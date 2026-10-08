// apps/web/src/lib/map-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The members' map side of a deep link `#map?focus=<kind>:<uuid>` (lib/deep-link.ts; built by an
// admin "View on map" link through lib/member-url.ts). The shell hands the target to the map panel
// as panelParams.focus; this module decides where it lands and when it has landed:
//
//  1. readMapFocusPin — one by-id read that applies EXACTLY the member predicate of the layer that
//     draws the pin (the in-bounds readers are SECURITY DEFINER, so members and admins see the same
//     pins, but a plain table read under resources_admin_select / orgs_admin_select — or a member's
//     own pending submission — would return rows no member's map shows). A resource that a visible
//     business links to resolves to that business's pin: the map draws the business leaf instead
//     (dedupeResourcesForBusinesses, lib/business.ts).
//  2. MapFocusController — the one-shot lifecycle: begin → located (fly) → found when the pin's id is
//     in its loaded layer; not_found when the read returns nothing or the id never appears before
//     the deadline; abandoned when the panel unmounts or a newer focus replaces it first. Every path
//     settles exactly once (one nav.deeplink.resolve row, the focus cleared).
//  3. Camera lock — a focus claims the camera so a later GPS fix or profile geocode does not fly
//     the map away from the pin.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { assertNever } from '@/components/feed/post-model'
import type { FocusKind, FocusTarget } from './deep-link'
import { parseGeographyPoint } from './business'
import { fetchApprovedBusinessById } from './business-data'
import { fetchOrganizationById } from './org-data'
import { isMapPoint, safetyAlertMapVisibility } from './member-visibility'
import { whereSafetyAlertLive } from '@/app/(admin)/moderation/safety-alert-live'

/** The focus kinds the map brings into view (feed-shell FOCUS_CONSUMERS registers the same four). */
export type MapFocusKind = Exclude<FocusKind, 'event'>
export const MAP_FOCUS_KINDS: readonly MapFocusKind[] = ['resource', 'organization', 'business', 'safety_alert']

export function isMapFocusKind(kind: FocusKind): kind is MapFocusKind {
  return (MAP_FOCUS_KINDS as readonly string[]).includes(kind)
}

/** The map layer a pin is drawn in. */
export type MapPinLayer = 'resource' | 'organization' | 'business' | 'safety_alert'

/** Where a focus lands: one pin, in one layer, at one point. */
export interface MapFocusPin {
  layer: MapPinLayer
  id: string
  lng: number
  lat: number
}

/** Above the resource cluster maxZoom (16, hooks/use-cluster.ts), so the pin is always a leaf. */
export const MAP_FOCUS_ZOOM = 17
/** How long the pin may take to appear in its layer after the fly starts. */
export const MAP_FOCUS_TIMEOUT_MS = 8000

// ---- 1. The by-id readers ------------------------------------------------------------------------

type Row = Record<string, unknown>
interface Result<T> {
  data: T | null
  error: unknown
}
/** The chained PostgREST calls these readers use (structural, so a test can record them). */
interface FocusQuery extends PromiseLike<Result<Row[]>> {
  eq(column: string, value: unknown): FocusQuery
  gt(column: string, value: string): FocusQuery
  order(column: string, options: { ascending: boolean }): FocusQuery
  maybeSingle(): PromiseLike<Result<Row>>
}
interface FocusClient {
  from(table: string): { select(columns: string): FocusQuery }
}
const db = (supabase: SupabaseClient<Database>) => supabase as unknown as FocusClient

function pinAt(layer: MapPinLayer, id: string, location: unknown): MapFocusPin | null {
  const point = parseGeographyPoint(location as Parameters<typeof parseGeographyPoint>[0])
  return isMapPoint(point) ? { layer, id, lng: point.lng, lat: point.lat } : null
}

/** resources_in_bounds: status='approved' AND location NOT NULL (+ the client's non-zero point).
 *  Then the business leaf that replaces it, when one is visible: businesses_in_bounds' predicate
 *  (business, approved, active, located) on organizations.resource_id. */
async function readResourcePin(supabase: SupabaseClient<Database>, id: string): Promise<MapFocusPin | null> {
  const { data: resource } = await db(supabase)
    .from('resources')
    .select('id, location')
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle()
  if (!resource) return null
  const own = pinAt('resource', id, resource.location)
  if (!own) return null

  const { data: businesses } = await db(supabase)
    .from('organizations')
    .select('id, location')
    .eq('resource_id', id)
    .eq('org_type', 'business')
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('id', { ascending: true })
  for (const business of businesses ?? []) {
    const leaf = pinAt('business', String(business.id), business.location)
    if (leaf) return leaf
  }
  return own
}

