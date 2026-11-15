// apps/web/src/lib/safety-alerts-fetch.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// When the alert surfaces read (Release 3.1 invariant 2): once per real change of a primitive key
// (the map's four bound numbers after 400 ms; the strip's viewer id at once), every 60 s while
// visible, once on return to the tab, once on refresh — never once per render (the loop that made
// safety_alerts_in_view ~1,100x more frequent than resources_in_bounds). And how the read volume is
// measured (invariant 8): one alerts.poll row per 30 reads or page hide, never one per read, per tab
// hide or per panel visit, and one error report per window however many reads fail.
// Fake timers + a counting fake fetch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  ALERTS_DEBOUNCE_MS,
  ALERTS_POLL_MS,
  KeyedPollScheduler,
  POLL_FLUSH_EVERY,
  PollCounter,
  SafetyAlertsFetchScheduler,
  boundsKey,
  createLatestOnlyLoader,
  flushPollCounters,
  resetPollCounters,
  sharedPollCounter,
  type AlertBounds,
  type PollRow,
} from './safety-alerts-fetch'

const B = (west = -73, south = 43, east = -72, north = 44): AlertBounds => ({ west, south, east, north })

function counting(visible = true) {
  const calls: AlertBounds[] = []
  const state = { visible }
  const scheduler = new SafetyAlertsFetchScheduler({ fetch: (b) => calls.push(b), isVisible: () => state.visible })
  return { scheduler, calls, state }
}

describe('SafetyAlertsFetchScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('N re-renders handing over new objects with identical bounds → exactly one read', () => {
    const { scheduler, calls } = counting()
    for (let i = 0; i < 50; i++) {
      scheduler.setBounds(B()) // a fresh object every render
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    expect(calls).toHaveLength(1)
    expect(boundsKey(calls[0])).toBe(boundsKey(B()))
  })

  it('one read per real viewport change, debounced: a pan that settles reads once, at its end', () => {
    const { scheduler, calls } = counting()
    scheduler.setBounds(B())
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    scheduler.setBounds(B(-74))
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS - 1)
    scheduler.setBounds(B(-75)) // still moving: the previous read is not sent
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    expect(calls.map((c) => c.west)).toEqual([-73, -75])
  })

  it('the 60 s poll fires once per 60 s while visible, and not while hidden', () => {
    const { scheduler, calls, state } = counting()
    scheduler.setBounds(B())
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    expect(calls).toHaveLength(1)
    // Re-renders with the same bounds do not restart the poll.
    for (let t = 0; t < ALERTS_POLL_MS * 3; t += 1000) {
      scheduler.setBounds(B())
      vi.advanceTimersByTime(1000)
    }
    expect(calls).toHaveLength(1 + 3)
    state.visible = false
    vi.advanceTimersByTime(ALERTS_POLL_MS * 2)
    expect(calls).toHaveLength(4)
  })

  it('refresh reads the current viewport once, now; with no viewport it reads nothing', () => {
    const { scheduler, calls } = counting()
    scheduler.refresh()
    expect(calls).toHaveLength(0)
    scheduler.setBounds(B())
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    scheduler.refresh()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(B())
  })

  it('the tab becoming visible reads the current viewport once; becoming hidden reads nothing', () => {
    const { scheduler, calls } = counting()
    scheduler.visibilityChanged(true) // no viewport yet
    expect(calls).toHaveLength(0)
    scheduler.setBounds(B())
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    scheduler.visibilityChanged(false)
    expect(calls).toHaveLength(1)
    scheduler.visibilityChanged(true)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(B())
  })

  it('dispose stops every timer; a StrictMode re-mount (setBounds after dispose) schedules afresh', () => {
    const { scheduler, calls } = counting()
    scheduler.setBounds(B())
    scheduler.dispose()
    vi.advanceTimersByTime(ALERTS_POLL_MS * 2)
    expect(calls).toHaveLength(0)
    scheduler.setBounds(B())
    vi.advanceTimersByTime(ALERTS_DEBOUNCE_MS)
    expect(calls).toHaveLength(1)
  })
})

