// apps/web/src/lib/safety-alerts-fetch.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// When the members' map reads safety_alerts_in_view (hooks/use-safety-alerts.ts forwards to this):
//  - once per REAL viewport change, 400 ms after the map settles — keyed on the four bound numbers,
//    so a re-render that hands over a new object with the same bounds schedules nothing (a new
//    object every render used to restart the debounce on every render: a refetch loop of roughly
//    two RPCs a second per open map, which also kept the 60 s poll from ever firing);
//  - every 60 s while the tab is visible (safety_alerts is not in the realtime publication, so this
//    poll is how a stationary viewer sees new pins and vote counts);
//  - right after the member places or edits an alert (refresh): those RPCs return the raw row with
//    a geography, not the lng/lat a marker needs, so the in-view read brings the pin in;
//  - once when the tab becomes visible again (the poll skips hidden tabs, so it catches up now).
// Only the latest read's answer is applied (createLatestOnlyLoader): a slow answer for an older
// viewport never replaces a newer one.

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

export class SafetyAlertsFetchScheduler {
  private key: string | null = null
  private bounds: AlertBounds | null = null
  private debounce: ReturnType<typeof setTimeout> | null = null
  private poll: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly deps: {
      fetch: (bounds: AlertBounds) => void
      /** document.visibilityState === 'visible' (no background polling). */
      isVisible: () => boolean
    },
  ) {}

  /** The map's current bounds (called on every render; only a change in the numbers schedules). */
  setBounds(bounds: AlertBounds | null): void {
    const key = boundsKey(bounds)
    if (key === this.key) return
    this.stop()
    this.key = key
    this.bounds = bounds
    if (!bounds) return
    this.debounce = setTimeout(() => {
      this.debounce = null
      this.deps.fetch(bounds)
    }, ALERTS_DEBOUNCE_MS)
    this.poll = setInterval(() => {
      if (this.bounds && this.deps.isVisible()) this.deps.fetch(this.bounds)
    }, ALERTS_POLL_MS)
  }

  /** The tab's visibility changed: becoming visible reads the current viewport once. */
  visibilityChanged(visible: boolean): void {
    if (visible) this.refresh()
  }

  /** Read the current viewport now (after the member placed or edited an alert). */
  refresh(): void {
    if (this.bounds) this.deps.fetch(this.bounds)
  }

  /** Unmount: stop both timers and forget the viewport (a StrictMode re-mount schedules afresh). */
  dispose(): void {
    this.stop()
    this.key = null
    this.bounds = null
  }

  private stop(): void {
    if (this.debounce) clearTimeout(this.debounce)
    if (this.poll) clearInterval(this.poll)
    this.debounce = null
    this.poll = null
  }
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
