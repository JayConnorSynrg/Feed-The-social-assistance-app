// apps/web/src/hooks/use-safety-alerts.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The map's alert layer on the REAL hook (mini hook runtime, a recording Supabase client, fake
// timers) — Release 3.1 invariants 2 and 5:
//   - reader calls counted across re-renders and bounds changes: a new bounds OBJECT with the same
//     four numbers reads nothing (the 137k-call loop), a real viewport change reads once after it
//     settles, the poll reads once per 60 s;
//   - a vote's answer keeps the pin where it is (and its is_mine) even when the answer carries no
//     coordinates; an answer that clears the alert takes the pin out at once;
//   - a placed alert appears from its answer and the viewport is read once more; a refused place
//     reads nothing;
//   - an update that moved the alert moves the marker;
//   - the server decides what is shown (invariant 1): a browser clock ahead of the server keeps a
//     just-placed pin; "shown until" passing asks the server once and removes nothing by itself;
//   - an alert whose popup is open and that left the viewport's answer is asked for by id before it
//     is marked ended;
//   - unmounting the map stops every read; alerts.poll rows are per 30 reads / unmount / page hide.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  backend: null as unknown as import('@/test/alert-fixtures').RpcBackend,
  logs: [] as Array<Record<string, unknown>>,
  errors: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/supabase/client', async () => {
  const { createRpcBackend, rpcClient } = await import('@/test/alert-fixtures')
  h.backend = createRpcBackend()
  const client = rpcClient(h.backend)
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: (name: string, attrs: Record<string, unknown>) => h.errors.push({ name, ...attrs }) },
  logEvent: (name: string, attrs: Record<string, unknown>) => h.logs.push({ name, ...attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { mount } from '@/test/mini-react'
import { ALERTS_DEBOUNCE_MS, ALERTS_POLL_MS, flushPollCounters, resetPollCounters } from '@/lib/safety-alerts-fetch'
import { ALERT_ID, HOUR, NOW, alert, iso } from '@/test/alert-fixtures'
import { useSafetyAlerts, type ViewportBounds } from './use-safety-alerts'

const doc = {
  visibilityState: 'visible' as 'visible' | 'hidden',
  listeners: new Map<string, () => void>(),
  activeElement: null as null | { closest: (s: string) => unknown },
  body: {},
  canvasFocus: 0,
  elements: new Map<string, unknown>(),
  addEventListener(type: string, fn: () => void) {
    doc.listeners.set(type, fn)
  },
  removeEventListener(type: string) {
    doc.listeners.delete(type)
  },
  querySelector(selector: string) {
    return selector === '.mapboxgl-canvas' ? { focus: () => void doc.canvasFocus++ } : (doc.elements.get(selector) ?? null)
  },
}

const B = (west = -73, south = 43, east = -72, north = 44): ViewportBounds => ({ west, south, east, north })
const reads = () => h.backend.named('safety_alerts_in_view')
const polls = () => h.logs.filter((l) => l.name === 'alerts.poll')
const setVisible = (visible: boolean) => {
  doc.visibilityState = visible ? 'visible' : 'hidden'
  doc.listeners.get('visibilitychange')?.()
}

async function map(initial: ViewportBounds | null = B()) {
  // A fresh object on every render, as a parent that rebuilds its bounds would hand over.
  const state = { make: () => (initial ? { ...initial } : null) as ViewportBounds | null }
  const c = mount(() => useSafetyAlerts(state.make()))
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms)
    return c.rerender()
  }
  await settle(ALERTS_DEBOUNCE_MS)
  return { c, state, settle, hook: () => c.rerender() }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  resetPollCounters()
  h.backend.reset()
  h.backend.answers.safety_alerts_in_view = { data: [alert({ is_mine: true })] }
  h.logs.length = 0
  h.errors.length = 0
  doc.visibilityState = 'visible'
  doc.listeners.clear()
  doc.elements.clear()
  doc.activeElement = null
  doc.canvasFocus = 0
  vi.stubGlobal('document', doc)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('reader calls across re-renders and bounds changes', () => {
  it('fifty re-renders, each with a NEW bounds object holding the same numbers: exactly one read', async () => {
    const m = await map()
    for (let i = 0; i < 50; i++) await m.settle(100)
    expect(reads()).toHaveLength(1)
    expect(reads()[0].args).toEqual({ p_min_lng: -73, p_min_lat: 43, p_max_lng: -72, p_max_lat: 44, p_include_resolved: true })
  })

  it('a real viewport change reads once, after the map settles; a pan in progress reads nothing', async () => {
    const m = await map()
    m.state.make = () => B(-74)
    m.c.rerender()
    await m.settle(ALERTS_DEBOUNCE_MS - 1)
    m.state.make = () => B(-75) // still moving: the read for -74 is never sent
    m.c.rerender()
    await m.settle(ALERTS_DEBOUNCE_MS - 1)
    expect(reads()).toHaveLength(1)
    await m.settle(1)
    expect(reads()).toHaveLength(2)
    expect(reads()[1].args.p_min_lng).toBe(-75)
  })

  it('the poll reads once per 60 s while visible, whatever the render rate; a hidden tab reads nothing', async () => {
    const m = await map()
    for (let second = 0; second < 120; second++) await m.settle(1000)
    expect(reads()).toHaveLength(1 + 2)
    doc.visibilityState = 'hidden'
    doc.listeners.get('visibilitychange')?.()
    await m.settle(ALERTS_POLL_MS * 3)
    expect(reads()).toHaveLength(3)
  })

  it('a slow answer for an older viewport never replaces the newer one', async () => {
    const pending: Array<{ west: number; answer: (rows: unknown[]) => void }> = []
    h.backend.answers.safety_alerts_in_view = (args) => new Promise((resolve) => pending.push({ west: args.p_min_lng as number, answer: (rows) => resolve({ data: rows }) }))
    const m = await map()
    m.state.make = () => B(-74)
    m.c.rerender()
    await m.settle(ALERTS_DEBOUNCE_MS)
    expect(pending.map((p) => p.west)).toEqual([-73, -74])
    pending[1].answer([alert({ id: 'newer-viewport' })])
    await m.settle()
    pending[0].answer([alert({ id: 'older-viewport' })]) // arrives last, for a viewport the map has left
    expect((await m.settle()).alerts.map((a) => a.id)).toEqual(['newer-viewport'])
    expect(m.hook().loading).toBe(false)
  })

  it('no bounds yet: nothing is read', async () => {
    const m = await map(null)
    await m.settle(ALERTS_POLL_MS)
    expect(reads()).toHaveLength(0)
  })

  it('unmounting the map stops everything: no poll, no pending viewport read, no read on return to the tab, no timer left', async () => {
    const m = await map()
    m.state.make = () => B(-74) // a viewport change whose read is still waiting for the map to settle
    m.c.rerender()
    m.c.unmount()
    await vi.advanceTimersByTimeAsync(60 * ALERTS_POLL_MS)
    setVisible(false)
    setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(reads()).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('read volume: alerts.poll rows', () => {
  it('fifty settled pans: 51 reads, one row of thirty; unmount writes the other 21', async () => {
    const m = await map()
    let west = -73
    for (let i = 0; i < 50; i++) {
      west += 0.01
      const w = west
      m.state.make = () => B(w)
      m.c.rerender()
      await m.settle(1000)
    }
    expect(reads()).toHaveLength(51)
    expect(polls().map((p) => [p.surface, p.reads])).toEqual([['map', 30]])
    m.c.unmount()
    expect(polls().map((p) => [p.surface, p.reads])).toEqual([['map', 30], ['map', 21]])
  })

  it('ten minutes visible: eleven reads, no row; hiding the tab writes none; the page going away writes one', async () => {
    const m = await map()
    await m.settle(ALERTS_POLL_MS * 10)
    setVisible(false)
    expect([reads().length, polls().length]).toEqual([11, 0])
    flushPollCounters()
    expect(h.logs).toEqual([{ name: 'alerts.poll', surface: 'map', reads: 11, changed: 0, errors: 0, last_error: null, result_count: 1, window_s: 600 }])
  })

  it('a reader that fails on every read for ten minutes: one error row, and the failures in the window row', async () => {
    h.backend.answers.safety_alerts_in_view = { error: { code: 'PGRST202', message: 'Could not find the function' } }
    const m = await map()
    await m.settle(ALERTS_POLL_MS * 10)
    expect(reads()).toHaveLength(11)
    expect(h.errors).toEqual([{ name: 'safety-alerts.fetch.error', code: 'PGRST202', message: 'alert read failed' }])
    expect(m.hook().error).toBeInstanceOf(Error)
    m.c.unmount()
    expect(polls()).toEqual([{ name: 'alerts.poll', surface: 'map', reads: 11, changed: 0, errors: 11, last_error: 'PGRST202', result_count: 0, window_s: 600 }])
  })
})

// The server's verdict decides, at the server's clock (NOW); the browser's clock is set ahead or behind.
describe('the browser clock is wrong: the map still shows what the server returned', () => {
  it('+3 h: the member places a severity-1 alert (two-hour window): the pin appears and stays through the re-read', async () => {
    vi.setSystemTime(NOW + 3 * HOUR)
    const m = await map()
    const placed = alert({ id: 'mine', is_mine: true, severity: 1, created_at: iso(0), expires_at: iso(2 * HOUR) })
    h.backend.answers.place_safety_alert = { data: placed }
    h.backend.answers.safety_alerts_in_view = { data: [alert({ is_mine: true }), placed] }
    const res = await m.hook().placeAlert({ type: 'road_closure', severity: 1, description: 'x', lng: -72.97, lat: 43.61 })
    expect(res.ok).toBe(true)
    expect(m.hook().alerts.map((a) => a.id)).toContain('mine')
    expect((await m.settle()).alerts.map((a) => [a.id, a.shown_state]).sort()).toEqual([[ALERT_ID, 'live'], ['mine', 'live']].sort())
    expect((await m.settle(ALERTS_POLL_MS * 3)).alerts).toHaveLength(2)
  })

  it.each([
    ['+10 min', 10 * 60_000],
    ['+2 h', 2 * HOUR],
    ['-10 min', -10 * 60_000],
    ['-1 day', -24 * HOUR],
  ])('%s: a live pin with nine minutes left and a resolved pin are both drawn; a row the server calls gone is not', async (_name, skew) => {
    vi.setSystemTime(NOW + skew)
    h.backend.answers.safety_alerts_in_view = {
      data: [
        alert({ id: 'live9', expires_at: iso(9 * 60_000) }),
        alert({ id: 'res', status: 'resolved', resolved_at: iso(-(5 * HOUR + 55 * 60_000)) }),
        alert({ id: 'gone', shown_state: 'gone', shown_until: null }),
      ],
    }
    const m = await map()
    expect(m.hook().alerts.map((a) => [a.id, a.shown_state]).sort()).toEqual([['live9', 'live'], ['res', 'resolved']])
  })

  it('when the server’s "shown until" passes, the map asks the server once; the pin stays until the server stops returning it', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ expires_at: iso(90_000) })] }
    const m = await map()
    await m.settle(91_000 - ALERTS_DEBOUNCE_MS - 1)
    const before = reads().length
    expect((await m.settle(1)).alerts).toHaveLength(1)
    expect(reads()).toHaveLength(before + 1)
    h.backend.answers.safety_alerts_in_view = { data: [] }
    m.hook().host.refresh()
    expect((await m.settle()).alerts).toEqual([])
  })
})

