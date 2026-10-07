-- 20261023000000_events_recurring_announce.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: organization events can REPEAT, and each event chooses how far ahead each date is
-- posted to the community feed (and the members' Events tab) to notify the community.
--
-- What this migration does
--   (a) Repeat rule. assistance_events.recurrence holds an RFC 8984 (JSCalendar) RecurrenceRule
--       subset: weekly (every 1-4 weeks, one or more weekdays) or monthly (nth / last weekday, or
--       day of month), ending on a date (until), after N dates (count, 1-1000) or never. The
--       first date (series_start_local) must be one of the rule's dates; its time of day and the
--       wall-clock length (series_duration, at most 24 h) apply to every date. The database
--       validates the rule: CHECK via the IMMUTABLE event_recurrence_problem(), which returns a
--       plain sentence (NULL = valid); the RPCs raise 22023 'event_recurrence_invalid: <sentence>'.
--   (b) Dates. A repeating event's dates are rows in event_occurrences (source 'rule', identity
--       series_local_date; partial UNIQUE (event_id, series_local_date) WHERE source = 'rule'). They
--       exist from the venue's today (never before the first date) through today + 180 days and
--       never beyond until/count: written in the same transaction as the save and topped up by
--       the nightly SQL job events_generate_nightly (pg_cron 37 3 * * *). The generator only
--       INSERTs (ON CONFLICT DO NOTHING), after locking the event and its organization, so re-runs,
--       concurrent runs and edits never duplicate a date, and a cancelled date is never re-created.
--       Generated times follow RFC 5545 Errata 4271 (a start inside a DST gap moves forward; a
--       repeated local time is its FIRST instant); hand-entered dates keep refusing gap / repeat
--       times (event_local_to_utc unchanged).
--   (c) Edits (admin_update_event). A new time of day moves every future rule date without
--       check-ins in place (same ids). A new pattern replaces only future rule dates without
--       check-ins. Dates with check-ins are never deleted or moved; one that no longer fits is
--       cancelled with cancel_reason 'rule_changed'. Hand-added dates and admin-cancelled dates are
--       untouched. A hand-added date that sits exactly on a repeat date (e.g. a one-off event's
--       date when the event is made to repeat, or a date added ahead of the 180-day horizon)
--       becomes that date's rule row, keeping its id and check-ins (event_adopt_manual_dates), so
--       every repeat date is exactly one rule row. extend_event_series adds 6 months to a series that ends (a count becomes an
--       until); org_events_ending_soon lists series about to end; preview_event_recurrence shows the
--       next dates of an unsaved rule with the same expansion (platform admins and
--       admins of an active non-business org only). Stopping a repeat ('recurrence' in p_clear)
--       keeps the next upcoming date as a hand-added one-off (same id).
--   (d) cancel_reason ('admin' | 'retired' | 'org_inactive' | 'rule_changed') is written by every
--       canceller. Reactivating an event or its organization restores exactly the future,
--       check-in-free dates cancelled for 'retired' / 'org_inactive', then fills missing rule dates.
--       add_event_dates can reschedule an admin-cancelled date (its reason is cleared) and takes
--       at most 366 dates per call.
--   (e) Announce window. assistance_events.announce_days_before (0, 1, 3, 7, 14 or 30; default 7):
--       a date is shown from 00:00 venue local time N days before its local date until it ends.
--       ONE rule, event_feed_next(), feeds ranked_feed_v2 and the new members' RPC upcoming_events,
--       the same for every viewer: per active event of an active organization, its soonest
--       announced, not-ended date that is upcoming or cancelled for a reason other than
--       'retired' / 'org_inactive' is the event's ONE row. A cancelled row keeps the event listed
--       (so nobody makes a wasted trip) until that date ends: upcoming_events returns it as
--       cancelled_* plus the following upcoming date as the next date (announced or not; NULL if
--       none) -> "Sat Oct 10 cancelled — next: Sat Oct 24"; ranked_feed_v2 returns the cancelled
--       occurrence id. This replaces the fixed 30-day horizon. Score: an upcoming row =
--       max(freshness since it became the event's shown date, on the posts' half-life; proximity
--       to its start, on event_half_life_hours); a cancelled row = proximity only; x the existing
--       distance factor. The posts branch and ranked_feed (v1) are unchanged; no function returns
--       profile display columns.
--   (f) assistance_events.geocode_accuracy and geocode_confidence are dropped: nothing reads them
--       (the pin is assistance_events.location); production holds 0 events (2026-10-07).
--
-- Migration order (5-step): (1) no extensions; (2) pure functions the new CHECK calls, then column
-- + constraint + index changes on existing tables; (3)-(4) no new tables; functions; (5) no RLS
-- change (no new table; the new columns are covered by the existing table grants + policies).
-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction.

BEGIN;
-- Fail fast instead of queueing behind long reads when a lock is contended.
SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- 2a. Pure functions (IMMUTABLE, no table access, not client-executable). Created first: the
--     new CHECK constraint calls event_recurrence_problem, which calls event_rule_dates.
-- ============================================================================

-- event_rule_dates: the local dates (and local start timestamps) of a rule on/after p_from and
-- through p_through. Weekdays are ISO 1=Mon..7=Sun. "Every N weeks" counts Mon-Sun weeks from the
-- week of the first date (RFC 5545 WKST=MO). nthOfPeriod -1 = the last such weekday of the month.
-- A byMonthDay a month lacks (31 in April) is skipped and not counted (RFC 5545). count counts
-- from the first date, so a count rule always enumerates from the first date; other rules start
-- at max(p_from, first date). until is inclusive and compared with each date's local start
-- (RFC 5545 UNTIL). The caller guarantees the rule passed event_recurrence_problem.
CREATE OR REPLACE FUNCTION public.event_rule_dates(p_rule jsonb, p_dtstart timestamp, p_from date, p_through date)
  RETURNS TABLE(local_date date, local_start timestamp)
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE
  SET search_path = pg_catalog, pg_temp
AS $fn$
  WITH r AS (
    SELECT p_rule->>'frequency'                    AS freq,
           COALESCE((p_rule->>'interval')::int, 1) AS iv,
           (p_rule->>'count')::bigint              AS cnt,
           (p_rule->>'until')::timestamp           AS until_ts,
           p_dtstart::date                         AS d0,
           p_dtstart::time                         AS t0,
           ARRAY(SELECT CASE e->>'day' WHEN 'mo' THEN 1 WHEN 'tu' THEN 2 WHEN 'we' THEN 3 WHEN 'th' THEN 4
                                       WHEN 'fr' THEN 5 WHEN 'sa' THEN 6 ELSE 7 END
                   || ':' || COALESCE(e->>'nthOfPeriod', '*')
                   FROM jsonb_array_elements(COALESCE(p_rule->'byDay', '[]'::jsonb)) e)   AS ndays,
           ARRAY(SELECT e::int FROM jsonb_array_elements_text(COALESCE(p_rule->'byMonthDay', '[]'::jsonb)) e) AS mdays
  ),
  days AS (
    SELECT g::date AS d, extract(isodow FROM g)::int AS dow, extract(day FROM g)::int AS dom
      FROM r, generate_series(CASE WHEN r.cnt IS NULL THEN GREATEST(r.d0, p_from) ELSE r.d0 END,
                              LEAST(p_through, r.until_ts::date), interval '1 day') g
  ),
  matched AS (
    SELECT x.d
      FROM days x, r
     WHERE CASE r.freq
             WHEN 'weekly' THEN
               (x.dow || ':*') = ANY (r.ndays)
               AND (((x.d - (x.dow - 1)) - (r.d0 - (extract(isodow FROM r.d0)::int - 1))) / 7) % r.iv = 0
             WHEN 'monthly' THEN
               x.dom = ANY (r.mdays)
               OR (x.dow || ':' || ((x.dom - 1) / 7 + 1)) = ANY (r.ndays)
               OR ((x.dow || ':-1') = ANY (r.ndays)
                   AND extract(month FROM x.d + 7) <> extract(month FROM x.d))
           END
       AND (r.until_ts IS NULL OR x.d + r.t0 <= r.until_ts)
  ),
  numbered AS (
    SELECT m.d, row_number() OVER (ORDER BY m.d) AS rn FROM matched m
  )
  SELECT n.d, n.d + r.t0
    FROM numbered n, r
   WHERE (r.cnt IS NULL OR n.rn <= r.cnt) AND n.d >= p_from
   ORDER BY n.d
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_rule_dates(jsonb, timestamp, date, date) FROM PUBLIC, anon, authenticated;

-- event_series_last_date: the local date of a series' LAST date (NULL when it never ends).
-- Consecutive dates of any accepted rule are at most 62 days apart (day 31: Jan 31 -> Mar 31), so
-- an until series' last date lies in (until - 62 days, until]; a count series enumerates from its
-- first date through count x 62 days (count <= 1000).
CREATE OR REPLACE FUNCTION public.event_series_last_date(p_rule jsonb, p_dtstart timestamp)
  RETURNS date
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE
  SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT CASE
           WHEN p_rule ? 'until' THEN
             (SELECT max(d.local_date)
                FROM public.event_rule_dates(p_rule, p_dtstart,
                       GREATEST(p_dtstart::date, (p_rule->>'until')::timestamp::date - 62),
                       (p_rule->>'until')::timestamp::date) d)
           WHEN p_rule ? 'count' THEN
             (SELECT max(d.local_date)
                FROM public.event_rule_dates(p_rule, p_dtstart, p_dtstart::date,
                       p_dtstart::date + (p_rule->>'count')::int * 62) d)
         END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_series_last_date(jsonb, timestamp) FROM PUBLIC, anon, authenticated;

-- event_recurrence_problem: NULL when the rule (with its first date, when given) is valid, else a
-- plain sentence naming the problem. The CHECK assistance_events_recurrence_valid tests IS NULL;
-- the RPCs raise 22023 'event_recurrence_invalid: <sentence>'. Accepted shape (RFC 8984 subset):
--   {"@type"?: "RecurrenceRule", "frequency": "weekly"|"monthly", "interval"?: int,
--    "byDay"?: [{"@type"?: "NDay", "day": "mo".."su", "nthOfPeriod"?: 1|2|3|4|-1}],
--    "byMonthDay"?: [1..31], "until"?: "YYYY-MM-DDTHH:MM:SS" (local, inclusive),
--    "count"?: 1..1000, "skip"?: "omit"}
CREATE OR REPLACE FUNCTION public.event_recurrence_problem(p_rule jsonb, p_series_start timestamp)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE PARALLEL SAFE
  SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  v_freq  text;
  v_iv    integer := 1;
  v_day   jsonb;
  v_keys  text[] := '{}';
  v_key   text;
  v_bad   text;
  v_until timestamp;
