-- Wave-1 DB-layer security hardening
-- Authored against LIVE definitions fetched from project ndtpovonpadugthmcntl on 2026-06-10.
-- Four independent fixes (A/B/C/D). Runs in an implicit transaction.

-- ============================================================================
-- A. spatial_ref_sys: close proven anon/authenticated DELETE/TRUNCATE/write hole.
--    *** BLOCKED via the postgres-role channel (Management API) ***
--    The write grants on this table were issued by supabase_admin (the table
--    owner). A REVOKE issued by postgres is a silent no-op for grants made by
--    another grantor: Postgres returns success but removes nothing, because a
--    role can only revoke grants it (or a role it belongs to) issued. postgres
--    is NOT a member of supabase_admin and cannot SET ROLE supabase_admin
--    (42501), so there is no postgres-channel path to revoke these.
--    This statement is retained as documentation of intent; it executes without
--    error but does not change the ACL. Effective remediation requires an
--    alternative channel (supabase_admin context / Supabase support).
--    RLS-enable is likewise not possible from postgres (owner=supabase_admin).
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.spatial_ref_sys
  FROM anon, authenticated;

-- ============================================================================
-- B. set_resource_location_by_id: add ownership/admin guard.
--    Converted from sql to plpgsql; signature (uuid, double precision,
--    double precision) and RETURNS void preserved exactly.
--    auth.uid() IS NOT NULL gate keeps the service_role edge-ingest path
--    working (service_role -> auth.uid() NULL -> guard skipped).
--    Authenticated non-owner non-admin -> 42501.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_resource_location_by_id(
  p_id  uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.resources r
       WHERE r.id = p_id AND r.submitted_by = auth.uid()
     )
     AND NOT public.is_current_user_admin()
  THEN
    RAISE EXCEPTION 'not authorized to set location for this resource'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.resources
  SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_id;
END;
$function$;

-- ============================================================================
-- C. safety_alerts_in_view: remove created_by (deanonymizes reporters).
--    DROP + CREATE required (RETURNS TABLE shape change). Body reproduced
--    EXACTLY from the live definition minus the created_by column in both the
--    RETURNS TABLE list and the inner SELECT. EXECUTE grants re-applied to the
--    exact live grantees (postgres, authenticated, service_role).
-- ============================================================================
DROP FUNCTION IF EXISTS public.safety_alerts_in_view(
  double precision, double precision, double precision, double precision
);

CREATE FUNCTION public.safety_alerts_in_view(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision
)
RETURNS TABLE(
  id            uuid,
  alert_type    text,
  severity      integer,
  description   text,
  lng           double precision,
  lat           double precision,
  status        text,
  confirm_count integer,
  clear_count   integer,
  created_at    timestamp with time zone,
  expires_at    timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.alert_type,
    sa.severity,
    sa.description,
    ST_X(sa.location::geometry)::float8 AS lng,
    ST_Y(sa.location::geometry)::float8 AS lat,
    sa.status,
    sa.confirm_count,
    sa.clear_count,
    sa.created_at,
    sa.expires_at
  FROM public.safety_alerts sa
  WHERE sa.status = 'live'
    AND sa.expires_at > now()
    AND ST_Intersects(
      sa.location,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    );
END;
$function$;

-- CREATE FUNCTION auto-grants EXECUTE to PUBLIC (and anon via Supabase default
-- privileges). The original function granted EXECUTE only to authenticated +
-- service_role, so revoke the auto-added PUBLIC/anon grants to avoid widening
-- the surface, then restore the exact original grantees.
REVOKE EXECUTE ON FUNCTION public.safety_alerts_in_view(
  double precision, double precision, double precision, double precision
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.safety_alerts_in_view(
  double precision, double precision, double precision, double precision
) TO authenticated, service_role;

-- ============================================================================
-- D. trigger fns: revoke EXECUTE. Both are trigger-return-type with zero
--    direct callers (confirmed live); EXECUTE belongs only to the trigger
--    machinery, which runs as the table owner regardless of grants.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.recompute_harmony()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resource_opt_ins_set_completed_at()
  FROM PUBLIC, anon, authenticated;
