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
//   - an update that moved the alert moves the marker.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  backend: null as unknown as import('@/test/alert-fixtures').RpcBackend,
  logs: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/supabase/client', async () => {
  const { createRpcBackend, rpcClient } = await import('@/test/alert-fixtures')
  h.backend = createRpcBackend()
  const client = rpcClient(h.backend)
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => h.logs.push({ name, ...attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { mount } from '@/test/mini-react'
import { ALERTS_DEBOUNCE_MS, ALERTS_POLL_MS } from '@/lib/safety-alerts-fetch'
import { NOW, alert } from '@/test/alert-fixtures'
import { useSafetyAlerts, type ViewportBounds } from './use-safety-alerts'

const doc = {
  visibilityState: 'visible' as 'visible' | 'hidden',
  listeners: new Map<string, () => void>(),
  activeElement: null as null | { closest: (s: string) => unknown },
  body: {},
  canvasFocus: 0,
  addEventListener(type: string, fn: () => void) {
    doc.listeners.set(type, fn)
  },
  removeEventListener(type: string) {
    doc.listeners.delete(type)
  },
  querySelector(selector: string) {
    return selector === '.mapboxgl-canvas' ? { focus: () => void doc.canvasFocus++ } : null
  },
}

const B = (west = -73, south = 43, east = -72, north = 44): ViewportBounds => ({ west, south, east, north })
const reads = () => h.backend.named('safety_alerts_in_view')

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
  h.backend.reset()
  h.backend.answers.safety_alerts_in_view = { data: [alert({ is_mine: true })] }
  h.logs.length = 0
  doc.visibilityState = 'visible'
  doc.listeners.clear()
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

  it('no bounds yet: nothing is read', async () => {
    const m = await map(null)
    await m.settle(ALERTS_POLL_MS)
    expect(reads()).toHaveLength(0)
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
    h.backend.answers.vote_safety_alert = { data: { ...held, status: 'cleared', clear_count: 3 } }
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
    h.backend.answers.safety_alerts_in_view = { data: [{ ...live, status: 'resolved', resolved_at: new Date(NOW).toISOString(), version: 2 }] }
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
