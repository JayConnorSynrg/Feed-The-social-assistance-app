// apps/web/src/lib/safety-alert-store.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The store between reads — Release 3.1 invariants 1 (the server decides), 5 (pins survive) and the
// half of 7 that lives here:
//   - a row is kept or dropped by the verdict the server put on it, on any browser clock; the store
//     never deletes on its own clock: at a "shown until" instant still ahead it asks for ONE read,
//     and at one already behind it does nothing (the 60 s poll is the backstop);
//   - an RPC answer is merged onto the alert held: the pin keeps its coordinates and its is_mine
//     (an answer without coordinates, or with NaN, never moves it); an answer WITH coordinates moves
//     it; the alert stays in the list (its popup stays open);
//   - an answer whose verdict is gone (cleared by votes) and a withdrawal take it out at once;
//   - an alert the member is engaged with is never taken away by a read: the store asks for it by
//     id — still shown: it stays as it is (it only left the viewport); gone: it stays, marked ended,
//     until they let go.
// Fake timers: the browser clock is Date.now(); the server's clock is the fixtures' NOW.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { alertShownState } from './safety-alert-live'
import type { SafetyAlert } from './safety-alert-rpc'
import { ENDED_STATUS, SHOWN_UNTIL_MARGIN_MS, SafetyAlertStore, alertsSignature, compareAlerts, mergeAlertAnswer } from './safety-alert-store'
import { HOUR, NOW, alert, iso } from '@/test/alert-fixtures'

const mine = (over: Partial<SafetyAlert> = {}) => alert({ id: 'a1', is_mine: true, verified: true, ...over })

