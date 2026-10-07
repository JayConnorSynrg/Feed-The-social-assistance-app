// event-checkin-state.test.ts
// The shared check-in state loader (feed + Events tab): what the member's buttons are built from.
// A fake Supabase client records every read; each read resolves only when the test releases it,
// so "started together" is observable.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const warn = vi.fn()
vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: (...a: unknown[]) => warn(...a), error: vi.fn() } }))

import { applyCheckinResult, loadCheckinState } from './event-checkin-state'
import { fakeClient } from './__tests__/fake-supabase'

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => warn.mockReset())

describe('loadCheckinState', () => {
  it('reads nothing for a logged-out viewer or a guest, or when no date is listed', async () => {
    for (const opts of [
      { userId: null, isGuest: false, occurrenceIds: ['o1'] },
      { userId: 'u1', isGuest: true, occurrenceIds: ['o1'] },
      { userId: 'u1', isGuest: false, occurrenceIds: [] },
    ]) {
      const f = fakeClient({})
      const s = await loadCheckinState(f.client, { ...opts, surface: 'feed' })
      expect(f.calls).toHaveLength(0)
      expect(s).toEqual({ statuses: {}, anonClaims: new Set() })
    }
  })

  it('starts both reads before either answers (parallel), each bounded by a timeout signal', async () => {
    // M-L1 (break-it): awaiting the own-rows read before starting the claims read leaves only one started here.
    const f = fakeClient({
      event_checkins: { data: [{ occurrence_id: 'o1', status: 'early' }], error: null },
      my_anonymous_claims: { data: [{ occurrence_id: 'o2' }], error: null },
    })
    const p = loadCheckinState(f.client, { userId: 'u1', isGuest: false, occurrenceIds: ['o1', 'o2', 'o1'], surface: 'feed' })
    await flush()
    expect(f.started.sort()).toEqual(['event_checkins', 'my_anonymous_claims'])
    f.releaseAll()
    const s = await p
    expect(s.statuses).toEqual({ o1: 'early' })
    expect([...s.anonClaims]).toEqual(['o2'])
    const own = f.calls.find((c) => c.name === 'event_checkins')!
    expect(own.ops).toContainEqual(['eq', ['user_id', 'u1']])
    expect(own.ops).toContainEqual(['in', ['occurrence_id', ['o1', 'o2']]])
    expect(own.ops.some(([op]) => op === 'abortSignal')).toBe(true)
    const rpc = f.calls.find((c) => c.name === 'my_anonymous_claims')!
    expect(rpc.ops).toContainEqual(['args', [{ p_occurrence_ids: ['o1', 'o2'] }]])
    expect(rpc.ops.some(([op]) => op === 'abortSignal')).toBe(true)
  })

  it('a failed half leaves its part empty, keeps the other, and is logged — buttons still render', async () => {
    // M-L2 (break-it): letting a failure throw rejects the whole load (no cards' state at all).
    const f = fakeClient({
      event_checkins: { data: [{ occurrence_id: 'o1', status: 'confirmed' }], error: null },
      my_anonymous_claims: new DOMException('timed out', 'TimeoutError'),
    })
    const p = loadCheckinState(f.client, { userId: 'u1', isGuest: false, occurrenceIds: ['o1'], surface: 'events_tab' })
    f.releaseAll()
    const s = await p
    expect(s.statuses).toEqual({ o1: 'confirmed' })
    expect(s.anonClaims.size).toBe(0)
    expect(warn).toHaveBeenCalledWith('events.checkin_state.load_failed', { surface: 'events_tab', part: 'anonymous', code: 'TimeoutError' })

    const g = fakeClient({ event_checkins: { data: null, error: { code: '42501', message: 'permission denied' } } })
    const q = loadCheckinState(g.client, { userId: 'u1', isGuest: false, occurrenceIds: ['o1'], surface: 'feed' })
    g.releaseAll()
    expect((await q).statuses).toEqual({})
    expect(warn).toHaveBeenCalledWith('events.checkin_state.load_failed', { surface: 'feed', part: 'own', code: '42501' })
  })
})

describe('applyCheckinResult — the card shows the server\'s check_in answer without a reload', () => {
  const base = { statuses: { other: 'early' as const }, anonClaims: new Set<string>() }
  it.each([
    ['early', { o1: 'early' }],
    ['already_early', { o1: 'early' }],
    ['confirmed', { o1: 'confirmed' }],
    ['already_confirmed', { o1: 'confirmed' }],
  ])('%s → tracked status', (result, expected) => {
    expect(applyCheckinResult(base, 'o1', result)?.statuses).toEqual({ other: 'early', ...expected })
  })
  it('confirmed_anonymous → the anonymous check-in is spent; tracked state untouched', () => {
    const next = applyCheckinResult(base, 'o1', 'confirmed_anonymous')!
    expect([...next.anonClaims]).toEqual(['o1'])
    expect(next.statuses).toEqual({ other: 'early' })
    expect(base.anonClaims.size).toBe(0) // not mutated
  })
  it('an unknown answer returns null (the caller re-reads)', () => {
    expect(applyCheckinResult(base, 'o1', null)).toBeNull()
    expect(applyCheckinResult(base, 'o1', 'mystery')).toBeNull()
  })
})
