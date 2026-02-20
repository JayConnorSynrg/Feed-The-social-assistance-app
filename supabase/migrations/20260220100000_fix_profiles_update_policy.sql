-- ============================================
-- FIX: Add missing UPDATE and INSERT RLS policies on profiles
-- BUG: Onboarding stalls because .update() silently fails — no UPDATE policy exists
-- ALSO: Add missing location_city and location_state columns
-- ============================================

-- Add missing columns (location_city, location_state referenced in public_profiles view)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_state TEXT;

-- Users can update their own profile (required for onboarding + settings)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (fallback if trigger doesn't fire)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
