// apps/web/src/lib/safety-alerts-fetch.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// When the members' surfaces read safety alerts (lib/safety-alert-rpc.ts). Alerts are not in the
// realtime publication (the reporter's id must never transit the WAL), so a poll is how a stationary
// viewer sees new pins, updates, resolutions and vote counts.
//
// KeyedPollScheduler — one timer set, keyed on a PRIMITIVE string:
//  - one read per real change of the key, after `debounceMs` (0 = at once). A caller that hands over
//    a new object with the same key on every render schedules nothing (a new bounds object every
//    render once restarted the debounce on every render: a refetch loop of roughly two RPCs a second
//    per open map — which also kept the 60 s poll from ever firing);
//  - every 60 s while the tab is visible;
//  - once when the tab becomes visible again (the poll skips hidden tabs, so it catches up then);
//  - once on refresh(): right after the member's own place / update / resolve / withdraw / vote.
// The map keys on its four bound numbers (SafetyAlertsFetchScheduler, 400 ms after the map settles);
// the feed strip keys on the viewer (hooks/use-safety-strip.ts, no debounce).
// Only the latest read's answer is applied (createLatestOnlyLoader): a slow answer for an older
// viewport never replaces a newer one.
//
// PollCounter — how often each surface reads, without a row per read: reads, changed answers and
// failures are counted in memory and written as ONE alerts.poll row per surface when 30 reads have
// accumulated (30 minutes of an idle, visible tab) or when the page goes away (pagehide). The
// counters live in module memory (sharedPollCounter), so hiding and showing the tab, or leaving a
// panel and coming back (its hook unmounts and mounts again), starts no new row and loses no count.
// A failed read is counted in the same window (errors, and the last error class); the first failure
// of a window is reported once, at once (onFirstError), so a reader that fails on every poll writes
// one error row per window, not one per read.
// sum(reads) over the rows is the exact read volume.

export const ALERTS_DEBOUNCE_MS = 400
export const ALERTS_POLL_MS = 60_000

export interface AlertBounds {
  west: number
  south: number
  east: number
  north: number
}

/** The identity of a viewport: its four numbers. */
export function boundsKey(bounds: AlertBounds | null): string | null {
  return bounds ? `${bounds.west},${bounds.south},${bounds.east},${bounds.north}` : null
}

export class KeyedPollScheduler<A> {
  private key: string | null = null
  private arg: A | null = null
  private debounce: ReturnType<typeof setTimeout> | null = null
  private poll: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly deps: {
      fetch: (arg: A) => void
      /** document.visibilityState === 'visible' (no background polling). */
      isVisible: () => boolean
      /** How long the key must stay unchanged before its first read (0 = read at once). */
      debounceMs: number
    },
  ) {}

  /** What to read, by key (called on every render; only a change of the key schedules).
   *  A null key stops everything. */
  set(key: string | null, arg: A | null): void {
    if (key === this.key) return
    this.stop()
    this.key = key
    this.arg = key === null ? null : arg
    if (key === null || arg === null) return
    if (this.deps.debounceMs <= 0) {
      this.deps.fetch(arg)
    } else {
      this.debounce = setTimeout(() => {
        this.debounce = null
        this.deps.fetch(arg)
      }, this.deps.debounceMs)
    }
    this.poll = setInterval(() => {
      if (this.arg !== null && this.deps.isVisible()) this.deps.fetch(this.arg)
    }, ALERTS_POLL_MS)
  }

  /** The tab's visibility changed: becoming visible reads once. */
  visibilityChanged(visible: boolean): void {
    if (visible) this.refresh()
  }

  /** Read now (after the member's own action). */
  refresh(): void {
    if (this.arg !== null) this.deps.fetch(this.arg)
  }

  /** Unmount: stop both timers and forget the key (a StrictMode re-mount schedules afresh). */
  dispose(): void {
    this.stop()
    this.key = null
    this.arg = null
  }

  private stop(): void {
    if (this.debounce) clearTimeout(this.debounce)
    if (this.poll) clearInterval(this.poll)
    this.debounce = null
    this.poll = null
  }
}

/** The map's scheduler: keyed on the four bound numbers, 400 ms after the map settles. */
export class SafetyAlertsFetchScheduler extends KeyedPollScheduler<AlertBounds> {
  constructor(deps: { fetch: (bounds: AlertBounds) => void; isVisible: () => boolean }) {
    super({ ...deps, debounceMs: ALERTS_DEBOUNCE_MS })
  }

