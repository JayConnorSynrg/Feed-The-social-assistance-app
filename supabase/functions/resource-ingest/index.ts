import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, createSyncLogger } from '../_shared/resource-pipeline.ts'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface IngestResource {
  name: string
  category?: string
  description?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  website?: string
  hours_of_operation?: Record<string, string>
  eligibility_requirements?: string
  services_offered?: string[]
  latitude?: number
  longitude?: number
  source_url?: string
  confidence?: 'high' | 'medium' | 'low'
}

interface IngestResult {
  success: boolean
  accepted: number
  rejected: number
  duplicates: number
  errors: string[]
  duration_ms: number
  timestamp: string
}

// ═══════════════════════════════════════════════════════════
// CORS — extends shared headers to allow x-agent-key
// ═══════════════════════════════════════════════════════════

function getIngestCorsHeaders(origin: string | null): Record<string, string> {
  const base = getCorsHeaders(origin)
  return {
    ...base,
    'Access-Control-Allow-Headers': base['Access-Control-Allow-Headers'] + ', x-agent-key',
  }
}

// ═══════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════

function validateResource(r: IngestResource): string | null {
  if (!r.name || r.name.trim().length < 2) return 'Name is required (min 2 chars)'
  if (r.phone) {
    const digits = r.phone.replace(/[^0-9]/g, '')
    if (digits.length < 7 || digits.length > 15) return `Invalid phone: ${r.phone}`
  }
  if (r.website && !r.website.match(/^https?:\/\/.+/)) return `Invalid URL: ${r.website}`
  if (r.email && !r.email.match(/^[^@]+@[^@]+\.[^@]+$/)) return `Invalid email: ${r.email}`
  return null
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone.trim()
}

function buildExternalId(name: string): string {
  return `agent_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`
}

// ═══════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getIngestCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Auth: validate agent key when AGENT_SYNC_SECRET is configured
  const agentKey = req.headers.get('x-agent-key')
  const expectedKey = Deno.env.get('AGENT_SYNC_SECRET')
  if (expectedKey && agentKey !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const logger = createSyncLogger('ingest')

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const resources: IngestResource[] = Array.isArray(body) ? body : (body.resources ?? [])

    if (resources.length === 0) {
      return new Response(JSON.stringify({ error: 'No resources provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    logger.log('fetch', { records_fetched: resources.length })

    let accepted = 0
    let rejected = 0
    let duplicates = 0
    const errors: string[] = []

    for (const resource of resources) {
      // Step 1: Validate
      const validationError = validateResource(resource)
      if (validationError) {
        errors.push(`${resource.name || 'unnamed'}: ${validationError}`)
        rejected++
        continue
      }

      // Step 2: Check for duplicates via SQL function
      const { data: dupes } = await supabase.rpc('find_duplicate_resource', {
        p_name: resource.name.trim(),
        p_phone: resource.phone || null,
        p_threshold: 0.4,
      })

      if (dupes && dupes.length > 0) {
        const best = dupes[0]
        const phoneMatch =
          resource.phone &&
          best.phone &&
          best.phone.replace(/[^0-9]/g, '') === resource.phone.replace(/[^0-9]/g, '')
        if (best.similarity_score >= 0.6 || phoneMatch) {
          duplicates++
          continue
        }
      }

      // Step 3: Upsert
      const row = {
        external_id: buildExternalId(resource.name),
        source: 'user_submitted',
        name: resource.name.trim(),
        category: resource.category || 'other',
        description: resource.description || null,
        address_line1: resource.address_line1 || null,
        city: resource.city || null,
        state: resource.state || null,
        zip_code: resource.zip_code || null,
        phone: normalizePhone(resource.phone),
        email: resource.email || null,
        website: resource.website || null,
        hours_of_operation: resource.hours_of_operation || null,
        eligibility_requirements: resource.eligibility_requirements || null,
        services_offered: resource.services_offered || null,
        status: resource.confidence === 'high' ? 'approved' : 'pending',
        is_verified: resource.confidence === 'high',
        last_verified_at: resource.confidence === 'high' ? new Date().toISOString() : null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('resources')
        .upsert(row, { onConflict: 'external_id,source', ignoreDuplicates: false })
        .select('id')
        .single()

      if (insertError) {
        errors.push(`${resource.name}: ${insertError.message}`)
        rejected++
        continue
      }

      // Step 4: Set PostGIS location if coordinates provided
      if (resource.latitude && resource.longitude && inserted?.id) {
        await supabase.rpc('set_resource_location_by_id', {
          p_id: inserted.id,
          p_lat: resource.latitude,
          p_lng: resource.longitude,
        })
      }

      accepted++
    }

    const result: IngestResult = {
      success: rejected === 0,
      accepted,
      rejected,
      duplicates,
      errors: errors.slice(0, 10),
      duration_ms: logger.elapsed(),
      timestamp: new Date().toISOString(),
    }

    logger.log('complete', {
      records_upserted: accepted,
      records_skipped: duplicates,
      records_errored: rejected,
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.log('error', { error: message })
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
