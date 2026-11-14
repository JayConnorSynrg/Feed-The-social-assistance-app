-- r3_foundation.smoke.sql
-- Behavioural smoke for 20261026600000_r3_foundation.sql (+ 20261026700000_r3_contract.sql): hygiene, the safety
-- alert lifecycle, labels, the comment lock, report scope, request / offer status and opt-ins, announcements,
-- petitions, the posts publication. Every invariant of specs/r3-model.md names the check ids below that hold it.
-- Concurrency (version token, lock vs comment, slot return, label apply / retract, pin / unpin, petition review
-- vs edit, re-report) lives in r3_foundation.race.sh.
--
-- Two release states, both must PASS: 20261026600000 alone (expand: the deployed client still updates alerts
-- without a token, decides opt-ins by direct UPDATE and sends a petition hash; a direct DELETE of an opt-in is
-- still possible) and 20261026600000 + 20261026700000 (contract: all four closed). The state is read from the
-- ledger; the checks that differ assert each state's own behaviour. Without the foundation migration the file
-- FAILS (it never skips).
-- Run against a database that already has the migration(s) applied, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/r3_foundation.smoke.sql
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. It seeds its own principals and rows, so it
-- targets local / ephemeral databases. Viewers: anon, G (guest), GT (guest holding the platform_admin tier),
-- C / C2 / C3 (members), A (author / owner), B / B2 (seekers), CM / CM2 (community moderators), RA (resource
-- admin), PA (platform admin), OA (org admin), XM (a moderator whose account is deleted at the end).
-- Refusals are proven by seeding the refused principal WITH the privilege (GT holds the top tier and owns a post,
-- an alert and a draft). Final state is read through pg_temp.fresh (sees the effects of calls made earlier in
-- the same check). now() is the transaction time, so every expiry below is exact.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path TO public, extensions, pg_temp;

DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026600000') THEN
    RAISE EXCEPTION 'FAIL r3_foundation smoke: 20261026600000_r3_foundation is not applied';
  END IF;
END
$pre$;

CREATE TEMP TABLE res (n serial, id text, what text, expect text, got text, ok boolean);
GRANT ALL ON res TO PUBLIC;
GRANT ALL ON SEQUENCE res_n_seq TO PUBLIC;

