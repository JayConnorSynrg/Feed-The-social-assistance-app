# RPC contract — migration 20261023000000_events_recurring_announce.sql
Source: `supabase/migrations/20261023000000_events_recurring_announce.sql`. Canonical copy: `specs/events-recurring-contract.md`.
Applies on top of 20261020000000. Organization events only (same write authority as 20261020: platform admin for any
non-business org; org admin of THAT active non-business org; guests refused). Every write RPC writes exactly one
`admin_actions` row per call carrying the request's `x-request-id` (send through privilegedRpc); idempotent replays
write nothing; failed calls write nothing. All are SECURITY DEFINER with a pinned search_path.

## 1. The repeat rule (`p_recurrence jsonb`) — RFC 8984 (JSCalendar) RecurrenceRule subset
```jsonc
{ "frequency": "weekly",                 // "weekly" | "monthly"
  "interval": 2,                          // weekly: 1..4 (every N weeks, counted from the FIRST date's week, Mon-Sun); monthly: 1 (omit)
  "byDay": [{ "day": "sa" }],             // weekly: >=1 day; monthly: [{ "day": "fr", "nthOfPeriod": -1 }] (1|2|3|4|-1 = last)
  "byMonthDay": [31],                     // monthly only, instead of byDay; 1..31 (a month without that day is skipped, not counted)
  "until": "2027-04-30T23:59:59",         // local date-time in the event's zone, inclusive — OR —
  "count": 12 }                           // 1..1000 total dates counted from the first date — OR neither = never ends
```
- Day codes `mo tu we th fr sa su` (ISO weekday 1..7 = mo..su). Optional `"@type": "RecurrenceRule"` / `"NDay"` accepted.
- `until` and `count` are mutually exclusive. UI default "ends after 6 months" = `until` = first date + 6 months, `T23:59:59`.
- The FIRST date (`p_starts_local` on create, `p_series_starts_local` on edit) must itself be one of the rule's dates,
  and must not be after `until`.
- A repeating event's dates last at most 24 h each (end - start, wall clock).
- Generated date times follow RFC 5545 Errata 4271: a start inside a DST gap moves forward by the gap
  (02:30 -> 03:30 on spring-forward day); a start inside a repeated hour uses the FIRST occurrence. Hand-entered
  dates (first date, add_event_dates) still refuse gap/repeat times with `22023 event_time_invalid: ...`.
- Rule problems: `22023` message `event_recurrence_invalid: <plain sentence>` (stable prefix; sentence for logs).
  The same check is a table CHECK (`assistance_events_recurrence_valid`), so no write path can store a bad rule.

## 2. Dates of a repeating event
- Exist from the venue's today (never before the first date) through today + 180 days, never beyond until/count;
  written in the same transaction as the save, topped up nightly (cron `events_generate_nightly` 03:37 UTC).
- `event_occurrences` gains: `source` ('rule' | 'manual'), `series_local_date` (date; the rule date a rule row stands
  for), `cancel_reason` ('admin' | 'retired' | 'org_inactive' | 'rule_changed'; NULL unless status='cancelled').
- Cancelling one date of a series (`cancel_event_occurrence`) is permanent for the generator (never re-created);
  `add_event_dates` with that exact local start reschedules it.
- Every date the pattern produces is exactly ONE rule row. A FUTURE hand-added date that sits exactly on a repeat date
  (same start instant) becomes that date's rule row (`source` 'rule', `series_local_date` set), keeping its id, status
  (an admin-cancelled one stays cancelled and is never re-created) and check-ins: the one-off's date when an event is
  made to repeat, and a date added with `add_event_dates` (also one ahead of the 180-day horizon). A later time-of-day
  edit moves it like any upcoming rule date (unless it has check-ins). Past hand-added dates are never adopted.
- Deploy: the migration ends with one `events_generate_nightly()` run (0 events in production => inserts nothing,
  writes one `info` row), so the watchdog sees a successful run from day one.

