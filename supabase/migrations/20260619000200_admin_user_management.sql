-- ============================================================
-- 20260619000200 admin user management
-- Extends admin_list_users() with auth metadata + adds
-- admin_user_notes table for per-user admin annotations
-- ============================================================

-- 1. Extended admin_list_users() — replaces the 6-column version
--    with 10 columns including login provider, last sign-in, ban status
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
    au.email,
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

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 2. admin_user_notes table
CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note        text        NOT NULL CHECK (char_length(note) <= 2000),
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_notes_admin_only"
  ON public.admin_user_notes
  FOR ALL
  TO authenticated
  USING  (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- 3. admin_add_user_note(user_id, note) → returns new note id
CREATE OR REPLACE FUNCTION public.admin_add_user_note(p_user_id uuid, p_note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note_id uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN RETURN NULL; END IF;
  INSERT INTO public.admin_user_notes (user_id, note, created_by)
  VALUES (p_user_id, p_note, auth.uid())
  RETURNING id INTO v_note_id;
  RETURN v_note_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_user_note(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_add_user_note(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_add_user_note(uuid, text) TO authenticated;

-- 4. admin_delete_user_note(note_id)
CREATE OR REPLACE FUNCTION public.admin_delete_user_note(p_note_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RETURN; END IF;
  DELETE FROM public.admin_user_notes WHERE id = p_note_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user_note(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user_note(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_delete_user_note(uuid) TO authenticated;

-- 5. admin_get_user_notes(user_id) → returns notes for a user
CREATE OR REPLACE FUNCTION public.admin_get_user_notes(p_user_id uuid)
RETURNS TABLE (
  id          uuid,
  note        text,
  created_by  uuid,
  created_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT n.id, n.note, n.created_by, n.created_at
  FROM public.admin_user_notes n
  WHERE n.user_id = p_user_id
  ORDER BY n.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_notes(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_notes(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_user_notes(uuid) TO authenticated;
