-- Migration: revoke_profiles_pii_select
-- Closes live cross-user PII leak: full_name + coords + zip + location were
-- SELECT-able by any authenticated or anon user via column-level grants combined
-- with a permissive RLS policy (auth.uid() <> id). Any signed-in user could
-- read all users' full names, lat/lng, zip codes, and city/state via raw PostgREST.
--
-- Self-reads are preserved via SECDEF accessors:
--   get_my_profile()       — returns the caller's own profile row
--   get_my_coordinates()   — returns the caller's own lat/lng
--
-- Prior contract migrations (20260612010000 / 20260606130000) may have drifted
-- or never took effect on prod (likely lat/lng vs latitude/longitude column name
-- mismatch). This migration is forward-only and idempotent (REVOKE is a no-op
-- if the privilege is already absent).
--
-- Rollback (if needed — run manually):
--   GRANT SELECT (full_name, latitude, longitude, zip_code, location_city, location_state)
--     ON public.profiles TO anon, authenticated;

REVOKE SELECT (full_name, latitude, longitude, zip_code, location_city, location_state)
  ON public.profiles
  FROM anon, authenticated;