## 3. Feed / Events-tab window (one rule for ranked_feed_v2 and upcoming_events, same for every viewer)
- `assistance_events.announce_days_before smallint NOT NULL DEFAULT 7`, one of `0, 1, 3, 7, 14, 30`.
- A date is announced from 00:00 venue local time N days before its local date. For each active event of an active
  org, its ROW is its soonest announced, not-ended date that is either upcoming, or cancelled for any reason except
  `retired` / `org_inactive` (i.e. `admin`, `rule_changed`). The feed and the members' Events tab show ONE card
  per event: that row.
- A cancelled row keeps the event listed from the moment of cancellation until the cancelled date ENDS (nobody makes
  a wasted trip); then the normal rule resumes. Weekly + lead 7 + tomorrow cancelled => listed today with the notice.

## 4. Signatures

### create_org_event (old 18-arg signature DROPPED; same name, 2 new trailing args)
```
create_org_event(p_org_id uuid, p_idempotency_key uuid, p_title text, p_time_zone text,
  p_starts_local timestamp, p_ends_local timestamp, p_location_source text,
  p_event_type text = 'distribution', p_description text = NULL, p_location_name text = NULL,
  p_address text = NULL, p_city text = NULL, p_state text = NULL, p_zip_code text = NULL,
  p_lat float8 = NULL, p_lng float8 = NULL, p_default_capacity int = NULL,
  p_requires_registration boolean = false,
  p_recurrence jsonb = NULL,                 -- NULL = one date (as before)
  p_announce_days_before int = 7) RETURNS uuid   -- event id
```
- Repeating: `p_starts_local`/`p_ends_local` = the first date (also the time of day + length of every date).
  Every rule date from today..today+180 is created now; if none is upcoming:
  `22023 event_recurrence_invalid: the repeat gives no upcoming dates`.
- Audit `event.create` details add: `recurrence`, `announce_days_before`, `generated` (dates written).
- New errors: `22023 event_invalid: post to the feed 0, 1, 3, 7, 14 or 30 days before each date`;
  `22023 event_recurrence_invalid: ...`.

### admin_update_event (old 16-arg signature DROPPED; 4 new trailing args)
```
admin_update_event(p_event_id uuid, p_title, p_event_type, p_description, p_location_name, p_address, p_city,
  p_state, p_zip_code, p_default_capacity int, p_requires_registration bool, p_location_source text,
  p_lat float8, p_lng float8, p_is_active bool, p_clear text[] = '{}',
  p_recurrence jsonb = NULL,                -- NULL keeps the stored rule
  p_series_starts_local timestamp = NULL,   -- first date start (date + time of day); both or neither
  p_series_ends_local timestamp = NULL,     -- first date end (length of every date, <= 24 h)
  p_announce_days_before int = NULL) RETURNS uuid   -- NULL keeps
```
- `p_clear` additionally accepts `'recurrence'` = stop repeating ("does not repeat"), in this order:
  1. KEEP: the event's next date — the soonest date starting after now, of any source, that is upcoming OR cancelled
     only because the event was retired / its org deactivated (`cancel_reason` retired / org_inactive) — is kept as a
     hand-added one-off: same id, same times, same status and reason (so a later reactivation restores it),
     check-ins kept, `source` 'manual', `series_local_date` NULL. If that date is already hand-added it is simply kept.
     Admin-cancelled and rule_changed dates are never the kept date; if no such date exists, nothing is kept.
     E.g. retire -> stop repeating -> reactivate leaves exactly that one date, upcoming, same id.
  2. REMOVE: every other future rule date without check-ins (upcoming, or cancelled for retired / org_inactive) is
     deleted; a future upcoming rule date WITH check-ins is cancelled with reason `rule_changed` (kept for its history).
  3. UNTOUCHED: other hand-added dates; admin-cancelled and rule_changed dates; dates that started or ended already.
  The rule columns become NULL and nothing is generated afterwards. Audit details `kept_one_off` = the kept date's id
  (NULL if none). Cannot be combined with p_recurrence / p_series_*. If the same call retires the event
  (`p_is_active => false`), the kept date is then cancelled with reason `retired` like any not-started date and comes
  back on reactivation.
