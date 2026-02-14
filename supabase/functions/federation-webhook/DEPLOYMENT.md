# Federation Webhook Deployment Guide

Quick reference for deploying and configuring the FEED Federation webhook system.

## Prerequisites

- [x] Supabase project with federation tables deployed
- [x] `supabase` CLI installed
- [x] Federation private key generated
- [x] Local instance registered in `federated_instances`

## Deployment Steps

### 1. Run Migration

```bash
# Apply webhook migration
npx supabase db push

# Verify migration
npx supabase db diff
```

Expected output:
```
✅ federation_webhook_log table created
✅ webhook_enabled column added to federation_peers
📡 Federation webhook support initialized
```

### 2. Deploy Edge Function

```bash
# Deploy function
npx supabase functions deploy federation-webhook

# Verify deployment
npx supabase functions list
```

### 3. Set Environment Variables

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
FEDERATION_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----

FEDERATION_INSTANCE_ID=<local-instance-uuid>
FEDERATION_INSTANCE_URL=https://oakland.feed.org
```

To get your local instance ID:

```sql
SELECT id, instance_url FROM federated_instances WHERE is_local = TRUE;
```

### 4. Configure Database Settings

```sql
-- Set Supabase URL and service role key
ALTER DATABASE postgres SET app.supabase_url = 'https://yourproject.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Important**: Use your actual service role key (found in Project Settings → API).

### 5. Configure Webhook URLs for Peers

```sql
-- Example: Configure webhook for SF instance
UPDATE federation_peers
SET
  webhook_enabled = TRUE,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{webhook_url}',
    '"https://sf.feed.org/api/webhooks/federation"'::jsonb
  )
WHERE remote_instance_id = (
  SELECT id FROM federated_instances
  WHERE instance_url = 'https://sf.feed.org'
);
```

### 6. Verify Configuration

```sql
-- Check all webhook configurations
SELECT
  fi.instance_name,
  fi.instance_url,
  fp.webhook_enabled,
  fp.metadata->>'webhook_url' AS webhook_url
FROM federation_peers fp
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE fp.webhook_enabled = TRUE;
```

### 7. Test Webhook Delivery

```bash
curl -X POST https://yourproject.supabase.co/functions/v1/federation-webhook \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "insert",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }'
```

Expected response:

```json
{
  "success": true,
  "event": "resource.created",
  "resource_id": "123e4567-e89b-12d3-a456-426614174000",
  "deliveries": {
    "total": 1,
    "succeeded": 1,
    "failed": 0,
    "retried": 0
  },
  "details": [
    {
      "peer": "SF FEED Instance",
      "status": 200,
      "attempts": 1,
      "success": true
    }
  ]
}
```

## Post-Deployment Checklist

- [ ] Migration applied successfully
- [ ] Edge function deployed
- [ ] Environment variables set
- [ ] Database settings configured
- [ ] Webhook URLs configured for active peers
- [ ] Test webhook delivery successful
- [ ] Monitor webhook logs for issues

## Monitoring Commands

```sql
-- View recent webhook deliveries
SELECT
  fi.instance_name,
  wl.event_type,
  wl.delivery_status,
  wl.created_at
FROM federation_webhook_log wl
JOIN federation_peers fp ON wl.peer_id = fp.id
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
ORDER BY wl.created_at DESC
LIMIT 20;

-- Get webhook statistics
SELECT * FROM get_webhook_stats('peer-uuid', 24);

-- View recent failures
SELECT * FROM get_recent_webhook_failures(10);
```

## View Live Logs

```bash
# Stream Edge Function logs
npx supabase functions logs federation-webhook --tail
```

## Troubleshooting

### Issue: "FEDERATION_PRIVATE_KEY not configured"

**Solution**: Set environment variable in Supabase Dashboard.

```bash
# Check if variable is set
npx supabase secrets list
```

### Issue: No webhooks delivered

**Solution**: Verify peer configuration.

```sql
-- Check peer has webhook_url
SELECT
  id,
  webhook_enabled,
  metadata->>'webhook_url' AS webhook_url
FROM federation_peers;
```

### Issue: Signature verification fails on receiver

**Solution**: Ensure signing secret matches.

```typescript
// Signing secret is first 64 chars of private key
const signingSecret = FEDERATION_PRIVATE_KEY.substring(0, 64)
```

### Issue: Automatic triggers not working

**Solution**: Verify database settings are configured.

```sql
-- Check settings
SELECT current_setting('app.supabase_url', true);
SELECT current_setting('app.service_role_key', true);
```

If null, run:

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://yourproject.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
```

## Rollback Instructions

If you need to rollback the webhook system:

```sql
-- Disable all webhooks
UPDATE federation_peers SET webhook_enabled = FALSE;

-- Drop trigger
DROP TRIGGER IF EXISTS on_resource_change_webhook ON public.resources;
DROP FUNCTION IF EXISTS on_resource_change_webhook();

-- Drop webhook functions
DROP FUNCTION IF EXISTS notify_federation_webhook(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS get_webhook_stats(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_recent_webhook_failures(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_webhook_logs();

-- Drop webhook log table
DROP TABLE IF EXISTS federation_webhook_log;

-- Remove webhook_enabled column
ALTER TABLE federation_peers DROP COLUMN IF EXISTS webhook_enabled;
```

## Next Steps

After successful deployment:

1. **Configure webhook receivers** on all federation partners
2. **Implement signature verification** in webhook receivers
3. **Set up monitoring** and alerting for failed deliveries
4. **Schedule cleanup** of old webhook logs (monthly)
5. **Document webhook endpoints** for federation partners

## Support Resources

- [README.md](./README.md) - Detailed documentation
- [examples.md](./examples.md) - Code examples and usage
- [Federation Protocol Docs](../../../docs/federation-protocol.md) - Full protocol specification

## Security Notes

- Never commit service role keys to version control
- Use HTTPS only for webhook URLs in production
- Rotate signing secrets every 90 days
- Monitor webhook logs for suspicious activity
- Implement rate limiting on webhook receivers

## Performance Tips

- Disable webhooks for inactive peers
- Use `webhook_enabled` flag to control delivery
- Clean up old logs monthly with `cleanup_old_webhook_logs()`
- Monitor delivery success rates and adjust retry logic

---

**Deployment Status**: ✅ Ready for Production

**Last Updated**: 2026-02-14

**Version**: 1.0.0
