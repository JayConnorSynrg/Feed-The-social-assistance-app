-- Fix dashboard_resource_stats: two bugs in prior migrations.
-- Bug 1: GROUP BY category was ambiguous — SELECT alias 'category' shadowed
--        resources.category column; PostgreSQL flagged it at call-time.
-- Bug 2: status = 'active' referenced a non-existent enum value;
--        resource_status enum is {pending, approved, rejected, archived}.
--        'approved' is the correct value for live/visible resources.
--
-- Fix: table-alias all refs to 'r', GROUP BY r.category (unambiguous column
-- reference), cast r.category::text to satisfy RETURNS TABLE text column,
-- ORDER BY COUNT(*) DESC (explicit aggregate — no alias reference),
-- FILTER (WHERE r.status = 'approved') for correct enum value.
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
    r.category::text                                                   AS category,
    COUNT(*)                                                           AS resource_count,
    COUNT(*) FILTER (WHERE r.status = 'approved')                     AS active_count
  FROM resources r
  GROUP BY r.category
  ORDER BY COUNT(*) DESC
  LIMIT 15;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_resource_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_resource_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_resource_stats() TO authenticated;
