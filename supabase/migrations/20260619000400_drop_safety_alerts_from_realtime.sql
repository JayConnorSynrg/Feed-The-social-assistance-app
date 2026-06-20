-- Remove safety_alerts from the supabase_realtime publication so created_by
-- never transits the WAL payload (reporter anonymity). Realtime WAL payloads
-- include every column regardless of column-level REVOKEs, so the only durable
-- way to keep the reporter's identity off the wire is to keep the table out of
-- the publication entirely.
--
-- The map keeps pins and vote counts fresh via the existing viewport refetch
-- (pan/zoom -> safety_alerts_in_view RPC) plus a conservative 60s poll for a
-- stationary viewer (see apps/web/src/hooks/use-safety-alerts.ts). The
-- safety_alerts_in_view RPC computes is_mine server-side, so no client ever
-- receives created_by.
--
-- Idempotent: only drops the table from the publication if it is currently a
-- member, so re-running this migration is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'safety_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.safety_alerts;
  END IF;
END $$;
