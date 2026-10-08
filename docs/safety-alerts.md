# Safety alerts

Members drop safety pins (weather, road closure, speeding, general) on the map. Pins publish
immediately with an "Unverified — neighbor report" label, collect confirm / clear votes, and
expire on a severity-based clock. Moderators (`community_moderator` and up, see
[admin-tiers.md](admin-tiers.md)) can verify or remove them.

## Lifecycle

| Status | Written by | When |
|---|---|---|
| `live` | `place_safety_alert` | On creation. `expires_at = now() + TTL`: severity 1 = 2 h, 2 = 6 h, 3 = 24 h, 4 = 72 h. |
| `cleared` | `vote_safety_alert` | At least 3 clear votes and more clears than confirms. |
| `removed` | `admin_remove_safety_alert` | A moderator removes it (audited in `admin_actions`). |
| `expired` | `expire_safety_alerts()` via pg_cron `safety_alerts_expire` (every 5 min) | `status = 'live'` and `expires_at <= now()`. Only `live` rows are touched; a re-run moves 0 rows. |

An alert is **live** while `status = 'live' AND expires_at > now()`. Every reader applies that
rule, so an alert drops out of every view at its expiry instant, and its row is marked `expired`
within 5 minutes:

- Map: `safety_alerts_in_view` (RPC). When it is called (`lib/safety-alerts-fetch.ts`): once per real
  viewport change, 400 ms after the map settles (keyed on the four bound numbers, so a re-render with
  the same bounds calls nothing); every 60 s while the tab is visible; once when the tab becomes
  visible again; and once right after the member places or edits an alert (those RPCs return no
  lng/lat for the marker). Only the latest read's answer is applied, so a slow answer for an older
  viewport never replaces a newer one. Deleting removes the pin locally, with no read. Until 2026-10 a new bounds object every render re-armed the debounce on every
  render: about 1.5–2.5 calls a second per open map, and the 60 s poll never fired.
- Feed safety strip (`feed-panel.tsx`): RLS `safety_alerts_select` (`status = 'live'`) plus
  `expires_at > now`.
- Admin review list and the Overview "Live Safety Alerts" count: `whereSafetyAlertLive`
  (`apps/web/src/lib/safety-alert-live.ts`).

Votes follow the same rule: `vote_safety_alert` refuses a vote with "alert is no longer live"
when the status is not `live` **or** `expires_at` has passed, and its auto-clear only changes a
row that is still `live`, so a vote racing the job or a removal never turns that alert into
`cleared`.

What changes when a row becomes `expired`: the RLS policy no longer returns it to members. Owners can still edit / delete it
through `update_safety_alert` / `delete_safety_alert` (ownership check only), and moderators can
still verify or remove it (no status check), though no UI lists expired alerts. The expiry
UPDATE never changes `verified`, so the Watcher engagement trigger
(`trg_engagement_safety_alert_verify`) records nothing.

## Operations

- Migration: `supabase/migrations/20261025000000_safety_alerts_expire_job.sql`.
- SQL smoke: `supabase/tests/safety_alerts_expire.smoke.sql` (BEGIN … ROLLBACK; X4b needs `feed.smoke_local=on`).
- Log: one `app_logs` row `safety_alerts.expire` per run that expired at least one alert
  (`info`, `context.expired`) or failed (`error`, `context.error_code`). See
  [observability.md](observability.md).
- Run by hand (service_role / Management API): `select public.expire_safety_alerts();`
