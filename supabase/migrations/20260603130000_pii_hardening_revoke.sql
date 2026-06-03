-- ============================================
-- PII HARDENING — PHASE 3 (CONTRACT / REVOKE)
-- Migration: 20260603130000_pii_hardening_revoke.sql
-- Ticket: FEED-SEC-PII-HARDENING
-- Author: Jelal Connor / SYNRG SCALING, LLC
-- Applied: 2026-06-03 via Management API
-- ============================================
--
-- CORRECTNESS NOTE (2026-06-03):
--   PostgreSQL evaluates a column-level REVOKE as: deny access ONLY if there is
--   no other grant that permits it. A table-level SELECT grant (which Supabase
--   provisioned by default for authenticated and anon) overrides a column-level
--   REVOKE. The bare REVOKE SELECT (col) approach in the original file was
--   INEFFECTIVE while the table-level grant existed. Empirically confirmed via:
--     has_column_privilege('authenticated','public.profiles','phone','SELECT') = TRUE
--   even after the column revoke ran.
--
--   The correct pattern (what was actually applied and verified on 2026-06-03):
--     1. REVOKE SELECT (table-level) from each role.
--     2. GRANT SELECT (<safe columns only>) back to each role.
--   This ensures has_column_privilege() returns FALSE for the 4 PII columns.
--
-- PRE-APPLY CHECKLIST (run once at start of fresh environment):
--   [x] Vercel develop deployment for PR #38 (feature/pii-hardening) shows Status: Ready
--   [x] apps/web/src/providers/auth-provider.tsx select list does NOT include
--       phone, paypal_email, venmo_username, is_admin
--   [x] apps/web/src/app/(social)/s/donate/[id]/page.tsx uses
--       supabase.rpc('get_donation_handles', ...) not direct column select
--   [x] apps/web/src/app/(social)/s/post/[id]/page.tsx uses
--       supabase.rpc('get_donation_handles', ...) not direct column select
--   [x] apps/web/src/components/panels/feed-panel.tsx embeds is_staff (not is_admin)
--   [x] apps/web/src/app/(admin)/layout.tsx uses rpc('is_current_user_admin')
--
-- VERIFICATION (post-apply):
--   SELECT has_column_privilege('authenticated','public.profiles','phone','SELECT');   -- FALSE
--   SELECT has_column_privilege('authenticated','public.profiles','full_name','SELECT'); -- TRUE
--   SELECT has_column_privilege('anon','public.profiles','phone','SELECT');             -- FALSE
--
--   REST proof (42501 = locked):
--   curl ".../rest/v1/profiles?select=phone,...&id=eq.<other>&limit=1"
--     -H "Authorization: Bearer <jwt>" -H "apikey: <anon-key>"
--   Expected: {"code":"42501","message":"permission denied for table profiles"}
--
-- REVERSIBLE (DOWN):
--   REVOKE SELECT (id, username, full_name, avatar_url, bio, location_city,
--     location_state, is_verified, created_at, updated_at, zip_code,
--     latitude, longitude, needs, onboarding_completed, user_role, is_staff)
--     ON public.profiles FROM authenticated, anon;
--   GRANT SELECT ON public.profiles TO authenticated, anon;
--
-- ============================================

-- ============================================
-- STEP A: Remove table-level SELECT from authenticated and anon
-- (column-level REVOKE is ineffective while table-level grant exists)
-- ============================================
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- ============================================
-- STEP B: Re-grant SELECT on safe (non-PII) columns only
-- Preserves: id, username, full_name, avatar_url, bio, location_city,
--   location_state, is_verified, created_at, updated_at, zip_code,
--   latitude, longitude, needs, onboarding_completed, user_role, is_staff
-- Withholds: phone, paypal_email, venmo_username, is_admin
-- ============================================
GRANT SELECT (
  id,
  username,
  full_name,
  avatar_url,
  bio,
  location_city,
  location_state,
  is_verified,
  created_at,
  updated_at,
  zip_code,
  latitude,
  longitude,
  needs,
  onboarding_completed,
  user_role,
  is_staff
) ON public.profiles TO authenticated;

GRANT SELECT (
  id,
  username,
  full_name,
  avatar_url,
  bio,
  location_city,
  location_state,
  is_verified,
  created_at,
  updated_at,
  zip_code,
  latitude,
  longitude,
  needs,
  onboarding_completed,
  user_role,
  is_staff
) ON public.profiles TO anon;

-- ============================================
-- STEP C: Explicit anon EXECUTE revoke on SECDEF functions.
--   REVOKE ... FROM PUBLIC does not necessarily cover named roles
--   that received grants via pg_default_acl at creation time.
--   Advisor lint 0028 confirmed anon could still call these functions.
-- ============================================
REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;
-- sync_is_staff is a trigger function — neither role should call it directly.
REVOKE EXECUTE ON FUNCTION public.sync_is_staff() FROM anon, authenticated, PUBLIC;
