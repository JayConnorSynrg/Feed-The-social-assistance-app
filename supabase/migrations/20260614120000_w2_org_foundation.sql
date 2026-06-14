-- ============================================================
-- W2: Org Foundation
-- Migration: 20260614120000_w2_org_foundation.sql
-- ============================================================

-- ── 1. organizations (core) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  org_type        text NOT NULL DEFAULT 'food_bank'
                    CHECK (org_type IN ('food_bank','pantry','shelter','clinic','mutual_aid','other')),
  website         text,
  phone           text,
  address         text,
  city            text,
  state           text,
  zip_code        text,
  -- PostGIS service area (reuse existing zip_centroids + profiles.location pattern)
  location        geography(Point, 4326),
  service_radius_miles numeric(6,2) DEFAULT 10,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_location
  ON organizations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by
  ON organizations (created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active
  ON organizations (is_active);

-- ── 2. organization_members (junction) ───────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin','member')),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- Indexes for RLS perf (MakerKit pattern: index user_id/org_id used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON organization_members (org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_user
  ON organization_members (org_id, user_id);

-- ── 3. updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

-- ── 4. SECDEF membership helpers ─────────────────────────────
CREATE OR REPLACE FUNCTION is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION is_org_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_org_admin(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION is_org_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION is_org_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_org_member(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION is_org_member(uuid) TO authenticated;

-- ── 5. RLS — organizations ───────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select_active"
  ON organizations FOR SELECT
  USING (is_active = true);

CREATE POLICY "orgs_all_is_admin"
  ON organizations FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "orgs_update_org_admin"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- ── 6. RLS — organization_members ────────────────────────────
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_own_or_org"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_org_member(org_id)
  );

CREATE POLICY "org_members_insert_admin"
  ON organization_members FOR INSERT
  WITH CHECK (
    is_current_user_admin()
    OR is_org_admin(org_id)
  );

CREATE POLICY "org_members_update_admin"
  ON organization_members FOR UPDATE
  USING (is_current_user_admin() OR is_org_admin(org_id))
  WITH CHECK (is_current_user_admin() OR is_org_admin(org_id));

CREATE POLICY "org_members_delete_admin"
  ON organization_members FOR DELETE
  USING (is_current_user_admin() OR is_org_admin(org_id));
