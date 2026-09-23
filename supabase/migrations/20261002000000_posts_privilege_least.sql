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
--     → authenticated needs INSERT. (Guests are anonymous-auth users whose JWT role
--       is authenticated, gated read-only by RESTRICTIVE RLS — they do not need a
--       separate grant.)
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
-- Live state before this migration (pg_class.relacl): anon=awdDxtm, authenticated=awdDxtm
--   (both hold INSERT a, UPDATE w, DELETE d, TRUNCATE D, REFERENCES x, TRIGGER t, MAINTAIN m).
--   SELECT (r) is NOT in relacl — it is column-scoped (18 columns granted =r to both
--   roles; `location` excluded — the W1.3 privacy gate). pg_attribute.attacl shows
--   ONLY read (=r) column grants — there are NO column-level UPDATE (=w) grants to
--   preserve (e.g. is_pinned is read-only for clients).
--
-- ── WHAT THIS DOES ────────────────────────────────────────────────────────────
--   REVOKE from anon         : INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--   REVOKE from authenticated:         UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--                              (authenticated KEEPS INSERT)
--
-- Does NOT touch SELECT / column-level grants or the supabase_realtime publication.
-- REVOKE is idempotent (revoking a not-held privilege is a no-op), so this migration
-- is replay-safe.

-- anon: no write path to posts — strip every table-write privilege.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.posts FROM anon;

-- authenticated: keeps INSERT (client post composer); every other write privilege is
-- unused because all UPDATE/DELETE flow through SECURITY DEFINER functions.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.posts FROM authenticated;
