-- 20261011000000_notification_preferences_and_producers.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
--
-- Wave B — in-app notification preferences + producers.
--
-- Delivers three producer paths into the system-write-only `notifications`
-- table, each gated by a per-user topic preference that defaults ON when absent:
--   (a) resource shared nearby      → resource_alerts     (existing producer, gated)
--   (b) application status change   → application_updates (NEW trigger)
--   (c) comment on your post        → community_posts     (NEW trigger)
--
-- Invariants (see specs/notifications-subsystem-model.md):
--   I1 exactly-once per (recipient,event) — NOT EXISTS dedup on user_id+link(+type)
--   I2 OFF suppresses only that topic; absent row = all-on via COALESCE(...,true)
--   I3 no PII in title/message (only the enum status word ever appears)
--   I4 comment dedup link never collides with the resource producer's link
--   I5 notifications stays system-write-only; every producer is SECDEF+search_path+REVOKE
--   I6 application producer fires on a real transition only; draft/in_progress → no-op
--
-- Replay-safe: CREATE TABLE IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS before
-- CREATE, CREATE OR REPLACE FUNCTION. Safe on PG15 (no PG17-only syntax).

BEGIN;

-- ===========================================================================
-- 1. notification_preferences — the only new table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_alerts     boolean NOT NULL DEFAULT true,
  application_updates  boolean NOT NULL DEFAULT true,
  community_posts      boolean NOT NULL DEFAULT true,
  email_updates        boolean NOT NULL DEFAULT true,
  push_notifications   boolean NOT NULL DEFAULT true,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Own-row only. auth.uid() wrapped in a subselect so the planner evaluates it
-- once per statement (Supabase RLS perf guidance).
DROP POLICY IF EXISTS notif_prefs_select_own ON public.notification_preferences;
CREATE POLICY notif_prefs_select_own ON public.notification_preferences
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS notif_prefs_insert_own ON public.notification_preferences;
CREATE POLICY notif_prefs_insert_own ON public.notification_preferences
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS notif_prefs_update_own ON public.notification_preferences;
CREATE POLICY notif_prefs_update_own ON public.notification_preferences
  FOR UPDATE USING (user_id = (select auth.uid()))
             WITH CHECK (user_id = (select auth.uid()));

-- Own-row via RLS; no anon, no DELETE grant.
REVOKE ALL ON TABLE public.notification_preferences FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_preferences TO authenticated;

-- ===========================================================================
-- 2. get_my_notification_prefs() — read accessor with synthesized all-true default
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_my_notification_prefs()
RETURNS public.notification_preferences
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.notification_preferences;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Account required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.notification_preferences
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    -- Absent row → all topics ON (I2). Synthesize without writing.
    v_row.user_id            := v_uid;
    v_row.resource_alerts    := true;
    v_row.application_updates := true;
    v_row.community_posts    := true;
    v_row.email_updates      := true;
    v_row.push_notifications := true;
    v_row.updated_at         := now();
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_notification_prefs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_notification_prefs() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_notification_prefs() TO authenticated;

