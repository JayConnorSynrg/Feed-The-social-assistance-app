-- ============================================================
-- W3: Events + Timings
-- ============================================================

-- ── 1. assistance_events (core) ──────────────────────────────
CREATE TABLE IF NOT EXISTS assistance_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  event_type      text NOT NULL DEFAULT 'distribution'
                    CHECK (event_type IN ('distribution','meal','pantry','clinic','other')),
  location_name   text,
  address         text,
  city            text,
  state           text,
  zip_code        text,
  location        geography(Point, 4326),
  rrule           text,
  default_capacity integer,
  requires_registration boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistance_events_org_id
  ON assistance_events (org_id);
CREATE INDEX IF NOT EXISTS idx_assistance_events_location
  ON assistance_events USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_assistance_events_active
  ON assistance_events (is_active, org_id);

CREATE OR REPLACE FUNCTION update_assistance_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_assistance_events_updated_at
  BEFORE UPDATE ON assistance_events
  FOR EACH ROW EXECUTE FUNCTION update_assistance_events_updated_at();

-- ── 2. event_occurrences (the user-facing "timings") ─────────
CREATE TABLE IF NOT EXISTS event_occurrences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES assistance_events(id) ON DELETE CASCADE,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  capacity        integer,
  notes           text,
  status          text NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','cancelled','completed')),
  rrule_dtstart   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_occurrences_event_id
  ON event_occurrences (event_id);
CREATE INDEX IF NOT EXISTS idx_event_occurrences_starts_at
  ON event_occurrences (starts_at);
CREATE INDEX IF NOT EXISTS idx_event_occurrences_status_starts
  ON event_occurrences (status, starts_at)
  WHERE status = 'upcoming';

CREATE OR REPLACE FUNCTION update_event_occurrences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_event_occurrences_updated_at
  BEFORE UPDATE ON event_occurrences
  FOR EACH ROW EXECUTE FUNCTION update_event_occurrences_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
ALTER TABLE assistance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_active"
  ON assistance_events FOR SELECT
  USING (is_active = true);

CREATE POLICY "events_all_is_admin"
  ON assistance_events FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "events_insert_org_admin"
  ON assistance_events FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "events_update_org_admin"
  ON assistance_events FOR UPDATE
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

ALTER TABLE event_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occurrences_select_active_event"
  ON event_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assistance_events ae
      WHERE ae.id = event_id AND ae.is_active = true
    )
  );

CREATE POLICY "occurrences_all_is_admin"
  ON event_occurrences FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "occurrences_manage_org_admin"
  ON event_occurrences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assistance_events ae
      WHERE ae.id = event_id AND is_org_admin(ae.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assistance_events ae
      WHERE ae.id = event_id AND is_org_admin(ae.org_id)
    )
  );
