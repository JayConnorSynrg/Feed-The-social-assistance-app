-- Add Vault Key Storage to user_secure_profiles table
-- This migration adds the necessary fields for zero-knowledge encryption vault

-- First, check if secure_profiles exists and rename it to user_secure_profiles if needed
-- This handles the case where the table was created with the old name
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'secure_profiles'
  ) AND NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_secure_profiles'
  ) THEN
    ALTER TABLE secure_profiles RENAME TO user_secure_profiles;
  END IF;
END
$$;

-- Add vault-related columns to user_secure_profiles table (or create it if it doesn't exist)
CREATE TABLE IF NOT EXISTS user_secure_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data TEXT,
  key_check TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add vault columns
ALTER TABLE user_secure_profiles
  ADD COLUMN IF NOT EXISTS encryption_salt TEXT,
  ADD COLUMN IF NOT EXISTS wrapped_dek TEXT,
  ADD COLUMN IF NOT EXISTS dek_iv TEXT,
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vault_created_at TIMESTAMPTZ;

-- Add comment explaining the zero-knowledge architecture
COMMENT ON COLUMN user_secure_profiles.encryption_salt IS 'Base64-encoded salt for PBKDF2 key derivation (stored on server, but non-sensitive)';
COMMENT ON COLUMN user_secure_profiles.wrapped_dek IS 'DEK (Data Encryption Key) wrapped by KEK (Key Encryption Key). Server stores this but cannot unwrap without user password.';
COMMENT ON COLUMN user_secure_profiles.dek_iv IS 'Initialization vector used when wrapping the DEK';
COMMENT ON COLUMN user_secure_profiles.encryption_version IS 'Version number for encryption scheme (allows for future upgrades)';
COMMENT ON COLUMN user_secure_profiles.vault_created_at IS 'Timestamp when the vault was first created';

-- Add index on vault_created_at for analytics
CREATE INDEX IF NOT EXISTS idx_user_secure_profiles_vault_created
  ON user_secure_profiles(vault_created_at)
  WHERE vault_created_at IS NOT NULL;

-- Add constraint to ensure vault data is complete or empty (not partial)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vault_data_complete'
  ) THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT vault_data_complete CHECK (
        (encryption_salt IS NULL AND wrapped_dek IS NULL AND dek_iv IS NULL) OR
        (encryption_salt IS NOT NULL AND wrapped_dek IS NOT NULL AND dek_iv IS NOT NULL)
      );
  END IF;
END
$$;

-- Enable RLS if not already enabled
ALTER TABLE user_secure_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_secure_profiles'
    AND policyname = 'user_secure_profiles_self_access'
  ) THEN
    CREATE POLICY user_secure_profiles_self_access ON user_secure_profiles
      FOR ALL USING (auth.uid() = id);
  END IF;
END
$$;
