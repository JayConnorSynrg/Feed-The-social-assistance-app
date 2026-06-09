-- Migration: conversation_reviews
-- Extends the reviews table and submit_review RPC to support conversation-path reviews.
--
-- Context:
--   reviews was created in 20260604150000_reviews_and_harmony.sql with a NOT NULL
--   opt_in_id FK. This migration makes opt_in_id nullable, adds conversation_id FK,
--   adds a CHECK enforcing exactly one anchor, and adds a partial UNIQUE index for the
--   conversation direction (mirroring the opt-in uniqueness constraint).
--
--   submit_review is extended with an optional p_conversation_id parameter while
--   keeping p_opt_in_id optional too. The RPC enforces exactly-one-anchor at runtime.
--
-- The recompute_harmony() trigger already keys on reviewee_id generically — no change
-- needed there (verified: trigger body uses NEW.reviewee_id / OLD.reviewee_id with no
-- opt_in_id filter).
--
-- Idempotent: IF NOT EXISTS / OR REPLACE guards throughout.

-- ============================================================
-- 1. Make opt_in_id nullable on reviews
--    (previously NOT NULL; now one-of-two anchors)
-- ============================================================

ALTER TABLE public.reviews
  ALTER COLUMN opt_in_id DROP NOT NULL;

-- ============================================================
-- 2. Add conversation_id FK column
-- ============================================================

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS conversation_id uuid
    REFERENCES public.conversations(id) ON DELETE CASCADE;

-- ============================================================
-- 3. Exactly-one-anchor CHECK
-- ============================================================

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_one_anchor;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_one_anchor
    CHECK (num_nonnulls(opt_in_id, conversation_id) = 1);

-- ============================================================
-- 4. Partial UNIQUE index for conversation path
--    One review per reviewer per conversation (per direction).
--    Mirrors UNIQUE(opt_in_id, reviewer_id) for the opt-in path.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS reviews_uniq_conversation_reviewer
  ON public.reviews (conversation_id, reviewer_id)
  WHERE conversation_id IS NOT NULL;

-- Index for fast lookups by conversation
CREATE INDEX IF NOT EXISTS idx_reviews_conversation_id
  ON public.reviews (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ============================================================
-- 5. Extend submit_review RPC
--    New signature: accepts p_opt_in_id OR p_conversation_id (exactly one).
--    Conversation path: conversation must be 'completed', caller must be a
--    participant (volunteer_id or requester_id); reviewee := the other participant.
-- ============================================================

-- Drop the old single-signature function before creating the new overload so
-- existing calls that pass p_opt_in_id positionally still resolve correctly.
-- The new function has all four params with defaults — both old callers (positional
-- or named p_opt_in_id) and new callers (named p_conversation_id) work.

DROP FUNCTION IF EXISTS public.submit_review(uuid, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.submit_review(
  p_opt_in_id        uuid    DEFAULT NULL,
  p_rating           integer DEFAULT NULL,
  p_would_recommend  boolean DEFAULT NULL,
  p_comment          text    DEFAULT NULL,
  p_conversation_id  uuid    DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      uuid;
  v_reviewer_id    uuid;
  v_reviewee_id    uuid;
  v_review         public.reviews%ROWTYPE;
  -- opt-in path
  v_opt_in_id_col  uuid;
  v_seeker_id      uuid;
  v_opt_in_status  text;
  v_post_author    uuid;
  -- conversation path
  v_conv_volunteer uuid;
  v_conv_requester uuid;
  v_conv_status    text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate rating (always required)
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Validate exactly one anchor
  IF num_nonnulls(p_opt_in_id, p_conversation_id) <> 1 THEN
    RAISE EXCEPTION 'Provide exactly one of p_opt_in_id or p_conversation_id';
  END IF;

  -- ─── Opt-in path ───────────────────────────────────────────────────────────
  IF p_opt_in_id IS NOT NULL THEN

    SELECT oi.id, oi.seeker_id, oi.status::text, p.user_id
    INTO v_opt_in_id_col, v_seeker_id, v_opt_in_status, v_post_author
    FROM public.resource_opt_ins oi
    JOIN public.posts p ON p.id = oi.post_id
    WHERE oi.id = p_opt_in_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Opt-in not found';
    END IF;

    IF v_caller_id = v_seeker_id THEN
      v_reviewer_id := v_seeker_id;
      v_reviewee_id := v_post_author;
    ELSIF v_caller_id = v_post_author THEN
      v_reviewer_id := v_post_author;
      v_reviewee_id := v_seeker_id;
    ELSE
      RAISE EXCEPTION 'You are not a participant in this exchange';
    END IF;

    IF v_opt_in_status <> 'completed' THEN
      RAISE EXCEPTION 'You can review only after the exchange is completed';
    END IF;

    BEGIN
      INSERT INTO public.reviews (
        opt_in_id, reviewer_id, reviewee_id, rating, would_recommend, comment
      ) VALUES (
        p_opt_in_id, v_reviewer_id, v_reviewee_id, p_rating, p_would_recommend, p_comment
      )
      RETURNING * INTO v_review;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already reviewed this exchange';
    END;

  -- ─── Conversation path ─────────────────────────────────────────────────────
  ELSE

    SELECT volunteer_id, requester_id, status::text
    INTO v_conv_volunteer, v_conv_requester, v_conv_status
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversation not found';
    END IF;

    IF v_conv_status <> 'completed' THEN
      RAISE EXCEPTION 'You can review only after the conversation is completed';
    END IF;

    IF v_caller_id = v_conv_volunteer THEN
      v_reviewer_id := v_conv_volunteer;
      v_reviewee_id := v_conv_requester;
    ELSIF v_caller_id = v_conv_requester THEN
      v_reviewer_id := v_conv_requester;
      v_reviewee_id := v_conv_volunteer;
    ELSE
      RAISE EXCEPTION 'You are not a participant in this conversation';
    END IF;

    BEGIN
      INSERT INTO public.reviews (
        conversation_id, reviewer_id, reviewee_id, rating, would_recommend, comment
      ) VALUES (
        p_conversation_id, v_reviewer_id, v_reviewee_id, p_rating, p_would_recommend, p_comment
      )
      RETURNING * INTO v_review;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already reviewed this conversation';
    END;

  END IF;

  -- The AFTER trigger on reviews handles harmony score recomputation.
  RETURN v_review;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text, uuid) TO authenticated;

-- ============================================================
-- 6. RPC: get_my_conversation_review
--    Returns the current user's review for a conversation (or NULL).
--    Used by the review-prompt card to check if user has already reviewed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_conversation_review(p_conversation_id uuid)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.reviews;
BEGIN
  SELECT * INTO v_row
  FROM public.reviews
  WHERE conversation_id = p_conversation_id
    AND reviewer_id = auth.uid();
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_conversation_review(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_conversation_review(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_my_conversation_review(uuid) TO authenticated;
