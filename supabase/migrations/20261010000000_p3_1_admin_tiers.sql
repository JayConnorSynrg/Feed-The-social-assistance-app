-- P3.1 — Three admin tiers, nomination only.
-- Community Moderator (CM) < Resource Admin (RA) < Platform Admin (PA).
--
-- Model: profiles.admin_tier is the single source of truth. A BEFORE trigger derives the
-- two legacy booleans from it (is_admin = tier=platform_admin ; is_staff = tier IS NOT NULL),
-- so all 48 is_current_user_admin() policies/RPCs become PA and all is_staff readers become
-- CM+ with zero predicate edits. Only the 6 RA resource fns, the 6 CM moderation RPCs, and
-- admin_list_users are edited explicitly. A tier changes only through admin_set_tier (nomination
-- by a strictly higher tier; the founder for anything touching PA) or the audited service_set_tier.
-- Every privileged action writes exactly one public.admin_actions row.
--
-- Slot 20261010000000 confirmed free in prod (highest applied 20261008000000). Lands after P3.0
-- (20261009000000). SECDEF hardening per pattern-security-definer-hardening. Column grants read
-- from pg_attribute.attacl. No ALTER PUBLICATION ... SET TABLE anywhere.

-- Bound how long this migration will wait on a lock before failing, so a stray lock cannot
-- hang the deploy. (statement_timeout is set by the deploy harness per transaction.)
SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- 1. Tier storage + public marker
-- ============================================================================
CREATE TYPE public.admin_tier AS ENUM ('community_moderator', 'resource_admin', 'platform_admin');

ALTER TABLE public.profiles ADD COLUMN admin_tier public.admin_tier;  -- NULL = no tier

-- T4: the tier marker is PUBLIC (feed cards, profiles). Read-only for clients; NO write grant.
-- is_staff was already anon-readable, so this makes public only what was already enumerable.
GRANT SELECT (admin_tier) ON public.profiles TO anon, authenticated;

-- ============================================================================
-- 2. Flag-derivation trigger (replaces sync_is_staff / sync_is_staff_trigger)
-- ============================================================================
-- is_admin and is_staff are ALWAYS derived from admin_tier. A direct write to admin_tier from any
-- client role raises; a direct write to is_admin / is_staff is silently recomputed from admin_tier.
-- Only admin_set_tier / service_set_tier (which SET feed.tier_write='on' for their own txn) may
-- change admin_tier.
CREATE OR REPLACE FUNCTION public.sync_tier_flags()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.admin_tier IS DISTINCT FROM OLD.admin_tier
     AND COALESCE(current_setting('feed.tier_write', true), '') <> 'on' THEN
    RAISE EXCEPTION 'p3_denied:tier_direct_write' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT'
     AND NEW.admin_tier IS NOT NULL
     AND COALESCE(current_setting('feed.tier_write', true), '') <> 'on' THEN
    NEW.admin_tier := NULL;
  END IF;
  -- COALESCE: is_admin/is_staff are NEVER NULL. (NEW.admin_tier = 'platform_admin') is NULL when
  -- admin_tier IS NULL, so without COALESCE a tier-less signup or a revoked user would get NULL.
  NEW.is_admin := COALESCE(NEW.admin_tier = 'platform_admin', false);
  NEW.is_staff := COALESCE(NEW.admin_tier IS NOT NULL, false);
  RETURN NEW;
END;
$$;
-- Trigger functions are invoked by the trigger, never called directly.
REVOKE EXECUTE ON FUNCTION public.sync_tier_flags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_is_staff_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_is_staff();

CREATE TRIGGER sync_tier_flags_trigger
  BEFORE INSERT OR UPDATE OF admin_tier, is_admin, is_staff ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_tier_flags();

-- Backfill: the two existing platform admins become PA (zero behavior change — is_admin/is_staff
-- stay true). tier_write flag is transaction-local to this migration only.
SELECT set_config('feed.tier_write', 'on', true);
UPDATE public.profiles SET admin_tier = 'platform_admin' WHERE is_admin;
SELECT set_config('feed.tier_write', 'off', true);

