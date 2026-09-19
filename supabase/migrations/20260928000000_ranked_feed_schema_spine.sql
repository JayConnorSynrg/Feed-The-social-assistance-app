-- W0.3 — Ranked-feed schema spine (additive).
-- Adds posts.location, denormalized like/comment counters kept exactly equal to
-- the live count by trigger, a single-row ranking config, heals the image_url
-- file-tree drift, swaps to the keyset index, and drops one redundant duplicate
-- SELECT policy. No existing column data is altered.
--
-- V1b (the location column-privilege CONTRACT) is present below but DEFERRED and
-- NOT applied to prod: it must follow the app-side EXPAND (posts .select('*') →
-- explicit column lists) because PostgREST 401s select=* under column grants.
-- See the V1b block for the exact enabling sequence. Everything else here IS
-- applied to prod and matches this file.
--
-- Consumers (not yet built): W1.3 ranked-feed RPC reads posts.location (emitted
-- as distance buckets, never raw coords), like_count/comment_count, and the
-- ranking constants. W1.4 keyset cursor uses ORDER BY is_pinned DESC, created_at
-- DESC, id DESC.
--
-- Empirical baseline verified live against project ndtpovonpadugthmcntl on
-- 2026-09-19: posts had 16 columns (no location / no counters), only TABLE-level
-- SELECT granted to anon+authenticated (zero column-level attacl), and postgres
-- holds rolbypassrls=true.

-- ─────────────────────────────────────────────────────────────────────────────
-- V4 — image_url drift-heal (idempotent no-op; column already present in prod).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url text;

-- ─────────────────────────────────────────────────────────────────────────────
-- V1a — location column (geography Point, WGS84). PostGIS confirmed installed.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- ─────────────────────────────────────────────────────────────────────────────
-- V2a — denormalized counters (added BEFORE the column-grant block so they are
-- enumerated into the safe re-GRANT list, while location is excluded).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS like_count    integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- V1b — CONTRACT: close the location column exposure to public roles.
-- ⚠️ DEFERRED / NOT YET APPLIED TO PROD (expand-before-contract ordering).
--
-- Only a TABLE-level SELECT grant exists on posts, so a bare column REVOKE is
-- inert; closing the exposure requires the atomic expand/contract below: REVOKE
-- the table-level SELECT from public roles, then GRANT SELECT on every column
-- EXCEPT location. This block is atomic (one statement / one implicit
-- transaction) so there is never a window in which location is public-readable.
--
-- WHY DEFERRED: empirically, PostgREST does NOT narrow `select=*` to privileged
-- columns — under column-level grants it 401s the whole request. The FEED web
-- app reads posts via `.select('*', ...)` at 5 sites, including the MAIN FEED
-- (apps/web/src/components/panels/feed-panel.tsx:1276). Applying this REVOKE
-- while those readers still use `*` makes the live feed error for anon AND
-- authenticated. posts has 0 rows today, so location currently guards no data.
--
-- ENABLING SEQUENCE (do both, in order, then uncomment + run this block):
--   EXPAND  → change every posts `.select('*')` to an explicit column list that
--             omits `location`, and deploy. Sites (verified 2026-09-19):
--               apps/web/src/components/panels/feed-panel.tsx:1276
--               apps/web/src/app/(social)/s/post/[id]/page.tsx:19,76
--               apps/web/src/app/profile/[username]/page.tsx:94
--               apps/web/src/app/api/og/post/[id]/route.tsx:15
--             (server pages using a service-role client are immune; verify per site.)
--   CONTRACT → run the block below against prod. Verified working 2026-09-19:
--             after it, anon SELECT of location → 42501; other columns → OK;
--             service_role/postgres retain full access; row-visibility unchanged.
--   NOTE     → also gate Realtime: posts on the supabase_realtime publication
--             would ship location in the WAL payload, which column grants do NOT
--             cover. Add a column-list to the publication or a filtered payload.
--
-- DO $$
-- DECLARE
--   col_list text;
-- BEGIN
--   SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
--     INTO col_list
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name   = 'posts'
--      AND column_name <> 'location';
--   IF col_list IS NULL THEN
--     RAISE EXCEPTION 'W0.3: refusing to re-grant — enumerated posts column list is empty';
--   END IF;
--   EXECUTE 'REVOKE SELECT ON public.posts FROM anon, authenticated';
--   EXECUTE format('GRANT SELECT (%s) ON public.posts TO anon, authenticated', col_list);
-- END $$;
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- V1c — GIST index on location for the distance queries the ranked-feed RPC runs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_location_gix ON public.posts USING gist (location);

-- ─────────────────────────────────────────────────────────────────────────────
-- V2b — counter triggers.
-- Strategy: RECOMPUTE (set the counter to the live COUNT(*) of the affected
-- post), NOT delta (+1/-1). Rationale: the invariant "like_count = COUNT(*)" then
-- holds BY CONSTRUCTION on every INSERT/DELETE/UPDATE — it cannot drift from a
-- double-fired event, a replayed WAL row, or a concurrent race, and it is
-- self-healing (a corrected counter converges on the next write). At FEED's
-- per-post like/comment volumes the COUNT is trivial. A delta approach is faster
-- but can permanently drift if any single event is missed or double-applied;
-- correctness is the requirement here, so recompute wins.
--
-- SECURITY DEFINER, owned by postgres (rolbypassrls=true): the trigger's UPDATE
-- on posts must bypass posts_update_own / posts_block_anon_update RLS, so that
-- user A liking user B's post succeeds. search_path pinned; EXECUTE revoked from
-- PUBLIC per the repo SECDEF-hardening pattern (trigger firing does not require
-- an EXECUTE grant to the invoking role).

CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target uuid;
BEGIN
  target := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts p
     SET like_count = (SELECT count(*) FROM public.post_likes pl WHERE pl.post_id = target)
   WHERE p.id = target;

  IF TG_OP = 'UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id THEN
    UPDATE public.posts p
       SET like_count = (SELECT count(*) FROM public.post_likes pl WHERE pl.post_id = OLD.post_id)
     WHERE p.id = OLD.post_id;
  END IF;

  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_post_like_count() FROM PUBLIC;
-- Harden: the REVOKE … FROM PUBLIC above is inert against Supabase's default
-- explicit EXECUTE grants to anon/authenticated, so strip those too. Trigger
-- firing is unaffected (triggers execute as the table owner, not the invoker);
-- this only removes a direct-call path no caller uses.
REVOKE EXECUTE ON FUNCTION public.sync_post_like_count() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target uuid;
BEGIN
  target := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts p
     SET comment_count = (SELECT count(*) FROM public.post_comments pc WHERE pc.post_id = target)
   WHERE p.id = target;

  IF TG_OP = 'UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id THEN
    UPDATE public.posts p
       SET comment_count = (SELECT count(*) FROM public.post_comments pc WHERE pc.post_id = OLD.post_id)
     WHERE p.id = OLD.post_id;
  END IF;

  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_post_comment_count() FROM PUBLIC;
-- Harden: as above — strip Supabase's default explicit EXECUTE grants to
-- anon/authenticated (the FROM PUBLIC revoke does not touch them). Trigger
-- firing is unaffected; this removes an unused direct-call path.
REVOKE EXECUTE ON FUNCTION public.sync_post_comment_count() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_post_like_count    ON public.post_likes;
CREATE TRIGGER trg_sync_post_like_count
  AFTER INSERT OR DELETE OR UPDATE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

DROP TRIGGER IF EXISTS trg_sync_post_comment_count ON public.post_comments;
CREATE TRIGGER trg_sync_post_comment_count
  AFTER INSERT OR DELETE OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comment_count();

-- Backfill existing rows so the counters are exact from the moment the triggers
-- exist (posts has 0 rows today, so this is a no-op, but included for correctness).
UPDATE public.posts p
   SET like_count    = (SELECT count(*) FROM public.post_likes    pl WHERE pl.post_id = p.id),
       comment_count = (SELECT count(*) FROM public.post_comments pc WHERE pc.post_id = p.id);

-- ─────────────────────────────────────────────────────────────────────────────
-- V3 — ranking config: single source of truth for the ranked-feed RPC. No
-- pre-existing config/settings/ranking table was found, so create a tiny
-- one-row table. SECURITY INVOKER RPCs read it, so grant SELECT to anon +
-- authenticated (constants, not secrets). Writes stay owner/service_role only.
-- singleton_guard + CHECK pins it to exactly one row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranking_config (
  singleton_guard   boolean PRIMARY KEY DEFAULT true CHECK (singleton_guard),
  half_life_hours   numeric NOT NULL DEFAULT 24,   -- H  — recency half-life (hours)
  distance_decay_km numeric NOT NULL DEFAULT 20,   -- d0 — distance decay scale (km)
  comment_weight    numeric NOT NULL DEFAULT 2,    -- comment_wt — comment vs like weight
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ranking_config (singleton_guard, half_life_hours, distance_decay_km, comment_weight)
VALUES (true, 24, 20, 2)
ON CONFLICT (singleton_guard) DO NOTHING;

ALTER TABLE public.ranking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ranking_config_select_all ON public.ranking_config;
CREATE POLICY ranking_config_select_all
  ON public.ranking_config FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.ranking_config TO anon, authenticated;
-- Harden: lock writes to owner/service_role at the GRANT level, so anon and
-- authenticated cannot write these constants even if a future RLS policy is
-- added — the privilege itself is gone, not merely gated by RLS. (These roles
-- were never granted write here; this makes the intent explicit and durable.)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ranking_config FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- V5 — keyset index swap. New 3-col index serves ORDER BY (is_pinned DESC,
-- created_at DESC, id DESC); the old 2-col (is_pinned, created_at DESC) index is
-- then redundant for that order and is dropped. posts has 0 rows, so a plain
-- CREATE INDEX (no CONCURRENTLY) takes only a trivial, momentary lock.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_pinned_created_id_idx
  ON public.posts (is_pinned DESC, created_at DESC, id DESC);
DROP INDEX IF EXISTS public.posts_pinned_created_at_idx;

-- ─────────────────────────────────────────────────────────────────────────────
-- V6 — drop the redundant duplicate SELECT policy. "Posts are viewable by
-- everyone" (PERMISSIVE, public, qual: NOT is_hidden) is a strict subset of
-- posts_select_public (PERMISSIVE, public, qual: NOT is_hidden OR owner OR
-- staff). Both PERMISSIVE policies union, so removing the subset leaves the
-- effective visibility byte-identical. posts_select_public is untouched.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
