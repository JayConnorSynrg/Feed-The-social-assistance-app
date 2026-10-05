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

// ---------------------------------------------------------------------------
// Open-now + hours display helpers (W3 public profile). All pure and time-zone-agnostic: the
// caller supplies "now" as a minute-of-week integer (day_of_week*1440 + hour*60 + minute) computed
// in the VIEWER's local zone (see OpenNowPill). No date library, no browser globals — so the
// midnight-crossing math is unit-testable in the node vitest env. There is no stored tz column;
// this is best-effort display for a local audience (accepted design residual).
// ---------------------------------------------------------------------------

/** Minutes in a full week (7 * 24 * 60). */
const MINUTES_PER_WEEK = 10080
const MINUTES_PER_DAY = 1440

/** Abbreviated day names indexed by day_of_week (0 = Sunday … 6 = Saturday). */
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/**
 * Parse a Postgres `time` string ('HH:MM' or 'HH:MM:SS') to minutes-since-midnight, or null when
 * malformed / out of range. '24:00' (end of day, the close of an "open 24 hours" interval) is 1440.
 * Seconds are ignored (display granularity is the minute).
 */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h === 24 && min === 0 && Number(m[3] ?? 0) === 0) return MINUTES_PER_DAY
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** schema.org opens/closes 'HH:MM' for a stored time; end of day (24:00) is emitted as '23:59'. */
export function schemaOrgTime(t: string): string | null {
  const min = timeToMinutes(t)
  if (min === null) return null
  const capped = Math.min(min, MINUTES_PER_DAY - 1)
  return `${Math.floor(capped / 60).toString().padStart(2, '0')}:${(capped % 60).toString().padStart(2, '0')}`
}

/**
 * Format minutes-since-midnight (0–1439) as a 12-hour clock label, e.g. 540 → "9:00 AM",
 * 1020 → "5:00 PM", 0 → "12:00 AM". Used by the pill and the hours table.
 */
export function minuteToClock(minuteOfDay: number): string {
  const mod = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const h24 = Math.floor(mod / 60)
  const m = mod % 60
  const period = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}

/**
 * Format one business_hours row as an interval label, e.g. "9:00 AM – 5:00 PM". 00:00–24:00 reads
 * "Open 24 hours"; an interval that closes at or before it opens ends the next day and says so.
 * Returns null when either endpoint is unparseable (the row is omitted rather than shown broken).
 */
export function formatHoursInterval(row: BusinessHours): string | null {
  const open = timeToMinutes(row.open_time)
  const close = timeToMinutes(row.close_time)
  if (open === null || close === null) return null
  if (open === 0 && close === MINUTES_PER_DAY) return 'Open 24 hours'
  const label = `${minuteToClock(open)} – ${minuteToClock(close)}`
  return close <= open ? `${label} (next day)` : label
}

/**
 * The computed open/closed state for the pill. `null` means "no usable hours" (render nothing).
 *  - open:  the business is open now; closeDay/closeMinute mark when the current interval ends.
 *  - closed: the business is closed now; openDay/openMinute mark the next interval that opens.
 */
export type OpenNowState =
  | { open: true; always: true }
  | { open: true; always?: false; closeDay: number; closeMinute: number }
  | { open: false; openDay: number; openMinute: number }
  | null

/**
 * Compute open/closed from the hours rows given "now" as a minute-of-week (0 = Sunday 00:00). An
 * interval whose close_time <= open_time is treated as crossing midnight (duration wraps into the
 * next day). The +MINUTES_PER_WEEK probe catches an interval that started late on Saturday and
 * covers the earliest minutes of Sunday. Returns null when no row yields a positive-length interval.
 */
export function computeOpenNow(
  hours: readonly BusinessHours[],
  nowMinuteOfWeek: number
): OpenNowState {
  if (!hours || hours.length === 0) return null
  const now = ((Math.trunc(nowMinuteOfWeek) % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK
  const raw: { start: number; end: number }[] = []
  for (const h of hours) {
    if (h.day_of_week < 0 || h.day_of_week > 6) continue
    const open = timeToMinutes(h.open_time)
    const close = timeToMinutes(h.close_time)
    if (open === null || close === null || open === MINUTES_PER_DAY) continue
    // A close of 24:00 ends at the end of the day. Otherwise the duration wraps at midnight: a close
    // at or before the open time runs into the next day (e.g. 22:00 → 02:00). Zero-length is skipped.
    const duration =
      close === MINUTES_PER_DAY
        ? MINUTES_PER_DAY - open
        : (((close - open) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    if (duration === 0) continue
    const start = h.day_of_week * MINUTES_PER_DAY + open
    raw.push({ start, end: start + duration })
  }
  if (raw.length === 0) return null

  // Merge back-to-back / overlapping intervals (Mon 09–12 + 12–17 closes at 17:00; seven 00:00–24:00
  // days are one continuous span), including the Saturday → Sunday wrap.
  raw.sort((a, b) => a.start - b.start)
  const intervals: { start: number; end: number }[] = []
  for (const iv of raw) {
    const last = intervals[intervals.length - 1]
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end)
    else intervals.push({ ...iv })
  }
  while (intervals.length > 1) {
    const first = intervals[0]
    const last = intervals[intervals.length - 1]
    if (last.end < first.start + MINUTES_PER_WEEK) break
    last.end = Math.max(last.end, first.end + MINUTES_PER_WEEK)
    intervals.shift()
  }
  if (intervals.some((iv) => iv.end - iv.start >= MINUTES_PER_WEEK)) return { open: true, always: true }

  for (const iv of intervals) {
    const inThisWeek = now >= iv.start && now < iv.end
    const inWrappedWeek = now + MINUTES_PER_WEEK >= iv.start && now + MINUTES_PER_WEEK < iv.end
    if (inThisWeek || inWrappedWeek) {
      const closeMow = iv.end % MINUTES_PER_WEEK
      return {
        open: true,
        closeDay: Math.floor(closeMow / MINUTES_PER_DAY),
        closeMinute: closeMow % MINUTES_PER_DAY,
      }
    }
  }

  // Closed: the next opening is the interval with the smallest forward distance from now.
  let best = Infinity
  for (const iv of intervals) {
    const delta = (((iv.start - now) % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK
    if (delta > 0 && delta < best) best = delta
  }
  if (best === Infinity) return null
  const openMow = (now + best) % MINUTES_PER_WEEK
  return {
    open: false,
    openDay: Math.floor(openMow / MINUTES_PER_DAY),
    openMinute: openMow % MINUTES_PER_DAY,
  }
}

/**
 * Render an OpenNowState as the pill label. Open → "Open now · closes 5:00 PM"; closed →
 * "Closed · opens Mon 9:00 AM". Returns null when there is nothing to show (no hours).
 */
export function formatOpenNow(state: OpenNowState): string | null {
  if (!state) return null
  if (state.open && state.always) return 'Open 24 hours'
  if (state.open) return `Open now · closes ${minuteToClock(state.closeMinute)}`
  return `Closed · opens ${DAY_NAMES_SHORT[state.openDay]} ${minuteToClock(state.openMinute)}`
}

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
