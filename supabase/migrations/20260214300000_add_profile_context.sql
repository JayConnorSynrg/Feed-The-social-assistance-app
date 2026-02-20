-- Add onboarding context fields to profiles table
-- These support geolocation, needs assessment, and onboarding flow

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS needs JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'seeking' CHECK (user_role IN ('seeking', 'providing', 'facilitator', 'both'));

-- Index for geolocation-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for onboarding status
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles (onboarding_completed)
  WHERE onboarding_completed = FALSE;
