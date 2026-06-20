-- Migration: 20260619000100_posts_realtime_publication.sql
-- Purpose: Add posts table to supabase_realtime publication (idempotent).
--   When admin_remove_post / admin_hold_post flips is_hidden=true, all
--   connected clients receive an UPDATE event and can remove the post from
--   their local feed state immediately — no poll required.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
END $$;