BEGIN
  IF p_rule IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_rule) <> 'object' THEN RETURN 'the repeat rule must be a JSON object'; END IF;
  SELECT string_agg(k, ', ' ORDER BY k) INTO v_bad FROM jsonb_object_keys(p_rule) k
   WHERE k NOT IN ('@type', 'frequency', 'interval', 'byDay', 'byMonthDay', 'until', 'count', 'skip');
  IF v_bad IS NOT NULL THEN RETURN 'the repeat rule has unsupported properties: ' || v_bad; END IF;
  IF p_rule ? '@type' AND p_rule->'@type' <> '"RecurrenceRule"'::jsonb THEN
    RETURN '@type must be RecurrenceRule';
  END IF;
  IF jsonb_typeof(p_rule->'frequency') IS DISTINCT FROM 'string'
     OR p_rule->>'frequency' NOT IN ('weekly', 'monthly') THEN
    RETURN 'frequency must be weekly or monthly';
  END IF;
  v_freq := p_rule->>'frequency';
  IF p_rule ? 'interval' THEN
    IF jsonb_typeof(p_rule->'interval') <> 'number' OR (p_rule->>'interval') !~ '^[0-9]{1,2}$' THEN
      RETURN 'interval must be a whole number';
    END IF;
    v_iv := (p_rule->>'interval')::integer;
  END IF;
  IF v_freq = 'weekly' AND v_iv NOT BETWEEN 1 AND 4 THEN RETURN 'a weekly rule repeats every 1 to 4 weeks'; END IF;
  IF v_freq = 'monthly' AND v_iv <> 1 THEN RETURN 'a monthly rule repeats every month (interval 1)'; END IF;
  IF p_rule ? 'skip' AND p_rule->'skip' <> '"omit"'::jsonb THEN RETURN 'skip must be omit'; END IF;
  IF p_rule ? 'until' AND p_rule ? 'count' THEN
    RETURN 'a repeat ends on a date (until) or after a number of dates (count), not both';
  END IF;
  IF p_rule ? 'count' AND (jsonb_typeof(p_rule->'count') <> 'number' OR (p_rule->>'count') !~ '^[1-9][0-9]{0,3}$'
                           OR (p_rule->>'count')::integer > 1000) THEN
    RETURN 'count must be a whole number from 1 to 1000';
  END IF;
  IF p_rule ? 'until' THEN
    IF jsonb_typeof(p_rule->'until') <> 'string'
       OR (p_rule->>'until') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$' THEN
      RETURN 'until must be a local date-time such as 2027-04-30T23:59:59';
    END IF;
    BEGIN
      v_until := (p_rule->>'until')::timestamp;
    EXCEPTION WHEN OTHERS THEN
      RETURN 'until is not a real date-time';
    END;
    IF to_char(v_until, 'YYYY-MM-DD"T"HH24:MI:SS') <> p_rule->>'until' THEN RETURN 'until is not a real date-time'; END IF;
  END IF;
  IF v_freq = 'weekly' THEN
    IF p_rule ? 'byMonthDay' THEN RETURN 'a weekly rule uses byDay only'; END IF;
    IF NOT p_rule ? 'byDay' THEN RETURN 'a weekly rule needs at least one day in byDay'; END IF;
  ELSIF (p_rule ? 'byDay') = (p_rule ? 'byMonthDay') THEN
    RETURN 'a monthly rule needs exactly one of byDay or byMonthDay';
  END IF;
  IF p_rule ? 'byDay' THEN
    IF jsonb_typeof(p_rule->'byDay') <> 'array' OR jsonb_array_length(p_rule->'byDay') = 0 THEN
      RETURN 'byDay must be a non-empty array';
    END IF;
    FOR v_day IN SELECT e FROM jsonb_array_elements(p_rule->'byDay') e LOOP
      IF jsonb_typeof(v_day) <> 'object' THEN RETURN 'each byDay entry must be an object'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_day) k WHERE k NOT IN ('@type', 'day', 'nthOfPeriod')) THEN
        RETURN 'a byDay entry takes day and nthOfPeriod only';
      END IF;
      IF v_day ? '@type' AND v_day->'@type' <> '"NDay"'::jsonb THEN RETURN 'a byDay entry @type must be NDay'; END IF;
      IF jsonb_typeof(v_day->'day') IS DISTINCT FROM 'string'
         OR v_day->>'day' NOT IN ('mo', 'tu', 'we', 'th', 'fr', 'sa', 'su') THEN
        RETURN 'day must be one of mo, tu, we, th, fr, sa, su';
      END IF;
      IF v_freq = 'weekly' AND v_day ? 'nthOfPeriod' THEN RETURN 'a weekly rule does not take nthOfPeriod'; END IF;
      IF v_freq = 'monthly' AND (jsonb_typeof(v_day->'nthOfPeriod') IS DISTINCT FROM 'number'
                                 OR v_day->>'nthOfPeriod' NOT IN ('1', '2', '3', '4', '-1')) THEN
        RETURN 'a monthly byDay entry needs nthOfPeriod 1, 2, 3, 4 or -1 (last)';
      END IF;
      v_key := (v_day->>'day') || ':' || COALESCE(v_day->>'nthOfPeriod', '');
      IF v_key = ANY (v_keys) THEN RETURN 'byDay lists the same day twice'; END IF;
      v_keys := v_keys || v_key;
    END LOOP;
  END IF;
  IF p_rule ? 'byMonthDay' THEN
    IF jsonb_typeof(p_rule->'byMonthDay') <> 'array' OR jsonb_array_length(p_rule->'byMonthDay') = 0 THEN
      RETURN 'byMonthDay must be a non-empty array';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rule->'byMonthDay') e
                WHERE jsonb_typeof(e) <> 'number' OR e::text !~ '^([1-9]|[12][0-9]|3[01])$') THEN
      RETURN 'byMonthDay values must be days 1 to 31';
    END IF;
    IF (SELECT count(*) <> count(DISTINCT e::text) FROM jsonb_array_elements(p_rule->'byMonthDay') e) THEN
      RETURN 'byMonthDay lists the same day twice';
    END IF;
  END IF;
  -- The first date belongs to the pattern (and the repeat does not end before it).
  IF p_series_start IS NOT NULL THEN
    IF v_until IS NOT NULL AND v_until < p_series_start THEN
      RETURN 'the repeat ends before its first date';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_rule_dates(p_rule, p_series_start,
                                                         p_series_start::date, p_series_start::date)) THEN
      RETURN 'the first date must be one of the repeating dates';
    END IF;
  END IF;
  RETURN NULL;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_recurrence_problem(jsonb, timestamp) FROM PUBLIC, anon, authenticated;

-- event_local_to_utc_rfc: local wall-clock time -> instant for GENERATED dates, per RFC 5545
-- (Errata 4271): a local time inside a DST gap is read with the offset in force BEFORE the gap
-- (02:30 -> 03:30 EDT); a repeated local time is the FIRST instant. Assumes no two offset changes
-- within 24 h. event_local_to_utc (hand-entered times: refuses gap / repeat) is unchanged.
CREATE OR REPLACE FUNCTION public.event_local_to_utc_rfc(p_local timestamp, p_time_zone text)
  RETURNS timestamptz
  LANGUAGE sql
  IMMUTABLE STRICT PARALLEL SAFE
  SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT CASE
           WHEN (a.pg AT TIME ZONE p_time_zone) <> p_local THEN b.first_inst          -- gap
           WHEN b.first_inst < a.pg AND (b.first_inst AT TIME ZONE p_time_zone) = p_local
             THEN b.first_inst                                                       -- repeat: first
           ELSE a.pg
         END
    FROM (SELECT p_local AT TIME ZONE p_time_zone AS pg) a
    CROSS JOIN LATERAL (
      SELECT (p_local - (((a.pg - interval '1 day') AT TIME ZONE p_time_zone)
                         - ((a.pg - interval '1 day') AT TIME ZONE 'UTC'))) AT TIME ZONE 'UTC' AS first_inst
    ) b
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_local_to_utc_rfc(timestamp, text) FROM PUBLIC, anon, authenticated;

-- event_rule_occurrences: rule dates -> instants. End = local start + duration (wall clock),
-- resolved with the same RFC rule; if a DST change makes that end not later than the start, the
-- end is start + duration (elapsed).
CREATE OR REPLACE FUNCTION public.event_rule_occurrences(
  p_rule jsonb, p_dtstart timestamp, p_duration interval, p_time_zone text, p_from date, p_through date)
  RETURNS TABLE(local_date date, local_start timestamp, local_end timestamp, starts_at timestamptz, ends_at timestamptz)
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE
  SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT d.local_date, d.local_start, d.local_start + p_duration, s.v,
         CASE WHEN e.v > s.v THEN e.v ELSE s.v + p_duration END
    FROM public.event_rule_dates(p_rule, p_dtstart, p_from, p_through) d
    CROSS JOIN LATERAL (SELECT public.event_local_to_utc_rfc(d.local_start, p_time_zone) AS v) s
    CROSS JOIN LATERAL (SELECT public.event_local_to_utc_rfc(d.local_start + p_duration, p_time_zone) AS v) e
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_rule_occurrences(jsonb, timestamp, interval, text, date, date) FROM PUBLIC, anon, authenticated;

-- event_date_announced: THE announce rule. A date is announced from 00:00 venue local time
-- p_days days before its local date (a local-date comparison: exact in DST-gap and
-- repeated-midnight zones). Used by event_feed_next (the rule ranked_feed_v2 and upcoming_events share).
CREATE OR REPLACE FUNCTION public.event_date_announced(p_now timestamptz, p_starts_at timestamptz,
                                                       p_time_zone text, p_days integer)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE
  SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT (p_now AT TIME ZONE p_time_zone)::date >= (p_starts_at AT TIME ZONE p_time_zone)::date - p_days
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_date_announced(timestamptz, timestamptz, text, integer) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2b. Tables (existing) — columns, constraints, indexes
-- ============================================================================

-- recurrence: the repeat rule (NULL = dates are added by hand only).
-- series_start_local: the first date's local start (date = first date + "every N weeks" anchor,
--   time = every date's start time). series_duration: wall-clock length of every rule date.
-- announce_days_before: each date is shown on the feed + Events tab from 00:00 venue local time
--   this many days before its local date.
-- geocode_accuracy / geocode_confidence: dropped (no reader; the pin is location).
ALTER TABLE public.assistance_events
  ADD COLUMN recurrence jsonb,
  ADD COLUMN series_start_local timestamp,
  ADD COLUMN series_duration interval,
  ADD COLUMN announce_days_before smallint NOT NULL DEFAULT 7,
  ADD CONSTRAINT assistance_events_recurrence_valid
    CHECK (public.event_recurrence_problem(recurrence, series_start_local) IS NULL),
  ADD CONSTRAINT assistance_events_series_complete
    CHECK ((recurrence IS NULL) = (series_start_local IS NULL)
       AND (recurrence IS NULL) = (series_duration IS NULL)),
  ADD CONSTRAINT assistance_events_series_duration_range
    CHECK (series_duration IS NULL OR (series_duration > interval '0' AND series_duration <= interval '24 hours')),
  ADD CONSTRAINT assistance_events_announce_days_before_preset
    CHECK (announce_days_before IN (0, 1, 3, 7, 14, 30)),
  DROP COLUMN geocode_accuracy,
  DROP COLUMN geocode_confidence;