describe('KeyedPollScheduler with no debounce (the feed strip: keyed on the viewer id)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function strip(visible = true) {
    const calls: string[] = []
    const state = { visible }
    const scheduler = new KeyedPollScheduler<string>({ fetch: (viewer) => calls.push(viewer), isVisible: () => state.visible, debounceMs: 0 })
    return { scheduler, calls, state }
  }

  it('reads at once for a viewer; the same viewer again (every render) reads nothing', () => {
    const { scheduler, calls } = strip()
    for (let i = 0; i < 50; i++) scheduler.set('user-1', 'user-1')
    expect(calls).toEqual(['user-1'])
  })

  it('polls once per 60 s while visible, not while hidden, and reads once on return', () => {
    const { scheduler, calls, state } = strip()
    scheduler.set('user-1', 'user-1')
    vi.advanceTimersByTime(ALERTS_POLL_MS * 3)
    expect(calls).toHaveLength(1 + 3)
    state.visible = false
    scheduler.visibilityChanged(false)
    vi.advanceTimersByTime(ALERTS_POLL_MS * 5)
    expect(calls).toHaveLength(4)
    state.visible = true
    scheduler.visibilityChanged(true)
    expect(calls).toHaveLength(5)
  })

  it('a new viewer reads at once; no viewer stops everything', () => {
    const { scheduler, calls } = strip()
    scheduler.set('user-1', 'user-1')
    scheduler.set('user-2', 'user-2')
    expect(calls).toEqual(['user-1', 'user-2'])
    scheduler.set(null, null)
    scheduler.refresh()
    vi.advanceTimersByTime(ALERTS_POLL_MS * 2)
    expect(calls).toHaveLength(2)
  })

  it('refresh reads once, now (after the member’s own action)', () => {
    const { scheduler, calls } = strip()
    scheduler.set('user-1', 'user-1')
    scheduler.refresh()
    expect(calls).toEqual(['user-1', 'user-1'])
  })
})

describe('PollCounter — read volume without a row per read', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.parse('2026-10-11T12:00:00.000Z') })
    resetPollCounters()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function counting() {
    const rows: PollRow[] = []
    const firstErrors: string[] = []
    return { rows, firstErrors, counter: new PollCounter('strip', (row) => rows.push(row), (code) => firstErrors.push(code)) }
  }

  it('30 reads write one row; 29 write none', () => {
    const { rows, counter } = counting()
    for (let i = 0; i < POLL_FLUSH_EVERY - 1; i++) {
      counter.record({ signature: 'a', count: 2 })
      vi.advanceTimersByTime(ALERTS_POLL_MS)
    }
    expect(rows).toEqual([])
    counter.record({ signature: 'a', count: 2 })
    expect(rows).toEqual([{ surface: 'strip', reads: 30, changed: 0, errors: 0, last_error: null, result_count: 2, window_s: 29 * 60 }])
  })

  it('a flush (the page goes away) writes what has accumulated, then starts over; no reads, no row', () => {
    const { rows, counter } = counting()
    counter.flush()
    expect(rows).toEqual([])
    counter.record({ signature: 'a', count: 1 })
    counter.record({ signature: 'b', count: 2 })
    counter.record({ error: '57014' })
    counter.record({ signature: 'b', count: 2 })
    counter.flush()
    expect(rows).toEqual([{ surface: 'strip', reads: 4, changed: 1, errors: 1, last_error: '57014', result_count: 2, window_s: 0 }])
    counter.flush()
    expect(rows).toHaveLength(1)
    counter.record({ signature: 'c', count: 0 })
    counter.flush()
    // Changed is counted against the last answer seen, across windows; the error does not carry over.
    expect(rows[1]).toMatchObject({ reads: 1, changed: 1, errors: 0, last_error: null, result_count: 0 })
  })

  it('an hour of an idle visible strip is two rows, not sixty', () => {
    const { rows, counter } = counting()
    for (let minute = 0; minute < 60; minute++) counter.record({ signature: 'same', count: 3 })
    expect(rows).toHaveLength(2)
    expect(rows.reduce((n, r) => n + r.reads, 0)).toBe(60)
  })

  it('a reader that fails on every read: one report per window, and the window row counts the failures', () => {
    const { rows, firstErrors, counter } = counting()
    for (let i = 0; i < POLL_FLUSH_EVERY + 5; i++) counter.record({ error: i < POLL_FLUSH_EVERY ? 'PGRST202' : 'exception' })
    // 35 failed reads: the first of each window was reported (2), not 35.
    expect(firstErrors).toEqual(['PGRST202', 'exception'])
    expect(rows).toEqual([{ surface: 'strip', reads: 30, changed: 0, errors: 30, last_error: 'PGRST202', result_count: 0, window_s: 0 }])
  })

  it('the page’s counter for a surface is one object: it counts on across whoever holds it, until thirty reads or a flush', () => {
    const rows: PollRow[] = []
    const write = (row: PollRow) => rows.push(row)
    // Twenty holders, one read each.
    for (let visit = 0; visit < 20; visit++) sharedPollCounter('strip', write, () => {}).record({ signature: 'a', count: 1 })
    expect(rows).toEqual([])
    expect(sharedPollCounter('strip', write, () => {})).toBe(sharedPollCounter('strip', write, () => {}))
    expect(sharedPollCounter('map', write, () => {})).not.toBe(sharedPollCounter('strip', write, () => {}))
    // Ten more reads reach thirty: one row for the lot.
    for (let read = 0; read < 10; read++) sharedPollCounter('strip', write, () => {}).record({ signature: 'a', count: 1 })
    expect(rows.map((r) => [r.surface, r.reads])).toEqual([['strip', 30]])
  })

  it('pagehide writes every surface’s open window, once', () => {
    const listeners = new Map<string, () => void>()
    vi.stubGlobal('window', { addEventListener: (type: string, fn: () => void) => listeners.set(type, fn) })
    const rows: PollRow[] = []
    sharedPollCounter('strip', (row) => rows.push(row), () => {}).record({ signature: 'a', count: 1 })
    sharedPollCounter('map', (row) => rows.push(row), () => {}).record({ signature: 'b', count: 4 })
    expect([...listeners.keys()]).toEqual(['pagehide'])
    listeners.get('pagehide')!()
    listeners.get('pagehide')!()
    expect(rows.map((r) => [r.surface, r.reads, r.result_count])).toEqual([['strip', 1, 1], ['map', 1, 4]])
    flushPollCounters()
    expect(rows).toHaveLength(2)
  })
})

