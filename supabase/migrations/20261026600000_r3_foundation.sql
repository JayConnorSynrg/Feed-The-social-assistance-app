-- 20261026600000_r3_foundation.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: Release 3 of post editing, the EXPAND step. One migration for every Release 3 capability, applied
-- before any Release 3 client: the client deployed today keeps working after it (replayed request by request).
-- Contract: specs/r3-contract.md. Model + invariants: specs/r3-model.md. Contract step:
-- 20261026700000_r3_contract.sql (applied after every Release 3 client is live).
--
-- What this migration does
--   (I) Hygiene first. TRUNCATE / REFERENCES / TRIGGER / MAINTAIN leave anon and authenticated on the 57 relations
--       that still carried them; the duplicate updated_at trigger on posts goes; objects postgres creates in public
--       from here on are born without anon / authenticated privileges (three schema-scoped default-privilege
--       statements); every function this file creates or replaces pins search_path = public, pg_temp and revokes
--       EXECUTE from PUBLIC and anon unless anon reads through it by design.
--   (H) Three notification_type values for Release 4 (moderation, content_update, event_update). Nothing in this
--       file uses them: a value added by ALTER TYPE cannot be used in the transaction that adds it.
--   (A) Safety alert lifecycle. Alerts gain a version token, an "updated" marker, a resolved state and an
--       append-only history (one complete message per version). Update: owner or moderator, only while live;
--       raising severity restarts the expiry for the new level from the update, lowering it caps what is left at
--       the lower level's window, any other update keeps the expiry; ANY change by the reporter returns a
--       verified alert to unverified. Resolve: shown as resolved for 6 hours, then gone. The owner's "delete" is a
--       recorded withdrawal (status withdrawn; no row leaves). A NULL-owner alert belongs to nobody. No reader and
--       no RPC returns created_by or verified_by, and no audit row or error text carries either; ownership is
--       is_mine only. A moderator cannot verify their own alert; a second verify keeps the first verifier. One
--       predicate decides live / resolved / gone.
--   (B) Labels: outdated / misleading / sensitive. Moderator-applied with a reason, append-only records,
--       retracted by negation, each naming the post version it covers; an author may mark their own post
--       sensitive; posts.labels carries the current set. Labels annotate only (ranking never reads them).
--   (C) Comment lock: moderators only, with a reason, enforced in the comment insert trigger (reads the lock
--       from the locked post row); moderators may still comment; existing comments stay editable and deletable.
--   (D) Reports: comments and org events become reportable; one OPEN report per member per item, and a new
--       report is taken after the item changed; three reports hide a post or a comment, never an org event.
--   (E) Requests and offers can be closed and reopened by their author. Opt-in decisions get an audited RPC and
--       every opt-in change writes an event row. Any DELETE of an opt-in row returns its slot (the direct seeker
--       DELETE drained offers). EXPAND/CONTRACT: the direct UPDATE (status) grant and the direct DELETE (policy
--       opt_ins_delete) stay until the contract step; withdraw_opt_in is the seeker's path from then on.
--       An opt-in write and the seeker's account deletion never meet in a deadlock: the three RPCs take the
--       seeker's profile row (KEY SHARE) before the post, and the trail trigger's account lookups never wait.
--   (F) Announcements: moderators pin / unpin with an expiry (7 days by default); ranked_feed_v2 gains an
--       optional p_filter ('announcements' = live pins + org events). DROP + CREATE with a DEFAULT, no overload.
--   (G) Petitions: drafts are column-limited on insert; the hash is sha256 of the body, computed by the server;
--       moderators approve (publishes a feed post) or reject; the signed text is immutable after the first
--       signature; the creator appends update notes beside it. EXPAND/CONTRACT: INSERT (body_version_hash) stays
--       until the contract step (the deployed composer sends it; the server overwrites it).
--   (P) Realtime: the posts column list is restated once with the seven new columns (DROP TABLE + ADD TABLE of
--       posts only; every other member unchanged). Alerts stay off realtime.
--
-- Migration order: (1) hygiene (so every object below is created under the tightened defaults); (2) enum values;
-- (3) columns + constraints on existing tables; (4) dependent tables + data fixes; (5) trigger functions +
-- triggers; (6) RPCs; (7) grants + the posts publication restatement; (8) RLS policies last.
-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Stable inputs for the two data fixes below (petition re-hash reads "no signature yet"; the slot repair counts
-- opt-in rows): a signature or opt-in in flight finishes first, none starts until this commits.
LOCK TABLE public.petition_signatures, public.resource_opt_ins IN SHARE MODE;

-- ============================================================================
-- 1. Hygiene
-- ============================================================================
-- TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: no client path uses any of them, and RLS never gates TRUNCATE.
-- The list is every relation in public where anon or authenticated held one (prod relacl, 2026-10-11).
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON
  public.admin_user_notes, public.assistance_events, public.audit_log, public.business_hours, public.business_photos,
  public.business_services, public.community_stats, public.content_reports, public.conversations, public.device_tokens,
  public.event_checkins, public.event_occurrences, public.favorites, public.federated_instances,
  public.federated_resources, public.federation_health_checks, public.federation_peers, public.federation_sync_log,
  public.federation_trust_events, public.federation_trust_overview, public.federation_webhook_log, public.follows,
  public.form_submissions, public.form_templates, public.impact_metrics, public.messages, public.mfa_backup_codes,
  public.notification_preferences, public.notifications, public.org_resources, public.organization_members,
  public.organizations, public.petition_signatures, public.petitions, public.poll_votes, public.polls,
  public.post_comments, public.post_likes, public.profiles, public.public_profiles, public.ranking_config,
  public.reminders, public.resource_bookmarks, public.resource_opt_ins, public.resources, public.reviews,
  public.safety_alert_votes, public.safety_alerts, public.saved_resource_documents, public.saved_resource_events,
  public.saved_resource_tasks, public.saved_resources, public.snap_retailers, public.user_documents,
  public.user_secure_profiles, public.user_sessions, public.zip_centroids
FROM anon, authenticated;

-- One updated_at trigger on posts: update_posts_updated_at (the original) stays, the duplicate added by
-- 20260220200000 goes (20261009000000 made the same choice for comments).
DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;

-- Trigger functions nobody needs to call
REVOKE ALL ON FUNCTION public.notify_post_comment_author(), public.notify_application_status_change() FROM PUBLIC, anon, authenticated;

-- Objects postgres creates in public stop being born open to anon / authenticated. Every table, sequence and
-- function below carries its own REVOKE / GRANT. PUBLIC's EXECUTE on new functions is a built-in default that can
-- only be removed role-wide (pg_temp included), so each new function also revokes from PUBLIC itself.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ============================================================================
-- 2. Enum values for Release 4 (not used anywhere in this file)
-- ============================================================================
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'moderation';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'content_update';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_update';

-- ============================================================================
-- 3. Columns + constraints on existing tables
-- ============================================================================
-- (A) safety_alerts
ALTER TABLE public.safety_alerts
  ADD COLUMN version          integer NOT NULL DEFAULT 1,
  ADD COLUMN updated_at       timestamptz,
  ADD COLUMN update_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN resolved_at      timestamptz,
  ADD COLUMN resolved_by_role text;
ALTER TABLE public.safety_alerts DROP CONSTRAINT safety_alerts_status_check;
ALTER TABLE public.safety_alerts
  ADD CONSTRAINT safety_alerts_status_check CHECK (status IN ('live', 'expired', 'cleared', 'removed', 'resolved', 'withdrawn')),
  ADD CONSTRAINT safety_alerts_version_check CHECK (version >= 1 AND update_count >= 0 AND update_count < version),
  ADD CONSTRAINT safety_alerts_resolved_shape CHECK ((status <> 'resolved' OR resolved_at IS NOT NULL)
                                                    AND (resolved_at IS NULL) = (resolved_by_role IS NULL)),
  ADD CONSTRAINT safety_alerts_resolved_by_role_check CHECK (resolved_by_role IN ('owner', 'moderator'));
COMMENT ON COLUMN public.safety_alerts.version IS 'Optimistic-concurrency token: 1 at creation, +1 on every content update, resolve, withdrawal and removal; never on a vote or a verify.';
COMMENT ON COLUMN public.safety_alerts.updated_at IS 'Last content update (update_safety_alert); NULL = never updated.';
COMMENT ON COLUMN public.safety_alerts.resolved_at IS 'All-clear given at this time (resolve_safety_alert); the alert is shown as resolved for 6 hours.';

-- (B, C, E, F) posts
ALTER TABLE public.posts
  ADD COLUMN labels                  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN comments_locked_at      timestamptz,
  ADD COLUMN comments_locked_reason  text,
  ADD COLUMN comments_locked_by_role text,
  ADD COLUMN closed_at               timestamptz,
  ADD COLUMN closed_reason           text,
  ADD COLUMN pinned_until            timestamptz;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_comments_lock_shape CHECK ((comments_locked_at IS NULL) = (comments_locked_reason IS NULL)
                                                 AND (comments_locked_at IS NULL) = (comments_locked_by_role IS NULL)),
  ADD CONSTRAINT posts_comments_locked_reason_check CHECK (comments_locked_reason IN ('heated', 'off_topic', 'resolved', 'spam', 'other')),
  ADD CONSTRAINT posts_comments_locked_by_role_check CHECK (comments_locked_by_role IN ('community_moderator', 'resource_admin', 'platform_admin')),
  ADD CONSTRAINT posts_closed_shape CHECK ((closed_at IS NULL) = (closed_reason IS NULL)),
  ADD CONSTRAINT posts_closed_reason_check CHECK (closed_reason IN ('fulfilled', 'closed')),
  ADD CONSTRAINT posts_closed_types CHECK (closed_at IS NULL OR post_type IN ('seeker_request', 'source_offer')),
  ADD CONSTRAINT posts_pinned_until_shape CHECK (pinned_until IS NULL OR is_pinned);
COMMENT ON COLUMN public.posts.labels IS 'The labels in force on this post (outdated / misleading / sensitive), kept equal to the active post_labels records by trigger. Annotation only: ranking never reads it.';
COMMENT ON COLUMN public.posts.comments_locked_at IS 'A moderator locked the comments at this time (admin_set_comments_locked); enforced by the comment insert trigger. NULL = open.';
COMMENT ON COLUMN public.posts.closed_at IS 'The author closed this request / offer (set_post_closed): no new opt-ins; nothing is hidden or deleted. NULL = open.';
COMMENT ON COLUMN public.posts.pinned_until IS 'A pin ends at this time (admin_set_post_pinned; 7 days by default). ranked_feed_v2 floats the post only while is_pinned and this is in the future.';

-- (D) reports: comments and org events; one OPEN report per member per item (resolved reports stay as history)
ALTER TABLE public.content_reports DROP CONSTRAINT content_reports_content_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_content_type_check CHECK (content_type IN ('post', 'comment', 'event'));
ALTER TABLE public.content_reports DROP CONSTRAINT content_reports_unique_reporter;
CREATE UNIQUE INDEX content_reports_one_open_per_reporter ON public.content_reports (reporter_id, content_type, content_id) WHERE status = 'open';
CREATE INDEX content_reports_reporter_content_idx ON public.content_reports (reporter_id, content_type, content_id, created_at DESC);
COMMENT ON COLUMN public.content_reports.reported_version IS 'The version of the post / comment the reporter saw (NULL = an org event, or filed before 20261026000000).';
-- a comment hidden by the 3-report rule is told apart from one a moderator hid (a dismissal lifts only the first)
ALTER TABLE public.post_comments ADD COLUMN hidden_reason text;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_hidden_reason_check
  CHECK (hidden_reason IS NULL OR (is_hidden AND hidden_reason IN ('moderator', 'community_reports_threshold')));
UPDATE public.post_comments SET hidden_reason = 'moderator' WHERE is_hidden AND hidden_reason IS NULL;

-- (G) petitions: a rejected draft is a status
ALTER TABLE public.petitions DROP CONSTRAINT petitions_status_check;
ALTER TABLE public.petitions ADD CONSTRAINT petitions_status_check CHECK (status IN ('approved', 'draft', 'archived', 'rejected'));

