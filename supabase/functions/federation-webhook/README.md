# Federation Webhook Notifications

This Edge Function delivers real-time webhook notifications to federation partners when resources are created, updated, or deleted.

## Features

- **Event-driven notifications**: Notifies partners of resource changes
- **HMAC-SHA256 signatures**: Ensures payload integrity
- **Automatic retries**: Up to 3 retries with exponential backoff (1s, 4s, 16s)
- **Parallel delivery**: Sends to all peers simultaneously
- **Detailed logging**: Records all delivery attempts in `federation_sync_log`
- **Smart retry logic**: Skips retries for client errors (4xx)

## Webhook Payload Format

```json
{
  "event": "resource.created" | "resource.updated" | "resource.deleted",
  "instance_id": "uuid",
  "instance_url": "https://oakland.feed.org",
  "resource_id": "uuid",
  "resource_type": "food",
  "timestamp": "2026-02-14T12:00:00Z",
  "signature": "sha256=abcdef123456..."
}
```

## HTTP Headers

- `Content-Type: application/json`
- `User-Agent: FEED-Federation/1.0`
- `X-Federation-Signature: sha256=...` (HMAC-SHA256 of payload body)
- `X-Federation-Event: resource.created` (event type)

## Signature Verification

Recipients should verify the signature using HMAC-SHA256:

```typescript
import crypto from 'crypto'

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  const receivedSignature = signature.replace('sha256=', '')

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  )
}
```

## Configuration

### Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `FEDERATION_PRIVATE_KEY` - Private key for HMAC signing
- `FEDERATION_INSTANCE_ID` - This instance's UUID
- `FEDERATION_INSTANCE_URL` - This instance's public URL (e.g., `https://oakland.feed.org`)

### Peer Configuration

Peers must have a `webhook_url` in their metadata JSONB field:

```sql
UPDATE federation_peers
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{webhook_url}',
  '"https://sf.feed.org/api/webhooks/federation"'::jsonb
)
WHERE id = 'peer-uuid';
```

## Deployment

Deploy to Supabase:

```bash
npx supabase functions deploy federation-webhook
```

Set environment variables in Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Add environment variables listed above
3. Restart the function

## Usage

### Manual Trigger

Trigger via HTTP POST:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/federation-webhook \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "insert",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }'
```

### Automatic Trigger (via Database Trigger)

Create a database trigger to automatically notify on resource changes:

```sql
-- Function to call webhook edge function
CREATE OR REPLACE FUNCTION notify_federation_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
BEGIN
  -- Determine event type
  IF (TG_OP = 'INSERT') THEN
    event_type := 'insert';
  ELSIF (TG_OP = 'UPDATE') THEN
    event_type := 'update';
  ELSIF (TG_OP = 'DELETE') THEN
    event_type := 'delete';
  END IF;

  -- Call webhook edge function via pg_net
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/federation-webhook',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'event_type', event_type,
      'resource_id', COALESCE(NEW.id, OLD.id)::text,
      'resource_type', COALESCE(NEW.resource_type, OLD.resource_type)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on resources table
CREATE TRIGGER on_resource_change
AFTER INSERT OR UPDATE OR DELETE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION notify_federation_webhook();
```

## Response Format

### Success

```json
{
  "success": true,
  "event": "resource.updated",
  "resource_id": "uuid",
  "deliveries": {
    "total": 5,
    "succeeded": 4,
    "failed": 1,
    "retried": 2
  },
  "details": [
    {
      "peer": "SF FEED Instance",
      "status": 200,
      "attempts": 1,
      "success": true
    },
    {
      "peer": "LA FEED Instance",
      "status": 200,
      "attempts": 2,
      "success": true
    },
    {
      "peer": "Berkeley FEED Instance",
      "status": 0,
      "attempts": 3,
      "success": false,
      "error": "Request timeout"
    }
  ]
}
```

### Error

```json
{
  "success": false,
  "error": "FEDERATION_PRIVATE_KEY not configured"
}
```

## Monitoring

All webhook deliveries are logged to `federation_sync_log`:

```sql
SELECT
  fsl.started_at,
  fi.instance_name,
  fsl.sync_status,
  fsl.error_message
FROM federation_sync_log fsl
JOIN federation_peers fp ON fsl.peer_id = fp.id
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE fsl.started_at > NOW() - INTERVAL '1 hour'
ORDER BY fsl.started_at DESC;
```

## Retry Logic

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1       | 0s    | 0s         |
| 2       | 1s    | 1s         |
| 3       | 4s    | 5s         |
| 4       | 16s   | 21s        |

**Note**: Retries are skipped for client errors (4xx status codes).

## Security Considerations

1. **Signature verification**: Recipients MUST verify the `X-Federation-Signature` header
2. **Timestamp validation**: Check that timestamps are recent (within 5 minutes)
3. **Rate limiting**: Implement rate limits on webhook endpoints
4. **Secret rotation**: Rotate `FEDERATION_PRIVATE_KEY` periodically
5. **HTTPS only**: Only deliver webhooks to HTTPS URLs in production

## Testing

### Local Testing

Start Supabase locally:

```bash
npx supabase start
npx supabase functions serve federation-webhook
```

Trigger webhook:

```bash
curl -X POST http://localhost:54321/functions/v1/federation-webhook \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "insert",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }'
```

### Mock Webhook Receiver

Use a service like webhook.site or create a simple receiver:

```typescript
// Simple Express webhook receiver
app.post('/api/webhooks/federation', (req, res) => {
  const signature = req.headers['x-federation-signature']
  const body = JSON.stringify(req.body)

  // Verify signature
  const isValid = verifySignature(body, signature, SECRET)

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  console.log('Received webhook:', req.body)
  res.json({ received: true })
})
```

## Troubleshooting

### No webhooks delivered

1. Check that peers have `webhook_url` in metadata:
   ```sql
   SELECT id, instance_name, metadata->>'webhook_url' as webhook_url
   FROM federated_instances fi
   JOIN federation_peers fp ON fi.id = fp.remote_instance_id
   WHERE fp.federation_enabled = true;
   ```

2. Verify environment variables are set in Supabase Dashboard

### Signature verification fails

1. Ensure signing secret matches on both sides (first 64 chars of private key)
2. Verify payload is not modified before verification
3. Check timestamp is recent (within 5 minutes)

### Timeouts

1. Check network connectivity to peer webhook URLs
2. Verify webhook URLs are accessible and responding quickly
3. Consider increasing `WEBHOOK_TIMEOUT_MS` if needed

## Performance

- **Parallel delivery**: All webhooks delivered simultaneously
- **Timeout**: 10 seconds per webhook delivery
- **Max execution time**: ~40 seconds (10s + 3 retries with backoff)
- **Concurrency**: Limited by Supabase Edge Function concurrency limits

## Related Functions

- `federation-sync` - Pull resources from federated instances
- `federation-health-check` - Monitor instance health and uptime

## License

Part of the FEED Platform - Mutual Aid Resource Sharing Platform
