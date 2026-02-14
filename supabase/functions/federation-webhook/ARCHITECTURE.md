# Federation Webhook Architecture

This document describes the technical architecture of the FEED Federation webhook notification system.

## System Overview

The webhook system provides real-time push notifications to federation partners when resources are created, updated, or deleted. It uses HMAC-SHA256 signatures for payload integrity and implements automatic retries with exponential backoff.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEED Instance (Oakland)                      │
│                                                                 │
│  ┌──────────────┐                                               │
│  │  Resources   │  INSERT/UPDATE/DELETE                         │
│  │    Table     │────────────────┐                              │
│  └──────────────┘                │                              │
│                                  ▼                              │
│                        ┌──────────────────┐                     │
│                        │  Database        │                     │
│                        │  Trigger         │                     │
│                        │  (on_resource_   │                     │
│                        │   change_webhook)│                     │
│                        └─────────┬────────┘                     │
│                                  │                              │
│                                  ▼                              │
│                        ┌──────────────────┐                     │
│                        │  pg_net.http_post│                     │
│                        │  (async call)    │                     │
│                        └─────────┬────────┘                     │
│                                  │                              │
│  ┌───────────────────────────────▼─────────────────────┐       │
│  │        Federation Webhook Edge Function             │       │
│  │                                                      │       │
│  │  1. Validate request                                │       │
│  │  2. Fetch peers with webhook_url                    │       │
│  │  3. Generate HMAC signature                         │       │
│  │  4. Deliver webhooks in parallel                    │       │
│  │  5. Retry failed deliveries (3x)                    │       │
│  │  6. Log delivery results                            │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                         │                                       │
│                         │ POST with signed payload              │
│                         ▼                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │   SF    │      │   LA    │      │Berkeley │
    │  FEED   │      │  FEED   │      │  FEED   │
    │Instance │      │Instance │      │Instance │
    └─────────┘      └─────────┘      └─────────┘
         │                │                │
         ▼                ▼                ▼
    Webhook          Webhook          Webhook
    Receiver         Receiver         Receiver
    (verify sig)     (verify sig)     (verify sig)
```

## Component Architecture

### 1. Database Layer

#### Tables

**federation_peers**
```sql
- id (UUID)
- local_instance_id (UUID)
- remote_instance_id (UUID)
- webhook_enabled (BOOLEAN) -- NEW
- metadata (JSONB)
  └─ webhook_url (TEXT)
```

**federation_webhook_log**
```sql
- id (UUID)
- peer_id (UUID) → federation_peers.id
- event_type (TEXT) -- resource.created, resource.updated, resource.deleted
- resource_id (UUID)
- resource_type (TEXT)
- delivery_status (TEXT) -- success, failed, retrying
- http_status_code (INTEGER)
- attempts (INTEGER)
- error_message (TEXT)
- delivered_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

#### Functions

