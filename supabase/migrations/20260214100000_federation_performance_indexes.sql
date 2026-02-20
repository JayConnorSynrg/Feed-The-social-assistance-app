-- Federation Performance Optimization Indexes
-- Part of Phase 6: Production Hardening
-- Addresses F6-T6 requirements for search and geographic query optimization

-- =============================================
-- Section 1: Text Search Indexes
-- =============================================

-- GIN trigram index for fuzzy text search on federated resources
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Name search (most common search field)
CREATE INDEX IF NOT EXISTS idx_federated_resources_name_trgm
  ON federated_resources USING GIN (name gin_trgm_ops);

-- Description search
CREATE INDEX IF NOT EXISTS idx_federated_resources_desc_trgm
  ON federated_resources USING GIN (description gin_trgm_ops);

-- Resource type for category filtering
CREATE INDEX IF NOT EXISTS idx_federated_resources_type
  ON federated_resources (resource_type);

-- Composite index for source instance lookups
CREATE INDEX IF NOT EXISTS idx_federated_resources_source
  ON federated_resources (source_instance_id, source_resource_id);

-- =============================================
-- Section 2: Geographic Indexes
-- =============================================

-- Lat/lng index for geographic queries using btree (for range scans)
CREATE INDEX IF NOT EXISTS idx_federated_resources_lat
  ON federated_resources (latitude) WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_federated_resources_lng
  ON federated_resources (longitude) WHERE longitude IS NOT NULL;

-- Composite lat/lng for bounding box queries
CREATE INDEX IF NOT EXISTS idx_federated_resources_geo
  ON federated_resources (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Same for local resources
CREATE INDEX IF NOT EXISTS idx_resources_name_trgm
  ON resources USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_resources_desc_trgm
  ON resources USING GIN (description gin_trgm_ops);

-- =============================================
-- Section 3: Federation Instance Indexes
-- =============================================

-- Status filter (frequently used in queries)
CREATE INDEX IF NOT EXISTS idx_federated_instances_status
  ON federated_instances (status);

-- Domain lookup
CREATE INDEX IF NOT EXISTS idx_federated_instances_url
  ON federated_instances (instance_url);

-- =============================================
-- Section 4: Federation Peer Indexes
-- =============================================

-- Active peer lookup
CREATE INDEX IF NOT EXISTS idx_federation_peers_enabled
  ON federation_peers (federation_enabled) WHERE federation_enabled = true;

-- Peer trust score for ranking
CREATE INDEX IF NOT EXISTS idx_federation_peers_trust
  ON federation_peers (trust_score DESC);

-- =============================================
-- Section 5: Sync Log Indexes
-- =============================================

-- Recent syncs by peer
CREATE INDEX IF NOT EXISTS idx_federation_sync_log_peer_time
  ON federation_sync_log (peer_id, started_at DESC);

-- Failed syncs for monitoring
CREATE INDEX IF NOT EXISTS idx_federation_sync_log_status
  ON federation_sync_log (sync_status) WHERE sync_status = 'failed';

-- =============================================
-- Section 6: Materialized View for Trust Scores
-- =============================================

-- Materialized view combining instance info with trust metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS federation_trust_overview AS
SELECT
  fi.id AS instance_id,
  fi.instance_name,
  fi.instance_url,
  fi.status,
  fi.created_at AS registered_at,
  fp.id AS peer_id,
  fp.trust_score,
  fp.federation_enabled,
  fp.updated_at AS last_sync_at,
  COALESCE(fr_counts.resource_count, 0) AS resource_count,
  COALESCE(sl_stats.total_syncs, 0) AS total_syncs,
  COALESCE(sl_stats.successful_syncs, 0) AS successful_syncs,
  COALESCE(sl_stats.failed_syncs, 0) AS failed_syncs,
  CASE
    WHEN COALESCE(sl_stats.total_syncs, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(sl_stats.successful_syncs, 0)::numeric / sl_stats.total_syncs) * 100, 2)
  END AS sync_success_rate,
  CASE
    WHEN fp.trust_score >= 0.80 THEN 'high'
    WHEN fp.trust_score >= 0.50 THEN 'medium'
    WHEN fp.trust_score >= 0.20 THEN 'low'
    ELSE 'untrusted'
  END AS trust_level
FROM federated_instances fi
LEFT JOIN federation_peers fp ON fp.remote_instance_id = fi.id
LEFT JOIN (
  SELECT source_instance_id, COUNT(*) AS resource_count
  FROM federated_resources
  GROUP BY source_instance_id
) fr_counts ON fr_counts.source_instance_id = fi.id
LEFT JOIN (
  SELECT
    peer_id,
    COUNT(*) AS total_syncs,
    COUNT(*) FILTER (WHERE sync_status = 'success') AS successful_syncs,
    COUNT(*) FILTER (WHERE sync_status = 'failed') AS failed_syncs
  FROM federation_sync_log
  WHERE started_at > NOW() - INTERVAL '30 days'
  GROUP BY peer_id
) sl_stats ON sl_stats.peer_id = fp.id
WHERE fi.is_local = false;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_federation_trust_overview_instance
  ON federation_trust_overview (instance_id);

CREATE INDEX IF NOT EXISTS idx_federation_trust_overview_trust
  ON federation_trust_overview (trust_score DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_federation_trust_overview()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY federation_trust_overview;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Section 7: Query Optimization Functions
-- =============================================

-- Optimized nearby federated resources search
CREATE OR REPLACE FUNCTION nearby_federated_resources(
  search_lat double precision,
  search_lng double precision,
  radius_miles double precision DEFAULT 25,
  resource_category text DEFAULT NULL,
  result_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  resource_type text,
  address_line1 text,
  city text,
  state text,
  zip_code text,
  phone text,
  website text,
  latitude double precision,
  longitude double precision,
  source_instance_id uuid,
  trust_score numeric,
  distance_miles double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.id,
    fr.name,
    fr.description,
    fr.resource_type,
    fr.address_line1,
    fr.city,
    fr.state,
    fr.zip_code,
    fr.phone,
    fr.website,
    fr.latitude,
    fr.longitude,
    fr.source_instance_id,
    fp.trust_score,
    (3959 * acos(
      cos(radians(search_lat)) * cos(radians(fr.latitude)) *
      cos(radians(fr.longitude) - radians(search_lng)) +
      sin(radians(search_lat)) * sin(radians(fr.latitude))
    )) AS distance_miles
  FROM federated_resources fr
  JOIN federated_instances fi ON fi.id = fr.source_instance_id
  LEFT JOIN federation_peers fp ON fp.remote_instance_id = fi.id
  WHERE fr.latitude IS NOT NULL
    AND fr.longitude IS NOT NULL
    AND fi.status = 'active'
    AND (resource_category IS NULL OR fr.resource_type = resource_category)
    AND (3959 * acos(
      cos(radians(search_lat)) * cos(radians(fr.latitude)) *
      cos(radians(fr.longitude) - radians(search_lng)) +
      sin(radians(search_lat)) * sin(radians(fr.latitude))
    )) <= radius_miles
  ORDER BY distance_miles ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comment on the migration
COMMENT ON MATERIALIZED VIEW federation_trust_overview IS
  'Pre-computed trust metrics for federation instances. Refresh periodically via refresh_federation_trust_overview().';
