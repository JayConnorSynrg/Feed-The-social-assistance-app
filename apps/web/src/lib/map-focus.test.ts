// apps/web/src/lib/map-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// M1/M2/M3 for the map deep link (#map?focus=<kind>:<id>), in node without a DOM:
//   1. readMapFocusPin resolves a pin EXACTLY when the member's map draws one, per kind, both
//      directions. The fake client APPLIES each filter to in-memory rows, and every fixture also
//      holds rows an admin (resources_admin_select / orgs_admin_select) or a submitter (own pending
//      submission) can read but no member's map shows — dropping one filter resolves such a row, RED.
//   2. A resource a visible business links to lands on that business's pin.
//   3. MapFocusController + mapFocusSettler: found / not_found / abandoned, exactly one
//      nav.deeplink.resolve row per focus (no id), the focus cleared on every path.
//   4. Camera lock: once a focus applies FOCUS_CAMERA_LOCK, a later GPS fix or profile geocode
//      cannot move the camera.
//   5. Marker popup: mounting focused opens it (rendered through the real hook); turning focused on
//      a mounted marker opens it (popupOnFocusChange — react-dom/server renders once and cannot run
//      a re-render, so the change case is proven on the pure decision the hook calls).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import {
  FOCUS_CAMERA_LOCK,
  MAP_FOCUS_TIMEOUT_MS,
  MAP_FOCUS_ZOOM,
  MapFocusController,
  applyFocusCameraLock,
  focusOpensPopup,
  gpsCenterDecision,
  isFocusedPin,
  mapFocusSettler,
  popupOnFocusChange,
  profileCenterAllowed,
  readMapFocusPin,
  type MapFocusOutcome,
  type MapFocusPin,
  type MapLayers,
} from './map-focus'
import type { FocusTarget } from './deep-link'
import { useFocusedPopup } from '@/components/map/use-focused-popup'

// ---- A PostgREST fake that applies the filters it is given ----------------------------------------

type Row = Record<string, unknown>

/** EWKB hex (little-endian, SRID 4326) for a point, the shape PostgREST returns for geography. */
function ewkb(lng: number, lat: number): string {
  const b = Buffer.alloc(25)
  b.writeUInt8(1, 0)
  b.writeUInt32LE(0x20000001, 1)
  b.writeUInt32LE(4326, 5)
  b.writeDoubleLE(lng, 9)
  b.writeDoubleLE(lat, 17)
  return b.toString('hex')
}

interface FakeOptions {
  /** Simulate a server that ignores .gt() (proves the client re-checks expiry). */
  ignoreGt?: boolean
  /** Make every read reject. */
  fail?: boolean
}

function fakeClient(tables: Record<string, Row[]>, opts: FakeOptions = {}) {
  const calls: string[] = []
  const client = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const result = () => (opts.fail ? Promise.reject(new Error('network')) : Promise.resolve({ data: rows, error: null }))
      const builder = {
        select(cols: string) {
          calls.push(`${table}.select(${cols})`)
          return builder
        },
        eq(col: string, val: unknown) {
          calls.push(`${table}.eq(${col},${String(val)})`)
          rows = rows.filter((r) => r[col] === val)
          return builder
        },
        in(col: string, vals: unknown[]) {
          calls.push(`${table}.in(${col})`)
          rows = rows.filter((r) => vals.includes(r[col]))
          return builder
        },
        gt(col: string, val: string) {
          calls.push(`${table}.gt(${col})`)
          if (!opts.ignoreGt) rows = rows.filter((r) => Date.parse(String(r[col])) > Date.parse(val))
          return builder
        },
        order(col: string) {
          rows = [...rows].sort((a, b) => String(a[col]).localeCompare(String(b[col])))
          return builder
        },
        maybeSingle() {
          if (opts.fail) return Promise.reject(new Error('network'))
          return Promise.resolve({ data: rows[0] ?? null, error: null })
        },
        single() {
          if (opts.fail) return Promise.reject(new Error('network'))
          return Promise.resolve(rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'PGRST116' } })
        },
        then<R>(cb: (r: { data: Row[]; error: null }) => R, rej?: (e: unknown) => R) {
          return result().then(cb, rej)
        },
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

