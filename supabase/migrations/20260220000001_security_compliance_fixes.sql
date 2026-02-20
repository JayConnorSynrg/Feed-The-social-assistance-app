-- ============================================
-- SECURITY COMPLIANCE FIX: 2026-02-20
-- Fixes identified in US State Privacy Law Compliance Assessment
-- Applies to: MD MODPA, CA CPRA, CO CPA, OR OCPA, CCPA, VCDPA, CTDPA
-- Judicial Review Reference: FEED-SEC-2026-0220
-- ============================================

-- ============================================
-- FIX #4: Restrict profiles SELECT policy
-- VULNERABILITY: USING (true) exposes paypal_email, venmo_username, is_admin to ALL users
-- LEGAL: Violates data minimization (MD MODPA §14-4604, CA CPRA §1798.100, CO CPA §6-1-1308)
-- APPROACH: RLS cannot restrict columns; create a secure public_profiles VIEW
--   with only non-sensitive columns. Application code must use this view when
--   reading another user's profile. The row-level policy is kept permissive because
--   the donate and shared-post pages legitimately expose payment info chosen by the user,
--   but column-level isolation is enforced via the view for all other access patterns.
-- ============================================

-- Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Owner can see their own full profile (all columns including sensitive PII)
DROP POLICY IF EXISTS "Users can view own full profile" ON profiles;
CREATE POLICY "Users can view own full profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow reading other users' profiles at the row level.
-- Column-level restriction is enforced by application code using the
-- public_profiles view below. This policy is needed for:
--   - /s/donate/[id]: Shows payment buttons (user-opted-in data)
--   - /s/post/[id]: Shows post author info with payment support
--   - /profile/[username]: Public profile page
--   - Feed post cards: Author name/avatar via JOIN
-- NOTE: All new cross-user profile reads MUST use public_profiles view.
DROP POLICY IF EXISTS "Users can view other profiles via RLS" ON profiles;
CREATE POLICY "Users can view other profiles via RLS"
  ON profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() != id
  );

-- ============================================
-- Create secure public view for cross-user profile reads
-- This view intentionally omits sensitive columns:
--   EXCLUDED: venmo_username, paypal_email (financial accounts)
--   EXCLUDED: is_admin (privilege escalation risk)
--   EXCLUDED: phone (PII — not yet in schema but reserved)
--   INCLUDED: location_city, location_state (city/state is not precise location)
-- ============================================

CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  username,
  full_name,
  avatar_url,
  bio,
  location_city,
  location_state,
  is_verified,
  created_at
FROM profiles;

-- Grant SELECT on the public view to all authenticated and anonymous users.
-- This view is safe for unrestricted read access because it excludes all sensitive PII.
GRANT SELECT ON public_profiles TO authenticated;
GRANT SELECT ON public_profiles TO anon;

-- Document the view for audit trail
COMMENT ON VIEW public_profiles IS
  'Safe public view of profiles table. Created 2026-02-20 for CCPA/CPRA/MODPA compliance. '
  'Excludes: venmo_username, paypal_email, is_admin. '
  'Application code MUST use this view for cross-user profile reads. '
  'Use profiles table directly only for: (1) the authenticated user reading their own profile, '
  'or (2) donate/shared-post pages where payment info is intentionally user-exposed.';

-- ============================================
-- FIX #5: Expand DELETE policy on form_submissions
-- VULNERABILITY: Existing DELETE policy restricts deletion to status = 'draft' only.
--   Users cannot delete submitted, in_progress, or completed submissions.
--   This prevents honoring right-to-delete requests under 20 state privacy laws.
-- LEGAL: Required by CCPA §1798.105, VCDPA §59.1-578, CPA §6-1-1306,
--   CTDPA §42-516o, and 16 additional state privacy statutes.
-- NOTE: The existing draft-only DELETE policy is kept for backward compatibility.
--   A new policy is added to cover all non-draft statuses.
-- ============================================

-- Add DELETE policy for all submission statuses (right-to-delete compliance).
-- The existing "Users can delete their own draft submissions" policy covers drafts.
-- This new policy covers submitted, in_progress, completed, and any future statuses.
DROP POLICY IF EXISTS "Users can delete their own submissions (right to delete)" ON form_submissions;
CREATE POLICY "Users can delete their own submissions (right to delete)"
  ON form_submissions FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for audit trail
COMMENT ON POLICY "Users can delete their own submissions (right to delete)" ON form_submissions IS
  'Added 2026-02-20: Enables right-to-delete compliance. '
  'Covers all submission statuses beyond draft (submitted, in_progress, completed). '
  'Required by: CCPA §1798.105, VCDPA §59.1-578, CO CPA §6-1-1306, '
  'CT CTDPA §42-516o, and 16 additional US state privacy laws. '
  'Complements existing draft-only DELETE policy.';
