-- Migration: 20260611173053_guest_access_anonymous_gating.sql
-- Purpose: Server-side enforcement of anonymous-user (guest) access gating.
--   Guests may browse (map, feed, programs, safety alerts, AI chat) but
--   CANNOT insert or update any user-generated content. RESTRICTIVE policies
--   are no-ops for permanent (non-anonymous) users — zero regression risk.
--   SECDEF functions receive an early-exit guard at the top of each body so
--   the protection is present even when called outside normal RLS flow.
-- Ref: Supabase anonymous auth — jwt claim is_anonymous = true for anon sessions.

-- ============================================================
-- HELPER EXPRESSION (inlined everywhere for clarity):
--   COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false)
-- Returns TRUE only for anonymous (guest) sessions.
-- Permanent authenticated users always get false → RESTRICTIVE policies
-- evaluate to TRUE (allow) for them, so existing policies are unaffected.
-- ============================================================


-- ============================================================
-- SECTION 1: RESTRICTIVE INSERT-block policies (15 tables)
-- ============================================================

-- posts
DROP POLICY IF EXISTS posts_block_anon_insert ON public.posts;
CREATE POLICY posts_block_anon_insert ON public.posts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- post_comments
DROP POLICY IF EXISTS post_comments_block_anon_insert ON public.post_comments;
CREATE POLICY post_comments_block_anon_insert ON public.post_comments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- post_likes
DROP POLICY IF EXISTS post_likes_block_anon_insert ON public.post_likes;
CREATE POLICY post_likes_block_anon_insert ON public.post_likes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- conversations
DROP POLICY IF EXISTS conversations_block_anon_insert ON public.conversations;
CREATE POLICY conversations_block_anon_insert ON public.conversations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- messages
DROP POLICY IF EXISTS messages_block_anon_insert ON public.messages;
CREATE POLICY messages_block_anon_insert ON public.messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- resource_opt_ins
DROP POLICY IF EXISTS resource_opt_ins_block_anon_insert ON public.resource_opt_ins;
CREATE POLICY resource_opt_ins_block_anon_insert ON public.resource_opt_ins
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- follows
DROP POLICY IF EXISTS follows_block_anon_insert ON public.follows;
CREATE POLICY follows_block_anon_insert ON public.follows
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- resources
DROP POLICY IF EXISTS resources_block_anon_insert ON public.resources;
CREATE POLICY resources_block_anon_insert ON public.resources
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- resource_bookmarks
DROP POLICY IF EXISTS resource_bookmarks_block_anon_insert ON public.resource_bookmarks;
CREATE POLICY resource_bookmarks_block_anon_insert ON public.resource_bookmarks
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- form_submissions
DROP POLICY IF EXISTS form_submissions_block_anon_insert ON public.form_submissions;
CREATE POLICY form_submissions_block_anon_insert ON public.form_submissions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- user_documents
DROP POLICY IF EXISTS user_documents_block_anon_insert ON public.user_documents;
CREATE POLICY user_documents_block_anon_insert ON public.user_documents
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- user_secure_profiles
DROP POLICY IF EXISTS user_secure_profiles_block_anon_insert ON public.user_secure_profiles;
CREATE POLICY user_secure_profiles_block_anon_insert ON public.user_secure_profiles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- reminders
DROP POLICY IF EXISTS reminders_block_anon_insert ON public.reminders;
CREATE POLICY reminders_block_anon_insert ON public.reminders
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- device_tokens
DROP POLICY IF EXISTS device_tokens_block_anon_insert ON public.device_tokens;
CREATE POLICY device_tokens_block_anon_insert ON public.device_tokens
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- audit_log
DROP POLICY IF EXISTS audit_log_block_anon_insert ON public.audit_log;
CREATE POLICY audit_log_block_anon_insert ON public.audit_log
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );


-- ============================================================
-- SECTION 2: RESTRICTIVE UPDATE-block policies (7 tables)
-- ============================================================

