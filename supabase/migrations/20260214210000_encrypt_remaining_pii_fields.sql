-- Encrypt ALL Remaining PII/PHI Fields Using Vault DEK
-- This migration adds encrypted columns for all sensitive data fields
-- while preserving existing plaintext columns for backward compatibility during migration

-- ============================================
-- USER SECURE PROFILES - Add Encrypted Columns
-- ============================================

-- Add encrypted TEXT columns alongside existing JSONB/TEXT[] columns
ALTER TABLE user_secure_profiles
  -- Household members (contains dependent names, DOBs, SSNs)
  ADD COLUMN IF NOT EXISTS encrypted_household_members TEXT,
  ADD COLUMN IF NOT EXISTS household_members_iv TEXT,

  -- Employer information (employment history, EIN)
  ADD COLUMN IF NOT EXISTS encrypted_employer_info TEXT,
  ADD COLUMN IF NOT EXISTS employer_info_iv TEXT,

  -- Emergency contact (names, phone numbers)
  ADD COLUMN IF NOT EXISTS encrypted_emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_iv TEXT,

  -- Mailing address (full mailing address)
  ADD COLUMN IF NOT EXISTS encrypted_mailing_address TEXT,
  ADD COLUMN IF NOT EXISTS mailing_address_iv TEXT,

  -- Residential address (physical address)
  ADD COLUMN IF NOT EXISTS encrypted_residential_address TEXT,
  ADD COLUMN IF NOT EXISTS residential_address_iv TEXT,

  -- Current benefits (government benefits list)
  ADD COLUMN IF NOT EXISTS encrypted_current_benefits TEXT,
  ADD COLUMN IF NOT EXISTS current_benefits_iv TEXT,

  -- Migration tracking
  ADD COLUMN IF NOT EXISTS encryption_migrated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encryption_migrated_at TIMESTAMPTZ;

-- Add comments explaining the encrypted fields
COMMENT ON COLUMN user_secure_profiles.encrypted_household_members IS 'Encrypted household members data (names, DOBs, SSNs) - encrypted with user DEK';
COMMENT ON COLUMN user_secure_profiles.household_members_iv IS 'Initialization vector for household_members encryption';
COMMENT ON COLUMN user_secure_profiles.encrypted_employer_info IS 'Encrypted employer information (employment history, EIN) - encrypted with user DEK';
COMMENT ON COLUMN user_secure_profiles.employer_info_iv IS 'Initialization vector for employer_info encryption';
COMMENT ON COLUMN user_secure_profiles.encrypted_emergency_contact IS 'Encrypted emergency contact information - encrypted with user DEK';
COMMENT ON COLUMN user_secure_profiles.emergency_contact_iv IS 'Initialization vector for emergency_contact encryption';
COMMENT ON COLUMN user_secure_profiles.encrypted_mailing_address IS 'Encrypted mailing address - encrypted with user DEK';
COMMENT ON COLUMN user_secure_profiles.mailing_address_iv IS 'Initialization vector for mailing_address encryption';
COMMENT ON COLUMN user_secure_profiles.encrypted_residential_address IS 'Encrypted residential address - encrypted with user DEK';
COMMENT ON COLUMN user_secure_profiles.residential_address_iv IS 'Initialization vector for residential_address encryption';
COMMENT ON COLUMN user_secure_profiles.encrypted_current_benefits IS 'Encrypted current benefits array - encrypted with user DEK';
COMMENT ON COLUMN user_secure_profiles.current_benefits_iv IS 'Initialization vector for current_benefits encryption';
COMMENT ON COLUMN user_secure_profiles.encryption_migrated IS 'Flag indicating whether plaintext data has been migrated to encrypted columns';
COMMENT ON COLUMN user_secure_profiles.encryption_migrated_at IS 'Timestamp when data was migrated to encrypted columns';

-- Add index for migration tracking
CREATE INDEX IF NOT EXISTS idx_user_secure_profiles_encryption_migrated
  ON user_secure_profiles(encryption_migrated)
  WHERE encryption_migrated = FALSE;

-- ============================================
-- FORM SUBMISSIONS - Add Encrypted Columns
-- ============================================

ALTER TABLE form_submissions
  -- Form data (contains SSN, income, addresses, medical info)
  ADD COLUMN IF NOT EXISTS encrypted_form_data TEXT,
  ADD COLUMN IF NOT EXISTS form_data_iv TEXT,

  -- Signature data (e-signatures - legally binding)
  ADD COLUMN IF NOT EXISTS encrypted_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS signature_data_iv TEXT,

  -- Migration tracking
  ADD COLUMN IF NOT EXISTS encryption_migrated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encryption_migrated_at TIMESTAMPTZ;