-- ============================================================================
-- 3. Founder (singleton). PA can be granted/revoked ONLY by the founder.
-- ============================================================================
CREATE TABLE public.platform_founder (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id   uuid NOT NULL
);
ALTER TABLE public.platform_founder ENABLE ROW LEVEL SECURITY;  -- no policies: unreadable/unwritable by clients
REVOKE ALL ON public.platform_founder FROM anon, authenticated, service_role;

-- Founder profile id ae6e0953-6425-4531-89fe-57feab106a24 (jcreationsrai@gmail.com, verified n=1
-- in prod this session). Hard-coded per D6 — no PII (email) in the repo.
INSERT INTO public.platform_founder (user_id) VALUES ('ae6e0953-6425-4531-89fe-57feab106a24');

-- is_founder answers ONLY for the caller (auth.uid()); it never reveals whether an arbitrary
-- user is the founder. service_set_tier checks a target against platform_founder directly.
CREATE FUNCTION public.is_founder()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_founder WHERE user_id = auth.uid()) $$;
REVOKE EXECUTE ON FUNCTION public.is_founder() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_founder() TO authenticated, service_role;

-- ============================================================================
-- 4. Tier helpers
-- ============================================================================
CREATE FUNCTION public.current_user_tier()
  RETURNS public.admin_tier
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$ SELECT admin_tier FROM public.profiles WHERE id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.current_user_tier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tier() TO authenticated, service_role;

CREATE FUNCTION public.current_user_tier_at_least(p public.admin_tier)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$ SELECT COALESCE(public.current_user_tier() >= p, false) $$;
REVOKE EXECUTE ON FUNCTION public.current_user_tier_at_least(public.admin_tier) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tier_at_least(public.admin_tier) TO authenticated, service_role;

-- Internal: tier of an arbitrary user. Not client-callable.
CREATE FUNCTION public.tier_of(p_user uuid)
  RETURNS public.admin_tier
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$ SELECT admin_tier FROM public.profiles WHERE id = p_user $$;
REVOKE EXECUTE ON FUNCTION public.tier_of(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tier_of(uuid) TO service_role;

-- request_id: the client-minted x-request-id, so the durable audit row and the app_logs
-- latency/error telemetry share one id. NULL under direct SQL (no request.headers).
-- request_id: the client-minted x-request-id. Capped at 64 chars and validated to a uuid/simple
-- token pattern; anything else stores NULL (no unbounded/garbage ids in the audit trail).
CREATE FUNCTION public.request_id()
  RETURNS text
  LANGUAGE sql STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN v ~ '^[A-Za-z0-9_-]{1,64}$' THEN v END
  FROM (SELECT NULLIF(current_setting('request.headers', true), '')::json ->> 'x-request-id' AS v) s
$$;
REVOKE EXECUTE ON FUNCTION public.request_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_id() TO authenticated, service_role;

-- ============================================================================
-- 5. Audit table (T5) + writer
-- ============================================================================
CREATE TABLE public.admin_actions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,                      -- NULL = system (service_set_tier / migration)
  actor_tier  public.admin_tier,         -- snapshot
  action      text NOT NULL,             -- tier.set | user.ban | user.unban | user.delete
                                         -- | post.remove | post.hold | post.authorize | report.resolve
                                         -- | safety_alert.verify | safety_alert.remove
                                         -- | resource.approve | resource.reject | resource.update | resource.set_location
  target_type text NOT NULL,
  target_id   text,                      -- no FK: survives user delete
  target_tier public.admin_tier,
  outcome     text NOT NULL CHECK (outcome IN ('ok', 'denied', 'error')),
  reason      text,                      -- denial code or admin-supplied reason
  details     jsonb NOT NULL DEFAULT '{}',
  request_id  text
);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_actions FROM anon, authenticated;
GRANT SELECT ON public.admin_actions TO authenticated;                 -- gated to PA by policy
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_actions FROM service_role;  -- append-only; only record_admin_action (SECDEF) writes
CREATE POLICY admin_actions_select_pa ON public.admin_actions
  FOR SELECT TO authenticated USING ((SELECT public.is_current_user_admin()));
