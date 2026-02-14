/**
 * Federation Pool Usage Examples
 *
 * Demonstrates common patterns for using the federation connection pool.
 */

import {
  createFederationPool,
  defaultPool,
  type PoolConfig,
  type PooledRequest,
  type PooledResponse,
} from './federation-pool'

// ============================================================================
// Example 1: Using the Default Singleton Pool
// ============================================================================

async function basicUsage() {
  try {
    const response = await defaultPool.request({
      url: 'https://partner.feed.network/api/posts',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer xyz123',
      },
    })

    console.log('Status:', response.status)
    console.log('Body:', response.body)
    console.log('Duration:', response.durationMs, 'ms')
    console.log('Retries:', response.retries)
  } catch (error) {
    console.error('Request failed:', error)
  }
}

// ============================================================================
// Example 2: Creating a Custom Pool with Configuration
// ============================================================================

async function customPoolExample() {
  const pool = createFederationPool({
    maxConcurrentPerInstance: 3,  // Allow 3 concurrent requests per partner
    maxTotalConcurrent: 20,        // Maximum 20 total concurrent requests
    requestTimeoutMs: 10000,       // 10 second timeout
    idleTimeoutMs: 30000,          // Close idle connections after 30s
    retryAttempts: 3,              // Retry up to 3 times
    retryDelayMs: 500,             // Wait 500ms before first retry
    maxQueueSize: 500,             // Allow up to 500 queued requests
  })

  const response = await pool.request({
    url: 'https://partner.feed.network/api/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'resource',
      data: { title: 'Food Bank', location: [40.7, -74.0] },
    }),
  })

  // Monitor pool health
  const stats = pool.getStats()
  console.log('Pool Statistics:', {
    total: stats.totalRequests,
    active: stats.activeRequests,
    queued: stats.queuedRequests,
    avgDuration: stats.avgDurationMs,
  })

  // Cleanup when done
  await pool.drain()
  pool.shutdown()
}

// ============================================================================
// Example 3: Handling Multiple Federated Partners
// ============================================================================

async function multiPartnerExample() {
  const partners = [
    'https://nyc.feed.network',
    'https://sf.feed.network',
    'https://chicago.feed.network',
  ]

  // Make parallel requests to all partners
  const requests = partners.map(baseUrl =>
    defaultPool.request({
      url: `${baseUrl}/api/resources`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer xyz123',
      },
    })
  )

  try {
    const responses = await Promise.allSettled(requests)

    responses.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const response = result.value
        console.log(`Partner ${partners[index]}:`, {
          status: response.status,
          duration: response.durationMs,
          retries: response.retries,
        })
      } else {
        console.error(`Partner ${partners[index]} failed:`, result.reason)
      }
    })
  } catch (error) {
    console.error('Request batch failed:', error)
  }
}

// ============================================================================
// Example 4: Monitoring and Diagnostics
// ============================================================================

async function monitoringExample() {
  // Start some requests
  const requests = Array.from({ length: 10 }, (_, i) =>
    defaultPool.request({
      url: `https://partner.feed.network/api/resource/${i}`,
      method: 'GET',
    })
  )

  // Poll statistics while requests are in flight
  const interval = setInterval(() => {
    const stats = defaultPool.getStats()
    console.log('Pool Status:', {
      active: stats.activeRequests,
      queued: stats.queuedRequests,
      completed: stats.completedRequests,
      failed: stats.failedRequests,
      avgDuration: Math.round(stats.avgDurationMs),
    })

    // Per-instance breakdown
    stats.instanceStats.forEach((instanceStats, instanceId) => {
      console.log(`  ${instanceId}:`, instanceStats)
    })
  }, 1000)

  await Promise.allSettled(requests)
  clearInterval(interval)

  // Final statistics
  const finalStats = defaultPool.getStats()
  console.log('Final Statistics:', finalStats)
}

// ============================================================================
// Example 5: Graceful Shutdown
// ============================================================================

async function gracefulShutdownExample() {
  const pool = createFederationPool()

  // Start long-running requests
  const requests = Array.from({ length: 5 }, (_, i) =>
    pool.request({
      url: `https://partner.feed.network/api/long-task/${i}`,
      method: 'GET',
    })
  )

  // Simulate shutdown signal
  process.on('SIGTERM', async () => {
    console.log('Shutdown signal received')

    // Wait for all in-flight requests to complete
    console.log('Draining connection pool...')
    await pool.drain()

    // Shutdown the pool (rejects queued requests)
    pool.shutdown()

    console.log('Pool shutdown complete')
    process.exit(0)
  })

  await Promise.allSettled(requests)
}

// ============================================================================
// Example 6: Error Handling Patterns
// ============================================================================

