-- ============================================================================
-- Migration: Harden SECURITY DEFINER functions
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Pin search_path and apply least-privilege EXECUTE grants to the SECURITY
--   DEFINER functions in the public schema. SECURITY DEFINER functions execute
--   with the owner's privileges; without a pinned search_path a caller can
--   prepend a malicious schema and shadow unqualified object references inside
--   the function body, escalating privileges. Postgres also grants EXECUTE to
--   PUBLIC by default on new functions, so anon/authenticated inherit the right
--   to invoke privileged maintenance/webhook/federation routines.
--
-- ADVISOR SATISFIED
--   Supabase database linter 0011 "function_search_path_mutable"
--   (every SECURITY DEFINER function below either gains an explicit
--   `SET search_path` clause here or was already pinned in a prior migration).
--
-- EMPIRICAL BASIS FOR search_path = public
--   anon, authenticated, and PUBLIC do NOT hold CREATE on the public schema on
--   this project, so they cannot plant a shadowing object in `public`. Pinning
--   search_path to `public` is therefore the minimal safe value. The two geo
--   functions (nearby_resources, resources_in_bounds) call PostGIS routines
--   (ST_DWithin, ST_MakeEnvelope, the <-> and && operators). PostGIS is
--   installed in the `public` schema on this project (verified:
--   pg_extension.extname='postgis' -> nspname='public'), so `public` alone
--   resolves every PostGIS symbol and no `extensions` entry is required.
--
-- ALSO IN THIS MIGRATION
--   - get_instance_uptime: fixes a tautology bug. The live body compares the
--     `instance_id` column to a parameter of the same name, so the param
--     shadows the column and the WHERE clause is always true. The parameter is
--     renamed to `p_instance_id` and the predicate corrected. search_path
--     pinned in the same CREATE OR REPLACE.
--   - nearby_resources: backfilled here (it existed only in prod with no
--     migration on disk) so a clean rebuild reproduces it. Body is verbatim
--     from prod; only the SET search_path clause is added.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- (0) get_instance_uptime: DROP+CREATE FIRST (before the (b) REVOKE/GRANT).
--     A param rename (instance_id -> p_instance_id) cannot be done with
--     CREATE OR REPLACE (42P13), so DROP FUNCTION is required. DROP also drops
--     all grants, so this MUST run BEFORE block (b)'s REVOKE/GRANT for this fn;
--     otherwise the fresh function is reborn with the default EXECUTE TO PUBLIC
--     grant, silently re-opening the hole. Running it here lets (b) apply
--     least-privilege (service_role-only) to the fresh function. Also fixes the
--     always-true tautology (column instance_id vs renamed param p_instance_id)
--     and pins SET search_path = public.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_instance_uptime(uuid);
CREATE FUNCTION public.get_instance_uptime(p_instance_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  total_checks INTEGER;
  healthy_checks INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE check_status = 'healthy')
  INTO total_checks, healthy_checks
  FROM public.federation_health_checks
  WHERE instance_id = p_instance_id
    AND checked_at > NOW() - INTERVAL '30 days';

  IF total_checks = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((healthy_checks::DECIMAL / total_checks) * 100, 2);
END;
$function$;

-- ----------------------------------------------------------------------------
-- (a) Pin search_path on currently-unpinned SECURITY DEFINER functions.
--     Minimal ALTER FUNCTION; no body restate.
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.cleanup_old_webhook_logs() SET search_path = public;
ALTER FUNCTION public.get_recent_webhook_failures(integer) SET search_path = public;
ALTER FUNCTION public.get_webhook_stats(uuid, integer) SET search_path = public;
ALTER FUNCTION public.get_stale_federated_resources(integer) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.on_resource_change_webhook() SET search_path = public;
ALTER FUNCTION public.notify_federation_webhook(text, uuid, text) SET search_path = public;
ALTER FUNCTION public.set_resource_location(text, text, double precision, double precision) SET search_path = public;
ALTER FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) SET search_path = public;
-- Geo functions: PostGIS lives in public on this project, so search_path = public
-- resolves ST_*/&&/<-> with no extensions entry needed.
ALTER FUNCTION public.nearby_resources(double precision, double precision, double precision) SET search_path = public;
ALTER FUNCTION public.resources_in_bounds(double precision, double precision, double precision, double precision, integer) SET search_path = public;

-- ----------------------------------------------------------------------------
-- (b) Least-privilege EXECUTE: revoke over-broad grants, then grant only to
--     verified legitimate callers. Full typed signatures throughout.
-- ----------------------------------------------------------------------------

-- service_role-only (sole caller is a service_role edge fn / cron / trigger path)
REVOKE EXECUTE ON FUNCTION public.set_resource_location(text, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_resource_location(text, text, double precision, double precision) TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_federation_webhook(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_federation_webhook(text, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_webhook_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_logs() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_recent_webhook_failures(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_webhook_failures(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_webhook_stats(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_webhook_stats(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_stale_federated_resources(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stale_federated_resources(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_lockouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_lockouts() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_inactive_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_inactive_sessions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_login_attempts() TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_account_locked(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_instance_uptime(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instance_uptime(uuid) TO service_role;

-- trigger-only: revoke all client roles, grant nothing (invoked by trigger as owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.on_resource_change_webhook() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_password_history_limit() FROM PUBLIC, anon, authenticated;

-- keep-grant exceptions: verified live callers would regress if these roles lost EXECUTE
-- set_resource_location_by_id: volunteer UI calls as authenticated; resource-ingest edge as service_role
REVOKE EXECUTE ON FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) TO authenticated, service_role;

-- nearby_resources: federated search route is auth-enforced
REVOKE EXECUTE ON FUNCTION public.nearby_resources(double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_resources(double precision, double precision, double precision) TO authenticated, service_role;

-- resources_in_bounds: powers the public pre-login map; MUST remain anon-callable.
-- Grants intentionally untouched here; search_path pinned in (a) only.

-- ----------------------------------------------------------------------------
-- (e) nearby_resources: backfill the missing migration. Body is verbatim from
--     prod (logic unchanged); only SET search_path = public is added.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_resources(lat double precision, lng double precision, radius_miles double precision DEFAULT 25)
 RETURNS SETOF resources
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.resources
  WHERE status = 'approved'
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
END;
$function$;

COMMIT;
