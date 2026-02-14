# Federation Connection Pool

A high-performance HTTP connection pooling library for federated FEED instances. Implements intelligent request management with concurrency control, automatic retries, and comprehensive statistics tracking.

## Features

- **Zero Dependencies**: Uses native `fetch` API with keep-alive connections
- **Concurrency Control**: Per-instance and global request limits
- **Automatic Queuing**: FIFO queue with configurable size limits
- **Smart Retries**: Exponential backoff for 5xx errors and network failures
- **Connection Reuse**: Keep-alive connections with idle timeout management
- **Statistics Tracking**: Detailed metrics per instance and globally
- **TypeScript**: Full type safety with comprehensive type definitions
- **Production Ready**: Includes timeout handling, graceful shutdown, and error recovery

## Performance Goals

- Reduce federation request latency by **30%+** through connection reuse
- Support **5 concurrent requests per instance** by default
- Handle **50+ total concurrent requests** across all partners
- Automatic cleanup of idle connections after **60 seconds**

## Installation

```typescript
import {
  createFederationPool,
  defaultPool,
  type PoolConfig
} from '@feed/shared/lib/federation-pool'
```

## Quick Start

### Using the Default Pool

```typescript
import { defaultPool } from '@feed/shared/lib/federation-pool'

const response = await defaultPool.request({
  url: 'https://partner.feed.network/api/posts',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer token123',
  },
})

console.log('Status:', response.status)
console.log('Body:', response.body)
console.log('Duration:', response.durationMs, 'ms')
```

### Creating a Custom Pool

```typescript
import { createFederationPool } from '@feed/shared/lib/federation-pool'

const pool = createFederationPool({
  maxConcurrentPerInstance: 3,
  maxTotalConcurrent: 20,
  requestTimeoutMs: 10000,
  retryAttempts: 3,
})

const response = await pool.request({
  url: 'https://partner.feed.network/api/submit',
  method: 'POST',
  body: JSON.stringify({ data: 'example' }),
})
```

## Configuration

### PoolConfig Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxConcurrentPerInstance` | number | 5 | Maximum concurrent requests per federated instance |
| `maxTotalConcurrent` | number | 50 | Maximum total concurrent requests across all instances |
| `requestTimeoutMs` | number | 30000 | Request timeout in milliseconds |
| `idleTimeoutMs` | number | 60000 | Close idle connections after this duration |
| `retryAttempts` | number | 2 | Number of retry attempts for failed requests |
| `retryDelayMs` | number | 1000 | Base delay between retries (with exponential backoff) |
| `maxQueueSize` | number | 1000 | Maximum queued requests before rejecting new ones |

### Default Configuration

```typescript
const DEFAULT_CONFIG: PoolConfig = {
  maxConcurrentPerInstance: 5,
  maxTotalConcurrent: 50,
  requestTimeoutMs: 30000,      // 30 seconds
  idleTimeoutMs: 60000,         // 60 seconds
  retryAttempts: 2,
  retryDelayMs: 1000,           // 1 second base delay
  maxQueueSize: 1000,
}
```

## API Reference

### `FederationPool`

The main connection pool class.

#### Methods

##### `request(req: PooledRequest): Promise<PooledResponse>`

Execute a pooled HTTP request.

```typescript
const response = await pool.request({
  url: 'https://partner.feed.network/api/endpoint',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token',
  },
  body: JSON.stringify({ data: 'example' }),
  instanceId: 'partner.feed.network', // Optional: auto-extracted from URL
})
```

**Parameters:**
- `url` (string): Target URL
- `method` ('GET' | 'POST' | 'PUT' | 'DELETE'): HTTP method
- `headers` (Record<string, string>): Optional request headers
- `body` (string): Optional request body
- `instanceId` (string): Optional instance ID (extracted from URL if omitted)

**Returns:** `Promise<PooledResponse>`

##### `getStats(): PoolStats`

Get current pool statistics.

```typescript
const stats = pool.getStats()
console.log({
  total: stats.totalRequests,
  active: stats.activeRequests,
  queued: stats.queuedRequests,
  completed: stats.completedRequests,
  failed: stats.failedRequests,
  avgDuration: stats.avgDurationMs,
})

// Per-instance statistics
stats.instanceStats.forEach((instanceStats, instanceId) => {
  console.log(`${instanceId}:`, instanceStats)
})
```

##### `drain(): Promise<void>`

Wait for all in-flight requests to complete.

```typescript
await pool.drain()
console.log('All requests completed')
```

##### `shutdown(): void`

