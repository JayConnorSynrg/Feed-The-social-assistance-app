// Mapbox Geocoding v6 forward-geocode client + classification, used by the
// admin resource edit dialog (resource-edit-dialog.tsx) to stamp
// geocode_accuracy/geocode_confidence in the SAME atomic write as a
// re-geocoded location, instead of leaving the row untagged until the next
// geocode-backfill cadence run.
//
// Mirrors the move-only-on-strong-match classification already used by the
// geocode-backfill edge function (supabase/functions/geocode-backfill/
// decision.ts computeCoarseDecision) so both paths agree on what counts as
// a precise (solid-pin) tier vs an approximate (hollow-pin) one — see
// PRECISE_GEOCODE_TIERS in geocode-accuracy.ts, the single source of truth
// for the tier set.
import { PRECISE_GEOCODE_TIERS } from './geocode-accuracy'

export interface MapboxV6Feature {
  geometry?: { coordinates?: [number, number] } // [lng, lat]
  properties?: {
    coordinates?: { accuracy?: string }
    match_code?: { confidence?: string }
  }
}

export interface MapboxV6Response {
  features?: MapboxV6Feature[]
}

export interface GeocodeMatch {
  lat: number
  lng: number
  /** 'rooftop' | 'parcel' | 'point' on a strong match; 'approximate' otherwise. */
  accuracy: string
  /** v6 match_code.confidence when a feature was returned ('exact'|'high'|'medium'|'low'); 'low' when the feature carried none. */
  confidence: string
}

const STRONG_CONFIDENCE = new Set(['exact', 'high'])

/**
 * Pure classification of a single v6 feature. Returns null only when the
 * feature carries no usable coordinate (no feature at all, or a malformed
 * geometry) — the caller treats that the same as a failed geocode and never
 * writes a location. Any feature with valid coordinates classifies as either
 * a strong (precise-tier) match or a weak one (tagged 'approximate'), and
 * either way its coordinate is the "best-effort" location to store.
 */
export function classifyV6Feature(feature: MapboxV6Feature | undefined): GeocodeMatch | null {
  const coords = feature?.geometry?.coordinates
  const hasValidCoords =
    !!feature
    && Array.isArray(coords)
    && coords.length === 2
    && Number.isFinite(coords[0])
    && Number.isFinite(coords[1])
  if (!hasValidCoords) return null

  const [lng, lat] = coords as [number, number]
  const rawAccuracy = feature?.properties?.coordinates?.accuracy
  const confidence = feature?.properties?.match_code?.confidence ?? 'low'
  const isStrongMatch = !!rawAccuracy && PRECISE_GEOCODE_TIERS.has(rawAccuracy) && STRONG_CONFIDENCE.has(confidence)

  return {
    lat,
    lng,
    accuracy: isStrongMatch ? rawAccuracy! : 'approximate',
    confidence,
  }
}

/**
 * Forward-geocodes `query` via Mapbox Geocoding v6 and returns the
 * classified top result, or null on ANY failure (missing token, empty
 * query, network error, no usable feature) — geocode failure must never
 * block save.
 */
export async function resolveGeoPointV6(query: string, token: string | undefined): Promise<GeocodeMatch | null> {
  const q = query.trim()
  if (!token || !q) return null
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&limit=1&country=us`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const json = await resp.json() as MapboxV6Response
    return classifyV6Feature(json.features?.[0])
  } catch {
    return null
  }
}
