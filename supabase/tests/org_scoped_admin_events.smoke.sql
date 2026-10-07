-- org_scoped_admin_events.smoke.sql
-- Behavioural smoke for 20261020000000_org_scoped_admin_events.sql (as changed by
-- 20261023000000_events_recurring_announce.sql: announce window instead of 30 days, geocode
-- columns dropped, new trailing RPC arguments; recurrence is covered in events_recurring.smoke.sql):
--   create_org_event / add_event_dates / cancel_event_occurrence / admin_update_event,
--   event time zones (DST gap + repeat), idempotency, write authority, the event_occurrences
--   write lockdown, ranked_feed_v2 event visibility + event half-life, can_admin_org, and the
--   SECURITY DEFINER hygiene of every new or changed function.
-- Org-admin profile editing (admin_save_organization / can_manage_org_photos) is covered in
-- org_admin_save.smoke.sql (S8 + S11).
--
-- Run against a database that ALREADY has the migration applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/org_scoped_admin_events.smoke.sql
--
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. A failed ASSERT aborts the
-- transaction with the failing message; reaching the final NOTICE means every check held.
-- Portable: it discovers a platform admin, two plain members and a guest at runtime and SKIPs
-- (loud NOTICE) when they are absent. Calls run as anon / authenticated (grant + RLS surface);
-- seeds and verification reads run as the connection superuser.
-- E16 creates a trigger on public.event_occurrences, so it runs only with feed.smoke_local=on.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path TO public, extensions, pg_temp;
-- Mirror production: anon holds no EXECUTE on is_current_user_admin (prod relacl probe 2026-10-06).
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;

-- Switch the caller: a NULL uid => anon; otherwise authenticated (guest when p_anon).
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

