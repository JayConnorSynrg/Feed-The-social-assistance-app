-- admin_list_users(): returns registered user PII for admin dashboard
-- Pattern: mirrors dashboard_adoption_stats auth.users JOIN (20260618100000)
-- Gate: is_current_user_admin() FIRST — matches all project SECDEF RPCs
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id         uuid,
  full_name  text,
  email      text,
  user_role  text,
  is_staff   boolean,
  joined_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    au.email,
    p.user_role,
    p.is_staff,
    p.created_at AS joined_at
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE (au.is_anonymous = false OR au.is_anonymous IS NULL)
  ORDER BY p.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
