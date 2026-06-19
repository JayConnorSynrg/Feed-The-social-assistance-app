-- Migration: admin verification of safety alerts
-- Adds verified/verified_by/verified_at columns, admin_verify_safety_alert RPC,
-- and rebuilds safety_alerts_in_view to expose the verified column.

-- ── a) Columns ────────────────────────────────────────────────────────────────

ALTER TABLE public.safety_alerts
  ADD COLUMN IF NOT EXISTS verified    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- ── b) admin_verify_safety_alert ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_verify_safety_alert(p_alert_id uuid)
  RETURNS public.safety_alerts
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_staff boolean;
  v_row      public.safety_alerts;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify caller is staff
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'forbidden: staff access required';
  END IF;

  UPDATE public.safety_alerts
    SET verified    = true,
        verified_by = auth.uid(),
        verified_at = now()
  WHERE id = p_alert_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'alert not found';
  END IF;

  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_verify_safety_alert(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_verify_safety_alert(uuid) TO authenticated;

-- ── c) Rebuild safety_alerts_in_view with verified column ─────────────────────
-- Return-type change requires DROP + CREATE (cannot ALTER a RETURNS TABLE signature).

DROP FUNCTION IF EXISTS public.safety_alerts_in_view(double precision, double precision, double precision, double precision);

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
    expires_at    timestamp with time zone,
    verified      boolean
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
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
    sa.expires_at,
    sa.verified
  FROM public.safety_alerts sa
  WHERE sa.status = 'live'
    AND sa.expires_at > now()
    AND ST_Intersects(
      sa.location,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    );
END;
$function$;

-- No explicit grants were present before (empty routine_privileges result);
-- the function inherits default PUBLIC EXECUTE which is appropriate for
-- authenticated callers via the in-view query path.
