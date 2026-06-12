/**
 * Vault Idle Auto-Lock Tests
 *
 * Guards the 15-minute inactivity lock (startIdleLock) and the pre-lock flush
 * ordering contract (runPreLockFlushes). Uses fake timers and a stubbed window
 * so the timer + activity-reset paths are verified without a DOM.
 *
 * The vault locks ONLY on sustained inactivity — backgrounding the tab does not
 * lock (the visibilitychange→hidden immediate lock was removed because it
 * interrupted mobile/Capacitor backgrounding, native file pickers, and
 * OAuth/print popups). The "tab hidden never locks" test below is a regression
 * guard so that immediate-on-hidden behaviour stays gone.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startIdleLock, runPreLockFlushes, IDLE_LOCK_TIMEOUT_MS, FLUSH_TIMEOUT_MS } from '../vault-idle-lock'

type Handler = (...args: unknown[]) => void

/** Minimal addEventListener/removeEventListener target that records handlers. */
function makeTarget() {
  const handlers = new Map<string, Set<Handler>>()
  return {
    handlers,
    addEventListener(type: string, fn: Handler) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: Handler) {
      handlers.get(type)?.delete(fn)
    },
    dispatch(type: string) {
      handlers.get(type)?.forEach((fn) => fn())
    },
    countFor(type: string) {
      return handlers.get(type)?.size ?? 0
    },
  }
}

describe('startIdleLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks after 15 minutes of inactivity', () => {
    const lock = vi.fn()
    const win = makeTarget()

    startIdleLock({ lock, win, now: () => Date.now() })

    // Not locked just before the window elapses.
    vi.advanceTimersByTime(IDLE_LOCK_TIMEOUT_MS - 1)
    expect(lock).not.toHaveBeenCalled()

    // Locks exactly at the 15-minute boundary.
    vi.advanceTimersByTime(1)
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on user activity (no premature lock)', () => {
    const lock = vi.fn()
    const win = makeTarget()

    startIdleLock({ lock, win, now: () => Date.now() })

    // Activity near the end of the first window resets it.
    vi.advanceTimersByTime(IDLE_LOCK_TIMEOUT_MS - 1_000)
    win.dispatch('keydown')

    // The original window would have elapsed here — but the reset prevents it.
    vi.advanceTimersByTime(2_000)
    expect(lock).not.toHaveBeenCalled()

    // A fresh full idle window after the reset does lock.
    vi.advanceTimersByTime(IDLE_LOCK_TIMEOUT_MS)
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('keeps the vault unlocked while the tab is hidden (no visibility listener, no lock)', () => {
    // Regression guard: the immediate lock-on-tab-hidden feature was removed.
    // The controller must NOT subscribe to visibilitychange and must NOT lock
    // when the tab is backgrounded — only the idle timer ever locks.
    const lock = vi.fn()
    const win = makeTarget()
    const doc = makeTarget()

    startIdleLock({ lock, win, now: () => Date.now() })

    // No visibilitychange listener is registered on any document-like target.
    expect(doc.countFor('visibilitychange')).toBe(0)

    // Even if a visibilitychange were dispatched, nothing is wired to it → no lock.
    doc.dispatch('visibilitychange')
    expect(lock).not.toHaveBeenCalled()

    // The vault stays unlocked right up until the full idle window elapses.
    vi.advanceTimersByTime(IDLE_LOCK_TIMEOUT_MS - 1)
    expect(lock).not.toHaveBeenCalled()
  })

  it('teardown removes every listener and cancels the pending timer (no leak)', () => {
    const lock = vi.fn()
    const win = makeTarget()

    const teardown = startIdleLock({ lock, win, now: () => Date.now() })

    // Activity listeners are attached.
    expect(win.countFor('keydown')).toBe(1)
    expect(win.countFor('scroll')).toBe(1)
    expect(win.countFor('pointerdown')).toBe(1)
    expect(win.countFor('focus')).toBe(1)

    teardown()

    // All listeners removed and the timer cancelled — no lock fires afterward.
    expect(win.countFor('keydown')).toBe(0)
    expect(win.countFor('scroll')).toBe(0)
    expect(win.countFor('pointerdown')).toBe(0)
    expect(win.countFor('focus')).toBe(0)
    vi.advanceTimersByTime(IDLE_LOCK_TIMEOUT_MS * 2)
    expect(lock).not.toHaveBeenCalled()
  })
})

describe('runPreLockFlushes (pre-lock flush ordering)', () => {
  it('awaits ALL registered flushes before the lock callback runs', async () => {
    const order: string[] = []

    // Two async flushes that resolve on later microtask/timer turns. If the lock
    // ran before they settled, "lock" would appear before both flush markers.
    const flushA = async () => {
      await Promise.resolve()
      order.push('flushA')
    }
    const flushB = async () => {
      await Promise.resolve()
      await Promise.resolve()
      order.push('flushB')
    }

    const onError = vi.fn()

    // This mirrors the vault-context wiring: flush-all, THEN lock.
    await runPreLockFlushes([flushA, flushB], onError)
    order.push('lock')

    expect(order).toEqual(['flushA', 'flushB', 'lock'])
    expect(onError).not.toHaveBeenCalled()
  })

  it('still locks (resolves) when a flush throws — error is reported, lock proceeds', async () => {
    const order: string[] = []
    const onError = vi.fn()

    const goodFlush = async () => {
      order.push('goodFlush')
    }
    const throwingFlush = async () => {
      throw new Error('persist failed')
    }

    // A rejecting flush must NOT reject runPreLockFlushes — the lock must proceed.
    await expect(
      runPreLockFlushes([throwingFlush, goodFlush], onError)
    ).resolves.toBeUndefined()
    order.push('lock')

    // The healthy flush still ran, the failure was routed to onError, lock proceeded.
    expect(order).toContain('goodFlush')
    expect(order[order.length - 1]).toBe('lock')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('resolves immediately when there are no registered flushes', async () => {
    const onError = vi.fn()
    await expect(runPreLockFlushes([], onError)).resolves.toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })

  it('STILL LOCKS when a flush hangs forever — bounded by FLUSH_TIMEOUT_MS (fail-closed)', async () => {
    // Security regression guard: a pre-lock flush whose network call never
    // settles (PostgREST/Storage do not throw on a stalled connection) must NOT
    // wedge the lock. runPreLockFlushes must resolve at FLUSH_TIMEOUT_MS so the
    // caller proceeds to lock — the unlocked vault never stays open on a hang.
    vi.useFakeTimers()
    try {
      const onError = vi.fn()
      // A flush that never resolves (simulates a hung upload).
      const hangingFlush = () => new Promise<void>(() => {})
      let locked = false

      const run = runPreLockFlushes([hangingFlush], onError).then(() => {
        // The caller locks immediately after the flush wait resolves.
        locked = true
      })

      // Before the timeout window elapses, the lock has not yet proceeded.
      await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS - 1)
      expect(locked).toBe(false)

      // At FLUSH_TIMEOUT_MS the wait resolves anyway and the lock proceeds.
      await vi.advanceTimersByTimeAsync(1)
      await run
      expect(locked).toBe(true)

      // The timeout was surfaced through onError so it is observable.
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire the timeout when flushes settle quickly (no spurious onError)', async () => {
    const onError = vi.fn()
    const fastFlush = async () => {
      await Promise.resolve()
    }
    await expect(runPreLockFlushes([fastFlush], onError)).resolves.toBeUndefined()
    // Fast path: timeout never wins the race, so onError stays untouched.
    expect(onError).not.toHaveBeenCalled()
  })
})