- Change time of day only: send `p_series_starts_local`/`p_series_ends_local` with the stored `series_start_local`
  DATE and the new times -> every future rule date without check-ins keeps its id and moves to the new time.
- Change the pattern: send `p_recurrence` (+ new `p_series_*` when the stored first date is not in the new pattern,
  else 22023 `event_recurrence_invalid: the first date must be one of the repeating dates`). Future rule dates
  without check-ins that no longer fit are removed, new ones created; dates with check-ins are never moved or
  deleted (cancelled with reason rule_changed if they no longer fit). Hand-added and admin-cancelled dates untouched.
- Make a one-off event repeat: send `p_recurrence` + `p_series_*`. If the existing date sits exactly on the pattern
  (same date and start time as `p_series_starts_local`), it becomes the first rule date (same id); otherwise it stays a
  hand-added extra date.
- Retire (`p_is_active => false`): not-started dates cancelled (reason retired). Reactivate (`true`): exactly the
  future, check-in-free dates cancelled by retire / org deactivation come back, missing rule dates are created.
- Audit details add: `rule_edit`, `recurrence`, `reconcile` {adopted, moved, deleted, cancelled_rule_changed,
  kept_with_checkins, generated}, `restored_dates`, `announce_days_before`.

### preview_event_recurrence (new; platform admins + org admins only; STABLE; writes nothing)
```
preview_event_recurrence(p_recurrence jsonb, p_starts_local timestamp, p_ends_local timestamp,
  p_time_zone text, p_limit int = 5)
RETURNS TABLE(local_date date, starts_local timestamp, ends_local timestamp,
              starts_at timestamptz, ends_at timestamptz, shifted boolean)
```
- The next `p_limit` (1..52) dates from max(today in p_time_zone, first date), same expansion + DST rule as saving.
  `shifted` = the date's start or end local time does not exist that day (DST gap) and was moved forward
  (`starts_local`/`ends_local` are the times as they will actually read on the clock).
- Who: a platform admin, or an admin of an active NON-BUSINESS organization (the people who can save a rule):
  `is_current_user_admin() OR EXISTS(organization_members role 'admin' of an org with is_active AND org_type <> 'business')`.
  A guest session is refused first, even one holding an admin row: `42501 event_denied: guests cannot manage events;
  sign in with an account`. Anyone else: `42501 event_denied: only a platform admin or an organization admin may
  preview repeating dates`. (EXECUTE is granted to `authenticated`; anon has none.)
- Errors: same rule / zone / time errors as create (22023).

### extend_event_series (new; authenticated)
```
extend_event_series(p_event_id uuid, p_idempotency_key uuid) RETURNS jsonb
-- {"recurrence": {...}, "previous_end": "2027-04-30", "until": "2027-10-30T23:59:59", "generated": n, "replayed": false}
```
- New end = (current end, or today if that already passed) + 6 months, `T23:59:59` local. A `count` rule becomes an
  `until` rule ending 6 months after its last date. Same key again -> same result with `"replayed": true`, no write.
- One audit row `event.extend_series` (details include `idempotency_key`).
- Errors: `22023 event_recurrence_invalid: only a repeating event that ends can be extended`;
  `22023 event_invalid: an idempotency key is required`; authority 42501 / P0002 as the other writers;
  `P0001 event_retired: ...` for a retired event.