-- ============================================================================
-- 4. Dependent tables (RLS on at birth; policies in section 8) + backfills
-- ============================================================================
-- (A) Alert history: one complete message per version (CAP 1.2: an update supersedes its predecessor by reference).
CREATE TABLE public.safety_alert_updates (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id           uuid NOT NULL REFERENCES public.safety_alerts(id) ON DELETE CASCADE,
  version            integer NOT NULL,                       -- the alert version this message IS (1 = the original alert)
  msg_type           text NOT NULL CHECK (msg_type IN ('alert', 'update', 'all_clear', 'cancel')),
  supersedes_version integer,                                -- NULL only for version 1
  sent_at            timestamptz NOT NULL DEFAULT now(),
  alert_type         text NOT NULL,
  severity           integer NOT NULL,
  description        text,
  location           geography(Point, 4326) NOT NULL,
  expires_at         timestamptz NOT NULL,                   -- every message carries its own expiry
  status             text NOT NULL,
  changed            text[] NOT NULL DEFAULT '{}',
  severity_change    text NOT NULL DEFAULT 'same' CHECK (severity_change IN ('escalated', 'de_escalated', 'same')),
  actor_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- never granted to a client role
  actor_role         text NOT NULL CHECK (actor_role IN ('owner', 'moderator', 'system')),
  note               text CHECK (char_length(note) <= 500),
  CONSTRAINT safety_alert_updates_alert_version_key UNIQUE (alert_id, version),
  CONSTRAINT safety_alert_updates_reference_shape CHECK ((version = 1) = (supersedes_version IS NULL)
                                                         AND (supersedes_version IS NULL OR supersedes_version < version))
);
ALTER TABLE public.safety_alert_updates ENABLE ROW LEVEL SECURITY;      -- read through safety_alert_history only
COMMENT ON TABLE public.safety_alert_updates IS 'Append-only history of safety alerts: one complete message per alert version. No client grant; read through safety_alert_history (role, never an id).';
-- every existing alert becomes message 1
INSERT INTO public.safety_alert_updates (alert_id, version, msg_type, sent_at, alert_type, severity, description, location, expires_at, status, actor_id, actor_role)
SELECT id, 1, 'alert', created_at, alert_type, severity, description, location, expires_at, 'live', created_by, 'owner' FROM public.safety_alerts;

-- (B) Label records. Append-only; the one change is the retraction (negation, not deletion).
CREATE TABLE public.post_labels (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id           uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  label             text NOT NULL CHECK (label IN ('outdated', 'misleading', 'sensitive')),
  post_version      integer NOT NULL CHECK (post_version >= 1),          -- the post version that was labelled
  source_role       text NOT NULL CHECK (source_role IN ('author', 'community_moderator', 'resource_admin', 'platform_admin')),
  source_kind       text GENERATED ALWAYS AS (CASE WHEN source_role = 'author' THEN 'author' ELSE 'moderator' END) STORED,
  applied_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- never granted to a client role
  reason            text CHECK (char_length(reason) <= 500),
  applied_at        timestamptz NOT NULL DEFAULT now(),
  retracted_at      timestamptz,
  retracted_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- never granted to a client role
  retracted_by_role text CHECK (retracted_by_role IN ('author', 'community_moderator', 'resource_admin', 'platform_admin')),
  retract_reason    text CHECK (char_length(retract_reason) <= 500),
  CONSTRAINT post_labels_retraction_shape CHECK ((retracted_at IS NULL) = (retracted_by_role IS NULL))
);
-- at most one active label of a kind per source class: an author's "sensitive" and a moderator's are separate records
CREATE UNIQUE INDEX post_labels_one_active ON public.post_labels (post_id, label, source_kind) WHERE retracted_at IS NULL;
CREATE INDEX post_labels_post_idx ON public.post_labels (post_id);
ALTER TABLE public.post_labels ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.post_labels IS 'Append-only label records for posts (outdated / misleading / sensitive). A label is lifted by retraction, never deleted. posts.labels is the current set.';

-- (E) Opt-in trail: one row per opt-in change, however it is made.
CREATE TABLE public.resource_opt_in_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opt_in_id   uuid NOT NULL,                                  -- no FK: a withdrawal deletes the opt-in row, the event stays
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  seeker_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event       text NOT NULL CHECK (event IN ('opted_in', 'accepted', 'declined', 'completed', 'withdrawn', 'unblocked', 'removed')),
  from_status text,
  to_status   text,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- never granted to a client role
  actor_role  text NOT NULL CHECK (actor_role IN ('seeker', 'author', 'platform_admin', 'system')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_opt_in_events_post_idx ON public.resource_opt_in_events (post_id, created_at);
CREATE INDEX resource_opt_in_events_opt_in_idx ON public.resource_opt_in_events (opt_in_id);
ALTER TABLE public.resource_opt_in_events ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.resource_opt_in_events IS 'Append-only trail of opt-in changes (opted in, accepted, declined, completed, withdrawn, unblocked, removed), written by trigger on resource_opt_ins.';
-- every opt-in row holds one slot until it is deleted: repair any offer the direct-DELETE defect already drained
UPDATE public.posts p
   SET slots_remaining = GREATEST(p.max_seekers - (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = p.id), 0)
 WHERE p.max_seekers IS NOT NULL
   AND p.slots_remaining IS DISTINCT FROM
       GREATEST(p.max_seekers - (SELECT count(*) FROM public.resource_opt_ins o WHERE o.post_id = p.id), 0);

-- (G) Petition update notes: appended beside the petition; the signed text and its hash are never touched.
CREATE TABLE public.petition_updates (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  petition_id uuid NOT NULL REFERENCES public.petitions(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  author_role text NOT NULL CHECK (author_role IN ('creator', 'moderator')),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,     -- never granted to a client role
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX petition_updates_petition_idx ON public.petition_updates (petition_id, created_at DESC);
ALTER TABLE public.petition_updates ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.petition_updates IS 'Append-only update notes for a petition, written by add_petition_update. The petition text and body_version_hash never change with a note.';

-- ============================================================================
-- 5. Trigger functions + triggers
-- ============================================================================
-- (A) history is append-only: a message leaves only with its alert (FK cascade); the one update that passes is an
-- account deletion clearing the actor (FK SET NULL)
CREATE FUNCTION public.safety_alert_updates_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.safety_alerts WHERE id = OLD.alert_id) THEN RETURN OLD; END IF;
  ELSIF OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'alert_history_append_only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER trg_safety_alert_updates_append_only BEFORE UPDATE OR DELETE ON public.safety_alert_updates
  FOR EACH ROW EXECUTE FUNCTION public.safety_alert_updates_append_only();

-- (B) label records are append-only: the one allowed change is the retraction; rows leave only with their post
CREATE FUNCTION public.post_labels_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  -- source_kind is generated and not yet computed in a BEFORE trigger
  c_retract constant text[] := ARRAY['retracted_at', 'retracted_by', 'retracted_by_role', 'retract_reason', 'source_kind'];
  c_actors  constant text[] := ARRAY['applied_by', 'retracted_by', 'source_kind'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.posts WHERE id = OLD.post_id) THEN
      RAISE EXCEPTION 'labels_append_only' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  -- the retraction: retracted_* go from unset to set, nothing else moves
  IF OLD.retracted_at IS NULL AND NEW.retracted_at IS NOT NULL AND (to_jsonb(NEW) - c_retract) = (to_jsonb(OLD) - c_retract) THEN
    RETURN NEW;
  END IF;
  -- an account deletion clearing an actor column (FK SET NULL)
  IF (to_jsonb(NEW) - c_actors) = (to_jsonb(OLD) - c_actors)
     AND (NEW.applied_by IS NULL OR NEW.applied_by = OLD.applied_by)
     AND (NEW.retracted_by IS NULL OR NEW.retracted_by = OLD.retracted_by) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'labels_append_only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER trg_post_labels_append_only BEFORE UPDATE OR DELETE ON public.post_labels
  FOR EACH ROW EXECUTE FUNCTION public.post_labels_append_only();

-- posts.labels = the labels of the active records (feed, share pages and realtime read it from the post row).
-- The trigger takes the post row lock itself, then recomputes in a new statement (which sees every record committed
-- while it waited): two writers of one post's labels are serialised here, whether or not their caller locked the
-- post first. FOR NO KEY UPDATE is the lock the UPDATE below takes anyway; it does not conflict with the
-- KEY SHARE lock the post_labels foreign key holds, so two inserters queue instead of deadlocking.
CREATE FUNCTION public.post_labels_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.posts WHERE id = NEW.post_id FOR NO KEY UPDATE;
  UPDATE public.posts p
     SET labels = COALESCE((SELECT array_agg(DISTINCT l.label ORDER BY l.label)
                              FROM public.post_labels l WHERE l.post_id = p.id AND l.retracted_at IS NULL), '{}')
   WHERE p.id = NEW.post_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_post_labels_sync AFTER INSERT OR UPDATE OF retracted_at ON public.post_labels
  FOR EACH ROW EXECUTE FUNCTION public.post_labels_sync();

-- an edit never clears a label: the label stays, and a moderator-applied one puts the post back in front of a moderator
CREATE FUNCTION public.posts_label_review_on_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.version > OLD.version AND cardinality(OLD.labels) > 0 AND NEW.needs_review_at IS NULL
     AND EXISTS (SELECT 1 FROM public.post_labels l
                  WHERE l.post_id = NEW.id AND l.retracted_at IS NULL AND l.source_kind = 'moderator') THEN
    NEW.needs_review_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_posts_label_review_on_edit BEFORE UPDATE OF version ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_label_review_on_edit();

-- (C) The comment lock is enforced where every new comment already takes the post row lock: the lock state is read
-- from the locked (latest) row, so a comment racing a lock cannot slip through. Same signature (CREATE OR REPLACE);
-- post_likes uses the same function and is unaffected (TG_TABLE_NAME).
CREATE OR REPLACE FUNCTION public.lock_post_for_engagement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_locked_at timestamptz; v_reason text;
BEGIN
  SELECT comments_locked_at, comments_locked_reason INTO v_locked_at, v_reason
    FROM public.posts WHERE id = NEW.post_id FOR NO KEY UPDATE;
  IF TG_TABLE_NAME = 'post_comments' AND v_locked_at IS NOT NULL
     AND auth.uid() IS NOT NULL                                   -- a signed-in caller; service-side writers pass
     AND NOT (public.current_user_tier_at_least('community_moderator')              -- moderators may still comment
              AND NOT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)) THEN   -- a guest never counts as one
    RAISE EXCEPTION 'comments_locked' USING ERRCODE = '42501',     -- 42501: the deployed client already shows "comments closed"
      DETAIL = jsonb_build_object('reason', v_reason, 'locked_at', v_locked_at)::text,
      HINT = 'Comments are locked on this post.';
  END IF;
  RETURN NEW;
END $$;

-- (E) every opt-in row holds one slot until it is deleted: the slot comes back on ANY delete (RPC, direct, cascade)
CREATE FUNCTION public.resource_opt_ins_return_slot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.posts SET slots_remaining = LEAST(slots_remaining + 1, max_seekers)
   WHERE id = OLD.post_id AND max_seekers IS NOT NULL;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_resource_opt_ins_return_slot AFTER DELETE ON public.resource_opt_ins
  FOR EACH ROW EXECUTE FUNCTION public.resource_opt_ins_return_slot();

-- one event row per opt-in change, however it is made (the RPCs, the direct status UPDATE the deployed client
-- still sends, a direct DELETE, an account deletion).
-- The trigger runs with the opt-in row already locked, and an account deletion locks the profile row first and
-- reaches the opt-in through the cascade. So the two account columns are looked up with a KEY SHARE lock that
-- never waits (SKIP LOCKED): a profile whose row is free is locked here (the foreign key below then has its lock
-- already, and a deletion that arrives later waits for this transaction); a profile that is being deleted at this
-- moment is recorded as NULL, the value ON DELETE SET NULL would give the row anyway. Nothing but its deletion
-- takes a lock on a profile row that conflicts with KEY SHARE (smoke E3e keeps it so), so no other write is skipped.
CREATE FUNCTION public.resource_opt_ins_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); r public.resource_opt_ins; v_author uuid; v_event text; v_role text;
        v_seeker uuid; v_actor uuid;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  SELECT user_id INTO v_author FROM public.posts WHERE id = r.post_id;
  IF NOT FOUND THEN RETURN NULL; END IF;                                  -- the post itself is going (cascade): no trail to keep
  v_role := CASE WHEN v_uid IS NULL THEN 'system' WHEN v_uid = r.seeker_id THEN 'seeker' WHEN v_uid = v_author THEN 'author'
                 WHEN public.is_current_user_admin() THEN 'platform_admin' ELSE 'system' END;
  v_event := CASE TG_OP WHEN 'INSERT' THEN 'opted_in'
                        WHEN 'UPDATE' THEN NEW.status
                        ELSE CASE WHEN OLD.status = 'declined' AND v_role = 'author' THEN 'unblocked'
                                  WHEN v_role = 'seeker' THEN 'withdrawn' ELSE 'removed' END END;
  -- a profile that is being deleted, in this statement (the cascade) or by another transaction, is recorded as NULL
  SELECT id INTO v_seeker FROM public.profiles WHERE id = r.seeker_id FOR KEY SHARE SKIP LOCKED;
  SELECT id INTO v_actor  FROM public.profiles WHERE id = v_uid       FOR KEY SHARE SKIP LOCKED;
  INSERT INTO public.resource_opt_in_events (opt_in_id, post_id, seeker_id, event, from_status, to_status, actor_id, actor_role)
  VALUES (r.id, r.post_id, v_seeker, v_event,
          CASE WHEN TG_OP <> 'INSERT' THEN OLD.status END, CASE WHEN TG_OP <> 'DELETE' THEN NEW.status END,
          v_actor, v_role);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_resource_opt_ins_audit AFTER INSERT OR UPDATE OF status OR DELETE ON public.resource_opt_ins
  FOR EACH ROW EXECUTE FUNCTION public.resource_opt_ins_audit();

