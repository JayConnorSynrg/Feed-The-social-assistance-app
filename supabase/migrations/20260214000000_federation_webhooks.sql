-- ============================================
-- FEED Federation Protocol - Webhook Support
-- Version: 1.0.0
-- Created: 2026-02-14
-- Description: Adds webhook notification support to federation protocol
-- ============================================

-- ============================================
-- STEP 1: Add webhook_enabled column to federation_peers
-- ============================================

ALTER TABLE public.federation_peers
ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.federation_peers.webhook_enabled IS 'Whether to send webhook notifications to this peer';

-- Index for webhook-enabled peers
CREATE INDEX IF NOT EXISTS idx_federation_peers_webhook_enabled
ON public.federation_peers(webhook_enabled)
WHERE webhook_enabled = TRUE;

-- ============================================
-- STEP 2: Create federation_webhook_log table
-- Tracks webhook delivery history separately from sync logs
-- ============================================

CREATE TABLE IF NOT EXISTS public.federation_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID NOT NULL REFERENCES public.federation_peers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('resource.created', 'resource.updated', 'resource.deleted')),
  resource_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('success', 'failed', 'retrying')) DEFAULT 'retrying',
  http_status_code INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_federation_webhook_log_peer ON public.federation_webhook_log(peer_id);
CREATE INDEX idx_federation_webhook_log_status ON public.federation_webhook_log(delivery_status);
CREATE INDEX idx_federation_webhook_log_created ON public.federation_webhook_log(created_at DESC);
CREATE INDEX idx_federation_webhook_log_resource ON public.federation_webhook_log(resource_id);

-- RLS Policies
ALTER TABLE public.federation_webhook_log ENABLE ROW LEVEL SECURITY;

-- Admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
  ON public.federation_webhook_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Only service role can insert webhook logs
CREATE POLICY "Only service role can insert webhook logs"
  ON public.federation_webhook_log
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE public.federation_webhook_log IS 'Detailed log of webhook delivery attempts to federation peers';

-- ============================================
-- STEP 3: Function to trigger webhook notification
-- Calls the federation-webhook Edge Function via pg_net
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_federation_webhook(
  p_event_type TEXT,
  p_resource_id UUID,
  p_resource_type TEXT
)
RETURNS void AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get configuration from app settings
  -- These should be set via ALTER DATABASE SET app.supabase_url = 'https://...';
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION
    WHEN undefined_object THEN
      RAISE WARNING 'Webhook notification skipped: app.supabase_url and app.service_role_key not configured';
      RETURN;
  END;

  -- Validate inputs
  IF p_event_type NOT IN ('insert', 'update', 'delete') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be insert, update, or delete.', p_event_type;
  END IF;

  IF p_resource_id IS NULL OR p_resource_type IS NULL THEN
    RAISE EXCEPTION 'resource_id and resource_type cannot be NULL';
  END IF;

  -- Call webhook edge function via pg_net
  -- Note: This is async and fire-and-forget
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/federation-webhook',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'event_type', p_event_type,
      'resource_id', p_resource_id::text,
      'resource_type', p_resource_type
    )
  );

  -- Log that webhook was triggered (actual delivery tracking happens in Edge Function)
  RAISE DEBUG 'Webhook notification triggered: event=% resource_id=% resource_type=%',
    p_event_type, p_resource_id, p_resource_type;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to trigger webhook notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.notify_federation_webhook IS 'Triggers webhook notifications to federation peers via Edge Function';

-- ============================================
-- STEP 4: Create database trigger for automatic webhooks
-- Triggers on resources table changes (if table exists)
-- ============================================

-- Note: This trigger should be created conditionally based on whether
-- the resources table exists. Adjust table name as needed.

