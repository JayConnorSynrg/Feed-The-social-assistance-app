-- supabase/tests/community_impact.smoke.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Proof for 20261027500000_community_impact_v1: specs/impact-metrics-contract.md section 6, (a)..(g) with b2, b3,
-- c2, c3, plus c4 (a failing carry never blocks a deletion). Each outcome carries two controls:
--   [instrument] the measurement can see the failure it guards against;
--   [aim]        the measurement is pointed at the object the migration created.
-- The preflight case (pf) reads the migration file itself: pass its path as -v mig=<absolute path>.
-- DISPOSABLE DATABASE ONLY (a copy with the migration applied; never prod): the helper schema smk below is created
-- and kept; every test runs in BEGIN ... ROLLBACK. Run as a superuser (the deletion tests SET ROLE supabase_auth_admin
-- and service_role, as GoTrue and the delete-account function do):
--   psql -X -v ON_ERROR_STOP=1 -v mig=$PWD/supabase/migrations/20261027500000_community_impact_v1.sql -U supabase_admin -d <copy> \
--     -f supabase/tests/community_impact.smoke.sql 2>&1 | grep -E 'PASS|FAIL|ERROR'
-- Expected: every line PASS (count printed by the runner), 0 FAIL, 0 ERROR.

-- smoke helpers for 20261027500000_community_impact_v1 (disposable database feed_smk only)
CREATE SCHEMA smk;
GRANT USAGE ON SCHEMA smk TO anon, authenticated;
-- an account (auth.users row; on_auth_user_created makes its profile)
CREATE FUNCTION smk.u(p_anon boolean DEFAULT false, p_created timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO auth.users (id, is_anonymous, created_at, aud, role, raw_user_meta_data, raw_app_meta_data)
  VALUES (gen_random_uuid(), p_anon, p_created, 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb) RETURNING id $$;
-- p_n ledger rows of one kind for one actor, each on its own target (engagement_events_once holds)
CREATE FUNCTION smk.led(p_actor uuid, p_kind text, p_n int, p_at timestamptz DEFAULT now()) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.engagement_events (actor_id, kind, target_type, target_id, source_table, source_pk, created_at)
  SELECT p_actor, p_kind, 'smoke', gen_random_uuid(), 'smoke', gen_random_uuid()::text, p_at FROM generate_series(1, p_n) $$;
-- p_k accounts with p_rows ledger rows each; returns the ids
CREATE FUNCTION smk.crowd(p_kind text, p_k int, p_rows int DEFAULT 1, p_at timestamptz DEFAULT now()) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE v uuid[] := '{}'; x uuid;
BEGIN FOR i IN 1..p_k LOOP x := smk.u(); PERFORM smk.led(x, p_kind, p_rows, p_at); v := v || x; END LOOP; RETURN v; END $$;
CREATE FUNCTION smk.f(p_id text) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.community_impact_summary() -> p_id $$;
CREATE FUNCTION smk.ok(p_test text, p_cond boolean, p_detail text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% % | %', CASE WHEN coalesce(p_cond, false) THEN 'PASS' ELSE 'FAIL' END, p_test, p_detail; END $$;
-- one org / event / occurrence to hang check-ins on; returns the occurrence id
CREATE FUNCTION smk.occ() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE o uuid; e uuid; oc uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('smoke org') RETURNING id INTO o;
  INSERT INTO public.assistance_events (org_id, title, time_zone) VALUES (o, 'smoke event', 'America/New_York') RETURNING id INTO e;
  INSERT INTO public.event_occurrences (event_id, starts_at, ends_at) VALUES (e, now() - interval '2 hours', now() - interval '1 hour') RETURNING id INTO oc;
  RETURN oc;
END $$;
-- p_visits confirmed (or p_status) anonymous check-ins spread over p_households household keys, household_size p_size
CREATE FUNCTION smk.visits(p_occ uuid, p_visits int, p_households int, p_size int DEFAULT 3, p_status text DEFAULT 'confirmed') RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.event_checkins (occurrence_id, household_key, household_size, status, is_anonymous)
  SELECT p_occ, 'hh-' || ((g - 1) % p_households), p_size, p_status, true FROM generate_series(1, p_visits) g $$;
-- one confirmed visit by an account on its own occurrence (check-ins are unique per occurrence and account)
CREATE FUNCTION smk.member_visit(p_user uuid, p_size int DEFAULT 1, p_key text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_key, household_size, status, confirmed_at)
  VALUES (smk.occ(), p_user, p_key, p_size, 'confirmed', now()) $$;
-- p_n anonymous walk-ins (organizer_confirm with p_user NULL: no account, no household_key)
CREATE FUNCTION smk.walkins(p_occ uuid, p_n int, p_size int DEFAULT 1) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.event_checkins (occurrence_id, user_id, household_key, household_size, status, is_anonymous, confirmed_at)
  SELECT p_occ, NULL, NULL, p_size, 'confirmed', true, now() FROM generate_series(1, p_n) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA smk TO anon, authenticated;

\set ON_ERROR_STOP 1
\set QUIET 1

-- ============================== (a) anon: numbers, nothing else ==============================
BEGIN;
INSERT INTO public.community_impact_rollup (metric_id, period_start, period_end, count, contributors)
VALUES ('needs_met', '2026-10-01', '2026-11-01', 3, 1);   -- a row anon would see if it could read the table
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$
DECLARE j jsonb; keys text[]; bad text[]; c text; denied_rollup text := 'readable'; denied_ledger text := 'readable'; denied_write text := 'writable'; ctl int;
BEGIN
  j := public.community_impact_summary();
  SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(j) k;
  SELECT array_agg(k) INTO bad FROM jsonb_each(j) e(k, val)
   WHERE (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(val) x) <> ARRAY['suppressed','unit','value','window'];
  PERFORM smk.ok('a  anon calls the RPC; keys = section 2 ids', keys = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY['resources_available',
    'resources_curated','snap_retailers','zip_codes_covered','organizations_listed','event_dates_next_30_days','petition_signers','needs_met',
    'people_served_at_events','alerts_verified','member_resources_approved']) x), format('%s keys', cardinality(keys)));
  PERFORM smk.ok('a  each value object = {value,suppressed,unit,window}', bad IS NULL, coalesce(array_to_string(bad, ','), 'all 11 exact'));
  BEGIN PERFORM count(*) FROM public.community_impact_rollup; EXCEPTION WHEN insufficient_privilege THEN denied_rollup := '42501'; END;
  BEGIN PERFORM count(*) FROM public.engagement_events; EXCEPTION WHEN insufficient_privilege THEN denied_ledger := '42501'; END;
  BEGIN INSERT INTO public.community_impact_rollup (metric_id, period_start, period_end) VALUES ('needs_met','2020-01-01','2020-02-01');
  EXCEPTION WHEN insufficient_privilege THEN denied_write := '42501'; END;
  PERFORM smk.ok('a  anon SELECT community_impact_rollup', denied_rollup = '42501', denied_rollup);
  PERFORM smk.ok('a  anon SELECT engagement_events', denied_ledger = '42501', denied_ledger);
  PERFORM smk.ok('a  anon INSERT community_impact_rollup', denied_write = '42501', denied_write);
  -- [instrument] the denial catcher reports a readable table as readable (anon reads approved resources)
  SELECT count(*) INTO ctl FROM public.resources WHERE status = 'approved';
  PERFORM smk.ok('a  [instrument] anon reads a public table through the same catcher', ctl > 0, ctl || ' rows');
  -- [instrument] the suppressed answer withholds the count: no number anywhere in a suppressed object
  PERFORM smk.ok('a  [instrument] suppressed figure carries value null', j->'needs_met'->'value' = 'null'::jsonb, (j->'needs_met')::text);
