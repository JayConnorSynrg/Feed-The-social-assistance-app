/**
 * SNAP Retailer Sync Edge Function
 *
 * Syncs USDA SNAP retailer locations from the ArcGIS FeatureServer
 * into the snap_retailers table for geospatial proximity queries.
 *
 * Usage:
 *   POST /snap-retailer-sync                   → full national sync
 *   POST /snap-retailer-sync?state=CA          → sync single state
 *   POST /snap-retailer-sync?full=true         → explicit full sync
 *
 * Authentication: requires x-sync-secret header matching SNAP_SYNC_SECRET env var,
 * OR a valid admin JWT in the Authorization header.
 *
 * Environment variables:
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 *   SNAP_SYNC_SECRET       — shared secret for admin trigger
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ARCGIS_BASE_URL =
  'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/SNAP_Retailer_Locations/FeatureServer/0/query'

const BATCH_SIZE = 2000 // ArcGIS max records per request
const INTER_BATCH_DELAY_MS = 1000 // 1 s pause between batches to avoid 429
const UPSERT_CHUNK_SIZE = 500 // rows per Supabase upsert call

// CORS — admin-only function, but keep consistent with project conventions
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
  'capacitor://localhost',
  'http://localhost',
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-sync-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArcGISAttributes {
  ObjectId: number
  Store_Name: string
  Store_Type?: string
  Address: string
  City: string
  State: string
  Zip5: string
  Longitude: number
  Latitude: number
  // Some datasets use alternate field names
  RETAILER_NAME?: string
  RETAILER_TYPE?: string
  ADDRESS?: string
  CITY?: string
  STATE?: string
  ZIP5?: string
  LONGITUDE?: number
  LATITUDE?: number
  // Incentive program field (may vary by dataset version)
  Incentive_Program?: string
  INCENTIVE_PROGRAM?: string
}

interface ArcGISFeature {
  attributes: ArcGISAttributes
}

interface ArcGISResponse {
  features: ArcGISFeature[]
  exceededTransferLimit?: boolean
}

interface SnapRetailerRow {
  retailer_id: string
  retailer_name: string
  retailer_type: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  location: string | null
  incentive_program: string | null
  last_synced_at: string
}

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

async function isAuthorized(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<boolean> {
  // Path 1: shared secret header
  const syncSecret = Deno.env.get('SNAP_SYNC_SECRET')
  if (syncSecret && req.headers.get('x-sync-secret') === syncSecret) {
    return true
  }

  // Path 2: admin JWT in Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    return profile?.is_admin === true
  }

  return false
}

// ---------------------------------------------------------------------------
// ArcGIS fetcher
// ---------------------------------------------------------------------------

async function fetchArcGISBatch(
  offset: number,
  stateFilter?: string
): Promise<ArcGISResponse> {
  const params = new URLSearchParams({
    where: stateFilter ? `State='${stateFilter}'` : '1=1',
    outFields: '*',
    resultOffset: String(offset),
    resultRecordCount: String(BATCH_SIZE),
    f: 'json',
  })

  const url = `${ARCGIS_BASE_URL}?${params.toString()}`
  const res = await fetch(url)

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ArcGIS HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()

  // ArcGIS returns an error object instead of features on query errors
  if (data.error) {
    throw new Error(
      `ArcGIS query error ${data.error.code}: ${data.error.message}`
    )
  }

  return data as ArcGISResponse
}

// ---------------------------------------------------------------------------
// Field mapper
// ---------------------------------------------------------------------------

function mapFeature(feature: ArcGISFeature, now: string): SnapRetailerRow | null {
  const a = feature.attributes

  const name = a.Store_Name || a.RETAILER_NAME
  const objectId = a.ObjectId

  if (!name || objectId == null) return null

  const longitude = a.Longitude ?? a.LONGITUDE
  const latitude = a.Latitude ?? a.LATITUDE

  // Build EWKT string for PostGIS geography column
  const location =
    longitude != null && latitude != null && !isNaN(longitude) && !isNaN(latitude)
      ? `SRID=4326;POINT(${longitude} ${latitude})`
      : null

  return {
    retailer_id: String(objectId),
    retailer_name: name,
    retailer_type: a.Store_Type ?? a.RETAILER_TYPE ?? null,
    address: a.Address ?? a.ADDRESS ?? null,
    city: a.City ?? a.CITY ?? null,
    state: a.State ?? a.STATE ?? null,
    zip_code: a.Zip5 ?? a.ZIP5 ?? null,
    location,
    incentive_program: a.Incentive_Program ?? a.INCENTIVE_PROGRAM ?? null,
    last_synced_at: now,
  }
}

// ---------------------------------------------------------------------------
// Upsert helper — chunks large arrays to stay within Supabase payload limits
// ---------------------------------------------------------------------------

async function upsertChunked(
  supabase: ReturnType<typeof createClient>,
  rows: SnapRetailerRow[]
): Promise<{ inserted: number; errors: number; messages: string[] }> {
  let inserted = 0
  let errors = 0
  const messages: string[] = []

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error } = await supabase
      .from('snap_retailers')
      .upsert(chunk, { onConflict: 'retailer_id', ignoreDuplicates: false })

    if (error) {
      errors += chunk.length
      messages.push(`Upsert chunk ${i}-${i + chunk.length}: ${error.message}`)
      console.error(`Upsert error at offset ${i}:`, error.message)
    } else {
      inserted += chunk.length
    }
  }

  return { inserted, errors, messages }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // ---- env validation ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }

    // ---- auth ----
    const authorized = await isAuthorized(req, supabaseUrl, supabaseServiceKey)
    if (!authorized) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ---- parse params ----
    const url = new URL(req.url)
    const stateFilter = url.searchParams.get('state')?.toUpperCase() || undefined
    // full=true is accepted for clarity but is the default when no state is provided
    const label = stateFilter ? `state=${stateFilter}` : 'full national'
    console.log(`[snap-retailer-sync] Starting sync: ${label}`)

    // ---- init Supabase service client ----
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ---- pagination loop ----
    let offset = 0
    let batchNum = 0
    let totalSynced = 0
    let totalErrors = 0
    let totalSkipped = 0
    const errorMessages: string[] = []

    let keepGoing = true
    while (keepGoing) {
      batchNum++
      console.log(`[snap-retailer-sync] Batch ${batchNum}: offset=${offset}`)

      const data = await fetchArcGISBatch(offset, stateFilter)
      const features = data.features ?? []

      if (features.length === 0) {
        console.log(`[snap-retailer-sync] Batch ${batchNum}: 0 features, done`)
        break
      }

      // Map + filter
      const now = new Date().toISOString()
      const rows: SnapRetailerRow[] = []
      for (const f of features) {
        const mapped = mapFeature(f, now)
        if (mapped) {
          rows.push(mapped)
        } else {
          totalSkipped++
        }
      }

      console.log(
        `[snap-retailer-sync] Batch ${batchNum}: ${features.length} features, ${rows.length} valid, ${features.length - rows.length} skipped`
      )

      // Upsert
      if (rows.length > 0) {
        const result = await upsertChunked(supabase, rows)
        totalSynced += result.inserted
        totalErrors += result.errors
        errorMessages.push(...result.messages)
      }

      // Check if more data is available
      keepGoing = data.exceededTransferLimit === true
      offset += features.length

      // Rate-limit pause between batches
      if (keepGoing) {
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
      }
    }

    const durationMs = Date.now() - startTime
    const result = {
      success: true,
      synced: totalSynced,
      errors: totalErrors,
      skipped: totalSkipped,
      batches: batchNum,
      duration_ms: durationMs,
      scope: stateFilter || 'national',
      ...(errorMessages.length > 0 ? { error_details: errorMessages } : {}),
    }

    console.log(`[snap-retailer-sync] Complete:`, JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[snap-retailer-sync] Fatal error after ${durationMs}ms:`, message)

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        duration_ms: durationMs,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
