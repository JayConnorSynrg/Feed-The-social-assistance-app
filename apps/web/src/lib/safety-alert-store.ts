// apps/web/src/lib/safety-alert-store.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The alerts one surface (the feed strip, or the map) holds between reads. Plain code, no React:
// the hooks (hooks/use-safety-strip.ts, hooks/use-safety-alerts.ts) forward to it.
//
// THE SERVER DECIDES what is shown (lib/safety-alert-live.ts): a row is kept or dropped by the
// verdict it carries (shown_state), never by the browser clock. A phone whose clock is hours off
// holds exactly what the server last returned.
//
//  - replace(rows): a reader's answer becomes the list.
//  - apply(answer): an RPC answer (place, update, resolve, vote) is merged onto the alert already
//    held, field by field (mergeAlertAnswer): the pin keeps its coordinates unless the answer carries
//    two finite numbers (an update that moved it), and keeps `is_mine`. An answer whose verdict is
//    gone (cleared by votes, removed) takes the alert out at once.
//  - remove(id): the member's own withdrawal — the entry leaves at once.
//  - At the earliest "shown until" instant among the rows held — when that instant is still in the
//    browser's future — the store asks for ONE read (onDue). It deletes nothing itself: the read's
//    answer does. With a wrong browser clock the 60 s poll is the backstop.
//    Those reads are spaced out: one is asked for no sooner than 5 seconds after the last read
//    finished (DUE_READ_SPACING_MS), so alerts that end close together share a read — fifty pins
//    ending 1.5 s apart cost a read every 5 s, not one each. An ended alert is therefore drawn for
//    up to about 6 seconds past its end, and never past the next 60 s poll.
//  - setEngaged(id, true): the member's focus or pointer is inside that strip entry, or its popup
//    is open. An engaged alert is never taken away by a read: when a read no longer returns it, the
//    store asks for that one alert by id (recheck). Still shown (it only left the viewport, or the
//    top five): it stays as it is. Gone: it stays, marked ended (drawn as "no longer listed", no
//    actions), until the member lets go. Their own actions (remove, or an answer that ends it)
//    still take it out at once.

import { alertShownState, alertShownUntil, isAlertShown } from './safety-alert-live'
import type { SafetyAlert } from './safety-alert-rpc'

/** Client-only status of an engaged alert the server no longer shows. Its verdict is gone. */
export const ENDED_STATUS = 'ended'

/** How long after a "shown until" instant the one read is asked for (the server has passed it). */
export const SHOWN_UNTIL_MARGIN_MS = 1000

/** A read the store asks for is never sooner than this after the last read finished. */
export const DUE_READ_SPACING_MS = 5000

const RANK = { live: 0, resolved: 1, gone: 2 } as const

/** The reader's order: live first, then highest severity, then newest. */
export function compareAlerts(a: SafetyAlert, b: SafetyAlert): number {
  const byState = RANK[alertShownState(a)] - RANK[alertShownState(b)]
  if (byState !== 0) return byState
  if (a.severity !== b.severity) return b.severity - a.severity
  return Date.parse(b.created_at) - Date.parse(a.created_at)
}

/**
 * An RPC answer applied onto the alert already held. Taken from the answer: status, the server's
 * verdict, counts, type, severity, description, expiry, verified, version, the update and resolve
 * marks. Kept from the held entry: `is_mine`, and the coordinates unless the answer carries two
 * finite numbers (then the pin moves). A marker's coordinates therefore stay finite through any answer.
 */
export function mergeAlertAnswer(held: SafetyAlert | undefined, answer: SafetyAlert): SafetyAlert {
  const moved = Number.isFinite(answer.lng) && Number.isFinite(answer.lat)
  return {
    id: answer.id,
    alert_type: answer.alert_type,
    severity: answer.severity,
    description: answer.description,
    lng: moved || !held ? answer.lng : held.lng,
    lat: moved || !held ? answer.lat : held.lat,
    status: answer.status,
    shown_state: answer.shown_state,
    shown_until: answer.shown_until,
    confirm_count: answer.confirm_count,
    clear_count: answer.clear_count,
    created_at: answer.created_at || held?.created_at || '',
    expires_at: answer.expires_at,
    verified: answer.verified,
    is_mine: held ? held.is_mine : answer.is_mine,
    version: answer.version,
    updated_at: answer.updated_at,
    update_count: answer.update_count,
    resolved_at: answer.resolved_at,
    resolved_by_role: answer.resolved_by_role,
  }
}

/** What a read returned, as one string: two reads with the same signature show the same thing. */
export function alertsSignature(alerts: readonly SafetyAlert[]): string {
  return alerts
    .map((a) => `${a.id}:${a.version}:${a.shown_state}:${a.confirm_count}:${a.clear_count}:${a.verified ? 1 : 0}`)
    .join('|')
}

export interface SafetyAlertStoreDeps {
  /** Ask the server again now: a "shown until" instant has passed on this clock. */
  onDue?: () => void
  /** Read one alert by id: is an engaged alert a read no longer returns still shown? */
  recheck?: (alertId: string) => Promise<SafetyAlert | null>
  /** The browser clock (only to decide when to ask again; never to hide a row). */
  now?: () => number
}

