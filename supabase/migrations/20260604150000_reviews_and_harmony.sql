-- Migration: reviews_and_harmony
-- Phase C2: bidirectional post-exchange reviews + harmony score aggregation.
-- Idempotent — safe to re-run.

-- ============================================================
-- 1. harmony columns on profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS harmony_score numeric(3,2);

-- NULL = no reviews yet; range 1.00–5.00 enforced by reviews.rating CHECK
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS harmony_reviews_count integer NOT NULL DEFAULT 0;

-- Grant column-level SELECT on the new columns to match the existing PII-hardened
-- column-list grants from migration 20260603130000_pii_hardening_revoke.sql.
-- (That migration revoked table-level SELECT and regrants specific columns only;
-- any new column added afterward needs an explicit grant or it's inaccessible.)
GRANT SELECT (harmony_score, harmony_reviews_count) ON public.profiles TO authenticated;
GRANT SELECT (harmony_score, harmony_reviews_count) ON public.profiles TO anon;

-- ============================================================
-- 2. reviews table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id               uuid         NOT NULL DEFAULT gen_random_uuid(),
  opt_in_id        uuid         NOT NULL REFERENCES public.resource_opt_ins(id) ON DELETE CASCADE,
  reviewer_id      uuid         NOT NULL REFERENCES public.profiles(id)         ON DELETE CASCADE,
  reviewee_id      uuid         NOT NULL REFERENCES public.profiles(id)         ON DELETE CASCADE,
  rating           integer      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  would_recommend  boolean,
  comment          text         CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  -- one review per direction per opt-in
  CONSTRAINT reviews_uniq_direction UNIQUE (opt_in_id, reviewer_id),
  CONSTRAINT reviews_no_self_review CHECK (reviewer_id <> reviewee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews (reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_opt_in_id   ON public.reviews (opt_in_id);

-- updated_at trigger (reuses the shared fn already in prod)
DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Harmony recompute trigger
--    Fires AFTER INSERT/UPDATE(rating)/DELETE on reviews
--    and updates the affected reviewee's harmony aggregates.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recompute_harmony()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewee_id uuid;
  v_avg         numeric(3,2);
  v_count       integer;
BEGIN
  -- Determine which reviewee to recompute
  IF TG_OP = 'DELETE' THEN
    v_reviewee_id := OLD.reviewee_id;
  ELSE
    v_reviewee_id := NEW.reviewee_id;
  END IF;

  -- Recompute aggregates
  SELECT
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewee_id = v_reviewee_id;

  -- Update the profile (v_avg will be NULL when count = 0)
  UPDATE public.profiles
  SET
    harmony_score          = v_avg,
    harmony_reviews_count  = COALESCE(v_count, 0)
  WHERE id = v_reviewee_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_recompute_harmony ON public.reviews;
CREATE TRIGGER trg_reviews_recompute_harmony
  AFTER INSERT OR UPDATE OF rating OR DELETE
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_harmony();

-- ============================================================
-- 4. RLS on reviews
-- ============================================================

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: participant-only (reviewer, reviewee, admin) — raw comments are NOT public
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT
  USING (
    reviewer_id = auth.uid()
    OR reviewee_id = auth.uid()
    OR is_current_user_admin()
  );

-- No INSERT policy — the SECDEF RPC is the only write path

-- UPDATE: reviewer may correct their own rating (or admin)
DROP POLICY IF EXISTS "reviews_update" ON public.reviews;
CREATE POLICY "reviews_update" ON public.reviews
  FOR UPDATE
  USING  (reviewer_id = auth.uid() OR is_current_user_admin())
  WITH CHECK (reviewer_id = auth.uid() OR is_current_user_admin());

-- DELETE: reviewer or admin
DROP POLICY IF EXISTS "reviews_delete" ON public.reviews;
CREATE POLICY "reviews_delete" ON public.reviews
  FOR DELETE
  USING (reviewer_id = auth.uid() OR is_current_user_admin());

-- ============================================================
-- 5. SECURITY DEFINER RPC: submit_review
--    Only participants of a COMPLETED opt-in exchange may review.
--    Each participant may review once per opt-in (enforced by UNIQUE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_review(
  p_opt_in_id        uuid,
  p_rating           integer,
  p_would_recommend  boolean DEFAULT NULL,
  p_comment          text    DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id   uuid;
  v_opt_in      public.resource_opt_ins%ROWTYPE;
  v_post_author uuid;
  v_reviewer_id uuid;
  v_reviewee_id uuid;
  v_review      public.reviews%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load opt-in + post author in one join
  SELECT oi.*, p.user_id
  INTO v_opt_in, v_post_author
  FROM public.resource_opt_ins oi
  JOIN public.posts p ON p.id = oi.post_id
  WHERE oi.id = p_opt_in_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opt-in not found';
  END IF;

  -- Determine caller role
  IF v_caller_id = v_opt_in.seeker_id THEN
    -- Seeker reviews the sourcer (post author)
    v_reviewer_id := v_opt_in.seeker_id;
    v_reviewee_id := v_post_author;
  ELSIF v_caller_id = v_post_author THEN
    -- Sourcer reviews the seeker
    v_reviewer_id := v_post_author;
    v_reviewee_id := v_opt_in.seeker_id;
  ELSE
    RAISE EXCEPTION 'You are not a participant in this exchange';
  END IF;

  -- Gate: only completed exchanges may be reviewed
  IF v_opt_in.status <> 'completed' THEN
    RAISE EXCEPTION 'You can review only after the exchange is completed';
  END IF;

  -- Validate rating (CHECK also enforces, but raise a friendly message here)
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Insert review (UNIQUE constraint raises unique_violation on duplicate)
  BEGIN
    INSERT INTO public.reviews (
      opt_in_id,
      reviewer_id,
      reviewee_id,
      rating,
      would_recommend,
      comment
    )
    VALUES (
      p_opt_in_id,
      v_reviewer_id,
      v_reviewee_id,
      p_rating,
      p_would_recommend,
      p_comment
    )
    RETURNING * INTO v_review;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'You have already reviewed this exchange';
  END;

  -- The AFTER trigger on reviews handles harmony score recomputation.
  RETURN v_review;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text) TO authenticated;

-- ============================================================
-- 6. completed_at auto-set trigger on resource_opt_ins
--    Sets completed_at when status transitions to 'completed'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resource_opt_ins_set_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resource_opt_ins_completed_at ON public.resource_opt_ins;
CREATE TRIGGER trg_resource_opt_ins_completed_at
  BEFORE UPDATE OF status
  ON public.resource_opt_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.resource_opt_ins_set_completed_at();
