-- 20261005000000_p2_1a_engagement.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-p2-1a-engagement
--
-- Builds the P2.1a engagement subsystem on top of the P2.0 integrity floor
-- (20261004000000): an append-only engagement ledger, per-user counters, a
-- tunable single-row badge_config, a public badge_summary on profiles, and the
-- opt-in unblock flow with a private per-author decline marker.
--
-- Replay-safe on PG15 (local) and PG17 (prod): every statement is idempotent
-- (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE /
-- DROP ... IF EXISTS / guarded policy creation). No PG17-only syntax is used.
--
-- ============================================================================
-- INVARIANT I1 — LEDGER EXACTLY-ONCE (derivation table)
-- ----------------------------------------------------------------------------
-- Every qualifying source event produces exactly ONE engagement_events row
-- (never zero, never two). Cheap kinds are unique on (actor, kind, target) so a
-- retry/undo/redo never duplicates or re-awards. State-transition kinds fire on
-- the transition INTO the qualifying state only. Guests (auth.users.is_anonymous)
-- and NULL actors produce no row. Source-row deletes never remove ledger rows.
--
-- kind                        | source table       | trigger event (condition)                    | actor credited                         | target_type/id     | category family path                                   | verified | cheap/once-ever
-- ----------------------------|--------------------|----------------------------------------------|----------------------------------------|--------------------|--------------------------------------------------------|----------|----------------
-- like                        | post_likes         | AFTER INSERT                                 | user_id                                | post / post_id     | post.resource_id -> resources.category -> family       | no       | once (actor,like,post)
-- poll_vote                   | poll_votes         | AFTER INSERT                                 | user_id                                | poll / poll_id     | poll.post_id -> post.resource_id -> category -> family  | no       | once (actor,poll_vote,poll)
-- follow                      | follows            | AFTER INSERT                                 | follower_id                            | user / following_id| none                                                   | no       | once (actor,follow,following)
-- comment                     | post_comments      | AFTER INSERT (NEW.is_hidden IS NOT TRUE)     | user_id                                | comment / id       | post.resource_id -> category -> family                  | no       | once (actor,comment,comment_id) [id is unique]
-- petition_signature          | petition_signatures| AFTER INSERT                                 | signer_id                              | petition / petition_id | none (petitions.cause_category is a separate vocab) | no       | once (actor,petition_signature,petition)
-- opt_in_completed_provider   | resource_opt_ins   | AFTER UPDATE (accepted -> completed)         | post author (posts.user_id)            | opt_in / id        | opt_in.resource_id -> resources.category -> family      | no       | once (actor,...,opt_in_id)
-- opt_in_completed_seeker     | resource_opt_ins   | AFTER UPDATE (accepted -> completed)         | seeker_id                              | opt_in / id        | opt_in.resource_id -> resources.category -> family      | no       | once (actor,...,opt_in_id)
-- conversation_completed      | conversations      | AFTER UPDATE (active -> completed)           | volunteer_id AND requester_id (2 rows) | conversation / id  | conversation.resource_id -> category -> family (100%)   | no       | once per actor (actor,...,conv_id)
-- review_received             | reviews            | AFTER INSERT                                 | reviewee_id                            | review / id        | opt_in_id/conversation_id -> resource -> category -> family | yes (peer) | once (actor,...,review_id)
-- safety_alert_verified       | safety_alerts      | AFTER UPDATE (verified false -> true)        | created_by                             | safety_alert / id  | none (alert_type is not a resource family)              | yes (admin) | once (actor,...,alert_id)
-- resource_approved           | resources          | AFTER UPDATE (status -> approved, submitted_by NOT NULL) | submitted_by               | resource / id      | resources.category -> family                            | yes (admin) | once (actor,...,resource_id)
-- appreciation_gift           | (reserved for P2.1b) | none yet                                   | (recipient)                            | user / giver       | none                                                   | no       | reserved kind — allowed by CHECK, no producer in P2.1a
--
-- For a COMPLETED OPT-IN both parties are credited: the PROVIDER (post author) under
-- opt_in_completed_provider (drives the Helper community badge + the category family),
-- and the SEEKER under opt_in_completed_seeker (category family only). Completion is
-- set by the post author (P2.0 trigger allows accepted->completed only), so it is
-- self-attested, not peer-verified -> verified=false. The only peer-verified fact is a
-- counterparty review (review_received); admin-verified facts are safety_alert_verified
-- and resource_approved. P3 admin eligibility reads verified=true rows only.
--
-- ============================================================================
-- INVARIANT I2 — SERVER-ONLY WRITES
--   engagement_events, user_engagement_counters, badge_config, profiles.badge_summary
--   and opt_in_declines carry NO client INSERT/UPDATE/DELETE policy and table-level
--   REVOKE ALL from anon/authenticated. Only the SECURITY DEFINER trigger functions
--   (owned by postgres) write them. Clients may SELECT: their own ledger rows / counters
--   (RLS actor=uid), the public badge_config, the public profiles.badge_summary, and
--   their own decline markers (author=uid). The ledger is NOT publicly readable; the
--   summary IS public.
--
-- INVARIANT I3 — SUMMARY CORRECTNESS
--   profiles.badge_summary = recompute(ledger, config) at all times. Maintained
--   incrementally in the trigger path (record_engagement_event -> counters ->
--   recompute_badge_summary). recompute_user_engagement(user) rebuilds counters from
--   the ledger and re-derives the summary (full recompute). A badge_config UPDATE
--   fires recompute_all_badge_summaries(). Incremental == full is proven by the
--   behavioural test suite.
--
-- INVARIANT I4 — READ PATHS UNBROKEN
--   profiles has NO table-level SELECT grant (relacl authenticated/anon = 'm' only);
--   every column is individually granted. A new column is therefore unreadable by
--   default, so badge_summary gets an explicit GRANT SELECT(badge_summary) TO anon,
--   authenticated. No profiles read uses select('*') (all explicit column lists or the
--   get_my_profile() SECDEF RPC), so adding the column breaks nothing. profiles is NOT
--   in supabase_realtime -> no WAL exposure and no publication change. The one new read
--   path is the public profile page select (profile/[username]/page.tsx).
--
-- INVARIANT I5 — UNBLOCK FLOW
--   unblock_opt_in(opt_in) is the only path from declined back to pending: SECDEF,
--   checks the caller authored the post and the opt-in is declined, then performs a
--   SANCTIONED declined->pending transition (a transaction-local GUC feed.optin_unblock
--   that enforce_opt_in_transition honours; forward-only holds for every other caller).
--   Slot accounting: the slot was decremented at opt-in and is NOT restored on decline
--   (P2.0 behaviour), so the seeker still holds it -> unblock is slot-neutral. The
--   private marker (opt_in_declines) survives the unblock, is readable ONLY by the
--   author (RLS), is never in a public view, in the seeker's view, or on the WAL.
-- ============================================================================

