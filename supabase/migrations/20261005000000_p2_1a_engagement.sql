-- 20261005000000_p2_1a_engagement.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-p2-1a-engagement
--
-- Builds the P2.1a engagement subsystem on top of the P2.0 integrity floor
-- (20261004000000): an append-only engagement ledger, per-user counters, a tunable
-- single-row badge_config, a public badge_summary on profiles, and the opt-in unblock
-- flow with a private per-author decline marker.
--
-- Replay-safe on PG15 (local) and PG17 (prod): every statement is idempotent
-- (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE /
-- DROP ... IF EXISTS / guarded policy creation). No PG16/17-only syntax.
--
-- ============================================================================
-- INVARIANTS
--   I1  LEDGER EXACTLY-ONCE. Each qualifying fact credits exactly ONE row via
--       UNIQUE(actor_id, kind, target_id) + ON CONFLICT DO NOTHING. Delete-and-redo of
--       any user-reversible source (like, comment, vote, follow, bookmark, save, message,
--       post) never re-awards because the target key is stable (the post / poll / resource
--       / conversation / petition), not the deletable child row. State-transition kinds
--       fire on the transition INTO the qualifying state only. Guests
--       (auth.users.is_anonymous) and NULL actors produce no row. Source-row deletes never
--       remove ledger rows.
--   I2  SERVER-ONLY WRITES. engagement_events / user_engagement_counters / badge_config /
--       opt_in_declines / profiles.badge_summary carry NO client write policy and
--       table-level REVOKE ALL. Only SECDEF trigger fns (owned by postgres) write them.
--   I3  SUMMARY = recompute(counters, config), under concurrency. recompute_badge_summary
--       locks the profile row (FOR UPDATE) before rebuilding; two-party events lock both
--       profiles in uuid order (deadlock-safe). Rewritten only when the value changes.
--   I4  READ PATHS UNBROKEN. profiles has column-only grants; badge_summary gets an
--       explicit GRANT SELECT to anon+authenticated. profiles is not in supabase_realtime.
--   I5  UNBLOCK. unblock_opt_in (author-only, declined-only) DELETEs the declined opt-in
--       and restores the slot; the seeker may then opt in again themselves via
--       opt_in_to_post. The transition graph is untouched (P2.0 forward-only holds).
--   I7  CORE-FIRST. A ledger failure never aborts the user's source write: every
--       engagement trigger body runs in a BEGIN/EXCEPTION subtransaction that RAISE
--       WARNINGs (and best-effort app_logs) instead of propagating. reconcile_engagement()
--       re-derives missed events idempotently from the source tables.
--
-- ============================================================================
-- I1 DERIVATION TABLE (as built)
-- kind                      | source              | event (condition)                     | actor(s)                       | target (STABLE key)            | family path                                     | verified   | weight
-- --------------------------|---------------------|---------------------------------------|--------------------------------|--------------------------------|-------------------------------------------------|------------|-------
-- like                      | post_likes          | AFTER INSERT                          | user_id                        | post_id                        | post.resource_id->category->family              | no         | 1
-- poll_vote                 | poll_votes          | AFTER INSERT                          | user_id                        | poll_id                        | poll.post->resource->category->family           | no         | 1
-- follow                    | follows             | AFTER INSERT                          | follower_id                    | following_id                   | none                                            | no         | 1
-- comment                   | post_comments       | AFTER INSERT (is_hidden not true)     | user_id                        | POST_ID (once per post)        | post.resource->category->family                 | no         | 1
-- petition_signature        | petition_signatures | AFTER INSERT                          | signer_id                      | petition_id                    | none                                            | no         | 1
-- post_created              | posts               | AFTER INSERT                          | user_id                        | post.id                        | resource->family OR post chip (metadata)        | no         | 1
-- event_checkin             | event_checkins      | AFTER INSERT (user_id not null)       | user_id (attendee)             | occurrence_id                  | none                                            | no         | 1
-- safety_alert_vote         | safety_alert_votes  | AFTER INSERT                          | voter_id                       | alert_id                       | none                                            | no         | 1
-- message                   | messages            | AFTER INSERT                          | sender_id                      | conversation_id (once/convo)   | none                                            | no         | 1
-- resource_bookmark         | resource_bookmarks  | AFTER INSERT                          | user_id                        | resource_id                    | resource.category->family                       | no         | 1
-- saved_resource            | saved_resources     | AFTER INSERT (resource_id not null)   | user_id                        | resource_id                    | resource.category->family                       | no         | 1
-- opt_in_completed_provider | resource_opt_ins    | AFTER UPDATE (accepted->completed)    | post author (posts.user_id)    | opt_in.id                      | opt_in.resource->category->family               | no         | 3
-- opt_in_completed_seeker   | resource_opt_ins    | AFTER UPDATE (accepted->completed)    | seeker_id                      | opt_in.id                      | opt_in.resource->category->family               | no         | 2
-- conversation_completed    | conversations       | AFTER UPDATE (active->completed)      | volunteer_id AND requester_id  | conversation.id                | conversation.resource->category->family (100%)  | no         | 3
-- review_received           | reviews             | AFTER INSERT                          | reviewee_id                    | COALESCE(opt_in_id,conv_id)*   | anchor->resource->category->family              | yes (peer) | 3
-- safety_alert_verified     | safety_alerts       | AFTER UPDATE (verified false->true, verified_by<>created_by) | created_by | alert.id      | none                                            | yes (admin)| 1
-- resource_approved         | resources           | AFTER UPDATE (->approved, submitted_by set, moderated_by<>submitted_by) | submitted_by | resource.id | resource.category->family                       | yes (admin)| 3
-- appreciation_gift         | (reserved P2.1b)    | none yet                              | recipient                      | giver                          | none                                            | no         | (reserved)
--
-- * review_received keys on the ANCHOR (opt_in_id/conversation_id) per reviewee, NOT on
--   reviews.id, so a delete+resubmit of the same review cannot re-award (review farm).
-- Self-verification earns nothing: resource_approved skips moderated_by=submitted_by;
--   safety_alert_verified skips verified_by=created_by (also applied in the backfill).
-- Completed opt-in credits BOTH parties; completed conversation credits both participants.
-- verified=true only for reviews (peer) + admin approvals; P3 admin eligibility reads those.
-- ============================================================================

