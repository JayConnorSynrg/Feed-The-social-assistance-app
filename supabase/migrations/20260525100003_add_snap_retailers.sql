-- Migration: add_snap_retailers
-- Adds snap_retailers table with PostGIS geography column for geospatial queries.
-- PostGIS extension is already enabled in 20260119000003_resources_table.sql.
-- Uses CREATE TABLE IF NOT EXISTS for idempotent application.

-- Ensure PostGIS is available (idempotent)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------------------------------------------------------------------------
-- snap_retailers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snap_retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id TEXT UNIQUE,
  retailer_name TEXT NOT NULL,
  retailer_type TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  location GEOGRAPHY(POINT, 4326),
  incentive_program TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS snap_retailers_location_idx ON snap_retailers USING GIST (location);
CREATE INDEX IF NOT EXISTS snap_retailers_state_idx ON snap_retailers (state);
CREATE INDEX IF NOT EXISTS snap_retailers_zip_idx ON snap_retailers (zip_code);

ALTER TABLE snap_retailers ENABLE ROW LEVEL SECURITY;

-- Anyone can read SNAP retailer locations (public data)
CREATE POLICY snap_retailers_select_public ON snap_retailers FOR SELECT
  USING (true);

-- Only admins can insert SNAP retailers (sync from USDA data)
CREATE POLICY snap_retailers_admin_insert ON snap_retailers FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can update SNAP retailers
CREATE POLICY snap_retailers_admin_update ON snap_retailers FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
