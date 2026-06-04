-- Migration: post_comments_parent_id_and_index
-- Adds parent_id column (self-referential FK) to post_comments for nested replies,
-- and a composite index on (post_id, parent_id, created_at) for threaded fetch performance.
-- Additive — idempotent — no RLS changes needed (existing 4 policies cover replies).

-- ---------------------------------------------------------------------------
-- 1. Add parent_id column (nullable — top-level comments have parent_id = NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES post_comments(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Composite index for threaded fetch: all comments for a post, grouped by
--    parent_id, ordered by created_at — eliminates full-table scan on large threads.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_post_comments_post_parent_created
  ON post_comments (post_id, parent_id, created_at);