BEGIN;

-- ── 0. Category-family crosswalks ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.engagement_category_family(p_category public.resource_category)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_category
    WHEN 'food' THEN 'food'
    WHEN 'housing' THEN 'housing'
    WHEN 'free_camping' THEN 'housing'
    WHEN 'clothing' THEN 'goods'
    WHEN 'free_goods_donation' THEN 'goods'
    WHEN 'waste_disposal' THEN 'goods'
    WHEN 'transportation' THEN 'transit'
    WHEN 'healthcare' THEN 'health'
    WHEN 'mental_health' THEN 'health'
    WHEN 'substance_abuse' THEN 'health'
    WHEN 'prenatal_natal_care' THEN 'health'
    WHEN 'financial' THEN 'money'
    WHEN 'eitc_tax_filing' THEN 'money'
    WHEN 'utilities' THEN 'money'
    WHEN 'childcare' THEN 'care'
    WHEN 'senior_services' THEN 'care'
    WHEN 'disability_services' THEN 'care'
    WHEN 'veteran_services' THEN 'care'
    WHEN 'domestic_violence' THEN 'care'
    WHEN 'education' THEN 'education'
    WHEN 'employment' THEN 'work'
    WHEN 'legal' THEN 'legal'
    WHEN 'free_legal' THEN 'legal'
    WHEN 'immigration' THEN 'legal'
    ELSE NULL  -- 'other' and any future unmapped value
  END;
$fn$;

-- A post-type-wizard chip (Food/Housing/Goods/Transit/Health/Money/Care/Education/Work/
-- Legal) is already a family name; lowercase + validate against the 10 families.
CREATE OR REPLACE FUNCTION public.engagement_family_from_chip(p_chip text)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE lower(coalesce(p_chip, ''))
    WHEN 'food' THEN 'food' WHEN 'housing' THEN 'housing' WHEN 'goods' THEN 'goods'
    WHEN 'transit' THEN 'transit' WHEN 'health' THEN 'health' WHEN 'money' THEN 'money'
    WHEN 'care' THEN 'care' WHEN 'education' THEN 'education' WHEN 'work' THEN 'work'
    WHEN 'legal' THEN 'legal' ELSE NULL END;
