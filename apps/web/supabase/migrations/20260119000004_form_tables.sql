-- FEED Platform: Form Tables Migration
-- Creates form templates, submissions, and secure profile data

-- Form type enum
CREATE TYPE form_type AS ENUM (
  'snap',           -- SNAP/Food Stamps
  'medicaid',       -- Medicaid/Health Coverage
  'tanf',           -- TANF/Cash Assistance
  'wic',            -- WIC Program
  'housing',        -- Housing Assistance
  'utility',        -- Utility Assistance
  'unemployment',   -- Unemployment Benefits
  'disability',     -- Disability Benefits
  'childcare',      -- Childcare Assistance
  'general'         -- General Application
);

-- Submission status enum
CREATE TYPE submission_status AS ENUM (
  'draft',
  'in_progress',
  'submitted',
  'under_review',
  'approved',
  'denied',
  'pending_info',
  'expired'
);

-- Form templates table
CREATE TABLE public.form_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  form_type form_type NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  -- Form schema (JSON Schema format)
  schema JSONB NOT NULL,

  -- Field mappings to secure profile
  field_mappings JSONB,

  -- Required documents
  required_documents TEXT[],

  -- Metadata
  agency_name TEXT,
  agency_website TEXT,
  estimated_time_minutes INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for form template lookups
CREATE INDEX idx_form_templates_type ON public.form_templates(form_type);
CREATE INDEX idx_form_templates_active ON public.form_templates(is_active);

-- Enable RLS
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies - templates are public read
CREATE POLICY "Form templates are viewable by everyone"
  ON public.form_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage form templates"
  ON public.form_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Form submissions table
CREATE TABLE public.form_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.form_templates(id) ON DELETE RESTRICT NOT NULL,

  -- Submission data (encrypted)
  form_data JSONB NOT NULL,

  -- Status tracking
  status submission_status DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),

  -- Progress tracking
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER,
  completion_percentage INTEGER DEFAULT 0,

  -- E-signature data
  signature_data TEXT,
  signed_at TIMESTAMPTZ,

  -- Notes and communication
  notes TEXT,
  agency_reference_number TEXT,

  -- Deadline tracking
  deadline TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_submissions_user ON public.form_submissions(user_id);
CREATE INDEX idx_submissions_template ON public.form_submissions(template_id);
CREATE INDEX idx_submissions_status ON public.form_submissions(status);
CREATE INDEX idx_submissions_user_status ON public.form_submissions(user_id, status);

-- Enable RLS
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own submissions"
  ON public.form_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions"
  ON public.form_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own draft submissions"
  ON public.form_submissions
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('draft', 'in_progress'));

CREATE POLICY "Users can delete their own draft submissions"
  ON public.form_submissions
  FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Secure user profiles (encrypted sensitive data)
CREATE TABLE public.user_secure_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,

  -- Personal info (will be encrypted client-side)
  encrypted_ssn TEXT,
  encrypted_dob TEXT,
  encrypted_income TEXT,

  -- Household info
  household_size INTEGER,
  household_members JSONB,  -- Encrypted household member details

  -- Employment info
  employment_status TEXT,
  employer_info JSONB,

  -- Address info
  mailing_address JSONB,
  residential_address JSONB,

  -- Benefits info
  current_benefits TEXT[],

  -- Emergency contact
  emergency_contact JSONB,

  -- Encryption metadata
  encryption_version INTEGER DEFAULT 1,
  last_decrypted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_secure_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own secure data
CREATE POLICY "Users can view their own secure profile"
  ON public.user_secure_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own secure profile"
  ON public.user_secure_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own secure profile"
  ON public.user_secure_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger for updated_at
CREATE TRIGGER update_secure_profiles_updated_at
  BEFORE UPDATE ON public.user_secure_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- User documents table
CREATE TABLE public.user_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  submission_id UUID REFERENCES public.form_submissions(id) ON DELETE SET NULL,

  -- Document info
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Categorization
  category TEXT,

  -- Expiration tracking
  expires_at TIMESTAMPTZ,

  -- Metadata
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_user ON public.user_documents(user_id);
CREATE INDEX idx_documents_submission ON public.user_documents(submission_id);
CREATE INDEX idx_documents_type ON public.user_documents(document_type);

-- Enable RLS
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own documents"
  ON public.user_documents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own documents"
  ON public.user_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.user_documents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.user_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.user_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
