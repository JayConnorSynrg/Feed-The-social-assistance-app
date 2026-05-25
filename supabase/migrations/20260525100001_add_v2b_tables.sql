-- Migration: add_v2b_tables
-- Adds impact_metrics, community_stats, and favorites tables with RLS policies.
-- Derived from V2-DEVELOPMENT-PLAN.md DDL definitions.
-- Uses CREATE TABLE IF NOT EXISTS for idempotent application.

-- ---------------------------------------------------------------------------
-- impact_metrics — per-user engagement/impact tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trees_planted INT NOT NULL DEFAULT 0,
  waste_reduced_kg DECIMAL NOT NULL DEFAULT 0,
  co2_saved_kg DECIMAL NOT NULL DEFAULT 0,
  events_joined INT NOT NULL DEFAULT 0,
  actions_completed INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS impact_metrics_user_id_uniq ON impact_metrics (user_id);
CREATE INDEX IF NOT EXISTS impact_metrics_user_id_idx ON impact_metrics (user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_impact_metrics_updated_at ON impact_metrics;
CREATE TRIGGER set_impact_metrics_updated_at
  BEFORE UPDATE ON impact_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE impact_metrics ENABLE ROW LEVEL SECURITY;

-- Users can read their own impact metrics
CREATE POLICY impact_metrics_select_own ON impact_metrics FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own impact metrics
CREATE POLICY impact_metrics_insert_own ON impact_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own impact metrics
CREATE POLICY impact_metrics_update_own ON impact_metrics FOR UPDATE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- community_stats — aggregate daily statistics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE NOT NULL UNIQUE,
  active_users INT NOT NULL DEFAULT 0,
  resources_accessed INT NOT NULL DEFAULT 0,
  applications_submitted INT NOT NULL DEFAULT 0,
  posts_created INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_stats_date_idx ON community_stats (stat_date DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_community_stats_updated_at ON community_stats;
CREATE TRIGGER set_community_stats_updated_at
  BEFORE UPDATE ON community_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE community_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read community stats (public dashboard data)
CREATE POLICY community_stats_select_public ON community_stats FOR SELECT
  USING (true);

-- Only admins can insert community stats
CREATE POLICY community_stats_insert_admin ON community_stats FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can update community stats
CREATE POLICY community_stats_update_admin ON community_stats FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- favorites — user-saved resources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_resource_id_idx ON favorites (resource_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Users can read their own favorites
CREATE POLICY favorites_select_own ON favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add their own favorites
CREATE POLICY favorites_insert_own ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY favorites_delete_own ON favorites FOR DELETE
  USING (auth.uid() = user_id);
