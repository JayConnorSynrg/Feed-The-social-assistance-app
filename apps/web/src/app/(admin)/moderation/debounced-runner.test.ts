import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncedRunner } from './debounced-runner'

// These tests target the exact layer AddressAutocomplete calls: on typing it
// schedule()s a search; on selecting a suggestion its choose() calls cancel().
// A stale debounce firing after a pick is what re-opened the list and allowed an
// accidental re-pick — so cancel() must drop the pending search, WITHOUT
// disabling the runner for the next keystroke.
describe('createDebouncedRunner', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('runs a scheduled fn once after the delay', () => {
    const runner = createDebouncedRunner(300)
    const run = vi.fn()
    runner.schedule(run)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('a later schedule replaces an earlier pending one (only the last fires)', () => {
    const runner = createDebouncedRunner(300)
    const first = vi.fn()
    const second = vi.fn()
    runner.schedule(first)
    vi.advanceTimersByTime(100)
    runner.schedule(second)
    vi.advanceTimersByTime(300)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  // (a) Selecting a suggestion while a debounce is pending must NOT fire the
  // stale search (so the list cannot re-open after a pick). This is the layer
  // choose()'s runnerRef.current.cancel() call exercises.
  // Mutation-proof: making cancel() a no-op (reverting its clearTimeout) fires
  // the stale search and turns this RED.
  it('cancel() drops a pending search so it never fires after a selection', () => {
    const runner = createDebouncedRunner(300)
    const search = vi.fn()
    runner.schedule(search)        // a keystroke's debounce is pending
    vi.advanceTimersByTime(150)    // …still within the 300ms window
    runner.cancel()                // user picks a suggestion → choose() cancels
    vi.advanceTimersByTime(300)    // let any stale timer try to fire
    expect(search).not.toHaveBeenCalled()
  })

  // (b) A genuinely new keystroke AFTER a selection still schedules a fresh
  // search — cancel() only drops the in-flight one, it does not kill debounce.
  it('a new schedule() after cancel() still fires (debounce is not disabled)', () => {
    const runner = createDebouncedRunner(300)
    const stale = vi.fn()
    const fresh = vi.fn()
    runner.schedule(stale)
    runner.cancel()                // selection
    runner.schedule(fresh)         // new keystroke after selection
    vi.advanceTimersByTime(300)
    expect(stale).not.toHaveBeenCalled()
    expect(fresh).toHaveBeenCalledTimes(1)
  })
})
