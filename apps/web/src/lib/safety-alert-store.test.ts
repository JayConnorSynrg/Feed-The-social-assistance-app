// apps/web/src/lib/safety-alert-store.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 5 — pins survive — and the half of invariant 7 that lives in the store:
//   - an RPC answer is merged onto the alert held: the pin keeps its coordinates and its is_mine
//     (an answer without coordinates, or with NaN, never moves it); an answer WITH coordinates (an
//     update that moved the alert) moves it; the alert stays in the list (its popup stays open);
//   - an answer that ends the alert (cleared by votes) and a withdrawal take it out at once;
//   - a resolved alert switches to resolved at once and leaves six hours later with no read;
//   - an alert the member is engaged with (focus in its strip entry, popup open) is never taken away
//     by a read or by the clock: it stays, marked ended, until they let go.
// Fake timers: the store's clock is Date.now().

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { alertShownState, RESOLVED_SHOWN_MS } from './safety-alert-live'
import type { SafetyAlert } from './safety-alert-rpc'
import { ENDED_STATUS, SafetyAlertStore, alertsSignature, compareAlerts, mergeAlertAnswer } from './safety-alert-store'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const HOUR = 3600_000

const alert = (over: Partial<SafetyAlert> = {}): SafetyAlert => ({
  id: 'a1',
  alert_type: 'road_closure',
  severity: 2,
  description: 'Bridge out',
  lng: -72.97,
  lat: 43.61,
  status: 'live',
  confirm_count: 1,
  clear_count: 0,
  created_at: iso(-HOUR),
  expires_at: iso(5 * HOUR),
  verified: true,
  is_mine: true,
  version: 1,
  updated_at: null,
  update_count: 0,
  resolved_at: null,
  ...over,
})

