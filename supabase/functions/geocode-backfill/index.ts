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
 * Usage (default / null-location mode — UNCHANGED from the original coverage
 * backfill; every candidate here has location IS NULL, so every geocode result
 * IS written, coarse or precise):
 *   POST /geocode-backfill                 → up to `limit` (default 200) candidates
 *   POST /geocode-backfill  { "limit": 50 } (JSON body) or ?limit=50 (query)
 *
 * Usage (untagged mode — PR-4, orphan-proof closure: re-geocode EVERY
 * approved+located pin that carries geocode_accuracy IS NULL, not just the
 * ~1,123 that collided on a shared zip-centroid coordinate. Selection is by
 * the row's OWN accuracy, not by collision, so processing any row can never
 * de-select any other row — repeated invocations converge to zero remaining
 * untagged pins with no orphans):
 *   POST /geocode-backfill?target=untagged&limit=2000
 *   Candidates come from untagged_geocode_targets() (20260923000000), which
 *   supersedes and replaces coarse_geocode_targets() (PR-3, dropped in the
 *   same migration — accuracy-based selection is a strict superset). Per
 *   row, the pin is MOVED only on a strong match (tier rooftop/parcel/point
 *   AND confidence exact/high — see decision.ts computeCoarseDecision);
 *   every other outcome keeps the existing centroid and tags geocode_accuracy
 *   = 'approximate'. A target row is never left with geocode_accuracy still
 *   NULL after a successfully-processed batch.
 *
 * Authentication: requires x-backfill-secret header matching BACKFILL_SECRET env
 * var (server-to-server / admin trigger only). Deploy with --no-verify-jwt; this
 * in-code check is the gate.
 *
 * Idempotent + re-runnable: default mode only SELECTs rows where location IS
 * NULL, so a row that already has a location is never touched. Untagged mode
 * only selects rows where geocode_accuracy IS NULL, so a row already
 * upgraded or tagged drops out of the target set on the next run.
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
import {
  buildAddressQuery,
  bucketAccuracy,
  pageThroughRpc,
  resolveCoarseWrite,
  runWithConcurrency,
  type AccuracyBucket,
  type MapboxBatchQuery,
  type MapboxBatchResponse,
  type MapboxFeatureCollection,
  type ResourceRow,
} from './decision.ts'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FN = 'geocode-backfill'

// Mapbox Geocoding v6 (2026): server-side forward geocoding, no referer needed.
// Docs (append current year): "Mapbox Geocoding API v6 batch 2026".
const MAPBOX_BATCH_URL = 'https://api.mapbox.com/search/geocode/v6/batch'

const DEFAULT_LIMIT = 200 // covers the ~33 now + headroom
const MAX_LIMIT = 1000 // hard ceiling to keep a single (default-mode) run bounded
// PR-4: untagged mode is orphan-proof by construction (INV-A — selection is
// by the row's OWN accuracy, never by a collision computed across rows), so
// unlike the superseded coarse mode there is no correctness reason to cover
// the whole population in one snapshot. The cap is chosen purely for edge
// wall-clock safety: a 1,000-row coarse run measured ~18s in prod, so 4,000
// stays comfortably inside the edge function's wall-clock budget while
// cutting the number of runs needed to close the ~18,004-row population.
const UNTAGGED_DEFAULT_LIMIT = 4000
const UNTAGGED_MAX_LIMIT = 4000
// FIX (limit-cap root cause, see fetchTargetsPaged below): the Supabase
// project's API "Max Rows" setting is a hard PostgREST db-max-rows cap
// (observed = 1000) that truncates ANY single response — including a
// table-returning RPC call — regardless of the function's own SQL LIMIT or
// a supabase-js .limit() requesting more. Page in chunks of this size.
const RPC_PAGE_SIZE = 1000
const MAPBOX_BATCH_MAX = 50 // v6 batch accepts up to 50 queries per call
const FETCH_TIMEOUT_MS = 20_000 // per Mapbox batch call
const UNTAGGED_WRITE_CONCURRENCY = 8 // FIX-3: bounded-concurrency pool for the independent per-row writes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TargetMode = 'null_location' | 'untagged'