describe('an alert whose popup is open leaves the viewport’s answer', () => {
  const inside = (args: Record<string, unknown>) => (args.p_min_lng as number) <= -72.97 && (args.p_max_lng as number) >= -72.97
  const byId = () => reads().filter((c) => 'p_alert_id' in c.args)

  it('panned away but still live: it is asked for by id, and stays live — votes and all', async () => {
    h.backend.answers.safety_alerts_in_view = (args) => ({ data: 'p_alert_id' in args || inside(args) ? [alert()] : [] })
    const m = await map()
    m.hook().setEngaged(ALERT_ID, true)
    m.state.make = () => B(-72.96, 43, -71.96, 44) // the pin is 0.01° outside the left edge
    m.c.rerender()
    const hook = await m.settle(ALERTS_DEBOUNCE_MS)
    expect(byId().map((c) => c.args)).toEqual([{ p_alert_id: ALERT_ID, p_include_resolved: true }])
    expect(hook.alerts.map((a) => [a.id, a.status, a.shown_state])).toEqual([[ALERT_ID, 'live', 'live']])
    // Once the popup closes, the next read of the viewport no longer holds a pin outside it.
    m.hook().setEngaged(ALERT_ID, false)
    expect((await m.settle(ALERTS_POLL_MS)).alerts).toEqual([])
    expect(byId()).toHaveLength(1)
  })

  it('really ended (the read by id returns nothing): the open popup’s alert is marked ended, not removed', async () => {
    const m = await map()
    m.hook().setEngaged(ALERT_ID, true)
    h.backend.answers.safety_alerts_in_view = { data: [] }
    const hook = await m.settle(ALERTS_POLL_MS)
    expect(byId()).toHaveLength(1)
    expect(hook.alerts.map((a) => [a.id, a.shown_state])).toEqual([[ALERT_ID, 'gone']])
  })

  it('the read by id fails: the alert is left as it was (never marked ended on no evidence)', async () => {
    const m = await map()
    m.hook().setEngaged(ALERT_ID, true)
    h.backend.answers.safety_alerts_in_view = (args) => ('p_alert_id' in args ? { error: { code: '57014', message: 'timeout' } } : { data: [] })
    const hook = await m.settle(ALERTS_POLL_MS)
    expect(hook.alerts.map((a) => [a.id, a.shown_state])).toEqual([[ALERT_ID, 'live']])
  })
})