describe('createLatestOnlyLoader — a slow answer for an older viewport never wins', () => {
  function deferred<T>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  function harness() {
    const pending: Array<ReturnType<typeof deferred<string>>> = []
    const results: string[] = []
    const errors: unknown[] = []
    const loading: boolean[] = []
    const load = createLatestOnlyLoader<number, string>({
      read: () => {
        const d = deferred<string>()
        pending.push(d)
        return d.promise
      },
      onStart: () => loading.push(true),
      onResult: (r) => results.push(r),
      onError: (e) => errors.push(e),
      onSettled: () => loading.push(false),
    })
    return { load, pending, results, errors, loading }
  }

  it('two reads in flight resolving in reverse order: the newer result wins, the older is dropped', async () => {
    const hx = harness()
    const first = hx.load(1)
    const second = hx.load(2)
    hx.pending[1].resolve('newer viewport')
    await second
    hx.pending[0].resolve('older viewport')
    await first
    expect(hx.results).toEqual(['newer viewport'])
    // Loading ends with the newer read only.
    expect(hx.loading).toEqual([true, true, false])
  })

  it('an older read failing after a newer one succeeded reports no error', async () => {
    const hx = harness()
    const first = hx.load(1)
    const second = hx.load(2)
    hx.pending[1].resolve('ok')
    await second
    hx.pending[0].reject(new Error('timeout'))
    await first
    expect(hx.results).toEqual(['ok'])
    expect(hx.errors).toEqual([])
  })

  it('the newest read failing still ends loading (an older answer arriving late changes nothing)', async () => {
    const hx = harness()
    const first = hx.load(1)
    const second = hx.load(2)
    hx.pending[1].reject(new Error('timeout'))
    await second
    hx.pending[0].resolve('older viewport')
    await first
    expect(hx.errors).toHaveLength(1)
    expect(hx.results).toEqual([])
    expect(hx.loading).toEqual([true, true, false])
  })

  it('a single read applies its result', async () => {
    const hx = harness()
    const only = hx.load(1)
    hx.pending[0].resolve('only')
    await only
    expect(hx.results).toEqual(['only'])
    expect(hx.loading).toEqual([true, false])
  })
})