CREATE FUNCTION public.resource_opt_in_events_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = OLD.post_id) THEN RETURN OLD; END IF;
  ELSIF (to_jsonb(NEW) - ARRAY['seeker_id', 'actor_id']) = (to_jsonb(OLD) - ARRAY['seeker_id', 'actor_id'])
        AND (NEW.seeker_id IS NULL OR NEW.seeker_id = OLD.seeker_id) AND (NEW.actor_id IS NULL OR NEW.actor_id = OLD.actor_id) THEN
    RETURN NEW;                                                           -- an account deletion (FK SET NULL)
  END IF;
  RAISE EXCEPTION 'opt_in_events_append_only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER trg_resource_opt_in_events_append_only BEFORE UPDATE OR DELETE ON public.resource_opt_in_events
  FOR EACH ROW EXECUTE FUNCTION public.resource_opt_in_events_append_only();

-- (G) the petition hash is the server's: sha256 of the body as stored, hex
CREATE FUNCTION public.petition_text_hash(p_body text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp AS
$$ SELECT encode(sha256(convert_to(p_body, 'UTF8')), 'hex') $$;

CREATE FUNCTION public.petitions_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.body_version_hash := public.petition_text_hash(NEW.body);       -- whatever the client sent
    RETURN NEW;
  END IF;
  -- the signed text is immutable once anyone has signed it (title, summary, body and their hash), for every writer
  IF (NEW.title, NEW.summary, NEW.body, NEW.body_version_hash) IS DISTINCT FROM (OLD.title, OLD.summary, OLD.body, OLD.body_version_hash) THEN
    IF EXISTS (SELECT 1 FROM public.petition_signatures WHERE petition_id = OLD.id) THEN
      RAISE EXCEPTION 'petition_text_locked' USING ERRCODE = '42501',
        HINT = 'The text of a signed petition cannot change. Add an update note instead.';
    END IF;
    NEW.body_version_hash := public.petition_text_hash(NEW.body);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_petitions_guard BEFORE INSERT OR UPDATE ON public.petitions
  FOR EACH ROW EXECUTE FUNCTION public.petitions_guard();

-- a signature names the text it signs: it waits for a text change in flight (row lock) and is refused when the
-- hash it carries is no longer the petition's, so the guard above cannot be raced by a first signature
CREATE FUNCTION public.petition_signatures_bind() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_hash text;
BEGIN
  SELECT body_version_hash INTO v_hash FROM public.petitions WHERE id = NEW.petition_id FOR SHARE;
  IF FOUND AND NEW.petition_version_hash IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'petition_text_changed' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('body_version_hash', v_hash)::text;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_petition_signatures_bind BEFORE INSERT ON public.petition_signatures
  FOR EACH ROW EXECUTE FUNCTION public.petition_signatures_bind();

-- existing petitions nobody has signed get the real hash (a signed one keeps the value its signatures recorded)
UPDATE public.petitions p SET body_version_hash = public.petition_text_hash(p.body)
 WHERE p.body_version_hash IS DISTINCT FROM public.petition_text_hash(p.body)
   AND NOT EXISTS (SELECT 1 FROM public.petition_signatures s WHERE s.petition_id = p.id);

CREATE FUNCTION public.petition_updates_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.petitions WHERE id = OLD.petition_id) THEN RETURN OLD; END IF;
  ELSIF OLD.created_by IS NOT NULL AND NEW.created_by IS NULL AND (to_jsonb(NEW) - 'created_by') = (to_jsonb(OLD) - 'created_by') THEN
    RETURN NEW;                                                           -- an account deletion (FK SET NULL)
  END IF;
  RAISE EXCEPTION 'petition_updates_append_only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER trg_petition_updates_append_only BEFORE UPDATE OR DELETE ON public.petition_updates
  FOR EACH ROW EXECUTE FUNCTION public.petition_updates_append_only();

-- ============================================================================
-- 6a. Safety alerts: helpers, then the RPCs. A changed signature or return type is DROP + CREATE (never an
--     overload); grants are restated in section 7.
-- ============================================================================
-- one place for the severity -> lifetime table
CREATE FUNCTION public.safety_alert_ttl(p_severity integer) RETURNS interval
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp AS
$$ SELECT CASE p_severity WHEN 1 THEN interval '2 hours' WHEN 2 THEN interval '6 hours'
                          WHEN 3 THEN interval '24 hours' WHEN 4 THEN interval '72 hours' END $$;

-- THE predicate. 'live' = status live and not past expiry (the rule the map, the vote, the expire job and the
-- deployed client already use); 'resolved' = all-clear given less than 6 hours ago (shown, not live); else 'gone'.
-- live  <=> state = 'live'        shown <=> state IN ('live', 'resolved')
CREATE FUNCTION public.safety_alert_shown_state(p_status text, p_expires_at timestamptz, p_resolved_at timestamptz,
                                                p_now timestamptz DEFAULT now())
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp AS
$$ SELECT CASE WHEN p_status = 'live' AND p_expires_at > p_now THEN 'live'
               WHEN p_status = 'resolved' AND p_resolved_at > p_now - interval '6 hours' THEN 'resolved'
               ELSE 'gone' END $$;

-- the one client-facing shape of an alert: no created_by, no verified_by; ownership only as is_mine
CREATE FUNCTION public.safety_alert_public(a public.safety_alerts) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, pg_temp AS
$$ SELECT jsonb_build_object(
     'id', a.id, 'alert_type', a.alert_type, 'severity', a.severity, 'description', a.description,
     'lng', ST_X(a.location::geometry)::float8, 'lat', ST_Y(a.location::geometry)::float8,
     'status', a.status, 'confirm_count', a.confirm_count, 'clear_count', a.clear_count,
     'created_at', a.created_at, 'expires_at', a.expires_at, 'verified', a.verified,
     'is_mine', COALESCE(a.created_by = auth.uid(), false),
     'version', a.version, 'updated_at', a.updated_at, 'update_count', a.update_count,
     'resolved_at', a.resolved_at, 'resolved_by_role', a.resolved_by_role,
     'shown_state', public.safety_alert_shown_state(a.status, a.expires_at, a.resolved_at),
     'shown_until', CASE WHEN a.status = 'resolved' THEN a.resolved_at + interval '6 hours' ELSE a.expires_at END) $$;

-- caller gate shared by the alert writes: signed in, not a guest (JWT claim or auth.users flag)
CREATE FUNCTION public.safety_alert_require_member() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
     OR EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';      -- the sentence the deployed client shows
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  RETURN v_uid;
END $$;

