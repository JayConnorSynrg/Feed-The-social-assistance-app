# Safety alerts

Members drop safety pins (weather, road closure, speeding, general) on the map. Pins publish
immediately with an "Unverified — neighbor report" label, collect "Still here" / "Gone now" votes,
and expire on a severity-based clock. The member who reported an alert can update it, raise or lower
its severity, mark it resolved or withdraw it, from the map popup or the feed strip. Moderators
(`community_moderator` and up, see [admin-tiers.md](admin-tiers.md)) can verify or remove alerts.
Nobody is ever shown who reported or verified an alert: the client receives ownership only as
`is_mine`.

Client contract: [specs/r3-contract.md](../specs/r3-contract.md) ("Safety alerts"); model and
invariants: [specs/r3-model.md](../specs/r3-model.md). Migrations `20261026600000_r3_foundation`
(apply before this client) and `20261026700000_r3_contract` (after every Release 3 client is deployed).

## Live and shown: one rule

```
live      status = 'live' AND expires_at > now          votes, updates, verify and resolve are possible
resolved  status = 'resolved' AND resolved_at > now - 6 h   an all-clear; drawn as resolved; never live
gone      everything else                               expired, cleared, removed, withdrawn, resolved >= 6 h
shown  =  live or resolved
```

The server applies it in the one reader, `safety_alerts_in_view` (the only place a resolved alert
can be read). The client applies the same rule, on the browser clock, in
`apps/web/src/lib/safety-alert-live.ts` (`alertShownState`), and nowhere else:
`lib/safety-alert-live.test.ts` scans the tree and fails when a file reads alerts another way or
writes its own status comparison.

| Surface | Reader call | Notes |
|---|---|---|
| Feed strip | `safety_alerts_in_view({ p_include_resolved: true, p_limit: 5 })` | live first, then highest severity, then newest |
| Map layer | `safety_alerts_in_view({ p_min_lng, p_min_lat, p_max_lng, p_max_lat, p_include_resolved: true })` | |
| Dialog (fresh read), conflict re-read, map-focus link, admin "Edit in admin" pin | `safety_alerts_in_view({ p_alert_id, p_include_resolved: true })` | 0 or 1 row |
| History | `safety_alert_history({ p_alert_id })` | newest first; empty once the alert is gone |
| Admin review list | `safety_alerts_in_view({ p_include_resolved: true, p_limit: 200 })` | resolved rows are labelled and never counted as live |
| Admin Overview "Live Safety Alerts" count | table head count through `whereSafetyAlertLive` | live only (RLS `safety_alerts_select` is `status = 'live'`); the one table read left |

All of them go through `apps/web/src/lib/safety-alert-rpc.ts`, which copies each row field by field
and drops any row the rule calls gone. A slow browser clock is corrected by the next read; a fast one
hides an alert early by the size of the skew.

## Lifecycle

| Status | Written by | When |
|---|---|---|
| `live` | `place_safety_alert` | On creation. `expires_at = now() + TTL`: severity 1 = 2 h, 2 = 6 h, 3 = 24 h, 4 = 72 h. |
| `resolved` | `resolve_safety_alert` | The reporter (or a moderator) marks it resolved. Shown as resolved for 6 hours; no reopen. |
| `withdrawn` | `delete_safety_alert` | The reporter withdraws it (a recorded withdrawal; the row stays). Gone at once. |
| `cleared` | `vote_safety_alert` | At least 3 "Gone now" votes and more of them than "Still here". Gone at once. |
| `removed` | `admin_remove_safety_alert` | A moderator removes it (audited in `admin_actions`). |
| `expired` | `expire_safety_alerts()` via pg_cron `safety_alerts_expire` (every 5 min) | `status = 'live'` and `expires_at <= now()`. |

Updates (`update_safety_alert`, the reporter or a moderator, live alerts only):

