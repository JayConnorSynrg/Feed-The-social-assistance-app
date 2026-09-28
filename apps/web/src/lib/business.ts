// apps/web/src/lib/business.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure, dependency-free helpers for the P4a local-business client surfaces. No React, no
// Supabase, no browser globals — so this module is unit-testable in the node vitest env and
// is safe to import from both server (public page) and client (panel/map) code.
//
// Two load-bearing invariants live here as pure functions:
//   * ONE PIN (CINV2): dedupeResourcesForBusinesses removes any resource that a business
//     already renders as its leaf (resource_id linkage), so a linked business never draws
//     both its leaf and the underlying resource pin.
//   * TRUTHFUL SUBMIT (CINV4): nextSubmitPhase maps a persist OUTCOME to the UI phase —
//     success => 'pending' (never 'live'/'approved'), failure => 'error'. The revert path is
//     therefore a pure, testable transition rather than an ad-hoc branch in the component.

/** Cost model for a business, mirroring the DB CHECK on organizations.cost_model. */
export type CostModel = 'free' | 'sliding_scale' | 'paid'

/**
 * One row of business_hours. `open_time`/`close_time` are Postgres `time` values serialised as
 * 'HH:MM' / 'HH:MM:SS' strings; `day_of_week` is 0 (Sunday) through 6 (Saturday).
 */
export interface BusinessHours {
  day_of_week: number
  open_time: string
  close_time: string
}

/** One row of business_services. `sort_order` fixes display order (ascending). */
export interface BusinessService {
  name: string
  description: string | null
  sort_order: number
}

/**
 * One row of business_photos. `kind` is logo | cover | gallery (the DB enforces at most one logo
 * and one cover per org via partial-unique indexes). `storage_path` is the object path in the
 * public bucket; `url` is its resolved public URL.
 */
export interface BusinessPhoto {
  kind: 'logo' | 'cover' | 'gallery'
  url: string
  storage_path: string
  sort_order: number
  caption: string | null
}

/** A business org as returned by businesses_in_bounds OR a direct approved-business select. */
export interface Business {
  id: string
  name: string
  description: string | null
  org_type: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  business_category: string | null
  cost_model: CostModel | null
  service_radius_miles: number | null
  // jsonb columns. `attributes` maps a BUSINESS_ATTRIBUTES key to a boolean; `social_links` maps a
  // SOCIAL_PLATFORMS key to an absolute (already-normalized) URL.
  attributes: Record<string, boolean>
  social_links: Record<string, string>
  // PostgREST serialises PostGIS GEOGRAPHY as an EWKB hex string; tests may pass GeoJSON.
  location: string | { coordinates?: [number, number] } | null
  resource_id: string | null
  // Populated ONLY by the showcase list reader (fetchApprovedBusinesses), which embeds the org's
  // single logo photo in the same query (no N+1). null when the business has no logo. Other readers
  // (map bbox, single-business page) leave it undefined — the card falls back to an initial/placeholder.
  logo_url?: string | null
}

/** Fields a member fills in on the submit-a-business form. org_type is fixed to 'business'. */
export interface NewBusinessInput {
  name: string
  description?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  business_category?: string | null
  cost_model?: CostModel | null
  service_radius_miles?: number | null
  attributes?: Record<string, boolean>
  social_links?: Record<string, string>
  // Repeating rich-profile rows the submit flow writes into the child tables AFTER the org insert
  // returns its id (via insertBusinessHours / insertBusinessServices / insertBusinessPhotos).
  hours?: BusinessHours[]
  services?: BusinessService[]
  photos?: BusinessPhoto[]
}

/**
 * Decode an EWKB hex Point (PostGIS GEOGRAPHY) into [lng, lat], or accept a GeoJSON
 * { coordinates } shape. Returns null when the value is missing or unparseable.
 * (Same byte layout the resource map path uses; kept independent here so the resource
 * path stays untouched — CINV6.)
 */
