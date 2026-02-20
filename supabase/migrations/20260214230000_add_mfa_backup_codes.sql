-- Migration: Add MFA Backup Codes Table
-- Description: Store hashed backup codes for MFA recovery
-- Version: 20260214230000

-- Create backup codes table
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id_unused ON mfa_backup_codes(user_id) WHERE used_at IS NULL;

-- Enable Row Level Security
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

DROP POLICY IF EXISTS "Users can view own backup codes" ON mfa_backup_codes;
-- Users can view their own backup codes
CREATE POLICY "Users can view own backup codes"
  ON mfa_backup_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own backup codes" ON mfa_backup_codes;
-- Users can insert their own backup codes
CREATE POLICY "Users can insert own backup codes"
  ON mfa_backup_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own backup codes" ON mfa_backup_codes;
-- Users can update (mark as used) their own backup codes
CREATE POLICY "Users can update own backup codes"
  ON mfa_backup_codes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own backup codes" ON mfa_backup_codes;
-- Users can delete their own backup codes
CREATE POLICY "Users can delete own backup codes"
  ON mfa_backup_codes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE mfa_backup_codes IS 'Stores hashed backup codes for MFA account recovery. Each code can only be used once.';
COMMENT ON COLUMN mfa_backup_codes.code_hash IS 'SHA-256 hash of the backup code';
COMMENT ON COLUMN mfa_backup_codes.used_at IS 'Timestamp when code was used (NULL if unused)';