interface BackfillSummary {
  candidates: number
  geocoded: number
  by_accuracy: Record<AccuracyBucket, number>
  skipped_no_result: number
  errors: number
  // Untagged mode only (target=untagged): move-vs-tag decision counts + the
  // size of the target population fetched this run. Omitted entirely in
  // default (null-location) mode so that response shape is unchanged (INV-D).
  upgraded?: number
  tagged?: number
  target_count?: number
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
// Paged RPC fetch (limit-cap fix) — see RPC_PAGE_SIZE above for root cause.
// Thin Supabase-specific wrapper around decision.ts's pure pageThroughRpc:
// each page is one .rpc(...).range(offset, pageEnd) call, which respects the
// platform's hard db-max-rows cap even when `limit` exceeds it.
// ---------------------------------------------------------------------------
async function fetchTargetsPaged(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  rpcName: string,
  limit: number,
): Promise<ResourceRow[]> {
  return pageThroughRpc<ResourceRow>(
    async (offset, pageEnd) => {
      const { data, error } = await supabase
        .rpc(rpcName, { p_limit: limit })
        .range(offset, pageEnd)
      if (error) {
        throw new Error(`${rpcName} RPC failed: ${error.message}`)
      }
      return (data ?? []) as ResourceRow[]
    },
    limit,
    RPC_PAGE_SIZE,
  )
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

    const url = new URL(req.url)

    // ---- parse target mode (query param only; defaults to the original
    // null-location behavior so INV-3 holds with zero body-parsing risk).
    // Parsed BEFORE limit so the mode-specific default/ceiling below can use it. ----
    const targetParam = (
      url.searchParams.get('target') ?? url.searchParams.get('mode') ?? ''
    ).trim()
    const targetMode: TargetMode = targetParam === 'untagged' ? 'untagged' : 'null_location'

    // ---- parse limit (query param or JSON body) ----
    // Default-mode default/ceiling (200 / 1000) are UNCHANGED (INV-D) — this
    // branch only takes effect when targetMode === 'untagged'.
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
    if (!Number.isFinite(limit) || limit <= 0) {
      limit = targetMode === 'untagged' ? UNTAGGED_DEFAULT_LIMIT : DEFAULT_LIMIT
    }
    limit = Math.min(
      Math.floor(limit),
      targetMode === 'untagged' ? UNTAGGED_MAX_LIMIT : MAX_LIMIT,
    )

    edgeLog('info', 'geocode-backfill.request.start', { limit, target: targetMode })

    // ---- init service client ----
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ---- SELECT only rows needing coverage (idempotent invariant) ----
    // Default mode (INV-D, UNCHANGED): status='approved' AND location IS NULL
    // AND address_line1 IS NOT NULL, ordered stably by id.
    // Untagged mode (PR-4, INV-A orphan-proof): status='approved' AND
    // location IS NOT NULL AND geocode_accuracy IS NULL — no collision
    // check, so selection depends only on the row's own accuracy — via
    // untagged_geocode_targets() (20260923000000), paged past the
    // platform's hard row cap by fetchTargetsPaged.
    let candidates: ResourceRow[]
    if (targetMode === 'untagged') {
      candidates = await fetchTargetsPaged(
        supabase,
        'untagged_geocode_targets',
        limit,
      )
    } else {
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
      candidates = (rows ?? []) as ResourceRow[]
    }

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
    if (targetMode === 'untagged') {
      summary.upgraded = 0
      summary.tagged = 0
      summary.target_count = candidates.length
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

    // ---- untagged-mode per-row write task (closure over supabase/summary) ----
    // Unifies FIX-1 (address-less rows: tagged directly, no Mapbox call
    // possible) and INV-B (addressed rows: moved only on a strong match) via
    // the single pure decision function resolveCoarseWrite — see decision.ts.
    // `fc` is omitted for address-less rows (resolveCoarseWrite ignores it
    // once buildAddressQuery(row) is null). Returns a zero-arg task function
    // so callers can queue it into the bounded-concurrency pool (FIX-3)
    // without awaiting immediately.
    function untaggedWriteTask(
      row: ResourceRow,
      fc: MapboxFeatureCollection | undefined,
    ): () => Promise<void> {
      return async () => {
        try {
          const result = resolveCoarseWrite(row, fc)

          const { error: rpcError } = await supabase.rpc('set_resource_geocode', {
            p_id: row.id,
            ...result.rpcArgs,
          })

          if (rpcError) {
            summary.errors++
            edgeLog('error', 'geocode-backfill.write.failed', {
              resource_id: row.id,
              message: rpcError.message,
            })
            return
          }

          if (result.action === 'upgraded') {
            summary.geocoded++
            summary.upgraded = (summary.upgraded ?? 0) + 1
            summary.by_accuracy[result.rpcArgs.p_accuracy as AccuracyBucket]++
          } else {
            summary.tagged = (summary.tagged ?? 0) + 1
            summary.by_accuracy.approximate++
          }

          edgeLog('info', 'geocode-backfill.untagged.decision', {
            resource_id: row.id,
            tier: result.rpcArgs.p_accuracy,
            confidence: result.rpcArgs.p_confidence,
            action: result.action,
            ...(result.reason ? { reason: result.reason } : {}),
          })
        } catch (err) {
          // One bad row never aborts the pool.
          summary.errors++
          edgeLog('error', 'geocode-backfill.row.failed', {
            resource_id: row.id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    // ---- process in Mapbox-batch-sized windows (≤50 per call) ----
    for (let i = 0; i < candidates.length; i += MAPBOX_BATCH_MAX) {
      const window = candidates.slice(i, i + MAPBOX_BATCH_MAX)

      if (targetMode === 'untagged') {
        // ---- untagged mode ----
        // Split the window: rows with a usable address go through Mapbox;
        // rows with no usable address (FIX-1) can never produce a Mapbox
        // query at all and are tagged directly. Both kinds of write are
        // independent per-row RPC calls, so they share one bounded-
        // concurrency pool (FIX-3) — the Mapbox-batch call and the
        // positional-alignment guard below are UNCHANGED and still run
        // strictly before any write for the addressed rows.
        const addressed: { row: ResourceRow; query: MapboxBatchQuery }[] = []
        const writeTasks: Array<() => Promise<void>> = []

        for (const row of window) {
          const q = buildAddressQuery(row)
          if (!q) {
            // FIX-1: no usable address → no Mapbox call possible → tag
            // directly (resolveCoarseWrite short-circuits on no-address).
            writeTasks.push(untaggedWriteTask(row, undefined))
            continue
          }
          addressed.push({
            row,
            query: {
              q,
              country: (row.country ?? 'us').toLowerCase() || 'us',
              limit: 1,
              autocomplete: false,
            },
          })
        }

        if (addressed.length > 0) {
          // ---- Mapbox batch call (graceful on non-200) ----
          let batchResults: MapboxFeatureCollection[] | null = null
          try {
            batchResults = await geocodeBatch(
              addressed.map((b) => b.query),
              mapboxToken,
            )
          } catch (err) {
            // Whole batch failed — count each addressed row as an error.
            // Left geocode_accuracy NULL: stays in the target set, retried
            // on the next run (INV-1's error carve-out — errored rows were
            // never "successfully processed").
            summary.errors += addressed.length
            edgeLog('error', 'geocode-backfill.mapbox.batch_failed', {
              batch_index: i,
              count: addressed.length,
              message: err instanceof Error ? err.message : String(err),
            })
          }

          if (batchResults) {
            // ---- life-safety guard (reviewer Note A): reject a length-
            // misaligned window — UNCHANGED. Mapbox v6 batch contract
            // returns one featurecollection per query, in order; if counts
            // disagree, positional matching could write the WRONG
            // coordinates. Skip the whole addressed set — a counted miss
            // is safe, a silent wrong-pin is not.
            if (batchResults.length !== addressed.length) {
              summary.errors += addressed.length
              edgeLog('warn', 'geocode-backfill.batch.length_mismatch', {
                expected: addressed.length,
                got: batchResults.length,
              })
            } else {
              for (let j = 0; j < addressed.length; j++) {
                writeTasks.push(
                  untaggedWriteTask(addressed[j].row, batchResults[j]),
                )
              }
            }
          }
        }

        // ---- FIX-3: bounded-concurrency pool for the independent per-row
        // writes queued above (tag-only + decision-based). ----
        await runWithConcurrency(writeTasks, UNTAGGED_WRITE_CONCURRENCY)
        continue
      }

      // ---- default (null-location) mode: UNCHANGED (INV-3) ----
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