-- ===========================================================================
-- 3. notify_seekers_near_resource — body preserved VERBATIM from
--    20260611173053_guest_access_anonymous_gating.sql, with ONE added predicate
--    gating each recipient (profiles s → s.id) on resource_alerts (default ON).
-- ===========================================================================
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
    -- Wave B: topic gate — skip seekers who turned Resource alerts OFF.
    -- Absent row → true (default-on, I2). Recipient per row is s.id.
    AND COALESCE(
          (SELECT np.resource_alerts
             FROM public.notification_preferences np
            WHERE np.user_id = s.id),
          true
        )
    -- Dedup guard: skip if seeker already has a notification for this exact post.
    AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = s.id
          AND n.link    = '/?post=' || p_post_id::text
          AND n.type    = 'general'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG 'notification_created type=% recipient_present=% count=%', 'general', (v_author IS NOT NULL), v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_seekers_near_resource(uuid, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_seekers_near_resource(uuid, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_seekers_near_resource(uuid, double precision) TO authenticated;

-- ===========================================================================
-- 4. notify_application_status_change() — application_updates topic
--    Fires on a real status TRANSITION only (WHEN guard on the trigger, I6).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type  notification_type;
  v_title text;
  v_msg   text;
  v_link  text;
  v_pref  boolean;
BEGIN
  -- Map the new status → notification_type. draft / in_progress produce nothing (I6).
  CASE NEW.status
    WHEN 'approved'     THEN v_type := 'approval';         v_title := 'Your application was approved';       v_msg := 'Good news — your application status changed to approved. Tap to view.';
    WHEN 'denied'       THEN v_type := 'denial';           v_title := 'Update on your application';           v_msg := 'Your application status changed to denied. Tap to view details.';
    WHEN 'pending_info' THEN v_type := 'document_request'; v_title := 'More information needed';               v_msg := 'Your application needs more information. Tap to view what is required.';
    WHEN 'expired'      THEN v_type := 'action_required';  v_title := 'Your application expired';              v_msg := 'Your application has expired. Tap to view next steps.';
    WHEN 'under_review' THEN v_type := 'status_update';    v_title := 'Your application is under review';      v_msg := 'Your application status changed to under review. Tap to view.';
    WHEN 'submitted'    THEN v_type := 'status_update';    v_title := 'Your application was submitted';        v_msg := 'Your application status changed to submitted. Tap to view.';
    ELSE
      -- draft, in_progress, or any future status not worth notifying on.
      RETURN NEW;
  END CASE;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Topic gate: application_updates, default ON when the row is absent (I2).
  SELECT COALESCE(
           (SELECT np.application_updates
              FROM public.notification_preferences np
             WHERE np.user_id = NEW.user_id),
           true
         )
    INTO v_pref;

  IF v_pref IS NOT TRUE THEN
    RAISE LOG 'notification_suppressed_by_pref type=%', v_type;
    RETURN NEW;
  END IF;

  -- Dedup key: user + application + status (I1). No PII in the link (I3).
  v_link := '/?application=' || NEW.id::text || '&status=' || NEW.status::text;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.user_id
      AND n.link    = v_link
  ) THEN
    RAISE LOG 'notification_dedup_suppressed type=%', v_type;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, application_id, is_read, created_at)
  VALUES (NEW.user_id, v_type, v_title, v_msg, v_link, NEW.id, false, now());

  RAISE LOG 'notification_created type=% recipient_present=%', v_type, (NEW.user_id IS NOT NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure break the status update itself.
  RAISE LOG 'notification_producer_error producer=% detail=%', 'application_status', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_application_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_application_status_change() FROM anon;

DROP TRIGGER IF EXISTS trg_notify_application_status ON public.form_submissions;
CREATE TRIGGER trg_notify_application_status
  AFTER UPDATE OF status ON public.form_submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_application_status_change();

-- ===========================================================================
-- 5. notify_post_comment_author() — community_posts topic
--    AFTER INSERT ON post_comments. Notifies the POST AUTHOR (not the commenter).
--    Mirrors the engagement_on_comment author-lookup precedent (20261005000000:643-657).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_post_comment_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author uuid;
  v_link   text;
  v_pref   boolean;
BEGIN
  -- Hidden/removed comment → no notification.
  IF NEW.is_hidden IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO v_author FROM public.posts p WHERE p.id = NEW.post_id;

  -- No author (post missing) or self-comment → nothing to notify.
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Topic gate: community_posts, default ON when the row is absent (I2).
  SELECT COALESCE(
           (SELECT np.community_posts
              FROM public.notification_preferences np
             WHERE np.user_id = v_author),
           true
         )
    INTO v_pref;

  IF v_pref IS NOT TRUE THEN
    RAISE LOG 'notification_suppressed_by_pref type=%', 'general';
    RETURN NEW;
  END IF;

  -- Dedup key distinct from the resource producer's ('/?post='||id, type=general)
  -- by appending &comment=<id> (I4). Exactly-once per comment (I1).
  v_link := '/?post=' || NEW.post_id::text || '&comment=' || NEW.id::text;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = v_author
      AND n.link    = v_link
      AND n.type    = 'general'
  ) THEN
    RAISE LOG 'notification_dedup_suppressed type=%', 'general';
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, is_read, created_at)
  VALUES (
    v_author,
    'general'::notification_type,
    'New comment on your post',
    'Someone commented on your post. Tap to view.',
    v_link,
    false,
    now()
  );

  RAISE LOG 'notification_created type=% recipient_present=%', 'general', (v_author IS NOT NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notification_producer_error producer=% detail=%', 'comment_author', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_post_comment_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_post_comment_author() FROM anon;

DROP TRIGGER IF EXISTS trg_notify_comment_author ON public.post_comments;
CREATE TRIGGER trg_notify_comment_author
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment_author();

COMMIT;