const NOW = new Date('2026-10-08T19:00:00.000Z')
const R1 = '11111111-1111-4111-8111-111111111111'
const B1 = '22222222-2222-4222-8222-222222222222'
const B2 = '33333333-3333-4333-8333-333333333333'
const O1 = '44444444-4444-4444-8444-444444444444'
const A1 = '55555555-5555-4555-8555-555555555555'
const HERE = ewkb(-72.97, 43.61)
const THERE = ewkb(-72.9, 43.7)

const resource = (over: Row = {}): Row => ({ id: R1, status: 'approved', location: HERE, ...over })
const business = (over: Row = {}): Row => ({
  id: B1, org_type: 'business', status: 'approved', is_active: true, location: THERE, resource_id: null, ...over,
})
const org = (over: Row = {}): Row => ({ id: O1, org_type: 'food_bank', is_active: true, location: HERE, resource_id: null, ...over })
const alert = (over: Row = {}): Row => ({
  id: A1, status: 'live', expires_at: '2026-10-08T21:00:00.000Z', location: HERE, ...over,
})

const read = (tables: Record<string, Row[]>, kind: 'resource' | 'organization' | 'business' | 'safety_alert', id: string, opts?: FakeOptions) =>
  readMapFocusPin(fakeClient(tables, opts).client, { kind, id }, NOW)

// ---- 1 + 2. Readers ------------------------------------------------------------------------------

describe('readMapFocusPin — resource (resources_in_bounds: approved AND located, non-zero point)', () => {
  it('an approved, located resource resolves to its own pin', async () => {
    const pin = await read({ resources: [resource()] }, 'resource', R1)
    expect(pin).toMatchObject({ layer: 'resource', id: R1 })
    expect(pin!.lng).toBeCloseTo(-72.97)
    expect(pin!.lat).toBeCloseTo(43.61)
  })
  it.each([
    ['pending (admin- or submitter-readable, not on the map)', { status: 'pending' }],
    ['rejected', { status: 'rejected' }],
    ['no location', { location: null }],
    ['a 0 coordinate (dropped by use-viewport-resources)', { location: ewkb(0, 43.61) }],
  ])('%s does not resolve', async (_label, over) => {
    expect(await read({ resources: [resource(over)] }, 'resource', R1)).toBeNull()
  })
  it('a missing id does not resolve', async () => {
    expect(await read({ resources: [resource()] }, 'resource', B2)).toBeNull()
  })
})

describe('readMapFocusPin — business-linked resource lands on the business pin', () => {
  it('a visible business linking the resource takes the focus (the map hides the resource pin)', async () => {
    const pin = await read({ resources: [resource()], organizations: [business({ resource_id: R1 })] }, 'resource', R1)
    expect(pin).toMatchObject({ layer: 'business', id: B1 })
    expect(pin!.lng).toBeCloseTo(-72.9)
  })
  it.each([
    ['inactive', { is_active: false }],
    ['pending', { status: 'pending' }],
    ['unlocated', { location: null }],
    ['not a business', { org_type: 'food_bank' }],
  ])('a linked business that is %s leaves the resource on its own pin', async (_label, over) => {
    const pin = await read({ resources: [resource()], organizations: [business({ resource_id: R1, ...over })] }, 'resource', R1)
    expect(pin).toMatchObject({ layer: 'resource', id: R1 })
  })
  it('two visible linked businesses: the first by id (deterministic)', async () => {
    const pin = await read(
      { resources: [resource()], organizations: [business({ id: B2, resource_id: R1 }), business({ id: B1, resource_id: R1 })] },
      'resource',
      R1,
    )
    expect(pin).toMatchObject({ layer: 'business', id: B1 })
  })
})

describe('readMapFocusPin — organization (organizations_in_bounds: active, non-business, located)', () => {
  it('an active, located non-business org resolves', async () => {
    expect(await read({ organizations: [org()] }, 'organization', O1)).toMatchObject({ layer: 'organization', id: O1 })
  })
  it.each([
    ['inactive (orgs_admin_select reads it)', { is_active: false }],
    ['a business row', { org_type: 'business', status: 'approved' }],
    ['unlocated', { location: null }],
  ])('%s does not resolve', async (_label, over) => {
    expect(await read({ organizations: [org(over)] }, 'organization', O1)).toBeNull()
  })
})

