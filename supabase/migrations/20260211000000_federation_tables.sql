-- ============================================
-- FEED Federation Protocol - Database Schema
-- Version: 1.0.0
-- Created: 2026-02-11
-- Description: Tables for federated resource sharing between FEED instances
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text matching
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE; -- For geospatial queries

-- ============================================
-- TABLE 1: federated_instances
-- Stores information about known FEED instances (both local and remote)
-- ============================================

CREATE TABLE IF NOT EXISTS public.federated_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_url TEXT NOT NULL UNIQUE,
  instance_name TEXT NOT NULL,
  is_local BOOLEAN NOT NULL DEFAULT FALSE,
  public_key TEXT NOT NULL, -- RSA public key for HTTP signature verification (PEM format)
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'blocked')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federated_instances_url ON public.federated_instances(instance_url);
CREATE INDEX idx_federated_instances_status ON public.federated_instances(status);
CREATE INDEX idx_federated_instances_is_local ON public.federated_instances(is_local);

-- Only one local instance allowed
CREATE UNIQUE INDEX idx_one_local_instance ON public.federated_instances(is_local) WHERE is_local = TRUE;

-- RLS Policies
ALTER TABLE public.federated_instances ENABLE ROW LEVEL SECURITY;

-- Anyone can read active instances (needed for federation discovery)
CREATE POLICY "Anyone can view active instances"
  ON public.federated_instances
  FOR SELECT
  USING (status = 'active');

-- Only admins can insert/update/delete instances
CREATE POLICY "Only admins can manage instances"
  ON public.federated_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- TABLE 2: federation_peers
-- Tracks trust relationships and settings between instances
-- ============================================

CREATE TABLE IF NOT EXISTS public.federation_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_instance_id UUID NOT NULL REFERENCES public.federated_instances(id) ON DELETE CASCADE,
  remote_instance_id UUID NOT NULL REFERENCES public.federated_instances(id) ON DELETE CASCADE,
  trust_score DECIMAL(3,2) NOT NULL DEFAULT 0.50 CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
  trust_level TEXT NOT NULL CHECK (trust_level IN ('untrusted', 'pending', 'trusted', 'verified', 'core')) DEFAULT 'pending',
  federation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (sync_interval_minutes >= 5),
  shared_resource_categories TEXT[] DEFAULT ARRAY['food', 'housing', 'healthcare', 'legal', 'employment', 'education'],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(local_instance_id, remote_instance_id)
);

-- Indexes
CREATE INDEX idx_federation_peers_local ON public.federation_peers(local_instance_id);
CREATE INDEX idx_federation_peers_remote ON public.federation_peers(remote_instance_id);
CREATE INDEX idx_federation_peers_trust_level ON public.federation_peers(trust_level);
CREATE INDEX idx_federation_peers_enabled ON public.federation_peers(federation_enabled) WHERE federation_enabled = TRUE;

-- RLS Policies
ALTER TABLE public.federation_peers ENABLE ROW LEVEL SECURITY;

-- Anyone can read enabled federation peers (needed for search)
CREATE POLICY "Anyone can view enabled federation peers"
  ON public.federation_peers
  FOR SELECT
  USING (federation_enabled = TRUE);

-- Only admins can manage peers
CREATE POLICY "Only admins can manage peers"
  ON public.federation_peers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- TABLE 3: federated_resources
-- Caches resources synced from federated instances
-- ============================================

CREATE TABLE IF NOT EXISTS public.federated_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_instance_id UUID NOT NULL REFERENCES public.federated_instances(id) ON DELETE CASCADE,
  source_resource_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('food', 'housing', 'healthcare', 'legal', 'employment', 'education', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  website TEXT,
  hours_of_operation JSONB,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_verified BOOLEAN DEFAULT FALSE,
  trust_score DECIMAL(3,2) CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_instance_id, source_resource_id)
);

