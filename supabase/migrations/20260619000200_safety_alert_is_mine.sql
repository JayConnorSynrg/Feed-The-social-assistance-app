-- additive: adds is_mine computed column. Safe to apply before client deploy.
-- Drops and recreates safety_alerts_in_view with is_mine replacing created_by exposure.
-- The live function never returned created_by, so this is purely additive.

DROP FUNCTION IF EXISTS public.safety_alerts_in_view(
  double precision,
  double precision,
  double precision,
  double precision
);

CREATE OR REPLACE FUNCTION public.safety_alerts_in_view(
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
  verified      boolean,
  is_mine       boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
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
    sa.verified,
    (sa.created_by = auth.uid()) AS is_mine
  FROM public.safety_alerts sa
  WHERE sa.status = 'live'
    AND sa.expires_at > now()
    AND ST_Intersects(
      sa.location,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    );
END;
$$;

-- Re-apply grants exactly as live proacl:
-- {=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
REVOKE EXECUTE ON FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision) TO service_role;
