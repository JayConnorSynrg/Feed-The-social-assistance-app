-- Migration: geocode_profiles_from_zip
-- Adds geography(POINT,4326) column to profiles, a GIST index,
-- a BEFORE trigger that:
--   (1) fallback-geocodes: fills lat/lng from zip_centroids ONLY when zip present AND lat/lng are NULL
--       (never clobbers a precise Mapbox coordinate)
--   (2) derives the geography column from whatever lat/lng now exist
-- Backfill: sets lat/lng for existing rows that have zip_code but no coords,
--           then sets location for all rows that have coords.
-- The `location` column is TRIGGER-DERIVED ONLY — never in any client grant.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add location column (geography, nullable; NULL until coords exist)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GIST index for proximity queries (mirrors nearby_resources pattern)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_location_gist
    ON public.profiles USING GIST (location);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger function: fallback geocode + location derivation
--    SECURITY DEFINER so it can read zip_centroids (authenticated SELECT policy)
--    and write location (trigger-only column).
--    SET search_path = public: required for PostGIS functions + zip_centroids.
--    REVOKE EXECUTE: trigger-only — no role should call this directly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.geocode_profile_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lat double precision;
    v_lng double precision;
BEGIN
    -- Step 1: Fallback geocode
    -- Only fill lat/lng from zip_centroids when:
    --   a) zip_code is present, AND
    --   b) latitude OR longitude is NULL (don't clobber a precise Mapbox fix)
    IF NEW.zip_code IS NOT NULL AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
        SELECT lat, lng
          INTO v_lat, v_lng
          FROM public.zip_centroids
         WHERE zip = NEW.zip_code
         LIMIT 1;

        IF FOUND THEN
            -- Only set the NULL component(s); if one is set and the other isn't
            -- (pathological), fill both from centroid for consistency.
            NEW.latitude  := v_lat;
            NEW.longitude := v_lng;
        END IF;
    END IF;

    -- Step 2: Derive geography from final lat/lng (precise or centroid)
    -- Geo invariant: ST_MakePoint(LONGITUDE, LATITUDE) — longitude first.
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(
            ST_MakePoint(NEW.longitude, NEW.latitude),
            4326
        )::geography;
    ELSE
        NEW.location := NULL;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger-only function: revoke direct invocation from all roles
REVOKE EXECUTE ON FUNCTION public.geocode_profile_location()
    FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Attach trigger
--    BEFORE INSERT OR UPDATE OF zip_code, latitude, longitude
--    Fires on: any INSERT (column list ignored for INSERT triggers in Postgres)
--              any UPDATE that touches zip_code, latitude, or longitude
--    Does NOT fire on unrelated column updates (avatar_url, bio, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_geocode_profile_location ON public.profiles;

CREATE TRIGGER trg_geocode_profile_location
    BEFORE INSERT OR UPDATE OF zip_code, latitude, longitude
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.geocode_profile_location();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill existing rows
--    Step A: for rows that have zip_code but NULL lat/lng, fill from zip_centroids
--    Step B: for rows that now have coords but NULL location, derive geography
--    The trigger is not used for backfill (UPDATE OF zip_code,lat,lng would fire it,
--    but we do it explicitly for clarity and to avoid any recursion concern).
-- ─────────────────────────────────────────────────────────────────────────────

-- Step A: fill lat/lng from centroid where zip present but coords missing
UPDATE public.profiles p
SET
    latitude  = z.lat,
    longitude = z.lng
FROM public.zip_centroids z
WHERE p.zip_code  = z.zip
  AND p.latitude  IS NULL;

-- Step B: derive geography for all rows that now have coordinates
UPDATE public.profiles
SET location = ST_SetSRID(
    ST_MakePoint(longitude, latitude),
    4326
)::geography
WHERE latitude  IS NOT NULL
  AND longitude IS NOT NULL
  AND location  IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Enforce location as SELECT-only for client roles
--    The table has a broad table-level INSERT grant (anon=a, authenticated=a)
--    from Supabase defaults.  Any new column without an explicit column ACL
--    inherits that table-level INSERT via information_schema.column_privileges.
--    To make location trigger-derived ONLY:
--      - GRANT SELECT (location): creates a column-level ACL entry r/postgres
--        (pg_attribute.attacl = {anon=r/postgres, authenticated=r/postgres})
--      - No UPDATE privilege: only postgres + service_role have UPDATE on location
--    Clients can READ the derived geography (e.g. for "nearby users" queries)
--    but cannot write it; the trigger is the sole writer.
-- ─────────────────────────────────────────────────────────────────────────────

-- Grant SELECT so clients can read proximity results; no UPDATE/INSERT granted.
GRANT SELECT (location) ON public.profiles TO anon, authenticated;
