-- Add SECURITY DEFINER RPC for counting completed profiles.
-- Replaces the broken browser-role query .not('full_name','is',null).not('phone','is',null)
-- which triggers 42501 (no SELECT grant on phone) and always returns 0 (phone IS NULL on
-- all prod rows).  The authoritative signal is onboarding_completed=true on profiles
-- joined to auth.users to exclude anonymous sessions.
CREATE OR REPLACE FUNCTION public.dashboard_completed_profiles()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_admin() THEN
    RETURN 0;
  END IF;
  RETURN (
    SELECT count(*)::bigint
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE p.onboarding_completed = true
      AND (au.is_anonymous = false OR au.is_anonymous IS NULL)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_completed_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dashboard_completed_profiles() FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_completed_profiles() TO authenticated;
