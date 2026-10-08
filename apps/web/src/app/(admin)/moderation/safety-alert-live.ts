// The one "live right now" rule for admin reads of safety_alerts.
//
// An alert is live while status = 'live' AND expires_at > now — the same rule the
// map reader safety_alerts_in_view applies. pg_cron job safety_alerts_expire
// (migration 20261025000000) moves past-expiry rows to 'expired' every 5 minutes;
// the expires_at filter keeps an alert in that window out of admin views too.
// `now` is the browser clock: a slow clock is bounded by the job's 5-minute status flip;
// a fast clock hides an alert early by the size of the skew.

interface LiveFilterable<Q> {
  eq(column: 'status', value: 'live'): Q
}
interface ExpiryFilterable<Q> {
  gt(column: 'expires_at', value: string): Q
}

export function whereSafetyAlertLive<Q extends LiveFilterable<Q> & ExpiryFilterable<Q>>(query: Q, now: Date): Q {
  return query.eq('status', 'live').gt('expires_at', now.toISOString())
}