describe('a vote keeps the pin', () => {
  it('an answer without coordinates: the pin keeps its place and is_mine; counts come from the answer; the viewport is read once', async () => {
    const m = await map()
    const held = m.hook().alerts[0]
    // What the server answered before Release 3: the raw row (a geography, no lng / lat, no is_mine).
    h.backend.answers.vote_safety_alert = { data: { ...held, lng: undefined, lat: undefined, is_mine: undefined, location: '0101000020E6…', confirm_count: 2 } }
    const res = await m.hook().voteAlert(held, 'confirm')
    expect(res.ok).toBe(true)
    const after = m.hook().alerts
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: held.id, lng: -72.97, lat: 43.61, is_mine: true, confirm_count: 2 })
    expect(h.backend.named('vote_safety_alert')[0].args).toEqual({ p_alert_id: held.id, p_vote: 'confirm' })
    await m.settle()
    expect(reads()).toHaveLength(2)
  })

  it('three "Gone now" clear the alert: the pin leaves at once', async () => {
    const m = await map()
    const held = m.hook().alerts[0]
    h.backend.answers.vote_safety_alert = { data: { ...held, status: 'cleared', clear_count: 3, shown_state: 'gone', shown_until: null } }
    h.backend.answers.safety_alerts_in_view = { data: [] }
    const res = await m.hook().voteAlert(held, 'clear')
    expect(res).toMatchObject({ ok: true, value: { status: 'cleared' } })
    expect(m.hook().alerts).toEqual([])
  })

  it('a vote on an alert that ended (PT410): the pin leaves; on one that was resolved: the next read shows it resolved', async () => {
    const m = await map()
    const held = m.hook().alerts[0]
    h.backend.answers.vote_safety_alert = { error: { code: 'PT410', message: 'alert is no longer live', details: '{"status":"expired"}' } }
    expect(await m.hook().voteAlert(held, 'confirm')).toMatchObject({ ok: false, failure: { kind: 'not_live', resolved: false } })
    expect(m.hook().alerts).toEqual([])

    const again = await map()
    const live = again.hook().alerts[0]
    h.backend.answers.vote_safety_alert = { error: { code: 'PT410', message: 'alert is no longer live', details: '{"status":"resolved"}' } }
    h.backend.answers.safety_alerts_in_view = { data: [alert({ ...live, status: 'resolved', resolved_at: iso(0), version: 2, shown_state: undefined, shown_until: undefined })] }
    await again.hook().voteAlert(live, 'confirm')
    expect((await again.settle()).alerts[0]).toMatchObject({ id: live.id, status: 'resolved' })
  })
})

