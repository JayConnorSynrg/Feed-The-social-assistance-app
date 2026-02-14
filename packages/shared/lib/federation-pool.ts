/**
 * Federation Connection Pool
 *
 * Manages outbound HTTP requests to federated instances with:
 * - Per-instance concurrency limits
 * - Request queuing and prioritization
 * - Connection reuse via keep-alive
 * - Automatic retries with exponential backoff
 * - Comprehensive statistics tracking
 *
 * Uses native fetch with zero external dependencies.
 */

export interface PoolConfig {
  maxConcurrentPerInstance: number  // default 5
  maxTotalConcurrent: number       // default 50
  requestTimeoutMs: number         // default 30000
  idleTimeoutMs: number            // default 60000
  retryAttempts: number            // default 2
  retryDelayMs: number             // default 1000
  maxQueueSize: number             // default 1000 (prevent memory exhaustion)
}

export interface PooledRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  instanceId?: string  // Optional: extracted from URL if not provided
}

export interface PooledResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  retries: number
  fromPool: boolean
  instanceId: string
}

export interface PoolStats {
  totalRequests: number
  activeRequests: number
  queuedRequests: number
  completedRequests: number
  failedRequests: number
  avgDurationMs: number
  instanceStats: Map<string, { active: number, queued: number, total: number }>
}

interface QueuedRequest {
  request: PooledRequest
  resolve: (response: PooledResponse) => void
  reject: (error: Error) => void
  enqueuedAt: number
}

interface InstanceState {
  active: number
  queued: number
  total: number
  lastRequestAt: number
}

const DEFAULT_CONFIG: PoolConfig = {
  maxConcurrentPerInstance: 5,
  maxTotalConcurrent: 50,
  requestTimeoutMs: 30000,
  idleTimeoutMs: 60000,
  retryAttempts: 2,
  retryDelayMs: 1000,
  maxQueueSize: 1000,
}

export class FederationPool {
  private config: PoolConfig
  private instanceStates: Map<string, InstanceState>
  private requestQueue: QueuedRequest[]
  private activeRequests: number
  private totalRequests: number
  private completedRequests: number
  private failedRequests: number
  private totalDurationMs: number
  private isShutdown: boolean
  private idleTimers: Map<string, NodeJS.Timeout>

  constructor(config?: Partial<PoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.instanceStates = new Map()
    this.requestQueue = []
    this.activeRequests = 0
    this.totalRequests = 0
    this.completedRequests = 0
    this.failedRequests = 0
    this.totalDurationMs = 0
    this.isShutdown = false
    this.idleTimers = new Map()
  }

