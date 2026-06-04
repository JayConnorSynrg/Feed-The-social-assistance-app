-- Migration: resource_opt_ins_and_capacity
-- Phase C1: adds capacity columns to posts and the resource_opt_ins table.
-- Idempotent — safe to re-run.

-- ============================================================
-- 1. Capacity columns on posts
--    max_seekers NULL = unlimited; slots_remaining tracks live count
-- ============================================================

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS max_seekers integer;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slots_remaining integer;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_max_seekers_positive;
ALTER TABLE public.posts ADD CONSTRAINT posts_max_seekers_positive
  CHECK (max_seekers IS NULL OR max_seekers > 0);

-- ============================================================
-- 2. BEFORE INSERT/UPDATE trigger: initialise slots_remaining
--    when max_seekers is set and slots_remaining is NULL.
--    This keeps the two columns in sync at insert time so that
--    app code only needs to decrement/increment slots_remaining.
-- ============================================================

CREATE OR REPLACE FUNCTION public.posts_init_slots_remaining()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- When a cap is set and slots_remaining is not yet initialised, seed it.
  IF NEW.max_seekers IS NOT NULL AND NEW.slots_remaining IS NULL THEN
    NEW.slots_remaining := NEW.max_seekers;
  END IF;
  -- If max_seekers is cleared (set to NULL), clear slots_remaining too.
  IF NEW.max_seekers IS NULL THEN
    NEW.slots_remaining := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_init_slots ON public.posts;
CREATE TRIGGER trg_posts_init_slots
  BEFORE INSERT OR UPDATE OF max_seekers, slots_remaining
  ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.posts_init_slots_remaining();

-- ============================================================
-- 3. resource_opt_ins table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resource_opt_ins (
  id           uuid         NOT NULL DEFAULT gen_random_uuid(),
  post_id      uuid         NOT NULL REFERENCES public.posts(id)     ON DELETE CASCADE,
  seeker_id    uuid         NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  resource_id  uuid                  REFERENCES public.resources(id) ON DELETE SET NULL,
  status       text         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT resource_opt_ins_pkey PRIMARY KEY (id),
  CONSTRAINT resource_opt_ins_uniq UNIQUE (post_id, seeker_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resource_opt_ins_post_id   ON public.resource_opt_ins (post_id);
CREATE INDEX IF NOT EXISTS idx_resource_opt_ins_seeker_id ON public.resource_opt_ins (seeker_id);
CREATE INDEX IF NOT EXISTS idx_resource_opt_ins_status    ON public.resource_opt_ins (status);

-- updated_at maintenance (reuse the existing fn that is already in prod)
DROP TRIGGER IF EXISTS trg_resource_opt_ins_updated_at ON public.resource_opt_ins;
CREATE TRIGGER trg_resource_opt_ins_updated_at
  BEFORE UPDATE ON public.resource_opt_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. RLS on resource_opt_ins
-- ============================================================

ALTER TABLE public.resource_opt_ins ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows OR post-owner rows OR admin
DROP POLICY IF EXISTS "opt_ins_select" ON public.resource_opt_ins;
CREATE POLICY "opt_ins_select" ON public.resource_opt_ins
  FOR SELECT
  USING (
    seeker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = auth.uid()
    )
    OR is_current_user_admin()
  );

-- INSERT: seeker must be the calling user (defence-in-depth; normal path is the RPC)
DROP POLICY IF EXISTS "opt_ins_insert" ON public.resource_opt_ins;
CREATE POLICY "opt_ins_insert" ON public.resource_opt_ins
  FOR INSERT
  WITH CHECK (seeker_id = auth.uid());

-- UPDATE: post owner transitions status (accept/decline/complete) OR admin
DROP POLICY IF EXISTS "opt_ins_update" ON public.resource_opt_ins;
CREATE POLICY "opt_ins_update" ON public.resource_opt_ins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = auth.uid()
    )
    OR is_current_user_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = auth.uid()
    )
    OR is_current_user_admin()
  );

-- DELETE: self-withdraw OR admin
DROP POLICY IF EXISTS "opt_ins_delete" ON public.resource_opt_ins;
CREATE POLICY "opt_ins_delete" ON public.resource_opt_ins
  FOR DELETE
  USING (seeker_id = auth.uid() OR is_current_user_admin());

-- ============================================================
-- 5a. SECURITY DEFINER RPC: opt_in_to_post
--     Caller identity enforced via auth.uid() internally.
--     Row-locks the post for race safety.
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

REVOKE EXECUTE ON FUNCTION public.opt_in_to_post(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.opt_in_to_post(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.opt_in_to_post(uuid) TO authenticated;

-- ============================================================
-- 5b. SECURITY DEFINER RPC: withdraw_opt_in
--     Only pending self-withdrawals are allowed.
--     Restores slot if capped (capped at max_seekers, never exceeded).
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

REVOKE EXECUTE ON FUNCTION public.withdraw_opt_in(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.withdraw_opt_in(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.withdraw_opt_in(uuid) TO authenticated;