BEGIN;

-- ── 0. Category-family crosswalk (resource_category enum -> one of the 10 families) ──
-- The 10 families match the post-type-wizard chips (Food, Housing, Goods, Transit,
-- Health, Money, Care, Education, Work, Legal), lowercased. 'other' returns NULL: it is
-- 92% of approved resources (mostly IMLS libraries) and would swamp every family badge,
-- so 'other' engagement is recorded in the ledger but earns no family credit.
CREATE OR REPLACE FUNCTION public.engagement_category_family(p_category public.resource_category)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_category
    WHEN 'food'                 THEN 'food'
    WHEN 'housing'              THEN 'housing'
    WHEN 'free_camping'         THEN 'housing'
    WHEN 'clothing'             THEN 'goods'
    WHEN 'free_goods_donation'  THEN 'goods'
    WHEN 'waste_disposal'       THEN 'goods'
    WHEN 'transportation'       THEN 'transit'
    WHEN 'healthcare'           THEN 'health'
    WHEN 'mental_health'        THEN 'health'
    WHEN 'substance_abuse'      THEN 'health'
    WHEN 'prenatal_natal_care'  THEN 'health'
    WHEN 'financial'            THEN 'money'
    WHEN 'eitc_tax_filing'      THEN 'money'
    WHEN 'utilities'            THEN 'money'
    WHEN 'childcare'            THEN 'care'
    WHEN 'senior_services'      THEN 'care'
    WHEN 'disability_services'  THEN 'care'
    WHEN 'veteran_services'     THEN 'care'
    WHEN 'domestic_violence'    THEN 'care'
    WHEN 'education'            THEN 'education'
    WHEN 'employment'           THEN 'work'
    WHEN 'legal'                THEN 'legal'
    WHEN 'free_legal'           THEN 'legal'
    WHEN 'immigration'          THEN 'legal'
    ELSE NULL  -- 'other' and any future unmapped value
  END;