-- Run q as a principal (p_uid NULL = anon role); returns 'OK <value>' or 'ERR <sqlstate> <message>[ | <detail>]'.
CREATE FUNCTION pg_temp.as_(p_uid uuid, p_anon boolean, q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text; d text; h text;
BEGIN
  IF p_uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE q INTO r;
    r := 'OK ' || COALESCE(r, '<null>');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL, h = PG_EXCEPTION_HINT;
    r := 'ERR ' || SQLSTATE || ' ' || SQLERRM || COALESCE(' | ' || NULLIF(d, ''), '')
         || CASE WHEN current_setting('r3smoke.hint', true) = 'on' THEN COALESCE(' | HINT ' || NULLIF(h, ''), '') ELSE '' END;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN r;
END $f$;
CREATE FUNCTION pg_temp.u(w text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
  SELECT (CASE w WHEN 'A'  THEN 'a0000000-0000-4000-8000-000000000001' WHEN 'B'   THEN 'b0000000-0000-4000-8000-000000000002'
                 WHEN 'B2' THEN 'b2000000-0000-4000-8000-000000000012' WHEN 'C'   THEN 'c0000000-0000-4000-8000-000000000003'
                 WHEN 'C2' THEN 'c2000000-0000-4000-8000-000000000013' WHEN 'C3'  THEN 'c3000000-0000-4000-8000-000000000023'
                 WHEN 'G'  THEN 'd0000000-0000-4000-8000-000000000004' WHEN 'GT'  THEN 'd1000000-0000-4000-8000-000000000014'
                 WHEN 'CM' THEN 'e0000000-0000-4000-8000-000000000005' WHEN 'CM2' THEN 'e2000000-0000-4000-8000-000000000015'
                 WHEN 'RA' THEN 'f0000000-0000-4000-8000-000000000006' WHEN 'PA'  THEN '10000000-0000-4000-8000-000000000007'
                 WHEN 'OA' THEN '20000000-0000-4000-8000-000000000008' WHEN 'XM'  THEN '90000000-0000-4000-8000-000000000009' END)::uuid
$f$;
CREATE FUNCTION pg_temp.run(w text, q text) RETURNS text LANGUAGE sql AS $f$
  SELECT CASE WHEN w = 'anon' THEN pg_temp.as_(NULL, false, q) ELSE pg_temp.as_(pg_temp.u(w), w IN ('G', 'GT'), q) END
$f$;
-- runx: run, with the HINT appended too: message | detail | hint is everything an error sends to a client
CREATE FUNCTION pg_temp.runx(w text, q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  PERFORM set_config('r3smoke.hint', 'on', true); r := pg_temp.run(w, q); PERFORM set_config('r3smoke.hint', 'off', true);
  RETURN r;
END $f$;
-- one check as a principal
CREATE FUNCTION pg_temp.t(p_id text, p_what text, p_expect text, w text, q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text := pg_temp.run(w, q);
BEGIN
  INSERT INTO res (id, what, expect, got, ok) VALUES (p_id, p_what, p_expect, left(r, 900), r ~ p_expect);
  RETURN r;
END $f$;
-- one assertion evaluated as the test owner
CREATE FUNCTION pg_temp.ck(p_id text, p_what text, p_expect text, p_got text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  INSERT INTO res (id, what, expect, got, ok)
  VALUES (p_id, p_what, p_expect, left(COALESCE(p_got, '<null>'), 900), COALESCE(p_got, '<null>') ~ p_expect);
  RETURN p_got;
END $f$;
-- the same statement as several principals: 'W=>result;' each
CREATE FUNCTION pg_temp.who(p_who text[], q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE w text; o text := '';
BEGIN
  FOREACH w IN ARRAY p_who LOOP o := o || w || '=>' || left(pg_temp.run(w, q), 160) || ';'; END LOOP;
  RETURN o;
END $f$;
-- run q as the test owner (the table owner), capturing errors
CREATE FUNCTION pg_temp.pg(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  EXECUTE q INTO r; RETURN 'OK ' || COALESCE(r, '<null>');
EXCEPTION WHEN others THEN RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
END $f$;
-- admin_actions rows written by one call: '<result prefix>|+<rows>'
CREATE FUNCTION pg_temp.audited(w text, q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n0 bigint := (SELECT count(*) FROM public.admin_actions); r text;
BEGIN
  r := pg_temp.run(w, q);
  RETURN left(r, 300) || '|+' || ((SELECT count(*) FROM public.admin_actions) - n0);
END $f$;
-- fresh(q): read state AFTER calls made earlier in the same check (an inline subquery sees the check's start snapshot)
CREATE FUNCTION pg_temp.fresh(q text) RETURNS text LANGUAGE plpgsql AS $f$ DECLARE r text; BEGIN EXECUTE q INTO r; RETURN r; END $f$;
-- svc(q): run q as service_role (the account deletion function's role), capturing errors
CREATE FUNCTION pg_temp.svc(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); PERFORM set_config('role', 'service_role', true);
  BEGIN EXECUTE q INTO r; r := 'OK ' || COALESCE(r, '<null>');
  EXCEPTION WHEN others THEN r := 'ERR ' || SQLSTATE || ' ' || SQLERRM; END;
  PERFORM set_config('role', 'postgres', true); PERFORM set_config('request.jwt.claims', '', true);
  RETURN r;
END $f$;
CREATE TEMP TABLE st AS SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026700000') AS contract;
GRANT SELECT ON st TO PUBLIC;
CREATE FUNCTION pg_temp.contract() RETURNS boolean LANGUAGE sql AS $f$ SELECT contract FROM st $f$;
-- an alert in one line: status|severity|version|update_count|verified|minutes to expiry
CREATE FUNCTION pg_temp.al(p uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT status || '|' || severity || '|' || version || '|' || update_count || '|' || verified::char || '|' ||
         round(extract(epoch FROM expires_at - now()) / 60)::text FROM public.safety_alerts WHERE id = p $f$;
-- the keys of a jsonb answer, sorted
CREATE FUNCTION pg_temp.keys(j text) RETURNS text LANGUAGE sql AS $f$
  SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(substr(j, 4)::jsonb) k $f$;
-- an offer's capacity in one line: max/slots/opt-in rows
CREATE FUNCTION pg_temp.slots(p_post uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(max_seekers::text, '-') || '/' || COALESCE(slots_remaining::text, '-') || '/' ||
         (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = po.id) FROM public.posts po WHERE po.id = p_post $f$;

-- ---------------------------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------------------------
INSERT INTO auth.users (id, email, is_anonymous, raw_user_meta_data)
SELECT pg_temp.u(w), CASE WHEN w IN ('G', 'GT') THEN NULL ELSE lower(w) || '@r3smoke.test' END, w IN ('G', 'GT'), '{}'::jsonb
FROM unnest(ARRAY['A','B','B2','C','C2','C3','G','GT','CM','CM2','RA','PA','OA','XM']) w;
INSERT INTO public.profiles (id) SELECT pg_temp.u(w) FROM unnest(ARRAY['A','B','B2','C','C2','C3','G','GT','CM','CM2','RA','PA','OA','XM']) w
ON CONFLICT (id) DO NOTHING;
SELECT set_config('feed.tier_write', 'on', true);
UPDATE public.profiles SET admin_tier = 'community_moderator' WHERE id IN (pg_temp.u('CM'), pg_temp.u('CM2'), pg_temp.u('XM'));
UPDATE public.profiles SET admin_tier = 'resource_admin'      WHERE id = pg_temp.u('RA');
UPDATE public.profiles SET admin_tier = 'platform_admin'      WHERE id IN (pg_temp.u('PA'), pg_temp.u('GT'));
SELECT set_config('feed.tier_write', '', true);
INSERT INTO public.organizations (id, name, org_type, is_active) VALUES ('0a000000-0000-4000-8000-0000000000a1', 'Smoke Org', 'community', true);
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ('0a000000-0000-4000-8000-0000000000a1', pg_temp.u('OA'), 'admin');
INSERT INTO public.assistance_events (id, org_id, title, time_zone, created_by, updated_at, announce_days_before) VALUES
 ('0e000000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-0000000000a1', 'Saturday food distribution', 'America/New_York', pg_temp.u('OA'), now() - interval '2 days', 7);
INSERT INTO public.event_occurrences (id, event_id, starts_at, ends_at, status) VALUES
 ('0f000000-0000-4000-8000-0000000000a1', '0e000000-0000-4000-8000-0000000000a1', now() + interval '2 days', now() + interval '2 days 2 hours', 'upcoming');

-- posts created 1 h ago (outside the quiet-edit grace)
INSERT INTO public.posts (id, user_id, content, post_type, metadata, max_seekers, created_at) VALUES
 ('00000000-0000-4000-a000-000000000001', pg_temp.u('A'),  'plain post', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000002', pg_temp.u('A'),  'need diapers', 'seeker_request', '{"categories":["childcare"]}', NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000003', pg_temp.u('A'),  'free produce', 'source_offer', '{"categories":["food"]}', 3, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000004', pg_temp.u('CM'), 'a moderator''s own post', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000005', pg_temp.u('GT'), 'guest-authored', 'source_offer', '{"categories":["food"]}', 2, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000006', pg_temp.u('A'),  'thread to lock', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000007', pg_temp.u('A'),  'post to report', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000008', pg_temp.u('A'),  'two coats', 'source_offer', '{"categories":["clothing"]}', 2, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000009', pg_temp.u('PA'), 'Office closed Monday', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-00000000000a', pg_temp.u('A'),  'pantry hours 9 to 5', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-00000000000b', pg_temp.u('C'),  'member C post', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-00000000000c', pg_temp.u('A'),  'a held post', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-00000000000d', pg_temp.u('A'),  'an offer a moderator removes', 'source_offer', '{"categories":["food"]}', 2, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-00000000000e', pg_temp.u('A'),  'a removed post', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-00000000000f', pg_temp.u('A'),  'a post its author deletes', 'feed', NULL, NULL, now() - interval '1 hour');
UPDATE public.posts SET is_hidden = true, hidden_at = now(), hidden_reason = 'hold_for_review' WHERE id = '00000000-0000-4000-a000-00000000000c';
UPDATE public.posts SET is_hidden = true, hidden_at = now(), hidden_reason = 'admin_removal' WHERE id = '00000000-0000-4000-a000-00000000000e';
INSERT INTO public.post_comments (id, post_id, user_id, content, created_at) VALUES
 ('0d000000-0000-4000-8000-000000000061', '00000000-0000-4000-a000-000000000006', pg_temp.u('B'),  'before the lock', now() - interval '50 minutes'),
 ('0d000000-0000-4000-8000-000000000071', '00000000-0000-4000-a000-000000000007', pg_temp.u('B'),  'a comment to report', now() - interval '50 minutes'),
 ('0d000000-0000-4000-8000-000000000072', '00000000-0000-4000-a000-000000000007', pg_temp.u('B'),  'a comment a moderator hides', now() - interval '50 minutes'),
 ('0d000000-0000-4000-8000-000000000073', '00000000-0000-4000-a000-000000000007', pg_temp.u('CM'), 'a moderator''s own comment', now() - interval '50 minutes'),
 ('0d000000-0000-4000-8000-000000000074', '00000000-0000-4000-a000-000000000007', pg_temp.u('C3'), 'another comment', now() - interval '50 minutes');
-- alerts in every state (S1 live .. S8 withdrawn), a NULL-owner alert (the reporter's account is gone), a guest's and a moderator's own
INSERT INTO public.safety_alerts (id, alert_type, severity, description, location, status, created_by, expires_at, resolved_at, resolved_by_role, created_at) VALUES
 ('5a000000-0000-4000-8000-000000000002', 'general', 2, 'live past expiry',  ST_SetSRID(ST_MakePoint(-72.51, 44.21), 4326)::geography, 'live',      pg_temp.u('A'), now() - interval '2 minutes', NULL, NULL, now() - interval '7 hours'),
 ('5a000000-0000-4000-8000-000000000003', 'general', 2, 'expired',           ST_SetSRID(ST_MakePoint(-72.52, 44.22), 4326)::geography, 'expired',   pg_temp.u('A'), now() - interval '1 hour',    NULL, NULL, now() - interval '7 hours'),
 ('5a000000-0000-4000-8000-000000000004', 'general', 2, 'cleared by votes',  ST_SetSRID(ST_MakePoint(-72.53, 44.23), 4326)::geography, 'cleared',   pg_temp.u('A'), now() + interval '3 hours',   NULL, NULL, now() - interval '3 hours'),
 ('5a000000-0000-4000-8000-000000000005', 'general', 2, 'removed',           ST_SetSRID(ST_MakePoint(-72.54, 44.24), 4326)::geography, 'removed',   pg_temp.u('A'), now() + interval '3 hours',   NULL, NULL, now() - interval '3 hours'),
 ('5a000000-0000-4000-8000-000000000006', 'general', 2, 'resolved 5h59 ago', ST_SetSRID(ST_MakePoint(-72.55, 44.25), 4326)::geography, 'resolved',  pg_temp.u('A'), now() + interval '1 hour',    now() - interval '5 hours 59 minutes', 'owner', now() - interval '7 hours'),
 ('5a000000-0000-4000-8000-000000000007', 'general', 2, 'resolved 6h01 ago', ST_SetSRID(ST_MakePoint(-72.56, 44.26), 4326)::geography, 'resolved',  pg_temp.u('A'), now() + interval '1 hour',    now() - interval '6 hours 1 minute',   'owner', now() - interval '7 hours'),
 ('5a000000-0000-4000-8000-000000000008', 'general', 2, 'withdrawn',         ST_SetSRID(ST_MakePoint(-72.57, 44.27), 4326)::geography, 'withdrawn', pg_temp.u('A'), now() + interval '3 hours',   NULL, NULL, now() - interval '3 hours'),
 ('5a000000-0000-4000-8000-0000000000a0', 'general', 2, 'reporter is gone',  ST_SetSRID(ST_MakePoint(-72.58, 44.28), 4326)::geography, 'live',      NULL,            now() + interval '5 hours',   NULL, NULL, now() - interval '1 hour'),
 ('5a000000-0000-4000-8000-0000000000a1', 'general', 2, 'a guest''s own',    ST_SetSRID(ST_MakePoint(-72.59, 44.29), 4326)::geography, 'live',      pg_temp.u('GT'), now() + interval '5 hours',   NULL, NULL, now() - interval '1 hour'),
 ('5a000000-0000-4000-8000-0000000000a2', 'general', 2, 'a moderator''s own', ST_SetSRID(ST_MakePoint(-72.60, 44.30), 4326)::geography, 'live',     pg_temp.u('CM'), now() + interval '5 hours',   NULL, NULL, now() - interval '1 hour'),
 ('5a000000-0000-4000-8000-0000000000a3', 'weather', 3, 'for the expiry cap', ST_SetSRID(ST_MakePoint(-72.61, 44.31), 4326)::geography, 'live',     pg_temp.u('A'), now() + interval '1 hour',    NULL, NULL, now() - interval '23 hours'),
 ('5a000000-0000-4000-8000-0000000000b1', 'general', 1, 'one more live',      ST_SetSRID(ST_MakePoint(-71.00, 43.00), 4326)::geography, 'live',     pg_temp.u('B'), now() + interval '1 hour',    NULL, NULL, now() - interval '1 hour'),
 ('5a000000-0000-4000-8000-0000000000b2', 'general', 1, 'and another',        ST_SetSRID(ST_MakePoint(-71.01, 43.01), 4326)::geography, 'live',     pg_temp.u('B'), now() + interval '1 hour',    NULL, NULL, now() - interval '1 hour');
-- the seeded alerts get their message 1, as the migration's backfill gives every existing alert
INSERT INTO public.safety_alert_updates (alert_id, version, msg_type, sent_at, alert_type, severity, description, location, expires_at, status, actor_id, actor_role)
SELECT id, 1, 'alert', created_at, alert_type, severity, description, location, expires_at, 'live', created_by, 'owner' FROM public.safety_alerts WHERE id::text LIKE '5a000000-%';
CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON ids TO PUBLIC;

-- two more resolved alerts (1 h ago) to withdraw and to remove without disturbing the read matrix
INSERT INTO public.safety_alerts (id, alert_type, severity, description, location, status, created_by, expires_at, resolved_at, resolved_by_role, created_at) VALUES
 ('5a000000-0000-4000-8000-000000000016', 'general', 2, 'resolved, to withdraw', ST_SetSRID(ST_MakePoint(-72.62, 44.32), 4326)::geography, 'resolved', pg_temp.u('A'), now() + interval '1 hour', now() - interval '1 hour', 'owner', now() - interval '5 hours'),
 ('5a000000-0000-4000-8000-000000000026', 'general', 2, 'resolved, to remove',   ST_SetSRID(ST_MakePoint(-72.63, 44.33), 4326)::geography, 'resolved', pg_temp.u('A'), now() + interval '1 hour', now() - interval '1 hour', 'owner', now() - interval '5 hours');
INSERT INTO public.safety_alert_updates (alert_id, version, msg_type, sent_at, alert_type, severity, description, location, expires_at, status, actor_id, actor_role)
SELECT id, 1, 'alert', created_at, alert_type, severity, description, location, expires_at, 'live', created_by, 'owner' FROM public.safety_alerts
 WHERE id IN ('5a000000-0000-4000-8000-000000000016', '5a000000-0000-4000-8000-000000000026');

-- ===================== HY: hygiene =====================
SELECT pg_temp.ck('HY1', 'no relation in public leaves TRUNCATE / REFERENCES / TRIGGER / MAINTAIN with anon or authenticated', '^0$',
  (SELECT count(*)::text FROM pg_class c, aclexplode(c.relacl) a
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v', 'm', 'p')
      AND pg_get_userbyid(a.grantee) IN ('anon', 'authenticated') AND a.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')));
SELECT pg_temp.ck('HY1b', 'TRUNCATE as a client role is refused (RLS never gates it): votes, notifications, comments', '^(\w+=>ERR 42501 permission denied for table \w+;){6}$',
  pg_temp.who(ARRAY['anon', 'C'], 'TRUNCATE public.safety_alert_votes') || pg_temp.who(ARRAY['anon', 'C'], 'TRUNCATE public.notifications')
  || pg_temp.who(ARRAY['anon', 'C'], 'TRUNCATE public.post_comments'));
SELECT pg_temp.ck('HY2', 'posts has exactly one updated_at trigger (update_posts_updated_at) and updated_at still moves', '^update_posts_updated_at\|OK t$',
  (SELECT string_agg(t.tgname, ',' ORDER BY t.tgname) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.posts'::regclass AND NOT t.tgisinternal AND p.proname IN ('update_updated_at', 'update_updated_at_column'))
  || '|' || pg_temp.pg($q$WITH u AS (UPDATE public.posts SET updated_at = now() - interval '9 days' WHERE id = '00000000-0000-4000-a000-00000000000b' RETURNING updated_at)
                           SELECT (updated_at = now())::char FROM u$q$));
CREATE TABLE public.r3_smoke_probe_t (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, v text);
CREATE FUNCTION public.r3_smoke_probe_f() RETURNS integer LANGUAGE sql AS 'SELECT 1';
SELECT pg_temp.ck('HY3', 'born closed: a new table, its sequence and a new function carry no anon / authenticated privilege (service_role keeps its default)',
  '^ffffffffffffffff\|ffffff\|ff\|tt$',
  (SELECT string_agg(has_table_privilege(r, 'public.r3_smoke_probe_t', p)::char, '' ORDER BY r, p)
     FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p)
  || '|' || (SELECT string_agg(has_sequence_privilege(r, 'public.r3_smoke_probe_t_id_seq', p)::char, '' ORDER BY r, p)
               FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) p)
  || '|' || (SELECT string_agg((EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = 'public.r3_smoke_probe_f()'::regprocedure)) a
                                         WHERE pg_get_userbyid(a.grantee) = r))::char, '' ORDER BY r) FROM unnest(ARRAY['anon', 'authenticated']) r)
  || '|' || has_table_privilege('service_role', 'public.r3_smoke_probe_t', 'SELECT')::char
         || has_function_privilege('service_role', 'public.r3_smoke_probe_f()', 'EXECUTE')::char);
DROP FUNCTION public.r3_smoke_probe_f();
DROP TABLE public.r3_smoke_probe_t;
SELECT pg_temp.ck('HY3b', 'the default-privilege change is scoped to schema public: no role-wide (schema-less) default ACL row exists for any role; postgres keeps its three rows in public and none of them names a client role',
  '^0\|3\|0$',
  (SELECT count(*)::text FROM pg_default_acl WHERE defaclnamespace = 0) || '|' ||
  (SELECT count(*) FROM pg_default_acl d WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace) || '|' ||
  (SELECT count(*) FROM pg_default_acl d, aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)));
-- every function this release creates or replaces
CREATE TEMP TABLE r3_fns (sig text PRIMARY KEY, kind text);   -- kind: member | anon | internal
INSERT INTO r3_fns VALUES
 ('place_safety_alert(text,integer,text,double precision,double precision)', 'member'),
 ('update_safety_alert(uuid,text,integer,text,double precision,double precision,integer,text)', 'member'),
 ('resolve_safety_alert(uuid,integer,text)', 'member'), ('delete_safety_alert(uuid)', 'member'), ('vote_safety_alert(uuid,text)', 'member'),
 ('admin_verify_safety_alert(uuid,integer)', 'member'), ('admin_remove_safety_alert(uuid,text,integer)', 'member'),
 ('admin_set_post_label(uuid,text,boolean,integer,text,text,uuid)', 'member'), ('set_own_post_label(uuid,text,boolean,integer)', 'member'),
 ('admin_set_comments_locked(uuid,boolean,integer,text,text)', 'member'),
 ('submit_content_report(text,uuid,report_reason,text)', 'member'), ('admin_resolve_report(uuid,text,integer)', 'member'),
 ('admin_set_comment_hidden(uuid,boolean,text)', 'member'),
 ('set_post_closed(uuid,boolean,integer,text)', 'member'), ('opt_in_to_post(uuid)', 'member'), ('withdraw_opt_in(uuid)', 'member'),
 ('unblock_opt_in(uuid)', 'member'), ('decide_opt_in(uuid,text,text)', 'member'),
 ('admin_set_post_pinned(uuid,boolean,integer,timestamp with time zone,text)', 'member'),
 ('admin_review_petition(uuid,text,text)', 'member'), ('add_petition_update(uuid,text)', 'member'),
 ('safety_alerts_in_view(double precision,double precision,double precision,double precision,uuid,boolean,integer)', 'anon'),
 ('safety_alert_history(uuid)', 'anon'), ('ranked_feed_v2(double precision,double precision,integer,real,uuid,text)', 'anon'),
 ('safety_alert_ttl(integer)', 'internal'), ('safety_alert_shown_state(text,timestamp with time zone,timestamp with time zone,timestamp with time zone)', 'internal'),
 ('safety_alert_public(safety_alerts)', 'internal'), ('safety_alert_require_member()', 'internal'),
 ('safety_alert_append(safety_alerts,text,integer,text[],text,uuid,text,text,timestamp with time zone)', 'internal'),
 ('safety_alert_updates_append_only()', 'internal'), ('post_labels_append_only()', 'internal'), ('post_labels_sync()', 'internal'),
 ('posts_label_review_on_edit()', 'internal'), ('lock_post_for_engagement()', 'internal'), ('resource_opt_ins_return_slot()', 'internal'),
 ('resource_opt_ins_audit()', 'internal'), ('resource_opt_in_events_append_only()', 'internal'), ('petition_text_hash(text)', 'internal'),
 ('resource_opt_in_events_forget_posts()', 'internal'), ('resource_opt_in_events_forget_profiles()', 'internal'),
 ('petitions_guard()', 'internal'), ('petition_signatures_bind()', 'internal'), ('petition_updates_append_only()', 'internal');
SELECT pg_temp.ck('HY4', 'all 43 functions of the release exist, each name has exactly one signature (no PostgREST overload)', '^43\|0$',
  (SELECT count(*) FILTER (WHERE to_regprocedure('public.' || sig) IS NOT NULL) || '|' ||
          (SELECT count(*) FROM (SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                                    AND proname IN (SELECT split_part(sig, '(', 1) FROM r3_fns) GROUP BY 1 HAVING count(*) > 1) d)
   FROM r3_fns));
SELECT pg_temp.ck('HY5', 'search_path pinned to public, pg_temp on every one of them (functions with a different setting listed)', '^$',
  (SELECT COALESCE(string_agg(sig, ', ' ORDER BY sig), '') FROM r3_fns f JOIN pg_proc p ON p.oid = to_regprocedure('public.' || f.sig)
    WHERE NOT (COALESCE(p.proconfig, '{}') @> ARRAY['search_path=public, pg_temp'])));
SELECT pg_temp.ck('HY6', 'EXECUTE: PUBLIC never; anon only on the three readers; authenticated on the member RPCs + readers, never on an internal helper or trigger function (wrong ones listed)', '^$',
  (SELECT COALESCE(string_agg(sig || ':' || got, ', ' ORDER BY sig), '')
     FROM (SELECT f.sig, f.kind,
                  (EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0))::char
                  || has_function_privilege('anon', p.oid, 'EXECUTE')::char || has_function_privilege('authenticated', p.oid, 'EXECUTE')::char AS got
             FROM r3_fns f JOIN pg_proc p ON p.oid = to_regprocedure('public.' || f.sig)) s
    WHERE got <> CASE kind WHEN 'member' THEN 'fft' WHEN 'anon' THEN 'ftt' ELSE 'fff' END));
SELECT pg_temp.ck('HY7', 'the two existing notification trigger functions are no longer client-executable', '^ffff$',
  (SELECT string_agg(has_function_privilege(r, f, 'EXECUTE')::char, '' ORDER BY f, r)
     FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['public.notify_post_comment_author()', 'public.notify_application_status_change()']) f));
SELECT pg_temp.ck('HY8', 'notification_type holds the three Release 4 values; no row uses one; no function in public names one as a literal at all, in any context (the matcher sees one when it is there)', '^3\|0\|0\|0\|t$',
  (SELECT count(*)::text FROM pg_enum WHERE enumtypid = 'public.notification_type'::regtype AND enumlabel IN ('moderation', 'content_update', 'event_update'))
  || '|' || (SELECT count(*) FROM public.notifications WHERE type::text IN ('moderation', 'content_update', 'event_update'))
  || '|' || (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
               AND p.prosrc ~ '''(moderation|content_update|event_update)''(::(public\.)?notification_type)?'
               AND p.prosrc ~ 'notification')
  || '|' || (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
               AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
               AND p.prosrc ~ '''(moderation|content_update|event_update)''')
  || '|' || ($ctl$ PERFORM 1 WHERE p_note = 'moderation'; $ctl$ ~ '''(moderation|content_update|event_update)''')::char);

-- ===================== A: safety alert lifecycle =====================
-- A0: who may place; the answer shape
SELECT pg_temp.ck('A0a', 'place: anon has no EXECUTE; a guest is refused, also when it holds the top tier', '^anon=>ERR 42501 permission denied for function place_safety_alert;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT'], $q$SELECT public.place_safety_alert('general', 1, 'tree down', -72.5, 44.2)::text$q$));
INSERT INTO ids SELECT 'al1', ((substr(pg_temp.t('A0b', 'a member places an alert: jsonb answer, live, version 1, is_mine', '^OK \{(?=.*"is_mine": true)(?=.*"status": "live")(?=.*"version": 1[,}])', 'A',
  $q$SELECT public.place_safety_alert('general', 1, '  tree down  ', -72.5, 44.2)::text$q$), 4))::jsonb ->> 'id')::uuid;
SELECT pg_temp.ck('A0c', 'the stored alert: trimmed text, 120 minutes for severity 1, message 1 in the history (by owner)', '^tree down\|live\|1\|1\|0\|f\|120\|1:alert:owner:t$',
  (SELECT description FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al1')) || '|' || pg_temp.al((SELECT v FROM ids WHERE k = 'al1')) || '|' ||
  (SELECT string_agg(version || ':' || msg_type || ':' || actor_role || ':' || (supersedes_version IS NULL)::char, ',') FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al1')));
SELECT pg_temp.ck('A0d', 'invalid input is refused before any write, with a token (no constraint error, no failing-row DETAIL)',
  '^ERR 22023 alert_field_invalid:type;ERR 22023 alert_field_invalid:type;ERR 22023 alert_field_invalid:severity;ERR 22023 alert_field_invalid:severity;ERR 22023 alert_field_invalid:location;ERR 22023 alert_field_invalid:location$',
  pg_temp.run('C', $q$SELECT public.place_safety_alert(NULL, 1, 'x', 0, 0)::text$q$) || ';' || pg_temp.run('C', $q$SELECT public.place_safety_alert('flood', 1, 'x', 0, 0)::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.place_safety_alert('general', NULL, 'x', 0, 0)::text$q$) || ';' || pg_temp.run('C', $q$SELECT public.place_safety_alert('general', 5, 'x', 0, 0)::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.place_safety_alert('general', 1, 'x', NULL, 0)::text$q$) || ';' || pg_temp.run('C', $q$SELECT public.place_safety_alert('general', 1, 'x', 181, 0)::text$q$));

SELECT pg_temp.ck('A0e', 'every signed-in member places an alert, each staff tier included', '^C=>OK live;CM=>OK live;RA=>OK live;PA=>OK live;$',
  pg_temp.who(ARRAY['C', 'CM', 'RA', 'PA'], $q$SELECT public.place_safety_alert('general', 1, 'placed by ' || auth.uid(), 10, 10) ->> 'status'$q$));
INSERT INTO ids SELECT 'pl_' || lower(w), (SELECT id FROM public.safety_alerts WHERE description = 'placed by ' || pg_temp.u(w)) FROM unnest(ARRAY['C', 'CM', 'RA', 'PA']) w;

-- A0g: the shared gate takes EITHER signal. A member's account presenting a token that carries the guest claim, and a
-- guest account presenting a token that does not, are both refused (G and GT above carry both signals at once).
SELECT pg_temp.ck('A0g', 'a guest by one signal alone is refused by the alert writes: the JWT claim without the account flag (place, vote), the account flag without the JWT claim (place, vote); nothing was written',
  '^(ERR 42501 Account required for this action;){4}\|0\|0$',
  pg_temp.as_(pg_temp.u('C2'), true,  $q$SELECT public.place_safety_alert('general', 1, 'claim only', -70.1, 42.1)::text$q$) || ';' ||
  pg_temp.as_(pg_temp.u('C2'), true,  $q$SELECT public.vote_safety_alert('5a000000-0000-4000-8000-0000000000b1', 'confirm')::text$q$) || ';' ||
  pg_temp.as_(pg_temp.u('G'),  false, $q$SELECT public.place_safety_alert('general', 1, 'flag only', -70.2, 42.2)::text$q$) || ';' ||
  pg_temp.as_(pg_temp.u('G'),  false, $q$SELECT public.vote_safety_alert('5a000000-0000-4000-8000-0000000000b1', 'confirm')::text$q$) || ';|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.safety_alerts WHERE description IN ('claim only', 'flag only')$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.safety_alert_votes WHERE alert_id = '5a000000-0000-4000-8000-0000000000b1'$q$));

-- A1: who may update / resolve / withdraw. Owned alert al1 (version 1), then the NULL-owner alert, then a tiered guest's own.
SELECT pg_temp.ck('A1a', 'update of an owned alert: anon no EXECUTE; guests refused; strangers (member, seeker) are not the owner',
  '^anon=>ERR 42501 permission denied for function update_safety_alert;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;C=>ERR 42501 not_alert_owner;B=>ERR 42501 not_alert_owner;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'B'], $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'hijack', p_expected_version => 1)::text$q$));
SELECT pg_temp.ck('A1b', 'the owner, then a community moderator, a resource admin and a platform admin update it (versions 2..5)', '^OK 2\|OK 3\|OK 4\|OK 5\|5$',
  pg_temp.run('A',  $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'tree down, lane blocked', p_expected_version => 1) ->> 'version'$q$) || '|' ||
  pg_temp.run('CM', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'tree down (mod)', p_expected_version => 2) ->> 'version'$q$) || '|' ||
  pg_temp.run('RA', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'tree down (ra)', p_expected_version => 3) ->> 'version'$q$) || '|' ||
  pg_temp.run('PA', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'tree down (pa)', p_expected_version => 4) ->> 'version'$q$) || '|' ||
  pg_temp.fresh($q$SELECT version::text FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al1')$q$));
SELECT pg_temp.ck('A1c', 'a NULL-owner alert belongs to nobody: a stranger and the former owner cannot update it; a moderator can',
  '^C=>ERR 42501 not_alert_owner;A=>ERR 42501 not_alert_owner;CM=>OK 2;$',
  pg_temp.who(ARRAY['C', 'A', 'CM'], $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a0', p_description => 'edited', p_expected_version => 1) ->> 'version'$q$));
SELECT pg_temp.ck('A1d', 'nobody can withdraw a NULL-owner alert (a moderator uses remove), nor someone else''s; guests refused first',
  '^C=>ERR 42501 not_alert_owner;A=>ERR 42501 not_alert_owner;CM=>ERR 42501 not_alert_owner;PA=>ERR 42501 not_alert_owner;G=>ERR 42501 Account required for this action;anon=>ERR 42501 permission denied for function delete_safety_alert;\|C=>ERR 42501 not_alert_owner;CM=>ERR 42501 not_alert_owner;RA=>ERR 42501 not_alert_owner;PA=>ERR 42501 not_alert_owner;$',
  pg_temp.who(ARRAY['C', 'A', 'CM', 'PA', 'G', 'anon'], $q$SELECT public.delete_safety_alert('5a000000-0000-4000-8000-0000000000a0')::text$q$) || '|' ||
  pg_temp.who(ARRAY['C', 'CM', 'RA', 'PA'], $q$SELECT public.delete_safety_alert((SELECT v FROM ids WHERE k = 'al1'))::text$q$));
SELECT pg_temp.ck('A1e', 'a guest who OWNS an alert and holds the top tier is refused on every write (update, resolve, withdraw, vote, verify, remove)',
  '^(ERR 42501 Account required for this action;){6}$',
  pg_temp.run('GT', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a1', p_description => 'x', p_expected_version => 1)::text$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT public.resolve_safety_alert('5a000000-0000-4000-8000-0000000000a1', 1)::text$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT public.delete_safety_alert('5a000000-0000-4000-8000-0000000000a1')::text$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT public.vote_safety_alert('5a000000-0000-4000-8000-0000000000a2', 'confirm')::text$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT public.admin_verify_safety_alert('5a000000-0000-4000-8000-0000000000a2')::text$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT public.admin_remove_safety_alert('5a000000-0000-4000-8000-0000000000a2')::text$q$) || ';');
SELECT pg_temp.ck('A1f', 'a missing alert answers PT404 on every write', '^(ERR PT404 alert_not_found;){6}$',
  pg_temp.run('PA', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000ff', p_description => 'x', p_expected_version => 1)::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.resolve_safety_alert('5a000000-0000-4000-8000-0000000000ff', 1)::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.delete_safety_alert('5a000000-0000-4000-8000-0000000000ff')::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.vote_safety_alert('5a000000-0000-4000-8000-0000000000ff', 'confirm')::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.admin_verify_safety_alert('5a000000-0000-4000-8000-0000000000ff')::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.admin_remove_safety_alert('5a000000-0000-4000-8000-0000000000ff')::text$q$) || ';');
SELECT pg_temp.ck('A1g', 'audit: a moderator''s update of someone else''s alert writes exactly one admin_actions row; the owner''s writes none', '^OK 6\|\+1;OK 7\|\+0$',
  pg_temp.audited('CM', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'tree down (mod again)', p_expected_version => 5, p_note => 'crew on site') ->> 'version'$q$) || ';' ||
  pg_temp.audited('A',  $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al1'), p_description => 'tree down', p_expected_version => 6) ->> 'version'$q$));
SELECT pg_temp.ck('A1h', '... and that row names the action, the tier, the version and what changed', '^safety_alert.update\|community_moderator\|crew on site\|6\|\["description"\]\|same$',
  (SELECT action || '|' || actor_tier || '|' || reason || '|' || (details ->> 'version') || '|' || (details -> 'changed')::text || '|' || (details ->> 'severity_change')
     FROM public.admin_actions WHERE action = 'safety_alert.update' AND actor_id = pg_temp.u('CM') ORDER BY id DESC LIMIT 1));

-- A2: expiry. A fresh severity-1 alert (120 minutes).
INSERT INTO ids SELECT 'al2', ((substr(pg_temp.run('A', $q$SELECT public.place_safety_alert('general', 1, 'ice', -72.4, 44.1)::text$q$), 4))::jsonb ->> 'id')::uuid;
UPDATE public.safety_alerts SET expires_at = now() + interval '50 minutes' WHERE id = (SELECT v FROM ids WHERE k = 'al2');   -- 70 minutes already used
CREATE FUNCTION pg_temp.upd2(p_args text) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.run('A', format($q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), %s, p_expected_version => (SELECT version FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2'))) ->> 'expires_at'$q$, p_args))
         || ' ' || pg_temp.fresh($q$SELECT pg_temp.al((SELECT v FROM ids WHERE k = 'al2'))$q$) $f$;
SELECT pg_temp.ck('A2a', 'a text / type edit at the same severity KEEPS the current expiry (50 minutes left)', 'live\|1\|2\|1\|f\|50$', pg_temp.upd2($q$p_description => 'black ice', p_type => 'weather'$q$));
SELECT pg_temp.ck('A2b', 'raising severity 1 -> 3 RESTARTS the expiry for the new level, from the update (24 h)', 'live\|3\|3\|2\|f\|1440$', pg_temp.upd2('p_severity => 3'));
SELECT pg_temp.ck('A2c', 'lowering 3 -> 2 CAPS what is left at the lower window (6 h)', 'live\|2\|4\|3\|f\|360$', pg_temp.upd2('p_severity => 2'));
SELECT pg_temp.ck('A2d', 'raising 2 -> 4 restarts at 72 h', 'live\|4\|5\|4\|f\|4320$', pg_temp.upd2('p_severity => 4'));
SELECT pg_temp.ck('A2e', 'lowering 4 -> 1 caps at 2 h', 'live\|1\|6\|5\|f\|120$', pg_temp.upd2('p_severity => 1'));
SELECT pg_temp.ck('A2f', 'the same values again: no new version, no new message', 'live\|1\|6\|5\|f\|120 6$',
  pg_temp.upd2($q$p_severity => 1, p_description => 'black ice', p_type => 'weather'$q$) || ' ' ||
  (SELECT count(*) FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2')));
SELECT pg_temp.ck('A2g', 'lowering never EXTENDS: severity 3 with 60 minutes left, lowered to 2 (a 6 h window), keeps its 60 minutes', '^OK 2\|live\|2\|2\|1\|f\|60$',
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_severity => 2, p_expected_version => 1) ->> 'version'$q$)
  || '|' || pg_temp.fresh($q$SELECT pg_temp.al('5a000000-0000-4000-8000-0000000000a3')$q$));
SELECT pg_temp.ck('A2h', 'a move alone (new location) keeps the expiry and is recorded as changed = {location}', '^OK 3\|\{location\}\|60\|-71$',
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_lng => -71, p_lat => 44, p_expected_version => 2) ->> 'version'$q$)
  || '|' || pg_temp.fresh($q$SELECT changed::text FROM public.safety_alert_updates WHERE alert_id = '5a000000-0000-4000-8000-0000000000a3' AND version = 3$q$)
  || '|' || split_part(pg_temp.fresh($q$SELECT pg_temp.al('5a000000-0000-4000-8000-0000000000a3')$q$), '|', 6)
  || '|' || pg_temp.fresh($q$SELECT ST_X(location::geometry)::text FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-0000000000a3'$q$));
SELECT pg_temp.ck('A2i', 'update validation: bad type / severity / half a location / an over-long note, each with its token',
  '^ERR 22023 alert_field_invalid:type;ERR 22023 alert_field_invalid:severity;ERR 22023 alert_field_invalid:location;ERR 22023 alert_field_invalid:location;ERR 22023 alert_field_invalid:note$',
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_type => 'flood', p_expected_version => 3)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_severity => 0, p_expected_version => 3)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_lng => -71, p_expected_version => 3)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_lng => -71, p_lat => 91, p_expected_version => 3)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a3', p_description => 'y', p_note => repeat('n', 501), p_expected_version => 3)::text$q$));

-- A3: the version token
SELECT pg_temp.t('A3a', 'a stale token is refused PT409 with the current version in DETAIL', '^ERR PT409 edit_conflict \| \{.*"current_version": 6', 'A',
  $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), p_description => 'lost update', p_expected_version => 5)::text$q$);
SELECT pg_temp.ck('A3b', 'no token: accepted in the expand state (the deployed client sends six arguments), refused 22023 after the contract step',
  CASE WHEN pg_temp.contract() THEN '^ERR 22023 alert_field_required:expected_version\|6$' ELSE '^OK 7\|7$' END,
  pg_temp.run('A', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), 'weather', 1, 'black ice, both lanes', -72.4, 44.1) ->> 'version'$q$)
  || '|' || pg_temp.fresh($q$SELECT version::text FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2')$q$));
SELECT pg_temp.ck('A3c', 'resolve needs its token from day one (both states), and refuses a stale one', '^ERR 22023 alert_field_required:expected_version;ERR PT409 edit_conflict',
  pg_temp.run('A', $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'al2'), NULL)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'al2'), 1)::text$q$));
SELECT pg_temp.ck('A3d', 'verify and remove take an OPTIONAL token: a stale one is refused, none is accepted (the deployed console sends the id only)',
  '^ERR PT409 edit_conflict.*;ERR PT409 edit_conflict.*;OK true$',
  pg_temp.run('CM', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'al2'), 1)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_remove_safety_alert((SELECT v FROM ids WHERE k = 'al2'), 'dup', 1)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'al2')) ->> 'verified'$q$));

-- A4: history. One complete message per version; a role, never an id; append-only.
SELECT pg_temp.ck('A4a', 'the history of al2 as a stranger and as a logged-out visitor read it: one message per version (version:type supersedes severity change role), newest first',
  CASE WHEN pg_temp.contract() THEN '^C=>OK 6:u51do,5:u44eo,4:u32do,3:u23eo,2:u11so,1:a-1so;anon=>OK 6:u51do,5:u44eo,4:u32do,3:u23eo,2:u11so,1:a-1so;$'
       ELSE '^C=>OK 7:u61so,6:u51do,5:u44eo,4:u32do,3:u23eo,2:u11so,1:a-1so;anon=>OK 7:u61so,6:u51do,5:u44eo,4:u32do,3:u23eo,2:u11so,1:a-1so;$' END,
  pg_temp.who(ARRAY['C', 'anon'], $q$SELECT string_agg(version || ':' || left(msg_type, 1) || COALESCE(supersedes_version::text, '-') || severity || left(severity_change, 1) || left(actor_role, 1), ',' ORDER BY version DESC)
                                       FROM public.safety_alert_history((SELECT v FROM ids WHERE k = 'al2'))$q$));
SELECT pg_temp.ck('A4b', 'each message carries its own expiry and what changed (v3 = the escalation: 24 h, severity + expires_at)', '^1440\|\{severity,expires_at\}\|weather\|black ice$',
  (SELECT round(extract(epoch FROM expires_at - sent_at) / 60) || '|' || changed::text || '|' || alert_type || '|' || description
     FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2') AND version = 3));
SELECT pg_temp.ck('A4c', 'the history reader returns no identity column', '^TABLE\(version integer, msg_type text, supersedes_version integer, sent_at timestamp with time zone, alert_type text, severity integer, description text, lng double precision, lat double precision, expires_at timestamp with time zone, changed text\[\], severity_change text, actor_role text, note text\)$',
  pg_get_function_result('public.safety_alert_history(uuid)'::regprocedure));
SELECT pg_temp.ck('A4d', 'no client role reads the history table itself (anon, member, owner, moderator, resource admin, platform admin)', '^(\w+=>ERR 42501 permission denied for table safety_alert_updates;){6}$',
  pg_temp.who(ARRAY['anon', 'C', 'A', 'CM', 'RA', 'PA'], $q$SELECT count(*)::text FROM public.safety_alert_updates$q$));
SELECT pg_temp.ck('A4e', 'append-only for every writer: the table owner cannot rewrite a message, re-point its actor, rewrite it while clearing the actor, or delete it', '^ERR 42501 alert_history_append_only;ERR 42501 alert_history_append_only;ERR 42501 alert_history_append_only;ERR 42501 alert_history_append_only$',
  pg_temp.pg($q$UPDATE public.safety_alert_updates SET description = 'rewritten' WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2') AND version = 2 RETURNING 'updated'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.safety_alert_updates SET actor_id = NULL, description = 'rewritten' WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2') AND version = 2 RETURNING 'updated'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.safety_alert_updates SET actor_id = pg_temp.u('C') WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2') AND version = 2 RETURNING 'updated'$q$) || ';' ||
  pg_temp.pg($q$DELETE FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2') AND version = 2 RETURNING 'deleted'$q$));
SELECT pg_temp.ck('A4f', 'exactly one message per version for every alert written through the RPCs (versions without a message, messages without a version)', '^0\|0$',
  (SELECT count(*) FROM public.safety_alerts sa, generate_series(2, sa.version) g(v)
    WHERE sa.id IN (SELECT v FROM ids WHERE k LIKE 'al%') AND NOT EXISTS (SELECT 1 FROM public.safety_alert_updates u WHERE u.alert_id = sa.id AND u.version = g.v))
  || '|' || (SELECT count(*) FROM public.safety_alert_updates u JOIN public.safety_alerts sa ON sa.id = u.alert_id WHERE u.version > sa.version));

SELECT pg_temp.ck('A4g', 'no value in the history a client reads is an account id (the owner''s, a moderator''s)', '^7?[67]\|0$',
  (SELECT count(*) || '|' || count(*) FILTER (WHERE EXISTS (SELECT 1 FROM unnest(ARRAY['A', 'CM', 'CM2', 'RA', 'PA']) w WHERE to_jsonb(h)::text LIKE '%' || pg_temp.u(w) || '%'))
     FROM public.safety_alert_history((SELECT v FROM ids WHERE k = 'al2')) h));

-- A5: the verified mark and self-moderation. al2 was verified by CM in A3d.
SELECT pg_temp.ck('A5a', 'verify: anon no EXECUTE; guests refused; a member and the alert''s owner are below the tier',
  '^anon=>ERR 42501 permission denied for function admin_verify_safety_alert;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;C=>ERR 42501 p3_denied:insufficient_tier;A=>ERR 42501 p3_denied:insufficient_tier;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'A'], $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'al1'))::text$q$));
SELECT pg_temp.ck('A5b', 'a moderator cannot verify their OWN alert; another moderator can (one audit row)', '^ERR 42501 self_moderation_refused\|\+0;OK true\|\+1$',
  pg_temp.audited('CM', $q$SELECT public.admin_verify_safety_alert('5a000000-0000-4000-8000-0000000000a2') ->> 'verified'$q$) || ';' ||
  pg_temp.audited('CM2', $q$SELECT public.admin_verify_safety_alert('5a000000-0000-4000-8000-0000000000a2') ->> 'verified'$q$));
SELECT pg_temp.ck('A5c', 'a second verify keeps the first verifier and writes no second audit row', '^OK true\|\+0;t$',
  pg_temp.audited('PA', $q$SELECT public.admin_verify_safety_alert('5a000000-0000-4000-8000-0000000000a2') ->> 'verified'$q$) || ';' ||
  pg_temp.fresh($q$SELECT (verified_by = pg_temp.u('CM2'))::char FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-0000000000a2'$q$));
SELECT pg_temp.ck('A5d', 'verify does not move the version', '^1$', (SELECT version::text FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-0000000000a2'));
SELECT pg_temp.ck('A5e', 'ANY edit by the reporter of a verified alert returns it to unverified, a LOWER severity alone included: verifier cleared; the message is the owner''s and names only severity + expiry',
  '^OK false\|t\|owner:de_escalated:\{severity,expires_at\}$',
  pg_temp.run('CM', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a2', p_severity => 1, p_expected_version => 1) ->> 'verified'$q$) || '|' ||
  pg_temp.fresh($q$SELECT (verified_by IS NULL AND verified_at IS NULL)::char FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-0000000000a2'$q$) || '|' ||
  pg_temp.fresh($q$SELECT actor_role || ':' || severity_change || ':' || changed::text FROM public.safety_alert_updates WHERE alert_id = '5a000000-0000-4000-8000-0000000000a2' AND version = 2$q$));
-- another moderator verifies it again (the mark is back for the next check)
SELECT pg_temp.run('CM2', $q$SELECT public.admin_verify_safety_alert('5a000000-0000-4000-8000-0000000000a2', 2) ->> 'verified'$q$);
SELECT pg_temp.ck('A5f', 'the reporter changes the text: back to unverified, verifier cleared (a moderator editing their own alert acts as its owner: no audit row)', '^OK false\|\+0\|t\|owner$',
  pg_temp.audited('CM', $q$SELECT public.update_safety_alert('5a000000-0000-4000-8000-0000000000a2', p_description => 'a different hazard', p_expected_version => 2) ->> 'verified'$q$) || '|' ||
  pg_temp.fresh($q$SELECT (verified_by IS NULL AND verified_at IS NULL)::char FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-0000000000a2'$q$) || '|' ||
  pg_temp.fresh($q$SELECT actor_role FROM public.safety_alert_updates WHERE alert_id = '5a000000-0000-4000-8000-0000000000a2' AND version = 3$q$));
SELECT pg_temp.ck('A5g', 'a moderator''s edit of SOMEONE ELSE''S verified alert keeps the mark: a new text, a higher severity, then a lower severity alone', '^OK true;OK true;OK true\|t$',
  pg_temp.run('CM2', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), p_description => 'black ice (checked)', p_expected_version => (SELECT version FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2'))) ->> 'verified'$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), p_severity => 2, p_expected_version => (SELECT version FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2'))) ->> 'verified'$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), p_severity => 1, p_expected_version => (SELECT version FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2'))) ->> 'verified'$q$) || '|' ||
  pg_temp.fresh($q$SELECT (verified_by IS NOT NULL AND severity = 1)::char FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2')$q$));
SELECT pg_temp.ck('A5h', 'the reporter moves it, changes its type or RAISES severity: each returns it to unverified', '^OK false;OK false;OK false$',
  (SELECT string_agg(pg_temp.run('A', format($q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al2'), %s, p_expected_version => (SELECT version FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2'))) ->> 'verified'$q$, a))
                     || CASE WHEN o < 3 THEN left(pg_temp.pg(format($q$UPDATE public.safety_alerts SET verified = true, verified_by = %L, verified_at = now() WHERE id = (SELECT v FROM ids WHERE k = 'al2') RETURNING ''$q$, pg_temp.u('CM'))), 0) ELSE '' END,
                     ';' ORDER BY o)
     FROM (VALUES (1, 'p_lng => -72.41, p_lat => 44.11'), (2, $q$p_type => 'road_closure'$q$), (3, 'p_severity => 3')) v(o, a)));
SELECT pg_temp.ck('A5i', 'a moderator may REMOVE their own alert (it only restricts): removed, one audit row, a cancel message by moderator', '^OK removed\|\+1\|cancel:moderator$',
  pg_temp.audited('CM', $q$SELECT public.admin_remove_safety_alert('5a000000-0000-4000-8000-0000000000a2', 'posted by mistake') ->> 'status'$q$) || '|' ||
  pg_temp.fresh($q$SELECT msg_type || ':' || actor_role FROM public.safety_alert_updates WHERE alert_id = '5a000000-0000-4000-8000-0000000000a2' ORDER BY version DESC LIMIT 1$q$));
SELECT pg_temp.ck('A5j', 'remove: anon no EXECUTE; guests refused; a member and the owner are below the tier; an over-long reason refused; removing again is a no-op',
  '^anon=>ERR 42501 permission denied for function admin_remove_safety_alert;G=>ERR 42501 Account required for this action;C=>ERR 42501 p3_denied:insufficient_tier;A=>ERR 42501 p3_denied:insufficient_tier;\|ERR 22023 alert_field_invalid:reason\|OK removed\|\+0$',
  pg_temp.who(ARRAY['anon', 'G', 'C', 'A'], $q$SELECT public.admin_remove_safety_alert((SELECT v FROM ids WHERE k = 'al1'))::text$q$) || '|' ||
  pg_temp.run('CM', $q$SELECT public.admin_remove_safety_alert((SELECT v FROM ids WHERE k = 'al1'), repeat('r', 501))::text$q$) || '|' ||
  pg_temp.audited('CM2', $q$SELECT public.admin_remove_safety_alert('5a000000-0000-4000-8000-0000000000a2') ->> 'status'$q$));

SELECT pg_temp.ck('A5k', 'each staff tier acts on SOMEONE ELSE''S alert: a resource admin verifies and a platform admin resolves the member''s; a resource admin removes the platform admin''s; a platform admin verifies the moderator''s (one audit row each)',
  '^OK true\|\+1;OK moderator\|\+1;OK removed\|\+1;OK true\|\+1$',
  pg_temp.audited('RA', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'pl_c')) ->> 'verified'$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'pl_c'), 1) ->> 'resolved_by_role'$q$) || ';' ||
  pg_temp.audited('RA', $q$SELECT public.admin_remove_safety_alert((SELECT v FROM ids WHERE k = 'pl_pa'), 'duplicate') ->> 'status'$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'pl_cm')) ->> 'verified'$q$));
SELECT pg_temp.ck('A5l', '... and none of them verifies their OWN (resource admin, platform admin)', '^ERR 42501 self_moderation_refused;ERR 42501 self_moderation_refused$',
  pg_temp.run('RA', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'pl_ra'))::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'pl_pa'))::text$q$));

-- A6: ONE predicate for live / resolved / gone, at every read site and every write
INSERT INTO ids VALUES ('s1', (SELECT v FROM ids WHERE k = 'al1')), ('s2', '5a000000-0000-4000-8000-000000000002'), ('s3', '5a000000-0000-4000-8000-000000000003'),
  ('s4', '5a000000-0000-4000-8000-000000000004'), ('s5', '5a000000-0000-4000-8000-000000000005'), ('s6', '5a000000-0000-4000-8000-000000000006'),
  ('s7', '5a000000-0000-4000-8000-000000000007'), ('s8', '5a000000-0000-4000-8000-000000000008');
SELECT pg_temp.ck('A6a', 'per state (s1 live .. s8 withdrawn): predicate | deployed-client reader | reader with resolved | direct table read (RLS) | history readable, for a member',
  '^s1=live\|1\|1\|1\|t;s2=gone\|0\|0\|1\|f;s3=gone\|0\|0\|0\|f;s4=gone\|0\|0\|0\|f;s5=gone\|0\|0\|0\|f;s6=resolved\|0\|1\|0\|t;s7=gone\|0\|0\|0\|f;s8=gone\|0\|0\|0\|f$',
  (SELECT string_agg(i.k || '=' || public.safety_alert_shown_state(sa.status, sa.expires_at, sa.resolved_at) || '|' ||
            substr(pg_temp.run('C', format('SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => %L)', i.v)), 4) || '|' ||
            substr(pg_temp.run('C', format('SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => %L, p_include_resolved => true)', i.v)), 4) || '|' ||
            substr(pg_temp.run('C', format('SELECT count(*)::text FROM public.safety_alerts WHERE id = %L', i.v)), 4) || '|' ||
            substr(pg_temp.run('C', format('SELECT (count(*) > 0)::char FROM public.safety_alert_history(%L)', i.v)), 4), ';' ORDER BY i.k)
     FROM ids i JOIN public.safety_alerts sa ON sa.id = i.v WHERE i.k ~ '^s[1-8]$'));
SELECT pg_temp.ck('A6b', 'the same for a logged-out visitor through the two readers (anon has no direct read)', '^s1=1\|1;s2=0\|0;s3=0\|0;s4=0\|0;s5=0\|0;s6=0\|1;s7=0\|0;s8=0\|0$',
  (SELECT string_agg(i.k || '=' || substr(pg_temp.run('anon', format('SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => %L)', i.v)), 4) || '|' ||
            substr(pg_temp.run('anon', format('SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => %L, p_include_resolved => true)', i.v)), 4), ';' ORDER BY i.k)
     FROM ids i WHERE i.k ~ '^s[1-8]$'));
SELECT pg_temp.ck('A6c', 'the client rule (status live AND expires_at > now) is exactly the predicate''s "live"; resolved is shown until resolved_at + 6 h', '^8\|live:t,resolved:f\|360$',
  (SELECT count(*) FILTER (WHERE (sa.status = 'live' AND sa.expires_at > now()) = (public.safety_alert_shown_state(sa.status, sa.expires_at, sa.resolved_at) = 'live'))::text
     FROM ids i JOIN public.safety_alerts sa ON sa.id = i.v WHERE i.k ~ '^s[1-8]$')
  || '|' || (SELECT string_agg(shown_state || ':' || (shown_until = expires_at)::char, ',' ORDER BY shown_state) FROM public.safety_alerts_in_view(p_include_resolved => true, p_limit => 100)
              WHERE id IN ((SELECT v FROM ids WHERE k = 's1'), '5a000000-0000-4000-8000-000000000006'))
  || '|' || (SELECT round(extract(epoch FROM shown_until - resolved_at) / 60)::text FROM public.safety_alerts_in_view(p_alert_id => '5a000000-0000-4000-8000-000000000006', p_include_resolved => true)));
SELECT pg_temp.ck('A6d', 'nothing changes a gone alert, and a resolved one is not live: update, resolve, vote and verify answer the kept sentence with PT410 on s2..s8',
  '^(s[2-8]=(ERR PT410 alert is no longer live \| \{"code": "alert_not_live", "status": "\w+"\}/){4};){7}$',
  (SELECT string_agg(i.k || '=' ||
            pg_temp.run('A',  format($q$SELECT public.update_safety_alert(%L, p_description => 'revive', p_severity => 4, p_expected_version => 1)::text$q$, i.v)) || '/' ||
            pg_temp.run('A',  format($q$SELECT public.resolve_safety_alert(%L, 1)::text$q$, i.v)) || '/' ||
            pg_temp.run('C',  format($q$SELECT public.vote_safety_alert(%L, 'confirm')::text$q$, i.v)) || '/' ||
            pg_temp.run('CM', format($q$SELECT public.admin_verify_safety_alert(%L)::text$q$, i.v)) || '/;', '' ORDER BY i.k)
     FROM ids i WHERE i.k ~ '^s[2-8]$'));
SELECT pg_temp.ck('A6e', '... and none of them moved: status, severity, version, expiry and vote counts are what was seeded', '^live\|2\|1\|0\|f\|-2;expired\|2\|1\|0\|f\|-60;cleared\|2\|1\|0\|f\|180;removed\|2\|1\|0\|f\|180;resolved\|2\|1\|0\|f\|60;resolved\|2\|1\|0\|f\|60;withdrawn\|2\|1\|0\|f\|180\|0$',
  (SELECT string_agg(pg_temp.al(i.v), ';' ORDER BY i.k) FROM ids i WHERE i.k ~ '^s[2-8]$') || '|' ||
  (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id IN (SELECT v FROM ids WHERE k ~ '^s[2-8]$')));
SELECT pg_temp.ck('A6f', 'withdraw and remove need a SHOWN alert: refused on every gone state (the already-removed one answers its own state to a moderator)',
  '^s2=ERR PT410 [^/]*/ERR PT410 [^;]*;s3=ERR PT410 [^/]*/ERR PT410 [^;]*;s4=ERR PT410 [^/]*/ERR PT410 [^;]*;s5=ERR PT410 [^/]*/OK removed;s7=ERR PT410 [^/]*/ERR PT410 [^;]*;s8=ERR PT410 [^/]*/ERR PT410 [^;]*;$',
  (SELECT string_agg(i.k || '=' || pg_temp.run('A', format('SELECT public.delete_safety_alert(%L)::text', i.v)) || '/' ||
                     pg_temp.run('CM', format($q$SELECT public.admin_remove_safety_alert(%L) ->> 'status'$q$, i.v)) || ';', '' ORDER BY i.k)
     FROM ids i WHERE i.k ~ '^s[234578]$'));
SELECT pg_temp.ck('A6g', 'a resolved alert that is still shown CAN be withdrawn by its owner and removed by a moderator', '^OK \|withdrawn\|2;OK removed\|removed\|2$',
  pg_temp.run('A', $q$SELECT public.delete_safety_alert('5a000000-0000-4000-8000-000000000016')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT status || '|' || version FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-000000000016'$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_remove_safety_alert('5a000000-0000-4000-8000-000000000026', 'false report') ->> 'status'$q$) || '|' ||
  pg_temp.fresh($q$SELECT status || '|' || version FROM public.safety_alerts WHERE id = '5a000000-0000-4000-8000-000000000026'$q$));
SELECT pg_temp.ck('A6h', 'the expire job is unchanged: it flips only the live row past its expiry (s2) and never touches a resolved one', '^1\|expired\|resolved\|resolved$',
  (SELECT public.expire_safety_alerts()::text) || '|' || pg_temp.fresh($q$SELECT string_agg(status, '|' ORDER BY id) FROM public.safety_alerts
     WHERE id IN ('5a000000-0000-4000-8000-000000000002', '5a000000-0000-4000-8000-000000000006', '5a000000-0000-4000-8000-000000000007')$q$));
SELECT pg_temp.ck('A6i', 'RLS on safety_alerts is still exactly status = ''live'' (one SELECT policy, authenticated)', '^safety_alerts_select:r:\{authenticated\}:\(status = ''live''::text\)$',
  (SELECT string_agg(polname || ':' || polcmd::text || ':' || polroles::regrole[]::text || ':' || pg_get_expr(polqual, polrelid), ';') FROM pg_policy WHERE polrelid = 'public.safety_alerts'::regclass));

-- A7: the ONE reader (map bbox, a single alert, the feed strip)
SELECT pg_temp.ck('A7a', 'the reader keeps id and the 13 columns the deployed client reads, in their order; 7 new ones follow; no identity column',
  '^TABLE\(id uuid, alert_type text, severity integer, description text, lng double precision, lat double precision, status text, confirm_count integer, clear_count integer, created_at timestamp with time zone, expires_at timestamp with time zone, verified boolean, is_mine boolean, version integer, updated_at timestamp with time zone, update_count integer, resolved_at timestamp with time zone, resolved_by_role text, shown_state text, shown_until timestamp with time zone\)$',
  pg_get_function_result('public.safety_alerts_in_view(double precision,double precision,double precision,double precision,uuid,boolean,integer)'::regprocedure));
SELECT pg_temp.ck('A7b', 'the deployed client''s bbox call (four named arguments): only live alerts inside the box, for a member and a logged-out visitor',
  '^C=>OK 2\|t\|live;anon=>OK 2\|t\|live;$',
  pg_temp.who(ARRAY['C', 'anon'], $q$SELECT count(*) || '|' || bool_and(lng BETWEEN -72.56 AND -72.385 AND lat BETWEEN 44.09 AND 44.26)::char || '|' || string_agg(DISTINCT status, ',')
                                       FROM public.safety_alerts_in_view(p_min_lng => -72.56, p_min_lat => 44.09, p_max_lng => -72.385, p_max_lat => 44.26)$q$));
SELECT pg_temp.ck('A7c', 'a p_alert_id-only call returns that alert; is_mine is true for its owner only (never for anon)', '^A=>OK 1\|t;C=>OK 1\|f;CM=>OK 1\|f;anon=>OK 1\|f;$',
  pg_temp.who(ARRAY['A', 'C', 'CM', 'anon'], $q$SELECT count(*) || '|' || bool_and(is_mine)::char FROM public.safety_alerts_in_view(p_alert_id => (SELECT v FROM ids WHERE k = 'al1'))$q$));
SELECT pg_temp.ck('A7d', 'the strip call (no arguments): five rows at most, live only, highest severity first then newest', '^5\|live\|t$',
  (SELECT count(*) || '|' || string_agg(DISTINCT shown_state, ',') || '|' ||
          (array_agg(severity ORDER BY o) = (SELECT array_agg(s ORDER BY s DESC, c DESC) FROM (SELECT severity s, created_at c FROM public.safety_alerts
                                               WHERE status = 'live' AND expires_at > now() ORDER BY severity DESC, created_at DESC LIMIT 5) x))::char
     FROM public.safety_alerts_in_view() WITH ORDINALITY v(id, alert_type, severity, description, lng, lat, status, confirm_count, clear_count, created_at, expires_at, verified, is_mine, version, updated_at, update_count, resolved_at, resolved_by_role, shown_state, shown_until, o)));
SELECT pg_temp.ck('A7e', 'with p_include_resolved the strip lists every live alert before any resolved one, and p_limit bounds it', '^t\|2$',
  (SELECT (max(o) FILTER (WHERE shown_state = 'live') < min(o) FILTER (WHERE shown_state = 'resolved'))::char
     FROM public.safety_alerts_in_view(p_include_resolved => true, p_limit => 100) WITH ORDINALITY v(id, alert_type, severity, description, lng, lat, status, confirm_count, clear_count, created_at, expires_at, verified, is_mine, version, updated_at, update_count, resolved_at, resolved_by_role, shown_state, shown_until, o))
  || '|' || (SELECT count(*) FROM public.safety_alerts_in_view(p_include_resolved => true, p_limit => 2)));

-- A8: resolve (shown for 6 hours, then gone)
SELECT pg_temp.ck('A8a', 'resolve: anon no EXECUTE; guest refused; a stranger is not the owner',
  '^anon=>ERR 42501 permission denied for function resolve_safety_alert;G=>ERR 42501 Account required for this action;C=>ERR 42501 not_alert_owner;$',
  pg_temp.who(ARRAY['anon', 'G', 'C'], $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'al1'), 7)::text$q$));
SELECT pg_temp.ck('A8b', 'the owner resolves: resolved, by role owner, version + 1, no audit row; shown for exactly 6 h; an all-clear message that expires with it',
  '^OK resolved\|\+0\|resolved\|owner\|8\|360\|all_clear:owner:360:\{status\}$',
  pg_temp.audited('A', $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'al1'), 7, 'crew cleared it') ->> 'shown_state'$q$) || '|' ||
  pg_temp.fresh($q$SELECT status || '|' || resolved_by_role || '|' || version || '|' || round(extract(epoch FROM (resolved_at + interval '6 hours') - now()) / 60) FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT msg_type || ':' || actor_role || ':' || round(extract(epoch FROM expires_at - sent_at) / 60) || ':' || changed::text FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al1') AND version = 8$q$));
SELECT pg_temp.ck('A8c', 'a resolved alert is shown, not live: the default reader and the direct read hide it, the flag shows it, a vote is refused, its history stays readable',
  '^0\|1\|0\|ERR PT410 alert is no longer live.*\|8$',
  substr(pg_temp.run('C', $q$SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => (SELECT v FROM ids WHERE k = 'al1'))$q$), 4) || '|' ||
  substr(pg_temp.run('C', $q$SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => (SELECT v FROM ids WHERE k = 'al1'), p_include_resolved => true)$q$), 4) || '|' ||
  substr(pg_temp.run('C', $q$SELECT count(*)::text FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al1')$q$), 4) || '|' ||
  pg_temp.run('C', $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al1'), 'confirm')::text$q$) || '|' ||
  substr(pg_temp.run('anon', $q$SELECT count(*)::text FROM public.safety_alert_history((SELECT v FROM ids WHERE k = 'al1'))$q$), 4));
SELECT pg_temp.ck('A8d', 'a moderator resolves someone else''s alert (here the NULL-owner one): by role moderator, one audit row', '^OK moderator\|\+1\|safety_alert.resolve$',
  pg_temp.audited('CM', $q$SELECT public.resolve_safety_alert('5a000000-0000-4000-8000-0000000000a0', 2, 'checked on site') ->> 'resolved_by_role'$q$) || '|' ||
  pg_temp.fresh($q$SELECT action FROM public.admin_actions ORDER BY id DESC LIMIT 1$q$));
INSERT INTO ids SELECT 'al3', ((substr(pg_temp.run('CM', $q$SELECT public.place_safety_alert('speeding', 2, 'racing on Elm', -72.3, 44.0)::text$q$), 4))::jsonb ->> 'id')::uuid;
SELECT pg_temp.ck('A8e', 'a moderator resolving their OWN alert acts as its owner: by role owner, no audit row (never "as moderator" on one''s own)', '^OK owner\|\+0$',
  pg_temp.audited('CM', $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'al3'), 1) ->> 'resolved_by_role'$q$));

-- A9: withdraw (the owner's "delete" is recorded; no row leaves)
INSERT INTO ids SELECT 'al4', ((substr(pg_temp.run('A', $q$SELECT public.place_safety_alert('general', 2, 'wrong pin', -72.2, 43.9)::text$q$), 4))::jsonb ->> 'id')::uuid;
SELECT pg_temp.run('C', $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al4'), 'confirm') ->> 'confirm_count'$q$);
SELECT pg_temp.ck('A9a', 'the deployed client''s delete call: the alert is WITHDRAWN (row kept, version + 1, vote kept), with a cancel message by owner; it leaves every reader at once',
  '^OK \|withdrawn\|2\|1\|1\|cancel:owner:1\|0\|0$',
  pg_temp.run('A', $q$SELECT public.delete_safety_alert((SELECT v FROM ids WHERE k = 'al4'))::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT status || '|' || version || '|' || confirm_count || '|' || (SELECT count(*) FROM public.safety_alert_votes v WHERE v.alert_id = sa.id) FROM public.safety_alerts sa WHERE id = (SELECT v FROM ids WHERE k = 'al4')$q$) || '|' ||
  pg_temp.fresh($q$SELECT msg_type || ':' || actor_role || ':' || supersedes_version FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al4') AND version = 2$q$) || '|' ||
  substr(pg_temp.run('A', $q$SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => (SELECT v FROM ids WHERE k = 'al4'), p_include_resolved => true)$q$), 4) || '|' ||
  substr(pg_temp.run('A', $q$SELECT count(*)::text FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al4')$q$), 4));
SELECT pg_temp.t('A9b', 'withdrawing again answers the kept sentence (nothing changes a gone alert)', '^ERR PT410 alert is no longer live', 'A',
  $q$SELECT public.delete_safety_alert((SELECT v FROM ids WHERE k = 'al4'))::text$q$);

-- A10: votes. Three "Gone now" votes clear the alert at once (gone, never shown as resolved).
INSERT INTO ids SELECT 'al5', ((substr(pg_temp.run('A', $q$SELECT public.place_safety_alert('general', 2, 'dog loose', -72.1, 43.8)::text$q$), 4))::jsonb ->> 'id')::uuid;
SELECT pg_temp.ck('A10a', 'vote: anon no EXECUTE; guest refused; an unknown vote refused with a token; a member''s vote counts once (a changed vote replaces it)',
  '^anon=>ERR 42501 permission denied for function vote_safety_alert;G=>ERR 42501 Account required for this action;\|ERR 22023 alert_field_invalid:vote\|OK 1/0\|OK 0/1\|OK 1/0$',
  pg_temp.who(ARRAY['anon', 'G'], $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'confirm')::text$q$) || '|' ||
  pg_temp.run('C', $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'maybe')::text$q$) || '|' ||
  pg_temp.run('C', $q$SELECT (j ->> 'confirm_count') || '/' || (j ->> 'clear_count') FROM public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'confirm') j$q$) || '|' ||
  pg_temp.run('C', $q$SELECT (j ->> 'confirm_count') || '/' || (j ->> 'clear_count') FROM public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'clear') j$q$) || '|' ||
  pg_temp.run('C', $q$SELECT (j ->> 'confirm_count') || '/' || (j ->> 'clear_count') FROM public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'confirm') j$q$));
SELECT pg_temp.ck('A10b', 'two clears do not clear; the third (outnumbering the one "Still here") does: status cleared in the answer the deployed client reads; a later vote is refused',
  '^OK live\|OK live\|OK cleared\|ERR PT410 alert is no longer live',
  pg_temp.run('C2', $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'clear') ->> 'status'$q$) || '|' ||
  pg_temp.run('C3', $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'clear') ->> 'status'$q$) || '|' ||
  pg_temp.run('B',  $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'clear') ->> 'status'$q$) || '|' ||
  pg_temp.run('B2', $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al5'), 'clear') ->> 'status'$q$));
SELECT pg_temp.ck('A10c', 'cleared = gone at once: no reader shows it, with or without resolved; votes never moved the version or wrote a message', '^gone\|0\|0\|1\|1\|f$',
  (SELECT public.safety_alert_shown_state(status, expires_at, resolved_at) FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al5')) || '|' ||
  substr(pg_temp.run('C', $q$SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => (SELECT v FROM ids WHERE k = 'al5'))$q$), 4) || '|' ||
  substr(pg_temp.run('C', $q$SELECT count(*)::text FROM public.safety_alerts_in_view(p_alert_id => (SELECT v FROM ids WHERE k = 'al5'), p_include_resolved => true)$q$), 4) || '|' ||
  (SELECT version || '|' || (SELECT count(*) FROM public.safety_alert_updates u WHERE u.alert_id = sa.id) || '|' || (resolved_at IS NOT NULL)::char
     FROM public.safety_alerts sa WHERE id = (SELECT v FROM ids WHERE k = 'al5')));

INSERT INTO ids SELECT 'al7', ((substr(pg_temp.run('A', $q$SELECT public.place_safety_alert('general', 2, 'contested', -72.05, 43.75)::text$q$), 4))::jsonb ->> 'id')::uuid;
SELECT pg_temp.ck('A10d', 'three clears that do NOT outnumber three "Still here" votes leave it live; the fourth clear clears it', '^live,live,live,live,live,live,cleared$',
  (SELECT string_agg(substr(pg_temp.run(w, format($q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al7'), %L) ->> 'status'$q$, vt)), 4), ',' ORDER BY o)
     FROM (VALUES (1, 'C', 'confirm'), (2, 'C2', 'confirm'), (3, 'C3', 'confirm'), (4, 'B', 'clear'), (5, 'B2', 'clear'), (6, 'CM', 'clear'), (7, 'CM2', 'clear')) x(o, w, vt)));

-- A11: reporter anonymity. No answer, no reader and no grant carries created_by / verified_by (or the raw location / actor).
INSERT INTO ids SELECT 'al6', ((substr(pg_temp.run('A', $q$SELECT public.place_safety_alert('general', 2, 'for the key check', -72.0, 43.7)::text$q$), 4))::jsonb ->> 'id')::uuid;
SELECT pg_temp.ck('A11a', 'every alert RPC answers with the same 20 keys: place, vote, update, verify, resolve, remove',
  '^(alert_type,clear_count,confirm_count,created_at,description,expires_at,id,is_mine,lat,lng,resolved_at,resolved_by_role,severity,shown_state,shown_until,status,update_count,updated_at,verified,version;){6}$',
  pg_temp.keys(pg_temp.run('C',  $q$SELECT public.place_safety_alert('general', 1, 'keys', -71.9, 43.6)::text$q$)) || ';' ||
  pg_temp.keys(pg_temp.run('C',  $q$SELECT public.vote_safety_alert((SELECT v FROM ids WHERE k = 'al6'), 'confirm')::text$q$)) || ';' ||
  pg_temp.keys(pg_temp.run('A',  $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 'al6'), p_description => 'keys', p_expected_version => 1)::text$q$)) || ';' ||
  pg_temp.keys(pg_temp.run('CM', $q$SELECT public.admin_verify_safety_alert((SELECT v FROM ids WHERE k = 'al6'))::text$q$)) || ';' ||
  pg_temp.keys(pg_temp.run('CM', $q$SELECT public.resolve_safety_alert((SELECT v FROM ids WHERE k = 'al6'), 2)::text$q$)) || ';' ||
  pg_temp.keys(pg_temp.run('CM', $q$SELECT public.admin_remove_safety_alert((SELECT v FROM ids WHERE k = 'al6'))::text$q$)) || ';');
SELECT pg_temp.ck('A11b', 'no function of the alert family returns or names an identity column in its result', '^0$',
  (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname ~ 'safety_alert'
     AND p.prorettype <> 'trigger'::regtype AND pg_get_function_result(p.oid) ~ '(created_by|verified_by|actor_id|safety_alerts\M)'));
SELECT pg_temp.ck('A11c', 'column grants: created_by and verified_by are selectable by no client role; the five new columns are; no table-level write bit is left', '^ffff\|tttttttttt\|0$',
  (SELECT string_agg(has_column_privilege(r, 'public.safety_alerts', c, 'SELECT')::char, '' ORDER BY c, r) FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['created_by', 'verified_by']) c)
  || '|' || (SELECT string_agg(has_column_privilege(r, 'public.safety_alerts', c, 'SELECT')::char, '' ORDER BY c, r) FROM unnest(ARRAY['anon', 'authenticated']) r,
               unnest(ARRAY['version', 'updated_at', 'update_count', 'resolved_at', 'resolved_by_role']) c)
  || '|' || (SELECT count(*) FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['public.safety_alerts', 'public.safety_alert_votes', 'public.safety_alert_updates']) t,
               unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) p WHERE has_table_privilege(r, t, p)));
SELECT pg_temp.ck('A11d', 'a direct read of either identity column is refused for every viewer (a moderator and a platform admin included)', '^(\w+=>ERR 42501 permission denied for table safety_alerts;){12}$',
  pg_temp.who(ARRAY['anon', 'G', 'C', 'A', 'CM', 'PA'], 'SELECT created_by::text FROM public.safety_alerts LIMIT 1') ||
  pg_temp.who(ARRAY['anon', 'G', 'C', 'A', 'CM', 'PA'], 'SELECT verified_by::text FROM public.safety_alerts LIMIT 1'));
SELECT pg_temp.ck('A11e', 'the deployed client''s three direct reads still work: the strip (10 columns), the admin list, the map-focus read (id, location, status, expires_at)', '^OK t;OK t;OK t$',
  pg_temp.run('C',  $q$SELECT (count(*) > 0)::char FROM (SELECT id, alert_type, severity, description, created_at, expires_at, status, confirm_count, clear_count, verified FROM public.safety_alerts WHERE expires_at > now() ORDER BY severity DESC, created_at DESC LIMIT 5) s$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT (count(*) > 0)::char FROM (SELECT id, status, alert_type, severity, description, confirm_count, clear_count, created_at, expires_at, verified FROM public.safety_alerts WHERE status = 'live' AND expires_at > now()) s$q$) || ';' ||
  pg_temp.run('C',  $q$SELECT (count(*) > 0)::char FROM (SELECT id, location, status, expires_at FROM public.safety_alerts WHERE status = 'live' AND expires_at > now()) s$q$));
-- A11g: everything a client is sent. alscan is A's alert, verified by CM; every answer and every error text (message,
-- DETAIL and HINT) of the alert RPCs and readers is collected, for strangers, moderators, a guest and anon.
INSERT INTO ids SELECT 'alscan', ((substr(pg_temp.run('A', $q$SELECT public.place_safety_alert('general', 2, 'for the identity scan', -72.05, 43.75)::text$q$), 4))::jsonb ->> 'id')::uuid;
CREATE TEMP TABLE scan (n serial, src text, txt text);
GRANT ALL ON scan TO PUBLIC; GRANT ALL ON SEQUENCE scan_n_seq TO PUBLIC;
DO $scan$
DECLARE r record; v_al text := quote_literal((SELECT v FROM ids WHERE k = 'alscan')) || '::uuid';
BEGIN
  FOR r IN SELECT * FROM (VALUES
     (1,  'verify',                 'CM',   'SELECT public.admin_verify_safety_alert($AL)::text'),
     (2,  'update, stale version',  'CM2',  'SELECT public.update_safety_alert($AL, p_description => ''z'', p_expected_version => 99)::text'),
     (3,  'resolve, stale version', 'CM2',  'SELECT public.resolve_safety_alert($AL, 99)::text'),
     (4,  'remove, stale version',  'CM2',  'SELECT public.admin_remove_safety_alert($AL, ''r'', 99)::text'),
     (5,  'verify, stale version',  'CM2',  'SELECT public.admin_verify_safety_alert($AL, 99)::text'),
     (6,  'update by a stranger',   'C',    'SELECT public.update_safety_alert($AL, p_description => ''z'', p_expected_version => 1)::text'),
     (7,  'resolve by a stranger',  'C',    'SELECT public.resolve_safety_alert($AL, 1)::text'),
     (8,  'withdraw by a stranger', 'C',    'SELECT public.delete_safety_alert($AL)::text'),
     (9,  'update, bad severity',   'CM2',  'SELECT public.update_safety_alert($AL, p_severity => 9, p_expected_version => 1)::text'),
     (10, 'update, bad type',       'CM2',  'SELECT public.update_safety_alert($AL, p_type => ''nope'', p_expected_version => 1)::text'),
     (11, 'update, long note',      'CM2',  'SELECT public.update_safety_alert($AL, p_description => ''q'', p_note => repeat(''n'', 501), p_expected_version => 1)::text'),
     (12, 'update, half a location','CM2',  'SELECT public.update_safety_alert($AL, p_lng => -72, p_expected_version => 1)::text'),
     (13, 'update by a guest',      'G',    'SELECT public.update_safety_alert($AL, p_description => ''z'', p_expected_version => 1)::text'),
     (14, 'verify by a member',     'C',    'SELECT public.admin_verify_safety_alert($AL)::text'),
     (15, 'vote, bad value',        'C',    'SELECT public.vote_safety_alert($AL, ''maybe'')::text'),
     (16, 'vote',                   'C',    'SELECT public.vote_safety_alert($AL, ''confirm'')::text'),
     (17, 'reader, one alert',      'anon', 'SELECT jsonb_agg(to_jsonb(v))::text FROM public.safety_alerts_in_view(p_alert_id => $AL) v'),
     (18, 'reader, one alert',      'CM2',  'SELECT jsonb_agg(to_jsonb(v))::text FROM public.safety_alerts_in_view(p_alert_id => $AL) v'),
     (19, 'history',                'C',    'SELECT jsonb_agg(to_jsonb(v))::text FROM public.safety_alert_history($AL) v'),
     (20, 'update by a moderator',  'CM2',  'SELECT public.update_safety_alert($AL, p_description => ''checked'', p_expected_version => 1)::text'),
     (21, 'remove by a moderator',  'CM2',  'SELECT public.admin_remove_safety_alert($AL, ''duplicate'', 2)::text'),
     (22, 'update, gone',           'CM2',  'SELECT public.update_safety_alert($AL, p_description => ''late'', p_expected_version => 3)::text'),
     (23, 'resolve, gone',          'CM2',  'SELECT public.resolve_safety_alert($AL, 3)::text'),
     (24, 'vote, gone',             'C',    'SELECT public.vote_safety_alert($AL, ''clear'')::text'),
     (25, 'verify, gone',           'CM2',  'SELECT public.admin_verify_safety_alert($AL)::text'),
     (26, 'withdraw, gone',         'A',    'SELECT public.delete_safety_alert($AL)::text'),
     (27, 'update by its owner, gone', 'A', 'SELECT public.update_safety_alert($AL, p_description => ''late'', p_expected_version => 3)::text'),
     (28, 'history',                'anon', 'SELECT jsonb_agg(to_jsonb(v))::text FROM public.safety_alert_history($AL) v')
  ) v(o, src, w, q) ORDER BY o LOOP
    INSERT INTO scan (src, txt) VALUES (r.src || ' / ' || r.w, pg_temp.runx(r.w, replace(r.q, '$AL', v_al)));
  END LOOP;
END $scan$;
SELECT pg_temp.ck('A11g', 'no answer and no error text (message, DETAIL, HINT) of the alert RPCs and readers carries an account id or names an identity key: texts scanned | errors among them, with a DETAIL | carrying any principal''s id | naming an identity key | the scanner finds the alert id in the answers',
  '^28\|20:10\|0\|0\|t$',
  (SELECT count(*) || '|' || count(*) FILTER (WHERE txt LIKE 'ERR %') || ':' || count(*) FILTER (WHERE txt LIKE 'ERR % | {%')
          || '|' || count(*) FILTER (WHERE txt ~ (SELECT string_agg(pg_temp.u(w)::text, '|') FROM unnest(ARRAY['A','B','B2','C','C2','C3','G','GT','CM','CM2','RA','PA','OA','XM']) w))
          || '|' || count(*) FILTER (WHERE txt ~ '(created_by|verified_by|actor_id|reporter)')
          || '|' || (count(*) FILTER (WHERE txt LIKE 'OK %' AND txt ~ (SELECT v::text FROM ids WHERE k = 'alscan')) >= 6)::char
     FROM scan));
-- A11f: the audit rows. A platform admin reads admin_actions, so no row may carry the reporter (or, on another
-- moderator's row, the verifier). Every safety_alert.* row written above is scanned as jsonb text, minus its own
-- actor_id; alscan (verified by CM, then updated and removed by CM2) is among them.
SELECT pg_temp.ck('A11f', 'no audit row of an alert action carries the reporter''s id or names an identity key, anywhere in the row (details, reason, target): verify, remove, update and resolve rows about someone else''s alert, and rows written by a moderator other than the verifier, are among those scanned; rows carrying an id | rows naming an identity key | the scanner finds the alert id in every row | a platform admin reads these rows',
  '^verify:t,remove:t,update:t,resolve:t,by-another:t\|0\|0\|t\|OK t$',
  (SELECT 'verify:' || (count(*) FILTER (WHERE aa.action = 'safety_alert.verify' AND sa.created_by <> aa.actor_id) > 0)::char
          || ',remove:' || (count(*) FILTER (WHERE aa.action = 'safety_alert.remove' AND sa.created_by <> aa.actor_id) > 0)::char
          || ',update:' || (count(*) FILTER (WHERE aa.action = 'safety_alert.update' AND sa.created_by <> aa.actor_id) > 0)::char
          || ',resolve:' || (count(*) FILTER (WHERE aa.action = 'safety_alert.resolve' AND sa.created_by <> aa.actor_id) > 0)::char
          || ',by-another:' || (count(*) FILTER (WHERE aa.action IN ('safety_alert.update', 'safety_alert.remove') AND sa.verified_by <> aa.actor_id) > 0)::char
          || '|' || count(*) FILTER (WHERE (to_jsonb(aa) - 'actor_id')::text ~ sa.created_by::text
                                        OR (sa.verified_by <> aa.actor_id AND (to_jsonb(aa) - 'actor_id')::text ~ sa.verified_by::text))
          || '|' || count(*) FILTER (WHERE aa.details::text ~ '"(created_by|verified_by|reporter|reporter_id|owner|owner_id)"')
          || '|' || bool_and((to_jsonb(aa) - 'actor_id')::text ~ sa.id::text)::char
     FROM public.admin_actions aa JOIN public.safety_alerts sa ON sa.id::text = aa.target_id
    WHERE aa.action LIKE 'safety_alert.%' AND sa.created_by IS NOT NULL)
  || '|' || pg_temp.run('PA', $q$SELECT (count(*) > 3)::char FROM public.admin_actions WHERE action LIKE 'safety_alert.%'$q$));

SELECT pg_temp.ck('A12', 'alerts stay off realtime: no alert table is a member of the publication', '^0$',
  (SELECT count(*)::text FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename ~ '^safety_alert'));

-- ===================== B: labels =====================
SELECT pg_temp.run('A', $q$SELECT public.delete_own_post('00000000-0000-4000-a000-00000000000f')::text$q$);
CREATE TEMP TABLE rank0 AS SELECT id, score FROM public.ranked_feed_v2(NULL, NULL, 1000);      -- before any label
SELECT pg_temp.ck('B1a', 'apply: anon no EXECUTE; guests refused (also the one holding the top tier); a member, a seeker and the post''s author are below the tier',
  '^anon=>ERR 42501 permission denied for function admin_set_post_label;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;C=>ERR 42501 p3_denied:insufficient_tier;B=>ERR 42501 p3_denied:insufficient_tier;A=>ERR 42501 p3_denied:insufficient_tier;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'B', 'A'], $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'outdated', true, 1, 'hours changed')::text$q$));
SELECT pg_temp.ck('B1b', 'a community moderator applies "outdated" with a reason: one record at the post''s version, one audit row',
  '^OK \{(?=.*"applied": true)(?=.*"changed": true)(?=.*"post_version": 1)(?=.*"label": "outdated").*\|\+1\|outdated:1:community_moderator:Hours changed in September:t$',
  pg_temp.audited('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'outdated', true, 1, '  Hours changed in September ')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT label || ':' || post_version || ':' || source_role || ':' || reason || ':' || (applied_by = pg_temp.u('CM'))::char FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a'$q$));
SELECT pg_temp.ck('B1c', 'a resource admin and a platform admin apply too; each record names its own tier', '^OK true;OK true\|misleading:resource_admin,outdated:community_moderator,sensitive:platform_admin$',
  pg_temp.run('RA', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'misleading', true, 1, 'the pantry moved') ->> 'changed'$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'sensitive', true, NULL, 'graphic photo') ->> 'changed'$q$) || '|' ||
  pg_temp.fresh($q$SELECT string_agg(label || ':' || source_role, ',' ORDER BY label) FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND retracted_at IS NULL$q$));
SELECT pg_temp.ck('B1d', 'validation: a reason is required to apply; unknown label; NULL applied; bad ground; over-long reason; a report that is not about this post; missing post; stale version',
  '^ERR 22023 label_field_required:reason;ERR 22023 label_field_required:reason;ERR 22023 label_invalid:spicy;ERR 22023 label_invalid:<null>;ERR 22023 label_field_required:applied;ERR 22023 label_field_invalid:ground;ERR 22023 label_field_invalid:reason;ERR 22023 label_field_invalid:report;ERR PT404 post_not_found;ERR PT409 edit_conflict.*$',
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true, 1)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true, 1, '   ')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'spicy', true, 1, 'r')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', NULL, true, 1, 'r')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', NULL, 1, 'r')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true, 1, 'r', 'because')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true, 1, repeat('r', 501))::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true, 1, 'r', 'incompatible_content', '0c0ffee0-0000-4000-8000-000000000000')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-0000000000ff', 'outdated', true, 1, 'r')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true, 9, 'r')::text$q$));
SELECT pg_temp.ck('B1e', 'none of those refusals wrote a record or an audit row; a deleted post takes no label', '^0\|0\|ERR PT404 post_deleted;ERR PT404 post_not_found$',
  (SELECT count(*) FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-000000000001') || '|' ||
  (SELECT count(*) FROM public.admin_actions WHERE action IN ('post.label', 'post.unlabel') AND target_id = '00000000-0000-4000-a000-000000000001') || '|' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000f', 'outdated', true, NULL, 'r')::text$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-00000000000f', 'sensitive', true)::text$q$));
SELECT pg_temp.ck('B1f', 'the same label again at the same version changes nothing: no second record, no audit row', '^OK false\|\+0\|1$',
  pg_temp.audited('CM2', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'outdated', true, 1, 'again') ->> 'changed'$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'outdated'$q$));
SELECT pg_temp.ck('B2a', 'posts.labels is the sorted set of the active records, read by anon, a guest and a member from the post row',
  '^anon=>OK \{misleading,outdated,sensitive\};G=>OK \{misleading,outdated,sensitive\};C=>OK \{misleading,outdated,sensitive\};$',
  pg_temp.who(ARRAY['anon', 'G', 'C'], $q$SELECT labels::text FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000a'$q$));
SELECT pg_temp.ck('B2b', 'the public part of a record (label, version, role, when) is readable wherever the post is', '^anon=>OK misleading@1/resource_admin,outdated@1/community_moderator,sensitive@1/platform_admin;C=>OK misleading@1/resource_admin,outdated@1/community_moderator,sensitive@1/platform_admin;$',
  pg_temp.who(ARRAY['anon', 'C'], $q$SELECT string_agg(label || '@' || post_version || '/' || source_role, ',' ORDER BY label) FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a'$q$));
SELECT pg_temp.ck('B2c', 'reason, who applied, who retracted and why are selectable by NO client role (column grants), also not by staff or the author',
  '^ffffffffffff\|(\w+=>ERR 42501 permission denied for table post_labels;){12}$',
  (SELECT string_agg(has_column_privilege(r, 'public.post_labels', c, 'SELECT')::char, '' ORDER BY c, r) FROM unnest(ARRAY['anon', 'authenticated']) r,
     unnest(ARRAY['reason', 'applied_by', 'retracted_by', 'retracted_by_role', 'retract_reason', 'source_kind']) c) || '|' ||
  pg_temp.who(ARRAY['anon', 'C', 'A', 'CM', 'RA', 'PA'], 'SELECT reason FROM public.post_labels LIMIT 1') ||
  pg_temp.who(ARRAY['anon', 'C', 'A', 'CM', 'RA', 'PA'], 'SELECT applied_by::text FROM public.post_labels LIMIT 1'));
SELECT pg_temp.ck('B2d', 'no client role writes label records or posts.labels directly', '^0\|C=>ERR 42501 permission denied for table post_labels;CM=>ERR 42501 permission denied for table post_labels;\|A=>ERR 42501 permission denied for table posts;CM=>ERR 42501 permission denied for table posts;$',
  (SELECT count(*) FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) p WHERE has_table_privilege(r, 'public.post_labels', p)) || '|' ||
  pg_temp.who(ARRAY['C', 'CM'], $q$INSERT INTO public.post_labels (post_id, label, post_version, source_role) VALUES ('00000000-0000-4000-a000-000000000001', 'outdated', 1, 'platform_admin') RETURNING 'forged'$q$) || '|' ||
  pg_temp.who(ARRAY['A', 'CM'], $q$UPDATE public.posts SET labels = '{}' WHERE id = '00000000-0000-4000-a000-00000000000a' RETURNING 'cleared'$q$));
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000c', 'misleading', true, NULL, 'held and labelled')::text$q$);
SELECT pg_temp.ck('B2e', 'a held post: its labels stop being readable with the post for anon and a member; its author and staff keep reading (records | post rows)',
  '^anon=>OK 0\|0;C=>OK 0\|0;A=>OK 1\|1;CM=>OK 1\|1;$',
  pg_temp.who(ARRAY['anon', 'C', 'A', 'CM'], $q$SELECT (SELECT count(*) FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000c') || '|' || (SELECT count(*) FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000c')$q$));

-- B3: retraction (negation, not deletion)
SELECT pg_temp.ck('B3a', 'retract: the post''s author and a member are below the tier; guests refused', '^A=>ERR 42501 p3_denied:insufficient_tier;C=>ERR 42501 p3_denied:insufficient_tier;GT=>ERR 42501 guest_refused;$',
  pg_temp.who(ARRAY['A', 'C', 'GT'], $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'outdated', false)::text$q$));
SELECT pg_temp.ck('B3b', 'a moderator retracts: the record stays, marked retracted (when, role, why); posts.labels loses it; one audit row; again = no change',
  '^OK true\|\+1\|t:community_moderator:author fixed the hours:t\|\{misleading,sensitive\}\|OK false\|\+0\|post.unlabel$',
  pg_temp.audited('CM2', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'outdated', false, 1, 'author fixed the hours') ->> 'changed'$q$) || '|' ||
  pg_temp.fresh($q$SELECT (retracted_at = now())::char || ':' || retracted_by_role || ':' || retract_reason || ':' || (retracted_by = pg_temp.u('CM2'))::char FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'outdated'$q$) || '|' ||
  pg_temp.fresh($q$SELECT labels::text FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000a'$q$) || '|' ||
  pg_temp.audited('CM2', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'outdated', false, 1) ->> 'changed'$q$) || '|' ||
  pg_temp.fresh($q$SELECT action FROM public.admin_actions ORDER BY id DESC LIMIT 1$q$));
SELECT pg_temp.ck('B3c', 'a retracted record is read by staff only (anon, member, author: active records)', '^anon=>OK 0;C=>OK 0;A=>OK 0;CM=>OK 1;PA=>OK 1;$',
  pg_temp.who(ARRAY['anon', 'C', 'A', 'CM', 'PA'], $q$SELECT count(*)::text FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND retracted_at IS NOT NULL$q$));
SELECT pg_temp.ck('B3d', 'no self-lift: a moderator labels their OWN post (it only restricts) and cannot retract from it; another moderator can',
  '^OK true;ERR 42501 self_moderation_refused;OK true$',
  pg_temp.run('CM',  $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000004', 'outdated', true, 1, 'superseded by a newer post') ->> 'applied'$q$) || ';' ||
  pg_temp.run('CM',  $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000004', 'outdated', false, 1) ->> 'changed'$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000004', 'outdated', false, 1) ->> 'changed'$q$));
SELECT pg_temp.ck('B3e', 'append-only for every writer: the table owner cannot rewrite a record, un-retract one, change a record while retracting it, or delete one',
  '^ERR 42501 labels_append_only;ERR 42501 labels_append_only;ERR 42501 labels_append_only;ERR 42501 labels_append_only;ERR 42501 labels_append_only$',
  pg_temp.pg($q$UPDATE public.post_labels SET reason = 'rewritten' WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'misleading' RETURNING 'updated'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.post_labels SET applied_by = NULL, reason = 'rewritten' WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'misleading' RETURNING 'updated'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.post_labels SET retracted_at = NULL, retracted_by = NULL, retracted_by_role = NULL, retract_reason = NULL WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'outdated' RETURNING 'unretracted'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.post_labels SET retracted_at = now(), retracted_by_role = 'platform_admin', post_version = 7 WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'misleading' RETURNING 'retracted+changed'$q$) || ';' ||
  pg_temp.pg($q$DELETE FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'outdated' RETURNING 'deleted'$q$));
SELECT pg_temp.ck('B3f', 'one active record per label and source class at most (a second one is refused by the index)', '^ERR 23505 duplicate key value violates unique constraint "post_labels_one_active"$',
  pg_temp.pg($q$INSERT INTO public.post_labels (post_id, label, post_version, source_role) VALUES ('00000000-0000-4000-a000-00000000000a', 'misleading', 1, 'platform_admin') RETURNING 'second'$q$));

-- B4: the author's own "sensitive"
SELECT pg_temp.ck('B4a', 'an author marks their own post sensitive: a record by "author", no audit row; the answer carries the labels', '^OK \["sensitive"\]\|\+0\|sensitive:author:1:t$',
  pg_temp.audited('A', $q$SELECT (public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', true, 1) -> 'labels')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT label || ':' || source_role || ':' || post_version || ':' || (reason IS NULL)::char FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-000000000001'$q$));
SELECT pg_temp.ck('B4b', 'only "sensitive" is self-applicable; only on one''s own post; guests refused (also on their own post, with the top tier); anon no EXECUTE; not on a removed post; stale version refused',
  '^ERR 42501 label_not_self_applicable:outdated;ERR 42501 label_not_self_applicable:misleading;ERR 42501 not_author;ERR 42501 not_author;ERR 42501 guest_refused;ERR 42501 permission denied for function set_own_post_label;ERR 42501 post_removed;ERR PT409 edit_conflict.*;ERR 22023 label_field_required:applied$',
  pg_temp.run('A',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'outdated', true)::text$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'misleading', true)::text$q$) || ';' ||
  pg_temp.run('C',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', true)::text$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', false)::text$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000005', 'sensitive', true)::text$q$) || ';' ||
  pg_temp.run('anon', $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', true)::text$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-00000000000e', 'sensitive', true)::text$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', false, 9)::text$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', NULL)::text$q$));
SELECT pg_temp.ck('B4c', 'a moderator''s "sensitive" on the same post is a SEPARATE record: the author retracts their own and the label stays; the author cannot lift the moderator''s',
  '^OK true;OK \["sensitive"\];ERR 42501 p3_denied:insufficient_tier\|author:t,platform_admin:f\|\{sensitive\}$',
  pg_temp.run('PA', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', true, 1, 'graphic injury photo') ->> 'changed'$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT (public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', false) -> 'labels')::text$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', false)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT string_agg(source_role || ':' || (retracted_at IS NOT NULL)::char, ',' ORDER BY source_role) FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-000000000001'$q$) || '|' ||
  pg_temp.fresh($q$SELECT labels::text FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000001'$q$));
SELECT pg_temp.ck('B4d', 'applying one''s own label twice, or retracting when none is active, writes nothing', '^2\|2$',
  (SELECT count(*)::text FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-000000000001') || '|' ||
  left(pg_temp.run('A', $q$SELECT public.set_own_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', false)::text$q$), 0) ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-000000000001'$q$));

SELECT pg_temp.ck('B4e', 'a resource admin retracts the platform admin''s "sensitive" (any staff tier lifts another''s label): the post carries no label any more', '^OK true\|\{\}\|resource_admin$',
  pg_temp.run('RA', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000001', 'sensitive', false, 1, 'photo replaced') ->> 'changed'$q$) || '|' ||
  pg_temp.fresh($q$SELECT labels::text FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000001'$q$) || '|' ||
  pg_temp.fresh($q$SELECT retracted_by_role FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-000000000001' AND source_kind = 'moderator'$q$));

-- B5: version-aware. Pa carries a moderator's "misleading" and "sensitive" at version 1.
SELECT pg_temp.ck('B5a', 'the author edits a moderator-labelled post: the labels stay, the records still name version 1, the post is flagged for review', '^OK 2\|\{misleading,sensitive\}\|1,1\|t$',
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-00000000000a', 1, '{"content":"pantry hours 10 to 6"}') ->> 'version'$q$) || '|' ||
  pg_temp.fresh($q$SELECT labels::text FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000a'$q$) || '|' ||
  pg_temp.fresh($q$SELECT string_agg(post_version::text, ',') FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND retracted_at IS NULL$q$) || '|' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000a'$q$));
SELECT pg_temp.ck('B5b', 'a moderator acting on the version they no longer see is refused PT409 (needs_review true in DETAIL)', '^ERR PT409 edit_conflict \| \{(?=.*"needs_review": true)(?=.*"current_version": 2)',
  pg_temp.run('CM2', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'misleading', false, 1, 'fixed')::text$q$));
SELECT pg_temp.ck('B5c', 're-affirming at the new version supersedes: the old record is retracted ("superseded"), a new one names version 2, the audit row links them, the review flag clears',
  '^OK \{(?=.*"changed": true)(?=.*"post_version": 2).*\|\+1\|misleading@1:t:superseded,misleading@2:f:\|t\|f$',
  pg_temp.audited('CM2', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'misleading', true, 2, 'still the wrong address')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT string_agg(label || '@' || post_version || ':' || (retracted_at IS NOT NULL)::char || ':' || COALESCE(retract_reason, ''), ',' ORDER BY post_version) FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'misleading'$q$) || '|' ||
  pg_temp.fresh($q$SELECT ((details ->> 'supersedes_label_id')::bigint = (SELECT id FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a' AND label = 'misleading' AND post_version = 1))::char FROM public.admin_actions ORDER BY id DESC LIMIT 1$q$) || '|' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000a'$q$));
SELECT pg_temp.ck('B5d', 'CONTROL: a post carrying only its author''s own "sensitive" is NOT flagged by an edit; an unlabelled one neither', '^OK \["sensitive"\];OK 2;f\|OK 2;f$',
  pg_temp.run('C', $q$SELECT (public.set_own_post_label('00000000-0000-4000-a000-00000000000b', 'sensitive', true) -> 'labels')::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.edit_post('00000000-0000-4000-a000-00000000000b', 1, '{"content":"member C post, edited"}') ->> 'version'$q$) || ';' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000b'$q$) || '|' ||
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000002', 1, '{"content":"need diapers, size 4"}') ->> 'version'$q$) || ';' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000002'$q$));
SELECT pg_temp.ck('B5e', 'a moderator''s own labelled post, edited, stays flagged when the same moderator re-affirms (one''s own action never clears the review flag)', '^OK 2;OK true;t$',
  left(pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000004', 'sensitive', true, 1, 'own post') ->> 'changed'$q$), 0) ||
  pg_temp.run('CM', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000004', 1, '{"content":"a moderator''s own post, edited"}') ->> 'version'$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-000000000004', 'sensitive', true, 2, 'own post, again') ->> 'changed'$q$) || ';' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000004'$q$));
SELECT pg_temp.ck('B6', 'labels annotate only: every ranked score is what it was before any label existed', '^0\|t$',
  (SELECT count(*)::text FROM public.ranked_feed_v2(NULL, NULL, 1000) r JOIN rank0 z ON z.id = r.id WHERE r.score IS DISTINCT FROM z.score) || '|' ||
  (SELECT (count(*) > 0)::char FROM public.ranked_feed_v2(NULL, NULL, 1000) r JOIN public.posts p ON p.id = r.id WHERE cardinality(p.labels) > 0));
SELECT pg_temp.ck('B7', 'the audit row of a label decision carries the statement-of-reasons fields; one row per decision (9 applied, 3 retracted so far)',
  '^application_date,author_id,automated_decision,automated_detection,content_type,decision_facts,decision_ground,decision_visibility,label,label_id,redress,report_id,source_type,supersedes_label_id,version\|CONTENT_LABELLED/INCOMPATIBLE_CONTENT/VOLUNTARY/NOT_AUTOMATED\|post.label=9,post.unlabel=3$',
  (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys((SELECT details FROM public.admin_actions WHERE action = 'post.label' ORDER BY id LIMIT 1)) k) || '|' ||
  (SELECT (details ->> 'decision_visibility') || '/' || (details ->> 'decision_ground') || '/' || (details ->> 'source_type') || '/' || (details ->> 'automated_decision') FROM public.admin_actions WHERE action = 'post.label' ORDER BY id LIMIT 1) || '|' ||
  (SELECT string_agg(action || '=' || n, ',' ORDER BY action) FROM (SELECT action, count(*) n FROM public.admin_actions WHERE action IN ('post.label', 'post.unlabel') GROUP BY 1) s));

-- ===================== C: comment lock =====================
SELECT pg_temp.ck('C1a', 'lock: anon no EXECUTE; guests refused (also with the top tier); a member is below the tier; the post''s AUTHOR cannot lock',
  '^anon=>ERR 42501 permission denied for function admin_set_comments_locked;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;C=>ERR 42501 p3_denied:insufficient_tier;A=>ERR 42501 p3_denied:insufficient_tier;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'A'], $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 1, 'heated')::text$q$));
SELECT pg_temp.ck('C1b', 'validation: NULL locked; a missing or unknown reason; an over-long note; stale version; missing post; deleted post',
  '^ERR 22023 lock_field_required:locked;ERR 22023 lock_field_invalid:reason;ERR 22023 lock_field_invalid:reason;ERR 22023 lock_field_invalid:note;ERR PT409 edit_conflict.*;ERR PT404 post_not_found;ERR PT404 post_deleted$',
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', NULL)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 1)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 1, 'boring')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 1, 'heated', repeat('n', 501))::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 9, 'heated')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-0000000000ff', true, 1, 'heated')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-00000000000f', true, NULL, 'heated')::text$q$));
SELECT pg_temp.ck('C1c', 'each of the five reasons is accepted, and each staff tier locks and unlocks (lock by one, unlock by another, on a scratch post)',
  '^heated/community_moderator/true,off_topic/resource_admin/true,resolved/platform_admin/true,spam/community_moderator/true,other/resource_admin/true$',
  (SELECT string_agg(substr(pg_temp.run(lk, format($q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-00000000000b', true, NULL, %L) ->> 'reason'$q$, r)), 4) || '/' ||
                     pg_temp.fresh($q$SELECT comments_locked_by_role FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000b'$q$) || '/' ||
                     substr(pg_temp.run(ul, $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-00000000000b', false) ->> 'changed'$q$), 4), ',' ORDER BY o)
     FROM (VALUES (1, 'heated', 'CM', 'RA'), (2, 'off_topic', 'RA', 'PA'), (3, 'resolved', 'PA', 'CM'), (4, 'spam', 'CM2', 'RA'), (5, 'other', 'RA', 'CM2')) x(o, r, lk, ul)));
SELECT pg_temp.ck('C2a', 'a moderator locks the thread: one audit row; the post keeps its version and gets no revision; locking again changes nothing',
  '^OK \{(?=.*"locked": true)(?=.*"changed": true)(?=.*"reason": "heated").*\|\+1\|1\|0\|heated:community_moderator:t\|OK false\|\+0$',
  pg_temp.audited('CM', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 1, 'heated', 'personal attacks from 3 accounts')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT version || '|' || (SELECT count(*) FROM public.post_revisions r WHERE r.post_id = p.id) || '|' || comments_locked_reason || ':' || comments_locked_by_role || ':' || (comments_locked_at = now())::char FROM public.posts p WHERE id = '00000000-0000-4000-a000-000000000006'$q$) || '|' ||
  pg_temp.audited('CM2', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', true, 1, 'spam') ->> 'changed'$q$));
SELECT pg_temp.ck('C2b', 'everyone who can read the post reads the lock: when, the reason code and the role; never who', '^anon=>OK t\|heated\|community_moderator;G=>OK t\|heated\|community_moderator;C=>OK t\|heated\|community_moderator;$',
  pg_temp.who(ARRAY['anon', 'G', 'C'], $q$SELECT (comments_locked_at IS NOT NULL)::char || '|' || comments_locked_reason || '|' || comments_locked_by_role FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000006'$q$));
SELECT pg_temp.ck('C3a', 'a new comment while locked (the INSERT the deployed client sends): a member, the post''s author and a seeker are refused 42501 comments_locked with the reason in DETAIL; so is a guest holding the top tier',
  '^(C|A|B|G|GT)=>ERR 42501 comments_locked \| \{"reason": "heated", "locked_at": "[^"]+"\};(\w+=>ERR 42501 comments_locked \| \{"reason": "heated", "locked_at": "[^"]+"\};){4}$',
  pg_temp.who(ARRAY['C', 'A', 'B', 'G', 'GT'], $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000006', auth.uid(), 'let me in') RETURNING 'inserted'$q$));
SELECT pg_temp.ck('C3b', 'a reply is refused the same way; anon has no INSERT at all', '^ERR 42501 comments_locked.*;ERR 42501 permission denied for table post_comments$',
  pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content, parent_id) VALUES ('00000000-0000-4000-a000-000000000006', auth.uid(), 'a reply', '0d000000-0000-4000-8000-000000000061') RETURNING 'inserted'$q$) || ';' ||
  pg_temp.run('anon', $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000006', NULL, 'x') RETURNING 'inserted'$q$));
SELECT pg_temp.ck('C3c', 'moderators may still comment: community moderator, resource admin, platform admin; a service-side writer (no session) too', '^CM=>OK inserted;RA=>OK inserted;PA=>OK inserted;\|OK inserted\|1/4$',
  pg_temp.who(ARRAY['CM', 'RA', 'PA'], $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000006', auth.uid(), 'moderator note') RETURNING 'inserted'$q$) || '|' ||
  pg_temp.pg(format($q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000006', %L, 'system note') RETURNING 'inserted'$q$, pg_temp.u('PA'))) || '|' ||
  pg_temp.fresh($q$SELECT count(*) FILTER (WHERE user_id IN (pg_temp.u('B'))) || '/' || count(*) FILTER (WHERE user_id NOT IN (pg_temp.u('B'))) FROM public.post_comments WHERE post_id = '00000000-0000-4000-a000-000000000006'$q$));
SELECT pg_temp.ck('C4', 'existing comments stay: readable; their author still edits and deletes; likes still work on the locked post', '^OK 5;OK 2;OK liked;OK true$',
  pg_temp.run('anon', $q$SELECT count(*)::text FROM public.post_comments WHERE post_id = '00000000-0000-4000-a000-000000000006'$q$) || ';' ||
  pg_temp.run('B', $q$SELECT public.edit_comment('0d000000-0000-4000-8000-000000000061', 1, 'before the lock (edited)') ->> 'version'$q$) || ';' ||
  pg_temp.run('C3', $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ('00000000-0000-4000-a000-000000000006', auth.uid()) RETURNING 'liked'$q$) || ';' ||
  pg_temp.run('B', $q$SELECT public.delete_own_comment('0d000000-0000-4000-8000-000000000061') ->> 'deleted'$q$));
SELECT pg_temp.ck('C5a', 'no self-lift: a moderator locks their OWN post and cannot unlock it; another moderator can', '^OK true;ERR 42501 self_moderation_refused;OK true$',
  pg_temp.run('CM',  $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000004', true, NULL, 'resolved') ->> 'changed'$q$) || ';' ||
  pg_temp.run('CM',  $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000004', false) ->> 'changed'$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000004', false) ->> 'changed'$q$));
SELECT pg_temp.ck('C5b', 'unlock: one audit row naming the reason that was lifted; the three lock columns clear together; a member comments again', '^OK true\|\+1\|post.comments_unlock:heated:INTERACTION_RESTRICTION_LIFTED\|t\|OK inserted$',
  pg_temp.audited('CM2', $q$SELECT public.admin_set_comments_locked('00000000-0000-4000-a000-000000000006', false, 1, NULL, 'cooled down') ->> 'changed'$q$) || '|' ||
  pg_temp.fresh($q$SELECT action || ':' || (details ->> 'lock_reason') || ':' || (details ->> 'decision_visibility') FROM public.admin_actions ORDER BY id DESC LIMIT 1$q$) || '|' ||
  pg_temp.fresh($q$SELECT (comments_locked_at IS NULL AND comments_locked_reason IS NULL AND comments_locked_by_role IS NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000006'$q$) || '|' ||
  pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000006', auth.uid(), 'thanks') RETURNING 'inserted'$q$));
SELECT pg_temp.ck('C6', 'CONTROL: a held post that is not locked still answers with the generic policy refusal (the client tells "locked" from "closed" by the message)',
  '^ERR 42501 new row violates row-level security policy "post_comments_insert_post_visible" for table "post_comments"$',
  pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-00000000000c', auth.uid(), 'x') RETURNING 'inserted'$q$));
SELECT pg_temp.ck('C7', 'the lock columns hold together (all three or none) and the reason / role vocabularies are closed, for every writer', '^ERR 23514 .*posts_comments_lock_shape.*;ERR 23514 .*posts_comments_locked_reason_check.*;ERR 23514 .*posts_comments_locked_by_role_check.*$',
  pg_temp.pg($q$UPDATE public.posts SET comments_locked_at = now() WHERE id = '00000000-0000-4000-a000-00000000000b' RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.posts SET comments_locked_at = now(), comments_locked_reason = 'boring', comments_locked_by_role = 'platform_admin' WHERE id = '00000000-0000-4000-a000-00000000000b' RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.posts SET comments_locked_at = now(), comments_locked_reason = 'spam', comments_locked_by_role = 'author' WHERE id = '00000000-0000-4000-a000-00000000000b' RETURNING 'x'$q$));

-- ===================== D: reports =====================
SELECT pg_temp.ck('D1a', 'report a post (unchanged): anon no EXECUTE; guests refused with the sentence the deployed client shows; the author cannot report their own post',
  '^anon=>ERR 42501 permission denied for function submit_content_report;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;A=>ERR P0001 you cannot report your own post;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'A'], $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'spam')::text$q$));
SELECT pg_temp.ck('D1b', 'a first report is stored at the version seen; a repeat on the same version stores nothing (accepted false); the keys the deployed client reads are kept',
  '^OK \{"hidden": false, "accepted": true, "report_count": 1\};OK \{"hidden": false, "accepted": false, "report_count": 1\}\|1:open:1$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'spam', 'about v1')::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'abusive', 'again')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*) || ':' || min(status) || ':' || min(reported_version) FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000007'$q$));
SELECT pg_temp.ck('D1c', 'an unsupported type, a missing post, a deleted post and over-long details are refused',
  '^ERR P0001 unsupported content_type: alert;ERR P0001 post not found;ERR P0001 post not found;ERR 22023 report_field_invalid:details$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('alert', '00000000-0000-4000-a000-000000000007', 'spam')::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-0000000000ff', 'spam')::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-00000000000f', 'spam')::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'spam', repeat('d', 1001))::text$q$));
SELECT pg_temp.ck('D2a', 'the report is dismissed; the SAME version is not reportable again by that member', '^OK dismiss;OK \{"hidden": false, "accepted": false, "report_count": 0\}$',
  pg_temp.run('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000007'), 'dismiss', 1) ->> 'action'$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'abusive')::text$q$));
SELECT pg_temp.ck('D2b', 'the author edits the post (version 2): the same member''s report of the NEW version is taken and names version 2; the old one stays as history',
  '^OK 2;OK \{"hidden": false, "accepted": true, "report_count": 1\}\|dismissed@1,open@2$',
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000007', 1, '{"content":"post to report, now worse"}') ->> 'version'$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'abusive', 'about v2')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT string_agg(status || '@' || reported_version, ',' ORDER BY reported_version) FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000007'$q$));
SELECT pg_temp.ck('D2c', 'three DISTINCT members with an open report hide the post (the re-reporter counts once)', '^OK \{"hidden": false, "accepted": true, "report_count": 2\};OK \{"hidden": true, "accepted": true, "report_count": 3\}\|t:community_reports_threshold$',
  pg_temp.run('C2', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'abusive')::text$q$) || ';' ||
  pg_temp.run('C3', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000007', 'abusive')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::char || ':' || hidden_reason FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000007'$q$));
SELECT pg_temp.ck('D2d', 'one OPEN report per member per item, for every writer (the old once-ever constraint is gone, the partial unique index holds)', '^ERR 23505 duplicate key value violates unique constraint "content_reports_one_open_per_reporter"\|0\|1$',
  pg_temp.pg(format($q$INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason) VALUES (%L, 'post', '00000000-0000-4000-a000-000000000007', 'spam') RETURNING 'second open'$q$, pg_temp.u('C'))) || '|' ||
  (SELECT count(*) FROM pg_constraint WHERE conname = 'content_reports_unique_reporter') || '|' ||
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'content_reports_one_open_per_reporter' AND indexdef ~ 'UNIQUE.*WHERE \(status = ''open''::text\)'));
SELECT pg_temp.ck('D2e', 'after an UPHELD report the member can report a later version too', '^OK true;OK uphold;OK false;OK 2;OK true$',
  pg_temp.run('B', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000001', 'spam') ->> 'accepted'$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000001'), 'uphold') ->> 'action'$q$) || ';' ||
  pg_temp.run('B', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000001', 'spam') ->> 'accepted'$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 1, '{"content":"plain post, edited"}') ->> 'version'$q$) || ';' ||
  pg_temp.run('B', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000001', 'spam') ->> 'accepted'$q$));

SELECT pg_temp.ck('D2f', 'no self-moderation on posts either: a moderator cannot dismiss or uphold a report on their OWN post; another moderator can', '^OK true;ERR 42501 self_moderation_refused;ERR 42501 self_moderation_refused;OK dismiss$',
  pg_temp.run('C',   $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000004', 'spam') ->> 'accepted'$q$) || ';' ||
  pg_temp.run('CM',  $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000004'), 'dismiss')::text$q$) || ';' ||
  pg_temp.run('CM',  $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000004'), 'uphold')::text$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '00000000-0000-4000-a000-000000000004'), 'dismiss') ->> 'action'$q$));

-- D3: comments. K71 / K72 by B, K73 by CM, K74 by C3, all on P7 (hidden by reports above: make it visible again first).
SELECT pg_temp.ck('D3a', 'a comment on a hidden post is not reportable', '^ERR PT404 report_target_not_found$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000071', 'spam')::text$q$));
UPDATE public.content_reports SET status = 'dismissed' WHERE content_id = '00000000-0000-4000-a000-000000000007';
UPDATE public.posts SET is_hidden = false, hidden_at = NULL, hidden_reason = NULL WHERE id = '00000000-0000-4000-a000-000000000007';
SELECT pg_temp.ck('D3b', 'report a comment: anon no EXECUTE; guests refused; its own author refused; a missing comment not found',
  '^anon=>ERR 42501 permission denied for function submit_content_report;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;B=>ERR 42501 report_own_content;\|ERR PT404 report_target_not_found$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'B'], $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000071', 'harassment')::text$q$) || '|' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-0000000000ff', 'harassment')::text$q$));
SELECT pg_temp.ck('D3c', 'two members report it (stored at the comment''s version); the third hides it with the community reason; the post''s comment count drops',
  '^OK \{"hidden": false, "accepted": true, "report_count": 1\};OK \{"hidden": false, "accepted": true, "report_count": 2\};OK \{"hidden": true, "accepted": true, "report_count": 3\}\|t:community_reports_threshold\|3:1\|3$',
  pg_temp.run('C',  $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000071', 'harassment')::text$q$) || ';' ||
  pg_temp.run('C2', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000071', 'harassment')::text$q$) || ';' ||
  pg_temp.run('C3', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000071', 'harassment')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::char || ':' || hidden_reason FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-000000000071'$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*) || ':' || min(reported_version) FROM public.content_reports WHERE content_type = 'comment' AND content_id = '0d000000-0000-4000-8000-000000000071'$q$) || '|' ||
  pg_temp.fresh($q$SELECT comment_count::text FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000007'$q$));
SELECT pg_temp.ck('D3d', 'the hidden comment: gone for anon and members, still read by its author and staff; a hidden comment takes no new report',
  '^anon=>OK 0;C=>OK 0;B=>OK 1;CM=>OK 1;\|ERR PT404 report_target_not_found$',
  pg_temp.who(ARRAY['anon', 'C', 'B', 'CM'], $q$SELECT count(*)::text FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-000000000071'$q$) || '|' ||
  pg_temp.run('RA', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000071', 'spam')::text$q$));
SELECT pg_temp.ck('D3j', 'resolve a comment report / hide a comment: anon no EXECUTE; guests refused (also with the top tier); a member and the comment''s author are below the tier',
  '^anon=>ERR 42501 permission denied for function admin_resolve_report;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;C=>ERR 42501 p3_denied:insufficient_tier;B=>ERR 42501 p3_denied:insufficient_tier;\|anon=>ERR 42501 permission denied for function admin_set_comment_hidden;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;C=>ERR 42501 p3_denied:insufficient_tier;B=>ERR 42501 p3_denied:insufficient_tier;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'B'], $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '0d000000-0000-4000-8000-000000000071' LIMIT 1), 'dismiss')::text$q$) || '|' ||
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'B'], $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-000000000071', false)::text$q$));
SELECT pg_temp.ck('D3e', 'dismissing: the first two leave it hidden; the LAST dismissal lifts the community hide (reason cleared); each writes one audit row naming the comment',
  '^OK false\|\+1;OK false\|\+1;OK true\|\+1\|f:t\|comment:1:true$',
  (SELECT string_agg(pg_temp.audited('CM', format($q$SELECT public.admin_resolve_report(%L, 'dismiss', 1) ->> 'unhidden'$q$, r.id)), ';' ORDER BY r.reporter_id)
     FROM public.content_reports r WHERE r.content_type = 'comment' AND r.content_id = '0d000000-0000-4000-8000-000000000071') || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::char || ':' || (hidden_reason IS NULL)::char FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-000000000071'$q$) || '|' ||
  pg_temp.fresh($q$SELECT (details ->> 'content_type') || ':' || (details ->> 'version') || ':' || (details ->> 'unhidden') FROM public.admin_actions WHERE action = 'report.resolve' ORDER BY id DESC LIMIT 1$q$));
SELECT pg_temp.ck('D3f', 'a moderator''s hide records its reason and answers the open reports (upheld); a later dismissal can NOT lift a moderator''s hide',
  '^OK true;OK true\|t:moderator:upheld\|OK false\|t:moderator$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000072', 'spam') ->> 'accepted'$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-000000000072', true, 'spam link') ->> 'is_hidden'$q$) || '|' ||
  pg_temp.fresh($q$SELECT c.is_hidden::char || ':' || c.hidden_reason || ':' || (SELECT status FROM public.content_reports r WHERE r.content_id = c.id) FROM public.post_comments c WHERE id = '0d000000-0000-4000-8000-000000000072'$q$) || '|' ||
  left(pg_temp.pg($q$UPDATE public.content_reports SET status = 'open' WHERE content_id = '0d000000-0000-4000-8000-000000000072' RETURNING 'reopened by the test'$q$), 0) ||
  pg_temp.run('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '0d000000-0000-4000-8000-000000000072'), 'dismiss') ->> 'unhidden'$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::char || ':' || hidden_reason FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-000000000072'$q$));
SELECT pg_temp.ck('D3g', 'a moderator unhiding clears the reason; hidden_reason is set only on a hidden comment, from a closed vocabulary (every writer)', '^OK false\|f:t;ERR 23514 .*post_comments_hidden_reason_check.*;ERR 23514 .*post_comments_hidden_reason_check.*$',
  pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-000000000072', false) ->> 'is_hidden'$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::char || ':' || (hidden_reason IS NULL)::char FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-000000000072'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.post_comments SET hidden_reason = 'moderator' WHERE id = '0d000000-0000-4000-8000-000000000072' RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.post_comments SET is_hidden = true, hidden_reason = 'because' WHERE id = '0d000000-0000-4000-8000-000000000072' RETURNING 'x'$q$));
SELECT pg_temp.ck('D3h', 'no self-moderation: the comment''s author, a moderator, cannot resolve a report on their own comment; another moderator can; a stale comment version is refused',
  '^OK true;ERR 42501 self_moderation_refused;ERR 42501 self_moderation_refused;ERR PT409 edit_conflict.*;OK dismiss$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000073', 'off_topic') ->> 'accepted'$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '0d000000-0000-4000-8000-000000000073'), 'dismiss')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '0d000000-0000-4000-8000-000000000073'), 'uphold')::text$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '0d000000-0000-4000-8000-000000000073'), 'dismiss', 7)::text$q$) || ';' ||
  pg_temp.run('CM2', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = '0d000000-0000-4000-8000-000000000073'), 'dismiss', 1) ->> 'action'$q$));
SELECT pg_temp.ck('D3i', 'a comment report follows the comment''s version too: dismissed, then the comment is edited, then the same member''s new report is taken', '^OK false;OK 2;OK true$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000073', 'off_topic') ->> 'accepted'$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.edit_comment('0d000000-0000-4000-8000-000000000073', 1, 'a moderator''s own comment, edited') ->> 'version'$q$) || ';' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('comment', '0d000000-0000-4000-8000-000000000073', 'off_topic') ->> 'accepted'$q$));

-- D4: org events
SELECT pg_temp.ck('D4a', 'report an org event: anon no EXECUTE; guests refused; the org''s own admin (its creator) refused; a missing event not found',
  '^anon=>ERR 42501 permission denied for function submit_content_report;G=>ERR 42501 Account required for this action;GT=>ERR 42501 Account required for this action;OA=>ERR 42501 report_own_content;\|ERR PT404 report_target_not_found$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'OA'], $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000a1', 'misinformation')::text$q$) || '|' ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000ff', 'misinformation')::text$q$));
SELECT pg_temp.ck('D4b', 'three members report it: it reaches the queue (3 open) and is NEVER hidden: still active, still in the feed for anon',
  '^OK \{"hidden": false, "accepted": true, "report_count": 1\};OK \{"hidden": false, "accepted": true, "report_count": 2\};OK \{"hidden": false, "accepted": true, "report_count": 3\}\|t\|3\|OK 1$',
  pg_temp.run('C',  $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000a1', 'misinformation', 'wrong day')::text$q$) || ';' ||
  pg_temp.run('C2', $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000a1', 'misinformation')::text$q$) || ';' ||
  pg_temp.run('C3', $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000a1', 'misinformation')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_active::char FROM public.assistance_events WHERE id = '0e000000-0000-4000-8000-0000000000a1'$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.content_reports WHERE content_type = 'event' AND status = 'open'$q$) || '|' ||
  pg_temp.run('anon', $q$SELECT count(*)::text FROM public.ranked_feed_v2(NULL, NULL, 1000) WHERE kind = 'event' AND id = '0f000000-0000-4000-8000-0000000000a1'$q$));
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ('0a000000-0000-4000-8000-0000000000a1', pg_temp.u('RA'), 'admin');
SELECT pg_temp.ck('D4c', 'resolve: the org admin holds no tier; a resource admin who is also an admin of that org is refused (own content); a moderator dismisses, nothing to unhide',
  '^OA=>ERR 42501 p3_denied:insufficient_tier;RA=>ERR 42501 self_moderation_refused;CM=>OK \{"action": "dismiss", "unhidden": false.*;$',
  pg_temp.who(ARRAY['OA', 'RA', 'CM'], format($q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_type = 'event' AND reporter_id = %L), 'dismiss')::text$q$, pg_temp.u('C'))));
SELECT pg_temp.ck('D4e', 'a platform admin upholds the second event report: resolved, nothing hidden, the event stays active', '^OK \{"action": "uphold", "unhidden": false.*\|t\|upheld$',
  pg_temp.run('PA', format($q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_type = 'event' AND reporter_id = %L), 'uphold')::text$q$, pg_temp.u('C2'))) || '|' ||
  pg_temp.fresh($q$SELECT is_active::char FROM public.assistance_events WHERE id = '0e000000-0000-4000-8000-0000000000a1'$q$) || '|' ||
  pg_temp.fresh(format($q$SELECT status FROM public.content_reports WHERE content_type = 'event' AND reporter_id = %L$q$, pg_temp.u('C2'))));
UPDATE public.content_reports SET created_at = now() - interval '1 hour' WHERE content_type = 'event' AND reporter_id = pg_temp.u('C');   -- the dismissed report is an hour old
SELECT pg_temp.ck('D4d', 'an org event has no version: a new report by the same member is taken only after the event was changed since their last one', '^OK false;OK true$',
  pg_temp.run('C', $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000a1', 'misinformation') ->> 'accepted'$q$) || ';' ||
  left(pg_temp.pg($q$UPDATE public.assistance_events SET address = '12 New Street' WHERE id = '0e000000-0000-4000-8000-0000000000a1' RETURNING 'edited'$q$), 0) ||
  pg_temp.run('C', $q$SELECT public.submit_content_report('event', '0e000000-0000-4000-8000-0000000000a1', 'misinformation') ->> 'accepted'$q$));
SELECT pg_temp.ck('D5', 'the queue read (the direct table read the console does): staff see every type; a member sees their own reports; nobody else sees any',
  '^anon=>OK <null>;A=>OK <null>;C=>OK comment:4 event:2 post:3;CM=>OK comment:\d+ event:4 post:\d+;PA=>OK comment:\d+ event:4 post:\d+;$',
  pg_temp.who(ARRAY['anon', 'A', 'C', 'CM', 'PA'], $q$SELECT string_agg(content_type || ':' || n, ' ' ORDER BY content_type) FROM (SELECT content_type, count(*) n FROM public.content_reports GROUP BY 1) s$q$));
SELECT pg_temp.ck('D6', 'content_type is a closed vocabulary for every writer', '^ERR 23514 .*content_reports_content_type_check.*$',
  pg_temp.pg(format($q$INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason) VALUES (%L, 'alert', gen_random_uuid(), 'spam') RETURNING 'x'$q$, pg_temp.u('C'))));

-- ===================== E: request / offer status, and opt-ins =====================
-- P3 = A's offer (3 slots). B and B2 opt in first.
SELECT pg_temp.ck('E0', 'opt_in_to_post keeps its refusals: guests (the sentence the deployed client shows), one''s own post, a hidden post; then two seekers opt in',
  '^ERR 42501 Account required for this action;ERR 42501 Account required for this action;ERR P0001 You cannot opt in to your own post;ERR P0001 This post is closed;OK pending;OK pending\|3/1/2$',
  pg_temp.run('G',  $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || ';' ||
  pg_temp.run('GT', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || ';' ||
  pg_temp.run('C',  $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-00000000000c')).status$q$) || ';' ||
  pg_temp.run('B',  $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || ';' ||
  pg_temp.run('B2', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000003')$q$));
SELECT pg_temp.ck('E1a', 'close: anon no EXECUTE; guests refused (also the one who owns the offer and holds the top tier); a member and every staff tier are not the author',
  '^anon=>ERR 42501 permission denied for function set_post_closed;G=>ERR 42501 guest_refused;C=>ERR 42501 not_author;CM=>ERR 42501 not_author;RA=>ERR 42501 not_author;PA=>ERR 42501 not_author;\|ERR 42501 guest_refused$',
  pg_temp.who(ARRAY['anon', 'G', 'C', 'CM', 'RA', 'PA'], $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', true, 1)::text$q$) || '|' ||
  pg_temp.run('GT', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000005', true, 1)::text$q$));
SELECT pg_temp.ck('E1b', 'validation: NULL closed; an unknown reason; a stale version; a post type that cannot be closed; a missing, a deleted and a removed post',
  '^ERR 22023 post_field_required:closed;ERR 22023 post_field_invalid:reason;ERR PT409 edit_conflict.*;ERR 0A000 post_type_not_closable:feed;ERR PT404 post_not_found;ERR PT404 post_not_found$',
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', NULL)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', true, 1, 'done')::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', true, 9)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000006', true)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-0000000000ff', true)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-00000000000f', true)::text$q$));
SELECT pg_temp.ck('E1c', 'the author closes the offer: a status, not an edit (same version, no revision, nothing hidden, opt-ins and slots kept)',
  '^OK \{(?=.*"closed": true)(?=.*"closed_reason": "fulfilled")(?=.*"version": 1).*\|1\|0\|f\|3/1/2\|t$',
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', true, 1)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT version || '|' || (SELECT count(*) FROM public.post_revisions r WHERE r.post_id = p.id) || '|' || is_hidden::char || '|' || pg_temp.slots(id) || '|' || (closed_at = now())::char FROM public.posts p WHERE id = '00000000-0000-4000-a000-000000000003'$q$));
SELECT pg_temp.ck('E1d', 'everyone still reads the closed offer, with its status', '^anon=>OK t\|fulfilled;G=>OK t\|fulfilled;C=>OK t\|fulfilled;$',
  pg_temp.who(ARRAY['anon', 'G', 'C'], $q$SELECT (closed_at IS NOT NULL)::char || '|' || closed_reason FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003'$q$));
SELECT pg_temp.ck('E1e', 'while closed: no NEW opt-in (the sentence the deployed client shows, SQLSTATE PT409, code post_closed); comments still work; nothing changed for the two who opted in',
  '^ERR PT409 This post is closed \| \{"code": "post_closed", "closed_reason": "fulfilled"\};OK commented\|3/1/2$',
  pg_temp.run('C', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || ';' ||
  pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000003', auth.uid(), 'is any left?') RETURNING 'commented'$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000003')$q$));
SELECT pg_temp.ck('E1f', 'closing again with another reason keeps the first closing time; the author reopens (both columns clear) and a new opt-in is taken',
  '^OK closed\|t;OK \{(?=.*"closed": false)(?=.*"closed_at": null)(?=.*"closed_reason": null).*;OK pending\|3/0/3$',
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', true, NULL, 'closed') ->> 'closed_reason'$q$) || '|' ||
  pg_temp.fresh($q$SELECT (closed_at = now())::char FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003'$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000003', false)::text$q$) || ';' ||
  pg_temp.run('C', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000003')$q$));
SELECT pg_temp.ck('E1g', 'a request closes and reopens too; only requests and offers can carry the status, for every writer (closed columns together, closed vocabulary)',
  '^OK true;OK false;ERR 23514 .*posts_closed_types.*;ERR 23514 .*posts_closed_shape.*;ERR 23514 .*posts_closed_reason_check.*$',
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000002', true) ->> 'closed'$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-000000000002', false) ->> 'closed'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.posts SET closed_at = now(), closed_reason = 'closed' WHERE id = '00000000-0000-4000-a000-000000000006' RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.posts SET closed_at = now() WHERE id = '00000000-0000-4000-a000-000000000002' RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.posts SET closed_at = now(), closed_reason = 'gone' WHERE id = '00000000-0000-4000-a000-000000000002' RETURNING 'x'$q$));
SELECT pg_temp.ck('E1h', 'no client role writes the closed columns directly', '^A=>ERR 42501 permission denied for table posts;PA=>ERR 42501 permission denied for table posts;$',
  pg_temp.who(ARRAY['A', 'PA'], $q$UPDATE public.posts SET closed_at = now(), closed_reason = 'closed' WHERE id = '00000000-0000-4000-a000-000000000003' RETURNING 'x'$q$));

-- E2: decide_opt_in. P3 holds B (pending), B2 (pending), C (pending).
INSERT INTO ids SELECT 'oi_' || lower(w), (SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000003' AND seeker_id = pg_temp.u(w)) FROM unnest(ARRAY['B', 'B2', 'C']) w;
SELECT pg_temp.ck('E2a', 'decide: anon no EXECUTE; guests refused; the seeker, a stranger and every staff tier are not the author',
  '^anon=>ERR 42501 permission denied for function decide_opt_in;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;B=>ERR 42501 not_author;C3=>ERR 42501 not_author;CM=>ERR 42501 not_author;RA=>ERR 42501 not_author;PA=>ERR 42501 not_author;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'B', 'C3', 'CM', 'RA', 'PA'], $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'accept')::text$q$));
SELECT pg_temp.ck('E2b', 'the state machine and the status token: pending cannot complete; an unknown decision; a stale status; a missing opt-in',
  '^ERR 22023 opt_in_transition_invalid \| \{"to": "completed", "from": "pending"\};ERR 22023 opt_in_field_invalid:decision;ERR 22023 opt_in_field_invalid:decision;ERR PT409 opt_in_conflict \| \{"current_status": "pending"\};ERR PT404 opt_in_not_found$',
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'complete')::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'maybe')::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), NULL)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'accept', 'accepted')::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in('0c0ffee0-0000-4000-8000-000000000000', 'accept')::text$q$));
SELECT pg_temp.ck('E2c', 'accept, then complete (completed_at set), decline another; every later move is refused; slots are untouched by decisions',
  '^OK accepted;OK completed:t;OK declined;ERR 22023 opt_in_transition_invalid \| \{"to": "accepted", "from": "declined"\};ERR 22023 opt_in_transition_invalid \| \{"to": "declined", "from": "completed"\}\|3/0/3$',
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'accept', 'pending') ->> 'status'$q$) || ';' ||
  pg_temp.run('A', $q$SELECT (j ->> 'status') || ':' || ((j ->> 'completed_at') IS NOT NULL)::char FROM public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'complete', 'accepted') j$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b2'), 'decline') ->> 'status'$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b2'), 'accept')::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_b'), 'decline')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000003')$q$));
SELECT pg_temp.ck('E2d', 'the legacy direct UPDATE of status: kept in the expand state (held to the same machine, by the author only), refused 42501 after the contract step; decide_opt_in works in both',
  CASE WHEN pg_temp.contract() THEN '^ERR 42501 permission denied for table resource_opt_ins;ERR 42501 permission denied for table resource_opt_ins;ERR 42501 permission denied for table resource_opt_ins\|f\|0\|OK accepted$'
       ELSE '^OK accepted;ERR 22023 invalid opt-in status transition accepted -> pending;OK <null>\|t\|1\|ERR 22023 opt_in_transition_invalid.*$' END,
  pg_temp.run('A', $q$UPDATE public.resource_opt_ins SET status = 'accepted' WHERE id = (SELECT v FROM ids WHERE k = 'oi_c') RETURNING status$q$) || ';' ||
  pg_temp.run('A', $q$UPDATE public.resource_opt_ins SET status = 'pending' WHERE id = (SELECT v FROM ids WHERE k = 'oi_c') RETURNING status$q$) || ';' ||
  pg_temp.run('C', $q$UPDATE public.resource_opt_ins SET status = 'completed' WHERE id = (SELECT v FROM ids WHERE k = 'oi_c') RETURNING status$q$) || '|' ||
  has_column_privilege('authenticated', 'public.resource_opt_ins', 'status', 'UPDATE')::char || '|' ||
  (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.resource_opt_ins'::regclass AND polname = 'opt_ins_update') || '|' ||
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT v FROM ids WHERE k = 'oi_c'), 'accept') ->> 'status'$q$));

-- E3: the trail. Every change above wrote exactly one event row, whichever path made it.
SELECT pg_temp.ck('E3a', 'the trail of P3: who (role) did what, from -> to, in order',
  '^opted_in:-:pending:seeker,opted_in:-:pending:seeker,opted_in:-:pending:seeker,accepted:pending:accepted:author,completed:accepted:completed:author,declined:pending:declined:author,accepted:pending:accepted:author$',
  (SELECT string_agg(event || ':' || COALESCE(from_status, '-') || ':' || COALESCE(to_status, '-') || ':' || actor_role, ',' ORDER BY id)
     FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000003'));
SELECT pg_temp.ck('E3b', 'one event per status change and per row born or gone: events = opt-in rows ever + status changes (no change without a row, no row twice)', '^t$',
  (SELECT (count(*) = count(DISTINCT (opt_in_id, event, COALESCE(from_status, ''))))::char FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000003'));
SELECT pg_temp.ck('E3c', 'who reads the trail: each seeker their own rows, the post''s author all of them, a platform admin all; a guest, a stranger, a moderator and a resource admin none; anon has no grant',
  '^anon=>ERR 42501 permission denied for table resource_opt_in_events;G=>OK 0;B=>OK 3;B2=>OK 2;C3=>OK 0;A=>OK 7;CM=>OK 0;RA=>OK 0;PA=>OK 7;$',
  pg_temp.who(ARRAY['anon', 'G', 'B', 'B2', 'C3', 'A', 'CM', 'RA', 'PA'], $q$SELECT count(*)::text FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000003'$q$));
SELECT pg_temp.ck('E3d', 'the acting account is selectable by nobody; nobody writes the trail; it is append-only for the table owner too',
  '^A=>ERR 42501 permission denied for table resource_opt_in_events;PA=>ERR 42501 permission denied for table resource_opt_in_events;\|A=>ERR 42501 permission denied for table resource_opt_in_events;\|ERR 42501 opt_in_events_append_only;ERR 42501 opt_in_events_append_only$',
  pg_temp.who(ARRAY['A', 'PA'], 'SELECT actor_id::text FROM public.resource_opt_in_events LIMIT 1') || '|' ||
  pg_temp.who(ARRAY['A'], $q$INSERT INTO public.resource_opt_in_events (opt_in_id, post_id, event, actor_role) VALUES (gen_random_uuid(), '00000000-0000-4000-a000-000000000003', 'accepted', 'author') RETURNING 'forged'$q$) || '|' ||
  pg_temp.pg($q$UPDATE public.resource_opt_in_events SET actor_id = NULL, event = 'declined' WHERE post_id = '00000000-0000-4000-a000-000000000003' AND event = 'accepted' RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$DELETE FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000003' RETURNING 'x'$q$));

-- E3e: the trail names both people and takes no lock to do it (no foreign key on it; the race script's R3l proves a
-- username change held at the same moment never blanks either one). The foreign-key actions it gave up are kept by
-- its two statement triggers: a deleted account is cleared from seeker_id and actor_id, a deleted post takes its rows.
INSERT INTO auth.users (id, email, is_anonymous, raw_user_meta_data) VALUES
  ('92000000-0000-4000-8000-0000000000a1', 'trail-author@r3smoke.test', false, '{}'::jsonb),
  ('92000000-0000-4000-8000-0000000000b1', 'trail-seeker@r3smoke.test', false, '{}'::jsonb);
INSERT INTO public.profiles (id) VALUES ('92000000-0000-4000-8000-0000000000a1'), ('92000000-0000-4000-8000-0000000000b1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.posts (id, user_id, content, post_type, metadata, max_seekers, created_at) VALUES
 ('00000000-0000-4000-a000-0000000000e2', '92000000-0000-4000-8000-0000000000a1', 'an offer whose trail is read', 'source_offer', '{"categories":["food"]}', 2, now() - interval '1 hour');
CREATE FUNCTION pg_temp.trail_e2() RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(string_agg(event || ':' || COALESCE((seeker_id = '92000000-0000-4000-8000-0000000000b1')::char, 'n') || ':' ||
                             CASE WHEN actor_id IS NULL THEN 'n' WHEN actor_id = '92000000-0000-4000-8000-0000000000b1' THEN 's'
                                  WHEN actor_id = '92000000-0000-4000-8000-0000000000a1' THEN 'a' ELSE 'x' END,
                             ',' ORDER BY id), 'none')
    FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-0000000000e2'
$f$;
SELECT pg_temp.ck('E3e', 'the trail names the seeker and the actor on every row (opted in by the seeker, accepted by the author); it has no foreign key; the seeker''s account deletion clears them from every row and records the removal by the system; the deletion function''s DELETE of the author''s posts takes the post''s trail rows; no trail row names a deleted account',
  '^OK pending\|OK accepted\|opted_in:t:s,accepted:t:a\|0\|OK 1\|opted_in:n:n,accepted:n:a,removed:n:n\|OK 1\|none\|OK 1\|0$',
  pg_temp.as_('92000000-0000-4000-8000-0000000000b1', false, $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-0000000000e2')).status$q$) || '|' ||
  pg_temp.as_('92000000-0000-4000-8000-0000000000a1', false, $q$SELECT public.decide_opt_in((SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-0000000000e2'), 'accept') ->> 'status'$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.trail_e2()$q$) || '|' ||
  (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.resource_opt_in_events'::regclass AND contype = 'f') || '|' ||
  pg_temp.svc($q$WITH d AS (DELETE FROM public.profiles WHERE id = '92000000-0000-4000-8000-0000000000b1' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.trail_e2()$q$) || '|' ||
  pg_temp.svc($q$WITH d AS (DELETE FROM public.posts WHERE user_id = '92000000-0000-4000-8000-0000000000a1' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.trail_e2()$q$) || '|' ||
  pg_temp.svc($q$WITH d AS (DELETE FROM public.profiles WHERE id = '92000000-0000-4000-8000-0000000000a1' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.resource_opt_in_events e
                    WHERE (e.seeker_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = e.seeker_id))
                       OR (e.actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = e.actor_id))
                       OR NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = e.post_id)$q$));

-- E4: the slot. Every opt-in row holds one slot until it is deleted; the slot comes back on any delete. P8 = 2 slots.
SELECT pg_temp.ck('E4a', 'the drain is closed, three times over. Expand: a seeker opts in and direct-DELETEs their own opt-in, the slot comes back (withdraw_opt_in then finds nothing). Contract: the direct DELETE is refused and holds the slot; withdraw_opt_in is the way out and returns it. Each withdrawal is on the trail',
  CASE WHEN pg_temp.contract()
       THEN '^(OK pending/ERR 42501 permission denied for table resource_opt_ins/2/1/1/OK true/2/2/0;?){3}\|3 withdrawn by seeker$'
       ELSE '^(OK pending/OK 1/2/2/0/OK false/2/2/0;?){3}\|3 withdrawn by seeker$' END,
  (SELECT string_agg(pg_temp.run('C', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$) || '/' ||
                     pg_temp.run('C', $q$WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008' AND seeker_id = auth.uid() RETURNING 1) SELECT count(*)::text FROM d$q$) || '/' ||
                     pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || '/' ||
                     pg_temp.run('C', $q$SELECT public.withdraw_opt_in('00000000-0000-4000-a000-000000000008')::text$q$) || '/' ||
                     pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$), ';' ORDER BY g) FROM generate_series(1, 3) g) || '|' ||
  pg_temp.fresh($q$SELECT count(*) || ' ' || min(event) || ' by ' || min(actor_role) FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000008' AND event <> 'opted_in'$q$));
SELECT pg_temp.ck('E4b', '... so the offer is still open to the next two seekers, and full for the third', '^OK pending;OK pending;ERR P0001 This offer is full\|2/0/2$',
  pg_temp.run('B',  $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$) || ';' ||
  pg_temp.run('B2', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$) || ';' ||
  pg_temp.run('C3', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$));
SELECT pg_temp.ck('E4c', 'the RPC paths return the slot exactly once: withdraw_opt_in (2/1/1), then decline + unblock_opt_in (2/2/0); a second withdraw returns nothing',
  '^OK true\|2/1/1;OK false\|2/1/1;OK declined\|2/1/1;OK true\|2/2/0$',
  pg_temp.run('B',  $q$SELECT public.withdraw_opt_in('00000000-0000-4000-a000-000000000008')::text$q$) || '|' || pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || ';' ||
  pg_temp.run('B',  $q$SELECT public.withdraw_opt_in('00000000-0000-4000-a000-000000000008')::text$q$) || '|' || pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.decide_opt_in((SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008'), 'decline') ->> 'status'$q$) || '|' || pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || ';' ||
  pg_temp.run('A',  $q$SELECT public.unblock_opt_in((SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008'))::text$q$) || '|' || pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$));
SELECT pg_temp.run('B', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$);
SELECT pg_temp.ck('E4d', 'a direct DELETE of someone else''s opt-in: in the expand state it reaches only one''s own PENDING row (a stranger, the post''s author, a moderator and a guest delete 0 rows); after the contract step every client role is refused outright; anon has no grant in either; slots unchanged',
  CASE WHEN pg_temp.contract() THEN '^(\w+=>ERR 42501 permission denied for table resource_opt_ins;){5}\|2/1/1$'
       ELSE '^C3=>OK 0;A=>OK 0;CM=>OK 0;G=>OK 0;anon=>ERR 42501 permission denied for table resource_opt_ins;\|2/1/1$' END,
  pg_temp.who(ARRAY['C3', 'A', 'CM', 'G', 'anon'], $q$WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$));
SELECT pg_temp.ck('E4e', '... and not an opt-in the author already accepted (expand: the seeker''s DELETE matches 0 rows; contract: refused); a direct INSERT is refused for everyone',
  CASE WHEN pg_temp.contract() THEN '^OK accepted;ERR 42501 permission denied for table resource_opt_ins\|2/1/1\|B=>ERR 42501 permission denied for table resource_opt_ins;A=>ERR 42501 permission denied for table resource_opt_ins;$'
       ELSE '^OK accepted;OK 0\|2/1/1\|B=>ERR 42501 permission denied for table resource_opt_ins;A=>ERR 42501 permission denied for table resource_opt_ins;$' END,
  pg_temp.run('A', $q$SELECT public.decide_opt_in((SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008'), 'accept') ->> 'status'$q$) || ';' ||
  pg_temp.run('B', $q$WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008' AND seeker_id = auth.uid() RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || '|' ||
  pg_temp.who(ARRAY['B', 'A'], $q$INSERT INTO public.resource_opt_ins (post_id, seeker_id, status) VALUES ('00000000-0000-4000-a000-000000000008', auth.uid(), 'accepted') RETURNING 'forged'$q$));
SELECT pg_temp.run('C3', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$);
SELECT pg_temp.ck('E4h', 'a platform admin cannot change or remove a member''s opt-in directly in either state (the policies have no admin branch; it left no admin_actions row). Expand: the UPDATE and the DELETE match no row; contract: both refused. The row, its status, its slot and the trail are untouched',
  CASE WHEN pg_temp.contract()
       THEN '^ERR 42501 permission denied for table resource_opt_ins;ERR 42501 permission denied for table resource_opt_ins\|pending\|2/0/2\|opted_in:-:seeker$'
       ELSE '^OK 0;OK 0\|pending\|2/0/2\|opted_in:-:seeker$' END,
  pg_temp.run('PA', format($q$WITH u AS (UPDATE public.resource_opt_ins SET status = 'declined' WHERE post_id = '00000000-0000-4000-a000-000000000008' AND seeker_id = %L RETURNING 1) SELECT count(*)::text FROM u$q$, pg_temp.u('C3'))) || ';' ||
  pg_temp.run('PA', format($q$WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008' AND seeker_id = %L RETURNING 1) SELECT count(*)::text FROM d$q$, pg_temp.u('C3'))) || '|' ||
  pg_temp.fresh(format($q$SELECT status FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008' AND seeker_id = %L$q$, pg_temp.u('C3'))) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || '|' ||
  pg_temp.fresh($q$SELECT event || ':' || COALESCE(from_status, '-') || ':' || actor_role FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000008' ORDER BY id DESC LIMIT 1$q$));
-- C3's row is still there in both states; C3 leaves through the RPC
SELECT pg_temp.run('C3', $q$SELECT public.withdraw_opt_in('00000000-0000-4000-a000-000000000008')::text$q$);
SELECT pg_temp.ck('E4f', 'a delete by the table owner (a service-side cleanup) returns the slot too and is on the trail as removed / system; the slot never exceeds the capacity', '^OK 1\|2/2/0\|removed:accepted:system\|2/2/0$',
  pg_temp.pg($q$WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000008' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$) || '|' ||
  pg_temp.fresh($q$SELECT event || ':' || from_status || ':' || actor_role FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000008' ORDER BY id DESC LIMIT 1$q$) || '|' ||
  left(pg_temp.pg($q$UPDATE public.posts SET slots_remaining = 2 WHERE id = '00000000-0000-4000-a000-000000000008' RETURNING 'x'$q$), 0) ||
  left(pg_temp.run('C', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$), 0) ||
  left(pg_temp.pg($q$UPDATE public.posts SET slots_remaining = 2 WHERE id = '00000000-0000-4000-a000-000000000008' RETURNING 'drifted high by the test'$q$), 0) ||
  left(pg_temp.run('C', $q$SELECT public.withdraw_opt_in('00000000-0000-4000-a000-000000000008')::text$q$), 0) ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-000000000008')$q$));
SELECT pg_temp.ck('E4g', 'on every capped offer the slots equal capacity minus opt-in rows', '^0$',
  (SELECT count(*)::text FROM public.posts p WHERE p.max_seekers IS NOT NULL
      AND p.slots_remaining IS DISTINCT FROM p.max_seekers - (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = p.id)));
-- E5: a removed post. C3 opts in to Pd, then a moderator removes it.
SELECT pg_temp.run('C3', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-00000000000d')).status$q$);
SELECT pg_temp.run('B2', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-00000000000d')).status$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_remove_post('00000000-0000-4000-a000-00000000000d')::text$q$);
SELECT pg_temp.ck('E5', 'nothing new is agreed on a removed post: accept is refused, decline still works; the author cannot close it', '^ERR 42501 post_removed;OK declined;ERR 42501 post_removed$',
  pg_temp.run('A', format($q$SELECT public.decide_opt_in((SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-00000000000d' AND seeker_id = %L), 'accept')::text$q$, pg_temp.u('C3'))) || ';' ||
  pg_temp.run('A', format($q$SELECT public.decide_opt_in((SELECT id FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-00000000000d' AND seeker_id = %L), 'decline') ->> 'status'$q$, pg_temp.u('B2'))) || ';' ||
  pg_temp.run('A', $q$SELECT public.set_post_closed('00000000-0000-4000-a000-00000000000d', true)::text$q$));

-- ===================== F: announcements (pin with an expiry; the Announcements filter) =====================
SELECT pg_temp.ck('F1a', 'pin: anon no EXECUTE; guests refused (also with the top tier); a member and the post''s author are below the tier',
  '^anon=>ERR 42501 permission denied for function admin_set_post_pinned;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;C=>ERR 42501 p3_denied:insufficient_tier;A=>ERR 42501 p3_denied:insufficient_tier;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'A'], $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000006', true)::text$q$));
SELECT pg_temp.ck('F1b', 'validation: NULL pinned; an end that is not in the future; an over-long reason; a stale version; a missing post; a held and a deleted post cannot be pinned',
  '^ERR 22023 pin_field_required:pinned;ERR 22023 pin_field_invalid:until;ERR 22023 pin_field_invalid:until;ERR 22023 pin_field_invalid:reason;ERR PT409 edit_conflict.*;ERR PT404 post_not_found;ERR 42501 post_not_visible;ERR 42501 post_not_visible$',
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', NULL)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true, 1, now() - interval '1 minute')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true, 1, now())::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true, 1, NULL, repeat('r', 501))::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true, 9)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-0000000000ff', true)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-00000000000c', true)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-00000000000f', true)::text$q$));
CREATE TEMP TABLE feed0 AS SELECT id, kind, score FROM public.ranked_feed_v2(NULL, NULL, 1000);      -- before any pin
SELECT pg_temp.ck('F2a', 'a community moderator pins: it ends 7 days from the pin by default; one audit row (not the moderator''s own post); the post keeps its version',
  '^OK \{(?=.*"is_pinned": true).*\|\+1\|t:t:1\|post.pin:office closure:false$',
  pg_temp.audited('CM', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true, 1, NULL, 'office closure')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_pinned::char || ':' || (pinned_until = now() + interval '7 days')::char || ':' || version FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000009'$q$) || '|' ||
  pg_temp.fresh($q$SELECT action || ':' || reason || ':' || (details ->> 'own_post') FROM public.admin_actions ORDER BY id DESC LIMIT 1$q$));
SELECT pg_temp.ck('F2b', 'a resource admin and a platform admin pin too; the caller may name another end; pinning one''s own post is allowed and recorded as such', '^OK t;OK t\|true$',
  pg_temp.run('RA', $q$SELECT ((public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true, 1, now() + interval '2 days') ->> 'pinned_until')::timestamptz = now() + interval '2 days')::char$q$) || ';' ||
  pg_temp.run('PA', $q$SELECT ((public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', true) ->> 'pinned_until')::timestamptz = now() + interval '7 days')::char$q$) || '|' ||
  pg_temp.fresh($q$SELECT details ->> 'own_post' FROM public.admin_actions WHERE action = 'post.pin' ORDER BY id DESC LIMIT 1$q$));
SELECT pg_temp.ck('F2c', 'everyone reads the pin and its end; the pinned post floats to the top for a member and a logged-out visitor; no other score moved',
  '^anon=>OK t\|t;C=>OK t\|t;\|anon=>OK t;C=>OK t;\|0$',
  pg_temp.who(ARRAY['anon', 'C'], $q$SELECT is_pinned::char || '|' || (pinned_until > now())::char FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000009'$q$) || '|' ||
  pg_temp.who(ARRAY['anon', 'C'], $q$SELECT (id = '00000000-0000-4000-a000-000000000009' AND score >= 1000000)::char FROM public.ranked_feed_v2(44.26, -72.58, 25) LIMIT 1$q$) || '|' ||
  (SELECT count(*)::text FROM public.ranked_feed_v2(NULL, NULL, 1000) r JOIN feed0 z ON z.id = r.id WHERE r.id <> '00000000-0000-4000-a000-000000000009' AND r.score IS DISTINCT FROM z.score));
SELECT pg_temp.ck('F3a', 'the Announcements filter returns the live pins and the org events, nothing else, for anon and a member (kind:announcement rows)',
  '^anon=>OK event,post\|2\|t;C=>OK event,post\|2\|t;$',
  pg_temp.who(ARRAY['anon', 'C'], $q$SELECT string_agg(kind, ',' ORDER BY kind) || '|' || count(*) || '|' || bool_and(id IN ('00000000-0000-4000-a000-000000000009', '0f000000-0000-4000-8000-0000000000a1'))::char
                                       FROM public.ranked_feed_v2(p_limit => 1000, p_filter => 'announcements')$q$));
SELECT pg_temp.ck('F3b', 'NULL and ''all'' return exactly the rows of the five-argument call the deployed client makes (named and positional); an unknown filter returns nothing',
  '^t\|t\|t\|0$',
  (SELECT (array_agg(id ORDER BY score DESC, id DESC) = (SELECT array_agg(id ORDER BY score DESC, id DESC) FROM public.ranked_feed_v2(p_lat => 44.26, p_lng => -72.58, p_limit => 1000, p_filter => 'all')))::char
     FROM public.ranked_feed_v2(p_lat => 44.26, p_lng => -72.58, p_limit => 1000)) || '|' ||
  (SELECT (array_agg(id ORDER BY score DESC, id DESC) = (SELECT array_agg(id ORDER BY score DESC, id DESC) FROM public.ranked_feed_v2(44.26, -72.58, 1000, NULL, NULL, NULL)))::char
     FROM public.ranked_feed_v2(44.26, -72.58, 1000, NULL, NULL)) || '|' ||
  (SELECT (count(*) = (SELECT count(*) FROM feed0))::char FROM public.ranked_feed_v2(NULL, NULL, 1000)) || '|' ||
  (SELECT count(*)::text FROM public.ranked_feed_v2(p_limit => 1000, p_filter => 'pinned')));
SELECT pg_temp.ck('F3c', 'the filter pages by the same keyset: page 1 (limit 1) is the pin, page 2 from its cursor is the event', '^post\|event$',
  (SELECT kind FROM public.ranked_feed_v2(p_limit => 1, p_filter => 'announcements')) || '|' ||
  (SELECT n.kind FROM public.ranked_feed_v2(p_limit => 1, p_filter => 'announcements') f,
          LATERAL public.ranked_feed_v2(p_limit => 1, p_cursor_score => f.score, p_cursor_id => f.id, p_filter => 'announcements') n));
SELECT pg_temp.ck('F3d', 'one signature, no overload; the return shape is unchanged; SECURITY DEFINER with the pinned search_path; anon keeps EXECUTE',
  '^1\|TABLE\(id uuid, kind text, score real, distance_bucket text\)\|t\|t$',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'ranked_feed_v2') || '|' ||
  pg_get_function_result('public.ranked_feed_v2(double precision,double precision,integer,real,uuid,text)'::regprocedure) || '|' ||
  (SELECT prosecdef::char FROM pg_proc WHERE oid = 'public.ranked_feed_v2(double precision,double precision,integer,real,uuid,text)'::regprocedure) || '|' ||
  has_function_privilege('anon', 'public.ranked_feed_v2(double precision,double precision,integer,real,uuid,text)', 'EXECUTE')::char);
SELECT pg_temp.ck('F4a', 'when pinned_until passes the pin stops floating and leaves the Announcements filter (no job: the rule is in the read); the score is the unpinned one',
  '^t\|event\|t$',
  left(pg_temp.pg($q$UPDATE public.posts SET pinned_until = now() - interval '1 second' WHERE id = '00000000-0000-4000-a000-000000000009' RETURNING 'expired by the test'$q$), 0) ||
  pg_temp.fresh($q$SELECT (score < 1000000)::char FROM public.ranked_feed_v2(NULL, NULL, 1000) WHERE id = '00000000-0000-4000-a000-000000000009'$q$) || '|' ||
  pg_temp.fresh($q$SELECT string_agg(kind, ',') FROM public.ranked_feed_v2(p_limit => 1000, p_filter => 'announcements')$q$) || '|' ||
  pg_temp.fresh($q$SELECT (r.score = z.score)::char FROM public.ranked_feed_v2(NULL, NULL, 1000) r JOIN feed0 z ON z.id = r.id WHERE r.id = '00000000-0000-4000-a000-000000000009'$q$));
SELECT pg_temp.ck('F4b', 'unpin: one audit row, both columns clear; unpinning what is not pinned writes nothing; an end without a pin is impossible for every writer',
  '^OK \{"post_id": "[^"]+", "is_pinned": false, "pinned_until": null\}\|\+1\|f:t\|OK false\|\+0\|ERR 23514 .*posts_pinned_until_shape.*$',
  pg_temp.audited('CM2', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', false, 1)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_pinned::char || ':' || (pinned_until IS NULL)::char FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000009'$q$) || '|' ||
  pg_temp.audited('CM2', $q$SELECT public.admin_set_post_pinned('00000000-0000-4000-a000-000000000009', false) ->> 'is_pinned'$q$) || '|' ||
  pg_temp.pg($q$UPDATE public.posts SET pinned_until = now() + interval '1 day' WHERE id = '00000000-0000-4000-a000-000000000009' RETURNING 'x'$q$));
SELECT pg_temp.ck('F4c', 'no client role writes the pin directly, and the author cannot edit it in', '^A=>ERR 42501 permission denied for table posts;CM=>ERR 42501 permission denied for table posts;PA=>ERR 42501 permission denied for table posts;\|ERR 22023 post_field_not_editable:pinned_until$',
  pg_temp.who(ARRAY['A', 'CM', 'PA'], $q$UPDATE public.posts SET is_pinned = true, pinned_until = now() + interval '30 days' WHERE id = '00000000-0000-4000-a000-000000000006' RETURNING 'x'$q$) || '|' ||
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000006', 1, '{"pinned_until":"2030-01-01T00:00:00Z"}')::text$q$));

-- ===================== G: petitions =====================
-- the draft, inserted as the deployed composer does (created_by, status, title, body, body_version_hash, summary)
SELECT pg_temp.ck('G1a', 'the deployed composer''s insert (it sends a hash): accepted in the expand state, refused 42501 after the contract step; without the hash column it is accepted in both',
  CASE WHEN pg_temp.contract() THEN '^ERR 42501 permission denied for table petitions;OK stored$' ELSE '^OK stored;OK stored$' END,
  pg_temp.run('A', $q$INSERT INTO public.petitions (created_by, status, title, body, body_version_hash, summary) VALUES (auth.uid(), 'draft', 'Fix the Elm St bridge', 'We ask the town to repair the bridge on Elm St.', 'V2UgYXNrIHRoZSB0b3duIHRvIHJlcGFp', 'Bridge repair') RETURNING 'stored'$q$) || ';' ||
  pg_temp.run('A', $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'draft', 'Plant trees on Main St', 'We ask the town to repair the bridge on Main St.', 'Trees') RETURNING 'stored'$q$));
INSERT INTO ids SELECT 'pt1', id FROM public.petitions WHERE title = 'Plant trees on Main St';
SELECT pg_temp.ck('G1b', 'the stored hash is the server''s sha256 of the body (64 hex), whatever the client sent; two bodies sharing their first 24 bytes get different hashes',
  '^t\|t\|t$',
  (SELECT bool_and(body_version_hash = encode(sha256(convert_to(body, 'UTF8')), 'hex'))::char || '|' || bool_and(body_version_hash ~ '^[0-9a-f]{64}$')::char || '|' ||
          (count(DISTINCT body_version_hash) = count(*))::char FROM public.petitions WHERE created_by = pg_temp.u('A') AND status = 'draft'));
SELECT pg_temp.ck('G1c', 'who may insert a draft: anon has no grant; a guest is refused by policy (also with the top tier); a member only as themself and only as a draft',
  '^ERR 42501 permission denied for table petitions;ERR 42501 new row violates row-level security policy "petitions_block_anon_insert" for table "petitions";ERR 42501 new row violates row-level security policy "petitions_block_anon_insert" for table "petitions";ERR 42501 new row violates row-level security policy for table "petitions";ERR 42501 new row violates row-level security policy for table "petitions"$',
  pg_temp.run('anon', $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (NULL, 'draft', 't', 'b', 's') RETURNING 'stored'$q$) || ';' ||
  pg_temp.run('G',    $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'draft', 't', 'b', 's') RETURNING 'stored'$q$) || ';' ||
  pg_temp.run('GT',   $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'draft', 't', 'b', 's') RETURNING 'stored'$q$) || ';' ||
  pg_temp.run('C',    $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'approved', 't', 'b', 's') RETURNING 'stored'$q$) || ';' ||
  pg_temp.run('C',    format($q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (%L, 'draft', 't', 'b', 's') RETURNING 'stored'$q$, pg_temp.u('A'))));
SELECT pg_temp.ck('G1d', 'column-limited INSERT: a member cannot preset any column a later rule reads (id, exported_at, exported_by, target_signatures, created_at, updated_at, cause_category, external_ref)',
  '^(ERR 42501 permission denied for table petitions;){8}\|ffffffff$',
  (SELECT string_agg(pg_temp.run('C', format($q$INSERT INTO public.petitions (created_by, status, title, body, summary, %I) VALUES (auth.uid(), 'draft', 't', 'b', 's', %s) RETURNING 'stored'$q$, c, v)) || ';', '' ORDER BY o)
     FROM (VALUES (1, 'id', 'gen_random_uuid()'), (2, 'exported_at', 'now()'), (3, 'exported_by', 'auth.uid()'), (4, 'target_signatures', '1'), (5, 'created_at', $q$'2020-01-01'$q$),
                  (6, 'updated_at', 'now()'), (7, 'cause_category', $q$'x'$q$), (8, 'external_ref', $q$'x'$q$)) x(o, c, v)) || '|' ||
  (SELECT string_agg(has_column_privilege('authenticated', 'public.petitions', c, 'INSERT')::char, '') FROM unnest(ARRAY['id', 'exported_at', 'exported_by', 'target_signatures', 'created_at', 'updated_at', 'cause_category', 'external_ref']) c));
SELECT pg_temp.ck('G1e', 'no client role updates or deletes a petition (the creator and staff included)', '^A=>ERR 42501 permission denied for table petitions;CM=>ERR 42501 permission denied for table petitions;PA=>ERR 42501 permission denied for table petitions;\|A=>ERR 42501 permission denied for table petitions;PA=>ERR 42501 permission denied for table petitions;$',
  pg_temp.who(ARRAY['A', 'CM', 'PA'], $q$UPDATE public.petitions SET status = 'approved' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'x'$q$) || '|' ||
  pg_temp.who(ARRAY['A', 'PA'], $q$DELETE FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'x'$q$));
SELECT pg_temp.ck('G2', 'who sees a draft: its creator and staff (community moderator, resource admin, platform admin); nobody else', '^anon=>OK 0;G=>OK 0;C=>OK 0;A=>OK 1;CM=>OK 1;RA=>OK 1;PA=>OK 1;$',
  pg_temp.who(ARRAY['anon', 'G', 'C', 'A', 'CM', 'RA', 'PA'], $q$SELECT count(*)::text FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1')$q$));
-- review
SELECT pg_temp.ck('G3a', 'review: anon no EXECUTE; guests refused (also with the top tier); a member and the creator are below the tier',
  '^anon=>ERR 42501 permission denied for function admin_review_petition;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;C=>ERR 42501 p3_denied:insufficient_tier;A=>ERR 42501 p3_denied:insufficient_tier;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'A'], $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'approve')::text$q$));
SELECT pg_temp.ck('G3b', 'validation: an unknown action; a rejection without a reason; an over-long reason; a missing petition',
  '^ERR 22023 petition_field_invalid:action;ERR 22023 petition_field_invalid:action;ERR 22023 petition_field_required:reason;ERR 22023 petition_field_invalid:reason;ERR PT404 petition_not_found$',
  pg_temp.run('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'publish')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), NULL)::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'reject', '  ')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'reject', repeat('r', 501))::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_review_petition('0c0ffee0-0000-4000-8000-000000000000', 'approve')::text$q$));
SELECT pg_temp.ck('G3c', 'a moderator approves: in one call the petition is approved and its feed post exists (type petition, authored by the creator, the title as its text); one audit row with the hash',
  '^OK \{(?=.*"status": "approved")(?=.*"changed": true).*\|\+1\|approved\|1:petition:t:Plant trees on Main St:1\|petition.approve:t:t$',
  pg_temp.audited('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'approve')::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT status FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*) || ':' || min(post_type::text) || ':' || bool_and(user_id = pg_temp.u('A'))::char || ':' || min(content) || ':' || min(version) FROM public.posts WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT a.action || ':' || ((a.details ->> 'body_version_hash') = p.body_version_hash)::char || ':' || ((a.details ->> 'post_id')::uuid = (SELECT id FROM public.posts WHERE petition_id = p.id))::char
                    FROM public.admin_actions a, public.petitions p WHERE p.id = (SELECT v FROM ids WHERE k = 'pt1') ORDER BY a.id DESC LIMIT 1$q$));
SELECT pg_temp.ck('G3d', 'approving again returns the same post and changes nothing (no second post, no audit row); a reject of an approved petition is refused',
  '^OK false:t\|\+0\|1\|ERR PT409 petition_not_draft \| \{"status": "approved"\}$',
  pg_temp.audited('PA', $q$SELECT (j ->> 'changed') || ':' || ((j ->> 'post_id')::uuid = (SELECT id FROM public.posts WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')))::char FROM public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'approve') j$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.posts WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  pg_temp.run('PA', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt1'), 'reject', 'changed my mind')::text$q$));
SELECT pg_temp.ck('G3e', 'the published petition: its post and the petition are readable by a logged-out visitor and a member, and the post is ranked',
  '^anon=>OK 1\|1\|1;C=>OK 1\|1\|1;$',
  pg_temp.who(ARRAY['anon', 'C'], $q$SELECT (SELECT count(*) FROM public.posts WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')) || '|' || (SELECT count(*) FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1')) || '|' ||
                                              (SELECT count(*) FROM public.ranked_feed_v2(NULL, NULL, 1000) r JOIN public.posts p ON p.id = r.id WHERE p.petition_id = (SELECT v FROM ids WHERE k = 'pt1'))$q$));
SELECT pg_temp.ck('G3f', 'create_post still refuses the petition type: review is the only way a petition post is born', '^ERR 0A000 post_type_not_creatable:petition$',
  pg_temp.run('A', $q$SELECT public.create_post('petition', '{"content":"sign this"}')::text$q$));
SELECT pg_temp.run('CM', $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'draft', 'A moderator''s own petition', 'Please.', 'Own') RETURNING 'stored'$q$);
INSERT INTO ids SELECT 'pt2', id FROM public.petitions WHERE title = 'A moderator''s own petition';
SELECT pg_temp.ck('G3g', 'no self-review: a moderator can neither approve nor reject their OWN petition; another moderator rejects it with a reason (one audit row, no post)',
  '^ERR 42501 self_moderation_refused;ERR 42501 self_moderation_refused;OK rejected\|\+1\|rejected:0\|petition.reject:duplicate of an existing petition$',
  pg_temp.run('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt2'), 'approve')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt2'), 'reject', 'oops')::text$q$) || ';' ||
  pg_temp.audited('CM2', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt2'), 'reject', 'duplicate of an existing petition') ->> 'status'$q$) || '|' ||
  pg_temp.fresh($q$SELECT status || ':' || (SELECT count(*) FROM public.posts WHERE petition_id = p.id) FROM public.petitions p WHERE id = (SELECT v FROM ids WHERE k = 'pt2')$q$) || '|' ||
  pg_temp.fresh($q$SELECT action || ':' || reason FROM public.admin_actions ORDER BY id DESC LIMIT 1$q$));
SELECT pg_temp.ck('G3h', 'a rejected petition: its creator and staff still read it, nobody else; it cannot be approved afterwards', '^anon=>OK 0;C=>OK 0;CM=>OK 1;CM2=>OK 1;\|ERR PT409 petition_not_draft \| \{"status": "rejected"\}$',
  pg_temp.who(ARRAY['anon', 'C', 'CM', 'CM2'], $q$SELECT count(*)::text FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt2')$q$) || '|' ||
  pg_temp.run('CM2', $q$SELECT public.admin_review_petition((SELECT v FROM ids WHERE k = 'pt2'), 'approve')::text$q$));
SELECT pg_temp.run('B', $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'draft', 'A member''s rejected petition', 'Please.', 'Mine') RETURNING 'stored'$q$);
SELECT pg_temp.ck('G3j', 'a resource admin rejects a member''s petition; the member still reads it (and nobody else without a tier does)', '^OK rejected\|B=>OK 1:rejected;C=>OK 0:;anon=>OK 0:;$',
  pg_temp.run('RA', $q$SELECT public.admin_review_petition((SELECT id FROM public.petitions WHERE title = 'A member''s rejected petition'), 'reject', 'not a local matter') ->> 'status'$q$) || '|' ||
  pg_temp.who(ARRAY['B', 'C', 'anon'], $q$SELECT count(*) || ':' || COALESCE(min(status), '') FROM public.petitions WHERE title = 'A member''s rejected petition'$q$));
INSERT INTO public.petitions (id, title, summary, body, body_version_hash, status, created_by) VALUES ('0c000000-0000-4000-8000-0000000000e1', 'Orphan draft', 's', 'body of the orphan', 'x', 'draft', NULL);
SELECT pg_temp.ck('G3i', 'a draft whose creator is gone cannot be approved (a feed post needs an author); the status vocabulary is closed for every writer',
  '^ERR PT409 petition_creator_missing;ERR 23514 .*petitions_status_check.*$',
  pg_temp.run('CM', $q$SELECT public.admin_review_petition('0c000000-0000-4000-8000-0000000000e1', 'approve')::text$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.petitions SET status = 'published' WHERE id = '0c000000-0000-4000-8000-0000000000e1' RETURNING 'x'$q$));
-- the guard: the signed text is immutable after the first signature, for every writer
SELECT pg_temp.ck('G4a', 'before any signature the table owner may change the text, and the hash follows; a hash-only write is put back to the true hash',
  '^OK t;OK t$',
  pg_temp.pg($q$UPDATE public.petitions SET body = 'We ask the town to plant ten trees on Main St.' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING (body_version_hash = encode(sha256(convert_to(body, 'UTF8')), 'hex'))::char$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.petitions SET body_version_hash = 'not-a-hash' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING (body_version_hash = encode(sha256(convert_to(body, 'UTF8')), 'hex'))::char$q$));
SELECT pg_temp.ck('G4b', 'a signature must name the text as it stands: one carrying another hash is refused PT409; the right one is stored',
  '^ERR PT409 petition_text_changed;OK signed$',
  pg_temp.pg(format($q$INSERT INTO public.petition_signatures (petition_id, signer_id, signer_display_name, affirmation_text, petition_version_hash) VALUES ((SELECT v FROM ids WHERE k = 'pt1'), %L, 'B', 'I support this', 'V2UgYXNrIHRoZSB0b3duIHRvIHJlcGFp') RETURNING 'signed'$q$, pg_temp.u('B'))) || ';' ||
  pg_temp.pg(format($q$INSERT INTO public.petition_signatures (petition_id, signer_id, signer_display_name, affirmation_text, petition_version_hash) SELECT id, %L, 'B', 'I support this', body_version_hash FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'signed'$q$, pg_temp.u('B'))));
SELECT pg_temp.ck('G4c', 'after the first signature the title, the summary, the body and the hash are locked for the table owner too; a non-text column still updates',
  '^ERR 42501 petition_text_locked;ERR 42501 petition_text_locked;ERR 42501 petition_text_locked;ERR 42501 petition_text_locked;OK 100\|t$',
  pg_temp.pg($q$UPDATE public.petitions SET title = 'Plant trees everywhere' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.petitions SET summary = 'More trees' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.petitions SET body = 'Something else entirely.' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.petitions SET body_version_hash = 'forged' WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 'x'$q$) || ';' ||
  pg_temp.pg($q$UPDATE public.petitions SET target_signatures = 100 WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING target_signatures::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT (p.body_version_hash = s.petition_version_hash AND p.body_version_hash = encode(sha256(convert_to(p.body, 'UTF8')), 'hex'))::char FROM public.petitions p JOIN public.petition_signatures s ON s.petition_id = p.id WHERE p.id = (SELECT v FROM ids WHERE k = 'pt1')$q$));
-- update notes
SELECT pg_temp.ck('G5a', 'an update note: anon no EXECUTE; guests refused; a member and every staff tier are not the creator',
  '^anon=>ERR 42501 permission denied for function add_petition_update;G=>ERR 42501 guest_refused;GT=>ERR 42501 guest_refused;C=>ERR 42501 not_petition_creator;CM=>ERR 42501 not_petition_creator;RA=>ERR 42501 not_petition_creator;PA=>ERR 42501 not_petition_creator;$',
  pg_temp.who(ARRAY['anon', 'G', 'GT', 'C', 'CM', 'RA', 'PA'], $q$SELECT public.add_petition_update((SELECT v FROM ids WHERE k = 'pt1'), 'hello')::text$q$));
CREATE TEMP TABLE pt_before AS SELECT to_jsonb(p) AS row, p.ctid::text AS tid FROM public.petitions p WHERE id = (SELECT v FROM ids WHERE k = 'pt1');
SELECT pg_temp.ck('G5b', 'the creator appends a note: the petition row is not written at all (same row version, same text, hash and updated_at), and the signature stands',
  '^OK t\|t\|1:creator:The select board put it on the November agenda.\|1$',
  pg_temp.run('A', $q$SELECT ((j ->> 'body_version_hash') = (SELECT body_version_hash FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1')))::char
                       FROM public.add_petition_update((SELECT v FROM ids WHERE k = 'pt1'), '  The select board put it on the November agenda.  ') j$q$) || '|' ||
  pg_temp.fresh($q$SELECT (to_jsonb(p) = (SELECT row FROM pt_before) AND p.ctid::text = (SELECT tid FROM pt_before))::char FROM public.petitions p WHERE id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*) || ':' || min(author_role) || ':' || min(body) FROM public.petition_updates WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.petition_signatures WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$));
SELECT pg_temp.ck('G5c', 'validation: an empty or over-long note; a missing petition; a petition that is not approved (a rejected one, by its creator)',
  '^ERR 22023 petition_field_invalid:body;ERR 22023 petition_field_invalid:body;ERR 22023 petition_field_invalid:body;ERR PT404 petition_not_found;ERR PT409 petition_not_approved \| \{"status": "rejected"\}$',
  pg_temp.run('A', $q$SELECT public.add_petition_update((SELECT v FROM ids WHERE k = 'pt1'), '   ')::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.add_petition_update((SELECT v FROM ids WHERE k = 'pt1'), NULL)::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.add_petition_update((SELECT v FROM ids WHERE k = 'pt1'), repeat('n', 2001))::text$q$) || ';' ||
  pg_temp.run('A', $q$SELECT public.add_petition_update('0c0ffee0-0000-4000-8000-000000000000', 'x')::text$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.add_petition_update((SELECT v FROM ids WHERE k = 'pt2'), 'x')::text$q$));
SELECT pg_temp.ck('G5d', 'notes are read with their approved petition by anyone (role, never who); the creator column is selectable by nobody; nobody writes the table; append-only for the owner too',
  '^anon=>OK creator: The select board put it on the November agenda.;C=>OK creator: The select board put it on the November agenda.;\|ff\|anon=>ERR 42501 permission denied for table petition_updates;A=>ERR 42501 permission denied for table petition_updates;PA=>ERR 42501 permission denied for table petition_updates;\|A=>ERR 42501 permission denied for table petition_updates;\|ERR 42501 petition_updates_append_only;ERR 42501 petition_updates_append_only$',
  pg_temp.who(ARRAY['anon', 'C'], $q$SELECT string_agg(author_role || ': ' || body, ' / ') FROM public.petition_updates WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  has_column_privilege('anon', 'public.petition_updates', 'created_by', 'SELECT')::char || has_column_privilege('authenticated', 'public.petition_updates', 'created_by', 'SELECT')::char || '|' ||
  pg_temp.who(ARRAY['anon', 'A', 'PA'], 'SELECT created_by::text FROM public.petition_updates LIMIT 1') || '|' ||
  pg_temp.who(ARRAY['A'], $q$INSERT INTO public.petition_updates (petition_id, body, author_role) VALUES ((SELECT v FROM ids WHERE k = 'pt1'), 'forged', 'creator') RETURNING 'forged'$q$) || '|' ||
  pg_temp.pg($q$UPDATE public.petition_updates SET created_by = NULL, body = 'rewritten' RETURNING 'x'$q$) || ';' || pg_temp.pg($q$DELETE FROM public.petition_updates RETURNING 'x'$q$));
SELECT pg_temp.ck('G5e', 'notes of a petition that is not approved are invisible to everyone but the table owner', '^anon=>OK 0;C=>OK 0;CM=>OK 0;$',
  left(pg_temp.pg(format($q$INSERT INTO public.petition_updates (petition_id, body, author_role, created_by) VALUES ((SELECT v FROM ids WHERE k = 'pt2'), 'note on a rejected petition', 'creator', %L) RETURNING 'seeded'$q$, pg_temp.u('CM'))), 0) ||
  pg_temp.who(ARRAY['anon', 'C', 'CM'], $q$SELECT count(*)::text FROM public.petition_updates WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt2')$q$));

-- ===================== P: the realtime publication =====================
SELECT pg_temp.ck('P1', 'the publication: posts carries the 24 previous columns + the 7 new, in order; every other member is exactly what it was',
  '^public.conversations:id,volunteer_id,requester_id\|public.messages:id,conversation_id,sender_id,content,is_read,created_at\|public.notifications:id,user_id,type,title,message,link,application_id,is_read,created_at\|public.poll_votes:id,poll_id\|public.post_comments:id,post_id\|public.posts:id,user_id,content,image_url,is_pinned,is_hidden,created_at,updated_at,resource_id,max_seekers,slots_remaining,post_type,petition_id,hidden_at,hidden_reason,metadata,like_count,comment_count,version,edited_at,edit_count,image_alt,deleted_at,needs_review_at,labels,comments_locked_at,comments_locked_reason,comments_locked_by_role,closed_at,closed_reason,pinned_until$',
  (SELECT string_agg(schemaname || '.' || tablename || ':' || array_to_string(attnames, ',') || COALESCE(' WHERE ' || rowfilter, ''), '|' ORDER BY schemaname, tablename)
     FROM pg_publication_tables WHERE pubname = 'supabase_realtime'));
SELECT pg_temp.ck('P2', 'every published posts column is one a client role may read (realtime sends only readable columns): anon reads all but the two staff / author ones', '^0\|deleted_at,needs_review_at$',
  (SELECT count(*) FILTER (WHERE NOT has_column_privilege('authenticated', 'public.posts', c, 'SELECT')) || '|' ||
          string_agg(c, ',' ORDER BY c) FILTER (WHERE NOT has_column_privilege('anon', 'public.posts', c, 'SELECT'))
     FROM (SELECT unnest(attnames) c FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') s));

-- ===================== X: deletions (accounts, posts, alerts, petitions) against the append-only tables =====================
-- XM, a moderator, leaves a trace in every new table, then deletes their account.
SELECT pg_temp.run('XM', $q$SELECT public.place_safety_alert('general', 1, 'placed by XM', -71.5, 43.2)::text$q$);
SELECT pg_temp.run('XM', $q$SELECT public.update_safety_alert((SELECT v FROM ids WHERE k = 's1'), p_description => 'x', p_expected_version => 1)::text$q$);
SELECT pg_temp.run('XM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000b', 'outdated', true, NULL, 'XM labels')::text$q$);
SELECT pg_temp.run('XM', $q$SELECT public.admin_set_post_label('00000000-0000-4000-a000-00000000000a', 'sensitive', false, NULL, 'XM retracts')::text$q$);
SELECT pg_temp.run('XM', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000008')).status$q$);
SELECT pg_temp.run('XM', $q$INSERT INTO public.petitions (created_by, status, title, body, summary) VALUES (auth.uid(), 'draft', 'XM petition', 'XM asks.', 'XM') RETURNING 'stored'$q$);
SELECT pg_temp.run('PA', $q$SELECT public.admin_review_petition((SELECT id FROM public.petitions WHERE title = 'XM petition'), 'approve')::text$q$);
SELECT pg_temp.run('XM', $q$SELECT public.add_petition_update((SELECT id FROM public.petitions WHERE title = 'XM petition'), 'XM note')::text$q$);
SELECT pg_temp.run('C',  $q$SELECT (public.opt_in_to_post((SELECT id FROM public.posts WHERE petition_id = (SELECT id FROM public.petitions WHERE title = 'XM petition')))).status$q$);
CREATE TEMP TABLE x0 AS SELECT (SELECT count(*) FROM public.safety_alert_updates WHERE actor_id = pg_temp.u('XM')) AS hist,
  (SELECT count(*) FROM public.post_labels WHERE applied_by = pg_temp.u('XM') OR retracted_by = pg_temp.u('XM')) AS labels,
  (SELECT count(*) FROM public.resource_opt_in_events WHERE seeker_id = pg_temp.u('XM')) AS events,
  (SELECT count(*) FROM public.petition_updates WHERE created_by = pg_temp.u('XM')) AS notes,
  (SELECT count(*) FROM public.safety_alert_updates) AS hist_all, (SELECT count(*) FROM public.post_labels) AS labels_all, (SELECT count(*) FROM public.petition_updates) AS notes_all,
  pg_temp.slots('00000000-0000-4000-a000-000000000008') AS p8;
SELECT pg_temp.ck('X1', 'XM left a trace in every new table (history messages, label records as applier and as retractor, an opt-in event, a note) and holds a slot of P8', '^1\|2\|1\|1\|2/1/1$',
  (SELECT (hist >= 1)::int || '|' || labels || '|' || events || '|' || notes || '|' || p8 FROM x0));
SELECT pg_temp.ck('X2', 'the account deletion goes through (no append-only trigger, no foreign key stands in its way)', '^OK deleted$',
  pg_temp.pg($q$WITH d AS (DELETE FROM public.profiles WHERE id = pg_temp.u('XM') RETURNING 1), e AS (DELETE FROM auth.users WHERE id = pg_temp.u('XM') RETURNING 1) SELECT 'deleted' FROM d$q$));
SELECT pg_temp.ck('X3', 'afterwards: no row of the histories is lost, the actor columns that named XM are NULL, the roles stay; XM''s opt-in is gone, its slot is back and the removal is on the trail (system, seeker cleared)',
  '^t\|t\|t\|0\|0\|0\|2/2/0\|removed:pending:system:t$',
  (SELECT ((SELECT count(*) FROM public.safety_alert_updates) = hist_all)::char || '|' || ((SELECT count(*) FROM public.post_labels) = labels_all)::char || '|' ||
          ((SELECT count(*) FROM public.petition_updates) = notes_all)::char FROM x0) || '|' ||
  (SELECT count(*) FROM public.safety_alert_updates WHERE actor_id = pg_temp.u('XM')) || '|' ||
  (SELECT count(*) FROM public.post_labels WHERE applied_by = pg_temp.u('XM') OR retracted_by = pg_temp.u('XM')) || '|' ||
  (SELECT count(*) FROM public.petition_updates WHERE created_by = pg_temp.u('XM')) || '|' ||
  pg_temp.slots('00000000-0000-4000-a000-000000000008') || '|' ||
  (SELECT event || ':' || from_status || ':' || actor_role || ':' || (seeker_id IS NULL)::char FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000008' ORDER BY id DESC LIMIT 1));
SELECT pg_temp.ck('X4', 'the records XM wrote still say what happened and in which role (label applied / retracted by a community moderator; the note by its creator)', '^community_moderator\|community_moderator:XM retracts\|creator$',
  (SELECT source_role FROM public.post_labels WHERE reason = 'XM labels') || '|' ||
  (SELECT retracted_by_role || ':' || retract_reason FROM public.post_labels WHERE retract_reason = 'XM retracts') || '|' ||
  (SELECT author_role FROM public.petition_updates WHERE body = 'XM note'));
SELECT pg_temp.ck('X5', 'hard deletes by the table owner cascade through the append-only tables: a post (labels + opt-in trail), an alert (history), a petition (notes, its post)',
  '^OK 1\|0\|0;OK 1\|0;OK 1\|0\|0$',
  pg_temp.pg($q$WITH d AS (DELETE FROM public.posts WHERE id = '00000000-0000-4000-a000-00000000000a' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.post_labels WHERE post_id = '00000000-0000-4000-a000-00000000000a'$q$) || '|' ||
  left(pg_temp.pg($q$DELETE FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003' RETURNING 'x'$q$), 0) ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-000000000003'$q$) || ';' ||
  pg_temp.pg($q$WITH d AS (DELETE FROM public.safety_alerts WHERE id = (SELECT v FROM ids WHERE k = 'al2') RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.safety_alert_updates WHERE alert_id = (SELECT v FROM ids WHERE k = 'al2')$q$) || ';' ||
  pg_temp.pg($q$WITH d AS (DELETE FROM public.petitions WHERE id = (SELECT v FROM ids WHERE k = 'pt1') RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.petition_updates WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT count(*)::text FROM public.posts WHERE petition_id = (SELECT v FROM ids WHERE k = 'pt1')$q$));

-- X6: the account deletion function's own path (supabase/functions/delete-account): as service_role it deletes the
-- member's posts, then the profile row; the profile's opt-ins on other members' offers go by cascade. No client
-- DELETE grant is involved, so this is the same before and after the contract step.
INSERT INTO auth.users (id, email, is_anonymous, raw_user_meta_data) VALUES ('91000000-0000-4000-8000-000000000019', 'leaver@r3smoke.test', false, '{}'::jsonb);
INSERT INTO public.profiles (id) VALUES ('91000000-0000-4000-8000-000000000019') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.posts (id, user_id, content, post_type, metadata, max_seekers, created_at) VALUES
 ('00000000-0000-4000-a000-0000000000e1', pg_temp.u('A'), 'an offer the leaver opts in to', 'source_offer', '{"categories":["food"]}', 2, now() - interval '1 hour');
SELECT pg_temp.ck('X6', 'the deletion function''s path in both release states: the member holds a slot (2/1/1); service_role deletes the profile; the opt-in goes by cascade, the slot is back (2/2/0) and the trail records the removal by the system with the seeker cleared',
  '^OK pending\|2/1/1\|OK 1\|2/2/0\|removed:pending:system:t$',
  pg_temp.as_('91000000-0000-4000-8000-000000000019', false, $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-0000000000e1')).status$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-0000000000e1')$q$) || '|' ||
  pg_temp.svc($q$WITH d AS (DELETE FROM public.profiles WHERE id = '91000000-0000-4000-8000-000000000019' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-0000000000e1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT event || ':' || from_status || ':' || actor_role || ':' || (seeker_id IS NULL)::char FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-0000000000e1' ORDER BY id DESC LIMIT 1$q$));

-- X7: service_role keeps its direct DELETE on opt-ins in both release states (the contract step closes the client
-- roles only). The e2e fixtures (apps/web/e2e/fulfillment-view.spec.ts) and service-side cleanups rely on it.
SELECT pg_temp.run('C', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-0000000000e1')).status$q$);
SELECT pg_temp.ck('X7', 'service_role deletes a member''s opt-in directly, before and after the contract step: it holds the DELETE privilege, the row goes (2/1/1 -> 2/2/0), the slot is back and the trail records the removal by the system for the seeker',
  '^t\|2/1/1\|OK 1\|2/2/0\|removed:pending:system:t$',
  has_table_privilege('service_role', 'public.resource_opt_ins', 'DELETE')::char || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-0000000000e1')$q$) || '|' ||
  pg_temp.svc($q$WITH d AS (DELETE FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-0000000000e1' RETURNING 1) SELECT count(*)::text FROM d$q$) || '|' ||
  pg_temp.fresh($q$SELECT pg_temp.slots('00000000-0000-4000-a000-0000000000e1')$q$) || '|' ||
  pg_temp.fresh($q$SELECT event || ':' || from_status || ':' || actor_role || ':' || (seeker_id = pg_temp.u('C'))::char FROM public.resource_opt_in_events WHERE post_id = '00000000-0000-4000-a000-0000000000e1' ORDER BY id DESC LIMIT 1$q$));

-- ===================== Z: release state =====================
SELECT pg_temp.ck('Z1', 'ledger rows: 0266 always; 0267 exactly when contracted', CASE WHEN pg_temp.contract() THEN '^1\|1$' ELSE '^1\|0$' END,
  (SELECT count(*) FILTER (WHERE version = '20261026600000') || '|' || count(*) FILTER (WHERE version = '20261026700000') FROM supabase_migrations.schema_migrations));
SELECT pg_temp.ck('Z2', 'the four legacy paths: open in the expand state, closed after the contract step (alert update without a token | UPDATE (status) on opt-ins + its policy | INSERT (body_version_hash) | DELETE on opt-ins + its policy); the read policy and the guest block on opt-ins stay in both',
  CASE WHEN pg_temp.contract() THEN '^t\|f:0\|f\|ff:0\|opt_ins_select,resource_opt_ins_block_anon_insert$' ELSE '^f\|t:1\|t\|tf:1\|opt_ins_delete,opt_ins_select,opt_ins_update,resource_opt_ins_block_anon_insert$' END,
  (SELECT (prosrc ~ 'IF p_expected_version IS NULL THEN RAISE EXCEPTION ''alert_field_required:expected_version''')::char FROM pg_proc
    WHERE oid = 'public.update_safety_alert(uuid,text,integer,text,double precision,double precision,integer,text)'::regprocedure) || '|' ||
  has_column_privilege('authenticated', 'public.resource_opt_ins', 'status', 'UPDATE')::char || ':' ||
  (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.resource_opt_ins'::regclass AND polcmd = 'w') || '|' ||
  has_column_privilege('authenticated', 'public.petitions', 'body_version_hash', 'INSERT')::char || '|' ||
  has_table_privilege('authenticated', 'public.resource_opt_ins', 'DELETE')::char || has_table_privilege('anon', 'public.resource_opt_ins', 'DELETE')::char || ':' ||
  (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.resource_opt_ins'::regclass AND polcmd = 'd') || '|' ||
  (SELECT string_agg(polname, ',' ORDER BY polname) FROM pg_policy WHERE polrelid = 'public.resource_opt_ins'::regclass));
-- the migration's data fixes, as properties of every row (the rows that existed before it included)
SELECT pg_temp.ck('BF1', 'every alert has its message 1 (the backfill covered the alerts that existed before the migration)', '^0$',
  (SELECT count(*)::text FROM public.safety_alerts a WHERE NOT EXISTS (SELECT 1 FROM public.safety_alert_updates u WHERE u.alert_id = a.id AND u.version = 1)));
SELECT pg_temp.ck('BF2', 'every petition nobody has signed carries the sha256 of its body; a signed one carries the value its signatures recorded', '^0\|0$',
  (SELECT count(*)::text FROM public.petitions p WHERE NOT EXISTS (SELECT 1 FROM public.petition_signatures s WHERE s.petition_id = p.id)
      AND p.body_version_hash IS DISTINCT FROM encode(sha256(convert_to(p.body, 'UTF8')), 'hex')) || '|' ||
  (SELECT count(*) FROM public.petition_signatures s JOIN public.petitions p ON p.id = s.petition_id WHERE s.petition_version_hash IS DISTINCT FROM p.body_version_hash));
SELECT pg_temp.ck('BF3', 'every hidden comment says why it is hidden (existing hidden comments were a moderator''s)', '^0$',
  (SELECT count(*)::text FROM public.post_comments WHERE is_hidden AND hidden_reason IS NULL));
SELECT pg_temp.ck('Z3', 'new tables: RLS on with at least one policy each; no client write privilege on any of them', '^4\|0$',
  (SELECT count(*) FILTER (WHERE c.relrowsecurity AND EXISTS (SELECT 1 FROM pg_policy po WHERE po.polrelid = c.oid)) || '|' ||
          count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE') OR has_table_privilege('authenticated', c.oid, 'DELETE')
                                 OR has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE'))
     FROM pg_class c WHERE c.oid IN ('public.safety_alert_updates'::regclass, 'public.post_labels'::regclass, 'public.resource_opt_in_events'::regclass, 'public.petition_updates'::regclass)));
SELECT pg_temp.ck('Z3b', 'the seven policies of this release decide through the SECURITY DEFINER helpers or the row itself: none reads public.profiles as the caller (a column revoke on profiles cannot change who they admit)', '^7\|0$',
  (SELECT count(*) || '|' || count(*) FILTER (WHERE COALESCE(pg_get_expr(polqual, polrelid), '') || COALESCE(pg_get_expr(polwithcheck, polrelid), '') ~ '\mprofiles\M')
     FROM pg_policy
    WHERE polname IN ('safety_alert_updates_no_client_read', 'post_labels_select_public', 'post_labels_select_staff', 'resource_opt_in_events_select_parties',
                      'petitions_select_staff', 'petitions_select_own', 'petition_updates_select_approved')));
SELECT pg_temp.ck('Z4', 'the id sequences of the new tables carry no anon / authenticated privilege', '^f+$',
  (SELECT string_agg(has_sequence_privilege(r, sq, pr)::char, '' ORDER BY sq, r, pr)
     FROM unnest(ARRAY['public.safety_alert_updates_id_seq', 'public.post_labels_id_seq', 'public.resource_opt_in_events_id_seq', 'public.petition_updates_id_seq']) sq,
          unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) pr));

-- ---------------------------------------------------------------------------------------------
\pset pager off
SELECT id, what, expect, got FROM res WHERE NOT ok ORDER BY n;
DO $verdict$
DECLARE v_fail text := (SELECT string_agg(id, ', ' ORDER BY n) FROM res WHERE NOT ok);
BEGIN
  ASSERT v_fail IS NULL, 'FAIL r3_foundation smoke: ' || v_fail;
  RAISE NOTICE 'PASS r3_foundation smoke: % checks', (SELECT count(*) FROM res);
END
$verdict$;

ROLLBACK;
