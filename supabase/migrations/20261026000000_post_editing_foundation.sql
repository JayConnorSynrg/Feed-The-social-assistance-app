-- 20261026000000_post_editing_foundation.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: members edit and delete their own posts and comments; everyone sees "Edited" and the
-- public edit history (roles, never names); concurrent edits cannot overwrite each other; nobody
-- rewrites someone else's text (moderators hide / hold / remove; platform admins redact private
-- details from history). Contract: specs/post-editing-contract.md. Model: specs/post-editing-model.md.
--
-- What this migration does
--   (a) posts gain edit metadata: version (optimistic-concurrency token, starts at 1, +1 on every
--       content edit and on nothing else), edited_at / edit_count (the public "Edited" marker; a
--       quiet edit inside the grace window leaves both untouched), image_alt, deleted_at (soft
--       delete), needs_review_at (an author edited a held / community-hidden post; moderation
--       re-queue). post_comments gain version / edited_at / edit_count. content_reports gain
--       reported_version (the version the reporter saw).
--   (b) post_revisions / post_comment_revisions: append-only snapshots of the superseded version,
--       readable exactly by whoever can read the parent (security-invoker helpers in RLS).
--       Redaction (author, or platform admin with a reason + audit row) blanks the text and keeps
--       who/when; an author cannot redact a revision an open report points at.
--   (c) create_post writes posts (and their polls, atomically). EXPAND/CONTRACT: this migration keeps
--       the existing client INSERT grants on posts and polls so the deployed client keeps posting
--       between this apply and the client deploy; 20261026500000_post_editing_contract.sql revokes them
--       after the client deploys (until then the forged-insert hole stays open). image_url must be an
--       existing object in the post-images bucket under the author's own folder. posts.lang = the
--       author's app language at posting (one of the 14 app locales, else NULL; share previews use
--       it); set once by create_post, never edited.
--   (d) edit_post: author only, p_expected_version -> SQLSTATE PT409 (HTTP 409) with
--       DETAIL {"current_version":n,"edited_at":...}; a per-type whitelist for every post type;
--       grace = first 5 minutes before anyone engaged (posts.engaged_at: set once by the first like,
--       vote, comment or opt-in, never cleared; an unlike / unvote / withdraw / comment delete or hide
--       does not reopen it); capacity reconcile; poll locks; venue time
--       zone for member events (every problem reported at once in DETAIL; legacy zone-less rows are
--       untouched until their first edit); a held / community-hidden post stays hidden and is re-queued; a
--       removed post is refused; a petition post is refused.
--   (e) delete_own_post (soft): the post leaves the feed for everyone but staff; opt-ins, comments,
--       votes and history stay; it takes no new comments, votes, opt-ins or reports.
--   (f) Comments: edit_comment (author, version token, grace = 5 min with no replies, history),
--       delete_own_comment (soft: the row and every reply stay, the text is removed, deleted_at shows
--       "deleted"), admin_set_comment_hidden (community moderator+, audited); client UPDATE and DELETE
--       on comments revoked (post_id / parent_id / user_id can no longer be re-pointed); a hard delete
--       (account deletion) re-roots replies instead of deleting them (parent FK ON DELETE SET NULL);
--       comments of a post readable only while the post is readable. Comment INSERT is column-scoped
--       (id, post_id, user_id, content, parent_id): created_at / version / edit counters are not forgeable.
--       Post and comment read policies are split anon / authenticated and find staff through
--       current_user_tier_at_least, not a direct profiles.is_staff read; so do guard_post_comments_is_hidden and
--       content_reports_select_own_or_staff (no caller-side profiles read remains on these tables).
--   (f1) Counters: comment_count counts only comments that are neither deleted nor hidden; comment_count
--       and like_count are recounted after taking the post row lock (the old recount lost one of two
--       concurrent changes); submit_content_report locks the post before counting open reports.
--       posts.engaged_at (server-only) marks the first engagement. Backfills for all three. Lock order on
--       every engagement path: the post row first, then profiles (no like / comment / vote deadlock).
--   (f2) Engagement on hidden posts: likes, comments (and replies) and poll votes are refused on any
--       hidden (held, removed, community-hidden or deleted) post, for everyone, like opt-ins.
--   (g) Moderation integrity: no one lifts or clears moderation on their own content (authorize, resolving a
--       report, unhiding a comment: 42501 self_moderation_refused; hold / remove / hide stay allowed); reports snapshot the version; admin_hold / remove / authorize /
--       resolve_report take an OPTIONAL p_expected_version (NULL = legacy caller, accepted); a
--       dismissal lifts only a community_reports_threshold hide; publishing an author's edit
--       that no moderator has seen needs the version, and only a versioned decision clears the
--       review flag (needs_review_at).
--   (h) ranked_feed_v2 never ranks a deleted post; opt_in_to_post refuses hidden posts; ranked_feed
--       (v1, 0 app callers; PostgREST calls 41 = smoke runs, unchanged 2026-10-08 -> 10-09) is dropped.
--   (i) Realtime: posts' column list gains the six new columns (DROP + ADD of posts only; every other
--       member and column list unchanged).
-- No HTML unescape pass: production holds 0 escaped rows (probe 2026-10-09).
--
-- Migration order (5-step): (1) no extensions; (2) columns + constraints on existing tables;
-- (3) new dependent tables (revisions); (4) functions, grants, publication; (5) RLS last.
-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- 2. Columns + constraints on existing tables
-- ============================================================================
-- No like, vote or opt-in lands under the old triggers while this runs, so the backfills in 4d see every
-- row (taken before posts: a like in flight finishes first instead of deadlocking against us).
LOCK TABLE public.post_likes, public.poll_votes, public.resource_opt_ins IN SHARE MODE;
ALTER TABLE public.posts
  ADD COLUMN version         integer NOT NULL DEFAULT 1,
  ADD COLUMN edited_at       timestamptz,
  ADD COLUMN edit_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN image_alt       text,
  ADD COLUMN deleted_at      timestamptz,
  ADD COLUMN needs_review_at timestamptz,
  ADD COLUMN lang            text,
  ADD COLUMN engaged_at      timestamptz;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_lang_check CHECK (lang IS NULL OR lang IN ('en', 'es', 'ht', 'vi', 'ar', 'zh', 'so', 'fr', 'pt', 'ru', 'ko', 'tl', 'am', 'hmn')),
  ADD CONSTRAINT posts_version_check CHECK (version >= 1 AND edit_count >= 0 AND edit_count < version),
  ADD CONSTRAINT posts_image_alt_check CHECK (image_alt IS NULL OR (image_url IS NOT NULL AND char_length(image_alt) <= 1000)),
  ADD CONSTRAINT posts_deleted_is_hidden CHECK (deleted_at IS NULL OR is_hidden);
ALTER TABLE public.posts DROP CONSTRAINT posts_hidden_reason_check,
  ADD CONSTRAINT posts_hidden_reason_check CHECK (hidden_reason IS NULL OR hidden_reason IN
    ('community_reports_threshold', 'admin_removal', 'hold_for_review', 'author_deleted'));

ALTER TABLE public.post_comments
  ADD COLUMN version    integer NOT NULL DEFAULT 1,
  ADD COLUMN edited_at  timestamptz,
  ADD COLUMN edit_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.post_comments ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_version_check CHECK (version >= 1 AND edit_count >= 0 AND edit_count < version),
  ADD CONSTRAINT post_comments_deleted_shape CHECK (deleted_at IS NULL OR content = '');
-- a hard delete (account deletion cascade) keeps other people's replies: they lose their parent link only
ALTER TABLE public.post_comments DROP CONSTRAINT post_comments_parent_id_fkey,
  ADD CONSTRAINT post_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.post_comments(id) ON DELETE SET NULL;

ALTER TABLE public.content_reports ADD COLUMN reported_version integer;

COMMENT ON COLUMN public.posts.version IS 'Optimistic-concurrency token: 1 at creation, +1 on every content edit (edit_post), never on likes/comments/opt-ins/moderation.';
COMMENT ON COLUMN public.posts.edited_at IS 'Last recorded (non-grace) edit; NULL = never shown as Edited.';
COMMENT ON COLUMN public.posts.deleted_at IS 'Soft delete by the author (delete_own_post); implies is_hidden.';
COMMENT ON COLUMN public.posts.lang IS 'The author''s app language when posting (lib/i18n.ts Locale; NULL = unknown). Set by create_post, never edited; share previews use it.';
COMMENT ON COLUMN public.posts.engaged_at IS 'First like, poll vote, comment or opt-in (set once by triggers, never cleared: an unlike, unvote, withdrawn opt-in, comment delete or hide keeps it). Ends the quiet-edit grace. Server-only: no client grant.';
COMMENT ON COLUMN public.posts.needs_review_at IS 'The author edited this held / community-hidden post at this time; cleared by any moderation decision.';
COMMENT ON COLUMN public.post_comments.deleted_at IS 'Soft delete by the author (delete_own_comment): content is emptied, the row and its replies stay.';
COMMENT ON COLUMN public.content_reports.reported_version IS 'posts.version the reporter saw (NULL = filed before 20261026000000).';

