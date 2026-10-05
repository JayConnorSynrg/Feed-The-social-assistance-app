-- p4b_organizations.smoke.sql
-- Behavioural smoke for the P4b informational-organizations data plane. Every check is a
-- rolled-back WRITE that asserts observed behaviour (never a text/ILIKE grep on a policy
-- or function body).
--
-- Run against a database that ALREADY has migrations 20261015000000 and 20261018000000
-- (guest write block, checked by the GUEST-BLOCK block) applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/p4b_organizations.smoke.sql
--   -- or via the Management API SQL endpoint (single request; it wraps one txn).
--
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. A failed ASSERT
-- aborts the transaction with the failing message. If it reaches the final NOTICE, every
-- invariant held. Portable: it discovers an is_admin actor, a plain member, and a resource
-- at runtime and SKIPs (with a loud NOTICE) if the fixtures are absent.
--
-- Fixtures are seeded as the connection superuser (RESET ROLE) so the business-insert guard
-- and RLS are bypassed and org_type/status/is_active/location can be set directly; every
-- VISIBILITY assertion then reads as anon (or, for org_resources writes, as a member/admin),
-- which is the surface the widened policies actually govern.

BEGIN;
-- Lock safety on shared databases: never wait on a lock longer than 2s.
SET LOCAL lock_timeout = '2s';

-- PostGIS lives in the extensions schema; pin it so st_makepoint / ::geography resolve
-- exactly as public.organizations_in_bounds pins them. LOCAL => reverts on ROLLBACK.
SET LOCAL search_path TO public, extensions, pg_temp;

DO $smoke$
DECLARE
  v_admin  uuid := (SELECT id FROM public.profiles WHERE is_admin = true LIMIT 1);
  v_member uuid := (SELECT id FROM public.profiles WHERE is_admin IS NOT TRUE LIMIT 1);
  v_res    uuid := (SELECT id FROM public.resources LIMIT 1);
  -- non-business (informational) orgs
  v_comm_active   uuid;  -- INV-1: active community  => children public
  v_comm_inactive uuid;  -- INV-1: inactive community => children hidden
  -- business orgs (INV-2 no-regression)
  v_biz_ok      uuid;    -- approved + active  => children public
  v_biz_pending uuid;    -- pending            => children hidden
  v_biz_inact   uuid;    -- approved + inactive => children hidden
  -- INV-4 bbox orgs
  v_bb_in      uuid;     -- active non-business inside bbox  => returned
  v_bb_biz     uuid;     -- business inside bbox             => excluded
  v_bb_inact   uuid;     -- inactive non-business inside bbox => excluded
  v_bb_out     uuid;     -- active non-business outside bbox  => excluded
  v_err  text;