-- source: 'rule' rows are written by the generator; 'manual' rows by create / add_event_dates.
-- series_local_date: the rule date a 'rule' row stands for (its identity; survives a time edit).
-- cancel_reason: who cancelled — 'admin' (never restored, never re-created), 'retired' and
--   'org_inactive' (restored when the event and its organization are active again),
--   'rule_changed' (a rule edit removed the date but it has check-ins, so the row is kept).
ALTER TABLE public.event_occurrences
  ADD COLUMN source text NOT NULL DEFAULT 'manual',
  ADD COLUMN series_local_date date,
  ADD COLUMN cancel_reason text,
  ADD CONSTRAINT event_occurrences_source_check CHECK (source IN ('rule', 'manual')),
  ADD CONSTRAINT event_occurrences_rule_has_date CHECK ((source = 'rule') = (series_local_date IS NOT NULL)),
  ADD CONSTRAINT event_occurrences_cancel_reason_check
    CHECK (cancel_reason IN ('admin', 'retired', 'org_inactive', 'rule_changed')),
  ADD CONSTRAINT event_occurrences_cancel_reason_only_when_cancelled
    CHECK (cancel_reason IS NULL OR status = 'cancelled');

-- One generated row per (event, rule date), whatever its start time.
CREATE UNIQUE INDEX event_occurrences_rule_date_key
  ON public.event_occurrences (event_id, series_local_date) WHERE source = 'rule';

-- The feed / Events-tab scan: not-ended upcoming dates (past dates stay 'upcoming' forever).
CREATE INDEX idx_event_occurrences_upcoming_ends_at
  ON public.event_occurrences (ends_at) WHERE status = 'upcoming';

-- ============================================================================
-- 3. Internal functions (INVOKER, not client-executable). They run as the owner when reached
--    from the SECURITY DEFINER RPCs / the organization trigger, and as the cron superuser.
-- ============================================================================

-- event_feed_next: THE visibility rule shared by ranked_feed_v2 and upcoming_events. One row per
-- active event of an active organization: its SOONEST date that is announced
-- (event_date_announced), not ended, and either 'upcoming' or cancelled for a reason other than
-- 'retired' / 'org_inactive' (an admin cancellation or a rule change: the event and org are still
-- active, so the cancelled date stays listed — as cancelled — until it ends, and nobody makes a
-- wasted trip). cancelled = the row is such a cancelled date (ranked_feed_v2 scores it on proximity
-- only). shown_since = the moment that date became the event's shown date = max(its announce instant, the end of the
-- previous date that was shown — upcoming, completed or cancelled-but-listed —, its creation): the
-- ranking's freshness anchor. starts_at <= now + 32 days only lets the scan stop early (implied
-- by the announce rule: lead <= 30 days, + 1 local day + offset slack).
CREATE OR REPLACE FUNCTION public.event_feed_next(p_now timestamptz)
  RETURNS TABLE(event_id uuid, occurrence_id uuid, starts_at timestamptz, ends_at timestamptz,
                cancelled boolean, shown_since timestamptz)
  LANGUAGE sql
  STABLE
  SET search_path = public, pg_temp
AS $fn$
  SELECT n.event_id, n.id, n.starts_at, n.ends_at, n.cancelled,
         GREATEST(n.announced_at, n.created_at, prev.ends_at)
    FROM (
      SELECT DISTINCT ON (eo.event_id)
             eo.event_id, eo.id, eo.starts_at, eo.ends_at, eo.created_at,
             (eo.status = 'cancelled') AS cancelled,
             ((((eo.starts_at AT TIME ZONE ae.time_zone)::date - ae.announce_days_before)::timestamp)
               AT TIME ZONE ae.time_zone) AS announced_at
        FROM public.event_occurrences eo
        JOIN public.assistance_events ae ON ae.id = eo.event_id
        JOIN public.organizations org    ON org.id = ae.org_id
       WHERE (eo.status = 'upcoming'
              OR (eo.status = 'cancelled'
                  AND eo.cancel_reason IS DISTINCT FROM 'retired'
                  AND eo.cancel_reason IS DISTINCT FROM 'org_inactive'))
         AND eo.ends_at >= p_now
         AND eo.starts_at <= p_now + interval '32 days'
         AND ae.is_active
         AND org.is_active
         AND public.event_date_announced(p_now, eo.starts_at, ae.time_zone, ae.announce_days_before)
       ORDER BY eo.event_id, eo.starts_at, eo.id
    ) n
    LEFT JOIN LATERAL (
      SELECT p.ends_at
        FROM public.event_occurrences p
       WHERE p.event_id = n.event_id AND p.starts_at < n.starts_at
         AND (p.status <> 'cancelled'
              OR (p.cancel_reason IS DISTINCT FROM 'retired' AND p.cancel_reason IS DISTINCT FROM 'org_inactive'))
       ORDER BY p.starts_at DESC
       LIMIT 1
    ) prev ON true
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_feed_next(timestamptz) FROM PUBLIC, anon, authenticated;

-- event_generate_occurrences: INSERT-ONLY generator for ONE repeating event. Locks the event and
-- its organization (FOR SHARE; the nightly job passes p_skip_locked and skips an event a writer
-- is editing — that writer regenerates it) and reads the rule from the LOCKED row, so a run never
-- writes dates of a rule that a concurrent edit has replaced; the INSERT runs in a new statement
-- snapshot after the lock. Inserts the rule's dates from the venue's today (never before the first
-- date) through today + 180 days, within until/count, skipping dates already ended.
-- ON CONFLICT DO NOTHING (no target = every unique index): a date that already has a row —
-- upcoming, cancelled for any reason, or a manual row at the same start — is never written again.
-- Does nothing for a retired event or an inactive organization. Never UPDATEs or DELETEs (it also
-- runs with no session, where the occurrence guard triggers let every write through).
-- Returns the rows inserted; NULL when skipped because the event was locked.
CREATE OR REPLACE FUNCTION public.event_generate_occurrences(p_event_id uuid, p_skip_locked boolean DEFAULT false)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_horizon_days constant integer := 180;
  v_ev    record;
  v_today date;
  v_n     integer;