$fn$;

-- Weight per kind (single source of truth, shared by record + reconcile).
CREATE OR REPLACE FUNCTION public.engagement_weight(p_kind text)
  RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_kind
    WHEN 'opt_in_completed_provider' THEN 3
    WHEN 'opt_in_completed_seeker'   THEN 2
    WHEN 'conversation_completed'    THEN 3
    WHEN 'review_received'           THEN 3
    WHEN 'resource_approved'         THEN 3
    ELSE 1
  END;
$fn$;

-- Community-badge dimension per kind (shared by record + recompute_user_engagement).
CREATE OR REPLACE FUNCTION public.engagement_community_dim(p_kind text)
  RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_kind
    WHEN 'comment'                   THEN 'badge:voice'
    WHEN 'opt_in_completed_provider' THEN 'badge:helper'
    WHEN 'conversation_completed'    THEN 'badge:connector'
    WHEN 'petition_signature'        THEN 'badge:advocate'
    WHEN 'safety_alert_verified'     THEN 'badge:watcher'
    ELSE NULL
  END;
$fn$;

-- ── 1. badge_config (single-row tunable thresholds) ─────────────────────────
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
    'opt_in_completed_provider','opt_in_completed_seeker','conversation_completed',
    'review_received','safety_alert_verified','resource_approved','appreciation_gift'
  )),
  CONSTRAINT engagement_events_once UNIQUE (actor_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_engagement_events_actor ON public.engagement_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_verified ON public.engagement_events (actor_id, verified) WHERE verified;

-- ── 3. user_engagement_counters ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_engagement_counters (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dimension  text        NOT NULL,
  count      integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dimension)
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

-- ── 5. profiles.badge_summary ───────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badge_summary jsonb;

-- ============================================================================
-- 6. WRITE PATH — SECURITY DEFINER helpers
-- ============================================================================

-- 6a. Level from accumulated points (single-row config).
CREATE OR REPLACE FUNCTION public.engagement_level(p_points integer)
  RETURNS integer LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
    WHEN p_points >= c.level3_threshold THEN 3
    WHEN p_points >= c.level2_threshold THEN 2
    WHEN p_points >= c.level1_threshold THEN 1
    ELSE 0
  END
  FROM public.badge_config c WHERE c.singleton_guard;
$fn$;

-- 6b. Best-effort failure log (I7). RAISE WARNING always; app_logs is a bonus.
CREATE OR REPLACE FUNCTION public.log_engagement_failure(p_context text, p_detail text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  RAISE WARNING 'engagement ledger skipped (%): %', p_context, p_detail;
  BEGIN
    INSERT INTO public.app_logs (level, event, context)
    VALUES ('warn', 'engagement.ledger.skipped',
            jsonb_build_object('context', p_context, 'detail', p_detail));
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- logging must never itself abort the source write
  END;
END;
$fn$;

-- 6c. Rebuild profiles.badge_summary for one user (I3). Locks the profile row FIRST to
--     serialise concurrent crediting. No updated_at key (timing-leak fix); the row is
--     rewritten only when the computed value changes, so profiles.updated_at bumps only
--     on a real level/count change.
CREATE OR REPLACE FUNCTION public.recompute_badge_summary(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_families jsonb;
  v_badges   jsonb;
  v_new      jsonb;
  v_current  jsonb;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user FOR UPDATE;

  SELECT
    COALESCE(jsonb_object_agg(substr(dimension, 8),
             jsonb_build_object('count', count, 'level', public.engagement_level(count)))
             FILTER (WHERE dimension LIKE 'family:%' AND public.engagement_level(count) > 0), '{}'::jsonb),
    COALESCE(jsonb_object_agg(substr(dimension, 7),
             jsonb_build_object('count', count, 'level', public.engagement_level(count)))
             FILTER (WHERE dimension LIKE 'badge:%' AND public.engagement_level(count) > 0), '{}'::jsonb)
  INTO v_families, v_badges
  FROM public.user_engagement_counters
  WHERE user_id = p_user;

  v_new := jsonb_build_object('families', v_families, 'badges', v_badges);

  SELECT badge_summary INTO v_current FROM public.profiles WHERE id = p_user;
  IF v_current IS DISTINCT FROM v_new THEN
    UPDATE public.profiles SET badge_summary = v_new WHERE id = p_user;
  END IF;
END;
$fn$;

-- 6d. Single write primitive. Exactly-once via ON CONFLICT DO NOTHING; guests/NULL actors
--     produce no row. p_family is the resolved family key (or NULL).
CREATE OR REPLACE FUNCTION public.record_engagement_event(
  p_actor uuid, p_kind text, p_target_type text, p_target_id uuid,
  p_source_table text, p_source_pk text, p_family text, p_verified boolean)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_weight    integer := public.engagement_weight(p_kind);
  v_community text    := public.engagement_community_dim(p_kind);
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
    INSERT INTO public.user_engagement_counters (user_id, dimension, count, updated_at)
    VALUES (p_actor, 'family:' || p_family, v_weight, now())
    ON CONFLICT (user_id, dimension)
      DO UPDATE SET count = public.user_engagement_counters.count + v_weight, updated_at = now();
  END IF;

  IF v_community IS NOT NULL THEN
    INSERT INTO public.user_engagement_counters (user_id, dimension, count, updated_at)
    VALUES (p_actor, v_community, 1, now())
    ON CONFLICT (user_id, dimension)
      DO UPDATE SET count = public.user_engagement_counters.count + 1, updated_at = now();
  END IF;

  PERFORM public.recompute_badge_summary(p_actor);
END;
$fn$;

-- 6e. Full recompute from the ledger (rebuild counters, then summary). Source of truth
--     the incremental path must always equal (I3).
CREATE OR REPLACE FUNCTION public.recompute_user_engagement(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  DELETE FROM public.user_engagement_counters WHERE user_id = p_user;

  INSERT INTO public.user_engagement_counters (user_id, dimension, count, updated_at)
  SELECT actor_id, 'family:' || category, SUM(weight), now()
  FROM public.engagement_events
  WHERE actor_id = p_user AND category IS NOT NULL
  GROUP BY actor_id, category;

  INSERT INTO public.user_engagement_counters (user_id, dimension, count, updated_at)
  SELECT actor_id, public.engagement_community_dim(kind), COUNT(*), now()
  FROM public.engagement_events
  WHERE actor_id = p_user AND public.engagement_community_dim(kind) IS NOT NULL
  GROUP BY actor_id, public.engagement_community_dim(kind);

  PERFORM public.recompute_badge_summary(p_user);
END;
$fn$;

-- 6f. Recompute every user's summary (a config threshold change).
CREATE OR REPLACE FUNCTION public.recompute_all_badge_summaries()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_user uuid;
BEGIN
  FOR v_user IN SELECT DISTINCT user_id FROM public.user_engagement_counters LOOP
    PERFORM public.recompute_badge_summary(v_user);
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

-- 6g. reconcile_engagement — re-derive missed events idempotently from the source tables
--     (I7 recovery + one-time backfill). Same ON CONFLICT keys, weights, family and
--     self-verification guards as the incremental path, so it can never double-award.
--     service_role / admin only. p_user NULL = all users.
CREATE OR REPLACE FUNCTION public.reconcile_engagement(p_user uuid DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE r record; v_family text; v_author uuid; v_u uuid;
BEGIN
  -- like
  FOR r IN SELECT pl.user_id, pl.post_id, p.resource_id FROM public.post_likes pl
           JOIN public.posts p ON p.id = pl.post_id
           WHERE p_user IS NULL OR pl.user_id = p_user LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'like','post',r.post_id,'post_likes',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- poll_vote
  FOR r IN SELECT pv.user_id, pv.poll_id, p.resource_id FROM public.poll_votes pv
           JOIN public.polls pl ON pl.id = pv.poll_id JOIN public.posts p ON p.id = pl.post_id
           WHERE p_user IS NULL OR pv.user_id = p_user LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'poll_vote','poll',r.poll_id,'poll_votes',r.user_id::text||':'||r.poll_id::text,v_family,false);
  END LOOP;
  -- follow
  FOR r IN SELECT follower_id, following_id FROM public.follows WHERE p_user IS NULL OR follower_id = p_user LOOP
    PERFORM public.record_engagement_event(r.follower_id,'follow','user',r.following_id,'follows',r.follower_id::text||':'||r.following_id::text,NULL,false);
  END LOOP;
  -- comment (once per post; visible only)
  FOR r IN SELECT DISTINCT pc.user_id, pc.post_id, p.resource_id FROM public.post_comments pc
           JOIN public.posts p ON p.id = pc.post_id
           WHERE (pc.is_hidden IS NOT TRUE) AND (p_user IS NULL OR pc.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'comment','post',r.post_id,'post_comments',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- petition_signature
  FOR r IN SELECT signer_id, petition_id FROM public.petition_signatures WHERE p_user IS NULL OR signer_id = p_user LOOP
    PERFORM public.record_engagement_event(r.signer_id,'petition_signature','petition',r.petition_id,'petition_signatures',r.signer_id::text||':'||r.petition_id::text,NULL,false);
  END LOOP;
  -- post_created (resource family, else post chip)
  FOR r IN SELECT id, user_id, resource_id, metadata FROM public.posts WHERE p_user IS NULL OR user_id = p_user LOOP
    v_family := NULL;
    IF r.resource_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    END IF;
    IF v_family IS NULL AND r.metadata ? 'categories' AND jsonb_typeof(r.metadata->'categories') = 'array'
       AND jsonb_array_length(r.metadata->'categories') > 0 THEN
      v_family := public.engagement_family_from_chip(r.metadata->'categories'->>0);
    END IF;
    PERFORM public.record_engagement_event(r.user_id,'post_created','post',r.id,'posts',r.id::text,v_family,false);
  END LOOP;
  -- event_checkin (attendee, user_id not null)
  FOR r IN SELECT user_id, occurrence_id FROM public.event_checkins WHERE user_id IS NOT NULL AND (p_user IS NULL OR user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'event_checkin','event',r.occurrence_id,'event_checkins',r.user_id::text||':'||r.occurrence_id::text,NULL,false);
  END LOOP;
  -- safety_alert_vote
  FOR r IN SELECT voter_id, alert_id FROM public.safety_alert_votes WHERE p_user IS NULL OR voter_id = p_user LOOP
    PERFORM public.record_engagement_event(r.voter_id,'safety_alert_vote','safety_alert',r.alert_id,'safety_alert_votes',r.voter_id::text||':'||r.alert_id::text,NULL,false);
  END LOOP;
  -- message (once per conversation)
  FOR r IN SELECT DISTINCT sender_id, conversation_id FROM public.messages WHERE p_user IS NULL OR sender_id = p_user LOOP
    PERFORM public.record_engagement_event(r.sender_id,'message','conversation',r.conversation_id,'messages',r.sender_id::text||':'||r.conversation_id::text,NULL,false);
  END LOOP;
  -- resource_bookmark
  FOR r IN SELECT rb.user_id, rb.resource_id, res.category FROM public.resource_bookmarks rb
           JOIN public.resources res ON res.id = rb.resource_id
           WHERE p_user IS NULL OR rb.user_id = p_user LOOP
    PERFORM public.record_engagement_event(r.user_id,'resource_bookmark','resource',r.resource_id,'resource_bookmarks',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- saved_resource (resource_id not null)
  FOR r IN SELECT sr.user_id, sr.resource_id, res.category FROM public.saved_resources sr
           JOIN public.resources res ON res.id = sr.resource_id
           WHERE sr.resource_id IS NOT NULL AND (p_user IS NULL OR sr.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'saved_resource','resource',r.resource_id,'saved_resources',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- opt_in completed (both parties)
  FOR r IN SELECT oi.id, oi.seeker_id, oi.resource_id, p.user_id AS author FROM public.resource_opt_ins oi
           JOIN public.posts p ON p.id = oi.post_id
           WHERE oi.status = 'completed' AND (p_user IS NULL OR oi.seeker_id = p_user OR p.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.author,'opt_in_completed_provider','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.seeker_id,'opt_in_completed_seeker','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
  END LOOP;
  -- conversation completed (both participants)
  FOR r IN SELECT c.id, c.volunteer_id, c.requester_id, c.resource_id FROM public.conversations c
           WHERE c.status = 'completed' AND (p_user IS NULL OR c.volunteer_id = p_user OR c.requester_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.volunteer_id,'conversation_completed','conversation',r.id,'conversations',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.requester_id,'conversation_completed','conversation',r.id,'conversations',r.id::text,v_family,false);
  END LOOP;
  -- review_received (keyed on anchor; peer-verified)
  FOR r IN SELECT id, reviewee_id, opt_in_id, conversation_id FROM public.reviews
           WHERE p_user IS NULL OR reviewee_id = p_user LOOP
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
  -- safety_alert_verified (admin; not self-verified)
  FOR r IN SELECT id, created_by FROM public.safety_alerts
           WHERE verified IS TRUE AND created_by IS NOT NULL AND verified_by IS NOT NULL AND verified_by <> created_by
             AND (p_user IS NULL OR created_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.created_by,'safety_alert_verified','safety_alert',r.id,'safety_alerts',r.id::text,NULL,true);
  END LOOP;
  -- resource_approved (admin; not self-approved)
  FOR r IN SELECT id, submitted_by, category FROM public.resources
           WHERE status = 'approved' AND submitted_by IS NOT NULL AND moderated_by IS NOT NULL AND moderated_by <> submitted_by
             AND (p_user IS NULL OR submitted_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.submitted_by,'resource_approved','resource',r.id,'resources',r.id::text,public.engagement_category_family(r.category),true);
  END LOOP;
END;
$fn$;

-- ============================================================================
-- 7. SOURCE TRIGGERS (each I7-wrapped: a ledger failure never aborts the source write)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.engagement_on_post_like()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.posts p LEFT JOIN public.resources r ON r.id = p.resource_id WHERE p.id = NEW.post_id;
    PERFORM public.record_engagement_event(NEW.user_id,'like','post',NEW.post_id,'post_likes',NEW.user_id::text||':'||NEW.post_id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('post_like', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_post_like ON public.post_likes;
CREATE TRIGGER trg_engagement_post_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.engagement_on_post_like();

CREATE OR REPLACE FUNCTION public.engagement_on_poll_vote()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.polls pl JOIN public.posts p ON p.id = pl.post_id LEFT JOIN public.resources r ON r.id = p.resource_id WHERE pl.id = NEW.poll_id;
    PERFORM public.record_engagement_event(NEW.user_id,'poll_vote','poll',NEW.poll_id,'poll_votes',NEW.user_id::text||':'||NEW.poll_id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('poll_vote', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_poll_vote ON public.poll_votes;
CREATE TRIGGER trg_engagement_poll_vote AFTER INSERT ON public.poll_votes FOR EACH ROW EXECUTE FUNCTION public.engagement_on_poll_vote();

CREATE OR REPLACE FUNCTION public.engagement_on_follow()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    PERFORM public.record_engagement_event(NEW.follower_id,'follow','user',NEW.following_id,'follows',NEW.follower_id::text||':'||NEW.following_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('follow', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_follow ON public.follows;
CREATE TRIGGER trg_engagement_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.engagement_on_follow();

-- comment: Voice once per (actor, POST) — a delete + re-post on the same post never re-awards.
CREATE OR REPLACE FUNCTION public.engagement_on_comment()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    IF NEW.is_hidden IS TRUE THEN RETURN NULL; END IF;
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.posts p LEFT JOIN public.resources r ON r.id = p.resource_id WHERE p.id = NEW.post_id;
    PERFORM public.record_engagement_event(NEW.user_id,'comment','post',NEW.post_id,'post_comments',NEW.user_id::text||':'||NEW.post_id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('comment', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_comment ON public.post_comments;
CREATE TRIGGER trg_engagement_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.engagement_on_comment();

CREATE OR REPLACE FUNCTION public.engagement_on_petition_signature()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    PERFORM public.record_engagement_event(NEW.signer_id,'petition_signature','petition',NEW.petition_id,'petition_signatures',NEW.signer_id::text||':'||NEW.petition_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('petition_signature', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_petition_signature ON public.petition_signatures;
CREATE TRIGGER trg_engagement_petition_signature AFTER INSERT ON public.petition_signatures FOR EACH ROW EXECUTE FUNCTION public.engagement_on_petition_signature();

CREATE OR REPLACE FUNCTION public.engagement_on_post_created()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    v_family := NULL;
    IF NEW.resource_id IS NOT NULL THEN
      SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
    END IF;
    IF v_family IS NULL AND NEW.metadata ? 'categories' AND jsonb_typeof(NEW.metadata->'categories') = 'array'
       AND jsonb_array_length(NEW.metadata->'categories') > 0 THEN
      v_family := public.engagement_family_from_chip(NEW.metadata->'categories'->>0);
    END IF;
    PERFORM public.record_engagement_event(NEW.user_id,'post_created','post',NEW.id,'posts',NEW.id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('post_created', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_post_created ON public.posts;
CREATE TRIGGER trg_engagement_post_created AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.engagement_on_post_created();

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

CREATE OR REPLACE FUNCTION public.engagement_on_safety_alert_vote()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  BEGIN
    PERFORM public.record_engagement_event(NEW.voter_id,'safety_alert_vote','safety_alert',NEW.alert_id,'safety_alert_votes',NEW.voter_id::text||':'||NEW.alert_id::text,NULL,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('safety_alert_vote', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_safety_alert_vote ON public.safety_alert_votes;
CREATE TRIGGER trg_engagement_safety_alert_vote AFTER INSERT ON public.safety_alert_votes FOR EACH ROW EXECUTE FUNCTION public.engagement_on_safety_alert_vote();

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

CREATE OR REPLACE FUNCTION public.engagement_on_resource_bookmark()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
    PERFORM public.record_engagement_event(NEW.user_id,'resource_bookmark','resource',NEW.resource_id,'resource_bookmarks',NEW.user_id::text||':'||NEW.resource_id::text,v_family,false);
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('resource_bookmark', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_resource_bookmark ON public.resource_bookmarks;
CREATE TRIGGER trg_engagement_resource_bookmark AFTER INSERT ON public.resource_bookmarks FOR EACH ROW EXECUTE FUNCTION public.engagement_on_resource_bookmark();

CREATE OR REPLACE FUNCTION public.engagement_on_saved_resource()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    IF NEW.resource_id IS NOT NULL THEN
      SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
      PERFORM public.record_engagement_event(NEW.user_id,'saved_resource','resource',NEW.resource_id,'saved_resources',NEW.user_id::text||':'||NEW.resource_id::text,v_family,false);
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('saved_resource', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_saved_resource ON public.saved_resources;
CREATE TRIGGER trg_engagement_saved_resource AFTER INSERT ON public.saved_resources FOR EACH ROW EXECUTE FUNCTION public.engagement_on_saved_resource();

-- opt-in: completed (both parties, two-profile lock in uuid order) + decline marker.
CREATE OR REPLACE FUNCTION public.engagement_on_opt_in()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text; v_author uuid;
BEGIN
  BEGIN
    IF OLD.status = 'accepted' AND NEW.status = 'completed' THEN
      SELECT user_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
      PERFORM 1 FROM public.profiles WHERE id IN (v_author, NEW.seeker_id) ORDER BY id FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.engagement_on_conversation()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_family text;
BEGIN
  BEGIN
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      PERFORM 1 FROM public.profiles WHERE id IN (NEW.volunteer_id, NEW.requester_id) ORDER BY id FOR UPDATE;
      SELECT public.engagement_category_family(r.category) INTO v_family FROM public.resources r WHERE r.id = NEW.resource_id;
      PERFORM public.record_engagement_event(NEW.volunteer_id,'conversation_completed','conversation',NEW.id,'conversations',NEW.id::text,v_family,false);
      PERFORM public.record_engagement_event(NEW.requester_id,'conversation_completed','conversation',NEW.id,'conversations',NEW.id::text,v_family,false);
    END IF;
  EXCEPTION WHEN OTHERS THEN PERFORM public.log_engagement_failure('conversation', SQLERRM); END;
  RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS trg_engagement_conversation ON public.conversations;
CREATE TRIGGER trg_engagement_conversation AFTER UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.engagement_on_conversation();

-- review: keyed on the ANCHOR (opt_in_id/conversation_id), so delete+resubmit never re-awards.
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

-- safety alert verified: admin fact, and NOT self-verified (verified_by <> created_by).
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

-- resource approved: admin fact, and NOT self-approved (moderated_by <> submitted_by).
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
-- 8. I5 — UNBLOCK (delete-and-requeue semantics; the P2.0 transition graph is untouched)
-- ============================================================================
-- The author unblocks a seeker they declined by DELETING the declined opt-in row and
-- restoring the slot. The seeker is NOT re-queued automatically — they may opt in again
-- themselves via opt_in_to_post. A declined opt-in never completed, so it has no reviews
-- to cascade. The private opt_in_declines marker survives (untouched here). No
-- enforce_opt_in_transition change is needed (no declined->pending edge).
CREATE OR REPLACE FUNCTION public.unblock_opt_in(p_opt_in_id uuid)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_author uuid;
  v_post   public.posts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  SELECT oi.status, p.user_id INTO v_status, v_author
  FROM public.resource_opt_ins oi JOIN public.posts p ON p.id = oi.post_id
  WHERE oi.id = p_opt_in_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Opt-in not found'; END IF;
  IF v_author IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the post author may unblock this opt-in' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'declined' THEN
    RAISE EXCEPTION 'Only a declined opt-in can be unblocked' USING ERRCODE = '22023';
  END IF;

  -- Row-lock the post for safe slot restoration, then delete the declined opt-in.
  SELECT * INTO v_post FROM public.posts
    WHERE id = (SELECT post_id FROM public.resource_opt_ins WHERE id = p_opt_in_id) FOR UPDATE;

  DELETE FROM public.resource_opt_ins WHERE id = p_opt_in_id;

  -- Restore the slot the declined opt-in still held (consumed at opt-in, never restored on
  -- decline), so a later self re-opt-in via opt_in_to_post decrements from the correct base.
  IF v_post.max_seekers IS NOT NULL THEN
    UPDATE public.posts SET slots_remaining = LEAST(slots_remaining + 1, v_post.max_seekers) WHERE id = v_post.id;
  END IF;

  RETURN true;
END;
$fn$;

-- ============================================================================
-- 9. RLS + GRANTS (I2 + I4)
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

GRANT SELECT (badge_summary) ON public.profiles TO anon, authenticated;

-- ============================================================================
-- 10. FUNCTION EXECUTE GRANTS
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.record_engagement_event(uuid,text,text,uuid,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_badge_summary(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_engagement(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_all_badge_summaries()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_engagement(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_engagement_failure(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.badge_config_recompute()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_post_like()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_poll_vote()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_follow()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_comment()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_petition_signature() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_post_created()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_event_checkin()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_safety_alert_vote()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_message()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_resource_bookmark()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_saved_resource()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_opt_in()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_conversation()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_review()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_safety_alert_verify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_resource_approved()  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recompute_badge_summary(uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_user_engagement(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_badge_summaries() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_engagement(uuid)      TO service_role;

GRANT EXECUTE ON FUNCTION public.engagement_category_family(public.resource_category) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_family_from_chip(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_level(integer)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_weight(text)     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_community_dim(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.unblock_opt_in(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unblock_opt_in(uuid) TO authenticated;

-- ============================================================================
-- 11. ONE-TIME IDEMPOTENT BACKFILL — credit existing facts through the same path.
--     Idempotent (same ON CONFLICT keys); self-verifications earn nothing (guards above).
-- ============================================================================
SELECT public.reconcile_engagement(NULL);

COMMIT;
