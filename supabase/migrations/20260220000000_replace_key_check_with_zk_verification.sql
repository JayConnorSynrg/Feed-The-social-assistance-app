-- Migration: Replace SHA-256 key_check with Zero-Knowledge Verification
-- Date: 2026-02-20
--
-- SECURITY FIX: The legacy key_check column stored SHA-256(masterPassword),
-- which an attacker with database access could brute-force at billions of
-- hashes per second, completely bypassing the 600,000-iteration PBKDF2
-- investment and destroying the encryption safe harbor.
--
-- REPLACEMENT: Two new columns store the output of an AES-GCM encryption
-- operation (using a PBKDF2-derived Vault Verification Key) over a fixed
-- known constant. Password verification on unlock uses the AES-GCM
-- authentication tag as the proof-of-knowledge mechanism. An attacker must
-- pay 600,000 PBKDF2 iterations per guess regardless of what is in the DB.
--
-- COLUMNS ADDED:
--   verification_ciphertext  TEXT  -- base64(AES-GCM ciphertext of "FEED_VAULT_VERIFY_v1")
--   verification_iv          TEXT  -- base64(12-byte random IV used for that encryption)
--
-- COLUMN DEPRECATED:
--   key_check  -- retained as nullable for the migration window; will be
--               -- dropped in a follow-up migration once all existing vaults
--               -- have been re-enrolled via unlockVault() or re-setup.

BEGIN;

-- 1. Add the two new zero-knowledge verification columns.
ALTER TABLE user_secure_profiles
  ADD COLUMN IF NOT EXISTS verification_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS verification_iv         TEXT;

-- 2. Deprecate key_check column if it exists (skip comment if column was never added).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_secure_profiles' AND column_name = 'key_check'
  ) THEN
    COMMENT ON COLUMN user_secure_profiles.key_check IS
      'DEPRECATED 2026-02-20: Replaced by verification_ciphertext + verification_iv.';
  END IF;
END $$;

COMMENT ON COLUMN user_secure_profiles.verification_ciphertext IS
  'AES-GCM ciphertext (base64) of the fixed constant "FEED_VAULT_VERIFY_v1" '
  'encrypted with the Vault Verification Key (VVK). '
  'VVK = PBKDF2(masterPassword, salt || "_verify", 600000 iterations, SHA-256). '
  'Used for zero-knowledge password verification: decryption success = correct password.';

COMMENT ON COLUMN user_secure_profiles.verification_iv IS
  'Random 12-byte IV (base64) used for the AES-GCM encryption stored in '
  'verification_ciphertext. Generated fresh on each vault setup or password change.';

COMMIT;

-- ============================================================
-- TODO (follow-up migration, scheduled after migration window):
-- ALTER TABLE user_secure_profiles DROP COLUMN key_check;
-- ============================================================
