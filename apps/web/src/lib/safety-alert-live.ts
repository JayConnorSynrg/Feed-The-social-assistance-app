// apps/web/src/lib/safety-alert-live.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE rule that says whether a safety alert is shown, and how (specs/r3-contract.md, "The live /
// shown rule"). Every client surface asks it: the feed strip, the map layer and popup, the map-focus
// link, the admin review list and the admin overview count.
//
//   live      status = 'live' AND expires_at > now      votes, updates, verify and resolve are possible
//   resolved  status = 'resolved' AND resolved_at > now - 6 h      drawn as an all-clear; never counted
//             as live, never voted on
//   gone      everything else (expired, cleared, removed, withdrawn, resolved for 6 hours or more)
//
// Two forms of the same rule:
//   alertShownState(row, now)        for a row a reader returned (safety_alerts_in_view) or an RPC answered;
//   whereSafetyAlertLive(query, now) for the one table read left (the admin overview's head count of
//                                    live alerts; RLS safety_alerts_select shows status = 'live' rows only).
// `now` is the browser clock. The server applies the same rule on its own clock in every reader, so a
// slow browser clock is corrected by the next read (60 s poll); a fast one hides an alert early by the
// size of the skew. pg_cron job safety_alerts_expire moves past-expiry rows to 'expired' every 5 minutes.
// lib/safety-alert-live.test.ts scans the tree: an alert read that bypasses this module fails there.

/** How long a resolved alert stays shown (contract: resolved_at + 6 h). */
export const RESOLVED_SHOWN_MS = 6 * 3600_000

export type AlertShownState = 'live' | 'resolved' | 'gone'

/** The three columns the rule reads. */
export interface AlertShownFields {
  status: string
  expires_at: string
  resolved_at?: string | null
}

export function alertShownState(alert: AlertShownFields, now: number = Date.now()): AlertShownState {
  if (alert.status === 'live' && Date.parse(alert.expires_at) > now) return 'live'
  if (alert.status === 'resolved' && alert.resolved_at != null && Date.parse(alert.resolved_at) > now - RESOLVED_SHOWN_MS) {
    return 'resolved'
  }
  return 'gone'
}

/** Live: it can be voted on, updated, verified and resolved. */
export function isAlertLive(alert: AlertShownFields, now: number = Date.now()): boolean {
  return alertShownState(alert, now) === 'live'
}

/** Shown: drawn on the strip and the map (live, or resolved less than 6 hours ago). */
export function isAlertShown(alert: AlertShownFields, now: number = Date.now()): boolean {
  return alertShownState(alert, now) !== 'gone'
}

/** A refusal named the alert's status (PT410 details): was it resolved (still shown), or gone? */
export function isResolvedStatus(status: string | null | undefined): boolean {
  return status === 'resolved'
}

/** The instant (ms) a shown alert stops being shown: its expiry while live, resolved_at + 6 h once
 *  resolved. null for an alert that is already gone. */
export function alertShownUntil(alert: AlertShownFields, now: number = Date.now()): number | null {
  const state = alertShownState(alert, now)
  if (state === 'live') return Date.parse(alert.expires_at)
  if (state === 'resolved') return Date.parse(alert.resolved_at as string) + RESOLVED_SHOWN_MS
  return null
}

interface LiveFilterable<Q> {
  eq(column: 'status', value: 'live'): Q
}
interface ExpiryFilterable<Q> {
  gt(column: 'expires_at', value: string): Q
}

/** The live half of the rule as a PostgREST filter (a resolved alert is not readable from the table). */
export function whereSafetyAlertLive<Q extends LiveFilterable<Q> & ExpiryFilterable<Q>>(query: Q, now: Date): Q {
  return query.eq('status', 'live').gt('expires_at', now.toISOString())
}