describe('placing and moving', () => {
  it('a placed alert appears from its answer (with the server’s is_mine) and the viewport is read once more', async () => {
    const m = await map()
    const placed = alert({ id: 'placed', alert_type: 'weather', is_mine: true, lng: -72.5, lat: 43.9 })
    h.backend.answers.place_safety_alert = { data: placed }
    const res = await m.hook().placeAlert({ type: 'weather', severity: 2, description: 'Ice', lng: -72.5, lat: 43.9 })
    expect(res.ok).toBe(true)
    expect(m.hook().alerts.map((a) => a.id).sort()).toEqual([alert().id, 'placed'].sort())
    await m.settle()
    expect(reads()).toHaveLength(2)
  })

  it('a refused place adds nothing and reads nothing', async () => {
    const m = await map()
    h.backend.answers.place_safety_alert = { error: { code: '42501', message: 'Account required for this action' } }
    const res = await m.hook().placeAlert({ type: 'weather', severity: 2, description: 'Ice', lng: -72.5, lat: 43.9 })
    expect(res).toMatchObject({ ok: false, failure: { kind: 'guest' } })
    await m.settle()
    expect(m.hook().alerts).toHaveLength(1)
    expect(reads()).toHaveLength(1)
  })

  it('an update that moved the alert moves the marker; one that did not leaves it', async () => {
    const m = await map()
    const held = m.hook().alerts[0]
    m.hook().host.applyAnswer({ ...held, description: 'Detour', version: 2, lng: Number.NaN, lat: Number.NaN })
    expect(m.hook().alerts[0]).toMatchObject({ lng: -72.97, lat: 43.61, description: 'Detour' })
    m.hook().host.applyAnswer({ ...held, version: 3, lng: -72.4, lat: 44.2 })
    expect(m.hook().alerts[0]).toMatchObject({ lng: -72.4, lat: 44.2 })
  })
})

