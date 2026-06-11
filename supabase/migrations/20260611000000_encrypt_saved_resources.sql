-- Wave-3: Zero-knowledge encryption of user-authored saved-resources fields.
--
-- Additive expand ONLY (no drops). Adds nullable encrypted/IV column pairs so
-- the app can store ciphertext for the four user-authored fields while leaving
-- all existing plaintext columns intact for migration tolerance.
--
-- Encrypted (user-authored, private):
--   saved_resources.notes              -> encrypted_notes / notes_iv
--   saved_resource_tasks.title         -> encrypted_title / title_iv
--   saved_resource_events.title        -> encrypted_title / title_iv
--   saved_resource_documents.file_name -> encrypted_file_name / file_name_iv
--
-- Left cleartext (public listing copies — encrypting breaks search, no privacy gain):
--   saved_resources.resource_name / resource_address / resource_phone /
--   resource_website / resource_category
--
-- RLS auto-covers the new columns (existing FOR ALL policies are row-scoped, not
-- column-scoped) so no policy change is required.
--
-- The plaintext-column DROP is a deferred Phase-3 PR and is intentionally NOT
-- part of this migration.

-- saved_resources: notes is nullable, so the plaintext col can be NULLed on write.
ALTER TABLE public.saved_resources
  ADD COLUMN IF NOT EXISTS encrypted_notes TEXT,
  ADD COLUMN IF NOT EXISTS notes_iv TEXT,
  ADD COLUMN IF NOT EXISTS encryption_migrated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_migrated_at TIMESTAMPTZ;

-- saved_resource_tasks: title is NOT NULL, so a placeholder stays in plaintext
-- and encrypted_title is treated as the source of truth.
ALTER TABLE public.saved_resource_tasks
  ADD COLUMN IF NOT EXISTS encrypted_title TEXT,
  ADD COLUMN IF NOT EXISTS title_iv TEXT;

-- saved_resource_events: title is NOT NULL (placeholder in plaintext).
ALTER TABLE public.saved_resource_events
  ADD COLUMN IF NOT EXISTS encrypted_title TEXT,
  ADD COLUMN IF NOT EXISTS title_iv TEXT;

-- saved_resource_documents: file_name is NOT NULL (placeholder in plaintext).
ALTER TABLE public.saved_resource_documents
  ADD COLUMN IF NOT EXISTS encrypted_file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_name_iv TEXT;