- **Version.** Every alert carries `version`. Update and resolve send the version the member saw; a
  stale one is refused `PT409` and the client opens a compare step (the current version beside the
  member's changes: keep mine, or use the current version). Nothing is sent again without the member.
- **Expiry.** Raising the severity restarts the expiry for the new level from the update. Lowering it
  never extends the alert and caps what is left at the lower level's window. Any other update keeps
  the expiry. The client shows the `expires_at` the server answered.
- **Verified.** The reporter's own change of type, text or place, or a raise of severity, returns a
  verified alert to unverified; the dialog says so before saving.
- **History.** One message per version (`safety_alert_history`): reported, updated (what changed),
  marked resolved — with the expiry that version carries. It never says who.
- **Ended first.** Any write on an alert that is no longer live is refused `PT410`; the dialog
  closes, says so, and the surface re-reads.

No self-moderation: a moderator cannot verify an alert they reported (the admin list offers no
Approve on it); resolving or updating their own alert is the reporter's act.

## Freshness: a poll, not realtime

`safety_alerts` is not in the realtime publication, so the reporter's id never transits the WAL.
Both surfaces read through one scheduler (`apps/web/src/lib/safety-alerts-fetch.ts`):

- once per real change of a primitive key — the map's four bound numbers (400 ms after the map
  settles), the strip's viewer id (at once). A re-render with the same key reads nothing. (Until
  2026-10 a new bounds object every render re-armed the debounce on every render: about 1.5–2.5
  calls a second per open map, and the poll never fired.)
- every **60 seconds** while the tab is visible; a hidden tab reads nothing and reads once on return;
- once after the member's own action (place, vote, update, resolve, withdraw);
- only the latest read's answer is applied.

Between reads the store (`lib/safety-alert-store.ts`) merges an RPC answer onto the alert it holds
— the pin keeps its coordinates unless the answer carries new ones, keeps `is_mine`, and its open
popup stays open — takes out an alert the member withdrew or their vote cleared at once, and drops an
alert at its "shown until" instant (expiry, or resolved + 6 h) with no read. Panels unmount on
switch, so placing or voting on the map and returning to the feed reads the strip again.

Read volume is measured by `alerts.poll` (one row per 30 reads / tab hide / unmount) and every
action by one `alerts.*` row: see [observability.md](observability.md#safety-alerts-member-actions-and-read-volume).

## Surfaces

- **Feed strip** (`components/feed/safety-strip.tsx`, `hooks/use-safety-strip.ts`): up to five shown
  alerts in the viewer's language. An entry opens the map on that alert. The reporter gets Update /
  Mark resolved / Withdraw; everyone gets History once an alert has changed. Two live regions are
  mounted from the first render: `role="alert"` for a new alert or a raised severity only;
  `role="status"` for an update, a resolution, an alert no longer listed and the member's own outcome.
  A refresh that changes nothing announces nothing. An entry never leaves while focus is inside it.
- **Map marker + popup** (`components/map/safety-alert-marker.tsx`, `hooks/use-safety-alerts.ts`):
  votes (members only, live alerts only), the same actions, a full date and time, "Updated …" and
  the expiry; the popup sets its own `lang` / `dir`.
- **Dialogs** (`components/alerts/`): update / resolve / withdraw with the compare step, and the history.
- **Hazard menu** (`components/map/hazard-bubble-menu.tsx`): the report flow. Its address search sends
  the typed address to Mapbox's geocoding API when the member presses Find or Enter; nothing typed is
  written to a log.
- **Admin review** (`app/(admin)/moderation/safety-alerts-review.tsx`): English; verify and remove
  send the version on screen.
- Copy: `lib/i18n-feed-alerts.ts` (14 locales), also the one source of the type and severity names.

## Operations

- Migrations: `supabase/migrations/20261025000000_safety_alerts_expire_job.sql`,
  `20261026600000_r3_foundation.sql`, `20261026700000_r3_contract.sql`.
- SQL smoke: `supabase/tests/safety_alerts_expire.smoke.sql`, `supabase/tests/r3_foundation.smoke.sql`.
- Log: one `app_logs` row `safety_alerts.expire` per run that expired at least one alert
  (`info`, `context.expired`) or failed (`error`, `context.error_code`).
- Run by hand (service_role / Management API): `select public.expire_safety_alerts();`
