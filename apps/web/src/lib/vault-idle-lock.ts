/**
 * Vault Idle Auto-Lock
 *
 * In-memory inactivity lock for the vault. While the vault is unlocked, a
 * 15-minute idle timer runs; if no user activity occurs before it elapses the
 * vault is locked. The timer resets on user activity (keydown / pointerdown /
 * scroll / focus) and the vault locks immediately when the tab is backgrounded
 * (visibilitychange → hidden).
 *
 * This is SEPARATE from — and shorter than — the 24h key-store session TTL
 * (key-store.ts MAX_SESSION_AGE). The key-store TTL bounds how long a stored
 * DEK survives across refreshes; this controller bounds how long an idle,
 * unlocked session stays exposed on an unattended device.
 *
 * The controller only ever calls the injected `lock` callback. It never
 * navigates, mutates guarded-flow state, or touches modal open/close — locking
 * is expressed solely through the vault's own lock() path, exactly like the
 * logout-lock and manual-lock flows.
 */

/** 15 minutes of inactivity before the unlocked vault auto-locks. */
export const IDLE_LOCK_TIMEOUT_MS = 15 * 60 * 1000

/** Min gap between activity-driven timer resets, so high-frequency events
 * (notably scroll) don't thrash the timer. */
const ACTIVITY_THROTTLE_MS = 1_000

/** Activity events that reset the idle timer. */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'scroll', 'focus'] as const

interface IdleLockDeps {
  /** Called when the vault should lock (idle elapsed or tab hidden). */
  lock: () => void
  /** Window-like event target. Defaults to the global `window`. */
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  /** Document-like target for visibilitychange. Defaults to `document`. */
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener'> & {
    readonly visibilityState: DocumentVisibilityState
  }
  /** Idle window in ms. Defaults to IDLE_LOCK_TIMEOUT_MS (override for tests). */
  timeoutMs?: number
  /** Monotonic clock in ms. Defaults to Date.now (override for tests). */
  now?: () => number
}

/**
 * Wire up the idle auto-lock against the given window/document. Returns a
 * teardown function that removes every listener and clears the pending timer.
 *
 * Caller contract: only start this while the vault is unlocked, and call the
 * returned teardown when it locks/unmounts.
 */
export function startIdleLock(deps: IdleLockDeps): () => void {
  const {
    lock,
    win = window,
    doc = document,
    timeoutMs = IDLE_LOCK_TIMEOUT_MS,
    now = Date.now,
  } = deps

  let timerId: ReturnType<typeof setTimeout> | undefined
  let lastReset = 0

  const clearTimer = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId)
      timerId = undefined
    }
  }

  const startTimer = () => {
    clearTimer()
    timerId = setTimeout(lock, timeoutMs)
  }

  // Activity handler: throttled clear+restart so a stream of scroll events
  // resets the timer at most once per ACTIVITY_THROTTLE_MS.
  const onActivity = () => {
    const t = now()
    if (t - lastReset < ACTIVITY_THROTTLE_MS) return
    lastReset = t
    startTimer()
  }

  // Tab backgrounded → lock immediately (don't wait out the idle window).
  const onVisibilityChange = () => {
    if (doc.visibilityState === 'hidden') {
      clearTimer()
      lock()
    }
  }

  for (const evt of ACTIVITY_EVENTS) {
    win.addEventListener(evt, onActivity, { passive: true })
  }
  doc.addEventListener('visibilitychange', onVisibilityChange)

  // Arm the initial idle window.
  lastReset = now()
  startTimer()

  return () => {
    clearTimer()
    for (const evt of ACTIVITY_EVENTS) {
      win.removeEventListener(evt, onActivity)
    }
    doc.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