-- Indexes
CREATE INDEX idx_federated_resources_source ON public.federated_resources(source_instance_id);
CREATE INDEX idx_federated_resources_type ON public.federated_resources(resource_type);
CREATE INDEX idx_federated_resources_location ON public.federated_resources(city, state);
CREATE INDEX idx_federated_resources_geo ON public.federated_resources USING GIST (
  ll_to_earth(latitude::float8, longitude::float8)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_federated_resources_name_trgm ON public.federated_resources USING GIN (name gin_trgm_ops);
CREATE INDEX idx_federated_resources_synced ON public.federated_resources(last_synced_at);

-- RLS Policies
ALTER TABLE public.federated_resources ENABLE ROW LEVEL SECURITY;

-- Anyone can view federated resources from trusted peers
CREATE POLICY "Anyone can view federated resources from trusted peers"
  ON public.federated_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.federation_peers fp
      WHERE fp.remote_instance_id = source_instance_id
        AND fp.federation_enabled = TRUE
        AND fp.trust_level IN ('trusted', 'verified', 'core')
    )
  );

-- Only system can insert/update/delete (via Edge Functions)
CREATE POLICY "Only service role can manage federated resources"
  ON public.federated_resources
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- TABLE 4: federation_sync_log
-- Tracks synchronization history and errors
-- ============================================

CREATE TABLE IF NOT EXISTS public.federation_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID NOT NULL REFERENCES public.federation_peers(id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('success', 'partial', 'failed')),
  resources_fetched INTEGER DEFAULT 0,
  resources_created INTEGER DEFAULT 0,
  resources_updated INTEGER DEFAULT 0,
  resources_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  sync_duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_federation_sync_log_peer ON public.federation_sync_log(peer_id);
CREATE INDEX idx_federation_sync_log_status ON public.federation_sync_log(sync_status);
CREATE INDEX idx_federation_sync_log_started ON public.federation_sync_log(started_at DESC);

-- RLS Policies
ALTER TABLE public.federation_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can view sync logs
CREATE POLICY "Admins can view sync logs"
  ON public.federation_sync_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Only service role can insert sync logs
CREATE POLICY "Only service role can insert sync logs"
  ON public.federation_sync_log
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- TABLE 5: federation_health_checks
-- Tracks uptime and availability of federated instances
-- ============================================

CREATE TABLE IF NOT EXISTS public.federation_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.federated_instances(id) ON DELETE CASCADE,
  check_status TEXT NOT NULL CHECK (check_status IN ('healthy', 'degraded', 'unhealthy', 'timeout')),
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federation_health_checks_instance ON public.federation_health_checks(instance_id);
CREATE INDEX idx_federation_health_checks_status ON public.federation_health_checks(check_status);
CREATE INDEX idx_federation_health_checks_checked ON public.federation_health_checks(checked_at DESC);

-- Automatically delete health checks older than 30 days
-- (pg_cron would handle this in production, or a scheduled Edge Function)

-- RLS Policies
ALTER TABLE public.federation_health_checks ENABLE ROW LEVEL SECURITY;

-- Admins can view health checks
CREATE POLICY "Admins can view health checks"
  ON public.federation_health_checks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Only service role can insert health checks
CREATE POLICY "Only service role can insert health checks"
  ON public.federation_health_checks
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- TABLE 6: federation_trust_events
-- Audit log for trust score changes
-- ============================================

CREATE TABLE IF NOT EXISTS public.federation_trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID NOT NULL REFERENCES public.federation_peers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'uptime_increase', 'uptime_decrease',
    'data_quality_increase', 'data_quality_decrease',
    'moderation_increase', 'moderation_decrease',
    'community_report_positive', 'community_report_negative',
    'manual_override', 'sync_failure', 'health_check_failure'
  )),
  old_trust_score DECIMAL(3,2) NOT NULL,
  new_trust_score DECIMAL(3,2) NOT NULL,
  old_trust_level TEXT,
  new_trust_level TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federation_trust_events_peer ON public.federation_trust_events(peer_id);
CREATE INDEX idx_federation_trust_events_type ON public.federation_trust_events(event_type);
CREATE INDEX idx_federation_trust_events_created ON public.federation_trust_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.federation_trust_events ENABLE ROW LEVEL SECURITY;

-- Admins can view trust events
CREATE POLICY "Admins can view trust events"
  ON public.federation_trust_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Only service role can insert trust events
CREATE POLICY "Only service role can insert trust events"
  ON public.federation_trust_events
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_federated_instances_updated_at
  BEFORE UPDATE ON public.federated_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_federation_peers_updated_at
  BEFORE UPDATE ON public.federation_peers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_federated_resources_updated_at
  BEFORE UPDATE ON public.federated_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate trust score from metrics
