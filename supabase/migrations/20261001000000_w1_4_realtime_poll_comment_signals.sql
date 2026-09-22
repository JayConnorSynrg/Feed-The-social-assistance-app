-- 20261001000000_w1_4_realtime_poll_comment_signals.sql
-- W1.4 — live poll tallies + live comment append (realtime SIGNAL publications)
--
-- Capability enabled: a signed-in user watching the feed sees poll tallies update
-- live when OTHER users vote, and new comments appear live inside an already-open
-- comment thread.
--
-- DESIGN — narrow, column-scoped SIGNAL publication:
--   poll_votes is published with (id, poll_id); post_comments with (id, post_id).
--   The published column list is deliberately narrow so voter identity
--   (poll_votes.user_id, poll_votes.option_index) and comment bodies/authors
--   (post_comments.content, .user_id) NEVER travel on the WAL replication wire —
--   there is no passive broadcast of voter identity to connected clients. The
--   realtime event is a pure SIGNAL ("something changed for this poll / this
--   post"), carrying no tally delta and no PII. Clients respond by RE-AGGREGATING
--   from an authoritative RLS-filtered read (usePollData.settleVotes) or
--   REFETCHING the thread (useRealtimeComments -> fetchComments).
--
--   id MUST be in each column list. supabase_realtime has pubdelete = true, and
--   Postgres 17 rejects (CheckCmdReplicaIdentity) a DELETE-publishing column list
--   that does not cover the table's REPLICA IDENTITY. Both tables' replica identity
--   is the primary key `id` (a surrogate uuid that leaks nothing). Omitting id
--   would make every unvote DELETE (usePollData.revokeVote) and comment delete
--   abort at the database. We keep REPLICA IDENTITY at the default (the PK) and do
--   NOT set REPLICA IDENTITY FULL: FULL would place user_id / option_index on the
--   DELETE wire and bloat WAL — the privacy regression this scope exists to avoid.
--
-- Live like/comment COUNTS already ride the posts WAL (posts.like_count /
--   posts.comment_count maintained in-txn by sync_post_like_count /
--   sync_post_comment_count; posts is already published). This migration does NOT
--   touch the posts publication entry and deliberately does NOT publish post_likes.
--
-- REPLAY-SAFE on ANY prior state (fresh / this-migration-already-applied / the
--   stale 20260630000100 full-publish of post_comments + post_likes / an earlier
--   W1.4 draft that published poll_votes(poll_id) only). Each table is reconciled
--   independently via guarded DROP + ADD keyed on pg_publication_rel / pg_attribute.
--   We NEVER use `ALTER PUBLICATION ... SET TABLE`: SET TABLE replaces the ENTIRE
--   publication table set and would drop `posts`, destroying the W1.3 posts WAL.
--
-- NOTE: This migration is committed but is NOT applied to prod by this change. It
--   is applied as a separate post-deploy step by the orchestrator once Vercel is
--   READY (mirrors the W1.3 V1b post-deploy sequence).

-- Returns the sorted set of published column names for a table in supabase_realtime,
-- NULL when the table is a full-table (no column list) member, and no row when the
-- table is not a member at all.
-- (Inlined per-table below as DO blocks — no helper function to avoid leaving an
--  artifact behind in the schema.)

-- ── post_likes: ensure ABSENT ───────────────────────────────────────────────
-- Live counts ride the posts WAL, so post_likes must never be published. Drop it
-- if any prior migration (e.g. stale 20260630000100) added it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'post_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.post_likes;
  END IF;
END $$;

-- ── poll_votes: publish exactly (id, poll_id) ───────────────────────────────
DO $$
DECLARE
  current_cols text[];
  is_member boolean;
BEGIN
  SELECT
    true,
    CASE
      WHEN pr.prattrs IS NULL THEN NULL  -- full-table member (all columns)
      ELSE (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(pr.prattrs) AS x(num)
        JOIN pg_attribute a ON a.attrelid = pr.prrelid AND a.attnum = x.num
      )
    END
  INTO is_member, current_cols
  FROM pg_publication p
  JOIN pg_publication_rel pr ON pr.prpubid = p.oid
  JOIN pg_class c ON c.oid = pr.prrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE p.pubname = 'supabase_realtime'
    AND n.nspname = 'public'
    AND c.relname = 'poll_votes';

  -- Member with the wrong column set (or full-table) → drop so we can re-add clean.
  IF COALESCE(is_member, false)
     AND (current_cols IS NULL OR current_cols <> ARRAY['id', 'poll_id']) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.poll_votes;
    is_member := false;
  END IF;

  IF NOT COALESCE(is_member, false) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes (id, poll_id);
  END IF;
END $$;

-- ── post_comments: publish exactly (id, post_id) ────────────────────────────
DO $$
DECLARE
  current_cols text[];
  is_member boolean;
BEGIN
  SELECT
    true,
    CASE
      WHEN pr.prattrs IS NULL THEN NULL
      ELSE (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(pr.prattrs) AS x(num)
        JOIN pg_attribute a ON a.attrelid = pr.prrelid AND a.attnum = x.num
      )
    END
  INTO is_member, current_cols
  FROM pg_publication p
  JOIN pg_publication_rel pr ON pr.prpubid = p.oid
  JOIN pg_class c ON c.oid = pr.prrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE p.pubname = 'supabase_realtime'
    AND n.nspname = 'public'
    AND c.relname = 'post_comments';

  IF COALESCE(is_member, false)
     AND (current_cols IS NULL OR current_cols <> ARRAY['id', 'post_id']) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.post_comments;
    is_member := false;
  END IF;

  IF NOT COALESCE(is_member, false) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments (id, post_id);
  END IF;
END $$;
