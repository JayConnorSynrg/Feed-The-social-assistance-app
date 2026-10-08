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
//  2. MapFocusSession — the one-shot lifecycle the panel's effects forward to: arrive (camera lock,
//     deadline, read, fly) → found when the pin's id is in its loaded layer; not_found when the read
//     returns nothing or the deadline fires first; abandoned when the member leaves first (panel
//     switch, newer link, drag/zoom). Every path settles exactly once (one nav.deeplink.resolve row,
//     the focus cleared).
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
import { whereSafetyAlertLive } from './safety-alert-live'

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
  abortSignal(signal: AbortSignal): FocusQuery
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
async function readResourcePin(supabase: SupabaseClient<Database>, id: string, signal: AbortSignal): Promise<MapFocusPin | null> {
  const { data: resource } = await db(supabase)
    .from('resources')
    .select('id, location')
    .abortSignal(signal)
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle()
  if (!resource) return null
  const own = pinAt('resource', id, resource.location)
  if (!own) return null

  const { data: businesses } = await db(supabase)
    .from('organizations')
    .select('id, location')
    .abortSignal(signal)
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
async function readSafetyAlertPin(supabase: SupabaseClient<Database>, id: string, now: Date, signal: AbortSignal): Promise<MapFocusPin | null> {
  const { data: alert } = await whereSafetyAlertLive(
    db(supabase).from('safety_alerts').select('id, location, status, expires_at').abortSignal(signal).eq('id', id),
    now,
  ).maybeSingle()
  if (!alert) return null
  const visibility = safetyAlertMapVisibility({ status: String(alert.status), expires_at: String(alert.expires_at) }, now)
  return visibility.visible ? pinAt('safety_alert', id, alert.location) : null
}

/** The pin a member's map draws for this target right now, or null (a failed or aborted read counts
 *  as null). `signal` aborts the resource and safety-alert queries; the organization and business
 *  readers (org-data / business-data) take none — the session's deadline settles a hung read. */
export async function readMapFocusPin(
  supabase: SupabaseClient<Database>,
  target: { kind: MapFocusKind; id: string },
  now: Date = new Date(),
  signal: AbortSignal = new AbortController().signal,
): Promise<MapFocusPin | null> {
  try {
    switch (target.kind) {
      case 'resource':
        return await readResourcePin(supabase, target.id, signal)
      case 'organization':
        return await readOrganizationPin(supabase, target.id)
      case 'business':
        return await readBusinessPin(supabase, target.id)
      case 'safety_alert':
        return await readSafetyAlertPin(supabase, target.id, now, signal)
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

/** found: the pin is on the map with its popup open. not_found: the place is not on the map (the
 *  read found nothing, or the pin did not appear before the deadline). abandoned: the member left
 *  first — switched panel, followed a newer link, or took the map (drag/zoom) during the flight. */
export type MapFocusOutcome = 'found' | 'not_found' | 'abandoned'

type Timer = ReturnType<typeof setTimeout>

export interface MapFocusSessionDeps {
  /** The by-id read (readMapFocusPin); `signal` aborts it when the focus settles first. */
  read: (target: { kind: MapFocusKind; id: string }, signal: AbortSignal) => Promise<MapFocusPin | null>
  /** The panel's camera flags; arrival applies FOCUS_CAMERA_LOCK to them. */
  camera: { setUserHasMovedMap: (value: boolean) => void; setHasGeocentered: (value: boolean) => void }
  /** A new focus is in hand (the panel resets its miss line and popup target). */
  onArrive: (target: FocusTarget) => void
  /** Move the camera to the located pin. */
  fly: (pin: MapFocusPin) => void
  /** The pin is in its loaded layer: open its popup (`item` is that layer's row). */
  onFound: (pin: MapFocusPin, item: { id: string }) => void
  /** Exactly once per accepted focus (mapFocusSettler: one row, focus cleared, miss line). */
  onSettle: (target: FocusTarget, outcome: MapFocusOutcome) => void
}

interface PendingFocus {
  target: FocusTarget
  pin: MapFocusPin | null
  deadline: Timer
  read: AbortController
}

const EMPTY_LAYERS: MapLayers = { resource: [], organization: [], business: [], safety_alert: [] }

/**
 * The map panel's deep-link focus, one at a time, each settled exactly once. The panel's effects
 * only forward to it: arrive (panelParams.focus changed), layersUpdated (a layer loaded),
 * memberTookMap (a drag or zoom gesture), unmount / remount (the panel's mount effect).
 *
 *  - arrive: claims the camera (FOCUS_CAMERA_LOCK), starts the deadline (MAP_FOCUS_TIMEOUT_MS from
 *    arrival, so a hung read still settles), then reads the pin and flies to it.
 *  - found: the pin's id is in its loaded layer (checked on every layer update and right after the
 *    read, against the layers already on screen).
 *  - not_found: the read returned nothing, or the deadline timer fired first — expire(target)
 *    settles that target whenever it is still pending, whatever the clock says.
 *  - abandoned: a newer focus, a member gesture, or a real unmount (the unmount is confirmed a tick
 *    later, so a StrictMode unmount + remount of the same instance keeps the focus).
 * Settling clears the deadline and aborts the read; a later read result or layer update for a
 * settled focus does nothing (no popup, no second row, no miss line).
 */
export class MapFocusSession {
  private pending: PendingFocus | null = null
  private layers: MapLayers = EMPTY_LAYERS
  private mounted = true

  constructor(private readonly deps: MapFocusSessionDeps) {}

  /** The focus waiting to land, if any. */
  get target(): FocusTarget | null {
    return this.pending?.target ?? null
  }

  /** panelParams.focus changed. False when it is not a map kind or the one already in hand. */
  arrive(focus: FocusTarget): boolean {
    if (!isMapFocusKind(focus.kind) || this.pending?.target === focus) return false
    if (this.pending) this.settle('abandoned')
    const pending: PendingFocus = {
      target: focus,
      pin: null,
      deadline: setTimeout(() => this.expire(focus), MAP_FOCUS_TIMEOUT_MS),
      read: new AbortController(),
    }
    this.pending = pending
    applyFocusCameraLock(this.deps.camera)
    this.deps.onArrive(focus)
    this.deps.read({ kind: focus.kind, id: focus.id }, pending.read.signal).then(
      (pin) => this.located(focus, pin),
      () => this.located(focus, null),
    )
    return true
  }

  /** A layer loaded: found when the pin is in it. */
  layersUpdated(layers: MapLayers): void {
    this.layers = layers
    this.tryFound()
  }

  /** The deadline for `target`: not_found if it is still the pending focus. */
  expire(target: FocusTarget): void {
    if (this.pending?.target === target) this.settle('not_found')
  }

  /** The member dragged or zoomed: the focus is no longer theirs to land. */
  memberTookMap(): void {
    if (this.pending) this.settle('abandoned')
  }

  unmount(): void {
    this.mounted = false
    setTimeout(() => {
      if (!this.mounted && this.pending) this.settle('abandoned')
    }, 0)
  }

  remount(): void {
    this.mounted = true
  }

  private located(target: FocusTarget, pin: MapFocusPin | null): void {
    const p = this.pending
    if (!p || p.target !== target) return
    if (!pin) {
      this.settle('not_found')
      return
    }
    p.pin = pin
    this.deps.fly(pin)
    this.tryFound()
  }

  private tryFound(): void {
    const p = this.pending
    if (!p?.pin) return
    const pin = p.pin
    const item = this.layers[pin.layer].find((row) => row.id === pin.id)
    if (!item) return
    this.settle('found')
    this.deps.onFound(pin, item)
  }

  private settle(outcome: MapFocusOutcome): void {
    const p = this.pending!
    this.pending = null
    clearTimeout(p.deadline)
    p.read.abort()
    this.deps.onSettle(p.target, outcome)
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

/** A marker's popup state: open, and the `focused` prop it last saw. */
export interface PopupState {
  open: boolean
  seenFocused: boolean | undefined
}

/** A marker mounting focused starts with its popup open (a cluster that splits at the focus zoom). */
export function initialPopupState(focused: boolean | undefined): PopupState {
  return { open: focused === true, seenFocused: focused }
}

/** The prop-change reducer (run while rendering): `focused` turning on opens the popup; any other
 *  change leaves it as the member left it (losing focus never closes it). Same object when nothing
 *  changed, so the hook only sets state on a real change. */
export function popupStateFor(state: PopupState, focused: boolean | undefined): PopupState {
  if (state.seenFocused === focused) return state
  return { open: focused === true && state.seenFocused !== true ? true : state.open, seenFocused: focused }
}

/** Whether a marker in `layer` with `id` is the focused pin. */
export function isFocusedPin(focused: Pick<MapFocusPin, 'layer' | 'id'> | null, layer: MapPinLayer, id: string): boolean {
  return focused !== null && focused.layer === layer && focused.id === id
}
