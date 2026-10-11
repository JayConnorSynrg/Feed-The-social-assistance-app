# Safety alerts

Members drop safety pins (weather, road closure, speeding, general) on the map. Pins publish
immediately with an "Unverified — neighbor report" label, collect "Still here" / "Gone now" votes,
and expire on a severity-based clock. The member who reported an alert can update it, raise or lower
its severity, mark it resolved or withdraw it, from the map popup or the feed strip. Moderators
(`community_moderator` and up, see [admin-tiers.md](admin-tiers.md)) can verify or remove alerts.
Nobody is ever shown who reported or verified an alert: the client receives ownership only as
`is_mine`, and the history and the resolved state credit a role ("by the reporter", "by a
moderator"), never a name.

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

**The server decides.** It applies the rule in the one reader, `safety_alerts_in_view` (the only
place a resolved alert can be read), and stamps its verdict on every row and every RPC answer:
`shown_state` (`live` · `resolved` · `gone`) and `shown_until` (the instant it ends, on the server's
clock). The client reads those two fields through `apps/web/src/lib/safety-alert-live.ts`
(`alertShownState`) and nowhere else. The browser clock never hides a row the server returned and
never keeps one the server dropped: a phone whose clock is hours ahead or a day behind shows exactly
what the server last said.

- `lib/safety-alert-rpc.ts` copies `shown_state` / `shown_until` from each row (`toSafetyAlert`) and
  keeps or drops a row by them. A row that carries no verdict (a pre-Release-3 answer shape) falls
  back to the rule on the browser clock and logs `alerts.shown_state.missing` once per page load.
- The strip, the marker and popup, the map-focus link and the admin list draw from
  `alert.shown_state`. No surface passes a clock to the predicate; `lib/safety-alert-live.test.ts`
  scans the tree and fails when a file reads alerts another way, writes its own status comparison, or
  hands the predicate a time.
- The browser clock does one thing: when the earliest `shown_until` is in the browser's future, the
  store sets one timer for it, and when it fires the surface **reads once** (it removes nothing by
  itself). The 60-second poll is the backstop. If reads fail (offline), the last server answer stays
  on screen until a read succeeds.

| Surface | Reader call | Notes |
|---|---|---|
| Feed strip | `safety_alerts_in_view({ p_include_resolved: true, p_limit: 5 })` | live first, then highest severity, then newest |
| Map layer | `safety_alerts_in_view({ p_min_lng, p_min_lat, p_max_lng, p_max_lat, p_include_resolved: true })` | |
| Dialog (fresh read), conflict re-read, map-focus link, admin "Edit in admin" pin | `safety_alerts_in_view({ p_alert_id, p_include_resolved: true })` | 0 or 1 row |
| History | `safety_alert_history({ p_alert_id })` | newest first; empty once the alert is gone |
| Admin review list | `safety_alerts_in_view({ p_include_resolved: true, p_limit: 200 })` | resolved rows are labelled and never counted as live |
| Admin Overview "Live Safety Alerts" count | the admin list read above (`countLiveSafetyAlerts`) | counts the rows the server calls live; exact up to 200; a resolved alert is never counted |
| An alert whose popup or strip entry the member is on, after a read stopped returning it | `safety_alerts_in_view({ p_alert_id, p_include_resolved: true })` | asked once before it is marked "no longer listed" (a pin that only left the viewport stays live) |

All of them go through `apps/web/src/lib/safety-alert-rpc.ts`, which copies each row field by field.
No client code reads the `safety_alerts` table.

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
- **Verified.** Any change the reporter saves to their own verified alert returns it to unverified
  until a moderator checks it again; the dialog says so before saving, and the notice after the save
  repeats it when the answer comes back unverified. A moderator's edit of someone else's alert keeps
  the mark.
- **History.** One message per version (`safety_alert_history`): reported, updated (what changed),
  marked resolved — with the expiry that version carries, credited to the ROLE that acted
  (`actor_role`: "Updated by the reporter", "Marked resolved by a moderator"). A resolved alert says
  "Resolved by the reporter" or "Resolved by a moderator" (`resolved_by_role`). Never a name or an id;
  a message without a role keeps the plain wording.
- **Ended first.** Any write on an alert that is no longer live is refused `PT410`; the dialog
  closes, says so, and the surface re-reads.
- **A write that never answers.** Every alert write (place, update, resolve, withdraw, vote, and the
  moderators' verify and remove) gives up after 12 seconds (`QUERY_TIMEOUT_MS`, passed to
  `privilegedRpc` as an `AbortSignal`). The dialog's single-flight gate is released and it says the
  connection failed, so Save works again; each opening of the dialog has its own gate.

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
- once when the earliest `shown_until` passes (the server then says whether the alert is gone);
- only the latest read's answer is applied.

Between reads the store (`lib/safety-alert-store.ts`) merges an RPC answer onto the alert it holds
— the pin keeps its coordinates unless the answer carries new ones, keeps `is_mine`, and its open
popup stays open — and takes out an alert the member withdrew or their vote cleared at once. It
removes nothing on a clock. An alert the member is on (focus or the pointer inside its strip entry,
or its popup open) is never taken away under them: when a read stops returning it the store asks for
it by id, keeps it live if the server still shows it (it only left the viewport), and otherwise
marks it "no longer listed" until they move on. Panels unmount on switch, so placing or voting on
the map and returning to the feed reads the strip again.

Read volume is measured by `alerts.poll` (one row per 30 reads, or when the page goes away — never
per tab hide and never per panel switch: the counter lives in the page's memory, so leaving the feed
or the map and coming back loses no count; failed reads are counted in the same row) and every
action by one `alerts.*` row: see [observability.md](observability.md#safety-alerts-member-actions-and-read-volume).

## Surfaces

- **Feed strip** (`components/feed/safety-strip.tsx`, `hooks/use-safety-strip.ts`): up to five shown
  alerts in the viewer's language. An entry opens the map on that alert. The reporter gets Update /
  Mark resolved / Withdraw (never a guest: the strip asks the session itself); everyone gets History
  once an alert has changed. Each action button is described by its entry's title, text and time.
  Two live regions are mounted from the first render: `role="alert"` for an alert created after the
  list before, or a raised severity, only; `role="status"` for an update, a resolution, an alert no
  longer listed and the member's own outcome. A refresh that changes nothing announces nothing, and
  what a region said is cleared 8 seconds later. The member's own outcome is also a visible line with
  a Dismiss control; it goes away when they start the next action. Dismiss takes its own button away,
  so focus goes to the strip's heading first (the feed's heading when no alert is listed). An entry
  never leaves while focus or the pointer is inside it. The strip never moves focus when the list
  changes: an action button that has focus when its action stops being offered (the alert ended, or
  someone resolved it) stays where it is, disabled, until focus leaves it. Focus never falls to the
  page, and a screen-reader user reading elsewhere is not pulled back.
- **Map marker + popup** (`components/map/safety-alert-marker.tsx`, `hooks/use-safety-alerts.ts`):
  votes (members only, live alerts only; a counted vote is announced once, "Vote recorded."), the same
  actions, a full date and time, "Updated …" and the expiry. The marker button and the popup's dialog
  (Close included) carry their own `lang` / `dir`. The marker face says severity and state without
  colour: low is a circle, moderate a diamond (a square stood on its corner, drawn inside the 32 px
  target), high a circle with a "!" badge, critical a rounded square with "!!", resolved a check mark,
  no longer listed a hollow dashed circle; each with a dark 2 px outline. The outline colours (and the
  edges of the alert buttons and form fields) are marked important in the class list (`border-…!`):
  `app/globals.css` sets `* { border-color }` outside any cascade layer, which otherwise beats every
  border-colour utility and draws the edge pale grey. Closing the popup clears "Vote recorded.", so a
  reopened popup starts clean. The member's own outcome is a line above the map (`MapAlertNotice`),
  in the page's flow so it never covers a marker; while there is nothing to say its wrapper is out of
  the layout (the map sits where it would without it) and its status region stays mounted. Its
  Dismiss control gives focus to the map first. When an alert ends under an open popup, the control
  that has focus stays, disabled, until focus leaves it; nothing moves focus.
- **Dialogs** (`components/alerts/`): update / resolve / withdraw with the compare step, and the
  history. Cancel is offered in every state, including while the alert is being read; the two
  confirmations expose their text as the dialog's description; the history announces "History loaded"
  with the number of entries. On close, focus returns to the control that opened the dialog; when that
  is gone (the alert was just marked resolved) to the alert's own entry or popup; when the alert left,
  to the next entry, the strip heading or the map.
- **Hazard menu** (`components/map/hazard-bubble-menu.tsx`): the report flow, for members. A guest
  sees the create-account prompt instead of the report entries. Its address search sends the typed
  address to Mapbox's geocoding API when the member presses Find or Enter; nothing typed is written
  to a log.
- **Admin review** (`app/(admin)/moderation/safety-alerts-review.tsx`): English; verify and remove
  send the version on screen; live, resolved and the map link follow the server's verdict; the list is
  read once per mount and once per stale refusal.
- Copy: `lib/i18n-feed-alerts.ts` (14 locales), also the one source of the type and severity names.

## Operations

- Migrations: `supabase/migrations/20261025000000_safety_alerts_expire_job.sql`,
  `20261026600000_r3_foundation.sql`, `20261026700000_r3_contract.sql`.
- SQL smoke: `supabase/tests/safety_alerts_expire.smoke.sql`, `supabase/tests/r3_foundation.smoke.sql`.
- Log: one `app_logs` row `safety_alerts.expire` per run that expired at least one alert
  (`info`, `context.expired`) or failed (`error`, `context.error_code`).
- Run by hand (service_role / Management API): `select public.expire_safety_alerts();`
