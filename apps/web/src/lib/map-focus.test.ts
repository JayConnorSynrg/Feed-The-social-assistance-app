// apps/web/src/lib/map-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// M1/M2/M3 for the map deep link (#map?focus=<kind>:<id>), in node without a DOM:
//   1. readMapFocusPin resolves a pin EXACTLY when the member's map draws one, per kind, both
//      directions. The fake client APPLIES each filter to in-memory rows, and every fixture also
//      holds rows an admin (resources_admin_select / orgs_admin_select) or a submitter (own pending
//      submission) can read but no member's map shows — dropping one filter resolves such a row, RED.
//   2. A resource a visible business links to lands on that business's pin.
//   3. MapFocusSession (the whole lifecycle the panel's effects forward to), on fake timers: found /
//      not_found / abandoned, exactly one nav.deeplink.resolve row per focus (no id), the focus
//      cleared on every path, the camera lock applied on arrival, the deadline from arrival (a hung
//      read still settles; a timer firing early still settles), a real unmount vs a StrictMode
//      unmount + remount, a member drag during the flight, and nothing after a settle.
//   4. Camera lock: once applied, a later GPS fix or profile geocode cannot move the camera.
//   5. Marker popup: the real hook driven through focused false → true → (member closes) → false →
//      true, by render-phase updates in react-dom/server (state is kept across those re-renders).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement as h, useState } from 'react'
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
  MapFocusSession,
  applyFocusCameraLock,
  gpsCenterDecision,
  initialPopupState,
  isFocusedPin,
  mapFocusSettler,
  popupStateFor,
  profileCenterAllowed,
  readMapFocusPin,
  type MapFocusOutcome,
  type MapFocusPin,
  type MapFocusSessionDeps,
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
  const signals: AbortSignal[] = []
  const client = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const result = () => (opts.fail ? Promise.reject(new Error('network')) : Promise.resolve({ data: rows, error: null }))
      const builder = {
        select(cols: string) {
          calls.push(`${table}.select(${cols})`)
          return builder
        },
        abortSignal(signal: AbortSignal) {
          calls.push(`${table}.abortSignal`)
          signals.push(signal)
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
  return { client: client as unknown as SupabaseClient<Database>, calls, signals }
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

describe('readMapFocusPin — the read can be aborted', () => {
  it('the resource and safety-alert queries carry the session signal', async () => {
    const signal = new AbortController().signal
    for (const [kind, table] of [['resource', 'resources'], ['safety_alert', 'safety_alerts']] as const) {
      const fake = fakeClient({ resources: [resource()], safety_alerts: [alert()] })
      await readMapFocusPin(fake.client, { kind, id: kind === 'resource' ? R1 : A1 }, NOW, signal)
      expect(fake.calls, kind).toContain(`${table}.abortSignal`)
      expect(fake.signals[0], kind).toBe(signal)
    }
  })
})

describe('readMapFocusPin — a failed read', () => {
  it('counts as no pin (not_found), never a throw', async () => {
    for (const kind of ['resource', 'organization', 'business', 'safety_alert'] as const) {
      expect(await read({}, kind, R1, { fail: true }), kind).toBeNull()
    }
  })
})

// ---- 3. The session (lifecycle + logging) on fake timers ---------------------------------------------

const target = (id = R1, kind: FocusTarget['kind'] = 'resource'): FocusTarget => ({ kind, id })
const PIN: MapFocusPin = { layer: 'resource', id: R1, lng: -72.97, lat: 43.61 }
const EMPTY: MapLayers = { resource: [], business: [], organization: [], safety_alert: [] }
const WITH_PIN: MapLayers = { ...EMPTY, resource: [{ id: B2 }, { id: R1 }] }

/** A read the test resolves by hand (or never, for a hung read). */
function deferredRead() {
  const reads: Array<{ target: { kind: string; id: string }; signal: AbortSignal; resolve: (pin: MapFocusPin | null) => void }> = []
  const read: MapFocusSessionDeps['read'] = (t, signal) =>
    new Promise((resolve) => {
      reads.push({ target: t, signal, resolve })
    })
  return { read, reads }
}

function harness() {
  const rows: Array<{ name: string; attrs: Record<string, unknown> }> = []
  let params: { focus?: FocusTarget } = {}
  const misses: boolean[] = []
  const flights: MapFocusPin[] = []
  const found: Array<{ pin: MapFocusPin; item: { id: string } }> = []
  const camera = { setUserHasMovedMap: vi.fn(), setHasGeocentered: vi.fn() }
  const arrivals: FocusTarget[] = []
  const { read, reads } = deferredRead()
  const session = new MapFocusSession({
    read,
    camera,
    onArrive: (t) => arrivals.push(t),
    fly: (pin) => flights.push(pin),
    onFound: (pin, item) => found.push({ pin, item }),
    onSettle: mapFocusSettler({
      logEvent: (name, attrs) => rows.push({ name, attrs: { ...attrs } }),
      setPanelParams: (update) => {
        params = update(params)
      },
      setFocusMiss: (m) => misses.push(m),
    }),
  })
  const arrive = (t: FocusTarget) => {
    params = { ...params, focus: t }
    return session.arrive(t)
  }
  return {
    session, rows, misses, flights, found, camera, arrivals, reads, arrive,
    params: () => params,
    outcomes: () => rows.map((r) => r.attrs.outcome as MapFocusOutcome),
  }
}

/** Let a resolved read's continuation run. */
const settleReads = () => vi.advanceTimersByTimeAsync(0)

describe('MapFocusSession — one row per followed focus, focus always cleared', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('arrive claims the camera (GPS fix and profile geocode locked out) and starts the read', () => {
    const hx = harness()
    expect(hx.arrive(target())).toBe(true)
    expect(hx.camera.setUserHasMovedMap).toHaveBeenCalledWith(true)
    expect(hx.camera.setHasGeocentered).toHaveBeenCalledWith(true)
    expect(hx.arrivals).toHaveLength(1)
    expect(hx.reads.map((r) => r.target)).toEqual([{ kind: 'resource', id: R1 }])
  })

  it('found: the read lands, the camera flies, the pin appears in its layer → one row, focus cleared, popup', async () => {
    const t = target()
    const hx = harness()
    hx.arrive(t)
    hx.reads[0].resolve(PIN)
    await settleReads()
    expect(hx.flights).toEqual([PIN])
    hx.session.layersUpdated(EMPTY) // still loading: no row
    expect(hx.rows).toHaveLength(0)
    hx.session.layersUpdated(WITH_PIN)
    expect(hx.rows).toEqual([{ name: 'nav.deeplink.resolve', attrs: { kind: 'resource', outcome: 'found', panel: 'map' } }])
    expect(hx.found).toEqual([{ pin: PIN, item: { id: R1 } }])
    expect(hx.params().focus).toBeUndefined()
    expect(hx.misses).toEqual([])
    // Settled: the deadline and later layers change nothing.
    await vi.advanceTimersByTimeAsync(MAP_FOCUS_TIMEOUT_MS * 2)
    hx.session.layersUpdated(WITH_PIN)
    expect(hx.rows).toHaveLength(1)
  })

  it('found at once when the pin is already in the layers on screen when the read lands', async () => {
    const hx = harness()
    hx.session.layersUpdated(WITH_PIN)
    hx.arrive(target())
    hx.reads[0].resolve(PIN)
    await settleReads()
    expect(hx.outcomes()).toEqual(['found'])
  })

  it('not_found: the read returns nothing → one row, miss line, no flight', async () => {
    const hx = harness()
    hx.arrive(target())
    hx.reads[0].resolve(null)
    await settleReads()
    expect(hx.outcomes()).toEqual(['not_found'])
    expect(hx.flights).toEqual([])
    expect(hx.misses).toEqual([true])
    expect(hx.params().focus).toBeUndefined()
  })

  it('not_found: the pin never appears → the deadline timer settles it, exactly once', async () => {
    const hx = harness()
    hx.arrive(target())
    hx.reads[0].resolve(PIN)
    await vi.advanceTimersByTimeAsync(MAP_FOCUS_TIMEOUT_MS - 1)
    expect(hx.rows).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(hx.outcomes()).toEqual(['not_found'])
    expect(hx.misses).toEqual([true])
    // A layer arriving after the deadline opens no popup and adds no row.
    hx.session.layersUpdated(WITH_PIN)
    expect(hx.found).toEqual([])
    expect(hx.rows).toHaveLength(1)
  })

  it('the deadline settles even when the timer fires early (clock jitter): expire does not compare clocks', async () => {
    const hx = harness()
    const t = target()
    hx.arrive(t)
    hx.reads[0].resolve(PIN)
    await settleReads()
    vi.setSystemTime(Date.now() - 1) // the timer's callback runs "1 ms before" the deadline instant
    hx.session.expire(t)
    expect(hx.outcomes()).toEqual(['not_found'])
  })

  it('a hung read still yields one not_found at the deadline (counted from arrival), and is aborted', async () => {
    const hx = harness()
    hx.arrive(target())
    await vi.advanceTimersByTimeAsync(MAP_FOCUS_TIMEOUT_MS)
    expect(hx.outcomes()).toEqual(['not_found'])
    expect(hx.misses).toEqual([true])
    expect(hx.reads[0].signal.aborted).toBe(true)
    // The read finally answering does nothing.
    hx.reads[0].resolve(PIN)
    await settleReads()
    expect(hx.flights).toEqual([])
    expect(hx.rows).toHaveLength(1)
  })

  it('a real unmount writes one abandoned row', async () => {
    const hx = harness()
    hx.arrive(target())
    hx.session.unmount()
    expect(hx.rows).toHaveLength(0) // confirmed a tick later
    await vi.advanceTimersByTimeAsync(0)
    expect(hx.outcomes()).toEqual(['abandoned'])
    expect(hx.params().focus).toBeUndefined()
    expect(hx.misses).toEqual([])
    await vi.advanceTimersByTimeAsync(MAP_FOCUS_TIMEOUT_MS)
    expect(hx.rows).toHaveLength(1)
  })

  it('unmount + remount in the same tick (StrictMode) writes no row and the focus still lands', async () => {
    const hx = harness()
    hx.arrive(target())
    hx.session.unmount()
    hx.session.remount()
    await vi.advanceTimersByTimeAsync(0)
    expect(hx.rows).toHaveLength(0)
    hx.reads[0].resolve(PIN)
    await settleReads()
    hx.session.layersUpdated(WITH_PIN)
    expect(hx.outcomes()).toEqual(['found'])
  })

  it('a member drag during the flight settles it as abandoned; the pin arriving later opens nothing', async () => {
    const hx = harness()
    hx.arrive(target())
    hx.reads[0].resolve(PIN)
    await settleReads()
    hx.session.memberTookMap()
    expect(hx.outcomes()).toEqual(['abandoned'])
    hx.session.layersUpdated(WITH_PIN)
    expect(hx.found).toEqual([])
    expect(hx.rows).toHaveLength(1)
    hx.session.memberTookMap() // nothing pending: no row
    expect(hx.rows).toHaveLength(1)
  })

  it('a newer link replaces a pending one: the old one is abandoned, the new one kept in panelParams', async () => {
    const first = target(R1)
    const second = target(B1, 'business')
    const hx = harness()
    hx.arrive(first)
    hx.arrive(second)
    expect(hx.outcomes()).toEqual(['abandoned'])
    expect(hx.params().focus).toBe(second)
    expect(hx.reads[0].signal.aborted).toBe(true)
    hx.reads[0].resolve(PIN) // the old read answering late is ignored
    hx.reads[1].resolve({ layer: 'business', id: B1, lng: 1, lat: 1 })
    await settleReads()
    expect(hx.flights.map((f) => f.id)).toEqual([B1])
    hx.session.layersUpdated({ ...EMPTY, business: [{ id: B1 }] })
    expect(hx.outcomes()).toEqual(['abandoned', 'found'])
    expect(hx.params().focus).toBeUndefined()
  })

  it('the same focus object again (re-render) is not a second focus; a new object for the same item is', async () => {
    const hx = harness()
    const t = target()
    expect(hx.arrive(t)).toBe(true)
    expect(hx.session.arrive(t)).toBe(false)
    hx.reads[0].resolve(PIN)
    await settleReads()
    hx.session.layersUpdated(WITH_PIN)
    const again = target()
    expect(hx.arrive(again)).toBe(true) // a re-click in the preview tab
    hx.reads[1].resolve(PIN)
    await settleReads()
    expect(hx.outcomes()).toEqual(['found', 'found'])
  })

  it('an event focus is not the map\'s: ignored, no row', () => {
    const hx = harness()
    expect(hx.session.arrive(target(R1, 'event'))).toBe(false)
    expect(hx.reads).toHaveLength(0)
  })

  it('rows carry kind / outcome / panel only — never an id', async () => {
    const hx = harness()
    hx.arrive(target(A1, 'safety_alert'))
    hx.reads[0].resolve(null)
    await settleReads()
    expect(Object.keys(hx.rows[0].attrs).sort()).toEqual(['kind', 'outcome', 'panel'])
    expect(JSON.stringify(hx.rows)).not.toContain(A1)
    expect(hx.rows[0].attrs).toEqual({ kind: 'safety_alert', outcome: 'not_found', panel: 'map' })
  })

  it('a business-linked resource is logged as resource and found on the business layer only', async () => {
    const hx = harness()
    hx.arrive(target(R1, 'resource'))
    const leaf: MapFocusPin = { layer: 'business', id: B1, lng: 1, lat: 1 }
    hx.reads[0].resolve(leaf)
    await settleReads()
    hx.session.layersUpdated({ ...EMPTY, resource: [{ id: B1 }] })
    expect(hx.rows).toHaveLength(0)
    hx.session.layersUpdated({ ...EMPTY, business: [{ id: B1 }] })
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

/** Drive the real hook through a sequence of `focused` values (and a member close) inside one
 *  react-dom/server render: each step advances by a render-phase update, which re-runs the
 *  component with its hook state kept. Returns the settled `open` after each step / action. */
function runPopup(steps: Array<{ focused?: boolean; close?: boolean }>): string[] {
  const log: string[] = []
  function Probe() {
    const [step, setStep] = useState(0)
    const [closedAt, setClosedAt] = useState(-1)
    const [lastSeen, setLastSeen] = useState('')
    const [open, setOpen] = useFocusedPopup(steps[step].focused)
    const sig = `${step}:${open}:${closedAt}`
    if (sig !== lastSeen) {
      setLastSeen(sig) // one more pass to see whether this state is settled
      return null
    }
    if (steps[step].close && closedAt !== step) {
      log.push(`${step}:${open}`)
      setOpen(false) // the member closes the popup (× or Escape)
      setClosedAt(step)
      return null
    }
    log.push(`${step}:${open}${closedAt === step ? ' (closed by member)' : ''}`)
    if (step < steps.length - 1) setStep(step + 1)
    return null
  }
  renderToStaticMarkup(h(Probe))
  return log
}

describe('marker popup — opened by the focus', () => {
  it('a mounted marker: false → true opens, the member closes it, false keeps it closed, true opens again', () => {
    expect(runPopup([{ focused: false }, { focused: true, close: true }, { focused: false }, { focused: true }])).toEqual([
      '0:false',
      '1:true',
      '1:false (closed by member)',
      '2:false',
      '3:true',
    ])
  })

  it('losing focus never closes a popup the member has open', () => {
    expect(runPopup([{ focused: true }, { focused: false }, { focused: undefined }])).toEqual(['0:true', '1:true', '2:true'])
  })

  it('a marker that mounts focused starts open; unfocused starts closed', () => {
    expect(runPopup([{ focused: true }])).toEqual(['0:true'])
    expect(runPopup([{ focused: false }])).toEqual(['0:false'])
    expect(runPopup([{}])).toEqual(['0:false'])
  })

  it('the reducer: same object when nothing changed (no state write), open only on a turn to true', () => {
    const s0 = initialPopupState(false)
    expect(popupStateFor(s0, false)).toBe(s0)
    const s1 = popupStateFor(s0, true)
    expect(s1).toEqual({ open: true, seenFocused: true })
    expect(popupStateFor({ open: false, seenFocused: true }, false)).toEqual({ open: false, seenFocused: false })
    expect(popupStateFor({ open: false, seenFocused: undefined }, true).open).toBe(true)
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