DO $$
BEGIN
  -- Check if resources table exists (adjust table name as needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'resources'
  ) THEN

    -- Create trigger function
    CREATE OR REPLACE FUNCTION public.on_resource_change_webhook()
    RETURNS TRIGGER AS $trigger$
    DECLARE
      event_type TEXT;
      resource_id UUID;
      resource_type TEXT;
    BEGIN
      -- Determine event type
      IF (TG_OP = 'INSERT') THEN
        event_type := 'insert';
        resource_id := NEW.id;
        resource_type := NEW.resource_type;
      ELSIF (TG_OP = 'UPDATE') THEN
        event_type := 'update';
        resource_id := NEW.id;
        resource_type := NEW.resource_type;
      ELSIF (TG_OP = 'DELETE') THEN
        event_type := 'delete';
        resource_id := OLD.id;
        resource_type := OLD.resource_type;
      END IF;

      -- Trigger webhook notification
      PERFORM public.notify_federation_webhook(event_type, resource_id, resource_type);

      RETURN COALESCE(NEW, OLD);
    END;
    $trigger$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Drop existing trigger if exists
    DROP TRIGGER IF EXISTS on_resource_change_webhook ON public.resources;

    -- Create trigger
    CREATE TRIGGER on_resource_change_webhook
    AFTER INSERT OR UPDATE OR DELETE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION public.on_resource_change_webhook();

    RAISE NOTICE '✅ Webhook trigger created on resources table';

  ELSE
    RAISE NOTICE '⚠️ resources table not found - webhook trigger not created';
    RAISE NOTICE 'ℹ️ Create trigger manually when resources table is available';
  END IF;
END $$;

-- ============================================
-- STEP 5: Helper functions for webhook management
-- ============================================

-- Get webhook delivery statistics for a peer
CREATE OR REPLACE FUNCTION public.get_webhook_stats(
  p_peer_id UUID,
  p_hours_ago INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_deliveries BIGINT,
  successful_deliveries BIGINT,
  failed_deliveries BIGINT,
  retried_deliveries BIGINT,
  avg_attempts NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_deliveries,
    COUNT(*) FILTER (WHERE delivery_status = 'success') AS successful_deliveries,
    COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed_deliveries,
    COUNT(*) FILTER (WHERE attempts > 1) AS retried_deliveries,
    ROUND(AVG(attempts), 2) AS avg_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE delivery_status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS success_rate
  FROM public.federation_webhook_log
  WHERE peer_id = p_peer_id
    AND created_at > NOW() - (p_hours_ago || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_webhook_stats IS 'Get webhook delivery statistics for a peer';

-- Get recent webhook failures for troubleshooting
CREATE OR REPLACE FUNCTION public.get_recent_webhook_failures(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  peer_name TEXT,
  event_type TEXT,
  resource_id UUID,
  attempts INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.instance_name,
    wl.event_type,
    wl.resource_id,
    wl.attempts,
    wl.error_message,
    wl.created_at
  FROM public.federation_webhook_log wl
  JOIN public.federation_peers fp ON wl.peer_id = fp.id
  JOIN public.federated_instances fi ON fp.remote_instance_id = fi.id
  WHERE wl.delivery_status = 'failed'
  ORDER BY wl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_recent_webhook_failures IS 'Get recent webhook delivery failures for troubleshooting';

-- Cleanup old webhook logs (retention: 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.federation_webhook_log
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % old webhook log entries', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_webhook_logs IS 'Delete webhook logs older than 30 days';

-- ============================================
-- STEP 6: Grant permissions
-- ============================================

-- Grant execute permissions on webhook functions to service role
GRANT EXECUTE ON FUNCTION public.notify_federation_webhook TO service_role;
GRANT EXECUTE ON FUNCTION public.get_webhook_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_webhook_failures TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_logs TO service_role;

-- ============================================
-- STEP 7: Example peer webhook configuration
-- ============================================

-- Example: Configure webhook URL for a peer via metadata
-- UPDATE public.federation_peers
-- SET
--   webhook_enabled = TRUE,
--   metadata = jsonb_set(
--     COALESCE(metadata, '{}'::jsonb),
--     '{webhook_url}',
--     '"https://sf.feed.org/api/webhooks/federation"'::jsonb
--   )
-- WHERE remote_instance_id = 'peer-instance-uuid';

-- ============================================
-- STEP 8: Verification
-- ============================================

DO $$
DECLARE
  table_exists BOOLEAN;
  column_exists BOOLEAN;
BEGIN
  -- Check webhook log table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'federation_webhook_log'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE '✅ federation_webhook_log table created';
  ELSE
    RAISE WARNING '⚠️ federation_webhook_log table not created';
  END IF;

  -- Check webhook_enabled column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'federation_peers'
    AND column_name = 'webhook_enabled'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE '✅ webhook_enabled column added to federation_peers';
  ELSE
    RAISE WARNING '⚠️ webhook_enabled column not added';
  END IF;

  RAISE NOTICE '📡 Federation webhook support initialized';
  RAISE NOTICE 'ℹ️ Configure webhook URLs in federation_peers.metadata';
  RAISE NOTICE 'ℹ️ Deploy Edge Function: npx supabase functions deploy federation-webhook';
END $$;
