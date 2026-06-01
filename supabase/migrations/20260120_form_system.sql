-- ⚠️ DRIFT NOTE (2026-06-01): This already-applied migration's committed content diverges
-- from the LIVE production schema (live form_templates uses uuid->text id + form_type ENUM +
-- field_mappings/required_documents/agency_name; this file shows category/agency TEXT and
-- creates form_signatures which does not exist live). Live is the source of truth. The forms
-- id-type drift is reconciled forward by 20260601035919. Full column-set parity for a fresh
-- `db reset` is a tracked follow-up (regenerate this baseline from live via `supabase db pull`).
-- Do NOT edit the SQL below — it is historical/applied; reconcile forward only.

-- Form System Migration
-- Creates tables for form templates, secure profiles, and form submissions

-- ============================================
-- Form Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS form_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  schema JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  category TEXT,
  agency TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for form_templates
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category);
CREATE INDEX IF NOT EXISTS idx_form_templates_is_active ON form_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_form_templates_agency ON form_templates(agency);

-- RLS for form_templates
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read active templates
CREATE POLICY "form_templates_select_active" ON form_templates
  FOR SELECT USING (is_active = true);

-- Only admins can insert/update/delete templates
CREATE POLICY "form_templates_admin_insert" ON form_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "form_templates_admin_update" ON form_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "form_templates_admin_delete" ON form_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- Secure Profiles Table (encrypted user data)
-- ============================================

CREATE TABLE IF NOT EXISTS secure_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,
  key_check TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for secure_profiles
CREATE INDEX IF NOT EXISTS idx_secure_profiles_user_id ON secure_profiles(user_id);

-- RLS for secure_profiles
ALTER TABLE secure_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only access their own secure profile
CREATE POLICY "secure_profiles_user_select" ON secure_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "secure_profiles_user_insert" ON secure_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "secure_profiles_user_update" ON secure_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "secure_profiles_user_delete" ON secure_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Form Submissions Table
-- ============================================

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES form_templates(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'approved', 'rejected', 'archived')),
  data JSONB NOT NULL DEFAULT '{}',
  encrypted_data TEXT, -- For sensitive fields
  submitted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for form_submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at DESC);

-- RLS for form_submissions
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "form_submissions_user_select" ON form_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own submissions
CREATE POLICY "form_submissions_user_insert" ON form_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own draft submissions
CREATE POLICY "form_submissions_user_update" ON form_submissions
  FOR UPDATE USING (
    auth.uid() = user_id
    AND status = 'draft'
  );

-- Admins can view all submissions
CREATE POLICY "form_submissions_admin_select" ON form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update submission status
CREATE POLICY "form_submissions_admin_update" ON form_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- Form Signatures Table
-- ============================================

CREATE TABLE IF NOT EXISTS form_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  signature_data TEXT NOT NULL, -- Base64 typed name or drawing
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(submission_id, user_id)
);

-- Index for form_signatures
CREATE INDEX IF NOT EXISTS idx_form_signatures_submission_id ON form_signatures(submission_id);

-- RLS for form_signatures
ALTER TABLE form_signatures ENABLE ROW LEVEL SECURITY;

-- Users can view their own signatures
CREATE POLICY "form_signatures_user_select" ON form_signatures
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own signatures
CREATE POLICY "form_signatures_user_insert" ON form_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all signatures
CREATE POLICY "form_signatures_admin_select" ON form_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- Updated at trigger function
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS form_templates_updated_at ON form_templates;
CREATE TRIGGER form_templates_updated_at
  BEFORE UPDATE ON form_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS secure_profiles_updated_at ON secure_profiles;
CREATE TRIGGER secure_profiles_updated_at
  BEFORE UPDATE ON secure_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS form_submissions_updated_at ON form_submissions;
CREATE TRIGGER form_submissions_updated_at
  BEFORE UPDATE ON form_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
