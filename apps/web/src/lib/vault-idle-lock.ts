/**
 * Vault Idle Auto-Lock
 *
 * In-memory inactivity lock for the vault. While the vault is unlocked, a
 * 15-minute idle timer runs; if no user activity occurs before it elapses the
 * vault is locked. The timer resets on user activity (keydown / pointerdown /
 * scroll / focus, throttled).
 *
 * Locking is driven ONLY by sustained inactivity — backgrounding the tab does
 * not lock. The earlier visibilitychange→hidden immediate lock was removed: in
 * mobile/Capacitor backgrounding, native file pickers, and OAuth/print popups
 * the tab goes `hidden` routinely without the user walking away, so an
 * immediate lock there interrupted in-progress work. The 15-minute idle window
 * remains the single, lossless trigger; the caller flushes active drafts before
 * the lock actually fires (see vault-context registerPreLockFlush).
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

/**
 * Upper bound on how long the pre-lock flush wait may take before the vault
 * locks regardless. A normal encrypted persist (encrypt → one storage upload →
 * one metadata insert on a healthy connection) settles well under this; 5s is
 * long enough to let that complete yet short enough that an unattended,
 * idle-locked vault is never held open by a stalled flush. This keeps idle
 * auto-lock fail-CLOSED: the security lock always proceeds within
 * FLUSH_TIMEOUT_MS even if a flush's network call hangs forever (PostgREST and
 * Storage do not throw on a stalled connection — see project memory pattern
 * "Vault-Unlock Timeout Resilience").
 */
export const FLUSH_TIMEOUT_MS = 5_000

/**
 * Run every registered pre-lock flush, bounded by FLUSH_TIMEOUT_MS. Used by the
 * vault context to persist in-flight guarded-flow drafts (PDF annotator, form
 * wizard) while the DEK is still available, BEFORE the vault actually locks.
 *
 * Contract (relied on by the idle-lock + manual-lock paths):
 *  - On the normal path, all flushes are awaited and settle before this
 *    resolves, so the caller can safely lock immediately after awaiting it with
 *    zero data loss.
 *  - A flush that REJECTS never blocks the lock: its error is routed to onError
 *    and the remaining flushes still run.
 *  - A flush that HANGS never blocks the lock either: the whole wait is bounded
 *    by FLUSH_TIMEOUT_MS. If the flushes do not all settle within that window
 *    this resolves anyway (routing a timeout notice through onError) so the
 *    caller still proceeds to lock. The vault always locks afterward —
 *    fail-closed by construction.
 */
export async function runPreLockFlushes(
  flushes: Iterable<() => Promise<void>>,
  onError: (err: unknown) => void,
  flushTimeoutMs: number = FLUSH_TIMEOUT_MS
): Promise<void> {
  const pending = Array.from(flushes).map((flush) =>
    Promise.resolve()
      .then(flush)
      .catch((err: unknown) => onError(err))
  )
  if (pending.length === 0) return

  // Bound the whole flush wait. If a flush hangs (never settles), the timeout
  // wins the race and the caller proceeds to lock anyway. The timer is always
  // cleared so no handle dangles past resolution.
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      onError(
        new Error(
          `pre-lock flush exceeded ${flushTimeoutMs}ms — locking anyway (fail-closed)`
        )
      )
      resolve()
    }, flushTimeoutMs)
  })

  try {
    await Promise.race([Promise.all(pending), timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Min gap between activity-driven timer resets, so high-frequency events
 * (notably scroll) don't thrash the timer. */
const ACTIVITY_THROTTLE_MS = 1_000

/** Activity events that reset the idle timer. */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'scroll', 'focus'] as const

interface IdleLockDeps {
  /** Called when the vault should lock (idle window elapsed). */
  lock: () => void
  /** Window-like event target. Defaults to the global `window`. */
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  /** Idle window in ms. Defaults to IDLE_LOCK_TIMEOUT_MS (override for tests). */
  timeoutMs?: number
  /** Monotonic clock in ms. Defaults to Date.now (override for tests). */
  now?: () => number
}

/**
 * Wire up the idle auto-lock against the given window. Returns a teardown
 * function that removes every listener and clears the pending timer.
 *
 * Caller contract: only start this while the vault is unlocked, and call the
 * returned teardown when it locks/unmounts.
 */
export function startIdleLock(deps: IdleLockDeps): () => void {
  const {
    lock,
    win = window,
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

  for (const evt of ACTIVITY_EVENTS) {
    win.addEventListener(evt, onActivity, { passive: true })
  }

  // Arm the initial idle window.
  lastReset = now()
  startTimer()

  return () => {
    clearTimer()
    for (const evt of ACTIVITY_EVENTS) {
      win.removeEventListener(evt, onActivity)
    }
  }
}
