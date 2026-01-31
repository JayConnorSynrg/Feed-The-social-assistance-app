-- FEED Platform: Resources Table Migration
-- Creates resources table for map markers with geospatial support

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
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