-- Run one statement as the CURRENT role; return 'OK <value>' or 'ERR <sqlstate> <message>'.
CREATE FUNCTION pg_temp.try(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  EXECUTE q INTO r;
  RETURN 'OK ' || COALESCE(r, '<null>');
EXCEPTION WHEN others THEN
  RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
END $f$;

CREATE FUNCTION pg_temp.feed_events() RETURNS uuid[] LANGUAGE sql AS $f$
  SELECT COALESCE(array_agg(r.id), '{}') FROM public.ranked_feed_v2(44.26, -72.58, 1000) r WHERE r.kind = 'event'
$f$;
CREATE FUNCTION pg_temp.event_score(p_occ uuid) RETURNS real LANGUAGE sql AS $f$
  SELECT r.score FROM public.ranked_feed_v2(NULL, NULL, 1000) r WHERE r.kind = 'event' AND r.id = p_occ
$f$;
CREATE FUNCTION pg_temp.posts_v1() RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(string_agg(r.id::text || '|' || r.score::text || '|' || r.distance_bucket, ',' ORDER BY r.id), '')
    FROM public.ranked_feed(44.26, -72.58, 1000, NULL, NULL) r
$f$;
CREATE FUNCTION pg_temp.posts_v2() RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(string_agg(r.id::text || '|' || r.score::text || '|' || r.distance_bucket, ',' ORDER BY r.id), '')
    FROM public.ranked_feed_v2(44.26, -72.58, 1000, NULL, NULL) r WHERE r.kind = 'post'
$f$;
-- One create_org_event call as SQL text (all optional args named).
CREATE FUNCTION pg_temp.create_sql(p_org uuid, p_key uuid, p_title text, p_tz text, p_s timestamp, p_e timestamp,
                                   p_src text, p_extra text DEFAULT '') RETURNS text LANGUAGE sql AS $f$
  SELECT format('SELECT public.create_org_event(p_org_id => %L, p_idempotency_key => %L, p_title => %L, p_time_zone => %L, p_starts_local => %L::timestamp, p_ends_local => %L::timestamp, p_location_source => %L%s)::text',
                p_org, p_key, p_title, p_tz, p_s, p_e, p_src, p_extra)
$f$;

DO $smoke$
DECLARE
  v_admin   uuid := (SELECT p.id FROM public.profiles p WHERE p.is_admin = true ORDER BY p.id LIMIT 1);
  v_m1      uuid := (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
                     WHERE p.is_admin IS NOT TRUE AND u.is_anonymous IS NOT TRUE ORDER BY p.id LIMIT 1);
  v_m2      uuid;
  v_guest   uuid := (SELECT u.id FROM auth.users u WHERE u.is_anonymous IS TRUE ORDER BY u.id LIMIT 1);
  v_now     timestamp := (now() AT TIME ZONE 'Etc/UTC');
  v_c       uuid := gen_random_uuid();   -- community, active, has a map pin; m1 is its admin
  v_c2      uuid := gen_random_uuid();   -- community, active, no pin; nobody's admin
  v_i       uuid := gen_random_uuid();   -- community, INACTIVE; m1 is its admin
  v_b       uuid := gen_random_uuid();   -- business, approved, active; m1 is its admin
  v_r       text;
  v_ev      uuid;
  v_ev2     uuid;
  v_ev_a    uuid; v_occ_a uuid;
  v_ev_r    uuid; v_occ_r uuid;
  v_ev_q    uuid; v_occ_q uuid;
  v_ev_i    uuid := gen_random_uuid(); v_occ_i uuid := gen_random_uuid();
  v_ev_f    uuid; v_occ_f uuid;
  v_ev_x    uuid; v_occ_x uuid;
  v_ev_h    uuid; v_occ_h uuid;
  v_ev_p    uuid := gen_random_uuid(); v_occ_p uuid := gen_random_uuid();
  v_key     uuid := gen_random_uuid();
  v_occ     uuid;
  v_n_ev    int; v_n_occ int; v_n_aud int;
  v_before  int; v_after int;
  v_act     record;
  v_viewer  record;
  v_feed    uuid[];
  v_p1      text; v_p2 text;
  v_score   real;
  v_fn      text;
BEGIN
  v_m2 := (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
           WHERE p.is_admin IS NOT TRUE AND u.is_anonymous IS NOT TRUE AND p.id <> v_m1 ORDER BY p.id LIMIT 1);
  IF v_admin IS NULL OR v_m1 IS NULL OR v_m2 IS NULL OR v_guest IS NULL THEN
    RAISE NOTICE 'SKIP org_scoped_admin_events smoke: needs one is_admin profile, two plain members and one guest';
    RETURN;
  END IF;

  -- ---------------- seeds (superuser) ----------------
  INSERT INTO public.organizations (id, name, org_type, is_active, address, city, state, zip_code, location) VALUES
    (v_c,  'SMOKE Pantry',   'community', true,  '1 Main St', 'Montpelier', 'VT', '05602',
           ST_SetSRID(ST_MakePoint(-72.5780, 44.2600), 4326)::geography),
    (v_c2, 'SMOKE Other',    'community', true,  NULL, NULL, NULL, NULL, NULL),
    (v_i,  'SMOKE Inactive', 'community', false, NULL, NULL, NULL, NULL,
           ST_SetSRID(ST_MakePoint(-72.5780, 44.2600), 4326)::geography);
  INSERT INTO public.organizations (id, name, org_type, status, is_active, location)
  VALUES (v_b, 'SMOKE Biz', 'business', 'approved', true, ST_SetSRID(ST_MakePoint(-72.5780, 44.2600), 4326)::geography);
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES
    (v_c, v_m1, 'admin'), (v_i, v_m1, 'admin'), (v_b, v_m1, 'admin'), (v_c2, v_m2, 'member'),
    (v_c, v_guest, 'admin');   -- a GUEST holding an admin row: every org-admin path must still refuse it
  -- posts for the posts-branch equality check (a visible, a pinned and a hidden-own one)
  INSERT INTO public.posts (user_id, content, created_at, location) VALUES
    (v_m1, 'smoke p1', now() - interval '3 hours', ST_SetSRID(ST_MakePoint(-72.5700, 44.2650), 4326)::geography);
  INSERT INTO public.posts (user_id, content, is_pinned, created_at) VALUES (v_m1, 'smoke p2', true, now() - interval '30 hours');
  INSERT INTO public.posts (user_id, content, is_hidden, created_at) VALUES (v_m2, 'smoke p3', true, now() - interval '1 hour');

  -- =====================================================================
  -- E1 — create_org_event happy path (org admin, 'org' location, America/New_York)
  -- =====================================================================
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-create-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, v_key, '  Food Share  ', 'America/New_York',
                                        '2026-11-10 10:00', '2026-11-10 12:00', 'org',
                                        ', p_description => ''Weekly'', p_default_capacity => 40'));
  RESET ROLE;
  ASSERT v_r LIKE 'OK %', 'E1: org admin create must succeed, got '||v_r;
  v_ev := substr(v_r, 4)::uuid;
  ASSERT (SELECT org_id = v_c AND title = 'Food Share' AND time_zone = 'America/New_York' AND is_active
            AND idempotency_key = v_key AND created_by = v_m1 AND description = 'Weekly'
            AND default_capacity = 40 AND recurrence IS NULL AND series_start_local IS NULL
            AND announce_days_before = 7
            AND address = '1 Main St' AND city = 'Montpelier' AND state = 'VT' AND zip_code = '05602'
            AND location_name = 'SMOKE Pantry'
            AND ST_Equals(location::geometry, (SELECT o.location::geometry FROM public.organizations o WHERE o.id = v_c))
          FROM public.assistance_events WHERE id = v_ev),
    'E1: event row must carry the trimmed title, zone, key, creator, the org pin + address, no repeat rule and the default 7-day announce lead';
  ASSERT (SELECT count(*) FROM public.event_occurrences WHERE event_id = v_ev) = 1, 'E1: exactly one first date';
  ASSERT (SELECT starts_at = '2026-11-10 15:00+00' AND ends_at = '2026-11-10 17:00+00' AND status = 'upcoming'
            AND capacity = 40 AND source = 'manual' AND series_local_date IS NULL AND cancel_reason IS NULL
          FROM public.event_occurrences WHERE event_id = v_ev),
    'E1: 10:00-12:00 America/New_York on 2026-11-10 (EST) must be stored as 15:00-17:00 UTC';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'E1: exactly one audit row, got '||(v_after - v_before);
  SELECT * INTO v_act FROM public.admin_actions WHERE target_id = v_ev::text;
  ASSERT v_act.action = 'event.create' AND v_act.actor_id = v_m1 AND v_act.actor_tier IS NULL
     AND v_act.target_type = 'event' AND v_act.outcome = 'ok' AND v_act.request_id = 'smoke-ev-create-1'
     AND v_act.details->>'actor_role' = 'org_admin' AND v_act.details->>'org_id' = v_c::text
     AND v_act.details->>'time_zone' = 'America/New_York' AND v_act.details->>'location_source' = 'org'
     AND (v_act.details->>'occurrence_id')::uuid = (SELECT id FROM public.event_occurrences WHERE event_id = v_ev),
    'E1: audit row must be event.create by the org admin with request_id + actor_role, got '||row_to_json(v_act)::text;

  -- =====================================================================
  -- E2 — idempotency: same key => same id, nothing new (even with a different payload)
  -- =====================================================================
  SELECT count(*) INTO v_n_ev FROM public.assistance_events;
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, v_key, 'Food Share', 'America/New_York',
                                        '2026-11-10 10:00', '2026-11-10 12:00', 'org'));
  ASSERT v_r = 'OK ' || v_ev, 'E2: a repeat with the same key must return the same event id, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, v_key, 'Renamed', 'America/Chicago',
                                        '2026-12-01 09:00', '2026-12-01 10:00', 'org'));
  RESET ROLE;
  ASSERT v_r = 'OK ' || v_ev, 'E2: a repeat with a different payload must still return the original id, got '||v_r;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev
     AND (SELECT count(*) FROM public.event_occurrences) = v_n_occ
     AND (SELECT count(*) FROM public.admin_actions) = v_n_aud,
    'E2: a repeat must write no event, no date and no audit row';
  ASSERT (SELECT title = 'Food Share' AND time_zone = 'America/New_York' FROM public.assistance_events WHERE id = v_ev),
    'E2: a repeat must not change the original event';

  -- =====================================================================
  -- E3 — 'address' location (platform admin), and location refusals
  -- =====================================================================
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-create-2"}', true);
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Clinic Day', 'America/New_York',
                                        '2026-11-12 09:00', '2026-11-12 11:00', 'address',
                                        ', p_address => ''22 State St'', p_city => ''Montpelier'', p_state => ''VT'', p_lat => 44.2601, p_lng => -72.5754'));
  RESET ROLE;
  ASSERT v_r LIKE 'OK %', 'E3: platform admin address create must succeed, got '||v_r;
  v_ev2 := substr(v_r, 4)::uuid;
  ASSERT (SELECT address = '22 State St'
            AND abs(ST_X(location::geometry) + 72.5754) < 1e-9 AND abs(ST_Y(location::geometry) - 44.2601) < 1e-9
          FROM public.assistance_events WHERE id = v_ev2), 'E3: the confirmed point + address must be stored';
  ASSERT (SELECT details->>'actor_role' = 'platform_admin' AND details->>'location_source' = 'address'
            AND request_id = 'smoke-ev-create-2'
          FROM public.admin_actions WHERE target_id = v_ev2::text AND action = 'event.create'),
    'E3: platform admin audit row must carry actor_role platform_admin';

  SELECT count(*) INTO v_n_ev FROM public.assistance_events;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'X', 'America/New_York', '2026-11-12 09:00', '2026-11-12 10:00', 'address',
                                        ', p_address => ''22 State St'''));
  ASSERT v_r LIKE 'ERR 22023 event_location_invalid%', 'E3: address without a confirmed point must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'X', 'America/New_York', '2026-11-12 09:00', '2026-11-12 10:00', 'address',
                                        ', p_address => ''22 State St'', p_lat => 0, p_lng => 0'));
  ASSERT v_r LIKE 'ERR 22023 %null island%', 'E3: a null-island point must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'X', 'America/New_York', '2026-11-12 09:00', '2026-11-12 10:00', 'mapbox'));
  ASSERT v_r LIKE 'ERR 22023 event_location_invalid%', 'E3: an unknown location source must be 22023, got '||v_r;
  RESET ROLE;
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(pg_temp.create_sql(v_c2, gen_random_uuid(), 'X', 'America/New_York', '2026-11-12 09:00', '2026-11-12 10:00', 'org'));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 22023 event_location_invalid%no map pin%', 'E3: org source on an org without a pin must be 22023, got '||v_r;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev AND (SELECT count(*) FROM public.admin_actions) = v_n_aud,
    'E3: refused creates write nothing';

  -- =====================================================================
  -- E4 — time validation: DST gap + repeat, end after start, IANA zone, required fields
  -- =====================================================================
  SELECT count(*) INTO v_n_ev FROM public.assistance_events;
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Gap', 'America/New_York', '2026-03-08 02:30', '2026-03-08 04:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_time_invalid: 2026-03-08 02:30 does not exist in America/New_York%',
    'E4: 2026-03-08 02:30 America/New_York (spring-forward gap) must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Gap end', 'America/New_York', '2026-03-08 01:00', '2026-03-08 02:15', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_time_invalid: 2026-03-08 02:15 does not exist%', 'E4: a gap END time must be 22023 too, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Repeat', 'America/New_York', '2026-11-01 01:30', '2026-11-01 03:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_time_invalid: 2026-11-01 01:30 happens twice in America/New_York%',
    'E4: 2026-11-01 01:30 America/New_York (fall-back repeat) must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Eq', 'America/New_York', '2026-11-12 09:00', '2026-11-12 09:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: the end time must be after%', 'E4: end = start must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Bad tz', 'EST', '2026-11-12 09:00', '2026-11-12 10:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: EST is not an IANA time zone%', 'E4: EST must be refused, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Bad tz', 'Mars/Olympus_Mons', '2026-11-12 09:00', '2026-11-12 10:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: Mars/Olympus_Mons is not an IANA%', 'E4: an unknown Area/City must be refused, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), '   ', 'America/New_York', '2026-11-12 09:00', '2026-11-12 10:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: a title is required%', 'E4: blank title must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, NULL, 'No key', 'America/New_York', '2026-11-12 09:00', '2026-11-12 10:00', 'org'));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: an idempotency key%', 'E4: a missing idempotency key must be 22023, got '||v_r;
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Ok edge', 'America/New_York', '2026-11-01 00:30', '2026-11-01 00:59', 'org'));
  ASSERT v_r LIKE 'OK %', 'E4: a time just before the repeated hour must be accepted, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev + 1
     AND (SELECT count(*) FROM public.event_occurrences) = v_n_occ + 1
     AND (SELECT count(*) FROM public.admin_actions) = v_n_aud + 1,
    'E4: only the one valid create may write (1 event, 1 date, 1 audit row)';

  -- =====================================================================
  -- E5 — write authority: everyone except a platform admin (any non-business org) / an admin
  --      of THAT org while active + non-business gets 42501 and nothing is written
  -- =====================================================================
  SELECT count(*) INTO v_n_ev FROM public.assistance_events;
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  FOR v_viewer IN SELECT * FROM (VALUES
      ('outsider member',              v_m2,    false, v_c),
      ('org admin of another org',     v_m1,    false, v_c2),
      ('org admin of an inactive org', v_m1,    false, v_i),
      ('org admin of a business org',  v_m1,    false, v_b),
      ('platform admin, business org', v_admin, false, v_b),
      ('guest holding an admin row',   v_guest, true,  v_c),
      ('org admin, unknown org',       v_m1,    false, gen_random_uuid()),
      ('anon',                         NULL::uuid, false, v_c)) AS t(label, uid, anon, org) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_r := pg_temp.try(pg_temp.create_sql(v_viewer.org, gen_random_uuid(), 'Denied', 'America/New_York',
                                          '2026-11-12 09:00', '2026-11-12 10:00', 'org'));
    RESET ROLE;
    ASSERT v_r LIKE 'ERR 42501 %', format('E5 [%s]: create_org_event must be 42501, got %s', v_viewer.label, v_r);
  END LOOP;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev
     AND (SELECT count(*) FROM public.event_occurrences) = v_n_occ
     AND (SELECT count(*) FROM public.admin_actions) = v_n_aud,
    'E5: every refused create writes nothing';

  -- =====================================================================
  -- E6 — clients cannot write event_occurrences directly (privileges + policies gone)
  -- =====================================================================
  ASSERT NOT has_table_privilege('authenticated', 'public.event_occurrences', 'INSERT')
     AND NOT has_table_privilege('authenticated', 'public.event_occurrences', 'UPDATE')
     AND NOT has_table_privilege('authenticated', 'public.event_occurrences', 'DELETE')
     AND NOT has_table_privilege('anon', 'public.event_occurrences', 'INSERT')
     AND has_table_privilege('authenticated', 'public.event_occurrences', 'SELECT'),
    'E6: anon/authenticated hold no INSERT/UPDATE/DELETE on event_occurrences (SELECT kept)';
  ASSERT (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_occurrences'
            AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')) = 0,
    'E6: no write policy remains on event_occurrences';
  SELECT id INTO v_occ FROM public.event_occurrences WHERE event_id = v_ev;
  FOR v_viewer IN SELECT * FROM (VALUES ('org admin', v_m1), ('platform admin', v_admin)) AS t(label, uid) LOOP
    PERFORM pg_temp.act(v_viewer.uid);
    v_r := pg_temp.try(format('INSERT INTO public.event_occurrences (event_id, starts_at, ends_at) VALUES (%L, now() + interval ''9 days'', now() + interval ''10 days'') RETURNING id::text', v_ev));
    ASSERT v_r LIKE 'ERR 42501 %', format('E6 [%s]: direct INSERT must be 42501, got %s', v_viewer.label, v_r);
    v_r := pg_temp.try(format('UPDATE public.event_occurrences SET status = ''cancelled'' WHERE id = %L RETURNING id::text', v_occ));
    ASSERT v_r LIKE 'ERR 42501 %', format('E6 [%s]: direct UPDATE must be 42501, got %s', v_viewer.label, v_r);
    v_r := pg_temp.try(format('DELETE FROM public.event_occurrences WHERE id = %L RETURNING id::text', v_occ));
    ASSERT v_r LIKE 'ERR 42501 %', format('E6 [%s]: direct DELETE must be 42501, got %s', v_viewer.label, v_r);
    RESET ROLE;
  END LOOP;
  ASSERT (SELECT status FROM public.event_occurrences WHERE id = v_occ) = 'upcoming', 'E6: the date is untouched';

  -- =====================================================================
  -- E7 — add_event_dates: event zone, duplicates ignored, one audit row per call, refusals
  -- =====================================================================
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-dates-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-11-10 10:00', '2026-11-17 10:00', '2027-07-06 10:00', '2027-07-06 10:00'],
           ARRAY['2026-11-10 12:00', '2026-11-17 12:00', '2027-07-06 12:00', '2027-07-06 12:00']));
  RESET ROLE;
  ASSERT v_r = 'OK 2', 'E7: 2 new dates (1 existing start + 1 repeated in the call ignored), got '||v_r;
  ASSERT (SELECT count(*) FROM public.event_occurrences WHERE event_id = v_ev) = 3, 'E7: the event now has 3 dates';
  ASSERT EXISTS (SELECT 1 FROM public.event_occurrences WHERE event_id = v_ev
                   AND starts_at = '2027-07-06 14:00+00' AND ends_at = '2027-07-06 16:00+00' AND capacity = 40),
    'E7: 10:00 America/New_York in July (EDT) must be 14:00 UTC, with the event default capacity';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'E7: exactly one audit row per call';
  ASSERT (SELECT action = 'event.add_dates' AND actor_id = v_m1 AND target_id = v_ev::text AND request_id = 'smoke-ev-dates-1'
            AND details->>'added' = '2' AND details->>'requested' = '4' AND details->>'actor_role' = 'org_admin'
          FROM public.admin_actions WHERE request_id = 'smoke-ev-dates-1'),
    'E7: audit row must be event.add_dates with requested/added/actor_role/request_id';
  -- all duplicates: 0 added, still exactly one audit row
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-11-17 10:00'], ARRAY['2026-11-17 12:00']));
  RESET ROLE;
  ASSERT v_r = 'OK 0', 'E7: an existing start time adds nothing, got '||v_r;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'E7: a 0-added call still writes exactly one audit row';
  -- refusals: nothing written, no audit row
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-12-01 10:00', '2027-03-14 02:30'], ARRAY['2026-12-01 11:00', '2027-03-14 04:00']));
  ASSERT v_r LIKE 'ERR 22023 event_time_invalid: 2027-03-14 02:30 does not exist%', 'E7: a DST-gap date must be 22023, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-12-01 10:00', '2026-12-02 10:00'], ARRAY['2026-12-01 11:00']));
  ASSERT v_r LIKE 'ERR 22023 event_invalid%', 'E7: mismatched start/end arrays must be 22023, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-12-01 10:00'], ARRAY['2026-12-01 09:00']));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: the end time must be after%', 'E7: end before start must be 22023, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', gen_random_uuid(),
           ARRAY['2026-12-01 10:00'], ARRAY['2026-12-01 11:00']));
  ASSERT v_r LIKE 'ERR 42501 %', 'E7: an unknown event for a non-platform caller must be 42501 (no existence oracle), got '||v_r;
  RESET ROLE;
  PERFORM pg_temp.act(v_m2);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-12-01 10:00'], ARRAY['2026-12-01 11:00']));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 42501 %', 'E7: an outsider must get 42501, got '||v_r;
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', gen_random_uuid(),
           ARRAY['2026-12-01 10:00'], ARRAY['2026-12-01 11:00']));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR P0002 %', 'E7: an unknown event for a platform admin must be P0002, got '||v_r;
  ASSERT (SELECT count(*) FROM public.event_occurrences) = v_n_occ AND (SELECT count(*) FROM public.admin_actions) = v_n_aud,
    'E7: refused calls write nothing';

  -- =====================================================================
  -- E8 — cancel_event_occurrence: one audit row, outsider refused, ended date refused
  -- =====================================================================
  SELECT id INTO v_occ FROM public.event_occurrences WHERE event_id = v_ev AND starts_at = '2026-11-17 15:00+00';
  PERFORM pg_temp.act(v_m2);
  v_r := pg_temp.try(format('SELECT public.cancel_event_occurrence(%L)::text', v_occ));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 42501 %' AND (SELECT status FROM public.event_occurrences WHERE id = v_occ) = 'upcoming',
    'E8: an outsider cancel must be 42501 and change nothing, got '||v_r;
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-occ-cancel-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.cancel_event_occurrence(%L)::text', v_occ));
  RESET ROLE;
  ASSERT v_r LIKE 'OK %' AND (SELECT status FROM public.event_occurrences WHERE id = v_occ) = 'cancelled',
    'E8: the org admin cancels the date, got '||v_r;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1 AND (SELECT action = 'occurrence.cancel' AND target_type = 'event_occurrence'
            AND target_id = v_occ::text AND details->>'was_status' = 'upcoming' AND details->>'event_id' = v_ev::text
            AND details->>'actor_role' = 'org_admin'
          FROM public.admin_actions WHERE request_id = 'smoke-occ-cancel-1'),
    'E8: exactly one occurrence.cancel audit row with was_status + event_id + request_id';
  -- an ENDED date (seeded by the superuser) stays: the occurrence guard refuses the cancel
  INSERT INTO public.event_occurrences (id, event_id, starts_at, ends_at) VALUES (v_occ_p, v_ev, now() - interval '5 hours', now() - interval '3 hours');
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.cancel_event_occurrence(%L)::text', v_occ_p));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR P0001 %attendance history is permanent%' AND (SELECT status FROM public.event_occurrences WHERE id = v_occ_p) = 'upcoming',
    'E8: cancelling an ended date must be refused by the guard, got '||v_r;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after = v_before, 'E8: a refused cancel writes no audit row';

  -- =====================================================================
  -- E8b — add_event_dates restores a CANCELLED date (same row, supplied end time); a SCHEDULED
  --        date is still ignored; the count covers added + restored; one audit row lists them
  -- =====================================================================
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-restore-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences WHERE event_id = v_ev;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-11-17 10:00', '2026-11-10 10:00', '2026-11-17 10:00', '2026-12-08 10:00'],
           ARRAY['2026-11-17 13:00', '2026-11-10 12:00', '2026-11-17 14:00', '2026-12-08 11:00']));
  RESET ROLE;
  ASSERT v_r = 'OK 2', 'E8b: 1 cancelled date restored + 1 new date (scheduled + in-call repeat ignored), got '||v_r;
  ASSERT (SELECT status = 'upcoming' AND ends_at = '2026-11-17 18:00+00' FROM public.event_occurrences WHERE id = v_occ),
    'E8b: the cancelled 2026-11-17 date is scheduled again (same id) with the FIRST supplied end time (13:00 EST)';
  ASSERT (SELECT count(*) FROM public.event_occurrences WHERE event_id = v_ev) = v_n_occ + 1,
    'E8b: only the genuinely new date adds a row';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1 AND (SELECT action = 'event.add_dates' AND details->>'added' = '1'
            AND details->>'restored' = '1' AND details->'restored_ids' = jsonb_build_array(v_occ)
          FROM public.admin_actions WHERE request_id = 'smoke-ev-restore-1'),
    'E8b: exactly one audit row with added=1, restored=1 and the restored id';
  -- re-adding the now-scheduled date changes nothing
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-11-17 10:00'], ARRAY['2026-11-17 16:00']));
  RESET ROLE;
  ASSERT v_r = 'OK 0' AND (SELECT ends_at FROM public.event_occurrences WHERE id = v_occ) = '2026-11-17 18:00+00',
    'E8b: a scheduled date is ignored (end time unchanged), got '||v_r;
  -- a cancelled date that holds a check-in cannot be re-opened (w1_6a K1 guard): refused, nothing changes
  PERFORM pg_temp.act(v_m1);
  PERFORM public.cancel_event_occurrence(v_occ);
  RESET ROLE;
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_size, status) VALUES (v_occ, v_m2, 1, 'early');
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev,
           ARRAY['2026-11-17 10:00'], ARRAY['2026-11-17 13:00']));
  RESET ROLE;
  ASSERT v_r = 'ERR P0001 This event has check-ins and cannot be reopened once cancelled or completed. (2026-11-17 10:00)'
     AND (SELECT status FROM public.event_occurrences WHERE id = v_occ) = 'cancelled',
    'E8b: re-opening a cancelled date with check-ins must be refused with P0001 naming the local start, got '||v_r;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after = v_before, 'E8b: the refused restore writes no audit row';

  -- =====================================================================
  -- E9 — admin_update_event: authority, location rules, fixed time zone, retire
  -- =====================================================================
  PERFORM pg_temp.act(v_m2);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_title => ''Hijack'')::text', v_ev));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR 42501 %' AND (SELECT title FROM public.assistance_events WHERE id = v_ev) = 'Food Share',
    'E9: an outsider update must be 42501 and change nothing, got '||v_r;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_address => ''9 Elm St'')::text', v_ev));
  ASSERT v_r LIKE 'ERR 22023 event_location_invalid: the address changed%', 'E9: an address change without a location source must be 22023, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_clear => ARRAY[''rrule''])::text', v_ev));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: p_clear accepts%', 'E9: an unknown p_clear field must be 22023, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_title => ''Food Share+'', p_address => ''9 Elm St'', p_location_source => ''address'', p_lat => 44.2700, p_lng => -72.5800)::text', v_ev));
  ASSERT v_r = 'OK ' || v_ev, 'E9: an address change with a confirmed point must succeed, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.admin_actions WHERE target_id = v_ev::text AND action = 'event.update') = 1,
    'E9: the refused edits wrote no audit row; the successful edit wrote exactly one event.update row';
  ASSERT (SELECT title = 'Food Share+' AND address = '9 Elm St' AND city = 'Montpelier'
            AND abs(ST_Y(location::geometry) - 44.27) < 1e-9 AND time_zone = 'America/New_York'
          FROM public.assistance_events WHERE id = v_ev),
    'E9: the new address + point are stored; city kept; the time zone is unchanged';
  v_r := pg_temp.try(format('UPDATE public.assistance_events SET time_zone = ''America/Chicago'' WHERE id = %L RETURNING id::text', v_ev));
  ASSERT v_r LIKE 'ERR 22023 event_invalid: an event''s time zone is fixed%', 'E9: the time zone cannot change after create (even for the owner role), got '||v_r;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_clear => ARRAY[''address''])::text', v_ev));
  RESET ROLE;
  ASSERT v_r LIKE 'OK %' AND (SELECT address IS NULL AND location IS NULL FROM public.assistance_events WHERE id = v_ev),
    'E9: clearing the address drops the pin, got '||v_r;
  -- edit + retire are audited: exactly one row per call, sharing the request id
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-update-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_description => ''Every Tuesday'')::text', v_ev));
  RESET ROLE;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_r LIKE 'OK %' AND v_after - v_before = 1
     AND (SELECT action = 'event.update' AND actor_id = v_m1 AND target_type = 'event' AND target_id = v_ev::text
            AND details->>'actor_role' = 'org_admin' AND details->>'is_active' = 'true'
          FROM public.admin_actions WHERE request_id = 'smoke-ev-update-1'),
    'E9: an edit writes exactly one event.update audit row with request_id + actor_role';
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-retire-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_is_active => false)::text', v_ev2));
  RESET ROLE;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_r LIKE 'OK %' AND v_after - v_before = 1
     AND (SELECT action = 'event.retire' AND details->>'was_active' = 'true' AND details->>'is_active' = 'false'
            AND details->>'cancelled_dates' = '1' AND details->>'actor_role' = 'platform_admin'
          FROM public.admin_actions WHERE request_id = 'smoke-ev-retire-1'),
    'E9: a retire writes exactly one event.retire audit row (1 not-started date cancelled)';
  ASSERT (SELECT NOT is_active FROM public.assistance_events WHERE id = v_ev2)
     AND (SELECT status FROM public.event_occurrences WHERE event_id = v_ev2) = 'cancelled',
    'E9: retire sets is_active=false and cancels the not-started date';
  -- a retired event gains no date
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences WHERE event_id = v_ev2;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev2,
           ARRAY['2026-12-03 09:00'], ARRAY['2026-12-03 11:00']));
  RESET ROLE;
  ASSERT v_r LIKE 'ERR P0001 event_retired:%', 'E9: add_event_dates on a retired event must be P0001 event_retired, got '||v_r;
  ASSERT (SELECT count(*) FROM public.event_occurrences WHERE event_id = v_ev2) = v_n_occ
     AND (SELECT count(*) FROM public.admin_actions) = v_n_aud, 'E9: the refused add writes nothing';
  ASSERT to_regprocedure('public.admin_create_event(uuid,text,text,text,text,text,text,text,text,text,integer,boolean,double precision,double precision,text,text)') IS NULL,
    'E9: admin_create_event is dropped';
  ASSERT to_regprocedure('public.admin_update_event(uuid,text,text,text,text,text,text,text,text,text,integer,boolean,double precision,double precision,text,text,boolean,boolean,text[])') IS NULL,
    'E9: the rrule/Mapbox admin_update_event signature is dropped';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                       AND ((table_name = 'assistance_events' AND column_name = 'rrule')
                         OR (table_name = 'event_occurrences' AND column_name = 'rrule_dtstart'))),
    'E9: rrule and rrule_dtstart columns are dropped';

  -- =====================================================================
  -- E10 — constraints on the tables themselves (superuser writes)
  -- =====================================================================
  v_r := pg_temp.try(format('INSERT INTO public.event_occurrences (event_id, starts_at, ends_at) VALUES (%L, now() + interval ''20 days'', now() + interval ''20 days'') RETURNING id::text', v_ev));
  ASSERT v_r LIKE 'ERR 23514 %', 'E10: CHECK ends_at > starts_at must reject an equal end, got '||v_r;
  v_r := pg_temp.try(format('INSERT INTO public.event_occurrences (event_id, starts_at, ends_at) VALUES (%L, ''2026-11-10 15:00+00'', ''2026-11-10 18:00+00'') RETURNING id::text', v_ev));
  ASSERT v_r LIKE 'ERR 23505 %', 'E10: UNIQUE (event_id, starts_at) must reject a second date at the same start, got '||v_r;
  v_r := pg_temp.try(format('INSERT INTO public.assistance_events (org_id, title) VALUES (%L, ''No tz'') RETURNING id::text', v_c));
  ASSERT v_r LIKE 'ERR 23502 %time_zone%', 'E10: time_zone is NOT NULL, got '||v_r;
  v_r := pg_temp.try(format('INSERT INTO public.assistance_events (org_id, title, time_zone) VALUES (%L, ''Bad tz'', ''EST'') RETURNING id::text', v_c));
  ASSERT v_r LIKE 'ERR 23514 %', 'E10: time_zone must have the Area/Location shape, got '||v_r;
  v_r := pg_temp.try(format('INSERT INTO public.assistance_events (org_id, title, time_zone, idempotency_key) VALUES (%L, ''Dup key'', ''Etc/UTC'', %L) RETURNING id::text', v_c, v_key));
  ASSERT v_r LIKE 'ERR 23505 %', 'E10: UNIQUE (org_id, idempotency_key), got '||v_r;
  ASSERT (SELECT data_type = 'numeric' AND is_nullable = 'NO' AND column_default = '168'
          FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ranking_config'
            AND column_name = 'event_half_life_hours'),
    'E10: ranking_config.event_half_life_hours is numeric NOT NULL DEFAULT 168';

  -- =====================================================================
  -- E11 — feed visibility, the same for anon, guest, member, org admin and platform admin
  -- =====================================================================
  PERFORM pg_temp.act(v_m1);
  v_ev_a := substr(pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Visible', 'Etc/UTC',
                    v_now + interval '2 days', v_now + interval '2 days 2 hours', 'org')), 4)::uuid;
  v_ev_r := substr(pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Retired in progress', 'Etc/UTC',
                    v_now - interval '1 hour', v_now + interval '2 hours', 'org')), 4)::uuid;
  v_ev_q := substr(pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Retired upcoming', 'Etc/UTC',
                    v_now + interval '3 days', v_now + interval '3 days 1 hour', 'org')), 4)::uuid;
  v_ev_f := substr(pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Too far', 'Etc/UTC',
                    v_now + interval '10 days', v_now + interval '10 days 1 hour', 'org')), 4)::uuid;
  v_ev_x := substr(pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Cancelled', 'Etc/UTC',
                    v_now + interval '4 days', v_now + interval '4 days 1 hour', 'org')), 4)::uuid;
  SELECT id INTO v_occ_x FROM public.event_occurrences WHERE event_id = v_ev_x;
  PERFORM public.cancel_event_occurrence(v_occ_x);
  PERFORM public.admin_update_event(p_event_id => v_ev_r, p_is_active => false);
  RESET ROLE;
  SELECT id INTO v_occ_a FROM public.event_occurrences WHERE event_id = v_ev_a;
  SELECT id INTO v_occ_r FROM public.event_occurrences WHERE event_id = v_ev_r;
  SELECT id INTO v_occ_q FROM public.event_occurrences WHERE event_id = v_ev_q;
  SELECT id INTO v_occ_f FROM public.event_occurrences WHERE event_id = v_ev_f;
  ASSERT (SELECT status = 'upcoming' FROM public.event_occurrences WHERE id = v_occ_r),
    'E11 setup: retiring keeps the in-progress date (w1_6a D1), so only is_active can hide it';
  -- retired by the owner role without the cancel cascade: its future date stays upcoming
  UPDATE public.assistance_events SET is_active = false WHERE id = v_ev_q;
  -- an active event with an upcoming date, owned by an INACTIVE org (seeded directly)
  INSERT INTO public.assistance_events (id, org_id, title, time_zone, location)
  VALUES (v_ev_i, v_i, 'Inactive org event', 'Etc/UTC', ST_SetSRID(ST_MakePoint(-72.5780, 44.2600), 4326)::geography);
  INSERT INTO public.event_occurrences (id, event_id, starts_at, ends_at)
  VALUES (v_occ_i, v_ev_i, now() + interval '1 day', now() + interval '1 day 1 hour');

  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_feed := pg_temp.feed_events();
    RESET ROLE;
    ASSERT v_occ_a = ANY (v_feed), format('E11 [%s]: an active event of an active org with a date inside its announce window (default 7 days) MUST appear', v_viewer.label);
    -- (covers BOTH removed paths: the admin/org-admin bypass and the signed-in non-guest
    --  "in-progress date of a retired event" path — the member viewer exercises the latter)
    ASSERT NOT (v_occ_r = ANY (v_feed)), format('E11 [%s]: a retired event (date in progress) must NOT appear', v_viewer.label);
    ASSERT NOT (v_occ_q = ANY (v_feed)), format('E11 [%s]: a retired event (date upcoming) must NOT appear', v_viewer.label);
    ASSERT NOT (v_occ_i = ANY (v_feed)), format('E11 [%s]: an event of an inactive org must NOT appear', v_viewer.label);
    ASSERT NOT (v_occ_f = ANY (v_feed)), format('E11 [%s]: a date 10 days out (beyond the default 7-day announce window) must NOT appear', v_viewer.label);
    -- since 20261023000000 an admin-cancelled, announced, not-ended date keeps its event listed (as the cancelled row)
    ASSERT v_occ_x = ANY (v_feed), format('E11 [%s]: an event whose only date was cancelled is listed with that cancelled date until it ends', v_viewer.label);
  END LOOP;
  -- reactivating brings it back for everyone (both directions)
  UPDATE public.assistance_events SET is_active = true WHERE id = v_ev_q;
  UPDATE public.organizations SET is_active = true WHERE id = v_i;   -- nothing to restore: seeded while inactive
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_feed := pg_temp.feed_events();
    RESET ROLE;
    ASSERT v_occ_q = ANY (v_feed) AND v_occ_i = ANY (v_feed),
      format('E11 [%s]: a reactivated event / org MUST appear again', v_viewer.label);
  END LOOP;
  UPDATE public.organizations SET is_active = false WHERE id = v_i;
  -- the deactivation cascade cancelled its date; restore it (no session => server-side write)
  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.event_occurrences SET status = 'upcoming', cancel_reason = NULL WHERE id = v_occ_i;

  -- =====================================================================
  -- E11b — inactive organization: its ORG ADMIN is refused by every event writer (is_org_admin has
  --         no active check, so each writer checks the org itself); a PLATFORM ADMIN may manage
  --         its events, and they stay out of the feed for every viewer until the org is active
  -- =====================================================================
  SELECT count(*) INTO v_n_ev FROM public.assistance_events;
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  PERFORM pg_temp.act(v_m1);
  v_r := pg_temp.try(pg_temp.create_sql(v_i, gen_random_uuid(), 'X', 'Etc/UTC', v_now + interval '1 day', v_now + interval '1 day 1 hour', 'org'));
  ASSERT v_r LIKE 'ERR 42501 %inactive%', 'E11b: org admin create_org_event on an inactive org must be 42501, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev_i,
           ARRAY[(v_now + interval '5 days')::text], ARRAY[(v_now + interval '5 days 1 hour')::text]));
  ASSERT v_r LIKE 'ERR 42501 %inactive%', 'E11b: org admin add_event_dates on an inactive org must be 42501, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.cancel_event_occurrence(%L)::text', v_occ_i));
  ASSERT v_r LIKE 'ERR 42501 %inactive%', 'E11b: org admin cancel_event_occurrence on an inactive org must be 42501, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_title => ''Changed'')::text', v_ev_i));
  ASSERT v_r LIKE 'ERR 42501 %inactive%', 'E11b: org admin admin_update_event on an inactive org must be 42501, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev
     AND (SELECT count(*) FROM public.event_occurrences) = v_n_occ
     AND (SELECT count(*) FROM public.admin_actions) = v_n_aud
     AND (SELECT title FROM public.assistance_events WHERE id = v_ev_i) = 'Inactive org event'
     AND (SELECT status FROM public.event_occurrences WHERE id = v_occ_i) = 'upcoming',
    'E11b: the org admin''s refused writes change nothing and write no audit row';

  -- a guest (anonymous sign-in) holding an admin row of the ACTIVE org C is refused by all four
  SELECT count(*) INTO v_n_ev FROM public.assistance_events;
  SELECT count(*) INTO v_n_occ FROM public.event_occurrences;
  SELECT count(*) INTO v_n_aud FROM public.admin_actions;
  ASSERT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = v_c AND user_id = v_guest AND role = 'admin'),
    'E11b setup: the guest holds an admin row of org C';
  PERFORM pg_temp.act(v_guest, true);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Guest', 'Etc/UTC', v_now + interval '1 day', v_now + interval '1 day 1 hour', 'org'));
  ASSERT v_r LIKE 'ERR 42501 event_denied: guests%', 'E11b: guest create_org_event must be 42501, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev_a,
           ARRAY[(v_now + interval '7 days')::text], ARRAY[(v_now + interval '7 days 1 hour')::text]));
  ASSERT v_r LIKE 'ERR 42501 event_denied: guests%', 'E11b: guest add_event_dates must be 42501, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.cancel_event_occurrence(%L)::text', v_occ_a));
  ASSERT v_r LIKE 'ERR 42501 event_denied: guests%', 'E11b: guest cancel_event_occurrence must be 42501, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_title => ''Guest'')::text', v_ev_a));
  ASSERT v_r LIKE 'ERR 42501 event_denied: guests%', 'E11b: guest admin_update_event must be 42501, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev
     AND (SELECT count(*) FROM public.event_occurrences) = v_n_occ
     AND (SELECT count(*) FROM public.admin_actions) = v_n_aud
     AND (SELECT title FROM public.assistance_events WHERE id = v_ev_a) = 'Visible'
     AND (SELECT status FROM public.event_occurrences WHERE id = v_occ_a) = 'upcoming',
    'E11b: the guest''s refused writes change nothing and write no audit row';

  -- platform admin: create / add / edit / cancel all work on the inactive org
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-ev-inactive-pa"}', true);
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(pg_temp.create_sql(v_i, gen_random_uuid(), 'Planned while inactive', 'Etc/UTC',
                                        v_now + interval '1 day', v_now + interval '1 day 2 hours', 'org'));
  ASSERT v_r LIKE 'OK %', 'E11b: a platform admin may create an event on an inactive org, got '||v_r;
  v_ev_p := substr(v_r, 4)::uuid;
  v_r := pg_temp.try(format('SELECT public.add_event_dates(%L, %L::timestamp[], %L::timestamp[])::text', v_ev_p,
           ARRAY[(v_now + interval '6 days')::text], ARRAY[(v_now + interval '6 days 1 hour')::text]));
  ASSERT v_r = 'OK 1', 'E11b: a platform admin may add a date on an inactive org, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.admin_update_event(p_event_id => %L, p_description => ''Prep'')::text', v_ev_p));
  ASSERT v_r LIKE 'OK %', 'E11b: a platform admin may edit an event of an inactive org, got '||v_r;
  v_r := pg_temp.try(format('SELECT public.cancel_event_occurrence(%L)::text', v_occ_i));
  ASSERT v_r LIKE 'OK %', 'E11b: a platform admin may cancel a date of an inactive org, got '||v_r;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.admin_actions WHERE request_id = 'smoke-ev-inactive-pa'
            AND details->>'actor_role' = 'platform_admin') = 4,
    'E11b: the 4 platform-admin writes are audited (one row each)';
  SELECT id INTO v_occ FROM public.event_occurrences WHERE event_id = v_ev_p ORDER BY starts_at LIMIT 1;
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_feed := pg_temp.feed_events();
    RESET ROLE;
    ASSERT NOT (v_occ = ANY (v_feed)), format('E11b [%s]: an inactive org''s new event must NOT be in the feed', v_viewer.label);
  END LOOP;
  UPDATE public.organizations SET is_active = true WHERE id = v_i;
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('member', v_m2, false),
      ('org admin', v_m1, false), ('platform admin', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_feed := pg_temp.feed_events();
    RESET ROLE;
    ASSERT v_occ = ANY (v_feed), format('E11b [%s]: once the org is active its event MUST be in the feed', v_viewer.label);
  END LOOP;
  UPDATE public.organizations SET is_active = false WHERE id = v_i;

  -- =====================================================================
  -- E12 — posts branch unchanged: v2 post rows == ranked_feed (v1) rows for every viewer;
  --        v1 itself is byte-identical (md5 captured 2026-09-24 on origin/develop)
  -- =====================================================================
  ASSERT (SELECT md5(pg_get_functiondef('public.ranked_feed(double precision,double precision,integer,real,uuid)'::regprocedure)))
         = '2cca92d907df6b60fbc840214a9df485', 'E12: ranked_feed (v1) must be unchanged';
  FOR v_viewer IN SELECT * FROM (VALUES
      ('anon', NULL::uuid, false), ('guest', v_guest, true), ('post owner', v_m2, false),
      ('member', v_m1, false), ('platform admin (staff)', v_admin, false)) AS t(label, uid, anon) LOOP
    PERFORM pg_temp.act(v_viewer.uid, v_viewer.anon);
    v_p1 := pg_temp.posts_v1();
    v_p2 := pg_temp.posts_v2();
    RESET ROLE;
    ASSERT v_p1 <> '' AND v_p1 = v_p2, format('E12 [%s]: v2 post rows must equal v1 rows (%s vs %s)', v_viewer.label, v_p1, v_p2);
  END LOOP;

  -- =====================================================================
  -- E13 — events rank with ranking_config.event_half_life_hours (posts do not)
  -- =====================================================================
  PERFORM pg_temp.act(v_admin);
  v_r := pg_temp.try(pg_temp.create_sql(v_c, gen_random_uuid(), 'Half-life probe', 'Etc/UTC',
                                        v_now + interval '168 hours', v_now + interval '169 hours', 'org'));
  RESET ROLE;
  v_ev_h := substr(v_r, 4)::uuid;
  SELECT id INTO v_occ_h FROM public.event_occurrences WHERE event_id = v_ev_h;
  -- Since 20261023000000 an event scores max(freshness, proximity). Isolate the proximity term:
  -- announced 30 days ahead + created 60 days ago => freshness ~2^-23 (freshness: events_recurring R13).
  UPDATE public.assistance_events SET announce_days_before = 30 WHERE id = v_ev_h;
  UPDATE public.event_occurrences SET created_at = now() - interval '60 days' WHERE id = v_occ_h;
  v_score := pg_temp.event_score(v_occ_h);
  ASSERT abs(v_score - 0.5) < 1e-6, 'E13: an event starting in 168 h scores 0.5 with the default 168 h half-life, got '||v_score;
  v_p1 := pg_temp.posts_v2();
  UPDATE public.ranking_config SET event_half_life_hours = 24;
  v_score := pg_temp.event_score(v_occ_h);
  ASSERT abs(v_score - 0.0078125) < 1e-7, 'E13: event_half_life_hours=24 must give 2^-7, got '||v_score;
  ASSERT pg_temp.posts_v2() = v_p1, 'E13: event_half_life_hours must not change any post score';
  UPDATE public.ranking_config SET event_half_life_hours = 168, half_life_hours = 48;
  v_score := pg_temp.event_score(v_occ_h);
  ASSERT abs(v_score - 0.5) < 1e-6, 'E13: while proximity dominates, half_life_hours (posts) must not change the event score, got '||v_score;
  UPDATE public.ranking_config SET half_life_hours = 24;

  -- =====================================================================
  -- E14 — can_admin_org truth table: true exactly for a platform admin or an admin of the org,
  --        while the org is active and non-business; false (never an error) otherwise
  -- =====================================================================
  ASSERT has_function_privilege('anon', 'public.can_admin_org(uuid)', 'EXECUTE')
     AND has_function_privilege('authenticated', 'public.can_admin_org(uuid)', 'EXECUTE'),
    'E14: anon + authenticated may call can_admin_org';
  PERFORM pg_temp.act(v_admin);
  ASSERT public.can_admin_org(v_c) IS TRUE,  'E14: platform admin + active community org => true';
  ASSERT public.can_admin_org(v_c2) IS TRUE, 'E14: platform admin + any active non-business org => true';
  ASSERT public.can_admin_org(v_i) IS TRUE,  'E14: platform admin + INACTIVE non-business org => true';
  ASSERT public.can_admin_org(v_b) IS FALSE, 'E14: platform admin + business org => false';
  ASSERT public.can_admin_org(gen_random_uuid()) IS FALSE, 'E14: platform admin + unknown id => false';
  ASSERT public.can_admin_org(NULL) IS FALSE, 'E14: NULL => false';
  PERFORM pg_temp.act(v_m1);
  ASSERT public.can_admin_org(v_c) IS TRUE,   'E14: org admin + own active org => true';
  ASSERT public.can_admin_org(v_i) IS FALSE,  'E14: org admin + own INACTIVE org => false';
  ASSERT public.can_admin_org(v_b) IS FALSE,  'E14: org admin + own business org => false';
  ASSERT public.can_admin_org(v_c2) IS FALSE, 'E14: org admin + another org => false';
  ASSERT public.can_admin_org(gen_random_uuid()) IS FALSE, 'E14: org admin + unknown id => false';
  PERFORM pg_temp.act(v_m2);
  ASSERT public.can_admin_org(v_c2) IS FALSE, 'E14: plain MEMBER of an org => false';
  RESET ROLE;
  ASSERT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = v_c AND user_id = v_guest AND role = 'admin'),
    'E14 setup: the guest holds an admin row of org C';
  PERFORM pg_temp.act(v_guest, true);
  ASSERT public.can_admin_org(v_c) IS FALSE, 'E14: guest holding an admin row => false';
  PERFORM pg_temp.act(NULL);
  v_r := pg_temp.try(format('SELECT public.can_admin_org(%L)::text', v_c));
  ASSERT v_r = 'OK false', 'E14: anon => false without an error, got '||v_r;
  v_r := pg_temp.try('SELECT public.can_admin_org(NULL)::text');
  ASSERT v_r = 'OK false', 'E14: anon + NULL => false without an error, got '||v_r;
  RESET ROLE;
  -- the get_admin_org_list equivalence the route relies on (org admin view)
  PERFORM pg_temp.act(v_m1);
  ASSERT ARRAY(SELECT l.id FROM public.get_admin_org_list() l ORDER BY l.id)
         = ARRAY(SELECT o.id FROM public.organizations o WHERE public.can_admin_org(o.id) ORDER BY o.id),
    'E14: can_admin_org admits exactly the orgs get_admin_org_list returns (org admin)';
  PERFORM pg_temp.act(v_admin);
  ASSERT ARRAY(SELECT o.id FROM public.organizations o WHERE public.can_admin_org(o.id) ORDER BY o.id)
         = ARRAY(SELECT o.id FROM public.organizations o WHERE o.org_type <> 'business' ORDER BY o.id),
    'E14: a platform admin is admitted to exactly every non-business org (active or not)';
  RESET ROLE;

  -- =====================================================================
  -- E15 — SECURITY DEFINER hygiene of every new / changed function
  -- =====================================================================
  FOREACH v_fn IN ARRAY ARRAY[
      'public.create_org_event(uuid,uuid,text,text,timestamp,timestamp,text,text,text,text,text,text,text,text,double precision,double precision,integer,boolean,jsonb,integer)',
      'public.add_event_dates(uuid,timestamp[],timestamp[])',
      'public.cancel_event_occurrence(uuid)',
      'public.admin_update_event(uuid,text,text,text,text,text,text,text,text,integer,boolean,text,double precision,double precision,boolean,text[],jsonb,timestamp,timestamp,integer)',
      'public.admin_save_organization(uuid,jsonb)',
      'public.can_manage_org_photos(text)',
      'public.can_admin_org(uuid)',
      'public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'] LOOP
    ASSERT (SELECT p.prosecdef AND array_to_string(p.proconfig, ',') LIKE 'search_path=public%pg_temp%'
            FROM pg_proc p WHERE p.oid = v_fn::regprocedure),
      'E15: '||v_fn||' must be SECURITY DEFINER with a pinned search_path';
    ASSERT has_function_privilege('authenticated', v_fn, 'EXECUTE'), 'E15: authenticated must EXECUTE '||v_fn;
    ASSERT NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
                       WHERE p.oid = v_fn::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
      'E15: PUBLIC must hold no EXECUTE on '||v_fn;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
      'public.create_org_event(uuid,uuid,text,text,timestamp,timestamp,text,text,text,text,text,text,text,text,double precision,double precision,integer,boolean,jsonb,integer)',
      'public.add_event_dates(uuid,timestamp[],timestamp[])',
      'public.cancel_event_occurrence(uuid)',
      'public.admin_update_event(uuid,text,text,text,text,text,text,text,text,integer,boolean,text,double precision,double precision,boolean,text[],jsonb,timestamp,timestamp,integer)',
      'public.admin_save_organization(uuid,jsonb)',
      'public.can_manage_org_photos(text)'] LOOP
    ASSERT NOT has_function_privilege('anon', v_fn, 'EXECUTE'), 'E15: anon must NOT EXECUTE '||v_fn;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
      'public.event_local_to_utc(timestamp,text)', 'public.org_event_write_gate(uuid)',
      'public.assistance_events_time_zone_fixed()', 'public.record_admin_action(uuid,text,text,text,text,text,jsonb,text)'] LOOP
    ASSERT NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') AND NOT has_function_privilege('anon', v_fn, 'EXECUTE'),
      'E15: '||v_fn||' must not be client-executable';
  END LOOP;

  -- =====================================================================
  -- E16 — atomicity: a failure after the event row is written leaves nothing (local only)
  -- =====================================================================
  IF current_setting('feed.smoke_local', true) = 'on' THEN
    CREATE FUNCTION public.smoke_fail_occurrence() RETURNS trigger LANGUAGE plpgsql
      AS 'BEGIN RAISE EXCEPTION ''smoke: occurrence insert failed''; END';
    CREATE TRIGGER smoke_fail_occurrence BEFORE INSERT ON public.event_occurrences
      FOR EACH ROW EXECUTE FUNCTION public.smoke_fail_occurrence();
    v_key := gen_random_uuid();
    SELECT count(*) INTO v_n_ev FROM public.assistance_events;
    SELECT count(*) INTO v_n_aud FROM public.admin_actions;
    PERFORM pg_temp.act(v_m1);
    v_r := pg_temp.try(pg_temp.create_sql(v_c, v_key, 'Atomic', 'America/New_York', '2026-11-20 10:00', '2026-11-20 11:00', 'org'));
    RESET ROLE;
    ASSERT v_r LIKE 'ERR P0001 smoke: occurrence insert failed%', 'E16: the failure must surface to the caller, got '||v_r;
    ASSERT (SELECT count(*) FROM public.assistance_events) = v_n_ev
       AND NOT EXISTS (SELECT 1 FROM public.assistance_events WHERE idempotency_key = v_key)
       AND (SELECT count(*) FROM public.admin_actions) = v_n_aud,
      'E16: a failed date insert must leave no event and no audit row';
    DROP TRIGGER smoke_fail_occurrence ON public.event_occurrences;
    RAISE NOTICE 'PASS E16 create atomicity (local)';
  ELSE
    RAISE NOTICE 'SKIP E16 create atomicity: needs feed.smoke_local=on (creates a trigger on event_occurrences; local DB only)';
  END IF;

  RAISE NOTICE 'PASS org_scoped_admin_events smoke: E1 create, E2 idempotency, E3 location, E4 time/DST, E5 authority, E6 occurrence lockdown, E7 add dates, E8 cancel, E9 update+audit, E10 constraints, E11 feed visibility, E11b inactive org (org admin refused, platform admin allowed, kept out of the feed), E8b restore cancelled date, E12 posts unchanged, E13 event half-life, E14 can_admin_org, E15 SECDEF hygiene';
END
$smoke$;

ROLLBACK;