-- posts
DROP POLICY IF EXISTS posts_block_anon_update ON public.posts;
CREATE POLICY posts_block_anon_update ON public.posts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- profiles
DROP POLICY IF EXISTS profiles_block_anon_update ON public.profiles;
CREATE POLICY profiles_block_anon_update ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- conversations
DROP POLICY IF EXISTS conversations_block_anon_update ON public.conversations;
CREATE POLICY conversations_block_anon_update ON public.conversations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- messages
DROP POLICY IF EXISTS messages_block_anon_update ON public.messages;
CREATE POLICY messages_block_anon_update ON public.messages
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- form_submissions
DROP POLICY IF EXISTS form_submissions_block_anon_update ON public.form_submissions;
CREATE POLICY form_submissions_block_anon_update ON public.form_submissions
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- user_documents
DROP POLICY IF EXISTS user_documents_block_anon_update ON public.user_documents;
CREATE POLICY user_documents_block_anon_update ON public.user_documents
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );

-- user_secure_profiles
DROP POLICY IF EXISTS user_secure_profiles_block_anon_update ON public.user_secure_profiles;
CREATE POLICY user_secure_profiles_block_anon_update ON public.user_secure_profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  )
  WITH CHECK (
    COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );


-- ============================================================
-- SECTION 3: Storage RESTRICTIVE INSERT block for user-documents bucket
-- ============================================================

DROP POLICY IF EXISTS user_documents_bucket_block_anon_insert ON storage.objects;
CREATE POLICY user_documents_bucket_block_anon_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents'
    AND COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) IS NOT TRUE
  );


-- ============================================================
-- SECTION 4: SECDEF function anonymous guard
-- Each function body is preserved verbatim from pg_proc.prosrc;
-- the is_anonymous check is injected at the top (first action in DECLARE/BEGIN).
-- SET search_path = public, pg_temp preserved from existing definitions.
-- ============================================================

-- 4a. opt_in_to_post
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


-- 4b. withdraw_opt_in
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


-- 4c. submit_review
-- Live signature (from pg_proc): p_opt_in_id, p_rating, p_would_recommend, p_comment, p_conversation_id
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
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

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

  -- Opt-in path
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

  -- Conversation path
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

REVOKE ALL ON FUNCTION public.submit_review(uuid, integer, boolean, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, boolean, text, uuid) TO authenticated;


