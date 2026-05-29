-- Migration: make form_data nullable for zero-knowledge vault path
--
-- The vault encryption path (use-vault-form-submission.ts) stores all user PII
-- exclusively in encrypted_form_data + form_data_iv columns (AES-GCM).
-- The plaintext form_data column is intentionally set to NULL on every vault insert
-- and update — writing plaintext would negate the statutory safe harbor under all
-- 50-state breach notification laws and violate the zero-knowledge representation
-- made to users.
--
-- This constraint loosening is the prerequisite for vault-path inserts to succeed.
-- It is reversible: rows that previously had form_data NOT NULL still have their
-- data. Only new vault-path rows (encryption_migrated=true) will have form_data=NULL.

ALTER TABLE public.form_submissions
  ALTER COLUMN form_data DROP NOT NULL;

ALTER TABLE public.form_submissions
  ALTER COLUMN form_data SET DEFAULT '{}'::jsonb;
