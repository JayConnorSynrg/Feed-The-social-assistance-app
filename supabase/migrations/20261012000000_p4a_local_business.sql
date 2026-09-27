-- 20261012000000_p4a_local_business.sql
-- P4a — local-business data plane.
--
-- Adds a `business` org_type plus a moderation lifecycle to public.organizations so
-- authenticated members can SUBMIT a local business (always pending), a resource_admin
-- can APPROVE / REJECT it, and the public map can read only approved businesses.
--
-- Design mirrors the existing resource-moderation plane verbatim in shape:
--   * status/moderated_by/moderated_at/rejection_reason columns  (cf. resources)
--   * approve_business/reject_business SECDEF RPCs                 (cf. approve_resource)
--   * businesses_in_bounds explicit-TABLE bbox reader             (cf. resources_in_bounds)
--   * record_admin_action(... 'organization', id, 'ok', reason, '{}', request_id())
--
-- Migration order (5-step): (1) no new extensions; (2) core-table constraint + columns;
-- (3) submit guard + RLS; (4) moderation + map RPCs; (5) hygiene + event-picker gate.
--
-- Everything runs in ONE transaction and the schema_migrations ledger row is written in
-- the SAME transaction (atomic apply-or-nothing).

BEGIN;

-- ---------------------------------------------------------------------------
-- (2) Core-table change: extend org_type CHECK to admit 'business'.
--     A CHECK constraint (not a Postgres enum) already governs org_type, so we
--     replace the constraint rather than ALTER TYPE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations DROP CONSTRAINT organizations_org_type_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_org_type_check
  CHECK (org_type = ANY (ARRAY[
    'food_bank','pantry','shelter','clinic','mutual_aid','other','business'
  ]::text[]));

