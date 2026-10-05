-- org_admin_save.smoke.sql
-- Behavioural smoke for the admin organizations redesign:
--   20261017000000_org_admin_save.sql          (admin_save_organization, businesses_in_bounds)
--   20261018000000_org_photos_and_guest_block.sql (org-photos bucket, can_manage_org_photos,
--                                                  storage.objects manager policies)
-- The guest write block is covered in p4b_organizations.smoke.sql; the map is_active leak in
-- p4a_local_business.smoke.sql.
--
-- Run against a database that ALREADY has both migrations applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/org_admin_save.smoke.sql
--   -- or via the Management API SQL endpoint (single request; it wraps one txn).
--
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. A failed ASSERT aborts
-- the transaction with the failing message. Reaching the final NOTICE means every invariant
-- held. Portable: it discovers an is_admin actor, a plain member and resources at runtime and
-- SKIPs (with a loud NOTICE) when the fixtures are absent. Calls run as `authenticated` /
-- `anon` (the grant + RLS surface); verification reads run as the connection superuser.
--
-- Lock safety: lock_timeout 2s for the whole transaction. S7 creates a trigger on
-- public.organizations (ShareRowExclusive until ROLLBACK), so it runs ONLY on a local/ephemeral
-- database that opts in with `SET feed.smoke_local = on` (or PGOPTIONS='-c feed.smoke_local=on');
-- elsewhere it is skipped with a NOTICE.

BEGIN;
SET LOCAL lock_timeout = '2s';

-- PostGIS lives in the extensions schema. LOCAL => reverts on ROLLBACK.
SET LOCAL search_path TO public, extensions, pg_temp;