END $t$;
RESET ROLE;
DO $t$ BEGIN
  -- [aim] the called function is the one this migration made, and the denied table holds a row (denial is not emptiness)
  PERFORM smk.ok('a  [aim] public.community_impact_summary() is SECDEF jsonb, no args',
    (SELECT prosecdef AND prorettype = 'jsonb'::regtype AND pronargs = 0 FROM pg_proc WHERE oid = 'public.community_impact_summary()'::regprocedure), 'pg_proc');
  PERFORM smk.ok('a  [aim] rollup holds 1 row the anon read was denied', (SELECT count(*) = 1 FROM public.community_impact_rollup), 'owner sees 1');
END $t$;
ROLLBACK;

-- authenticated: the same RPC; no rollup access; the ledger stays own-rows only
BEGIN;
INSERT INTO public.community_impact_rollup (metric_id, period_start, period_end, count, contributors) VALUES ('needs_met', '2026-10-01', '2026-11-01', 3, 1);
SELECT smk.crowd('opt_in_completed_seeker', 3, 1);
SELECT set_config('request.jwt.claims', json_build_object('role','authenticated','sub',smk.u()::text)::text, true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE r text := 'readable'; n int; BEGIN
  PERFORM smk.ok('a  authenticated calls the RPC', jsonb_typeof(public.community_impact_summary()) = 'object', 'object');
  BEGIN PERFORM count(*) FROM public.community_impact_rollup; EXCEPTION WHEN insufficient_privilege THEN r := '42501'; END;
  PERFORM smk.ok('a  authenticated SELECT community_impact_rollup', r = '42501', r);
  SELECT count(*) INTO n FROM public.engagement_events;
  PERFORM smk.ok('a  authenticated sees 0 of 3 others'' ledger rows', n = 0, n || ' rows');
END $t$;
ROLLBACK;

-- no new object other than the four this file names (rollup, its pkey index, two functions; one trigger)
DO $t$ DECLARE v text; BEGIN
  SELECT string_agg(x, ', ' ORDER BY x) INTO v FROM (
    SELECT 'rel:' || relname x FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname LIKE 'community_impact%'
    UNION ALL SELECT 'fn:' || proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'community_impact%'
    UNION ALL SELECT 'trg:' || tgname FROM pg_trigger WHERE tgname LIKE '%community_impact%') s;
  PERFORM smk.ok('a  new objects are exactly the named ones', v = 'fn:community_impact_carry_departed, fn:community_impact_summary, rel:community_impact_rollup, rel:community_impact_rollup_id_seq, rel:community_impact_rollup_pkey, trg:trg_community_impact_carry_departed', v);
END $t$;

-- ============================== (b) 9 people suppressed; 10 shown, rounded down to 5 ==============================
BEGIN;
DO $t$ DECLARE a uuid[]; t uuid; j jsonb; BEGIN
  a := smk.crowd('opt_in_completed_seeker', 4, 2) || smk.crowd('opt_in_completed_seeker', 5, 1);   -- 9 people, n = 13
  PERFORM smk.ok('b  [aim] seed is 13 rows / 9 seekers of opt_in_completed_seeker',
    (SELECT count(*) = 13 AND count(DISTINCT actor_id) = 9 FROM public.engagement_events WHERE kind = 'opt_in_completed_seeker'), 'direct count');
  j := smk.f('needs_met');
  PERFORM smk.ok('b  9 people, n=13: suppressed, value null', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  t := smk.u(); PERFORM smk.led(t, 'opt_in_completed_seeker', 1);                                 -- 10 people, n = 14
  j := smk.f('needs_met');
  PERFORM smk.ok('b  10 people, n=14: {value:10, suppressed:false}', j->'value' = '10'::jsonb AND j->>'suppressed' = 'false', j::text);
  PERFORM smk.led(t, 'opt_in_completed_seeker', 1);                                               -- n = 15
  j := smk.f('needs_met');
  PERFORM smk.ok('b  n=15 shows 15', j->'value' = '15'::jsonb, j::text);
  -- [instrument] the k gate reads the other ledger figures independently: alerts_verified has 0 people and stays suppressed
  PERFORM smk.ok('b  [instrument] other figures unaffected (alerts_verified suppressed)', smk.f('alerts_verified')->>'suppressed' = 'true', smk.f('alerts_verified')::text);
  -- petition_signers shows distinct people, not rows: 12 signers with 2 rows each -> 10
  PERFORM smk.crowd('petition_signature', 12, 2);
  PERFORM smk.ok('b  petition_signers = distinct signers rounded (12 people, 24 rows -> 10)', smk.f('petition_signers')->'value' = '10'::jsonb, smk.f('petition_signers')::text);
END $t$;
ROLLBACK;

-- ============================== (b2) one person cannot pass k alone ==============================
BEGIN;
DO $t$ DECLARE j jsonb; BEGIN
  PERFORM smk.led(smk.u(), 'safety_alert_verified', 40);
  PERFORM smk.ok('b2 [aim] 40 rows / 1 reporter of safety_alert_verified',
    (SELECT count(*) = 40 AND count(DISTINCT actor_id) = 1 FROM public.engagement_events WHERE kind = 'safety_alert_verified'), 'direct count');
  j := smk.f('alerts_verified');
  PERFORM smk.ok('b2 one account, 40 rows: suppressed', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  PERFORM smk.crowd('safety_alert_verified', 9, 1);                                               -- [instrument] 10 people, n = 49 -> 45
  j := smk.f('alerts_verified');
  PERFORM smk.ok('b2 [instrument] + 9 more reporters: shown 45 (n=49), so the 40 rows are counted once k is met', j->'value' = '45'::jsonb, j::text);
END $t$;
ROLLBACK;

-- ============================== (b3) household floor ==============================
BEGIN;
DO $t$ DECLARE oc uuid := smk.occ(); j jsonb; BEGIN
  PERFORM smk.visits(oc, 19, 19, 3);
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('b3 19 visits / 19 households: suppressed', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  PERFORM smk.visits(oc, 1, 1, 6);   -- a 20th visit, size 6 (sum 63); its key is set to a 20th household below
  UPDATE public.event_checkins SET household_key = 'hh-19' WHERE household_size = 6;
  PERFORM smk.ok('b3 [aim] 20 confirmed visits, 20 households, sum 63',
    (SELECT count(*) = 20 AND count(DISTINCT household_key) = 20 AND sum(household_size) = 63 FROM public.event_checkins WHERE status = 'confirmed'), 'direct');
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('b3 20 visits / 20 households: shown, sum 63 -> 60', j->'value' = '60'::jsonb AND j->>'suppressed' = 'false', j::text);
END $t$;
ROLLBACK;
BEGIN;
DO $t$ DECLARE oc uuid := smk.occ(); j jsonb; BEGIN
  PERFORM smk.visits(oc, 25, 1, 4);
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('b3 25 visits / 1 household: suppressed, value null', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  DELETE FROM public.event_checkins;
  PERFORM smk.visits(oc, 20, 9, 1);
  PERFORM smk.ok('b3 20 visits / 9 identities: suppressed, value null', smk.f('people_served_at_events')->>'suppressed' = 'true' AND smk.f('people_served_at_events')->'value' = 'null'::jsonb, smk.f('people_served_at_events')::text);
  PERFORM smk.visits(oc, 1, 1, 1); UPDATE public.event_checkins SET household_key = 'hh-x' WHERE id = (SELECT id FROM public.event_checkins ORDER BY checked_in_at DESC, id LIMIT 1);
  PERFORM smk.ok('b3 [instrument] 21 visits / 10 identities: shown 20 (sum 21)', smk.f('people_served_at_events')->'value' = '20'::jsonb, smk.f('people_served_at_events')::text);
  -- [aim] early check-ins are not confirmed visits: 40 early from 40 households add nothing
  PERFORM smk.visits(oc, 40, 40, 5, 'early');
  PERFORM smk.ok('b3 [aim] 40 early check-ins do not count (still 20)', smk.f('people_served_at_events')->'value' = '20'::jsonb, smk.f('people_served_at_events')::text);
  -- identity fallback: a visit with no household_key and no user counts as its own identity (id::text)
  DELETE FROM public.event_checkins;
  INSERT INTO public.event_checkins (occurrence_id, household_size, status, is_anonymous) SELECT oc, 2, 'confirmed', true FROM generate_series(1, 20);
  PERFORM smk.ok('b3 20 anonymous walk-ins (no key, no account) add no identity: suppressed, value null',
    smk.f('people_served_at_events')->>'suppressed' = 'true' AND smk.f('people_served_at_events')->'value' = 'null'::jsonb, smk.f('people_served_at_events')::text);
END $t$;
ROLLBACK;

-- ============================== (c) deleting a contributor leaves every all-time figure unchanged ==============================
BEGIN;
CREATE TEMP TABLE c_ids ON COMMIT DROP AS SELECT smk.crowd('opt_in_completed_seeker', 11, 1) a;
CREATE TEMP TABLE c_one ON COMMIT DROP AS SELECT smk.u() id;
CREATE TEMP TABLE c_guest ON COMMIT DROP AS SELECT smk.u(true, now() - interval '40 days') id;
-- the deleted member: 2 rows in Sept + 1 in Oct (needs_met), plus 1 row of each other carried kind in Oct
SELECT smk.led((SELECT id FROM c_one), 'opt_in_completed_seeker', 2, '2026-09-15 12:00+00'), smk.led((SELECT id FROM c_one), 'opt_in_completed_seeker', 1, '2026-10-03 12:00+00'),
       smk.led((SELECT id FROM c_one), 'petition_signature', 1, '2026-10-03 12:00+00'), smk.led((SELECT id FROM c_one), 'safety_alert_verified', 1, '2026-10-03 12:00+00'),
       smk.led((SELECT id FROM c_one), 'resource_approved', 1, '2026-10-03 12:00+00'),
       smk.led((SELECT id FROM c_guest), 'opt_in_completed_seeker', 2, '2026-10-20 12:00+00');
SELECT smk.crowd('petition_signature', 11), smk.crowd('safety_alert_verified', 11), smk.crowd('resource_approved', 11);
CREATE TEMP TABLE c_before ON COMMIT DROP AS SELECT public.community_impact_summary() j;
DO $t$ BEGIN
  PERFORM smk.ok('c  [aim] before: needs_met 13 people / 16 rows -> 15; all four ledger figures shown',
    (SELECT j->'needs_met'->'value' = '15'::jsonb AND j->'petition_signers'->'value' = '10'::jsonb AND j->'alerts_verified'->'value' = '10'::jsonb
            AND j->'member_resources_approved'->'value' = '10'::jsonb FROM c_before), (SELECT j::text FROM c_before));
  PERFORM smk.ok('c  [aim] the carry trigger is on auth.users, BEFORE DELETE FOR EACH ROW, enabled, the only one',
    (SELECT count(*) = 1 AND bool_and(tgfoid = 'public.community_impact_carry_departed()'::regprocedure AND tgtype = 11 AND tgenabled = 'O'
                                     AND tgrelid = 'auth.users'::regclass)
       FROM pg_trigger WHERE tgname = 'trg_community_impact_carry_departed'), 'pg_trigger');
END $t$;
-- admin path / member path: GoTrue deletes the auth.users row as supabase_auth_admin
SELECT set_config('smk.victim', (SELECT id FROM c_one)::text, true);
SET LOCAL ROLE supabase_auth_admin;
DELETE FROM auth.users WHERE id = current_setting('smk.victim')::uuid;
RESET ROLE;
DO $t$ BEGIN
  PERFORM smk.ok('c  member deleted (as supabase_auth_admin): RPC JSON identical', (SELECT j FROM c_before) = public.community_impact_summary(), public.community_impact_summary()::text);
  PERFORM smk.ok('c  rollup (metric|month|end|count|contributors|k): needs_met Sept 2/1/1, Oct 1/0/0',
    (SELECT array_agg(format('%s|%s|%s|%s|%s|%s', metric_id, period_start, period_end, count, contributors, k_contributors) ORDER BY metric_id, period_start) FROM public.community_impact_rollup)
      = ARRAY['alerts_verified|2026-10-01|2026-11-01|1|1|1', 'member_resources_approved|2026-10-01|2026-11-01|1|1|1', 'needs_met|2026-09-01|2026-10-01|2|1|1',
              'needs_met|2026-10-01|2026-11-01|1|0|0', 'petition_signers|2026-10-01|2026-11-01|1|1|1'],
    (SELECT string_agg(format('%s|%s|%s|%s|%s', metric_id, period_start, count, contributors, k_contributors), '; ' ORDER BY metric_id, period_start) FROM public.community_impact_rollup));
  PERFORM smk.ok('c  [aim] the member''s ledger rows are gone (the cascade ran)', (SELECT count(*) = 0 FROM public.engagement_events WHERE actor_id = (SELECT id FROM c_one)), 'live rows');
END $t$;
-- guest-cleanup cron statement, verbatim
DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';
DO $t$ BEGIN
  PERFORM smk.ok('c  guest deleted by cleanup-anonymous-users: RPC JSON identical', (SELECT j FROM c_before) = public.community_impact_summary(), public.community_impact_summary()::text);
  PERFORM smk.ok('c  rollup needs_met Oct now count 3 / contributors 1 / k 0 (the guest adds to the value, not to k)',
    (SELECT sum(count) = 3 AND sum(contributors) = 1 AND sum(k_contributors) = 0 FROM public.community_impact_rollup WHERE metric_id = 'needs_met' AND period_start = '2026-10-01'), 'rows (append-only)');
  PERFORM smk.ok('c  rollup stores no user id (columns)', (SELECT array_agg(attname::text ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.community_impact_rollup'::regclass AND attnum > 0 AND NOT attisdropped)
     = ARRAY['id','metric_id','period_start','period_end','count','contributors','k_contributors','written_at'], 'row id + seven count/period columns');
END $t$;
ROLLBACK;
-- [instrument] the same deletion with the carry disabled DOES lower the figure, so (c) can fail
BEGIN;
CREATE TEMP TABLE i_one ON COMMIT DROP AS SELECT smk.u() id;
SELECT smk.crowd('opt_in_completed_seeker', 10, 1), smk.led((SELECT id FROM i_one), 'opt_in_completed_seeker', 5);
CREATE TEMP TABLE i_before ON COMMIT DROP AS SELECT smk.f('needs_met') j;
ALTER TABLE auth.users DISABLE TRIGGER trg_community_impact_carry_departed;
DELETE FROM auth.users WHERE id = (SELECT id FROM i_one);
DO $t$ BEGIN PERFORM smk.ok('c  [instrument] carry disabled: the same delete lowers needs_met (15 -> 10)',
  (SELECT j FROM i_before) = '{"value":15,"suppressed":false,"unit":"completions","window":"all_time"}'::jsonb AND smk.f('needs_met')->'value' = '10'::jsonb,
  (SELECT j::text FROM i_before) || ' -> ' || smk.f('needs_met')::text); END $t$;
ROLLBACK;
-- member path as the delete-account edge function does it: dependent rows first (service_role), then the auth user
BEGIN;
CREATE TEMP TABLE m_one ON COMMIT DROP AS SELECT smk.u() id;
SELECT smk.crowd('resource_approved', 11, 1), smk.led((SELECT id FROM m_one), 'resource_approved', 2);
CREATE TEMP TABLE m_before ON COMMIT DROP AS SELECT public.community_impact_summary() j;
SELECT set_config('smk.victim', (SELECT id FROM m_one)::text, true);
SET LOCAL ROLE service_role;
DELETE FROM public.posts WHERE user_id = current_setting('smk.victim')::uuid;
DELETE FROM public.profiles WHERE id = current_setting('smk.victim')::uuid;
RESET ROLE;
SET LOCAL ROLE supabase_auth_admin;
DELETE FROM auth.users WHERE id = current_setting('smk.victim')::uuid;
RESET ROLE;
DO $t$ BEGIN PERFORM smk.ok('c  self-delete shape (profiles first, then auth user): RPC JSON identical', (SELECT j FROM m_before) = public.community_impact_summary(),
  (SELECT count::text || '/' || contributors FROM public.community_impact_rollup WHERE metric_id = 'member_resources_approved')); END $t$;
ROLLBACK;

-- at exactly k: one member's deletion keeps the figure open only through the carried k
BEGIN;
CREATE TEMP TABLE ck ON COMMIT DROP AS SELECT unnest(smk.crowd('opt_in_completed_seeker', 10, 1)) id;
SELECT smk.led(id, 'petition_signature', 1) FROM ck;
CREATE TEMP TABLE ck_before ON COMMIT DROP AS SELECT public.community_impact_summary() j;
DELETE FROM auth.users WHERE id = (SELECT id FROM ck ORDER BY id LIMIT 1);
DO $t$ BEGIN
  PERFORM smk.ok('c  [aim] at k=10: needs_met and petition_signers shown 10 before',
    (SELECT j->'needs_met'->'value' = '10'::jsonb AND j->'petition_signers'->'value' = '10'::jsonb FROM ck_before), 'before');
  PERFORM smk.ok('c  at k=10, one member deleted (9 live + 1 carried): JSON identical', (SELECT j FROM ck_before) = public.community_impact_summary(),
    (public.community_impact_summary()->'needs_met')::text);
END $t$;
ROLLBACK;

-- ============================== (c2) rows deleted for another reason are not carried ==============================
BEGIN;
CREATE TEMP TABLE c2_a ON COMMIT DROP AS SELECT smk.u() id;
SELECT smk.led((SELECT id FROM c2_a), 'petition_signature', 3);
DELETE FROM public.engagement_events WHERE actor_id = (SELECT id FROM c2_a) AND ctid = (SELECT min(ctid) FROM public.engagement_events WHERE actor_id = (SELECT id FROM c2_a));
DO $t$ BEGIN
  PERFORM smk.ok('c2 [aim] the live actor''s row was deleted (3 -> 2)', (SELECT count(*) = 2 FROM public.engagement_events WHERE actor_id = (SELECT id FROM c2_a)), 'live rows');
  PERFORM smk.ok('c2 direct delete of a live actor''s row: rollup unchanged (empty)', (SELECT count(*) = 0 FROM public.community_impact_rollup), 'rollup rows');
END $t$;
DELETE FROM auth.users WHERE id = (SELECT id FROM c2_a);
DO $t$ BEGIN PERFORM smk.ok('c2 [instrument] the same actor''s remaining rows ARE carried on account deletion (count 2, contributors 1)',
  (SELECT sum(count) = 2 AND sum(contributors) = 1 FROM public.community_impact_rollup WHERE metric_id = 'petition_signers'), 'rollup'); END $t$;
ROLLBACK;

-- ============================== (c3) re-running cannot double-count ==============================
BEGIN;
CREATE TEMP TABLE c3 ON COMMIT DROP AS SELECT unnest(smk.crowd('opt_in_completed_seeker', 4, 3)) id;   -- 4 accounts x 3 rows
CREATE TEMP TABLE c3_rows ON COMMIT DROP AS SELECT count(*) n FROM public.engagement_events;
-- two accounts in ONE statement
DELETE FROM auth.users WHERE id IN (SELECT id FROM c3 ORDER BY id LIMIT 2);
DO $t$ BEGIN PERFORM smk.ok('c3 two accounts, one statement: count 6, contributors 2',
  (SELECT sum(count) = 6 AND sum(contributors) = 2 FROM public.community_impact_rollup), (SELECT sum(count) || '/' || sum(contributors) FROM public.community_impact_rollup)); END $t$;
-- the same statement again (path fires twice): nothing more
DELETE FROM auth.users WHERE id IN (SELECT id FROM c3 ORDER BY id LIMIT 2);
DO $t$ BEGIN PERFORM smk.ok('c3 same delete re-run: still 6 / 2', (SELECT sum(count) = 6 AND sum(contributors) = 2 FROM public.community_impact_rollup), 'rollup'); END $t$;
-- the other two in TWO statements
DELETE FROM auth.users WHERE id = (SELECT id FROM c3 ORDER BY id OFFSET 2 LIMIT 1);
DELETE FROM auth.users WHERE id = (SELECT id FROM c3 ORDER BY id OFFSET 3 LIMIT 1);
DELETE FROM auth.users WHERE id = (SELECT id FROM c3 ORDER BY id OFFSET 3 LIMIT 1);
DO $t$ BEGIN
  PERFORM smk.ok('c3 two more in two statements (+1 repeat): carried 12 = rows removed, contributors 4',
    (SELECT sum(count) = (SELECT n FROM c3_rows) AND sum(contributors) = 4 FROM public.community_impact_rollup), (SELECT sum(count) || '/' || sum(contributors) FROM public.community_impact_rollup));
  PERFORM smk.ok('c3 [aim] all 12 ledger rows are gone', (SELECT count(*) = 0 FROM public.engagement_events), 'live rows');
END $t$;
-- cleanup cron twice on two guests in one statement
CREATE TEMP TABLE c3g ON COMMIT DROP AS SELECT smk.u(true, now() - interval '45 days') id FROM generate_series(1, 2);
SELECT smk.led(id, 'opt_in_completed_seeker', 2) FROM c3g;
DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';
DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';
DO $t$ BEGIN PERFORM smk.ok('c3 cleanup cron x2 on 2 guests (2 rows each): +4 rows, +2 contributors once, k stays 4 (members only)',
  (SELECT sum(count) = 16 AND sum(contributors) = 6 AND sum(k_contributors) = 4 FROM public.community_impact_rollup),
  (SELECT sum(count) || '/' || sum(contributors) || '/' || sum(k_contributors) FROM public.community_impact_rollup)); END $t$;
-- [instrument] the totals check sees an extra carry: a fabricated duplicate breaks the equality
DO $t$ BEGIN PERFORM smk.ok('c3 [instrument] the equality detects a double count (16+1 <> 16)', NOT ((SELECT sum(count) + 1 FROM public.community_impact_rollup) = 16), 'arith'); END $t$;
ROLLBACK;

-- ============================== (c4) a failing carry never blocks the deletion ==============================
BEGIN;
CREATE TEMP TABLE c4 ON COMMIT DROP AS SELECT smk.u() id;
SELECT smk.led((SELECT id FROM c4), 'opt_in_completed_seeker', 2);
ALTER TABLE public.community_impact_rollup ADD CONSTRAINT smk_force_fail CHECK (count < 0) NOT VALID;
DELETE FROM auth.users WHERE id = (SELECT id FROM c4);
DO $t$ BEGIN
  PERFORM smk.ok('c4 carry failed, deletion went through', (SELECT count(*) = 0 FROM auth.users WHERE id = (SELECT id FROM c4)), 'auth.users row gone');
  PERFORM smk.ok('c4 the failure is logged (app_logs engagement.ledger.skipped, context impact_carry)',
    (SELECT count(*) = 1 FROM public.app_logs WHERE event = 'engagement.ledger.skipped' AND context->>'context' = 'impact_carry'), 'app_logs');
END $t$;
ROLLBACK;

-- ============================== (d) EXECUTE + search_path ==============================
DO $t$ DECLARE a text; BEGIN
  SELECT proacl::text INTO a FROM pg_proc WHERE oid = 'public.community_impact_summary()'::regprocedure;
  PERFORM smk.ok('d  summary proacl: no PUBLIC, anon=X, authenticated=X', a !~ '(^|[{,])=X' AND a ~ 'anon=X' AND a ~ 'authenticated=X', a);
  PERFORM smk.ok('d  summary proconfig + prosecdef', (SELECT proconfig = ARRAY['search_path=public, pg_temp'] AND prosecdef AND provolatile = 's'
     FROM pg_proc WHERE oid = 'public.community_impact_summary()'::regprocedure), (SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.community_impact_summary()'::regprocedure));
  SELECT proacl::text INTO a FROM pg_proc WHERE oid = 'public.community_impact_carry_departed()'::regprocedure;
  PERFORM smk.ok('d  carry: pinned, SECDEF, no PUBLIC/anon/authenticated EXECUTE', a !~ '(^|[{,])=X' AND a !~ 'anon=' AND a !~ 'authenticated='
     AND (SELECT proconfig = ARRAY['search_path=public, pg_temp', 'lock_timeout=100ms'] AND prosecdef FROM pg_proc WHERE oid = 'public.community_impact_carry_departed()'::regprocedure), a);
  PERFORM smk.ok('d  [instrument] has_function_privilege agrees: anon yes / PUBLIC-only role no',
    has_function_privilege('anon', 'public.community_impact_summary()', 'EXECUTE') AND NOT has_function_privilege('pgbouncer', 'public.community_impact_summary()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.community_impact_carry_departed()', 'EXECUTE'), 'has_function_privilege');
  -- [instrument] the PUBLIC pattern matches a real PUBLIC grant
  PERFORM smk.ok('d  [instrument] the =X/ pattern detects PUBLIC on a function that has it', (SELECT proacl::text ~ '(^|[{,])=X' FROM pg_proc WHERE oid = 'auth.uid()'::regprocedure), (SELECT proacl::text FROM pg_proc WHERE oid = 'auth.uid()'::regprocedure));
END $t$;

-- ============================== (e) rollup closed to clients ==============================
DO $t$ BEGIN
  PERFORM smk.ok('e  rollup: RLS on, 0 policies, no anon/authenticated in relacl',
    (SELECT relrowsecurity AND coalesce(relacl::text, '') !~ '(anon|authenticated)=' AND (SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_impact_rollup')
       FROM pg_class WHERE oid = 'public.community_impact_rollup'::regclass), (SELECT relacl::text FROM pg_class WHERE oid = 'public.community_impact_rollup'::regclass));
  PERFORM smk.ok('e  [instrument] the same relacl test flags authenticated on engagement_events',
    (SELECT relacl::text ~ 'authenticated=' FROM pg_class WHERE oid = 'public.engagement_events'::regclass), (SELECT relacl::text FROM pg_class WHERE oid = 'public.engagement_events'::regclass));
  PERFORM smk.ok('e  [aim] no column-level grant on the rollup', NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.community_impact_rollup'::regclass AND attacl IS NOT NULL), 'attacl');
  PERFORM smk.ok('e  rollup id sequence: no anon/authenticated/PUBLIC grant', (SELECT coalesce(relacl::text, '') !~ '(anon|authenticated)=' AND coalesce(relacl::text, '') !~ '(^|[{,])='
     FROM pg_class WHERE oid = 'public.community_impact_rollup_id_seq'::regclass), (SELECT relacl::text FROM pg_class WHERE oid = 'public.community_impact_rollup_id_seq'::regclass));
END $t$;

-- ============================== (f) staff and admin rows count ==============================
BEGIN;
DO $t$ DECLARE adm uuid := smk.u(); BEGIN
  PERFORM set_config('feed.tier_write', 'on', true); UPDATE public.profiles SET admin_tier = 'platform_admin' WHERE id = adm;   -- is_admin follows the tier (sync_tier_flags_trigger)
  PERFORM smk.crowd('resource_approved', 9, 1);
  PERFORM smk.ok('f  [instrument] 9 members alone: suppressed', smk.f('member_resources_approved')->>'suppressed' = 'true', smk.f('member_resources_approved')::text);
  PERFORM smk.led(adm, 'resource_approved', 1);
  PERFORM smk.ok('f  [aim] the 10th contributor is a platform admin', (SELECT is_admin AND admin_tier = 'platform_admin' FROM public.profiles WHERE id = adm), 'profiles.is_admin + admin_tier');
  PERFORM smk.ok('f  admin''s row makes 10 people: shown 10', smk.f('member_resources_approved')->'value' = '10'::jsonb, smk.f('member_resources_approved')::text);
END $t$;
ROLLBACK;

-- ============================== (g) catalog figures exact ==============================
BEGIN;
DO $t$ DECLARE j jsonb; o uuid; e uuid; d0 jsonb; BEGIN
  j := public.community_impact_summary();
  PERFORM smk.ok('g  catalog figures equal direct counts',
    (j->'resources_available'->>'value')::bigint = (SELECT count(*) FROM public.resources WHERE status = 'approved')
    AND (j->'resources_curated'->>'value')::bigint = (SELECT count(*) FROM public.resources WHERE status = 'approved' AND source NOT IN ('imls','hud'))
    AND (j->'snap_retailers'->>'value')::bigint = (SELECT count(*) FROM public.snap_retailers)
    AND (j->'zip_codes_covered'->>'value')::bigint = (SELECT count(DISTINCT zip_code) FROM public.resources WHERE status = 'approved' AND nullif(btrim(zip_code), '') IS NOT NULL)
    AND (j->'organizations_listed'->>'value')::bigint = (SELECT count(*) FROM public.organizations WHERE is_active AND status = 'approved')
    AND (j->'event_dates_next_30_days'->>'value')::bigint = (SELECT count(*) FROM public.event_occurrences o JOIN public.assistance_events e ON e.id = o.event_id
          WHERE e.is_active AND o.status = 'upcoming' AND o.starts_at >= now() AND o.starts_at < now() + interval '30 days')
    AND NOT EXISTS (SELECT 1 FROM jsonb_each(j) x(k, v) WHERE k IN ('resources_available','resources_curated','snap_retailers','zip_codes_covered','organizations_listed','event_dates_next_30_days')
          AND (v->>'suppressed')::boolean), j::text);
  d0 := j;
  -- [instrument] each catalog rule moves with exactly its own source; [aim] rows outside the rule do not
  INSERT INTO public.resources (name, status, source, zip_code) VALUES ('g1', 'approved', 'imls', '05401'), ('g2', 'approved', 'admin_added', ' '), ('g3', 'pending', 'admin_added', '99999');
  INSERT INTO public.organizations (name, status, is_active) VALUES ('g org ok', 'approved', true), ('g org off', 'approved', false), ('g org pending', 'pending', true) ;
  INSERT INTO public.organizations (name) VALUES ('g org 2') RETURNING id INTO o;
  UPDATE public.organizations SET is_active = false WHERE id = o;
  INSERT INTO public.organizations (name) VALUES ('g org 3') RETURNING id INTO o;
  INSERT INTO public.assistance_events (org_id, title, time_zone) VALUES (o, 'g ev', 'America/New_York') RETURNING id INTO e;
  INSERT INTO public.event_occurrences (event_id, starts_at, ends_at) VALUES (e, now() + interval '2 days', now() + interval '2 days 1 hour'),
        (e, now() + interval '31 days', now() + interval '31 days 1 hour'), (e, now() - interval '1 day', now() - interval '23 hours');
  j := public.community_impact_summary();
  PERFORM smk.ok('g  [instrument] +2 approved -> resources_available +2', (j->'resources_available'->>'value')::int - (d0->'resources_available'->>'value')::int = 2, 'delta');
  PERFORM smk.ok('g  [aim] imls excluded from curated (+1 only: admin_added)', (j->'resources_curated'->>'value')::int - (d0->'resources_curated'->>'value')::int = 1, 'delta');
  PERFORM smk.ok('g  [aim] blank zip and pending zip excluded (+1 zip: 05401 unless present)', (j->'zip_codes_covered'->>'value')::int - (d0->'zip_codes_covered'->>'value')::int
     = CASE WHEN EXISTS (SELECT 1 FROM public.resources WHERE status='approved' AND zip_code='05401' AND name <> 'g1') THEN 0 ELSE 1 END, 'delta');
  PERFORM smk.ok('g  [aim] orgs: +2 (g org ok, g org 3); inactive and pending excluded', (j->'organizations_listed'->>'value')::int - (d0->'organizations_listed'->>'value')::int = 2, 'delta');
  PERFORM smk.ok('g  [aim] event dates: +1 (in 30 days); day 31 and yesterday excluded', (j->'event_dates_next_30_days'->>'value')::int - (d0->'event_dates_next_30_days'->>'value')::int = 1, 'delta');
END $t$;
ROLLBACK;

-- ============================== (p2) anonymous walk-ins open nothing and reveal nothing ==============================
-- review finding P2: one organizer's walk-ins passed both floors alone, then size-1 steps exposed another household's size
BEGIN;
DO $t$ DECLARE oc uuid := smk.occ(); j jsonb; changed int := 0; BEGIN
  PERFORM smk.member_visit(smk.u(), 3);          -- the victim: one member household of 3, at another org's event
  PERFORM smk.walkins(oc, 19, 1);
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('p2 [aim] 20 confirmed visits: 19 walk-ins (no account, no key) + 1 member',
    (SELECT count(*) = 20 AND count(*) FILTER (WHERE user_id IS NULL AND household_key IS NULL) = 19 FROM public.event_checkins WHERE status = 'confirmed'), 'direct');
  PERFORM smk.ok('p2 19 walk-ins + 1 member: suppressed, value null', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  FOR i IN 1..30 LOOP
    PERFORM smk.walkins(oc, 1, 1);
    IF smk.f('people_served_at_events') IS DISTINCT FROM j THEN changed := changed + 1; END IF;
  END LOOP;
  PERFORM smk.ok('p2 30 more size-1 walk-ins, one at a time: the answer never changes (no rounding step to read)', changed = 0, changed || ' changes');
  -- [instrument] the figure opens once 10 member identities exist, and then the walk-ins are in the value
  FOR i IN 1..9 LOOP PERFORM smk.member_visit(smk.u(), 1); END LOOP;
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('p2 [instrument] + 9 members (10 identities): shown 60 (sum 3 + 49 walk-ins + 9 = 61)', j->'value' = '60'::jsonb, j::text);
END $t$;
ROLLBACK;

-- ============================== (p3) a deleted account's visits never become many households ==============================
-- review finding P3: ON DELETE SET NULL turned one member's 20 visits into 20 identities (id::text) and opened {value:80}
BEGIN;
CREATE TEMP TABLE p3m ON COMMIT DROP AS SELECT smk.u() id;
SELECT smk.member_visit((SELECT id FROM p3m), 4) FROM generate_series(1, 20);
CREATE TEMP TABLE p3_before ON COMMIT DROP AS SELECT smk.f('people_served_at_events') j;
SELECT set_config('smk.victim', (SELECT id FROM p3m)::text, true);
SET LOCAL ROLE supabase_auth_admin;
DELETE FROM auth.users WHERE id = current_setting('smk.victim')::uuid;
RESET ROLE;
DO $t$ BEGIN
  PERFORM smk.ok('p3 one member, 20 visits: suppressed, value null before', (SELECT j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb FROM p3_before), (SELECT j::text FROM p3_before));
  PERFORM smk.ok('p3 after the member deleted the account: still suppressed, value null', smk.f('people_served_at_events')->>'suppressed' = 'true'
     AND smk.f('people_served_at_events')->'value' = 'null'::jsonb, smk.f('people_served_at_events')::text);
  PERFORM smk.ok('p3 [aim] the 20 visits stayed, account cleared (user_id NULL)', (SELECT count(*) = 20 AND bool_and(user_id IS NULL) FROM public.event_checkins WHERE status = 'confirmed'), 'direct');
  PERFORM smk.ok('p3 carried identities: exactly 1 (one person, not 20 visits)', (SELECT sum(k_contributors) = 1 AND sum(contributors) = 1 AND sum(count) = 0
     FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events'), (SELECT string_agg(format('%s|%s|%s', count, contributors, k_contributors), ';') FROM public.community_impact_rollup));
END $t$;
ROLLBACK;
-- deletion never lowers the identity count: multi-row, one statement, two statements, repeats, the guest cron
BEGIN;
CREATE TEMP TABLE p3c ON COMMIT DROP AS SELECT smk.u() id FROM generate_series(1, 10);
CREATE TEMP TABLE p3k ON COMMIT DROP AS SELECT smk.u() id;                                 -- a member whose visits carry a household_key
CREATE TEMP TABLE p3g ON COMMIT DROP AS SELECT smk.u(true, now() - interval '40 days') id;  -- a guest with visits
SELECT smk.member_visit(id, 1), smk.member_visit(id, 1) FROM p3c;                           -- 10 identities, 20 visits, sum 20
SELECT smk.member_visit((SELECT id FROM p3k), 2, 'hh-keyed'), smk.member_visit((SELECT id FROM p3g), 3);
CREATE TEMP TABLE p3c_before ON COMMIT DROP AS SELECT public.community_impact_summary() j;
DO $t$ BEGIN PERFORM smk.ok('p3 [aim] before: 23 visits, 11 identities (10 members + 1 key; the guest is none), shown 25 (sum 25)',
  (SELECT j->'people_served_at_events'->'value' = '25'::jsonb FROM p3c_before), (SELECT (j->'people_served_at_events')::text FROM p3c_before)); END $t$;
DELETE FROM auth.users WHERE id IN (SELECT id FROM p3c ORDER BY id LIMIT 2);                -- two accounts, one statement
DO $t$ BEGIN PERFORM smk.ok('p3 two members deleted in one statement: JSON identical; 2 identities carried',
  (SELECT j FROM p3c_before) = public.community_impact_summary() AND (SELECT sum(k_contributors) = 2 FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events'),
  (SELECT sum(k_contributors)::text FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events')); END $t$;
DELETE FROM auth.users WHERE id IN (SELECT id FROM p3c ORDER BY id LIMIT 2);                -- the same delete again
DELETE FROM auth.users WHERE id = (SELECT id FROM p3c ORDER BY id OFFSET 2 LIMIT 1);
DELETE FROM auth.users WHERE id = (SELECT id FROM p3c ORDER BY id OFFSET 2 LIMIT 1);        -- and again
DO $t$ BEGIN PERFORM smk.ok('p3 repeat + a third member in its own statement twice: JSON identical; 3 identities carried',
  (SELECT j FROM p3c_before) = public.community_impact_summary() AND (SELECT sum(k_contributors) = 3 FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events'),
  (SELECT sum(k_contributors)::text FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events')); END $t$;
DELETE FROM auth.users WHERE id = (SELECT id FROM p3k);
DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';
DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';
DO $t$ BEGIN
  PERFORM smk.ok('p3 keyed member + guest (cron x2) deleted: JSON identical', (SELECT j FROM p3c_before) = public.community_impact_summary(), public.community_impact_summary()::text);
  PERFORM smk.ok('p3 [aim] keyed member carries no identity (its key survives); guest carries contributors 1, k 0',
    (SELECT sum(k_contributors) = 3 AND sum(contributors) = 4 FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events'),
    (SELECT sum(contributors) || '/' || sum(k_contributors) FROM public.community_impact_rollup WHERE metric_id = 'people_served_at_events'));
END $t$;
ROLLBACK;
-- [instrument] with the carry disabled, one member's deletion closes the figure, so the p3 checks can fail
BEGIN;
CREATE TEMP TABLE p3i ON COMMIT DROP AS SELECT smk.u() id FROM generate_series(1, 10);
SELECT smk.member_visit(id, 1), smk.member_visit(id, 1) FROM p3i;
ALTER TABLE auth.users DISABLE TRIGGER trg_community_impact_carry_departed;
DELETE FROM auth.users WHERE id = (SELECT id FROM p3i ORDER BY id LIMIT 1);
DO $t$ BEGIN PERFORM smk.ok('p3 [instrument] carry disabled: deleting 1 of 10 members suppresses the figure (identities 10 -> 9)',
  smk.f('people_served_at_events')->>'suppressed' = 'true', smk.f('people_served_at_events')::text); END $t$;
ROLLBACK;

-- ============================== (sybil) guest accounts add to values, never to k ==============================
BEGIN;
DO $t$ DECLARE j jsonb; g uuid; BEGIN
  PERFORM smk.crowd('opt_in_completed_seeker', 9, 1);
  FOR i IN 1..20 LOOP g := smk.u(true, now() - interval '40 days'); PERFORM smk.led(g, 'opt_in_completed_seeker', 1); END LOOP;
  j := smk.f('needs_met');
  PERFORM smk.ok('sybil 9 members + 20 guests (29 people, n=29): needs_met suppressed, value null', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  PERFORM smk.crowd('opt_in_completed_seeker', 1, 1);
  j := smk.f('needs_met');
  PERFORM smk.ok('sybil [instrument] + 1 member (k=10): shown 30, the guests'' rows are in the value', j->'value' = '30'::jsonb, j::text);
  PERFORM smk.crowd('petition_signature', 9, 1);
  FOR i IN 1..20 LOOP g := smk.u(true, now() - interval '40 days'); PERFORM smk.led(g, 'petition_signature', 1); END LOOP;
  PERFORM smk.ok('sybil 9 member + 20 guest signers: petition_signers suppressed, value null',
    smk.f('petition_signers')->>'suppressed' = 'true' AND smk.f('petition_signers')->'value' = 'null'::jsonb, smk.f('petition_signers')::text);
  PERFORM smk.crowd('petition_signature', 1, 1);
  PERFORM smk.ok('sybil [instrument] + 1 member signer: shown 30 distinct signers', smk.f('petition_signers')->'value' = '30'::jsonb, smk.f('petition_signers')::text);
  -- events: 9 member visits + 11 guest visits = 20 visits, 9 identities
  FOR i IN 1..9 LOOP PERFORM smk.member_visit(smk.u(), 1); END LOOP;
  FOR i IN 1..11 LOOP PERFORM smk.member_visit(smk.u(true, now() - interval '40 days'), 1); END LOOP;
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('sybil 9 member + 11 guest visits: people_served suppressed, value null', j->>'suppressed' = 'true' AND j->'value' = 'null'::jsonb, j::text);
  -- [aim] the guest filter reads auth.users.is_anonymous: one guest upgraded to a member makes 10 identities
  UPDATE auth.users SET is_anonymous = false WHERE id = (SELECT c.user_id FROM public.event_checkins c JOIN auth.users u ON u.id = c.user_id WHERE u.is_anonymous LIMIT 1);
  j := smk.f('people_served_at_events');
  PERFORM smk.ok('sybil [aim] one guest becomes a member: 10 identities, shown 20', j->'value' = '20'::jsonb, j::text);
END $t$;
CREATE TEMP TABLE sy_before ON COMMIT DROP AS SELECT public.community_impact_summary() j;
DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';   -- the nightly guest cleanup
DO $t$ BEGIN
  PERFORM smk.ok('sybil cleanup cron deletes every guest: JSON identical (values and k unchanged)', (SELECT j FROM sy_before) = public.community_impact_summary(), public.community_impact_summary()::text);
  PERFORM smk.ok('sybil [aim] the cron removed 50 guests; their rows carried with k 0',
    (SELECT count(*) = 0 FROM auth.users WHERE is_anonymous) AND (SELECT sum(k_contributors) = 0 AND sum(contributors) = 50 FROM public.community_impact_rollup),
    (SELECT sum(count) || '/' || sum(contributors) || '/' || sum(k_contributors) FROM public.community_impact_rollup));
END $t$;
ROLLBACK;

-- ============================== (pf) a second BEFORE DELETE row trigger on auth.users refuses the migration ==============================
-- the preflight block of the migration file itself, run on this database put back to its pre-migration shape (rolled back)
SELECT set_config('smk.preflight', substring(pg_read_file(:'mig') FROM '(DO \$preflight\$.*?\$preflight\$;)'), false);
BEGIN;
DROP TRIGGER trg_community_impact_carry_departed ON auth.users;
DROP FUNCTION public.community_impact_carry_departed();
DROP FUNCTION public.community_impact_summary();
DROP TABLE public.community_impact_rollup;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261027500000';
DO $t$ DECLARE st text := 'none'; dt text := ''; BEGIN
  PERFORM smk.ok('pf [aim] the preflight block was read from the migration file', current_setting('smk.preflight') LIKE 'DO $preflight$%no BEFORE DELETE row trigger on auth.users%', length(current_setting('smk.preflight')) || ' chars');
  BEGIN EXECUTE current_setting('smk.preflight'); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, dt = PG_EXCEPTION_DETAIL; END;
  PERFORM smk.ok('pf [instrument] on the pre-migration shape the preflight passes', st = 'none', st || ' ' || dt);
END $t$;
CREATE FUNCTION public.smk_other_before_delete() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN OLD; END';
CREATE TRIGGER zz_other_before_delete BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.smk_other_before_delete();
DO $t$ DECLARE st text := 'none'; dt text := ''; BEGIN
  BEGIN EXECUTE current_setting('smk.preflight'); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, dt = PG_EXCEPTION_DETAIL; END;
  PERFORM smk.ok('pf another BEFORE DELETE row trigger on auth.users: refused 55000 naming it',
    st = '55000' AND dt = 'no BEFORE DELETE row trigger on auth.users yet (this file adds the only one)', st || ' ' || dt);
END $t$;
ROLLBACK;