-- Moderation lifecycle + provenance + one-pin linkage.
--   status DEFAULT 'approved' keeps EVERY pre-existing (admin-created) org usable and
--   readable; the BEFORE INSERT guard below forces 'pending' for member business submits.
--   resource_id is nullable + UNIQUE + FK ON DELETE SET NULL => at most one business per
--   resource, enforced by the DB (INV2).
ALTER TABLE public.organizations
  ADD COLUMN status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN moderated_by uuid NULL,
  ADD COLUMN moderated_at timestamptz NULL,
  ADD COLUMN rejection_reason text NULL,
  ADD COLUMN submitted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN resource_id uuid NULL UNIQUE REFERENCES public.resources(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- (3a) BEFORE INSERT guard — caller-role based, mirrors guard_organizations_org_admin_update.
--      INV1 / INV5: a business inserted by a non-platform-admin ALWAYS lands pending, owned
--      by auth.uid(), with every moderation field NULL, and creates no privilege. The guard
--      COERCES the safe shape (cannot be bypassed by the client) and additionally RAISES a
--      greppable `guard:organizations_business_insert` on any attempt to preset moderation-
--      authority fields (forged pre-approval). service_role / postgres bypass unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_organizations_business_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  -- Pipelines / admin tooling running as service_role or postgres bypass unchanged.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  -- Platform admins create pre-approved orgs of any type (default status='approved').
  IF current_user = 'authenticated' AND public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;
  -- Non-admin authenticated / anon: only org_type='business' is RLS-permitted to insert;
  -- any other org_type is rejected by the RLS WITH CHECK, so pass it through untouched.
  IF NEW.org_type <> 'business' THEN
    RETURN NEW;
  END IF;
  -- Presetting moderation-authority fields is never legitimate on a member submit
  -- (a forged pre-approval / pre-rejection). Reject with a greppable prefix.
  IF NEW.moderated_by IS NOT NULL
     OR NEW.moderated_at IS NOT NULL
     OR NEW.rejection_reason IS NOT NULL
     OR (NEW.submitted_by IS NOT NULL AND NEW.submitted_by IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:organizations_business_insert: status and moderation fields are set by resource admins only',
      HINT    = 'Submit a business with descriptive + contact fields only; it enters review as pending.';
  END IF;
  -- Force the safe submission shape regardless of what the client sent.
  NEW.status           := 'pending';
  NEW.submitted_by     := auth.uid();
  NEW.moderated_by     := NULL;
  NEW.moderated_at     := NULL;
  NEW.rejection_reason := NULL;
  RETURN NEW;
END $fn$;

-- Default privileges auto-grant EXECUTE to anon/authenticated on new public functions,
-- so REVOKE must name them, not only PUBLIC. This is a trigger function (never called
-- directly); strip anon/authenticated/PUBLIC — the trigger fires regardless of grants.
REVOKE EXECUTE ON FUNCTION public.guard_organizations_business_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_organizations_guard_business_insert
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_organizations_business_insert();

-- ---------------------------------------------------------------------------
-- (3b) RLS — submit + public read.
-- ---------------------------------------------------------------------------
-- INV1: authenticated members may INSERT ONLY business orgs. The pre-existing
--       orgs_admin_insert (authenticated + is_current_user_admin) is unchanged; permissive
--       policies OR together, so admins keep full insert authority for every org_type.
CREATE POLICY orgs_business_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (org_type = 'business');

-- A submitter must be able to read back their OWN business at any status (submission
-- confirmation, pending state, rejection_reason). This also makes the client's
-- `INSERT ... organizations ... RETURNING` work: under RLS, RETURNING re-reads the row
-- through the SELECT policy, and a pending business is otherwise invisible to everyone.
-- anon is unaffected (submitted_by = auth.uid() is NULL for anon, and this is TO
-- authenticated), so INV4's public/anon scope is unchanged.
CREATE POLICY orgs_select_own_submission ON public.organizations
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- INV4: public/anon read.  Permissive policies OR (they can only widen), so the pending
--       business rows (is_active defaults true) would leak through the existing is_active-only
--       rule if we merely ADDED a policy. We therefore TIGHTEN the existing permissive rule:
--       non-business rows behave EXACTLY as before (is_active = true); business rows are public
--       only when status='approved'. Platform admins keep full visibility via the separate
--       permissive orgs_admin_select policy (needed to moderate pending business).
ALTER POLICY orgs_select_active ON public.organizations
  USING (is_active = true AND (org_type <> 'business' OR status = 'approved'));

-- ---------------------------------------------------------------------------
-- (4a) Moderation RPCs — SECDEF, tier-gated, exactly-one audit row each.
--      Shape mirrors approve_resource verbatim: tier gate -> UPDATE -> record_admin_action.
--      is_active is intentionally NOT touched (visibility is governed by status), which
--      keeps the AFTER UPDATE OF is_active cascade (organizations_cascade_deactivate) inert.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_business(p_org_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.current_user_tier_at_least('resource_admin') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  UPDATE public.organizations
     SET status = 'approved',
         moderated_by = auth.uid(),
         moderated_at = now(),
         rejection_reason = NULL,
         updated_at = now()
   WHERE id = p_org_id AND org_type = 'business';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'business % not found', p_org_id USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.record_admin_action(auth.uid(), 'business.approve', 'organization', p_org_id::text,
    'ok', p_reason, '{}'::jsonb, public.request_id());
END $fn$;

CREATE OR REPLACE FUNCTION public.reject_business(p_org_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.current_user_tier_at_least('resource_admin') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  UPDATE public.organizations
     SET status = 'rejected',
         moderated_by = auth.uid(),
         moderated_at = now(),
         rejection_reason = p_reason,
         updated_at = now()
   WHERE id = p_org_id AND org_type = 'business';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'business % not found', p_org_id USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.record_admin_action(auth.uid(), 'business.reject', 'organization', p_org_id::text,
    'ok', p_reason, '{}'::jsonb, public.request_id());
END $fn$;

-- Strip PUBLIC + the default-privilege anon grant (mirrors approve_resource, which is
-- exposed to authenticated + service_role only). The tier gate blocks lower callers at
-- runtime; revoking anon EXECUTE closes it at the grant layer too (defense in depth).
REVOKE EXECUTE ON FUNCTION public.approve_business(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_business(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_business(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_business(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- (4b) Map bbox reader — explicit column list, mirrors resources_in_bounds' shape.
--      Approved business orgs only; SECDEF + STABLE sql + pinned search_path incl. extensions
--      for PostGIS operators, granted to anon + authenticated exactly like resources_in_bounds.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.businesses_in_bounds(
  min_lng double precision, min_lat double precision,
  max_lng double precision, max_lat double precision,
  max_results integer DEFAULT 500)
 RETURNS TABLE(
   id uuid, name text, description text, org_type text,
   address text, city text, state text, phone text, website text,
   location geography, resource_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $fn$
  SELECT id, name, description, org_type, address, city, state, phone, website, location, resource_id
  FROM organizations
  WHERE org_type = 'business' AND status = 'approved' AND location IS NOT NULL
    AND location::geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  ORDER BY name
  LIMIT max_results;
$fn$;

REVOKE EXECUTE ON FUNCTION public.businesses_in_bounds(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.businesses_in_bounds(double precision, double precision, double precision, double precision, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- (5a) Hygiene fix (pre-existing): update_organizations_updated_at() is a trigger function
--      (invoked by the trigger, never called directly) yet carried EXECUTE for PUBLIC/anon/
--      authenticated. Strip the broad grants; the trigger keeps firing regardless of grants.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.update_organizations_updated_at() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (5b) INV6 gate: business orgs are a distinct data plane, not aid orgs that host events.
--      Exclude them from the event-management admin org list (feeds the event scheduler
--      picker + the admin-shell Events section). Body is otherwise identical to the prior
--      definition; only `AND o.org_type <> 'business'` is added to each branch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_org_list()
 RETURNS TABLE(id uuid, name text, org_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF (SELECT is_admin FROM public.profiles WHERE profiles.id = auth.uid()) THEN
    RETURN QUERY
      SELECT o.id, o.name, o.org_type
      FROM public.organizations o
      WHERE o.is_active = true
        AND o.org_type <> 'business'
      ORDER BY o.name;
  ELSE
    RETURN QUERY
      SELECT o.id, o.name, o.org_type
      FROM public.organizations o
      JOIN public.organization_members om ON om.org_id = o.id
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND o.is_active = true
        AND o.org_type <> 'business'
      ORDER BY o.name;
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261012000000', 'p4a_local_business');

COMMIT;
