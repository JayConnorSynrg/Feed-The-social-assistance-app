-- Fix: dashboard_adoption_stats and dashboard_resource_stats referenced
-- is_active which does not exist on either profiles or resources tables.
-- profiles has no soft-delete column; resources uses status='active'.

-- ── 2. dashboard_adoption_stats (fixed) ─────────────────────────
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
  FROM profiles;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_adoption_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_adoption_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_adoption_stats() TO authenticated;

-- ── 3. dashboard_resource_stats (fixed) ─────────────────────────
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
    COALESCE(category, 'uncategorized')                          AS category,
    COUNT(*)                                                     AS resource_count,
    COUNT(*) FILTER (WHERE status = 'active')                   AS active_count
  FROM resources
  GROUP BY category
  ORDER BY resource_count DESC
  LIMIT 15;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_resource_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_resource_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_resource_stats() TO authenticated;