**notify_federation_webhook(event_type, resource_id, resource_type)**
- Called by database trigger or manually
- Makes async HTTP POST to Edge Function via pg_net
- Fire-and-forget (doesn't block transaction)

**get_webhook_stats(peer_id, hours_ago)**
- Returns delivery statistics for a peer
- Calculates success rate and average attempts

**get_recent_webhook_failures(limit)**
- Returns recent failed deliveries
- Used for troubleshooting

**cleanup_old_webhook_logs()**
- Deletes logs older than 30 days
- Should be run on a schedule

#### Triggers

**on_resource_change_webhook**
- Attached to resources table
- Fires on INSERT, UPDATE, DELETE
- Calls notify_federation_webhook()

### 2. Edge Function Layer

#### Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Edge Function Execution                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Request Validation                                       │
│     ├─ Check HTTP method (POST only)                        │
│     ├─ Parse JSON body                                      │
│     ├─ Validate required fields                             │
│     └─ Map event_type to event name                         │
│                                                              │
│  2. Peer Discovery                                           │
│     ├─ Query federation_peers WHERE webhook_enabled = TRUE  │
│     ├─ Filter peers with webhook_url in metadata            │
│     └─ Build peer list with webhook URLs                    │
│                                                              │
│  3. Payload Generation                                       │
│     ├─ Build webhook payload object                         │
│     ├─ Generate HMAC-SHA256 signature                       │
│     │  └─ Key: first 64 chars of FEDERATION_PRIVATE_KEY     │
│     └─ Add signature to payload                             │
│                                                              │
│  4. Parallel Webhook Delivery                                │
│     ├─ For each peer with webhook_url:                      │
│     │  ├─ Attempt 1: POST to webhook_url                    │
│     │  ├─ Attempt 2: Retry after 1s (if failed)             │
│     │  ├─ Attempt 3: Retry after 4s (if failed)             │
│     │  ├─ Attempt 4: Retry after 16s (if failed)            │
│     │  └─ Skip retries for 4xx errors                       │
│     └─ Use Promise.allSettled for parallel execution        │
│                                                              │
│  5. Logging                                                  │
│     ├─ Log each delivery to federation_webhook_log          │
│     │  └─ Include status, attempts, error_message           │
│     └─ Can also update federation_sync_log (legacy)         │
│                                                              │
│  6. Response                                                 │
│     ├─ Calculate delivery summary                           │
│     │  ├─ total                                             │
│     │  ├─ succeeded                                         │
│     │  ├─ failed                                            │
│     │  └─ retried                                           │
│     └─ Return JSON with details array                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Functions

**generateSignature(payload, signingSecret)**
- Uses Web Crypto API (Deno)
- HMAC-SHA256 of JSON stringified payload
- Returns `sha256=<hex>` format

**deliverWebhook(webhookUrl, payload, peerName)**
- Implements retry logic with exponential backoff
- 10 second timeout per attempt
- Returns DeliveryResult object

**logDelivery(supabase, peerId, result, payload)**
- Inserts record to federation_webhook_log
- Logs both successes and failures

### 3. Network Layer

#### HTTP Request Format

```http
POST /api/webhooks/federation HTTP/1.1
Host: sf.feed.org
Content-Type: application/json
User-Agent: FEED-Federation/1.0
X-Federation-Signature: sha256=abc123...
X-Federation-Event: resource.created

{
  "event": "resource.created",
  "instance_id": "uuid-of-sender",
  "instance_url": "https://oakland.feed.org",
  "resource_id": "uuid-of-resource",
  "resource_type": "food",
  "timestamp": "2026-02-14T12:00:00Z",
  "signature": "sha256=abc123..."
}
```

#### Security Headers

| Header | Purpose |
|--------|---------|
| `X-Federation-Signature` | HMAC-SHA256 signature of payload |
| `X-Federation-Event` | Event type for quick filtering |
| `User-Agent` | Identifies FEED Federation client |

### 4. Retry Logic

```
Attempt 1: Immediate
    │
    ├─ Success → Log success, return
    │
    └─ Failure
        │
        ├─ 4xx error → Skip retries, log failure, return
        │
        └─ 5xx error or timeout
            │
            Wait 1 second
            │
Attempt 2: After 1s delay
    │
    ├─ Success → Log success (retried), return
    │
    └─ Failure
        │
        Wait 4 seconds
        │
Attempt 3: After 4s delay
    │
    ├─ Success → Log success (retried), return
    │
    └─ Failure
        │
        Wait 16 seconds
        │
Attempt 4: After 16s delay
    │
    ├─ Success → Log success (retried), return
    │
    └─ Failure → Log failure (all attempts exhausted)
```

**Total retry time**: Up to 21 seconds (1s + 4s + 16s)

**Backoff strategy**: Exponential (2^n seconds)

## Data Flow Diagrams

### Create Resource Flow

```
User Action                Database                Edge Function           Remote Instance
    │                         │                         │                        │
    │  INSERT INTO resources  │                         │                        │
    │────────────────────────>│                         │                        │
    │                         │                         │                        │
    │                         │ Trigger fires           │                        │
    │                         │────────────┐            │                        │
    │                         │            │            │                        │
    │                         │<───────────┘            │                        │
    │                         │                         │                        │
    │                         │ pg_net.http_post()      │                        │
    │                         │────────────────────────>│                        │
    │                         │                         │                        │
    │  200 OK                 │                         │ Fetch peers            │
    │<────────────────────────│                         │────────────┐           │
    │                         │                         │            │           │
    │                         │                         │<───────────┘           │
    │                         │                         │                        │
    │                         │                         │ Generate signature     │
    │                         │                         │────────────┐           │
    │                         │                         │            │           │
    │                         │                         │<───────────┘           │
    │                         │                         │                        │
    │                         │                         │ POST webhook           │
    │                         │                         │───────────────────────>│
    │                         │                         │                        │
    │                         │                         │                        │ Verify sig
    │                         │                         │                        │────────┐
    │                         │                         │                        │        │
    │                         │                         │                        │<───────┘
    │                         │                         │                        │
    │                         │                         │         200 OK         │ Process
    │                         │                         │<───────────────────────│
    │                         │                         │                        │
    │                         │                         │ Log delivery           │
    │                         │                         │────────────┐           │
    │                         │                         │            │           │
    │                         │                         │<───────────┘           │
    │                         │                         │                        │
```

### Failed Delivery with Retry Flow

```
Edge Function                                          Remote Instance
    │                                                         │
    │ Attempt 1: POST webhook                                │
    │────────────────────────────────────────────────────────>│
    │                                                         │
    │                                                         X (timeout/error)
    │
    │ Wait 1 second
    │────────────┐
    │            │
    │<───────────┘
    │
    │ Attempt 2: POST webhook
    │────────────────────────────────────────────────────────>│
    │                                                         │
    │                                                         X (timeout/error)
    │
    │ Wait 4 seconds
    │────────────┐
    │            │
    │<───────────┘
    │
    │ Attempt 3: POST webhook
    │────────────────────────────────────────────────────────>│
    │                                                         │
    │                                  200 OK                 │
    │<────────────────────────────────────────────────────────│
    │
    │ Log delivery (success, 3 attempts)
    │────────────┐
    │            │
    │<───────────┘
```

## Security Architecture

### Signature Generation

```typescript
// Sender (Oakland FEED)
const payload = {
  event: 'resource.created',
  instance_id: 'oakland-uuid',
  instance_url: 'https://oakland.feed.org',
  resource_id: 'resource-uuid',
  resource_type: 'food',
  timestamp: '2026-02-14T12:00:00Z'
}

const signingSecret = FEDERATION_PRIVATE_KEY.substring(0, 64)
const signature = HMAC_SHA256(JSON.stringify(payload), signingSecret)
// → sha256=abc123def456...

payload.signature = signature
```

### Signature Verification

```typescript
// Receiver (SF FEED)
const receivedPayload = req.body
const receivedSignature = req.headers['x-federation-signature']

// Remove signature field before verification
const { signature, ...payloadWithoutSignature } = receivedPayload

const expectedSignature = HMAC_SHA256(
  JSON.stringify(payloadWithoutSignature),
  SHARED_SECRET
)

if (receivedSignature !== expectedSignature) {
  throw new Error('Invalid signature')
}

// Also check timestamp
const timestamp = new Date(receivedPayload.timestamp)
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

if (timestamp < fiveMinutesAgo) {
  throw new Error('Timestamp too old')
}
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Max concurrent webhooks | ~100 | Limited by Edge Function concurrency |
| Timeout per delivery | 10s | Per attempt |
| Max retry time | 21s | 1s + 4s + 16s |
| Max execution time | ~40s | Initial + 3 retries |
| Payload size limit | 100KB | Typical Edge Function limit |
| Rate limit | N/A | No built-in rate limiting |

### Optimization Strategies

1. **Parallel delivery**: Uses `Promise.allSettled()` to deliver to all peers simultaneously
2. **Smart retries**: Skips retries for client errors (4xx)
3. **Async logging**: Database logging doesn't block webhook delivery
4. **Connection pooling**: Reuses Supabase client connection
5. **Minimal payload**: Only includes essential fields

## Monitoring & Observability

### Metrics to Monitor

```sql
-- Delivery success rate (last 24 hours)
SELECT
  COUNT(*) FILTER (WHERE delivery_status = 'success')::FLOAT / COUNT(*) * 100 AS success_rate,
  ROUND(AVG(attempts), 2) AS avg_attempts,
  COUNT(*) AS total_deliveries
FROM federation_webhook_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Deliveries per peer (last 24 hours)
SELECT
  fi.instance_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE delivery_status = 'success') AS succeeded,
  COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed
