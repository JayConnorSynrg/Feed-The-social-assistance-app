-- 20261026500000_post_editing_contract.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: the CONTRACT step of post editing (expand = 20261026000000_post_editing_foundation.sql).
-- Apply only AFTER the client that writes posts through create_post is deployed: until then the
-- deployed client still inserts posts and polls directly, and the foundation migration kept those grants
-- so posting never breaks during the apply -> deploy window.
--
-- What this migration does
--   (a) Closes the forged-insert hole: clients can no longer INSERT into posts (is_pinned, counts,
--       created_at, petition_id, version, deleted_at ... were all client-settable). create_post (SECURITY
--       DEFINER, per-type whitelist) is the only client writer from here on.
--   (b) Closes the poll holes: clients can no longer INSERT / UPDATE / DELETE polls (an author deleting a
--       poll wiped its votes; a poll row could be attached to any own post). Polls come with create_post
--       and change only through edit_post.
--   (c) Refuses to run before the foundation migration (create_post must exist), so it can never leave
--       clients with no way to post.
-- Contract: specs/post-editing-contract.md ("Release: expand / contract").
--
-- Migration order (5-step): no extensions, tables or functions; grants + policies only (RLS last).
-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF to_regprocedure('public.create_post(public.post_type,jsonb,uuid,text)') IS NULL THEN
    RAISE EXCEPTION '20261026500000 requires 20261026000000_post_editing_foundation (create_post) to be applied first'
      USING ERRCODE = '55000';
  END IF;
END
$guard$;

-- (a) posts: create_post is the only client writer
REVOKE INSERT ON public.posts FROM PUBLIC, anon, authenticated;
DROP POLICY posts_insert_own ON public.posts;

-- (b) polls: rows come with create_post / edit_post only
REVOKE INSERT, UPDATE, DELETE ON public.polls FROM PUBLIC, anon, authenticated;
DROP POLICY polls_insert_own ON public.polls;
DROP POLICY polls_delete_own ON public.polls;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261026500000', 'post_editing_contract');

COMMIT;
