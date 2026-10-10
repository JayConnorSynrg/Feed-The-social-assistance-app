-- posts_editing.smoke.sql
-- Behavioural smoke for 20261026000000_post_editing_foundation.sql: create_post (every creatable type,
-- atomic poll, image rules), edit_post (author only, version token / PT409, per-type whitelist,
-- grace, capacity, poll locks + close, venue time zone, held re-queue, removed refusal), soft delete,
-- history + RLS + redaction, comments (edit / version / grace / history / hide), posts.comment_count
-- (comments neither deleted nor hidden, every transition + backfill), posts.engaged_at (grace ends at the
-- first like / vote / comment / opt-in, for good), moderation integrity
-- (report snapshot, dismiss scope, optional p_expected_version, unseen-edit guard), the audit
-- ledger (exactly one row per staff action), ranked_feed_v2 / v1 drop, grants, publication, hygiene.
-- Concurrency (two edits, vote vs options edit, opt-in vs capacity cut, moderator vs author) lives
-- in posts_editing.race.sh.
--
-- Two release states, both must PASS: 20261026000000 alone (expand: the deployed client still inserts
-- posts / polls directly) and 20261026000000 + 20261026500000 (contract: client INSERT revoked). The
-- state is read from the ledger; the checks that differ assert each state's own behaviour.
-- Run against a database that ALREADY has the migration(s) applied, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/posts_editing.smoke.sql
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. It seeds its own principals
-- (auth.users + profiles + tiers) and rows, so it targets local / ephemeral databases. Every check
-- records a row; the final DO block lists the failing ids (ASSERT) or prints
-- 'PASS posts_editing smoke: N checks'. Refusals are proven by seeding the refused principal WITH
-- the privilege (the guest holds the platform_admin tier and authors a post).

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path TO public, extensions, pg_temp;

CREATE TEMP TABLE res (n serial, id text, what text, expect text, got text, ok boolean);
GRANT ALL ON res TO PUBLIC;
GRANT ALL ON SEQUENCE res_n_seq TO PUBLIC;

