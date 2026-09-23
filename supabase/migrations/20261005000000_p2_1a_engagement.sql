-- 20261005000000_p2_1a_engagement.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-p2-1a-engagement
--
-- P2.1a engagement subsystem on the P2.0 integrity floor (20261004000000): an
-- append-only engagement ledger, per-user scoped counters, a tunable single-row
-- badge_config, a PUBLIC badge_summary on profiles + a PRIVATE owner-only summary, and
-- the opt-in unblock flow with a private per-author decline marker.
--
-- Replay-safe on PG15 (local) and PG17 (prod): every statement is idempotent. No
-- PG16/17-only syntax. Wrapped in BEGIN/COMMIT with a bounded lock wait.
--
-- ============================================================================
-- INVARIANTS
--   I1  LEDGER EXACTLY-ONCE. UNIQUE(actor_id, kind, target_id) + ON CONFLICT DO NOTHING.
--       The target key is the durable object (post/poll/resource/conversation/petition/
--       review-anchor), never a deletable child, so delete-and-redo never re-awards.
--   I2  SERVER-ONLY WRITES. The ledger, counters, badge_config, both summaries and
--       opt_in_declines carry no client write policy + table-level REVOKE ALL; only SECDEF
--       triggers (owner) write them.
--   I3  SUMMARY = recompute(counters, config), under concurrency. Public summary recompute
--       locks the profile row FOR NO KEY UPDATE; private summary recompute locks the
--       private-table owner row FOR NO KEY UPDATE; two-party events lock both profiles in
--       uuid order. Each summary is rewritten only when its value changes.
--   I4  READ PATHS UNBROKEN. profiles has column-only grants; badge_summary is GRANTed
--       SELECT to anon+authenticated (no UPDATE). profiles is not in supabase_realtime.
--   I5  UNBLOCK. unblock_opt_in (author-only, declined-only) DELETEs the declined opt-in
--       and restores the slot exactly once (rowcount-gated, post row-locked); the seeker
--       re-opts via opt_in_to_post. The P2.0 transition graph is untouched.
--   I7  CORE-FIRST. Every engagement trigger body is a BEGIN/EXCEPTION subtransaction
--       (RAISE WARNING + best-effort app_logs); reconcile_engagement() re-derives missed
--       events idempotently (also scheduled nightly via pg_cron).
--   A1  COMMUNITY-CONFIRMED. An action whose actor OWNS the target content earns nothing
--       (own like/comment/poll-vote/alert-vote/bookmark/save). Opt-in/review are already
--       cross-party; resource_approved/safety_alert_verified already exclude the self case.
--   A2  post_created credits the author EXACTLY ONCE, at the FIRST qualifying engagement
--       (a like, a NON-HIDDEN comment, a poll vote, or an opt-in) by a DIFFERENT non-guest
--       user — never at creation. Live triggers and reconcile share this exact rule. A post
--       deleted before outside engagement earns nothing; after credit, deleting the post
--       keeps it (key (author, post_created, post_id) is stable). Two-account collusion
--       stays possible; those credits are UNVERIFIED and never gate privilege.
--   B1/B2  PUBLIC/PRIVATE SPLIT. Each kind is classified public or private from live RLS
--       (engagement_is_public). Public credit -> profiles.badge_summary; private credit ->
--       user_private_badge_summary (owner-only RLS, no client writes, not published,
--       no FK/embed path). Writing private credit never touches profiles (updated_at safe).
--   B3  verified + P3 eligibility unaffected: verified facts may be public or private;
--       eligibility reads the ledger server-side, never a summary.
--
-- ============================================================================
-- I1 DERIVATION + B1 CLASSIFICATION (18 kinds + reserved)  [scope from live RLS]
-- kind                          | source              | actor(s)             | target        | scope   | family | verified | wt
-- ------------------------------|---------------------|----------------------|---------------|---------|--------|----------|---
-- like                          | post_likes INS      | user_id (≠author)    | post_id       | public  | post   | no       | 1
-- poll_vote                     | poll_votes INS      | user_id (≠author)    | poll_id       | public  | post   | no       | 1   (poll_votes SELECT USING true → visible)
-- follow                        | follows INS         | follower(≠following) | following_id  | public  | none   | no       | 1   (follows SELECT true)
-- comment                       | post_comments INS   | user_id (≠author)    | post_id       | public  | post   | no       | 1   (visible comments)
-- post_created                  | via like/comment/opt-in | post author      | post.id       | public  | resource/chip | no | 1   (A2: first outside non-guest engagement)
-- opt_in_completed_provider     | resource_opt_ins UPD| post author          | opt_in.id     | public  | resource| no      | 3   (helping others → public)
-- conversation_completed_volunteer | conversations UPD| volunteer_id        | conv.id       | public  | resource| no      | 3   (helping others → public)
-- safety_alert_verified         | safety_alerts UPD   | created_by (verifier≠creator) | alert.id | PRIVATE | none | yes(admin)| 1  (created_by has NO client grant; verified_at IS granted → a public write would unmask the reporter via profiles.updated_at=verified_at)
-- resource_approved             | resources UPD       | submitted_by (mod≠sub)| resource.id  | public  | resource| yes(admin)| 3  (approved resource public)
-- petition_signature            | petition_signatures INS | signer_id        | petition_id   | private | none   | no       | 1   (signer-only RLS)
-- event_checkin                 | event_checkins INS  | user_id              | occurrence_id | private | none   | no       | 1   (own/admin only)
-- safety_alert_vote             | safety_alert_votes INS | voter(≠creator)   | alert_id      | private | none   | no       | 1   (voter-only RLS)
-- message                       | messages INS        | sender_id            | conversation_id| private| none   | no       | 1   (participant-only correspondence)
-- resource_bookmark             | resource_bookmarks INS | user(≠submitter)  | resource_id   | private | resource| no      | 1   (owner-only RLS)
-- saved_resource                | saved_resources INS | user(≠submitter)     | resource_id   | private | resource| no      | 1   (owner-only RLS)
-- opt_in_completed_seeker       | resource_opt_ins UPD| seeker_id            | opt_in.id     | private | resource| no      | 2   (receiving help → private)
-- conversation_completed_requester | conversations UPD| requester_id        | conv.id       | private | resource| no      | 3   (receiving → private)
-- review_received               | reviews INS         | reviewee_id          | anchor        | private | resource| yes(peer)| 3   (reviews RLS = parties+admin only)
-- appreciation_gift             | (reserved P2.1b)    | recipient            | giver         | private | none   | no       | —
--
-- Community badges: Voice←comment, Helper←opt_in_completed_provider,
-- Connector←conversation_completed_volunteer (PUBLIC); Voice/Helper/Connector public.
-- Watcher←safety_alert_verified (PRIVATE) and Advocate←petition_signature (PRIVATE) — both
-- private (reporter unmasking / signer-only RLS).
-- Evidence note: poll_votes SELECT is USING true → poll_vote is PUBLIC (contradicts the
-- tentative "poll votes private" guess; decided from live RLS per instruction).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 0. Pure classification / crosswalk helpers ──────────────────────────────
CREATE OR REPLACE FUNCTION public.engagement_category_family(p_category public.resource_category)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_category
    WHEN 'food' THEN 'food' WHEN 'housing' THEN 'housing' WHEN 'free_camping' THEN 'housing'
    WHEN 'clothing' THEN 'goods' WHEN 'free_goods_donation' THEN 'goods' WHEN 'waste_disposal' THEN 'goods'
    WHEN 'transportation' THEN 'transit'
    WHEN 'healthcare' THEN 'health' WHEN 'mental_health' THEN 'health' WHEN 'substance_abuse' THEN 'health' WHEN 'prenatal_natal_care' THEN 'health'
    WHEN 'financial' THEN 'money' WHEN 'eitc_tax_filing' THEN 'money' WHEN 'utilities' THEN 'money'
    WHEN 'childcare' THEN 'care' WHEN 'senior_services' THEN 'care' WHEN 'disability_services' THEN 'care' WHEN 'veteran_services' THEN 'care' WHEN 'domestic_violence' THEN 'care'
    WHEN 'education' THEN 'education' WHEN 'employment' THEN 'work'
    WHEN 'legal' THEN 'legal' WHEN 'free_legal' THEN 'legal' WHEN 'immigration' THEN 'legal'
    ELSE NULL
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.engagement_family_from_chip(p_chip text)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE lower(coalesce(p_chip, ''))
    WHEN 'food' THEN 'food' WHEN 'housing' THEN 'housing' WHEN 'goods' THEN 'goods'
    WHEN 'transit' THEN 'transit' WHEN 'health' THEN 'health' WHEN 'money' THEN 'money'
    WHEN 'care' THEN 'care' WHEN 'education' THEN 'education' WHEN 'work' THEN 'work'
    WHEN 'legal' THEN 'legal' ELSE NULL END;