### org_events_ending_soon (new; authenticated; same gate as the org admin page)
```
org_events_ending_soon(p_org_id uuid, p_within_days int = 30)
RETURNS TABLE(event_id uuid, title text, last_local_date date, remaining_dates int)
```
- Active repeating events of the org with an end (until/count) whose LAST date is on or before today + `p_within_days`
  (1..180; else `22023 event_invalid: look ahead 1 to 180 days`) — including series whose last date already passed.
  `last_local_date` = that last date (venue-local, may be in the past); `remaining_dates` = rule dates from today
  through it (0 once passed; counts admin-cancelled dates too). Ordered by last date. Not admin of org -> 42501.

### upcoming_events (new; anon + authenticated) — members' Events tab
```
upcoming_events(p_limit int = 50)
RETURNS TABLE(event_id uuid, occurrence_id uuid, starts_at timestamptz, ends_at timestamptz,
              cancelled_occurrence_id uuid, cancelled_starts_at timestamptz)
```
- Exactly the events the feed shows, ONE row per event, ordered by the event's row date (§3).
- Row is an upcoming date: `occurrence_id/starts_at/ends_at` = that date; `cancelled_*` NULL.
- Row is a cancelled date: `cancelled_occurrence_id/cancelled_starts_at` = the cancelled date and
  `occurrence_id/starts_at/ends_at` = the event's FOLLOWING upcoming date (later cancelled dates skipped), even if
  that date is not yet announced; all three NULL when there is none -> render "Sat Oct 10 cancelled — next: Sat Oct 24"
  (or "Sat Oct 10 cancelled" alone).
- `COALESCE(cancelled_occurrence_id, occurrence_id)` = the feed row id for the same event.
- Hydrate event/org fields with the existing `event_occurrences` select on `occurrence_id` (or
  `cancelled_occurrence_id` when `occurrence_id` is NULL) — RLS-visible to every viewer for an active event of an
  active org, cancelled or not. Returns no profile columns.

### ranked_feed_v2 (signature + RETURNS unchanged)
- Event rows: one per event = its row (§3; replaces the fixed 30 days). `id` = that occurrence's id — for a cancelled
  row, the CANCELLED occurrence's id (`kind` stays 'event'; hydrate it and render it as cancelled from its status).
- Upcoming row score = max(freshness, proximity) x distance factor. freshness = 2^-(h since the date became the
  event's shown date / ranking_config.half_life_hours), where "became shown" = max(announce instant, end of the previous
  date that was shown — upcoming, completed, or cancelled other than retired/org_inactive —, date created);
  proximity = 2^-(|h to start| / ranking_config.event_half_life_hours).
- Cancelled row score = proximity of the cancelled date x distance factor (no freshness).

### unchanged signatures, changed behaviour
- `add_event_dates`: at most 366 dates per call (`22023 event_invalid: add at most 366 dates at a time`);
  rescheduling a cancelled date clears its cancel_reason; a new date exactly on a repeat date becomes that date's
  rule row (audit details `became_rule_dates`).
- `cancel_event_occurrence`: sets cancel_reason 'admin'.

## 5. Columns dropped
`assistance_events.geocode_accuracy`, `assistance_events.geocode_confidence` (no reader; the pin is `location`).

## 6. UI call sites that must change
- apps/web/src/lib/event-admin-rpc.ts (+test): create/update arg builders gain p_recurrence/p_announce_days_before/p_series_*.
- apps/web/src/lib/event-form-model.ts (+test): recurrence + announce fields; p_clear 'recurrence'.
- apps/web/src/app/(admin)/moderation/event-create-dialog.tsx / event-edit-dialog.tsx: repeat + "post N days before" controls, preview.
- apps/web/src/components/panels/events-panel.tsx: read `upcoming_events` (drop the 30-day client window) + cancelled notice.
- apps/web/src/components/panels/feed-panel.tsx: unchanged call; window now server-side.
- apps/web/src/app/(admin)/moderation/org/org-overview-data.ts: org_events_ending_soon + extend_event_series.
- apps/web/src/app/(admin)/moderation/event-scheduler.tsx: 200-dates-per-event read (a weekly 7-day series holds ~182 future dates).
