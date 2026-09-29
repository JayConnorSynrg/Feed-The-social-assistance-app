-- p4b_organizations.smoke.sql
-- Behavioural smoke for the P4b informational-organizations data plane. Every check is a
-- rolled-back WRITE that asserts observed behaviour (never a text/ILIKE grep on a policy
-- or function body).
--
-- Run against a database that ALREADY has migration 20261015000000 applied, e.g.:
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

ROLLBACK;