describe('the map’s notice for the member’s own action', () => {
  it('is set by announce, dismissed by clearNotice, and cleared when the member votes or places next', async () => {
    const m = await map()
    m.hook().host.announce('Alert updated.')
    expect(m.hook().notice).toEqual({ text: 'Alert updated.', seq: 1 })
    m.hook().clearNotice()
    expect(m.hook().notice.text).toBe('')

    m.hook().host.announce('Alert marked resolved.')
    h.backend.answers.vote_safety_alert = { data: alert({ is_mine: true, confirm_count: 2 }) }
    await m.hook().voteAlert(m.hook().alerts[0], 'confirm')
    expect(m.hook().notice.text).toBe('')

    m.hook().host.announce('Alert updated.')
    h.backend.answers.place_safety_alert = { error: { code: '42501', message: 'Account required for this action' } }
    await m.hook().placeAlert({ type: 'weather', severity: 2, description: 'Ice', lng: -72.5, lat: 43.9 })
    expect(m.hook().notice.text).toBe('')
    // The same sentence twice is still a new message (seq moves).
    m.hook().host.announce('Alert updated.')
    expect(m.hook().notice.seq).toBeGreaterThan(2)
  })
})

describe('focus for an alert that is still on the map', () => {
  it('goes to its open popup’s dialog; with no popup, to its marker; false when it is not drawn', async () => {
    const m = await map()
    const got: string[] = []
    doc.elements.set(`[data-testid="safety-alert-marker-${ALERT_ID}"]`, { focus: () => void got.push('marker') })
    expect(m.hook().host.focusAlert(ALERT_ID)).toBe(true)
    doc.elements.set(`[data-testid="safety-alert-popup-${ALERT_ID}"]`, { closest: (s: string) => (s === '[role="dialog"]' ? { focus: () => void got.push('popup') } : null) })
    expect(m.hook().host.focusAlert(ALERT_ID)).toBe(true)
    expect(m.hook().host.focusAlert('missing')).toBe(false)
    expect(got).toEqual(['marker', 'popup'])
  })
})

describe('focus after an alert left the map', () => {
  it('goes to the map when focus would be lost, and stays put when the member is elsewhere', async () => {
    const m = await map()
    doc.activeElement = { closest: (s: string) => (s.includes('mapboxgl-popup') ? {} : null) } // inside the leaving popup
    m.hook().host.focusAfterLeave()
    expect(doc.canvasFocus).toBe(1)
    doc.activeElement = { closest: () => null } // e.g. the search box
    m.hook().host.focusAfterLeave()
    expect(doc.canvasFocus).toBe(1)
  })
})
