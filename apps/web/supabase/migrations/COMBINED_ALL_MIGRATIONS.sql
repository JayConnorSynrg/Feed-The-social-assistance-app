-- ============================================================
-- FEED Platform: Combined Migrations
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- MIGRATION 1: Core Tables
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  venmo_username TEXT,
  paypal_email TEXT,
  location_city TEXT,
  location_state TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Follow relationships table
CREATE TABLE public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Indexes for follow lookups
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- Enable RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follows
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows
  FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================================
-- MIGRATION 2: Posts Table
-- ============================================================

CREATE TABLE public.posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_user_created ON public.posts(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts
  FOR SELECT
  USING (NOT is_hidden);

CREATE POLICY "Users can create their own posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Likes table
CREATE TABLE public.post_likes (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Indexes for likes
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_id);

-- Enable RLS for likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for likes
CREATE POLICY "Likes are viewable by everyone"
  ON public.post_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.post_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.post_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE public.post_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX idx_comments_post ON public.post_comments(post_id);
CREATE INDEX idx_comments_user ON public.post_comments(user_id);
CREATE INDEX idx_comments_parent ON public.post_comments(parent_id);

-- Enable RLS for comments
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Comments are viewable by everyone"
  ON public.post_comments
  FOR SELECT
  USING (NOT is_hidden);

CREATE POLICY "Users can create comments"
  ON public.post_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.post_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.post_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for comments updated_at
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- MIGRATION 3: Resources Table
-- ============================================================

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Resource categories enum
CREATE TYPE resource_category AS ENUM (
  'food',
  'housing',
  'healthcare',
  'employment',
  'education',
  'legal',
  'transportation',
  'utilities',
  'clothing',
  'financial',
  'mental_health',
  'substance_abuse',
  'domestic_violence',
  'childcare',
  'senior_services',
  'disability_services',
  'veteran_services',
  'immigration',
  'other'
);

-- Resource source enum
CREATE TYPE resource_source AS ENUM (
  'user_submitted',
  '211_api',
  'admin_added',
  'partner_org'
);

-- Resource status enum
CREATE TYPE resource_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'archived'
);

-- Resources table
CREATE TABLE public.resources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category resource_category NOT NULL DEFAULT 'other',

  -- Location data
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  location GEOGRAPHY(POINT, 4326),

  -- Contact info
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Hours of operation (JSON for flexibility)
  hours_of_operation JSONB,

  -- Additional info
  eligibility_requirements TEXT,
  languages_served TEXT[],
  services_offered TEXT[],

  -- Source tracking
  source resource_source DEFAULT 'user_submitted',
  external_id TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Moderation
  status resource_status DEFAULT 'pending',
  moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Metadata
  is_verified BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for location queries
CREATE INDEX idx_resources_location ON public.resources USING GIST (location);

-- Regular indexes
CREATE INDEX idx_resources_category ON public.resources(category);
CREATE INDEX idx_resources_status ON public.resources(status);
CREATE INDEX idx_resources_city_state ON public.resources(city, state);
CREATE INDEX idx_resources_submitted_by ON public.resources(submitted_by);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resources
CREATE POLICY "Approved resources are viewable by everyone"
  ON public.resources
  FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can view their own pending submissions"
  ON public.resources
  FOR SELECT
  USING (auth.uid() = submitted_by);

CREATE POLICY "Users can submit resources"
  ON public.resources
  FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can update their pending submissions"
  ON public.resources
  FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending');

CREATE POLICY "Admins can manage all resources"
  ON public.resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to search resources by location
CREATE OR REPLACE FUNCTION public.nearby_resources(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION DEFAULT 25
)
RETURNS SETOF public.resources AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.resources
  WHERE status = 'approved'
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resource bookmarks
CREATE TABLE public.resource_bookmarks (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, resource_id)
);

-- Enable RLS for bookmarks
ALTER TABLE public.resource_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON public.resource_bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookmarks"
  ON public.resource_bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON public.resource_bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- MIGRATION 4: Form Tables
-- ============================================================

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

-- ============================================================
-- END OF MIGRATIONS
-- ============================================================
