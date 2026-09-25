-- P3.0 — Close security gaps: moderation-authority guards on resources (I1),
-- post_comments (I6) and organizations (I3), the volunteer-withdraw fix (I1b), and
-- moderated-pin integrity on set_resource_location_by_id.
--
-- WHY TRIGGERS (SECURITY INVOKER), NOT GRANTS OR RLS-CHECKS:
--   * A column GRANT cannot tell a platform admin apart from an ordinary user, cannot
--     express "only while active", and would break the legitimate suggest / volunteer /
--     admin-direct-edit payloads.
--   * An RLS WITH CHECK cannot compare NEW against OLD, so it cannot say
--     "moderated_by unchanged" or "created_by unchanged".
--   * A BEFORE trigger sees OLD and NEW and runs as the CALLER's role, so it can enforce
--     exactly the moderation-authority boundary and nothing more.
--
-- TRUSTED WRITERS PASS UNTOUCHED. Every guard exits at the first test when current_user is
-- not a client role: service_role (edge pipelines, BYPASSRLS), postgres (the owner of every
-- SECURITY DEFINER RPC — approve_resource / reject_resource / admin_update_resource /
-- set_resource_location_by_id — and of migrations / Management-API SQL), and supabase_admin.
-- Client roles (authenticated, anon) pass only when they hold the relevant authority:
-- platform admins via is_current_user_admin(), comment staff via profiles.is_staff.
--
-- SECURITY INVOKER IS LOAD-BEARING. A SECURITY DEFINER trigger would always see
-- current_user = postgres and would therefore never enforce against a client.
--
-- OBSERVABILITY. Every rejection raises SQLSTATE 42501 with a stable, greppable message
-- prefix per guard (guard:resources_moderation_fields / guard:post_comments_is_hidden /
-- guard:organizations_admin_fields) plus a HINT, so operators can count rejections per guard
-- in postgres_logs: source='postgres_logs' AND position('guard:resources_moderation_fields'
-- IN event_message) > 0.
--
-- NO SCHEMA SHAPE CHANGE. No column or type is added, so packages/database/types.ts is
-- unchanged and no gen-types run is required. Apply via the Management API and record the
-- version in supabase_migrations.schema_migrations (ledger discipline).