-- ============================================================================
-- 3. Dependent tables: append-only edit histories
-- ============================================================================
CREATE TABLE public.post_revisions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id        uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  version        integer NOT NULL,                   -- the version this snapshot WAS (superseded by version + 1)
  edited_at      timestamptz NOT NULL DEFAULT now(), -- when it was superseded
  reason         text CHECK (char_length(reason) <= 500),
  fields_changed text[],
  snapshot       jsonb,                              -- content, metadata, image_url, image_alt, max_seekers[, poll]
  redacted_at    timestamptz,
  redactor_role  text CHECK (redactor_role IN ('author', 'platform_admin')),
  CONSTRAINT post_revisions_post_version_key UNIQUE (post_id, version),
  CONSTRAINT post_revisions_redaction_shape CHECK (
    (redacted_at IS NULL) = (redactor_role IS NULL)
    AND (redacted_at IS NULL) = (snapshot IS NOT NULL)
    AND (redacted_at IS NULL OR (reason IS NULL AND fields_changed IS NULL)))
);
COMMENT ON TABLE public.post_revisions IS 'Append-only history of posts: one row per recorded (non-grace) edit, holding the superseded version. Readable exactly when the post is readable. Written only by edit_post; the only update is redaction.';

CREATE TABLE public.post_comment_revisions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id    uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  version       integer NOT NULL,                    -- the comment version this text WAS
  edited_at     timestamptz NOT NULL DEFAULT now(),
  content       text,
  redacted_at   timestamptz,
  redactor_role text CHECK (redactor_role IN ('author', 'platform_admin')),
  CONSTRAINT post_comment_revisions_comment_version_key UNIQUE (comment_id, version),
  CONSTRAINT post_comment_revisions_redaction_shape CHECK (
    (redacted_at IS NULL) = (redactor_role IS NULL) AND (redacted_at IS NULL) = (content IS NOT NULL))
);
COMMENT ON TABLE public.post_comment_revisions IS 'Append-only history of comments (superseded text per recorded edit). Readable exactly when the comment is readable. Written only by edit_comment; the only update is redaction.';

-- ============================================================================
-- 4a. Internal helpers (not client-executable unless a policy needs them)
-- ============================================================================

-- Append-only guard for both history tables: UPDATE only as a redaction; DELETE only when the parent
-- row is already gone (ON DELETE CASCADE from a hard-deleted post / comment / account).
CREATE FUNCTION public.post_revisions_append_only()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_redactable constant text[] := ARRAY['snapshot', 'reason', 'fields_changed', 'content', 'redacted_at', 'redactor_role'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'post_revisions' THEN
      IF EXISTS (SELECT 1 FROM public.posts WHERE id = (to_jsonb(OLD) ->> 'post_id')::uuid) THEN
        RAISE EXCEPTION 'revisions_append_only' USING ERRCODE = '42501';
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.post_comments WHERE id = (to_jsonb(OLD) ->> 'comment_id')::uuid) THEN
      RAISE EXCEPTION 'revisions_append_only' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.redacted_at IS NULL AND NEW.redacted_at IS NOT NULL
     AND (to_jsonb(NEW) - c_redactable) = (to_jsonb(OLD) - c_redactable) THEN
    RETURN NEW;  -- the one allowed transition: redaction (the CHECK fixes its shape)
  END IF;
  RAISE EXCEPTION 'revisions_append_only' USING ERRCODE = '42501';
END $fn$;
CREATE TRIGGER trg_post_revisions_append_only BEFORE UPDATE OR DELETE ON public.post_revisions
  FOR EACH ROW EXECUTE FUNCTION public.post_revisions_append_only();
CREATE TRIGGER trg_post_comment_revisions_append_only BEFORE UPDATE OR DELETE ON public.post_comment_revisions
  FOR EACH ROW EXECUTE FUNCTION public.post_revisions_append_only();

-- Visibility helpers for RLS. SECURITY INVOKER: the caller's own RLS + column grants apply inside.
-- The SET clause keeps the planner from inlining them, so each check is one primary-key probe.
CREATE FUNCTION public.post_is_readable(p_post_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) $fn$;
CREATE FUNCTION public.comment_is_readable(p_comment_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.post_comments WHERE id = p_comment_id) $fn$;
-- A poll takes votes while its post is visible (not held / removed / community-hidden / deleted) and
-- the poll has not ended.
CREATE FUNCTION public.poll_is_open(p_poll_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.polls pl JOIN public.posts p ON p.id = pl.post_id
                 WHERE pl.id = p_poll_id AND NOT p.is_hidden AND p.deleted_at IS NULL
                   AND (pl.ends_at IS NULL OR pl.ends_at > now()))
$fn$;
-- A post takes new likes and comments while it is visible (same rule as opt-ins: no engagement on a
-- hidden or deleted post, its author and staff included).
CREATE FUNCTION public.post_accepts_engagement(p_post_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id AND NOT is_hidden) $fn$;