-- Run q as a principal (p_uid NULL = anon role); returns 'OK <value>' or 'ERR <sqlstate> <message>[ | <detail>]'.
CREATE FUNCTION pg_temp.as_(p_uid uuid, p_anon boolean, q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text; d text;
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
    GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL;
    r := 'ERR ' || SQLSTATE || ' ' || SQLERRM || COALESCE(' | ' || NULLIF(d, ''), '');
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN r;
END $f$;
-- principal by label
CREATE FUNCTION pg_temp.u(w text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
  SELECT (CASE w WHEN 'A' THEN 'a0000000-0000-4000-8000-000000000001' WHEN 'B' THEN 'b0000000-0000-4000-8000-000000000002'
                 WHEN 'C' THEN 'c0000000-0000-4000-8000-000000000003' WHEN 'G' THEN 'd0000000-0000-4000-8000-000000000004'
                 WHEN 'CM' THEN 'e0000000-0000-4000-8000-000000000005' WHEN 'RA' THEN 'f0000000-0000-4000-8000-000000000006'
                 WHEN 'PA' THEN '10000000-0000-4000-8000-000000000007' WHEN 'OA' THEN '20000000-0000-4000-8000-000000000008'
                 WHEN 'B2' THEN '30000000-0000-4000-8000-000000000009' END)::uuid
$f$;
CREATE FUNCTION pg_temp.run(w text, q text) RETURNS text LANGUAGE sql AS $f$
  SELECT CASE WHEN w = 'anon' THEN pg_temp.as_(NULL, false, q) ELSE pg_temp.as_(pg_temp.u(w), w = 'G', q) END
$f$;
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
-- one template, many keys, one principal: 'key=>result' lines
CREATE FUNCTION pg_temp.each(w text, p_keys text[], p_tpl text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE k text; o text := '';
BEGIN
  FOREACH k IN ARRAY p_keys LOOP o := o || k || '=>' || left(pg_temp.run(w, format(p_tpl, k)), 70) || E'\n'; END LOOP;
  RETURN o;
END $f$;
-- run q as the test owner, capturing errors
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
  RETURN left(r, 400) || '|+' || ((SELECT count(*) FROM public.admin_actions) - n0);
END $f$;
CREATE TEMP TABLE st AS SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026500000') AS contract;
GRANT SELECT ON st TO PUBLIC;
CREATE FUNCTION pg_temp.contract() RETURNS boolean LANGUAGE sql AS $f$ SELECT contract FROM st $f$;
CREATE FUNCTION pg_temp.ver(p uuid) RETURNS integer LANGUAGE sql AS $f$ SELECT version FROM public.posts WHERE id = p $f$;

-- ---------------------------------------------------------------------------------------------
-- Seed: A author, B seeker, C member, G guest (platform_admin tier + author of P8), CM community
-- moderator, RA resource admin, PA platform admin, OA org admin (no post rights), B2 second seeker.
-- ---------------------------------------------------------------------------------------------
INSERT INTO auth.users (id, email, is_anonymous, raw_user_meta_data)
SELECT pg_temp.u(w), CASE WHEN w = 'G' THEN NULL ELSE lower(w) || '@smoke.test' END, w = 'G', '{}'::jsonb
FROM unnest(ARRAY['A','B','C','G','CM','RA','PA','OA','B2']) w;
INSERT INTO public.profiles (id) SELECT id FROM auth.users u
WHERE u.email LIKE '%@smoke.test' OR u.id = pg_temp.u('G') ON CONFLICT (id) DO NOTHING;
SELECT set_config('feed.tier_write', 'on', true);
UPDATE public.profiles SET admin_tier = 'community_moderator' WHERE id = pg_temp.u('CM');
UPDATE public.profiles SET admin_tier = 'resource_admin'      WHERE id = pg_temp.u('RA');
UPDATE public.profiles SET admin_tier = 'platform_admin'      WHERE id IN (pg_temp.u('PA'), pg_temp.u('G'));
SELECT set_config('feed.tier_write', '', true);
INSERT INTO public.organizations (id, name, org_type, is_active) VALUES ('0a000000-0000-4000-8000-0000000000a1', 'Smoke Org', 'community', true);
INSERT INTO public.organization_members (org_id, user_id, role) VALUES ('0a000000-0000-4000-8000-0000000000a1', pg_temp.u('OA'), 'admin');

-- posts created 1 h ago (outside the grace window)
INSERT INTO public.posts (id, user_id, content, post_type, metadata, max_seekers, created_at) VALUES
 ('00000000-0000-4000-a000-000000000001', pg_temp.u('A'), 'plain post', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000002', pg_temp.u('A'), 'need diapers', 'seeker_request', '{"categories":["childcare"]}', NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000003', pg_temp.u('A'), 'free produce', 'source_offer', '{"categories":["food"]}', 3, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000004', pg_temp.u('A'), 'Potluck', 'event_post',
    '{"starts_at":"2026-11-01T17:00","ends_at":"2026-11-01T19:00","location":"Town hall","is_online":false}', NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000005', pg_temp.u('A'), 'Best day?', 'poll', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000007', pg_temp.u('A'), 'resource share', 'resource_post', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000008', pg_temp.u('G'), 'guest-authored', 'feed', NULL, NULL, now() - interval '1 hour'),
 ('00000000-0000-4000-a000-000000000009', pg_temp.u('C'), 'member C post', 'feed', NULL, NULL, now() - interval '1 hour');
INSERT INTO public.polls (id, post_id, question, options, ends_at) VALUES
 ('0b000000-0000-4000-8000-000000000005', '00000000-0000-4000-a000-000000000005', 'Best day?', '["Sat","Sun"]', now() + interval '2 days');
INSERT INTO public.petitions (id, title, summary, body, body_version_hash, status, created_by) VALUES
 ('0c000000-0000-4000-8000-000000000006', 'Fix the bridge', 'sum', 'body', 'h1', 'approved', pg_temp.u('A'));
INSERT INTO public.posts (id, user_id, content, post_type, petition_id, created_at) VALUES
 ('00000000-0000-4000-a000-000000000006', pg_temp.u('A'), 'sign this', 'petition', '0c000000-0000-4000-8000-000000000006', now() - interval '1 hour');
INSERT INTO public.resources (id, name, category, status) VALUES
 ('0f000000-0000-4000-8000-000000000001', 'Food shelf', 'food', 'approved'),
 ('0f000000-0000-4000-8000-000000000002', 'Pending shelf', 'food', 'pending');
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.objects (bucket_id, name) VALUES
 ('post-images', 'a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg'),
 ('post-images', 'a0000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.webp'),
 -- existing objects in the author's own folder with a refused type: only the extension rule can refuse them
 ('post-images', 'a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.gif'),
 ('post-images', 'a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.svg'),
 ('post-images', 'c0000000-0000-4000-8000-000000000003/22222222-2222-4222-8222-222222222222.jpg');
CREATE TEMP TABLE snap AS
  SELECT id, post_type, petition_id, resource_id, user_id, is_pinned, created_at
  FROM public.posts WHERE id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004',
                                 '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000001');

-- ===================== M: new columns, grants, version untouched by engagement =====================
SELECT pg_temp.ck('M1', 'defaults: version 1, edit_count 0, edited_at/deleted_at/needs_review_at NULL', '^1\|0\|t\|t\|t$',
  (SELECT version || '|' || edit_count || '|' || (edited_at IS NULL)::char || '|' || (deleted_at IS NULL)::char || '|' || (needs_review_at IS NULL)::char
   FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000001'));
SELECT pg_temp.ck('M2', 'column SELECT: anon gets version/edited_at/edit_count/image_alt/lang only; authenticated all seven', '^ttttt ff ttttttt$',
  (SELECT string_agg(has_column_privilege('anon', 'public.posts', c, 'SELECT')::char, '' ORDER BY o) FILTER (WHERE o <= 5) || ' ' ||
          string_agg(has_column_privilege('anon', 'public.posts', c, 'SELECT')::char, '' ORDER BY o) FILTER (WHERE o > 5) || ' ' ||
          string_agg(has_column_privilege('authenticated', 'public.posts', c, 'SELECT')::char, '' ORDER BY o)
   FROM unnest(ARRAY['version','edited_at','edit_count','image_alt','lang','deleted_at','needs_review_at']) WITH ORDINALITY x(c, o)));
SELECT pg_temp.ck('M3', 'no client UPDATE / DELETE on comments (both states); posts.location unreadable', '^ffff f$',
  (SELECT string_agg(has_table_privilege(r, 'public.post_comments', p)::char, '' ORDER BY r, p)
   FROM unnest(ARRAY['anon','authenticated']) r, unnest(ARRAY['UPDATE','DELETE']) p)
  || ' ' || has_column_privilege('anon', 'public.posts', 'location', 'SELECT')::char);
SELECT pg_temp.ck('M3b', 'client INSERT on posts + INSERT/UPDATE/DELETE on polls: kept by 026 (expand), revoked by 0265 (contract)',
  CASE WHEN pg_temp.contract() THEN '^fffff$' ELSE '^tttt' END,
  (SELECT string_agg(has_table_privilege('authenticated', tb, p)::char, '' ORDER BY o)
   FROM (VALUES (1, 'public.posts', 'INSERT'), (2, 'public.polls', 'INSERT'), (3, 'public.polls', 'UPDATE'), (4, 'public.polls', 'DELETE'), (5, 'public.posts', 'UPDATE')) v(o, tb, p)));
SELECT pg_temp.run('B', $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ('00000000-0000-4000-a000-000000000002', auth.uid()) RETURNING 'liked'$q$);
SELECT pg_temp.run('B', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0d000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-a000-000000000002', auth.uid(), 'first') RETURNING 'commented'$q$);
SELECT pg_temp.t('M4a', 'B opts in to offer P3 (pending)', '^OK pending', 'B', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$);
SELECT pg_temp.run('B2', $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$);
SELECT pg_temp.t('M4b', 'author declines B2 (the slot stays held until unblock)', '^OK declined', 'A',
  $q$UPDATE public.resource_opt_ins SET status = 'declined' WHERE post_id = '00000000-0000-4000-a000-000000000003' AND seeker_id = '30000000-0000-4000-8000-000000000009' RETURNING status$q$);
SELECT pg_temp.run('B', $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000009', 'spam')::text$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post('00000000-0000-4000-a000-000000000009')::text$q$);
SELECT pg_temp.ck('M4', 'like / comment / opt-in / decline / report / hold leave version 1, edit_count 0, edited_at NULL',
  '^1\|0\|t;1\|0\|t;1\|0\|t$',
  (SELECT string_agg(version || '|' || edit_count || '|' || (edited_at IS NULL)::char, ';' ORDER BY id) FROM public.posts
   WHERE id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000009')));
SELECT pg_temp.ck('M4c', 'the engagement really happened (likes|comments|slots|hidden)', '^1\|1\|1\|true$',
  (SELECT (SELECT like_count FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000002') || '|' ||
          (SELECT comment_count FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000002') || '|' ||
          (SELECT slots_remaining FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003') || '|' ||
          (SELECT is_hidden FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000009')));
SELECT pg_temp.run('CM', $q$SELECT public.admin_authorize_post('00000000-0000-4000-a000-000000000009')::text$q$);
SELECT pg_temp.ck('M4d', 'authorize leaves version 1', '^1$', pg_temp.ver('00000000-0000-4000-a000-000000000009')::text);

-- ===================== E: edit_post =====================
SELECT pg_temp.t('E1', 'guest who AUTHORED the post and holds the platform_admin tier is refused first', '^ERR 42501 guest_refused', 'G',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000008', 1, '{"content":"x"}')::text$q$);
SELECT pg_temp.ck('E2', 'non-authors refused: member, community moderator, resource admin, platform admin, org admin',
  '^(\w+=>ERR 42501 not_author;){5}$',
  pg_temp.who(ARRAY['C','CM','RA','PA','OA'], $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 1, '{"content":"x"}')::text$q$));
SELECT pg_temp.t('E2b', 'missing expected version refused', '^ERR 22023 post_field_required:expected_version', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', NULL, '{"content":"x"}')::text$q$);
SELECT pg_temp.t('E3', 'author edits after grace: version 2, revision written, not grace', '^OK .*"grace": false.*"version": 2', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 1, '{"content":"plain post (edited)"}', 'typo')::text$q$);
SELECT pg_temp.t('E3b', 'stale expected version -> PT409 with current_version in DETAIL (JSON)', '^ERR PT409 edit_conflict \| \{.*"current_version": 2\}$', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 1, '{"content":"lost update"}')::text$q$);
SELECT pg_temp.ck('E3c', 'PT409 DETAIL parses as JSON with current_version + edited_at',
  '^2\|t$',
  (SELECT (d::jsonb ->> 'current_version') || '|' || (d::jsonb ? 'edited_at')::char
   FROM (SELECT split_part(pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 1, '{"content":"x"}')::text$q$), ' | ', 2) d) s));
SELECT pg_temp.ck('E4', 'feed post: every protected key refused 22023 post_field_not_editable',
  '^(\w+=>ERR 22023 post_field_not_editable:\w+\n){15}$',
  pg_temp.each('A', ARRAY['post_type','is_pinned','resource_id','user_id','like_count','comment_count','created_at','petition_id',
                          'is_hidden','hidden_reason','version','categories','deleted_at','edited_at','lang'],
    $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 2, jsonb_build_object(%L, 'x'))::text$q$));
SELECT pg_temp.t('E5', 'seeker_request: categories editable', '"changed": \["metadata"\]', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000002', 1, '{"categories":["childcare","clothing"]}')::text$q$);
SELECT pg_temp.t('E5b', 'seeker_request: image_url is not a field of this type', '^ERR 22023 post_field_not_editable:image_url', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000002', 2, '{"image_url":null}')::text$q$);
-- capacity: P3 max 3, rows B pending + B2 declined => committed 2
SELECT pg_temp.t('E6a', 'offer: capacity below committed refused with the committed count', '^ERR 22023 capacity_below_committed \| \{"committed": 2\}', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000003', 1, '{"max_seekers":1}')::text$q$);
SELECT pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000003', 1, '{"max_seekers":5}')::text$q$);
SELECT pg_temp.ck('E6b', 'offer: raise to 5 -> slots 3', '^5\|3$',
  (SELECT max_seekers || '|' || slots_remaining FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003'));
SELECT pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000003', 2, '{"max_seekers":null}')::text$q$);
SELECT pg_temp.ck('E6c', 'offer: unlimited -> slots NULL', '^\|$',
  (SELECT COALESCE(max_seekers::text, '') || '|' || COALESCE(slots_remaining::text, '') FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003'));
SELECT pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000003', 3, '{"max_seekers":2}')::text$q$);
SELECT pg_temp.ck('E6d', 'offer: back to 2 with 2 committed -> slots 0', '^2\|0$',
  (SELECT max_seekers || '|' || slots_remaining FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003'));
-- member event post (the legacy row has no time zone)
SELECT pg_temp.ck('E7a', 'legacy zone-less event: ANY edit (title only, or time) must add the venue time zone',
  '^title=>ERR 22023 post_field_required:time_zone.*\ntime=>ERR 22023 post_field_required:time_zone',
  pg_temp.each('A', ARRAY['title','time'],
   $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000004', 1, (jsonb_build_object(
        'title', '{"content":"Potluck!"}'::jsonb, 'time', '{"starts_at":"2026-11-02T17:00","ends_at":"2026-11-02T19:00"}'::jsonb))->%L)::text$q$));
SELECT pg_temp.t('E7b', 'event: time + venue zone accepted', '"version": 2', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000004', 1, '{"starts_at":"2026-11-02T17:00","ends_at":"2026-11-02T19:00","time_zone":"America/New_York"}')::text$q$);
SELECT pg_temp.ck('E7c', 'event: invalid end / unknown zone / unsupported zones / impossible date refused; online clears location',
  '^ends=>ERR 22023 post_field_invalid:ends_at.*\nmars=>ERR 22023 post_field_invalid:time_zone.*\nasun=>ERR 22023 post_field_invalid:time_zone.*\ncoyh=>ERR 22023 post_field_invalid:time_zone.*\ndate=>ERR 22023 post_field_invalid:starts_at.*\nonline=>OK',
  pg_temp.each('A', ARRAY['ends','mars','asun','coyh','date','online'],
   $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000004', 2, (jsonb_build_object(
        'ends', '{"ends_at":"2026-11-02T16:00"}'::jsonb, 'mars', '{"time_zone":"Mars/Base"}'::jsonb,
        'asun', '{"time_zone":"America/Asuncion"}'::jsonb, 'coyh', '{"time_zone":"America/Coyhaique"}'::jsonb,
        'date', '{"starts_at":"2026-02-30T10:00"}'::jsonb, 'online', '{"is_online":true}'::jsonb))->%L)::text$q$));
SELECT pg_temp.ck('E7d', 'event metadata after edits (online => location null, zone kept)', '^true\|\|America/New_York\|2026-11-02T17:00$',
  (SELECT (metadata->>'is_online') || '|' || COALESCE(metadata->>'location', '') || '|' || (metadata->>'time_zone') || '|' || (metadata->>'starts_at')
   FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000004'));
-- a legacy row shaped like production's only event_post (no zone, end BEFORE start): untouched until edited
INSERT INTO public.posts (id, user_id, content, post_type, metadata, created_at) VALUES
 ('00000000-0000-4000-a000-000000000010', pg_temp.u('A'), 'Clothing swap', 'event_post',
  '{"ends_at":"2026-09-23T02:00","location":"49 Evelyn St","is_online":false,"starts_at":"2026-09-26T09:00"}', now() - interval '1 hour');
SELECT pg_temp.ck('E7f', 'legacy event, title-only edit: refused, reporting BOTH the missing zone and the end before the start',
  '^ERR 22023 post_field_required:time_zone \| \{"problems": \{"ends_at": "before_start", "time_zone": "required"\}\}$',
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000010', 1, '{"content":"Clothing swap!"}')::text$q$));
SELECT pg_temp.ck('E7g', '... adding only the zone still reports the end time', '^ERR 22023 post_field_invalid:ends_at \| \{"problems": \{"ends_at": "before_start"\}\}$',
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000010', 1, '{"time_zone":"America/New_York"}')::text$q$));
SELECT pg_temp.ck('E7h', '... zone + a valid end: accepted; the row was unchanged until then', '^OK .*"version": 2',
  pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000010', 1, '{"time_zone":"America/New_York","ends_at":"2026-09-26T11:00"}')::text$q$));
SELECT pg_temp.ck('E7h2', '... stored', '^America/New_York\|2026-09-26T11:00\|1$',
  (SELECT (metadata->>'time_zone') || '|' || (metadata->>'ends_at') || '|' || (SELECT count(*) FROM public.post_revisions WHERE post_id = p.id)
   FROM public.posts p WHERE id = '00000000-0000-4000-a000-000000000010'));
SELECT pg_temp.t('E7e', 'event: the zone cannot be removed', '^ERR 22023 post_field_invalid:time_zone', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000004', 3, '{"time_zone":null}')::text$q$);
-- poll
SELECT pg_temp.t('E8a', 'poll with 0 votes: question + options editable', '"version": 2', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000005', 1, '{"content":"Which day?","options":["Fri","Sat","Sun"]}')::text$q$);
SELECT pg_temp.ck('E8b', 'poll: posts.content and polls.question stay in sync', '^Which day\?\|Which day\?\|\["Fri", "Sat", "Sun"\]$',
  (SELECT p.content || '|' || pl.question || '|' || pl.options::text FROM public.posts p JOIN public.polls pl ON pl.post_id = p.id
   WHERE p.id = '00000000-0000-4000-a000-000000000005'));
SELECT pg_temp.run('B', $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) VALUES ('0b000000-0000-4000-8000-000000000005', auth.uid(), 1) RETURNING 'voted'$q$);
SELECT pg_temp.ck('E8c', 'after the first vote: question/options locked; extend ok; shorten refused; remove deadline ok; add deadline refused; close now ok; reopen refused; close again no-op',
  '^q=>ERR 22023 post_field_locked:content.*\no=>ERR 22023 post_field_locked:options.*\next=>OK.*\nshort=>ERR 22023 post_field_locked:ends_at.*\nnull=>OK.*\ndl=>ERR 22023 post_field_locked:ends_at.*\nclose=>OK.*\nreopen=>ERR 22023 post_field_locked:ends_at.*\nagain=>OK \{.*"changed": \[\]',
  pg_temp.each('A', ARRAY['q','o','ext','short','null','dl','close','reopen','again'],
   $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000005', (SELECT version FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000005'), (jsonb_build_object(
        'q', '{"content":"Changed?"}'::jsonb, 'o', '{"options":["X","Y"]}'::jsonb,
        'ext', jsonb_build_object('ends_at', to_char(now() + interval '5 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        'short', jsonb_build_object('ends_at', to_char(now() + interval '1 day', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        'null', '{"ends_at":null}'::jsonb,
        'dl', jsonb_build_object('ends_at', to_char(now() + interval '9 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        'close', '{"ends_at":"now"}'::jsonb,
        'reopen', jsonb_build_object('ends_at', to_char(now() + interval '9 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        'again', '{"ends_at":"now"}'::jsonb))->%L)::text$q$));
SELECT pg_temp.ck('E8d', 'closed poll: ends_at = now; a new vote is refused (RLS), the earlier vote stays', '^t\|C=>ERR 42501 new row violates row-level security policy.*;\|1$',
  (SELECT (ends_at = now())::char FROM public.polls WHERE id = '0b000000-0000-4000-8000-000000000005') || '|' ||
  pg_temp.who(ARRAY['C'], $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) VALUES ('0b000000-0000-4000-8000-000000000005', auth.uid(), 0) RETURNING 'voted'$q$)
  || '|' || (SELECT count(*) FROM public.poll_votes WHERE poll_id = '0b000000-0000-4000-8000-000000000005'));
SELECT pg_temp.ck('E8e', 'poll deadline must be an instant with an offset or "now" (no infinity / zone-less / prose)',
  '^inf=>ERR 22023 post_field_invalid:ends_at.*\nnaive=>ERR 22023 post_field_invalid:ends_at.*\nword=>ERR 22023 post_field_invalid:ends_at',
  pg_temp.each('C', ARRAY['inf','naive','word'],
   $q$SELECT public.create_post('poll', jsonb_build_object('content', 'Lunch?', 'options', jsonb_build_array('Yes','No')) || (jsonb_build_object(
        'inf', '{"ends_at":"infinity"}'::jsonb, 'naive', '{"ends_at":"2030-01-01T10:00"}'::jsonb, 'word', '{"ends_at":"tomorrow"}'::jsonb))->%L)::text$q$));
SELECT pg_temp.t('E9', 'petition post: not editable', '^ERR 0A000 post_type_not_editable:petition', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000006', 1, '{"content":"x"}')::text$q$);
SELECT pg_temp.t('E10', 'resource_post: the linked resource is not editable', '^ERR 22023 post_field_not_editable:resource_id', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000007', 1, jsonb_build_object('resource_id', gen_random_uuid()))::text$q$);
-- grace
SELECT pg_temp.t('E11a', 'create_post (fresh feed post)', '^OK [0-9a-f-]{36}$', 'A', $q$SELECT public.create_post('feed', '{"content":"fresh"}')::text$q$);
CREATE TEMP TABLE ids AS SELECT id AS fresh FROM public.posts WHERE content = 'fresh';
GRANT SELECT ON ids TO PUBLIC;
SELECT pg_temp.t('E11b', 'grace edit (< 5 min, no engagement): quiet, version bumps', '"grace": true.*"version": 2', 'A',
  $q$SELECT public.edit_post((SELECT fresh FROM ids), 1, '{"content":"fresh!"}')::text$q$);
SELECT pg_temp.ck('E11c', 'grace: 0 revisions, edited_at NULL, edit_count 0, version 2', '^0\|t\|0\|2$',
  (SELECT (SELECT count(*) FROM public.post_revisions WHERE post_id = p.id) || '|' || (p.edited_at IS NULL)::char || '|' || p.edit_count || '|' || p.version
   FROM public.posts p WHERE p.id = (SELECT fresh FROM ids)));
SELECT pg_temp.run('B', $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ((SELECT fresh FROM ids), auth.uid()) RETURNING 'liked'$q$);
SELECT pg_temp.t('E11d', 'after the first like the same edit is recorded', '"grace": false', 'A',
  $q$SELECT public.edit_post((SELECT fresh FROM ids), 2, '{"content":"fresh!!"}')::text$q$);
SELECT pg_temp.ck('E11e', 'recorded edit: 1 revision (version 2), edited_at set, edit_count 1', '^1\|2\|f\|1$',
  (SELECT (SELECT count(*) FROM public.post_revisions WHERE post_id = p.id) || '|' || (SELECT max(version) FROM public.post_revisions WHERE post_id = p.id)
          || '|' || (p.edited_at IS NULL)::char || '|' || p.edit_count FROM public.posts p WHERE p.id = (SELECT fresh FROM ids)));
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"fresh reported"}')::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.submit_content_report('post', (SELECT id FROM public.posts WHERE content = 'fresh reported'), 'spam')::text$q$);
SELECT pg_temp.t('E11f', 'a report also ends the grace window', '"grace": false', 'A',
  $q$SELECT public.edit_post((SELECT id FROM public.posts WHERE content = 'fresh reported'), 1, '{"content":"fresh reported!"}')::text$q$);
-- held / removed
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post('00000000-0000-4000-a000-000000000001', 2)::text$q$);
SELECT pg_temp.t('E12a', 'author may edit a HELD post', '"version": 3', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000001', 2, '{"content":"plain post (fixed for review)"}')::text$q$);
SELECT pg_temp.ck('E12b', 'held edit: still hidden, reason kept, re-queued (needs_review_at), revision written', '^true\|hold_for_review\|t\|2$',
  (SELECT is_hidden || '|' || hidden_reason || '|' || (needs_review_at IS NOT NULL)::char || '|' ||
          (SELECT count(*) FROM public.post_revisions WHERE post_id = p.id) FROM public.posts p WHERE id = '00000000-0000-4000-a000-000000000001'));
SELECT pg_temp.run('CM', $q$SELECT public.admin_remove_post('00000000-0000-4000-a000-000000000009')::text$q$);
SELECT pg_temp.t('E12c', 'author may NOT edit an admin-removed post', '^ERR 42501 post_removed', 'C',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000009', 1, '{"content":"x"}')::text$q$);
SELECT pg_temp.ck('E13', 'never changed by edits: type, petition, resource, author, pin, created_at; counts = their rows', '^0$',
  (SELECT count(*)::text FROM snap s JOIN public.posts p USING (id)
   WHERE (s.post_type, s.petition_id, s.resource_id, s.user_id, s.is_pinned, s.created_at)
         IS DISTINCT FROM (p.post_type, p.petition_id, p.resource_id, p.user_id, p.is_pinned, p.created_at)
      OR p.like_count <> (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id)
      OR p.comment_count <> (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND NOT c.is_hidden)));
SELECT pg_temp.t('E14', 'no-op edit: nothing changes, no version bump, no revision', '"changed": \[\].*"version": 1', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000007', 1, '{"content":"resource share"}')::text$q$);
SELECT pg_temp.ck('E15', 'image_url: foreign host, other user folder, missing object, an existing own gif / svg refused; own object ok; alt needs image',
  '^host=>ERR 22023 post_field_invalid:image_url.*\nother=>ERR 22023 post_field_invalid:image_url.*\nmissing=>ERR 22023 post_field_invalid:image_url.*\ngif=>ERR 22023 post_field_invalid:image_url.*\nsvg=>ERR 22023 post_field_invalid:image_url.*\nown=>OK.*\nalt_no_img=>ERR 22023 post_field_invalid:image_alt',
  pg_temp.each('A', ARRAY['host','other','missing','gif','svg','own','alt_no_img'],
   $q$SELECT public.edit_post((SELECT fresh FROM ids), (SELECT version FROM public.posts WHERE id = (SELECT fresh FROM ids)), (jsonb_build_object(
     'host', '{"image_url":"https://evil.example/storage/v1/object/public/post-images/a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg"}'::jsonb,
     'other', '{"image_url":"https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/c0000000-0000-4000-8000-000000000003/22222222-2222-4222-8222-222222222222.jpg"}'::jsonb,
     'missing', '{"image_url":"https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/a0000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.jpg"}'::jsonb,
     'gif', '{"image_url":"https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.gif"}'::jsonb,
     'svg', '{"image_url":"https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.svg"}'::jsonb,
     'own', '{"image_url":"https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/a0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg","image_alt":"Crates of apples"}'::jsonb,
     'alt_no_img', '{"image_url":null,"image_alt":"orphan alt"}'::jsonb))->%L)::text$q$));
SELECT pg_temp.run('A', $q$SELECT public.edit_post((SELECT fresh FROM ids), (SELECT version FROM public.posts WHERE id = (SELECT fresh FROM ids)), '{"image_url":null}')::text$q$);
SELECT pg_temp.ck('E15b', 'removing the photo clears its alt text', '^t\|t$',
  (SELECT (image_url IS NULL)::char || '|' || (image_alt IS NULL)::char FROM public.posts WHERE id = (SELECT fresh FROM ids)));
SELECT pg_temp.run('A', $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000007', 1, jsonb_build_object('content', E'<script>alert("x")</script> & ''q'' &amp; &lt;b&gt;'))::text$q$);
SELECT pg_temp.t('E16', 'raw text round-trips exactly (stored unescaped; React escapes on render)', '^OK t$', 'C',
  $q$SELECT ((SELECT content FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000007') = E'<script>alert("x")</script> & ''q'' &amp; &lt;b&gt;')::char$q$);
SELECT pg_temp.t('E17', 'an edit note longer than 500 characters is refused', '^ERR 22023 post_field_invalid:reason', 'A',
  $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000007', 2, '{"content":"x"}', repeat('r', 501))::text$q$);

-- ===================== R: history, RLS, redaction =====================
SELECT pg_temp.ck('R1', 'revision row: superseded version, previous content, fields, reason', '^1\|plain post\|\{content\}\|typo$',
  (SELECT version || '|' || (snapshot->>'content') || '|' || fields_changed::text || '|' || reason FROM public.post_revisions
   WHERE post_id = '00000000-0000-4000-a000-000000000001' AND version = 1));
SELECT pg_temp.ck('R1b', 'poll revision carries the poll (question, options, deadline)', '^Best day\?\|\["Sat", "Sun"\]$',
  (SELECT (snapshot->'poll'->>'question') || '|' || (snapshot->'poll'->'options')::text FROM public.post_revisions
   WHERE post_id = '00000000-0000-4000-a000-000000000005' AND version = 1));
SELECT pg_temp.ck('R2', 'visible post: anon, guest, member read its history', '^anon=>OK 1;G=>OK 1;C=>OK 1;$',
  pg_temp.who(ARRAY['anon','G','C'], $q$SELECT count(*)::text FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000002'$q$));
SELECT pg_temp.ck('R3', 'held post history: hidden from anon / members; author + every staff tier see it',
  '^anon=>OK 0;C=>OK 0;B=>OK 0;A=>OK 2;CM=>OK 2;RA=>OK 2;PA=>OK 2;$',
  pg_temp.who(ARRAY['anon','C','B','A','CM','RA','PA'], $q$SELECT count(*)::text FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000001'$q$));
SELECT pg_temp.ck('R4', 'author redacts own revision (no audit row)', '^OK .*"redactor_role": "author".*\|\+0$',
  pg_temp.audited('A', $q$SELECT public.redact_post_revision((SELECT id FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000002' AND version = 1))::text$q$));
SELECT pg_temp.t('R4b', 'anon sees only version / when / who-role on a redacted revision', '^OK 1\|author\|t\|t\|t\|t$', 'anon',
  $q$SELECT version || '|' || redactor_role || '|' || (redacted_at IS NOT NULL)::char || '|' || (snapshot IS NULL)::char || '|' || (reason IS NULL)::char || '|' || (fields_changed IS NULL)::char
     FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000002'$q$);
SELECT pg_temp.ck('R5', 'platform admin: reason required; then redacts with exactly one audit row',
  '^ERR 22023 reason_required.*\|\+0;OK .*"redactor_role": "platform_admin".*\|\+1$',
  pg_temp.audited('PA', $q$SELECT public.redact_post_revision((SELECT min(id) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000003'))::text$q$)
  || ';' || pg_temp.audited('PA', $q$SELECT public.redact_post_revision((SELECT min(id) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000003'), 'contained a phone number')::text$q$));
SELECT pg_temp.ck('R5b', 'repeat redaction is idempotent (no second audit row)', '^OK .*"already_redacted": true.*\|\+0$',
  pg_temp.audited('PA', $q$SELECT public.redact_post_revision((SELECT min(id) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000003'), 'again')::text$q$));
SELECT pg_temp.ck('R6', 'redaction refused: community moderator, resource admin, member; guest with the platform tier refused as guest',
  '^CM=>ERR 42501 p3_denied:insufficient_tier;RA=>ERR 42501 p3_denied:insufficient_tier;C=>ERR 42501 p3_denied:insufficient_tier;G=>ERR 42501 guest_refused;$',
  pg_temp.who(ARRAY['CM','RA','C','G'], $q$SELECT public.redact_post_revision((SELECT id FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000004' AND version = 2), 'r')::text$q$));
SELECT pg_temp.ck('R7', 'clients cannot write history (insert / update / delete)', '^(A=>ERR 42501 permission denied for table post_revisions;){3}$',
  pg_temp.who(ARRAY['A'], $q$INSERT INTO public.post_revisions (post_id, version, snapshot, fields_changed) VALUES ('00000000-0000-4000-a000-000000000001', 9, '{}', '{}') RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['A'], $q$UPDATE public.post_revisions SET snapshot = '{}' RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['A'], $q$DELETE FROM public.post_revisions RETURNING 'x'$q$));
SELECT pg_temp.ck('R7b', 'append-only even for the table owner: rewrite, un-redact and delete refused while the post exists',
  '^ERR 42501 revisions_append_only\|ERR 42501 revisions_append_only\|ERR 42501 revisions_append_only$',
  pg_temp.pg($q$UPDATE public.post_revisions SET snapshot = '{"content":"rewritten"}' WHERE post_id = '00000000-0000-4000-a000-000000000001' AND version = 1 RETURNING 'x'$q$)
  || '|' || pg_temp.pg($q$UPDATE public.post_revisions SET redacted_at = NULL, redactor_role = NULL, snapshot = '{}' WHERE post_id = '00000000-0000-4000-a000-000000000002' AND version = 1 RETURNING 'x'$q$)
  || '|' || pg_temp.pg($q$DELETE FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000001' RETURNING 'x'$q$));

-- ===================== K: comments =====================
SELECT pg_temp.t('K1a', 'comment edit inside 5 min with no replies: grace (no history), version 2', '"grace": true.*"version": 2', 'B',
  $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', 1, 'first!')::text$q$);
SELECT pg_temp.t('K1a2', 'a second tab still on version 1 is refused even inside grace (no silent overwrite)',
  '^ERR PT409 edit_conflict \| \{.*"current_version": 2\}$', 'B',
  $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', 1, 'first from tab two')::text$q$);
UPDATE public.post_comments SET created_at = now() - interval '1 hour' WHERE id = '0d000000-0000-4000-8000-0000000000c1';
SELECT pg_temp.t('K1b', 'later comment edit: history row + Edited marker', '"grace": false.*"version": 3', 'B',
  $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', 2, 'first!!')::text$q$);
SELECT pg_temp.ck('K1c', 'comment: 1 revision (version 2, previous text), edit_count 1, edited_at set, post version untouched', '^1\|2\|first!\|1\|t\|2$',
  (SELECT (SELECT count(*) FROM public.post_comment_revisions r WHERE r.comment_id = c.id) || '|' ||
          (SELECT version || '|' || content FROM public.post_comment_revisions r WHERE r.comment_id = c.id) || '|' || c.edit_count || '|' ||
          (c.edited_at IS NOT NULL)::char || '|' || pg_temp.ver(c.post_id)
   FROM public.post_comments c WHERE c.id = '0d000000-0000-4000-8000-0000000000c1'));
SELECT pg_temp.ck('K2', 'comment edit refused: other member, guest, stale version, missing version',
  '^C=>ERR 42501 not_author;G=>ERR 42501 guest_refused;B=>ERR PT409 edit_conflict \| \{.*"current_version": 3\};B=>ERR 22023 comment_field_required:expected_version;$',
  pg_temp.who(ARRAY['C','G'], $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', 3, 'hijack')::text$q$)
  || pg_temp.who(ARRAY['B'], $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', 2, 'again')::text$q$)
  || pg_temp.who(ARRAY['B'], $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', NULL, 'again')::text$q$));
SELECT pg_temp.t('K3', 'comment owner can no longer re-point post_id (UPDATE revoked)', '^ERR 42501 permission denied for table post_comments', 'B',
  $q$UPDATE public.post_comments SET post_id = '00000000-0000-4000-a000-000000000005' WHERE id = '0d000000-0000-4000-8000-0000000000c1' RETURNING 'x'$q$);
SELECT pg_temp.t('K5a', 'anon reads comment history while the comment is visible', '^OK 1$', 'anon',
  $q$SELECT count(*)::text FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c1'$q$);
SELECT pg_temp.ck('K4', 'moderator hides a comment with exactly one audit row; guest (platform_admin tier) and member refused',
  '^ERR 42501 guest_refused.*\|\+0;ERR 42501 p3_denied:insufficient_tier.*\|\+0;OK .*"is_hidden": true.*\|\+1$',
  pg_temp.audited('G', $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-0000000000c1', true, 'spam')::text$q$)
  || ';' || pg_temp.audited('C', $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-0000000000c1', true, 'spam')::text$q$)
  || ';' || pg_temp.audited('CM', $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-0000000000c1', true, 'spam')::text$q$));
SELECT pg_temp.ck('K4b', 'hidden comment: its author cannot edit it', '^B=>ERR 42501 comment_hidden;$',
  pg_temp.who(ARRAY['B'], $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c1', 3, 'sneaky')::text$q$));
SELECT pg_temp.ck('K5', 'hidden comment + its history: author and staff only', '^anon=>OK 0\|0;C=>OK 0\|0;B=>OK 1\|1;CM=>OK 1\|1;PA=>OK 1\|1;$',
  pg_temp.who(ARRAY['anon','C','B','CM','PA'], $q$SELECT (SELECT count(*) FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-0000000000c1') || '|' ||
     (SELECT count(*) FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c1')$q$));
SELECT pg_temp.ck('K5b', 'moderator unhides (one audit row); the guard still refuses a member toggling is_hidden',
  '^OK .*"is_hidden": false.*\|\+1;ERR 42501 permission denied for table post_comments$',
  pg_temp.audited('CM', $q$SELECT public.admin_set_comment_hidden('0d000000-0000-4000-8000-0000000000c1', false, 'ok on review')::text$q$)
  || ';' || pg_temp.run('B', $q$UPDATE public.post_comments SET is_hidden = true WHERE id = '0d000000-0000-4000-8000-0000000000c1' RETURNING 'x'$q$));
INSERT INTO public.post_comments (id, post_id, user_id, content, created_at) VALUES
  ('0d000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-a000-000000000002', pg_temp.u('C'), 'parent', now()),
  ('0d000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-a000-000000000002', pg_temp.u('B'), 'reply', now());
UPDATE public.post_comments SET parent_id = '0d000000-0000-4000-8000-0000000000c2' WHERE id = '0d000000-0000-4000-8000-0000000000c3';
SELECT pg_temp.t('K6', 'a comment with a reply has no grace (history recorded)', '"grace": false', 'C',
  $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c2', 1, 'parent (edited)')::text$q$);
SELECT pg_temp.ck('K7', 'no new comment on a HELD post: member, its author and staff all refused (same rule as likes / votes)',
  '^(\w+=>ERR 42501 new row violates row-level security policy "post_comments_insert_post_visible" for table "post_comments";){3}$',
  pg_temp.who(ARRAY['C','A','CM'], $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000001', auth.uid(), 'hi') RETURNING 'x'$q$));
INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES
  ('0d000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-a000-000000000001', pg_temp.u('B'), 'said before the hold');
SELECT pg_temp.ck('K7b', 'a reply to an existing comment on a held post is refused too (author and staff included)',
  '^(\w+=>ERR 42501 new row violates row-level security policy "post_comments_insert_post_visible" for table "post_comments";){3}$',
  pg_temp.who(ARRAY['B','A','CM'], $q$INSERT INTO public.post_comments (post_id, user_id, content, parent_id) VALUES ('00000000-0000-4000-a000-000000000001', auth.uid(), 'reply', '0d000000-0000-4000-8000-0000000000c9') RETURNING 'x'$q$));
-- soft delete of a comment with a reply (P4, visible); the comment has one history row
INSERT INTO public.post_comments (id, post_id, user_id, content, created_at) VALUES
  ('0d000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-a000-000000000004', pg_temp.u('B'), 'parent text', now() - interval '1 hour');
SELECT pg_temp.run('B', $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c5', 1, 'parent text (edited)')::text$q$);
INSERT INTO public.post_comments (id, post_id, user_id, content, parent_id) VALUES
  ('0d000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-a000-000000000004', pg_temp.u('C'), 'a reply', '0d000000-0000-4000-8000-0000000000c5');
SELECT pg_temp.ck('K8a', 'delete_own_comment: another member and a guest are refused', '^C=>ERR 42501 not_author;G=>ERR 42501 guest_refused;$',
  pg_temp.who(ARRAY['C','G'], $q$SELECT public.delete_own_comment('0d000000-0000-4000-8000-0000000000c5')::text$q$));
SELECT pg_temp.t('K8b', 'the author deletes own comment (no audit row is a staff matter: none written)', '^OK \{"deleted": true', 'B',
  $q$SELECT public.delete_own_comment('0d000000-0000-4000-8000-0000000000c5')::text$q$);
SELECT pg_temp.ck('K8c', 'soft delete: the row stays with empty text + deleted_at; the reply keeps its parent; version unchanged', '^t\|\|t\|2\|a reply$',
  (SELECT (c.id IS NOT NULL)::char || '|' || c.content || '|' || (c.deleted_at IS NOT NULL)::char || '|' || c.version || '|' ||
          (SELECT r.content FROM public.post_comments r WHERE r.parent_id = c.id)
   FROM public.post_comments c WHERE c.id = '0d000000-0000-4000-8000-0000000000c5'));
SELECT pg_temp.ck('K8d', 'readers see the deleted placeholder and the reply under it; its history stays readable (rules unchanged)', '^anon=>OK 2\|1\|1;C=>OK 2\|1\|1;$',
  pg_temp.who(ARRAY['anon','C'], $q$SELECT (SELECT count(*) FROM public.post_comments WHERE id IN ('0d000000-0000-4000-8000-0000000000c5','0d000000-0000-4000-8000-0000000000c6')) || '|' ||
     (SELECT count(*) FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-0000000000c5' AND content = '' AND deleted_at IS NOT NULL) || '|' ||
     (SELECT count(*) FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c5')$q$));
SELECT pg_temp.ck('K8e', 'a deleted comment: second delete PT404, edit PT404 comment_deleted; direct DELETE revoked for everyone',
  '^B=>ERR PT404 comment_not_found;B=>ERR PT404 comment_deleted;C=>ERR 42501 permission denied for table post_comments;$',
  pg_temp.who(ARRAY['B'], $q$SELECT public.delete_own_comment('0d000000-0000-4000-8000-0000000000c5')::text$q$)
  || pg_temp.who(ARRAY['B'], $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c5', 2, 'back')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$DELETE FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-0000000000c6' RETURNING 'x'$q$));
SELECT pg_temp.t('K8f', 'a reply can still be added under a deleted comment', '^OK x$', 'A',
  $q$INSERT INTO public.post_comments (post_id, user_id, content, parent_id) VALUES ('00000000-0000-4000-a000-000000000004', auth.uid(), 'late reply', '0d000000-0000-4000-8000-0000000000c5') RETURNING 'x'$q$);
-- account deletion (hard delete cascade) of a commenter keeps other people's replies
INSERT INTO auth.users (id, email) VALUES ('40000000-0000-4000-8000-00000000000a', 'leaver@smoke.test');
INSERT INTO public.profiles (id) VALUES ('40000000-0000-4000-8000-00000000000a') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES
  ('0d000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-a000-000000000004', '40000000-0000-4000-8000-00000000000a', 'leaver comment');
INSERT INTO public.post_comments (id, post_id, user_id, content, parent_id) VALUES
  ('0d000000-0000-4000-8000-0000000000c8', '00000000-0000-4000-a000-000000000004', pg_temp.u('C'), 'reply to leaver', '0d000000-0000-4000-8000-0000000000c7');
DELETE FROM auth.users WHERE id = '40000000-0000-4000-8000-00000000000a';
SELECT pg_temp.ck('K8g', 'account deletion removes the leaver''s comment but keeps the reply (re-rooted, parent_id NULL)', '^0\|reply to leaver\|t$',
  (SELECT count(*) FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-0000000000c7') || '|' ||
  (SELECT content || '|' || (parent_id IS NULL)::char FROM public.post_comments WHERE id = '0d000000-0000-4000-8000-0000000000c8'));
SELECT pg_temp.ck('R9', 'comment history redaction: guest (platform_admin tier) and member refused; author ok; platform admin needs a reason, then one audit row',
  '^G=>ERR 42501 guest_refused;C=>ERR 42501 p3_denied:insufficient_tier;\|OK .*"redactor_role": "author".*\|\+0\|ERR 22023 reason_required.*\|\+0\|OK .*"redactor_role": "platform_admin".*\|\+1$',
  pg_temp.who(ARRAY['G','C'], $q$SELECT public.redact_comment_revision((SELECT id FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c1'))::text$q$)
  || '|' || pg_temp.audited('B', $q$SELECT public.redact_comment_revision((SELECT id FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c1'))::text$q$)
  || '|' || pg_temp.audited('PA', $q$SELECT public.redact_comment_revision((SELECT id FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c2'))::text$q$)
  || '|' || pg_temp.audited('PA', $q$SELECT public.redact_comment_revision((SELECT id FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c2'), 'address')::text$q$));
SELECT pg_temp.ck('R9b', 'redacted comment revision keeps who/when only', '^t\|author$',
  (SELECT (content IS NULL)::char || '|' || redactor_role FROM public.post_comment_revisions WHERE comment_id = '0d000000-0000-4000-8000-0000000000c1'));

-- ===================== N: posts.comment_count = comments neither deleted nor hidden =====================
-- cc(post) = 'posts.comment_count|comments with deleted_at IS NULL AND NOT is_hidden'
CREATE FUNCTION pg_temp.cc(p_post uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT comment_count || '|' || (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p_post AND c.deleted_at IS NULL AND NOT c.is_hidden)
  FROM public.posts WHERE id = p_post
$f$;
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"count post"}')::text$q$);
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"count post 2"}')::text$q$);
CREATE TEMP TABLE nid AS SELECT (SELECT id FROM public.posts WHERE content = 'count post') AS p, (SELECT id FROM public.posts WHERE content = 'count post 2') AS p2;
GRANT SELECT ON nid TO PUBLIC;
-- e1 leaf (B), e2 parent (B), e3 reply to e2 (A), e4 (C), e5 (C)
SELECT pg_temp.run(w, format($q$INSERT INTO public.post_comments (id, post_id, user_id, content, parent_id) VALUES (%L, (SELECT p FROM nid), auth.uid(), %L, %L) RETURNING 'x'$q$, k, txt, par))
FROM (VALUES ('B', '0e000000-0000-4000-8000-0000000000e1', 'leaf', NULL), ('B', '0e000000-0000-4000-8000-0000000000e2', 'parent', NULL),
             ('A', '0e000000-0000-4000-8000-0000000000e3', 'reply', '0e000000-0000-4000-8000-0000000000e2'),
             ('C', '0e000000-0000-4000-8000-0000000000e4', 'to hide', NULL), ('C', '0e000000-0000-4000-8000-0000000000e5', 'hide then delete', NULL)) v(w, k, txt, par)
ORDER BY k;
SELECT pg_temp.ck('N1', 'insert: five member comments (one a reply) -> 5', '^5\|5$', pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.run('B', $q$SELECT public.delete_own_comment('0e000000-0000-4000-8000-0000000000e1')::text$q$);
SELECT pg_temp.ck('N2', 'soft delete of a leaf (no replies) -> 4', '^4\|4$', pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.run('B', $q$SELECT public.delete_own_comment('0e000000-0000-4000-8000-0000000000e2')::text$q$);
SELECT pg_temp.ck('N3', 'soft delete of a parent with a live reply -> 3; the reply stays and still counts', '^3\|3\|reply\|t$',
  pg_temp.cc((SELECT p FROM nid)) || '|' || (SELECT content || '|' || (deleted_at IS NULL)::char FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000e3'));
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000e4', true)::text$q$);
SELECT pg_temp.ck('N4', 'moderator hides a comment -> 2', '^2\|2$', pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000e4', false)::text$q$);
SELECT pg_temp.ck('N5', 'moderator unhides it -> 3', '^3\|3$', pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000e5', true)::text$q$);
SELECT pg_temp.ck('N6a', 'a second comment hidden -> 2', '^2\|2$', pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.run('C', $q$SELECT public.delete_own_comment('0e000000-0000-4000-8000-0000000000e5')::text$q$);
SELECT pg_temp.ck('N6b', 'its author deletes the hidden comment -> still 2', '^2\|2\|t$',
  pg_temp.cc((SELECT p FROM nid)) || '|' || (SELECT (deleted_at IS NOT NULL AND is_hidden)::char FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000e5'));
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000e5', false)::text$q$);
SELECT pg_temp.ck('N6c', 'unhiding a deleted comment does not count it -> still 2', '^2\|2\|f$',
  pg_temp.cc((SELECT p FROM nid)) || '|' || (SELECT is_hidden::char FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000e5'));
SELECT pg_temp.ck('N7', 'un-delete (owner path; no RPC un-deletes) counts the comment again -> 3', '^OK x\|3\|3$',
  pg_temp.pg($q$UPDATE public.post_comments SET deleted_at = NULL, content = 'leaf back' WHERE id = '0e000000-0000-4000-8000-0000000000e1' RETURNING 'x'$q$) || '|' || pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.ck('N8', 'hard delete (owner path; members have no DELETE) of a live comment -> 2', '^OK x\|2\|2$',
  pg_temp.pg($q$DELETE FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000e3' RETURNING 'x'$q$) || '|' || pg_temp.cc((SELECT p FROM nid)));
SELECT pg_temp.ck('N9', 'post_id: no client role may re-point a comment; the owner path recounts both posts (1|1 ; 1|1)', '^ff\|OK x\|1\|1;1\|1$',
  has_column_privilege('authenticated', 'public.post_comments', 'post_id', 'UPDATE')::char || has_column_privilege('anon', 'public.post_comments', 'post_id', 'UPDATE')::char || '|' ||
  pg_temp.pg($q$UPDATE public.post_comments SET post_id = (SELECT p2 FROM nid) WHERE id = '0e000000-0000-4000-8000-0000000000e4' RETURNING 'x'$q$) || '|' ||
  pg_temp.cc((SELECT p FROM nid)) || ';' || pg_temp.cc((SELECT p2 FROM nid)));
-- grace: a comment closes the quiet-edit window for good, even after it is deleted or hidden (count 0)
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"grace deleted comment"}')::text$q$);
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"grace hidden comment"}')::text$q$);
CREATE TEMP TABLE gid AS SELECT (SELECT id FROM public.posts WHERE content = 'grace deleted comment') AS d, (SELECT id FROM public.posts WHERE content = 'grace hidden comment') AS h;
GRANT SELECT ON gid TO PUBLIC;
SELECT pg_temp.run('B', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000f1', (SELECT d FROM gid), auth.uid(), 'only comment') RETURNING 'x'$q$);
SELECT pg_temp.run('B', $q$SELECT public.delete_own_comment('0e000000-0000-4000-8000-0000000000f1')::text$q$);
SELECT pg_temp.run('C', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000f2', (SELECT h FROM gid), auth.uid(), 'only comment') RETURNING 'x'$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000f2', true)::text$q$);
SELECT pg_temp.ck('N10a', 'the only comment deleted / hidden: both posts count 0, fresh and visible', '^0\|0;0\|0\|t\|t$',
  pg_temp.cc((SELECT d FROM gid)) || ';' || pg_temp.cc((SELECT h FROM gid)) || '|' ||
  (SELECT bool_and(created_at > now() - interval '5 minutes' AND NOT is_hidden)::char FROM public.posts WHERE id IN ((SELECT d FROM gid), (SELECT h FROM gid))) || '|' ||
  (SELECT bool_and(like_count = 0)::char FROM public.posts WHERE id IN ((SELECT d FROM gid), (SELECT h FROM gid))));
SELECT pg_temp.t('N10b', 'only comment deleted: the quiet edit stays closed (recorded edit)', '"grace": false', 'A',
  $q$SELECT public.edit_post((SELECT d FROM gid), 1, '{"content":"grace deleted comment!"}')::text$q$);
SELECT pg_temp.t('N10c', 'only comment hidden: the quiet edit stays closed (recorded edit)', '"grace": false', 'A',
  $q$SELECT public.edit_post((SELECT h FROM gid), 1, '{"content":"grace hidden comment!"}')::text$q$);
-- backfill: every post in the database, including rows that existed before 20261026000000
SELECT pg_temp.ck('N11', 'backfill + trigger: 0 posts whose comment_count differs from its live, visible comments (|posts checked)', '^0\|[0-9]+$',
  (SELECT count(*) FILTER (WHERE p.comment_count <> (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND NOT c.is_hidden))
          || '|' || count(*) FROM public.posts p));
SELECT pg_temp.ck('N12', 'counter / marker / lock-order trigger functions: SECURITY DEFINER, pinned search_path, no PUBLIC / anon / authenticated EXECUTE', '^(t\|t\|f\|f\|f;){4}$',
  (SELECT string_agg(p.prosecdef::char || '|' || EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')::char || '|' ||
          EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0)::char || '|' ||
          has_function_privilege('anon', p.oid, 'EXECUTE')::char || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::char || ';', '' ORDER BY p.proname)
   FROM pg_proc p WHERE p.oid IN ('public.sync_post_comment_count()'::regprocedure, 'public.sync_post_like_count()'::regprocedure, 'public.mark_post_engaged()'::regprocedure, 'public.lock_post_for_engagement()'::regprocedure)));

-- ===================== G: grace ends at the first engagement, for good (posts.engaged_at) =====================
SELECT pg_temp.as_(pg_temp.u('A'), false, x) FROM unnest(ARRAY[
  $q$SELECT public.create_post('feed', '{"content":"g quiet"}')::text$q$,
  $q$SELECT public.create_post('feed', '{"content":"g like"}')::text$q$,
  $q$SELECT public.create_post('poll', '{"content":"G poll?","options":["x","y"]}')::text$q$,
  $q$SELECT public.create_post('source_offer', '{"content":"g offer","max_seekers":3}')::text$q$,
  $q$SELECT public.create_post('feed', '{"content":"g sticky"}')::text$q$]) x;
CREATE TEMP TABLE gp AS SELECT content AS k, id FROM public.posts WHERE content IN ('g quiet', 'g like', 'G poll?', 'g offer', 'g sticky');
GRANT SELECT ON gp TO PUBLIC;
CREATE FUNCTION pg_temp.g(k text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM gp WHERE gp.k = $1 $f$;
GRANT EXECUTE ON FUNCTION pg_temp.g(text) TO PUBLIC;
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"g held"}')::text$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT id FROM public.posts WHERE content = 'g held'), 1)::text$q$);
SELECT pg_temp.ck('G1b', 'a held post, fresh and never engaged: the author''s edit is recorded, not quiet', '^t\|t\|OK .*"grace": false',
  (SELECT (is_hidden AND created_at > now() - interval '5 minutes')::char || '|' || (engaged_at IS NULL)::char FROM public.posts WHERE content = 'g held') || '|' ||
  pg_temp.run('A', $q$SELECT public.edit_post((SELECT id FROM public.posts WHERE content = 'g held'), 1, '{"content":"g held!"}')::text$q$));
SELECT pg_temp.ck('G1', 'no engagement: engaged_at NULL and the edit is quiet', '^t\|OK .*"grace": true',
  (SELECT (engaged_at IS NULL)::char FROM public.posts WHERE id = pg_temp.g('g quiet')) || '|' ||
  pg_temp.run('A', $q$SELECT public.edit_post(pg_temp.g('g quiet'), 1, '{"content":"g quiet!"}')::text$q$));
-- like then unlike / vote then unvote / opt-in then withdraw (each as its own statement, then one check reads the result)
SELECT pg_temp.run('B', $q$INSERT INTO public.post_likes (post_id, user_id) VALUES (pg_temp.g('g like'), auth.uid()) RETURNING 'x'$q$);
SELECT pg_temp.run('B', $q$DELETE FROM public.post_likes WHERE post_id = pg_temp.g('g like') AND user_id = auth.uid() RETURNING 'x'$q$);
SELECT pg_temp.run('B', $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) VALUES ((SELECT id FROM public.polls WHERE post_id = pg_temp.g('G poll?')), auth.uid(), 0) RETURNING 'x'$q$);
SELECT pg_temp.run('B', $q$DELETE FROM public.poll_votes WHERE poll_id = (SELECT id FROM public.polls WHERE post_id = pg_temp.g('G poll?')) AND user_id = auth.uid() RETURNING 'x'$q$);
SELECT pg_temp.run('B', $q$SELECT (public.opt_in_to_post(pg_temp.g('g offer'))).status$q$);
SELECT pg_temp.run('B', $q$SELECT public.withdraw_opt_in(pg_temp.g('g offer'))::text$q$);
SELECT pg_temp.ck('G2a', 'after like+unlike, vote+unvote, opt-in+withdraw: no row left, engaged_at kept on all three', '^0\|t;0\|t;0\|t$',
  (SELECT like_count || '|' || (engaged_at IS NOT NULL)::char FROM public.posts WHERE id = pg_temp.g('g like')) || ';' ||
  (SELECT (SELECT count(*) FROM public.poll_votes v JOIN public.polls pl ON pl.id = v.poll_id WHERE pl.post_id = p.id) || '|' || (engaged_at IS NOT NULL)::char FROM public.posts p WHERE id = pg_temp.g('G poll?')) || ';' ||
  (SELECT (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = p.id) || '|' || (engaged_at IS NOT NULL)::char FROM public.posts p WHERE id = pg_temp.g('g offer')));
SELECT pg_temp.t('G2', 'like then unlike within 5 min: the quiet edit stays closed', '"grace": false', 'A',
  $q$SELECT public.edit_post(pg_temp.g('g like'), 1, '{"content":"g like!"}')::text$q$);
SELECT pg_temp.t('G3', 'vote then unvote within 5 min: the quiet edit stays closed', '"grace": false', 'A',
  $q$SELECT public.edit_post(pg_temp.g('G poll?'), 1, '{"content":"G poll changed?"}')::text$q$);
SELECT pg_temp.t('G4', 'opt-in then withdraw (row deleted) within 5 min: the quiet edit stays closed', '"grace": false', 'A',
  $q$SELECT public.edit_post(pg_temp.g('g offer'), 1, '{"content":"g offer!"}')::text$q$);
-- (the only comment deleted / hidden: N10b, N10c)
-- a later like, comment, vote or opt-in never moves engaged_at (set once)
UPDATE public.posts SET engaged_at = '2026-01-01 00:00:00+00' WHERE id IN (pg_temp.g('g sticky'), pg_temp.g('G poll?'), pg_temp.g('g offer'));
SELECT pg_temp.run('B', $q$INSERT INTO public.post_likes (post_id, user_id) VALUES (pg_temp.g('g sticky'), auth.uid()) RETURNING 'x'$q$);
SELECT pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES (pg_temp.g('g sticky'), auth.uid(), 'later') RETURNING 'x'$q$);
SELECT pg_temp.run('C', $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) VALUES ((SELECT id FROM public.polls WHERE post_id = pg_temp.g('G poll?')), auth.uid(), 1) RETURNING 'x'$q$);
SELECT pg_temp.run('C', $q$SELECT (public.opt_in_to_post(pg_temp.g('g offer'))).status$q$);
SELECT pg_temp.ck('G5', 'later like + comment, vote, opt-in: engaged_at unchanged (|engagement landed)', '^3\|1\|1\|1\|1$',
  (SELECT count(*) FILTER (WHERE engaged_at = '2026-01-01 00:00:00+00') FROM public.posts WHERE id IN (pg_temp.g('g sticky'), pg_temp.g('G poll?'), pg_temp.g('g offer'))) || '|' ||
  (SELECT like_count || '|' || comment_count FROM public.posts WHERE id = pg_temp.g('g sticky')) || '|' ||
  (SELECT count(*) FROM public.poll_votes v JOIN public.polls pl ON pl.id = v.poll_id WHERE pl.post_id = pg_temp.g('G poll?')) || '|' ||
  (SELECT count(*) FROM public.resource_opt_ins WHERE post_id = pg_temp.g('g offer')));
SELECT pg_temp.ck('G6', 'clients cannot write engaged_at: author and anon UPDATE refused; no column / table UPDATE or SELECT grant; INSERT only for authenticated between 026 and 0265',
  CASE WHEN pg_temp.contract() THEN '^A=>ERR 42501 permission denied for table posts;anon=>ERR 42501 permission denied for table posts;\|ffff\|ff\|<null>$'
       ELSE '^A=>ERR 42501 permission denied for table posts;anon=>ERR 42501 permission denied for table posts;\|ffff\|ft\|<null>$' END,
  pg_temp.who(ARRAY['A','anon'], $q$UPDATE public.posts SET engaged_at = NULL WHERE id = pg_temp.g('g like') RETURNING 'x'$q$) || '|' ||
  has_column_privilege('anon', 'public.posts', 'engaged_at', 'UPDATE')::char || has_column_privilege('authenticated', 'public.posts', 'engaged_at', 'UPDATE')::char ||
  has_column_privilege('anon', 'public.posts', 'engaged_at', 'SELECT')::char || has_column_privilege('authenticated', 'public.posts', 'engaged_at', 'SELECT')::char || '|' ||
  has_column_privilege('anon', 'public.posts', 'engaged_at', 'INSERT')::char || has_column_privilege('authenticated', 'public.posts', 'engaged_at', 'INSERT')::char || '|' ||
  COALESCE((SELECT array_to_string(attacl, ' ') FROM pg_attribute WHERE attrelid = 'public.posts'::regclass AND attname = 'engaged_at'), '<null>'));
SELECT pg_temp.ck('G7', 'between 026 and 0265 a direct client INSERT may preset engaged_at: it only closes the author''s own grace; after 0265 refused',
  CASE WHEN pg_temp.contract() THEN '^ERR 42501' ELSE '^OK x\|OK .*"grace": false' END,
  pg_temp.run('A', $q$INSERT INTO public.posts (id, user_id, content, engaged_at) VALUES ('0e000000-0000-4000-a000-0000000000a1', auth.uid(), 'preset', now()) RETURNING 'x'$q$)
  || CASE WHEN pg_temp.contract() THEN '' ELSE '|' || pg_temp.run('A', $q$SELECT public.edit_post('0e000000-0000-4000-a000-0000000000a1', 1, '{"content":"preset!"}')::text$q$) END);
-- backfill: every post in the database, including rows that existed before 20261026000000
SELECT pg_temp.ck('G8a', 'backfill + trigger: 0 posts whose like_count differs from its like rows (|posts checked)', '^0\|[0-9]+$',
  (SELECT count(*) FILTER (WHERE p.like_count <> (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id)) || '|' || count(*) FROM public.posts p));
SELECT pg_temp.ck('G8b', 'backfill + triggers: 0 posts with a like, vote, comment or opt-in row and no engaged_at (|engaged posts)', '^0\|[0-9]+$',
  (SELECT count(*) FILTER (WHERE p.engaged_at IS NULL) || '|' || count(*) FROM public.posts p
   WHERE EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = p.id)
      OR EXISTS (SELECT 1 FROM public.poll_votes v JOIN public.polls pl ON pl.id = v.poll_id WHERE pl.post_id = p.id)
      OR EXISTS (SELECT 1 FROM public.post_comments c WHERE c.post_id = p.id)
      OR EXISTS (SELECT 1 FROM public.resource_opt_ins o WHERE o.post_id = p.id)));

-- ===================== D: delete_own_post (soft) =====================
INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0d000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-a000-000000000003', pg_temp.u('C'), 'c on offer');
CREATE TEMP TABLE d0 AS SELECT (SELECT count(*) FROM public.resource_opt_ins WHERE post_id = '00000000-0000-4000-a000-000000000003') oi,
  (SELECT count(*) FROM public.post_comments WHERE post_id = '00000000-0000-4000-a000-000000000003') cm,
  (SELECT count(*) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000003') rv,
  pg_temp.ver('00000000-0000-4000-a000-000000000003') v;
SELECT pg_temp.ck('D5', 'delete refused: other member, guest-author with the platform tier', '^C=>ERR 42501 not_author;G=>ERR 42501 guest_refused;$',
  pg_temp.who(ARRAY['C'], $q$SELECT public.delete_own_post('00000000-0000-4000-a000-000000000003')::text$q$)
  || pg_temp.who(ARRAY['G'], $q$SELECT public.delete_own_post('00000000-0000-4000-a000-000000000008')::text$q$));
SELECT pg_temp.ck('D1', 'author deletes own offer (no audit row)', '^OK .*"deleted": true.*\|\+0$',
  pg_temp.audited('A', $q$SELECT public.delete_own_post('00000000-0000-4000-a000-000000000003')::text$q$));
SELECT pg_temp.ck('D1b', 'soft delete: deleted_at, hidden, author_deleted; opt-ins / comments / history / version preserved', '^t\|true\|author_deleted\|t$',
  (SELECT (deleted_at IS NOT NULL)::char || '|' || is_hidden || '|' || hidden_reason || '|' ||
     ((SELECT count(*) FROM public.resource_opt_ins WHERE post_id = p.id) = d0.oi AND (SELECT count(*) FROM public.post_comments WHERE post_id = p.id) = d0.cm
      AND (SELECT count(*) FROM public.post_revisions WHERE post_id = p.id) = d0.rv AND p.version = d0.v)::char
   FROM public.posts p, d0 WHERE p.id = '00000000-0000-4000-a000-000000000003'));
SELECT pg_temp.ck('D2', 'deleted post: gone for author, anon, member, seeker; every staff tier still sees it', '^anon=>OK 0;A=>OK 0;C=>OK 0;B=>OK 0;CM=>OK 1;RA=>OK 1;PA=>OK 1;$',
  pg_temp.who(ARRAY['anon','A','C','B','CM','RA','PA'], $q$SELECT count(*)::text FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000003'$q$));
SELECT pg_temp.ck('D3', 'ranked_feed_v2 never ranks a deleted post (author, staff); the author still sees own held post',
  '^A=>OK false\|true;PA=>OK false\|true;anon=>OK false\|false;$',
  pg_temp.who(ARRAY['A','PA','anon'], $q$SELECT (bool_or(id = '00000000-0000-4000-a000-000000000003') IS TRUE)::text || '|' || (bool_or(id = '00000000-0000-4000-a000-000000000001') IS TRUE)::text FROM public.ranked_feed_v2(NULL, NULL, 500)$q$));
SELECT pg_temp.ck('D4', 'comments + history of a deleted post: hidden from anon / author / commenter; staff keep both', '^anon=>OK 0\|0;A=>OK 0\|0;C=>OK 0\|0;PA=>OK 1\|[1-9];$',
  pg_temp.who(ARRAY['anon','A','C','PA'], $q$SELECT (SELECT count(*) FROM public.post_comments WHERE post_id = '00000000-0000-4000-a000-000000000003') || '|' || (SELECT count(*) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000003')$q$));
SELECT pg_temp.ck('D5b', 'a deleted post takes nothing: delete again, edit, report, opt-in, new comment (even staff), comment edit',
  '^A=>ERR PT404 post_not_found;A=>ERR PT404 post_not_found;C=>ERR P0001 post not found;B2=>ERR P0001 This post is closed;PA=>ERR 42501 new row violates row-level security policy.*;C=>ERR 42501 comments_closed;$',
  pg_temp.who(ARRAY['A'], $q$SELECT public.delete_own_post('00000000-0000-4000-a000-000000000003')::text$q$)
  || pg_temp.who(ARRAY['A'], $q$SELECT public.edit_post('00000000-0000-4000-a000-000000000003', 4, '{"content":"x"}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.submit_content_report('post', '00000000-0000-4000-a000-000000000003', 'spam')::text$q$)
  || pg_temp.who(ARRAY['B2'], $q$SELECT (public.opt_in_to_post('00000000-0000-4000-a000-000000000003')).status$q$)
  || pg_temp.who(ARRAY['PA'], $q$INSERT INTO public.post_comments (post_id, user_id, content) VALUES ('00000000-0000-4000-a000-000000000003', auth.uid(), 'late') RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.edit_comment('0d000000-0000-4000-8000-0000000000c4', 1, 'edit')::text$q$));
SELECT pg_temp.run('C', $q$SELECT public.create_post('poll', '{"content":"Delete me?","options":["Yes","No"]}')::text$q$);
CREATE TEMP TABLE dpoll AS SELECT pl.id FROM public.polls pl JOIN public.posts p ON p.id = pl.post_id WHERE p.content = 'Delete me?';
GRANT SELECT ON dpoll TO PUBLIC;
SELECT pg_temp.t('D5c0', 'control: the open poll takes a vote before deletion', '^OK x$', 'B2',
  $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) SELECT id, auth.uid(), 0 FROM dpoll RETURNING 'x'$q$);
SELECT pg_temp.run('C', $q$SELECT public.delete_own_post((SELECT id FROM public.posts WHERE content = 'Delete me?'))::text$q$);
SELECT pg_temp.t('D5c', 'a deleted poll takes no votes (its poll id is still known to the voter)', '^ERR 42501 new row violates row-level security policy', 'B',
  $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) SELECT id, auth.uid(), 0 FROM dpoll RETURNING 'x'$q$);
SELECT pg_temp.run('A', $q$SELECT public.delete_own_post('00000000-0000-4000-a000-000000000001')::text$q$);
SELECT pg_temp.ck('D6', 'held then deleted: keeps hold_for_review; moderators cannot authorize or hold it',
  '^hold_for_review\|CM=>ERR PT404 post_deleted;CM=>ERR PT404 post_deleted;$',
  (SELECT hidden_reason FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000001') || '|' ||
  pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post('00000000-0000-4000-a000-000000000001', 3)::text$q$) ||
  pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_hold_post('00000000-0000-4000-a000-000000000001', 3)::text$q$));
SELECT pg_temp.ck('R7c0', 'control: the post to hard-delete has post history and comment history', '^1\|2$',
  (SELECT count(*) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000002') || '|' ||
  (SELECT count(*) FROM public.post_comment_revisions WHERE comment_id IN ('0d000000-0000-4000-8000-0000000000c1', '0d000000-0000-4000-8000-0000000000c2')));
SELECT pg_temp.ck('R7c', 'hard delete of a post with history + comment history (account-deletion cascade) passes the append-only trigger',
  '^OK 00000000-0000-4000-a000-000000000002$',
  pg_temp.pg($q$DELETE FROM public.posts WHERE id = '00000000-0000-4000-a000-000000000002' RETURNING id::text$q$));
SELECT pg_temp.ck('R7d', '... and both histories went with it', '^0\|0$',
  (SELECT count(*) FROM public.post_revisions WHERE post_id = '00000000-0000-4000-a000-000000000002') || '|' ||
  (SELECT count(*) FROM public.post_comment_revisions WHERE comment_id IN ('0d000000-0000-4000-8000-0000000000c1', '0d000000-0000-4000-8000-0000000000c2')));

-- ===================== P: create_post replaces the open INSERT =====================
SELECT pg_temp.t('P1', 'contract: a forged direct INSERT (self-pin, counts) is refused / expand: the deployed client''s plain INSERT still works (new columns default)',
  CASE WHEN pg_temp.contract() THEN '^ERR 42501 permission denied for table posts' ELSE '^OK 1\|0\|<no lang>$' END, 'C',
  CASE WHEN pg_temp.contract()
       THEN $q$INSERT INTO public.posts (user_id, content, is_pinned, like_count) VALUES (auth.uid(), 'forged', true, 999) RETURNING 'x'$q$
       ELSE $q$INSERT INTO public.posts (user_id, content) VALUES (auth.uid(), 'old client post') RETURNING version || '|' || edit_count || '|' || COALESCE(lang, '<no lang>')$q$ END);
-- the deployed client's poll flow is two requests: INSERT the post, then INSERT its polls row
SELECT pg_temp.ck('P1b', 'the deployed client''s poll flow: both requests work under expand, both refused under contract',
  CASE WHEN pg_temp.contract() THEN '^ERR 42501 permission denied for table posts;ERR 42501 permission denied for table polls$' ELSE '^OK poll;OK x$' END,
  pg_temp.run('C', $q$INSERT INTO public.posts (user_id, content, post_type) VALUES (auth.uid(), 'Old client poll?', 'poll') RETURNING post_type::text$q$)
  || ';' || pg_temp.run('C', $q$INSERT INTO public.polls (post_id, question, options) VALUES (COALESCE((SELECT id FROM public.posts WHERE content = 'Old client poll?'), '00000000-0000-4000-a000-000000000009'), 'Old client poll?', '["A","B"]'::jsonb) RETURNING 'x'$q$));
SELECT pg_temp.run('C', $q$SELECT public.create_post('feed', '{"content":"clean"}')::text$q$);
SELECT pg_temp.ck('P2', 'create_post has no path to is_pinned / petition_id / user_id; the created row is clean',
  '^C=>ERR 22023 post_field_not_editable:is_pinned;C=>ERR 22023 post_field_not_editable:petition_id;C=>ERR 22023 post_field_not_editable:user_id;\|false\|0\|0\|t\|1\|t$',
  pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('feed', '{"content":"x","is_pinned":true}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('feed', '{"content":"x","petition_id":"0c000000-0000-4000-8000-000000000006"}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('feed', '{"content":"x","user_id":"a0000000-0000-4000-8000-000000000001"}')::text$q$)
  || '|' || (SELECT p.is_pinned || '|' || p.like_count || '|' || p.comment_count || '|' || (p.created_at = now())::char || '|' || p.version || '|' || (p.user_id = pg_temp.u('C'))::char
             FROM public.posts p WHERE p.content = 'clean'));
SELECT pg_temp.run('C', $q$SELECT public.create_post('poll', '{"content":"Shall we?","options":["Yes","No"],"ends_at":"2031-01-01T00:00:00Z"}')::text$q$);
SELECT pg_temp.ck('P3a', 'poll created atomically with its polls row (question = content, deadline kept)', '^true$',
  (SELECT (pl.question = p.content AND pl.options = '["Yes", "No"]'::jsonb AND pl.ends_at = '2031-01-01T00:00:00Z'::timestamptz)::text
   FROM public.posts p JOIN public.polls pl ON pl.post_id = p.id WHERE p.content = 'Shall we?'));
SELECT pg_temp.ck('P3b', 'invalid poll refused: 1 option / duplicate options / past deadline',
  '^one=>ERR 22023 post_field_invalid:options.*\ndup=>ERR 22023 post_field_invalid:options.*\npast=>ERR 22023 post_field_invalid:ends_at.*\n$',
  pg_temp.each('C', ARRAY['one','dup','past'], $q$SELECT public.create_post('poll', (jsonb_build_object(
     'one', '{"content":"Orphan?","options":["only one"]}'::jsonb, 'dup', '{"content":"Orphan?","options":["Yes","yes "]}'::jsonb,
     'past', '{"content":"Orphan?","options":["a","b"],"ends_at":"2020-01-01T00:00:00Z"}'::jsonb))->%L)::text$q$));
SELECT pg_temp.ck('P3c', '... and leaves no orphan post', '^0$', (SELECT count(*)::text FROM public.posts WHERE content = 'Orphan?'));
SELECT pg_temp.ck('P4', 'create refused: guest, petition, resource_post, resource on a request, unapproved resource, event without start / zone',
  '^G=>ERR 42501 guest_refused;C=>ERR 0A000 post_type_not_creatable:petition;C=>ERR 0A000 post_type_not_creatable:resource_post;C=>ERR 22023 post_field_invalid:resource_id;C=>ERR 22023 post_field_invalid:resource_id;C=>ERR 22023 post_field_required:starts_at \| \{"problems": \{"starts_at": "required"\}\};C=>ERR 22023 post_field_required:time_zone \| \{"problems": \{"time_zone": "required"\}\};$',
  pg_temp.who(ARRAY['G'], $q$SELECT public.create_post('feed', '{"content":"x"}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('petition', '{"content":"x"}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('resource_post', '{"content":"x"}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('seeker_request', '{"content":"x"}', '0f000000-0000-4000-8000-000000000001')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('feed', '{"content":"x"}', '0f000000-0000-4000-8000-000000000002')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('event_post', '{"content":"Picnic","time_zone":"America/New_York"}')::text$q$)
  || pg_temp.who(ARRAY['C'], $q$SELECT public.create_post('event_post', '{"content":"Picnic","starts_at":"2026-11-05T12:00"}')::text$q$));
SELECT pg_temp.t('P4b', 'create: an event missing its zone AND ending before it starts reports both', '^ERR 22023 post_field_required:time_zone \| \{"problems": \{"ends_at": "before_start", "time_zone": "required"\}\}$', 'C',
  $q$SELECT public.create_post('event_post', '{"content":"Picnic","starts_at":"2026-11-05T12:00","ends_at":"2026-11-05T10:00"}')::text$q$);
SELECT pg_temp.run('C', format('SELECT public.create_post(''feed'', %L, NULL, %L)::text', jsonb_build_object('content', 'lang ' || n), l))
FROM (VALUES (1, 'es'), (2, ' HMN '), (3, 'other'), (4, 'tlh'), (5, NULL)) v(n, l);
SELECT pg_temp.ck('P9', 'lang: the client locale is stored (trimmed, lower-cased); other / unknown / missing -> NULL',
  '^es\|hmn\|<null>\|<null>\|<null>$',
  (SELECT string_agg(COALESCE(lang, '<null>'), '|' ORDER BY content) FROM public.posts WHERE content IN ('lang 1','lang 2','lang 3','lang 4','lang 5')));
SELECT pg_temp.t('P9a', 'lang is never editable', '^ERR 22023 post_field_not_editable:lang', 'C',
  $q$SELECT public.edit_post((SELECT id FROM public.posts WHERE content = 'lang 1'), 1, '{"lang":"en"}')::text$q$);
SELECT pg_temp.ck('P9b', 'lang readable by anon; the column refuses a value outside the 14 app locales', '^OK es\|ERR 23514 .*posts_lang_check',
  pg_temp.run('anon', $q$SELECT lang FROM public.posts WHERE content = 'lang 1'$q$) || '|' ||
  pg_temp.pg($q$UPDATE public.posts SET lang = 'xx' WHERE content = 'lang 1' RETURNING 'x'$q$));
SELECT pg_temp.ck('P5', 'contract: polls direct INSERT / UPDATE / DELETE by the author refused (vote-wipe hole closed); expand: still open (P1b)',
  CASE WHEN pg_temp.contract() THEN '^C=>ERR 42501 permission denied for table polls;C=>ERR 42501 permission denied for table polls;C=>ERR 42501 permission denied for table polls;$' ELSE '^expand$' END,
  CASE WHEN NOT pg_temp.contract() THEN 'expand' ELSE
  pg_temp.who(ARRAY['C'], $q$INSERT INTO public.polls (post_id, question, options) SELECT id, 'q', '[]' FROM public.posts WHERE content = 'Shall we?' RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['C'], $q$UPDATE public.polls SET options = '["A","B"]' WHERE question = 'Shall we?' RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['C'], $q$DELETE FROM public.polls WHERE question = 'Shall we?' RETURNING 'x'$q$) END);
SELECT pg_temp.run('C', $q$SELECT public.create_post('event_post', '{"content":"Picnic","starts_at":"2026-11-05T12:00","ends_at":"2026-11-05T14:00","location":"Park","is_online":true,"time_zone":"America/Chicago"}')::text$q$);
SELECT pg_temp.ck('P6', 'member event created with venue zone; online => no location', '^\{"ends_at": "2026-11-05T14:00", "location": null, "is_online": true, "starts_at": "2026-11-05T12:00", "time_zone": "America/Chicago"\}$',
  (SELECT metadata::text FROM public.posts WHERE content = 'Picnic'));
SELECT pg_temp.run('A', $q$SELECT public.create_post('feed', '{"content":"Shared program","max_seekers":4,"image_url":"https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/a0000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.webp","image_alt":"A shelf"}', '0f000000-0000-4000-8000-000000000001')::text$q$);
SELECT pg_temp.ck('P7', 'composer / programs share: feed with approved resource, capacity (slots seeded), own photo + alt', '^feed\|0f000000-0000-4000-8000-000000000001\|4\|4\|t\|A shelf$',
  (SELECT post_type || '|' || resource_id || '|' || max_seekers || '|' || slots_remaining || '|' || (image_url LIKE '%/44444444-%')::char || '|' || image_alt
   FROM public.posts WHERE content = 'Shared program'));
SELECT pg_temp.run('C', $q$SELECT public.create_post('source_offer', '{"content":"Winter coats","categories":["clothing"," childcare "],"max_seekers":5}', '0f000000-0000-4000-8000-000000000001')::text$q$);
SELECT pg_temp.ck('P8', 'offer with categories (trimmed) + resource; request with categories', '^\{"categories": \["clothing", "childcare"\]\}\|5\|5\|OK [0-9a-f-]{36}$',
  (SELECT metadata::text || '|' || max_seekers || '|' || slots_remaining FROM public.posts WHERE content = 'Winter coats')
  || '|' || pg_temp.run('C', $q$SELECT public.create_post('seeker_request', '{"content":"Need a crib","categories":["childcare"]}')::text$q$));

-- ===================== X: moderation integrity =====================
SELECT pg_temp.run('C', $q$SELECT public.create_post('feed', '{"content":"orig"}')::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.create_post('feed', '{"content":"to hold"}')::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.create_post('feed', '{"content":"to remove"}')::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.create_post('feed', '{"content":"crowd hidden"}')::text$q$);
CREATE TEMP TABLE xp AS SELECT (SELECT id FROM public.posts WHERE content = 'orig') x1, (SELECT id FROM public.posts WHERE content = 'to hold') x2,
                               (SELECT id FROM public.posts WHERE content = 'to remove') x3, (SELECT id FROM public.posts WHERE content = 'crowd hidden') x4;
GRANT SELECT ON xp TO PUBLIC;
UPDATE public.posts SET created_at = now() - interval '1 hour' WHERE id IN (SELECT x1 FROM xp UNION SELECT x2 FROM xp UNION SELECT x3 FROM xp UNION SELECT x4 FROM xp);
SELECT pg_temp.run('A', $q$SELECT public.submit_content_report('post', (SELECT x1 FROM xp), 'misinformation')::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.edit_post((SELECT x1 FROM xp), 1, '{"content":"orig (changed after report)"}')::text$q$);
SELECT pg_temp.run('B', $q$SELECT public.submit_content_report('post', (SELECT x1 FROM xp), 'spam')::text$q$);
SELECT pg_temp.ck('X1', 'reports snapshot the version they saw (1 before the edit, 2 after)', '^1,2$',
  (SELECT string_agg(reported_version::text, ',' ORDER BY reported_version) FROM public.content_reports WHERE content_id = (SELECT x1 FROM xp)));
SELECT pg_temp.t('X2', 'moderator reads the reported version''s text from history', '^OK orig$', 'CM',
  $q$SELECT r.snapshot->>'content' FROM public.content_reports c JOIN public.post_revisions r ON r.post_id = c.content_id AND r.version = c.reported_version
     WHERE c.content_id = (SELECT x1 FROM xp) AND c.reported_version = 1$q$);
SELECT pg_temp.ck('R8', 'the author cannot redact the revision an open report points at (evidence kept)', '^C=>ERR 42501 revision_under_report;\|orig$',
  pg_temp.who(ARRAY['C'], $q$SELECT public.redact_post_revision((SELECT id FROM public.post_revisions WHERE post_id = (SELECT x1 FROM xp) AND version = 1))::text$q$)
  || '|' || (SELECT snapshot->>'content' FROM public.post_revisions WHERE post_id = (SELECT x1 FROM xp) AND version = 1));
SELECT pg_temp.run('PA', $q$SELECT public.submit_content_report('post', (SELECT x1 FROM xp), 'spam')::text$q$);
SELECT pg_temp.ck('X3', 'third reporter auto-hides (community_reports_threshold); version untouched', '^true\|community_reports_threshold\|2$',
  (SELECT is_hidden || '|' || hidden_reason || '|' || version FROM public.posts WHERE id = (SELECT x1 FROM xp)));
SELECT pg_temp.ck('X4', 'dismiss at a stale version refused; at the current version the last dismissal lifts the community hide (one audit row each)',
  '^ERR PT409 edit_conflict.*\|\+0;OK .*"unhidden": false.*\|\+1;OK .*"unhidden": false.*\|\+1;OK .*"unhidden": true.*\|\+1$',
  pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT x1 FROM xp) ORDER BY reported_version, reporter_id LIMIT 1), 'dismiss', 1)::text$q$)
  || ';' || pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT x1 FROM xp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 2)::text$q$)
  || ';' || pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT x1 FROM xp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 2)::text$q$)
  || ';' || pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT x1 FROM xp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 2)::text$q$));
SELECT pg_temp.ck('X4b', 'after the last dismissal the community-hidden post is visible again', '^false\|$',
  (SELECT is_hidden || '|' || COALESCE(hidden_reason, '') FROM public.posts WHERE id = (SELECT x1 FROM xp)));
SELECT pg_temp.run('A', $q$SELECT public.submit_content_report('post', (SELECT x2 FROM xp), 'spam')::text$q$);
SELECT pg_temp.run('A', $q$SELECT public.submit_content_report('post', (SELECT x3 FROM xp), 'spam')::text$q$);
SELECT pg_temp.ck('X5a', 'hold and remove: one audit row each, carrying the version', '^OK .*\|\+1;OK .*\|\+1$',
  pg_temp.audited('CM', $q$SELECT public.admin_hold_post((SELECT x2 FROM xp), 1)::text$q$)
  || ';' || pg_temp.audited('CM', $q$SELECT public.admin_remove_post((SELECT x3 FROM xp), 'abuse', 1)::text$q$));
SELECT pg_temp.ck('X5r', 'admin_resolve_report returns the superset {report_id, action, unhidden, needs_review}', '^OK t\|dismiss$',
  (SELECT CASE WHEN r LIKE 'OK %' THEN 'OK ' || (substr(r, 4)::jsonb ?& ARRAY['report_id', 'action', 'unhidden', 'needs_review'])::char || '|' || (substr(r, 4)::jsonb ->> 'action') ELSE r END
   FROM (SELECT pg_temp.run('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT x2 FROM xp)), 'dismiss', 1)::text$q$) AS r) s));
SELECT pg_temp.ck('X5', 'dismissing the only report of a HELD or REMOVED post never un-hides it', '^true\|hold_for_review;true\|admin_removal$',
  (SELECT string_agg(is_hidden || '|' || hidden_reason, ';' ORDER BY content) FROM public.posts WHERE id IN (SELECT x2 FROM xp UNION SELECT x3 FROM xp)));
SELECT pg_temp.run('C', $q$SELECT public.edit_post((SELECT x2 FROM xp), 1, '{"content":"to hold (fixed)"}')::text$q$);
SELECT pg_temp.ck('X6', 'author edit re-queues the held post; approving the unseen version refused; current version accepted',
  '^t\|CM=>ERR PT409 edit_conflict.*;CM=>OK .*;$',
  (SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = (SELECT x2 FROM xp)) || '|'
  || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp), 1)::text$q$)
  || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp), 2)::text$q$));
SELECT pg_temp.ck('X6b', 'approved at the version the moderator saw: visible, review flag cleared, version unchanged', '^false\|f\|2$',
  (SELECT is_hidden || '|' || (needs_review_at IS NOT NULL)::char || '|' || version FROM public.posts WHERE id = (SELECT x2 FROM xp)));
SELECT pg_temp.ck('X7', 'transition: a legacy caller (no version) can still hold and authorize an unedited post', '^CM=>OK.*;CM=>OK.*;$',
  pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_hold_post((SELECT x2 FROM xp))::text$q$)
  || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp))::text$q$));
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT x2 FROM xp), 2)::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.edit_post((SELECT x2 FROM xp), 2, '{"content":"to hold (fixed again)"}')::text$q$);
SELECT pg_temp.ck('X8', 'a legacy caller cannot publish an author edit no moderator has seen (PT409 needs_review); with the version it can',
  '^CM=>ERR PT409 edit_conflict \| .*"needs_review": true.*;\|true\|CM=>OK.*;$',
  pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp))::text$q$)
  || '|' || (SELECT is_hidden FROM public.posts WHERE id = (SELECT x2 FROM xp)) || '|'
  || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp), 3)::text$q$));
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT x2 FROM xp), 3)::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.edit_post((SELECT x2 FROM xp), 3, '{"content":"to hold (third try)"}')::text$q$);
-- (each read below is its own statement: a statement's subqueries see the snapshot taken before its calls)
SELECT pg_temp.ck('X8b1', 'a legacy hold of an edited held post succeeds ...', '^CM=>OK.*;$',
  pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_hold_post((SELECT x2 FROM xp))::text$q$));
SELECT pg_temp.ck('X8b2', '... keeps the review flag, so a legacy authorize is still refused', '^t\|CM=>ERR PT409 edit_conflict.*;$',
  (SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = (SELECT x2 FROM xp))
  || '|' || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp))::text$q$));
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT x2 FROM xp), 4)::text$q$);
SELECT pg_temp.ck('X8b3', 'a versioned hold (the moderator saw version 4) clears the flag; a legacy authorize may then publish', '^f\|CM=>OK.*;$',
  (SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = (SELECT x2 FROM xp))
  || '|' || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT x2 FROM xp))::text$q$));
SELECT pg_temp.ck('X8b4', '... and it is visible', '^false$', (SELECT is_hidden::text FROM public.posts WHERE id = (SELECT x2 FROM xp)));
SELECT pg_temp.run('C', $q$SELECT public.create_post('feed', '{"content":"hold then remove"}')::text$q$);
UPDATE public.posts SET created_at = now() - interval '1 hour' WHERE content = 'hold then remove';
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT id FROM public.posts WHERE content = 'hold then remove'), 1)::text$q$);
SELECT pg_temp.run('C', $q$SELECT public.edit_post((SELECT id FROM public.posts WHERE content = 'hold then remove'), 1, '{"content":"hold then remove (edited)"}')::text$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_remove_post((SELECT id FROM public.posts WHERE content = 'hold then remove (edited)'))::text$q$);
SELECT pg_temp.ck('X8c', 'a legacy remove keeps the review flag: reinstating the unseen edit still needs the version',
  '^removed\|t\|CM=>ERR PT409 edit_conflict.*;CM=>OK.*;$',
  (SELECT CASE hidden_reason WHEN 'admin_removal' THEN 'removed' ELSE hidden_reason END || '|' || (needs_review_at IS NOT NULL)::char FROM public.posts WHERE content = 'hold then remove (edited)')
  || '|' || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT id FROM public.posts WHERE content = 'hold then remove (edited)'))::text$q$)
  || pg_temp.who(ARRAY['CM'], $q$SELECT public.admin_authorize_post((SELECT id FROM public.posts WHERE content = 'hold then remove (edited)'), 2)::text$q$));
-- community-hidden, then edited by its author, then dismissed by a legacy caller
SELECT pg_temp.run(w, $q$SELECT public.submit_content_report('post', (SELECT x4 FROM xp), 'spam')::text$q$) FROM unnest(ARRAY['A','B','B2']) w;
SELECT pg_temp.run('C', $q$SELECT public.edit_post((SELECT x4 FROM xp), 1, '{"content":"crowd hidden (fixed)"}')::text$q$);
SELECT pg_temp.run('CM', format('SELECT public.admin_resolve_report(%L, ''dismiss'')::text', id)) FROM public.content_reports WHERE content_id = (SELECT x4 FROM xp) AND status = 'open';
SELECT pg_temp.ck('X9', 'legacy dismissals of an edited community-hidden post: reports closed, post stays hidden for review', '^0\|true\|community_reports_threshold\|t$',
  (SELECT (SELECT count(*) FROM public.content_reports WHERE content_id = p.id AND status = 'open') || '|' || p.is_hidden || '|' || p.hidden_reason || '|' || (p.needs_review_at IS NOT NULL)::char
   FROM public.posts p WHERE p.id = (SELECT x4 FROM xp)));
SELECT pg_temp.ck('X10', 'moderation RPCs: member and guest-with-platform-tier refused', '^C=>ERR 42501 p3_denied:insufficient_tier;G=>ERR 42501 Anonymous users cannot perform moderation actions;C=>ERR 42501 p3_denied:insufficient_tier;G=>ERR 42501 Account required for this action;$',
  pg_temp.who(ARRAY['C','G'], $q$SELECT public.admin_hold_post((SELECT x1 FROM xp))::text$q$)
  || pg_temp.who(ARRAY['C','G'], $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports LIMIT 1), 'dismiss')::text$q$));

-- ===================== V: no new engagement on a hidden post =====================
SELECT pg_temp.t('V1', 'control: a like on a visible post is accepted', '^OK x$', 'B',
  $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ((SELECT x1 FROM xp), auth.uid()) RETURNING 'x'$q$);
SELECT pg_temp.ck('V2', 'likes refused on removed (its author, a moderator), community-hidden and deleted posts',
  '^C=>ERR 42501 new row violates row-level security policy "post_likes_insert_post_visible" for table "post_likes";CM=>ERR 42501 new row violates row-level security policy "post_likes_insert_post_visible" for table "post_likes";B=>ERR 42501 new row violates row-level security policy "post_likes_insert_post_visible" for table "post_likes";B=>ERR 42501 new row violates row-level security policy "post_likes_insert_post_visible" for table "post_likes";$',
  pg_temp.who(ARRAY['C','CM'], $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ((SELECT x3 FROM xp), auth.uid()) RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['B'], $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ((SELECT x4 FROM xp), auth.uid()) RETURNING 'x'$q$)
  || pg_temp.who(ARRAY['B'], $q$INSERT INTO public.post_likes (post_id, user_id) VALUES ('00000000-0000-4000-a000-000000000003', auth.uid()) RETURNING 'x'$q$));
SELECT pg_temp.run('CM', format('SELECT public.admin_hold_post(%L, %s)::text', (SELECT x1 FROM xp), pg_temp.ver((SELECT x1 FROM xp))));
SELECT pg_temp.t('V3', 'unliking stays allowed after the post is held', '^OK x$', 'B',
  $q$DELETE FROM public.post_likes WHERE post_id = (SELECT x1 FROM xp) AND user_id = auth.uid() RETURNING 'x'$q$);
SELECT pg_temp.run('C', $q$SELECT public.create_post('poll', '{"content":"Held poll?","options":["Yes","No"]}')::text$q$);
CREATE TEMP TABLE hp AS SELECT pl.id AS poll, p.id AS post FROM public.polls pl JOIN public.posts p ON p.id = pl.post_id WHERE p.content = 'Held poll?';
GRANT SELECT ON hp TO PUBLIC;
SELECT pg_temp.t('V4a', 'control: a vote on the visible poll is accepted', '^OK x$', 'B2',
  $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) SELECT poll, auth.uid(), 0 FROM hp RETURNING 'x'$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT post FROM hp), 1)::text$q$);
SELECT pg_temp.ck('V4', 'votes refused on a held poll, even for its author and staff', '^B=>ERR 42501 new row violates row-level security policy.*;C=>ERR 42501 new row violates row-level security policy.*;CM=>ERR 42501 new row violates row-level security policy.*;$',
  pg_temp.who(ARRAY['B','C','CM'], $q$INSERT INTO public.poll_votes (poll_id, user_id, option_index) SELECT poll, auth.uid(), 1 FROM hp RETURNING 'x'$q$));

-- ===================== L: audit ledger =====================
SELECT pg_temp.ck('L1', 'every staff action kind of this migration wrote admin_actions rows',
  '^comment.hide,comment.unhide,comment_revision.redact,post.authorize,post.hold,post.remove,post_revision.redact,report.resolve$',
  (SELECT string_agg(DISTINCT action, ',' ORDER BY action) FROM public.admin_actions
   WHERE action IN ('comment.hide','comment.unhide','comment_revision.redact','post.authorize','post.hold','post.remove','post_revision.redact','report.resolve')));
SELECT pg_temp.ck('L2', 'author-only actions (create, edit, delete, own redaction, comment edit) write no admin_actions rows', '^0$',
  (SELECT count(*)::text FROM public.admin_actions WHERE actor_id IN (pg_temp.u('A'), pg_temp.u('B'), pg_temp.u('C'))));
SELECT pg_temp.ck('L3', 'every post moderation audit row carries the version acted on', '^0$',
  (SELECT count(*)::text FROM public.admin_actions WHERE action IN ('post.hold','post.remove','post.authorize') AND NOT (details ? 'version')));

-- ===================== W: comment INSERT columns (column-scoped grant) =====================
SELECT pg_temp.as_(pg_temp.u('A'), false, $q$SELECT public.create_post('feed', '{"content":"w post"}')::text$q$);
SELECT pg_temp.ck('W1', 'a member cannot set created_at on a new comment (would keep grace open for good)', '^ERR 42501 permission denied for table post_comments',
  pg_temp.run('B', $q$INSERT INTO public.post_comments (post_id, user_id, content, created_at) VALUES ((SELECT id FROM public.posts WHERE content = 'w post'), auth.uid(), 'forged', '2099-01-01') RETURNING 'x'$q$));
SELECT pg_temp.ck('W2', 'a member cannot set version / edit_count / edited_at (fake "Edited")', '^ERR 42501 permission denied for table post_comments',
  pg_temp.run('B', $q$INSERT INTO public.post_comments (post_id, user_id, content, version, edit_count, edited_at) VALUES ((SELECT id FROM public.posts WHERE content = 'w post'), auth.uid(), 'forged', 5, 4, now()) RETURNING 'x'$q$));
SELECT pg_temp.run('B', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000c1', (SELECT id FROM public.posts WHERE content = 'w post'), auth.uid(), 'normal') RETURNING 'x'$q$);
SELECT pg_temp.ck('W3', 'the client''s inserts still work: a comment (post_id, user_id, content) and a reply (+ parent_id); defaults applied',
  '^OK x\|t\|1\|0\|t$',
  pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content, parent_id) VALUES ((SELECT id FROM public.posts WHERE content = 'w post'), auth.uid(), 'reply', '0e000000-0000-4000-8000-0000000000c1') RETURNING 'x'$q$) || '|' ||
  (SELECT (created_at = now())::char || '|' || version || '|' || edit_count || '|' || (edited_at IS NULL)::char FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000c1'));
SELECT pg_temp.ck('W4', 'comment INSERT: anon none; authenticated only id, post_id, user_id, content, parent_id',
  '^f\|id,post_id,user_id,content,parent_id$',
  has_table_privilege('anon', 'public.post_comments', 'INSERT')::char || '|' ||
  (SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.post_comments'::regclass AND attnum > 0 AND NOT attisdropped
     AND has_column_privilege('authenticated', 'public.post_comments', attname, 'INSERT')));

-- ===================== S: per-viewer visibility; reads survive a client REVOKE of profiles.is_staff (Settings C2) =====================
SELECT pg_temp.as_(pg_temp.u('A'), false, x) FROM unnest(ARRAY[
  $q$SELECT public.create_post('feed', '{"content":"vis visible"}')::text$q$,
  $q$SELECT public.create_post('feed', '{"content":"vis held"}')::text$q$,
  $q$SELECT public.create_post('feed', '{"content":"vis deleted"}')::text$q$]) x;
SELECT pg_temp.run('CM', $q$SELECT public.admin_hold_post((SELECT id FROM public.posts WHERE content = 'vis held'), 1)::text$q$);
SELECT pg_temp.run('A', $q$SELECT public.delete_own_post((SELECT id FROM public.posts WHERE content = 'vis deleted'))::text$q$);
SELECT pg_temp.run('C', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000b1', (SELECT id FROM public.posts WHERE content = 'vis visible'), auth.uid(), 'vis ok') RETURNING 'x'$q$);
SELECT pg_temp.run('B', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000b2', (SELECT id FROM public.posts WHERE content = 'vis visible'), auth.uid(), 'vis hidden') RETURNING 'x'$q$);
SELECT pg_temp.run('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000b2', true)::text$q$);
CREATE FUNCTION pg_temp.vis() RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.who(ARRAY['anon','C','A','B','CM','PA','G'],
    $q$SELECT (SELECT count(*) FROM public.posts WHERE content IN ('vis visible', 'vis held', 'vis deleted')) || '|' ||
              (SELECT count(*) FROM public.post_comments WHERE id IN ('0e000000-0000-4000-8000-0000000000b1', '0e000000-0000-4000-8000-0000000000b2'))$q$)
$f$;
-- posts (visible, held, deleted) | comments (visible, hidden): anon / member see visible rows; the post author also
-- their held post; the hidden comment's author also that comment; staff (CM, PA, and the guest that holds a tier) all
SELECT pg_temp.ck('S1', 'per-viewer visibility of posts | comments', '^anon=>OK 1\|1;C=>OK 1\|1;A=>OK 2\|1;B=>OK 1\|2;CM=>OK 3\|2;PA=>OK 3\|2;G=>OK 3\|2;$', pg_temp.vis());
-- reports: C and B each report A's visible post; a member reads only their own report, staff read all
SELECT pg_temp.run(w, $q$SELECT public.submit_content_report('post', (SELECT id FROM public.posts WHERE content = 'vis visible'), 'spam')::text$q$) FROM unnest(ARRAY['C','B']) w;
CREATE FUNCTION pg_temp.rvis() RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.who(ARRAY['anon','C','B','A','CM','PA','G'],
    $q$SELECT count(*)::text FROM public.content_reports WHERE content_id = (SELECT id FROM public.posts WHERE content = 'vis visible')$q$)
$f$;
SELECT pg_temp.ck('S1b', 'per-viewer visibility of reports: anon none (no policy), a member their own, the reported author none, staff all', '^anon=>OK 0;C=>OK 1;B=>OK 1;A=>OK 0;CM=>OK 2;PA=>OK 2;G=>OK 2;$', pg_temp.rvis());
REVOKE SELECT (is_staff) ON public.profiles FROM anon, authenticated;
SELECT pg_temp.ck('S2', 'simulated Settings C2 in force: clients can no longer read profiles.is_staff', '^anon=>ERR 42501 [^;]*;C=>ERR 42501 [^;]*;$',
  pg_temp.who(ARRAY['anon','C'], $q$SELECT is_staff::text FROM public.profiles LIMIT 1$q$));
SELECT pg_temp.ck('S3', 'under simulated C2 the same per-viewer visibility (no read fails)', '^anon=>OK 1\|1;C=>OK 1\|1;A=>OK 2\|1;B=>OK 1\|2;CM=>OK 3\|2;PA=>OK 3\|2;G=>OK 3\|2;$', pg_temp.vis());
SELECT pg_temp.ck('S4', 'under simulated C2 the same per-viewer visibility of reports (staff read all, a member their own)', '^anon=>OK 0;C=>OK 1;B=>OK 1;A=>OK 0;CM=>OK 2;PA=>OK 2;G=>OK 2;$', pg_temp.rvis());
SELECT pg_temp.ck('S5', 'under simulated C2 a member still comments and replies (the is_hidden guard reads no profiles column)', '^OK x\|OK x$',
  pg_temp.run('B', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000b3', (SELECT id FROM public.posts WHERE content = 'vis visible'), auth.uid(), 'under c2') RETURNING 'x'$q$) || '|' ||
  pg_temp.run('C', $q$INSERT INTO public.post_comments (post_id, user_id, content, parent_id) VALUES ((SELECT id FROM public.posts WHERE content = 'vis visible'), auth.uid(), 'reply under c2', '0e000000-0000-4000-8000-0000000000b3') RETURNING 'x'$q$));
-- the is_hidden guard is defense in depth beneath the column grant (clients cannot insert is_hidden or update comments):
-- loosen the grant for this check only, still under the simulated C2, and the guard must still decide
GRANT INSERT (is_hidden) ON public.post_comments TO authenticated;
SELECT pg_temp.ck('S6', 'guard beneath the grant: with INSERT(is_hidden) granted for the test, a member''s hidden comment is refused, a moderator''s is allowed (under C2)',
  '^C=>ERR 42501 guard:post_comments_is_hidden[^;]*;CM=>OK x;$',
  pg_temp.who(ARRAY['C','CM'], $q$INSERT INTO public.post_comments (post_id, user_id, content, is_hidden) VALUES ((SELECT id FROM public.posts WHERE content = 'vis visible'), auth.uid(), 'guard test', true) RETURNING 'x'$q$));
REVOKE INSERT (is_hidden) ON public.post_comments FROM authenticated;
GRANT SELECT (is_staff) ON public.profiles TO anon, authenticated;

-- ===================== Y: no one lifts or clears moderation on their own content =====================
-- refused: authorize, resolving a report (dismiss or uphold), unhiding a comment (42501 self_moderation_refused,
-- no audit row); allowed: hold / hide of one's own content; another moderator or a platform admin clears it
SELECT pg_temp.as_(pg_temp.u(w), false, format('SELECT public.create_post(''feed'', %L)::text', jsonb_build_object('content', c)))
FROM (VALUES ('CM', 'y own'), ('CM', 'y own reports'), ('CM', 'y own hold'), ('PA', 'y pa own'), ('PA', 'y pa reports'),
             ('CM', 'y own edited hold'), ('CM', 'y own edited remove'), ('CM', 'y own removed')) v(w, c);
CREATE TEMP TABLE yp AS SELECT (SELECT id FROM public.posts WHERE content = 'y own') a, (SELECT id FROM public.posts WHERE content = 'y own reports') r,
  (SELECT id FROM public.posts WHERE content = 'y own hold') h, (SELECT id FROM public.posts WHERE content = 'y pa own') pa,
  (SELECT id FROM public.posts WHERE content = 'y pa reports') pr, (SELECT id FROM public.posts WHERE content = 'y own edited hold') eh,
  (SELECT id FROM public.posts WHERE content = 'y own edited remove') er, (SELECT id FROM public.posts WHERE content = 'y own removed') rm;
GRANT SELECT ON yp TO PUBLIC;
SELECT pg_temp.run(w, format('SELECT public.submit_content_report(''post'', %L, ''spam'')::text', x))
FROM unnest(ARRAY['B','C','B2']) w, (SELECT a AS x FROM yp UNION ALL SELECT r FROM yp UNION ALL SELECT pr FROM yp
                                     UNION ALL SELECT eh FROM yp UNION ALL SELECT er FROM yp) t;
-- fresh(q): read state AFTER calls made earlier in the same check (an inline subquery sees the check's start snapshot)
CREATE FUNCTION pg_temp.fresh(q text) RETURNS text LANGUAGE plpgsql AS $f$ DECLARE r text; BEGIN EXECUTE q INTO r; RETURN r; END $f$;
CREATE FUNCTION pg_temp.ystate(p_post uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT is_hidden || '|' || (SELECT count(*) FROM public.content_reports WHERE content_id = p_post AND status = 'open') FROM public.posts WHERE id = p_post
$f$;
SELECT pg_temp.ck('Y1', 'a community moderator''s two posts, each hidden by three member reports', '^true\|3;true\|3$',
  pg_temp.ystate((SELECT a FROM yp)) || ';' || pg_temp.ystate((SELECT r FROM yp)));
SELECT pg_temp.ck('Y2', 'the author-moderator cannot authorize their own post (versioned or legacy); nothing changes, no audit row',
  '^ERR 42501 self_moderation_refused\|\+0;ERR 42501 self_moderation_refused\|\+0\|true\|3$',
  pg_temp.audited('CM', $q$SELECT public.admin_authorize_post((SELECT a FROM yp), 1)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_authorize_post((SELECT a FROM yp))::text$q$) || '|' || pg_temp.ystate((SELECT a FROM yp)));
SELECT pg_temp.ck('Y3', 'a platform admin authorizes it: visible, every open report dismissed, one audit row', '^OK .*\|\+1\|false\|0$',
  pg_temp.audited('PA', $q$SELECT public.admin_authorize_post((SELECT a FROM yp), 1)::text$q$) || '|' || pg_temp.ystate((SELECT a FROM yp)));
SELECT pg_temp.ck('Y4', 'the author cannot resolve reports on their own post: CM dismiss (versioned, legacy) and uphold refused; a platform admin on their own post too',
  '^ERR 42501 self_moderation_refused\|\+0;ERR 42501 self_moderation_refused\|\+0;ERR 42501 self_moderation_refused\|\+0\|true\|3;PA=>ERR 42501 self_moderation_refused\|\+0;PA=>ERR 42501 self_moderation_refused\|\+0\|true\|3$',
  pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT r FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 1)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT r FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss')::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT r FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'uphold', 1)::text$q$) || '|' ||
  pg_temp.ystate((SELECT r FROM yp)) || ';PA=>' ||
  pg_temp.audited('PA', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT pr FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 1)::text$q$) || ';PA=>' ||
  pg_temp.audited('PA', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT pr FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'uphold')::text$q$) || '|' ||
  pg_temp.ystate((SELECT pr FROM yp)));
SELECT pg_temp.ck('Y5', 'a platform admin dismisses the three reports (versioned, then legacy): the last lifts the community hide',
  '^OK .*\|\+1;OK .*\|\+1;OK .*"unhidden": true.*\|\+1\|false\|0$',
  pg_temp.audited('PA', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT r FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 1)::text$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT r FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss')::text$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.admin_resolve_report((SELECT id FROM public.content_reports WHERE content_id = (SELECT r FROM yp) AND status = 'open' ORDER BY reporter_id LIMIT 1), 'dismiss', 1)::text$q$) || '|' ||
  pg_temp.ystate((SELECT r FROM yp)));
SELECT pg_temp.run('CM', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000d1', (SELECT id FROM public.posts WHERE content = 'w post'), auth.uid(), 'cm own comment') RETURNING 'x'$q$);
SELECT pg_temp.run('PA', $q$INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES ('0e000000-0000-4000-8000-0000000000d2', (SELECT id FROM public.posts WHERE content = 'w post'), auth.uid(), 'pa own comment') RETURNING 'x'$q$);
SELECT pg_temp.ck('Y6', 'own comment: the moderator may hide it, may not unhide it (no audit row); a platform admin unhides it; a platform admin''s own comment the same way round',
  '^OK .*"is_hidden": true.*\|\+1;ERR 42501 self_moderation_refused\|\+0;OK .*"is_hidden": false.*\|\+1\|false;PA=>OK .*"is_hidden": true.*\|\+1;PA=>ERR 42501 self_moderation_refused\|\+0;CM=>OK .*"is_hidden": false.*\|\+1\|false$',
  pg_temp.audited('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000d1', true)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000d1', false)::text$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000d1', false)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::text FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000d1'$q$) || ';PA=>' ||
  pg_temp.audited('PA', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000d2', true)::text$q$) || ';PA=>' ||
  pg_temp.audited('PA', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000d2', false)::text$q$) || ';CM=>' ||
  pg_temp.audited('CM', $q$SELECT public.admin_set_comment_hidden('0e000000-0000-4000-8000-0000000000d2', false)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::text FROM public.post_comments WHERE id = '0e000000-0000-4000-8000-0000000000d2'$q$));
SELECT pg_temp.ck('Y7', 'own post: the moderator may hold it; may not authorize it back (versioned or legacy); a platform admin can',
  '^OK .*\|\+1;ERR 42501 self_moderation_refused\|\+0;ERR 42501 self_moderation_refused\|\+0;OK .*\|\+1\|false$',
  pg_temp.audited('CM', $q$SELECT public.admin_hold_post((SELECT h FROM yp), 1)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_authorize_post((SELECT h FROM yp), 1)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_authorize_post((SELECT h FROM yp))::text$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.admin_authorize_post((SELECT h FROM yp), 1)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::text FROM public.posts WHERE id = (SELECT h FROM yp)$q$));
SELECT pg_temp.ck('Y8', 'platform admins are included: a platform admin holds their own post, cannot authorize it; a community moderator can',
  '^OK .*\|\+1;ERR 42501 self_moderation_refused\|\+0;OK .*\|\+1\|false$',
  pg_temp.audited('PA', $q$SELECT public.admin_hold_post((SELECT pa FROM yp), 1)::text$q$) || ';' ||
  pg_temp.audited('PA', $q$SELECT public.admin_authorize_post((SELECT pa FROM yp), 1)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_authorize_post((SELECT pa FROM yp), 1)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT is_hidden::text FROM public.posts WHERE id = (SELECT pa FROM yp)$q$));

-- one's own hold / removal never clears the review flag; one's own removed post cannot be held (would make it editable)
SELECT pg_temp.run('CM', format('SELECT public.edit_post(%L, 1, %L)::text', x, '{"content":"edited while hidden"}')) FROM (SELECT eh AS x FROM yp UNION ALL SELECT er FROM yp) t;
SELECT pg_temp.ck('Y9a', 'the CM''s two own posts: hidden by reports, then edited by the CM (version 2, needs_review)', '^community_reports_threshold\|2\|t;community_reports_threshold\|2\|t$',
  (SELECT string_agg(hidden_reason || '|' || version || '|' || (needs_review_at IS NOT NULL)::char, ';' ORDER BY content) FROM public.posts WHERE id IN ((SELECT eh FROM yp), (SELECT er FROM yp))));
SELECT pg_temp.ck('Y9', 'a self-hold / self-remove WITH the version keeps needs_review; a platform admin''s legacy authorize then gets PT409',
  '^OK .*\|\+1\|t;PA=>ERR PT409 edit_conflict.*"needs_review": true.*;\|OK .*\|\+1\|t;PA=>ERR PT409 edit_conflict.*"needs_review": true.*;$',
  pg_temp.audited('CM', $q$SELECT public.admin_hold_post((SELECT eh FROM yp), 2)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = (SELECT eh FROM yp)$q$) || ';' ||
  pg_temp.who(ARRAY['PA'], $q$SELECT public.admin_authorize_post((SELECT eh FROM yp))::text$q$) || '|' ||
  pg_temp.audited('CM', $q$SELECT public.admin_remove_post((SELECT er FROM yp), 'self', 2)::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT (needs_review_at IS NOT NULL)::char FROM public.posts WHERE id = (SELECT er FROM yp)$q$) || ';' ||
  pg_temp.who(ARRAY['PA'], $q$SELECT public.admin_authorize_post((SELECT er FROM yp))::text$q$));
SELECT pg_temp.ck('Y10a', 'a platform admin removes the CM''s post (one audit row)', '^OK .*\|\+1$',
  pg_temp.audited('PA', $q$SELECT public.admin_remove_post((SELECT rm FROM yp), 'abuse', 1)::text$q$));
SELECT pg_temp.ck('Y10', 'the CM''s self-hold of their removed post is refused (versioned and legacy, no audit row); it stays removed; the CM''s edit gets post_removed',
  '^ERR 42501 self_moderation_refused\|\+0;ERR 42501 self_moderation_refused\|\+0\|admin_removal;ERR 42501 post_removed',
  pg_temp.audited('CM', $q$SELECT public.admin_hold_post((SELECT rm FROM yp), 1)::text$q$) || ';' ||
  pg_temp.audited('CM', $q$SELECT public.admin_hold_post((SELECT rm FROM yp))::text$q$) || '|' ||
  pg_temp.fresh($q$SELECT hidden_reason FROM public.posts WHERE id = (SELECT rm FROM yp)$q$) || ';' ||
  pg_temp.run('CM', $q$SELECT public.edit_post((SELECT rm FROM yp), 1, '{"content":"back again"}')::text$q$));

-- ===================== F: feed delivery =====================
SELECT pg_temp.t('F1', 'anon hydration select of the public new columns (column grants)', '^OK', 'anon',
  $q$SELECT count(*)::text FROM (SELECT id, version, edited_at, edit_count, image_alt FROM public.posts) x$q$);
SELECT pg_temp.t('F1b', 'anon cannot select the moderation columns', '^ERR 42501 permission denied for table posts', 'anon',
  $q$SELECT count(*)::text FROM (SELECT id, deleted_at FROM public.posts) x$q$);
SELECT pg_temp.ck('F2', 'ranked_feed_v2 still returns ids only', '^TABLE\(id uuid, kind text, score real, distance_bucket text\)$',
  pg_get_function_result('public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'::regprocedure));
SELECT pg_temp.ck('F3', 'ranked_feed (v1) is gone; v2 runs for anon', '^t\|OK [1-9]',
  (to_regprocedure('public.ranked_feed(double precision,double precision,integer,real,uuid)') IS NULL)::char || '|' ||
  pg_temp.run('anon', $q$SELECT count(*)::text FROM public.ranked_feed_v2(NULL, NULL, 50)$q$));

-- ===================== Q: hygiene =====================
SELECT pg_temp.ck('Q1', 'every SECDEF fn of this migration: pinned search_path, no PUBLIC / anon EXECUTE', '^0\|12$',
  (SELECT count(*) FILTER (WHERE p.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
                             OR has_function_privilege('anon', p.oid, 'EXECUTE')
                             OR EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0)) || '|' || count(*)
   FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
     AND p.proname IN ('create_post','edit_post','delete_own_post','redact_post_revision','redact_comment_revision','edit_comment',
                       'delete_own_comment','admin_set_comment_hidden','admin_hold_post','admin_remove_post','admin_authorize_post','admin_resolve_report')));
SELECT pg_temp.ck('Q1b', 'internal helpers: no client EXECUTE; RLS helpers executable by the roles their policies name', '^ffffffffff\|tttttt$',
  (SELECT string_agg(has_function_privilege(r, f::regprocedure, 'EXECUTE')::char, '' ORDER BY f, r)
   FROM unnest(ARRAY['public.post_revisions_append_only()','public.post_image_url_ok(text,uuid)','public.post_normalize_fields(post_type,uuid,jsonb)','public.post_lock_for_moderation(uuid,integer,boolean)','public.post_assert_event(jsonb)']) f,
        unnest(ARRAY['anon','authenticated']) r) || '|' ||
  (SELECT string_agg(has_function_privilege(r, f::regprocedure, 'EXECUTE')::char, '' ORDER BY f, r)
   FROM (VALUES ('public.post_is_readable(uuid)','anon'), ('public.post_is_readable(uuid)','authenticated'), ('public.comment_is_readable(uuid)','anon'),
                ('public.comment_is_readable(uuid)','authenticated'), ('public.poll_is_open(uuid)','authenticated'),
                ('public.post_accepts_engagement(uuid)','authenticated')) v(f, r)));
SELECT pg_temp.ck('Q1c', 'SECURITY INVOKER for every helper an RLS policy calls', '^0$',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef
     AND proname IN ('post_is_readable','comment_is_readable','poll_is_open','post_accepts_engagement','post_lock_for_moderation','post_normalize_fields','post_image_url_ok','post_assert_event')));
SELECT pg_temp.ck('Q1d', 'post_is_live retired (comments use post_accepts_engagement)', '^t$', (to_regprocedure('public.post_is_live(uuid)') IS NULL)::char);
SELECT pg_temp.ck('Q2', 'no function of this migration reads or returns profile display columns', '^0$',
  (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('create_post','edit_post','delete_own_post','redact_post_revision','redact_comment_revision','edit_comment',
       'delete_own_comment','post_accepts_engagement','admin_set_comment_hidden','admin_hold_post','admin_remove_post','admin_authorize_post','admin_resolve_report',
       'post_normalize_fields','post_image_url_ok','post_lock_for_moderation','post_is_readable','comment_is_readable','poll_is_open',
       'opt_in_to_post','submit_content_report','ranked_feed_v2')
     AND (p.prosrc ~ '\m(avatar_url|username|bio|first_name|full_name|last_name)\M'
          OR pg_get_function_result(p.oid) ~ '(avatar_url|username|bio|first_name|full_name)')));
SELECT pg_temp.ck('Q3', 'new tables: RLS on + a SELECT policy; no client write grant', '^2\|0$',
  (SELECT count(*) FILTER (WHERE c.relrowsecurity AND EXISTS (SELECT 1 FROM pg_policy po WHERE po.polrelid = c.oid AND po.polcmd = 'r')) || '|' ||
          count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE')
                                 OR has_table_privilege('authenticated', c.oid, 'DELETE') OR has_table_privilege('anon', c.oid, 'INSERT')
                                 OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE'))
   FROM pg_class c WHERE c.oid IN ('public.post_revisions'::regclass, 'public.post_comment_revisions'::regclass)));
SELECT pg_temp.ck('Q4', 'realtime: posts column list = the 18 previous columns + the 6 new; the other signal members unchanged',
  '^poll_votes:id,poll_id\|post_comments:id,post_id\|posts:id,user_id,content,image_url,is_pinned,is_hidden,created_at,updated_at,resource_id,max_seekers,slots_remaining,post_type,petition_id,hidden_at,hidden_reason,metadata,like_count,comment_count,version,edited_at,edit_count,image_alt,deleted_at,needs_review_at$',
  (SELECT string_agg(tablename || ':' || array_to_string(attnames, ','), '|' ORDER BY tablename) FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename IN ('posts', 'poll_votes', 'post_comments')));
SELECT pg_temp.ck('Q4b', 'revision id sequences: no anon / authenticated USAGE, SELECT or UPDATE', '^ffffffffffff$',
  (SELECT string_agg(has_sequence_privilege(r, sq, pr)::char, '' ORDER BY sq, r, pr)
   FROM unnest(ARRAY['public.post_revisions_id_seq', 'public.post_comment_revisions_id_seq']) sq, unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) pr));
SELECT pg_temp.ck('Q5', 'named author FKs kept (posts_user_id_fkey, post_comments_user_id_fkey)', '^2$',
  (SELECT count(*)::text FROM pg_constraint WHERE conname IN ('posts_user_id_fkey', 'post_comments_user_id_fkey') AND contype = 'f'));
SELECT pg_temp.ck('Q6', 'ledger rows: 026 always; 0265 exactly when contracted', CASE WHEN pg_temp.contract() THEN '^1\|1$' ELSE '^1\|0$' END,
  (SELECT count(*) FILTER (WHERE version = '20261026000000') || '|' || count(*) FILTER (WHERE version = '20261026500000')
   FROM supabase_migrations.schema_migrations));
SELECT pg_temp.ck('Q7', 'exactly one signature per moderation RPC (no PostgREST overload)', '^1,1,1,1$',
  (SELECT string_agg(n::text, ',' ORDER BY proname) FROM (SELECT proname, count(*) n FROM pg_proc WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('admin_hold_post','admin_remove_post','admin_authorize_post','admin_resolve_report') GROUP BY proname) s));

-- ---------------------------------------------------------------------------------------------
\pset pager off
SELECT id, what, expect, got FROM res WHERE NOT ok ORDER BY n;
DO $verdict$
DECLARE v_fail text := (SELECT string_agg(id, ', ' ORDER BY n) FROM res WHERE NOT ok);
BEGIN
  ASSERT v_fail IS NULL, 'FAIL posts_editing smoke: ' || v_fail;
  RAISE NOTICE 'PASS posts_editing smoke: % checks', (SELECT count(*) FROM res);
END
$verdict$;

ROLLBACK;
