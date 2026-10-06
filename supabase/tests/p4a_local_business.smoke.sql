-- p4a_local_business.smoke.sql
-- Behavioural smoke for the P4a local-business data plane. Every check is a rolled-back
-- WRITE that asserts observed behaviour (never a text/ILIKE grep on a function body).
--
-- Run against a database that ALREADY has migrations 20261012000000, 20261017000000
-- (businesses_in_bounds is_active filter, checked by the MAP-LEAK block) and 20261020000000
-- (create_org_event, checked by INV5) applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/p4a_local_business.smoke.sql
--   -- or via the Management API SQL endpoint (single request; it wraps one txn).
--
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. A failed ASSERT
-- aborts the transaction with the failing message. If it reaches the final NOTICE, every
-- invariant held. Portable: it discovers a >=resource_admin actor and a plain member at
-- runtime and SKIPs (with a loud NOTICE) if the fixtures are absent.

BEGIN;
-- Lock safety on shared databases: never wait on a lock longer than 2s.
SET LOCAL lock_timeout = '2s';

DO $smoke$
DECLARE
  v_admin   uuid := (SELECT id FROM public.profiles
                     WHERE admin_tier >= 'resource_admin'::public.admin_tier
                     ORDER BY admin_tier DESC LIMIT 1);
  v_member  uuid := (SELECT id FROM public.profiles
                     WHERE (admin_tier IS NULL) AND is_admin IS NOT TRUE LIMIT 1);
  v_res     uuid := (SELECT id FROM public.resources LIMIT 1);
  v_biz     uuid;
  v_err     text;
  v_status  text;
  v_before  int;
  v_after   int;
  v_host    text;
BEGIN
  IF v_admin IS NULL OR v_member IS NULL THEN
    RAISE NOTICE 'SKIP p4a smoke: needs one profile >= resource_admin and one plain member';
    RETURN;
  END IF;

  -- ============ INV1 — pending-only submit, both directions ============
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) a member submit is coerced to pending + owned by the submitter, even when the
  --     client tries to preset status='approved'.
  INSERT INTO public.organizations (name, org_type, city, state, status)
  VALUES ('SMOKE Biz', 'business', 'Burlington', 'VT', 'approved')
  RETURNING id, status INTO v_biz, v_status;
  ASSERT v_status = 'pending', 'INV1: member business must be coerced to pending, got '||v_status;
  ASSERT (SELECT submitted_by FROM public.organizations WHERE id = v_biz) = v_member,
    'INV1: submitted_by must be the submitter';
  ASSERT (SELECT moderated_by FROM public.organizations WHERE id = v_biz) IS NULL,
    'INV1: moderated_by must be NULL on submit';

  -- (b) presetting a moderation field is rejected by the guard.
  v_err := NULL;
  BEGIN
    INSERT INTO public.organizations (name, org_type, moderated_by)
    VALUES ('SMOKE Forged', 'business', v_admin);
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  ASSERT v_err LIKE 'guard:organizations_business_insert%',
    'INV1: forged moderation insert must raise guard:organizations_business_insert, got '||COALESCE(v_err,'<none>');

  -- ============ INV2 — one pin per resource ============
  IF v_res IS NOT NULL THEN
    RESET ROLE;  -- postgres bypasses the submit guard so we can set resource_id directly
    UPDATE public.organizations SET resource_id = v_res WHERE id = v_biz;
    v_err := NULL;
    BEGIN
      INSERT INTO public.organizations (name, org_type, status, resource_id)
      VALUES ('SMOKE Biz 2', 'business', 'approved', v_res);
    EXCEPTION WHEN unique_violation THEN v_err := 'UNIQUE'; END;
    ASSERT v_err = 'UNIQUE', 'INV2: a second business on the same resource_id must violate UNIQUE';
  END IF;

  -- ============ INV5 — submitter gains no privilege ============
  ASSERT (SELECT count(*) FROM public.organization_members
          WHERE org_id = v_biz AND user_id = v_member) = 0,
    'INV5: submitting a business must create no membership';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT public.is_org_admin(v_biz) IS FALSE, 'INV5: submitter must not be org admin';
  -- (20261020) create_org_event is the one event writer; the submitter must get exactly 42501
  -- (any other SQLSTATE, e.g. undefined_function, would mean the gate was never reached).
  v_host := NULL;
  BEGIN
    PERFORM public.create_org_event(v_biz, gen_random_uuid(), 'SMOKE Sneak Event', 'America/New_York',
                                    '2026-11-10 10:00'::timestamp, '2026-11-10 11:00'::timestamp, 'org');
    v_host := 'HOSTED';
  EXCEPTION WHEN others THEN v_host := SQLSTATE; END;
  ASSERT v_host = '42501', 'INV5: submitter must get 42501 hosting an event on the biz, got '||COALESCE(v_host, '<none>');
  RESET ROLE;
  ASSERT NOT EXISTS (SELECT 1 FROM public.assistance_events WHERE org_id = v_biz),
    'INV5: the refused call must write no event';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- ============ INV3 — approve/reject authority + exactly-one audit ============
  -- lower tier cannot approve
  v_err := NULL;
  BEGIN PERFORM public.approve_business(v_biz, 'self approve');
  EXCEPTION WHEN others THEN v_err := SQLERRM; END;
  ASSERT v_err LIKE 'p3_denied%', 'INV3: lower tier must be denied, got '||COALESCE(v_err,'<none>');

  -- >= resource_admin approves and writes exactly one audit row
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SELECT count(*) INTO v_before FROM public.admin_actions;
  PERFORM public.approve_business(v_biz, 'smoke: verified');
  SELECT count(*) INTO v_after FROM public.admin_actions;
  ASSERT v_after - v_before = 1, 'INV3: approve_business must write exactly one admin_actions row';
  ASSERT (SELECT status FROM public.organizations WHERE id = v_biz) = 'approved',
    'INV3: status must be approved after approve_business';
  ASSERT (SELECT action FROM public.admin_actions ORDER BY created_at DESC LIMIT 1) = 'business.approve',
    'INV3/INV7: latest audit action must be business.approve';

  -- ============ INV4 — public read scope (anon) ============
  RESET ROLE;
  INSERT INTO public.organizations (name, org_type, status)
  VALUES ('SMOKE Pending Anon', 'business', 'pending');
  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  SET LOCAL ROLE anon;
  ASSERT (SELECT count(*) FROM public.organizations WHERE name='SMOKE Pending Anon') = 0,
    'INV4: anon must NOT see a pending business';
  ASSERT (SELECT count(*) FROM public.organizations WHERE id = v_biz) = 1,
    'INV4: anon MUST see an approved business';
  RESET ROLE;

  RAISE NOTICE 'PASS p4a_local_business smoke: INV1..INV5 + INV7 audit all held';
