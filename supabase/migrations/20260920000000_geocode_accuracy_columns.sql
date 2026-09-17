-- ─────────────────────────────────────────────────────────────
-- 20260920000000_geocode_accuracy_columns.sql
--
-- PURPOSE (life-safety map-accuracy): record how precise each resource's
-- coordinate is, and provide one reusable primitive to write a geocode
-- result (point + accuracy + confidence) atomically. Backs a coverage
-- backfill (geocoding ~33 approved resources with a street address but
-- NULL location) and later precise-geocode paths.
--
-- EMPIRICAL MODEL (verified live before authoring):
--   * resources.location is geography(Point,4326), written lng-first via
--     ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
--     (cf. set_resource_location_by_id in 20260611173053, line 826;
--      admin_update_resource in 20260918000000, lines 212-215).
--   * Mapbox Geocoding v6 returns:
--       properties.coordinates.accuracy   -> rooftop/parcel/point/interpolated/approximate
--       properties.match_code.confidence  -> exact/high/medium/low
--     These two strings are what geocode_accuracy / geocode_confidence store.
--
-- 5-STEP ORDER: no extensions/tables created here (postgis + resources already
-- exist); this migration is (2) additive columns on a core table + (5) the
-- function's grant model. No RLS block: RLS on resources is unchanged; the
-- new function is SECURITY DEFINER with an explicit grant model below.
-- ─────────────────────────────────────────────────────────────


-- ── 1. Additive columns (metadata-only; nullable text => no table rewrite) ──
-- Nullable: existing rows stay NULL until (re)geocoded. No backfill of these
-- columns here. No NOT NULL => Postgres records only catalog defaults, so this
-- is a metadata-only change (ACCESS EXCLUSIVE held momentarily, no row scan,
-- no rewrite) — safe at 19k rows.
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS geocode_accuracy   text;

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS geocode_confidence text;

COMMENT ON COLUMN public.resources.geocode_accuracy   IS
  'Mapbox Geocoding v6 properties.coordinates.accuracy: rooftop/parcel/point/interpolated/approximate. NULL until (re)geocoded.';
COMMENT ON COLUMN public.resources.geocode_confidence IS
  'Mapbox Geocoding v6 properties.match_code.confidence: exact/high/medium/low. NULL until (re)geocoded.';


-- ── 2. set_resource_geocode(...) — reusable atomic geocode-write primitive ──
-- INVARIANT (both directions):
--   * When p_lat AND p_lng are BOTH non-null -> write location (lng-first),
--     geocode_accuracy, geocode_confidence, and updated_at in ONE UPDATE.
--   * When EITHER p_lat OR p_lng is null -> location is left EXACTLY as-is
--     (a null coordinate pair must NEVER null an existing point). Accuracy /
--     confidence are still updated when supplied; otherwise the call no-ops.
-- This mirrors admin_update_resource's Invariant 2 (atomic geocode).
--
-- SECURITY DEFINER + search_path pinned to (public, extensions) because it
-- calls PostGIS (ST_SetSRID/ST_MakePoint). Unquoted list per multi-schema
-- search_path rule.
--
-- Idempotent: DROP + CREATE.
DROP FUNCTION IF EXISTS public.set_resource_geocode(uuid, double precision, double precision, text, text);

CREATE FUNCTION public.set_resource_geocode(
  p_id         uuid,
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy   text default null,
  p_confidence text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    -- Both coordinates present: atomic point + accuracy + confidence write.
    UPDATE public.resources
    SET location           = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        geocode_accuracy   = p_accuracy,
        geocode_confidence = p_confidence,
        updated_at         = now()
    WHERE id = p_id;
  ELSE
    -- Null coordinate pair: NEVER touch location. Update accuracy/confidence
    -- only when at least one is supplied; otherwise no-op entirely.
    IF p_accuracy IS NOT NULL OR p_confidence IS NOT NULL THEN
      UPDATE public.resources
      SET geocode_accuracy   = p_accuracy,
          geocode_confidence = p_confidence,
          updated_at         = now()
      WHERE id = p_id;
    END IF;
  END IF;
END;
$$;

-- ── 3. Grant model: server/admin primitive only ──
-- The backfill edge function runs as service_role; grant EXECUTE there only.
-- REVOKE from PUBLIC and anon so inherited/guest access cannot self-write
-- coordinates. Not granted to authenticated: the admin edit path keeps using
-- admin_update_resource, and owner writes keep using set_resource_location_by_id.
REVOKE ALL     ON FUNCTION public.set_resource_geocode(uuid, double precision, double precision, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_resource_geocode(uuid, double precision, double precision, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_resource_geocode(uuid, double precision, double precision, text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.set_resource_geocode(uuid, double precision, double precision, text, text) TO service_role;
