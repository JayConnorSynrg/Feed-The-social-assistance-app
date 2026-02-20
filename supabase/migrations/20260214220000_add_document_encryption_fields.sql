-- Add Document Encryption Fields
-- Adds encryption metadata to user_documents table for client-side encryption

-- Check if user_documents table exists, create if not
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_documents') THEN
    -- Create user_documents table if it doesn't exist
    CREATE TABLE user_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      category TEXT,
      file_path TEXT NOT NULL,
      file_size BIGINT,
      mime_type TEXT,
      notes TEXT,
      submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL,
      is_verified BOOLEAN DEFAULT false,
      verified_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create index on user_id for fast lookups
    CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
    CREATE INDEX idx_user_documents_category ON user_documents(category);
    CREATE INDEX idx_user_documents_submission_id ON user_documents(submission_id);

    -- Enable RLS
    ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

    -- RLS Policies: Users can only access their own documents
    CREATE POLICY "user_documents_select_own" ON user_documents
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "user_documents_insert_own" ON user_documents
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "user_documents_update_own" ON user_documents
      FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY "user_documents_delete_own" ON user_documents
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add encryption fields to user_documents table
ALTER TABLE user_documents
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_original_name TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_name_iv TEXT,
  ADD COLUMN IF NOT EXISTS original_size BIGINT,
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- Create index on is_encrypted for filtering
CREATE INDEX IF NOT EXISTS idx_user_documents_is_encrypted ON user_documents(is_encrypted);

-- Add comment explaining encryption fields
COMMENT ON COLUMN user_documents.encryption_iv IS 'IV (Initialization Vector) used for file encryption (Base64)';
COMMENT ON COLUMN user_documents.encrypted_original_name IS 'Encrypted original filename (Base64)';
COMMENT ON COLUMN user_documents.encrypted_name_iv IS 'IV used for filename encryption (Base64)';
COMMENT ON COLUMN user_documents.original_size IS 'Original file size in bytes before encryption';
COMMENT ON COLUMN user_documents.is_encrypted IS 'Flag indicating if file is client-side encrypted';

-- Ensure Storage bucket exists with proper RLS policies
DO $$
BEGIN
  -- Insert bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('user-documents', 'user-documents', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage RLS Policies: Users can only access their own documents
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "user_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "user_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "user_documents_delete" ON storage.objects;

-- Create storage policies
-- Users can upload to their own folder
CREATE POLICY "user_documents_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read from their own folder
CREATE POLICY "user_documents_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete from their own folder
CREATE POLICY "user_documents_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_user_documents_updated_at ON user_documents;

-- Create trigger for updated_at
CREATE TRIGGER update_user_documents_updated_at
  BEFORE UPDATE ON user_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