/** organizations_in_bounds: active, non-business, located — fetchOrganizationById filters the first two. */
async function readOrganizationPin(supabase: SupabaseClient<Database>, id: string): Promise<MapFocusPin | null> {
  const org = await fetchOrganizationById(supabase, id)
  return org ? pinAt('organization', id, org.location) : null
}

/** businesses_in_bounds: business, approved, active, located — fetchApprovedBusinessById filters the first three. */
async function readBusinessPin(supabase: SupabaseClient<Database>, id: string): Promise<MapFocusPin | null> {
  const business = await fetchApprovedBusinessById(supabase, id)
  return business ? pinAt('business', id, business.location) : null
}

/** safety_alerts_in_view: status='live' AND expires_at > now. RLS safety_alerts_select checks status
 *  only, so the expiry is filtered in the query and checked again on the returned row. */
async function readSafetyAlertPin(supabase: SupabaseClient<Database>, id: string, now: Date): Promise<MapFocusPin | null> {
  const { data: alert } = await whereSafetyAlertLive(
    db(supabase).from('safety_alerts').select('id, location, status, expires_at').eq('id', id),
    now,
  ).maybeSingle()
  if (!alert) return null
  const visibility = safetyAlertMapVisibility({ status: String(alert.status), expires_at: String(alert.expires_at) }, now)
  return visibility.visible ? pinAt('safety_alert', id, alert.location) : null
}

/** The pin a member's map draws for this target right now, or null (a failed read counts as null). */
export async function readMapFocusPin(
  supabase: SupabaseClient<Database>,
  target: { kind: MapFocusKind; id: string },
  now: Date = new Date(),
): Promise<MapFocusPin | null> {
  try {
    switch (target.kind) {
      case 'resource':
        return await readResourcePin(supabase, target.id)
      case 'organization':
        return await readOrganizationPin(supabase, target.id)
      case 'business':
        return await readBusinessPin(supabase, target.id)
      case 'safety_alert':
        return await readSafetyAlertPin(supabase, target.id, now)
      default:
        return assertNever(target.kind)
    }
  } catch {
    return null
  }
}

// ---- 2. The one-shot lifecycle -------------------------------------------------------------------

/** The ids each layer has loaded (what the map can draw right now). */
export type MapLayers = Record<MapPinLayer, readonly { id: string }[]>

export function pinInLayers(pin: MapFocusPin, layers: MapLayers): boolean {
  return layers[pin.layer].some((item) => item.id === pin.id)
}

/** found: the pin is on the map with its popup open. not_found: the place is not on the map.
 *  abandoned: the member left (panel switched, or a newer link replaced it) before it settled. */
export type MapFocusOutcome = 'found' | 'not_found' | 'abandoned'
export type MapFocusSettled = { outcome: 'found'; pin: MapFocusPin } | { outcome: 'not_found' } | { outcome: 'abandoned' }

interface PendingFocus {
  target: FocusTarget
  pin: MapFocusPin | null
  deadline: number
}

/**
 * One focus at a time, each settled exactly once. `onSettle` runs once per focus that `begin`
 * accepted (the panel logs nav.deeplink.resolve and clears panelParams.focus there).
 */
export class MapFocusController {
  private pending: PendingFocus | null = null

  constructor(private readonly onSettle: (target: FocusTarget, outcome: MapFocusOutcome) => void) {}

  /** The focus waiting to land, if any. */
  get target(): FocusTarget | null {
    return this.pending?.target ?? null
  }

  /** A focus arrived. False when it is the one already in hand (the same object). A newer focus
   *  replaces an unsettled one, which settles as abandoned. */
  begin(target: FocusTarget): boolean {
    if (this.pending?.target === target) return false
    if (this.pending) this.settle({ outcome: 'abandoned' })
    this.pending = { target, pin: null, deadline: Infinity }
    return true
  }