-- 4d. submit_content_report
-- Live signature uses report_reason enum type for p_reason
CREATE OR REPLACE FUNCTION public.submit_content_report(
  p_content_type text,
  p_content_id   uuid,
  p_reason       report_reason,
  p_details      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reporter    uuid;
  v_report_count bigint;
  v_post_hidden  boolean := false;
  v_post_author  uuid;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  v_reporter := auth.uid();
  IF v_reporter IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_content_type <> 'post' THEN
    RAISE EXCEPTION 'unsupported content_type: %', p_content_type;
  END IF;

  -- Verify the post exists and capture author
  SELECT user_id INTO v_post_author
  FROM public.posts
  WHERE id = p_content_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  -- Reject self-reporting
  IF v_post_author = v_reporter THEN
    RAISE EXCEPTION 'you cannot report your own post';
  END IF;

  -- Insert; re-report from same user is silently ignored (ON CONFLICT DO NOTHING)
  INSERT INTO public.content_reports
    (reporter_id, content_type, content_id, reason, details)
  VALUES
    (v_reporter, p_content_type, p_content_id, p_reason, p_details)
  ON CONFLICT (reporter_id, content_type, content_id) DO NOTHING;

  -- Recount distinct open reporters for this content
  SELECT count(DISTINCT reporter_id) INTO v_report_count
  FROM public.content_reports
  WHERE content_type = p_content_type
    AND content_id   = p_content_id
    AND status       = 'open';

  -- Auto-hide at N=3 if not already hidden
  IF v_report_count >= 3 THEN
    UPDATE public.posts
    SET
      is_hidden     = true,
      hidden_at     = now(),
      hidden_reason = 'community_reports_threshold'
    WHERE id = p_content_id
      AND is_hidden = false;

    v_post_hidden := true;
  END IF;

  RETURN jsonb_build_object(
    'report_count', v_report_count,
    'hidden',       v_post_hidden
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_content_report(text, uuid, report_reason, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_content_report(text, uuid, report_reason, text) TO authenticated;


-- 4e. place_safety_alert
-- Live signature: p_type, p_severity, p_description, p_lng, p_lat (lng FIRST — matches ST_MakePoint(p_lng, p_lat))
CREATE OR REPLACE FUNCTION public.place_safety_alert(
  p_type        text,
  p_severity    integer,
  p_description text,
  p_lng         double precision,
  p_lat         double precision
)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ttl     interval;
  v_row     public.safety_alerts;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  -- Validate inputs
  IF p_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'invalid alert_type: %', p_type;
  END IF;
  IF p_severity < 1 OR p_severity > 4 THEN
    RAISE EXCEPTION 'severity must be between 1 and 4';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Severity → TTL:  1=2h  2=6h  3=24h  4=72h
  v_ttl := CASE p_severity
    WHEN 1 THEN interval '2 hours'
    WHEN 2 THEN interval '6 hours'
    WHEN 3 THEN interval '24 hours'
    WHEN 4 THEN interval '72 hours'
  END;

  INSERT INTO public.safety_alerts
    (alert_type, severity, description, location, status, created_by, expires_at)
  VALUES
    (p_type, p_severity, p_description,
     ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
     'live', auth.uid(), now() + v_ttl)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- signature: p_type text, p_severity integer, p_description text, p_lng double precision, p_lat double precision
REVOKE ALL ON FUNCTION public.place_safety_alert(text, integer, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_safety_alert(text, integer, text, double precision, double precision) TO authenticated;


-- 4f. vote_safety_alert
CREATE OR REPLACE FUNCTION public.vote_safety_alert(
  p_alert_id uuid,
  p_vote     text
)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.safety_alerts;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  IF p_vote NOT IN ('confirm', 'clear') THEN
    RAISE EXCEPTION 'vote must be confirm or clear';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify the alert exists and is live
  SELECT * INTO v_row FROM public.safety_alerts WHERE id = p_alert_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alert not found';
  END IF;
  IF v_row.status <> 'live' THEN
    RAISE EXCEPTION 'alert is no longer live';
  END IF;

  -- Upsert vote (one per user per alert)
  INSERT INTO public.safety_alert_votes (alert_id, voter_id, vote)
  VALUES (p_alert_id, auth.uid(), p_vote)
  ON CONFLICT (alert_id, voter_id) DO UPDATE
    SET vote = EXCLUDED.vote;

  -- Recompute counts atomically
  UPDATE public.safety_alerts
  SET
    confirm_count = (
      SELECT count(*) FROM public.safety_alert_votes
      WHERE alert_id = p_alert_id AND vote = 'confirm'
    ),
    clear_count = (
      SELECT count(*) FROM public.safety_alert_votes
      WHERE alert_id = p_alert_id AND vote = 'clear'
    ),
    -- Auto-clear: >= 3 clear votes and clears outweigh confirms
    status = CASE
      WHEN (
        (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = p_alert_id AND vote = 'clear') >= 3
        AND
        (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = p_alert_id AND vote = 'clear')
          > (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = p_alert_id AND vote = 'confirm')
      ) THEN 'cleared'
      ELSE status
    END
  WHERE id = p_alert_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_safety_alert(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_safety_alert(uuid, text) TO authenticated;


-- 4g. notify_seekers_near_resource
CREATE OR REPLACE FUNCTION public.notify_seekers_near_resource(
  p_post_id     uuid,
  p_radius_miles double precision DEFAULT 25
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_author uuid;
    v_loc    geography;
    v_rname  text;
    v_count  integer;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  -- Resolve post → resource location + resource name + ownership in one query.
  -- posts.user_id is the author column (confirmed from 20260220200000 schema).
  SELECT p.user_id,
         r.location,
         r.name
  INTO   v_author, v_loc, v_rname
  FROM   public.posts     p
  JOIN   public.resources r ON r.id = p.resource_id
  WHERE  p.id = p_post_id;

  -- Must be the post's author; also catches "post not found" (v_author IS NULL).
  IF v_author IS NULL OR v_author <> auth.uid() THEN
      RAISE EXCEPTION 'not authorized';
  END IF;

  -- No geodata on the resource → nothing to fan out.
  IF v_loc IS NULL THEN
      RETURN 0;
  END IF;

  -- Fan-out: insert for each in-radius seeker who doesn't already have this
  -- notification (dedup keyed on user_id + link + type).
  INSERT INTO public.notifications (user_id, type, title, message, link, is_read, created_at)
  SELECT
      s.id,
      'general'::notification_type,
      'A resource near you',
      'Someone shared "' || coalesce(v_rname, 'a resource') || '" that may help you. Tap to view.',
      '/?post=' || p_post_id::text,
      false,
      now()
  FROM public.profiles s
  WHERE s.location IS NOT NULL
    -- Exclude calling user if authenticated; include all if service_role (auth.uid()=NULL)
    AND (auth.uid() IS NULL OR s.id <> auth.uid())
    -- Same seeker filter as seekers_within_radius for consistent count vs fan-out.
    AND s.user_role IN ('seeking', 'both', 'facilitator')
    AND ST_DWithin(s.location, v_loc, p_radius_miles * 1609.34)
    -- Dedup guard: skip if seeker already has a notification for this exact post.
    AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = s.id
          AND n.link    = '/?post=' || p_post_id::text
          AND n.type    = 'general'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_seekers_near_resource(uuid, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_seekers_near_resource(uuid, double precision) TO authenticated;


-- 4h. set_resource_location_by_id
CREATE OR REPLACE FUNCTION public.set_resource_location_by_id(
  p_id  uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.resources r
       WHERE r.id = p_id AND r.submitted_by = auth.uid()
     )
     AND NOT public.is_current_user_admin()
  THEN
    RAISE EXCEPTION 'not authorized to set location for this resource'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.resources
  SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) TO authenticated;


-- 4i. admin_resolve_report
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id uuid,
  p_action    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_staff    boolean;
  v_content_id  uuid;
  v_content_type text;
  v_open_count  bigint;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify caller is staff
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'forbidden: staff access required';
  END IF;

  IF p_action NOT IN ('dismiss', 'uphold') THEN
    RAISE EXCEPTION 'action must be dismiss or uphold';
  END IF;

  -- Fetch the report
  SELECT content_id, content_type
  INTO v_content_id, v_content_type
  FROM public.content_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report not found';
  END IF;

  IF p_action = 'uphold' THEN
    UPDATE public.content_reports
    SET status = 'upheld'
    WHERE id = p_report_id;

  ELSIF p_action = 'dismiss' THEN
    UPDATE public.content_reports
    SET status = 'dismissed'
    WHERE id = p_report_id;

    -- If no open reports remain for this content, un-hide the post
    SELECT count(*) INTO v_open_count
    FROM public.content_reports
    WHERE content_type = v_content_type
      AND content_id   = v_content_id
      AND status       = 'open';

    IF v_open_count = 0 AND v_content_type = 'post' THEN
      UPDATE public.posts
      SET
        is_hidden     = false,
        hidden_at     = NULL,
        hidden_reason = NULL
      WHERE id = v_content_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'report_id', p_report_id,
    'action',    p_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text) TO authenticated;


-- 4j. admin_remove_safety_alert
CREATE OR REPLACE FUNCTION public.admin_remove_safety_alert(p_alert_id uuid)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_staff boolean;
  v_row      public.safety_alerts;
BEGIN
  -- Anonymous guard: guests may not perform write actions
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify caller is staff
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'forbidden: staff access required';
  END IF;

  UPDATE public.safety_alerts
  SET status = 'removed'
  WHERE id = p_alert_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'alert not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_safety_alert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_safety_alert(uuid) TO authenticated;


-- ============================================================
-- SECTION 5: pg_cron daily anonymous user cleanup
-- Runs at 03:00 UTC daily; removes anon sessions older than 30 days.
-- All auth.users FKs verified CASCADE — no orphan risk.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-users') THEN
    PERFORM cron.unschedule('cleanup-anonymous-users');
  END IF;
END;
$$;

SELECT cron.schedule(
  'cleanup-anonymous-users',
  '0 3 * * *',
  $$DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days';$$
);
