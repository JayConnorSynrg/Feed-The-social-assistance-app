-- 20261001000000_w1_4_realtime_poll_comment_signals.sql
-- W1.4 — live poll tallies + live comment append (realtime SIGNAL publications)
--
-- Capability enabled: a signed-in user watching the feed sees poll tallies update
-- live when OTHER users vote, and new comments appear live inside an already-open
-- comment thread.
--
-- DESIGN — signal-only, column-scoped publication:
--   We publish poll_votes with ONLY (poll_id) and post_comments with ONLY
--   (id, post_id). The published column list is deliberately narrow so voter
--   identity (poll_votes.user_id, poll_votes.option_index) and comment bodies
--   (post_comments.content, .user_id) NEVER travel on the WAL replication wire.
--   The realtime event is a pure SIGNAL — "something changed for this poll / this
--   post" — carrying no tally delta and no PII. Clients respond by RE-AGGREGATING
--   from an authoritative RLS-filtered read (usePollData.settleVotes) or REFETCHING
--   the thread (useRealtimeComments -> fetchComments). This keeps identity and
--   content off the wire while still delivering the live UX.
--
-- Live like/comment COUNTS already ride the posts WAL (posts.like_count /
--   posts.comment_count are maintained in-txn by sync_post_like_count /
--   sync_post_comment_count and posts is already published). This migration does
--   NOT touch that path and deliberately does NOT publish post_likes.
--
-- REPLICA IDENTITY is intentionally left at the default (primary key). We do NOT
--   set REPLICA IDENTITY FULL: FULL would place user_id / option_index on the
--   DELETE wire and bloat WAL — a privacy regression this design exists to avoid.
--
-- Idempotent: each ADD TABLE is guarded on pg_publication_rel membership so a
--   re-apply is a no-op.
--
-- NOTE: This migration is committed but is NOT applied to prod by this change. It
--   is applied as a separate post-deploy step by the orchestrator once Vercel is
--   READY (mirrors the W1.3 V1b post-deploy sequence).

-- poll_votes — publish ONLY poll_id (the signal key). user_id / option_index stay
-- off the wire; usePollData re-aggregates tallies from an RLS-filtered read.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes (poll_id);
  END IF;
END $$;

-- post_comments — publish ONLY (id, post_id). The comment body (content) and
-- author (user_id) stay off the wire; CommentThread refetches the RLS-filtered
-- thread when a signal arrives for its post_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments (id, post_id);
  END IF;
END $$;