async function errorHandlingExample() {
  try {
    const response = await defaultPool.request({
      url: 'https://partner.feed.network/api/critical',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ critical: true }),
    })

    // Check response status
    if (response.status >= 200 && response.status < 300) {
      // Success
      const data = JSON.parse(response.body)
      console.log('Success:', data)
    } else if (response.status >= 400 && response.status < 500) {
      // Client error - don't retry, log for debugging
      console.error('Client error:', response.status, response.body)
    } else if (response.status >= 500) {
      // Server error - already retried by pool
      console.error('Server error after retries:', response.status)
      console.error('Retry count:', response.retries)
    }
  } catch (error) {
    // Network errors, timeouts, or pool errors
    console.error('Request failed completely:', error)

    // Check if it's a timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timed out')
    }
  }
}

// ============================================================================
// Example 7: Rate Limiting and Backpressure
// ============================================================================

async function rateLimitingExample() {
  const pool = createFederationPool({
    maxConcurrentPerInstance: 2,
    maxQueueSize: 100,
  })

  const instanceId = 'partner.feed.network'

  // Make many requests - pool will automatically queue and throttle
  const requests = Array.from({ length: 50 }, (_, i) => {
    return pool.request({
      url: `https://${instanceId}/api/item/${i}`,
      method: 'GET',
      instanceId, // Explicitly set for better control
    })
  })

  try {
    const results = await Promise.allSettled(requests)

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`Completed: ${successful} successful, ${failed} failed`)
  } catch (error) {
    console.error('Batch failed:', error)
  } finally {
    await pool.drain()
    pool.shutdown()
  }
}

// ============================================================================
// Example 8: Federation Discovery Pattern
// ============================================================================

async function discoveryExample() {
  const pool = createFederationPool()

  // Discover federated instances
  const directoryResponse = await pool.request({
    url: 'https://directory.feed.network/api/instances',
    method: 'GET',
  })

  const instances = JSON.parse(directoryResponse.body)

  // Query each discovered instance in parallel
  const healthChecks = instances.map((instance: { url: string }) =>
    pool.request({
      url: `${instance.url}/api/health`,
      method: 'GET',
    })
  )

  const results = await Promise.allSettled(healthChecks)

  // Filter to healthy instances
  const healthyInstances = results
    .map((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 200) {
        return instances[index]
      }
      return null
    })
    .filter(Boolean)

  console.log('Healthy instances:', healthyInstances)

  await pool.drain()
  pool.shutdown()
}

// ============================================================================
// Example 9: Streaming Large Responses
// ============================================================================

async function streamingExample() {
  // Note: The pool returns the full response body as a string.
  // For true streaming, you would need to bypass the pool or extend it.
  // This example shows how to handle large responses efficiently.

  const response = await defaultPool.request({
    url: 'https://partner.feed.network/api/bulk-export',
    method: 'GET',
  })

  // Process large response in chunks
  const lines = response.body.split('\n')
  for (const line of lines) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line)
        // Process item
        console.log('Processing:', item.id)
      } catch (error) {
        console.error('Invalid JSON line:', line)
      }
    }
  }
}

// ============================================================================
// Example 10: Performance Optimization
// ============================================================================

async function performanceExample() {
  const pool = createFederationPool({
    maxConcurrentPerInstance: 10,  // Higher concurrency for bulk operations
    requestTimeoutMs: 5000,         // Shorter timeout for fast-fail
    retryAttempts: 1,               // Fewer retries for performance
    idleTimeoutMs: 300000,          // Keep connections alive longer (5 min)
  })

  const startTime = Date.now()

  // Bulk fetch resources from multiple partners
  const partners = ['nyc', 'sf', 'la', 'chicago', 'boston']
  const resourceTypes = ['food', 'housing', 'healthcare', 'legal']

  const requests = partners.flatMap(partner =>
    resourceTypes.map(type =>
      pool.request({
        url: `https://${partner}.feed.network/api/resources/${type}`,
        method: 'GET',
        instanceId: `${partner}.feed.network`,
      })
    )
  )

  const results = await Promise.allSettled(requests)

  const endTime = Date.now()
  const stats = pool.getStats()

  console.log('Performance Summary:', {
    totalRequests: requests.length,
    duration: endTime - startTime,
    avgRequestDuration: stats.avgDurationMs,
    successRate: (stats.completedRequests / stats.totalRequests) * 100,
    latencyReduction: stats.avgDurationMs < 100 ? 'Excellent' : 'Good',
  })

  await pool.drain()
  pool.shutdown()
}

// Export examples for testing
export {
  basicUsage,
  customPoolExample,
  multiPartnerExample,
  monitoringExample,
  gracefulShutdownExample,
  errorHandlingExample,
  rateLimitingExample,
  discoveryExample,
  streamingExample,
  performanceExample,
}