BEGIN
  IF p_skip_locked THEN
    SELECT ae.id, ae.recurrence, ae.series_start_local, ae.series_duration, ae.time_zone,
           ae.default_capacity, ae.is_active, org.is_active AS org_active
      INTO v_ev
      FROM public.assistance_events ae
      JOIN public.organizations org ON org.id = ae.org_id
     WHERE ae.id = p_event_id
       FOR SHARE OF ae, org SKIP LOCKED;
    IF NOT FOUND THEN RETURN NULL; END IF;
  ELSE
    SELECT ae.id, ae.recurrence, ae.series_start_local, ae.series_duration, ae.time_zone,
           ae.default_capacity, ae.is_active, org.is_active AS org_active
      INTO v_ev
      FROM public.assistance_events ae
      JOIN public.organizations org ON org.id = ae.org_id
     WHERE ae.id = p_event_id
       FOR SHARE OF ae, org;
    IF NOT FOUND THEN RETURN 0; END IF;
  END IF;
  IF v_ev.recurrence IS NULL OR NOT v_ev.is_active OR NOT v_ev.org_active THEN
    RETURN 0;
  END IF;
  v_today := (now() AT TIME ZONE v_ev.time_zone)::date;
  INSERT INTO public.event_occurrences (event_id, starts_at, ends_at, capacity, source, series_local_date)
  SELECT v_ev.id, x.starts_at, x.ends_at, v_ev.default_capacity, 'rule', x.local_date
    FROM public.event_rule_occurrences(v_ev.recurrence, v_ev.series_start_local, v_ev.series_duration,
                                       v_ev.time_zone, v_today, v_today + c_horizon_days) x
   WHERE x.ends_at > now()
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_generate_occurrences(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- event_adopt_manual_dates: a hand-added ('manual') FUTURE date that sits exactly on one of the
-- event's repeat dates (same start instant; that rule date has no row yet) becomes that date's rule
-- row: source 'rule' + series_local_date, keeping its id, status and check-ins. Without it a
-- converted one-off's first date (or a date added ahead of the 180-day horizon) stays 'manual',
-- blocks the generator through UNIQUE (event_id, starts_at), and a later time edit leaves it at the
-- old time beside a new rule row. Changes identity columns only (never times or status). Called by
-- event_apply_rule_change (every rule / first date / time edit, incl. one-off -> repeating) and by
-- add_event_dates. Returns the rows adopted.
CREATE OR REPLACE FUNCTION public.event_adopt_manual_dates(p_event_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_n integer;
BEGIN
  WITH ev AS (
    SELECT ae.recurrence, ae.series_start_local, ae.series_duration, ae.time_zone
      FROM public.assistance_events ae
     WHERE ae.id = p_event_id AND ae.recurrence IS NOT NULL
  ), cand AS (
    -- the rule dates of the row's local day (and the day before: a DST shift can cross midnight)
    SELECT DISTINCT ON (x.local_date) eo.id, x.local_date
      FROM public.event_occurrences eo
      CROSS JOIN ev
      CROSS JOIN LATERAL public.event_rule_occurrences(
             ev.recurrence, ev.series_start_local, ev.series_duration, ev.time_zone,
             (eo.starts_at AT TIME ZONE ev.time_zone)::date - 1, (eo.starts_at AT TIME ZONE ev.time_zone)::date) x
     WHERE eo.event_id = p_event_id
       AND eo.source = 'manual'
       AND eo.starts_at > now()
       AND x.starts_at = eo.starts_at
       AND NOT EXISTS (SELECT 1 FROM public.event_occurrences r
                        WHERE r.event_id = p_event_id AND r.source = 'rule' AND r.series_local_date = x.local_date)
     ORDER BY x.local_date, eo.id
  )
  UPDATE public.event_occurrences eo
     SET source = 'rule', series_local_date = cand.local_date
    FROM cand
   WHERE eo.id = cand.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_adopt_manual_dates(uuid) FROM PUBLIC, anon, authenticated;

-- event_apply_rule_change: after a rule / first date / time edit (admin_update_event,
-- extend_event_series; the caller holds the event row FOR UPDATE and runs in the admin's session,
-- so the occurrence guard triggers stay live as a second line). Touches only FUTURE 'rule' rows
-- that are upcoming or cancelled for 'retired' / 'org_inactive'. Manual rows and rows cancelled
-- for 'admin' / 'rule_changed' are never touched. First, hand-added dates sitting exactly on a
-- rule date become rule rows (event_adopt_manual_dates); then three single statements, then the generator:
--   1. no check-ins, and the date left the rule (or a manual row holds its new start) -> deleted
--   2. no check-ins, date still in the rule, time changed                            -> moved (same id)
--   3. check-ins, upcoming, date left the rule                 -> cancelled, cancel_reason 'rule_changed'
--   (check-ins, date still in the rule, time changed -> kept at its time; reported as kept)
CREATE OR REPLACE FUNCTION public.event_apply_rule_change(p_event_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_horizon_days constant integer := 180;
  v_ev      record;
  v_today   date;
  v_through date;
  v_moved   integer := 0;
  v_deleted integer := 0;
  v_cxl     integer := 0;
  v_kept    integer := 0;
  v_adopted integer;
  v_gen     integer;
BEGIN
  SELECT ae.id, ae.recurrence, ae.series_start_local, ae.series_duration, ae.time_zone
    INTO v_ev FROM public.assistance_events ae WHERE ae.id = p_event_id FOR UPDATE;
  v_today := (now() AT TIME ZONE v_ev.time_zone)::date;
  v_adopted := public.event_adopt_manual_dates(p_event_id);
  -- The rule's dates through the horizon, or through the furthest rule row (a hand-added date
  -- adopted ahead of the horizon), whichever is later: every existing rule row is reconciled.
  v_through := GREATEST(v_today + c_horizon_days,
                        (SELECT max(eo.series_local_date) FROM public.event_occurrences eo
                          WHERE eo.event_id = p_event_id AND eo.source = 'rule' AND eo.starts_at > now()));

  -- 1. remove
  WITH n AS MATERIALIZED (
    SELECT x.local_date, x.starts_at
      FROM public.event_rule_occurrences(v_ev.recurrence, v_ev.series_start_local, v_ev.series_duration,
                                         v_ev.time_zone, v_today, v_through) x
     WHERE v_ev.recurrence IS NOT NULL
  )
  DELETE FROM public.event_occurrences eo
   WHERE eo.event_id = p_event_id
     AND eo.source = 'rule'
     AND eo.starts_at > now()
     AND (eo.status = 'upcoming' OR eo.cancel_reason IN ('retired', 'org_inactive'))
     AND NOT EXISTS (SELECT 1 FROM public.event_checkins c WHERE c.occurrence_id = eo.id)
     AND NOT EXISTS (SELECT 1 FROM public.event_anonymous_claims a WHERE a.occurrence_id = eo.id)
     AND NOT EXISTS (
       SELECT 1 FROM n
        WHERE n.local_date = eo.series_local_date
          AND (n.starts_at = eo.starts_at
               OR NOT EXISTS (SELECT 1 FROM public.event_occurrences m
                               WHERE m.event_id = p_event_id AND m.starts_at = n.starts_at AND m.id <> eo.id)));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- 2. move (same id)
  WITH n AS MATERIALIZED (
    SELECT x.local_date, x.starts_at, x.ends_at
      FROM public.event_rule_occurrences(v_ev.recurrence, v_ev.series_start_local, v_ev.series_duration,
                                         v_ev.time_zone, v_today, v_through) x
     WHERE v_ev.recurrence IS NOT NULL
  )
  UPDATE public.event_occurrences eo
     SET starts_at = n.starts_at, ends_at = n.ends_at
    FROM n
   WHERE eo.event_id = p_event_id
     AND eo.source = 'rule'
     AND eo.starts_at > now()
     AND (eo.status = 'upcoming' OR eo.cancel_reason IN ('retired', 'org_inactive'))
     AND n.local_date = eo.series_local_date
     AND (eo.starts_at, eo.ends_at) IS DISTINCT FROM (n.starts_at, n.ends_at)
     AND NOT EXISTS (SELECT 1 FROM public.event_checkins c WHERE c.occurrence_id = eo.id)
     AND NOT EXISTS (SELECT 1 FROM public.event_anonymous_claims a WHERE a.occurrence_id = eo.id);
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  -- 3. keep + cancel the dates with check-ins that left the rule
  WITH n AS MATERIALIZED (
    SELECT x.local_date
      FROM public.event_rule_occurrences(v_ev.recurrence, v_ev.series_start_local, v_ev.series_duration,
                                         v_ev.time_zone, v_today, v_through) x
     WHERE v_ev.recurrence IS NOT NULL
  )
  UPDATE public.event_occurrences eo
     SET status = 'cancelled', cancel_reason = 'rule_changed'
   WHERE eo.event_id = p_event_id
     AND eo.source = 'rule'
     AND eo.starts_at > now()
     AND eo.status = 'upcoming'
     AND (EXISTS (SELECT 1 FROM public.event_checkins c WHERE c.occurrence_id = eo.id)
          OR EXISTS (SELECT 1 FROM public.event_anonymous_claims a WHERE a.occurrence_id = eo.id))
     AND NOT EXISTS (SELECT 1 FROM n WHERE n.local_date = eo.series_local_date);
  GET DIAGNOSTICS v_cxl = ROW_COUNT;

  WITH n AS MATERIALIZED (
    SELECT x.local_date, x.starts_at, x.ends_at
      FROM public.event_rule_occurrences(v_ev.recurrence, v_ev.series_start_local, v_ev.series_duration,
                                         v_ev.time_zone, v_today, v_through) x
     WHERE v_ev.recurrence IS NOT NULL
  )
  SELECT count(*) INTO v_kept
    FROM public.event_occurrences eo
    JOIN n ON n.local_date = eo.series_local_date
   WHERE eo.event_id = p_event_id AND eo.source = 'rule' AND eo.starts_at > now() AND eo.status = 'upcoming'
     AND (eo.starts_at, eo.ends_at) IS DISTINCT FROM (n.starts_at, n.ends_at);

  v_gen := public.event_generate_occurrences(p_event_id);
  RETURN jsonb_build_object('adopted', v_adopted, 'moved', v_moved, 'deleted', v_deleted, 'cancelled_rule_changed', v_cxl,
                            'kept_with_checkins', v_kept, 'generated', v_gen);
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_apply_rule_change(uuid) FROM PUBLIC, anon, authenticated;

-- event_restore_system_cancelled: once the event AND its organization are both active, restore
-- exactly the FUTURE dates cancelled for 'retired' / 'org_inactive' that have no check-ins (a date
-- with check-ins stays cancelled: w1_6a K1), then fill rule dates the pause skipped.
-- Returns the number of dates restored.
CREATE OR REPLACE FUNCTION public.event_restore_system_cancelled(p_event_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.event_occurrences eo
     SET status = 'upcoming', cancel_reason = NULL
    FROM public.assistance_events ae
    JOIN public.organizations org ON org.id = ae.org_id
   WHERE eo.event_id = p_event_id AND ae.id = eo.event_id
     AND ae.is_active AND org.is_active
     AND eo.status = 'cancelled' AND eo.cancel_reason IN ('retired', 'org_inactive')
     AND eo.starts_at > now()
     AND NOT EXISTS (SELECT 1 FROM public.event_checkins c WHERE c.occurrence_id = eo.id)
     AND NOT EXISTS (SELECT 1 FROM public.event_anonymous_claims a WHERE a.occurrence_id = eo.id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM public.event_generate_occurrences(p_event_id);
  RETURN v_n;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_restore_system_cancelled(uuid) FROM PUBLIC, anon, authenticated;

-- events_generate_nightly: the pg_cron job (37 3 * * *). One run at a time: a concurrent run
-- returns {"skipped": true} and writes one 'warn' events.generate.skipped row. Otherwise each
-- repeating event of an active organization is topped up in its own subtransaction (a failure is
-- counted by SQLSTATE and the run continues) and the run writes exactly ONE app_logs row:
-- 'events.generate.nightly', level 'info' (or 'error' when any event failed), with the counts in
-- context and the run time in duration_ms.
CREATE OR REPLACE FUNCTION public.events_generate_nightly()
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_t0       timestamptz := clock_timestamp();
  v_id       uuid;
  v_n        integer;
  v_state    text;
  v_scanned  integer := 0;
  v_ok       integer := 0;
  v_failed   integer := 0;
  v_skipped  integer := 0;
  v_inserted integer := 0;
  v_types    jsonb := '{}'::jsonb;
  v_ids      jsonb := '[]'::jsonb;
  v_ctx      jsonb;
  v_ms       integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('feed.events_generate_nightly')) THEN
    INSERT INTO public.app_logs (level, event, context)
    VALUES ('warn', 'events.generate.skipped', jsonb_build_object('reason', 'another run holds the lock'));
    RETURN jsonb_build_object('skipped', true);
  END IF;
  FOR v_id IN
    SELECT ae.id
      FROM public.assistance_events ae
      JOIN public.organizations org ON org.id = ae.org_id
     WHERE ae.recurrence IS NOT NULL AND ae.is_active AND org.is_active
     ORDER BY ae.id
  LOOP
    v_scanned := v_scanned + 1;
    BEGIN
      v_n := public.event_generate_occurrences(v_id, true);
      IF v_n IS NULL THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_ok := v_ok + 1;
        v_inserted := v_inserted + v_n;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_state  := SQLSTATE;
      v_failed := v_failed + 1;
      v_types  := v_types || jsonb_build_object(v_state, COALESCE((v_types->>v_state)::integer, 0) + 1);
      v_ids    := v_ids || to_jsonb(v_id);
    END;
  END LOOP;
  v_ms  := (extract(epoch FROM clock_timestamp() - v_t0) * 1000)::integer;
  v_ctx := jsonb_build_object('events_scanned', v_scanned, 'events_ok', v_ok, 'events_failed', v_failed,
                              'events_skipped_locked', v_skipped, 'inserted', v_inserted, 'horizon_days', 180,
                              'failures_by_type', v_types, 'failed_event_ids', v_ids);
  INSERT INTO public.app_logs (level, event, context, duration_ms)
  VALUES (CASE WHEN v_failed > 0 THEN 'error' ELSE 'info' END, 'events.generate.nightly', v_ctx, v_ms);
  RETURN v_ctx || jsonb_build_object('duration_ms', v_ms);
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.events_generate_nightly() FROM PUBLIC, anon, authenticated;

-- events_generate_watchdog: the pg_cron job (37 15 * * *). Writes exactly one 'error'
-- events.generate.watchdog row when no successful ('info') events.generate.nightly row exists in
-- the last 26 hours, and nothing otherwise. Returns whether it alerted.
CREATE OR REPLACE FUNCTION public.events_generate_watchdog()
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_logs l
              WHERE l.event = 'events.generate.nightly' AND l.level = 'info'
                AND l.created_at > now() - interval '26 hours') THEN
    RETURN false;
  END IF;
  INSERT INTO public.app_logs (level, event, context)
  VALUES ('error', 'events.generate.watchdog',
          jsonb_build_object('reason', 'no successful events.generate.nightly run in the last 26 hours',
                             'last_success', (SELECT max(l.created_at) FROM public.app_logs l
                                               WHERE l.event = 'events.generate.nightly' AND l.level = 'info')));
  RETURN true;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.events_generate_watchdog() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3b. Event writers (SECDEF RPCs) — copied from 20261020000000 and changed only where noted
-- ============================================================================

-- create_org_event: + p_recurrence (NULL = one date, as before) and p_announce_days_before
-- (default 7). Repeating: the first date is p_starts_local / p_ends_local; all rule dates within
-- 180 days are written in this transaction. The old 18-argument signature is DROPPED first, so
-- PostgREST never sees two overloads.
DROP FUNCTION public.create_org_event(uuid, uuid, text, text, timestamp, timestamp, text, text, text, text, text, text, text, text, double precision, double precision, integer, boolean);

CREATE OR REPLACE FUNCTION public.create_org_event(
  p_org_id uuid,
  p_idempotency_key uuid,
  p_title text,
  p_time_zone text,
  p_starts_local timestamp,
  p_ends_local timestamp,
  p_location_source text,
  p_event_type text DEFAULT 'distribution',
  p_description text DEFAULT NULL,
  p_location_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_default_capacity integer DEFAULT NULL,
  p_requires_registration boolean DEFAULT false,
  p_recurrence jsonb DEFAULT NULL,
  p_announce_days_before integer DEFAULT 7)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_id       uuid;
  v_occ      uuid;
  v_starts   timestamptz;
  v_ends     timestamptz;
  v_loc      geography;
  v_loc_name text;
  v_address  text;
  v_city     text;
  v_state    text;
  v_zip      text;
  v_problem  text;
  v_today    date;
  v_gen      integer;
BEGIN
  v_role := public.org_event_write_gate(p_org_id);

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'event_invalid: an idempotency key is required' USING ERRCODE = '22023';
  END IF;
  SELECT ae.id INTO v_id FROM public.assistance_events ae
   WHERE ae.org_id = p_org_id AND ae.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'event_invalid: a title is required' USING ERRCODE = '22023';
  END IF;
  IF p_time_zone IS NULL
     OR p_time_zone !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_time_zone) THEN
    RAISE EXCEPTION 'event_invalid: % is not an IANA time zone such as America/New_York',
      COALESCE(p_time_zone, '<missing>') USING ERRCODE = '22023';
  END IF;
  v_starts := public.event_local_to_utc(p_starts_local, p_time_zone);
  v_ends   := public.event_local_to_utc(p_ends_local, p_time_zone);
  IF v_ends <= v_starts THEN
    RAISE EXCEPTION 'event_invalid: the end time must be after the start time' USING ERRCODE = '22023';
  END IF;
  IF p_announce_days_before IS NULL OR p_announce_days_before NOT IN (0, 1, 3, 7, 14, 30) THEN
    RAISE EXCEPTION 'event_invalid: post to the feed 0, 1, 3, 7, 14 or 30 days before each date' USING ERRCODE = '22023';
  END IF;
  IF p_recurrence IS NOT NULL THEN
    -- Repeating: p_starts_local / p_ends_local are the FIRST date (its time of day and length
    -- apply to every date). The first date must be one of the rule's dates (validator).
    IF p_ends_local - p_starts_local > interval '24 hours' THEN
      RAISE EXCEPTION 'event_recurrence_invalid: a repeating event lasts at most 24 hours per date' USING ERRCODE = '22023';
    END IF;
    v_problem := public.event_recurrence_problem(p_recurrence, p_starts_local);
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION 'event_recurrence_invalid: %', v_problem USING ERRCODE = '22023';
    END IF;
    -- Consecutive rule dates are at most 62 days apart: no date in this window = none to come.
    v_today := (now() AT TIME ZONE p_time_zone)::date;
    IF NOT EXISTS (SELECT 1 FROM public.event_rule_occurrences(p_recurrence, p_starts_local,
                                   p_ends_local - p_starts_local, p_time_zone,
                                   v_today, GREATEST(v_today, p_starts_local::date) + 62) x
                    WHERE x.ends_at > now()) THEN
      RAISE EXCEPTION 'event_recurrence_invalid: the repeat gives no upcoming dates' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_location_source = 'org' THEN
    SELECT o.location, o.address, o.city, o.state, o.zip_code, o.name
      INTO v_loc, v_address, v_city, v_state, v_zip, v_loc_name
      FROM public.organizations o WHERE o.id = p_org_id;
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: this organization has no map pin; enter the event address instead'
        USING ERRCODE = '22023';
    END IF;
    v_loc_name := COALESCE(NULLIF(btrim(p_location_name), ''), v_loc_name);
  ELSIF p_location_source = 'address' THEN
    IF NULLIF(btrim(p_address), '') IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: a street address is required' USING ERRCODE = '22023';
    END IF;
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: confirm the address on the map first' USING ERRCODE = '22023';
    END IF;
    PERFORM public.w1_6a_validate_geo(p_lat, p_lng, NULL);
    v_loc      := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    v_loc_name := NULLIF(btrim(p_location_name), '');
    v_address  := btrim(p_address);
    v_city     := NULLIF(btrim(p_city), '');
    v_state    := NULLIF(btrim(p_state), '');
    v_zip      := NULLIF(btrim(p_zip_code), '');
  ELSE
    RAISE EXCEPTION 'event_location_invalid: location source must be org or address, got %',
      COALESCE(p_location_source, '<missing>') USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.assistance_events
    (org_id, idempotency_key, title, event_type, description, location_name,
     address, city, state, zip_code, location,
     time_zone, default_capacity, requires_registration, created_by,
     recurrence, series_start_local, series_duration, announce_days_before)
  VALUES
    (p_org_id, p_idempotency_key, btrim(p_title), COALESCE(p_event_type, 'distribution'),
     NULLIF(btrim(p_description), ''), v_loc_name,
     v_address, v_city, v_state, v_zip, v_loc,
     p_time_zone, p_default_capacity, COALESCE(p_requires_registration, false), v_uid,
     p_recurrence, CASE WHEN p_recurrence IS NOT NULL THEN p_starts_local END,
     CASE WHEN p_recurrence IS NOT NULL THEN p_ends_local - p_starts_local END, p_announce_days_before)
  ON CONFLICT (org_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- A concurrent call with the same key committed first: return its event, write nothing.
    SELECT ae.id INTO v_id FROM public.assistance_events ae
     WHERE ae.org_id = p_org_id AND ae.idempotency_key = p_idempotency_key;
    RETURN v_id;
  END IF;

  IF p_recurrence IS NULL THEN
    INSERT INTO public.event_occurrences (event_id, starts_at, ends_at, capacity)
    VALUES (v_id, v_starts, v_ends, p_default_capacity)
    RETURNING id INTO v_occ;
  ELSE
    -- Repeating: every rule date from the venue's today through today + 180 days, now. (None yet
    -- for an inactive organization or a first date beyond 180 days: the organization's
    -- reactivation / the nightly job creates them.)
    v_gen := public.event_generate_occurrences(v_id);
    SELECT eo.id INTO v_occ FROM public.event_occurrences eo
     WHERE eo.event_id = v_id ORDER BY eo.starts_at LIMIT 1;
  END IF;

  PERFORM public.record_admin_action(
    v_uid, 'event.create', 'event', v_id::text, 'ok', NULL,
    jsonb_build_object('org_id', p_org_id, 'occurrence_id', v_occ, 'time_zone', p_time_zone,
                       'starts_at', v_starts, 'ends_at', v_ends,
                       'location_source', p_location_source, 'actor_role', v_role,
                       'recurrence', p_recurrence, 'announce_days_before', p_announce_days_before,
                       'generated', v_gen),
    public.request_id());

  RETURN v_id;
END
$fn$;
REVOKE ALL ON FUNCTION public.create_org_event(uuid, uuid, text, text, timestamp, timestamp, text, text, text, text, text, text, text, text, double precision, double precision, integer, boolean, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_org_event(uuid, uuid, text, text, timestamp, timestamp, text, text, text, text, text, text, text, text, double precision, double precision, integer, boolean, jsonb, integer) TO authenticated;

-- add_event_dates: at most 366 dates per call; rescheduling a cancelled date (any reason without
-- check-ins, e.g. one date of a series cancelled by an admin) clears its cancel_reason; a new date
-- exactly on one of the event's repeat dates becomes that date's rule row (event_adopt_manual_dates).
CREATE OR REPLACE FUNCTION public.add_event_dates(
  p_event_id uuid,
  p_starts_local timestamp[],
  p_ends_local timestamp[])
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_role   text;
  v_tz     text;
  v_active boolean;
  v_cap    integer;
  v_starts timestamptz[] := '{}';
  v_ends   timestamptz[] := '{}';
  v_s      timestamptz;
  v_e      timestamptz;
  v_n      integer;
  v_added  integer;
  v_restored integer;
  v_restored_ids uuid[];
  v_adopted integer;
BEGIN
  SELECT ae.org_id INTO v_org FROM public.assistance_events ae WHERE ae.id = p_event_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'event_not_found: %', p_event_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);

  SELECT ae.time_zone, ae.is_active, ae.default_capacity INTO v_tz, v_active, v_cap
    FROM public.assistance_events ae WHERE ae.id = p_event_id FOR UPDATE;
  IF v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'event_retired: this event is retired; reactivate it before adding dates'
      USING ERRCODE = 'P0001';
  END IF;

  v_n := cardinality(p_starts_local);
  IF v_n IS NULL OR v_n = 0 OR v_n IS DISTINCT FROM cardinality(p_ends_local) THEN
    RAISE EXCEPTION 'event_invalid: give at least one date, with one end time for every start time'
      USING ERRCODE = '22023';
  END IF;
  IF v_n > 366 THEN
    RAISE EXCEPTION 'event_invalid: add at most 366 dates at a time' USING ERRCODE = '22023';
  END IF;
  FOR i IN 1 .. v_n LOOP
    v_s := public.event_local_to_utc(p_starts_local[i], v_tz);
    v_e := public.event_local_to_utc(p_ends_local[i], v_tz);
    IF v_e <= v_s THEN
      RAISE EXCEPTION 'event_invalid: the end time must be after the start time (%)',
        to_char(p_starts_local[i], 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
    END IF;
    -- A cancelled date that already has check-ins stays cancelled (w1_6a K1). Refuse here, naming
    -- the date, before the occurrence guard would refuse it without one.
    IF EXISTS (SELECT 1 FROM public.event_occurrences eo
                WHERE eo.event_id = p_event_id AND eo.starts_at = v_s AND eo.status = 'cancelled'
                  AND (EXISTS (SELECT 1 FROM public.event_checkins c WHERE c.occurrence_id = eo.id)
                       OR EXISTS (SELECT 1 FROM public.event_anonymous_claims a WHERE a.occurrence_id = eo.id))) THEN
      RAISE EXCEPTION 'This event has check-ins and cannot be reopened once cancelled or completed. (%)',
        to_char(p_starts_local[i], 'YYYY-MM-DD HH24:MI') USING ERRCODE = 'P0001';
    END IF;
    v_starts := v_starts || v_s;
    v_ends   := v_ends || v_e;
  END LOOP;

  -- xmax = 0 marks a freshly inserted row; a row returned by DO UPDATE is a restored date.
  WITH dates AS (
    SELECT DISTINCT ON (d.s) d.s, d.e
      FROM unnest(v_starts, v_ends) WITH ORDINALITY AS d(s, e, ord)
     ORDER BY d.s, d.ord
  ), written AS (
    INSERT INTO public.event_occurrences AS eo (event_id, starts_at, ends_at, capacity)
    SELECT p_event_id, dates.s, dates.e, v_cap FROM dates
    ON CONFLICT (event_id, starts_at) DO UPDATE
      SET status = 'upcoming', ends_at = EXCLUDED.ends_at, cancel_reason = NULL
      WHERE eo.status = 'cancelled'
    RETURNING eo.id, (eo.xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE w.inserted),
         count(*) FILTER (WHERE NOT w.inserted),
         COALESCE(array_agg(w.id ORDER BY w.id) FILTER (WHERE NOT w.inserted), '{}')
    INTO v_added, v_restored, v_restored_ids
    FROM written w;
  -- A date that sits exactly on one of the event's repeat dates becomes that date's rule row.
  v_adopted := public.event_adopt_manual_dates(p_event_id);

  PERFORM public.record_admin_action(
    v_uid, 'event.add_dates', 'event', p_event_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'requested', v_n, 'added', v_added, 'restored', v_restored,
                       'restored_ids', to_jsonb(v_restored_ids), 'time_zone', v_tz, 'actor_role', v_role,
                       'became_rule_dates', v_adopted),
    public.request_id());

  RETURN v_added + v_restored;
END
$fn$;
REVOKE ALL ON FUNCTION public.add_event_dates(uuid, timestamp[], timestamp[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_dates(uuid, timestamp[], timestamp[]) TO authenticated;

-- cancel_event_occurrence: cancel_reason 'admin' — never restored by a reactivation and never
-- re-created by the generator (add_event_dates can reschedule it).
CREATE OR REPLACE FUNCTION public.cancel_event_occurrence(p_occurrence_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_event  uuid;
  v_status text;
  v_role   text;
BEGIN
  SELECT ae.org_id, eo.event_id INTO v_org, v_event
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
   WHERE eo.id = p_occurrence_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'occurrence_not_found: %', p_occurrence_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);

  SELECT eo.status INTO v_status FROM public.event_occurrences eo
   WHERE eo.id = p_occurrence_id FOR UPDATE;
  UPDATE public.event_occurrences SET status = 'cancelled', cancel_reason = 'admin' WHERE id = p_occurrence_id;

  PERFORM public.record_admin_action(
    v_uid, 'occurrence.cancel', 'event_occurrence', p_occurrence_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'event_id', v_event, 'was_status', v_status,
                       'actor_role', v_role),
    public.request_id());
END
$fn$;
REVOKE ALL ON FUNCTION public.cancel_event_occurrence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event_occurrence(uuid) TO authenticated;

-- admin_update_event: + p_recurrence / p_series_starts_local / p_series_ends_local /
-- p_announce_days_before (NULL keeps); 'recurrence' in p_clear stops repeating and keeps the next
-- upcoming date as a one-off. A rule, first
-- date or time change reconciles the future rule dates (event_apply_rule_change); retiring
-- cancels with reason 'retired'; reactivating restores system-cancelled dates. The geocode
-- columns are no longer written (dropped). Old 16-argument signature DROPPED first.
DROP FUNCTION public.admin_update_event(uuid, text, text, text, text, text, text, text, text, integer, boolean, text, double precision, double precision, boolean, text[]);

CREATE OR REPLACE FUNCTION public.admin_update_event(
  p_event_id uuid,
  p_title text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_location_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_default_capacity integer DEFAULT NULL,
  p_requires_registration boolean DEFAULT NULL,
  p_location_source text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_clear text[] DEFAULT '{}'::text[],
  p_recurrence jsonb DEFAULT NULL,
  p_series_starts_local timestamp DEFAULT NULL,
  p_series_ends_local timestamp DEFAULT NULL,
  p_announce_days_before integer DEFAULT NULL)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_ev         record;
  v_clear      text[] := COALESCE(p_clear, '{}'::text[]);
  v_clear_addr boolean;
  v_set_loc    boolean := false;
  v_loc        geography;
  v_address    text;
  v_city       text;
  v_state      text;
  v_zip        text;
  v_org_name   text;
  v_role       text;
  v_cancelled  integer := 0;
  v_problem    text;
  v_rule       jsonb;
  v_start      timestamp;
  v_dur        interval;
  v_s          timestamptz;
  v_e          timestamptz;
  v_rule_edit  boolean;
  v_reconcile  jsonb;
  v_restored   integer := 0;
  v_kept_id    uuid;
BEGIN
  SELECT ae.org_id INTO v_org FROM public.assistance_events ae WHERE ae.id = p_event_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'event_not_found: %', p_event_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);

  SELECT * INTO v_ev FROM public.assistance_events ae WHERE ae.id = p_event_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM unnest(v_clear) c(f)
             WHERE c.f IS NULL OR c.f NOT IN ('description', 'location_name', 'address', 'city', 'state', 'zip_code', 'recurrence')) THEN
    RAISE EXCEPTION 'event_invalid: p_clear accepts description, location_name, address, city, state, zip_code, recurrence'
      USING ERRCODE = '22023';
  END IF;
  v_clear_addr := 'address' = ANY (v_clear);

  -- Repeat rule / first date / announce lead. NULL keeps the stored value; 'recurrence' in
  -- p_clear stops repeating. The first date's times are hand-entered (gap / repeat refused).
  IF p_announce_days_before IS NOT NULL AND p_announce_days_before NOT IN (0, 1, 3, 7, 14, 30) THEN
    RAISE EXCEPTION 'event_invalid: post to the feed 0, 1, 3, 7, 14 or 30 days before each date' USING ERRCODE = '22023';
  END IF;
  IF 'recurrence' = ANY (v_clear)
     AND (p_recurrence IS NOT NULL OR p_series_starts_local IS NOT NULL OR p_series_ends_local IS NOT NULL) THEN
    RAISE EXCEPTION 'event_recurrence_invalid: a repeat rule cannot be cleared and set in the same save' USING ERRCODE = '22023';
  END IF;
  IF (p_series_starts_local IS NULL) <> (p_series_ends_local IS NULL) THEN
    RAISE EXCEPTION 'event_recurrence_invalid: give both the start and the end time of the first date' USING ERRCODE = '22023';
  END IF;
  v_rule := CASE WHEN 'recurrence' = ANY (v_clear) THEN NULL ELSE COALESCE(p_recurrence, v_ev.recurrence) END;
  IF v_rule IS NULL AND p_series_starts_local IS NOT NULL THEN
    RAISE EXCEPTION 'event_recurrence_invalid: a first date and time apply to a repeating event only' USING ERRCODE = '22023';
  END IF;
  IF p_series_starts_local IS NOT NULL THEN
    v_s := public.event_local_to_utc(p_series_starts_local, v_ev.time_zone);
    v_e := public.event_local_to_utc(p_series_ends_local, v_ev.time_zone);
    IF v_e <= v_s THEN
      RAISE EXCEPTION 'event_invalid: the end time must be after the start time' USING ERRCODE = '22023';
    END IF;
    IF p_series_ends_local - p_series_starts_local > interval '24 hours' THEN
      RAISE EXCEPTION 'event_recurrence_invalid: a repeating event lasts at most 24 hours per date' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_start := CASE WHEN v_rule IS NULL THEN NULL ELSE COALESCE(p_series_starts_local, v_ev.series_start_local) END;
  v_dur   := CASE WHEN v_rule IS NULL THEN NULL
                  WHEN p_series_starts_local IS NOT NULL THEN p_series_ends_local - p_series_starts_local
                  ELSE v_ev.series_duration END;
  IF v_rule IS NOT NULL AND v_start IS NULL THEN
    RAISE EXCEPTION 'event_recurrence_invalid: a new repeat rule needs the start and end time of its first date' USING ERRCODE = '22023';
  END IF;
  v_problem := public.event_recurrence_problem(v_rule, v_start);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'event_recurrence_invalid: %', v_problem USING ERRCODE = '22023';
  END IF;
  v_rule_edit := (v_rule, v_start, v_dur) IS DISTINCT FROM (v_ev.recurrence, v_ev.series_start_local, v_ev.series_duration);

  IF p_location_source IS NOT NULL AND v_clear_addr THEN
    RAISE EXCEPTION 'event_location_invalid: an address cannot be cleared and set in the same save'
      USING ERRCODE = '22023';
  END IF;

  IF p_location_source = 'org' THEN
    SELECT o.location, o.address, o.city, o.state, o.zip_code, o.name
      INTO v_loc, v_address, v_city, v_state, v_zip, v_org_name
      FROM public.organizations o WHERE o.id = v_org;
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: this organization has no map pin; enter the event address instead'
        USING ERRCODE = '22023';
    END IF;
    v_set_loc := true;
  ELSIF p_location_source = 'address' THEN
    v_address := COALESCE(NULLIF(btrim(p_address), ''), v_ev.address);
    IF v_address IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: a street address is required' USING ERRCODE = '22023';
    END IF;
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: confirm the address on the map first' USING ERRCODE = '22023';
    END IF;
    PERFORM public.w1_6a_validate_geo(p_lat, p_lng, NULL);
    v_loc     := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    v_city    := CASE WHEN 'city' = ANY (v_clear) THEN NULL ELSE COALESCE(NULLIF(btrim(p_city), ''), v_ev.city) END;
    v_state   := CASE WHEN 'state' = ANY (v_clear) THEN NULL ELSE COALESCE(NULLIF(btrim(p_state), ''), v_ev.state) END;
    v_zip     := CASE WHEN 'zip_code' = ANY (v_clear) THEN NULL ELSE COALESCE(NULLIF(btrim(p_zip_code), ''), v_ev.zip_code) END;
    v_set_loc := true;
  ELSIF p_location_source IS NOT NULL THEN
    RAISE EXCEPTION 'event_location_invalid: location source must be org or address, got %', p_location_source
      USING ERRCODE = '22023';
  ELSIF NOT v_clear_addr
        AND ((p_address  IS NOT NULL AND btrim(p_address)  IS DISTINCT FROM v_ev.address)
          OR (p_city     IS NOT NULL AND btrim(p_city)     IS DISTINCT FROM v_ev.city)
          OR (p_state    IS NOT NULL AND btrim(p_state)    IS DISTINCT FROM v_ev.state)
          OR (p_zip_code IS NOT NULL AND btrim(p_zip_code) IS DISTINCT FROM v_ev.zip_code)) THEN
    RAISE EXCEPTION 'event_location_invalid: the address changed; confirm its map location (location source org or address)'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.assistance_events SET
    title         = COALESCE(NULLIF(btrim(p_title), ''), title),
    event_type    = COALESCE(p_event_type, event_type),
    description   = CASE WHEN 'description'   = ANY (v_clear) THEN NULL ELSE COALESCE(p_description, description) END,
    location_name = CASE WHEN 'location_name' = ANY (v_clear) THEN NULL ELSE COALESCE(p_location_name, location_name) END,
    address  = CASE WHEN v_set_loc THEN v_address
                    WHEN v_clear_addr THEN NULL ELSE address END,
    city     = CASE WHEN v_set_loc THEN v_city
                    WHEN 'city' = ANY (v_clear) THEN NULL ELSE city END,
    state    = CASE WHEN v_set_loc THEN v_state
                    WHEN 'state' = ANY (v_clear) THEN NULL ELSE state END,
    zip_code = CASE WHEN v_set_loc THEN v_zip
                    WHEN 'zip_code' = ANY (v_clear) THEN NULL ELSE zip_code END,
    location           = CASE WHEN v_set_loc THEN v_loc WHEN v_clear_addr THEN NULL ELSE location END,
    default_capacity      = COALESCE(p_default_capacity, default_capacity),
    requires_registration = COALESCE(p_requires_registration, requires_registration),
    is_active             = COALESCE(p_is_active, is_active),
    recurrence            = v_rule,
    series_start_local    = v_start,
    series_duration       = v_dur,
    announce_days_before  = COALESCE(p_announce_days_before, announce_days_before)
  WHERE id = p_event_id;

  -- Stop repeating ('recurrence' in p_clear): like a calendar's "does not repeat", the event keeps
  -- its NEXT date (soonest start after now) that is upcoming, or cancelled only because the event was
  -- retired / its org deactivated (reason kept, so reactivation restores it), as a hand-added one-off —
  -- same id, source 'manual', series_local_date NULL — before the reconcile below removes / cancels
  -- the other future rule dates. Admin-cancelled and rule_changed dates are never the kept date; none
  -- left => nothing kept. (Runs before retire, so a retire in the same call cancels the kept date with
  -- reason 'retired' and reactivation restores it.)
  IF v_rule IS NULL AND v_ev.recurrence IS NOT NULL THEN
    SELECT eo.id INTO v_kept_id FROM public.event_occurrences eo
     WHERE eo.event_id = p_event_id AND eo.starts_at > now()
       AND (eo.status = 'upcoming'
            OR (eo.status = 'cancelled' AND eo.cancel_reason IN ('retired', 'org_inactive')))
     ORDER BY eo.starts_at, eo.id LIMIT 1;
    UPDATE public.event_occurrences SET source = 'manual', series_local_date = NULL
     WHERE id = v_kept_id AND source = 'rule';
  END IF;

  -- Retiring cancels only dates that have NOT started; an in-progress date runs to its end and
  -- ended dates keep their attendance history (w1_6a D1/D2).
  IF p_is_active IS FALSE THEN
    UPDATE public.event_occurrences
       SET status = 'cancelled', cancel_reason = 'retired'
     WHERE event_id = p_event_id
       AND status NOT IN ('cancelled', 'completed')
       AND starts_at > now();
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;
  -- A new rule / first date / time: reconcile the future rule dates, then create missing ones.
  IF v_rule_edit THEN
    v_reconcile := public.event_apply_rule_change(p_event_id);
  END IF;
  -- Reactivation: restore the dates retire / org deactivation cancelled (no check-ins, future).
  IF p_is_active IS TRUE AND v_ev.is_active IS FALSE THEN
    v_restored := public.event_restore_system_cancelled(p_event_id);
  END IF;

  PERFORM public.record_admin_action(
    v_uid, CASE WHEN p_is_active IS FALSE THEN 'event.retire' ELSE 'event.update' END,
    'event', p_event_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'was_active', v_ev.is_active,
                       'is_active', COALESCE(p_is_active, v_ev.is_active),
                       'location_source', p_location_source, 'cleared', to_jsonb(v_clear),
                       'cancelled_dates', v_cancelled, 'actor_role', v_role,
                       'rule_edit', v_rule_edit, 'recurrence', v_rule, 'reconcile', v_reconcile,
                       'restored_dates', v_restored, 'kept_one_off', v_kept_id,
                       'announce_days_before', COALESCE(p_announce_days_before, v_ev.announce_days_before)),
    public.request_id());
  RETURN p_event_id;
