// apps/web/src/lib/safety-alert-store.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The alerts one surface (the feed strip, or the map) holds between reads. Plain code, no React:
// the hooks (hooks/use-safety-strip.ts, hooks/use-safety-alerts.ts) forward to it.
//
//  - replace(rows): a reader's answer becomes the list.
//  - apply(answer): an RPC answer (place, update, resolve, vote) is merged onto the alert already
//    held, field by field (mergeAlertAnswer): the pin keeps its coordinates unless the answer carries
//    two finite numbers (an update that moved it), and keeps `is_mine`. An answer the shown rule
//    calls gone (cleared by votes, removed) takes the alert out at once.
//  - remove(id): the member's own withdrawal — the entry leaves at once.
//  - A timer at the earliest "shown until" instant (expiry while live, resolved + 6 h) drops an
//    alert without a read, so a resolved alert leaves after six hours with no reload.
//  - setEngaged(id, true): the member's focus is inside that strip entry, or its popup is open. An
//    engaged alert is never taken away by a read or by the clock: it stays, with status 'ended'
//    (rendered as "no longer listed", no actions), until the member lets go. Their own actions
//    (remove, or an answer that ends it) still take it out at once.

import { alertShownState, alertShownUntil, isAlertShown } from './safety-alert-live'
import type { SafetyAlert } from './safety-alert-rpc'

/** Client-only status of an engaged alert that a read no longer returns. The shown rule calls it gone. */
export const ENDED_STATUS = 'ended'

const RANK = { live: 0, resolved: 1, gone: 2 } as const

/** The reader's order: live first, then highest severity, then newest. */
export function compareAlerts(a: SafetyAlert, b: SafetyAlert, now: number): number {
  const byState = RANK[alertShownState(a, now)] - RANK[alertShownState(b, now)]
  if (byState !== 0) return byState
  if (a.severity !== b.severity) return b.severity - a.severity
  return Date.parse(b.created_at) - Date.parse(a.created_at)
}

/**
 * An RPC answer applied onto the alert already held. Taken from the answer: status, counts, type,
 * severity, description, expiry, verified, version, the update and resolve marks. Kept from the held
 * entry: `is_mine`, and the coordinates unless the answer carries two finite numbers (then the pin
 * moves). A marker's coordinates therefore stay finite through any answer.
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
  }
}

/** What a read returned, as one string: two reads with the same signature show the same thing. */
export function alertsSignature(alerts: readonly SafetyAlert[]): string {
  return alerts
    .map((a) => `${a.id}:${a.version}:${a.status}:${a.confirm_count}:${a.clear_count}:${a.verified ? 1 : 0}`)
    .join('|')
}

export class SafetyAlertStore {
  private byId = new Map<string, SafetyAlert>()
  private readonly engaged = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly onChange: (alerts: SafetyAlert[]) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** The list a surface draws, in the reader's order. */
  list(): SafetyAlert[] {
    const now = this.now()
    return [...this.byId.values()].sort((a, b) => compareAlerts(a, b, now))
  }

  get(id: string): SafetyAlert | undefined {
    return this.byId.get(id)
  }

  replace(alerts: readonly SafetyAlert[]): void {
    const now = this.now()
    const next = new Map<string, SafetyAlert>()
    for (const alert of alerts) if (isAlertShown(alert, now)) next.set(alert.id, alert)
    for (const id of this.engaged) {
      const held = this.byId.get(id)
      if (held && !next.has(id)) next.set(id, { ...held, status: ENDED_STATUS })
    }
    this.byId = next
    this.emit()
  }

  apply(answer: SafetyAlert): void {
    const merged = mergeAlertAnswer(this.byId.get(answer.id), answer)
    if (isAlertShown(merged, this.now())) this.byId.set(merged.id, merged)
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
    if (held && !isAlertShown(held, this.now())) {
      this.byId.delete(id)
      this.emit()
    }
  }

  /** Unmount: stop the timer. */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private emit(): void {
    this.schedule()
    this.onChange(this.list())
  }

  /** One timer at the earliest instant a held alert stops being shown. */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const now = this.now()
    let next: number | null = null
    for (const alert of this.byId.values()) {
      const until = alertShownUntil(alert, now)
      if (until !== null && (next === null || until < next)) next = until
    }
    if (next === null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.expire()
    }, Math.max(0, next - now))
  }

  private expire(): void {
    const now = this.now()
    for (const [id, alert] of this.byId) {
      if (isAlertShown(alert, now)) continue
      if (this.engaged.has(id)) this.byId.set(id, { ...alert, status: ENDED_STATUS })
      else this.byId.delete(id)
    }
    this.emit()
  }
}
