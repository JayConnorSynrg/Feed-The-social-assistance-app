/**
 * Vault Idle Auto-Lock Tests
 *
 * Guards the 15-minute inactivity lock + lock-on-tab-hidden behaviour
 * (startIdleLock). Uses fake timers and a stubbed window/document so the timer,
 * activity-reset, and visibilitychange paths are verified without a DOM.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startIdleLock, IDLE_LOCK_TIMEOUT_MS } from '../vault-idle-lock'

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
    const doc = { ...makeTarget(), visibilityState: 'visible' as DocumentVisibilityState }

    startIdleLock({ lock, win, doc, now: () => Date.now() })

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
    const doc = { ...makeTarget(), visibilityState: 'visible' as DocumentVisibilityState }

    startIdleLock({ lock, win, doc, now: () => Date.now() })

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

  it('locks immediately when the tab is hidden (visibilitychange)', () => {
    const lock = vi.fn()
    const win = makeTarget()
    const doc = { ...makeTarget(), visibilityState: 'hidden' as DocumentVisibilityState }

    startIdleLock({ lock, win, doc, now: () => Date.now() })

    doc.dispatch('visibilitychange')
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('teardown removes every listener and cancels the pending timer (no leak)', () => {
    const lock = vi.fn()
    const win = makeTarget()
    const doc = { ...makeTarget(), visibilityState: 'visible' as DocumentVisibilityState }

    const teardown = startIdleLock({ lock, win, doc, now: () => Date.now() })

    // Listeners are attached.
    expect(win.countFor('keydown')).toBe(1)
    expect(win.countFor('scroll')).toBe(1)
    expect(doc.countFor('visibilitychange')).toBe(1)

    teardown()

    // All listeners removed and the timer cancelled — no lock fires afterward.
    expect(win.countFor('keydown')).toBe(0)
    expect(win.countFor('scroll')).toBe(0)
    expect(doc.countFor('visibilitychange')).toBe(0)
    vi.advanceTimersByTime(IDLE_LOCK_TIMEOUT_MS * 2)
    expect(lock).not.toHaveBeenCalled()
  })
})
