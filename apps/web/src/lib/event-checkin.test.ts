// event-checkin.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Unit tests for the pure W1.6a window/state + attendance math. Includes explicit
// mutation-proving cases (boundary inclusivity, correct rate denominator).

import { describe, it, expect } from 'vitest'
import {
  EARLY_WINDOW_MINUTES,
  windowOpensAtMs,
  isInWindow,
  isEnded,
  computeCheckinButton,
  clampHousehold,
  computeOccurrenceStats,
  computeAttendanceRate,
  formatRatePct,
  type CheckinRow,
} from './event-checkin'

const MIN = 60_000
const base = Date.UTC(2026, 8, 24, 12, 0, 0) // fixed "starts_at"
const start = base
const end = base + 120 * MIN // 2h event

describe('window helpers', () => {
  it('window opens exactly 30 min before start', () => {
    expect(windowOpensAtMs(start)).toBe(start - EARLY_WINDOW_MINUTES * MIN)
  })

  // MUTATION PROOF: `>=` vs `>` at the open boundary. At exactly opensAt the window
  // is OPEN; a mutant using `>` would return false here.
  it('is in window at the exact open boundary (inclusive)', () => {
    expect(isInWindow(windowOpensAtMs(start), start, end)).toBe(true)
    expect(isInWindow(windowOpensAtMs(start) - 1, start, end)).toBe(false)
  })

  // MUTATION PROOF: `<=` vs `<` at ends_at. At exactly ends_at still in window.
  it('is in window at the exact end boundary (inclusive), out one ms later', () => {
    expect(isInWindow(end, start, end)).toBe(true)
    expect(isInWindow(end + 1, start, end)).toBe(false)
  })

  it('isEnded past ends_at or completed status', () => {
    expect(isEnded('upcoming', end + 1, end)).toBe(true)
    expect(isEnded('upcoming', end, end)).toBe(false)
    expect(isEnded('completed', start - 999 * MIN, end)).toBe(true)
  })
})

describe('computeCheckinButton', () => {
  it('before window, no prior check-in → "Check in early", not presence', () => {
    const m = computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus: 'none', nowMs: start - 90 * MIN })
    expect(m.kind).toBe('early')
    expect(m.actionable).toBe(true)
    expect(m.confirmsPresence).toBe(false)
  })

  it('before window, already early → "Checked in (early)", not actionable', () => {
    const m = computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus: 'early', nowMs: start - 90 * MIN })
    expect(m.kind).toBe('checked_early')
    expect(m.actionable).toBe(false)
  })

  it('in window (none or early) → "I\'m here", confirms presence', () => {
    for (const myStatus of ['none', 'early'] as const) {
      const m = computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus, nowMs: start + 5 * MIN })
      expect(m.kind).toBe('in_window')
      expect(m.actionable).toBe(true)
      expect(m.confirmsPresence).toBe(true)
    }
  })

  it('confirmed is terminal → "Attended", not actionable, even in window', () => {
    const m = computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus: 'confirmed', nowMs: start + 5 * MIN })
    expect(m.kind).toBe('attended')
    expect(m.actionable).toBe(false)
  })

  it('ended with early → checked_early; ended with none → ended', () => {
    expect(computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus: 'early', nowMs: end + MIN }).kind).toBe('checked_early')
    expect(computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus: 'none', nowMs: end + MIN }).kind).toBe('ended')
  })

  it('cancelled overrides everything', () => {
    // M2: an anonymous claim is terminal + non-actionable, and wins even inside the window
    // (a second, identified, check-in would be refused by the server).
    const anon = computeCheckinButton({ status: 'upcoming', startsAtMs: start, endsAtMs: end, myStatus: 'none', nowMs: start + 5 * MIN, anonymousClaimed: true })
    expect(anon.kind).toBe('anonymous')
    expect(anon.actionable).toBe(false)
    // A cancelled occurrence still reads "Cancelled" even if anonymously claimed.
    expect(computeCheckinButton({ status: 'cancelled', startsAtMs: start, endsAtMs: end, myStatus: 'none', nowMs: start + 5 * MIN, anonymousClaimed: true }).kind).toBe('cancelled')

    const m = computeCheckinButton({ status: 'cancelled', startsAtMs: start, endsAtMs: end, myStatus: 'early', nowMs: start + 5 * MIN })
    expect(m.kind).toBe('cancelled')
    expect(m.actionable).toBe(false)
  })
})

describe('clampHousehold', () => {
  it('clamps to [1,20] and rounds', () => {
    expect(clampHousehold(0)).toBe(1)
    expect(clampHousehold(25)).toBe(20)
    expect(clampHousehold(3.4)).toBe(3)
    expect(clampHousehold(NaN)).toBe(1)
  })
})

describe('computeOccurrenceStats', () => {
  const rows: CheckinRow[] = [
    { status: 'confirmed', user_id: 'u1' },
    { status: 'early', user_id: 'u2' },
    { status: 'early', user_id: 'u3' },
    { status: 'confirmed', user_id: null }, // anonymous — excluded from figures
  ]

  it('not ended: no no-shows, show rate undefined', () => {
    const s = computeOccurrenceStats(rows, false)
    expect(s).toEqual({ early: 2, confirmed: 1, noShow: 0, showRate: null })
  })

  // MUTATION PROOF: show rate denominator is confirmed + noShow (NOT confirmed + all early,
  // NOT total rows incl. anon). 1 confirmed, 2 early → ended → 1/(1+2) = 0.3333.
  it('ended: no-shows are early rows; show rate = confirmed/(confirmed+noShow)', () => {
    const s = computeOccurrenceStats(rows, true)
    expect(s.confirmed).toBe(1)
    expect(s.noShow).toBe(2)
    expect(s.showRate).toBeCloseTo(1 / 3, 5)
  })
})

describe('computeAttendanceRate', () => {
  // MUTATION PROOF: rate is confirmed/total, null when total is 0.
  it('confirmed/total, null on no data', () => {
    expect(computeAttendanceRate(2, 3)).toBeCloseTo(2 / 3, 5)
    expect(computeAttendanceRate(0, 0)).toBeNull()
    expect(computeAttendanceRate(1, 1)).toBe(1)
  })
})

describe('formatRatePct', () => {
  it('whole percent or em dash', () => {
    expect(formatRatePct(0.6667)).toBe('67%')
    expect(formatRatePct(0)).toBe('0%')
    expect(formatRatePct(null)).toBe('—')
  })
})
