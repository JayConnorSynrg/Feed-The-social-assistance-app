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
  id?: string
  geometry?: { coordinates?: [number, number] } // [lng, lat]
  properties?: {
    mapbox_id?: string
    feature_type?: string
    /** Standardized primary line, e.g. "1600 Pennsylvania Avenue Northwest". */
    name?: string
    /** Whole formatted address including name, e.g. "1600 … Ave, Washington, DC 20500". */
    full_address?: string
    /** Formatted context only (city, region, postcode, country) without the name line. */
    place_formatted?: string
    coordinates?: { accuracy?: string }
    match_code?: { confidence?: string }
    context?: {
      address?: { name?: string }
      street?: { name?: string }
      postcode?: { name?: string }
      place?: { name?: string }
      region?: { name?: string; region_code?: string }
    }
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

// ─────────────────────────────────────────────────────────────
// Address autocomplete (W2) — live suggestions + component parts
// ─────────────────────────────────────────────────────────────

/** The address fields an autocomplete selection can autofill. */
export interface ParsedV6Address {
  address_line1: string
  city: string
  /** Two-letter region code (e.g. 'VT') when available, else ''. */
  state: string
  zip: string
}

/**
 * Pure extraction of the autofillable address parts from a v6 feature. Reads
 * `properties.context` (place/region/postcode) with sensible fallbacks to
 * `properties.name` for the street line. Missing parts come back as '' so a
 * selection never writes `undefined` into a form field.
 */
export function parseV6Address(feature: MapboxV6Feature | undefined): ParsedV6Address {
  const p = feature?.properties
  const ctx = p?.context
  const address_line1 = (ctx?.address?.name ?? p?.name ?? '').trim()
  const city = (ctx?.place?.name ?? '').trim()
  const state = (ctx?.region?.region_code ?? '').trim()
  const zip = (ctx?.postcode?.name ?? '').trim()
  return { address_line1, city, state, zip }
}

/** One live address suggestion: a display label, the parsed autofill parts,
 *  and the classified geocode match (coords + accuracy/confidence) or null. */
export interface AddressSuggestion extends ParsedV6Address {
  /** Stable key for React lists — the feature's mapbox_id/id, else a synthesized index. */
  id: string
  /** Human-readable full address shown in the dropdown row. */
  label: string
  /** Classified coordinate match for the accuracy gate; null when unusable. */
  match: GeocodeMatch | null
}

/** Builds the display label for a suggestion row from a v6 feature. */
function suggestionLabel(feature: MapboxV6Feature): string {
  const p = feature.properties
  if (p?.full_address) return p.full_address
  return [p?.name, p?.place_formatted].filter(Boolean).join(', ')
}

export interface SuggestOptions {
  limit?: number
  /** Injectable fetch for testing; defaults to global fetch. */
  fetchImpl?: typeof fetch
}

/**
 * Forward-geocodes `query` via Mapbox Geocoding v6 with autocomplete on and
 * returns up to `limit` (default 5, hard-capped at 10 per the v6 API) address
 * suggestions, each carrying its parsed parts and classified coordinate match.
 * Returns [] on ANY failure (missing token, empty/blank query, network error,
 * non-OK response, or a response with no features) — an autocomplete failure
 * must never block typing or saving; the on-save geocode remains the fallback.
 */
export async function suggestAddressesV6(
  query: string,
  token: string | undefined,
  opts: SuggestOptions = {},
): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (!token || !q) return []
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10)
  const doFetch = opts.fetchImpl ?? fetch
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}`
      + `&access_token=${token}&autocomplete=true&types=address&limit=${limit}&country=us`
    const resp = await doFetch(url)
    if (!resp.ok) return []
    const json = await resp.json() as MapboxV6Response
    const features = json.features ?? []
    return features.map((feature, i) => {
      const parts = parseV6Address(feature)
      return {
        id: feature.properties?.mapbox_id ?? feature.id ?? `sugg-${i}`,
        label: suggestionLabel(feature) || parts.address_line1 || q,
        ...parts,
        match: classifyV6Feature(feature),
      }
    })
  } catch {
    return []
  }
}
