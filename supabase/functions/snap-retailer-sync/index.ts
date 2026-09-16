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
 *   SNAP_RETAILER_URL      — (optional) national USDA SNAP retailer FeatureServer
 *                            layer URL; defaults to the pinned no-key national layer.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// National USDA SNAP retailer FeatureServer layer (no API key required).
// 251k+ records, maxRecordCount 1000, paginated via resultOffset/resultRecordCount.
// Overridable via SNAP_RETAILER_URL; the pinned default is the full national layer.
const SNAP_RETAILER_LAYER_URL =
  Deno.env.get('SNAP_RETAILER_URL') ||
  'https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0'

// Query endpoint derived from the layer URL (tolerates a trailing /query in the env value).
const ARCGIS_QUERY_URL = SNAP_RETAILER_LAYER_URL.replace(/\/query\/?$/, '') + '/query'

const BATCH_SIZE = 1000 // National endpoint maxRecordCount per request
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

// National USDA SNAP retailer schema (case-sensitive field names).
interface ArcGISAttributes {
  Record_ID?: number | string // stable USDA id → retailer_id (upsert key)
  Store_Name?: string
  Store_Street_Address?: string
  Additonal_Address?: string // USDA's misspelling — kept intentionally
  City?: string
  State?: string // 2-letter
  Zip_Code?: string | number // 5-digit
  Store_Type?: string
  Incentive_Program?: string
  Latitude?: number // WGS84
  Longitude?: number // WGS84
  ObjectId?: number
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

  const url = `${ARCGIS_QUERY_URL}?${params.toString()}`
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

  const name = a.Store_Name
  const recordId = a.Record_ID

  // Record_ID is the stable USDA id and the upsert key — a row without it is unusable.
  if (!name || recordId == null || String(recordId).trim() === '') return null

  const longitude = typeof a.Longitude === 'number' ? a.Longitude : Number(a.Longitude)
  const latitude = typeof a.Latitude === 'number' ? a.Latitude : Number(a.Latitude)

  // Build EWKT string for the PostGIS GEOGRAPHY(POINT,4326) column.
  // Drop the ocean-null (0,0) sentinel so bad rows never render on the map.
  const location =
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    (longitude !== 0 || latitude !== 0)
      ? `SRID=4326;POINT(${longitude} ${latitude})`
      : null

  // USDA splits the secondary address into the (misspelled) Additonal_Address field.
  const address =
    [a.Store_Street_Address, a.Additonal_Address]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(', ') || null

  const zip =
    a.Zip_Code != null && String(a.Zip_Code).trim() !== '' ? String(a.Zip_Code).trim() : null

  return {
    retailer_id: String(recordId),
    retailer_name: name,
    retailer_type: a.Store_Type ?? null,
    address,
    city: a.City ?? null,
    state: a.State ?? null,
    zip_code: zip,
    location,
    incentive_program: a.Incentive_Program ?? null,
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
    let totalFetched = 0
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

      totalFetched += features.length

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

      // National paging: a full page (== BATCH_SIZE) means more rows remain; a short
      // page is the last one. Honor exceededTransferLimit as a belt-and-suspenders signal.
      keepGoing = features.length >= BATCH_SIZE || data.exceededTransferLimit === true
      offset += features.length

      // Rate-limit pause between batches
      if (keepGoing) {
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
      }
    }

    const durationMs = Date.now() - startTime

    // Structured run-summary — the canonical {fetched, upserted, pages, errors} log line.
    const runSummary = {
      fetched: totalFetched,
      upserted: totalSynced,
      pages: batchNum,
      errors: totalErrors,
    }
    console.log(`[snap-retailer-sync] run-summary ${JSON.stringify(runSummary)}`)

    const result = {
      success: true,
      ...runSummary,
      synced: totalSynced,
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