  /** The map's current bounds (called on every render; only a change in the numbers schedules). */
  setBounds(bounds: AlertBounds | null): void {
    this.set(boundsKey(bounds), bounds)
  }
}

/** One alerts.poll row is written after this many reads on a surface. */
export const POLL_FLUSH_EVERY = 30

export type PollSurface = 'strip' | 'map'

export interface PollRow {
  surface: PollSurface
  /** Reader calls since the last row (poll ticks, returns to the tab, refreshes, viewport changes). */
  reads: number
  /** How many of them returned something different from the read before. */
  changed: number
  /** How many of them failed, and the class of the last failure (a server code, or 'exception'). */
  errors: number
  last_error: string | null
  /** Alerts in the latest answer. */
  result_count: number
  /** Seconds the window covered. */
  window_s: number
}

export class PollCounter {
  private reads = 0
  private changed = 0
  private errors = 0
  private lastError: string | null = null
  private resultCount = 0
  private signature: string | null = null
  private since: number | null = null

  constructor(
    private readonly surface: PollSurface,
    private readonly write: (row: PollRow) => void,
    /** Called for the first failed read of a window only. */
    private readonly onFirstError: (errorClass: string) => void = () => {},
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** One read finished: its answer's signature and size, or the class of its failure. */
  record(result: { signature: string; count: number } | { error: string }): void {
    if (this.since === null) this.since = this.now()
    this.reads += 1
    if ('error' in result) {
      this.errors += 1
      this.lastError = result.error
      if (this.errors === 1) this.onFirstError(result.error)
    } else {
      if (this.signature !== null && this.signature !== result.signature) this.changed += 1
      this.signature = result.signature
      this.resultCount = result.count
    }
    if (this.reads >= POLL_FLUSH_EVERY) this.flush()
  }

  /** Write the window as one row (nothing when no read happened) and start a new window. */
  flush(): void {
    if (this.reads === 0 || this.since === null) return
    this.write({
      surface: this.surface,
      reads: this.reads,
      changed: this.changed,
      errors: this.errors,
      last_error: this.lastError,
      result_count: this.resultCount,
      window_s: Math.max(0, Math.round((this.now() - this.since) / 1000)),
    })
    this.reads = 0
    this.changed = 0
    this.errors = 0
    this.lastError = null
    this.since = null
  }
}

// One counter per surface for the life of the page: a hidden tab, a panel switch or a remount
// carries on in the same window.
const shared = new Map<PollSurface, PollCounter>()
let pagehideBound = false

/** Write every surface's open window now (the page is going away). */
export function flushPollCounters(): void {
  for (const counter of shared.values()) counter.flush()
}

/** The page's counter for a surface (created on first use; `write` and `onFirstError` are taken then). */
export function sharedPollCounter(surface: PollSurface, write: (row: PollRow) => void, onFirstError: (errorClass: string) => void): PollCounter {
  let counter = shared.get(surface)
  if (!counter) {
    counter = new PollCounter(surface, write, onFirstError)
    shared.set(surface, counter)
  }
  if (!pagehideBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    pagehideBound = true
    window.addEventListener('pagehide', flushPollCounters)
  }
  return counter
}

/** Test-only: forget every counter (a new page). */
export function resetPollCounters(): void {
  shared.clear()
  pagehideBound = false
}

/**
 * Wrap a read so only the most recent call's outcome is applied: each call takes a sequence
 * number, and an answer (or error) that arrives after a newer call started is dropped — the newer
 * call owns the result and the loading flag.
 */
export function createLatestOnlyLoader<A, R>(deps: {
  read: (arg: A) => Promise<R>
  onStart: () => void
  onResult: (result: R) => void
  onError: (error: unknown) => void
  onSettled: () => void
}): (arg: A) => Promise<void> {
  let latest = 0
  return async (arg) => {
    const seq = ++latest
    deps.onStart()
    try {
      const result = await deps.read(arg)
      if (seq === latest) deps.onResult(result)
    } catch (error) {
      if (seq === latest) deps.onError(error)
    } finally {
      if (seq === latest) deps.onSettled()
    }
  }
}
