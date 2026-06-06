-- Migration: 20260606130000_profiles_coord_read_lockdown.sql
-- Security: close cross-user coordinate-read privacy hole on public.profiles
--
-- HOLE: authenticated users held column SELECT on latitude, longitude, location, zip_code
-- AND the cross-user RLS SELECT policy (auth.uid() <> id) allowed any logged-in user to
-- bulk-read every other user's home coordinates directly via PostgREST, bypassing the
-- count-only seekers_within_radius RPC.
--
-- FIX — expand/contract staging:
--
--   Phase 1 (EXPAND — applied to prod BEFORE app code deploys):
--     Create get_my_coordinates() SECDEF accessor so the new app code can call it.
--     This is safe to apply now: the old column SELECT still works too, so the
--     current deployed code (reading coords directly) is unaffected.
--
--   Phase 2 (CONTRACT — applied to prod ONLY AFTER new app code is deployed):
--     REVOKE SELECT (latitude, longitude, location, zip_code) FROM anon, authenticated.
--     Applying this before the new code is live is a breaking change — the running app
--     reads latitude/longitude directly on auth-provider.tsx L55-58, L176-179, L196-199.
--
--   The REVOKE lines below are included for fresh-DB reproducibility (schema integrity)
--   but carry a comment marking them as POST-DEPLOY. The orchestrator applies them to
--   prod manually after Vercel deploys this PR.
--
-- Mirrors the get_my_private_profile() pattern from 20260603120000_pii_hardening_expand.sql:
--   SECDEF + SET search_path + REVOKE PUBLIC/anon + GRANT authenticated.

-- ============================================================
-- PHASE 1: accessor (EXPAND — safe to apply before app deploy)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_coordinates()
  RETURNS TABLE(latitude double precision, longitude double precision)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT latitude, longitude
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_coordinates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_coordinates() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_my_coordinates() TO authenticated;

COMMENT ON FUNCTION public.get_my_coordinates() IS
  'Returns the calling user''s own latitude/longitude. '
  'SECURITY DEFINER with pinned search_path so it executes as the function owner '
  'and cannot be path-hijacked. Accessible to authenticated only (anon + PUBLIC revoked). '
  'Replaces direct column SELECT on profiles.latitude/longitude after the coordinate '
  'column REVOKE (Phase 2 below) is applied to prod.';

-- ============================================================
-- PHASE 2: coordinate read lockdown (CONTRACT)
-- POST-DEPLOY STEP: apply this to prod ONLY after Vercel deploys
-- the app code that uses get_my_coordinates() instead of direct
-- column SELECT. Applying before deploy breaks the running app.
-- ============================================================

REVOKE SELECT (latitude, longitude, location, zip_code) ON public.profiles FROM anon, authenticated;
