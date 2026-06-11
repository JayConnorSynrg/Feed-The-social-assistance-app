-- P9-T8: Create government-forms storage bucket (private, service_role sync only)
-- Mirrors the idiom from 20260214220000_add_document_encryption_fields.sql.
-- Idempotent: ON CONFLICT DO NOTHING on bucket insert; DROP IF EXISTS on policies.

DO $$
BEGIN
  -- Create bucket if it does not already exist.
  -- public=false: all access requires a signed URL or authenticated RLS policy.
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('government-forms', 'government-forms', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Drop policies before (re-)creating so migration is re-runnable.
DROP POLICY IF EXISTS "gov_forms_select_authenticated" ON storage.objects;

-- Authenticated users can download any object in this bucket.
-- No INSERT/UPDATE/DELETE for client roles — writes come from service_role (sync script).
CREATE POLICY "gov_forms_select_authenticated" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'government-forms');