function harness() {
  const emitted: SafetyAlert[][] = []
  const store = new SafetyAlertStore((list) => emitted.push(list))
  const ids = () => store.list().map((a) => a.id)
  return { store, emitted, ids }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('mergeAlertAnswer — the pin keeps its place', () => {
  it('an answer without coordinates (or with NaN) keeps the held ones and is_mine; content comes from the answer', () => {
    const held = alert()
    const answer = alert({ lng: Number.NaN, lat: Number.NaN, is_mine: false, confirm_count: 2, severity: 4, description: null, version: 2, verified: false, expires_at: iso(72 * HOUR) })
    const merged = mergeAlertAnswer(held, answer)
    expect([merged.lng, merged.lat]).toEqual([-72.97, 43.61])
    expect(merged.is_mine).toBe(true)
    expect(merged).toMatchObject({ confirm_count: 2, severity: 4, description: null, version: 2, verified: false, expires_at: iso(72 * HOUR) })
  })

  it('half a coordinate is no coordinate: the pin stays where it was', () => {
    const merged = mergeAlertAnswer(alert(), alert({ lng: -70, lat: Number.NaN }))
    expect([merged.lng, merged.lat]).toEqual([-72.97, 43.61])
  })

  it('an answer with two finite coordinates moves the pin (an update that moved the alert)', () => {
    const merged = mergeAlertAnswer(alert(), alert({ lng: -72.5, lat: 44.1, version: 2 }))
    expect([merged.lng, merged.lat]).toEqual([-72.5, 44.1])
  })

  it('a first answer (a placed alert) is taken whole, with the server is_mine', () => {
    const merged = mergeAlertAnswer(undefined, alert({ is_mine: true }))
    expect(merged).toEqual(alert({ is_mine: true }))
  })
})

describe('SafetyAlertStore', () => {
  it('a vote answer keeps the alert in the list, at its place, with finite coordinates', () => {
    const { store, emitted } = harness()
    store.replace([alert({ id: 'a1' }), alert({ id: 'a2', severity: 1 })])
    store.apply(alert({ id: 'a1', lng: Number.NaN, lat: Number.NaN, is_mine: false, confirm_count: 5 }))
    const list = emitted.at(-1)!
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(list[0]).toMatchObject({ confirm_count: 5, lng: -72.97, lat: 43.61, is_mine: true })
    expect(list.every((a) => Number.isFinite(a.lng) && Number.isFinite(a.lat))).toBe(true)
  })

  it('an answer that clears the alert (three "Gone now") takes it out at once', () => {
    const { store, ids } = harness()
    store.replace([alert()])
    store.apply(alert({ status: 'cleared', clear_count: 3 }))
    expect(ids()).toEqual([])
  })

  it('a withdrawal takes it out at once', () => {
    const { store, ids, emitted } = harness()
    store.replace([alert({ id: 'a1' }), alert({ id: 'a2' })])
    store.remove('a1')
    expect(ids()).toEqual(['a2'])
    expect(emitted.at(-1)!.map((a) => a.id)).toEqual(['a2'])
  })

  it('a resolved answer switches the alert to resolved at once; it leaves six hours later with no read', () => {
    const { store, ids } = harness()
    store.replace([alert({ id: 'a1' }), alert({ id: 'a2', severity: 1, expires_at: iso(24 * HOUR) })])
    store.apply(alert({ id: 'a1', status: 'resolved', resolved_at: iso(0), version: 2 }))
    // Resolved is shown, never live, and sorts after the live one.
    expect(ids()).toEqual(['a2', 'a1'])
    expect(alertShownState(store.get('a1')!, Date.now())).toBe('resolved')
    vi.advanceTimersByTime(RESOLVED_SHOWN_MS - 1)
    expect(ids()).toContain('a1')
    vi.advanceTimersByTime(1)
    expect(ids()).toEqual(['a2'])
  })

  it('a live alert leaves at its expiry instant with no read', () => {
    const { store, ids, emitted } = harness()
    store.replace([alert({ id: 'soon', expires_at: iso(60_000) }), alert({ id: 'later' })])
    const before = emitted.length
    vi.advanceTimersByTime(59_999)
    expect(ids()).toEqual(['soon', 'later'])
    vi.advanceTimersByTime(1)
    expect(ids()).toEqual(['later'])
    expect(emitted.length).toBe(before + 1)
  })

  it('a read never returns a gone row to the list', () => {
    const { store, ids } = harness()
    store.replace([alert({ id: 'live' }), alert({ id: 'expired', expires_at: iso(-1) }), alert({ id: 'removed', status: 'removed' })])
    expect(ids()).toEqual(['live'])
  })

  it('engaged: an alert a read no longer returns stays, marked ended, until the member lets go', () => {
    const { store, ids } = harness()
    store.replace([alert({ id: 'a1' }), alert({ id: 'a2' })])
    store.setEngaged('a1', true)
    store.replace([alert({ id: 'a2' })])
    expect(ids()).toEqual(['a2', 'a1'])
    expect(store.get('a1')!.status).toBe(ENDED_STATUS)
    expect(alertShownState(store.get('a1')!, Date.now())).toBe('gone')
    store.replace([alert({ id: 'a2' })]) // a second read still keeps it
    expect(ids()).toContain('a1')
    store.setEngaged('a1', false)
    expect(ids()).toEqual(['a2'])
  })

  it('engaged: the clock does not take it away either', () => {
    const { store, ids } = harness()
    store.replace([alert({ id: 'a1', expires_at: iso(1000) })])
    store.setEngaged('a1', true)
    vi.advanceTimersByTime(5000)
    expect(ids()).toEqual(['a1'])
    expect(store.get('a1')!.status).toBe(ENDED_STATUS)
    store.setEngaged('a1', false)
    expect(ids()).toEqual([])
  })

  it('engaged: the member’s own withdrawal still takes it out at once', () => {
    const { store, ids } = harness()
    store.replace([alert()])
    store.setEngaged('a1', true)
    store.remove('a1')
    expect(ids()).toEqual([])
  })

  it('letting go of a still-shown alert changes nothing', () => {
    const { store, ids, emitted } = harness()
    store.replace([alert()])
    store.setEngaged('a1', true)
    const before = emitted.length
    store.setEngaged('a1', false)
    expect(ids()).toEqual(['a1'])
    expect(emitted.length).toBe(before)
  })

  it('dispose stops the timer', () => {
    const { store, emitted } = harness()
    store.replace([alert({ expires_at: iso(1000) })])
    store.dispose()
    const before = emitted.length
    vi.advanceTimersByTime(10_000)
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
    expect([...rows].sort((a, b) => compareAlerts(a, b, NOW)).map((a) => a.id)).toEqual(['live-3', 'live-1-new', 'live-1-old', 'resolved-4'])
  })

  it('the signature moves with a version, a status, a count or the verified mark — not with a re-read of the same thing', () => {
    const base = alertsSignature([alert()])
    expect(alertsSignature([alert()])).toBe(base)
    for (const over of [{ version: 2 }, { status: 'resolved' }, { confirm_count: 2 }, { clear_count: 1 }, { verified: false }] as Array<Partial<SafetyAlert>>) {
      expect(alertsSignature([alert(over)]), JSON.stringify(over)).not.toBe(base)
    }
    expect(alertsSignature([])).toBe('')
  })
})
