// apps/web/src/lib/safety-alert-live.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE client predicate for whether a safety alert is shown, and how (specs/r3-contract.md,
// "The live / shown rule"). Every client surface asks it: the feed strip, the map layer and popup,
// the map-focus link and the admin review list.
//
//   live      votes, updates, verify and resolve are possible
//   resolved  drawn as an all-clear for six hours; never counted as live, never voted on
//   gone      everything else (expired, cleared, removed, withdrawn, resolved for 6 hours or more)
//
// THE SERVER DECIDES. Every reader row and every RPC answer carries the server's own verdict
// (`shown_state`) and the instant it ends (`shown_until`), computed on the server's clock; the
// predicate reads those fields. The browser clock never hides a row the server returned and never
// keeps one the server dropped: a phone whose clock is hours off shows exactly what the server said.
//
// The rule itself (status = 'live' AND expires_at > now; resolved_at > now - 6 h) is written here only
// as a fallback for a row that carries no server verdict. That should not happen (a pre-Release-3
// answer shape); lib/safety-alert-rpc.ts logs it when it does.
// lib/safety-alert-live.test.ts scans the tree: an alert read that bypasses this module fails there.

/** How long a resolved alert stays shown (contract: resolved_at + 6 h). Fallback rule only. */
export const RESOLVED_SHOWN_MS = 6 * 3600_000

export type AlertShownState = 'live' | 'resolved' | 'gone'

/** What the predicate reads: the server's verdict, and the columns the fallback rule needs. */
export interface AlertShownFields {
  status: string
  expires_at: string
  resolved_at?: string | null
  /** The server's verdict for this row. */
  shown_state?: string | null
  /** The instant the server stops showing it (expiry while live, resolved_at + 6 h once resolved). */
  shown_until?: string | null
}

const STATES: readonly string[] = ['live', 'resolved', 'gone']

/** True when the row carries the server's verdict. */
export function hasServerShownState(alert: { shown_state?: string | null }): boolean {
  return typeof alert.shown_state === 'string' && STATES.includes(alert.shown_state)
}

/** The rule on a clock: for a row with no server verdict only. */
export function localShownState(alert: Pick<AlertShownFields, 'status' | 'expires_at' | 'resolved_at'>, now: number): AlertShownState {
  if (alert.status === 'live' && Date.parse(alert.expires_at) > now) return 'live'
  if (alert.status === 'resolved' && alert.resolved_at != null && Date.parse(alert.resolved_at) > now - RESOLVED_SHOWN_MS) {
    return 'resolved'
  }
  return 'gone'
}

/** The server's verdict; `fallbackNow` is the clock for a row that carries none. */
export function alertShownState(alert: AlertShownFields, fallbackNow: number = Date.now()): AlertShownState {
  if (hasServerShownState(alert)) return alert.shown_state as AlertShownState
  return localShownState(alert, fallbackNow)
}

/** Live: it can be voted on, updated, verified and resolved. */
export function isAlertLive(alert: AlertShownFields, fallbackNow?: number): boolean {
  return alertShownState(alert, fallbackNow) === 'live'
}

/** Shown: drawn on the strip and the map (live, or resolved less than 6 hours ago). */
export function isAlertShown(alert: AlertShownFields, fallbackNow?: number): boolean {
  return alertShownState(alert, fallbackNow) !== 'gone'
}

/** A refusal named the alert's status (PT410 details): was it resolved (still shown), or gone? */
export function isResolvedStatus(status: string | null | undefined): boolean {
  return status === 'resolved'
}

/** The instant (ms, server time) a shown alert stops being shown; null for a gone alert or a row
 *  that does not say. A surface uses it only to ask the server again at that instant. */
export function alertShownUntil(alert: AlertShownFields): number | null {
  if (alertShownState(alert) === 'gone' || !alert.shown_until) return null
  const until = Date.parse(alert.shown_until)
  return Number.isNaN(until) ? null : until
}
