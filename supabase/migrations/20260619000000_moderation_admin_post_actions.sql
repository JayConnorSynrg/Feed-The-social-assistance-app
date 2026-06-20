-- Migration: 20260619000000_moderation_admin_post_actions.sql
-- Purpose: Admin SECDEF RPCs for direct post moderation (remove, hold, authorize).
--   Columns is_hidden / hidden_at / hidden_reason already exist from 20260609000000_content_reports.sql.
--   This migration adds:
--     1. CHECK constraint on hidden_reason (idempotent via DROP IF EXISTS / ADD)
--     2. admin_remove_post  — sets is_hidden=true + hidden_reason='admin_removal'
--     3. admin_hold_post    — sets is_hidden=true + hidden_reason='hold_for_review'
--     4. admin_authorize_post — clears is_hidden + dismisses open reports

-- ============================================================
-- 1. CHECK constraint on hidden_reason
-- ============================================================
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_hidden_reason_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_hidden_reason_check
  CHECK (
    hidden_reason IS NULL
    OR hidden_reason IN ('community_reports_threshold', 'admin_removal', 'hold_for_review')
  );

-- ============================================================
-- 2. admin_remove_post
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_remove_post(
  p_post_id uuid,
  p_reason  text DEFAULT 'admin_removal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  -- Anonymous guard
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Staff gate
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'Only staff may perform moderation actions'
      USING ERRCODE = '42501';
  END IF;

  -- Hide the post
  UPDATE public.posts
  SET
    is_hidden     = true,
    hidden_at     = now(),
    hidden_reason = 'admin_removal'
  WHERE id = p_post_id;

  -- Uphold all open reports for this post
  UPDATE public.content_reports
  SET status = 'upheld'
  WHERE content_type = 'post'
    AND content_id   = p_post_id
    AND status       = 'open';

  -- Audit trail
  PERFORM log_audit_event(
    auth.uid(),
    'admin.post.remove',
    'admin',
    'update',
    'warning',
    'post',
    p_post_id::text,
    jsonb_build_object('reason', 'admin_removal', 'p_reason', p_reason)
  );

  RETURN '{"success": true}'::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_remove_post(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_remove_post(uuid, text) TO authenticated;

-- ============================================================
-- 3. admin_hold_post
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_hold_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  -- Anonymous guard
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Staff gate
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'Only staff may perform moderation actions'
      USING ERRCODE = '42501';
  END IF;

  -- Hold the post
  UPDATE public.posts
  SET
    is_hidden     = true,
    hidden_at     = now(),
    hidden_reason = 'hold_for_review'
  WHERE id = p_post_id;

  -- Audit trail
  PERFORM log_audit_event(
    auth.uid(),
    'admin.post.hold',
    'admin',
    'update',
    'info',
    'post',
    p_post_id::text,
    jsonb_build_object('reason', 'hold_for_review')
  );

  RETURN '{"success": true}'::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_hold_post(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_hold_post(uuid) TO authenticated;

-- ============================================================
-- 4. admin_authorize_post
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_authorize_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  -- Anonymous guard
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Staff gate
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'Only staff may perform moderation actions'
      USING ERRCODE = '42501';
  END IF;

  -- Un-hide the post
  UPDATE public.posts
  SET
    is_hidden     = false,
    hidden_at     = NULL,
    hidden_reason = NULL
  WHERE id = p_post_id;

  -- Dismiss all open reports for this post
  UPDATE public.content_reports
  SET status = 'dismissed'
  WHERE content_type = 'post'
    AND content_id   = p_post_id
    AND status       = 'open';

  -- Audit trail
  PERFORM log_audit_event(
    auth.uid(),
    'admin.post.authorize',
    'admin',
    'update',
    'info',
    'post',
    p_post_id::text,
    jsonb_build_object('action', 'authorized')
  );

  RETURN '{"success": true}'::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_authorize_post(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_authorize_post(uuid) TO authenticated;
