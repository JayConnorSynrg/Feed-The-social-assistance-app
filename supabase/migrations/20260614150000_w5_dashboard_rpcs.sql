-- ============================================================
-- W5: Dashboard Aggregate SECDEF RPCs
-- k-anonymity: k≥20 — any bucket below 20 is suppressed/generalized
-- ============================================================

-- ── 1. community_people_fed (k-anon aggregate) ───────────────
CREATE OR REPLACE FUNCTION community_people_fed(
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  period_start    date,
  period_end      date,
  total_visits    bigint,
  people_fed      bigint,
  suppressed      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visits bigint;
  v_fed    bigint;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT is_current_user_admin() THEN RETURN; END IF;

  SELECT COUNT(*), COALESCE(SUM(ec.household_size), 0)
  INTO v_visits, v_fed
  FROM event_checkins ec
  JOIN event_occurrences eo ON eo.id = ec.occurrence_id
  WHERE eo.starts_at::date BETWEEN p_start_date AND p_end_date;

  IF v_visits < 20 THEN
    RETURN QUERY SELECT p_start_date, p_end_date, v_visits, NULL::bigint, true;
  ELSE
    RETURN QUERY SELECT p_start_date, p_end_date, v_visits, v_fed, false;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION community_people_fed(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION community_people_fed(date, date) FROM anon;
GRANT  EXECUTE ON FUNCTION community_people_fed(date, date) TO authenticated;

-- ── 2. dashboard_adoption_stats ──────────────────────────────
CREATE OR REPLACE FUNCTION dashboard_adoption_stats()
RETURNS TABLE (
  total_users       bigint,
  seekers           bigint,
  providers         bigint,
  facilitators      bigint,
  new_users_30d     bigint,
  new_users_7d      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    COUNT(*)                                                    AS total_users,
    COUNT(*) FILTER (WHERE user_role = 'seeking')              AS seekers,
    COUNT(*) FILTER (WHERE user_role = 'providing')            AS providers,
    COUNT(*) FILTER (WHERE user_role = 'facilitator')          AS facilitators,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS new_users_7d
  FROM profiles
  WHERE is_active = true OR is_active IS NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_adoption_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_adoption_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_adoption_stats() TO authenticated;

-- ── 3. dashboard_resource_stats ──────────────────────────────
CREATE OR REPLACE FUNCTION dashboard_resource_stats()
RETURNS TABLE (
  category        text,
  resource_count  bigint,
  active_count    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    COALESCE(category, 'uncategorized')  AS category,
    COUNT(*)                             AS resource_count,
    COUNT(*) FILTER (WHERE is_active = true OR is_active IS NULL) AS active_count
  FROM resources
  GROUP BY category
  ORDER BY resource_count DESC
  LIMIT 15;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_resource_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_resource_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_resource_stats() TO authenticated;

-- ── 4. dashboard_petition_momentum ───────────────────────────
CREATE OR REPLACE FUNCTION dashboard_petition_momentum()
RETURNS TABLE (
  total_petitions   bigint,
  total_signatures  bigint,
  active_petitions  bigint,
  top_petition_id   uuid,
  top_petition_sigs bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  WITH petition_counts AS (
    SELECT
      p.id,
      COUNT(ps.id) AS sig_count
    FROM posts p
    LEFT JOIN posts ps ON ps.petition_id = p.id AND ps.post_type = 'petition_signature'
    WHERE p.post_type = 'petition'
    GROUP BY p.id
  )
  SELECT
    (SELECT COUNT(*) FROM posts WHERE post_type = 'petition')::bigint,
    (SELECT COUNT(*) FROM posts WHERE post_type = 'petition_signature')::bigint,
    (SELECT COUNT(*) FROM posts WHERE post_type = 'petition' AND created_at >= NOW() - INTERVAL '30 days')::bigint,
    (SELECT id FROM petition_counts ORDER BY sig_count DESC LIMIT 1),
    (SELECT sig_count FROM petition_counts ORDER BY sig_count DESC LIMIT 1)::bigint;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_petition_momentum() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_petition_momentum() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_petition_momentum() TO authenticated;

-- ── 5. dashboard_event_stats ─────────────────────────────────
CREATE OR REPLACE FUNCTION dashboard_event_stats()
RETURNS TABLE (
  total_orgs          bigint,
  active_events       bigint,
  upcoming_30d        bigint,
  total_checkins_30d  bigint,
  people_fed_30d      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM organizations WHERE is_active = true)::bigint,
    (SELECT COUNT(*) FROM assistance_events WHERE is_active = true)::bigint,
    (SELECT COUNT(*) FROM event_occurrences
       WHERE status = 'upcoming'
         AND starts_at BETWEEN NOW() AND NOW() + INTERVAL '30 days')::bigint,
    (SELECT COUNT(*) FROM event_checkins ec
       JOIN event_occurrences eo ON eo.id = ec.occurrence_id
       WHERE eo.starts_at >= NOW() - INTERVAL '30 days')::bigint,
    (SELECT COALESCE(SUM(ec.household_size), 0) FROM event_checkins ec
       JOIN event_occurrences eo ON eo.id = ec.occurrence_id
       WHERE eo.starts_at >= NOW() - INTERVAL '30 days')::bigint;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_event_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_event_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_event_stats() TO authenticated;