FROM federation_webhook_log wl
JOIN federation_peers fp ON wl.peer_id = fp.id
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE wl.created_at > NOW() - INTERVAL '24 hours'
GROUP BY fi.instance_name;

-- Slow deliveries (> 5 seconds)
SELECT
  fi.instance_name,
  wl.event_type,
  wl.attempts,
  wl.created_at
FROM federation_webhook_log wl
JOIN federation_peers fp ON wl.peer_id = fp.id
JOIN federated_instances fi ON fp.remote_instance_id = fi.id
WHERE wl.attempts > 2 -- Multiple retries indicate slow response
ORDER BY wl.created_at DESC
LIMIT 20;
```

### Alerting Conditions

1. **Success rate < 90%** (last hour) → Investigate webhook receiver issues
2. **Average attempts > 2** → Peers experiencing connectivity issues
3. **Failed deliveries > 10** (last hour) → Potential network issues
4. **No deliveries in 1 hour** → Trigger may be broken

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Production Setup                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Supabase Project (Oakland FEED)                        │
│  ├─ PostgreSQL Database                                 │
│  │  ├─ federation_peers table                           │
│  │  ├─ federation_webhook_log table                     │
│  │  ├─ on_resource_change_webhook trigger               │
│  │  └─ notify_federation_webhook() function             │
│  │                                                       │
│  ├─ Edge Functions                                       │
│  │  └─ federation-webhook                                │
│  │     ├─ Runtime: Deno                                  │
│  │     ├─ Region: Multi-region (auto)                    │
│  │     ├─ Timeout: 60s                                   │
│  │     └─ Memory: 256MB                                  │
│  │                                                       │
│  └─ Environment Variables (Secrets)                      │
│     ├─ FEDERATION_PRIVATE_KEY                            │
│     ├─ FEDERATION_INSTANCE_ID                            │
│     └─ FEDERATION_INSTANCE_URL                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

### Error Categories

| Error Type | HTTP Code | Retry? | Handling |
|------------|-----------|--------|----------|
| Invalid request | 400 | No | Log and return error |
| Unauthorized | 401 | No | Check service role key |
| Missing env vars | 500 | No | Log and return error |
| Peer not found | N/A | No | Skip peer, continue with others |
| Network timeout | N/A | Yes | Retry with backoff |
| 5xx from receiver | 5xx | Yes | Retry with backoff |
| 4xx from receiver | 4xx | No | Log and mark failed |

### Graceful Degradation

1. If peer has no webhook_url → Skip silently
2. If webhook delivery fails → Log but don't fail transaction
3. If all peers fail → Return success with failed count
4. If database logging fails → Log to Edge Function logs

## Scalability Considerations

### Current Limits

- **Peers per instance**: ~1000 (limited by query performance)
- **Webhooks per event**: ~100 (limited by parallel execution)
- **Events per second**: ~10 (limited by Edge Function concurrency)

### Scaling Strategies

1. **Rate limiting**: Add peer-level rate limits
2. **Queue-based delivery**: Use message queue for high volume
3. **Batch webhooks**: Group multiple events into single payload
4. **Regional edge functions**: Deploy closer to peers
5. **Webhook fanout service**: Dedicated microservice for webhook delivery

## Future Enhancements

1. **Webhook subscriptions**: Allow peers to subscribe to specific event types
2. **Webhook verification**: Implement challenge-response verification
3. **Delivery guarantees**: Add at-least-once delivery semantics
4. **Priority queuing**: High-priority webhooks delivered first
5. **Circuit breaker**: Temporarily disable webhooks to failing peers
6. **Rate limiting**: Configurable rate limits per peer
7. **Webhook replay**: Allow peers to request missed events

---

**Version**: 1.0.0
**Last Updated**: 2026-02-14
**Maintainer**: FEED Platform Team