describe('readMapFocusPin — business (businesses_in_bounds: business, approved, active, located)', () => {
  it('an approved, active, located business resolves', async () => {
    expect(await read({ organizations: [business()] }, 'business', B1)).toMatchObject({ layer: 'business', id: B1 })
  })
  it.each([
    ['inactive', { is_active: false }],
    ['pending (its submitter reads it)', { status: 'pending' }],
    ['not a business', { org_type: 'food_bank' }],
    ['unlocated', { location: null }],
  ])('%s does not resolve', async (_label, over) => {
    expect(await read({ organizations: [business(over)] }, 'business', B1)).toBeNull()
  })
})

describe('readMapFocusPin — safety alert (safety_alerts_in_view: live AND expires_at > now)', () => {
  it('a live, unexpired alert resolves', async () => {
    expect(await read({ safety_alerts: [alert()] }, 'safety_alert', A1)).toMatchObject({ layer: 'safety_alert', id: A1 })
  })
  it.each([
    ['removed', { status: 'removed' }],
    ['expired', { status: 'expired' }],
    ['live but past expires_at (the expiry job has not reached it)', { expires_at: '2026-10-08T18:59:00.000Z' }],
  ])('%s does not resolve', async (_label, over) => {
    expect(await read({ safety_alerts: [alert(over)] }, 'safety_alert', A1)).toBeNull()
  })
  it('the expiry is re-checked on the returned row (RLS checks status only)', async () => {
    // A server that ignored .gt() would return the past-expiry row; the client still refuses it.
    const past = alert({ expires_at: '2026-10-08T18:59:00.000Z' })
    expect(await read({ safety_alerts: [past] }, 'safety_alert', A1, { ignoreGt: true })).toBeNull()
  })
  it('the query itself carries both filters', async () => {
    const { client, calls } = fakeClient({ safety_alerts: [alert()] })
    await readMapFocusPin(client, { kind: 'safety_alert', id: A1 }, NOW)
    expect(calls).toContain('safety_alerts.eq(status,live)')
    expect(calls).toContain('safety_alerts.gt(expires_at)')
  })
})

describe('readMapFocusPin — a failed read', () => {
  it('counts as no pin (not_found), never a throw', async () => {
    for (const kind of ['resource', 'organization', 'business', 'safety_alert'] as const) {
      expect(await read({}, kind, R1, { fail: true }), kind).toBeNull()
    }
  })
})

// ---- 3. Lifecycle and logging ----------------------------------------------------------------------

const target = (id = R1, kind: FocusTarget['kind'] = 'resource'): FocusTarget => ({ kind, id })
const PIN: MapFocusPin = { layer: 'resource', id: R1, lng: -72.97, lat: 43.61 }
const EMPTY: MapLayers = { resource: [], business: [], organization: [], safety_alert: [] }
const WITH_PIN: MapLayers = { ...EMPTY, resource: [{ id: B2 }, { id: R1 }] }

function harness() {
  const rows: Array<{ name: string; attrs: Record<string, unknown> }> = []
  let params: { focus?: FocusTarget } = {}
  const misses: boolean[] = []
  const onSettle = mapFocusSettler({
    logEvent: (name, attrs) => rows.push({ name, attrs: { ...attrs } }),
    setPanelParams: (update) => {
      params = update(params)
    },
    setFocusMiss: (m) => misses.push(m),
  })
  const controller = new MapFocusController(onSettle)
  const arrive = (t: FocusTarget) => {
    params = { ...params, focus: t }
    return controller.begin(t)
  }
  return { controller, rows, misses, arrive, params: () => params, outcomes: () => rows.map((r) => r.attrs.outcome as MapFocusOutcome) }
}

