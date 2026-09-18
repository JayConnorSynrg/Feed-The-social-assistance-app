/**
 * Pure, portable decision logic for the geocode-backfill edge function.
 *
 * Deliberately dependency-free (no `Deno.serve`, no Deno-only imports, no
 * top-level side effects) so this module can be imported and unit-tested
 * under Node/vitest in addition to running under the Deno edge runtime via
 * a plain relative `./decision.ts` import.
 */

// Accuracy buckets we track for coverage/quality reporting.
// v6 `properties.coordinates.accuracy` values: rooftop | parcel | point |
// interpolated | approximate | street | (region/place fallbacks).
export type AccuracyBucket =
  | 'rooftop'
  | 'parcel'
  | 'point'
  | 'interpolated'
  | 'approximate'

export interface ResourceRow {
  id: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  /** Only present on rows returned by untagged_geocode_targets(); always NULL there by definition. */
  geocode_accuracy?: string | null
}

export interface MapboxBatchQuery {
  q: string
  country: string
  limit: number
  autocomplete: boolean
}

export interface MapboxFeature {
  geometry?: { coordinates?: [number, number] } // [lng, lat]
  properties?: {
    coordinates?: { accuracy?: string }
    match_code?: { confidence?: string }
  }
}

export interface MapboxFeatureCollection {
  features?: MapboxFeature[]
}

export interface MapboxBatchResponse {
  batch?: MapboxFeatureCollection[]
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
export function buildAddressQuery(row: ResourceRow): string | null {
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
export function bucketAccuracy(accuracy: string | undefined): AccuracyBucket {
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
// Coarse-mode write decision (INV-2)
// ---------------------------------------------------------------------------

export interface CoarseDecision {
  /** true  → move the pin (write lat/lng + tier as the new accuracy).
   *  false → keep the existing centroid, tag geocode_accuracy = 'approximate'. */
  isPreciseUpgrade: boolean
  tier: AccuracyBucket
  confidence: string | null
  /** Non-null only when isPreciseUpgrade is true. */
  lat: number | null
  lng: number | null
}

/**
 * INV-2 (move-only-on-strong-match): a target pin's location is OVERWRITTEN
 * (moved) IF AND ONLY IF the v6 result tier is rooftop/parcel/point AND
 * confidence is exact/high. For every other outcome — coarser tier,
 * medium/low confidence, no feature, or unusable coordinates — the existing
 * centroid is kept and the row is tagged 'approximate'.
 */
export function computeCoarseDecision(
  fc: MapboxFeatureCollection | undefined,
): CoarseDecision {
  const feature = fc?.features?.[0]
  const coords = feature?.geometry?.coordinates
  const hasValidCoords =
    !!feature &&
    !!coords &&
    coords.length >= 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1])

  const rawAccuracy = feature?.properties?.coordinates?.accuracy
  const confidence = feature?.properties?.match_code?.confidence ?? null
  const tier = bucketAccuracy(rawAccuracy)

  const isPreciseUpgrade =
    hasValidCoords &&
    (tier === 'rooftop' || tier === 'parcel' || tier === 'point') &&
    (confidence === 'exact' || confidence === 'high')

  return {
    isPreciseUpgrade,
    tier,
    confidence,
    lat: isPreciseUpgrade && coords ? coords[1] : null,
    lng: isPreciseUpgrade && coords ? coords[0] : null,
  }
}

// ---------------------------------------------------------------------------
// Coarse-mode per-row write resolution (FIX-1 + INV-2, unified)
// ---------------------------------------------------------------------------

export interface SetResourceGeocodeArgs {
  p_lat: number | null
  p_lng: number | null
  p_accuracy: string
  p_confidence: string | null
}

export interface CoarseWriteResult {
  action: 'upgraded' | 'tagged'
  /** Present only when tagged for a reason other than a plain weak Mapbox match. */
  reason?: 'no_address'
  rpcArgs: SetResourceGeocodeArgs
}

/**
 * Resolves the full per-row coarse-mode write for `set_resource_geocode`,
 * covering both:
 *   - FIX-1 (INV-1 completeness): a row with no usable address can never
 *     produce a Mapbox query at all. It is tagged 'approximate' directly
 *     (existing centroid kept) rather than silently skipped, so it never
 *     stays geocode_accuracy=NULL forever while still rendering as exact.
 *   - INV-2 (move-only-on-strong-match): an addressed row is resolved via
 *     computeCoarseDecision — moved only on a strong match, tagged
 *     'approximate' otherwise (coarser tier, weak confidence, no feature).
 * `fc` is ignored (and may be omitted) when the row has no address, since no
 * Mapbox call was ever made for it.
 */
export function resolveCoarseWrite(
  row: ResourceRow,
  fc: MapboxFeatureCollection | undefined,
): CoarseWriteResult {
  if (buildAddressQuery(row) === null) {
    return {
      action: 'tagged',
      reason: 'no_address',
      rpcArgs: { p_lat: null, p_lng: null, p_accuracy: 'approximate', p_confidence: null },
    }
  }

  const decision = computeCoarseDecision(fc)
  return {
    action: decision.isPreciseUpgrade ? 'upgraded' : 'tagged',
    rpcArgs: decision.isPreciseUpgrade
      ? {
          p_lat: decision.lat,
          p_lng: decision.lng,
          p_accuracy: decision.tier,
          p_confidence: decision.confidence,
        }
      : {
          p_lat: null,
          p_lng: null,
          p_accuracy: 'approximate',
          p_confidence: decision.confidence,
        },
  }
}

// ---------------------------------------------------------------------------
// Bounded-concurrency task pool (FIX-3: keep a single coarse run — up to
// ~1,123 rows — under the edge function's wall-clock budget by overlapping
// independent per-row writes, without changing the Mapbox-batch-call or
// window-alignment logic above).
// ---------------------------------------------------------------------------

/**
 * Runs `tasks` with at most `concurrency` in flight at once and awaits all of
 * them. Every task is expected to catch its own errors internally (as every
 * caller here does) — this pool does not short-circuit on a task throwing.
 * Task COUNT and eventual completion are identical to running them serially;
 * only wall-clock overlap changes.
 */
export async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  if (tasks.length === 0) return
  let cursor = 0
  const workerCount = Math.max(1, Math.min(concurrency, tasks.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < tasks.length) {
      const idx = cursor++
      await tasks[idx]()
    }
  })
  await Promise.all(workers)
}

