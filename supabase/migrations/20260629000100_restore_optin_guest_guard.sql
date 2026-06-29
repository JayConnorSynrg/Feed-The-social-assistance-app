-- Migration: 20260629000100_restore_optin_guest_guard.sql
-- Purpose: Restore the is_anonymous guest guard on opt_in_to_post and withdraw_opt_in
--   SECDEF functions. These guards may drift out of prod if the functions are
--   replaced without the guard (e.g., via a hotfix that re-creates the body from
--   an older snapshot). This migration is idempotent — safe to re-apply.
--
-- Both function bodies are verbatim from 20260611173053_guest_access_anonymous_gating.sql.
-- GRANT/REVOKE are re-applied to ensure privileges are correct post-replace.

-- ============================================================
-- opt_in_to_post — restore with anonymous guard
-- ============================================================

CREATE OR REPLACE FUNCTION public.opt_in_to_post(p_post_id uuid)
RETURNS public.resource_opt_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_post      public.posts%ROWTYPE;
  v_opt_in    public.resource_opt_ins%ROWTYPE;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Row-lock the post to serialise concurrent opt-ins
  SELECT * INTO v_post
  FROM public.posts
  WHERE id = p_post_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Disallow opting into your own post
  IF v_post.user_id = v_caller_id THEN
    RAISE EXCEPTION 'You cannot opt in to your own post';
  END IF;

  -- Capacity check
  IF v_post.max_seekers IS NOT NULL AND v_post.slots_remaining <= 0 THEN
    RAISE EXCEPTION 'This offer is full';
  END IF;

  -- Insert opt-in row
  BEGIN
    INSERT INTO public.resource_opt_ins (post_id, seeker_id, resource_id, status)
    VALUES (p_post_id, v_caller_id, v_post.resource_id, 'pending')
    RETURNING * INTO v_opt_in;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Already opted in';
  END;

  -- Decrement slots if capped
  IF v_post.max_seekers IS NOT NULL THEN
    UPDATE public.posts
    SET slots_remaining = slots_remaining - 1
    WHERE id = p_post_id;
  END IF;

  RETURN v_opt_in;
END;
$$;

REVOKE ALL ON FUNCTION public.opt_in_to_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.opt_in_to_post(uuid) TO authenticated;


-- ============================================================
-- withdraw_opt_in — restore with anonymous guard
-- ============================================================

CREATE OR REPLACE FUNCTION public.withdraw_opt_in(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id  uuid;
  v_post       public.posts%ROWTYPE;
  v_deleted    integer;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Row-lock post for safe slot restoration
  SELECT * INTO v_post
  FROM public.posts
  WHERE id = p_post_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Delete only pending opt-in for this user
  DELETE FROM public.resource_opt_ins
  WHERE post_id = p_post_id
    AND seeker_id = v_caller_id
    AND status = 'pending';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 AND v_post.max_seekers IS NOT NULL THEN
    UPDATE public.posts
    SET slots_remaining = LEAST(slots_remaining + 1, v_post.max_seekers)
    WHERE id = p_post_id;
  END IF;

  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_opt_in(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_opt_in(uuid) TO authenticated;
