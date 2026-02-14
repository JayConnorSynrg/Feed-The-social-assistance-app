# Federation Webhook Examples

This document provides practical examples for configuring and using the FEED Federation webhook system.

## Table of Contents

1. [Configuration](#configuration)
2. [Manual Testing](#manual-testing)
3. [Automatic Triggers](#automatic-triggers)
4. [Webhook Receiver](#webhook-receiver)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

---

## Configuration

### 1. Set Environment Variables

In Supabase Dashboard → Project Settings → Edge Functions:

```bash
FEDERATION_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
FEDERATION_INSTANCE_ID=123e4567-e89b-12d3-a456-426614174000
FEDERATION_INSTANCE_URL=https://oakland.feed.org
```

### 2. Configure Database Settings

Set Supabase URL and service role key for webhook triggers:

```sql
-- Run as superuser
ALTER DATABASE postgres SET app.supabase_url = 'https://yourproject.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3. Configure Webhook URL for a Peer

Add webhook URL to peer's metadata:

```sql
-- Enable webhooks and set URL
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

### 4. Verify Configuration

```sql
-- Check all peers with webhooks configured
SELECT
  fi.instance_name,
  fi.instance_url,
  fp.webhook_enabled,
  fp.metadata->>'webhook_url' AS webhook_url,
  fp.federation_enabled
FROM federation_peers fp
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE fp.webhook_enabled = TRUE;
```

---

## Manual Testing

### Test 1: Basic Webhook Delivery

```bash
curl -X POST https://yourproject.supabase.co/functions/v1/federation-webhook \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
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
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "retried": 0
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
      "attempts": 1,
      "success": true
    }
  ]
}
```

### Test 2: Update Event

```bash
curl -X POST https://yourproject.supabase.co/functions/v1/federation-webhook \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "update",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "housing"
  }'
```

### Test 3: Delete Event

```bash
curl -X POST https://yourproject.supabase.co/functions/v1/federation-webhook \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "delete",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }'
```

---

## Automatic Triggers

### Trigger on Resource Insert

```sql
-- Call webhook function directly from SQL
SELECT notify_federation_webhook(
  'insert',
  '123e4567-e89b-12d3-a456-426614174000',
  'food'
);
```

### Database Trigger (Automatic)

The migration already creates a trigger on the `resources` table (if it exists).
If you need to create it manually or for a different table:

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION on_resource_change_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
BEGIN
  -- Map database operation to event type
  IF (TG_OP = 'INSERT') THEN
    event_type := 'insert';
  ELSIF (TG_OP = 'UPDATE') THEN
    event_type := 'update';
  ELSIF (TG_OP = 'DELETE') THEN
    event_type := 'delete';
  END IF;

  -- Trigger webhook
  PERFORM notify_federation_webhook(
    event_type,
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.resource_type, OLD.resource_type)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to table
CREATE TRIGGER on_resource_change_webhook
AFTER INSERT OR UPDATE OR DELETE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION on_resource_change_webhook();
```

### Test Automatic Trigger

```sql
-- Insert a resource (should trigger webhook)
INSERT INTO resources (id, name, resource_type, description)
VALUES (
  gen_random_uuid(),
  'Oakland Food Pantry',
  'food',
  'Free food distribution every Tuesday'
);

-- Update a resource (should trigger webhook)
UPDATE resources
SET description = 'Free food distribution Tuesday and Thursday'
WHERE name = 'Oakland Food Pantry';

-- Delete a resource (should trigger webhook)
DELETE FROM resources
WHERE name = 'Oakland Food Pantry';
```

---

## Webhook Receiver

### Node.js / Express Example

```typescript
import express from 'express'
import crypto from 'crypto'

const app = express()
app.use(express.json())

// Verify webhook signature
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

// Webhook endpoint
app.post('/api/webhooks/federation', (req, res) => {
  const signature = req.headers['x-federation-signature'] as string
  const eventType = req.headers['x-federation-event'] as string

  // Verify signature
  const payload = JSON.stringify(req.body)
  const secret = process.env.FEDERATION_WEBHOOK_SECRET! // First 64 chars of private key

  if (!verifySignature(payload, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Verify timestamp (prevent replay attacks)
  const timestamp = new Date(req.body.timestamp)
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  if (timestamp < fiveMinutesAgo) {
    return res.status(401).json({ error: 'Timestamp too old' })
  }

  // Process webhook
  console.log('Received webhook:', {
    event: eventType,
    instance: req.body.instance_url,
    resource_id: req.body.resource_id,
    resource_type: req.body.resource_type,
  })

  // Handle different event types
  switch (eventType) {
    case 'resource.created':
      // Handle new resource
      console.log('New resource created:', req.body.resource_id)
      break

    case 'resource.updated':
      // Handle resource update
      console.log('Resource updated:', req.body.resource_id)
      break

    case 'resource.deleted':
      // Handle resource deletion
      console.log('Resource deleted:', req.body.resource_id)
      break
  }

  res.json({ received: true })
})

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000')
})
```

### Deno / Supabase Edge Function Example

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const receivedHex = signature.replace('sha256=', '')

  return expectedHex === receivedHex
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('x-federation-signature') || ''
  const eventType = req.headers.get('x-federation-event') || ''

  const payload = await req.text()
  const data = JSON.parse(payload)

  // Verify signature
  const secret = Deno.env.get('FEDERATION_WEBHOOK_SECRET')!
  const isValid = await verifySignature(payload, signature, secret)

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Process webhook
  console.log('Received webhook:', eventType, data)

  return new Response(
    JSON.stringify({ received: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## Monitoring

### View Recent Webhook Deliveries

```sql
-- All deliveries in last 24 hours
SELECT
  fi.instance_name AS peer,
  wl.event_type,
  wl.delivery_status,
  wl.attempts,
  wl.http_status_code,
  wl.created_at
FROM federation_webhook_log wl
JOIN federation_peers fp ON wl.peer_id = fp.id
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE wl.created_at > NOW() - INTERVAL '24 hours'
ORDER BY wl.created_at DESC
LIMIT 50;
```

### Get Delivery Statistics

```sql
-- Stats for a specific peer
SELECT * FROM get_webhook_stats(
  'peer-uuid',
  24 -- hours
);

-- Results:
-- total_deliveries | successful_deliveries | failed_deliveries | retried_deliveries | avg_attempts | success_rate
-- ------------------|----------------------|-------------------|-------------------|--------------|-------------
-- 150              | 145                  | 5                 | 12                | 1.08         | 96.67
```

### View Recent Failures

```sql
SELECT * FROM get_recent_webhook_failures(20);
```

### Webhook Delivery Rate

```sql
-- Deliveries per hour (last 24 hours)
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE delivery_status = 'success') AS succeeded,
  COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed,
  ROUND(AVG(attempts), 2) AS avg_attempts
FROM federation_webhook_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## Troubleshooting

### Debug: Check Webhook Configuration

```sql
-- Verify peers have webhook URLs
SELECT
  fi.instance_name,
  fp.webhook_enabled,
  fp.metadata->>'webhook_url' AS webhook_url
FROM federation_peers fp
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE fp.federation_enabled = TRUE;
```

### Debug: Test Signature Generation

```typescript
// Node.js
const crypto = require('crypto')

const payload = JSON.stringify({
  event: 'resource.created',
  instance_id: 'test-id',
  instance_url: 'https://test.feed.org',
  resource_id: '123e4567-e89b-12d3-a456-426614174000',
  resource_type: 'food',
  timestamp: '2026-02-14T12:00:00Z',
})

const secret = 'your-secret-key-first-64-chars'

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex')

console.log(`sha256=${signature}`)
```

### Debug: View Edge Function Logs

```bash
# View live logs
npx supabase functions logs federation-webhook --tail

# View recent logs
npx supabase functions logs federation-webhook --limit 50
```

### Debug: Test with Mock Webhook Receiver

Use webhook.site for quick testing:

```sql
-- Set webhook URL to webhook.site
UPDATE federation_peers
SET metadata = jsonb_set(
  metadata,
  '{webhook_url}',
  '"https://webhook.site/your-unique-url"'::jsonb
)
WHERE id = 'peer-uuid';

-- Trigger a test webhook
SELECT notify_federation_webhook(
  'insert',
  gen_random_uuid(),
  'food'
);
```

### Common Issues

| Issue | Solution |
|-------|----------|
| No webhooks delivered | Check `webhook_enabled = TRUE` and `webhook_url` is set |
| Signature verification fails | Ensure signing secret matches (first 64 chars of private key) |
| Timeouts | Webhook receivers must respond within 10 seconds |
| 4xx errors | Check webhook URL is correct and accessible |
| 5xx errors | Check webhook receiver is running and healthy |

### Cleanup Old Logs

```sql
-- Delete logs older than 30 days
SELECT cleanup_old_webhook_logs();
```

---

## Advanced Usage

### Conditional Webhooks (Only for Specific Resource Types)

Modify the trigger function to filter by resource type:

```sql
CREATE OR REPLACE FUNCTION on_resource_change_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
  resource_type TEXT;
BEGIN
  resource_type := COALESCE(NEW.resource_type, OLD.resource_type);

  -- Only send webhooks for food and housing
  IF resource_type NOT IN ('food', 'housing') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Rest of function...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Batch Webhooks

For high-volume scenarios, batch multiple events:

```sql
-- Store events in a queue table
CREATE TABLE webhook_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  resource_id UUID,
  resource_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Process queue every minute
-- (via cron or scheduled Edge Function)
SELECT notify_federation_webhook(
  event_type,
  resource_id,
  resource_type
)
FROM webhook_queue
WHERE created_at > NOW() - INTERVAL '1 minute';
```

---

## Performance Tips

1. **Use webhook_enabled flag**: Disable webhooks for inactive peers
2. **Monitor delivery rates**: Track success rates and adjust retry logic
3. **Implement rate limiting**: Limit webhooks per peer per minute
4. **Use async processing**: Don't block on webhook delivery in critical paths
5. **Clean up old logs**: Run `cleanup_old_webhook_logs()` regularly

---

## Security Checklist

- [ ] HTTPS only for webhook URLs in production
- [ ] Verify signatures on all received webhooks
- [ ] Validate timestamps (max 5 minutes old)
- [ ] Implement rate limiting on webhook receivers
- [ ] Rotate signing secrets periodically
- [ ] Monitor for suspicious activity (high failure rates)
- [ ] Use service role key only in secure environments
- [ ] Log all webhook deliveries for audit trail
