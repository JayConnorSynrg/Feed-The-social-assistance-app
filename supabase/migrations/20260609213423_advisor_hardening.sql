-- Migration: 20260609213423_advisor_hardening.sql
-- Advisor hardening: drop duplicate indexes, consolidate duplicate permissive RLS policies.
--
-- TRIGGER FUNCTIONS: all trigger fns show granted_to=null (no PUBLIC/anon/authenticated
-- EXECUTE grants present) — no revokes needed; already locked down.
--
-- DUPLICATE INDEXES dropped (identical column sets covered by retained index):
--   post_comments.post_comments_post_id_idx  → covered by idx_comments_post
--   post_comments.post_comments_user_id_idx  → covered by idx_comments_user
--   post_likes.post_likes_post_id_idx        → covered by idx_post_likes_post
--   post_likes.post_likes_user_id_idx        → covered by idx_post_likes_user
--   posts.posts_user_id_idx                  → subset of idx_posts_user_created (user_id,created_at)
--
-- DUPLICATE RLS POLICIES dropped (identical USING/WITH_CHECK per table+cmd):
--   post_comments: old "Users can ..." naming duplicated by newer snake_case policies
--   post_likes:    old "Users can ..." / "Likes are ..." duplicated by snake_case policies
--   posts:         old "Users can ..." DELETE/INSERT/UPDATE duplicated by snake_case policies
--   form_templates: broad ALL policy duplicated by granular INSERT/UPDATE/DELETE/SELECT policies
--
-- posts SELECT: "Posts are viewable by everyone" (qual=NOT is_hidden) vs
--   "posts_select_public" (qual=NOT is_hidden OR user_id=auth.uid() OR staff) — NOT identical,
--   both retained (two additive permissive policies give correct combined behavior).
--
-- Idempotent: DROP IF EXISTS throughout.

-- ============================================================
-- DROP DUPLICATE INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.post_comments_post_id_idx;
DROP INDEX IF EXISTS public.post_comments_user_id_idx;
DROP INDEX IF EXISTS public.post_likes_post_id_idx;
DROP INDEX IF EXISTS public.post_likes_user_id_idx;
DROP INDEX IF EXISTS public.posts_user_id_idx;

-- ============================================================
-- DROP DUPLICATE RLS POLICIES — post_comments
-- ============================================================

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;

-- ============================================================
-- DROP DUPLICATE RLS POLICIES — post_likes
-- ============================================================

DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.post_likes;

-- ============================================================
-- DROP DUPLICATE RLS POLICIES — posts
-- ============================================================

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;

-- ============================================================
-- DROP DUPLICATE RLS POLICIES — form_templates
-- ============================================================
-- The broad ALL policy is redundant with granular INSERT/UPDATE/DELETE/SELECT policies.
-- Granular policies have WITH_CHECK on INSERT that the ALL policy lacks — keep granular.

DROP POLICY IF EXISTS "Admins can manage form templates" ON public.form_templates;

-- ============================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================
-- SELECT tablename, indexname FROM pg_indexes
-- WHERE schemaname='public' AND indexname IN (
--   'post_comments_post_id_idx','post_comments_user_id_idx',
--   'post_likes_post_id_idx','post_likes_user_id_idx','posts_user_id_idx'
-- );  -- expect 0 rows
--
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname='public' AND policyname IN (
--   'Users can delete their own comments','Users can create comments',
--   'Comments are viewable by everyone','Users can update their own comments',
--   'Users can unlike posts','Users can like posts','Likes are viewable by everyone',
--   'Users can delete their own posts','Users can create their own posts',
--   'Users can update their own posts','Admins can manage form templates'
-- );  -- expect 0 rows
