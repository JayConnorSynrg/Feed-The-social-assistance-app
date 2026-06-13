-- Migration: 20260613120000_profiles_preferred_language.sql
-- Purpose: Add preferred_language column to public.profiles and wire up grants.
--
-- DESIGN:
--   - Stores a BCP-47 short code (en, es, ht, vi, ar, zh, so, fr, pt, ru, ko,
--     tl, am, hmn, other).  NULL = not set yet → app treats as 'en'.
--   - Non-sensitive (language is not PII) so anon + authenticated both get
--     SELECT. This lets the auth-provider read it without an extra SECDEF call.
--   - Added to the column-scoped INSERT grant (authenticated; 11→12 cols) so
--     onboarding can write it.
--   - Added to the column-scoped UPDATE grant (authenticated; 16→17 cols) so
--     the settings panel can persist changes.
--
-- IDEMPOTENCY:
--   ADD COLUMN IF NOT EXISTS is safe to re-run.
--   GRANT re-states the FULL column list — PostgreSQL replaces the ACL entry
--   idempotently (no duplicate-privilege error on re-run).
--
-- PROD APPLY: additive only (new nullable column; no RLS change needed because
--   the column is non-PII and existing SELECT RLS on profiles already gates rows).
--   Zero downtime.

-- 1. Add the column (idempotent) -----------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

-- 2. SELECT grant (non-PII; anon-readable for auth-provider fetch) ---------------
GRANT SELECT (preferred_language) ON public.profiles TO authenticated, anon;

-- 3. INSERT grant — re-state FULL 12-column set (was 11; +preferred_language) ----
--    Existing grant set by migration 20260606120000_harden_profiles_write_grants.sql
--    (11 cols). Re-stating with the added column replaces the ACL entry for
--    authenticated INSERT; no change to anon (still no INSERT).
GRANT INSERT (
  id,
  user_role,
  zip_code,
  location_city,
  location_state,
  latitude,
  longitude,
  needs,
  phone,
  onboarding_completed,
  updated_at,
  preferred_language
) ON public.profiles TO authenticated;

-- 4. UPDATE grant — re-state FULL 17-column set (was 16; +preferred_language) ---
--    Existing grant set by migration 20260604150000_reviews_and_harmony.sql
--    (16 cols). Re-stating with the added column replaces the ACL entry.
GRANT UPDATE (
  username,
  full_name,
  avatar_url,
  bio,
  venmo_username,
  paypal_email,
  location_city,
  location_state,
  updated_at,
  zip_code,
  latitude,
  longitude,
  needs,
  onboarding_completed,
  phone,
  user_role,
  preferred_language
) ON public.profiles TO authenticated;

-- 5. Update get_my_profile() SECDEF accessor to return preferred_language --------
--    The accessor is the canonical way the auth-provider reads own-row profile
--    data (name-privacy lockdown routes SELECT through SECDEF). Without this
--    the auth-provider would not see preferred_language on page load.
--
--    NOTE: Cannot use CREATE OR REPLACE when the RETURNS TABLE signature changes
--    (Postgres 42P13). DROP FUNCTION IF EXISTS first to allow the return-type
--    extension (preferred_language column added).
DROP FUNCTION IF EXISTS public.get_my_profile();
CREATE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id                   uuid,
  username             text,
  full_name            text,
  first_name           text,
  last_name            text,
  avatar_url           text,
  bio                  text,
  location_city        text,
  location_state       text,
  is_verified          boolean,
  is_staff             boolean,
  created_at           timestamptz,
  onboarding_completed boolean,
  user_role            text,
  preferred_language   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.bio,
    p.location_city,
    p.location_state,
    p.is_verified,
    p.is_staff,
    p.created_at,
    p.onboarding_completed,
    p.user_role::text,
    p.preferred_language
  FROM public.profiles p
  WHERE p.id = auth.uid();
$function$;

-- Re-state SECDEF grants (idempotent; function was already authenticated-only).
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
