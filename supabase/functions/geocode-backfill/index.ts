/**
 * Geocode Backfill Edge Function (life-safety coverage backfill)
 *
 * Geocodes APPROVED resources that have a street address but a NULL `location`,
 * so they finally render on the map. Targets the ~33 addressed-but-null approved
 * rows first (incl. real Rutland housing orgs: NeighborWorks, BROC, Rutland
 * Housing Authority, Open Door Mission).
 *
 * Coverage-over-invisibility policy: even a coarse (zip-centroid / approximate)
 * result IS written — but tagged with its TRUE accuracy so the UI can flag it as
 * approximate. A coarse point is NEVER written as if it were rooftop.
 *
 * Usage:
 *   POST /geocode-backfill                 → up to `limit` (default 200) candidates
 *   POST /geocode-backfill  { "limit": 50 } (JSON body) or ?limit=50 (query)
 *
 * Authentication: requires x-backfill-secret header matching BACKFILL_SECRET env
 * var (server-to-server / admin trigger only). Deploy with --no-verify-jwt; this
 * in-code check is the gate.
 *
 * Idempotent + re-runnable: it only SELECTs rows where location IS NULL, so a row
 * that already has a location is never touched, and a second run finds fewer/zero
 * rows.
 *
 * Environment variables:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS; used for SELECT + RPC)
 *   MAPBOX_TOKEN              — Mapbox server-side token (Geocoding v6 forward/batch)
 *   BACKFILL_SECRET          — shared secret required in x-backfill-secret header
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { edgeLog } from '../_shared/log.ts'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FN = 'geocode-backfill'

// Mapbox Geocoding v6 (2026): server-side forward geocoding, no referer needed.
// Docs (append current year): "Mapbox Geocoding API v6 batch 2026".
const MAPBOX_BATCH_URL = 'https://api.mapbox.com/search/geocode/v6/batch'

const DEFAULT_LIMIT = 200 // covers the ~33 now + headroom
const MAX_LIMIT = 1000 // hard ceiling to keep a single run bounded
const MAPBOX_BATCH_MAX = 50 // v6 batch accepts up to 50 queries per call
const FETCH_TIMEOUT_MS = 20_000 // per Mapbox batch call

// Accuracy buckets we track for coverage/quality reporting.
// v6 `properties.coordinates.accuracy` values: rooftop | parcel | point |
// interpolated | approximate | street | (region/place fallbacks).
type AccuracyBucket =
  | 'rooftop'
  | 'parcel'
  | 'point'
  | 'interpolated'
  | 'approximate'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResourceRow {
  id: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
}

interface MapboxBatchQuery {
  types?: string[]
  q: string
  country: string
  limit: number
  autocomplete: boolean
}

interface MapboxFeature {
  geometry?: { coordinates?: [number, number] } // [lng, lat]
  properties?: {
    coordinates?: { accuracy?: string }
    match_code?: { confidence?: string }
  }
}

interface MapboxFeatureCollection {
  features?: MapboxFeature[]
}

interface MapboxBatchResponse {
  batch?: MapboxFeatureCollection[]
}

interface BackfillSummary {
  candidates: number
  geocoded: number
  by_accuracy: Record<AccuracyBucket, number>
  skipped_no_result: number
  errors: number
}

// ---------------------------------------------------------------------------
// Query construction — build a single-line address string per Mapbox v6 guidance.
// ---------------------------------------------------------------------------

/**
 * Compose the forward-geocode query string from the structured address columns:
 *   address_line1[, address_line2], city, state zip_code
 * Empty parts are dropped so a missing unit/zip never injects stray commas.
 * Returns null when there is nothing meaningful to geocode.
 */