-- ─── I1: resources — status / moderation fields are set by moderators only ───────────────
-- A client INSERT lands EXACTLY pending (a NULL status is a violation — never let a NULL slip
-- past as "not pending"), with every moderation field empty; the ONE exception is a volunteer
-- listing (is_volunteer_resource = true), which its own submitter may insert approved, still
-- with every moderation field empty. A client UPDATE may touch no moderation field and may not
-- change status EXCEPT the one legitimate client transition: a volunteer withdrawing their own
-- listing (pending OR approved -> archived). Moderation fields:
-- moderated_by, moderated_at, is_verified, last_verified_at, rejection_reason.
CREATE OR REPLACE FUNCTION public.guard_resources_moderation_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF current_user = 'authenticated' AND public.is_current_user_admin() THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- IS NOT DISTINCT FROM so a NULL status fails both arms and is rejected.
    IF NOT (NEW.status IS NOT DISTINCT FROM 'pending'
            OR (NEW.status IS NOT DISTINCT FROM 'approved' AND COALESCE(NEW.is_volunteer_resource, false))) THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'guard:resources_moderation_fields: status is set by moderators only',
        DETAIL  = format('attempted status=%s is_volunteer_resource=%s', NEW.status, NEW.is_volunteer_resource),
        HINT    = 'Submit the resource as pending; a moderator approves it (volunteer listings may be inserted approved).';
    END IF;
    IF NEW.moderated_by IS NOT NULL
       OR NEW.moderated_at IS NOT NULL
       OR COALESCE(NEW.is_verified, false)
       OR NEW.last_verified_at IS NOT NULL
       OR NEW.rejection_reason IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'guard:resources_moderation_fields: moderation fields are set by moderators only',
        DETAIL  = format('moderated_by=%s moderated_at=%s is_verified=%s last_verified_at=%s rejection_reason=%s',
                         NEW.moderated_by, NEW.moderated_at, NEW.is_verified, NEW.last_verified_at, NEW.rejection_reason),
        HINT    = 'Leave moderated_by / moderated_at / is_verified / last_verified_at / rejection_reason unset; a moderator sets them.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE by a non-admin client.
  IF NEW.moderated_by     IS DISTINCT FROM OLD.moderated_by
  OR NEW.moderated_at     IS DISTINCT FROM OLD.moderated_at
  OR NEW.is_verified      IS DISTINCT FROM OLD.is_verified
  OR NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at
  OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:resources_moderation_fields: moderation fields are set by moderators only',
      HINT    = 'Only a moderator changes moderated_by / moderated_at / is_verified / last_verified_at / rejection_reason.';
  END IF;

  -- is_volunteer_resource is fixed at creation. Flipping it on an existing row would otherwise
  -- unlock the volunteer-only carve-outs (self-withdraw here, and the owner path of
  -- set_resource_location_by_id), letting a non-volunteer pending pin be archived or, once a
  -- moderator approves it, relocated by its submitter.
  IF NEW.is_volunteer_resource IS DISTINCT FROM OLD.is_volunteer_resource THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:resources_moderation_fields: is_volunteer_resource is set only when the listing is created',
      HINT    = 'Whether a resource is a volunteer listing is fixed when it is created.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- The only client-legitimate status change is a volunteer withdrawing their OWN listing,
    -- whether it is still pending or already approved. A rejected listing stays rejected.
    IF NOT (OLD.status IN ('pending', 'approved')
            AND NEW.status = 'archived'
            AND COALESCE(OLD.is_volunteer_resource, false)
            AND auth.uid() = OLD.submitted_by) THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'guard:resources_moderation_fields: status is set by moderators only',
        DETAIL  = format('attempted %s -> %s', OLD.status, NEW.status),
        HINT    = 'Only a moderator changes status; a volunteer may withdraw their own listing (pending/approved -> archived).';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_resources_guard_moderation
  BEFORE INSERT OR UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.guard_resources_moderation_fields();

-- I1b: give the volunteer owner an RLS path to withdraw their own listing (pending or
-- approved) by archiving it. Today the only client UPDATE policy ("Users can update their
-- pending submissions") holds the new row at status='pending', so archiving matches zero rows
-- and PostgREST reports success with no error — a silent no-op. This permissive policy matches
-- the owner's own volunteer row (USING) and permits it to become archived (WITH CHECK) and
-- nothing else. The guard above still forbids any moderation-field write on the same statement.
CREATE POLICY "Volunteers can withdraw their own listing" ON public.resources
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = submitted_by AND is_volunteer_resource = true AND status IN ('pending', 'approved'))
  WITH CHECK ((select auth.uid()) = submitted_by AND is_volunteer_resource = true AND status = 'archived');

-- ─── Moderated-pin integrity: set_resource_location_by_id ────────────────────────────────
-- A moderated resource's coordinates must not be moved by its submitter after moderation. The
-- owner path applies only while the row is still pending, or when it is the owner's own
-- volunteer listing, and it resets geocode_accuracy to NULL so a rooftop tag never lingers on
-- coordinates the user chose. Admin and server (auth.uid() IS NULL) paths are unchanged.
CREATE OR REPLACE FUNCTION public.set_resource_location_by_id(p_id uuid, p_lat double precision, p_lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Anonymous guard: guests may not perform write actions.
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  -- Admin and server paths unchanged: set location, leave geocode_accuracy as-is.
  IF auth.uid() IS NULL OR public.is_current_user_admin() THEN
    UPDATE public.resources
      SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      WHERE id = p_id;
    RETURN;
  END IF;

  -- Owner path: only the caller's OWN resource, and only while it is still pending or is their
  -- own volunteer listing. Reset geocode_accuracy so a moderator's rooftop tag never stays on
  -- coordinates the user picked.
  IF NOT EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = p_id
      AND r.submitted_by = auth.uid()
      AND (r.status = 'pending' OR r.is_volunteer_resource = true)
  ) THEN
    RAISE EXCEPTION 'not authorized to set location for this resource'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.resources
    SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        geocode_accuracy = NULL
    WHERE id = p_id;