END
$fn$;
REVOKE ALL ON FUNCTION public.admin_update_event(uuid, text, text, text, text, text, text, text, text, integer, boolean, text, double precision, double precision, boolean, text[], jsonb, timestamp, timestamp, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, text, text, text, text, text, text, text, text, integer, boolean, text, double precision, double precision, boolean, text[], jsonb, timestamp, timestamp, integer) TO authenticated;

-- ============================================================================
-- 3d. New RPCs (SECURITY DEFINER)
-- ============================================================================

-- preview_event_recurrence: the next p_limit (1-52) dates of an UNSAVED rule, with the same
-- validation, expansion and DST rule as saving. Writes nothing. Callable by a platform admin or an
-- admin of an active NON-BUSINESS organization (the people who can save a rule: org_event_write_gate);
-- a guest session is refused first, even one holding an admin row; everyone else gets 42501.
-- starts_local / ends_local are the clock times the dates will actually have; shifted = the
-- rule's start or end time does not exist that day (DST gap) and was moved forward.
CREATE OR REPLACE FUNCTION public.preview_event_recurrence(
  p_recurrence jsonb,
  p_starts_local timestamp,
  p_ends_local timestamp,
  p_time_zone text,
  p_limit integer DEFAULT 5)
  RETURNS TABLE(local_date date, starts_local timestamp, ends_local timestamp,
                starts_at timestamptz, ends_at timestamptz, shifted boolean)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_problem text;
  v_from    date;
  v_s       timestamptz;
  v_e       timestamptz;
