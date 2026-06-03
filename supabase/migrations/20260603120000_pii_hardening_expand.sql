-- ============================================
-- PII HARDENING — PHASE 1 (EXPAND / ADDITIVE)
-- Migration: 20260603120000_pii_hardening_expand.sql
-- Ticket: FEED-SEC-PII-HARDENING
-- Author: Jelal Connor / SYNRG SCALING, LLC
-- ============================================
--
-- PURPOSE: Close a confirmed production PII leak where any authenticated user
-- could bulk-read every other user's phone, paypal_email, venmo_username,
-- and is_admin via the "Users can view other profiles via RLS" policy + column
-- SELECT grants.
--
-- PATTERN: expand / contract (zero-downtime)
--   PHASE 1 (this file) — additive only; safe to apply while current app code is live.
--     * Adds is_staff (synced mirror of is_admin) so code can switch display logic
--       without depending on the gated is_admin column.
--     * Creates three SECURITY DEFINER helper RPCs that enforce own-row / contextual
--       column access at the Postgres layer.
--     * Converts public_profiles VIEW to security_invoker=true (closes advisor ERROR 0010).
--     * Does NOT revoke any existing column grants — current deployed app still works.
--   PHASE 3 (separate file, apply post-deploy) — revokes column grants on the 4 PII cols.
--
-- SAFE TO RE-RUN: every statement is idempotent.
--
-- REVERSIBLE (DOWN):
--   -- DROP TRIGGER IF EXISTS sync_is_staff_trigger ON public.profiles;
--   -- DROP FUNCTION IF EXISTS public.sync_is_staff() CASCADE;
--   -- DROP FUNCTION IF EXISTS public.get_my_private_profile() CASCADE;
--   -- DROP FUNCTION IF EXISTS public.get_donation_handles(uuid) CASCADE;
--   -- DROP FUNCTION IF EXISTS public.is_current_user_admin() CASCADE;
--   -- ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_staff;
--   -- ALTER VIEW public.public_profiles SET (security_invoker = false);
--
-- ============================================

-- ============================================
-- STEP 1 — Add is_staff column (mirror of is_admin)
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_staff IS
  'Mirror of is_admin. Kept in sync by sync_is_staff trigger. '
  'Intended for display/badge logic after PII-hardening revokes cross-user is_admin reads. '
  'Added 2026-06-03 (PII hardening phase 1).';

-- ============================================
-- STEP 2 — Backfill is_staff from is_admin
-- ============================================
UPDATE public.profiles
SET is_staff = is_admin
WHERE is_staff IS DISTINCT FROM is_admin;

-- ============================================
-- STEP 3 — Trigger to keep is_staff in sync with is_admin
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_is_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Whenever is_admin changes, mirror the value to is_staff.
  -- This runs on INSERT and UPDATE so the columns never drift.
  NEW.is_staff := NEW.is_admin;
  RETURN NEW;
END;
$$;

-- Revoke public execute on the trigger function — invoked by the trigger engine, not users.
REVOKE ALL ON FUNCTION public.sync_is_staff() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_is_staff_trigger ON public.profiles;
CREATE TRIGGER sync_is_staff_trigger
  BEFORE INSERT OR UPDATE OF is_admin ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_is_staff();

-- ============================================
-- STEP 4a — RPC: get_my_private_profile()
-- Returns the caller's own private PII fields.
-- Replaces auth-provider select('*') for the phone field and
-- any future consumer that needs own-row PII.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE(
  phone         text,
  paypal_email  text,
  venmo_username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT phone, paypal_email, venmo_username
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

COMMENT ON FUNCTION public.get_my_private_profile() IS
  'Returns the authenticated user''s own phone, paypal_email, venmo_username. '
  'SECURITY DEFINER bypasses RLS; caller can only see their own row (WHERE id = auth.uid()). '
  'Added 2026-06-03 (PII hardening phase 1).';

-- ============================================
-- STEP 4b — RPC: get_donation_handles(target_id uuid)
-- Returns a specific user's payment handles.
-- Donation handles are public-by-design (user opted in by setting them).
-- Replaces direct column selects in donate/[id] and post/[id] pages.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_donation_handles(target_id uuid)
RETURNS TABLE(
  paypal_email   text,
  venmo_username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT paypal_email, venmo_username
  FROM public.profiles
  WHERE id = target_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_donation_handles(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_donation_handles(uuid) TO authenticated;
-- anon GRANT intentionally omitted: the donate and post/[id] social pages are
-- protected by proxy.ts (L138) which redirects every unauthenticated request to
-- /login — those paths are NOT in the publicRoutes allowlist. Granting anon
-- would restore the exact column-isolation bypass this hardening is closing.

COMMENT ON FUNCTION public.get_donation_handles(uuid) IS
  'Returns paypal_email and venmo_username for a given profile id. '
  'Payment handles are user-visible on donate/post pages, but those pages '
  'require authentication (proxy.ts redirect gate). '
  'SECURITY DEFINER enforces column isolation — callers cannot extract other PII. '
  'Callable by authenticated role only (anon EXECUTE deliberately withheld). '
  'Added 2026-06-03 (PII hardening phase 1).';

-- ============================================
-- STEP 4c — RPC: is_current_user_admin()
-- Returns boolean for the caller's own is_admin value.
-- Replaces admin layout direct column select.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

COMMENT ON FUNCTION public.is_current_user_admin() IS
  'Returns true if the authenticated user has is_admin=true, false otherwise. '
  'SECURITY DEFINER; caller can only check their own admin status (WHERE id = auth.uid()). '
  'Added 2026-06-03 (PII hardening phase 1).';

-- ============================================
-- STEP 5 — Convert public_profiles VIEW to security_invoker
-- Closes Supabase advisor ERROR 0010 (SECURITY DEFINER view).
-- ============================================
ALTER VIEW public.public_profiles SET (security_invoker = true);

COMMENT ON VIEW public.public_profiles IS
  'Safe public view of profiles table. Created 2026-02-20 for CCPA/CPRA/MODPA compliance. '
  'Converted to security_invoker=true 2026-06-03 (closes advisor ERROR 0010). '
  'Excludes: venmo_username, paypal_email, is_admin, phone, is_staff. '
  'Application code MUST use this view for cross-user profile reads (non-payment, non-admin). '
  'Use profiles table directly only for: (1) the authenticated user reading their own row, '
  'or (2) RPCs (get_donation_handles, get_my_private_profile, is_current_user_admin).';
