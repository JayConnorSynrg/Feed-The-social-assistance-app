-- events_recurring.smoke.sql
-- Behavioural smoke for 20261023000000_events_recurring_announce.sql: repeat-rule validation,
-- expansion (incl. DST per RFC 5545 Errata 4271), the generator's exactly-once dates, rule edits,
-- cancel reasons + restore, the per-event announce window shared by ranked_feed_v2 and
-- upcoming_events incl. the cancelled-date row that keeps an event listed (5-viewer parity), ranking values, the nightly job + watchdog, preview,
-- extend, ending soon, schema / SECURITY DEFINER hygiene and the return-column invariant.
-- Concurrency (generator vs save, nightly vs nightly) lives in events_recurring.race.sh.
--
-- Run against a database that ALREADY has the migration applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/events_recurring.smoke.sql
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. A failed ASSERT aborts the
-- transaction with the failing message; reaching the final NOTICE means every check held.
-- Portable: it discovers a platform admin, two plain members and a guest at runtime and SKIPs
-- (loud NOTICE) when they are absent. R10b creates a trigger, so it runs only with
-- feed.smoke_local=on. Dates are relative to the run day (now() is fixed for the transaction).

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path TO public, extensions, pg_temp;
-- Mirror production: anon holds no EXECUTE on is_current_user_admin (prod relacl probe 2026-10-06).
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;