CREATE OR REPLACE FUNCTION public.calculate_trust_score(
  uptime_score DECIMAL,
  data_quality_score DECIMAL,
  moderation_score DECIMAL,
  community_score DECIMAL,
  longevity_days INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
  longevity_score DECIMAL;
BEGIN
  -- Longevity score: max 1.0 at 180 days
  longevity_score := LEAST(longevity_days / 180.0, 1.0);

  -- Weighted average
  RETURN (
    uptime_score * 0.30 +
    data_quality_score * 0.25 +
    moderation_score * 0.20 +
    community_score * 0.15 +
    longevity_score * 0.10
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine trust level from trust score
CREATE OR REPLACE FUNCTION public.trust_score_to_level(score DECIMAL)
RETURNS TEXT AS $$
BEGIN
  CASE
    WHEN score < 0.2 THEN RETURN 'untrusted';
    WHEN score < 0.4 THEN RETURN 'pending';
    WHEN score < 0.7 THEN RETURN 'trusted';
    WHEN score < 0.9 THEN RETURN 'verified';
    ELSE RETURN 'core';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get stale federated resources (not synced in 24 hours)
CREATE OR REPLACE FUNCTION public.get_stale_federated_resources(hours_threshold INTEGER DEFAULT 24)
RETURNS TABLE (
  resource_id UUID,
  source_instance_url TEXT,
  hours_since_sync DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.id,
    fi.instance_url,
    EXTRACT(EPOCH FROM (NOW() - fr.last_synced_at)) / 3600 AS hours_since_sync
  FROM public.federated_resources fr
  JOIN public.federated_instances fi ON fr.source_instance_id = fi.id
  WHERE fr.last_synced_at < NOW() - (hours_threshold || ' hours')::INTERVAL
  ORDER BY fr.last_synced_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get instance uptime percentage (last 30 days)
CREATE OR REPLACE FUNCTION public.get_instance_uptime(instance_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_checks INTEGER;
  healthy_checks INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE check_status = 'healthy')
  INTO total_checks, healthy_checks
  FROM public.federation_health_checks
  WHERE instance_id = instance_id
    AND checked_at > NOW() - INTERVAL '30 days';

  IF total_checks = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((healthy_checks::DECIMAL / total_checks) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert local instance (to be updated with actual values)
-- This should be updated via the federation setup CLI
INSERT INTO public.federated_instances (
  instance_url,
  instance_name,
  is_local,
  public_key,
  status
) VALUES (
  'http://localhost:3000',
  'Local Development Instance',
  TRUE,
  'PLACEHOLDER_PUBLIC_KEY', -- Replace with actual public key
  'active'
) ON CONFLICT (instance_url) DO NOTHING;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.federated_instances IS 'Registry of known FEED instances (local and remote)';
COMMENT ON TABLE public.federation_peers IS 'Trust relationships and sync settings between instances';
COMMENT ON TABLE public.federated_resources IS 'Cached resources from federated instances';
COMMENT ON TABLE public.federation_sync_log IS 'History of synchronization attempts';
COMMENT ON TABLE public.federation_health_checks IS 'Uptime and health monitoring for federated instances';
COMMENT ON TABLE public.federation_trust_events IS 'Audit log for trust score changes';

COMMENT ON COLUMN public.federated_instances.public_key IS 'RSA-4096 public key in PEM format for HTTP signature verification';
COMMENT ON COLUMN public.federation_peers.trust_score IS 'Calculated trust score from 0.0 (untrusted) to 1.0 (fully trusted)';
COMMENT ON COLUMN public.federation_peers.trust_level IS 'Categorized trust level: untrusted, pending, trusted, verified, core';
COMMENT ON COLUMN public.federated_resources.source_resource_id IS 'Original resource ID from source instance';
COMMENT ON COLUMN public.federated_resources.trust_score IS 'Inherited trust score from source instance';

-- ============================================
-- COMPLETION
-- ============================================

-- Verify all tables created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'federated_instances',
      'federation_peers',
      'federated_resources',
      'federation_sync_log',
      'federation_health_checks',
      'federation_trust_events'
    );

  IF table_count = 6 THEN
    RAISE NOTICE '✅ All 6 federation tables created successfully';
  ELSE
    RAISE WARNING '⚠️ Only % of 6 federation tables created', table_count;
  END IF;
END $$;