END
$smoke$;

-- ============ MAP-LEAK — businesses_in_bounds returns ACTIVE approved located businesses only ============
-- (20261017000000) Seeded as superuser in a far-south test envelope; read as anon, the public map surface.
SET LOCAL search_path TO public, extensions, pg_temp;

DO $mapleak$
DECLARE
  v_active   uuid;
  v_inactive uuid;
  v_pending  uuid;
BEGIN
  RESET ROLE;
  INSERT INTO public.organizations (name, org_type, status, is_active, location)
  VALUES ('SMOKE Map Active', 'business', 'approved', true,
          st_setsrid(st_makepoint(-179.75, -89.75), 4326)::geography) RETURNING id INTO v_active;
  INSERT INTO public.organizations (name, org_type, status, is_active, location)
  VALUES ('SMOKE Map Inactive', 'business', 'approved', false,
          st_setsrid(st_makepoint(-179.75, -89.75), 4326)::geography) RETURNING id INTO v_inactive;
  INSERT INTO public.organizations (name, org_type, status, is_active, location)
  VALUES ('SMOKE Map Pending', 'business', 'pending', true,
          st_setsrid(st_makepoint(-179.75, -89.75), 4326)::geography) RETURNING id INTO v_pending;

  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  SET LOCAL ROLE anon;
  ASSERT EXISTS (SELECT 1 FROM public.businesses_in_bounds(-179.8, -89.8, -179.7, -89.7) WHERE id = v_active),
    'MAP-LEAK: an active approved located business MUST appear';
  ASSERT NOT EXISTS (SELECT 1 FROM public.businesses_in_bounds(-179.8, -89.8, -179.7, -89.7) WHERE id = v_inactive),
    'MAP-LEAK: an inactive (deactivated) business must NOT appear';
  ASSERT NOT EXISTS (SELECT 1 FROM public.businesses_in_bounds(-179.8, -89.8, -179.7, -89.7) WHERE id = v_pending),
    'MAP-LEAK: a pending business must NOT appear';
  RESET ROLE;

  RAISE NOTICE 'PASS p4a map-leak smoke: businesses_in_bounds excludes inactive + pending, keeps active approved';
END
$mapleak$;

ROLLBACK;
