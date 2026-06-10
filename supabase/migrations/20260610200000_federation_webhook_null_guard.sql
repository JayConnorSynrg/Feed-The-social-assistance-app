-- Migration: 20260610200000_federation_webhook_null_guard.sql
--
-- PURPOSE
--   Silence ~50×/day pg_net NOT NULL violation warnings emitted by
--   notify_federation_webhook() on every resources INSERT/UPDATE/DELETE.
--
-- ROOT CAUSE
--   current_setting('app.supabase_url', true) returns NULL when the GUC is
--   unset (the `true` = missing_ok flag). On this project the GUC is NOT set in
--   prod (no ALTER DATABASE … SET app.supabase_url = '…' has been applied).
--   NULL || '/functions/v1/federation-webhook' evaluates to NULL in Postgres.
--   net.http_post(url := NULL) violates the NOT NULL constraint on
--   http_request_queue.url, which is caught by the existing WHEN OTHERS handler
--   and emitted as:
--     WARNING: Failed to trigger webhook notification: …
--   This fires on every row-level INSERT/UPDATE/DELETE on public.resources
--   (≈ 50×/day at current write rate).
--
-- CONTEXT
--   federation_peers = 0 (no real peer has ever onboarded). No webhook delivery
--   is occurring now regardless. The null-guard preserves all plumbing so that
--   when a peer onboards AND the GUCs are set via:
--     ALTER DATABASE postgres SET "app.supabase_url" = 'https://…';
--     ALTER DATABASE postgres SET "app.service_role_key" = '…';
--   the function will begin firing correctly without any code change.
--
-- USER CHOICE
--   Null-guard selected over DROP TRIGGER — the trigger and function remain in
--   place for future use; only the noisy path is silenced.
--
-- INVARIANTS PRESERVED (from 20260601043054_harden_security_definer_fns.sql
--   and 20260603150000_harden_function_search_path.sql)
--   - SECURITY DEFINER retained
--   - SET search_path = public retained (advisor lint 0011)
--   - EXECUTE revoked from PUBLIC, anon, authenticated; only service_role granted
--     (re-stated below after CREATE OR REPLACE to guard against drift)

CREATE OR REPLACE FUNCTION public.notify_federation_webhook(
  p_event_type TEXT,
  p_resource_id UUID,
  p_resource_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url     TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Read settings (missing_ok = true → NULL when unset, no exception)
  v_supabase_url     := current_setting('app.supabase_url',    true);
  v_service_role_key := current_setting('app.service_role_key', true);

  -- NULL-GUARD: both GUCs must be non-empty for a valid pg_net call.
  -- When unset (the normal prod state while federation_peers = 0) skip silently
  -- rather than letting NULL propagate to net.http_post and produce a NOT NULL
  -- violation warning on every resources write.
  IF v_supabase_url     IS NULL OR v_supabase_url     = ''
  OR v_service_role_key IS NULL OR v_service_role_key = ''
  THEN
    RETURN;
  END IF;

  -- Validate caller-supplied arguments
  IF p_event_type NOT IN ('insert', 'update', 'delete') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be insert, update, or delete.', p_event_type;
  END IF;

  IF p_resource_id IS NULL OR p_resource_type IS NULL THEN
    RAISE EXCEPTION 'resource_id and resource_type cannot be NULL';
  END IF;

  -- Async, fire-and-forget HTTP POST to the federation-webhook Edge Function
  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/federation-webhook',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'event_type',    p_event_type,
      'resource_id',   p_resource_id::text,
      'resource_type', p_resource_type
    )
  );

  RAISE DEBUG 'Webhook notification triggered: event=% resource_id=% resource_type=%',
    p_event_type, p_resource_id, p_resource_type;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger webhook notification: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.notify_federation_webhook(text, uuid, text) IS
  'Triggers webhook notifications to federation peers via Edge Function. '
  'No-ops silently when app.supabase_url / app.service_role_key GUCs are unset.';

-- Re-assert least-privilege EXECUTE posture (CREATE OR REPLACE preserves existing
-- grants; re-stating here is a no-op when already correct but guards against drift
-- if this migration is ever replayed on a fresh DB or after an accidental GRANT).
REVOKE EXECUTE ON FUNCTION public.notify_federation_webhook(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_federation_webhook(text, uuid, text)
  TO service_role;