-- Snapshot of an org row + every child table, for "nothing persisted" checks.
CREATE FUNCTION pg_temp.org_snap(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws(' | ',
    (SELECT row_to_json(o)::text FROM public.organizations o WHERE o.id = p),
    (SELECT string_agg(row_to_json(h)::text, ',' ORDER BY h.id) FROM public.business_hours h WHERE h.org_id = p),
    (SELECT string_agg(row_to_json(f)::text, ',' ORDER BY f.id) FROM public.business_photos f WHERE f.org_id = p),
    (SELECT string_agg(row_to_json(s)::text, ',' ORDER BY s.id) FROM public.business_services s WHERE s.org_id = p),
    (SELECT string_agg(row_to_json(r)::text, ',' ORDER BY r.resource_id) FROM public.org_resources r WHERE r.org_id = p));
$$;

DO $smoke$
DECLARE
  c_base   constant text := 'https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/org-photos/';
  v_admin  uuid := (SELECT id FROM public.profiles WHERE is_admin = true ORDER BY id LIMIT 1);
  v_member uuid := (SELECT id FROM public.profiles WHERE is_admin IS NOT TRUE ORDER BY id LIMIT 1);
  v_res    uuid[] := ARRAY(SELECT id FROM public.resources WHERE status = 'approved' ORDER BY id LIMIT 3);
  v_res_pending uuid := (SELECT id FROM public.resources WHERE status <> 'approved' ORDER BY id LIMIT 1);
  v_comm   uuid := gen_random_uuid();
  v_biz    uuid := gen_random_uuid();
  v_new    uuid := gen_random_uuid();
  v_mbiz   uuid;   -- business submitted by v_member
  v_mcomm  uuid;   -- non-business row with submitted_by = v_member
  v_obiz   uuid;   -- business submitted by nobody
  v_logo   text;
  v_gal    text;
  v_cover  text;
  v_blogo  text;
  v_comm_base jsonb;
  v_biz_base  jsonb;
  v_payload jsonb;
  v_target uuid;
  v_case   jsonb;
  v_ret    jsonb;
  v_state  text;
  v_err    text;
  v_before int;
  v_after  int;
  v_n      int;
  v_snap_comm text;
  v_snap_biz  text;
  v_act    record;
  v_own    text;
  v_foreign text;
  v_ev     uuid;
  v_occ    uuid;
BEGIN
  IF v_admin IS NULL OR v_member IS NULL OR cardinality(v_res) < 3 OR v_res_pending IS NULL THEN
    RAISE NOTICE 'SKIP org_admin_save smoke: needs one is_admin profile, one plain member, 3 approved + 1 non-approved resource';
    RETURN;
  END IF;

  v_logo  := v_comm || '/' || gen_random_uuid() || '.webp';
  v_gal   := v_comm || '/' || gen_random_uuid() || '.jpg';
  v_cover := v_comm || '/' || gen_random_uuid() || '.png';
  v_blogo := v_biz  || '/' || gen_random_uuid() || '.webp';

  -- =====================================================================
  -- S1 — GATE: only a platform admin writes; non-admin 42501 / anon permission denied.
  -- =====================================================================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_state := NULL; v_err := NULL;
  BEGIN
    PERFORM public.admin_save_organization(v_comm, jsonb_build_object('name', 'SMOKE Comm', 'org_type', 'community'));
  EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
  END;
  ASSERT v_state = '42501' AND v_err LIKE 'org_save_denied%',
    'S1: non-admin member must get 42501 org_save_denied, got '||COALESCE(v_state, '<none>')||' '||COALESCE(v_err, '');

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  v_state := NULL; v_err := NULL;
  BEGIN
    PERFORM public.admin_save_organization(v_comm, jsonb_build_object('name', 'SMOKE Comm', 'org_type', 'community'));
  EXCEPTION WHEN others THEN v_state := SQLSTATE;
  END;
  ASSERT v_state = '42501', 'S1: anon must be denied EXECUTE (42501), got '||COALESCE(v_state, '<none>');

  RESET ROLE;
  ASSERT NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_comm),
    'S1: a denied call must write nothing';
  ASSERT NOT has_function_privilege('anon', 'public.admin_save_organization(uuid, jsonb)', 'EXECUTE'),
    'S1: anon must hold no EXECUTE on admin_save_organization';

  -- =====================================================================
  -- S2 — admin CREATE non-business: one row, every part, exactly one audit row.
  --      Includes an overnight interval and an Open-24-hours interval (accepted).
  -- =====================================================================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-org-create-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SET LOCAL ROLE authenticated;
  v_ret := public.admin_save_organization(v_comm, jsonb_build_object(
    'name', '  SMOKE Comm  ', 'org_type', 'community', 'description', 'Smoke community',
    'website', 'https://example.org', 'email', 'info@example.org', 'city', 'Burlington', 'state', 'VT',
    'location', jsonb_build_object('lng', -179.85, 'lat', -89.85),
    'hours', jsonb_build_array(
      jsonb_build_object('day_of_week', 1, 'open_time', '09:00:00', 'close_time', '17:00:00'),
      jsonb_build_object('day_of_week', 5, 'open_time', '22:00', 'close_time', '02:00'),
      jsonb_build_object('day_of_week', 6, 'open_time', '00:00', 'close_time', '24:00')),
    'photos', jsonb_build_array(
      jsonb_build_object('kind', 'logo', 'storage_path', v_logo, 'url', c_base || v_logo),
      jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', c_base || v_gal, 'caption', 'Front')),
    'resource_ids', to_jsonb(v_res)));
  RESET ROLE;

  ASSERT (v_ret->>'id')::uuid = v_comm AND (v_ret->>'created')::boolean
     AND jsonb_array_length(v_ret->'removed_photo_paths') = 0,
    'S2: create must return {id, created:true, removed_photo_paths:[]}, got '||v_ret::text;
  ASSERT (SELECT count(*) FROM public.organizations WHERE id = v_comm) = 1, 'S2: exactly one org row';
  ASSERT (SELECT name = 'SMOKE Comm' AND org_type = 'community' AND created_by = v_admin
            AND status = 'approved' AND is_active AND submitted_by IS NULL
            AND moderated_by IS NULL AND moderated_at IS NULL
            AND website = 'https://example.org' AND email = 'info@example.org'
          FROM public.organizations WHERE id = v_comm),
    'S2: create must set trimmed name, created_by=admin, approved, active, no submitter/moderation';
  ASSERT (SELECT abs(ST_X(location::geometry) + 179.85) < 1e-9 AND abs(ST_Y(location::geometry) + 89.85) < 1e-9
          FROM public.organizations WHERE id = v_comm), 'S2: location must be set from {lng,lat}';
  ASSERT (SELECT count(*) FROM public.business_hours WHERE org_id = v_comm) = 3, 'S2: 3 hours rows';
  ASSERT EXISTS (SELECT 1 FROM public.business_hours WHERE org_id = v_comm AND day_of_week = 5
                   AND open_time = '22:00' AND close_time = '02:00'), 'S2: overnight interval accepted';
  ASSERT EXISTS (SELECT 1 FROM public.business_hours WHERE org_id = v_comm AND day_of_week = 6
                   AND open_time = '00:00' AND close_time = '24:00'), 'S2: 00:00-24:00 accepted';
  ASSERT (SELECT array_agg(storage_path ORDER BY sort_order) FROM public.business_photos WHERE org_id = v_comm)
         = ARRAY[v_logo, v_gal], 'S2: photos stored in payload order';
  ASSERT (SELECT caption FROM public.business_photos WHERE org_id = v_comm AND storage_path = v_gal) = 'Front',
    'S2: photo caption stored';
  ASSERT (SELECT array_agg(resource_id ORDER BY sort_order) FROM public.org_resources WHERE org_id = v_comm) = v_res,
    'S2: resources linked in payload order';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'S2: exactly one audit row, got '||(v_after - v_before);
  SELECT * INTO v_act FROM public.admin_actions WHERE target_id = v_comm::text;
  ASSERT v_act.action = 'org.create' AND v_act.actor_id = v_admin AND v_act.target_type = 'organization'
     AND v_act.outcome = 'ok' AND v_act.request_id = 'smoke-org-create-1',
    'S2: audit row must be org.create by admin with request_id, got '||row_to_json(v_act)::text;
  ASSERT v_act.details = jsonb_build_object('org_type', 'community', 'hours_count', 3, 'photo_count', 2,
                           'resource_count', 3, 'service_count', 0, 'location_set', true),
    'S2: audit details mismatch: '||v_act.details::text;

  -- =====================================================================
  -- S3 — admin CREATE business: business fields validated + stored, moderated_* set.
  -- =====================================================================
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-biz-create-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SET LOCAL ROLE authenticated;
  v_ret := public.admin_save_organization(v_biz, jsonb_build_object(
    'name', 'SMOKE Biz', 'org_type', 'business', 'business_category', 'food', 'cost_model', 'sliding_scale',
    'service_radius_miles', 25,
    'attributes', jsonb_build_object('wifi', true, 'parking', false),
    'social_links', jsonb_build_object('instagram', 'https://instagram.com/smoke', 'x', ''),
    'services', jsonb_build_array(jsonb_build_object('name', 'Groceries'),
                                  jsonb_build_object('name', 'Delivery', 'description', 'Weekly')),
    'photos', jsonb_build_array(jsonb_build_object('kind', 'logo', 'storage_path', v_blogo, 'url', c_base || v_blogo)),
    'location', jsonb_build_object('lng', -179.85, 'lat', -89.85)));
  RESET ROLE;
  ASSERT (v_ret->>'created')::boolean, 'S3: business create must report created';
  ASSERT (SELECT created_by = v_admin AND moderated_by = v_admin AND moderated_at IS NOT NULL
            AND status = 'approved' AND is_active AND submitted_by IS NULL
            AND business_category = 'food' AND cost_model = 'sliding_scale' AND service_radius_miles = 25
            AND attributes = '{"wifi": true}'::jsonb
            AND social_links = '{"instagram": "https://instagram.com/smoke"}'::jsonb
          FROM public.organizations WHERE id = v_biz),
    'S3: business create must set moderated_by/at=admin/now, approved, and the validated business fields';
  ASSERT (SELECT array_agg(name ORDER BY sort_order) FROM public.business_services WHERE org_id = v_biz)
         = ARRAY['Groceries', 'Delivery'], 'S3: services stored in order';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'S3: exactly one audit row';
  ASSERT (SELECT action = 'business.create' AND request_id = 'smoke-biz-create-1' AND details->>'service_count' = '2'
          FROM public.admin_actions WHERE target_id = v_biz::text),
    'S3: audit action must be business.create with request_id + service_count 2';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  ASSERT (SELECT count(*) FROM public.organizations WHERE id = v_biz) = 1,
    'S3: an admin-created business is public immediately (approved + active)';
  RESET ROLE;

  -- =====================================================================
  -- S4 — admin UPDATE: replace semantics, absent keys kept, protected fields untouched,
  --      removed_photo_paths returned, resources re-ordered, one audit row.
  -- =====================================================================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-org-update-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SET LOCAL ROLE authenticated;
  v_ret := public.admin_save_organization(v_comm, jsonb_build_object(
    'name', 'SMOKE Comm Renamed', 'org_type', 'nonprofit',
    'hours', jsonb_build_array(jsonb_build_object('day_of_week', 2, 'open_time', '10:00', 'close_time', '14:00')),
    'photos', jsonb_build_array(
      jsonb_build_object('kind', 'cover', 'storage_path', v_cover, 'url', c_base || v_cover),
      jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', c_base || v_gal)),
    'resource_ids', jsonb_build_array(v_res[3], v_res[1]),
    'status', 'rejected', 'is_active', false, 'created_by', v_member));
  RESET ROLE;
  ASSERT NOT (v_ret->>'created')::boolean, 'S4: update must report created=false';
  ASSERT v_ret->'removed_photo_paths' = jsonb_build_array(v_logo),
    'S4: removed_photo_paths must list exactly the dropped logo, got '||(v_ret->'removed_photo_paths')::text;
  ASSERT (SELECT name = 'SMOKE Comm Renamed' AND org_type = 'nonprofit' AND description = 'Smoke community'
            AND location IS NOT NULL AND created_by = v_admin AND status = 'approved' AND is_active
          FROM public.organizations WHERE id = v_comm),
    'S4: update must change name/org_type, keep absent description+location, never touch created_by/status/is_active';
  ASSERT (SELECT count(*) FROM public.business_hours WHERE org_id = v_comm) = 1
     AND EXISTS (SELECT 1 FROM public.business_hours WHERE org_id = v_comm AND day_of_week = 2),
    'S4: hours array must REPLACE all rows';
  ASSERT (SELECT array_agg(storage_path ORDER BY sort_order) FROM public.business_photos WHERE org_id = v_comm)
         = ARRAY[v_cover, v_gal], 'S4: photos array must REPLACE all rows';
  ASSERT (SELECT array_agg(resource_id ORDER BY sort_order) FROM public.org_resources WHERE org_id = v_comm)
         = ARRAY[v_res[3], v_res[1]], 'S4: resource_ids must REPLACE links in the new order';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'S4: exactly one audit row per update';
  ASSERT (SELECT count(*) FROM public.admin_actions WHERE target_id = v_comm::text AND action = 'org.update'
            AND request_id = 'smoke-org-update-1' AND details->>'org_type' = 'nonprofit') = 1,
    'S4: audit row must be org.update with request_id';

  -- location: null clears; absent description stays.
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_save_organization(v_comm, jsonb_build_object(
    'name', 'SMOKE Comm Renamed', 'org_type', 'nonprofit', 'location', NULL));
  RESET ROLE;
  ASSERT (SELECT location IS NULL AND description = 'Smoke community' FROM public.organizations WHERE id = v_comm),
    'S4: location null must clear; absent description must be kept';
  ASSERT (SELECT array_agg(storage_path ORDER BY sort_order) FROM public.business_photos WHERE org_id = v_comm)
         = ARRAY[v_cover, v_gal], 'S4: an absent photos key must keep photos';

  -- protected fields on a member-submitted pending business stay untouched by an admin save.
  UPDATE public.organizations SET submitted_by = v_member, created_by = v_member, status = 'pending',
         moderated_by = NULL, moderated_at = NULL WHERE id = v_biz;
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_save_organization(v_biz, jsonb_build_object(
    'name', 'SMOKE Biz Edited', 'org_type', 'business', 'status', 'approved', 'is_active', false,
    'submitted_by', v_admin, 'moderated_by', v_admin));
  RESET ROLE;
  ASSERT (SELECT name = 'SMOKE Biz Edited' AND submitted_by = v_member AND created_by = v_member
            AND status = 'pending' AND is_active AND moderated_by IS NULL AND moderated_at IS NULL
            AND business_category = 'food'
          FROM public.organizations WHERE id = v_biz),
    'S4: business update must never change submitted_by/created_by/status/is_active/moderation, and keep absent fields';

  -- =====================================================================
  -- S5 — business <-> non-business switching rejected (both directions).
  -- =====================================================================
  SET LOCAL ROLE authenticated;
  v_state := NULL; v_err := NULL;
  BEGIN
    PERFORM public.admin_save_organization(v_comm, jsonb_build_object('name', 'X', 'org_type', 'business'));
  EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
  END;
  ASSERT v_state = '22023' AND v_err LIKE '%cannot switch%', 'S5: non-business -> business must be rejected, got '||COALESCE(v_err, '<none>');
  v_state := NULL; v_err := NULL;
  BEGIN
    PERFORM public.admin_save_organization(v_biz, jsonb_build_object('name', 'X', 'org_type', 'community'));
  EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
  END;
  ASSERT v_state = '22023' AND v_err LIKE '%cannot switch%', 'S5: business -> non-business must be rejected, got '||COALESCE(v_err, '<none>');
  RESET ROLE;

  -- =====================================================================
  -- S6 — validation: every invalid payload raises 22023 and NOTHING persists
  --      (org row, children and audit unchanged; a create writes no row).
  -- =====================================================================
  v_snap_comm := pg_temp.org_snap(v_comm);
  v_snap_biz  := pg_temp.org_snap(v_biz);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  v_comm_base := jsonb_build_object('name', 'SMOKE Comm Renamed', 'org_type', 'nonprofit');
  v_biz_base  := jsonb_build_object('name', 'SMOKE Biz Edited', 'org_type', 'business');

  SET LOCAL ROLE authenticated;
  FOR v_case IN SELECT e FROM jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('l', 'blank name',          't', 'comm', 'f', 'name is required',      'p', jsonb_build_object('name', '   ')),
    jsonb_build_object('l', 'missing name create', 't', 'new',  'f', 'name is required',      'p', jsonb_build_object('name', NULL)),
    jsonb_build_object('l', 'bad org_type',        't', 'comm', 'f', 'org_type',              'p', jsonb_build_object('org_type', 'casino')),
    jsonb_build_object('l', 'biz field on org',    't', 'comm', 'f', 'business-only',         'p', jsonb_build_object('business_category', 'food')),
    jsonb_build_object('l', 'services on org',     't', 'comm', 'f', 'business-only',         'p', jsonb_build_object('services', jsonb_build_array(jsonb_build_object('name', 'x')))),
    jsonb_build_object('l', 'bad category',        't', 'biz',  'f', 'business_category',     'p', jsonb_build_object('business_category', 'casino')),
    jsonb_build_object('l', 'bad cost_model',      't', 'biz',  'f', 'cost_model',            'p', jsonb_build_object('cost_model', 'barter')),
    jsonb_build_object('l', 'bad attribute key',   't', 'biz',  'f', 'attribute',             'p', jsonb_build_object('attributes', jsonb_build_object('free_lunch', true))),
    jsonb_build_object('l', 'non-bool attribute',  't', 'biz',  'f', 'attribute',             'p', jsonb_build_object('attributes', jsonb_build_object('wifi', 'yes'))),
    jsonb_build_object('l', 'js social url',       't', 'biz',  'f', 'social link',           'p', jsonb_build_object('social_links', jsonb_build_object('instagram', 'javascript:alert(1)'))),
    jsonb_build_object('l', 'unknown platform',    't', 'biz',  'f', 'social link',           'p', jsonb_build_object('social_links', jsonb_build_object('myspace', 'https://myspace.com/x'))),
    jsonb_build_object('l', 'blank service name',  't', 'biz',  'f', 'service',               'p', jsonb_build_object('services', jsonb_build_array(jsonb_build_object('name', '  ')))),
    jsonb_build_object('l', 'ftp website',         't', 'comm', 'f', 'website',               'p', jsonb_build_object('website', 'ftp://example.org')),
    jsonb_build_object('l', 'bad email',           't', 'comm', 'f', 'email',                 'p', jsonb_build_object('email', 'not-an-email')),
    jsonb_build_object('l', 'zero-length hours',   't', 'comm', 'f', 'same time',             'p', jsonb_build_object('hours', jsonb_build_array(jsonb_build_object('day_of_week', 1, 'open_time', '09:00', 'close_time', '09:00')))),
    jsonb_build_object('l', 'zero-length 00:00',   't', 'comm', 'f', 'same time',             'p', jsonb_build_object('hours', jsonb_build_array(jsonb_build_object('day_of_week', 1, 'open_time', '00:00', 'close_time', '00:00')))),
    jsonb_build_object('l', '24:00 not from 00:00','t', 'comm', 'f', '24:00',                 'p', jsonb_build_object('hours', jsonb_build_array(jsonb_build_object('day_of_week', 1, 'open_time', '08:00', 'close_time', '24:00')))),
    jsonb_build_object('l', 'day 7',               't', 'comm', 'f', 'day_of_week',           'p', jsonb_build_object('hours', jsonb_build_array(jsonb_build_object('day_of_week', 7, 'open_time', '09:00', 'close_time', '17:00')))),
    jsonb_build_object('l', 'lat out of range',    't', 'comm', 'f', 'location',              'p', jsonb_build_object('location', jsonb_build_object('lng', 0, 'lat', 95))),
    jsonb_build_object('l', 'photo other folder',  't', 'comm', 'f', 'storage_path',          'p', jsonb_build_object('photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_blogo, 'url', c_base || v_blogo)))),
    jsonb_build_object('l', 'photo svg',           't', 'comm', 'f', 'storage_path',          'p', jsonb_build_object('photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_comm || '/' || gen_random_uuid() || '.svg', 'url', c_base || v_comm || '/x.svg')))),
    jsonb_build_object('l', 'photo url mismatch',  't', 'comm', 'f', 'url',                   'p', jsonb_build_object('photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', c_base || v_cover)))),
    jsonb_build_object('l', 'photo other bucket',  't', 'comm', 'f', 'url',                   'p', jsonb_build_object('photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', replace(c_base, 'org-photos', 'post-images') || v_gal)))),
    jsonb_build_object('l', 'two logos',           't', 'comm', 'f', 'at most one logo',      'p', jsonb_build_object('photos', jsonb_build_array(
                                                                                                     jsonb_build_object('kind', 'logo', 'storage_path', v_gal, 'url', c_base || v_gal),
                                                                                                     jsonb_build_object('kind', 'logo', 'storage_path', v_cover, 'url', c_base || v_cover)))),
    jsonb_build_object('l', 'unapproved resource', 't', 'comm', 'f', 'approved resource',     'p', jsonb_build_object('resource_ids', jsonb_build_array(v_res_pending))),
    jsonb_build_object('l', 'userinfo host trick', 't', 'comm', 'f', 'url',                   'p', jsonb_build_object('photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_gal,
                                                                                                     'url', 'https://ndtpovonpadugthmcntl.supabase.co@evil.example/storage/v1/object/public/org-photos/' || v_gal)))),
    jsonb_build_object('l', 'object name',         't', 'comm', 'f', 'name must be a string', 'p', jsonb_build_object('name', jsonb_build_object('a', 1))),
    jsonb_build_object('l', 'array city',          't', 'comm', 'f', 'city must be a string', 'p', jsonb_build_object('city', jsonb_build_array('Burlington'))),
    jsonb_build_object('l', 'number phone',        't', 'comm', 'f', 'phone must be a string','p', jsonb_build_object('phone', 8025550100)),
    jsonb_build_object('l', 'string lng',          't', 'comm', 'f', 'location',              'p', jsonb_build_object('location', jsonb_build_object('lng', 'abc', 'lat', 2))),
    jsonb_build_object('l', 'string day',          't', 'comm', 'f', 'day_of_week',           'p', jsonb_build_object('hours', jsonb_build_array(jsonb_build_object('day_of_week', '1', 'open_time', '09:00', 'close_time', '10:00')))),
    jsonb_build_object('l', 'object caption',      't', 'comm', 'f', 'caption',               'p', jsonb_build_object('photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', c_base || v_gal, 'caption', jsonb_build_object('x', 1))))),
    jsonb_build_object('l', 'string radius',       't', 'biz',  'f', 'service_radius_miles',  'p', jsonb_build_object('service_radius_miles', 'ten')),
    jsonb_build_object('l', 'duplicate photo',     't', 'comm', 'f', 'duplicate photo',       'p', jsonb_build_object('photos', jsonb_build_array(
                                                                                                     jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', c_base || v_gal),
                                                                                                     jsonb_build_object('kind', 'gallery', 'storage_path', v_gal, 'url', c_base || v_gal)))),
    jsonb_build_object('l', 'duplicate hours',     't', 'comm', 'f', 'duplicate hours',       'p', jsonb_build_object('hours', jsonb_build_array(
                                                                                                     jsonb_build_object('day_of_week', 1, 'open_time', '09:00', 'close_time', '17:00'),
                                                                                                     jsonb_build_object('day_of_week', 1, 'open_time', '09:00:00', 'close_time', '17:00')))),
    jsonb_build_object('l', 'bad resource uuid',   't', 'comm', 'f', 'UUID string',           'p', jsonb_build_object('resource_ids', jsonb_build_array('not-a-uuid'))),
    jsonb_build_object('l', 'numeric resource id', 't', 'comm', 'f', 'UUID string',           'p', jsonb_build_object('resource_ids', jsonb_build_array(123))),
    jsonb_build_object('l', 'dup resource (case)', 't', 'comm', 'f', 'duplicate resource',    'p', jsonb_build_object('resource_ids', jsonb_build_array(v_res[1]::text, upper(v_res[1]::text)))),
    -- atomicity: valid name + hours + resources followed by an invalid photo => nothing persists
    jsonb_build_object('l', 'partial payload',     't', 'comm', 'f', 'storage_path',          'p', jsonb_build_object(
        'name', 'SMOKE Partial', 'hours', jsonb_build_array(jsonb_build_object('day_of_week', 3, 'open_time', '09:00', 'close_time', '10:00')),
        'resource_ids', jsonb_build_array(v_res[2]),
        'photos', jsonb_build_array(jsonb_build_object('kind', 'gallery', 'storage_path', v_comm || '/bad.gif', 'url', c_base || v_comm || '/bad.gif'))))
  )) AS e LOOP
    v_target  := CASE v_case->>'t' WHEN 'comm' THEN v_comm WHEN 'biz' THEN v_biz ELSE v_new END;
    v_payload := (CASE v_case->>'t' WHEN 'biz' THEN v_biz_base ELSE v_comm_base END) || (v_case->'p');
    v_state := NULL; v_err := NULL;
    BEGIN
      PERFORM public.admin_save_organization(v_target, v_payload);
    EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
    END;
    ASSERT v_state = '22023' AND v_err LIKE '%' || (v_case->>'f') || '%',
      format('S6 [%s]: expected 22023 matching "%s", got %s %s', v_case->>'l', v_case->>'f',
             COALESCE(v_state, '<none: call succeeded>'), COALESCE(v_err, ''));
  END LOOP;
  RESET ROLE;
  ASSERT pg_temp.org_snap(v_comm) = v_snap_comm, 'S6: a rejected save must leave the org + children unchanged';
  ASSERT pg_temp.org_snap(v_biz)  = v_snap_biz,  'S6: a rejected business save must leave it unchanged';
  ASSERT NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_new), 'S6: a rejected create writes no row';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after = v_before, 'S6: a rejected save writes no audit row';

  -- =====================================================================
  -- S8 — can_manage_org_photos truth table + org-photos storage policies + bucket config.
  -- =====================================================================
  INSERT INTO public.organizations (name, org_type, status, submitted_by)
  VALUES ('SMOKE Member Biz', 'business', 'pending', v_member) RETURNING id INTO v_mbiz;
  INSERT INTO public.organizations (name, org_type, submitted_by)
  VALUES ('SMOKE Member Comm', 'community', v_member) RETURNING id INTO v_mcomm;
  INSERT INTO public.organizations (name, org_type, status)
  VALUES ('SMOKE Other Biz', 'business', 'approved') RETURNING id INTO v_obiz;

  ASSERT (SELECT public AND file_size_limit = 5242880
            AND allowed_mime_types::text[] @> ARRAY['image/webp', 'image/jpeg', 'image/png']
            AND cardinality(allowed_mime_types) = 3
          FROM storage.buckets WHERE id = 'org-photos'),
    'S8: org-photos bucket must be public, 5 MB, webp/jpeg/png';
  ASSERT NOT has_function_privilege('anon', 'public.can_manage_org_photos(text)', 'EXECUTE'),
    'S8: anon must hold no EXECUTE on can_manage_org_photos';

  SET LOCAL ROLE authenticated;
  -- no user
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  ASSERT public.can_manage_org_photos(v_mbiz::text) IS FALSE, 'S8: no user => false';
  -- guest (anonymous sign-in), even with an admin uid
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  ASSERT public.can_manage_org_photos(v_comm::text) IS FALSE, 'S8: guest (admin uid) => false';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  ASSERT public.can_manage_org_photos(v_mbiz::text) IS FALSE, 'S8: guest (member uid, own biz) => false';
  -- platform admin
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  ASSERT public.can_manage_org_photos(v_comm::text) IS TRUE, 'S8: admin + existing org folder => true';
  ASSERT public.can_manage_org_photos(v_new::text) IS TRUE,  'S8: admin + not-yet-created org uuid => true';
  ASSERT public.can_manage_org_photos('not-a-uuid') IS FALSE, 'S8: admin + non-uuid folder => false';
  -- member
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  ASSERT public.can_manage_org_photos(v_mbiz::text)  IS TRUE,  'S8: member + own business => true';
  ASSERT public.can_manage_org_photos(v_obiz::text)  IS FALSE, 'S8: member + someone else''s business => false';
  ASSERT public.can_manage_org_photos(v_mcomm::text) IS FALSE, 'S8: member + own NON-business row => false';
  ASSERT public.can_manage_org_photos(v_new::text)   IS FALSE, 'S8: member + unknown uuid => false';
  ASSERT public.can_manage_org_photos('x')           IS FALSE, 'S8: member + non-uuid => false';
  -- anon role
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  v_state := NULL; v_err := NULL;
  BEGIN PERFORM public.can_manage_org_photos(v_mbiz::text);
  EXCEPTION WHEN others THEN v_state := SQLSTATE; END;
  ASSERT v_state = '42501', 'S8: anon must be denied EXECUTE on can_manage_org_photos';
  RESET ROLE;

  -- storage.objects: managers list + delete in their folder only; listing closed to the public;
  -- no direct client upload.
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('org-photos', v_mbiz || '/' || gen_random_uuid() || '.webp'),
    ('org-photos', v_obiz || '/' || gen_random_uuid() || '.webp');
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'org-photos' AND name LIKE v_mbiz || '/%') = 1,
    'S8: member lists own business folder';
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'org-photos' AND name LIKE v_obiz || '/%') = 0,
    'S8: member cannot list another org folder';
  DELETE FROM storage.objects WHERE bucket_id = 'org-photos' AND name LIKE v_obiz || '/%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'S8: member cannot delete in another org folder';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'storage' AND tablename = 'objects'
                       AND cmd IN ('INSERT', 'UPDATE', 'ALL')
                       AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%org-photos%'),
    'S8: no INSERT/UPDATE/ALL policy on storage.objects may reference org-photos (uploads are service-role only)';
  DELETE FROM storage.objects WHERE bucket_id = 'org-photos' AND name LIKE v_mbiz || '/%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'S8: member deletes in own business folder';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'org-photos' AND name LIKE v_obiz || '/%') = 1,
    'S8: admin lists any org folder';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'org-photos') = 0,
    'S8: guest cannot list org-photos';

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'org-photos') = 0,
    'S8: public listing of org-photos stays closed';
  RESET ROLE;

  -- =====================================================================
  -- S9 — removed_photo_paths never returns a file outside THIS org's folder.
  --      A member plants a row on their own business whose storage_path points into another
  --      org's folder; an admin save that drops it must not hand that path back for deletion.
  -- =====================================================================
  v_own     := v_mbiz || '/' || gen_random_uuid() || '.webp';
  v_foreign := v_comm || '/' || gen_random_uuid() || '.webp';
  INSERT INTO public.business_photos (org_id, kind, url, storage_path) VALUES (v_mbiz, 'gallery', c_base || v_own, v_own);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.business_photos (org_id, kind, url, storage_path) VALUES (v_mbiz, 'gallery', 'https://x/y.webp', v_foreign);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_ret := public.admin_save_organization(v_mbiz, jsonb_build_object(
    'name', 'SMOKE Member Biz', 'org_type', 'business', 'photos', '[]'::jsonb));
  RESET ROLE;
  ASSERT v_ret->'removed_photo_paths' = jsonb_build_array(v_own),
    'S9: removed_photo_paths must list ONLY the own-folder file, got '||(v_ret->'removed_photo_paths')::text;
  ASSERT NOT (v_ret->'removed_photo_paths' ? v_foreign), 'S9: a foreign-folder path must never be returned';
  ASSERT (SELECT count(*) FROM public.business_photos WHERE org_id = v_mbiz) = 0, 'S9: both rows are dropped';

  -- =====================================================================
  -- S10 — admin_set_org_active: admin only, exactly one row, every call audited (no-op too),
  --       deactivation fires organizations_cascade_deactivate, works for businesses.
  -- =====================================================================
  INSERT INTO public.assistance_events (org_id, title) VALUES (v_comm, 'SMOKE Event') RETURNING id INTO v_ev;
  INSERT INTO public.event_occurrences (event_id, starts_at, ends_at)
  VALUES (v_ev, now() + interval '1 day', now() + interval '1 day 2 hours') RETURNING id INTO v_occ;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_state := NULL; v_err := NULL;
  BEGIN PERFORM public.admin_set_org_active(v_comm, false);
  EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM; END;
  ASSERT v_state = '42501' AND v_err LIKE 'org_active_denied%',
    'S10: non-admin must get 42501, got '||COALESCE(v_state, '<none>')||' '||COALESCE(v_err, '');
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  v_state := NULL; v_err := NULL;
  BEGIN PERFORM public.admin_set_org_active(v_comm, false);
  EXCEPTION WHEN others THEN v_state := SQLSTATE; END;
  ASSERT v_state = '42501', 'S10: anon must be denied EXECUTE';
  RESET ROLE;
  ASSERT (SELECT is_active FROM public.organizations WHERE id = v_comm), 'S10: a denied call changes nothing';
  ASSERT (SELECT status FROM public.event_occurrences WHERE id = v_occ) = 'upcoming', 'S10: a denied call cascades nothing';
  ASSERT NOT has_function_privilege('anon', 'public.admin_set_org_active(uuid, boolean)', 'EXECUTE'),
    'S10: anon must hold no EXECUTE on admin_set_org_active';

  -- deactivate (cascade fires)
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-org-deact-1"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_set_org_active(v_comm, false);
  RESET ROLE;
  ASSERT (SELECT NOT is_active FROM public.organizations WHERE id = v_comm), 'S10: deactivate sets is_active=false';
  ASSERT (SELECT status FROM public.event_occurrences WHERE id = v_occ) = 'cancelled',
    'S10: deactivate must fire organizations_cascade_deactivate (future occurrence cancelled)';
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'S10: exactly one audit row per deactivate';
  ASSERT (SELECT action = 'org.deactivate' AND target_type = 'organization' AND target_id = v_comm::text
            AND actor_id = v_admin AND details->>'was_active' = 'true'
          FROM public.admin_actions WHERE request_id = 'smoke-org-deact-1'),
    'S10: audit row must be org.deactivate on the org with request_id';

  -- reactivate, then a no-op reactivate (still audited)
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-org-react-1"}', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_set_org_active(v_comm, true);
  RESET ROLE;
  ASSERT (SELECT is_active FROM public.organizations WHERE id = v_comm), 'S10: reactivate sets is_active=true';
  ASSERT (SELECT action = 'org.reactivate' AND details->>'was_active' = 'false'
          FROM public.admin_actions WHERE request_id = 'smoke-org-react-1'), 'S10: reactivate audited';
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-org-react-2"}', true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_set_org_active(v_comm, true);
  RESET ROLE;
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1 AND (SELECT is_active FROM public.organizations WHERE id = v_comm),
    'S10: a no-op reactivate is allowed and still writes exactly one audit row';
  ASSERT (SELECT details->>'was_active' = 'true' FROM public.admin_actions WHERE request_id = 'smoke-org-react-2'),
    'S10: the no-op audit row records was_active=true';

  -- businesses too
  PERFORM set_config('request.headers', '{"x-request-id":"smoke-biz-deact-1"}', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_set_org_active(v_biz, false);
  RESET ROLE;
  ASSERT (SELECT NOT is_active FROM public.organizations WHERE id = v_biz), 'S10: a business can be deactivated';
  ASSERT (SELECT action = 'org.deactivate' AND details->>'org_type' = 'business'
          FROM public.admin_actions WHERE request_id = 'smoke-biz-deact-1'), 'S10: business deactivate audited';

  -- 0 rows => P0002, no audit
  SELECT count(*) INTO v_before FROM public.admin_actions;
  SET LOCAL ROLE authenticated;
  v_state := NULL; v_err := NULL;
  BEGIN PERFORM public.admin_set_org_active(v_new, false);
  EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM; END;
  RESET ROLE;
  ASSERT v_state = 'P0002', 'S10: an unknown org must raise P0002, got '||COALESCE(v_state, '<none: silent success>');
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after = v_before, 'S10: a failed call writes no audit row';

  -- =====================================================================
  -- S7 — an UPDATE that affects 0 rows is an error, never a silent success.
  --      A BEFORE UPDATE trigger that skips the row simulates the 0-row outcome. It takes a
  --      ShareRowExclusive lock on organizations until ROLLBACK (which also removes it), so it
  --      runs only on a local database that opted in with feed.smoke_local=on. Runs LAST.
  -- =====================================================================
  IF current_setting('feed.smoke_local', true) = 'on' THEN
    CREATE FUNCTION public.smoke_skip_org_update() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NULL; END';
    EXECUTE format('CREATE TRIGGER smoke_skip_org_update BEFORE UPDATE ON public.organizations
                    FOR EACH ROW WHEN (OLD.id = %L::uuid) EXECUTE FUNCTION public.smoke_skip_org_update()', v_comm);
    v_snap_comm := pg_temp.org_snap(v_comm);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    v_state := NULL; v_err := NULL;
    BEGIN
      PERFORM public.admin_save_organization(v_comm, jsonb_build_object(
        'name', 'SMOKE Ghost', 'org_type', 'nonprofit',
        'hours', jsonb_build_array(jsonb_build_object('day_of_week', 4, 'open_time', '09:00', 'close_time', '10:00'))));
    EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
    END;
    RESET ROLE;
    ASSERT v_state = 'P0002' AND v_err LIKE '%affected 0 rows%',
      '0-row update must raise P0002, got '||COALESCE(v_state, '<none: silent success>')||' '||COALESCE(v_err, '');
    ASSERT pg_temp.org_snap(v_comm) = v_snap_comm, 'S7: a 0-row update must persist no child writes';
    RAISE NOTICE 'PASS S7 0-row update guard (local)';
  ELSE
    RAISE NOTICE 'SKIP S7 0-row update guard: needs feed.smoke_local=on (creates a trigger on organizations; local DB only)';
  END IF;

  RAISE NOTICE 'PASS org_admin_save smoke: S1 gate, S2-S4 create/update, S5 switch, S6 validation+atomicity, S8 photos, S9 foreign paths, S10 set-active';
END
$smoke$;

ROLLBACK;