function buildAddressQuery(row: ResourceRow): string | null {
  const street = [row.address_line1, row.address_line2]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')

  const cityStateZip = [
    (row.city ?? '').trim(),
    [(row.state ?? '').trim(), (row.zip_code ?? '').trim()]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const q = [street, cityStateZip].filter(Boolean).join(', ').trim()
  return q.length > 0 ? q : null
}

/** Normalize an arbitrary Mapbox accuracy string into one of our tracked buckets. */
function bucketAccuracy(accuracy: string | undefined): AccuracyBucket {
  switch (accuracy) {
    case 'rooftop':
      return 'rooftop'
    case 'parcel':
      return 'parcel'
    case 'point':
      return 'point'
    case 'interpolated':
      return 'interpolated'
    // street / place / region / postcode / null → treated as approximate coverage.
    default:
      return 'approximate'
  }
}

// ---------------------------------------------------------------------------
// Mapbox v6 batch call — up to 50 queries, returns featurecollections in order.
// ---------------------------------------------------------------------------

async function geocodeBatch(
  queries: MapboxBatchQuery[],
  token: string,
): Promise<MapboxFeatureCollection[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(
      `${MAPBOX_BATCH_URL}?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queries),
        signal: controller.signal,
      },
    )

    if (!res.ok) {
      const body = await res.text()
      // Non-200: surface a bounded message; the caller counts this as errors and continues.
      throw new Error(`Mapbox HTTP ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = (await res.json()) as MapboxBatchResponse
    return data.batch ?? []
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, FN)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    // ---- env validation ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mapboxToken = Deno.env.get('MAPBOX_TOKEN')
    const backfillSecret = Deno.env.get('BACKFILL_SECRET')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }
    if (!mapboxToken) {
      throw new Error('MAPBOX_TOKEN is required')
    }

    // ---- auth gate: constant-shape secret header check ----
    // If BACKFILL_SECRET is unset, fail closed (never publicly triggerable).
    const provided = req.headers.get('x-backfill-secret')
    if (!backfillSecret || !provided || provided !== backfillSecret) {
      edgeLog('warn', 'geocode-backfill.auth.rejected', {
        has_secret_configured: Boolean(backfillSecret),
        has_header: Boolean(provided),
      })
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: jsonHeaders },
      )
    }

    // ---- parse limit (query param or JSON body) ----
    const url = new URL(req.url)
    let limit = Number(url.searchParams.get('limit'))
    if (!Number.isFinite(limit) || limit <= 0) {
      // Fall back to JSON body if present.
      try {
        const body = await req.json()
        if (body && Number.isFinite(Number(body.limit))) {
          limit = Number(body.limit)
        }
      } catch {
        // no/invalid body — keep default
      }
    }
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
    limit = Math.min(Math.floor(limit), MAX_LIMIT)

    edgeLog('info', 'geocode-backfill.request.start', { limit })

    // ---- init service client ----
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ---- SELECT only rows needing coverage (idempotent invariant) ----
    // status='approved' AND location IS NULL AND address_line1 IS NOT NULL,
    // ordered stably by id so repeated runs are deterministic.
    const { data: rows, error: selectError } = await supabase
      .from('resources')
      .select(
        'id, address_line1, address_line2, city, state, zip_code, country',
      )
      .eq('status', 'approved')
      .is('location', null)
      .not('address_line1', 'is', null)
      .order('id', { ascending: true })
      .limit(limit)

    if (selectError) {
      throw new Error(`resources SELECT failed: ${selectError.message}`)
    }

    const candidates = (rows ?? []) as ResourceRow[]

    const summary: BackfillSummary = {
      candidates: candidates.length,
      geocoded: 0,
      by_accuracy: {
        rooftop: 0,
        parcel: 0,
        point: 0,
        interpolated: 0,
        approximate: 0,
      },
      skipped_no_result: 0,
      errors: 0,
    }

    if (candidates.length === 0) {
      edgeLog('info', 'geocode-backfill.request.complete', {
        ...summary,
        duration_ms: Date.now() - startTime,
      })
      return new Response(
        JSON.stringify({ success: true, ...summary, duration_ms: Date.now() - startTime }),
        { headers: jsonHeaders },
      )
    }

    // ---- process in Mapbox-batch-sized windows (≤50 per call) ----
    for (let i = 0; i < candidates.length; i += MAPBOX_BATCH_MAX) {
      const window = candidates.slice(i, i + MAPBOX_BATCH_MAX)

      // Build queries; rows with no usable address string are skipped up front.
      const built: { row: ResourceRow; query: MapboxBatchQuery }[] = []
      for (const row of window) {
        const q = buildAddressQuery(row)
        if (!q) {
          summary.skipped_no_result++
          continue
        }
        built.push({
          row,
          query: {
            q,
            country: (row.country ?? 'us').toLowerCase() || 'us',
            limit: 1,
            autocomplete: false,
          },
        })
      }

      if (built.length === 0) continue

      // ---- Mapbox batch call (graceful on non-200) ----
      let batchResults: MapboxFeatureCollection[]
      try {
        batchResults = await geocodeBatch(
          built.map((b) => b.query),
          mapboxToken,
        )
      } catch (err) {
        // Whole batch failed — count each row as an error and continue.
        summary.errors += built.length
        edgeLog('error', 'geocode-backfill.mapbox.batch_failed', {
          batch_index: i,
          count: built.length,
          message: err instanceof Error ? err.message : String(err),
        })
        continue
      }

      // ---- life-safety guard (reviewer Note A): reject a length-misaligned window ----
      // Mapbox v6 batch contract returns one featurecollection per query, in order.
      // If the counts disagree, positional matching (batchResults[j] ↔ built[j]) could
      // write the WRONG coordinates to a resource. Treat the entire window as errors and
      // skip it — a counted miss is safe; a silent wrong-pin is not.
      if (batchResults.length !== built.length) {
        summary.errors += built.length
        edgeLog('warn', 'geocode-backfill.batch.length_mismatch', {
          expected: built.length,
          got: batchResults.length,
        })
        continue
      }

      // ---- per-row: parse feature + write (per-row try/catch) ----
      for (let j = 0; j < built.length; j++) {
        const { row } = built[j]
        const fc = batchResults[j]
        try {
          const feature = fc?.features?.[0]
          const coords = feature?.geometry?.coordinates
          if (!feature || !coords || coords.length < 2) {
            // Ungeocodable → leave location null, count, continue.
            summary.skipped_no_result++
            continue
          }

          const [lng, lat] = coords
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            summary.skipped_no_result++
            continue
          }

          const rawAccuracy = feature.properties?.coordinates?.accuracy
          const confidence = feature.properties?.match_code?.confidence ?? null
          const bucket = bucketAccuracy(rawAccuracy)

          // WRITE POLICY: write the point with its TRUE accuracy tag (coverage-over-
          // invisibility). A coarse result is stored as approximate, never as rooftop.
          const { error: rpcError } = await supabase.rpc('set_resource_geocode', {
            p_id: row.id,
            p_lat: lat,
            p_lng: lng,
            p_accuracy: rawAccuracy ?? 'approximate',
            p_confidence: confidence,
          })

          if (rpcError) {
            summary.errors++
            edgeLog('error', 'geocode-backfill.write.failed', {
              resource_id: row.id,
              message: rpcError.message,
            })
            continue
          }

          summary.geocoded++
          summary.by_accuracy[bucket]++
        } catch (err) {
          // One bad row never aborts the batch.
          summary.errors++
          edgeLog('error', 'geocode-backfill.row.failed', {
            resource_id: row.id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const duration_ms = Date.now() - startTime

    // ---- OPTIMIZATION LOGGING: structured summary (no secrets) ----
    edgeLog('info', 'geocode-backfill.request.complete', {
      ...summary,
      duration_ms,
    })

    return new Response(
      JSON.stringify({ success: true, ...summary, duration_ms }),
      { headers: jsonHeaders },
    )
  } catch (error) {
    const duration_ms = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'
    edgeLog('error', 'geocode-backfill.fatal', { message, duration_ms })

    return new Response(
      JSON.stringify({ success: false, error: message, duration_ms }),
      { status: 500, headers: jsonHeaders },
    )
  }
})