export class SafetyAlertStore {
  private byId = new Map<string, SafetyAlert>()
  private readonly engaged = new Set<string>()
  private readonly rechecking = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | null = null
  /** When the waiting timer fires (browser clock). */
  private timerAt: number | null = null
  /** When the last read finished, answered or failed (browser clock). */
  private lastReadAt: number | null = null
  private readonly now: () => number

  constructor(
    private readonly onChange: (alerts: SafetyAlert[]) => void,
    private readonly deps: SafetyAlertStoreDeps = {},
  ) {
    this.now = deps.now ?? (() => Date.now())
  }

  /** The list a surface draws, in the reader's order. */
  list(): SafetyAlert[] {
    return [...this.byId.values()].sort(compareAlerts)
  }

  get(id: string): SafetyAlert | undefined {
    return this.byId.get(id)
  }

  replace(alerts: readonly SafetyAlert[]): void {
    // A read just finished: whatever instant a waiting timer was for, this answer covers it.
    this.lastReadAt = this.now()
    this.cancelTimer()
    const next = new Map<string, SafetyAlert>()
    for (const alert of alerts) if (isAlertShown(alert)) next.set(alert.id, alert)
    const dropped: string[] = []
    for (const id of this.engaged) {
      const held = this.byId.get(id)
      if (!held || next.has(id)) continue
      // The read no longer returns an alert the member is on. Keep it as it was and ask the server
      // about that one alert (it may only have left the viewport or the top five).
      next.set(id, held)
      if (isAlertShown(held)) dropped.push(id)
    }
    this.byId = next
    this.emit()
    for (const id of dropped) this.recheck(id)
  }

  apply(answer: SafetyAlert): void {
    const merged = mergeAlertAnswer(this.byId.get(answer.id), answer)
    if (isAlertShown(merged)) this.byId.set(merged.id, merged)
    else this.byId.delete(merged.id)
    this.emit()
  }

  remove(id: string): void {
    if (!this.byId.delete(id)) return
    this.emit()
  }

  setEngaged(id: string, engaged: boolean): void {
    if (engaged) {
      this.engaged.add(id)
      return
    }
    if (!this.engaged.delete(id)) return
    const held = this.byId.get(id)
    if (held && !isAlertShown(held)) {
      this.byId.delete(id)
      this.emit()
    }
  }

  /** A read finished without an answer (it failed): the next one the store asks for is spaced from it too. */
  readFailed(): void {
    this.lastReadAt = this.now()
    this.schedule()
  }

  /** Unmount: stop the timer. */
  dispose(): void {
    this.cancelTimer()
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.timerAt = null
  }

  /** Is an engaged alert a read dropped still shown? One by-id read; without a reader, it is ended. */
  private recheck(id: string): void {
    if (!this.deps.recheck) return this.end(id)
    if (this.rechecking.has(id)) return
    this.rechecking.add(id)
    this.deps.recheck(id).then(
      (row) => {
        this.rechecking.delete(id)
        const held = this.byId.get(id)
        if (!held || !this.engaged.has(id)) return
        if (row && isAlertShown(row)) {
          this.byId.set(id, mergeAlertAnswer(held, row))
          this.emit()
        } else {
          this.end(id)
        }
      },
      // The answer is unknown (offline): the alert stays as last seen; the next read asks again.
      () => void this.rechecking.delete(id),
    )
  }

  /** Mark an engaged alert the server no longer shows: it stays until the member lets go. */
  private end(id: string): void {
    const held = this.byId.get(id)
    if (!held) return
    this.byId.set(id, { ...held, status: ENDED_STATUS, shown_state: 'gone', shown_until: null })
    this.emit()
  }

  private emit(): void {
    this.schedule()
    this.onChange(this.list())
  }

  /** One timer for the earliest "shown until" instant that is still ahead on this clock. It asks for
   *  one read; it never deletes. An instant already behind this clock arms nothing (the row was just
   *  returned by the server, so this clock is the one that is wrong): the poll will ask.
   *  The read is asked for no sooner than DUE_READ_SPACING_MS after the last read finished. A timer
   *  already waiting is never pushed back by a later alert (an alert whose instant passed while it
   *  waits is covered by that same read) — only by that spacing. */
  private schedule(): void {
    if (!this.deps.onDue) return
    const now = this.now()
    let next: number | null = null
    for (const alert of this.byId.values()) {
      const until = alertShownUntil(alert)
      if (until !== null && until > now && (next === null || until < next)) next = until
    }
    const floor = this.lastReadAt === null ? 0 : this.lastReadAt + DUE_READ_SPACING_MS
    const fresh = next === null ? null : Math.max(next + SHOWN_UNTIL_MARGIN_MS, floor)
    const waiting = this.timerAt === null ? null : Math.max(this.timerAt, floor)
    const at = fresh === null ? waiting : waiting === null ? fresh : Math.min(fresh, waiting)
    if (at === null || at === this.timerAt) return
    this.cancelTimer()
    this.timerAt = at
    this.timer = setTimeout(() => {
      this.timer = null
      this.timerAt = null
      this.deps.onDue?.()
    }, at - now)
  }
}
