/**
 * Sync 211 Edge Function
 *
 * Scheduled function to sync resources from the 211 API to our database.
 * Can be triggered via cron schedule or manually via HTTP request.
 *
 * Environment variables required:
 * - API_211_KEY: API key for 211 service
 * - API_211_BASE_URL: (optional) Base URL for 211 API
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'

// CORS headers for HTTP requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration
const PAGE_SIZE = 100
const MAX_PAGES = 10 // Limit total records per sync

// 211 API types
interface API211Location {
  id: string
  name: string
  description?: string
  address?: {
    address1?: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    county?: string
  }
  location?: {
    latitude?: number
    longitude?: number
  }
  phones?: Array<{
    number: string
    type?: string
  }>
  hours?: string | Record<string, string>
  website?: string
  email?: string
  services?: Array<{
    id: string
    name: string
    taxonomies?: Array<{
      id: string
      name: string
      parent?: string
    }>
  }>
  organization?: {
    id: string
    name: string
  }
  lastUpdated?: string
}

interface API211SearchResponse {
  results: API211Location[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Category mapping
const TAXONOMY_TO_CATEGORY: Record<string, string> = {
  'BD': 'food',
  'BD-1800': 'food',
  'BH': 'housing',
  'BH-1800': 'housing',
  'LF': 'healthcare',
  'RF': 'mental_health',
  'RX': 'substance_abuse',
  'ND': 'employment',
  'HH': 'education',
  'FT': 'legal',
  'BT': 'transportation',
  'BV': 'utilities',
  'BM': 'clothing',
  'NT': 'financial',
  'PH': 'childcare',
  'PS': 'senior_services',
  'LD': 'disability_services',
  'TD': 'veteran_services',
  'FN': 'domestic_violence',
  'FJ': 'immigration',
}

/**
 * Determines category from location data
 */
function determineCategory(location: API211Location): string {
  if (location.services) {
    for (const service of location.services) {
      if (service.taxonomies) {
        for (const taxonomy of service.taxonomies) {
          if (TAXONOMY_TO_CATEGORY[taxonomy.id]) {
            return TAXONOMY_TO_CATEGORY[taxonomy.id]
          }
          if (taxonomy.parent && TAXONOMY_TO_CATEGORY[taxonomy.parent]) {
            return TAXONOMY_TO_CATEGORY[taxonomy.parent]
          }
        }
      }
    }
  }
  return 'other'
}

/**
 * Normalizes phone number
 */
function normalizePhone(phones?: Array<{ number: string; type?: string }>): string | null {
  if (!phones || phones.length === 0) return null
  const phone = phones[0].number
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

/**
 * Transforms 211 location to our schema
 */
function transformLocation(location: API211Location) {
  return {
    external_id: location.id,
    external_source: '211',
    name: location.name,
    description: location.description || null,
    category: determineCategory(location),
    address_line1: location.address?.address1 || null,
    city: location.address?.city || null,
    state: location.address?.state || null,
    zip_code: location.address?.zip || null,
    phone: normalizePhone(location.phones),
    website: location.website || null,
    email: location.email || null,
    hours_of_operation: typeof location.hours === 'object' ? location.hours : null,
    latitude: location.location?.latitude || null,
    longitude: location.location?.longitude || null,
    organization_name: location.organization?.name || null,
    last_synced_at: new Date().toISOString(),
    status: 'approved',
  }
}

/**
 * Fetches data from 211 API
 */
async function fetch211Data(
  apiKey: string,
  baseUrl: string,
  page: number
): Promise<API211SearchResponse> {
  const url = `${baseUrl}/search?pageSize=${PAGE_SIZE}&page=${page}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`211 API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const apiKey = Deno.env.get('API_211_KEY')
    const baseUrl = Deno.env.get('API_211_BASE_URL') || 'https://api.211.org/v1'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!apiKey) {
      throw new Error('API_211_KEY not configured')
    }
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured')
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body for optional parameters
    let syncParams = { incremental: true }
    if (req.method === 'POST') {
      try {
        syncParams = await req.json()
      } catch {
        // Use defaults
      }
    }

    console.log('Starting 211 sync...', { incremental: syncParams.incremental })

    let totalSynced = 0
    let totalErrors = 0
    let page = 1
    let hasMore = true

    while (hasMore && page <= MAX_PAGES) {
      try {
        // Fetch page of data
        const data = await fetch211Data(apiKey, baseUrl, page)

        if (!data.results || data.results.length === 0) {
          hasMore = false
          break
        }

        // Transform and filter valid records
        const resources = data.results
          .map(transformLocation)
          .filter((r) => r.name && (r.latitude || r.city))

        if (resources.length > 0) {
          // Upsert to database (using external_id as unique key)
          const { error: upsertError } = await supabase
            .from('resources')
            .upsert(resources, {
              onConflict: 'external_id,external_source',
              ignoreDuplicates: false,
            })

          if (upsertError) {
            console.error('Upsert error:', upsertError)
            totalErrors += resources.length
          } else {
            totalSynced += resources.length
          }
        }

        hasMore = data.hasMore
        page++

        // Small delay between pages to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (pageError) {
        console.error(`Error on page ${page}:`, pageError)
        totalErrors++
        page++
      }
    }

    // Log sync completion
    const result = {
      success: true,
      synced: totalSynced,
      errors: totalErrors,
      pagesProcessed: page - 1,
      timestamp: new Date().toISOString(),
    }

    console.log('211 sync complete:', result)

    // Optionally store sync log
    await supabase.from('sync_logs').insert({
      source: '211',
      records_synced: totalSynced,
      errors: totalErrors,
      details: result,
    }).catch(() => {
      // sync_logs table may not exist
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