export function parseGeographyPoint(
  location: string | { coordinates?: [number, number] } | null | undefined
): { lng: number; lat: number } | null {
  if (!location) return null
  if (typeof location !== 'string') {
    const c = location.coordinates
    if (!c || c.length < 2 || Number.isNaN(c[0]) || Number.isNaN(c[1])) return null
    return { lng: c[0], lat: c[1] }
  }
  if (location.length < 50) return null
  try {
    const bytes = new Uint8Array(location.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    const view = new DataView(bytes.buffer)
    const littleEndian = bytes[0] === 1
    const lng = view.getFloat64(9, littleEndian)
    const lat = view.getFloat64(17, littleEndian)
    if (Number.isNaN(lng) || Number.isNaN(lat)) return null
    return { lng, lat }
  } catch {
    return null
  }
}

/**
 * Map a distance in km to the SAME bucket vocabulary the server ranked_feed RPCs emit
 * (<2km / 2-10km / 10-50km / >50km / unknown). The boundaries mirror that fixed contract —
 * they are not a new distance formula (the distance itself is computed with the existing
 * haversine calculateDistance). Feed the result to distanceBucketLabel for display.
 */
export function bucketForKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return 'unknown'
  if (km < 2) return '<2km'
  if (km < 10) return '2-10km'
  if (km < 50) return '10-50km'
  return '>50km'
}

/** The set of resource ids that businesses already render as their own leaf. */
export function businessLinkedResourceIds(
  businesses: readonly Pick<Business, 'resource_id'>[]
): Set<string> {
  const ids = new Set<string>()
  for (const b of businesses) {
    if (b.resource_id) ids.add(b.resource_id)
  }
  return ids
}

/**
 * CINV2 (ONE PIN): drop every resource whose id is a rendered business's resource_id, so a
 * resource-linked business shows only its leaf, never also the underlying resource pin.
 * A business without resource_id removes nothing. resources_in_bounds is never touched — the
 * filter runs purely on the already-fetched arrays.
 */
export function dedupeResourcesForBusinesses<T extends { id: string }>(
  resources: readonly T[],
  businesses: readonly Pick<Business, 'resource_id'>[]
): T[] {
  const linked = businessLinkedResourceIds(businesses)
  return resources.filter((r) => !linked.has(r.id))
}

/** Ascending distance sort; items with unknown distance sort last. Stable, non-mutating. */
export function sortByDistanceKm<T>(
  items: readonly T[],
  kmOf: (item: T) => number | null
): T[] {
  return items
    .map((item, i) => ({ item, i, km: kmOf(item) }))
    .sort((a, b) => {
      const ak = a.km == null || Number.isNaN(a.km) ? Infinity : a.km
      const bk = b.km == null || Number.isNaN(b.km) ? Infinity : b.km
      if (ak !== bk) return ak - bk
      return a.i - b.i // stable within a bucket / for equal distances
    })
    .map((x) => x.item)
}

/**
 * Result of persisting a business submission (CINV4 — truthful, three-valued).
 *  - { ok:true, id }               the org row AND every provided child row persisted.
 *  - { ok:true, id, partial }      the org row persisted (business is pending review) but one or
 *                                  more child inserts (photos/hours/services) failed. `partial` is a
 *                                  bounded, PII-free human message naming the child kinds that failed.
 *                                  The submit MUST NOT be reported as full success — the business was
 *                                  created, some profile detail was not saved.
 *  - { ok:false, error }           the org insert itself failed; nothing persisted.
 */
export type SubmitOutcome =
  | { ok: true; id: string; partial?: string }
  | { ok: false; error: string }

/** Truthful UI phase for the submit surface. Note: NO 'live'/'approved' phase exists. */
export type SubmitPhase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  // `warning` is set ONLY when the business was created but some child profile data failed to save
  // (partial success); the pending panel shows it alongside the pending-review confirmation.
  | { kind: 'pending'; id: string; warning?: string }
  | { kind: 'error'; message: string }

/**
 * CINV4 (TRUTHFUL SUBMIT): translate a persist OUTCOME into the UI phase. A successful org insert
 * becomes 'pending' review (never shown as already-live); a partial success carries the warning so
 * the panel can tell the user their business was created but some detail failed; a failure becomes
 * 'error' carrying the message so the component can revert and surface a banner. If a caller ever
 * swallowed the error (returned ok:true on failure), this would still refuse to fabricate a
 * 'pending' — the outcome discriminant is the single source of truth.
 */
export function nextSubmitPhase(outcome: SubmitOutcome): SubmitPhase {
  if (!outcome.ok) return { kind: 'error', message: outcome.error }
  return outcome.partial
    ? { kind: 'pending', id: outcome.id, warning: outcome.partial }
    : { kind: 'pending', id: outcome.id }
}