$fn$;

CREATE OR REPLACE FUNCTION public.engagement_weight(p_kind text)
  RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_kind
    WHEN 'opt_in_completed_provider' THEN 3
    WHEN 'opt_in_completed_seeker'   THEN 2
    WHEN 'conversation_completed_volunteer' THEN 3
    WHEN 'conversation_completed_requester' THEN 3
    WHEN 'review_received'           THEN 3
    WHEN 'resource_approved'         THEN 3
    ELSE 1
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.engagement_community_dim(p_kind text)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_kind
    WHEN 'comment'                        THEN 'badge:voice'
    WHEN 'opt_in_completed_provider'      THEN 'badge:helper'
    WHEN 'conversation_completed_volunteer' THEN 'badge:connector'
    WHEN 'petition_signature'             THEN 'badge:advocate'
    WHEN 'safety_alert_verified'          THEN 'badge:watcher'
    ELSE NULL
  END;
$fn$;

-- B1: a kind is PUBLIC when the underlying fact is visible to other users (per live RLS)
-- or it records helping others; otherwise PRIVATE (owner-only visibility / receiving help).
CREATE OR REPLACE FUNCTION public.engagement_is_public(p_kind text)
  RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  -- Public ONLY when another user can read the actor↔target link through a granted column
  -- (column grants, not just row RLS). safety_alert_verified is PRIVATE: safety_alerts
  -- .created_by has no client grant, but verified_at IS granted, so a public write would let
  -- anyone join profiles.updated_at = verified_at to unmask the hidden reporter. Watcher is
  -- therefore a private badge.
  SELECT p_kind IN (
    'like','poll_vote','follow','comment','post_created',
    'opt_in_completed_provider','conversation_completed_volunteer',
    'resource_approved'
  );
$fn$;

-- ── 1. badge_config ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badge_config (
  singleton_guard  boolean     NOT NULL DEFAULT true,
  level1_threshold integer     NOT NULL DEFAULT 3,
  level2_threshold integer     NOT NULL DEFAULT 10,
  level3_threshold integer     NOT NULL DEFAULT 25,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT badge_config_singleton      CHECK (singleton_guard),
  CONSTRAINT badge_config_singleton_uniq UNIQUE (singleton_guard),
  CONSTRAINT badge_config_thresholds_ordered
    CHECK (level1_threshold >= 1 AND level1_threshold < level2_threshold AND level2_threshold < level3_threshold)
);
INSERT INTO public.badge_config (singleton_guard) VALUES (true) ON CONFLICT (singleton_guard) DO NOTHING;