-- Add comments explaining the encrypted fields
COMMENT ON COLUMN form_submissions.encrypted_form_data IS 'Encrypted form submission data (SSN, income, addresses, medical info) - encrypted with user DEK';
COMMENT ON COLUMN form_submissions.form_data_iv IS 'Initialization vector for form_data encryption';
COMMENT ON COLUMN form_submissions.encrypted_signature_data IS 'Encrypted e-signature data (legally binding) - encrypted with user DEK';
COMMENT ON COLUMN form_submissions.signature_data_iv IS 'Initialization vector for signature_data encryption';
COMMENT ON COLUMN form_submissions.encryption_migrated IS 'Flag indicating whether plaintext data has been migrated to encrypted columns';
COMMENT ON COLUMN form_submissions.encryption_migrated_at IS 'Timestamp when data was migrated to encrypted columns';

-- Add index for migration tracking
CREATE INDEX IF NOT EXISTS idx_form_submissions_encryption_migrated
  ON form_submissions(encryption_migrated)
  WHERE encryption_migrated = FALSE;

-- ============================================
-- DATA INTEGRITY CONSTRAINTS
-- ============================================

-- Ensure encrypted data and IV are both present or both null
DO $$
BEGIN
  -- user_secure_profiles constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'household_members_encryption_complete') THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT household_members_encryption_complete CHECK (
        (encrypted_household_members IS NULL AND household_members_iv IS NULL) OR
        (encrypted_household_members IS NOT NULL AND household_members_iv IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employer_info_encryption_complete') THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT employer_info_encryption_complete CHECK (
        (encrypted_employer_info IS NULL AND employer_info_iv IS NULL) OR
        (encrypted_employer_info IS NOT NULL AND employer_info_iv IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_contact_encryption_complete') THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT emergency_contact_encryption_complete CHECK (
        (encrypted_emergency_contact IS NULL AND emergency_contact_iv IS NULL) OR
        (encrypted_emergency_contact IS NOT NULL AND emergency_contact_iv IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mailing_address_encryption_complete') THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT mailing_address_encryption_complete CHECK (
        (encrypted_mailing_address IS NULL AND mailing_address_iv IS NULL) OR
        (encrypted_mailing_address IS NOT NULL AND mailing_address_iv IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residential_address_encryption_complete') THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT residential_address_encryption_complete CHECK (
        (encrypted_residential_address IS NULL AND residential_address_iv IS NULL) OR
        (encrypted_residential_address IS NOT NULL AND residential_address_iv IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'current_benefits_encryption_complete') THEN
    ALTER TABLE user_secure_profiles
      ADD CONSTRAINT current_benefits_encryption_complete CHECK (
        (encrypted_current_benefits IS NULL AND current_benefits_iv IS NULL) OR
        (encrypted_current_benefits IS NOT NULL AND current_benefits_iv IS NOT NULL)
      );
  END IF;

  -- form_submissions constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_data_encryption_complete') THEN
    ALTER TABLE form_submissions
      ADD CONSTRAINT form_data_encryption_complete CHECK (
        (encrypted_form_data IS NULL AND form_data_iv IS NULL) OR
        (encrypted_form_data IS NOT NULL AND form_data_iv IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signature_data_encryption_complete') THEN
    ALTER TABLE form_submissions
      ADD CONSTRAINT signature_data_encryption_complete CHECK (
        (encrypted_signature_data IS NULL AND signature_data_iv IS NULL) OR
        (encrypted_signature_data IS NOT NULL AND signature_data_iv IS NOT NULL)
      );
  END IF;
END
$$;

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- NOTE: Existing plaintext columns are preserved for backward compatibility:
-- - user_secure_profiles: household_members, employer_info, emergency_contact,
--   mailing_address, residential_address, current_benefits
-- - form_submissions: form_data, signature_data
--
-- Migration strategy:
-- 1. Application code will be updated to write to BOTH plaintext and encrypted columns
-- 2. When users unlock their vault, plaintext data will be migrated to encrypted columns
-- 3. After migration is complete for all users, plaintext columns can be dropped
-- 4. Use encryption_migrated flag to track migration progress
--
-- Security note: All encrypted fields use AES-GCM with user's DEK (Data Encryption Key)
-- Each field has its own initialization vector (IV) - IVs are never reused