END $$;

-- ─── I6: post_comments — is_hidden is set / cleared by staff (or the server) only ────────
-- Users keep inserting and replying to comments exactly as today (their payloads never carry
-- is_hidden). Only staff (profiles.is_staff, read inline exactly as every content-moderation
-- RPC does, so this guard tracks is_staff semantics automatically as P3 tiers extend them) or
-- a server role (service_role / postgres) may set or clear is_hidden.
CREATE OR REPLACE FUNCTION public.guard_post_comments_is_hidden()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF current_user = 'authenticated'
     AND COALESCE((SELECT p.is_staff FROM public.profiles p WHERE p.id = auth.uid()), false) THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.is_hidden, false))
  OR (TG_OP = 'UPDATE' AND NEW.is_hidden IS DISTINCT FROM OLD.is_hidden) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:post_comments_is_hidden: comment visibility is set by moderators only',
      HINT    = 'Only moderators can hide or show comments.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_post_comments_guard_is_hidden
  BEFORE INSERT OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_comments_is_hidden();

-- ─── I3: organizations — org admins edit descriptive fields of their OWN ACTIVE org only ──
-- Platform admins keep full control (bypass). An org admin (reaching this row via the
-- permissive orgs_update_org_admin policy) may edit descriptive fields — including org_type —
-- but only while the org is active, and may never change is_active, created_by, id or
-- created_at. The W1.6a deactivation cascade (AFTER UPDATE OF is_active) is untouched and
-- still fires whenever a platform admin flips is_active.
CREATE OR REPLACE FUNCTION public.guard_organizations_org_admin_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF current_user = 'authenticated' AND public.is_current_user_admin() THEN RETURN NEW; END IF;
  IF OLD.is_active IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:organizations_admin_fields: an inactive organization is edited by platform admins only',
      HINT    = 'Ask a platform admin to reactivate the organization.';
  END IF;
  IF NEW.is_active  IS DISTINCT FROM OLD.is_active
  OR NEW.created_by IS DISTINCT FROM OLD.created_by
  OR NEW.id         IS DISTINCT FROM OLD.id
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:organizations_admin_fields: is_active, created_by, id and created_at are set by platform admins only',
      HINT    = 'Org admins may edit descriptive fields (name, description, org_type, contact, location) of their own active org.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_organizations_guard_org_admin
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_organizations_org_admin_update();

-- The guard functions are only ever invoked by their triggers. Postgres does not check
-- EXECUTE on a trigger function when the trigger fires (the privilege is checked only for a
-- direct call / CREATE TRIGGER), so revoking it from client roles is safe and removes a
-- needless direct-call surface.
REVOKE EXECUTE ON FUNCTION
    public.guard_resources_moderation_fields(),
    public.guard_post_comments_is_hidden(),
    public.guard_organizations_org_admin_update()
  FROM PUBLIC, anon, authenticated;

-- ─── Side fix (trivially safe): drop the duplicate updated_at trigger on post_comments ────
-- post_comments carried TWO BEFORE UPDATE ROW triggers that both do exactly
-- "NEW.updated_at = now()": set_post_comments_updated_at (update_updated_at_column) and
-- update_comments_updated_at (update_updated_at). The two functions are byte-identical in
-- effect and are shared by other tables, so we drop the redundant TRIGGER only (not the
-- function) and keep update_comments_updated_at.
DROP TRIGGER IF EXISTS set_post_comments_updated_at ON public.post_comments;
