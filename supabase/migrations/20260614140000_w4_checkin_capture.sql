-- ============================================================
-- W4: Check-in Capture
-- Design: anonymous-yes, walk-in v1, household_size=people-fed multiplier
-- k≥20 k-anon enforced at the SECDEF aggregate layer (W5)
-- ============================================================

-- ── 1. event_checkins ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id   uuid NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  household_key   text,
  household_size  integer NOT NULL DEFAULT 1 CHECK (household_size >= 1 AND household_size <= 20),
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_in_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text
);

-- Partial unique index for dedup of identified check-ins only
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_occurrence_user_unique
  ON event_checkins (occurrence_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkins_occurrence_id
  ON event_checkins (occurrence_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id
  ON event_checkins (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_at
  ON event_checkins (checked_in_at);
CREATE INDEX IF NOT EXISTS idx_checkins_occurrence_at
  ON event_checkins (occurrence_id, checked_in_at);

-- ── 2. SECDEF aggregate helper ──────────────────────────────
CREATE OR REPLACE FUNCTION get_occurrence_checkin_summary(p_occurrence_id uuid)
RETURNS TABLE (
  occurrence_id     uuid,
  total_visits      bigint,
  people_fed        bigint,
  identified_visits bigint,
  anonymous_visits  bigint,
  unique_households bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (
    is_current_user_admin()
    OR EXISTS (
      SELECT 1
      FROM event_occurrences eo
      JOIN assistance_events ae ON ae.id = eo.event_id
      WHERE eo.id = p_occurrence_id
        AND is_org_admin(ae.org_id)
    )
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p_occurrence_id,
    COUNT(*)                                         AS total_visits,
    COALESCE(SUM(household_size), 0)::bigint         AS people_fed,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL)      AS identified_visits,
    COUNT(*) FILTER (WHERE user_id IS NULL)          AS anonymous_visits,
    COUNT(DISTINCT household_key) FILTER (WHERE household_key IS NOT NULL) AS unique_households
  FROM event_checkins
  WHERE occurrence_id = p_occurrence_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_occurrence_checkin_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_occurrence_checkin_summary(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION get_occurrence_checkin_summary(uuid) TO authenticated;

-- ── 3. RLS ───────────────────────────────────────────────────
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_select_own"
  ON event_checkins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "checkins_select_admin"
  ON event_checkins FOR SELECT
  USING (is_current_user_admin());

CREATE POLICY "checkins_select_org_admin"
  ON event_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM event_occurrences eo
      JOIN assistance_events ae ON ae.id = eo.event_id
      WHERE eo.id = occurrence_id
        AND is_org_admin(ae.org_id)
    )
  );

CREATE POLICY "checkins_insert_auth"
  ON event_checkins FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "checkins_update_own"
  ON event_checkins FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "checkins_update_admin"
  ON event_checkins FOR UPDATE
  USING (
    is_current_user_admin()
    OR EXISTS (
      SELECT 1
      FROM event_occurrences eo
      JOIN assistance_events ae ON ae.id = eo.event_id
      WHERE eo.id = occurrence_id AND is_org_admin(ae.org_id)
    )
  );