-- one history message for the alert row as it now stands
CREATE FUNCTION public.safety_alert_append(a public.safety_alerts, p_msg_type text, p_supersedes integer, p_changed text[],
                                           p_severity_change text, p_actor uuid, p_actor_role text, p_note text,
                                           p_expires timestamptz DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS
$$ INSERT INTO public.safety_alert_updates (alert_id, version, msg_type, supersedes_version, alert_type, severity, description,
                                             location, expires_at, status, changed, severity_change, actor_id, actor_role, note)
   VALUES (a.id, a.version, p_msg_type, p_supersedes, a.alert_type, a.severity, a.description, a.location,
           COALESCE(p_expires, a.expires_at), a.status, COALESCE(p_changed, '{}'), p_severity_change, p_actor, p_actor_role,
           NULLIF(btrim(p_note), '')) $$;

DROP FUNCTION public.place_safety_alert(text, integer, text, double precision, double precision);
CREATE FUNCTION public.place_safety_alert(p_type text, p_severity integer, p_description text, p_lng double precision, p_lat double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := public.safety_alert_require_member(); a public.safety_alerts;
BEGIN
  -- every input is checked before the write: no constraint error (and no failing-row DETAIL) reaches a client
  IF p_type IS NULL OR p_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'alert_field_invalid:type' USING ERRCODE = '22023'; END IF;
  IF p_severity IS NULL OR p_severity NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'alert_field_invalid:severity' USING ERRCODE = '22023'; END IF;
  IF p_lng IS NULL OR p_lat IS NULL OR p_lng NOT BETWEEN -180 AND 180 OR p_lat NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION 'alert_field_invalid:location' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.safety_alerts (alert_type, severity, description, location, status, created_by, expires_at)
  VALUES (p_type, p_severity, NULLIF(btrim(p_description), ''), ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          'live', v_uid, now() + public.safety_alert_ttl(p_severity))
  RETURNING * INTO a;
  PERFORM public.safety_alert_append(a, 'alert', NULL, NULL, 'same', v_uid, 'owner', NULL);
  RETURN public.safety_alert_public(a);
END $$;

-- EXPAND: p_expected_version is optional (the deployed client sends six arguments); 20261026700000 makes it required.
DROP FUNCTION public.update_safety_alert(uuid, text, integer, text, double precision, double precision);
CREATE FUNCTION public.update_safety_alert(p_alert_id uuid, p_type text DEFAULT NULL, p_severity integer DEFAULT NULL,
                                           p_description text DEFAULT NULL, p_lng double precision DEFAULT NULL,
                                           p_lat double precision DEFAULT NULL, p_expected_version integer DEFAULT NULL,
                                           p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := public.safety_alert_require_member(); v_now timestamptz := now();
  a public.safety_alerts; v_owner boolean; v_changed text[] := '{}'; v_sev text := 'same';
  n_type text; n_sev integer; n_desc text; n_loc geography; n_exp timestamptz; v_unverify boolean;
BEGIN
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  v_owner := a.created_by IS NOT NULL AND a.created_by = v_uid;                 -- a NULL owner is nobody
  IF NOT (v_owner OR public.current_user_tier_at_least('community_moderator')) THEN
    RAISE EXCEPTION 'not_alert_owner' USING ERRCODE = '42501'; END IF;
  IF a.status <> 'live' OR a.expires_at <= v_now THEN                           -- the live rule of the vote and the map
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> a.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', a.version, 'updated_at', a.updated_at)::text; END IF;
  IF char_length(btrim(p_note)) > 500 THEN RAISE EXCEPTION 'alert_field_invalid:note' USING ERRCODE = '22023'; END IF;

  n_type := COALESCE(p_type, a.alert_type);
  n_sev  := COALESCE(p_severity, a.severity);
  n_desc := CASE WHEN p_description IS NULL THEN a.description ELSE NULLIF(btrim(p_description), '') END;
  IF n_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'alert_field_invalid:type' USING ERRCODE = '22023'; END IF;
  IF n_sev NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'alert_field_invalid:severity' USING ERRCODE = '22023'; END IF;
  IF (p_lng IS NULL) <> (p_lat IS NULL) OR p_lng NOT BETWEEN -180 AND 180 OR p_lat NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION 'alert_field_invalid:location' USING ERRCODE = '22023'; END IF;
  n_loc := CASE WHEN p_lng IS NULL THEN a.location ELSE ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography END;

  IF n_type IS DISTINCT FROM a.alert_type  THEN v_changed := array_append(v_changed, 'alert_type');  END IF;
  IF n_sev  IS DISTINCT FROM a.severity    THEN v_changed := array_append(v_changed, 'severity');    END IF;
  IF n_desc IS DISTINCT FROM a.description THEN v_changed := array_append(v_changed, 'description'); END IF;
  IF NOT ST_Equals(n_loc::geometry, a.location::geometry) THEN v_changed := array_append(v_changed, 'location'); END IF;
  IF cardinality(v_changed) = 0 THEN RETURN public.safety_alert_public(a); END IF;   -- nothing changed: no version, no message

  -- expiry: raising severity restarts the window for the new level from this update; lowering it never extends the
  -- alert and caps what is left at the lower level's window; any other update keeps the current expiry
  IF n_sev > a.severity THEN    v_sev := 'escalated';    n_exp := v_now + public.safety_alert_ttl(n_sev);
  ELSIF n_sev < a.severity THEN v_sev := 'de_escalated'; n_exp := LEAST(a.expires_at, v_now + public.safety_alert_ttl(n_sev));
  ELSE n_exp := a.expires_at; END IF;
  IF n_exp IS DISTINCT FROM a.expires_at THEN v_changed := array_append(v_changed, 'expires_at'); END IF;
  -- publish-then-verify: ANY change by the reporter returns a verified alert to unverified (a lower severity alone
  -- included); a moderator's change of someone else's alert keeps the mark
  v_unverify := a.verified AND v_owner;

  UPDATE public.safety_alerts
     SET alert_type = n_type, severity = n_sev, description = n_desc, location = n_loc, expires_at = n_exp,
         version = a.version + 1, updated_at = v_now, update_count = a.update_count + 1,
         verified    = CASE WHEN v_unverify THEN false ELSE verified END,
         verified_by = CASE WHEN v_unverify THEN NULL ELSE verified_by END,
         verified_at = CASE WHEN v_unverify THEN NULL ELSE verified_at END
   WHERE id = a.id RETURNING * INTO a;
  PERFORM public.safety_alert_append(a, 'update', a.version - 1, v_changed, v_sev, v_uid,
                                     CASE WHEN v_owner THEN 'owner' ELSE 'moderator' END, p_note);
  IF NOT v_owner THEN       -- a moderator acting on someone else's alert: one audit row (an owner's write is its history row)
    PERFORM public.record_admin_action(v_uid, 'safety_alert.update', 'safety_alert', a.id::text, 'ok', NULLIF(btrim(p_note), ''),
      jsonb_build_object('version', a.version, 'changed', v_changed, 'severity_change', v_sev), public.request_id());
  END IF;
  RETURN public.safety_alert_public(a);
END $$;

-- new in this release: the version token is required from day one
CREATE FUNCTION public.resolve_safety_alert(p_alert_id uuid, p_expected_version integer, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := public.safety_alert_require_member(); v_now timestamptz := now(); a public.safety_alerts; v_owner boolean;
BEGIN
  IF p_expected_version IS NULL THEN RAISE EXCEPTION 'alert_field_required:expected_version' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  v_owner := a.created_by IS NOT NULL AND a.created_by = v_uid;
  IF NOT (v_owner OR public.current_user_tier_at_least('community_moderator')) THEN
    RAISE EXCEPTION 'not_alert_owner' USING ERRCODE = '42501'; END IF;
  IF a.status <> 'live' OR a.expires_at <= v_now THEN
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  IF p_expected_version <> a.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', a.version, 'updated_at', a.updated_at)::text; END IF;
  IF char_length(btrim(p_note)) > 500 THEN RAISE EXCEPTION 'alert_field_invalid:note' USING ERRCODE = '22023'; END IF;
  -- the reporter resolving their own alert acts as its owner, moderator or not (never "as moderator" on one's own)
  UPDATE public.safety_alerts
     SET status = 'resolved', resolved_at = v_now, resolved_by_role = CASE WHEN v_owner THEN 'owner' ELSE 'moderator' END,
         version = a.version + 1
   WHERE id = a.id RETURNING * INTO a;
  -- the all-clear is its own message and expires when the resolved alert stops being shown
  PERFORM public.safety_alert_append(a, 'all_clear', a.version - 1, ARRAY['status'], 'same', v_uid, a.resolved_by_role, p_note,
                                     v_now + interval '6 hours');
  IF NOT v_owner THEN
    PERFORM public.record_admin_action(v_uid, 'safety_alert.resolve', 'safety_alert', a.id::text, 'ok', NULLIF(btrim(p_note), ''),
      jsonb_build_object('version', a.version), public.request_id());
  END IF;
  RETURN public.safety_alert_public(a);
END $$;

-- same name, arguments and return type as today (CREATE OR REPLACE): the owner's "delete" is a recorded withdrawal
CREATE OR REPLACE FUNCTION public.delete_safety_alert(p_alert_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := public.safety_alert_require_member(); a public.safety_alerts;
BEGIN
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  IF a.created_by IS NULL OR a.created_by <> v_uid THEN RAISE EXCEPTION 'not_alert_owner' USING ERRCODE = '42501'; END IF;
  IF public.safety_alert_shown_state(a.status, a.expires_at, a.resolved_at) = 'gone' THEN
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  UPDATE public.safety_alerts SET status = 'withdrawn', version = a.version + 1 WHERE id = a.id RETURNING * INTO a;
  PERFORM public.safety_alert_append(a, 'cancel', a.version - 1, ARRAY['status'], 'same', v_uid, 'owner', NULL);
END $$;

DROP FUNCTION public.vote_safety_alert(uuid, text);
CREATE FUNCTION public.vote_safety_alert(p_alert_id uuid, p_vote text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := public.safety_alert_require_member(); a public.safety_alerts;
BEGIN
  IF p_vote IS NULL OR p_vote NOT IN ('confirm', 'clear') THEN
    RAISE EXCEPTION 'alert_field_invalid:vote' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  IF a.status <> 'live' OR a.expires_at <= now() THEN
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  INSERT INTO public.safety_alert_votes (alert_id, voter_id, vote) VALUES (p_alert_id, v_uid, p_vote)
  ON CONFLICT (alert_id, voter_id) DO UPDATE SET vote = EXCLUDED.vote;
  -- three "Gone now" votes outnumbering "Still here" clear the alert at once (it is gone, not shown as resolved)
  UPDATE public.safety_alerts s
     SET confirm_count = c.confirms, clear_count = c.clears,
         status = CASE WHEN s.status = 'live' AND c.clears >= 3 AND c.clears > c.confirms THEN 'cleared' ELSE s.status END
    FROM (SELECT count(*) FILTER (WHERE vote = 'confirm') AS confirms, count(*) FILTER (WHERE vote = 'clear') AS clears
            FROM public.safety_alert_votes WHERE alert_id = p_alert_id) c
   WHERE s.id = p_alert_id RETURNING s.* INTO a;
  RETURN public.safety_alert_public(a);
END $$;

DROP FUNCTION public.admin_verify_safety_alert(uuid);
CREATE FUNCTION public.admin_verify_safety_alert(p_alert_id uuid, p_expected_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := public.safety_alert_require_member(); a public.safety_alerts;
BEGIN
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  IF a.created_by = v_uid THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;   -- never one's own alert
  IF a.status <> 'live' OR a.expires_at <= now() THEN
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> a.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', a.version, 'updated_at', a.updated_at)::text; END IF;
  IF a.verified THEN RETURN public.safety_alert_public(a); END IF;              -- the first verifier stands; no second audit row
  UPDATE public.safety_alerts SET verified = true, verified_by = v_uid, verified_at = now() WHERE id = a.id RETURNING * INTO a;
  -- the audit row names the alert and the acting moderator, never the reporter (reporter anonymity holds for staff too)
  PERFORM public.record_admin_action(v_uid, 'safety_alert.verify', 'safety_alert', a.id::text, 'ok', NULL,
    jsonb_build_object('version', a.version), public.request_id());
  RETURN public.safety_alert_public(a);
END $$;

DROP FUNCTION public.admin_remove_safety_alert(uuid);
CREATE FUNCTION public.admin_remove_safety_alert(p_alert_id uuid, p_reason text DEFAULT NULL, p_expected_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := public.safety_alert_require_member(); a public.safety_alerts; v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'alert_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  IF a.status = 'removed' THEN RETURN public.safety_alert_public(a); END IF;
  IF public.safety_alert_shown_state(a.status, a.expires_at, a.resolved_at) = 'gone' THEN
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> a.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', a.version, 'updated_at', a.updated_at)::text; END IF;
  -- removing one's own alert only restricts, so it is allowed (verifying it is not)
  UPDATE public.safety_alerts SET status = 'removed', version = a.version + 1 WHERE id = a.id RETURNING * INTO a;
  PERFORM public.safety_alert_append(a, 'cancel', a.version - 1, ARRAY['status'], 'same', v_uid, 'moderator', v_reason);
  PERFORM public.record_admin_action(v_uid, 'safety_alert.remove', 'safety_alert', a.id::text, 'ok', v_reason,
    jsonb_build_object('version', a.version), public.request_id());                -- no reporter id (see verify)
  RETURN public.safety_alert_public(a);
END $$;

-- ONE reader: the map (bbox), a single alert (p_alert_id) and the feed strip (neither: top p_limit, default 5).
-- The first 13 columns are the ones the deployed client reads, in the same order; id is kept.
DROP FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision);
CREATE FUNCTION public.safety_alerts_in_view(p_min_lng double precision DEFAULT NULL, p_min_lat double precision DEFAULT NULL,
                                             p_max_lng double precision DEFAULT NULL, p_max_lat double precision DEFAULT NULL,
                                             p_alert_id uuid DEFAULT NULL, p_include_resolved boolean DEFAULT false,
                                             p_limit integer DEFAULT NULL)
RETURNS TABLE(id uuid, alert_type text, severity integer, description text, lng double precision, lat double precision, status text,
              confirm_count integer, clear_count integer, created_at timestamptz, expires_at timestamptz, verified boolean, is_mine boolean,
              version integer, updated_at timestamptz, update_count integer, resolved_at timestamptz, resolved_by_role text,
              shown_state text, shown_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sa.id, sa.alert_type, sa.severity, sa.description, ST_X(sa.location::geometry)::float8, ST_Y(sa.location::geometry)::float8,
         sa.status, sa.confirm_count, sa.clear_count, sa.created_at, sa.expires_at, sa.verified,
         COALESCE(sa.created_by = auth.uid(), false),
         sa.version, sa.updated_at, sa.update_count, sa.resolved_at, sa.resolved_by_role, st.state,
         CASE WHEN sa.status = 'resolved' THEN sa.resolved_at + interval '6 hours' ELSE sa.expires_at END
    FROM public.safety_alerts sa
   CROSS JOIN LATERAL (SELECT public.safety_alert_shown_state(sa.status, sa.expires_at, sa.resolved_at) AS state) st
   WHERE (st.state = 'live' OR (COALESCE(p_include_resolved, false) AND st.state = 'resolved'))
     AND (p_alert_id IS NULL OR sa.id = p_alert_id)
     AND (p_min_lng IS NULL OR p_min_lat IS NULL OR p_max_lng IS NULL OR p_max_lat IS NULL
          OR ST_Intersects(sa.location, ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography))
   ORDER BY (st.state = 'live') DESC, sa.severity DESC, sa.created_at DESC
   LIMIT COALESCE(p_limit, CASE WHEN p_alert_id IS NULL AND (p_min_lng IS NULL OR p_min_lat IS NULL OR p_max_lng IS NULL OR p_max_lat IS NULL)
                                THEN 5 END)
$$;

-- the history of an alert that is currently shown: who changed it is a role, never an id
CREATE FUNCTION public.safety_alert_history(p_alert_id uuid)
RETURNS TABLE(version integer, msg_type text, supersedes_version integer, sent_at timestamptz, alert_type text, severity integer,
              description text, lng double precision, lat double precision, expires_at timestamptz, changed text[],
              severity_change text, actor_role text, note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.version, u.msg_type, u.supersedes_version, u.sent_at, u.alert_type, u.severity, u.description,
         ST_X(u.location::geometry)::float8, ST_Y(u.location::geometry)::float8, u.expires_at, u.changed, u.severity_change,
         u.actor_role, u.note
    FROM public.safety_alert_updates u JOIN public.safety_alerts sa ON sa.id = u.alert_id
   WHERE u.alert_id = p_alert_id AND public.safety_alert_shown_state(sa.status, sa.expires_at, sa.resolved_at) <> 'gone'
   ORDER BY u.version DESC
$$;

-- ============================================================================
-- 6b. Labels
-- ============================================================================
-- Moderator: apply (p_applied true) or retract (false). Applying again at a newer post version retracts the older
-- record ('superseded') and writes a new one at the version the moderator saw.
CREATE FUNCTION public.admin_set_post_label(p_post_id uuid, p_label text, p_applied boolean, p_expected_version integer DEFAULT NULL,
                                            p_reason text DEFAULT NULL, p_ground text DEFAULT 'incompatible_content',
                                            p_report_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid(); v_tier public.admin_tier; p public.posts%ROWTYPE; v_reason text := NULLIF(btrim(p_reason), '');
  v_old public.post_labels; v_new bigint;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_tier := public.current_user_tier();
  IF v_tier IS NULL OR v_tier < 'community_moderator' THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF p_label IS NULL OR p_label NOT IN ('outdated', 'misleading', 'sensitive') THEN
    RAISE EXCEPTION 'label_invalid:%', COALESCE(p_label, '<null>') USING ERRCODE = '22023'; END IF;
  IF p_applied IS NULL THEN RAISE EXCEPTION 'label_field_required:applied' USING ERRCODE = '22023'; END IF;
  IF p_ground IS NULL OR p_ground NOT IN ('incompatible_content', 'illegal_content') THEN
    RAISE EXCEPTION 'label_field_invalid:ground' USING ERRCODE = '22023'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'label_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  IF p_applied AND v_reason IS NULL THEN                                   -- a label is a decision: it carries its facts
    RAISE EXCEPTION 'label_field_required:reason' USING ERRCODE = '22023'; END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, false);
  IF p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'post_deleted' USING ERRCODE = 'PT404'; END IF;
  -- the audit row may only name a report that is about this post
  IF p_report_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.content_reports
                                              WHERE id = p_report_id AND content_type = 'post' AND content_id = p.id) THEN
    RAISE EXCEPTION 'label_field_invalid:report' USING ERRCODE = '22023'; END IF;
  -- no one lifts moderation on their own content (labelling one's own post only restricts, so it is allowed)
  IF NOT p_applied AND p.user_id = v_uid THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_old FROM public.post_labels
   WHERE post_id = p.id AND label = p_label AND source_kind = 'moderator' AND retracted_at IS NULL FOR UPDATE;
  IF p_applied AND v_old.id IS NOT NULL AND v_old.post_version = p.version THEN
    RETURN jsonb_build_object('post_id', p.id, 'label', p_label, 'applied', true, 'label_id', v_old.id,
                              'post_version', v_old.post_version, 'changed', false);
  END IF;
  IF NOT p_applied AND v_old.id IS NULL THEN
    RETURN jsonb_build_object('post_id', p.id, 'label', p_label, 'applied', false, 'label_id', NULL,
                              'post_version', p.version, 'changed', false);
  END IF;
  IF v_old.id IS NOT NULL THEN
    UPDATE public.post_labels SET retracted_at = now(), retracted_by = v_uid, retracted_by_role = v_tier::text,
           retract_reason = CASE WHEN p_applied THEN 'superseded' ELSE v_reason END
     WHERE id = v_old.id;
  END IF;
  IF p_applied THEN
    INSERT INTO public.post_labels (post_id, label, post_version, source_role, applied_by, reason)
    VALUES (p.id, p_label, p.version, v_tier::text, v_uid, v_reason) RETURNING id INTO v_new;
  END IF;
  -- a moderator who acted on the version they saw has reviewed it (the rule hold / remove use; never on one's own post)
  IF p_expected_version IS NOT NULL AND p.user_id <> v_uid AND NOT p.is_hidden THEN
    UPDATE public.posts SET needs_review_at = NULL WHERE id = p.id AND needs_review_at IS NOT NULL;
  END IF;
  PERFORM public.record_admin_action(v_uid, CASE WHEN p_applied THEN 'post.label' ELSE 'post.unlabel' END, 'post', p.id::text, 'ok', v_reason,
    jsonb_build_object('label', p_label, 'label_id', COALESCE(v_new, v_old.id),
                       'supersedes_label_id', CASE WHEN p_applied THEN v_old.id END,
                       'author_id', p.user_id, 'version', p.version,
                       -- statement-of-reasons fields: no reader in this release; the moderation screens of the
                       -- next release (decision log, the notice to the author) read them from this row
                       'decision_visibility', CASE WHEN p_applied THEN 'CONTENT_LABELLED' ELSE 'LABEL_RETRACTED' END,
                       'decision_ground', upper(p_ground), 'decision_facts', v_reason,
                       'source_type', CASE WHEN p_report_id IS NULL THEN 'VOLUNTARY' ELSE 'OTHER_NOTIFICATION' END,
                       'report_id', p_report_id, 'automated_detection', false, 'automated_decision', 'NOT_AUTOMATED',
                       'content_type', 'post', 'application_date', now(), 'redress', 'report_or_contact_moderators'),
    public.request_id());
  RETURN jsonb_build_object('post_id', p.id, 'label', p_label, 'applied', p_applied, 'label_id', COALESCE(v_new, v_old.id),
                            'post_version', p.version, 'changed', true);
END $$;

-- Author: mark / unmark one's own post. The allowlist is the whole rule (sensitive only). A moderator's label on
-- the same post is a separate record the author cannot retract.
CREATE FUNCTION public.set_own_post_label(p_post_id uuid, p_label text, p_applied boolean, p_expected_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  c_self_labels constant text[] := ARRAY['sensitive'];
  v_uid uuid := auth.uid(); p public.posts%ROWTYPE; v_old public.post_labels; v_new bigint;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_label IS NULL OR NOT (p_label = ANY (c_self_labels)) THEN
    RAISE EXCEPTION 'label_not_self_applicable:%', COALESCE(p_label, '<null>') USING ERRCODE = '42501'; END IF;
  IF p_applied IS NULL THEN RAISE EXCEPTION 'label_field_required:applied' USING ERRCODE = '22023'; END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, false);
  IF p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'post_not_found' USING ERRCODE = 'PT404'; END IF;
  IF p.user_id <> v_uid THEN RAISE EXCEPTION 'not_author' USING ERRCODE = '42501'; END IF;
  IF p.hidden_reason = 'admin_removal' THEN RAISE EXCEPTION 'post_removed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_old FROM public.post_labels
   WHERE post_id = p.id AND label = p_label AND source_kind = 'author' AND retracted_at IS NULL FOR UPDATE;
  IF p_applied AND v_old.id IS NULL THEN
    INSERT INTO public.post_labels (post_id, label, post_version, source_role, applied_by)
    VALUES (p.id, p_label, p.version, 'author', v_uid) RETURNING id INTO v_new;
  ELSIF NOT p_applied AND v_old.id IS NOT NULL THEN
    UPDATE public.post_labels SET retracted_at = now(), retracted_by = v_uid, retracted_by_role = 'author' WHERE id = v_old.id;
  END IF;
  RETURN jsonb_build_object('post_id', p.id, 'label', p_label, 'applied', p_applied, 'label_id', COALESCE(v_new, v_old.id),
                            'labels', (SELECT to_jsonb(labels) FROM public.posts WHERE id = p.id));
END $$;

-- ============================================================================
-- 6c. Comment lock
-- ============================================================================
CREATE FUNCTION public.admin_set_comments_locked(p_post_id uuid, p_locked boolean, p_expected_version integer DEFAULT NULL,
                                                 p_reason text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_tier public.admin_tier; p public.posts%ROWTYPE; v_note text := NULLIF(btrim(p_note), ''); v_at timestamptz;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_tier := public.current_user_tier();
  IF v_tier IS NULL OR v_tier < 'community_moderator' THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF p_locked IS NULL THEN RAISE EXCEPTION 'lock_field_required:locked' USING ERRCODE = '22023'; END IF;
  IF p_locked AND (p_reason IS NULL OR p_reason NOT IN ('heated', 'off_topic', 'resolved', 'spam', 'other')) THEN
    RAISE EXCEPTION 'lock_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  IF char_length(v_note) > 500 THEN RAISE EXCEPTION 'lock_field_invalid:note' USING ERRCODE = '22023'; END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, false);
  IF p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'post_deleted' USING ERRCODE = 'PT404'; END IF;
  -- no one lifts moderation on their own content (locking one's own post only restricts, so it is allowed)
  IF NOT p_locked AND p.user_id = v_uid THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;
  IF p_locked = (p.comments_locked_at IS NOT NULL) THEN
    RETURN jsonb_build_object('post_id', p.id, 'locked', p_locked, 'locked_at', p.comments_locked_at,
                              'reason', p.comments_locked_reason, 'changed', false);
  END IF;
  v_at := CASE WHEN p_locked THEN now() END;
  -- a status, not an edit: posts.version does not move (an author's open edit dialog is not invalidated)
  UPDATE public.posts
     SET comments_locked_at = v_at,
         comments_locked_reason = CASE WHEN p_locked THEN p_reason END,
         comments_locked_by_role = CASE WHEN p_locked THEN v_tier::text END
   WHERE id = p.id;
  PERFORM public.record_admin_action(v_uid, CASE WHEN p_locked THEN 'post.comments_lock' ELSE 'post.comments_unlock' END,
    'post', p.id::text, 'ok', COALESCE(v_note, p_reason),
    jsonb_build_object('author_id', p.user_id, 'version', p.version,
                       'lock_reason', CASE WHEN p_locked THEN p_reason ELSE p.comments_locked_reason END,
                       -- statement-of-reasons fields (as on a label decision): read by the next release's moderation screens
                       'decision_visibility', CASE WHEN p_locked THEN 'CONTENT_INTERACTION_RESTRICTED' ELSE 'INTERACTION_RESTRICTION_LIFTED' END,
                       'decision_ground', 'INCOMPATIBLE_CONTENT', 'decision_facts', COALESCE(v_note, p_reason),
                       'source_type', 'VOLUNTARY', 'automated_detection', false, 'automated_decision', 'NOT_AUTOMATED',
                       'content_type', 'post', 'application_date', now(), 'redress', 'report_or_contact_moderators'),
    public.request_id());
  RETURN jsonb_build_object('post_id', p.id, 'locked', p_locked, 'locked_at', v_at,
                            'reason', CASE WHEN p_locked THEN p_reason END, 'changed', true);
END $$;

-- ============================================================================
-- 6d. Reports: posts (unchanged for a first report), comments, org events. Same signatures (CREATE OR REPLACE).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_content_report(p_content_type text, p_content_id uuid, p_reason report_reason, p_details text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reporter uuid; v_count bigint; v_hidden boolean := false; v_accepted boolean := false;
  v_author uuid; v_version integer; v_changed_at timestamptz; v_last public.content_reports;
BEGIN
  IF COALESCE((SELECT (auth.jwt() ->> 'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501'; END IF;
  v_reporter := auth.uid();
  IF v_reporter IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF char_length(p_details) > 1000 THEN RAISE EXCEPTION 'report_field_invalid:details' USING ERRCODE = '22023'; END IF;

  -- lock the reported item: the open-report count below runs after this lock, so two concurrent reports serialise
  IF p_content_type = 'post' THEN
    SELECT user_id, version INTO v_author, v_version FROM public.posts WHERE id = p_content_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'post not found'; END IF;
    IF v_author = v_reporter THEN RAISE EXCEPTION 'you cannot report your own post'; END IF;
  ELSIF p_content_type = 'comment' THEN
    SELECT c.user_id, c.version INTO v_author, v_version FROM public.post_comments c
     WHERE c.id = p_content_id AND c.deleted_at IS NULL AND NOT c.is_hidden
       AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = c.post_id AND NOT p.is_hidden)
       FOR UPDATE OF c;
    IF NOT FOUND THEN RAISE EXCEPTION 'report_target_not_found' USING ERRCODE = 'PT404'; END IF;
    IF v_author = v_reporter THEN RAISE EXCEPTION 'report_own_content' USING ERRCODE = '42501'; END IF;
  ELSIF p_content_type = 'event' THEN
    SELECT e.created_by, e.updated_at INTO v_author, v_changed_at FROM public.assistance_events e
     WHERE e.id = p_content_id AND e.is_active
       AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = e.org_id AND o.is_active)
       FOR NO KEY UPDATE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'report_target_not_found' USING ERRCODE = 'PT404'; END IF;
    IF v_author = v_reporter OR public.is_org_admin((SELECT org_id FROM public.assistance_events WHERE id = p_content_id)) THEN
      RAISE EXCEPTION 'report_own_content' USING ERRCODE = '42501'; END IF;
  ELSE
    RAISE EXCEPTION 'unsupported content_type: %', p_content_type;
  END IF;

  -- this member's latest report on the item. Open: nothing to add. Resolved: a new report is taken only when the
  -- item changed since (posts / comments: a newer version; org events: updated after that report).
  SELECT * INTO v_last FROM public.content_reports
   WHERE reporter_id = v_reporter AND content_type = p_content_type AND content_id = p_content_id
   ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_last.id IS NULL
     OR (v_last.status <> 'open'
         AND ((p_content_type IN ('post', 'comment') AND v_version > COALESCE(v_last.reported_version, 0))
              OR (p_content_type = 'event' AND v_changed_at > v_last.created_at))) THEN
    INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason, details, reported_version)
    VALUES (v_reporter, p_content_type, p_content_id, p_reason, p_details, v_version);
    v_accepted := true;
  END IF;

  SELECT count(DISTINCT reporter_id) INTO v_count FROM public.content_reports
   WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'open';

  -- three distinct open reporters hide a post or a comment pending review; an org event is never hidden by reports
  -- (three accounts must not be able to take a food distribution off the feed): it reaches the queue only
  IF v_count >= 3 AND p_content_type = 'post' THEN
    UPDATE public.posts SET is_hidden = true, hidden_at = now(), hidden_reason = 'community_reports_threshold'
     WHERE id = p_content_id AND is_hidden = false;
    v_hidden := true;
  ELSIF v_count >= 3 AND p_content_type = 'comment' THEN
    UPDATE public.post_comments SET is_hidden = true, hidden_reason = 'community_reports_threshold'
     WHERE id = p_content_id AND NOT is_hidden;
    v_hidden := true;
  END IF;
  RETURN jsonb_build_object('report_count', v_count, 'hidden', v_hidden, 'accepted', v_accepted);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id uuid, p_action text, p_expected_version integer DEFAULT NULL::integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_content_id uuid; v_content_type text; v_open_count bigint;
  p public.posts%ROWTYPE; c public.post_comments%ROWTYPE; e public.assistance_events%ROWTYPE;
  v_unhidden boolean := false; v_review_held boolean := false; v_version integer;
BEGIN
  IF COALESCE((SELECT (auth.jwt() ->> 'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('dismiss', 'uphold') THEN RAISE EXCEPTION 'action must be dismiss or uphold'; END IF;
  SELECT content_id, content_type INTO v_content_id, v_content_type FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;

  -- lock the reported item (a hard-deleted one leaves nothing to lock; the report still resolves). No one resolves
  -- reports on their own content: 'dismiss' can lift the community hide, 'uphold' takes the report out of the count.
  IF v_content_type = 'post' AND EXISTS (SELECT 1 FROM public.posts WHERE id = v_content_id) THEN
    p := public.post_lock_for_moderation(v_content_id, p_expected_version, false);
    v_version := p.version;
    IF p.user_id = auth.uid() THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;
  ELSIF v_content_type = 'comment' THEN
    SELECT * INTO c FROM public.post_comments WHERE id = v_content_id FOR UPDATE;
    v_version := c.version;
    IF c.id IS NOT NULL AND p_expected_version IS NOT NULL AND p_expected_version <> c.version THEN
      RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
        DETAIL = jsonb_build_object('current_version', c.version, 'edited_at', c.edited_at)::text; END IF;
    IF c.user_id = auth.uid() THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;
  ELSIF v_content_type = 'event' THEN
    SELECT * INTO e FROM public.assistance_events WHERE id = v_content_id FOR NO KEY UPDATE;
    IF e.id IS NOT NULL AND (e.created_by = auth.uid() OR public.is_org_admin(e.org_id)) THEN
      RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;
  END IF;

  IF p_action = 'uphold' THEN
    UPDATE public.content_reports SET status = 'upheld' WHERE id = p_report_id;
  ELSE
    UPDATE public.content_reports SET status = 'dismissed' WHERE id = p_report_id;
    SELECT count(*) INTO v_open_count FROM public.content_reports
     WHERE content_type = v_content_type AND content_id = v_content_id AND status = 'open';
    -- the last dismissal lifts ONLY the automatic community hide, never a hold, a removal, a deletion or a
    -- moderator's hide; an author's edit no moderator has seen stays hidden for a version-less caller
    IF v_open_count = 0 AND p.id IS NOT NULL AND p.hidden_reason = 'community_reports_threshold' AND p.deleted_at IS NULL THEN
      IF p_expected_version IS NULL AND p.needs_review_at IS NOT NULL THEN
        v_review_held := true;
      ELSE
        UPDATE public.posts SET is_hidden = false, hidden_at = NULL, hidden_reason = NULL, needs_review_at = NULL WHERE id = v_content_id;
        v_unhidden := true;
      END IF;
    ELSIF v_open_count = 0 AND c.id IS NOT NULL AND c.hidden_reason = 'community_reports_threshold' AND c.deleted_at IS NULL THEN
      UPDATE public.post_comments SET is_hidden = false, hidden_reason = NULL WHERE id = v_content_id;
      v_unhidden := true;
    END IF;
  END IF;
  PERFORM public.record_admin_action(auth.uid(), 'report.resolve', 'report', p_report_id::text, 'ok', p_action,
    jsonb_build_object('content_type', v_content_type, 'content_id', v_content_id, 'version', v_version, 'unhidden', v_unhidden),
    public.request_id());
  RETURN jsonb_build_object('report_id', p_report_id, 'action', p_action, 'unhidden', v_unhidden, 'needs_review', v_review_held);
END $$;

-- a moderator's hide records its reason (a later dismissal cannot lift it) and, like admin_remove_post, answers the open reports
CREATE OR REPLACE FUNCTION public.admin_set_comment_hidden(p_comment_id uuid, p_hidden boolean, p_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_post uuid; v_author uuid; v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF p_hidden IS NULL THEN RAISE EXCEPTION 'comment_field_required:hidden' USING ERRCODE = '22023'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'post_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  SELECT post_id, user_id INTO v_post, v_author FROM public.post_comments WHERE id = p_comment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'comment_not_found' USING ERRCODE = 'PT404'; END IF;
  -- no one unhides their own comment (hiding it stays allowed: it only restricts)
  IF NOT p_hidden AND v_author = auth.uid() THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;
  UPDATE public.post_comments SET is_hidden = p_hidden, hidden_reason = CASE WHEN p_hidden THEN 'moderator' END WHERE id = p_comment_id;
  IF p_hidden THEN
    UPDATE public.content_reports SET status = 'upheld' WHERE content_type = 'comment' AND content_id = p_comment_id AND status = 'open';
  END IF;
  PERFORM public.record_admin_action(auth.uid(), CASE WHEN p_hidden THEN 'comment.hide' ELSE 'comment.unhide' END,
    'comment', p_comment_id::text, 'ok', v_reason, jsonb_build_object('post_id', v_post, 'author_id', v_author), public.request_id());
  RETURN jsonb_build_object('comment_id', p_comment_id, 'is_hidden', p_hidden);
END $$;

-- ============================================================================
-- 6e. Request / offer status, and opt-ins
-- ============================================================================
-- closed / fulfilled: a status set by the author, reversible. Not an edit: no new version, no revision, nothing hidden.
CREATE FUNCTION public.set_post_closed(p_post_id uuid, p_closed boolean, p_expected_version integer DEFAULT NULL,
                                       p_reason text DEFAULT 'fulfilled')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); p public.posts%ROWTYPE;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_closed IS NULL THEN RAISE EXCEPTION 'post_field_required:closed' USING ERRCODE = '22023'; END IF;
  SELECT * INTO p FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'post_not_found' USING ERRCODE = 'PT404'; END IF;
  IF p.user_id <> v_uid THEN RAISE EXCEPTION 'not_author' USING ERRCODE = '42501'; END IF;
  IF p.post_type NOT IN ('seeker_request', 'source_offer') THEN
    RAISE EXCEPTION 'post_type_not_closable:%', p.post_type USING ERRCODE = '0A000'; END IF;
  IF p.hidden_reason = 'admin_removal' THEN RAISE EXCEPTION 'post_removed' USING ERRCODE = '42501'; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> p.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', p.version, 'edited_at', p.edited_at)::text; END IF;
  IF p_closed AND (p_reason IS NULL OR p_reason NOT IN ('fulfilled', 'closed')) THEN
    RAISE EXCEPTION 'post_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  UPDATE public.posts
     SET closed_at = CASE WHEN p_closed THEN COALESCE(closed_at, now()) END,
         closed_reason = CASE WHEN p_closed THEN p_reason END
   WHERE id = p.id RETURNING * INTO p;
  RETURN jsonb_build_object('post_id', p.id, 'closed', p.closed_at IS NOT NULL, 'closed_at', p.closed_at,
                            'closed_reason', p.closed_reason, 'version', p.version);
END $$;

-- the live body + one check: a closed post takes no new opt-ins (same signature and return type: CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.opt_in_to_post(p_post_id uuid) RETURNS resource_opt_ins
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_caller_id uuid; v_post public.posts%ROWTYPE; v_opt_in public.resource_opt_ins%ROWTYPE;
BEGIN
  IF COALESCE((SELECT (auth.jwt() ->> 'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501'; END IF;
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- row-lock the post to serialise concurrent opt-ins
  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  -- hidden (held, removed, community-hidden) or deleted posts take no opt-ins
  IF v_post.is_hidden THEN RAISE EXCEPTION 'This post is closed'; END IF;
  -- closed by its author: the sentence the deployed client already shows for a hidden post, with its own token
  IF v_post.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This post is closed' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('code', 'post_closed', 'closed_reason', v_post.closed_reason)::text; END IF;
  IF v_post.user_id = v_caller_id THEN RAISE EXCEPTION 'You cannot opt in to your own post'; END IF;
  IF v_post.max_seekers IS NOT NULL AND v_post.slots_remaining <= 0 THEN RAISE EXCEPTION 'This offer is full'; END IF;
  BEGIN
    INSERT INTO public.resource_opt_ins (post_id, seeker_id, resource_id, status)
    VALUES (p_post_id, v_caller_id, v_post.resource_id, 'pending') RETURNING * INTO v_opt_in;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Already opted in';
  END;
  IF v_post.max_seekers IS NOT NULL THEN
    UPDATE public.posts SET slots_remaining = slots_remaining - 1 WHERE id = p_post_id;
  END IF;
  RETURN v_opt_in;
END $$;

-- withdraw / unblock: the live bodies minus their own slot arithmetic; the slot comes back in
-- trg_resource_opt_ins_return_slot, the one place a deleted opt-in returns its slot (same signatures: CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.withdraw_opt_in(p_post_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_caller_id uuid; v_deleted integer;
BEGIN
  IF COALESCE((SELECT (auth.jwt() ->> 'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501'; END IF;
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- The lock order of every opt-in RPC: the seeker's profile (KEY SHARE), then the post, then the opt-in. An account
  -- deletion takes the profile row first and reaches the opt-in through the cascade, so the two queue at the profile
  -- row; without this lock the trail row's foreign key asks for it last and the two meet in a deadlock.
  PERFORM 1 FROM public.profiles WHERE id = v_caller_id FOR KEY SHARE;
  PERFORM 1 FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  DELETE FROM public.resource_opt_ins WHERE post_id = p_post_id AND seeker_id = v_caller_id AND status = 'pending';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END $$;

CREATE OR REPLACE FUNCTION public.unblock_opt_in(p_opt_in_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_status text; v_author uuid; v_post_id uuid; v_seeker uuid; v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501'; END IF;
  SELECT oi.status, oi.post_id, oi.seeker_id, p.user_id INTO v_status, v_post_id, v_seeker, v_author
    FROM public.resource_opt_ins oi JOIN public.posts p ON p.id = oi.post_id WHERE oi.id = p_opt_in_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opt-in not found'; END IF;
  IF v_author IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the post author may unblock this opt-in' USING ERRCODE = '42501'; END IF;
  IF v_status <> 'declined' THEN
    RAISE EXCEPTION 'Only a declined opt-in can be unblocked' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_seeker FOR KEY SHARE;         -- the seeker's profile, then the post, then the opt-in
  PERFORM 1 FROM public.posts WHERE id = v_post_id FOR UPDATE;
  DELETE FROM public.resource_opt_ins WHERE id = p_opt_in_id AND status = 'declined';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END $$;

-- the author's decision on an opt-in: accept, decline, complete. State machine + status token; the trail row is
-- written by trg_resource_opt_ins_audit.
CREATE FUNCTION public.decide_opt_in(p_opt_in_id uuid, p_decision text, p_expected_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_post_id uuid; v_seeker uuid; p public.posts%ROWTYPE; o public.resource_opt_ins%ROWTYPE; v_to text;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_to := CASE p_decision WHEN 'accept' THEN 'accepted' WHEN 'decline' THEN 'declined' WHEN 'complete' THEN 'completed' END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'opt_in_field_invalid:decision' USING ERRCODE = '22023'; END IF;
  SELECT post_id, seeker_id INTO v_post_id, v_seeker FROM public.resource_opt_ins WHERE id = p_opt_in_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'opt_in_not_found' USING ERRCODE = 'PT404'; END IF;
  -- the seeker's profile first (KEY SHARE): a decision and that seeker's account deletion queue at the profile row.
  -- After the wait the opt-in may be gone with the account; the lookup below then answers opt_in_not_found.
  PERFORM 1 FROM public.profiles WHERE id = v_seeker FOR KEY SHARE;
  SELECT * INTO p FROM public.posts WHERE id = v_post_id FOR UPDATE;        -- then the post, then the opt-in
  SELECT * INTO o FROM public.resource_opt_ins WHERE id = p_opt_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'opt_in_not_found' USING ERRCODE = 'PT404'; END IF;
  IF p.user_id <> v_uid THEN RAISE EXCEPTION 'not_author' USING ERRCODE = '42501'; END IF;
  IF p_expected_status IS NOT NULL AND p_expected_status <> o.status THEN
    RAISE EXCEPTION 'opt_in_conflict' USING ERRCODE = 'PT409', DETAIL = jsonb_build_object('current_status', o.status)::text; END IF;
  IF NOT ((o.status = 'pending' AND v_to IN ('accepted', 'declined')) OR (o.status = 'accepted' AND v_to = 'completed')) THEN
    RAISE EXCEPTION 'opt_in_transition_invalid' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('from', o.status, 'to', v_to)::text; END IF;
  -- nothing new is agreed on a removed or deleted post (declining and completing stay possible)
  IF v_to = 'accepted' AND (p.deleted_at IS NOT NULL OR p.hidden_reason = 'admin_removal') THEN
    RAISE EXCEPTION 'post_removed' USING ERRCODE = '42501'; END IF;
  UPDATE public.resource_opt_ins SET status = v_to WHERE id = o.id RETURNING * INTO o;
  RETURN jsonb_build_object('opt_in_id', o.id, 'post_id', o.post_id, 'status', o.status, 'completed_at', o.completed_at);
END $$;

-- ============================================================================
-- 6f. Announcements: a staff pin with an expiry, and the Announcements filter
-- ============================================================================
CREATE FUNCTION public.admin_set_post_pinned(p_post_id uuid, p_pinned boolean, p_expected_version integer DEFAULT NULL,
                                             p_until timestamptz DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); p public.posts%ROWTYPE; v_reason text := NULLIF(btrim(p_reason), ''); v_until timestamptz;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF p_pinned IS NULL THEN RAISE EXCEPTION 'pin_field_required:pinned' USING ERRCODE = '22023'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'pin_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  v_until := CASE WHEN p_pinned THEN COALESCE(p_until, now() + interval '7 days') END;      -- every pin ends
  IF p_pinned AND v_until <= now() THEN RAISE EXCEPTION 'pin_field_invalid:until' USING ERRCODE = '22023'; END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, false);
  IF p_pinned AND (p.is_hidden OR p.deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'post_not_visible' USING ERRCODE = '42501'; END IF;
  IF NOT p_pinned AND NOT p.is_pinned THEN                                  -- nothing to unpin: no write, no audit row
    RETURN jsonb_build_object('post_id', p.id, 'is_pinned', false, 'pinned_until', NULL);
  END IF;
  UPDATE public.posts SET is_pinned = p_pinned, pinned_until = v_until WHERE id = p.id;
  -- pinning one's own post is allowed (a staff announcement is usually the staff member's own post); the row says so
  PERFORM public.record_admin_action(v_uid, CASE WHEN p_pinned THEN 'post.pin' ELSE 'post.unpin' END, 'post', p.id::text, 'ok', v_reason,
    jsonb_build_object('author_id', p.user_id, 'version', p.version, 'pinned_until', v_until, 'own_post', p.user_id = v_uid),
    public.request_id());
  RETURN jsonb_build_object('post_id', p.id, 'is_pinned', p_pinned, 'pinned_until', v_until);
END $$;

-- ranked_feed_v2 gains p_filter (a signature change: DROP + CREATE with a DEFAULT, never an overload; grants in
-- section 7). NULL / 'all' = the rows of today; 'announcements' = live pins + org events, complete across pages.
-- The body is the live one plus: the pin stops floating when pinned_until passes, and the filter.
DROP FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid);
CREATE FUNCTION public.ranked_feed_v2(p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL, p_limit integer DEFAULT 25,
                                      p_cursor_score real DEFAULT NULL, p_cursor_id uuid DEFAULT NULL, p_filter text DEFAULT NULL)
RETURNS TABLE(id uuid, kind text, score real, distance_bucket text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $function$
  WITH cfg AS (
    SELECT half_life_hours, distance_decay_km, comment_weight, event_half_life_hours
    FROM public.ranking_config
    LIMIT 1
  ),
  caller AS (
    SELECT (SELECT auth.uid()) AS uid
  ),
  origin AS (
    SELECT CASE
             WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
             ELSE NULL
           END AS geo
  ),
  -- ===================================================================
  -- POSTS branch — the W1.3 ranking (ranked_feed v1 dropped in 20261026000000).
  -- A deleted post is never ranked, for any viewer (author and staff included).
  -- ===================================================================
  visible AS (
    SELECT
      p.id,
      (p.is_pinned AND (p.pinned_until IS NULL OR p.pinned_until > now())) AS is_pinned,   -- an expired pin no longer floats
      p.like_count,
      p.comment_count,
      p.created_at,
      CASE
        WHEN o.geo IS NOT NULL AND p.location IS NOT NULL
        THEN ST_Distance(p.location, o.geo) / 1000.0
        ELSE NULL
      END AS dist_km
    FROM public.posts p
    CROSS JOIN origin o
    CROSS JOIN caller c
    WHERE p.deleted_at IS NULL
      AND (   (NOT p.is_hidden)
           OR (p.user_id = c.uid)
           OR EXISTS (
                SELECT 1 FROM public.profiles pr
                WHERE pr.id = c.uid AND pr.is_staff = true
              ))
  ),
  base AS (
    SELECT
      v.id,
      v.dist_km,
      v.is_pinned,
      (
          (1 + log(10.0, 1 + v.like_count + cfg.comment_weight * v.comment_count))
        * exp( -ln(2.0)
               * (EXTRACT(EPOCH FROM (now() - v.created_at)) / 3600.0)
               / cfg.half_life_hours )
        * CASE
            WHEN v.dist_km IS NULL THEN 1.0
            WHEN v.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km )
            WHEN v.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km )
            WHEN v.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km )
            ELSE                        exp( -75.0 / cfg.distance_decay_km )
          END
        + CASE WHEN v.is_pinned THEN 1000000.0 ELSE 0 END
      ) AS raw_score
    FROM visible v
    CROSS JOIN cfg
  ),
  scored AS (
    SELECT
      b.id,
      b.dist_km,
      b.is_pinned,
      (CASE WHEN b.raw_score < 1e-20 THEN 0.0 ELSE b.raw_score END)::real AS score
    FROM base b
  ),
  posts_ranked AS (
    SELECT
      s.id,
      'post'::text AS kind,
      s.is_pinned AS announcement,
      s.score,
      CASE
        WHEN s.dist_km IS NULL   THEN 'unknown'
        WHEN s.dist_km < 2       THEN '<2km'
        WHEN s.dist_km < 10      THEN '2-10km'
        WHEN s.dist_km < 50      THEN '10-50km'
        ELSE                          '>50km'
      END AS distance_bucket
    FROM scored s
  ),
  -- ===================================================================
  -- EVENTS branch — one row per event from the shared rule event_feed_next
  -- (announce window, active event + org, not ended; the same rows
  -- upcoming_events lists). An upcoming row scores max(freshness since the
  -- date became the event's shown date, on the posts' half-life; proximity
  -- to its start, on the events' half-life); a cancelled row (listed until
  -- it ends so nobody makes a wasted trip) scores proximity only. Both x
  -- distance bucket factor. dist_km NEVER returned (anti-oracle).
  -- ===================================================================
  ev_next AS (
    SELECT
      f.occurrence_id AS occ_id,
      f.starts_at,
      f.cancelled,
      f.shown_since,
      CASE
        WHEN o.geo IS NOT NULL AND ae.location IS NOT NULL
        THEN ST_Distance(ae.location, o.geo) / 1000.0
        ELSE NULL
      END AS dist_km
    FROM public.event_feed_next(now()) f
    JOIN public.assistance_events ae ON ae.id = f.event_id
    CROSS JOIN origin o
  ),
  ev_base AS (
    SELECT
      x.occ_id,
      x.dist_km,
      (
          CASE
            WHEN x.cancelled THEN                            -- cancelled row: proximity only
              exp( -ln(2.0)
                   * ( abs(EXTRACT(EPOCH FROM (now() - x.starts_at))) / 3600.0 )
                   / cfg.event_half_life_hours )
            ELSE GREATEST(
              exp( -ln(2.0)
                   * ( GREATEST(EXTRACT(EPOCH FROM (now() - x.shown_since)), 0) / 3600.0 )
                   / cfg.half_life_hours ),                  -- freshness since shown (posts' half-life)
              exp( -ln(2.0)
                   * ( abs(EXTRACT(EPOCH FROM (now() - x.starts_at))) / 3600.0 )
                   / cfg.event_half_life_hours )             -- proximity to start (events' half-life)
            )
          END
        * CASE
            WHEN x.dist_km IS NULL THEN 1.0
            WHEN x.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km )
            WHEN x.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km )
            WHEN x.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km )
            ELSE                        exp( -75.0 / cfg.distance_decay_km )
          END
      ) AS raw_score                                       -- never pinned
    FROM ev_next x
    CROSS JOIN cfg
  ),
  events_ranked AS (
    SELECT
      eb.occ_id AS id,                                     -- feed row id = occurrence id
      'event'::text AS kind,
      true AS announcement,                                -- an org event is an announcement
      (CASE WHEN eb.raw_score < 1e-20 THEN 0.0 ELSE eb.raw_score END)::real AS score,
      CASE
        WHEN eb.dist_km IS NULL THEN 'unknown'
        WHEN eb.dist_km < 2     THEN '<2km'
        WHEN eb.dist_km < 10    THEN '2-10km'
        WHEN eb.dist_km < 50    THEN '10-50km'
        ELSE                         '>50km'
      END AS distance_bucket
    FROM ev_base eb
  ),
  merged AS (
    SELECT id, kind, announcement, score, distance_bucket FROM posts_ranked
    UNION ALL
    SELECT id, kind, announcement, score, distance_bucket FROM events_ranked
  )
  SELECT
    m.id,
    m.kind,
    m.score,
    m.distance_bucket
  FROM merged m
  -- Single cross-kind keyset (INV-C): (score, id) < cursor in the same (DESC, DESC)
  -- order. occ_id / post_id are distinct UUIDs so the (score, id) key is unique
  -- across kinds; the id tiebreak keeps it strictly monotonic on score ties.
  WHERE
    (p_cursor_score IS NULL
     OR (m.score, m.id) < (p_cursor_score, p_cursor_id))
    AND (p_filter IS NULL OR p_filter = 'all' OR (p_filter = 'announcements' AND m.announcement))
  ORDER BY m.score DESC, m.id DESC
  LIMIT greatest(coalesce(p_limit, 25), 1);
$function$;

-- ============================================================================
-- 6g. Petitions: review (approve publishes a feed post) and update notes
-- ============================================================================
-- draft -> approved -> feed post, in one transaction. create_post keeps refusing the petition type: this is the
-- only way a petition post is born.
CREATE FUNCTION public.admin_review_petition(p_petition_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); t public.petitions%ROWTYPE; v_post uuid; v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'petition_field_invalid:action' USING ERRCODE = '22023'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'petition_field_invalid:reason' USING ERRCODE = '22023'; END IF;
  IF p_action = 'reject' AND v_reason IS NULL THEN RAISE EXCEPTION 'petition_field_required:reason' USING ERRCODE = '22023'; END IF;
  SELECT * INTO t FROM public.petitions WHERE id = p_petition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'petition_not_found' USING ERRCODE = 'PT404'; END IF;
  IF t.created_by = v_uid THEN RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501'; END IF;   -- nobody reviews their own petition
  IF t.status = 'approved' AND p_action = 'approve' THEN                                                      -- already approved: the same post
    RETURN jsonb_build_object('petition_id', t.id, 'status', t.status,
      'post_id', (SELECT id FROM public.posts WHERE petition_id = t.id ORDER BY created_at LIMIT 1), 'changed', false);
  END IF;
  IF t.status <> 'draft' THEN
    RAISE EXCEPTION 'petition_not_draft' USING ERRCODE = 'PT409', DETAIL = jsonb_build_object('status', t.status)::text; END IF;
  IF p_action = 'approve' THEN
    IF t.created_by IS NULL THEN RAISE EXCEPTION 'petition_creator_missing' USING ERRCODE = 'PT409'; END IF;   -- a feed post needs an author
    UPDATE public.petitions SET status = 'approved' WHERE id = t.id;
    INSERT INTO public.posts (user_id, content, post_type, petition_id) VALUES (t.created_by, t.title, 'petition', t.id)
    RETURNING id INTO v_post;
  ELSE
    UPDATE public.petitions SET status = 'rejected' WHERE id = t.id;
  END IF;
  PERFORM public.record_admin_action(v_uid, 'petition.' || p_action, 'petition', t.id::text, 'ok', v_reason,
    jsonb_build_object('created_by', t.created_by, 'post_id', v_post, 'body_version_hash', t.body_version_hash), public.request_id());
  RETURN jsonb_build_object('petition_id', t.id, 'status', CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
                            'post_id', v_post, 'changed', true);
END $$;

-- an update note: the creator only, approved petitions only; the petitions row is read, never written
CREATE FUNCTION public.add_petition_update(p_petition_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); t public.petitions%ROWTYPE; v_body text := btrim(p_body); v_id bigint; v_at timestamptz;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501'; END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF v_body IS NULL OR char_length(v_body) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'petition_field_invalid:body' USING ERRCODE = '22023'; END IF;
  SELECT * INTO t FROM public.petitions WHERE id = p_petition_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'petition_not_found' USING ERRCODE = 'PT404'; END IF;
  IF t.created_by IS NULL OR t.created_by <> v_uid THEN RAISE EXCEPTION 'not_petition_creator' USING ERRCODE = '42501'; END IF;
  IF t.status <> 'approved' THEN
    RAISE EXCEPTION 'petition_not_approved' USING ERRCODE = 'PT409', DETAIL = jsonb_build_object('status', t.status)::text; END IF;
  INSERT INTO public.petition_updates (petition_id, body, author_role, created_by) VALUES (t.id, v_body, 'creator', v_uid)
  RETURNING id, created_at INTO v_id, v_at;
  RETURN jsonb_build_object('update_id', v_id, 'petition_id', t.id, 'created_at', v_at, 'body_version_hash', t.body_version_hash);
END $$;

-- ============================================================================
-- 7. Grants, then the posts publication restatement
-- ============================================================================
-- (A) alerts: every write is an RPC (no write policy ever existed); the verifying moderator's id leaves the client
-- surface; the new non-identity columns join the column grants. created_by was never granted.
REVOKE INSERT, UPDATE, DELETE ON public.safety_alerts, public.safety_alert_votes FROM PUBLIC, anon, authenticated;
REVOKE SELECT (verified_by) ON public.safety_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT (version, updated_at, update_count, resolved_at, resolved_by_role) ON public.safety_alerts TO anon, authenticated;
REVOKE ALL ON public.safety_alert_updates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.safety_alert_updates TO service_role;

-- (B, C, E, F) the seven new posts columns are public wherever the post is
GRANT SELECT (labels, comments_locked_at, comments_locked_reason, comments_locked_by_role, closed_at, closed_reason, pinned_until)
  ON public.posts TO anon, authenticated;
-- label records: the public part only (no actor ids, no reason text)
REVOKE ALL ON public.post_labels FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.post_labels TO service_role;
GRANT SELECT (id, post_id, label, post_version, source_role, applied_at, retracted_at) ON public.post_labels TO anon, authenticated;

-- (E) opt-ins: no INSERT policy ever existed (opt_in_to_post is the only writer). The seeker's own DELETE stays
-- (policy opt_ins_delete, authenticated) and now returns the slot; anon never had a policy and loses the bit.
-- UPDATE (status) + policy opt_ins_update stay until 20261026700000 (the deployed client decides opt-ins with a
-- direct UPDATE).
REVOKE INSERT ON public.resource_opt_ins FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON public.resource_opt_ins FROM PUBLIC, anon;
REVOKE ALL ON public.resource_opt_in_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.resource_opt_in_events TO service_role;
GRANT SELECT (id, opt_in_id, post_id, seeker_id, event, from_status, to_status, actor_role, created_at)
  ON public.resource_opt_in_events TO authenticated;

-- (G) petitions: a draft carries only what the composer sends; every column a later rule reads is the server's.
-- INSERT (body_version_hash) stays until 20261026700000 (the deployed composer sends it; the trigger overwrites it).
REVOKE INSERT, UPDATE, DELETE ON public.petitions FROM PUBLIC, anon, authenticated;
GRANT INSERT (created_by, status, title, summary, body, body_version_hash) ON public.petitions TO authenticated;
REVOKE ALL ON public.petition_updates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.petition_updates TO service_role;
GRANT SELECT (id, petition_id, body, author_role, created_at) ON public.petition_updates TO anon, authenticated;

REVOKE ALL ON SEQUENCE public.safety_alert_updates_id_seq, public.post_labels_id_seq, public.resource_opt_in_events_id_seq,
  public.petition_updates_id_seq FROM PUBLIC, anon, authenticated;

DO $grants$
DECLARE f text;
BEGIN
  -- member RPCs (each refuses guests itself)
  FOREACH f IN ARRAY ARRAY[
    'place_safety_alert(text,integer,text,double precision,double precision)',
    'update_safety_alert(uuid,text,integer,text,double precision,double precision,integer,text)',
    'resolve_safety_alert(uuid,integer,text)', 'delete_safety_alert(uuid)', 'vote_safety_alert(uuid,text)',
    'admin_verify_safety_alert(uuid,integer)', 'admin_remove_safety_alert(uuid,text,integer)',
    'admin_set_post_label(uuid,text,boolean,integer,text,text,uuid)', 'set_own_post_label(uuid,text,boolean,integer)',
    'admin_set_comments_locked(uuid,boolean,integer,text,text)',
    'submit_content_report(text,uuid,public.report_reason,text)', 'admin_resolve_report(uuid,text,integer)',
    'admin_set_comment_hidden(uuid,boolean,text)',
    'set_post_closed(uuid,boolean,integer,text)', 'opt_in_to_post(uuid)', 'withdraw_opt_in(uuid)', 'unblock_opt_in(uuid)',
    'decide_opt_in(uuid,text,text)',
    'admin_set_post_pinned(uuid,boolean,integer,timestamptz,text)',
    'admin_review_petition(uuid,text,text)', 'add_petition_update(uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  -- readers a logged-out visitor uses by design
  FOREACH f IN ARRAY ARRAY[
    'safety_alerts_in_view(double precision,double precision,double precision,double precision,uuid,boolean,integer)',
    'safety_alert_history(uuid)',
    'ranked_feed_v2(double precision,double precision,integer,real,uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', f);
  END LOOP;
  -- internal helpers and trigger functions: no client EXECUTE
  FOREACH f IN ARRAY ARRAY[
    'safety_alert_ttl(integer)', 'safety_alert_shown_state(text,timestamptz,timestamptz,timestamptz)',
    'safety_alert_public(public.safety_alerts)', 'safety_alert_require_member()',
    'safety_alert_append(public.safety_alerts,text,integer,text[],text,uuid,text,text,timestamptz)',
    'safety_alert_updates_append_only()', 'post_labels_append_only()', 'post_labels_sync()', 'posts_label_review_on_edit()',
    'lock_post_for_engagement()', 'resource_opt_ins_return_slot()', 'resource_opt_ins_audit()',
    'resource_opt_in_events_append_only()', 'petition_text_hash(text)', 'petitions_guard()', 'petition_signatures_bind()',
    'petition_updates_append_only()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END
$grants$;

-- Realtime: ONE restatement of the posts column list for the whole release (labels, comment lock, closed status,
-- pin expiry). DROP TABLE + ADD TABLE of posts only: SET TABLE would replace every member.
ALTER PUBLICATION supabase_realtime DROP TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts (id, user_id, content, image_url, is_pinned, is_hidden,
  created_at, updated_at, resource_id, max_seekers, slots_remaining, post_type, petition_id, hidden_at, hidden_reason,
  metadata, like_count, comment_count, version, edited_at, edit_count, image_alt, deleted_at, needs_review_at,
  labels, comments_locked_at, comments_locked_reason, comments_locked_by_role, closed_at, closed_reason, pinned_until);

-- ============================================================================
-- 8. RLS (last)
-- ============================================================================
-- safety_alerts: unchanged (status = 'live'): a resolved alert is served by safety_alerts_in_view only, so no
-- reader that was not updated can show one as an active hazard.
-- alert history: no client reads the table (no grant); safety_alert_history is the reader. The policy states it.
CREATE POLICY safety_alert_updates_no_client_read ON public.safety_alert_updates FOR SELECT TO anon, authenticated
  USING (false);

-- label records: the active ones wherever the post is readable; staff read the retracted ones too
CREATE POLICY post_labels_select_public ON public.post_labels FOR SELECT TO anon, authenticated
  USING (retracted_at IS NULL AND public.post_is_readable(post_id));
CREATE POLICY post_labels_select_staff ON public.post_labels FOR SELECT TO authenticated
  USING ((SELECT public.current_user_tier_at_least('community_moderator')));

-- the opt-in trail: its two parties and platform admins; nobody writes it
CREATE POLICY resource_opt_in_events_select_parties ON public.resource_opt_in_events FOR SELECT TO authenticated
  USING (seeker_id = (SELECT auth.uid())
         OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = (SELECT auth.uid()))
         OR (SELECT public.is_current_user_admin()));

-- petitions: staff see drafts awaiting a decision; the creator keeps seeing their own draft or rejected petition
CREATE POLICY petitions_select_staff ON public.petitions FOR SELECT TO authenticated
  USING ((SELECT public.current_user_tier_at_least('community_moderator')));
DROP POLICY petitions_select_own_drafts ON public.petitions;
CREATE POLICY petitions_select_own ON public.petitions FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()) AND status IN ('draft', 'rejected'));
-- update notes: readable with the approved petition they belong to
CREATE POLICY petition_updates_select_approved ON public.petition_updates FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.petitions p WHERE p.id = petition_id AND p.status = 'approved'));

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261026600000', 'r3_foundation');

COMMIT;
