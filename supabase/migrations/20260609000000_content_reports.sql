-- Migration: 20260609000000_content_reports.sql
-- Feature: Community content reports — 3-distinct-reporter auto-hide
--
-- PURPOSE
--   Any authenticated user can flag a post for review. When 3 distinct
--   reporters flag the same post the post is automatically hidden from
--   all other users (author still sees it with a "Hidden pending review"
--   badge). Staff can dismiss (restore) or uphold (keep hidden).
--
-- SECURITY
--   All writes go through SECURITY DEFINER RPCs (REVOKE from PUBLIC+anon,
--   GRANT to authenticated). No direct client INSERT/UPDATE/DELETE on
--   content_reports. Mirrors the safety_alerts pattern from 20260608000400.
--
-- POLICY FIX
--   The existing posts_select_public policy (USING (NOT is_hidden)) is
--   replaced here to add author self-access and staff override so authors
--   see their own hidden posts. The old policy had `NOT is_hidden` which
--   already worked for the public hide; we consolidate rather than stack
--   (advisor flags multiple permissive policies on posts as a finding).
--
-- IDEMPOTENCY
--   CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY,
--   CREATE INDEX IF NOT EXISTS, OR REPLACE fns.

-- ============================================================
-- 1. report_reason enum
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE public.report_reason AS ENUM (
      'spam',
      'abusive',
      'harassment',
      'misinformation',
      'illegal',
      'off_topic',
      'other'
    );
  END IF;
END;
$$;

-- ============================================================
-- 2. content_reports table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_reports (
  id            uuid            NOT NULL DEFAULT gen_random_uuid(),
  reporter_id   uuid            NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type  text            NOT NULL CHECK (content_type IN ('post')),
  content_id    uuid            NOT NULL,
  reason        public.report_reason NOT NULL,
  details       text            CHECK (char_length(details) <= 1000),
  status        text            NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'dismissed', 'upheld')),
  created_at    timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_pkey PRIMARY KEY (id),
  CONSTRAINT content_reports_unique_reporter UNIQUE (reporter_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_content
  ON public.content_reports (content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_status
  ON public.content_reports (status);

-- ============================================================
-- 3. posts: add is_hidden + hidden_at + hidden_reason columns
-- ============================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_hidden    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at    timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text;

-- ============================================================
-- 4. RLS on content_reports
--    SELECT: own rows OR staff.  No direct INSERT/UPDATE/DELETE.
-- ============================================================

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_reports_select_own_or_staff" ON public.content_reports;
CREATE POLICY "content_reports_select_own_or_staff" ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND is_staff = true
    )
  );

-- No direct INSERT/UPDATE/DELETE — all writes via SECDEF RPCs.

-- ============================================================
-- 5. UPDATE posts SELECT policy to allow author + staff to see
--    their own hidden posts (consolidate — no new permissive policy).
-- ============================================================

-- Drop the old posts_select_public (USING (NOT is_hidden)) and replace with
-- one that hides posts from others but shows them to their authors + staff.
-- This replaces the policy in place since 20260220200000_add_community_feed_tables.sql.
DROP POLICY IF EXISTS "posts_select_public" ON public.posts;
CREATE POLICY "posts_select_public" ON public.posts
  FOR SELECT
  USING (
    NOT is_hidden
    OR user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND is_staff = true
    )
  );

-- ============================================================
-- 6. SECDEF RPC: submit_content_report
--    Insert or no-op (re-report), recount, auto-hide at N=3.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_content_report(
  p_content_type text,
  p_content_id   uuid,
  p_reason       public.report_reason,
  p_details      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter    uuid;
  v_report_count bigint;
  v_post_hidden  boolean := false;
  v_post_author  uuid;
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.submit_content_report(text, uuid, public.report_reason, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_content_report(text, uuid, public.report_reason, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.submit_content_report(text, uuid, public.report_reason, text) TO authenticated;

-- ============================================================
-- 7. SECDEF RPC: admin_resolve_report
--    Staff-only: dismiss or uphold a single report.
--    dismiss → mark dismissed; if no open reports remain → un-hide.
--    uphold  → mark upheld; post stays hidden.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id uuid,
  p_action    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff    boolean;
  v_content_id  uuid;
  v_content_type text;
  v_open_count  bigint;
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text) TO authenticated;
