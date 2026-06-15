-- W7: Admin org context RPC — returns all orgs for super-admins, member orgs for org-admins
CREATE OR REPLACE FUNCTION get_admin_org_list()
RETURNS TABLE (id uuid, name text, org_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Null-uid gate (SECDEF safety)
  IF auth.uid() IS NULL THEN RETURN; END IF;

  -- Super-admins see all active orgs
  IF (SELECT is_admin FROM profiles WHERE profiles.id = auth.uid()) THEN
    RETURN QUERY
      SELECT o.id, o.name, o.org_type
      FROM organizations o
      WHERE o.is_active = true
      ORDER BY o.name;
  ELSE
    -- Org-admins/members see only their orgs
    RETURN QUERY
      SELECT o.id, o.name, o.org_type
      FROM organizations o
      JOIN organization_members om ON om.org_id = o.id
      WHERE om.user_id = auth.uid() AND o.is_active = true
      ORDER BY o.name;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_admin_org_list() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_org_list() FROM anon;