describe('MapFocusController + mapFocusSettler — one row per followed focus, focus always cleared', () => {
  it('found: the pin appears in its layer after the fly → one row, focus cleared, popup target returned', () => {
    const t = target()
    const hx = harness()
    expect(hx.arrive(t)).toBe(true)
    expect(hx.controller.located(t, PIN, 0)).toEqual(PIN)
    expect(hx.controller.check(EMPTY, 100)).toBeNull() // still loading: keep waiting, no row
    expect(hx.rows).toHaveLength(0)
    expect(hx.controller.check(WITH_PIN, 200)).toEqual({ outcome: 'found', pin: PIN })
    expect(hx.rows).toEqual([{ name: 'nav.deeplink.resolve', attrs: { kind: 'resource', outcome: 'found', panel: 'map' } }])
    expect(hx.params().focus).toBeUndefined()
    expect(hx.misses).toEqual([])
    // Settled: later layer loads change nothing.
    expect(hx.controller.check(WITH_PIN, 300)).toBeNull()
    expect(hx.rows).toHaveLength(1)
  })

  it('not_found: the id never appears before the deadline → one row, focus cleared, miss line', () => {
    const t = target()
    const hx = harness()
    hx.arrive(t)
    hx.controller.located(t, PIN, 1000)
    expect(hx.controller.check(EMPTY, 1000 + MAP_FOCUS_TIMEOUT_MS - 1)).toBeNull()
    expect(hx.controller.check(EMPTY, 1000 + MAP_FOCUS_TIMEOUT_MS)).toEqual({ outcome: 'not_found' })
    expect(hx.outcomes()).toEqual(['not_found'])
    expect(hx.params().focus).toBeUndefined()
    expect(hx.misses).toEqual([true])
  })

  it('not_found: the by-id read returned nothing → settled at once, no fly', () => {
    const t = target()
    const hx = harness()
    hx.arrive(t)
    expect(hx.controller.located(t, null, 0)).toBeNull()
    expect(hx.outcomes()).toEqual(['not_found'])
    expect(hx.params().focus).toBeUndefined()
    expect(hx.controller.check(WITH_PIN, 1)).toBeNull()
    expect(hx.rows).toHaveLength(1)
  })

  it('abandoned: the panel unmounts with the focus pending → one row; a second abandon writes nothing', () => {
    const t = target()
    const hx = harness()
    hx.arrive(t)
    hx.controller.abandon()
    hx.controller.abandon()
    expect(hx.outcomes()).toEqual(['abandoned'])
    expect(hx.params().focus).toBeUndefined()
    expect(hx.misses).toEqual([])
  })

  it('a newer link replaces a pending one: the old one is abandoned, the new one kept in panelParams', () => {
    const first = target(R1)
    const second = target(B1, 'business')
    const hx = harness()
    hx.arrive(first)
    hx.controller.located(first, PIN, 0)
    hx.arrive(second)
    expect(hx.outcomes()).toEqual(['abandoned'])
    expect(hx.params().focus).toBe(second) // clearing the old one did not drop the new one
    // The old read resolving late is ignored.
    expect(hx.controller.located(first, PIN, 10)).toBeNull()
    expect(hx.rows).toHaveLength(1)
    hx.controller.located(second, { layer: 'business', id: B1, lng: 1, lat: 1 }, 20)
    hx.controller.check({ ...EMPTY, business: [{ id: B1 }] }, 30)
    expect(hx.outcomes()).toEqual(['abandoned', 'found'])
    expect(hx.params().focus).toBeUndefined()
  })

  it('the same focus object delivered again (re-render, StrictMode effect re-run) is not a second focus', () => {
    const t = target()
    const hx = harness()
    expect(hx.arrive(t)).toBe(true)
    expect(hx.controller.begin(t)).toBe(false)
    hx.controller.located(t, PIN, 0)
    hx.controller.check(WITH_PIN, 1)
    expect(hx.rows).toHaveLength(1)
  })

  it('a re-click in the preview tab (a new object for the same item) is a new focus with its own row', () => {
    const hx = harness()
    for (const t of [target(), target()]) {
      hx.arrive(t)
      hx.controller.located(t, PIN, 0)
      hx.controller.check(WITH_PIN, 1)
    }
    expect(hx.outcomes()).toEqual(['found', 'found'])
  })

  it('rows carry kind / outcome / panel only — never an id', () => {
    const t = target(A1, 'safety_alert')
    const hx = harness()
    hx.arrive(t)
    hx.controller.located(t, null, 0)
    expect(Object.keys(hx.rows[0].attrs).sort()).toEqual(['kind', 'outcome', 'panel'])
    expect(JSON.stringify(hx.rows)).not.toContain(A1)
    expect(hx.rows[0].attrs).toEqual({ kind: 'safety_alert', outcome: 'not_found', panel: 'map' })
  })

  it('a business-linked resource is logged as the kind that was followed (resource), found on the business layer', () => {
    const t = target(R1, 'resource')
    const hx = harness()
    hx.arrive(t)
    const leaf: MapFocusPin = { layer: 'business', id: B1, lng: 1, lat: 1 }
    hx.controller.located(t, leaf, 0)
    // The resource layer never holds it (deduped away); the business layer does.
    expect(hx.controller.check({ ...EMPTY, resource: [{ id: B1 }] }, 1)).toBeNull()
    expect(hx.controller.check({ ...EMPTY, business: [{ id: B1 }] }, 2)).toEqual({ outcome: 'found', pin: leaf })
    expect(hx.rows[0].attrs).toEqual({ kind: 'resource', outcome: 'found', panel: 'map' })
  })
})