$fn$;

-- ── 1. badge_config (single row, tunable thresholds — mirrors ranking_config) ──
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
INSERT INTO public.badge_config (singleton_guard) VALUES (true)
  ON CONFLICT (singleton_guard) DO NOTHING;

-- ── 2. engagement_events (append-only ledger) ──
CREATE TABLE IF NOT EXISTS public.engagement_events (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL,
  target_type  text        NOT NULL,
  target_id    uuid        NOT NULL,
  category     text,                 -- family key (see engagement_category_family); nullable
  verified     boolean     NOT NULL DEFAULT false,
  weight       integer     NOT NULL DEFAULT 1,
  source_table text        NOT NULL,
  source_pk    text        NOT NULL,
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_events_kind_chk CHECK (kind IN (
    'like','poll_vote','follow','comment','petition_signature',
    'opt_in_completed_provider','opt_in_completed_seeker','conversation_completed',
    'review_received','safety_alert_verified','resource_approved','appreciation_gift'
  )),
  -- Award-once-per-pair-ever for every kind: the same (actor, kind, target) can only
  -- ever record one row, so undo/redo/retry never duplicates or re-awards.
  CONSTRAINT engagement_events_once UNIQUE (actor_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_engagement_events_actor ON public.engagement_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_verified ON public.engagement_events (actor_id, verified) WHERE verified;

-- ── 3. user_engagement_counters (per-user, per-dimension accumulated points) ──
-- dimension is 'family:<key>' (weighted points) or 'badge:<key>' (event count, weight 1).
CREATE TABLE IF NOT EXISTS public.user_engagement_counters (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dimension  text        NOT NULL,
  count      integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dimension)
);

-- ── 4. opt_in_declines (private per-author decline marker) ──
-- Keyed per author across all their posts (matches the user's wording). Written only by
-- the resource_opt_ins AFTER UPDATE trigger; readable only by the author (RLS). Survives
-- an unblock. Never public, never in the seeker's view, never on the WAL.
CREATE TABLE IF NOT EXISTS public.opt_in_declines (
  author_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seeker_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_declined_at timestamptz NOT NULL DEFAULT now(),
  last_declined_at  timestamptz NOT NULL DEFAULT now(),
  times_declined    integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (author_id, seeker_id)
);

-- ── 5. profiles.badge_summary (public, server-maintained) ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badge_summary jsonb;

-- ============================================================================
-- 6. WRITE PATH — SECURITY DEFINER helpers (owner-only writers)
-- ============================================================================

-- 6a. Level from accumulated points, per the (single-row) config.
CREATE OR REPLACE FUNCTION public.engagement_level(p_points integer)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
    WHEN p_points >= c.level3_threshold THEN 3
    WHEN p_points >= c.level2_threshold THEN 2
    WHEN p_points >= c.level1_threshold THEN 1
    ELSE 0
  END
  FROM public.badge_config c
  WHERE c.singleton_guard;
$fn$;

-- 6b. Rebuild profiles.badge_summary for one user from that user's counters + config.
--     badge_summary = f(counters); dimensions with level 0 are omitted (empty state).
CREATE OR REPLACE FUNCTION public.recompute_badge_summary(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_families jsonb;
  v_badges   jsonb;
BEGIN
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

  UPDATE public.profiles
  SET badge_summary = jsonb_build_object(
        'families', COALESCE(v_families, '{}'::jsonb),
        'badges',   COALESCE(v_badges,   '{}'::jsonb),
        'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
  WHERE id = p_user;
END;
$fn$;

-- 6c. The single write primitive. Exactly-once via ON CONFLICT DO NOTHING; guests and
--     NULL actors produce no row. On a genuinely new row it bumps the family dimension
--     (weighted) and/or the community-badge dimension (by 1), then re-derives the
--     summary. p_family is the already-resolved family key (or NULL).
CREATE OR REPLACE FUNCTION public.record_engagement_event(
  p_actor        uuid,
  p_kind         text,
  p_target_type  text,
  p_target_id    uuid,
  p_source_table text,
  p_source_pk    text,
  p_family       text,
  p_verified     boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_weight    integer;
  v_community text;
  v_inserted  uuid;
BEGIN
  -- No actor, no row.
  IF p_actor IS NULL THEN
    RETURN;
  END IF;
  -- Guests are read-only. Read is_anonymous by id so this is correct for every writer
  -- path (client, SECDEF RPC, and the service-role petition route where the JWT claim
  -- is absent).
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor AND is_anonymous IS TRUE) THEN
    RETURN;
  END IF;

  v_weight := CASE p_kind
    WHEN 'opt_in_completed_provider' THEN 3
    WHEN 'opt_in_completed_seeker'   THEN 2
    WHEN 'conversation_completed'    THEN 3
    WHEN 'review_received'           THEN 3
    WHEN 'resource_approved'         THEN 3
    ELSE 1
  END;

  v_community := CASE p_kind
    WHEN 'comment'                   THEN 'badge:voice'
    WHEN 'opt_in_completed_provider' THEN 'badge:helper'
    WHEN 'conversation_completed'    THEN 'badge:connector'
    WHEN 'petition_signature'        THEN 'badge:advocate'
    WHEN 'safety_alert_verified'     THEN 'badge:watcher'
    ELSE NULL
  END;

  INSERT INTO public.engagement_events
    (actor_id, kind, target_type, target_id, category, verified, weight, source_table, source_pk)
  VALUES
    (p_actor, p_kind, p_target_type, p_target_id, p_family, p_verified, v_weight, p_source_table, p_source_pk)
  ON CONFLICT (actor_id, kind, target_id) DO NOTHING
  RETURNING id INTO v_inserted;

  -- Conflict (already awarded) -> no counter movement, no re-award.
  IF v_inserted IS NULL THEN
    RETURN;
  END IF;

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

-- 6d. Full recompute from the ledger (rebuild counters, then the summary). This is the
--     source-of-truth recompute the incremental path must always agree with (I3).
CREATE OR REPLACE FUNCTION public.recompute_user_engagement(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  DELETE FROM public.user_engagement_counters WHERE user_id = p_user;

  -- Family dimensions: weighted sum over category-bearing events.
  INSERT INTO public.user_engagement_counters (user_id, dimension, count, updated_at)
  SELECT actor_id, 'family:' || category, SUM(weight), now()
  FROM public.engagement_events
  WHERE actor_id = p_user AND category IS NOT NULL
  GROUP BY actor_id, category;

  -- Community-badge dimensions: one point per qualifying event.
  INSERT INTO public.user_engagement_counters (user_id, dimension, count, updated_at)
  SELECT actor_id,
         CASE kind
           WHEN 'comment'                   THEN 'badge:voice'
           WHEN 'opt_in_completed_provider' THEN 'badge:helper'
           WHEN 'conversation_completed'    THEN 'badge:connector'
           WHEN 'petition_signature'        THEN 'badge:advocate'
           WHEN 'safety_alert_verified'     THEN 'badge:watcher'
         END,
         COUNT(*), now()
  FROM public.engagement_events
  WHERE actor_id = p_user
    AND kind IN ('comment','opt_in_completed_provider','conversation_completed',
                 'petition_signature','safety_alert_verified')
  GROUP BY actor_id, kind;

  PERFORM public.recompute_badge_summary(p_user);
END;
$fn$;

-- 6e. Recompute every user's summary (levels change on a config threshold change).
CREATE OR REPLACE FUNCTION public.recompute_all_badge_summaries()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user uuid;
BEGIN
  FOR v_user IN SELECT DISTINCT user_id FROM public.user_engagement_counters LOOP
    PERFORM public.recompute_badge_summary(v_user);
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.badge_config_recompute()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.recompute_all_badge_summaries();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_badge_config_recompute ON public.badge_config;
CREATE TRIGGER trg_badge_config_recompute
  AFTER UPDATE ON public.badge_config
  FOR EACH ROW EXECUTE FUNCTION public.badge_config_recompute();

-- ============================================================================
-- 7. SOURCE TRIGGERS — one AFTER trigger per source table
-- ============================================================================

-- 7a. post_likes -> like
CREATE OR REPLACE FUNCTION public.engagement_on_post_like()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_family text;
BEGIN
  SELECT public.engagement_category_family(r.category)
    INTO v_family
  FROM public.posts p LEFT JOIN public.resources r ON r.id = p.resource_id
  WHERE p.id = NEW.post_id;
  PERFORM public.record_engagement_event(
    NEW.user_id, 'like', 'post', NEW.post_id, 'post_likes',
    NEW.user_id::text || ':' || NEW.post_id::text, v_family, false);
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_post_like ON public.post_likes;
CREATE TRIGGER trg_engagement_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_post_like();

-- 7b. poll_votes -> poll_vote
CREATE OR REPLACE FUNCTION public.engagement_on_poll_vote()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_family text;
BEGIN
  SELECT public.engagement_category_family(r.category)
    INTO v_family
  FROM public.polls pl
    JOIN public.posts p ON p.id = pl.post_id
    LEFT JOIN public.resources r ON r.id = p.resource_id
  WHERE pl.id = NEW.poll_id;
  PERFORM public.record_engagement_event(
    NEW.user_id, 'poll_vote', 'poll', NEW.poll_id, 'poll_votes',
    NEW.user_id::text || ':' || NEW.poll_id::text, v_family, false);
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_poll_vote ON public.poll_votes;
CREATE TRIGGER trg_engagement_poll_vote
  AFTER INSERT ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_poll_vote();

-- 7c. follows -> follow (no category, no community badge; recorded for completeness/P3)
CREATE OR REPLACE FUNCTION public.engagement_on_follow()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.record_engagement_event(
    NEW.follower_id, 'follow', 'user', NEW.following_id, 'follows',
    NEW.follower_id::text || ':' || NEW.following_id::text, NULL, false);
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_follow ON public.follows;
CREATE TRIGGER trg_engagement_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_follow();

-- 7d. post_comments -> comment (Voice) — only a visible (non-hidden) comment counts
CREATE OR REPLACE FUNCTION public.engagement_on_comment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_family text;
BEGIN
  IF NEW.is_hidden IS TRUE THEN
    RETURN NULL;
  END IF;
  SELECT public.engagement_category_family(r.category)
    INTO v_family
  FROM public.posts p LEFT JOIN public.resources r ON r.id = p.resource_id
  WHERE p.id = NEW.post_id;
  PERFORM public.record_engagement_event(
    NEW.user_id, 'comment', 'comment', NEW.id, 'post_comments',
    NEW.id::text, v_family, false);
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_comment ON public.post_comments;
CREATE TRIGGER trg_engagement_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_comment();

-- 7e. petition_signatures -> petition_signature (Advocate)
CREATE OR REPLACE FUNCTION public.engagement_on_petition_signature()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  PERFORM public.record_engagement_event(
    NEW.signer_id, 'petition_signature', 'petition', NEW.petition_id, 'petition_signatures',
    NEW.signer_id::text || ':' || NEW.petition_id::text, NULL, false);
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_petition_signature ON public.petition_signatures;
CREATE TRIGGER trg_engagement_petition_signature
  AFTER INSERT ON public.petition_signatures
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_petition_signature();

-- 7f. resource_opt_ins -> opt_in_completed_{provider,seeker} + decline marker
--     Fires AFTER UPDATE. The completion credit fires on accepted->completed only.
--     The decline marker records on ANY transition into 'declined'. Runs alongside the
--     P2.0 BEFORE UPDATE enforce_opt_in_transition (which gates the transition graph).
CREATE OR REPLACE FUNCTION public.engagement_on_opt_in()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_family text;
  v_author uuid;
BEGIN
  IF OLD.status = 'accepted' AND NEW.status = 'completed' THEN
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.resources r WHERE r.id = NEW.resource_id;
    SELECT user_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    PERFORM public.record_engagement_event(
      v_author, 'opt_in_completed_provider', 'opt_in', NEW.id, 'resource_opt_ins',
      NEW.id::text, v_family, false);
    PERFORM public.record_engagement_event(
      NEW.seeker_id, 'opt_in_completed_seeker', 'opt_in', NEW.id, 'resource_opt_ins',
      NEW.id::text, v_family, false);
  END IF;

  IF NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
    SELECT user_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    IF v_author IS NOT NULL THEN
      INSERT INTO public.opt_in_declines (author_id, seeker_id)
      VALUES (v_author, NEW.seeker_id)
      ON CONFLICT (author_id, seeker_id)
        DO UPDATE SET last_declined_at = now(),
                      times_declined   = public.opt_in_declines.times_declined + 1;
    END IF;
  END IF;

  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_opt_in ON public.resource_opt_ins;
CREATE TRIGGER trg_engagement_opt_in
  AFTER UPDATE ON public.resource_opt_ins
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_opt_in();

-- 7g. conversations -> conversation_completed (Connector, both participants)
CREATE OR REPLACE FUNCTION public.engagement_on_conversation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_family text;
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'completed' THEN
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.resources r WHERE r.id = NEW.resource_id;
    PERFORM public.record_engagement_event(
      NEW.volunteer_id, 'conversation_completed', 'conversation', NEW.id, 'conversations',
      NEW.id::text, v_family, false);
    PERFORM public.record_engagement_event(
      NEW.requester_id, 'conversation_completed', 'conversation', NEW.id, 'conversations',
      NEW.id::text, v_family, false);
  END IF;
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_conversation ON public.conversations;
CREATE TRIGGER trg_engagement_conversation
  AFTER UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_conversation();

-- 7h. reviews -> review_received (peer-verified; credited to the reviewee)
CREATE OR REPLACE FUNCTION public.engagement_on_review()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_family text;
BEGIN
  IF NEW.opt_in_id IS NOT NULL THEN
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.resource_opt_ins oi LEFT JOIN public.resources r ON r.id = oi.resource_id
    WHERE oi.id = NEW.opt_in_id;
  ELSIF NEW.conversation_id IS NOT NULL THEN
    SELECT public.engagement_category_family(r.category) INTO v_family
    FROM public.conversations c JOIN public.resources r ON r.id = c.resource_id
    WHERE c.id = NEW.conversation_id;
  END IF;
  PERFORM public.record_engagement_event(
    NEW.reviewee_id, 'review_received', 'review', NEW.id, 'reviews',
    NEW.id::text, v_family, true);
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_review ON public.reviews;
CREATE TRIGGER trg_engagement_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_review();

-- 7i. safety_alerts -> safety_alert_verified (Watcher; admin-verified)
CREATE OR REPLACE FUNCTION public.engagement_on_safety_alert_verify()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.verified IS TRUE AND OLD.verified IS DISTINCT FROM TRUE THEN
    PERFORM public.record_engagement_event(
      NEW.created_by, 'safety_alert_verified', 'safety_alert', NEW.id, 'safety_alerts',
      NEW.id::text, NULL, true);
  END IF;
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_safety_alert_verify ON public.safety_alerts;
CREATE TRIGGER trg_engagement_safety_alert_verify
  AFTER UPDATE ON public.safety_alerts
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_safety_alert_verify();

-- 7j. resources -> resource_approved (admin-verified; user-submitted only)
CREATE OR REPLACE FUNCTION public.engagement_on_resource_approved()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE v_family text;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved'
     AND NEW.submitted_by IS NOT NULL THEN
    v_family := public.engagement_category_family(NEW.category);
    PERFORM public.record_engagement_event(
      NEW.submitted_by, 'resource_approved', 'resource', NEW.id, 'resources',
      NEW.id::text, v_family, true);
  END IF;
  RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_engagement_resource_approved ON public.resources;
CREATE TRIGGER trg_engagement_resource_approved
  AFTER UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_resource_approved();

-- ============================================================================
-- 8. I5 — UNBLOCK FLOW
-- ============================================================================

-- 8a. Extend the P2.0 opt-in transition graph with a SANCTIONED declined->pending edge
--     that is permitted ONLY when the transaction-local GUC feed.optin_unblock='on'
--     (set by unblock_opt_in below). Forward-only holds for every other caller. Body is
--     otherwise the P2.0 graph verbatim.
CREATE OR REPLACE FUNCTION public.enforce_opt_in_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pending'  AND NEW.status IN ('accepted','declined'))
      OR (OLD.status = 'accepted' AND NEW.status = 'completed')
      OR (OLD.status = 'declined' AND NEW.status = 'pending'
          AND COALESCE(current_setting('feed.optin_unblock', true), '') = 'on')
    ) THEN
      RAISE EXCEPTION 'invalid opt-in status transition % -> %', OLD.status, NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- 8b. unblock_opt_in — the only path from declined back to pending. Author-only.
--     Slot-neutral: the slot was consumed at opt-in and never restored on decline
--     (P2.0), so the seeker still holds it; declined->pending reuses that same slot.
CREATE OR REPLACE FUNCTION public.unblock_opt_in(p_opt_in_id uuid)
  RETURNS public.resource_opt_ins
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_author uuid;
  v_row    public.resource_opt_ins;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  SELECT oi.status, p.user_id
    INTO v_status, v_author
  FROM public.resource_opt_ins oi
    JOIN public.posts p ON p.id = oi.post_id
  WHERE oi.id = p_opt_in_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opt-in not found';
  END IF;
  IF v_author IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the post author may unblock this opt-in' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'declined' THEN
    RAISE EXCEPTION 'Only a declined opt-in can be unblocked' USING ERRCODE = '22023';
  END IF;

  -- Sanction the declined->pending transition for this statement only.
  PERFORM set_config('feed.optin_unblock', 'on', true);
  UPDATE public.resource_opt_ins SET status = 'pending' WHERE id = p_opt_in_id
    RETURNING * INTO v_row;
  PERFORM set_config('feed.optin_unblock', 'off', true);

  RETURN v_row;
END;
$fn$;

-- ============================================================================
-- 9. RLS + GRANTS (I2 + I4)
-- ============================================================================

-- 9a. engagement_events — ledger: own-read only, no client writes, not public.
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_events_select_own ON public.engagement_events;
CREATE POLICY engagement_events_select_own ON public.engagement_events
  FOR SELECT TO authenticated USING (actor_id = (SELECT auth.uid()));
REVOKE ALL ON public.engagement_events FROM anon, authenticated;
GRANT SELECT ON public.engagement_events TO authenticated;

-- 9b. user_engagement_counters — own-read only, no client writes.
ALTER TABLE public.user_engagement_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_engagement_counters_select_own ON public.user_engagement_counters;
CREATE POLICY user_engagement_counters_select_own ON public.user_engagement_counters
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.user_engagement_counters FROM anon, authenticated;
GRANT SELECT ON public.user_engagement_counters TO authenticated;

-- 9c. badge_config — public read, no client writes.
ALTER TABLE public.badge_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS badge_config_select_all ON public.badge_config;
CREATE POLICY badge_config_select_all ON public.badge_config
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.badge_config FROM anon, authenticated;
GRANT SELECT ON public.badge_config TO anon, authenticated;

-- 9d. opt_in_declines — author-read only (the private marker), no client writes, not public.
ALTER TABLE public.opt_in_declines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opt_in_declines_select_author ON public.opt_in_declines;
CREATE POLICY opt_in_declines_select_author ON public.opt_in_declines
  FOR SELECT TO authenticated USING (author_id = (SELECT auth.uid()));
REVOKE ALL ON public.opt_in_declines FROM anon, authenticated;
GRANT SELECT ON public.opt_in_declines TO authenticated;

-- 9e. profiles.badge_summary — public read (I4: profiles has column-only grants).
GRANT SELECT (badge_summary) ON public.profiles TO anon, authenticated;

-- ============================================================================
-- 10. FUNCTION EXECUTE GRANTS (security-definer hardening)
-- ============================================================================
-- Trigger functions and internal write helpers: revoke EXECUTE from every client role
-- (triggers fire regardless of EXECUTE grant; the helpers are internal-only). Recompute
-- maintenance functions are granted to service_role for ops. unblock_opt_in is the one
-- client-callable RPC (authenticated only).

REVOKE EXECUTE ON FUNCTION public.record_engagement_event(uuid, text, text, uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_badge_summary(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_engagement(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_all_badge_summaries()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.badge_config_recompute()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_post_like()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_poll_vote()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_follow()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_comment()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_petition_signature() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_opt_in()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_conversation()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_review()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_safety_alert_verify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.engagement_on_resource_approved()  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recompute_badge_summary(uuid)     TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_user_engagement(uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_badge_summaries()   TO service_role;

-- engagement_category_family / engagement_level are pure helpers; keep them callable.
GRANT EXECUTE ON FUNCTION public.engagement_category_family(public.resource_category) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.engagement_level(integer) TO anon, authenticated, service_role;

-- unblock_opt_in — authenticated only (guests are read-only; anon has no session).
REVOKE EXECUTE ON FUNCTION public.unblock_opt_in(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unblock_opt_in(uuid) TO authenticated;

COMMIT;