function harness(deps: { recheck?: (id: string) => Promise<SafetyAlert | null> } = {}) {
  const emitted: SafetyAlert[][] = []
  const due: number[] = []
  const store = new SafetyAlertStore((list) => emitted.push(list), { onDue: () => due.push(Date.now()), ...deps })
  const ids = () => store.list().map((a) => a.id)
  return { store, emitted, due, ids }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('mergeAlertAnswer — the pin keeps its place', () => {
  it('an answer without coordinates (or with NaN) keeps the held ones and is_mine; content and the verdict come from the answer', () => {
    const held = mine()
    const answer = mine({ lng: Number.NaN, lat: Number.NaN, is_mine: false, confirm_count: 2, severity: 4, description: null, version: 2, verified: false, expires_at: iso(72 * HOUR) })
    const merged = mergeAlertAnswer(held, answer)
    expect([merged.lng, merged.lat]).toEqual([-72.97, 43.61])
    expect(merged.is_mine).toBe(true)
    expect(merged).toMatchObject({ confirm_count: 2, severity: 4, description: null, version: 2, verified: false, expires_at: iso(72 * HOUR), shown_state: 'live', shown_until: iso(72 * HOUR) })
  })

  it('half a coordinate is no coordinate: the pin stays where it was', () => {
    const merged = mergeAlertAnswer(mine(), mine({ lng: -70, lat: Number.NaN }))
    expect([merged.lng, merged.lat]).toEqual([-72.97, 43.61])
  })

  it('an answer with two finite coordinates moves the pin (an update that moved the alert)', () => {
    const merged = mergeAlertAnswer(mine(), mine({ lng: -72.5, lat: 44.1, version: 2 }))
    expect([merged.lng, merged.lat]).toEqual([-72.5, 44.1])
  })

  it('a first answer (a placed alert) is taken whole, with the server is_mine', () => {
    expect(mergeAlertAnswer(undefined, mine())).toEqual(mine())
  })

  it('who resolved it rides along as a role', () => {
    expect(mergeAlertAnswer(mine(), mine({ status: 'resolved', resolved_at: iso(0), resolved_by_role: 'moderator' })).resolved_by_role).toBe('moderator')
  })
})

describe('the server decides what is held, on any browser clock', () => {
  // The server (clock = NOW) returns: 9 minutes left, 1 hour left, resolved 5 h 55 min ago.
  const served = () => [
    alert({ id: 'live-9-min', expires_at: iso(9 * 60_000) }),
    alert({ id: 'live-1-h', expires_at: iso(HOUR) }),
    alert({ id: 'resolved', status: 'resolved', resolved_at: iso(-(5 * HOUR + 55 * 60_000)) }),
  ]

  it.each([
    ['+10 min', 10 * 60_000],
    ['+2 h', 2 * HOUR],
    ['+3 h', 3 * HOUR],
    ['-10 min', -10 * 60_000],
    ['-1 day', -24 * HOUR],
  ])('browser clock %s: every row the server returned is held, with the server’s verdict', (_label, skew) => {
    vi.setSystemTime(NOW + skew)
    const { store, ids } = harness()
    store.replace(served())
    expect(ids()).toEqual(['live-9-min', 'live-1-h', 'resolved'])
    expect(store.list().map((a) => alertShownState(a))).toEqual(['live', 'live', 'resolved'])
  })

  it('a clock that is ahead never removes a row the server just returned — not at once, not later', () => {
    vi.setSystemTime(NOW + 3 * HOUR)
    const { store, ids, due } = harness()
    store.replace(served())
    vi.advanceTimersByTime(24 * HOUR)
    expect(ids()).toEqual(['live-9-min', 'live-1-h', 'resolved'])
    // Every "shown until" is already behind this clock: nothing to wait for, the poll will ask.
    expect(due).toEqual([])
  })

  it('at the earliest "shown until" still ahead, the store asks for ONE read and deletes nothing', () => {
    const { store, ids, due, emitted } = harness()
    store.replace(served())
    const before = emitted.length
    vi.advanceTimersByTime(5 * 60_000 + SHOWN_UNTIL_MARGIN_MS - 1) // the resolved row's instant is the earliest: +5 min
    expect(due).toEqual([])
    vi.advanceTimersByTime(1)
    expect(due).toHaveLength(1)
    expect(ids()).toEqual(['live-9-min', 'live-1-h', 'resolved'])
    expect(emitted.length).toBe(before)
    // The read answers: the server dropped it. Only now does it leave.
    store.replace(served().slice(0, 2))
    expect(ids()).toEqual(['live-9-min', 'live-1-h'])
  })

  it('after that one read the same instant is not asked about again; the next instant is', () => {
    const { store, due } = harness()
    store.replace(served())
    vi.advanceTimersByTime(5 * 60_000 + SHOWN_UNTIL_MARGIN_MS)
    store.replace(served()) // the server still returns all three (its clock is a little behind)
    vi.advanceTimersByTime(60_000)
    expect(due).toHaveLength(1)
    vi.advanceTimersByTime(3 * 60_000 + SHOWN_UNTIL_MARGIN_MS) // +9 min: the next row's instant
    expect(due).toHaveLength(2)
  })

  it('a clock that is behind keeps a row the server has not dropped yet; the read that omits it removes it', () => {
    vi.setSystemTime(NOW - 10 * 60_000)
    const { store, ids } = harness()
    store.replace([alert({ id: 'a1', expires_at: iso(30_000) })])
    vi.advanceTimersByTime(45_000)
    expect(ids()).toEqual(['a1'])
    store.replace([])
    expect(ids()).toEqual([])
  })

  it('a row the server calls gone is never held, though its dates look live on this clock', () => {
    vi.setSystemTime(NOW - 24 * HOUR)
    const { store, ids } = harness()
    store.replace([alert({ id: 'live' }), alert({ id: 'cleared', status: 'cleared' }), alert({ id: 'over', expires_at: iso(-1) })])
    expect(ids()).toEqual(['live'])
  })

  it('without a reader to ask (no onDue) no timer is armed at all', () => {
    const store = new SafetyAlertStore(() => {})
    store.replace(served())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('dispose stops the timer', () => {
    const { store, due } = harness()
    store.replace(served())
    store.dispose()
    vi.advanceTimersByTime(24 * HOUR)
    expect(due).toEqual([])
  })
})

describe('answers and withdrawals', () => {
  it('a vote answer keeps the alert in the list, at its place, with finite coordinates', () => {
    const { store, emitted } = harness()
    store.replace([mine(), alert({ id: 'a2', severity: 1 })])
    store.apply(mine({ lng: Number.NaN, lat: Number.NaN, is_mine: false, confirm_count: 5 }))
    const list = emitted.at(-1)!
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(list[0]).toMatchObject({ confirm_count: 5, lng: -72.97, lat: 43.61, is_mine: true })
    expect(list.every((a) => Number.isFinite(a.lng) && Number.isFinite(a.lat))).toBe(true)
  })

  it('an answer that clears the alert (three "Gone now": the server’s verdict is gone) takes it out at once', () => {
    const { store, ids } = harness()
    store.replace([mine()])
    store.apply(mine({ status: 'cleared', clear_count: 3 }))
    expect(ids()).toEqual([])
  })

  it('a placed alert is held by the server’s verdict even when its expiry is behind this clock', () => {
    vi.setSystemTime(NOW + 3 * HOUR)
    const { store, ids } = harness()
    store.apply(mine({ expires_at: iso(2 * HOUR) })) // a severity-1 alert: 2 hours, by the server's clock
    expect(ids()).toEqual(['a1'])
  })

  it('a withdrawal takes it out at once', () => {
    const { store, ids, emitted } = harness()
    store.replace([mine(), alert({ id: 'a2' })])
    store.remove('a1')
    expect(ids()).toEqual(['a2'])
    expect(emitted.at(-1)!.map((a) => a.id)).toEqual(['a2'])
  })

  it('a resolved answer switches the alert to resolved at once, after the live ones', () => {
    const { store, ids } = harness()
    store.replace([mine(), alert({ id: 'a2', severity: 1, expires_at: iso(24 * HOUR) })])
    store.apply(mine({ status: 'resolved', resolved_at: iso(0), resolved_by_role: 'owner', version: 2 }))
    expect(ids()).toEqual(['a2', 'a1'])
    expect(alertShownState(store.get('a1')!)).toBe('resolved')
  })
})

describe('an alert the member is on is not taken away by a read', () => {
  const flush = () => vi.advanceTimersByTimeAsync(0)

  it('it only left the viewport (the by-id read still shows it): it stays as it is, with its fresh row', async () => {
    const asked: string[] = []
    const { store, ids } = harness({ recheck: async (id) => (asked.push(id), mine({ confirm_count: 9 })) })
    store.replace([mine(), alert({ id: 'a2' })])
    store.setEngaged('a1', true)
    store.replace([alert({ id: 'a2' })])
    expect(ids()).toEqual(['a2', 'a1']) // kept while the answer is on its way
    expect(alertShownState(store.get('a1')!)).toBe('live')
    await flush()
    expect(asked).toEqual(['a1'])
    expect(store.get('a1')).toMatchObject({ status: 'live', shown_state: 'live', confirm_count: 9 })
  })

  it('the server no longer shows it (the by-id read finds nothing): it stays, marked ended, until the member lets go', async () => {
    const { store, ids } = harness({ recheck: async () => null })
    store.replace([mine(), alert({ id: 'a2' })])
    store.setEngaged('a1', true)
    store.replace([alert({ id: 'a2' })])
    await flush()
    expect(ids()).toEqual(['a2', 'a1'])
    expect(store.get('a1')).toMatchObject({ status: ENDED_STATUS, shown_state: 'gone' })
    store.replace([alert({ id: 'a2' })]) // a second read still keeps it, and asks nothing more
    expect(ids()).toContain('a1')
    store.setEngaged('a1', false)
    expect(ids()).toEqual(['a2'])
  })

  it('the by-id read failed (offline): the alert stays as last seen, and the next read asks again', async () => {
    let calls = 0
    const { store } = harness({ recheck: async () => (calls++, Promise.reject(new Error('offline'))) })
    store.replace([mine()])
    store.setEngaged('a1', true)
    store.replace([])
    await flush()
    expect(store.get('a1')).toMatchObject({ status: 'live', shown_state: 'live' })
    store.replace([])
    await flush()
    expect(calls).toBe(2)
  })

  it('one by-id read per dropped alert at a time', async () => {
    let release!: (row: SafetyAlert | null) => void
    let calls = 0
    const { store } = harness({ recheck: () => (calls++, new Promise((r) => (release = r))) })
    store.replace([mine()])
    store.setEngaged('a1', true)
    store.replace([])
    store.replace([])
    expect(calls).toBe(1)
    release(null)
    await flush()
    expect(store.get('a1')?.status).toBe(ENDED_STATUS)
  })

  it('the member let go before the answer came: nothing is kept', async () => {
    let release!: (row: SafetyAlert | null) => void
    const { store, ids } = harness({ recheck: () => new Promise((r) => (release = r)) })
    store.replace([mine()])
    store.setEngaged('a1', true)
    store.replace([])
    store.setEngaged('a1', false)
    release(mine())
    await flush()
    // Still held as last seen (it was shown); the next read, with nobody on it, drops it.
    store.replace([])
    expect(ids()).toEqual([])
  })

  it('no way to ask (no recheck): it is marked ended', () => {
    const { store } = harness()
    store.replace([mine()])
    store.setEngaged('a1', true)
    store.replace([])
    expect(store.get('a1')?.status).toBe(ENDED_STATUS)
  })

  it('the member’s own withdrawal still takes it out at once', () => {
    const { store, ids } = harness()
    store.replace([mine()])
    store.setEngaged('a1', true)
    store.remove('a1')
    expect(ids()).toEqual([])
  })

  it('letting go of a still-shown alert changes nothing', () => {
    const { store, ids, emitted } = harness()
    store.replace([mine()])
    store.setEngaged('a1', true)
    const before = emitted.length
    store.setEngaged('a1', false)
    expect(ids()).toEqual(['a1'])
    expect(emitted.length).toBe(before)
  })
})

describe('order and signature', () => {
  it('live first, then highest severity, then newest (the reader’s order)', () => {
    const rows = [
      alert({ id: 'resolved-4', severity: 4, status: 'resolved', resolved_at: iso(0) }),
      alert({ id: 'live-1-new', severity: 1, created_at: iso(-1000) }),
      alert({ id: 'live-3', severity: 3 }),
      alert({ id: 'live-1-old', severity: 1, created_at: iso(-HOUR) }),
    ]
    expect([...rows].sort(compareAlerts).map((a) => a.id)).toEqual(['live-3', 'live-1-new', 'live-1-old', 'resolved-4'])
  })

  it('the signature moves with a version, the verdict, a count or the verified mark — not with a re-read of the same thing', () => {
    const base = alertsSignature([alert()])
    expect(alertsSignature([alert()])).toBe(base)
    for (const over of [{ version: 2 }, { status: 'resolved', resolved_at: iso(0) }, { confirm_count: 2 }, { clear_count: 1 }, { verified: true }] as Array<Partial<SafetyAlert>>) {
      expect(alertsSignature([alert(over)]), JSON.stringify(over)).not.toBe(base)
    }
    expect(alertsSignature([])).toBe('')
  })
})