BEGIN
  IF v_admin IS NULL OR v_member IS NULL OR v_res IS NULL THEN
    RAISE NOTICE 'SKIP p4b smoke: needs one is_admin profile, one plain member, and one resource';
    RETURN;
  END IF;

  -- =====================================================================
  -- Seed all fixtures as superuser (guard + RLS bypassed).
  -- =====================================================================
  RESET ROLE;

  -- INV-1 non-business orgs + one child row each -----------------------
  INSERT INTO public.organizations (name, org_type, is_active, city, state)
  VALUES ('SMOKE Comm Active', 'community', true, 'Burlington', 'VT') RETURNING id INTO v_comm_active;
  INSERT INTO public.organizations (name, org_type, is_active, city, state)
  VALUES ('SMOKE Comm Inactive', 'community', false, 'Burlington', 'VT') RETURNING id INTO v_comm_inactive;

  INSERT INTO public.business_hours   (org_id, day_of_week, open_time, close_time) VALUES (v_comm_active, 1, '09:00', '17:00');
  INSERT INTO public.business_services(org_id, name)                              VALUES (v_comm_active, 'SMOKE Service');
  INSERT INTO public.business_photos  (org_id, kind, url, storage_path)           VALUES (v_comm_active, 'logo', 'https://x/logo.png', 'p/logo.png');

  INSERT INTO public.business_hours   (org_id, day_of_week, open_time, close_time) VALUES (v_comm_inactive, 1, '09:00', '17:00');
  INSERT INTO public.business_services(org_id, name)                              VALUES (v_comm_inactive, 'SMOKE Service');
  INSERT INTO public.business_photos  (org_id, kind, url, storage_path)           VALUES (v_comm_inactive, 'logo', 'https://x/logo.png', 'p/logo.png');

  -- INV-2 business orgs + one child row each ---------------------------
  INSERT INTO public.organizations (name, org_type, status, is_active) VALUES ('SMOKE Biz OK', 'business', 'approved', true) RETURNING id INTO v_biz_ok;
  INSERT INTO public.organizations (name, org_type, status, is_active) VALUES ('SMOKE Biz Pending', 'business', 'pending', true) RETURNING id INTO v_biz_pending;
  INSERT INTO public.organizations (name, org_type, status, is_active) VALUES ('SMOKE Biz Inactive', 'business', 'approved', false) RETURNING id INTO v_biz_inact;

  INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz_ok, 2, '08:00', '16:00');
  INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz_pending, 2, '08:00', '16:00');
  INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz_inact, 2, '08:00', '16:00');

  -- INV-4 bbox orgs (far-south test envelope, no collision with real data) ---
  INSERT INTO public.organizations (name, org_type, is_active, location)
  VALUES ('SMOKE BBox In', 'community', true, st_setsrid(st_makepoint(-179.85, -89.85), 4326)::geography) RETURNING id INTO v_bb_in;
  INSERT INTO public.organizations (name, org_type, status, is_active, location)
  VALUES ('SMOKE BBox Biz', 'business', 'approved', true, st_setsrid(st_makepoint(-179.85, -89.85), 4326)::geography) RETURNING id INTO v_bb_biz;
  INSERT INTO public.organizations (name, org_type, is_active, location)
  VALUES ('SMOKE BBox Inact', 'community', false, st_setsrid(st_makepoint(-179.85, -89.85), 4326)::geography) RETURNING id INTO v_bb_inact;
  INSERT INTO public.organizations (name, org_type, is_active, location)
  VALUES ('SMOKE BBox Out', 'community', true, st_setsrid(st_makepoint(0, 0), 4326)::geography) RETURNING id INTO v_bb_out;

  -- =====================================================================
  -- INV-1 — child visibility tracks parent (non-business), both directions.
  -- =====================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  SET LOCAL ROLE anon;

  ASSERT (SELECT count(*) FROM public.business_hours    WHERE org_id = v_comm_active) = 1,
    'INV-1: anon must SEE hours of an active non-business org';
  ASSERT (SELECT count(*) FROM public.business_services WHERE org_id = v_comm_active) = 1,
    'INV-1: anon must SEE services of an active non-business org';
  ASSERT (SELECT count(*) FROM public.business_photos   WHERE org_id = v_comm_active) = 1,
    'INV-1: anon must SEE photos of an active non-business org';

  ASSERT (SELECT count(*) FROM public.business_hours    WHERE org_id = v_comm_inactive) = 0,
    'INV-1: anon must NOT see hours of an inactive non-business org';
  ASSERT (SELECT count(*) FROM public.business_services WHERE org_id = v_comm_inactive) = 0,
    'INV-1: anon must NOT see services of an inactive non-business org';
  ASSERT (SELECT count(*) FROM public.business_photos   WHERE org_id = v_comm_inactive) = 0,
    'INV-1: anon must NOT see photos of an inactive non-business org';

  -- =====================================================================
  -- INV-2 — NO business regression, both directions.
  -- =====================================================================
  ASSERT (SELECT count(*) FROM public.business_hours WHERE org_id = v_biz_ok) = 1,
    'INV-2: anon must SEE hours of an approved+active business (no regression)';
  ASSERT (SELECT count(*) FROM public.business_hours WHERE org_id = v_biz_pending) = 0,
    'INV-2: anon must NOT see hours of a pending business';
  ASSERT (SELECT count(*) FROM public.business_hours WHERE org_id = v_biz_inact) = 0,
    'INV-2: anon must NOT see hours of an approved-but-inactive business';

  -- =====================================================================
  -- INV-3 — org_resources integrity: write authority + read tracks parent.
  -- =====================================================================
  -- (a) a non-admin member INSERT is blocked (only org_resources_admin_all can write).
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_err := NULL;
  BEGIN
    INSERT INTO public.org_resources (org_id, resource_id) VALUES (v_comm_active, v_res);
  EXCEPTION WHEN insufficient_privilege THEN v_err := '42501';
  END;
  ASSERT v_err = '42501', 'INV-3: non-admin INSERT into org_resources must be blocked (42501), got '||COALESCE(v_err,'<none>');

  -- (b) an admin INSERT is allowed — this creates the visible-parent link.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.org_resources (org_id, resource_id) VALUES (v_comm_active, v_res);
  ASSERT (SELECT count(*) FROM public.org_resources WHERE org_id = v_comm_active AND resource_id = v_res) = 1,
    'INV-3: admin INSERT into org_resources must be allowed';

  -- seed a hidden-parent link (superuser) so anon read can be checked in both directions.
  RESET ROLE;
  INSERT INTO public.org_resources (org_id, resource_id) VALUES (v_comm_inactive, v_res);

  -- (c) anon reads a link iff its parent org is publicly visible.
  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  SET LOCAL ROLE anon;
  ASSERT (SELECT count(*) FROM public.org_resources WHERE org_id = v_comm_active AND resource_id = v_res) = 1,
    'INV-3: anon must SEE an org_resources link when the parent org is publicly visible';
  ASSERT (SELECT count(*) FROM public.org_resources WHERE org_id = v_comm_inactive AND resource_id = v_res) = 0,
    'INV-3: anon must NOT see an org_resources link when the parent org is is_active=false';

  -- =====================================================================
  -- INV-4 — organizations_in_bounds returns only publicly-visible NON-business orgs in bbox.
  -- =====================================================================
  ASSERT EXISTS (SELECT 1 FROM public.organizations_in_bounds(-179.9, -89.9, -179.8, -89.8) WHERE id = v_bb_in),
    'INV-4: RPC must RETURN an active non-business org inside the bbox';
  ASSERT NOT EXISTS (SELECT 1 FROM public.organizations_in_bounds(-179.9, -89.9, -179.8, -89.8) WHERE id = v_bb_biz),
    'INV-4: RPC must EXCLUDE a business org inside the bbox';
  ASSERT NOT EXISTS (SELECT 1 FROM public.organizations_in_bounds(-179.9, -89.9, -179.8, -89.8) WHERE id = v_bb_inact),
    'INV-4: RPC must EXCLUDE an inactive non-business org inside the bbox';
  ASSERT NOT EXISTS (SELECT 1 FROM public.organizations_in_bounds(-179.9, -89.9, -179.8, -89.8) WHERE id = v_bb_out),
    'INV-4: RPC must EXCLUDE a non-business org outside the bbox';

  RESET ROLE;
  RAISE NOTICE 'PASS p4b_organizations smoke: INV-1..INV-4 both directions all held';