Cancel all pending requests and reject queued requests.

```typescript
pool.shutdown()
console.log('Pool shutdown complete')
```

### Types

#### `PooledRequest`

```typescript
interface PooledRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  instanceId?: string
}
```

#### `PooledResponse`

```typescript
interface PooledResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  retries: number
  fromPool: boolean
  instanceId: string
}
```

#### `PoolStats`

```typescript
interface PoolStats {
  totalRequests: number
  activeRequests: number
  queuedRequests: number
  completedRequests: number
  failedRequests: number
  avgDurationMs: number
  instanceStats: Map<string, {
    active: number
    queued: number
    total: number
  }>
}
```

## Behavior Details

### Concurrency Control

The pool enforces two levels of concurrency limits:

1. **Per-Instance Limit**: Prevents overwhelming a single federated partner
2. **Global Limit**: Prevents resource exhaustion on the client

When limits are reached, requests are automatically queued in FIFO order.

```typescript
// Example: 10 requests to same instance with limit of 5
// First 5 execute immediately, remaining 5 are queued
const requests = Array.from({ length: 10 }, (_, i) =>
  pool.request({
    url: `https://partner.feed.network/api/${i}`,
    method: 'GET',
  })
)

await Promise.all(requests) // All complete in order
```

### Retry Logic

The pool automatically retries requests that fail with:
- **5xx Server Errors**: Indicates temporary server issues
- **Network Errors**: Connection failures, timeouts, DNS errors

**Retry behavior:**
- Uses exponential backoff: `retryDelayMs * 2^attemptNumber`
- Default: 1s, 2s, 4s for 3 total attempts
- Does NOT retry 4xx client errors (invalid requests)

```typescript
// Example: Automatic retry on 503 Service Unavailable
const response = await pool.request({
  url: 'https://partner.feed.network/api/endpoint',
  method: 'GET',
})

console.log('Retries:', response.retries) // Could be 0-2
```

### Timeout Management

Each request has an independent timeout controlled by `requestTimeoutMs`:

```typescript
const pool = createFederationPool({
  requestTimeoutMs: 5000, // 5 second timeout
})

try {
  await pool.request({
    url: 'https://slow-partner.feed.network/api/endpoint',
    method: 'GET',
  })
} catch (error) {
  // Throws if request exceeds 5 seconds
  console.error('Request timed out')
}
```

### Connection Reuse

The pool uses native fetch with `Connection: keep-alive` headers:

- Connections are reused for multiple requests to the same instance
- Idle connections are closed after `idleTimeoutMs`
- Instance state is cleaned up when idle

```typescript
// These 5 requests reuse the same connection
for (let i = 0; i < 5; i++) {
  await pool.request({
    url: 'https://partner.feed.network/api/endpoint',
    method: 'GET',
  })
}
```

### Queue Management

Requests are queued when concurrency limits are reached:

- Queue uses FIFO (First-In-First-Out) ordering
- Maximum queue size prevents memory exhaustion
- Queued requests track wait time in statistics

```typescript
// If maxQueueSize is exceeded:
try {
  await pool.request({
    url: 'https://partner.feed.network/api/endpoint',
    method: 'GET',
  })
} catch (error) {
  console.error('Queue size limit exceeded')
}
```

## Usage Patterns

### Multi-Partner Requests

```typescript
const partners = [
  'https://nyc.feed.network',
  'https://sf.feed.network',
  'https://chicago.feed.network',
]

const responses = await Promise.allSettled(
  partners.map(url =>
    defaultPool.request({
      url: `${url}/api/resources`,
      method: 'GET',
    })
  )
)

