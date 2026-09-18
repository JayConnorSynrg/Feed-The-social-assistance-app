-- ─────────────────────────────────────────────────────────────
-- 20260922000100_coarse_geocode_targets_fn.sql
--
-- PURPOSE (life-safety map-accuracy, PR-3): select the coarse zip-centroid
-- pin population for re-geocoding. Today 1,123 approved resources sit on a
-- ZIP-code centroid (their location collides exactly with >=1 other approved
-- row) but carry geocode_accuracy = NULL, so the map renders them as if they
-- were EXACT addresses. This function returns that target population so the
-- geocode-backfill edge function (coarse mode) can either upgrade each pin to
-- its true street coordinate or explicitly tag it 'approximate'.
--
-- TARGET POPULATION (verified live, count = 1,123):
--   approved rows where location IS NOT NULL, geocode_accuracy IS NULL, and
--   (lng,lat) is shared with >=1 OTHER approved row (zip-centroid collision
--   signature). A plain PostgREST filter cannot express the collision
--   self-join/group-by, hence a dedicated RPC.
--
-- Does NOT touch or supersede set_resource_geocode (20260920000000) — this
-- function is read-only target selection; the write-decision (move vs tag)
-- lives in the edge function per-row.
--
-- 5-STEP ORDER: no extensions/tables/enums here (postgis + resources already
-- exist); this is step (5) — a function + its grant model, layered on an
-- existing core table. No RLS change: resources RLS is untouched; this
-- function is SECURITY DEFINER with an explicit, narrow grant model below.
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.coarse_geocode_targets(integer);

CREATE FUNCTION public.coarse_geocode_targets(p_limit integer DEFAULT 1200)
RETURNS TABLE (
  id                uuid,
  address_line1     text,
  address_line2     text,
  city              text,
  state             text,
  zip_code          text,
  country           text,
  geocode_accuracy  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH approved_points AS (
    -- Every approved, located row, with its exact coordinate pair. Used both
    -- to detect collisions (>=2 approved rows at the identical point, i.e. a
    -- ZIP centroid) and to carry the address columns the caller needs.
    SELECT
      r.id,
      r.address_line1,
      r.address_line2,
      r.city,
      r.state,
      r.zip_code,
      r.country,
      r.geocode_accuracy,
      ST_X(r.location::geometry) AS lng,
      ST_Y(r.location::geometry) AS lat
    FROM public.resources r
    WHERE r.status = 'approved'
      AND r.location IS NOT NULL
  ),
  collision_counts AS (
    -- n > 1 at a given (lng,lat) means at least one OTHER approved row sits
    -- at that exact point too — the zip-centroid collision signature.
    SELECT lng, lat, COUNT(*) AS n
    FROM approved_points
    GROUP BY lng, lat
  )
  SELECT
    ap.id,
    ap.address_line1,
    ap.address_line2,
    ap.city,
    ap.state,
    ap.zip_code,
    ap.country,
    ap.geocode_accuracy
  FROM approved_points ap
  JOIN collision_counts cc
    ON cc.lng = ap.lng AND cc.lat = ap.lat
  WHERE ap.geocode_accuracy IS NULL
    AND cc.n > 1
  ORDER BY ap.id
  LIMIT p_limit;
$$;

-- ── Grant model: server/admin primitive only (mirrors set_resource_geocode) ──
-- The backfill edge function runs as service_role; grant EXECUTE there only.
-- REVOKE from PUBLIC/anon/authenticated so this read primitive (which still
-- bypasses RLS as SECURITY DEFINER) cannot be invoked by client-origin roles.
REVOKE ALL     ON FUNCTION public.coarse_geocode_targets(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.coarse_geocode_targets(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.coarse_geocode_targets(integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.coarse_geocode_targets(integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.coarse_geocode_targets(integer) TO postgres;
