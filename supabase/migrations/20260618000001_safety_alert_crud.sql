-- Safety Alert CRUD RPCs
-- Allows alert creators to update and delete their own alerts via SECURITY DEFINER functions.

-- ─── update_safety_alert ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_safety_alert(
  p_alert_id   uuid,
  p_type       text,
  p_severity   int,
  p_description text,
  p_lng        float8,
  p_lat        float8
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Ownership guard
  IF auth.uid() <> (SELECT created_by FROM safety_alerts WHERE id = p_alert_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Validate alert_type
  IF p_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'invalid alert_type: %', p_type;
  END IF;

  -- Validate severity
  IF p_severity < 1 OR p_severity > 4 THEN
    RAISE EXCEPTION 'severity must be between 1 and 4';
  END IF;

  -- Apply update
  UPDATE safety_alerts
  SET
    alert_type  = p_type,
    severity    = p_severity,
    description = p_description,
    location    = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_alert_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_safety_alert(uuid, text, int, text, float8, float8) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_safety_alert(uuid, text, int, text, float8, float8) TO authenticated;


-- ─── delete_safety_alert ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_safety_alert(
  p_alert_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Ownership guard
  IF auth.uid() <> (SELECT created_by FROM safety_alerts WHERE id = p_alert_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM safety_alerts WHERE id = p_alert_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_safety_alert(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_safety_alert(uuid) TO authenticated;
