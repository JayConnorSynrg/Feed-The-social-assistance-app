-- Migration: add_community_feed_tables
-- Adds posts, post_likes, and post_comments tables with RLS policies.
-- Uses CREATE TABLE IF NOT EXISTS and idempotent policy patterns so this
-- migration is safe to apply against a production instance that already has
-- these tables.

-- ---------------------------------------------------------------------------
-- updated_at trigger function (idempotent — safe if already exists)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  is_hidden   boolean     NOT NULL DEFAULT false,
  is_pinned   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS posts_user_id_idx            ON posts (user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx         ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_pinned_created_at_idx  ON posts (is_pinned, created_at DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_posts_updated_at ON posts;
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posts_select_public  ON posts;
DROP POLICY IF EXISTS posts_insert_own     ON posts;
DROP POLICY IF EXISTS posts_update_own     ON posts;
DROP POLICY IF EXISTS posts_delete_own     ON posts;

-- Anyone (including anonymous) can read visible posts.
CREATE POLICY posts_select_public
  ON posts FOR SELECT
  USING (NOT is_hidden);

-- Authenticated users can create their own posts.
CREATE POLICY posts_insert_own
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own posts.
CREATE POLICY posts_update_own
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete only their own posts.
CREATE POLICY posts_delete_own
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS post_likes_post_id_idx  ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_id_idx  ON post_likes (user_id);

-- RLS
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_likes_select       ON post_likes;
DROP POLICY IF EXISTS post_likes_insert_own   ON post_likes;
DROP POLICY IF EXISTS post_likes_delete_own   ON post_likes;

-- Anyone can read likes (required for aggregate count queries).
CREATE POLICY post_likes_select
  ON post_likes FOR SELECT
  USING (true);

-- Authenticated users can like posts.
CREATE POLICY post_likes_insert_own
  ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove only their own likes.
CREATE POLICY post_likes_delete_own
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- post_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  is_hidden   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx  ON post_comments (post_id);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx  ON post_comments (user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_post_comments_updated_at ON post_comments;
CREATE TRIGGER set_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_comments_select_visible  ON post_comments;
DROP POLICY IF EXISTS post_comments_insert_own      ON post_comments;
DROP POLICY IF EXISTS post_comments_update_own      ON post_comments;
DROP POLICY IF EXISTS post_comments_delete_own      ON post_comments;

-- Anyone can read visible comments.
CREATE POLICY post_comments_select_visible
  ON post_comments FOR SELECT
  USING (NOT is_hidden);

-- Authenticated users can post comments.
CREATE POLICY post_comments_insert_own
  ON post_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can edit only their own comments.
CREATE POLICY post_comments_update_own
  ON post_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete only their own comments.
-- Also satisfies the account-deletion sweep:
--   DELETE FROM post_comments WHERE user_id = $user
-- which executes as the authenticated user whose uid matches.
CREATE POLICY post_comments_delete_own
  ON post_comments FOR DELETE
  USING (auth.uid() = user_id);