-- ── 2. engagement_events (append-only ledger) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.engagement_events (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL,
  target_type  text        NOT NULL,
  target_id    uuid        NOT NULL,
  category     text,
  verified     boolean     NOT NULL DEFAULT false,
  weight       integer     NOT NULL DEFAULT 1,
  source_table text        NOT NULL,
  source_pk    text        NOT NULL,
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_events_kind_chk CHECK (kind IN (
    'like','poll_vote','follow','comment','petition_signature','post_created',
    'event_checkin','safety_alert_vote','message','resource_bookmark','saved_resource',
    'opt_in_completed_provider','opt_in_completed_seeker',
    'conversation_completed_volunteer','conversation_completed_requester',
    'review_received','safety_alert_verified','resource_approved','appreciation_gift'
  )),
  CONSTRAINT engagement_events_once UNIQUE (actor_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_engagement_events_actor ON public.engagement_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_verified ON public.engagement_events (actor_id, verified) WHERE verified;

-- ── 3. user_engagement_counters (per user, per SCOPE, per dimension) ─────────
CREATE TABLE IF NOT EXISTS public.user_engagement_counters (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope      text        NOT NULL DEFAULT 'public',
  dimension  text        NOT NULL,
  count      integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, dimension),
  CONSTRAINT user_engagement_counters_scope_chk CHECK (scope IN ('public','private'))
);

-- ── 4. opt_in_declines (private per-author marker) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.opt_in_declines (
  author_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seeker_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_declined_at timestamptz NOT NULL DEFAULT now(),
  last_declined_at  timestamptz NOT NULL DEFAULT now(),
  times_declined    integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (author_id, seeker_id)
);

-- ── 5. summaries ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badge_summary jsonb;  -- PUBLIC
CREATE TABLE IF NOT EXISTS public.user_private_badge_summary (               -- PRIVATE
  user_id    uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  summary    jsonb       NOT NULL DEFAULT '{"families":{},"badges":{}}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. WRITE PATH — SECURITY DEFINER helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.engagement_level(p_points integer)
  RETURNS integer LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
    WHEN p_points >= c.level3_threshold THEN 3
    WHEN p_points >= c.level2_threshold THEN 2
    WHEN p_points >= c.level1_threshold THEN 1
    ELSE 0
  END FROM public.badge_config c WHERE c.singleton_guard;
$fn$;

CREATE OR REPLACE FUNCTION public.log_engagement_failure(p_context text, p_detail text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  RAISE WARNING 'engagement ledger skipped (%): %', p_context, p_detail;
  BEGIN
    INSERT INTO public.app_logs (level, event, context)
    VALUES ('warn', 'engagement.ledger.skipped', jsonb_build_object('context', p_context, 'detail', p_detail));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$fn$;

-- Lock up to two profile rows in uuid order (deadlock-safe; FOR NO KEY UPDATE so inbound
-- FK KEY SHARE never conflicts). Used before any trigger path that credits two profiles.
CREATE OR REPLACE FUNCTION public.lock_two_profiles(p_a uuid, p_b uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id IN (p_a, p_b) ORDER BY id FOR NO KEY UPDATE;
END;
$fn$;

-- Build a summary jsonb from one scope's counters. PUBLIC summary publishes LEVELS ONLY
-- (no raw counts — a privacy floor, and it is rewritten only when a level changes because
-- counts never appear); the PRIVATE summary (p_with_counts=true) keeps counts for the owner.
CREATE OR REPLACE FUNCTION public.engagement_summary_for(p_user uuid, p_scope text, p_with_counts boolean)
  RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'families', COALESCE(jsonb_object_agg(substr(dimension, 8),
                CASE WHEN p_with_counts
                  THEN jsonb_build_object('count', count, 'level', public.engagement_level(count))
                  ELSE jsonb_build_object('level', public.engagement_level(count)) END)
                FILTER (WHERE dimension LIKE 'family:%' AND public.engagement_level(count) > 0), '{}'::jsonb),
    'badges',   COALESCE(jsonb_object_agg(substr(dimension, 7),
                CASE WHEN p_with_counts
                  THEN jsonb_build_object('count', count, 'level', public.engagement_level(count))
                  ELSE jsonb_build_object('level', public.engagement_level(count)) END)
                FILTER (WHERE dimension LIKE 'badge:%' AND public.engagement_level(count) > 0), '{}'::jsonb)
  )
  FROM public.user_engagement_counters WHERE user_id = p_user AND scope = p_scope;
$fn$;

-- PUBLIC summary -> profiles.badge_summary. Locks the profile row (NO KEY UPDATE);
-- rewritten only on change (so profiles.updated_at bumps only on a real change).
CREATE OR REPLACE FUNCTION public.recompute_badge_summary(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_new jsonb; v_cur jsonb;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user FOR NO KEY UPDATE;
  v_new := public.engagement_summary_for(p_user, 'public', false);  -- LEVELS ONLY (no counts)
  SELECT badge_summary INTO v_cur FROM public.profiles WHERE id = p_user;
  -- The public summary has levels only, so it changes only when a LEVEL changes; write only
  -- then, and never write an empty summary over NULL (public-empty users stay NULL), so
  -- profiles.updated_at is untouched unless a public level actually changes.
  IF v_cur IS DISTINCT FROM v_new
     AND NOT (v_cur IS NULL AND v_new = '{"families": {}, "badges": {}}'::jsonb) THEN
    UPDATE public.profiles SET badge_summary = v_new WHERE id = p_user;
  END IF;
END;
$fn$;

-- PRIVATE summary -> user_private_badge_summary. Locks the private owner row (NO KEY
-- UPDATE); never touches profiles (so profiles.updated_at is untouched by private credit).
CREATE OR REPLACE FUNCTION public.recompute_private_badge_summary(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_new jsonb; v_cur jsonb;
BEGIN
  INSERT INTO public.user_private_badge_summary (user_id, summary)
  VALUES (p_user, '{"families":{},"badges":{}}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.user_private_badge_summary WHERE user_id = p_user FOR NO KEY UPDATE;
  v_new := public.engagement_summary_for(p_user, 'private', true);  -- owner keeps counts
  SELECT summary INTO v_cur FROM public.user_private_badge_summary WHERE user_id = p_user;
  IF v_cur IS DISTINCT FROM v_new THEN
    UPDATE public.user_private_badge_summary SET summary = v_new, updated_at = now() WHERE user_id = p_user;
  END IF;
END;
$fn$;

-- Single write primitive. Exactly-once; guests/NULL actors produce no row. Scope from
-- the kind decides which counters + which summary are touched.
CREATE OR REPLACE FUNCTION public.record_engagement_event(
  p_actor uuid, p_kind text, p_target_type text, p_target_id uuid,
  p_source_table text, p_source_pk text, p_family text, p_verified boolean)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_weight    integer := public.engagement_weight(p_kind);
  v_community text    := public.engagement_community_dim(p_kind);
  v_scope     text    := CASE WHEN public.engagement_is_public(p_kind) THEN 'public' ELSE 'private' END;
  v_inserted  uuid;
BEGIN
  IF p_actor IS NULL OR p_target_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor AND is_anonymous IS TRUE) THEN RETURN; END IF;

  INSERT INTO public.engagement_events
    (actor_id, kind, target_type, target_id, category, verified, weight, source_table, source_pk)
  VALUES
    (p_actor, p_kind, p_target_type, p_target_id, p_family, p_verified, v_weight, p_source_table, p_source_pk)
  ON CONFLICT (actor_id, kind, target_id) DO NOTHING
  RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN; END IF;

  IF p_family IS NOT NULL THEN
    INSERT INTO public.user_engagement_counters (user_id, scope, dimension, count, updated_at)
    VALUES (p_actor, v_scope, 'family:' || p_family, v_weight, now())
    ON CONFLICT (user_id, scope, dimension)
      DO UPDATE SET count = public.user_engagement_counters.count + v_weight, updated_at = now();
  END IF;

  IF v_community IS NOT NULL THEN
    INSERT INTO public.user_engagement_counters (user_id, scope, dimension, count, updated_at)
    VALUES (p_actor, v_scope, v_community, 1, now())
    ON CONFLICT (user_id, scope, dimension)
      DO UPDATE SET count = public.user_engagement_counters.count + 1, updated_at = now();
  END IF;

  IF v_scope = 'public' THEN
    PERFORM public.recompute_badge_summary(p_actor);
  ELSE
    PERFORM public.recompute_private_badge_summary(p_actor);
  END IF;
END;
$fn$;

-- A2: credit the post author's post_created (public) at the FIRST outside, non-guest
-- engagement (like/comment/opt-in). Once-ever via the ledger key; needs an engager who is
-- not the author and not a guest.
CREATE OR REPLACE FUNCTION public.credit_post_created(p_post_id uuid, p_engager uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_author uuid; v_res uuid; v_meta jsonb; v_family text;
BEGIN
  SELECT user_id, resource_id, metadata INTO v_author, v_res, v_meta FROM public.posts WHERE id = p_post_id;
  IF v_author IS NULL OR p_engager IS NULL OR p_engager = v_author THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_engager AND is_anonymous IS TRUE) THEN RETURN; END IF;
  IF v_res IS NOT NULL THEN
    SELECT public.engagement_category_family(category) INTO v_family FROM public.resources WHERE id = v_res;
  END IF;
  IF v_family IS NULL AND v_meta ? 'categories' AND jsonb_typeof(v_meta->'categories') = 'array'
     AND jsonb_array_length(v_meta->'categories') > 0 THEN
    v_family := public.engagement_family_from_chip(v_meta->'categories'->>0);
  END IF;
  PERFORM public.record_engagement_event(v_author, 'post_created', 'post', p_post_id, 'posts', p_post_id::text, v_family, false);
END;
$fn$;

-- Full recompute from the ledger (rebuild BOTH scopes' counters, then both summaries).
CREATE OR REPLACE FUNCTION public.recompute_user_engagement(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  DELETE FROM public.user_engagement_counters WHERE user_id = p_user;

  -- Family dimensions per scope.
  INSERT INTO public.user_engagement_counters (user_id, scope, dimension, count, updated_at)
  SELECT actor_id, CASE WHEN public.engagement_is_public(kind) THEN 'public' ELSE 'private' END,
         'family:' || category, SUM(weight), now()
  FROM public.engagement_events
  WHERE actor_id = p_user AND category IS NOT NULL
  GROUP BY actor_id, CASE WHEN public.engagement_is_public(kind) THEN 'public' ELSE 'private' END, category;

  -- Community-badge dimensions per scope.
  INSERT INTO public.user_engagement_counters (user_id, scope, dimension, count, updated_at)
  SELECT actor_id, CASE WHEN public.engagement_is_public(kind) THEN 'public' ELSE 'private' END,
         public.engagement_community_dim(kind), COUNT(*), now()
  FROM public.engagement_events
  WHERE actor_id = p_user AND public.engagement_community_dim(kind) IS NOT NULL
  GROUP BY actor_id, CASE WHEN public.engagement_is_public(kind) THEN 'public' ELSE 'private' END, public.engagement_community_dim(kind);

  PERFORM public.recompute_badge_summary(p_user);
  PERFORM public.recompute_private_badge_summary(p_user);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.recompute_all_badge_summaries()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_user uuid;
BEGIN
  FOR v_user IN SELECT DISTINCT user_id FROM public.user_engagement_counters LOOP
    PERFORM public.recompute_badge_summary(v_user);
    PERFORM public.recompute_private_badge_summary(v_user);
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.badge_config_recompute()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.recompute_all_badge_summaries();
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_badge_config_recompute ON public.badge_config;
CREATE TRIGGER trg_badge_config_recompute
  AFTER UPDATE ON public.badge_config FOR EACH ROW EXECUTE FUNCTION public.badge_config_recompute();

-- reconcile_engagement — re-derive missed events idempotently from source tables, applying
-- A1 (owner earns nothing) and A2 (post_created only on outside engagement) IDENTICALLY.
CREATE OR REPLACE FUNCTION public.reconcile_engagement(p_user uuid DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  SET lock_timeout = '5s'   -- bound each lock wait (nightly cron + backfill); no batching (8 users)
AS $fn$
DECLARE r record; v_family text; v_author uuid;
BEGIN
  -- like (A1: liker <> post author)
  FOR r IN SELECT pl.user_id, pl.post_id, p.user_id AS author, p.resource_id FROM public.post_likes pl
           JOIN public.posts p ON p.id = pl.post_id
           WHERE pl.user_id <> p.user_id AND (p_user IS NULL OR pl.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'like','post',r.post_id,'post_likes',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- poll_vote (A1: voter <> post author)
  FOR r IN SELECT pv.user_id, pv.poll_id, p.user_id AS author, p.resource_id FROM public.poll_votes pv
           JOIN public.polls pl ON pl.id = pv.poll_id JOIN public.posts p ON p.id = pl.post_id
           WHERE pv.user_id <> p.user_id AND (p_user IS NULL OR pv.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'poll_vote','poll',r.poll_id,'poll_votes',r.user_id::text||':'||r.poll_id::text,v_family,false);
  END LOOP;
  -- follow (A1: follower <> following)
  FOR r IN SELECT follower_id, following_id FROM public.follows WHERE follower_id <> following_id AND (p_user IS NULL OR follower_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.follower_id,'follow','user',r.following_id,'follows',r.follower_id::text||':'||r.following_id::text,NULL,false);
  END LOOP;
  -- comment (A1: commenter <> post author; visible only)
  FOR r IN SELECT DISTINCT pc.user_id, pc.post_id, p.user_id AS author, p.resource_id FROM public.post_comments pc
           JOIN public.posts p ON p.id = pc.post_id
           WHERE (pc.is_hidden IS NOT TRUE) AND pc.user_id <> p.user_id AND (p_user IS NULL OR pc.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'comment','post',r.post_id,'post_comments',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- petition_signature (private; A1: signer <> petition creator)
  FOR r IN SELECT ps.signer_id, ps.petition_id FROM public.petition_signatures ps
           JOIN public.petitions pt ON pt.id = ps.petition_id
           WHERE ps.signer_id IS DISTINCT FROM pt.created_by AND (p_user IS NULL OR ps.signer_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.signer_id,'petition_signature','petition',r.petition_id,'petition_signatures',r.signer_id::text||':'||r.petition_id::text,NULL,false);
  END LOOP;
  -- event_checkin (private)
  FOR r IN SELECT user_id, occurrence_id FROM public.event_checkins WHERE user_id IS NOT NULL AND (p_user IS NULL OR user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'event_checkin','event',r.occurrence_id,'event_checkins',r.user_id::text||':'||r.occurrence_id::text,NULL,false);
  END LOOP;
  -- safety_alert_vote (A1: voter <> alert creator; private)
  FOR r IN SELECT v.voter_id, v.alert_id FROM public.safety_alert_votes v JOIN public.safety_alerts a ON a.id = v.alert_id
           WHERE v.voter_id IS DISTINCT FROM a.created_by AND (p_user IS NULL OR v.voter_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.voter_id,'safety_alert_vote','safety_alert',r.alert_id,'safety_alert_votes',r.voter_id::text||':'||r.alert_id::text,NULL,false);
  END LOOP;
  -- message (private; once per conversation)
  FOR r IN SELECT DISTINCT sender_id, conversation_id FROM public.messages WHERE p_user IS NULL OR sender_id = p_user LOOP
    PERFORM public.record_engagement_event(r.sender_id,'message','conversation',r.conversation_id,'messages',r.sender_id::text||':'||r.conversation_id::text,NULL,false);
  END LOOP;
  -- resource_bookmark (A1: user <> resource submitter; private)
  FOR r IN SELECT rb.user_id, rb.resource_id, res.category, res.submitted_by FROM public.resource_bookmarks rb
           JOIN public.resources res ON res.id = rb.resource_id
           WHERE rb.user_id IS DISTINCT FROM res.submitted_by AND (p_user IS NULL OR rb.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'resource_bookmark','resource',r.resource_id,'resource_bookmarks',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- saved_resource (A1: user <> resource submitter; private)
  FOR r IN SELECT sr.user_id, sr.resource_id, res.category, res.submitted_by FROM public.saved_resources sr
           JOIN public.resources res ON res.id = sr.resource_id
           WHERE sr.resource_id IS NOT NULL AND sr.user_id IS DISTINCT FROM res.submitted_by AND (p_user IS NULL OR sr.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'saved_resource','resource',r.resource_id,'saved_resources',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- opt_in completed: provider (public) + seeker (private)
  FOR r IN SELECT oi.id, oi.seeker_id, oi.resource_id, p.user_id AS author FROM public.resource_opt_ins oi
           JOIN public.posts p ON p.id = oi.post_id
           WHERE oi.status = 'completed' AND (p_user IS NULL OR oi.seeker_id = p_user OR p.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.author,'opt_in_completed_provider','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.seeker_id,'opt_in_completed_seeker','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
  END LOOP;
  -- conversation completed: volunteer (public) + requester (private)
  FOR r IN SELECT c.id, c.volunteer_id, c.requester_id, c.resource_id FROM public.conversations c
           WHERE c.status = 'completed' AND (p_user IS NULL OR c.volunteer_id = p_user OR c.requester_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.volunteer_id,'conversation_completed_volunteer','conversation',r.id,'conversations',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.requester_id,'conversation_completed_requester','conversation',r.id,'conversations',r.id::text,v_family,false);
  END LOOP;
  -- review_received (private; keyed on anchor)
  FOR r IN SELECT id, reviewee_id, opt_in_id, conversation_id FROM public.reviews WHERE p_user IS NULL OR reviewee_id = p_user LOOP
    v_family := NULL;
    IF r.opt_in_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family
      FROM public.resource_opt_ins oi LEFT JOIN public.resources res ON res.id = oi.resource_id WHERE oi.id = r.opt_in_id;
    ELSIF r.conversation_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family
      FROM public.conversations c JOIN public.resources res ON res.id = c.resource_id WHERE c.id = r.conversation_id;
    END IF;
    PERFORM public.record_engagement_event(r.reviewee_id,'review_received','review',COALESCE(r.opt_in_id, r.conversation_id),'reviews',COALESCE(r.opt_in_id, r.conversation_id)::text,v_family,true);
  END LOOP;
  -- safety_alert_verified (public; admin; not self-verified)
  FOR r IN SELECT id, created_by FROM public.safety_alerts
           WHERE verified IS TRUE AND created_by IS NOT NULL AND verified_by IS NOT NULL AND verified_by <> created_by
             AND (p_user IS NULL OR created_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.created_by,'safety_alert_verified','safety_alert',r.id,'safety_alerts',r.id::text,NULL,true);
  END LOOP;
  -- resource_approved (public; admin; not self-approved)
  FOR r IN SELECT id, submitted_by, category FROM public.resources
           WHERE status = 'approved' AND submitted_by IS NOT NULL AND moderated_by IS NOT NULL AND moderated_by <> submitted_by
             AND (p_user IS NULL OR submitted_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.submitted_by,'resource_approved','resource',r.id,'resources',r.id::text,public.engagement_category_family(r.category),true);
  END LOOP;
  -- post_created (A2: author credited iff a QUALIFYING outside engagement exists by a
  -- non-guest ≠ author — a like, a NON-HIDDEN comment, a POLL VOTE, or an opt-in. This must
  -- match the live triggers exactly (poll_vote also credits post_created; hidden comments do
  -- not). The EXISTS proves outside engagement; family is derived from the post.
  FOR r IN SELECT p.id, p.user_id, p.resource_id, p.metadata FROM public.posts p
           WHERE (p_user IS NULL OR p.user_id = p_user)
             AND EXISTS (
               SELECT 1 FROM public.post_likes pl JOIN auth.users u ON u.id = pl.user_id
                 WHERE pl.post_id = p.id AND pl.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.post_comments pc JOIN auth.users u ON u.id = pc.user_id
                 WHERE pc.post_id = p.id AND pc.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
                   AND pc.is_hidden IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.poll_votes pv JOIN public.polls pol ON pol.id = pv.poll_id
                 JOIN auth.users u ON u.id = pv.user_id
                 WHERE pol.post_id = p.id AND pv.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.resource_opt_ins oi JOIN auth.users u ON u.id = oi.seeker_id
                 WHERE oi.post_id = p.id AND oi.seeker_id <> p.user_id AND u.is_anonymous IS NOT TRUE
             ) LOOP
    v_family := NULL;
    IF r.resource_id IS NOT NULL THEN
      SELECT public.engagement_category_family(category) INTO v_family FROM public.resources WHERE id = r.resource_id;
    END IF;
    IF v_family IS NULL AND r.metadata ? 'categories' AND jsonb_typeof(r.metadata->'categories') = 'array'
       AND jsonb_array_length(r.metadata->'categories') > 0 THEN
      v_family := public.engagement_family_from_chip(r.metadata->'categories'->>0);
    END IF;
    PERFORM public.record_engagement_event(r.user_id,'post_created','post',r.id,'posts',r.id::text,v_family,false);
  END LOOP;
END;
$fn$;

-- ============================================================================
-- 7. SOURCE TRIGGERS (each I7-wrapped; A1 owner guards; A2 post_created relocation)
-- ============================================================================

-- like -> credit liker (public) unless liker owns the post (A1); then A2 credit author.
CREATE OR REPLACE FUNCTION public.engagement_on_post_like()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_author uuid; v_res uuid;
BEGIN
  BEGIN
    SELECT p.user_id, p.resource_id INTO v_author, v_res FROM public.posts p WHERE p.id = NEW.post_id;
    IF NEW.user_id = v_author THEN RETURN NULL; END IF;  -- A1: own post earns nothing
    -- This path credits TWO profiles (liker + author via post_created). Lock both up front in
    -- uuid order so a cross-like (A likes B, B likes A concurrently) cannot deadlock.
    PERFORM public.lock_two_profiles(NEW.user_id, v_author);
    SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = v_res;
    PERFORM public.record_engagement_event(NEW.user_id,'like','post',NEW.post_id,'post_likes',NEW.user_id::text||':'||NEW.post_id::text,v_family,false);
    PERFORM public.credit_post_created(NEW.post_id, NEW.user_id);  -- A2
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('post_like', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_post_like ON public.post_likes;
CREATE TRIGGER trg_engagement_post_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.engagement_on_post_like();

-- poll_vote -> credit voter (public) unless voter owns the poll's post (A1).
CREATE OR REPLACE FUNCTION public.engagement_on_poll_vote()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_author uuid; v_res uuid; v_post uuid;
BEGIN
  BEGIN
    SELECT p.user_id, p.resource_id, p.id INTO v_author, v_res, v_post
    FROM public.polls pl JOIN public.posts p ON p.id = pl.post_id WHERE pl.id = NEW.poll_id;
    IF NEW.user_id = v_author THEN RETURN NULL; END IF;  -- A1
    PERFORM public.lock_two_profiles(NEW.user_id, v_author);  -- credits voter + author; lock both
    SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = v_res;
    PERFORM public.record_engagement_event(NEW.user_id,'poll_vote','poll',NEW.poll_id,'poll_votes',NEW.user_id::text||':'||NEW.poll_id::text,v_family,false);
    PERFORM public.credit_post_created(v_post, NEW.user_id);  -- A2 (a vote is outside engagement)
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('poll_vote', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_poll_vote ON public.poll_votes;
CREATE TRIGGER trg_engagement_poll_vote AFTER INSERT ON public.poll_votes FOR EACH ROW EXECUTE FUNCTION public.engagement_on_poll_vote();

-- follow -> public; A1 self-follow earns nothing.
CREATE OR REPLACE FUNCTION public.engagement_on_follow()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    IF NEW.follower_id = NEW.following_id THEN RETURN NULL; END IF;  -- A1
    PERFORM public.record_engagement_event(NEW.follower_id,'follow','user',NEW.following_id,'follows',NEW.follower_id::text||':'||NEW.following_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('follow', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_follow ON public.follows;
CREATE TRIGGER trg_engagement_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.engagement_on_follow();

-- comment -> Voice (public), once per (actor, post); A1 own post earns nothing; A2 author.
CREATE OR REPLACE FUNCTION public.engagement_on_comment()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_author uuid; v_res uuid;
BEGIN
  BEGIN
    IF NEW.is_hidden IS TRUE THEN RETURN NULL; END IF;
    SELECT p.user_id, p.resource_id INTO v_author, v_res FROM public.posts p WHERE p.id = NEW.post_id;
    IF NEW.user_id = v_author THEN RETURN NULL; END IF;  -- A1
    PERFORM public.lock_two_profiles(NEW.user_id, v_author);  -- credits commenter + author; lock both
    SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = v_res;
    PERFORM public.record_engagement_event(NEW.user_id,'comment','post',NEW.post_id,'post_comments',NEW.user_id::text||':'||NEW.post_id::text,v_family,false);
    PERFORM public.credit_post_created(NEW.post_id, NEW.user_id);  -- A2
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('comment', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_comment ON public.post_comments;
CREATE TRIGGER trg_engagement_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.engagement_on_comment();

-- petition_signature -> Advocate (PRIVATE).
CREATE OR REPLACE FUNCTION public.engagement_on_petition_signature()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_creator uuid;
BEGIN
  BEGIN
    SELECT created_by INTO v_creator FROM public.petitions WHERE id = NEW.petition_id;
    IF NEW.signer_id IS NOT DISTINCT FROM v_creator THEN RETURN NULL; END IF;  -- A1: signing own petition earns nothing
    PERFORM public.record_engagement_event(NEW.signer_id,'petition_signature','petition',NEW.petition_id,'petition_signatures',NEW.signer_id::text||':'||NEW.petition_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('petition_signature', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_petition_signature ON public.petition_signatures;
CREATE TRIGGER trg_engagement_petition_signature AFTER INSERT ON public.petition_signatures FOR EACH ROW EXECUTE FUNCTION public.engagement_on_petition_signature();

-- post_created is NO LONGER credited at creation (A2). Drop any prior creation trigger.
DROP TRIGGER IF EXISTS trg_engagement_post_created ON public.posts;

-- event_checkin -> PRIVATE (attendee).
CREATE OR REPLACE FUNCTION public.engagement_on_event_checkin()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    IF NEW.user_id IS NOT NULL THEN
      PERFORM public.record_engagement_event(NEW.user_id,'event_checkin','event',NEW.occurrence_id,'event_checkins',NEW.user_id::text||':'||NEW.occurrence_id::text,NULL,false);
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('event_checkin', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_event_checkin ON public.event_checkins;
CREATE TRIGGER trg_engagement_event_checkin AFTER INSERT ON public.event_checkins FOR EACH ROW EXECUTE FUNCTION public.engagement_on_event_checkin();

-- safety_alert_vote -> PRIVATE; A1 own alert earns nothing.
CREATE OR REPLACE FUNCTION public.engagement_on_safety_alert_vote()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_creator uuid;
BEGIN
  BEGIN
    SELECT created_by INTO v_creator FROM public.safety_alerts WHERE id = NEW.alert_id;
    IF NEW.voter_id IS NOT DISTINCT FROM v_creator THEN RETURN NULL; END IF;  -- A1
    PERFORM public.record_engagement_event(NEW.voter_id,'safety_alert_vote','safety_alert',NEW.alert_id,'safety_alert_votes',NEW.voter_id::text||':'||NEW.alert_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('safety_alert_vote', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_safety_alert_vote ON public.safety_alert_votes;
CREATE TRIGGER trg_engagement_safety_alert_vote AFTER INSERT ON public.safety_alert_votes FOR EACH ROW EXECUTE FUNCTION public.engagement_on_safety_alert_vote();

-- message -> PRIVATE (once per conversation).
CREATE OR REPLACE FUNCTION public.engagement_on_message()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    PERFORM public.record_engagement_event(NEW.sender_id,'message','conversation',NEW.conversation_id,'messages',NEW.sender_id::text||':'||NEW.conversation_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('message', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_message ON public.messages;
CREATE TRIGGER trg_engagement_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.engagement_on_message();

-- resource_bookmark -> PRIVATE; A1 own resource earns nothing.
CREATE OR REPLACE FUNCTION public.engagement_on_resource_bookmark()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_sub uuid;
BEGIN
  BEGIN
    SELECT category, submitted_by INTO v_family, v_sub FROM public.resources WHERE id = NEW.resource_id;
    IF NEW.user_id IS NOT DISTINCT FROM v_sub THEN RETURN NULL; END IF;  -- A1
    SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
    PERFORM public.record_engagement_event(NEW.user_id,'resource_bookmark','resource',NEW.resource_id,'resource_bookmarks',NEW.user_id::text||':'||NEW.resource_id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('resource_bookmark', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_resource_bookmark ON public.resource_bookmarks;
CREATE TRIGGER trg_engagement_resource_bookmark AFTER INSERT ON public.resource_bookmarks FOR EACH ROW EXECUTE FUNCTION public.engagement_on_resource_bookmark();

-- saved_resource -> PRIVATE; A1 own resource earns nothing.
CREATE OR REPLACE FUNCTION public.engagement_on_saved_resource()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_sub uuid;
BEGIN
  BEGIN
    IF NEW.resource_id IS NULL THEN RETURN NULL; END IF;
    SELECT submitted_by INTO v_sub FROM public.resources WHERE id = NEW.resource_id;
    IF NEW.user_id IS NOT DISTINCT FROM v_sub THEN RETURN NULL; END IF;  -- A1
    SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
    PERFORM public.record_engagement_event(NEW.user_id,'saved_resource','resource',NEW.resource_id,'saved_resources',NEW.user_id::text||':'||NEW.resource_id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('saved_resource', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_saved_resource ON public.saved_resources;
CREATE TRIGGER trg_engagement_saved_resource AFTER INSERT ON public.saved_resources FOR EACH ROW EXECUTE FUNCTION public.engagement_on_saved_resource();

-- opt_in INSERT -> A2: a seeker opting in is an outside engagement, credit the post author.
CREATE OR REPLACE FUNCTION public.engagement_on_opt_in_insert()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    PERFORM public.credit_post_created(NEW.post_id, NEW.seeker_id);  -- A2
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('opt_in_insert', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_opt_in_insert ON public.resource_opt_ins;
CREATE TRIGGER trg_engagement_opt_in_insert AFTER INSERT ON public.resource_opt_ins FOR EACH ROW EXECUTE FUNCTION public.engagement_on_opt_in_insert();

-- opt_in UPDATE -> completed: provider (public) + seeker (private); decline marker.
CREATE OR REPLACE FUNCTION public.engagement_on_opt_in()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_author uuid;
BEGIN
  BEGIN
    IF OLD.status = 'accepted' AND NEW.status = 'completed' THEN
      SELECT user_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
      PERFORM 1 FROM public.profiles WHERE id IN (v_author, NEW.seeker_id) ORDER BY id FOR NO KEY UPDATE;
      SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
      PERFORM public.record_engagement_event(v_author,'opt_in_completed_provider','opt_in',NEW.id,'resource_opt_ins',NEW.id::text,v_family,false);
      PERFORM public.record_engagement_event(NEW.seeker_id,'opt_in_completed_seeker','opt_in',NEW.id,'resource_opt_ins',NEW.id::text,v_family,false);
    END IF;
    IF NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
      SELECT user_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
      IF v_author IS NOT NULL THEN
        INSERT INTO public.opt_in_declines (author_id, seeker_id) VALUES (v_author, NEW.seeker_id)
        ON CONFLICT (author_id, seeker_id) DO UPDATE SET last_declined_at = now(),
          times_declined = public.opt_in_declines.times_declined + 1;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('opt_in', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_opt_in ON public.resource_opt_ins;
CREATE TRIGGER trg_engagement_opt_in AFTER UPDATE ON public.resource_opt_ins FOR EACH ROW EXECUTE FUNCTION public.engagement_on_opt_in();

-- conversation completed -> volunteer (public) + requester (private).
CREATE OR REPLACE FUNCTION public.engagement_on_conversation()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      PERFORM 1 FROM public.profiles WHERE id IN (NEW.volunteer_id, NEW.requester_id) ORDER BY id FOR NO KEY UPDATE;
      SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
      PERFORM public.record_engagement_event(NEW.volunteer_id,'conversation_completed_volunteer','conversation',NEW.id,'conversations',NEW.id::text,v_family,false);
      PERFORM public.record_engagement_event(NEW.requester_id,'conversation_completed_requester','conversation',NEW.id,'conversations',NEW.id::text,v_family,false);
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('conversation', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_conversation ON public.conversations;
CREATE TRIGGER trg_engagement_conversation AFTER UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.engagement_on_conversation();

-- review -> review_received (PRIVATE, peer-verified), keyed on the anchor.
CREATE OR REPLACE FUNCTION public.engagement_on_review()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    IF NEW.opt_in_id IS NOT NULL THEN
      SELECT public.engagement_category_family(r.category) INTO v_family
      FROM public.resource_opt_ins oi LEFT JOIN public.resources r ON r.id = oi.resource_id WHERE oi.id = NEW.opt_in_id;
    ELSIF NEW.conversation_id IS NOT NULL THEN
      SELECT public.engagement_category_family(r.category) INTO v_family
      FROM public.conversations c JOIN public.resources r ON r.id = c.resource_id WHERE c.id = NEW.conversation_id;
    END IF;
    PERFORM public.record_engagement_event(NEW.reviewee_id,'review_received','review',COALESCE(NEW.opt_in_id, NEW.conversation_id),'reviews',COALESCE(NEW.opt_in_id, NEW.conversation_id)::text,v_family,true);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('review', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_review ON public.reviews;
CREATE TRIGGER trg_engagement_review AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.engagement_on_review();

-- safety_alert verified -> Watcher (public); admin; not self-verified.
CREATE OR REPLACE FUNCTION public.engagement_on_safety_alert_verify()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    IF NEW.verified IS TRUE AND OLD.verified IS DISTINCT FROM TRUE
       AND NEW.created_by IS NOT NULL AND NEW.verified_by IS NOT NULL AND NEW.verified_by <> NEW.created_by THEN
      PERFORM public.record_engagement_event(NEW.created_by,'safety_alert_verified','safety_alert',NEW.id,'safety_alerts',NEW.id::text,NULL,true);
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('safety_alert_verify', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_safety_alert_verify ON public.safety_alerts;
CREATE TRIGGER trg_engagement_safety_alert_verify AFTER UPDATE ON public.safety_alerts FOR EACH ROW EXECUTE FUNCTION public.engagement_on_safety_alert_verify();

-- resource approved -> public; admin; not self-approved.
CREATE OR REPLACE FUNCTION public.engagement_on_resource_approved()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved'
       AND NEW.submitted_by IS NOT NULL AND NEW.moderated_by IS NOT NULL AND NEW.moderated_by <> NEW.submitted_by THEN
      v_family := public.engagement_category_family(NEW.category);
      PERFORM public.record_engagement_event(NEW.submitted_by,'resource_approved','resource',NEW.id,'resources',NEW.id::text,v_family,true);
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('resource_approved', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_resource_approved ON public.resources;
CREATE TRIGGER trg_engagement_resource_approved AFTER UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.engagement_on_resource_approved();

-- ============================================================================
-- 8. I5 — UNBLOCK (delete-and-requeue; slot restored exactly once; P2.0 graph untouched)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.unblock_opt_in(p_opt_in_id uuid)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_status  text;
  v_author  uuid;
  v_post_id uuid;
  v_post    public.posts%ROWTYPE;
  v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  SELECT oi.status, oi.post_id, p.user_id INTO v_status, v_post_id, v_author
  FROM public.resource_opt_ins oi JOIN public.posts p ON p.id = oi.post_id WHERE oi.id = p_opt_in_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Opt-in not found'; END IF;
  IF v_author IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the post author may unblock this opt-in' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'declined' THEN
    RAISE EXCEPTION 'Only a declined opt-in can be unblocked' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_post FROM public.posts WHERE id = v_post_id FOR UPDATE;
  DELETE FROM public.resource_opt_ins WHERE id = p_opt_in_id AND status = 'declined';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted > 0 AND v_post.max_seekers IS NOT NULL THEN
    UPDATE public.posts SET slots_remaining = LEAST(slots_remaining + 1, v_post.max_seekers) WHERE id = v_post_id;
  END IF;
  RETURN v_deleted > 0;
END;
$fn$;

-- ============================================================================
-- 9. RLS + GRANTS (I2 + I4 + B2)
-- ============================================================================
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_events_select_own ON public.engagement_events;
CREATE POLICY engagement_events_select_own ON public.engagement_events
  FOR SELECT TO authenticated USING (actor_id = (SELECT auth.uid()));
REVOKE ALL ON public.engagement_events FROM anon, authenticated;
GRANT SELECT ON public.engagement_events TO authenticated;

ALTER TABLE public.user_engagement_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_engagement_counters_select_own ON public.user_engagement_counters;
CREATE POLICY user_engagement_counters_select_own ON public.user_engagement_counters
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.user_engagement_counters FROM anon, authenticated;
GRANT SELECT ON public.user_engagement_counters TO authenticated;

ALTER TABLE public.badge_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS badge_config_select_all ON public.badge_config;
CREATE POLICY badge_config_select_all ON public.badge_config FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.badge_config FROM anon, authenticated;
GRANT SELECT ON public.badge_config TO anon, authenticated;

ALTER TABLE public.opt_in_declines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opt_in_declines_select_author ON public.opt_in_declines;
CREATE POLICY opt_in_declines_select_author ON public.opt_in_declines
  FOR SELECT TO authenticated USING (author_id = (SELECT auth.uid()));
REVOKE ALL ON public.opt_in_declines FROM anon, authenticated;
GRANT SELECT ON public.opt_in_declines TO authenticated;

-- B2: private summary — owner SELECT only, no client writes, not published, no embed path.
ALTER TABLE public.user_private_badge_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_private_badge_summary_select_own ON public.user_private_badge_summary;
CREATE POLICY user_private_badge_summary_select_own ON public.user_private_badge_summary
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.user_private_badge_summary FROM anon, authenticated;
GRANT SELECT ON public.user_private_badge_summary TO authenticated;

GRANT SELECT (badge_summary) ON public.profiles TO anon, authenticated;

-- ============================================================================
-- 10. FUNCTION EXECUTE GRANTS
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.record_engagement_event(uuid,text,text,uuid,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_post_created(uuid, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_badge_summary(uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_private_badge_summary(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_summary_for(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_two_profiles(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_engagement(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_all_badge_summaries()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_engagement(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_engagement_failure(text, text)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.badge_config_recompute()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_post_like()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_poll_vote()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_follow()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_comment()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_petition_signature()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_event_checkin()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_safety_alert_vote()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_message()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_resource_bookmark()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_saved_resource()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_opt_in_insert()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_opt_in()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_conversation()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_review()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_safety_alert_verify()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_resource_approved()       FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recompute_badge_summary(uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_private_badge_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_user_engagement(uuid)       TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_badge_summaries()       TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_engagement(uuid)            TO service_role;

GRANT EXECUTE ON FUNCTION public.engagement_category_family(public.resource_category) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_family_from_chip(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_level(integer)         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_weight(text)           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_community_dim(text)    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_is_public(text)        TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.unblock_opt_in(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unblock_opt_in(uuid) TO authenticated;

-- ============================================================================
-- 11. NIGHTLY MISSED-CREDIT RECOVERY (pg_cron, guarded + idempotent)
-- ============================================================================
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'engagement_reconcile_nightly') THEN
      PERFORM cron.unschedule('engagement_reconcile_nightly');
    END IF;
    PERFORM cron.schedule('engagement_reconcile_nightly', '27 4 * * *', 'SELECT public.reconcile_engagement();');
  END IF;
END;
$cron$;

-- ============================================================================
-- 12. ONE-TIME IDEMPOTENT BACKFILL (same rules, incl. A1/A2 + public/private split).
-- ============================================================================
SELECT public.reconcile_engagement(NULL);

COMMIT;