  /**
   * Execute a pooled HTTP request with automatic queuing and retry
   */
  async request(req: PooledRequest): Promise<PooledResponse> {
    if (this.isShutdown) {
      throw new Error('Federation pool is shutdown')
    }

    // Extract instance ID from URL if not provided
    const instanceId = req.instanceId || this.extractInstanceId(req.url)

    // Check queue size limit
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue size limit exceeded (${this.config.maxQueueSize})`)
    }

    this.totalRequests++

    // Ensure instance state exists
    if (!this.instanceStates.has(instanceId)) {
      this.instanceStates.set(instanceId, {
        active: 0,
        queued: 0,
        total: 0,
        lastRequestAt: 0,
      })
    }

    const state = this.instanceStates.get(instanceId)!

    // Check if we can execute immediately
    if (
      this.activeRequests < this.config.maxTotalConcurrent &&
      state.active < this.config.maxConcurrentPerInstance
    ) {
      return this.executeRequest(req, instanceId)
    }

    // Queue the request
    return new Promise<PooledResponse>((resolve, reject) => {
      const queued: QueuedRequest = {
        request: req,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      }

      this.requestQueue.push(queued)
      state.queued++
    })
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats {
    const instanceStats = new Map<string, { active: number, queued: number, total: number }>()

    for (const [instanceId, state] of this.instanceStates.entries()) {
      instanceStats.set(instanceId, {
        active: state.active,
        queued: state.queued,
        total: state.total,
      })
    }

    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      avgDurationMs: this.completedRequests > 0
        ? this.totalDurationMs / this.completedRequests
        : 0,
      instanceStats,
    }
  }

  /**
   * Wait for all in-flight requests to complete
   */
  async drain(): Promise<void> {
    while (this.activeRequests > 0 || this.requestQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * Cancel all pending requests and reject queued requests
   */
  shutdown(): void {
    this.isShutdown = true

    // Clear all idle timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer)
    }
    this.idleTimers.clear()

    // Reject all queued requests
    for (const queued of this.requestQueue) {
      queued.reject(new Error('Federation pool shutdown'))
    }
    this.requestQueue = []

    // Reset queue counts
    for (const state of this.instanceStates.values()) {
      state.queued = 0
    }
  }

  /**
   * Extract instance ID from URL hostname
   */
  private extractInstanceId(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.hostname
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }
  }

  /**
   * Execute a request with retries
   */
  private async executeRequest(
    req: PooledRequest,
    instanceId: string,
    retryCount = 0
  ): Promise<PooledResponse> {
    const state = this.instanceStates.get(instanceId)!

    // Increment counters
    state.active++
    state.total++
    state.lastRequestAt = Date.now()
    this.activeRequests++

    // Clear any existing idle timer for this instance
    const existingTimer = this.idleTimers.get(instanceId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.idleTimers.delete(instanceId)
    }

    const startTime = Date.now()
    let response: PooledResponse

    try {
      // Create abort controller for timeout
      const abortController = new AbortController()
      const timeoutId = setTimeout(
        () => abortController.abort(),
        this.config.requestTimeoutMs
      )

      try {
        // Prepare headers with keep-alive and federation user agent
        const headers = {
          'Connection': 'keep-alive',
          'User-Agent': 'FEED-Federation/1.0',
          ...req.headers,
        }

        // Execute fetch
        const fetchResponse = await fetch(req.url, {
          method: req.method,
          headers,
          body: req.body,
          signal: abortController.signal,
        })

        clearTimeout(timeoutId)

        // Extract response headers
        const responseHeaders: Record<string, string> = {}
        fetchResponse.headers.forEach((value, key) => {
          responseHeaders[key] = value
        })

        // Read response body
        const body = await fetchResponse.text()

        const durationMs = Date.now() - startTime

        response = {
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers: responseHeaders,
          body,
          durationMs,
          retries: retryCount,
          fromPool: true,
          instanceId,
        }

        // Check if we should retry on 5xx errors
        if (
          fetchResponse.status >= 500 &&
          retryCount < this.config.retryAttempts
        ) {
          // Decrement counters before retry
          state.active--
          this.activeRequests--

          // Wait before retry with exponential backoff
          const delay = this.config.retryDelayMs * Math.pow(2, retryCount)
          await new Promise(resolve => setTimeout(resolve, delay))

          // Retry recursively
          return this.executeRequest(req, instanceId, retryCount + 1)
        }

        // Track statistics
        this.totalDurationMs += durationMs

        if (fetchResponse.ok) {
          this.completedRequests++
        } else {
          this.failedRequests++
        }

      } catch (error) {
        clearTimeout(timeoutId)

        // Handle fetch errors (network, timeout, abort)
        if (retryCount < this.config.retryAttempts) {
          // Decrement counters before retry
          state.active--
          this.activeRequests--

          // Wait before retry
          const delay = this.config.retryDelayMs * Math.pow(2, retryCount)
          await new Promise(resolve => setTimeout(resolve, delay))

          // Retry recursively
          return this.executeRequest(req, instanceId, retryCount + 1)
        }

        // Max retries exhausted
        this.failedRequests++
        throw error
      }

    } finally {
      // Decrement active counters
      state.active--
      this.activeRequests--

      // Start idle timeout if no more active requests for this instance
      if (state.active === 0) {
        const timer = setTimeout(() => {
          // Cleanup instance state if still idle
          if (state.active === 0) {
            this.instanceStates.delete(instanceId)
            this.idleTimers.delete(instanceId)
          }
        }, this.config.idleTimeoutMs)

        this.idleTimers.set(instanceId, timer)
      }

      // Process next queued request
      this.processQueue()
    }

    return response!
  }

  /**
   * Process the next queued request if capacity available
   */
  private processQueue(): void {
    if (this.requestQueue.length === 0) {
      return
    }

    if (this.activeRequests >= this.config.maxTotalConcurrent) {
      return
    }

    // Find next request that can be executed
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queued = this.requestQueue[i]
      const instanceId = queued.request.instanceId ||
        this.extractInstanceId(queued.request.url)

      const state = this.instanceStates.get(instanceId)

      if (!state || state.active < this.config.maxConcurrentPerInstance) {
        // Remove from queue
        this.requestQueue.splice(i, 1)

        if (state) {
          state.queued--
        }

        // Execute the request
        this.executeRequest(queued.request, instanceId)
          .then(queued.resolve)
          .catch(queued.reject)

        // Try to process another request
        this.processQueue()
        break
      }
    }
  }
}

/**
 * Factory function to create a new federation pool
 */
export function createFederationPool(config?: Partial<PoolConfig>): FederationPool {
  return new FederationPool(config)
}

/**
 * Default singleton pool instance
 */
export const defaultPool = new FederationPool()