responses.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`${partners[index]}:`, result.value.status)
  } else {
    console.error(`${partners[index]} failed:`, result.reason)
  }
})
```

### Monitoring Pool Health

```typescript
setInterval(() => {
  const stats = pool.getStats()
  console.log('Pool Health:', {
    active: stats.activeRequests,
    queued: stats.queuedRequests,
    successRate: (
      stats.completedRequests / stats.totalRequests * 100
    ).toFixed(2) + '%',
    avgLatency: Math.round(stats.avgDurationMs) + 'ms',
  })
}, 5000)
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down...')

  // Wait for in-flight requests
  await pool.drain()

  // Reject queued requests
  pool.shutdown()

  process.exit(0)
})
```

### Error Handling

```typescript
try {
  const response = await pool.request({
    url: 'https://partner.feed.network/api/submit',
    method: 'POST',
    body: JSON.stringify({ data: 'example' }),
  })

  if (response.status >= 200 && response.status < 300) {
    // Success
    const data = JSON.parse(response.body)
    console.log('Success:', data)
  } else if (response.status >= 400 && response.status < 500) {
    // Client error (no retries)
    console.error('Invalid request:', response.body)
  } else {
    // Server error (already retried)
    console.error('Server error after retries:', response.retries)
  }
} catch (error) {
  // Network error, timeout, or pool error
  console.error('Request failed:', error)
}
```

## Performance Benchmarks

Expected performance improvements over standard fetch:

| Metric | Standard Fetch | With Pool | Improvement |
|--------|---------------|-----------|-------------|
| Connection Setup | ~50-100ms | ~5-10ms | **~90% faster** |
| Request Latency | 150-200ms | 100-130ms | **~30% faster** |
| Throughput | ~10 req/s | ~50 req/s | **5x increase** |
| Failed Requests | No retries | Auto-retry | **Higher reliability** |

## Limitations

### Browser Environment

The pool uses native `fetch`, which has different behavior in browsers vs Node.js:

- **Node.js**: Full control over connection pooling via keep-alive
- **Browser**: Connection pooling managed by browser (less control)

For browser environments, the pool still provides:
- Concurrency control
- Request queuing
- Retry logic
- Statistics tracking

### Connection Lifecycle

The pool cannot explicitly close connections - it relies on:
- Browser/runtime connection pooling
- Idle timeout to release instance state
- Keep-alive headers to signal intent

### Streaming Responses

The current implementation reads the full response body before returning. For streaming use cases:

```typescript
// Not supported by pool (loads entire response):
const response = await pool.request({
  url: 'https://partner.feed.network/api/large-file',
  method: 'GET',
})

// For streaming, use fetch directly:
const fetchResponse = await fetch(url)
const reader = fetchResponse.body.getReader()
```

## Testing

Comprehensive test suite included at `packages/shared/lib/__tests__/federation-pool.test.ts`.

Run tests:
```bash
npm test -- federation-pool
```

Test coverage:
- Basic request execution
- Concurrency control
- Retry logic
- Statistics tracking
- Pool management
- Error handling
- Graceful shutdown

## Examples

See `federation-pool.example.ts` for 10+ complete examples including:
- Basic usage
- Custom configuration
- Multi-partner requests
- Monitoring and diagnostics
- Graceful shutdown
- Error handling patterns
- Rate limiting
- Federation discovery
- Performance optimization

## Integration with FEED

### Federation Protocol (Phase 6)

This pool is designed for use in FEED's federation protocol:

```typescript
// In supabase/functions/federation-sync/index.ts
import { defaultPool } from '@feed/shared/lib/federation-pool'

const syncWithPartner = async (partnerUrl: string) => {
  const response = await defaultPool.request({
    url: `${partnerUrl}/api/federation/posts`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${federationToken}`,
    },
  })

  return JSON.parse(response.body)
}
```

### Edge Function Usage

```typescript
// In Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { defaultPool } from './federation-pool.ts'

serve(async (req) => {
  const response = await defaultPool.request({
    url: 'https://partner.feed.network/api/resources',
    method: 'GET',
  })

  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## Troubleshooting

### High Queue Depth

```typescript
const stats = pool.getStats()
if (stats.queuedRequests > 100) {
  console.warn('High queue depth - consider:')
  console.warn('- Increasing maxConcurrentPerInstance')
  console.warn('- Increasing maxTotalConcurrent')
  console.warn('- Reducing request volume')
  console.warn('- Checking for slow partners')
}
```

### Frequent Timeouts

```typescript
const stats = pool.getStats()
const timeoutRate = stats.failedRequests / stats.totalRequests

if (timeoutRate > 0.1) {
  console.warn('Timeout rate:', (timeoutRate * 100).toFixed(2) + '%')
  console.warn('Consider increasing requestTimeoutMs')
}
```

### Memory Leaks

```typescript
// Monitor queue growth
setInterval(() => {
  const stats = pool.getStats()
  if (stats.queuedRequests > stats.maxQueueSize * 0.8) {
    console.error('Queue approaching limit - investigate')
  }
}, 10000)
```

## Version History

- **1.0.0** (2026-02-14): Initial implementation
  - Zero-dependency connection pooling
  - Per-instance concurrency limits
  - Automatic retry with exponential backoff
  - Comprehensive statistics tracking
  - Graceful shutdown support

## License

MIT License - Part of the FEED Mutual Aid Platform

## Contributing

See the main FEED repository for contribution guidelines.