END
$smoke$;

-- =====================================================================
-- GUEST-BLOCK (20261018000000) — a guest (anonymous sign-in, jwt is_anonymous=true) cannot
-- INSERT / UPDATE / DELETE organizations, business_hours, business_photos, business_services or
-- org_resources. To prove the RESTRICTIVE policy is the cause, the guest carries a platform-admin
-- uid (every permissive write policy passes for it); the same uid as a permanent session is the
-- control. Members keep their own-business writes; public + guest reads are unchanged.
-- =====================================================================
DO $guest$
DECLARE
  v_admin  uuid := (SELECT id FROM public.profiles WHERE is_admin = true ORDER BY id LIMIT 1);
  v_member uuid := (SELECT id FROM public.profiles WHERE is_admin IS NOT TRUE ORDER BY id LIMIT 1);
  v_res    uuid[] := ARRAY(SELECT id FROM public.resources WHERE status = 'approved' ORDER BY id LIMIT 2);
  v_org    uuid;
  v_biz    uuid;
  v_hours  uuid;
  v_photo  uuid;
  v_svc    uuid;
  v_new    uuid;
  v_n      int;
  v_err    text;
  v_tbl    text;
  v_guest_admin  text;
  v_guest_member text;
  v_admin_c      text;
  v_member_c     text;
