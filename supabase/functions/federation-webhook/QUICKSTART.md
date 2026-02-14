# Federation Webhook Quick Start

Get the FEED Federation webhook system up and running in 5 minutes.

## Prerequisites

- [x] Supabase project with federation tables
- [x] Supabase CLI installed
- [x] PostgreSQL with `pg_net` extension enabled

## Step 1: Deploy Migration (1 min)

```bash
# Apply webhook migration
npx supabase db push

# Verify tables created
npx supabase db diff
```

**Expected output:**
```
✅ federation_webhook_log table created
✅ webhook_enabled column added to federation_peers
```

## Step 2: Deploy Edge Function (1 min)

```bash
# Deploy the function
npx supabase functions deploy federation-webhook

# Verify deployment
npx supabase functions list
```

**Expected output:**
```
federation-webhook (deployed)
```

## Step 3: Set Environment Variables (1 min)

In **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**, add:

```bash
FEDERATION_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
FEDERATION_INSTANCE_ID=<your-local-instance-uuid>
FEDERATION_INSTANCE_URL=https://yourinstance.feed.org
```

Get your instance ID:

```sql
SELECT id FROM federated_instances WHERE is_local = TRUE;
```

## Step 4: Configure Database Settings (1 min)

```sql
-- Set Supabase URL and service role key
ALTER DATABASE postgres SET app.supabase_url = 'https://yourproject.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

Find these values in **Project Settings** → **API**.

## Step 5: Configure a Test Peer (1 min)

```sql
-- Add webhook URL to a peer's metadata
UPDATE federation_peers
SET
  webhook_enabled = TRUE,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{webhook_url}',
    '"https://webhook.site/your-unique-url"'::jsonb
  )
WHERE remote_instance_id = (
  SELECT id FROM federated_instances WHERE instance_url = 'https://testpeer.feed.org'
  LIMIT 1
);
```

**Pro tip**: Use [webhook.site](https://webhook.site) to create a test webhook URL instantly.

## Step 6: Test It! (1 min)

### Manual Test

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

**Expected response:**

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
      "peer": "Test Peer",
      "status": 200,
      "attempts": 1,
      "success": true
    }
  ]
}
```

### Automated Test

```bash
# Run integration tests
cd supabase/functions/federation-webhook
./integration-test.sh
```

**Expected output:**

```
✅ All tests passed!
Tests Run: 9
Tests Passed: 9
Tests Failed: 0
```

## Verify Webhook Delivery

Check webhook.site to see the received webhook:

**Headers:**
```
Content-Type: application/json
User-Agent: FEED-Federation/1.0
X-Federation-Signature: sha256=abc123...
X-Federation-Event: resource.created
```

**Body:**
```json
{
  "event": "resource.created",
  "instance_id": "your-instance-uuid",
  "instance_url": "https://yourinstance.feed.org",
  "resource_id": "123e4567-e89b-12d3-a456-426614174000",
  "resource_type": "food",
  "timestamp": "2026-02-14T12:00:00Z",
  "signature": "sha256=abc123..."
}
```

## View Logs

```sql
-- View recent webhook deliveries
SELECT
  fi.instance_name AS peer,
  wl.event_type,
  wl.delivery_status,
  wl.http_status_code,
  wl.attempts,
  wl.created_at
FROM federation_webhook_log wl
JOIN federation_peers fp ON wl.peer_id = fp.id
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
ORDER BY wl.created_at DESC
LIMIT 10;
```

## Enable Automatic Webhooks

The migration already created a trigger on the `resources` table (if it exists).

Test automatic webhooks:

```sql
-- Insert a resource (triggers webhook automatically)
INSERT INTO resources (id, name, resource_type, description)
VALUES (
  gen_random_uuid(),
  'Test Food Pantry',
  'food',
  'Automatic webhook test'
);
```

Check webhook.site - you should receive the webhook!

## Troubleshooting

### No webhooks delivered

```sql
-- Check peer configuration
SELECT
  fi.instance_name,
  fp.webhook_enabled,
  fp.metadata->>'webhook_url' AS webhook_url
FROM federation_peers fp
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE fp.federation_enabled = TRUE;
```

### Signature verification fails

The signing secret is the **first 64 characters** of `FEDERATION_PRIVATE_KEY`:

```typescript
const signingSecret = FEDERATION_PRIVATE_KEY.substring(0, 64)
```

### View Edge Function logs

```bash
npx supabase functions logs federation-webhook --tail
```

## Next Steps

1. **Configure production webhook URLs** for real federation partners
2. **Implement webhook receiver** on partner instances (see [examples.md](./examples.md))
3. **Set up monitoring** for webhook delivery rates
4. **Schedule log cleanup** (run `cleanup_old_webhook_logs()` monthly)

## Resources

- [README.md](./README.md) - Full documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [examples.md](./examples.md) - Code examples and usage patterns
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture details
- [test.ts](./test.ts) - Deno test suite
- [integration-test.sh](./integration-test.sh) - Bash integration tests

## Common Commands

```bash
# Deploy function
npx supabase functions deploy federation-webhook

# View logs
npx supabase functions logs federation-webhook --tail

# Run tests
./integration-test.sh

# View webhook stats
psql -c "SELECT * FROM get_webhook_stats('peer-uuid', 24);"

# Cleanup old logs
psql -c "SELECT cleanup_old_webhook_logs();"
```

## Success Checklist

- [x] Migration applied
- [x] Edge function deployed
- [x] Environment variables set
- [x] Database settings configured
- [x] Test peer configured
- [x] Manual test successful
- [x] Webhook received and verified
- [x] Logs visible in database

**Congratulations! Your webhook system is ready!** 🎉

---

**Time to complete**: ~5 minutes
**Difficulty**: Beginner
**Last updated**: 2026-02-14