BEGIN
  IF auth.uid() IS NULL OR COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'event_denied: guests cannot manage events; sign in with an account' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_current_user_admin()
          OR EXISTS (SELECT 1 FROM public.organization_members om
                       JOIN public.organizations o ON o.id = om.org_id
                      WHERE om.user_id = auth.uid() AND om.role = 'admin'
                        AND o.is_active AND o.org_type <> 'business')) THEN
    RAISE EXCEPTION 'event_denied: only a platform admin or an organization admin may preview repeating dates'
      USING ERRCODE = '42501';
  END IF;
  IF p_time_zone IS NULL
     OR p_time_zone !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_time_zone) THEN
    RAISE EXCEPTION 'event_invalid: % is not an IANA time zone such as America/New_York',
      COALESCE(p_time_zone, '<missing>') USING ERRCODE = '22023';
  END IF;
  IF p_recurrence IS NULL THEN
    RAISE EXCEPTION 'event_recurrence_invalid: a repeat rule is required' USING ERRCODE = '22023';
  END IF;
  v_s := public.event_local_to_utc(p_starts_local, p_time_zone);
  v_e := public.event_local_to_utc(p_ends_local, p_time_zone);
  IF v_e <= v_s THEN
    RAISE EXCEPTION 'event_invalid: the end time must be after the start time' USING ERRCODE = '22023';
  END IF;
  IF p_ends_local - p_starts_local > interval '24 hours' THEN
    RAISE EXCEPTION 'event_recurrence_invalid: a repeating event lasts at most 24 hours per date' USING ERRCODE = '22023';
  END IF;
  v_problem := public.event_recurrence_problem(p_recurrence, p_starts_local);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'event_recurrence_invalid: %', v_problem USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 52 THEN
    RAISE EXCEPTION 'event_invalid: preview 1 to 52 dates' USING ERRCODE = '22023';
  END IF;
  v_from := GREATEST((now() AT TIME ZONE p_time_zone)::date, p_starts_local::date);
  RETURN QUERY
  SELECT x.local_date,
         (x.starts_at AT TIME ZONE p_time_zone),
         (x.ends_at AT TIME ZONE p_time_zone),
         x.starts_at,
         x.ends_at,
         ((x.starts_at AT TIME ZONE p_time_zone) <> x.local_start
          OR (x.ends_at AT TIME ZONE p_time_zone) <> x.local_end)
    FROM public.event_rule_occurrences(p_recurrence, p_starts_local, p_ends_local - p_starts_local,
                                       p_time_zone, v_from, v_from + p_limit * 62) x
   WHERE x.ends_at > now()
   ORDER BY x.local_date
   LIMIT p_limit;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.preview_event_recurrence(jsonb, timestamp, timestamp, text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.preview_event_recurrence(jsonb, timestamp, timestamp, text, integer) TO authenticated;

-- extend_event_series: "repeat for 6 more months". New end = (the series' last date, or today
-- when that already passed) + 6 months, 23:59:59 local; a count rule becomes an until rule. The
-- new dates are created now. Idempotent per (event, p_idempotency_key): a replay returns the
-- first call's result with "replayed": true and writes nothing. One audit row per extending call.
CREATE OR REPLACE FUNCTION public.extend_event_series(p_event_id uuid, p_idempotency_key uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_role  text;
  v_ev    record;
  v_prev  jsonb;
  v_today date;
  v_end   date;
  v_until timestamp;
  v_rule  jsonb;
  v_rec   jsonb;
  v_res   jsonb;
BEGIN
  SELECT ae.org_id INTO v_org FROM public.assistance_events ae WHERE ae.id = p_event_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'event_not_found: %', p_event_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'event_invalid: an idempotency key is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ev FROM public.assistance_events ae WHERE ae.id = p_event_id FOR UPDATE;
  SELECT a.details->'result' INTO v_prev
    FROM public.admin_actions a
   WHERE a.target_type = 'event' AND a.target_id = p_event_id::text AND a.action = 'event.extend_series'
     AND a.details->>'idempotency_key' = p_idempotency_key::text
   ORDER BY a.id DESC
   LIMIT 1;
  IF v_prev IS NOT NULL THEN
    RETURN v_prev || jsonb_build_object('replayed', true);
  END IF;

  IF v_ev.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'event_retired: this event is retired; reactivate it before extending it' USING ERRCODE = 'P0001';
  END IF;
  IF v_ev.recurrence IS NULL OR NOT (v_ev.recurrence ? 'until' OR v_ev.recurrence ? 'count') THEN
    RAISE EXCEPTION 'event_recurrence_invalid: only a repeating event that ends can be extended' USING ERRCODE = '22023';
  END IF;
  v_today := (now() AT TIME ZONE v_ev.time_zone)::date;
  v_end   := public.event_series_last_date(v_ev.recurrence, v_ev.series_start_local);
  v_until := (GREATEST(v_end, v_today) + interval '6 months')::date + time '23:59:59';
  v_rule  := (v_ev.recurrence - 'count') || jsonb_build_object('until', to_char(v_until, 'YYYY-MM-DD"T"HH24:MI:SS'));
  UPDATE public.assistance_events SET recurrence = v_rule WHERE id = p_event_id;
  v_rec := public.event_apply_rule_change(p_event_id);
  v_res := jsonb_build_object('recurrence', v_rule, 'previous_end', v_end, 'until', v_rule->>'until',
                              'generated', v_rec->'generated', 'replayed', false);
  PERFORM public.record_admin_action(
    v_uid, 'event.extend_series', 'event', p_event_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'idempotency_key', p_idempotency_key, 'was', v_ev.recurrence,
                       'result', v_res, 'reconcile', v_rec, 'actor_role', v_role),
    public.request_id());
  RETURN v_res;
END
$fn$;
REVOKE ALL ON FUNCTION public.extend_event_series(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_event_series(uuid, uuid) TO authenticated;

-- org_events_ending_soon: for the organization admin page. Active repeating events of the org
-- that end (until / count) whose last date is on or before today + p_within_days (1-180) —
-- including series whose last date already passed. remaining_dates = rule dates from today
-- through the last date (0 once it passed). Same gate as the page (can_admin_org), else 42501.
CREATE OR REPLACE FUNCTION public.org_events_ending_soon(p_org_id uuid, p_within_days integer DEFAULT 30)
  RETURNS TABLE(event_id uuid, title text, last_local_date date, remaining_dates integer)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.can_admin_org(p_org_id) THEN
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  IF p_within_days IS NULL OR p_within_days NOT BETWEEN 1 AND 180 THEN
    RAISE EXCEPTION 'event_invalid: look ahead 1 to 180 days' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT ae.id, ae.title, s.last_d,
         (SELECT count(*)::integer
            FROM public.event_rule_dates(ae.recurrence, ae.series_start_local, s.today, s.last_d) d)
    FROM public.assistance_events ae
    CROSS JOIN LATERAL (
      SELECT (now() AT TIME ZONE ae.time_zone)::date AS today,
             public.event_series_last_date(ae.recurrence, ae.series_start_local) AS last_d
    ) s
   WHERE ae.org_id = p_org_id
     AND ae.is_active
     AND ae.recurrence IS NOT NULL
     AND (ae.recurrence ? 'until' OR ae.recurrence ? 'count')
     AND s.last_d <= s.today + p_within_days
   ORDER BY s.last_d, ae.id;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.org_events_ending_soon(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.org_events_ending_soon(uuid, integer) TO authenticated;

-- upcoming_events: the members' Events tab. Exactly the events ranked_feed_v2 shows (same rule,
-- event_feed_next), ONE row per event, ordered by the event's row date. When the event's row is
-- an upcoming date: occurrence_id/starts_at/ends_at = that date, cancelled_* NULL. When it is a
-- cancelled date ("Sat Oct 10 cancelled — next: Sat Oct 24", listed until it ends): cancelled_* =
-- that date and occurrence_id/starts_at/ends_at = the event's following upcoming date, announced
-- or not (NULL when there is none). Ids + times only (the client hydrates event / org fields
-- through its RLS selects); no profile columns. Same EXECUTE grants as ranked_feed_v2.
CREATE OR REPLACE FUNCTION public.upcoming_events(p_limit integer DEFAULT 50)
  RETURNS TABLE(event_id uuid, occurrence_id uuid, starts_at timestamptz, ends_at timestamptz,
                cancelled_occurrence_id uuid, cancelled_starts_at timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
  SELECT f.event_id,
         CASE WHEN f.cancelled THEN nx.id        ELSE f.occurrence_id END,
         CASE WHEN f.cancelled THEN nx.starts_at ELSE f.starts_at END,
         CASE WHEN f.cancelled THEN nx.ends_at   ELSE f.ends_at END,
         CASE WHEN f.cancelled THEN f.occurrence_id END,
         CASE WHEN f.cancelled THEN f.starts_at END
    FROM public.event_feed_next(now()) f
    LEFT JOIN LATERAL (
      SELECT x.id, x.starts_at, x.ends_at
        FROM public.event_occurrences x
       WHERE f.cancelled
         AND x.event_id = f.event_id
         AND x.status = 'upcoming'
         AND x.starts_at > f.starts_at
       ORDER BY x.starts_at, x.id
       LIMIT 1
    ) nx ON true
   ORDER BY f.starts_at, f.occurrence_id
   LIMIT greatest(coalesce(p_limit, 50), 1)
$fn$;
REVOKE EXECUTE ON FUNCTION public.upcoming_events(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upcoming_events(integer) TO anon, authenticated, service_role;

-- ============================================================================
-- 3e. Organization deactivate / reactivate (trigger function from 20261007000000, changed only
--     where noted): deactivation cancels with cancel_reason 'org_inactive'; reactivation restores.
--     The trigger (AFTER UPDATE OF is_active) is unchanged.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.organizations_cascade_deactivate()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.is_active IS TRUE AND NEW.is_active IS NOT TRUE THEN
    UPDATE public.event_occurrences eo
       SET status = 'cancelled', cancel_reason = 'org_inactive'
      FROM public.assistance_events ae
     WHERE ae.id = eo.event_id
       AND ae.org_id = NEW.id
       AND eo.status NOT IN ('cancelled','completed')
       AND eo.ends_at > now();
  ELSIF OLD.is_active IS NOT TRUE AND NEW.is_active IS TRUE THEN
    -- Reactivation: each active event gets back its future, check-in-free dates cancelled for
    -- 'org_inactive' / 'retired', and its missing rule dates.
    PERFORM public.event_restore_system_cancelled(ae.id)
       FROM public.assistance_events ae
      WHERE ae.org_id = NEW.id AND ae.is_active;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.organizations_cascade_deactivate() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3f. ranked_feed_v2 — posts branch byte-identical; events branch reads the shared rule
--     event_feed_next. Signature, RETURNS and grants unchanged.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ranked_feed_v2(
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_limit integer DEFAULT 25,
  p_cursor_score real DEFAULT NULL::real,
  p_cursor_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, kind text, score real, distance_bucket text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH cfg AS (
    SELECT half_life_hours, distance_decay_km, comment_weight, event_half_life_hours
    FROM public.ranking_config
    LIMIT 1
  ),
  caller AS (
    SELECT (SELECT auth.uid()) AS uid
  ),
  origin AS (
    SELECT CASE
             WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
             ELSE NULL
           END AS geo
  ),
  -- ===================================================================
  -- POSTS branch — BYTE-IDENTICAL to public.ranked_feed (W1.3). Any change
  -- here breaks I1; the harness compares the post rows of v2 against v1.
  -- ===================================================================
  visible AS (
    SELECT
      p.id,
      p.is_pinned,
      p.like_count,
      p.comment_count,
      p.created_at,
      CASE
        WHEN o.geo IS NOT NULL AND p.location IS NOT NULL
        THEN ST_Distance(p.location, o.geo) / 1000.0
        ELSE NULL
      END AS dist_km
    FROM public.posts p
    CROSS JOIN origin o
    CROSS JOIN caller c
    WHERE
         (NOT p.is_hidden)
      OR (p.user_id = c.uid)
      OR EXISTS (
           SELECT 1 FROM public.profiles pr
           WHERE pr.id = c.uid AND pr.is_staff = true
         )
  ),
  base AS (
    SELECT
      v.id,
      v.dist_km,
      (
          (1 + log(10.0, 1 + v.like_count + cfg.comment_weight * v.comment_count))
        * exp( -ln(2.0)
               * (EXTRACT(EPOCH FROM (now() - v.created_at)) / 3600.0)
               / cfg.half_life_hours )
        * CASE
            WHEN v.dist_km IS NULL THEN 1.0
            WHEN v.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km )
            WHEN v.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km )
            WHEN v.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km )
            ELSE                        exp( -75.0 / cfg.distance_decay_km )
          END
        + CASE WHEN v.is_pinned THEN 1000000.0 ELSE 0 END
      ) AS raw_score
    FROM visible v
    CROSS JOIN cfg
  ),
  scored AS (
    SELECT
      b.id,
      b.dist_km,
      (CASE WHEN b.raw_score < 1e-20 THEN 0.0 ELSE b.raw_score END)::real AS score
    FROM base b
  ),
  posts_ranked AS (
    SELECT
      s.id,
      'post'::text AS kind,
      s.score,
      CASE
        WHEN s.dist_km IS NULL   THEN 'unknown'
        WHEN s.dist_km < 2       THEN '<2km'
        WHEN s.dist_km < 10      THEN '2-10km'
        WHEN s.dist_km < 50      THEN '10-50km'
        ELSE                          '>50km'
      END AS distance_bucket
    FROM scored s
  ),
  -- ===================================================================
  -- EVENTS branch — one row per event from the shared rule event_feed_next
  -- (announce window, active event + org, not ended; the same rows
  -- upcoming_events lists). An upcoming row scores max(freshness since the
  -- date became the event's shown date, on the posts' half-life; proximity
  -- to its start, on the events' half-life); a cancelled row (listed until
  -- it ends so nobody makes a wasted trip) scores proximity only. Both x
  -- distance bucket factor. dist_km NEVER returned (anti-oracle).
  -- ===================================================================
  ev_next AS (
    SELECT
      f.occurrence_id AS occ_id,
      f.starts_at,
      f.cancelled,
      f.shown_since,
      CASE
        WHEN o.geo IS NOT NULL AND ae.location IS NOT NULL
        THEN ST_Distance(ae.location, o.geo) / 1000.0
        ELSE NULL
      END AS dist_km
    FROM public.event_feed_next(now()) f
    JOIN public.assistance_events ae ON ae.id = f.event_id
    CROSS JOIN origin o
  ),
  ev_base AS (
    SELECT
      x.occ_id,
      x.dist_km,
      (
          CASE
            WHEN x.cancelled THEN                            -- cancelled row: proximity only
              exp( -ln(2.0)
                   * ( abs(EXTRACT(EPOCH FROM (now() - x.starts_at))) / 3600.0 )
                   / cfg.event_half_life_hours )
            ELSE GREATEST(
              exp( -ln(2.0)
                   * ( GREATEST(EXTRACT(EPOCH FROM (now() - x.shown_since)), 0) / 3600.0 )
                   / cfg.half_life_hours ),                  -- freshness since shown (posts' half-life)
              exp( -ln(2.0)
                   * ( abs(EXTRACT(EPOCH FROM (now() - x.starts_at))) / 3600.0 )
                   / cfg.event_half_life_hours )             -- proximity to start (events' half-life)
            )
          END
        * CASE
            WHEN x.dist_km IS NULL THEN 1.0
            WHEN x.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km )
            WHEN x.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km )
            WHEN x.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km )
            ELSE                        exp( -75.0 / cfg.distance_decay_km )
          END
      ) AS raw_score                                       -- never pinned
    FROM ev_next x
    CROSS JOIN cfg
  ),
  events_ranked AS (
    SELECT
      eb.occ_id AS id,                                     -- feed row id = occurrence id
      'event'::text AS kind,
      (CASE WHEN eb.raw_score < 1e-20 THEN 0.0 ELSE eb.raw_score END)::real AS score,
      CASE
        WHEN eb.dist_km IS NULL THEN 'unknown'
        WHEN eb.dist_km < 2     THEN '<2km'
        WHEN eb.dist_km < 10    THEN '2-10km'
        WHEN eb.dist_km < 50    THEN '10-50km'
        ELSE                         '>50km'
      END AS distance_bucket
    FROM ev_base eb
  ),
  merged AS (
    SELECT id, kind, score, distance_bucket FROM posts_ranked
    UNION ALL
    SELECT id, kind, score, distance_bucket FROM events_ranked
  )
  SELECT
    m.id,
    m.kind,
    m.score,
    m.distance_bucket
  FROM merged m
  -- Single cross-kind keyset (INV-C): (score, id) < cursor in the same (DESC, DESC)
  -- order. occ_id / post_id are distinct UUIDs so the (score, id) key is unique
  -- across kinds; the id tiebreak keeps it strictly monotonic on score ties.
  WHERE
    p_cursor_score IS NULL
    OR (m.score, m.id) < (p_cursor_score, p_cursor_id)
  ORDER BY m.score DESC, m.id DESC
  LIMIT greatest(coalesce(p_limit, 25), 1);
$function$;

-- Least-privilege EXECUTE, matching public.ranked_feed exactly.
REVOKE EXECUTE ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) IS
  'Ranked community feed = W1.3 posts (byte-identical to ranked_feed) UNION ALL one row per event (event_feed_next: per active event of an active organization, its soonest announced — from 00:00 venue time announce_days_before days before its local date — not-ended date that is upcoming, or cancelled for a reason other than retired/org_inactive (then the row id is the cancelled occurrence, listed until it ends); the same for every viewer and the same rows as upcoming_events). Single cross-kind keyset on (score DESC, id DESC). Events: engagement=1; upcoming row score = max(freshness since the date became the shown date [max(announce, previous shown date end, created)] on half_life_hours, proximity |now-starts_at| on event_half_life_hours); cancelled row = proximity only; x quantized distance bucket (no oracle). 20261023000000.';

-- ============================================================================
-- 4. Nightly top-up + watchdog (pg_cron, guarded + idempotent re-schedule)
-- ============================================================================
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'events_generate_nightly') THEN
      PERFORM cron.unschedule('events_generate_nightly');
    END IF;
    PERFORM cron.schedule('events_generate_nightly', '37 3 * * *', 'SELECT public.events_generate_nightly();');
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'events_generate_watchdog') THEN
      PERFORM cron.unschedule('events_generate_watchdog');
    END IF;
    PERFORM cron.schedule('events_generate_watchdog', '37 15 * * *', 'SELECT public.events_generate_watchdog();');
  END IF;
END;
$cron$;

-- ============================================================================
-- 5. RLS — no change: no new table; the new columns of assistance_events / event_occurrences
--    are covered by their existing SELECT policies, and clients still hold no write privilege on
--    event_occurrences (20261020000000).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One nightly run now, so the watchdog finds a successful run from the day of deploy. With no
-- repeating event it inserts nothing and writes one 'info' events.generate.nightly row
-- (events_scanned 0), which commits with this migration.
-- ---------------------------------------------------------------------------
SELECT public.events_generate_nightly();

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261023000000', 'events_recurring_announce');

COMMIT;
