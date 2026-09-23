-- 20261002000000_posts_privilege_least.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-h-hygiene (Invariant 2 — each role on public.posts holds
--       exactly the privileges its real write paths use).
--
-- ── DERIVATION (write paths on public.posts) ──────────────────────────────────
-- Runtime writers, and the role each runs as:
--   INSERT (client, PostgREST, runs as the caller's JWT role = authenticated):
--     apps/web/src/components/panels/post-type-wizard.tsx:246, :316, :485, :600
--     apps/web/src/components/panels/feed-panel.tsx:1994
--     apps/web/src/components/panels/programs-panel.tsx:71
--     → authenticated needs INSERT. (Guests are anonymous-auth users whose JWT role
--       is authenticated, gated read-only by RESTRICTIVE RLS — no separate grant.)
--   UPDATE/DELETE: NONE from any client or edge path. Every posts mutation other
--     than the INSERT above runs inside a SECURITY DEFINER function (executes as the
--     owner, which bypasses RLS and needs NO caller table privilege):
--       admin_remove_post / admin_hold_post / admin_authorize_post  (UPDATE is_hidden)
--       opt_in_to_post / withdraw_opt_in                            (UPDATE slots_remaining)
--       submit_content_report                                       (UPDATE is_hidden)
--       sync_post_like_count / sync_post_comment_count (triggers)   (UPDATE like/comment_count)
--   The truly-unauthenticated `anon` role has NO write path to posts at all.
--
-- Per-role privilege usage (of INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN):
--   anon          : none  (read-only; SELECT is column-level and is NOT touched here)
--   authenticated : INSERT only
--
-- Live state before this migration (pg_class.relacl): anon=awdDxtm, authenticated=awdDxtm.
--   SELECT (r) is NOT in relacl — it is column-scoped (18 columns granted =r to both
--   roles; `location` excluded — the W1.3 privacy gate). pg_attribute.attacl shows ONLY
--   read (=r) column grants — NO column-level UPDATE/DELETE grants. No PUBLIC grant on
--   posts. Confirmed live this wave.
--
-- ── WHAT THIS DOES ────────────────────────────────────────────────────────────
--   REVOKE from anon         : INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--   REVOKE from authenticated:         UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--                              (authenticated KEEPS INSERT)
--   DROP the now-dead RLS policies posts_update_own, posts_delete_own,
--     posts_block_anon_update: after the revoke, neither anon nor authenticated holds
--     UPDATE/DELETE (verified: no table grant, no column grant, no PUBLIC grant), so
--     these UPDATE/DELETE policies are unreachable by client roles. SECDEF writers
--     bypass RLS. Kept: posts_insert_own, posts_block_anon_insert, posts_select_public.
--
-- Does NOT touch SELECT / column-level grants or the supabase_realtime publication.
-- REVOKE and DROP POLICY IF EXISTS are idempotent, so this migration is replay-safe.
--
-- Compatibility: prod is PG 17.6; local supabase/config.toml pins major_version = 15.
-- MAINTAIN is a PG17+ privilege, so revoking it errors on PG15. The MAINTAIN revoke is
-- therefore guarded by a server-version check so local `db reset`/replay stays valid,
-- while the effect on prod is identical.

-- anon: no write path to posts — strip every PG15-valid table-write privilege.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.posts FROM anon;

-- authenticated: keeps INSERT (client post composer); every other write privilege is
-- unused because all UPDATE/DELETE flow through SECURITY DEFINER functions.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.posts FROM authenticated;

-- MAINTAIN (PG17+ only) — guarded so a local PG15 replay does not error.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON public.posts FROM anon';
    EXECUTE 'REVOKE MAINTAIN ON public.posts FROM authenticated';
  END IF;
END
$$;

-- Drop the now-unreachable UPDATE/DELETE RLS policies (no client role holds the grant).
DROP POLICY IF EXISTS posts_update_own       ON public.posts;
DROP POLICY IF EXISTS posts_delete_own       ON public.posts;
DROP POLICY IF EXISTS posts_block_anon_update ON public.posts;