CREATE INDEX admin_actions_created_at_idx ON public.admin_actions (created_at DESC);
CREATE INDEX admin_actions_target_idx ON public.admin_actions (target_type, target_id);

-- Writer: computes actor_tier / target_tier itself. service_role EXECUTE only; SECDEF RPCs call
-- it as owner. It never RAISEs, so a caller that wants a durable denial row can write one and
-- then return {ok:false}.
CREATE FUNCTION public.record_admin_action(
  p_actor       uuid,
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_outcome     text,
  p_reason      text DEFAULT NULL,
  p_details     jsonb DEFAULT '{}',
  p_request_id  text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_tier public.admin_tier;
BEGIN
  -- Caps (fix: bound audit inputs, applies to every caller incl. the API routes):
  --   request_id -> uuid/simple-token pattern, <=64 chars, else NULL; reason -> <=500 chars.
  p_request_id := CASE WHEN p_request_id ~ '^[A-Za-z0-9_-]{1,64}$' THEN p_request_id ELSE NULL END;
  p_reason     := left(p_reason, 500);
  -- target_tier is meaningful only when the target is a user (ban/delete/tier.set).
  IF p_target_type IN ('user', 'tier') AND p_target_id IS NOT NULL THEN
    BEGIN
      v_target_tier := public.tier_of(p_target_id::uuid);
    EXCEPTION WHEN others THEN
      v_target_tier := NULL;
    END;
  END IF;
  INSERT INTO public.admin_actions
    (actor_id, actor_tier, action, target_type, target_id, target_tier, outcome, reason, details, request_id)
  VALUES
    (p_actor, public.tier_of(p_actor), p_action, p_target_type, p_target_id, v_target_tier,
     p_outcome, p_reason, COALESCE(p_details, '{}'::jsonb), p_request_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_admin_action(uuid, text, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_action(uuid, text, text, text, text, text, jsonb, text) TO service_role;

-- ============================================================================
-- 6. Grant / revoke (nomination) + break-glass + people list
-- ============================================================================
-- admin_set_tier: nomination by a strictly higher tier; the founder for anything touching PA.
-- The FIRST failing check writes one 'denied' row and returns {ok:false, code} WITHOUT RAISE, so
-- the denial row commits (D4). No self-target; no thresholds; no self-request.
CREATE FUNCTION public.admin_set_tier(
  p_target     uuid,
  p_tier       public.admin_tier,   -- NULL = revoke
  p_reason     text DEFAULT NULL,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old   public.admin_tier;
  v_rid   text := COALESCE(p_request_id, public.request_id());
BEGIN
  -- Callers with NO tier (guests, anonymous, plain users) get a structured denial with NO durable
  -- row — the RAISE lands in postgres_logs so the attempt is still observable, but the append-only
  -- admin_actions table is not writable by every anonymous probe. Only tier-holders (whose denials
  -- are meaningful moderation-authority events) produce durable rows below.
  IF v_actor IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'p3_denied:auth' USING ERRCODE = '42501';
  END IF;
  IF public.current_user_tier() IS NULL THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;

  -- 2. no self-target
  IF p_target = v_actor THEN
    PERFORM public.record_admin_action(v_actor, 'tier.set', 'tier', p_target::text, 'denied', 'self',
      jsonb_build_object('to', p_tier), v_rid);
    RETURN jsonb_build_object('ok', false, 'code', 'self');
  END IF;

  v_old := public.tier_of(p_target);

  -- 3. no-op
  IF v_old IS NOT DISTINCT FROM p_tier THEN
    PERFORM public.record_admin_action(v_actor, 'tier.set', 'tier', p_target::text, 'denied', 'no_change',
      jsonb_build_object('from', v_old, 'to', p_tier), v_rid);
    RETURN jsonb_build_object('ok', false, 'code', 'no_change');
  END IF;

  -- 4/5. authority: anything touching PA is founder-only; otherwise the actor must outrank both
  --      the old and the new tier (NULL treated as lowest).
  IF 'platform_admin' IN (v_old, p_tier) THEN
    IF NOT public.is_founder() THEN
      PERFORM public.record_admin_action(v_actor, 'tier.set', 'tier', p_target::text, 'denied', 'founder_only',
        jsonb_build_object('from', v_old, 'to', p_tier), v_rid);
      RETURN jsonb_build_object('ok', false, 'code', 'founder_only');
    END IF;
  ELSIF NOT COALESCE(public.current_user_tier() > GREATEST(v_old, p_tier), false) THEN  -- NULL actor tier = lowest = never outranks
    PERFORM public.record_admin_action(v_actor, 'tier.set', 'tier', p_target::text, 'denied', 'insufficient_tier',
      jsonb_build_object('from', v_old, 'to', p_tier), v_rid);
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_tier');
  END IF;

  -- 6. target must be a real (non-anonymous) user with a profile
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_target AND (u.is_anonymous = false OR u.is_anonymous IS NULL)
  ) THEN
    PERFORM public.record_admin_action(v_actor, 'tier.set', 'tier', p_target::text, 'denied', 'target_invalid',
      jsonb_build_object('from', v_old, 'to', p_tier), v_rid);
    RETURN jsonb_build_object('ok', false, 'code', 'target_invalid');
  END IF;

  -- apply
  PERFORM set_config('feed.tier_write', 'on', true);
  UPDATE public.profiles SET admin_tier = p_tier WHERE id = p_target;
  PERFORM set_config('feed.tier_write', 'off', true);

  PERFORM public.record_admin_action(v_actor, 'tier.set', 'tier', p_target::text, 'ok', p_reason,
    jsonb_build_object('from', v_old, 'to', p_tier), v_rid);
  RETURN jsonb_build_object('ok', true, 'from', v_old, 'to', p_tier);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_tier(uuid, public.admin_tier, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_tier(uuid, public.admin_tier, text, text) TO authenticated;

-- service_set_tier: break-glass, service_role only, audited (actor NULL, reason required).
-- Non-nomination path for operators and e2e fixtures (D3).
CREATE FUNCTION public.service_set_tier(
  p_target uuid,
  p_tier   public.admin_tier,
  p_reason text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE v_old public.admin_tier;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'service_set_tier requires a reason' USING ERRCODE = '22004';
  END IF;
  v_old := public.tier_of(p_target);

  -- Founder-only is ABSOLUTE: the break-glass path may NOT create/remove/alter a Platform Admin,
  -- may NOT touch the founder, and may only target a real (non-anonymous) user. Each refusal is a
  -- durable audit row (system actor) so the attempt is recorded.
  IF p_tier = 'platform_admin' OR v_old = 'platform_admin' THEN
    PERFORM public.record_admin_action(NULL, 'tier.set', 'tier', p_target::text, 'denied', 'platform_admin_forbidden',
      jsonb_build_object('from', v_old, 'to', p_tier, 'service', true), NULL);
    RETURN jsonb_build_object('ok', false, 'code', 'platform_admin_forbidden');
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_founder WHERE user_id = p_target) THEN
    PERFORM public.record_admin_action(NULL, 'tier.set', 'tier', p_target::text, 'denied', 'founder_immutable',
      jsonb_build_object('from', v_old, 'to', p_tier, 'service', true), NULL);
    RETURN jsonb_build_object('ok', false, 'code', 'founder_immutable');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_target AND (u.is_anonymous = false OR u.is_anonymous IS NULL)
  ) THEN
    PERFORM public.record_admin_action(NULL, 'tier.set', 'tier', p_target::text, 'denied', 'target_invalid',
      jsonb_build_object('from', v_old, 'to', p_tier, 'service', true), NULL);
    RETURN jsonb_build_object('ok', false, 'code', 'target_invalid');
  END IF;

  PERFORM set_config('feed.tier_write', 'on', true);
  UPDATE public.profiles SET admin_tier = p_tier WHERE id = p_target;
  PERFORM set_config('feed.tier_write', 'off', true);
  PERFORM public.record_admin_action(NULL, 'tier.set', 'tier', p_target::text, 'ok', p_reason,
    jsonb_build_object('from', v_old, 'to', p_tier, 'service', true), NULL);
  RETURN jsonb_build_object('ok', true, 'from', v_old, 'to', p_tier);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.service_set_tier(uuid, public.admin_tier, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_set_tier(uuid, public.admin_tier, text) TO service_role;

-- admin_list_people: RA+, for the People tab. No email / no ban data (that stays PA via admin_list_users).
CREATE FUNCTION public.admin_list_people(p_search text DEFAULT NULL, p_limit integer DEFAULT 50)
  RETURNS TABLE(id uuid, first_name text, username text, avatar_url text, admin_tier public.admin_tier, joined_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_user_tier_at_least('resource_admin') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.first_name, p.username, p.avatar_url, p.admin_tier, p.created_at AS joined_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE (u.is_anonymous = false OR u.is_anonymous IS NULL)
    AND (p_search IS NULL
         OR p.first_name ilike '%' || p_search || '%'
         OR p.username  ilike '%' || p_search || '%')
  ORDER BY (p.admin_tier IS NULL), p.admin_tier DESC, p.created_at DESC
  LIMIT LEAST(greatest(coalesce(p_limit, 50), 1), 200);  -- hard cap 200
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_people(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_people(text, integer) TO authenticated;

-- ============================================================================
-- 7. RA re-gate (bodies verbatim apart from the gate; approve/reject/update add AUD)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_pending_resources()
 RETURNS TABLE(id uuid, name text, description text, category text, address text, city text, state text, zip_code text, phone text, website text, status text, discovery_metadata jsonb, lat double precision, lng double precision, service_mode text, email text, geocode_accuracy text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.current_user_tier_at_least('resource_admin') then
    raise exception 'p3_denied:insufficient_tier' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.description, r.category::text, r.address_line1 as address, r.city, r.state,
    r.zip_code, r.phone, r.website, r.status::text, r.discovery_metadata,
    st_y(r.location::geometry) as lat, st_x(r.location::geometry) as lng,
    r.service_mode::text, r.email, r.geocode_accuracy
  from public.resources r
  where r.status = 'pending'
  order by r.created_at asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_resources(p_state text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_status text DEFAULT 'approved'::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, description text, category text, address_line1 text, city text, state text, zip_code text, phone text, email text, website text, status text, source text, is_verified boolean, moderated_at timestamp with time zone, lat double precision, lng double precision, service_mode text, geocode_accuracy text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not public.current_user_tier_at_least('resource_admin') then
    raise exception 'p3_denied:insufficient_tier' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.description, r.category::text, r.address_line1, r.city, r.state, r.zip_code,
    r.phone, r.email, r.website, r.status::text, r.source::text, r.is_verified, r.moderated_at,
    st_y(r.location::geometry) as lat, st_x(r.location::geometry) as lng, r.service_mode::text, r.geocode_accuracy
  from public.resources r
  where r.status = coalesce(p_status, 'approved')::resource_status
    and (p_state  is null or upper(r.state) = upper(p_state))
    and (p_city   is null or r.city ilike '%' || p_city || '%')
    and (p_search is null or r.name ilike '%' || p_search || '%' or r.description ilike '%' || p_search || '%')
  order by r.name asc
  limit  greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.approve_resource(p_resource_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.current_user_tier_at_least('resource_admin') then
    raise exception 'p3_denied:insufficient_tier' using errcode = '42501';
  end if;
  -- Form-template rows (discovery_metadata.content_type='form') are approved ONLY by a Platform
  -- Admin, through approve_form_template. An RA cannot approve a form via the resource path.
  if not public.is_current_user_admin()
     and (select r.discovery_metadata->>'content_type' from public.resources r where r.id = p_resource_id) = 'form' then
    raise exception 'p3_denied:form_requires_platform_admin' using errcode = '42501';
  end if;
  update public.resources
     set status = 'approved', moderated_by = auth.uid(), moderated_at = now(), updated_at = now()
   where id = p_resource_id;
  if not found then raise exception 'resource % not found', p_resource_id using errcode='P0002'; end if;
  perform public.record_admin_action(auth.uid(), 'resource.approve', 'resource', p_resource_id::text,
    'ok', p_reason, '{}'::jsonb, public.request_id());
end; $function$;

CREATE OR REPLACE FUNCTION public.reject_resource(p_resource_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.current_user_tier_at_least('resource_admin') then
    raise exception 'p3_denied:insufficient_tier' using errcode = '42501';
  end if;
  update public.resources
     set status = 'rejected', rejection_reason = p_reason, moderated_by = auth.uid(), moderated_at = now(), updated_at = now()
   where id = p_resource_id;
  if not found then raise exception 'resource % not found', p_resource_id using errcode='P0002'; end if;
  perform public.record_admin_action(auth.uid(), 'resource.reject', 'resource', p_resource_id::text,
    'ok', p_reason, '{}'::jsonb, public.request_id());
end; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_resource(p_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_address_line1 text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_website text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_service_mode text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_geocode_accuracy text DEFAULT NULL::text, p_geocode_confidence text DEFAULT NULL::text, p_mark_unlocated boolean DEFAULT false)
 RETURNS TABLE(id uuid, name text, description text, category text, address_line1 text, city text, state text, zip_code text, phone text, email text, website text, status text, source text, is_verified boolean, moderated_at timestamp with time zone, lat double precision, lng double precision, service_mode text, geocode_accuracy text, geocode_confidence text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not public.current_user_tier_at_least('resource_admin') then
    raise exception 'p3_denied:insufficient_tier' using errcode = '42501';
  end if;

  update public.resources r
     set name          = coalesce(p_name, r.name),
         category      = coalesce(p_category::resource_category, r.category),
         status        = coalesce(p_status::resource_status, r.status),
         service_mode  = coalesce(p_service_mode::resource_service_mode, r.service_mode),
         description   = p_description,
         address_line1 = p_address_line1,
         city          = p_city,
         state         = p_state,
         zip_code      = p_zip_code,
         phone         = p_phone,
         email         = p_email,
         website       = p_website,
         location           = case
                                 when p_lat is not null and p_lng is not null
                                   then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
                                 else r.location
                               end,
         geocode_accuracy   = case
                                 when p_lat is not null and p_lng is not null then p_geocode_accuracy
                                 when p_mark_unlocated and r.location is null then 'unlocated'
                                 else r.geocode_accuracy
                               end,
         geocode_confidence = case
                                 when p_lat is not null and p_lng is not null then p_geocode_confidence
                                 else r.geocode_confidence
                               end,
         moderated_by  = auth.uid(),
         moderated_at  = now(),
         updated_at    = now()
   where r.id = p_id;

  if not found then
    raise exception 'resource % not found', p_id using errcode = 'P0002';
  end if;

  perform public.record_admin_action(auth.uid(), 'resource.update', 'resource', p_id::text,
    'ok', null, jsonb_build_object('status', p_status), public.request_id());

  return query
  select r.id, r.name, r.description, r.category::text, r.address_line1, r.city, r.state, r.zip_code,
    r.phone, r.email, r.website, r.status::text, r.source::text, r.is_verified, r.moderated_at,
    st_y(r.location::geometry) as lat, st_x(r.location::geometry) as lng,
    r.service_mode::text, r.geocode_accuracy, r.geocode_confidence
  from public.resources r
  where r.id = p_id;
end;
$function$;

-- set_resource_location_by_id: owner OR service (uid NULL) OR RA+. AUD only when the admin branch
-- authorized (not owner, not service).
-- Carries P3.0 (20261009000000)'s owner path forward VERBATIM (own resource while pending OR own
-- volunteer listing; resets geocode_accuracy). P3.1 only re-gates the admin branch from
-- is_current_user_admin() (PA) to current_user_tier_at_least('resource_admin') (RA+) and audits it.
-- The server path (auth.uid() IS NULL) stays a system actor with no audit row.
CREATE OR REPLACE FUNCTION public.set_resource_location_by_id(p_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Anonymous guard: guests may not perform write actions.
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  -- Server path (P3.0): set location, leave geocode_accuracy as-is, no audit (system actor).
  IF auth.uid() IS NULL THEN
    UPDATE public.resources
      SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      WHERE id = p_id;
    RETURN;
  END IF;

  -- Resource-admin path (P3.1: RA+, was PA): set location, leave accuracy as-is, audit the action.
  IF public.current_user_tier_at_least('resource_admin') THEN
    UPDATE public.resources
      SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      WHERE id = p_id;
    PERFORM public.record_admin_action(auth.uid(), 'resource.set_location', 'resource', p_id::text,
      'ok', null, jsonb_build_object('lat', p_lat, 'lng', p_lng), public.request_id());
    RETURN;
  END IF;

  -- Owner path (P3.0 verbatim): only the caller's OWN resource, while pending OR their own
  -- volunteer listing. Reset geocode_accuracy so a moderator's rooftop tag never stays on
  -- coordinates the user picked.
  IF NOT EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = p_id
      AND r.submitted_by = auth.uid()
      AND (r.status = 'pending' OR r.is_volunteer_resource = true)
  ) THEN
    RAISE EXCEPTION 'not authorized to set location for this resource' USING ERRCODE = '42501';
  END IF;

  UPDATE public.resources
    SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        geocode_accuracy = NULL
    WHERE id = p_id;
END;
$function$;

-- ============================================================================
-- 8. CM re-gate + AUD (no T3 per D2 — moderation keeps current behavior apart from gate + audit).
--    Gate is_staff -> current_user_tier_at_least('community_moderator') (semantically identical).
--    remove/hold/authorize drop log_audit_event in favor of record_admin_action.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_remove_post(p_post_id uuid, p_reason text DEFAULT 'admin_removal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_author uuid;
BEGIN
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_author FROM public.posts WHERE id = p_post_id;

  UPDATE public.posts
  SET is_hidden = true, hidden_at = now(), hidden_reason = 'admin_removal'
  WHERE id = p_post_id;

  UPDATE public.content_reports
  SET status = 'upheld'
  WHERE content_type = 'post' AND content_id = p_post_id AND status = 'open';

  PERFORM public.record_admin_action(auth.uid(), 'post.remove', 'post', p_post_id::text,
    'ok', p_reason, jsonb_build_object('author_id', v_author), public.request_id());

  RETURN '{"success": true}'::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_hold_post(p_post_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_author uuid;
BEGIN
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_author FROM public.posts WHERE id = p_post_id;

  UPDATE public.posts
  SET is_hidden = true, hidden_at = now(), hidden_reason = 'hold_for_review'
  WHERE id = p_post_id;

  PERFORM public.record_admin_action(auth.uid(), 'post.hold', 'post', p_post_id::text,
    'ok', 'hold_for_review', jsonb_build_object('author_id', v_author), public.request_id());

  RETURN '{"success": true}'::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_authorize_post(p_post_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_author uuid;
BEGIN
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_author FROM public.posts WHERE id = p_post_id;

  UPDATE public.posts
  SET is_hidden = false, hidden_at = NULL, hidden_reason = NULL
  WHERE id = p_post_id;

  UPDATE public.content_reports
  SET status = 'dismissed'
  WHERE content_type = 'post' AND content_id = p_post_id AND status = 'open';

  PERFORM public.record_admin_action(auth.uid(), 'post.authorize', 'post', p_post_id::text,
    'ok', NULL, jsonb_build_object('author_id', v_author), public.request_id());

  RETURN '{"success": true}'::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_content_id   uuid;
  v_content_type text;
  v_open_count   bigint;
BEGIN
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('dismiss', 'uphold') THEN
    RAISE EXCEPTION 'action must be dismiss or uphold';
  END IF;

  SELECT content_id, content_type INTO v_content_id, v_content_type
  FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;

  IF p_action = 'uphold' THEN
    UPDATE public.content_reports SET status = 'upheld' WHERE id = p_report_id;
  ELSIF p_action = 'dismiss' THEN
    UPDATE public.content_reports SET status = 'dismissed' WHERE id = p_report_id;
    SELECT count(*) INTO v_open_count
    FROM public.content_reports
    WHERE content_type = v_content_type AND content_id = v_content_id AND status = 'open';
    IF v_open_count = 0 AND v_content_type = 'post' THEN
      UPDATE public.posts SET is_hidden = false, hidden_at = NULL, hidden_reason = NULL WHERE id = v_content_id;
    END IF;
  END IF;

  PERFORM public.record_admin_action(auth.uid(), 'report.resolve', 'report', p_report_id::text,
    'ok', p_action, jsonb_build_object('content_type', v_content_type, 'content_id', v_content_id), public.request_id());

  RETURN jsonb_build_object('report_id', p_report_id, 'action', p_action);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_safety_alert(p_alert_id uuid)
 RETURNS safety_alerts
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.safety_alerts;
BEGIN
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE='42501';
  END IF;

  UPDATE public.safety_alerts
    SET verified = true, verified_by = auth.uid(), verified_at = now()
  WHERE id = p_alert_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert not found'; END IF;

  PERFORM public.record_admin_action(auth.uid(), 'safety_alert.verify', 'safety_alert', p_alert_id::text,
    'ok', NULL, jsonb_build_object('created_by', v_row.created_by), public.request_id());

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_safety_alert(p_alert_id uuid)
 RETURNS safety_alerts
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.safety_alerts;
BEGIN
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE='42501';
  END IF;

  UPDATE public.safety_alerts SET status = 'removed' WHERE id = p_alert_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert not found'; END IF;

  PERFORM public.record_admin_action(auth.uid(), 'safety_alert.remove', 'safety_alert', p_alert_id::text,
    'ok', NULL, jsonb_build_object('created_by', v_row.created_by), public.request_id());

  RETURN v_row;
END;
$function$;

-- ============================================================================
-- 9. admin_list_users: add admin_tier output column (DROP+CREATE — RETURNS TABLE). Gate unchanged (PA).
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, full_name text, email text, user_role text, is_staff boolean, admin_tier public.admin_tier, joined_at timestamp with time zone, last_sign_in_at timestamp with time zone, provider text, banned_until timestamp with time zone, email_confirmed boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    p.id, p.full_name, au.email::text, p.user_role, p.is_staff, p.admin_tier,
    p.created_at AS joined_at, au.last_sign_in_at,
    (au.raw_app_meta_data->>'provider') AS provider, au.banned_until,
    (au.email_confirmed_at IS NOT NULL) AS email_confirmed
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE (au.is_anonymous = false OR au.is_anonymous IS NULL)
  ORDER BY p.created_at DESC
  LIMIT 200;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated, service_role;

-- ============================================================================
-- 10. Retire the facilitator code: drop the redemption table (0 rows; service-role-only).
--     The deployed edge function + its secrets are removed by the orchestrator after merge.
-- ============================================================================
DROP TABLE IF EXISTS public.admin_code_redemptions;
