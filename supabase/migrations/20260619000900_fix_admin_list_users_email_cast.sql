-- ============================================================
-- 20260619000900 fix admin_list_users email cast
--
-- Root cause: auth.users.email is character varying, but
-- admin_list_users() declares RETURNS TABLE(... email text ...).
-- PL/pgSQL RETURN QUERY enforces strict structural type matching,
-- so every call throws:
--   ERROR: structure of query does not match function result type
--   DETAIL: Returned type character varying does not match expected type text in column 3.
--
-- Broken since migration 20260619000200_admin_user_management.sql
-- (migration #139). This forward-only fix adds au.email::text.
-- Signature is UNCHANGED — zero regression to callers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id               uuid,
  full_name        text,
  email            text,
  user_role        text,
  is_staff         boolean,
  joined_at        timestamptz,
  last_sign_in_at  timestamptz,
  provider         text,
  banned_until     timestamptz,
  email_confirmed  boolean
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
    au.email::text,
    p.user_role,
    p.is_staff,
    p.created_at                          AS joined_at,
    au.last_sign_in_at,
    (au.raw_app_meta_data->>'provider')   AS provider,
    au.banned_until,
    (au.email_confirmed_at IS NOT NULL)   AS email_confirmed
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE (au.is_anonymous = false OR au.is_anonymous IS NULL)
  ORDER BY p.created_at DESC
  LIMIT 200;
END;
$$;
