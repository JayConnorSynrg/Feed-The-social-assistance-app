// apps/web/src/lib/safety-alerts-fetch.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The members' map reads safety_alerts_in_view once per real viewport change, every 60 s while
// visible, and once right after the member places or edits an alert — never once per render
// (the loop that made safety_alerts_in_view ~1,100x more frequent than resources_in_bounds).
// Fake timers + a counting fake fetch; the place/edit writes call onWritten exactly once on success.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { ALERTS_DEBOUNCE_MS, ALERTS_POLL_MS, SafetyAlertsFetchScheduler, boundsKey, type AlertBounds } from './safety-alerts-fetch'
import { placeSafetyAlert, updateSafetyAlert } from '@/hooks/use-safety-alerts'

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

describe('place / edit an alert → one refetch so the pin appears (their RPCs return no lng/lat)', () => {
  function rpcClient(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn(() => ({ abortSignal: () => Promise.resolve(result) }))
    return { client: { rpc } as never, rpc }
  }
  const input = { type: 'general' as const, severity: 2, description: 'Ice', lng: -72.9, lat: 43.6 }

  it('a placed alert triggers exactly one refetch; a failed place triggers none', async () => {
    const ok = rpcClient({ data: { id: 'a1' }, error: null })
    const onWritten = vi.fn()
    await placeSafetyAlert(ok.client, input, onWritten)
    expect(onWritten).toHaveBeenCalledTimes(1)
    const bad = rpcClient({ data: null, error: new Error('denied') })
    const none = vi.fn()
    await expect(placeSafetyAlert(bad.client, input, none)).rejects.toThrow('denied')
    expect(none).not.toHaveBeenCalled()
  })

  it('an edited alert triggers exactly one refetch; a failed edit triggers none', async () => {
    const ok = rpcClient({ data: null, error: null })
    const onWritten = vi.fn()
    await updateSafetyAlert(ok.client, 'a1', { ...input }, onWritten)
    expect(onWritten).toHaveBeenCalledTimes(1)
    expect(ok.rpc).toHaveBeenCalledWith('update_safety_alert', expect.objectContaining({ p_alert_id: 'a1' }))
    const bad = rpcClient({ data: null, error: new Error('not yours') })
    const none = vi.fn()
    await expect(updateSafetyAlert(bad.client, 'a1', input, none)).rejects.toThrow('not yours')
    expect(none).not.toHaveBeenCalled()
  })
})
