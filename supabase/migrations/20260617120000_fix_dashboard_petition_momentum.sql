-- Fix dashboard_petition_momentum: petition_signature is not a valid post_type enum value.
-- Signatures are stored in petition_signatures table (not posts).
-- Petitions are stored in the petitions table (not posts with post_type='petition').

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
    FROM petitions p
    LEFT JOIN petition_signatures ps ON ps.petition_id = p.id
    GROUP BY p.id
  )
  SELECT
    (SELECT COUNT(*) FROM petitions)::bigint,
    (SELECT COUNT(*) FROM petition_signatures)::bigint,
    (SELECT COUNT(*) FROM petitions WHERE created_at >= NOW() - INTERVAL '30 days')::bigint,
    (SELECT id FROM petition_counts ORDER BY sig_count DESC LIMIT 1),
    (SELECT sig_count FROM petition_counts ORDER BY sig_count DESC LIMIT 1)::bigint;
END;
$$;
REVOKE EXECUTE ON FUNCTION dashboard_petition_momentum() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dashboard_petition_momentum() FROM anon;
GRANT  EXECUTE ON FUNCTION dashboard_petition_momentum() TO authenticated;
