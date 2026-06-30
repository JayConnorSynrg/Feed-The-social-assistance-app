-- fix(realtime): add notifications, post_likes, post_comments to supabase_realtime publication
--
-- GAP: clients subscribe via postgres_changes (use-notifications.ts:244,
-- use-realtime-feed.ts:171/225) but these tables were absent from the publication,
-- causing the notification bell and live like/comment counts to be refresh-only.
--
-- WAL-safety review (2026-06-30):
--   notifications   — id uuid, user_id uuid, type, title text, message text, link text,
--                     application_id uuid, is_read boolean, created_at timestamptz.
--                     RLS: select/update/delete own only; no INSERT policy (forge-proof).
--                     No column-level REVOKE conflicts. Safe.
--   post_likes      — user_id uuid, post_id uuid, created_at timestamptz. No PII beyond
--                     auth.uid()-gated user_id. RLS gating confirmed. Safe.
--   post_comments   — id uuid, post_id uuid, user_id uuid, content text, parent_id uuid,
--                     is_hidden boolean, created_at timestamptz, updated_at timestamptz.
--                     content is public-facing comment body already displayed in the feed.
--                     RLS: select_visible (respects is_hidden), insert/update/delete own,
--                     block_anon_insert. Safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'post_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  END IF;
END $$;