// ---------------------------------------------------------------------------
// Paged RPC fetch (PR-4 limit-cap fix)
//
// Root cause: the Supabase project's API "Max Rows" setting is a hard
// PostgREST db-max-rows cap (observed = 1000) that truncates ANY single
// response — including a table-returning RPC call — to that many rows,
// regardless of the function's own internal SQL LIMIT or a supabase-js
// .limit()/.range() call requesting more in one shot. `?target=coarse&limit=
// 1200` in prod (PR-3) silently came back as 1000 rows for exactly this
// reason — COARSE_MAX_LIMIT=1500 (an application-level clamp) was never the
// bottleneck; the platform-level cap downstream of it was.
//
// Fix: page. Each individual request asks for <=pageSize rows (a caller-
// supplied fetchPage callback so this stays decoupled from the Supabase
// client and unit-testable), which respects the hard cap, and we issue
// repeated sequential requests against the SAME deterministic (ORDER BY id,
// STABLE) underlying result set until `limit` rows are collected or a short
// page proves the target set is exhausted.
// ---------------------------------------------------------------------------
export async function pageThroughRpc<T>(
  fetchPage: (offset: number, pageEnd: number) => Promise<T[]>,
  limit: number,
  pageSize: number,
): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  while (offset < limit) {
    const pageEnd = Math.min(offset + pageSize, limit) - 1
    const page = await fetchPage(offset, pageEnd)
    rows.push(...page)
    const requested = pageEnd - offset + 1
    if (page.length < requested) break // short page → target set exhausted
    offset += pageSize
  }
  return rows
}
