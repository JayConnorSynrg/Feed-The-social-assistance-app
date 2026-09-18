// supabase/functions/_shared/mapbox-v6.ts
//
// Minimal, pure Mapbox Geocoding API v6 forward-geocode helper for
// resource-discover's write-time geocode stamp.
//
// Deliberately dependency-free (no Supabase client, no Deno-only imports
// beyond global `fetch`, no top-level side effects) so this module can be
// imported and unit-tested under Node/vitest in addition to running under
// the Deno edge runtime.
//
// This is an independent copy of the accuracy/confidence classification
// already proven in `supabase/functions/geocode-backfill/decision.ts` (v6
// batch endpoint, INV-2 move-only-on-strong-match gate). It is NOT imported
// by geocode-backfill and does NOT refactor it — that already-shipped path
// stays untouched.

// Mapbox Geocoding API v6 (2026) single-query forward endpoint.
const MAPBOX_FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward'

// v6 `properties.coordinates.accuracy` values: rooftop | parcel | point |
// interpolated | approximate | street | (region/place fallbacks) — all
// non-tracked values bucket to 'approximate'.
export type GeocodeAccuracyTier =
  | 'rooftop'
  | 'parcel'
  | 'point'
  | 'interpolated'
  | 'approximate'

export interface GeocodeForwardResult {
  lat: number
  lng: number
  /** Bucketed v6 `properties.coordinates.accuracy` tier. */
  tier: GeocodeAccuracyTier
  /** Raw v6 `properties.match_code.confidence` (exact|high|medium|low), or null. */
  confidence: string | null
}

interface MapboxV6Feature {
  geometry?: { coordinates?: [number, number] } // [lng, lat]
  properties?: {
    coordinates?: { accuracy?: string }
    match_code?: { confidence?: string }
  }
}

interface MapboxV6ForwardResponse {
  features?: MapboxV6Feature[]
}

/** Normalize an arbitrary Mapbox v6 accuracy string into a tracked tier. */
export function bucketAccuracyTier(accuracy: string | undefined): GeocodeAccuracyTier {
  switch (accuracy) {
    case 'rooftop':
      return 'rooftop'
    case 'parcel':
      return 'parcel'
    case 'point':
      return 'point'
    case 'interpolated':
      return 'interpolated'
    default:
      return 'approximate'
  }
}

/**
 * Forward-geocodes a single free-text address query against Mapbox's v6
 * structured Geocoding API. Returns null on any failure (network error,
 * non-OK response, no feature, unusable coordinates) — callers degrade to
 * their own fallback (e.g. ZIP-centroid). Never throws.
 */
export async function geocodeForwardV6(
  query: string,
  token: string,
): Promise<GeocodeForwardResult | null> {
  const q = query.trim()
  if (!q || !token) return null
  try {
    const url =
      `${MAPBOX_FORWARD_URL}?q=${encodeURIComponent(q)}` +
      `&access_token=${encodeURIComponent(token)}&country=US&types=address&limit=1`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const json = (await resp.json()) as MapboxV6ForwardResponse
    const feature = json.features?.[0]
    const coords = feature?.geometry?.coordinates
    const hasValidCoords =
      !!feature &&
      !!coords &&
      coords.length >= 2 &&
      Number.isFinite(coords[0]) &&
      Number.isFinite(coords[1])
    if (!hasValidCoords || !coords) return null
    return {
      lng: coords[0],
      lat: coords[1],
      tier: bucketAccuracyTier(feature.properties?.coordinates?.accuracy),
      confidence: feature.properties?.match_code?.confidence ?? null,
    }
  } catch {
    return null
  }
}

export interface GeocodeWriteClassification {
  /** Value to stamp into resources.geocode_accuracy. Never null. */
  accuracy: GeocodeAccuracyTier
  /** true only when the result meets the strong-match bar (life-safety gate). */
  moved: boolean
}

/**
 * Life-safety-style classification gate mirroring geocode-backfill's
 * `computeCoarseDecision` / INV-2: a result is tagged with its raw precise
 * tier ONLY when BOTH the tier is rooftop/parcel/point AND confidence is
 * exact/high. Every weaker outcome (coarser tier, medium/low confidence) is
 * tagged 'approximate' — never left untagged — so a coarse or low-confidence
 * match never renders as a solid, precise pin.
 */
export function classifyGeocodeWrite(
  tier: GeocodeAccuracyTier,
  confidence: string | null,
): GeocodeWriteClassification {
  const strong =
    (tier === 'rooftop' || tier === 'parcel' || tier === 'point') &&
    (confidence === 'exact' || confidence === 'high')
  return { accuracy: strong ? tier : 'approximate', moved: strong }
}