BEGIN
  IF v_admin IS NULL OR v_member IS NULL OR cardinality(v_res) < 2 THEN
    RAISE NOTICE 'SKIP p4b guest-block smoke: needs one is_admin profile, one plain member, two approved resources';
    RETURN;
  END IF;
  v_guest_admin  := json_build_object('sub', v_admin,  'role', 'authenticated', 'is_anonymous', true)::text;
  v_guest_member := json_build_object('sub', v_member, 'role', 'authenticated', 'is_anonymous', true)::text;
  v_admin_c      := json_build_object('sub', v_admin,  'role', 'authenticated')::text;
  v_member_c     := json_build_object('sub', v_member, 'role', 'authenticated')::text;

  RESET ROLE;
  INSERT INTO public.organizations (name, org_type, is_active) VALUES ('SMOKE Guest Org', 'community', true)
    RETURNING id INTO v_org;
  INSERT INTO public.organizations (name, org_type, status, is_active, submitted_by)
    VALUES ('SMOKE Guest Biz', 'business', 'approved', true, v_member) RETURNING id INTO v_biz;
  INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz, 1, '09:00', '17:00')
    RETURNING id INTO v_hours;
  INSERT INTO public.business_photos (org_id, kind, url, storage_path) VALUES (v_biz, 'gallery', 'https://x/g.webp', 'p/g.webp')
    RETURNING id INTO v_photo;
  INSERT INTO public.business_services (org_id, name) VALUES (v_biz, 'SMOKE Svc') RETURNING id INTO v_svc;
  INSERT INTO public.org_resources (org_id, resource_id) VALUES (v_org, v_res[1]);

  -- ---------- G1: guest INSERT denied on all 5 tables ----------
  PERFORM set_config('request.jwt.claims', v_guest_admin, true);
  SET LOCAL ROLE authenticated;
  FOREACH v_tbl IN ARRAY ARRAY['organizations', 'business_hours', 'business_photos', 'business_services', 'org_resources'] LOOP
    v_err := NULL;
    BEGIN
      CASE v_tbl
        WHEN 'organizations'     THEN INSERT INTO public.organizations (name, org_type) VALUES ('SMOKE Guest Insert', 'community');
        WHEN 'business_hours'    THEN INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz, 2, '09:00', '17:00');
        WHEN 'business_photos'   THEN INSERT INTO public.business_photos (org_id, kind, url, storage_path) VALUES (v_biz, 'gallery', 'https://x/h.webp', 'p/h.webp');
        WHEN 'business_services' THEN INSERT INTO public.business_services (org_id, name) VALUES (v_biz, 'SMOKE Guest Svc');
        WHEN 'org_resources'     THEN INSERT INTO public.org_resources (org_id, resource_id) VALUES (v_org, v_res[2]);
      END CASE;
    EXCEPTION WHEN insufficient_privilege THEN v_err := '42501';
    END;
    ASSERT v_err = '42501', 'GUEST-BLOCK G1: guest INSERT into '||v_tbl||' must be denied (42501), got '||COALESCE(v_err, '<allowed>');
  END LOOP;

  -- ---------- G2: guest UPDATE + DELETE affect 0 rows on all 5 tables ----------
  UPDATE public.organizations     SET description = 'guest' WHERE id = v_org;  GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest UPDATE organizations must affect 0 rows';
  UPDATE public.business_hours    SET close_time = '18:00'  WHERE id = v_hours; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest UPDATE business_hours must affect 0 rows';
  UPDATE public.business_photos   SET caption = 'guest'     WHERE id = v_photo; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest UPDATE business_photos must affect 0 rows';
  UPDATE public.business_services SET description = 'guest' WHERE id = v_svc;   GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest UPDATE business_services must affect 0 rows';
  UPDATE public.org_resources     SET sort_order = 9        WHERE org_id = v_org; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest UPDATE org_resources must affect 0 rows';
  DELETE FROM public.business_hours    WHERE id = v_hours; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest DELETE business_hours must affect 0 rows';
  DELETE FROM public.business_photos   WHERE id = v_photo; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest DELETE business_photos must affect 0 rows';
  DELETE FROM public.business_services WHERE id = v_svc;   GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest DELETE business_services must affect 0 rows';
  DELETE FROM public.org_resources     WHERE org_id = v_org; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest DELETE org_resources must affect 0 rows';
  DELETE FROM public.organizations     WHERE id = v_org;   GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 0, 'GUEST-BLOCK G2: guest DELETE organizations must affect 0 rows';

  -- ---------- G3: guest + public reads unchanged ----------
  ASSERT (SELECT count(*) FROM public.organizations WHERE id = v_org) = 1, 'GUEST-BLOCK G3: guest still READS an active org';
  ASSERT (SELECT count(*) FROM public.business_hours WHERE org_id = v_biz) = 1, 'GUEST-BLOCK G3: guest still READS business hours';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  ASSERT (SELECT count(*) FROM public.organizations WHERE id = v_org) = 1, 'GUEST-BLOCK G3: anon still READS an active org';
  ASSERT (SELECT count(*) FROM public.org_resources WHERE org_id = v_org) = 1, 'GUEST-BLOCK G3: anon still READS org links';

  -- ---------- G4: guest member cannot write its OWN business (owner_all would allow) ----------
  PERFORM set_config('request.jwt.claims', v_guest_member, true);
  SET LOCAL ROLE authenticated;
  v_err := NULL;
  BEGIN
    INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz, 3, '09:00', '17:00');
  EXCEPTION WHEN insufficient_privilege THEN v_err := '42501';
  END;
  ASSERT v_err = '42501', 'GUEST-BLOCK G4: guest member must not write hours of its own business';
  v_err := NULL;
  BEGIN
    INSERT INTO public.organizations (name, org_type) VALUES ('SMOKE Guest Submit', 'business');
  EXCEPTION WHEN insufficient_privilege THEN v_err := '42501';
  END;
  ASSERT v_err = '42501', 'GUEST-BLOCK G4: guest must not submit a business';

  -- ---------- G5: permanent admin (control) writes all 5 tables ----------
  PERFORM set_config('request.jwt.claims', v_admin_c, true);
  INSERT INTO public.organizations (name, org_type) VALUES ('SMOKE Admin Insert', 'community') RETURNING id INTO v_new;
  INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_new, 2, '09:00', '17:00');
  INSERT INTO public.business_photos (org_id, kind, url, storage_path) VALUES (v_new, 'gallery', 'https://x/a.webp', 'p/a.webp');
  INSERT INTO public.business_services (org_id, name) VALUES (v_new, 'SMOKE Admin Svc');
  INSERT INTO public.org_resources (org_id, resource_id) VALUES (v_new, v_res[2]);
  UPDATE public.organizations     SET description = 'admin' WHERE id = v_org;     GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin UPDATE organizations must affect 1 row';
  UPDATE public.business_photos   SET caption = 'admin'     WHERE id = v_photo;   GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin UPDATE business_photos must affect 1 row';
  UPDATE public.org_resources     SET sort_order = 1        WHERE org_id = v_org; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin UPDATE org_resources must affect 1 row';
  DELETE FROM public.business_hours    WHERE org_id = v_new; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin DELETE business_hours must affect 1 row';
  DELETE FROM public.business_photos   WHERE org_id = v_new; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin DELETE business_photos must affect 1 row';
  DELETE FROM public.business_services WHERE org_id = v_new; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin DELETE business_services must affect 1 row';
  DELETE FROM public.org_resources     WHERE org_id = v_new; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin DELETE org_resources must affect 1 row';
  DELETE FROM public.organizations     WHERE id = v_new;     GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G5: admin DELETE organizations must affect 1 row';

  -- ---------- G6: permanent member keeps own-business child writes ----------
  PERFORM set_config('request.jwt.claims', v_member_c, true);
  UPDATE public.business_hours    SET close_time = '18:00'  WHERE id = v_hours; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G6: member UPDATE own business hours must affect 1 row';
  UPDATE public.business_services SET description = 'member' WHERE id = v_svc;  GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G6: member UPDATE own business services must affect 1 row';
  INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time) VALUES (v_biz, 4, '09:00', '17:00');
  DELETE FROM public.business_hours WHERE org_id = v_biz AND day_of_week = 4; GET DIAGNOSTICS v_n = ROW_COUNT;
  ASSERT v_n = 1, 'GUEST-BLOCK G6: member INSERT+DELETE own business hours must work';
  INSERT INTO public.organizations (name, org_type) VALUES ('SMOKE Member Submit', 'business');

  RESET ROLE;
  RAISE NOTICE 'PASS p4b guest-block smoke: G1-G2 guest writes denied on 5 tables, G3 reads unchanged, G4 guest member denied, G5-G6 admin + member unaffected';
END
$guest$;

ROLLBACK;