  /** The by-id read for `target` finished. Returns the pin to fly to, or null: no pin settles the
   *  focus as not_found; a read for a focus no longer in hand is ignored. */
  located(target: FocusTarget, pin: MapFocusPin | null, now: number): MapFocusPin | null {
    const p = this.pending
    if (!p || p.target !== target) return null
    if (!pin) {
      this.settle({ outcome: 'not_found' })
      return null
    }
    p.pin = pin
    p.deadline = now + MAP_FOCUS_TIMEOUT_MS
    return pin
  }

  /** After a layer load or the deadline tick: found once the pin is in its layer, not_found once
   *  the deadline has passed without it, otherwise keep waiting (null). */
  check(layers: MapLayers, now: number): MapFocusSettled | null {
    const p = this.pending
    if (!p?.pin) return null
    if (pinInLayers(p.pin, layers)) return this.settle({ outcome: 'found', pin: p.pin })
    if (now >= p.deadline) return this.settle({ outcome: 'not_found' })
    return null
  }

  /** The panel is going away with a focus still in hand. */
  abandon(): void {
    if (this.pending) this.settle({ outcome: 'abandoned' })
  }

  private settle(result: MapFocusSettled): MapFocusSettled {
    const target = this.pending!.target
    this.pending = null
    this.onSettle(target, result.outcome)
    return result
  }
}

/** The panel's onSettle: one nav.deeplink.resolve row (kind, outcome, panel — never the id), the
 *  focus cleared from panelParams unless a newer one already replaced it, and the polite miss line
 *  for not_found. */
export function mapFocusSettler(deps: {
  logEvent: (name: 'nav.deeplink.resolve', attrs: { kind: FocusKind; outcome: MapFocusOutcome; panel: 'map' }) => void
  setPanelParams: (update: <P extends { focus?: FocusTarget }>(prev: P) => P) => void
  setFocusMiss: (miss: boolean) => void
}): (target: FocusTarget, outcome: MapFocusOutcome) => void {
  return (target, outcome) => {
    deps.logEvent('nav.deeplink.resolve', { kind: target.kind, outcome, panel: 'map' })
    deps.setPanelParams((prev) => (prev.focus === target ? { ...prev, focus: undefined } : prev))
    if (outcome === 'not_found') deps.setFocusMiss(true)
  }
}

// ---- 3. Camera lock and popup --------------------------------------------------------------------

/** What the GPS centring effect does with the current state (map-panel.tsx, Priority 2). */
export type GpsCenterDecision = 'blocked' | 'skipped' | 'wait' | 'fly'

export function gpsCenterDecision(state: {
  hasPosition: boolean
  userHasMovedMap: boolean
  hasProfileCentered: boolean
  hasGeocentered: boolean
}): GpsCenterDecision {
  if (state.userHasMovedMap && state.hasProfileCentered) return 'blocked'
  if (state.hasGeocentered) return 'skipped'
  if (!state.hasPosition) return 'wait'
  return 'fly'
}

/** Profile centring (Priority 1a/1b) runs only until the camera is taken. */
export function profileCenterAllowed(state: { userHasMovedMap: boolean }): boolean {
  return !state.userHasMovedMap
}

/** The camera state a focus sets: the GPS fix counts as applied and the map as moved, so neither
 *  the GPS fix nor the profile geocode flies the camera off the pin afterwards. */
export const FOCUS_CAMERA_LOCK = { userHasMovedMap: true, hasGeocentered: true } as const

export function applyFocusCameraLock(set: {
  setUserHasMovedMap: (value: boolean) => void
  setHasGeocentered: (value: boolean) => void
}): void {
  set.setUserHasMovedMap(FOCUS_CAMERA_LOCK.userHasMovedMap)
  set.setHasGeocentered(FOCUS_CAMERA_LOCK.hasGeocentered)
}

/** A marker mounting with `focused` starts with its popup open (one that mounts later: a cluster
 *  that splits at the focus zoom). */
export function focusOpensPopup(focused: boolean | undefined): boolean {
  return focused === true
}

/** A marker already on the map whose `focused` prop changed: the focus landing on it opens the
 *  popup; anything else leaves the popup as the member left it (losing focus never closes it). */
export function popupOnFocusChange(prev: boolean | undefined, next: boolean | undefined, open: boolean): boolean {
  return next === true && prev !== true ? true : open
}

/** Whether a marker in `layer` with `id` is the focused pin. */
export function isFocusedPin(focused: Pick<MapFocusPin, 'layer' | 'id'> | null, layer: MapPinLayer, id: string): boolean {
  return focused !== null && focused.layer === layer && focused.id === id
}