// ---- 4. Camera lock ----------------------------------------------------------------------------------

describe('camera lock — a focus keeps a later GPS fix or profile geocode off the camera', () => {
  const states = [false, true].flatMap((moved) =>
    [false, true].flatMap((profileCentered) => [false, true].map((geocentered) => ({ moved, profileCentered, geocentered }))),
  )

  it('without a focus the GPS rule is unchanged: first fix flies; a manual pan after a profile centre blocks', () => {
    const base = { hasPosition: true, userHasMovedMap: false, hasProfileCentered: false, hasGeocentered: false }
    expect(gpsCenterDecision(base)).toBe('fly')
    expect(gpsCenterDecision({ ...base, hasProfileCentered: true })).toBe('fly') // GPS overrides a profile centre
    expect(gpsCenterDecision({ ...base, userHasMovedMap: true, hasProfileCentered: true })).toBe('blocked')
    expect(gpsCenterDecision({ ...base, hasGeocentered: true })).toBe('skipped')
    expect(gpsCenterDecision({ ...base, hasPosition: false })).toBe('wait')
    expect(profileCenterAllowed({ userHasMovedMap: false })).toBe(true)
  })

  it('applyFocusCameraLock sets both flags', () => {
    const setUserHasMovedMap = vi.fn()
    const setHasGeocentered = vi.fn()
    applyFocusCameraLock({ setUserHasMovedMap, setHasGeocentered })
    expect(setUserHasMovedMap).toHaveBeenCalledWith(true)
    expect(setHasGeocentered).toHaveBeenCalledWith(true)
  })

  it.each(states)('after the lock, from any prior state (%o), a GPS fix never flies and profile centring stops', (s) => {
    const locked = {
      hasPosition: true,
      userHasMovedMap: s.moved || FOCUS_CAMERA_LOCK.userHasMovedMap,
      hasProfileCentered: s.profileCentered,
      hasGeocentered: s.geocentered || FOCUS_CAMERA_LOCK.hasGeocentered,
    }
    expect(gpsCenterDecision(locked)).not.toBe('fly')
    expect(profileCenterAllowed(locked)).toBe(false)
  })

  it('the focus zoom is above the cluster maxZoom (16), so the pin is a leaf', () => {
    expect(MAP_FOCUS_ZOOM).toBeGreaterThan(16)
  })
})

// ---- 5. Marker popup -----------------------------------------------------------------------------------

function PopupProbe({ focused }: { focused?: boolean }) {
  const [open] = useFocusedPopup(focused)
  return h('span', null, open ? 'open' : 'closed')
}

describe('marker popup — opened by the focus', () => {
  it('a marker that mounts focused renders its popup open (the real hook)', () => {
    expect(renderToStaticMarkup(h(PopupProbe, { focused: true }))).toBe('<span>open</span>')
    expect(renderToStaticMarkup(h(PopupProbe, { focused: false }))).toBe('<span>closed</span>')
    expect(renderToStaticMarkup(h(PopupProbe, {}))).toBe('<span>closed</span>')
    expect(focusOpensPopup(true)).toBe(true)
    expect(focusOpensPopup(undefined)).toBe(false)
  })

  it('a mounted marker opens when focused turns on; losing focus never closes a popup the member has open', () => {
    expect(popupOnFocusChange(false, true, false)).toBe(true)
    expect(popupOnFocusChange(undefined, true, false)).toBe(true)
    expect(popupOnFocusChange(true, false, true)).toBe(true)
    expect(popupOnFocusChange(true, false, false)).toBe(false)
    expect(popupOnFocusChange(false, undefined, false)).toBe(false)
  })

  it('only the marker in the focused layer with the focused id is focused', () => {
    const pin = { layer: 'business' as const, id: B1 }
    expect(isFocusedPin(pin, 'business', B1)).toBe(true)
    expect(isFocusedPin(pin, 'organization', B1)).toBe(false)
    expect(isFocusedPin(pin, 'business', B2)).toBe(false)
    expect(isFocusedPin(null, 'business', B1)).toBe(false)
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})
