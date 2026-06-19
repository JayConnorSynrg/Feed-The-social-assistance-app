-- Split dashboard_adoption_stats into registered users vs guest sessions
-- anonymous users (is_anonymous=true) are real sessions but not registered accounts
-- DROP required: return type changed (added guest_sessions column)
DROP FUNCTION IF EXISTS dashboard_adoption_stats();
CREATE OR REPLACE FUNCTION dashboard_adoption_stats()
RETURNS TABLE (
  total_users       bigint,
  guest_sessions    bigint,
  seekers           bigint,
  providers         bigint,
  facilitators      bigint,
  new_users_30d     bigint,
  new_users_7d      bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE au.is_anonymous = false OR au.is_anonymous IS NULL)::bigint AS total_users,
    COUNT(*) FILTER (WHERE au.is_anonymous = true)::bigint                             AS guest_sessions,
    COUNT(*) FILTER (WHERE p.user_role = 'seeking'     AND (au.is_anonymous = false OR au.is_anonymous IS NULL))::bigint AS seekers,
    COUNT(*) FILTER (WHERE p.user_role = 'providing'   AND (au.is_anonymous = false OR au.is_anonymous IS NULL))::bigint AS providers,
    COUNT(*) FILTER (WHERE p.user_role = 'facilitator' AND (au.is_anonymous = false OR au.is_anonymous IS NULL))::bigint AS facilitators,
    COUNT(*) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days' AND (au.is_anonymous = false OR au.is_anonymous IS NULL))::bigint AS new_users_30d,
    COUNT(*) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days'  AND (au.is_anonymous = false OR au.is_anonymous IS NULL))::bigint AS new_users_7d
  FROM profiles p
  JOIN auth.users au ON au.id = p.id;
END; $$;
REVOKE EXECUTE ON FUNCTION dashboard_adoption_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_adoption_stats() FROM anon;
GRANT EXECUTE ON FUNCTION dashboard_adoption_stats() TO authenticated;
