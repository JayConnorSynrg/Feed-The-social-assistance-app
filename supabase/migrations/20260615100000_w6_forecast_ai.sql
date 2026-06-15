-- ============================================================
-- W6: Projected Turnout Forecast + Community Stats Feeder
-- Forecaster: benefit-cycle trailing weighted MA
-- Anti-speculation: returns null/suppressed when history < 20 occurrences
-- ============================================================

-- ── 1. projected_turnout SECDEF RPC ──────────────────────────
CREATE OR REPLACE FUNCTION projected_turnout(
  p_org_id   uuid,
  p_date     date DEFAULT (CURRENT_DATE + INTERVAL '7 days')
)
RETURNS TABLE (
  forecast_date     date,
  projected_visits  numeric,
  projected_people_fed numeric,
  confidence        text,
  suppressed        boolean,
  reason            text,
  history_count     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_history_count bigint;
  v_weekday       int;
  v_day_of_month  int;
  v_weekday_weight numeric;
  v_cycle_weight  numeric;
  v_avg_visits    numeric;
  v_avg_hsize     numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (is_current_user_admin() OR is_org_admin(p_org_id)) THEN RETURN; END IF;

  SELECT COUNT(DISTINCT eo.id)
  INTO v_history_count
  FROM event_checkins ec
  JOIN event_occurrences eo ON eo.id = ec.occurrence_id
  JOIN assistance_events ae ON ae.id = eo.event_id
  WHERE ae.org_id = p_org_id
    AND eo.starts_at < NOW();

  IF v_history_count < 20 THEN
    RETURN QUERY SELECT
      p_date,
      NULL::numeric, NULL::numeric,
      'insufficient'::text, true,
      format('Forecast available after 20 recorded events (current: %s)', v_history_count),
      v_history_count;
    RETURN;
  END IF;

  v_weekday := EXTRACT(DOW FROM p_date)::int;
  v_weekday_weight := CASE v_weekday
    WHEN 6 THEN 1.4
    WHEN 5 THEN 1.2
    WHEN 1 THEN 1.1
    WHEN 0 THEN 0.8
    ELSE 1.0
  END;

  v_day_of_month := EXTRACT(DAY FROM p_date)::int;
  v_cycle_weight := CASE
    WHEN v_day_of_month BETWEEN 1 AND 10 THEN 1.3
    WHEN v_day_of_month >= 28 THEN 1.2
    WHEN v_day_of_month BETWEEN 15 AND 20 THEN 0.85
    ELSE 1.0
  END;

  SELECT
    AVG(visit_count),
    AVG(avg_household_size)
  INTO v_avg_visits, v_avg_hsize
  FROM (
    SELECT
      COUNT(ec.id)                  AS visit_count,
      AVG(ec.household_size)        AS avg_household_size
    FROM event_occurrences eo
    JOIN assistance_events ae ON ae.id = eo.event_id
    LEFT JOIN event_checkins ec ON ec.occurrence_id = eo.id
    WHERE ae.org_id = p_org_id
      AND eo.starts_at < NOW()
      AND EXTRACT(DOW FROM eo.starts_at) = v_weekday
    GROUP BY eo.id
    ORDER BY eo.starts_at DESC
    LIMIT 8
  ) recent;

  IF v_avg_visits IS NULL THEN
    SELECT AVG(visit_count), AVG(avg_household_size)
    INTO v_avg_visits, v_avg_hsize
    FROM (
      SELECT COUNT(ec.id) AS visit_count, AVG(ec.household_size) AS avg_household_size
      FROM event_occurrences eo
      JOIN assistance_events ae ON ae.id = eo.event_id
      LEFT JOIN event_checkins ec ON ec.occurrence_id = eo.id
      WHERE ae.org_id = p_org_id AND eo.starts_at < NOW()
      GROUP BY eo.id ORDER BY eo.starts_at DESC LIMIT 12
    ) fallback;
  END IF;

  RETURN QUERY SELECT
    p_date,
    ROUND(COALESCE(v_avg_visits, 0) * v_weekday_weight * v_cycle_weight, 1),
    ROUND(COALESCE(v_avg_visits, 0) * COALESCE(v_avg_hsize, 1) * v_weekday_weight * v_cycle_weight, 1),
    CASE WHEN v_history_count >= 50 THEN 'high'
         WHEN v_history_count >= 20 THEN 'medium'
         ELSE 'low' END::text,
    false,
    format('Based on %s historical events', v_history_count),
    v_history_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION projected_turnout(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION projected_turnout(uuid, date) FROM anon;
GRANT  EXECUTE ON FUNCTION projected_turnout(uuid, date) TO authenticated;

-- ── 2. community_stats feeder ────────────────────────────────
-- Columns confirmed from types.ts:
--   stat_date, active_users, resources_accessed, applications_submitted, posts_created
-- ON CONFLICT targets stat_date (DB-level unique constraint exists; id is PK)
CREATE OR REPLACE FUNCTION refresh_community_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_current_user_admin() THEN RETURN; END IF;
  INSERT INTO community_stats (stat_date, active_users, resources_accessed, applications_submitted, posts_created)
  SELECT
    CURRENT_DATE,
    (SELECT COUNT(*) FROM profiles WHERE updated_at >= NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM resources WHERE created_at >= NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM form_submissions WHERE created_at >= NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '30 days')
  ON CONFLICT (stat_date) DO UPDATE
    SET active_users           = EXCLUDED.active_users,
        resources_accessed     = EXCLUDED.resources_accessed,
        applications_submitted = EXCLUDED.applications_submitted,
        posts_created          = EXCLUDED.posts_created,
        updated_at             = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_community_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_community_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION refresh_community_stats() TO authenticated;