-- image_url: the post-images bucket, the author's own folder, a uuid object name, an object that exists.
CREATE FUNCTION public.post_image_url_ok(p_url text, p_author uuid)
  RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT p_url ~ ('^(https://ndtpovonpadugthmcntl\.supabase\.co|http://(127\.0\.0\.1|localhost):54321)'
                  || '/storage/v1/object/public/post-images/' || p_author::text
                  || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
     AND EXISTS (SELECT 1 FROM storage.objects o
                 WHERE o.bucket_id = 'post-images' AND o.name = substring(p_url FROM '/post-images/(.*)$'))
$fn$;

-- Per-type field whitelist + validation + normalisation, shared by create_post and edit_post.
-- Raises 22023 'post_field_not_editable:<key>' / 'post_field_invalid:<key>'.
CREATE FUNCTION public.post_normalize_fields(p_type public.post_type, p_author uuid, p_fields jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_allowed text[] := CASE p_type
    WHEN 'feed'           THEN ARRAY['content', 'image_url', 'image_alt', 'max_seekers']
    WHEN 'seeker_request' THEN ARRAY['content', 'categories', 'max_seekers']
    WHEN 'source_offer'   THEN ARRAY['content', 'categories', 'max_seekers']
    WHEN 'event_post'     THEN ARRAY['content', 'starts_at', 'ends_at', 'location', 'is_online', 'time_zone']
    WHEN 'poll'           THEN ARRAY['content', 'options', 'ends_at']
    WHEN 'resource_post'  THEN ARRAY['content']
    ELSE ARRAY[]::text[] END;
  c_local    constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?$';
  c_instant  constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)$';
  -- Zones the production tz database converts differently from browsers (lib/event-time.ts SERVER_UNSUPPORTED_ZONES).
  c_bad_zone constant text[] := ARRAY['America/Asuncion', 'America/Coyhaique'];
  k text; v jsonb; s text; t timestamptz; r jsonb := '{}'::jsonb;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN
    RAISE EXCEPTION 'post_fields_not_object' USING ERRCODE = '22023';
  END IF;
  FOR k, v IN SELECT * FROM jsonb_each(p_fields) LOOP
    IF NOT (k = ANY (c_allowed)) THEN
      RAISE EXCEPTION 'post_field_not_editable:%', k USING ERRCODE = '22023';
    END IF;
    s := CASE WHEN jsonb_typeof(v) = 'string' THEN btrim(v #>> '{}') END;
    IF k = 'content' THEN
      IF s IS NULL OR char_length(s) NOT BETWEEN 1 AND 5000
         OR (p_type = 'poll' AND char_length(s) NOT BETWEEN 3 AND 300) THEN
        RAISE EXCEPTION 'post_field_invalid:content' USING ERRCODE = '22023';
      END IF;
      r := r || jsonb_build_object(k, s);
    ELSIF k = 'image_url' THEN
      IF jsonb_typeof(v) = 'null' THEN
        r := r || '{"image_url": null}';
      ELSIF s IS NULL OR NOT public.post_image_url_ok(s, p_author) THEN
        RAISE EXCEPTION 'post_field_invalid:image_url' USING ERRCODE = '22023';
      ELSE
        r := r || jsonb_build_object(k, s);
      END IF;
    ELSIF k = 'image_alt' THEN
      IF jsonb_typeof(v) = 'null' OR s = '' THEN
        r := r || '{"image_alt": null}';
      ELSIF s IS NULL OR char_length(s) > 1000 THEN
        RAISE EXCEPTION 'post_field_invalid:image_alt' USING ERRCODE = '22023';
      ELSE
        r := r || jsonb_build_object(k, s);
      END IF;
    ELSIF k = 'max_seekers' THEN
      IF jsonb_typeof(v) = 'null' THEN
        r := r || '{"max_seekers": null}';
      ELSIF jsonb_typeof(v) <> 'number' OR (v #>> '{}') !~ '^[0-9]+$' OR (v #>> '{}')::numeric NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'post_field_invalid:max_seekers' USING ERRCODE = '22023';
      ELSE
        r := r || jsonb_build_object(k, (v #>> '{}')::integer);
      END IF;
    ELSIF k = 'categories' THEN
      IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) > 10
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(v) e
                    WHERE jsonb_typeof(e) <> 'string' OR char_length(btrim(e #>> '{}')) NOT BETWEEN 1 AND 40) THEN
        RAISE EXCEPTION 'post_field_invalid:categories' USING ERRCODE = '22023';
      END IF;
      r := r || jsonb_build_object(k, (SELECT COALESCE(jsonb_agg(btrim(e #>> '{}')), '[]'::jsonb) FROM jsonb_array_elements(v) e));
    ELSIF k IN ('starts_at', 'ends_at') AND p_type = 'event_post' THEN
      -- venue-local wall-clock time 'YYYY-MM-DDTHH:MM', interpreted in metadata.time_zone
      IF k = 'ends_at' AND jsonb_typeof(v) = 'null' THEN
        r := r || '{"ends_at": null}';
      ELSIF s IS NULL OR s !~ c_local THEN
        RAISE EXCEPTION 'post_field_invalid:%', k USING ERRCODE = '22023';
      ELSE
        BEGIN
          PERFORM s::timestamp;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'post_field_invalid:%', k USING ERRCODE = '22023';
        END;
        r := r || jsonb_build_object(k, s);
      END IF;
    ELSIF k = 'ends_at' AND p_type = 'poll' THEN
      -- an instant with an offset, or "now" (close the poll now); NULL = no deadline
      IF jsonb_typeof(v) = 'null' THEN
        r := r || '{"ends_at": null}';
      ELSIF s = 'now' THEN
        r := r || jsonb_build_object(k, now());
      ELSIF s IS NULL OR s !~ c_instant THEN
        RAISE EXCEPTION 'post_field_invalid:ends_at' USING ERRCODE = '22023';
      ELSE
        BEGIN
          t := s::timestamptz;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'post_field_invalid:ends_at' USING ERRCODE = '22023';
        END;
        r := r || jsonb_build_object(k, t);
      END IF;
    ELSIF k = 'location' THEN
      IF jsonb_typeof(v) = 'null' OR s = '' THEN
        r := r || '{"location": null}';
      ELSIF s IS NULL OR char_length(s) > 200 THEN
        RAISE EXCEPTION 'post_field_invalid:location' USING ERRCODE = '22023';
      ELSE
        r := r || jsonb_build_object(k, s);
      END IF;
    ELSIF k = 'is_online' THEN
      IF jsonb_typeof(v) <> 'boolean' THEN
        RAISE EXCEPTION 'post_field_invalid:is_online' USING ERRCODE = '22023';
      END IF;
      r := r || jsonb_build_object(k, v);
    ELSIF k = 'time_zone' THEN
      IF s IS NULL OR s !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$' OR s = ANY (c_bad_zone)
         OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = s) THEN
        RAISE EXCEPTION 'post_field_invalid:time_zone' USING ERRCODE = '22023';
      END IF;
      r := r || jsonb_build_object(k, s);
    ELSIF k = 'options' THEN
      IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) NOT BETWEEN 2 AND 10
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(v) e
                    WHERE jsonb_typeof(e) <> 'string' OR char_length(btrim(e #>> '{}')) NOT BETWEEN 1 AND 100)
         OR (SELECT count(DISTINCT lower(btrim(e #>> '{}'))) FROM jsonb_array_elements(v) e) <> jsonb_array_length(v) THEN
        RAISE EXCEPTION 'post_field_invalid:options' USING ERRCODE = '22023';
      END IF;
      r := r || jsonb_build_object(k, (SELECT jsonb_agg(btrim(e #>> '{}')) FROM jsonb_array_elements(v) e));
    END IF;
  END LOOP;
  RETURN r;
END $fn$;

-- Member event checks on the MERGED metadata (create and every edit). Every problem is reported at
-- once in DETAIL {"problems": {"<field>": "required"|"invalid"|"before_start"}}; the message is the
-- first of starts_at, time_zone, ends_at. A legacy row (no zone, or end before start) is untouched by
-- this migration and must be fixed by the first edit.
CREATE FUNCTION public.post_assert_event(p_meta jsonb)
  RETURNS void
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_local constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?$';
  s text := p_meta ->> 'starts_at'; e text := p_meta ->> 'ends_at'; pr jsonb;
BEGIN
  pr := jsonb_strip_nulls(jsonb_build_object(
    'starts_at', CASE WHEN s IS NULL THEN 'required' WHEN s !~ c_local THEN 'invalid' END,
    'time_zone', CASE WHEN p_meta ->> 'time_zone' IS NULL THEN 'required' END,
    'ends_at',   CASE WHEN e IS NULL THEN NULL WHEN e !~ c_local THEN 'invalid'
                      WHEN s ~ c_local AND e::timestamp <= s::timestamp THEN 'before_start' END));
  IF pr = '{}'::jsonb THEN RETURN; END IF;
  RAISE EXCEPTION '%', CASE
      WHEN pr ? 'starts_at' THEN CASE pr ->> 'starts_at' WHEN 'required' THEN 'post_field_required:starts_at' ELSE 'post_field_invalid:starts_at' END
      WHEN pr ? 'time_zone' THEN 'post_field_required:time_zone'
      ELSE 'post_field_invalid:ends_at' END
    USING ERRCODE = '22023', DETAIL = jsonb_build_object('problems', pr)::text;
END $fn$;

-- Moderation row lock + optimistic check. p_publishes: the action would make the post visible.
-- A legacy caller (p_expected_version NULL) cannot publish an author's edit no moderator has seen.
CREATE FUNCTION public.post_lock_for_moderation(p_post_id uuid, p_expected_version integer, p_publishes boolean)
  RETURNS public.posts
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE p public.posts%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF (p_expected_version IS NOT NULL AND p_expected_version <> p.version)
     OR (p_expected_version IS NULL AND p_publishes AND p.needs_review_at IS NOT NULL) THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', p.version, 'edited_at', p.edited_at,
                                  'needs_review', p.needs_review_at IS NOT NULL)::text;
  END IF;
  RETURN p;
END $fn$;

-- ============================================================================
-- 4b. Author write path: create / edit / delete posts
-- ============================================================================
CREATE FUNCTION public.create_post(p_post_type public.post_type, p_fields jsonb, p_resource_id uuid DEFAULT NULL,
                                   p_lang text DEFAULT NULL)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  f jsonb; v_meta jsonb := NULL; v_id uuid; v_poll_ends timestamptz;
  -- the client's effective locale; anything else (incl. 'other') is stored as NULL
  v_lang text := CASE WHEN lower(btrim(p_lang)) IN ('en', 'es', 'ht', 'vi', 'ar', 'zh', 'so', 'fr', 'pt', 'ru', 'ko', 'tl', 'am', 'hmn') THEN lower(btrim(p_lang)) END;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_post_type IS NULL OR p_post_type IN ('petition', 'resource_post') THEN
    RAISE EXCEPTION 'post_type_not_creatable:%', COALESCE(p_post_type::text, '<null>') USING ERRCODE = '0A000';
  END IF;
  f := public.post_normalize_fields(p_post_type, v_uid, p_fields);
  IF NOT f ? 'content' THEN
    RAISE EXCEPTION 'post_field_required:content' USING ERRCODE = '22023';
  END IF;
  IF p_resource_id IS NOT NULL AND (p_post_type NOT IN ('feed', 'source_offer')
     OR NOT EXISTS (SELECT 1 FROM public.resources WHERE id = p_resource_id AND status = 'approved')) THEN
    RAISE EXCEPTION 'post_field_invalid:resource_id' USING ERRCODE = '22023';
  END IF;
  IF f ->> 'image_alt' IS NOT NULL AND f ->> 'image_url' IS NULL THEN
    RAISE EXCEPTION 'post_field_invalid:image_alt' USING ERRCODE = '22023';
  END IF;

  IF p_post_type IN ('seeker_request', 'source_offer') THEN
    v_meta := jsonb_build_object('categories', COALESCE(f -> 'categories', '[]'::jsonb));
  ELSIF p_post_type = 'event_post' THEN
    PERFORM public.post_assert_event(f);
    v_meta := jsonb_build_object(
      'starts_at', f -> 'starts_at',
      'ends_at',   COALESCE(f -> 'ends_at', 'null'::jsonb),
      'location',  CASE WHEN (f ->> 'is_online')::boolean IS TRUE THEN 'null'::jsonb ELSE COALESCE(f -> 'location', 'null'::jsonb) END,
      'is_online', COALESCE(f -> 'is_online', 'false'::jsonb),
      'time_zone', f -> 'time_zone');
  ELSIF p_post_type = 'poll' THEN
    IF NOT f ? 'options' THEN
      RAISE EXCEPTION 'post_field_required:options' USING ERRCODE = '22023';
    END IF;
    v_poll_ends := (f ->> 'ends_at')::timestamptz;
    IF v_poll_ends IS NOT NULL AND v_poll_ends <= now() THEN
      RAISE EXCEPTION 'post_field_invalid:ends_at' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.posts (user_id, content, post_type, metadata, image_url, image_alt, resource_id, max_seekers, lang)
  VALUES (v_uid, f ->> 'content', p_post_type, v_meta, f ->> 'image_url', f ->> 'image_alt', p_resource_id,
          (f ->> 'max_seekers')::integer, v_lang)
  RETURNING id INTO v_id;
  IF p_post_type = 'poll' THEN
    INSERT INTO public.polls (post_id, question, options, ends_at)
    VALUES (v_id, f ->> 'content', f -> 'options', v_poll_ends);
  END IF;
  RETURN v_id;
END $fn$;
COMMENT ON FUNCTION public.create_post(public.post_type, jsonb, uuid, text) IS
  'The only client writer of posts (+ its polls row, atomically). Fields per type: specs/post-editing-contract.md. Petitions and resource_post are created by their own server paths.';

CREATE FUNCTION public.edit_post(p_post_id uuid, p_expected_version integer, p_changes jsonb, p_reason text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  p public.posts%ROWTYPE;
  v_poll public.polls%ROWTYPE;
  f jsonb; v_meta jsonb; v_changed text[] := '{}';
  v_votes bigint := 0; v_taken bigint; v_slots integer; v_grace boolean; v_rev bigint; v_reason text;
  n_content text; n_image text; n_alt text; n_max integer; n_opts jsonb; n_ends timestamptz;
  v_closed boolean;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'post_field_required:expected_version' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO p FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'post_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF p.user_id <> v_uid THEN
    RAISE EXCEPTION 'not_author' USING ERRCODE = '42501';
  END IF;
  IF p.hidden_reason = 'admin_removal' THEN
    RAISE EXCEPTION 'post_removed' USING ERRCODE = '42501';
  END IF;
  IF p.post_type = 'petition' THEN
    RAISE EXCEPTION 'post_type_not_editable:petition' USING ERRCODE = '0A000';
  END IF;
  IF p_expected_version <> p.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', p.version, 'edited_at', p.edited_at)::text;
  END IF;
  v_reason := NULLIF(btrim(p_reason), '');
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'post_field_invalid:reason' USING ERRCODE = '22023';
  END IF;

  f := public.post_normalize_fields(p.post_type, p.user_id, p_changes);

  n_content := COALESCE(f ->> 'content', p.content);
  n_image   := CASE WHEN f ? 'image_url' THEN f ->> 'image_url' ELSE p.image_url END;
  n_alt     := CASE WHEN f ? 'image_alt' THEN f ->> 'image_alt'
                    WHEN f ? 'image_url' AND f ->> 'image_url' IS NULL THEN NULL
                    ELSE p.image_alt END;
  n_max     := CASE WHEN f ? 'max_seekers' THEN (f ->> 'max_seekers')::integer ELSE p.max_seekers END;
  v_meta    := COALESCE(p.metadata, '{}'::jsonb);
  IF n_alt IS NOT NULL AND n_image IS NULL THEN
    RAISE EXCEPTION 'post_field_invalid:image_alt' USING ERRCODE = '22023';
  END IF;

  IF f ? 'categories' THEN
    v_meta := v_meta || jsonb_build_object('categories', f -> 'categories');
  END IF;

  IF p.post_type = 'event_post' THEN
    -- every edited member event carries its venue time zone (legacy rows gain one on first edit)
    v_meta := v_meta || (f - 'content');
    PERFORM public.post_assert_event(v_meta);
    IF (v_meta ->> 'is_online')::boolean IS TRUE THEN
      v_meta := v_meta || '{"location": null}';
    END IF;
  END IF;

  IF p.post_type = 'poll' THEN
    -- FOR UPDATE on the polls row conflicts with the FOR KEY SHARE a concurrent vote's FK check takes:
    -- a vote and an options edit serialize, and the edit sees every committed vote.
    SELECT * INTO v_poll FROM public.polls WHERE post_id = p.id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'poll_not_found' USING ERRCODE = 'PT404';
    END IF;
    SELECT count(*) INTO v_votes FROM public.poll_votes WHERE poll_id = v_poll.id;
    n_opts := COALESCE(f -> 'options', v_poll.options);
    n_ends := v_poll.ends_at;
    IF v_votes > 0 AND f ? 'content' AND f ->> 'content' IS DISTINCT FROM v_poll.question THEN
      RAISE EXCEPTION 'post_field_locked:content' USING ERRCODE = '22023', HINT = 'The question is locked after the first vote.';
    END IF;
    IF v_votes > 0 AND f ? 'options' AND n_opts IS DISTINCT FROM v_poll.options THEN
      RAISE EXCEPTION 'post_field_locked:options' USING ERRCODE = '22023', HINT = 'Options are locked after the first vote.';
    END IF;
    IF f ? 'ends_at' THEN
      n_ends   := (f ->> 'ends_at')::timestamptz;
      v_closed := v_poll.ends_at IS NOT NULL AND v_poll.ends_at <= v_now;
      IF n_ends IS NOT NULL AND n_ends <= v_now THEN
        n_ends := CASE WHEN v_closed THEN v_poll.ends_at ELSE v_now END;   -- close now (already closed: unchanged)
      ELSIF v_votes > 0 AND (v_closed OR (n_ends IS NOT NULL AND (v_poll.ends_at IS NULL OR n_ends < v_poll.ends_at))) THEN
        RAISE EXCEPTION 'post_field_locked:ends_at' USING ERRCODE = '22023',
          HINT = 'After the first vote a poll can only be extended or closed now.';
      END IF;
    END IF;
  END IF;

  -- capacity reconcile: every opt-in row holds a slot until it is deleted (withdraw / unblock restore it)
  IF n_max IS DISTINCT FROM p.max_seekers THEN
    SELECT count(*) INTO v_taken FROM public.resource_opt_ins WHERE post_id = p.id;
    IF n_max IS NOT NULL AND n_max < v_taken THEN
      RAISE EXCEPTION 'capacity_below_committed' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('committed', v_taken)::text;
    END IF;
    v_slots := CASE WHEN n_max IS NULL THEN NULL ELSE n_max - v_taken END;
  ELSE
    v_slots := p.slots_remaining;
  END IF;

  IF n_content IS DISTINCT FROM p.content     THEN v_changed := array_append(v_changed, 'content');     END IF;
  IF n_image   IS DISTINCT FROM p.image_url   THEN v_changed := array_append(v_changed, 'image_url');   END IF;
  IF n_alt     IS DISTINCT FROM p.image_alt   THEN v_changed := array_append(v_changed, 'image_alt');   END IF;
  IF n_max     IS DISTINCT FROM p.max_seekers THEN v_changed := array_append(v_changed, 'max_seekers'); END IF;
  IF v_meta    IS DISTINCT FROM COALESCE(p.metadata, '{}'::jsonb) THEN v_changed := array_append(v_changed, 'metadata'); END IF;
  IF p.post_type = 'poll' AND (n_opts IS DISTINCT FROM v_poll.options OR n_ends IS DISTINCT FROM v_poll.ends_at) THEN
    v_changed := array_append(v_changed, 'poll');
  END IF;
  IF cardinality(v_changed) = 0 THEN
    RETURN jsonb_build_object('post_id', p.id, 'version', p.version, 'edited_at', p.edited_at,
                              'edit_count', p.edit_count, 'revision_id', NULL, 'grace', false, 'changed', '[]'::jsonb);
  END IF;

  -- grace: the first 5 minutes, while nobody has engaged and the post is visible -> a quiet edit
  v_grace := p.created_at > v_now - interval '5 minutes' AND NOT p.is_hidden
             AND p.engaged_at IS NULL  -- no like, vote or comment ever (an unlike / unvote / delete / hide keeps it set)
             AND NOT EXISTS (SELECT 1 FROM public.resource_opt_ins WHERE post_id = p.id)
             AND NOT EXISTS (SELECT 1 FROM public.content_reports WHERE content_type = 'post' AND content_id = p.id);

  IF NOT v_grace THEN
    INSERT INTO public.post_revisions (post_id, version, edited_at, reason, fields_changed, snapshot)
    VALUES (p.id, p.version, v_now, v_reason, v_changed,
            jsonb_build_object('content', p.content, 'metadata', p.metadata, 'image_url', p.image_url,
                               'image_alt', p.image_alt, 'max_seekers', p.max_seekers)
            || CASE WHEN p.post_type = 'poll' THEN jsonb_build_object('poll', jsonb_build_object(
                 'question', v_poll.question, 'options', v_poll.options, 'ends_at', v_poll.ends_at)) ELSE '{}'::jsonb END)
    RETURNING id INTO v_rev;
  END IF;

  UPDATE public.posts SET
    content         = n_content,
    image_url       = n_image,
    image_alt       = n_alt,
    max_seekers     = n_max,
    slots_remaining = v_slots,
    metadata        = CASE WHEN v_meta = '{}'::jsonb AND p.metadata IS NULL THEN NULL ELSE v_meta END,
    version         = p.version + 1,
    edited_at       = CASE WHEN v_grace THEN p.edited_at ELSE v_now END,
    edit_count      = p.edit_count + CASE WHEN v_grace THEN 0 ELSE 1 END,
    needs_review_at = CASE WHEN p.is_hidden AND p.hidden_reason IN ('hold_for_review', 'community_reports_threshold')
                           THEN v_now ELSE p.needs_review_at END
  WHERE id = p.id;

  IF p.post_type = 'poll' THEN
    UPDATE public.polls SET question = n_content, options = n_opts, ends_at = n_ends WHERE id = v_poll.id;
  END IF;

  RETURN jsonb_build_object('post_id', p.id, 'version', p.version + 1,
    'edited_at', CASE WHEN v_grace THEN p.edited_at ELSE v_now END,
    'edit_count', p.edit_count + CASE WHEN v_grace THEN 0 ELSE 1 END,
    'revision_id', v_rev, 'grace', v_grace, 'changed', to_jsonb(v_changed));
END $fn$;
COMMENT ON FUNCTION public.edit_post(uuid, integer, jsonb, text) IS
  'Author-only content edit with optimistic concurrency (PT409 + DETAIL {"current_version",...}), per-type whitelist, 5-minute pre-engagement grace, history row per recorded edit. specs/post-editing-contract.md.';

CREATE FUNCTION public.delete_own_post(p_post_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); p public.posts%ROWTYPE;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'post_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF p.user_id <> v_uid THEN
    RAISE EXCEPTION 'not_author' USING ERRCODE = '42501';
  END IF;
  -- soft delete: opt-ins, comments, votes and history stay; a moderation reason already set is kept
  UPDATE public.posts
     SET deleted_at = now(), is_hidden = true, hidden_at = COALESCE(hidden_at, now()),
         hidden_reason = COALESCE(hidden_reason, 'author_deleted')
   WHERE id = p.id;
  RETURN jsonb_build_object('post_id', p.id, 'deleted', true);
END $fn$;

-- ============================================================================
-- 4c. History redaction (author, or platform admin with a reason)
-- ============================================================================
CREATE FUNCTION public.redact_post_revision(p_revision_id bigint, p_reason text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); r public.post_revisions%ROWTYPE; v_author uuid; v_role text; v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.post_revisions WHERE id = p_revision_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'revision_not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT user_id INTO v_author FROM public.posts WHERE id = r.post_id;
  IF v_author = v_uid THEN
    v_role := 'author';
  ELSIF public.current_user_tier_at_least('platform_admin') THEN
    v_role := 'platform_admin';
  ELSE
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'platform_admin' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'post_field_invalid:reason' USING ERRCODE = '22023';
  END IF;
  IF r.redacted_at IS NOT NULL THEN
    RETURN jsonb_build_object('revision_id', r.id, 'redacted', true, 'already_redacted', true, 'redactor_role', r.redactor_role);
  END IF;
  -- the reported text is the evidence a moderator reviews: its author cannot erase it while a report is open
  IF v_role = 'author' AND EXISTS (SELECT 1 FROM public.content_reports c
       WHERE c.content_type = 'post' AND c.content_id = r.post_id AND c.status = 'open' AND c.reported_version = r.version) THEN
    RAISE EXCEPTION 'revision_under_report' USING ERRCODE = '42501';
  END IF;
  UPDATE public.post_revisions
     SET snapshot = NULL, reason = NULL, fields_changed = NULL, redacted_at = now(), redactor_role = v_role
   WHERE id = r.id;
  IF v_role = 'platform_admin' THEN
    PERFORM public.record_admin_action(v_uid, 'post_revision.redact', 'post', r.post_id::text, 'ok', v_reason,
      jsonb_build_object('revision_id', r.id, 'version', r.version, 'author_id', v_author), public.request_id());
  END IF;
  RETURN jsonb_build_object('revision_id', r.id, 'redacted', true, 'already_redacted', false, 'redactor_role', v_role);
END $fn$;

CREATE FUNCTION public.redact_comment_revision(p_revision_id bigint, p_reason text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); r public.post_comment_revisions%ROWTYPE; v_author uuid; v_post uuid; v_role text;
        v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.post_comment_revisions WHERE id = p_revision_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'revision_not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT user_id, post_id INTO v_author, v_post FROM public.post_comments WHERE id = r.comment_id;
  IF v_author = v_uid THEN
    v_role := 'author';
  ELSIF public.current_user_tier_at_least('platform_admin') THEN
    v_role := 'platform_admin';
  ELSE
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'platform_admin' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'post_field_invalid:reason' USING ERRCODE = '22023';
  END IF;
  IF r.redacted_at IS NOT NULL THEN
    RETURN jsonb_build_object('revision_id', r.id, 'redacted', true, 'already_redacted', true, 'redactor_role', r.redactor_role);
  END IF;
  UPDATE public.post_comment_revisions
     SET content = NULL, redacted_at = now(), redactor_role = v_role
   WHERE id = r.id;
  IF v_role = 'platform_admin' THEN
    PERFORM public.record_admin_action(v_uid, 'comment_revision.redact', 'comment', r.comment_id::text, 'ok', v_reason,
      jsonb_build_object('revision_id', r.id, 'version', r.version, 'post_id', v_post, 'author_id', v_author), public.request_id());
  END IF;
  RETURN jsonb_build_object('revision_id', r.id, 'redacted', true, 'already_redacted', false, 'redactor_role', v_role);
END $fn$;

-- ============================================================================
-- 4d. Comments
-- ============================================================================
CREATE FUNCTION public.edit_comment(p_comment_id uuid, p_expected_version integer, p_content text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_now timestamptz := now();
  c public.post_comments%ROWTYPE; v_txt text := btrim(p_content); v_grace boolean; v_rev bigint;
  v_post_deleted timestamptz; v_post_reason text;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'comment_field_required:expected_version' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.post_comments WHERE id = p_comment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'comment_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF c.user_id <> v_uid THEN
    RAISE EXCEPTION 'not_author' USING ERRCODE = '42501';
  END IF;
  IF c.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'comment_deleted' USING ERRCODE = 'PT404';
  END IF;
  IF c.is_hidden THEN
    RAISE EXCEPTION 'comment_hidden' USING ERRCODE = '42501';
  END IF;
  SELECT deleted_at, hidden_reason INTO v_post_deleted, v_post_reason FROM public.posts WHERE id = c.post_id;
  IF v_post_deleted IS NOT NULL OR v_post_reason = 'admin_removal' THEN
    RAISE EXCEPTION 'comments_closed' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version <> c.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', c.version, 'edited_at', c.edited_at)::text;
  END IF;
  IF v_txt IS NULL OR char_length(v_txt) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'comment_invalid:content' USING ERRCODE = '22023';
  END IF;
  IF v_txt = c.content THEN
    RETURN jsonb_build_object('comment_id', c.id, 'version', c.version, 'edited_at', c.edited_at,
                              'edit_count', c.edit_count, 'grace', false, 'changed', false);
  END IF;
  v_grace := c.created_at > v_now - interval '5 minutes'
             AND NOT EXISTS (SELECT 1 FROM public.post_comments r WHERE r.parent_id = c.id);
  IF NOT v_grace THEN
    INSERT INTO public.post_comment_revisions (comment_id, version, edited_at, content)
    VALUES (c.id, c.version, v_now, c.content)
    RETURNING id INTO v_rev;
  END IF;
  UPDATE public.post_comments
     SET content    = v_txt,
         version    = c.version + 1,
         edited_at  = CASE WHEN v_grace THEN c.edited_at ELSE v_now END,
         edit_count = c.edit_count + CASE WHEN v_grace THEN 0 ELSE 1 END
   WHERE id = c.id;
  RETURN jsonb_build_object('comment_id', c.id, 'version', c.version + 1,
    'edited_at', CASE WHEN v_grace THEN c.edited_at ELSE v_now END,
    'edit_count', c.edit_count + CASE WHEN v_grace THEN 0 ELSE 1 END,
    'revision_id', v_rev, 'grace', v_grace, 'changed', true);
END $fn$;

-- Soft delete: the row (and so every reply under it) stays; the text is removed; history rules unchanged.
CREATE FUNCTION public.delete_own_comment(p_comment_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); c public.post_comments%ROWTYPE;
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.post_comments WHERE id = p_comment_id FOR UPDATE;
  IF NOT FOUND OR c.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'comment_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF c.user_id <> v_uid THEN
    RAISE EXCEPTION 'not_author' USING ERRCODE = '42501';
  END IF;
  UPDATE public.post_comments SET content = '', deleted_at = now() WHERE id = c.id;
  RETURN jsonb_build_object('comment_id', c.id, 'deleted', true);
END $fn$;

CREATE FUNCTION public.admin_set_comment_hidden(p_comment_id uuid, p_hidden boolean, p_reason text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_post uuid; v_author uuid; v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'guest_refused' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  IF p_hidden IS NULL THEN
    RAISE EXCEPTION 'comment_field_required:hidden' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'post_field_invalid:reason' USING ERRCODE = '22023';
  END IF;
  SELECT post_id, user_id INTO v_post, v_author FROM public.post_comments WHERE id = p_comment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'comment_not_found' USING ERRCODE = 'PT404';
  END IF;
  -- no one unhides their own comment (hiding it stays allowed: it only restricts)
  IF NOT p_hidden AND v_author = auth.uid() THEN
    RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501';
  END IF;
  UPDATE public.post_comments SET is_hidden = p_hidden WHERE id = p_comment_id;
  PERFORM public.record_admin_action(auth.uid(), CASE WHEN p_hidden THEN 'comment.hide' ELSE 'comment.unhide' END,
    'comment', p_comment_id::text, 'ok', v_reason, jsonb_build_object('post_id', v_post, 'author_id', v_author),
    public.request_id());
  RETURN jsonb_build_object('comment_id', p_comment_id, 'is_hidden', p_hidden);
END $fn$;

-- Engagement counters + the first-engagement marker. Every counter below follows one pattern: lock the
-- post row(s) first, then recount in a SEPARATE statement. Under READ COMMITTED every statement takes a
-- fresh snapshot, so the recount sees each change committed by the session that held the lock before
-- us. (The previous bodies recounted inside the locking UPDATE, whose snapshot predates the wait: two
-- sessions changing one post's comments or likes left the number one short or one over.) A recount,
-- unlike a relative +-1, rewrites the true value on every change, so a stale number cannot outlive the
-- next change to its post. posts.engaged_at is set once (COALESCE) by the first like, vote, comment or
-- opt-in, in the same statement / under the same post lock, and never cleared.
-- Lock order: the post row, then profiles. The engagement triggers (engagement_on_post_like / _comment /
-- _poll_vote / _opt_in_insert) lock the engager's and the author's profiles; every insert path below takes
-- the post first (BEFORE INSERT, ahead of the foreign-key check and those AFTER triggers), and opt_in_to_post /
-- withdraw_opt_in / unblock_opt_in lock the post before touching opt-ins. The post lock is FOR NO KEY UPDATE
-- (what an UPDATE of posts takes): it does not conflict with another insert's foreign-key share lock.

-- posts.comment_count = the post's comments that are neither deleted nor hidden (replies included; a
-- deleted parent's "Comment deleted" placeholder is not a comment). Same trigger (AFTER INSERT OR UPDATE
-- OR DELETE on post_comments), new body.
CREATE OR REPLACE FUNCTION public.sync_post_comment_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_posts uuid[];
BEGIN
  -- an edit that leaves the comment on the same post and in the same counted / not-counted state
  IF TG_OP = 'UPDATE' AND NEW.post_id IS NOT DISTINCT FROM OLD.post_id
     AND (NEW.deleted_at IS NULL AND NOT NEW.is_hidden) IS NOT DISTINCT FROM (OLD.deleted_at IS NULL AND NOT OLD.is_hidden) THEN
    RETURN NULL;
  END IF;
  v_posts := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[OLD.post_id, NEW.post_id]) x WHERE x IS NOT NULL ORDER BY x);
  PERFORM 1 FROM public.posts WHERE id = ANY (v_posts) ORDER BY id FOR NO KEY UPDATE;
  UPDATE public.posts p
     SET comment_count = (SELECT count(*) FROM public.post_comments pc
                           WHERE pc.post_id = p.id AND pc.deleted_at IS NULL AND NOT pc.is_hidden),
         engaged_at    = CASE WHEN p.id = NEW.post_id AND NEW.post_id IS DISTINCT FROM OLD.post_id  -- insert, or moved here
                               THEN COALESCE(p.engaged_at, now()) ELSE p.engaged_at END
   WHERE p.id = ANY (v_posts);
  RETURN NULL;
END $fn$;

-- posts.like_count = the post's like rows (unchanged meaning). Same trigger (AFTER INSERT OR UPDATE OR
-- DELETE on post_likes), new body: lock, then recount; the first like sets engaged_at.
CREATE OR REPLACE FUNCTION public.sync_post_like_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_posts uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.post_id IS NOT DISTINCT FROM OLD.post_id THEN
    RETURN NULL;
  END IF;
  v_posts := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[OLD.post_id, NEW.post_id]) x WHERE x IS NOT NULL ORDER BY x);
  PERFORM 1 FROM public.posts WHERE id = ANY (v_posts) ORDER BY id FOR NO KEY UPDATE;
  UPDATE public.posts p
     SET like_count = (SELECT count(*) FROM public.post_likes pl WHERE pl.post_id = p.id),
         engaged_at = CASE WHEN p.id = NEW.post_id AND NEW.post_id IS DISTINCT FROM OLD.post_id  -- insert, or moved here
                            THEN COALESCE(p.engaged_at, now()) ELSE p.engaged_at END
   WHERE p.id = ANY (v_posts);
  RETURN NULL;
END $fn$;

-- likes and comments: lock the post before the engagement triggers lock profiles (lock order above). Without
-- it a like held the post's foreign-key share lock and the author's profile and then waited for the post,
-- while a second like / comment / first vote held the post and waited for the profile: deadlock.
CREATE FUNCTION public.lock_post_for_engagement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM 1 FROM public.posts WHERE id = NEW.post_id FOR NO KEY UPDATE;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_post_likes_lock_post BEFORE INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.lock_post_for_engagement();
CREATE TRIGGER trg_post_comments_lock_post BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.lock_post_for_engagement();

-- poll votes and opt-ins carry no count on posts: the first one sets engaged_at. BEFORE INSERT, so the
-- post row is locked before the row's foreign-key checks lock polls / posts: the same order as edit_post
-- (post, then poll), so a vote and an options edit cannot deadlock. A refused insert rolls this back.
CREATE FUNCTION public.mark_post_engaged()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'poll_votes' THEN
    UPDATE public.posts p SET engaged_at = COALESCE(p.engaged_at, now())
      FROM public.polls pl WHERE pl.id = NEW.poll_id AND p.id = pl.post_id AND p.engaged_at IS NULL;
  ELSE
    UPDATE public.posts p SET engaged_at = COALESCE(p.engaged_at, now())
     WHERE p.id = NEW.post_id AND p.engaged_at IS NULL;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_poll_votes_mark_post_engaged BEFORE INSERT ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.mark_post_engaged();
CREATE TRIGGER trg_resource_opt_ins_mark_post_engaged BEFORE INSERT ON public.resource_opt_ins
  FOR EACH ROW EXECUTE FUNCTION public.mark_post_engaged();

-- One-time backfills (this transaction holds ACCESS EXCLUSIVE on posts and post_comments and SHARE on
-- post_likes and poll_votes from section 2, so nothing changes underneath). Counts: rows whose number
-- changes only. engaged_at: every post with a like, vote, comment or opt-in row, at the earliest such
-- created_at (now() when none of them carries one).
UPDATE public.posts p
   SET comment_count = c.n
  FROM (SELECT p2.id, (SELECT count(*) FROM public.post_comments pc
                        WHERE pc.post_id = p2.id AND pc.deleted_at IS NULL AND NOT pc.is_hidden) AS n
          FROM public.posts p2) c
 WHERE c.id = p.id AND p.comment_count IS DISTINCT FROM c.n;
UPDATE public.posts p
   SET like_count = c.n
  FROM (SELECT p2.id, (SELECT count(*) FROM public.post_likes pl WHERE pl.post_id = p2.id) AS n
          FROM public.posts p2) c
 WHERE c.id = p.id AND p.like_count IS DISTINCT FROM c.n;
UPDATE public.posts p
   SET engaged_at = COALESCE(e.first_at, now())
  FROM (SELECT p2.id,
               LEAST((SELECT min(l.created_at) FROM public.post_likes l WHERE l.post_id = p2.id),
                     (SELECT min(v.created_at) FROM public.poll_votes v JOIN public.polls pl ON pl.id = v.poll_id WHERE pl.post_id = p2.id),
                     (SELECT min(c.created_at) FROM public.post_comments c WHERE c.post_id = p2.id),
                     (SELECT min(o.created_at) FROM public.resource_opt_ins o WHERE o.post_id = p2.id)) AS first_at
          FROM public.posts p2
         WHERE EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = p2.id)
            OR EXISTS (SELECT 1 FROM public.poll_votes v JOIN public.polls pl ON pl.id = v.poll_id WHERE pl.post_id = p2.id)
            OR EXISTS (SELECT 1 FROM public.post_comments c WHERE c.post_id = p2.id)
            OR EXISTS (SELECT 1 FROM public.resource_opt_ins o WHERE o.post_id = p2.id)) e
 WHERE e.id = p.id AND p.engaged_at IS NULL;

-- ============================================================================
-- 4e. Moderation RPCs: + optional p_expected_version (DROP first: a new defaulted argument would
--     otherwise create an overload PostgREST cannot choose between). Grants re-applied below.
-- ============================================================================
DROP FUNCTION public.admin_hold_post(uuid);
DROP FUNCTION public.admin_remove_post(uuid, text);
DROP FUNCTION public.admin_authorize_post(uuid);
DROP FUNCTION public.admin_resolve_report(uuid, text);

CREATE FUNCTION public.admin_hold_post(p_post_id uuid, p_expected_version integer DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE p public.posts%ROWTYPE;
BEGIN
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, false);
  IF p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'post_deleted' USING ERRCODE = 'PT404';
  END IF;

  -- the review flag clears only when the moderator acted on the version they saw
  UPDATE public.posts
  SET is_hidden = true, hidden_at = now(), hidden_reason = 'hold_for_review',
      needs_review_at = CASE WHEN p_expected_version IS NULL THEN needs_review_at END
  WHERE id = p_post_id;

  PERFORM public.record_admin_action(auth.uid(), 'post.hold', 'post', p_post_id::text,
    'ok', 'hold_for_review', jsonb_build_object('author_id', p.user_id, 'version', p.version), public.request_id());

  RETURN '{"success": true}'::jsonb;
END;
$fn$;

CREATE FUNCTION public.admin_remove_post(p_post_id uuid, p_reason text DEFAULT 'admin_removal'::text, p_expected_version integer DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE p public.posts%ROWTYPE;
BEGIN
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, false);

  UPDATE public.posts
  SET is_hidden = true, hidden_at = now(), hidden_reason = 'admin_removal',
      needs_review_at = CASE WHEN p_expected_version IS NULL THEN needs_review_at END
  WHERE id = p_post_id;

  UPDATE public.content_reports
  SET status = 'upheld'
  WHERE content_type = 'post' AND content_id = p_post_id AND status = 'open';

  PERFORM public.record_admin_action(auth.uid(), 'post.remove', 'post', p_post_id::text,
    'ok', p_reason, jsonb_build_object('author_id', p.user_id, 'version', p.version), public.request_id());

  RETURN '{"success": true}'::jsonb;
END;
$fn$;

CREATE FUNCTION public.admin_authorize_post(p_post_id uuid, p_expected_version integer DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE p public.posts%ROWTYPE;
BEGIN
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Anonymous users cannot perform moderation actions' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE = '42501';
  END IF;
  p := public.post_lock_for_moderation(p_post_id, p_expected_version, true);
  IF p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'post_deleted' USING ERRCODE = 'PT404';
  END IF;
  -- no one lifts moderation on their own content (authorize unhides and dismisses every open report)
  IF p.user_id = auth.uid() THEN
    RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501';
  END IF;

  UPDATE public.posts
  SET is_hidden = false, hidden_at = NULL, hidden_reason = NULL, needs_review_at = NULL
  WHERE id = p_post_id;

  UPDATE public.content_reports
  SET status = 'dismissed'
  WHERE content_type = 'post' AND content_id = p_post_id AND status = 'open';

  PERFORM public.record_admin_action(auth.uid(), 'post.authorize', 'post', p_post_id::text,
    'ok', NULL, jsonb_build_object('author_id', p.user_id, 'version', p.version), public.request_id());

  RETURN '{"success": true}'::jsonb;
END;
$fn$;

CREATE FUNCTION public.admin_resolve_report(p_report_id uuid, p_action text, p_expected_version integer DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_content_id   uuid;
  v_content_type text;
  v_open_count   bigint;
  p              public.posts%ROWTYPE;
  v_unhidden     boolean := false;
  v_review_held  boolean := false;
BEGIN
  IF COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.current_user_tier_at_least('community_moderator') THEN
    RAISE EXCEPTION 'p3_denied:insufficient_tier' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('dismiss', 'uphold') THEN
    RAISE EXCEPTION 'action must be dismiss or uphold';
  END IF;

  SELECT content_id, content_type INTO v_content_id, v_content_type
  FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;

  -- lock the reported post (a hard-deleted post leaves nothing to lock; the report still resolves)
  IF v_content_type = 'post' AND EXISTS (SELECT 1 FROM public.posts WHERE id = v_content_id) THEN
    p := public.post_lock_for_moderation(v_content_id, p_expected_version, false);
  END IF;
  -- no one resolves reports on their own content: 'dismiss' clears the report and can lift the community hide;
  -- 'uphold' also takes it out of the open count that submit_content_report's 3-report auto-hide counts
  IF p.user_id = auth.uid() THEN
    RAISE EXCEPTION 'self_moderation_refused' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'uphold' THEN
    UPDATE public.content_reports SET status = 'upheld' WHERE id = p_report_id;
  ELSE
    UPDATE public.content_reports SET status = 'dismissed' WHERE id = p_report_id;
    SELECT count(*) INTO v_open_count
    FROM public.content_reports
    WHERE content_type = v_content_type AND content_id = v_content_id AND status = 'open';
    -- Dismissals lift ONLY the automatic community hide, never a hold, a removal or a deletion;
    -- an author's edit no moderator has seen stays hidden for a legacy (version-less) caller.
    IF v_open_count = 0 AND p.id IS NOT NULL AND p.hidden_reason = 'community_reports_threshold'
       AND p.deleted_at IS NULL THEN
      IF p_expected_version IS NULL AND p.needs_review_at IS NOT NULL THEN
        v_review_held := true;
      ELSE
        UPDATE public.posts SET is_hidden = false, hidden_at = NULL, hidden_reason = NULL, needs_review_at = NULL
        WHERE id = v_content_id;
        v_unhidden := true;
      END IF;
    END IF;
  END IF;

  PERFORM public.record_admin_action(auth.uid(), 'report.resolve', 'report', p_report_id::text,
    'ok', p_action, jsonb_build_object('content_type', v_content_type, 'content_id', v_content_id,
                                       'version', p.version, 'unhidden', v_unhidden), public.request_id());

  RETURN jsonb_build_object('report_id', p_report_id, 'action', p_action, 'unhidden', v_unhidden,
                            'needs_review', v_review_held);
END;
$fn$;

-- ============================================================================
-- 4f. Existing functions: the live body (= the latest repo definition) + one change each
-- ============================================================================

-- guard_post_comments_is_hidden (BEFORE INSERT OR UPDATE on post_comments, SECURITY INVOKER): the live body,
-- except the staff check: current_user_tier_at_least('community_moderator') (SECURITY DEFINER) instead of a
-- caller-side read of profiles.is_staff, so a client REVOKE of that column (Settings C2) cannot stop every
-- comment insert. Nested so anon (no EXECUTE on the tier function) never evaluates it.
CREATE OR REPLACE FUNCTION public.guard_post_comments_is_hidden()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF current_user = 'authenticated' THEN
    IF public.current_user_tier_at_least('community_moderator') THEN
      RETURN NEW;
    END IF;
  END IF;
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.is_hidden, false))
  OR (TG_OP = 'UPDATE' AND NEW.is_hidden IS DISTINCT FROM OLD.is_hidden) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'guard:post_comments_is_hidden: comment visibility is set by moderators only',
      HINT    = 'Only moderators can hide or show comments.';
  END IF;
  RETURN NEW;
END $function$;

-- opt_in_to_post: a hidden post (held, removed, community-hidden or deleted) takes no opt-ins
CREATE OR REPLACE FUNCTION public.opt_in_to_post(p_post_id uuid)
 RETURNS resource_opt_ins
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Hidden (held, removed, community-hidden) or deleted posts take no opt-ins
  IF v_post.is_hidden THEN
    RAISE EXCEPTION 'This post is closed';
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
$function$;

-- submit_content_report: snapshot the version the reporter saw; a deleted post is not reportable; the post
-- row is locked before the open-report count (two concurrent reports cannot both miss the threshold)
CREATE OR REPLACE FUNCTION public.submit_content_report(p_content_type text, p_content_id uuid, p_reason report_reason, p_details text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_reporter    uuid;
  v_report_count bigint;
  v_post_hidden  boolean := false;
  v_post_author  uuid;
  v_post_version integer;
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

  -- Verify the post exists (and is not deleted) and capture author + the version reported. FOR UPDATE:
  -- the open-report count below runs after this lock, so of two concurrent reports the second counts
  -- the first (without it both counted 2 and a post with 3 open reports stayed visible).
  SELECT user_id, version INTO v_post_author, v_post_version
  FROM public.posts
  WHERE id = p_content_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  -- Reject self-reporting
  IF v_post_author = v_reporter THEN
    RAISE EXCEPTION 'you cannot report your own post';
  END IF;

  -- Insert; re-report from same user is silently ignored (ON CONFLICT DO NOTHING)
  INSERT INTO public.content_reports
    (reporter_id, content_type, content_id, reason, details, reported_version)
  VALUES
    (v_reporter, p_content_type, p_content_id, p_reason, p_details, v_post_version)
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
$function$;

-- ranked_feed_v2: a deleted post is never ranked, for any viewer (author and staff included)
CREATE OR REPLACE FUNCTION public.ranked_feed_v2(
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_limit integer DEFAULT 25,
  p_cursor_score real DEFAULT NULL::real,
  p_cursor_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, kind text, score real, distance_bucket text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
      p.is_pinned,
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
      (CASE WHEN b.raw_score < 1e-20 THEN 0.0 ELSE b.raw_score END)::real AS score
    FROM base b
  ),
  posts_ranked AS (
    SELECT
      s.id,
      'post'::text AS kind,
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
    SELECT id, kind, score, distance_bucket FROM posts_ranked
    UNION ALL
    SELECT id, kind, score, distance_bucket FROM events_ranked
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
    p_cursor_score IS NULL
    OR (m.score, m.id) < (p_cursor_score, p_cursor_id)
  ORDER BY m.score DESC, m.id DESC
  LIMIT greatest(coalesce(p_limit, 25), 1);
$function$;

-- Least-privilege EXECUTE (unchanged).
REVOKE EXECUTE ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) IS
  'Ranked community feed = W1.3 posts (deleted posts never ranked; ranked_feed v1 dropped in 20261026000000) UNION ALL one row per event (event_feed_next: per active event of an active organization, its soonest announced — from 00:00 venue time announce_days_before days before its local date — not-ended date that is upcoming, or cancelled for a reason other than retired/org_inactive (then the row id is the cancelled occurrence, listed until it ends); the same for every viewer and the same rows as upcoming_events). Single cross-kind keyset on (score DESC, id DESC). Events: engagement=1; upcoming row score = max(freshness since the date became the shown date [max(announce, previous shown date end, created)] on half_life_hours, proximity |now-starts_at| on event_half_life_hours); cancelled row = proximity only; x quantized distance bucket (no oracle). 20261023000000, 20261026000000.';

-- ranked_feed (v1): 0 app callers since the client moved to v2; dropped with smokes 23 + 29 updated.
DROP FUNCTION public.ranked_feed(double precision, double precision, integer, real, uuid);

-- ============================================================================
-- 4g. Grants
-- ============================================================================
-- posts / polls: client INSERT stays until 20261026500000 (contract) so the deployed client keeps posting
GRANT SELECT (version, edited_at, edit_count, image_alt, lang) ON public.posts TO anon, authenticated;
GRANT SELECT (deleted_at, needs_review_at) ON public.posts TO authenticated;
-- comments: edit_comment / delete_own_comment / admin_set_comment_hidden are the only updaters
-- (post_id cannot be re-pointed; deleting never removes other people's replies). The deployed client
-- never updates or deletes comments, so this needs no expand step.
REVOKE UPDATE, DELETE ON public.post_comments FROM PUBLIC, anon, authenticated;
-- comment INSERT: only the columns a member writes. created_at, version, edit_count, edited_at, deleted_at and
-- is_hidden take their defaults (a forged future created_at kept the comment's quiet-edit grace open for good;
-- a forged version / edit_count / edited_at showed a fake "Edited"). The deployed client (develop 52f6dee) and
-- this branch insert post_id, user_id, content (+ parent_id for a reply) only, so this needs no expand step.
REVOKE INSERT ON public.post_comments FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, post_id, user_id, content, parent_id) ON public.post_comments TO authenticated;

REVOKE ALL ON public.post_revisions, public.post_comment_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.post_revisions, public.post_comment_revisions TO anon, authenticated;
GRANT ALL ON public.post_revisions, public.post_comment_revisions TO service_role;
REVOKE ALL ON SEQUENCE public.post_revisions_id_seq, public.post_comment_revisions_id_seq FROM anon, authenticated;

DO $grants$
DECLARE f text;
BEGIN
  -- client RPCs: signed-in members (each refuses guests itself)
  FOREACH f IN ARRAY ARRAY[
    'create_post(public.post_type,jsonb,uuid,text)', 'edit_post(uuid,integer,jsonb,text)', 'delete_own_post(uuid)',
    'redact_post_revision(bigint,text)', 'redact_comment_revision(bigint,text)',
    'edit_comment(uuid,integer,text)', 'delete_own_comment(uuid)', 'admin_set_comment_hidden(uuid,boolean,text)',
    'admin_hold_post(uuid,integer)', 'admin_remove_post(uuid,text,integer)',
    'admin_authorize_post(uuid,integer)', 'admin_resolve_report(uuid,text,integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  -- RLS helpers: every role a policy applies to must be able to execute them
  FOREACH f IN ARRAY ARRAY['post_is_readable(uuid)', 'comment_is_readable(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['poll_is_open(uuid)', 'post_accepts_engagement(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  -- internal helpers / trigger function: no client EXECUTE
  FOREACH f IN ARRAY ARRAY[
    'post_revisions_append_only()', 'post_image_url_ok(text,uuid)', 'post_normalize_fields(public.post_type,uuid,jsonb)',
    'post_lock_for_moderation(uuid,integer,boolean)', 'post_assert_event(jsonb)', 'sync_post_comment_count()', 'sync_post_like_count()', 'mark_post_engaged()', 'lock_post_for_engagement()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END
$grants$;

-- ============================================================================
-- 4h. Realtime: posts' column list grows by the six new columns. DROP + ADD of posts only
--     (SET TABLE would replace every member). Every other member is untouched.
-- ============================================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts (id, user_id, content, image_url, is_pinned, is_hidden,
  created_at, updated_at, resource_id, max_seekers, slots_remaining, post_type, petition_id, hidden_at, hidden_reason,
  metadata, like_count, comment_count, version, edited_at, edit_count, image_alt, deleted_at, needs_review_at);

-- ============================================================================
-- 5. RLS (last)
-- ============================================================================
ALTER TABLE public.post_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comment_revisions ENABLE ROW LEVEL SECURITY;

-- history is readable exactly when the parent is readable (the parent's RLS applies inside the helper)
CREATE POLICY post_revisions_select_if_post_readable ON public.post_revisions
  FOR SELECT USING (public.post_is_readable(post_id));
CREATE POLICY post_comment_revisions_select_if_comment_readable ON public.post_comment_revisions
  FOR SELECT USING (public.comment_is_readable(comment_id));

-- Read policies: split by role, and staff = current_user_tier_at_least('community_moderator') (SECURITY DEFINER,
-- reads admin_tier) instead of a direct profiles.is_staff read, so a client-role REVOKE of profiles columns
-- (Settings C2) cannot turn post or comment reads into 42501. Equivalent: is_staff is kept equal to
-- (admin_tier IS NOT NULL) by sync_tier_flags_trigger and community_moderator is the lowest tier (prod
-- 2026-10-09: 0 of 23 profiles differ). anon cannot execute the tier function and has no uid: visible rows only.
-- posts: the author no longer sees their own deleted post; staff still do (audit)
ALTER POLICY posts_select_public ON public.posts TO anon USING (NOT is_hidden);
CREATE POLICY posts_select_member ON public.posts FOR SELECT TO authenticated USING (
  (NOT is_hidden)
  OR (user_id = (SELECT auth.uid()) AND deleted_at IS NULL)
  OR (SELECT public.current_user_tier_at_least('community_moderator')));

-- comments: readable only while the post is readable; a hidden comment by its author + staff only;
-- new comments / replies only on a visible post
ALTER POLICY post_comments_select_visible ON public.post_comments TO anon
  USING ((NOT is_hidden) AND public.post_is_readable(post_id));
CREATE POLICY post_comments_select_member ON public.post_comments FOR SELECT TO authenticated USING (
  ((NOT is_hidden) OR user_id = (SELECT auth.uid()) OR (SELECT public.current_user_tier_at_least('community_moderator')))
  AND public.post_is_readable(post_id));

-- content_reports: a member reads their own reports, staff read all (same roles, authenticated; the staff test
-- through the tier helper instead of a caller-side profiles.is_staff read)
ALTER POLICY content_reports_select_own_or_staff ON public.content_reports
  USING ((reporter_id = (SELECT auth.uid())) OR (SELECT public.current_user_tier_at_least('community_moderator')));
DROP POLICY post_comments_update_own ON public.post_comments;
DROP POLICY post_comments_delete_own ON public.post_comments;
CREATE POLICY post_comments_insert_post_visible ON public.post_comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.post_accepts_engagement(post_id));

-- poll votes: only while the poll is open and its post is visible
CREATE POLICY poll_votes_insert_poll_open ON public.poll_votes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.poll_is_open(poll_id));

-- likes: only on a visible post (unliking stays allowed)
CREATE POLICY post_likes_insert_post_visible ON public.post_likes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.post_accepts_engagement(post_id));

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261026000000', 'post_editing_foundation');

COMMIT;