CREATE FUNCTION pg_temp.act(p_uid uuid, p_anon boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF p_uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
END $f$;
CREATE FUNCTION pg_temp.try(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  EXECUTE q INTO r;
  RETURN 'OK ' || COALESCE(r, '<null>');
EXCEPTION WHEN others THEN
  RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
END $f$;
-- create_org_event as the CURRENT role ('org' location), returning 'OK <id>' / 'ERR ...'.
CREATE FUNCTION pg_temp.mk(p_org uuid, p_title text, p_tz text, p_s timestamp, p_e timestamp,
                           p_rule jsonb DEFAULT NULL, p_announce integer DEFAULT 7) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.try(format(
    'SELECT public.create_org_event(p_org_id => %L, p_idempotency_key => %L, p_title => %L, p_time_zone => %L, '
    'p_starts_local => %L::timestamp, p_ends_local => %L::timestamp, p_location_source => ''org'', '
    'p_recurrence => %L::jsonb, p_announce_days_before => %L)::text',
    p_org, gen_random_uuid(), p_title, p_tz, p_s, p_e, p_rule, p_announce))
$f$;
CREATE FUNCTION pg_temp.dcode(d date) RETURNS text LANGUAGE sql AS $f$
  SELECT (ARRAY['mo','tu','we','th','fr','sa','su'])[extract(isodow FROM d)::int]
$f$;
-- weekly rule on the weekday of d (+ extra properties)
CREATE FUNCTION pg_temp.wk(d date, extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $f$
  SELECT jsonb_build_object('frequency', 'weekly', 'byDay', jsonb_build_array(jsonb_build_object('day', pg_temp.dcode(d)))) || extra
$f$;
CREATE FUNCTION pg_temp.ids(p_ev uuid, p_where text DEFAULT 'true') RETURNS uuid[] LANGUAGE plpgsql AS $f$
DECLARE r uuid[];
BEGIN
  EXECUTE format('SELECT COALESCE(array_agg(id ORDER BY starts_at, id), ''{}'') FROM public.event_occurrences WHERE event_id = %L AND (%s)', p_ev, p_where) INTO r;
  RETURN r;
END $f$;
CREATE FUNCTION pg_temp.cnt(p_ev uuid, p_where text DEFAULT 'true') RETURNS integer LANGUAGE sql AS $f$
  SELECT cardinality(pg_temp.ids(p_ev, p_where))
$f$;
CREATE FUNCTION pg_temp.feed_occ(p_evs uuid[]) RETURNS uuid[] LANGUAGE sql AS $f$
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), '{}')
    FROM public.ranked_feed_v2(NULL, NULL, 10000) r
    JOIN public.event_occurrences eo ON eo.id = r.id
   WHERE r.kind = 'event' AND eo.event_id = ANY (p_evs)
$f$;
-- the event's ROW date: the cancelled date when the row is cancelled, else the next date (= the feed row id)
CREATE FUNCTION pg_temp.members_occ(p_evs uuid[]) RETURNS uuid[] LANGUAGE sql AS $f$
  SELECT COALESCE(array_agg(COALESCE(u.cancelled_occurrence_id, u.occurrence_id) ORDER BY COALESCE(u.cancelled_occurrence_id, u.occurrence_id)), '{}')
    FROM public.upcoming_events(10000) u WHERE u.event_id = ANY (p_evs)
$f$;
CREATE FUNCTION pg_temp.score(p_occ uuid, p_lat float8 DEFAULT NULL, p_lng float8 DEFAULT NULL) RETURNS float8 LANGUAGE sql AS $f$
  SELECT r.score::float8 FROM public.ranked_feed_v2(p_lat, p_lng, 10000) r WHERE r.kind = 'event' AND r.id = p_occ
$f$;
CREATE FUNCTION pg_temp.zone_at_hour(h integer) RETURNS text LANGUAGE sql AS $f$
  SELECT z FROM unnest(ARRAY['Etc/GMT+12','Etc/GMT+11','Etc/GMT+10','Etc/GMT+9','Etc/GMT+8','Etc/GMT+7','Etc/GMT+6','Etc/GMT+5','Etc/GMT+4','Etc/GMT+3','Etc/GMT+2','Etc/GMT+1','Etc/GMT','Etc/GMT-1','Etc/GMT-2','Etc/GMT-3','Etc/GMT-4','Etc/GMT-5','Etc/GMT-6','Etc/GMT-7','Etc/GMT-8','Etc/GMT-9','Etc/GMT-10','Etc/GMT-11','Etc/GMT-12','Etc/GMT-13','Etc/GMT-14']) z WHERE extract(hour FROM now() AT TIME ZONE z) = h LIMIT 1
$f$;
CREATE FUNCTION pg_temp.ndates(p_rule jsonb, p_start timestamp, p_from date, p_through date) RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(string_agg(to_char(d.local_start, 'YYYY-MM-DD HH24:MI'), ',' ORDER BY d.local_date), '')
    FROM public.event_rule_dates(p_rule, p_start, p_from, p_through) d
$f$;
CREATE FUNCTION pg_temp.utc(p_rule jsonb, p_start timestamp, p_dur interval, p_tz text, p_from date, p_through date) RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(string_agg(to_char(x.starts_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI') || '/' || to_char(x.ends_at AT TIME ZONE 'UTC', 'HH24:MI'), ',' ORDER BY x.local_date), '')
    FROM public.event_rule_occurrences(p_rule, p_start, p_dur, p_tz, p_from, p_through) x
$f$;

DO $smoke$
DECLARE
  v_admin uuid := (SELECT p.id FROM public.profiles p WHERE p.is_admin = true ORDER BY p.id LIMIT 1);
  v_m1    uuid := (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
                   WHERE p.is_admin IS NOT TRUE AND u.is_anonymous IS NOT TRUE ORDER BY p.id LIMIT 1);
  v_m2    uuid;
  v_guest uuid := (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS TRUE ORDER BY u.id LIMIT 1);
  v_c     uuid := gen_random_uuid();   -- active community org with a pin; m1 is its admin
  v_o     uuid := gen_random_uuid();   -- active community org for the deactivate / reactivate path; m1 admin
  v_today date := (now() AT TIME ZONE 'Etc/UTC')::date;
  v_S     date;
  v_r     text;
  v_ev    uuid; v_w uuid; v_x uuid; v_y uuid; v_y2 uuid; v_z uuid; v_e2 uuid;
  v_ids   uuid[]; v_ids2 uuid[];
  v_occ   uuid; v_occ2 uuid; v_occ3 uuid; v_r2 uuid; v_r3 uuid;
  v_n     integer; v_m integer; v_before integer; v_after integer;
  v_j     jsonb;
  v_act   record;
  v_viewer record;
  v_evs   uuid[];
  v_exp   uuid[];
  v_f     uuid[]; v_u uuid[];
  v_tz    text;
  v_loc   date;
  v_sc    float8; v_sc2 float8; v_fx float8; v_px float8;
  v_fn    text;
  v_rule  jsonb;
  v_o2    uuid := gen_random_uuid();   -- org deactivated in R8 (feed filter fixtures)
  v_k     uuid[];
BEGIN
  v_m2 := (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
           WHERE p.is_admin IS NOT TRUE AND u.is_anonymous IS NOT TRUE AND p.id <> v_m1 ORDER BY p.id LIMIT 1);
  IF v_admin IS NULL OR v_m1 IS NULL OR v_m2 IS NULL OR v_guest IS NULL THEN
    RAISE NOTICE 'SKIP events_recurring smoke: needs one is_admin profile, two plain members and one guest';
    RETURN;
  END IF;
  v_S := v_today + 1;
  IF EXISTS (SELECT 1 FROM public.app_logs WHERE event = 'events.generate.nightly' AND level = 'info' AND context ? 'events_scanned') THEN
    RAISE NOTICE 'R11a: the migration''s own nightly run row is present';
  ELSIF current_setting('feed.smoke_local', true) = 'on' THEN
    RAISE EXCEPTION 'R11a: applying the migration must write one successful events.generate.nightly row (watchdog baseline)';
  ELSE
    RAISE NOTICE 'SKIP R11a: no events.generate.nightly row (app_logs retention may have purged it)';
  END IF;
  INSERT INTO public.organizations (id, name, org_type, is_active, address, city, state, zip_code, location) VALUES
    (v_c, 'RECUR Pantry', 'community', true, '1 Main St', 'Montpelier', 'VT', '05602',
          ST_SetSRID(ST_MakePoint(-72.5780, 44.2600), 4326)::geography),
    (v_o, 'RECUR Kitchen', 'community', true, '2 Main St', 'Montpelier', 'VT', '05602',
          ST_SetSRID(ST_MakePoint(-72.5790, 44.2610), 4326)::geography);
  INSERT INTO public.organizations (id, name, org_type, is_active, location) VALUES
    (v_o2, 'RECUR Paused', 'community', true, ST_SetSRID(ST_MakePoint(-72.5795, 44.2615), 4326)::geography);
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES (v_c, v_m1, 'admin'), (v_o, v_m1, 'admin'), (v_o2, v_m1, 'admin');

  -- =====================================================================
  -- R0 — the validator: plain sentence (NULL = valid); CHECK + RPC use the same function
  -- =====================================================================
  FOR v_act IN SELECT * FROM (VALUES
      ('{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2026-10-10 10:00', NULL),
      ('{"@type":"RecurrenceRule","frequency":"weekly","interval":2,"byDay":[{"@type":"NDay","day":"tu"},{"day":"th"}],"until":"2027-01-31T23:59:59"}', '2026-10-08 09:00', NULL),
      ('{"frequency":"monthly","byDay":[{"day":"fr","nthOfPeriod":-1}],"count":12}', '2026-10-30 18:00', NULL),
      ('{"frequency":"monthly","byMonthDay":[31],"count":1000}', '2026-10-31 08:00', NULL),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2026-10-11 10:00', 'the first date must be one of the repeating dates'),
      ('{"frequency":"monthly","byDay":[{"day":"fr","nthOfPeriod":-1}]}', '2026-10-23 18:00', 'the first date must be one of the repeating dates'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}],"until":"2026-10-09T23:59:59"}', '2026-10-10 10:00', 'the repeat ends before its first date'),
      ('{"frequency":"daily"}', '2026-10-10 10:00', 'frequency must be weekly or monthly'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}],"interval":5}', '2026-10-10 10:00', 'a weekly rule repeats every 1 to 4 weeks'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}],"count":1001}', '2026-10-10 10:00', 'count must be a whole number from 1 to 1000'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}],"count":3,"until":"2027-01-01T00:00:00"}', '2026-10-10 10:00', 'a repeat ends on a date (until) or after a number of dates (count), not both'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}],"until":"2027-02-30T00:00:00"}', '2026-10-10 10:00', 'until is not a real date-time'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"}],"byHour":[9]}', '2026-10-10 10:00', 'the repeat rule has unsupported properties: byHour'),
      ('{"frequency":"monthly","byDay":[{"day":"sa","nthOfPeriod":5}]}', '2026-10-10 10:00', 'a monthly byDay entry needs nthOfPeriod 1, 2, 3, 4 or -1 (last)'),
      ('{"frequency":"weekly","byDay":[{"day":"sa"},{"day":"sa"}]}', '2026-10-10 10:00', 'byDay lists the same day twice')
    ) AS t(rule, st, expected) LOOP
    v_r := public.event_recurrence_problem(v_act.rule::jsonb, v_act.st::timestamp);
    ASSERT v_r IS NOT DISTINCT FROM v_act.expected, format('R0: %s from %s => %s, expected %s', v_act.rule, v_act.st, v_r, v_act.expected);
  END LOOP;
  v_r := pg_temp.try(format($q$INSERT INTO public.assistance_events (org_id, title, time_zone, recurrence, series_start_local, series_duration)
                               VALUES (%L, 'bad', 'Etc/UTC', '{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2026-10-11 10:00', '1 hour') RETURNING id::text$q$, v_c));
  ASSERT v_r LIKE 'ERR 23514 %assistance_events_recurrence_valid%', 'R0: a first date outside the pattern is refused by the CHECK even for the owner, got '||v_r;
  v_r := pg_temp.try(format($q$INSERT INTO public.assistance_events (org_id, title, time_zone, recurrence) VALUES (%L, 'half', 'Etc/UTC', '{"frequency":"weekly","byDay":[{"day":"sa"}]}') RETURNING id::text$q$, v_c));
  ASSERT v_r LIKE 'ERR 23514 %', 'R0: a rule without its first date / duration is refused, got '||v_r;
  v_r := pg_temp.try(format($q$INSERT INTO public.assistance_events (org_id, title, time_zone, announce_days_before) VALUES (%L, 'lead', 'Etc/UTC', 5) RETURNING id::text$q$, v_c));
  ASSERT v_r LIKE 'ERR 23514 %announce_days_before%', 'R0: announce_days_before 5 is refused, got '||v_r;
  v_r := pg_temp.try(format($q$INSERT INTO public.assistance_events (org_id, title, time_zone, recurrence, series_start_local, series_duration)
                               VALUES (%L, 'long', 'Etc/UTC', '{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2026-10-10 10:00', '25 hours') RETURNING id::text$q$, v_c));
  ASSERT v_r LIKE 'ERR 23514 %series_duration%', 'R0: a date longer than 24 h is refused, got '||v_r;

  -- =====================================================================
  -- R1 — expansion matrix (pure; fixed dates)
  -- =====================================================================
  ASSERT pg_temp.ndates('{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2026-10-10 10:00', '2026-10-01', '2026-11-07')
       = '2026-10-10 10:00,2026-10-17 10:00,2026-10-24 10:00,2026-10-31 10:00,2026-11-07 10:00', 'R1a: weekly Saturday';
  -- every 2 weeks, anchored on the FIRST date's week (Mon Oct 5), not on p_from
  ASSERT pg_temp.ndates('{"frequency":"weekly","interval":2,"byDay":[{"day":"tu"},{"day":"th"}]}', '2026-10-08 09:00', '2026-10-15', '2026-11-06')
       = '2026-10-20 09:00,2026-10-22 09:00,2026-11-03 09:00,2026-11-05 09:00', 'R1b: every 2 weeks anchored on the first date''s week';
  ASSERT pg_temp.ndates('{"frequency":"weekly","interval":2,"byDay":[{"day":"tu"},{"day":"th"}]}', '2026-10-08 09:00', '2026-10-01', '2026-10-20')
       = '2026-10-08 09:00,2026-10-20 09:00', 'R1b: nothing before the first date (Tue Oct 6 is excluded)';
  -- day 31 + count: a month without day 31 is skipped and NOT counted
  ASSERT pg_temp.ndates('{"frequency":"monthly","byMonthDay":[31],"count":3}', '2026-10-31 08:00', '2026-10-01', '2027-12-31')
       = '2026-10-31 08:00,2026-12-31 08:00,2027-01-31 08:00', 'R1c: 31st x3 skips November';
  ASSERT pg_temp.ndates('{"frequency":"monthly","byDay":[{"day":"fr","nthOfPeriod":-1}]}', '2026-10-30 18:00', '2026-10-01', '2027-02-28')
       = '2026-10-30 18:00,2026-11-27 18:00,2026-12-25 18:00,2027-01-29 18:00,2027-02-26 18:00', 'R1d: last Friday';
  ASSERT pg_temp.ndates('{"frequency":"monthly","byDay":[{"day":"tu","nthOfPeriod":2}]}', '2026-10-13 18:00', '2026-10-01', '2026-12-31')
       = '2026-10-13 18:00,2026-11-10 18:00,2026-12-08 18:00', 'R1e: second Tuesday';
  ASSERT pg_temp.ndates('{"frequency":"weekly","byDay":[{"day":"sa"}],"until":"2026-10-24T10:00:00"}', '2026-10-10 10:00', '2026-10-01', '2026-12-31')
       = '2026-10-10 10:00,2026-10-17 10:00,2026-10-24 10:00', 'R1f: until is inclusive of a date starting exactly at until';
  ASSERT pg_temp.ndates('{"frequency":"weekly","byDay":[{"day":"sa"}],"until":"2026-10-24T09:59:59"}', '2026-10-10 10:00', '2026-10-01', '2026-12-31')
       = '2026-10-10 10:00,2026-10-17 10:00', 'R1f: until compares the local start';
  ASSERT pg_temp.ndates('{"frequency":"weekly","byDay":[{"day":"sa"}],"count":4}', '2026-10-10 10:00', '2026-10-20', '2026-12-31')
       = '2026-10-24 10:00,2026-10-31 10:00', 'R1g: count is counted from the first date, not from p_from';
  ASSERT public.event_series_last_date('{"frequency":"monthly","byMonthDay":[31],"count":3}', '2026-10-31 08:00') = '2027-01-31'
     AND public.event_series_last_date('{"frequency":"weekly","byDay":[{"day":"sa"}],"until":"2027-04-30T23:59:59"}', '2026-10-10 10:00') = '2027-04-24'
     AND public.event_series_last_date('{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2026-10-10 10:00') IS NULL,
    'R1h: last date of count / until / never-ending series';
  -- DST (RFC 5545 Errata 4271): gap -> moved forward, repeat -> FIRST instant
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2027-03-07 02:30', '1 hour', 'America/New_York', '2027-03-01', '2027-03-21')
       = '03-07 07:30/08:30,03-14 07:30/08:30,03-21 06:30/07:30', 'R1i: NY spring gap 02:30 -> 03:30 EDT (07:30Z)';
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2026-10-25 01:30', '1 hour', 'America/New_York', '2026-10-20', '2026-11-08')
       = '10-25 05:30/06:30,11-01 05:30/07:30,11-08 06:30/07:30', 'R1j: NY fall repeat 01:30 -> first instant (EDT); wall-clock end 02:30 EST';
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2027-03-14 01:30', '2 hours', 'America/New_York', '2027-03-14', '2027-03-14')
       = '03-14 06:30/07:30', 'R1k: a date spanning the gap ends at its wall-clock end (03:30 EDT)';
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2026-09-27 02:15', '1 hour', 'Australia/Lord_Howe', '2026-09-20', '2026-10-11')
       = '09-26 15:45/16:45,10-03 15:45/16:15,10-10 15:15/16:15', 'R1l: Lord Howe 30-minute gap: 02:15 -> 02:45';
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2027-03-28 01:45', '1 hour', 'Australia/Lord_Howe', '2027-03-20', '2027-04-11')
       = '03-27 14:45/15:45,04-03 14:45/16:15,04-10 15:15/16:15', 'R1m: Lord Howe 30-minute repeat: first instant';
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2027-03-21 01:30', '1 hour', 'Europe/London', '2027-03-20', '2027-04-04')
       = '03-21 01:30/02:30,03-28 01:30/02:30,04-04 00:30/01:30', 'R1n: London spring gap 01:30 -> 02:30 BST; its wall-clock end (02:30) is not later, so end = start + 1 h';
  ASSERT pg_temp.utc('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2026-10-18 01:30', '1 hour', 'Europe/London', '2026-10-15', '2026-11-01')
       = '10-18 00:30/01:30,10-25 00:30/02:30,11-01 01:30/02:30', 'R1o: London fall repeat: first instant';

  -- =====================================================================
  -- R2 — create a repeating event: dates exist exactly once, today .. today+180, same transaction
  -- =====================================================================
  PERFORM set_config('request.headers', '{"x-request-id":"recur-create-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.mk(v_c, 'Weekly share', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S));
  RESET ROLE;
  ASSERT v_r LIKE 'OK %', 'R2: org admin creates a weekly event, got '||v_r;
  v_w := substr(v_r, 4)::uuid;
  v_n := (v_today + 180 - v_S) / 7 + 1;
  ASSERT pg_temp.cnt(v_w) = v_n AND pg_temp.cnt(v_w, 'source = ''rule'' AND status = ''upcoming''') = v_n,
    format('R2: %s weekly dates from the first date through today+180, got %s', v_n, pg_temp.cnt(v_w));
  ASSERT (SELECT min(series_local_date) = v_S AND max(series_local_date) <= v_today + 180
             AND bool_and(starts_at = (series_local_date + time '10:00') AT TIME ZONE 'Etc/UTC')
             AND bool_and(ends_at - starts_at = interval '1 hour')
          FROM public.event_occurrences WHERE event_id = v_w),
    'R2: rule rows carry their local date, 10:00-11:00 UTC, within the horizon';
  ASSERT (SELECT recurrence = pg_temp.wk(v_S) AND series_start_local = v_S + time '10:00' AND series_duration = interval '1 hour'
             AND announce_days_before = 7 FROM public.assistance_events WHERE id = v_w), 'R2: rule columns stored';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  SELECT * INTO v_act FROM public.admin_actions WHERE request_id = 'recur-create-1';
  ASSERT v_after - v_before = 1 AND v_act.action = 'event.create' AND (v_act.details->>'generated')::int = v_n
     AND v_act.details->'recurrence' = pg_temp.wk(v_S) AND v_act.details->>'announce_days_before' = '7'
     AND (v_act.details->>'occurrence_id')::uuid = (pg_temp.ids(v_w))[1],
    'R2: exactly one event.create audit row with recurrence, announce, generated, first occurrence';
  -- the horizon is exactly today+180: a rule on every weekday has one date per day from S
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.mk(v_c, 'Every day', 'Etc/UTC', v_S + time '07:00', v_S + time '08:00',
                    '{"frequency":"weekly","byDay":[{"day":"mo"},{"day":"tu"},{"day":"we"},{"day":"th"},{"day":"fr"},{"day":"sa"},{"day":"su"}]}');
  RESET ROLE;
  ASSERT v_r LIKE 'OK %' AND pg_temp.cnt(substr(v_r, 4)::uuid) = 180
     AND (SELECT max(series_local_date) FROM public.event_occurrences WHERE event_id = substr(v_r, 4)::uuid) = v_today + 180,
    'R2: horizon = today+180 inclusive (180 daily dates from tomorrow), got '||v_r||' / '||pg_temp.cnt(substr(v_r, 4)::uuid);
  -- re-runs write nothing
  v_m := public.event_generate_occurrences(v_w);
  ASSERT v_m = 0 AND pg_temp.cnt(v_w) = v_n, 'R2: a re-run inserts nothing';
  ASSERT (SELECT max(c) FROM (SELECT count(*) c FROM public.event_occurrences WHERE event_id = v_w GROUP BY series_local_date) s) = 1,
    'R2: one row per rule date';
  -- until / count / first date in the past
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.mk(v_c, 'Until', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00',
                    pg_temp.wk(v_S, jsonb_build_object('until', to_char(v_S + 21 + time '10:00', 'YYYY-MM-DD"T"HH24:MI:SS'))));
  ASSERT v_r LIKE 'OK %' AND pg_temp.cnt(substr(v_r, 4)::uuid) = 4, 'R2: until (inclusive) = 4 dates, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Count', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S, '{"count":3}'));
  ASSERT v_r LIKE 'OK %' AND pg_temp.cnt(substr(v_r, 4)::uuid) = 3, 'R2: count 3 = 3 dates, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Started', 'Etc/UTC', v_today - 13 + time '10:00', v_today - 13 + time '11:00', pg_temp.wk(v_today - 13, '{"count":4}'));
  ASSERT v_r LIKE 'OK %', 'R2: a series that started 2 weeks ago is accepted, got '||v_r;
  RESET ROLE;
  ASSERT pg_temp.cnt(substr(v_r, 4)::uuid) = 2
     AND (SELECT min(series_local_date) FROM public.event_occurrences WHERE event_id = substr(v_r, 4)::uuid) = v_today + 1,
    'R2: count counts from the first date; only dates from today are written (2 of 4)';
  -- R2b: in a zone where it is 15:xx now, a series whose first date is today 09:00-10:00 (ended)
  v_tz := pg_temp.zone_at_hour(15);
  v_loc := (now() AT TIME ZONE v_tz)::date;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.mk(v_c, 'Ended today', v_tz, v_loc + time '09:00', v_loc + time '10:00', pg_temp.wk(v_loc));
  RESET ROLE;
  ASSERT v_r LIKE 'OK %'
     AND pg_temp.cnt(substr(v_r, 4)::uuid, format('series_local_date = %L', v_loc)) = 0
     AND (SELECT min(series_local_date) FROM public.event_occurrences WHERE event_id = substr(v_r, 4)::uuid) = v_loc + 7,
    format('R2b: the first date ended earlier today (%s) => not written; dates start a week later, got %s', v_tz, v_r);

  -- =====================================================================
  -- R3 — create refusals: 22023 with stable prefixes; nothing written
  -- =====================================================================
  SELECT count(*) INTO v_before FROM public.assistance_events;
  SELECT count(*) INTO v_m FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.mk(v_c, 'Off pattern', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S + 1));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: the first date must be one of the repeating dates%', 'R3: first date off pattern, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Bad rule', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', '{"frequency":"yearly"}');
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: frequency must be weekly or monthly%', 'R3: bad rule, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Too long', 'Etc/UTC', v_S + time '10:00', v_S + 1 + time '11:00', pg_temp.wk(v_S));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: a repeating event lasts at most 24 hours%', 'R3: > 24 h, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Over', 'Etc/UTC', v_today - 14 + time '10:00', v_today - 14 + time '11:00',
                    pg_temp.wk(v_today - 14, jsonb_build_object('until', to_char(v_today - 7 + time '23:00', 'YYYY-MM-DD"T"HH24:MI:SS'))));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: the repeat gives no upcoming dates%', 'R3: a finished series, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Lead', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', NULL, 5);
  ASSERT v_r LIKE 'ERR 22023 event_invalid: post to the feed 0, 1, 3, 7, 14 or 30 days%', 'R3: announce 5, got '||v_r;
  v_r := pg_temp.mk(v_c, 'Gap', 'America/New_York', '2027-03-14 02:30', '2027-03-14 03:30', '{"frequency":"weekly","byDay":[{"day":"su"}]}');
  ASSERT v_r LIKE 'ERR 22023 event_time_invalid: 2027-03-14 02:30 does not exist%', 'R3: a hand-entered first date still refuses the gap, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_before AND (SELECT count(*) FROM public.admin_actions) = v_m,
    'R3: refused creates write no event and no audit row';

  -- =====================================================================
  -- R4 — edits: time of day (same ids), pattern (future check-in-free rule dates only),
  --       check-ins never moved / deleted, hand-added + admin-cancelled dates untouched
  -- =====================================================================
  v_ids := pg_temp.ids(v_w);
  v_r2 := v_ids[2]; v_r3 := v_ids[3];
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_size, status) VALUES (v_r2, v_m2, 1, 'early');
  PERFORM pg_temp.act(v_m1);
  PERFORM public.cancel_event_occurrence(v_r3);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_w,
           ARRAY[(v_S + 3 + time '15:00')::text], ARRAY[(v_S + 3 + time '16:00')::text]));
  RESET ROLE;
  ASSERT v_r = 'OK 1', 'R4 setup: one hand-added date, got '||v_r;
  SELECT id INTO v_occ FROM public.event_occurrences WHERE event_id = v_w AND source = 'manual';
  ASSERT (SELECT status = 'cancelled' AND cancel_reason = 'admin' FROM public.event_occurrences WHERE id = v_r3), 'R5a: cancel_event_occurrence sets cancel_reason admin';
  -- R4a: time of day 10:00-11:00 -> 11:00-12:30
  PERFORM set_config('request.headers', '{"x-request-id":"recur-time-1"}', true);
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_series_starts_local => %L::timestamp, p_series_ends_local => %L::timestamp)::text',
           v_w, v_S + time '11:00', v_S + time '12:30'));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_w, 'R4a: time change succeeds, got '||v_r;
  ASSERT pg_temp.ids(v_w) = v_ids || v_occ OR pg_temp.ids(v_w, 'source = ''rule''') = v_ids,
    'R4a: the same rule rows (ids) remain';
  ASSERT pg_temp.cnt(v_w, format('source = ''rule'' AND id NOT IN (%L, %L) AND (starts_at <> (series_local_date + time ''11:00'') AT TIME ZONE ''Etc/UTC'' OR ends_at - starts_at <> interval ''90 minutes'')', v_r2, v_r3)) = 0,
    'R4a: every other rule date moved to 11:00-12:30 in place';
  ASSERT (SELECT starts_at = (series_local_date + time '10:00') AT TIME ZONE 'Etc/UTC' AND status = 'upcoming' FROM public.event_occurrences WHERE id = v_r2)
     AND (SELECT starts_at = (series_local_date + time '10:00') AT TIME ZONE 'Etc/UTC' AND cancel_reason = 'admin' FROM public.event_occurrences WHERE id = v_r3)
     AND (SELECT starts_at = (v_S + 3 + time '15:00') AT TIME ZONE 'Etc/UTC' AND source = 'manual' FROM public.event_occurrences WHERE id = v_occ),
    'R4a: the check-in date keeps its time; the admin-cancelled and hand-added dates are untouched';
  SELECT details INTO v_j FROM public.admin_actions WHERE request_id = 'recur-time-1';
  ASSERT (SELECT count(*) FROM public.admin_actions WHERE request_id = 'recur-time-1') = 1
     AND v_j->>'rule_edit' = 'true' AND (v_j->'reconcile'->>'moved')::int = v_n - 2
     AND v_j->'reconcile'->>'kept_with_checkins' = '1' AND v_j->'reconcile'->>'deleted' = '0' AND v_j->'reconcile'->>'generated' = '0',
    'R4a: one event.update audit row: moved n-2, kept 1, deleted 0, generated 0, got '||v_j::text;
  ASSERT public.event_generate_occurrences(v_w) = 0, 'R4a: a re-run after the time change inserts nothing (no duplicate per date)';
  -- R4e: refusals write nothing
  SELECT count(*) INTO v_m FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_clear => ARRAY[''recurrence''], p_recurrence => %L::jsonb)::text', v_w, pg_temp.wk(v_S)));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: a repeat rule cannot be cleared and set%', 'R4e: clear + set, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_series_starts_local => %L::timestamp)::text', v_w, v_S + time '09:00'));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: give both the start and the end time%', 'R4e: start without end, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_recurrence => %L::jsonb)::text', v_w, pg_temp.wk(v_S + 1)));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: the first date must be one of the repeating dates%', 'R4e: new pattern without a matching first date, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_announce_days_before => 2)::text', v_w));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: post to the feed%', 'R4e: announce 2, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.admin_actions) = v_m, 'R4e: refused edits write no audit row';
  -- R4b: pattern change: weekday of S -> weekday of S+1, first date S+1 11:00-12:30
  PERFORM set_config('request.headers', '{"x-request-id":"recur-pattern-1"}', true);
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_recurrence => %L::jsonb, p_series_starts_local => %L::timestamp, p_series_ends_local => %L::timestamp)::text',
           v_w, pg_temp.wk(v_S + 1), v_S + 1 + time '11:00', v_S + 1 + time '12:30'));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_w, 'R4b: pattern change succeeds, got '||v_r;
  v_m := (v_today + 180 - (v_S + 1)) / 7 + 1;
  ASSERT pg_temp.cnt(v_w, format('source = ''rule'' AND status = ''upcoming'' AND extract(isodow FROM series_local_date) = %s', extract(isodow FROM v_S + 1))) = v_m
     AND pg_temp.cnt(v_w, format('source = ''rule'' AND extract(isodow FROM series_local_date) = %s AND id NOT IN (%L, %L)', extract(isodow FROM v_S), v_r2, v_r3)) = 0,
    format('R4b: %s new-weekday dates; every old-weekday rule date without check-ins removed', v_m);
  ASSERT (SELECT status = 'cancelled' AND cancel_reason = 'rule_changed' AND starts_at = (series_local_date + time '10:00') AT TIME ZONE 'Etc/UTC'
          FROM public.event_occurrences WHERE id = v_r2),
    'R4b: the check-in date that left the pattern is kept (same time) and cancelled with reason rule_changed';
  ASSERT (SELECT cancel_reason = 'admin' FROM public.event_occurrences WHERE id = v_r3)
     AND (SELECT status = 'upcoming' FROM public.event_occurrences WHERE id = v_occ),
    'R4b: admin-cancelled and hand-added dates untouched';
  SELECT details INTO v_j FROM public.admin_actions WHERE request_id = 'recur-pattern-1';
  ASSERT (v_j->'reconcile'->>'deleted')::int = v_n - 2 AND v_j->'reconcile'->>'cancelled_rule_changed' = '1'
     AND (v_j->'reconcile'->>'generated')::int = v_m, 'R4b: audit reconcile counts, got '||v_j::text;
  -- R4c: an admin-cancelled rule date is never re-created
  v_occ2 := (pg_temp.ids(v_w, 'source = ''rule'' AND status = ''upcoming'''))[1];
  PERFORM pg_temp.act(v_m1);
  PERFORM public.cancel_event_occurrence(v_occ2);
  RESET ROLE;
  PERFORM public.event_generate_occurrences(v_w);
  PERFORM public.events_generate_nightly();
  ASSERT (SELECT count(*) FROM public.event_occurrences e WHERE e.event_id = v_w
            AND e.series_local_date = (SELECT series_local_date FROM public.event_occurrences WHERE id = v_occ2)) = 1
     AND (SELECT cancel_reason FROM public.event_occurrences WHERE id = v_occ2) = 'admin',
    'R4c: the generator and the nightly job never re-create an admin-cancelled date';
  -- R5b: add_event_dates reschedules that admin-cancelled date (clears the reason)
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_w,
           ARRAY[(SELECT (starts_at AT TIME ZONE 'Etc/UTC')::text FROM public.event_occurrences WHERE id = v_occ2)],
           ARRAY[(SELECT (ends_at AT TIME ZONE 'Etc/UTC')::text FROM public.event_occurrences WHERE id = v_occ2)]));
  RESET ROLE;
  ASSERT v_r = 'OK 1' AND (SELECT status = 'upcoming' AND cancel_reason IS NULL AND source = 'rule' FROM public.event_occurrences WHERE id = v_occ2),
    'R5b: add_event_dates re-adds an admin-cancelled date (same row, reason cleared), got '||v_r;
  -- R5c: at most 366 dates per call
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_w,
           (SELECT array_agg((v_today + 400 + g + time '08:00')::text) FROM generate_series(1, 367) g),
           (SELECT array_agg((v_today + 400 + g + time '09:00')::text) FROM generate_series(1, 367) g)));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 22023 event_invalid: add at most 366 dates at a time%', 'R5c: 367 dates refused, got '||v_r;
  -- R5d: reason constraints
  v_r := pg_temp.try(format('UPDATE public.event_occurrences SET cancel_reason = ''admin'' WHERE id = %L RETURNING id::text', v_occ));
  ASSERT v_r LIKE 'ERR 23514 %', 'R5d: a cancel_reason on an upcoming date is refused, got '||v_r;
  v_r := pg_temp.try(format('UPDATE public.event_occurrences SET status = ''cancelled'', cancel_reason = ''other'' WHERE id = %L RETURNING id::text', v_occ));
  ASSERT v_r LIKE 'ERR 23514 %', 'R5d: an unknown cancel_reason is refused, got '||v_r;
  -- R4d: stop repeating: the NEXT upcoming date (v_occ2, S+1, a rule date) is kept as a one-off (same id,
  --      manual); other future check-in-free rule dates removed; hand-added + cancelled-with-reason kept
  PERFORM set_config('request.headers', '{"x-request-id":"recur-stop-1"}', true);
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_clear => ARRAY[''recurrence''])::text', v_w));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_w
     AND (SELECT recurrence IS NULL AND series_start_local IS NULL AND series_duration IS NULL FROM public.assistance_events WHERE id = v_w)
     AND pg_temp.cnt(v_w, 'source = ''rule'' AND status = ''upcoming''') = 0
     AND (SELECT source = 'manual' AND series_local_date IS NULL AND status = 'upcoming' FROM public.event_occurrences WHERE id = v_occ2)
     AND (SELECT details->>'kept_one_off' FROM public.admin_actions WHERE request_id = 'recur-stop-1') = v_occ2::text
     AND pg_temp.cnt(v_w) = 4,   -- kept next date, hand-added, rule_changed (check-ins), first admin-cancelled date
    'R4d: stopping keeps the next upcoming date as a one-off and removes the other upcoming rule dates, got '||v_r||' rows '||pg_temp.cnt(v_w);
  ASSERT public.event_generate_occurrences(v_w) = 0, 'R4d: a non-repeating event generates nothing';
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_series_starts_local => %L::timestamp, p_series_ends_local => %L::timestamp)::text',
           v_w, v_S + time '09:00', v_S + time '10:00'));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: a first date and time apply to a repeating event only%', 'R4e: series times without a rule, got '||v_r;

  -- =====================================================================
  -- R17 — every repeat date is exactly ONE rule row: a hand-added date sitting exactly on a repeat
  --        date (a one-off made to repeat; a date added ahead of the horizon) becomes that date's
  --        rule row, keeping its id and check-ins
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Convert', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid;
  v_e2 := substr(pg_temp.mk(v_c, 'Convert ci', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid;
  RESET ROLE;
  v_occ := (pg_temp.ids(v_ev))[1]; v_occ2 := (pg_temp.ids(v_e2))[1];
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_size, status) VALUES (v_occ2, v_m2, 1, 'early');
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_recurrence => pg_temp.wk(v_S),
            p_series_starts_local => v_S + time '10:00', p_series_ends_local => v_S + time '11:00');
  PERFORM public.admin_update_event(p_event_id => v_e2, p_recurrence => pg_temp.wk(v_S),
            p_series_starts_local => v_S + time '10:00', p_series_ends_local => v_S + time '11:00');
  RESET ROLE;
  ASSERT (SELECT source = 'rule' AND series_local_date = v_S FROM public.event_occurrences WHERE id = v_occ)
     AND (SELECT source = 'rule' AND series_local_date = v_S FROM public.event_occurrences WHERE id = v_occ2)
     AND pg_temp.cnt(v_ev) = v_n AND pg_temp.cnt(v_e2) = v_n AND pg_temp.cnt(v_ev, 'source = ''manual''') = 0,
    'R17: converting a one-off to repeating adopts its date as the first rule row (same id, also with check-ins); n dates, none manual';
  -- time of day 10:00 -> 12:00: ONE row on S, at the new time, same id (the check-in date keeps its time)
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_series_starts_local => v_S + time '12:00', p_series_ends_local => v_S + time '13:00');
  PERFORM public.admin_update_event(p_event_id => v_e2, p_series_starts_local => v_S + time '12:00', p_series_ends_local => v_S + time '13:00');
  RESET ROLE;
  ASSERT pg_temp.ids(v_ev, format('(starts_at AT TIME ZONE ''Etc/UTC'')::date = %L', v_S)) = ARRAY[v_occ]
     AND (SELECT starts_at = (v_S + time '12:00') AT TIME ZONE 'Etc/UTC' FROM public.event_occurrences WHERE id = v_occ),
    'R17: after convert + time change, S has exactly one row, the same id, at 12:00';
  ASSERT pg_temp.ids(v_e2, format('(starts_at AT TIME ZONE ''Etc/UTC'')::date = %L', v_S)) = ARRAY[v_occ2]
     AND (SELECT starts_at = (v_S + time '10:00') AT TIME ZONE 'Etc/UTC' AND status = 'upcoming' FROM public.event_occurrences WHERE id = v_occ2)
     AND EXISTS (SELECT 1 FROM public.event_checkins WHERE occurrence_id = v_occ2),
    'R17: the adopted date with check-ins stays the single row on S, at its time, check-ins kept';
  PERFORM pg_temp.act(NULL);
  ASSERT pg_temp.members_occ(ARRAY[v_ev]) = ARRAY[v_occ] AND pg_temp.feed_occ(ARRAY[v_ev]) = ARRAY[v_occ],
    'R17: the feed and the Events tab show the adopted date (at its new time)';
  RESET ROLE;
  -- add_event_dates: a date exactly on a repeat date ahead of the horizon (S+210) becomes a rule row; an off-pattern one stays manual
  PERFORM set_config('request.headers', '{"x-request-id":"recur-adopt-add"}', true);
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY[(v_S + 210 + time '12:00')::text, (v_S + 3 + time '12:00')::text],
           ARRAY[(v_S + 210 + time '13:00')::text, (v_S + 3 + time '13:00')::text]));
  RESET ROLE;
  SELECT id INTO v_occ3 FROM public.event_occurrences WHERE event_id = v_ev AND starts_at = (v_S + 210 + time '12:00') AT TIME ZONE 'Etc/UTC';
  ASSERT v_r = 'OK 2'
     AND (SELECT source = 'rule' AND series_local_date = v_S + 210 FROM public.event_occurrences WHERE id = v_occ3)
     AND (SELECT source FROM public.event_occurrences WHERE event_id = v_ev AND starts_at = (v_S + 3 + time '12:00') AT TIME ZONE 'Etc/UTC') = 'manual'
     AND (SELECT details->>'became_rule_dates' FROM public.admin_actions WHERE request_id = 'recur-adopt-add') = '1',
    'R17: add_event_dates adopts the on-pattern date (S+210) as a rule row, keeps the off-pattern one manual, audits became_rule_dates, got '||v_r;
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_series_starts_local => v_S + time '14:00', p_series_ends_local => v_S + time '15:00');
  RESET ROLE;
  ASSERT pg_temp.ids(v_ev, format('series_local_date = %L', v_S + 210)) = ARRAY[v_occ3]
     AND (SELECT starts_at = (v_S + 210 + time '14:00') AT TIME ZONE 'Etc/UTC' FROM public.event_occurrences WHERE id = v_occ3)
     AND pg_temp.cnt(v_ev, format('(starts_at AT TIME ZONE ''Etc/UTC'')::date = %L', v_S + 210)) = 1,
    'R17: a time change moves the adopted far-ahead date too (same id, one row; not deleted for lying beyond the horizon)';
  -- probe3 S1: an ADMIN-CANCELLED one-off made to repeat keeps its status through adoption, a time change and the
  -- nightly job: exactly one row on S, still cancelled/admin at 10:00; the event lists it as cancelled, next S+7 12:00
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Convert cancelled', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid;
  v_occ := (pg_temp.ids(v_ev))[1];
  PERFORM public.cancel_event_occurrence(v_occ);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_recurrence => pg_temp.wk(v_S),
            p_series_starts_local => v_S + time '10:00', p_series_ends_local => v_S + time '11:00');
  PERFORM public.admin_update_event(p_event_id => v_ev, p_series_starts_local => v_S + time '12:00', p_series_ends_local => v_S + time '13:00');
  RESET ROLE;
  PERFORM public.events_generate_nightly();
  ASSERT pg_temp.ids(v_ev, format('(starts_at AT TIME ZONE ''Etc/UTC'')::date = %L', v_S)) = ARRAY[v_occ]
     AND (SELECT source = 'rule' AND series_local_date = v_S AND status = 'cancelled' AND cancel_reason = 'admin'
                 AND starts_at = (v_S + time '10:00') AT TIME ZONE 'Etc/UTC' FROM public.event_occurrences WHERE id = v_occ),
    'R17 S1: the admin-cancelled date is adopted as cancelled/admin, stays at 10:00, and S gets no new row';
  ASSERT (SELECT u.cancelled_occurrence_id = v_occ AND u.starts_at = (v_S + 7 + time '12:00') AT TIME ZONE 'Etc/UTC'
          FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev),
    'R17 S1: listed as "S cancelled — next S+7 12:00"';
  -- a PAST hand-added date on a pattern date stays hand-added (only future dates are adopted)
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Past add', 'Etc/UTC', v_today - 13 + time '10:00', v_today - 13 + time '11:00', pg_temp.wk(v_today - 13)), 4)::uuid;
  PERFORM public.add_event_dates(v_ev, ARRAY[v_today - 6 + time '10:00'], ARRAY[v_today - 6 + time '11:00']);
  RESET ROLE;
  ASSERT (SELECT source = 'manual' AND series_local_date IS NULL FROM public.event_occurrences
           WHERE event_id = v_ev AND starts_at = (v_today - 6 + time '10:00') AT TIME ZONE 'Etc/UTC'),
    'R17: a past hand-added date on a pattern date is not adopted';
  -- probe3 S4: convert then stop repeating => exactly that date remains, as a one-off (same id)
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Convert then stop', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid;
  v_occ := (pg_temp.ids(v_ev))[1];
  PERFORM public.admin_update_event(p_event_id => v_ev, p_recurrence => pg_temp.wk(v_S),
            p_series_starts_local => v_S + time '10:00', p_series_ends_local => v_S + time '11:00');
  PERFORM public.admin_update_event(p_event_id => v_ev, p_clear => ARRAY['recurrence']);
  RESET ROLE;
  ASSERT pg_temp.ids(v_ev) = ARRAY[v_occ]
     AND (SELECT source = 'manual' AND series_local_date IS NULL AND status = 'upcoming'
                 AND starts_at = (v_S + time '10:00') AT TIME ZONE 'Etc/UTC' FROM public.event_occurrences WHERE id = v_occ),
    'R17 S4: convert then stop repeating leaves exactly the next date, as a one-off with the same id, got '||pg_temp.cnt(v_ev)||' rows';
  -- stop: the kept next date may hold check-ins (kept upcoming, not cancelled); no upcoming date => nothing kept
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Stop with check-in', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S)), 4)::uuid;
  RESET ROLE;
  v_ids := pg_temp.ids(v_ev);
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_size, status) VALUES (v_ids[1], v_m2, 1, 'early');
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_clear => ARRAY['recurrence']);
  v_e2 := substr(pg_temp.mk(v_c, 'Stop nothing upcoming', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S, '{"count":1}')), 4)::uuid;
  PERFORM public.cancel_event_occurrence((pg_temp.ids(v_e2))[1]);
  PERFORM public.admin_update_event(p_event_id => v_e2, p_clear => ARRAY['recurrence']);
  RESET ROLE;
  ASSERT pg_temp.ids(v_ev) = ARRAY[v_ids[1]]
     AND (SELECT source = 'manual' AND status = 'upcoming' FROM public.event_occurrences WHERE id = v_ids[1]),
    'R17: the kept next date with check-ins stays upcoming as a one-off; the rest of the series is removed';
  ASSERT pg_temp.cnt(v_e2) = 1
     AND (SELECT source = 'rule' AND status = 'cancelled' AND cancel_reason = 'admin' FROM public.event_occurrences WHERE event_id = v_e2),
    'R17: with no upcoming date nothing is kept as a one-off (the admin-cancelled date is left as it was)';
  -- probe4 S7: retire, stop repeating while retired, reactivate => exactly one upcoming one-off date, same id
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Retire stop reactivate', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S)), 4)::uuid;
  v_occ := (pg_temp.ids(v_ev))[1];
  PERFORM public.admin_update_event(p_event_id => v_ev, p_is_active => false);
  PERFORM set_config('request.headers', '{"x-request-id":"recur-s7-stop"}', true);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_clear => ARRAY['recurrence']);
  PERFORM set_config('request.headers', '{"x-request-id":"recur-s7-reactivate"}', true);
  RESET ROLE;
  ASSERT pg_temp.ids(v_ev) = ARRAY[v_occ]
     AND (SELECT source = 'manual' AND series_local_date IS NULL AND status = 'cancelled' AND cancel_reason = 'retired'
          FROM public.event_occurrences WHERE id = v_occ)
     AND (SELECT details->>'kept_one_off' FROM public.admin_actions WHERE request_id = 'recur-s7-stop') = v_occ::text,
    'R17 S7: stopping while retired keeps the next date as a one-off, still cancelled with reason retired';
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_ev, p_is_active => true);
  RESET ROLE;
  ASSERT pg_temp.ids(v_ev) = ARRAY[v_occ]
     AND (SELECT status = 'upcoming' AND cancel_reason IS NULL AND source = 'manual'
                 AND starts_at = (v_S + time '10:00') AT TIME ZONE 'Etc/UTC' FROM public.event_occurrences WHERE id = v_occ),
    'R17 S7: reactivation restores exactly that one-off date (same id, upcoming)';

  -- =====================================================================
  -- R6 — retire / reactivate: reason 'retired'; reactivation restores exactly the future,
  --       check-in-free dates retire cancelled, then fills missing rule dates
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_x := substr(pg_temp.mk(v_c, 'Retire me', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S)), 4)::uuid;
  v_ids := pg_temp.ids(v_x);
  PERFORM public.cancel_event_occurrence(v_ids[3]);
  RESET ROLE;
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_size, status) VALUES (v_ids[2], v_m2, 1, 'early');
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_is_active => false)::text', v_x));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_x AND pg_temp.cnt(v_x, 'cancel_reason = ''retired''') = v_n - 1
     AND (SELECT cancel_reason FROM public.event_occurrences WHERE id = v_ids[3]) = 'admin',
    'R6: retire cancels every not-started date with reason retired (the admin-cancelled one keeps admin)';
  ASSERT public.event_generate_occurrences(v_x) = 0, 'R6: a retired event generates nothing';
  DELETE FROM public.event_occurrences WHERE id = v_ids[cardinality(v_ids)];   -- a date the pause "skipped"
  PERFORM set_config('request.headers', '{"x-request-id":"recur-reactivate-1"}', true);
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_is_active => true)::text', v_x));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_x
     AND pg_temp.cnt(v_x, 'status = ''upcoming'' AND cancel_reason IS NULL') = v_n - 2
     AND (SELECT status = 'cancelled' AND cancel_reason = 'retired' FROM public.event_occurrences WHERE id = v_ids[2])
     AND (SELECT cancel_reason FROM public.event_occurrences WHERE id = v_ids[3]) = 'admin'
     AND (SELECT (details->>'restored_dates')::int = v_n - 3 FROM public.admin_actions WHERE request_id = 'recur-reactivate-1'),
    'R6: reactivation restores n-3 check-in-free retired dates + regenerates the deleted one; check-in date stays cancelled; admin stays admin';

  -- =====================================================================
  -- R7 — organization deactivate / reactivate (reason org_inactive), incl. retire while inactive
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_y  := substr(pg_temp.mk(v_o, 'Org series', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S)), 4)::uuid;
  v_y2 := substr(pg_temp.mk(v_o, 'Org series 2', 'Etc/UTC', v_S + time '12:00', v_S + time '13:00', pg_temp.wk(v_S)), 4)::uuid;
  v_z  := substr(pg_temp.mk(v_o, 'Org retired', 'Etc/UTC', v_S + time '14:00', v_S + time '15:00', pg_temp.wk(v_S)), 4)::uuid;
  PERFORM public.admin_update_event(p_event_id => v_z, p_is_active => false);
  PERFORM public.cancel_event_occurrence((pg_temp.ids(v_y2))[1]);
  RESET ROLE;
  UPDATE public.organizations SET is_active = false WHERE id = v_o;
  ASSERT pg_temp.cnt(v_y, 'cancel_reason = ''org_inactive''') = v_n
     AND pg_temp.cnt(v_y2, 'cancel_reason = ''org_inactive''') = v_n - 1 AND pg_temp.cnt(v_y2, 'cancel_reason = ''admin''') = 1
     AND pg_temp.cnt(v_z, 'cancel_reason = ''retired''') = v_n,
    'R7: deactivation cancels the org''s open dates with reason org_inactive; admin / retired reasons kept';
  ASSERT (SELECT count(*) FROM public.events_generate_nightly() j) = 1 AND pg_temp.cnt(v_y, 'status = ''upcoming''') = 0,
    'R7: the nightly job generates nothing for an inactive org';
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_is_active => false)::text', v_y));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_y AND pg_temp.cnt(v_y, 'cancel_reason = ''org_inactive''') = v_n,
    'R7: retiring while the org is inactive keeps reason org_inactive, got '||v_r;
  UPDATE public.organizations SET is_active = true WHERE id = v_o;
  ASSERT pg_temp.cnt(v_y2, 'status = ''upcoming'' AND cancel_reason IS NULL') = v_n - 1
     AND pg_temp.cnt(v_y2, 'cancel_reason = ''admin''') = 1,
    'R7: org reactivation restores an active event''s org_inactive dates (admin-cancelled stays)';
  ASSERT pg_temp.cnt(v_y, 'status = ''upcoming''') = 0 AND pg_temp.cnt(v_z, 'cancel_reason = ''retired''') = v_n,
    'R7: org reactivation restores nothing of retired events';
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_y, p_is_active => true);
  PERFORM public.admin_update_event(p_event_id => v_z, p_is_active => true);
  RESET ROLE;
  ASSERT pg_temp.cnt(v_y, 'status = ''upcoming'' AND cancel_reason IS NULL') = v_n
     AND pg_temp.cnt(v_z, 'status = ''upcoming'' AND cancel_reason IS NULL') = v_n,
    'R7: reactivating each event restores both org_inactive and retired dates once both are active';
  -- P3: with NO session (service / cron: the occurrence guards let every write through), the restore
  --     function's own conditions keep a check-in date and an anonymous-claim date cancelled
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_o, 'P3 no session', 'Etc/UTC', v_S + time '16:00', v_S + time '17:00', pg_temp.wk(v_S)), 4)::uuid;
  RESET ROLE;
  v_ids := pg_temp.ids(v_ev);
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_size, status) VALUES (v_ids[2], v_m2, 1, 'early');
  INSERT INTO public.event_anonymous_claims (occurrence_id, user_id) VALUES (v_ids[3], v_m2);
  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.organizations SET is_active = false WHERE id = v_o;
  UPDATE public.organizations SET is_active = true WHERE id = v_o;
  PERFORM public.events_generate_nightly();
  ASSERT (SELECT status = 'cancelled' AND cancel_reason = 'org_inactive' AND starts_at = (v_S + 7 + time '16:00') AT TIME ZONE 'Etc/UTC'
          FROM public.event_occurrences WHERE id = v_ids[2])
     AND (SELECT status = 'cancelled' AND cancel_reason = 'org_inactive' FROM public.event_occurrences WHERE id = v_ids[3])
     AND pg_temp.cnt(v_ev, 'status = ''upcoming'' AND cancel_reason IS NULL') = v_n - 2
     AND pg_temp.cnt(v_ev) = v_n,
    'R7 P3: no-session deactivate + reactivate (+ nightly) restores n-2; the check-in and anonymous-claim dates stay cancelled, unmoved, not duplicated';

  -- =====================================================================
  -- R8 — announce window: one rule for the feed and the members' tab, identical for every viewer,
  --       one row per event (its next shown date)
  -- =====================================================================
  v_evs := '{}'; v_exp := '{}';
  PERFORM pg_temp.act(v_m1);
  -- weekly, lead 7: next date tomorrow -> shown (one row: the NEXT date only)
  v_ev := substr(pg_temp.mk(v_c, 'V weekly', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S)), 4)::uuid;
  v_evs := v_evs || v_ev; v_exp := v_exp || (pg_temp.ids(v_ev))[1];
  -- one-off 10 days out: hidden with lead 7, shown once the lead is 14 (edit)
  v_e2 := substr(pg_temp.mk(v_c, 'V lead', 'Etc/UTC', v_today + 10 + time '10:00', v_today + 10 + time '11:00'), 4)::uuid;
  v_evs := v_evs || v_e2;
  -- lead 0: tomorrow hidden; an in-progress date shown
  v_ev := substr(pg_temp.mk(v_c, 'V zero tomorrow', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', NULL, 0), 4)::uuid;
  v_evs := v_evs || v_ev;
  v_ev := substr(pg_temp.mk(v_c, 'V zero now', 'Etc/UTC', date_trunc('minute', now() AT TIME ZONE 'Etc/UTC') - interval '1 hour',
                            date_trunc('minute', now() AT TIME ZONE 'Etc/UTC') + interval '1 hour', NULL, 0), 4)::uuid;
  v_evs := v_evs || v_ev; v_exp := v_exp || (pg_temp.ids(v_ev))[1];
  -- the local-midnight boundary in zones far from UTC: local date today+7 shown, today+8 hidden
  FOREACH v_tz IN ARRAY ARRAY['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/New_York'] LOOP
    v_loc := (now() AT TIME ZONE v_tz)::date;
    v_ev := substr(pg_temp.mk(v_c, 'V edge in '||v_tz, v_tz, v_loc + 7 + time '23:00', v_loc + 7 + time '23:30'), 4)::uuid;
    v_evs := v_evs || v_ev; v_exp := v_exp || (pg_temp.ids(v_ev))[1];
    v_ev := substr(pg_temp.mk(v_c, 'V out in '||v_tz, v_tz, v_loc + 8 + time '00:30', v_loc + 8 + time '01:00'), 4)::uuid;
    v_evs := v_evs || v_ev;
  END LOOP;
  RESET ROLE;
  -- R6 / R7 events: next date tomorrow => shown. v_y2's first date (tomorrow) is admin-cancelled and
  -- its next date is today+8 (outside lead 7): the event STILL shows, its row = the cancelled date.
  v_evs := v_evs || v_x || v_y || v_y2;
  v_exp := v_exp || (pg_temp.ids(v_x, 'status = ''upcoming'''))[1] || (pg_temp.ids(v_y, 'status = ''upcoming'''))[1]
                 || (pg_temp.ids(v_y2, 'cancel_reason = ''admin'''))[1];
  -- a date cancelled for 'retired' / 'org_inactive' never keeps an event listed (event active here)
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'V system-cancelled', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.event_occurrences SET status = 'cancelled', cancel_reason = 'retired' WHERE event_id = v_ev;
  v_evs := v_evs || v_ev;
  v_evs := v_evs || v_w;           -- R4 event: its only upcoming date is hand-added at S+3 -> shown
  v_exp := v_exp || (pg_temp.ids(v_w, 'source = ''manual'' AND status = ''upcoming'''))[1];
  -- inactive event / inactive org: rows the cascades leave in place must still never be shown
  PERFORM pg_temp.act(v_m1);
  v_k := ARRAY[
    substr(pg_temp.mk(v_c,  'K retired, admin-cancelled date', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid,
    substr(pg_temp.mk(v_c,  'K retired, date in progress', 'Etc/UTC', date_trunc('minute', now() AT TIME ZONE 'Etc/UTC') - interval '1 hour',
                                                             date_trunc('minute', now() AT TIME ZONE 'Etc/UTC') + interval '1 hour'), 4)::uuid,
    substr(pg_temp.mk(v_o2, 'K inactive org, admin-cancelled date', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00'), 4)::uuid];
  PERFORM public.cancel_event_occurrence((pg_temp.ids(v_k[1]))[1]);
  PERFORM public.admin_update_event(p_event_id => v_k[1], p_is_active => false);
  PERFORM public.admin_update_event(p_event_id => v_k[2], p_is_active => false);
  PERFORM public.cancel_event_occurrence((pg_temp.ids(v_k[3]))[1]);
  RESET ROLE;
  UPDATE public.organizations SET is_active = false WHERE id = v_o2;
  ASSERT (SELECT cancel_reason FROM public.event_occurrences WHERE event_id = v_k[1]) = 'admin'
     AND (SELECT status FROM public.event_occurrences WHERE event_id = v_k[2]) = 'upcoming'
     AND (SELECT cancel_reason FROM public.event_occurrences WHERE event_id = v_k[3]) = 'admin',
    'R8 setup: retire / deactivation left an admin-cancelled date, an in-progress date, an admin-cancelled date';
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_f := pg_temp.feed_occ(v_k);
    v_u := pg_temp.members_occ(v_k);
    RESET ROLE;
    ASSERT v_f = '{}' AND v_u = '{}',
      format('R8 [%s]: retired event (admin-cancelled / in-progress date) and inactive-org event (admin-cancelled date): 0 rows, got feed %s members %s',
             v_viewer.label, v_f, v_u);
  END LOOP;
  SELECT array_agg(e ORDER BY e) INTO v_exp FROM unnest(v_exp) e;
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_f := pg_temp.feed_occ(v_evs);
    v_u := pg_temp.members_occ(v_evs);
    RESET ROLE;
    ASSERT v_f = v_exp, format('R8 [%s]: feed shows exactly the announced next dates: %s vs expected %s', v_viewer.label, v_f, v_exp);
    ASSERT v_u = v_exp, format('R8 [%s]: upcoming_events lists the same dates as the feed: %s', v_viewer.label, v_u);
  END LOOP;
  -- lead 14 brings the 10-day date in; retiring / deactivating takes events out for everyone
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_e2, p_announce_days_before => 14);
  RESET ROLE;
  PERFORM pg_temp.act(NULL);
  v_f := pg_temp.feed_occ(ARRAY[v_e2]); v_u := pg_temp.members_occ(ARRAY[v_e2]);
  RESET ROLE;
  ASSERT v_f = pg_temp.ids(v_e2) AND v_u = v_f, 'R8: raising the lead to 14 days shows the 10-day date (feed + members)';
  -- one row per event: at lead 14 the weekly event has TWO announced dates (S, S+7); both lists show only S
  PERFORM pg_temp.act(v_m1);
  PERFORM public.admin_update_event(p_event_id => v_evs[1], p_announce_days_before => 14);
  RESET ROLE;
  ASSERT pg_temp.cnt(v_evs[1], format('starts_at < %L', (v_today + 15)::timestamptz)) = 2
     AND pg_temp.feed_occ(ARRAY[v_evs[1]]) = ARRAY[(pg_temp.ids(v_evs[1]))[1]]
     AND pg_temp.members_occ(ARRAY[v_evs[1]]) = ARRAY[(pg_temp.ids(v_evs[1]))[1]],
    'R8: two announced dates => ONE row per event (its soonest) in the feed and the members list';
  UPDATE public.organizations SET is_active = false WHERE id = v_o;
  PERFORM pg_temp.act(v_guest, true);
  ASSERT pg_temp.feed_occ(ARRAY[v_y]) = '{}' AND pg_temp.members_occ(ARRAY[v_y]) = '{}', 'R8: an inactive org''s events leave the feed and the tab';
  RESET ROLE;
  UPDATE public.organizations SET is_active = true WHERE id = v_o;

  -- =====================================================================
  -- R9 — cancelled date keeps the event listed: weekly, lead 7, tomorrow cancelled => listed TODAY
  --      with "tomorrow cancelled — next: S+7" (the next date need not be announced) until the
  --      cancelled date ends; then the normal rule resumes
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Notice', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S)), 4)::uuid;
  v_ids := pg_temp.ids(v_ev);
  PERFORM public.cancel_event_occurrence(v_ids[1]);   -- tomorrow cancelled; next = S+7 = today+8 (not announced)
  RESET ROLE;
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    SELECT u.occurrence_id, u.cancelled_occurrence_id INTO v_occ2, v_occ3 FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev;
    v_f := pg_temp.feed_occ(ARRAY[v_ev]);
    RESET ROLE;
    ASSERT v_occ3 = v_ids[1] AND v_occ2 = v_ids[2] AND v_f = ARRAY[v_ids[1]],
      format('R9 [%s]: listed now as "S cancelled — next S+7" (members) / the cancelled occurrence (feed), got %s / %s / %s',
             v_viewer.label, v_occ2, v_occ3, v_f);
  END LOOP;
  ASSERT (SELECT u.starts_at = (SELECT starts_at FROM public.event_occurrences WHERE id = v_ids[2])
            AND u.cancelled_starts_at = (SELECT starts_at FROM public.event_occurrences WHERE id = v_ids[1])
          FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev),
    'R9: next date times = S+7, cancelled_starts_at = S';
  -- the next date is the following UPCOMING date: cancel S+7 too => next = S+14, row still S
  PERFORM pg_temp.act(v_m1);
  PERFORM public.cancel_event_occurrence(v_ids[2]);
  RESET ROLE;
  ASSERT (SELECT u.cancelled_occurrence_id = v_ids[1] AND u.occurrence_id = v_ids[3] FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev),
    'R9: next skips a later cancelled date (S+14)';
  -- an already-ended cancelled date never qualifies; the row stays the soonest not-ended one
  INSERT INTO public.event_occurrences (event_id, starts_at, ends_at, status, cancel_reason)
  VALUES (v_ev, now() - interval '3 hours', now() - interval '2 hours', 'cancelled', 'admin');
  ASSERT (SELECT u.cancelled_occurrence_id FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev) = v_ids[1],
    'R9: an ended cancelled date is not the row';
  -- reschedule it: the row is the upcoming date again, no notice
  PERFORM pg_temp.act(v_m1);
  PERFORM public.add_event_dates(v_ev, ARRAY[v_S + time '10:00'], ARRAY[v_S + time '11:00']);
  RESET ROLE;
  ASSERT (SELECT u.occurrence_id = v_ids[1] AND u.cancelled_occurrence_id IS NULL AND u.cancelled_starts_at IS NULL
          FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev),
    'R9: a rescheduled date is the row again and the notice disappears';
  -- once the cancelled date has ended the normal rule resumes (next date today+8: not announced at lead 7)
  PERFORM pg_temp.act(v_m1);
  PERFORM public.cancel_event_occurrence(v_ids[1]);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);   -- server-side write: let the cancelled date end
  UPDATE public.event_occurrences SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 minute' WHERE id = v_ids[1];
  ASSERT NOT EXISTS (SELECT 1 FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev)
     AND pg_temp.feed_occ(ARRAY[v_ev]) = '{}',
    'R9: after the cancelled date ends, the event leaves both lists until its next date is announced';
  -- a cancelled date with no following date: next = NULL
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Last one', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S, '{"count":1}')), 4)::uuid;
  PERFORM public.cancel_event_occurrence((pg_temp.ids(v_ev))[1]);
  RESET ROLE;
  ASSERT (SELECT u.occurrence_id IS NULL AND u.starts_at IS NULL AND u.ends_at IS NULL
             AND u.cancelled_occurrence_id = (pg_temp.ids(v_ev))[1]
          FROM public.upcoming_events(10000) u WHERE u.event_id = v_ev),
    'R9: a cancelled date with no later date is listed with next = NULL';

  -- =====================================================================
  -- R10 — nightly job + watchdog (one app_logs row per run; per-event isolation)
  -- =====================================================================
  v_occ3 := (pg_temp.ids(v_x, 'status = ''upcoming'''))[5];   -- evaluate once (pg_temp.ids is volatile)
  DELETE FROM public.event_occurrences WHERE id = v_occ3;
  SELECT count(*), array_agg(id) INTO v_before, v_ids2 FROM public.app_logs;
  v_j := public.events_generate_nightly();
  SELECT count(*) INTO v_after FROM public.app_logs;
  ASSERT v_after - v_before = 1 AND (v_j->>'inserted')::int = 1 AND v_j->>'events_failed' = '0'
     AND (SELECT level = 'info' AND duration_ms IS NOT NULL AND context ? 'events_scanned' AND context ? 'failures_by_type'
                 AND (context->>'inserted')::int = 1
            FROM public.app_logs WHERE event = 'events.generate.nightly' AND id <> ALL (COALESCE(v_ids2, '{}'))),
    'R10: one info events.generate.nightly row; the deleted date is topped up, got '||v_j::text;
  IF current_setting('feed.smoke_local', true) = 'on' THEN
    CREATE FUNCTION public.smoke_fail_generate() RETURNS trigger LANGUAGE plpgsql AS $t$
    BEGIN
      IF NEW.event_id::text = current_setting('smoke.fail_event', true) THEN RAISE EXCEPTION 'smoke: generator failure'; END IF;
      RETURN NEW;
    END $t$;
    CREATE TRIGGER smoke_fail_generate BEFORE INSERT ON public.event_occurrences
      FOR EACH ROW EXECUTE FUNCTION public.smoke_fail_generate();
    PERFORM set_config('smoke.fail_event', v_y::text, true);
    v_occ3 := (pg_temp.ids(v_y, 'status = ''upcoming'''))[4];   -- evaluate once (pg_temp.ids is volatile)
    DELETE FROM public.event_occurrences WHERE id = v_occ3;
    v_occ3 := (pg_temp.ids(v_y2, 'status = ''upcoming'''))[4];   -- evaluate once (pg_temp.ids is volatile)
    DELETE FROM public.event_occurrences WHERE id = v_occ3;
    SELECT count(*), array_agg(id) INTO v_before, v_ids2 FROM public.app_logs;
    v_j := public.events_generate_nightly();
    ASSERT (SELECT count(*) FROM public.app_logs) - v_before = 1
       AND v_j->>'events_failed' = '1' AND v_j->'failures_by_type' = '{"P0001": 1}'::jsonb
       AND v_j->'failed_event_ids' = jsonb_build_array(v_y) AND (v_j->>'inserted')::int = 1
       AND (SELECT level FROM public.app_logs WHERE event = 'events.generate.nightly' AND id <> ALL (v_ids2)) = 'error',
      'R10b: one failing event is counted by SQLSTATE, the run continues (other event topped up), level error, got '||v_j::text;
    DROP TRIGGER smoke_fail_generate ON public.event_occurrences;
    DROP FUNCTION public.smoke_fail_generate();
    RAISE NOTICE 'PASS R10b nightly failure isolation (local)';
  ELSE
    RAISE NOTICE 'SKIP R10b nightly failure isolation: needs feed.smoke_local=on (creates a trigger; local DB only)';
  END IF;
  -- watchdog
  SELECT count(*) INTO v_before FROM public.app_logs;
  v_r := public.events_generate_watchdog()::text;
  ASSERT v_r = 'false' AND (SELECT count(*) FROM public.app_logs) = v_before,
    'R10c: a successful run in the last 26 h => watchdog writes nothing';
  DELETE FROM public.app_logs WHERE event = 'events.generate.nightly';
  INSERT INTO public.app_logs (level, event, created_at) VALUES ('info', 'events.generate.nightly', now() - interval '27 hours'),
                                                                ('error', 'events.generate.nightly', now() - interval '1 hour');
  SELECT count(*) INTO v_before FROM public.app_logs;
  v_r := public.events_generate_watchdog()::text;
  ASSERT v_r = 'true' AND (SELECT count(*) FROM public.app_logs) = v_before + 1
     AND (SELECT count(*) FROM public.app_logs WHERE event = 'events.generate.watchdog' AND level = 'error') = 1,
    'R10c: no successful run in 26 h (only an older info + a recent error run) => exactly one error row';
  INSERT INTO public.app_logs (level, event, created_at) VALUES ('info', 'events.generate.nightly', now() - interval '25 hours');
  SELECT count(*) INTO v_before FROM public.app_logs;
  v_r := public.events_generate_watchdog()::text;
  ASSERT v_r = 'false' AND (SELECT count(*) FROM public.app_logs) = v_before,
    'R10c: a successful run 25 h ago => nothing';

  -- =====================================================================
  -- R13 — ranking: max(freshness since shown, proximity) x distance factor
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Rank new', 'Etc/UTC', v_today + 3 + time '10:00', v_today + 3 + time '11:00'), 4)::uuid;
  RESET ROLE;
  v_occ := (pg_temp.ids(v_ev))[1];
  v_sc := pg_temp.score(v_occ);
  ASSERT abs(v_sc - 1.0) < 1e-6, 'R13a: a date created now (already announced) scores 1.0 (fresh), got '||v_sc;
  -- announce anchor: a zone whose local time is 00:xx; date local today+7 12:00, lead 7, created long ago
  SELECT z INTO v_tz FROM unnest(ARRAY['Etc/GMT+12','Etc/GMT+11','Etc/GMT+10','Etc/GMT+9','Etc/GMT+8','Etc/GMT+7','Etc/GMT+6',
      'Etc/GMT+5','Etc/GMT+4','Etc/GMT+3','Etc/GMT+2','Etc/GMT+1','Etc/GMT','Etc/GMT-1','Etc/GMT-2','Etc/GMT-3','Etc/GMT-4',
      'Etc/GMT-5','Etc/GMT-6','Etc/GMT-7','Etc/GMT-8','Etc/GMT-9','Etc/GMT-10','Etc/GMT-11','Etc/GMT-12','Etc/GMT-13','Etc/GMT-14']) z
   WHERE extract(hour FROM now() AT TIME ZONE z) = 0 LIMIT 1;
  v_loc := (now() AT TIME ZONE v_tz)::date;
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Rank announce', v_tz, v_loc + 7 + time '12:00', v_loc + 7 + time '13:00'), 4)::uuid;
  RESET ROLE;
  v_occ := (pg_temp.ids(v_ev))[1];
  UPDATE public.event_occurrences SET created_at = now() - interval '60 days' WHERE id = v_occ;
  v_fx := 2 ^ (-(extract(epoch FROM now() - (v_loc::timestamp AT TIME ZONE v_tz)) / 3600.0) / 24.0);
  v_px := 2 ^ (-(extract(epoch FROM (SELECT starts_at FROM public.event_occurrences WHERE id = v_occ) - now()) / 3600.0) / 168.0);
  v_sc := pg_temp.score(v_occ);
  ASSERT v_fx > v_px AND abs(v_sc - v_fx) < 1e-6, format('R13b: freshness from the announce instant (%s, local 00:00 today) = %s beats proximity %s; got %s', v_tz, v_fx, v_px, v_sc);
  -- previous date's end anchor: previous date ended 2 h ago, next date in 5 days
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Rank prev', 'Etc/UTC', date_trunc('minute', now() AT TIME ZONE 'Etc/UTC') + interval '5 days',
                            date_trunc('minute', now() AT TIME ZONE 'Etc/UTC') + interval '5 days 1 hour'), 4)::uuid;
  RESET ROLE;
  v_occ := (pg_temp.ids(v_ev))[1];
  UPDATE public.event_occurrences SET created_at = now() - interval '60 days' WHERE id = v_occ;
  INSERT INTO public.event_occurrences (id, event_id, starts_at, ends_at)
  VALUES (gen_random_uuid(), v_ev, now() - interval '4 hours', now() - interval '2 hours') RETURNING id INTO v_occ2;
  v_px := 2 ^ (-(extract(epoch FROM (SELECT starts_at FROM public.event_occurrences WHERE id = v_occ) - now()) / 3600.0) / 168.0);
  v_sc := pg_temp.score(v_occ);
  ASSERT abs(v_sc - 2 ^ (-2.0 / 24.0)) < 1e-6, 'R13c: shown since the previous date ended 2 h ago => 2^(-2/24), got '||v_sc;
  PERFORM set_config('request.jwt.claims', '{}', true);   -- server-side write (no session): the guard lets it through
  UPDATE public.event_occurrences SET status = 'cancelled', cancel_reason = 'admin' WHERE id = v_occ2;
  v_sc := pg_temp.score(v_occ);
  ASSERT abs(v_sc - 2 ^ (-2.0 / 24.0)) < 1e-6, 'R13c: an admin-cancelled previous date was shown (as a cancelled row) => still the anchor, got '||v_sc;
  UPDATE public.event_occurrences SET cancel_reason = 'retired' WHERE id = v_occ2;
  v_sc := pg_temp.score(v_occ);
  ASSERT abs(v_sc - v_px) < 1e-6, format('R13c: a system-cancelled previous date was never shown => no anchor => proximity %s, got %s', v_px, v_sc);
  PERFORM pg_temp.act(v_m1);
  v_e2 := substr(pg_temp.mk(v_c, 'Rank cancelled', 'Etc/UTC', v_today + 3 + time '10:00', v_today + 3 + time '11:00'), 4)::uuid;
  PERFORM public.cancel_event_occurrence((pg_temp.ids(v_e2))[1]);
  RESET ROLE;
  v_occ3 := (pg_temp.ids(v_e2))[1];
  v_fx := 2 ^ (-(extract(epoch FROM (SELECT starts_at FROM public.event_occurrences WHERE id = v_occ3) - now()) / 3600.0) / 168.0);
  ASSERT abs(pg_temp.score(v_occ3) - v_fx) < 1e-6,
    format('R13e: a cancelled row scores proximity only (%s), no freshness boost (would be 1.0), got %s', v_fx, pg_temp.score(v_occ3));
  v_sc2 := pg_temp.score(v_occ, 44.2600, -72.5780);
  ASSERT abs(v_sc2 / v_sc - exp(-1.0 / 20.0)) < 1e-5, 'R13d: the distance bucket factor is unchanged (<2 km => exp(-1/20)), got '||(v_sc2 / v_sc);

  -- =====================================================================
  -- R14 — extend_event_series: +6 months from the end, count -> until, idempotent, one audit row
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Extend', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00', pg_temp.wk(v_S, '{"count":3}')), 4)::uuid;
  RESET ROLE;   -- count audit rows as the owner (admin_actions is platform-admin-only under RLS)
  PERFORM set_config('request.headers', '{"x-request-id":"recur-extend-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_j := public.extend_event_series(v_ev, 'e0000000-0000-4000-8000-000000000001');
  RESET ROLE;
  ASSERT v_j->>'previous_end' = (v_S + 14)::text
     AND v_j->>'until' = to_char((v_S + 14 + interval '6 months')::date, 'YYYY-MM-DD') || 'T23:59:59'
     AND NOT (v_j->'recurrence' ? 'count') AND v_j->>'replayed' = 'false'
     AND pg_temp.cnt(v_ev) = LEAST((v_today + 180 - v_S) / 7 + 1, ((v_S + 14 + interval '6 months')::date - v_S) / 7 + 1)
     AND (SELECT count(*) FROM public.admin_actions) - v_before = 1
     AND (SELECT action = 'event.extend_series' AND details->>'idempotency_key' = 'e0000000-0000-4000-8000-000000000001'
          FROM public.admin_actions WHERE request_id = 'recur-extend-1'),
    'R14: count 3 -> until last date + 6 months, dates created, one audit row, got '||v_j::text;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.extend_event_series(%L, %L)::text', v_ev, 'e0000000-0000-4000-8000-000000000001'));
  RESET ROLE;
  ASSERT (substr(v_r, 4)::jsonb) = v_j || '{"replayed": true}' AND (SELECT count(*) FROM public.admin_actions) - v_before = 1,
    'R14: a replay with the same key returns the same result and writes nothing, got '||v_r;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.extend_event_series(%L, %L)::text', v_x, gen_random_uuid()));
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: only a repeating event that ends can be extended%', 'R14: never-ending series, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.extend_event_series(%L, NULL)::text', v_ev));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: an idempotency key is required%', 'R14: no key, got '||v_r;
  PERFORM pg_temp.act(v_m2);
  v_r := pg_temp.try(format('SELECT public.extend_event_series(%L, %L)::text', v_ev, gen_random_uuid()));
  ASSERT v_r LIKE 'ERR 42501 %', 'R14: an outsider gets 42501, got '||v_r;
  RESET ROLE;

  -- =====================================================================
  -- R15 — org_events_ending_soon
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_ev := substr(pg_temp.mk(v_c, 'Ending', 'Etc/UTC', v_S + time '10:00', v_S + time '11:00',
                            pg_temp.wk(v_S, jsonb_build_object('until', to_char(v_S + 14 + time '23:59:59', 'YYYY-MM-DD"T"HH24:MI:SS')))), 4)::uuid;
  ASSERT (SELECT last_local_date = v_S + 14 AND remaining_dates = 3 FROM public.org_events_ending_soon(v_c, 30) WHERE event_id = v_ev),
    'R15: a series ending in 15 days is listed with its last date and 3 remaining dates';
  ASSERT NOT EXISTS (SELECT 1 FROM public.org_events_ending_soon(v_c, 10) WHERE event_id = v_ev)
     AND NOT EXISTS (SELECT 1 FROM public.org_events_ending_soon(v_c, 180) WHERE event_id = v_x),
    'R15: outside the window, and never-ending series, are not listed';
  v_r := pg_temp.try(format('SELECT count(*)::text FROM public.org_events_ending_soon(%L, 0)', v_c));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: look ahead 1 to 180 days%', 'R15: window 0 refused, got '||v_r;
  PERFORM pg_temp.act(v_m2);
  v_r := pg_temp.try(format('SELECT count(*)::text FROM public.org_events_ending_soon(%L, 30)', v_c));
  ASSERT v_r LIKE 'ERR 42501 %', 'R15: a non-admin gets 42501, got '||v_r;
  RESET ROLE;

  -- =====================================================================
  -- R16 — preview_event_recurrence (same expansion; shifted flag; authenticated only; no writes)
  -- =====================================================================
  SELECT count(*) INTO v_before FROM public.event_occurrences;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try($q$SELECT string_agg(to_char(starts_local, 'MM-DD HH24:MI') || CASE WHEN shifted THEN '*' ELSE '' END, ',' ORDER BY local_date)
                       FROM public.preview_event_recurrence('{"frequency":"weekly","byDay":[{"day":"su"}]}', '2027-03-07 02:30', '2027-03-07 03:15', 'America/New_York', 3)$q$);
  ASSERT v_r = 'OK 03-07 02:30,03-14 03:30*,03-21 02:30', 'R16: preview flags the DST-gap date as shifted, got '||v_r;
  v_r := pg_temp.try($q$SELECT count(*)::text FROM public.preview_event_recurrence('{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2027-03-07 10:00', '2027-03-07 11:00', 'America/New_York')$q$);
  ASSERT v_r LIKE 'ERR 22023 event_recurrence_invalid: the first date must be one of the repeating dates%', 'R16: same validation as save, got '||v_r;
  v_r := pg_temp.try(format($q$SELECT string_agg(local_date::text, ',' ORDER BY local_date) FROM public.preview_event_recurrence(%L, %L, %L, 'Etc/UTC')$q$,
                            pg_temp.wk(v_S), v_S + time '10:00', v_S + time '11:00'));
  ASSERT v_r = 'OK ' || (SELECT string_agg((v_S + 7 * g)::text, ',' ORDER BY g) FROM generate_series(0, 4) g), 'R16: default 5 dates = the generator''s first 5, got '||v_r;
  PERFORM pg_temp.act(NULL);
  v_r := pg_temp.try($q$SELECT count(*)::text FROM public.preview_event_recurrence('{"frequency":"weekly","byDay":[{"day":"sa"}]}', '2027-03-06 10:00', '2027-03-06 11:00', 'Etc/UTC')$q$);
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 42501 %', 'R16: anon cannot preview, got '||v_r;
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES (v_c, v_guest, 'admin') ON CONFLICT DO NOTHING;
  FOR v_viewer IN SELECT * FROM (VALUES
      ('plain member', v_m2, false, 'ERR 42501 event_denied: only a platform admin or an organization admin%'),
      ('guest holding an org admin row', v_guest, true, 'ERR 42501 event_denied: guests%'),
      ('org admin', v_m1, false, 'OK 5'), ('platform admin', v_admin, false, 'OK 5')) AS t(label, uid, anon, expected) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_r := pg_temp.try(format($q$SELECT count(*)::text FROM public.preview_event_recurrence(%L, %L, %L, 'Etc/UTC')$q$,
                              pg_temp.wk(v_S), v_S + time '10:00', v_S + time '11:00'));
    RESET ROLE;
    ASSERT v_r LIKE v_viewer.expected, format('R16 [%s]: preview => %s, got %s', v_viewer.label, v_viewer.expected, v_r);
  END LOOP;
  v_e2 := gen_random_uuid();
  INSERT INTO public.organizations (id, name, org_type, status, is_active, location)
  VALUES (v_e2, 'RECUR Biz', 'business', 'approved', true, ST_SetSRID(ST_MakePoint(-72.5780, 44.2600), 4326)::geography);
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES (v_e2, v_m2, 'admin');
  PERFORM pg_temp.act(v_m2);
  v_r := pg_temp.try(format($q$SELECT count(*)::text FROM public.preview_event_recurrence(%L, %L, %L, 'Etc/UTC')$q$,
                            pg_temp.wk(v_S), v_S + time '10:00', v_S + time '11:00'));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 42501 event_denied: only a platform admin or an organization admin%',
    'R16: an admin of an active BUSINESS org only (cannot save events) cannot preview, got '||v_r;
  ASSERT (SELECT count(*) FROM public.event_occurrences) = v_before, 'R16: preview writes nothing';

  -- =====================================================================
  -- R11 — schema, signatures, fingerprints, SECURITY DEFINER hygiene
  -- =====================================================================
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assistance_events'
                       AND column_name IN ('geocode_accuracy', 'geocode_confidence')),
    'R11: geocode_accuracy / geocode_confidence dropped';
  ASSERT (SELECT data_type = 'smallint' AND is_nullable = 'NO' AND column_default = '7' FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'assistance_events' AND column_name = 'announce_days_before'),
    'R11: announce_days_before smallint NOT NULL DEFAULT 7';
  ASSERT (SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i WHERE i.indexrelid = 'public.event_occurrences_rule_date_key'::regclass)
         LIKE '%UNIQUE INDEX event_occurrences_rule_date_key ON public.event_occurrences USING btree (event_id, series_local_date) WHERE (source = ''rule''::text)%'
     AND (SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i WHERE i.indexrelid = 'public.idx_event_occurrences_upcoming_ends_at'::regclass)
         LIKE '%(ends_at) WHERE (status = ''upcoming''::text)%',
    'R11: partial unique (event_id, series_local_date) WHERE source=rule + (ends_at) WHERE upcoming';
  ASSERT (SELECT array_agg(column_name::text ORDER BY column_name::text) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ranking_config')
         = ARRAY['comment_weight','distance_decay_km','event_half_life_hours','half_life_hours','singleton_guard','updated_at'],
    'R11: no new ranking_config constant';
  ASSERT (SELECT count(*) FROM pg_proc WHERE proname = 'create_org_event' AND pronamespace = 'public'::regnamespace) = 1
     AND (SELECT count(*) FROM pg_proc WHERE proname = 'admin_update_event' AND pronamespace = 'public'::regnamespace) = 1
     AND (SELECT count(*) FROM pg_proc WHERE proname = 'add_event_dates' AND pronamespace = 'public'::regnamespace) = 1,
    'R11: exactly one signature each (old ones dropped, no PostgREST overload)';
  ASSERT to_regprocedure('public.ranked_feed(double precision,double precision,integer,real,uuid)') IS NULL
     AND (SELECT md5(pg_get_functiondef('public.event_local_to_utc(timestamp,text)'::regprocedure))) = 'aa78328d8bdf1b33506b72aa5b24e117',
    'R11: ranked_feed (v1) dropped (20261026000000); event_local_to_utc unchanged';
  ASSERT (SELECT md5(substring(d FROM position('  visible AS (' IN d) FOR position('  -- EVENTS branch' IN d) - position('  visible AS (' IN d)))
          FROM (SELECT pg_get_functiondef('public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'::regprocedure) d) s)
         = 'eab880757418ffbd2ddc13566f7032bc',
    'R11: ranked_feed_v2 posts branch = W1.3 ranking + the deleted-post filter (20261026000000)';
  ASSERT (SELECT prosrc !~* 'temp' FROM pg_proc WHERE oid = 'public.event_apply_rule_change(uuid)'::regprocedure),
    'R11: the rule-edit step uses no temp table';
  FOREACH v_fn IN ARRAY ARRAY[
      'public.create_org_event(uuid,uuid,text,text,timestamp,timestamp,text,text,text,text,text,text,text,text,double precision,double precision,integer,boolean,jsonb,integer)',
      'public.admin_update_event(uuid,text,text,text,text,text,text,text,text,integer,boolean,text,double precision,double precision,boolean,text[],jsonb,timestamp,timestamp,integer)',
      'public.add_event_dates(uuid,timestamp[],timestamp[])', 'public.cancel_event_occurrence(uuid)',
      'public.preview_event_recurrence(jsonb,timestamp,timestamp,text,integer)', 'public.extend_event_series(uuid,uuid)',
      'public.org_events_ending_soon(uuid,integer)', 'public.upcoming_events(integer)',
      'public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'] LOOP
    ASSERT (SELECT p.prosecdef AND array_to_string(p.proconfig, ',') LIKE 'search_path=public%pg_temp%' FROM pg_proc p WHERE p.oid = v_fn::regprocedure),
      'R11: '||v_fn||' must be SECURITY DEFINER with a pinned search_path';
    ASSERT has_function_privilege('authenticated', v_fn, 'EXECUTE'), 'R11: authenticated must EXECUTE '||v_fn;
    ASSERT NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = v_fn::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
      'R11: PUBLIC must hold no EXECUTE on '||v_fn;
    ASSERT has_function_privilege('anon', v_fn, 'EXECUTE') = (v_fn LIKE 'public.upcoming_events%' OR v_fn LIKE 'public.ranked_feed_v2%'),
      'R11: anon EXECUTE only on upcoming_events + ranked_feed_v2: '||v_fn;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
      'public.event_rule_dates(jsonb,timestamp,date,date)', 'public.event_series_last_date(jsonb,timestamp)',
      'public.event_recurrence_problem(jsonb,timestamp)', 'public.event_local_to_utc_rfc(timestamp,text)',
      'public.event_rule_occurrences(jsonb,timestamp,interval,text,date,date)',
      'public.event_date_announced(timestamptz,timestamptz,text,integer)', 'public.event_feed_next(timestamptz)',
      'public.event_generate_occurrences(uuid,boolean)', 'public.event_apply_rule_change(uuid)',
      'public.event_restore_system_cancelled(uuid)', 'public.event_adopt_manual_dates(uuid)', 'public.events_generate_nightly()', 'public.events_generate_watchdog()',
      'public.organizations_cascade_deactivate()'] LOOP
    ASSERT NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') AND NOT has_function_privilege('anon', v_fn, 'EXECUTE'),
      'R11: '||v_fn||' must not be client-executable';
    ASSERT (SELECT p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE 'search_path=%' FROM pg_proc p WHERE p.oid = v_fn::regprocedure),
      'R11: '||v_fn||' pins its search_path';
    ASSERT (SELECT NOT p.prosecdef FROM pg_proc p WHERE p.oid = v_fn::regprocedure) OR v_fn = 'public.organizations_cascade_deactivate()',
      'R11: internal '||v_fn||' runs as the caller (not SECURITY DEFINER)';
  END LOOP;
  ASSERT (SELECT provolatile = 'i' FROM pg_proc WHERE oid = 'public.event_recurrence_problem(jsonb,timestamp)'::regprocedure),
    'R11: the CHECK validator is IMMUTABLE';

  -- =====================================================================
  -- R12 — return-column invariant (agreed with Settings C2): ranked_feed_v2 keeps its shape and its
  --        single profiles reference; no function of this migration returns profile display columns
  -- =====================================================================
  ASSERT pg_get_function_result('public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'::regprocedure)
         = 'TABLE(id uuid, kind text, score real, distance_bucket text)', 'R12: ranked_feed_v2 RETURNS unchanged';
  ASSERT pg_get_function_result('public.upcoming_events(integer)'::regprocedure)
         = 'TABLE(event_id uuid, occurrence_id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, cancelled_occurrence_id uuid, cancelled_starts_at timestamp with time zone)',
    'R12: upcoming_events returns ids + times only';
  ASSERT (SELECT (length(d) - length(replace(d, 'public.profiles', ''))) / length('public.profiles')
          FROM (SELECT pg_get_functiondef('public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'::regprocedure) d) s) = 1,
    'R12: ranked_feed_v2 references public.profiles exactly once (posts branch)';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p
     CROSS JOIN LATERAL unnest(COALESCE(p.proargnames, '{}'), COALESCE(p.proargmodes, '{}')) AS a(name, mode)
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('create_org_event','admin_update_event','add_event_dates','cancel_event_occurrence','preview_event_recurrence',
                         'extend_event_series','org_events_ending_soon','upcoming_events','ranked_feed_v2','event_feed_next',
                         'event_rule_dates','event_rule_occurrences','event_series_last_date','event_recurrence_problem',
                         'event_local_to_utc_rfc','event_date_announced','event_generate_occurrences','event_apply_rule_change',
                         'event_restore_system_cancelled','event_adopt_manual_dates','events_generate_nightly','events_generate_watchdog')
       AND a.mode IN ('o', 't', 'b')
       AND a.name IN ('avatar_url', 'username', 'bio', 'first_name', 'full_name')),
    'R12: no function of this migration returns avatar_url / username / bio / first_name / full_name';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('upcoming_events','preview_event_recurrence','extend_event_series','org_events_ending_soon','ranked_feed_v2')
       AND p.prorettype = 'public.profiles'::regtype),
    'R12: no function returns the profiles row type';

  RAISE NOTICE 'PASS events_recurring smoke: R0 validator, R1 expansion+DST, R2 generator, R3 create refusals, R4 edits, R5 cancel reasons, R6 retire/reactivate, R7 org deactivate/reactivate, R8 announce window parity, R9 cancelled row + notice, R10 nightly+watchdog, R11 schema/hygiene, R12 return columns, R13 ranking, R14 extend, R15 ending soon, R16 preview, R17 hand-added dates on repeat dates';
END
$smoke$;

ROLLBACK;
