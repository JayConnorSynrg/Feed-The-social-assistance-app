/**
 * Federation Pool Tests
 *
 * Validates connection pooling behavior, concurrency limits,
 * retry logic, and statistics tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  FederationPool,
  createFederationPool,
  defaultPool,
  type PoolConfig,
} from '../federation-pool'

// Mock fetch globally
global.fetch = vi.fn()

describe('FederationPool', () => {
  let pool: FederationPool

  beforeEach(() => {
    vi.clearAllMocks()
    pool = createFederationPool({
      maxConcurrentPerInstance: 2,
      maxTotalConcurrent: 5,
      requestTimeoutMs: 5000,
      idleTimeoutMs: 1000,
      retryAttempts: 2,
      retryDelayMs: 100,
      maxQueueSize: 10,
    })
  })

  afterEach(() => {
    pool.shutdown()
  })

  describe('Basic Request Execution', () => {
    it('should execute a successful GET request', async () => {
      const mockResponse = new Response('{"success":true}', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

      const response = await pool.request({
        url: 'https://partner1.example.com/api/test',
        method: 'GET',
      })

      expect(response.status).toBe(200)
      expect(response.body).toBe('{"success":true}')
      expect(response.retries).toBe(0)
      expect(response.fromPool).toBe(true)
      expect(response.instanceId).toBe('partner1.example.com')
      expect(response.durationMs).toBeGreaterThan(0)

      expect(fetch).toHaveBeenCalledWith(
        'https://partner1.example.com/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Connection': 'keep-alive',
            'User-Agent': 'FEED-Federation/1.0',
          }),
        })
      )
    })

    it('should execute a POST request with body and custom headers', async () => {
      const mockResponse = new Response('{"created":true}', {
        status: 201,
        statusText: 'Created',
      })

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

      const response = await pool.request({
        url: 'https://partner2.example.com/api/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test',
        },
        body: JSON.stringify({ name: 'test' }),
      })

      expect(response.status).toBe(201)
      expect(fetch).toHaveBeenCalledWith(
        'https://partner2.example.com/api/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'test',
            'User-Agent': 'FEED-Federation/1.0',
          }),
          body: JSON.stringify({ name: 'test' }),
        })
      )
    })

    it('should extract instance ID from URL', async () => {
      const mockResponse = new Response('ok', { status: 200 })
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

      const response = await pool.request({
        url: 'https://test.example.org:8080/path',
        method: 'GET',
      })

      expect(response.instanceId).toBe('test.example.org')
    })

    it('should use provided instance ID if specified', async () => {
      const mockResponse = new Response('ok', { status: 200 })
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

      const response = await pool.request({
        url: 'https://test.example.org/path',
        method: 'GET',
        instanceId: 'custom-instance-id',
      })

      expect(response.instanceId).toBe('custom-instance-id')
    })
  })

  describe('Concurrency Control', () => {
    it('should respect per-instance concurrency limit', async () => {
      const mockResponse = new Response('ok', { status: 200 })

      // Create 4 concurrent requests to same instance (limit is 2)
      const requests = Array.from({ length: 4 }, (_, i) =>
        pool.request({
          url: `https://partner1.example.com/api/${i}`,
          method: 'GET',
        })
      )

      // Let first batch start
      await new Promise(resolve => setTimeout(resolve, 10))

      const stats = pool.getStats()
      expect(stats.activeRequests).toBeLessThanOrEqual(2)
      expect(stats.queuedRequests).toBeGreaterThan(0)

      // Resolve all fetches
      vi.mocked(fetch).mockResolvedValue(mockResponse)
      await Promise.all(requests)

      const finalStats = pool.getStats()
      expect(finalStats.activeRequests).toBe(0)
      expect(finalStats.queuedRequests).toBe(0)
      expect(finalStats.completedRequests).toBe(4)
    })

    it('should respect total concurrency limit across instances', async () => {
      const mockResponse = new Response('ok', { status: 200 })

      // Create 10 requests across different instances (total limit is 5)
      const requests = Array.from({ length: 10 }, (_, i) =>
        pool.request({
          url: `https://partner${i}.example.com/api/test`,
          method: 'GET',
        })
      )

      await new Promise(resolve => setTimeout(resolve, 10))

      const stats = pool.getStats()
      expect(stats.activeRequests).toBeLessThanOrEqual(5)

      vi.mocked(fetch).mockResolvedValue(mockResponse)
      await Promise.all(requests)
    })

    it('should throw error when queue size limit exceeded', async () => {
      // Mock fetch to never resolve
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))

      // Fill the queue (maxQueueSize is 10, maxTotalConcurrent is 5)
      // So we need 15 requests to exceed the queue
      const requests = Array.from({ length: 15 }, (_, i) =>
        pool.request({
          url: `https://partner1.example.com/api/${i}`,
          method: 'GET',
        })
      )

      // Wait for queue to fill
      await new Promise(resolve => setTimeout(resolve, 10))

      // Next request should fail
      await expect(
        pool.request({
          url: 'https://partner1.example.com/api/overflow',
          method: 'GET',
        })
      ).rejects.toThrow('Queue size limit exceeded')
    })
  })

  describe('Retry Logic', () => {
    it('should retry on 5xx server errors', async () => {
      // First two attempts fail, third succeeds
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response('error', { status: 503 }))
        .mockResolvedValueOnce(new Response('error', { status: 500 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))

      const response = await pool.request({
        url: 'https://partner1.example.com/api/test',
        method: 'GET',
      })

      expect(response.status).toBe(200)
      expect(response.retries).toBe(2)
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('should fail after max retry attempts', async () => {
      // All attempts fail with 503
      vi.mocked(fetch).mockResolvedValue(
        new Response('error', { status: 503 })
      )

      const response = await pool.request({
        url: 'https://partner1.example.com/api/test',
        method: 'GET',
      })

      expect(response.status).toBe(503)
      expect(response.retries).toBe(2)
      expect(fetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should retry on network errors', async () => {
      // First two attempts fail, third succeeds
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))

      const response = await pool.request({
        url: 'https://partner1.example.com/api/test',
        method: 'GET',
      })

      expect(response.status).toBe(200)
      expect(response.retries).toBe(2)
    })

    it('should throw after max retries on network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      await expect(
        pool.request({
          url: 'https://partner1.example.com/api/test',
          method: 'GET',
        })
      ).rejects.toThrow('Network error')

      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('should not retry on 4xx client errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('not found', { status: 404 })
      )

      const response = await pool.request({
        url: 'https://partner1.example.com/api/test',
        method: 'GET',
      })

      expect(response.status).toBe(404)
      expect(response.retries).toBe(0)
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Statistics Tracking', () => {
    it('should track request statistics', async () => {
      const mockResponse = new Response('ok', { status: 200 })
      vi.mocked(fetch).mockResolvedValue(mockResponse)

      await pool.request({
        url: 'https://partner1.example.com/api/1',
        method: 'GET',
      })
      await pool.request({
        url: 'https://partner1.example.com/api/2',
        method: 'GET',
      })
      await pool.request({
        url: 'https://partner2.example.com/api/1',
        method: 'GET',
      })

      const stats = pool.getStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.completedRequests).toBe(3)
      expect(stats.failedRequests).toBe(0)
      expect(stats.avgDurationMs).toBeGreaterThan(0)
    })

    it('should track per-instance statistics', async () => {
      const mockResponse = new Response('ok', { status: 200 })
      vi.mocked(fetch).mockResolvedValue(mockResponse)

      await pool.request({
        url: 'https://partner1.example.com/api/1',
        method: 'GET',
      })
      await pool.request({
        url: 'https://partner1.example.com/api/2',
        method: 'GET',
      })
      await pool.request({
        url: 'https://partner2.example.com/api/1',
        method: 'GET',
      })

      const stats = pool.getStats()
      const instance1Stats = stats.instanceStats.get('partner1.example.com')
      const instance2Stats = stats.instanceStats.get('partner2.example.com')

      expect(instance1Stats?.total).toBe(2)
      expect(instance2Stats?.total).toBe(1)
    })

    it('should track failed requests', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('error', { status: 500 })
      )

      await pool.request({
        url: 'https://partner1.example.com/api/test',
        method: 'GET',
      })

      const stats = pool.getStats()
      expect(stats.failedRequests).toBe(1)
      expect(stats.completedRequests).toBe(0)
    })
  })

  describe('Pool Management', () => {
    it('should drain pool waiting for all requests to complete', async () => {
      let resolveCount = 0
      vi.mocked(fetch).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolveCount++
            resolve(new Response('ok', { status: 200 }))
          }, 100)
        })
      })

      // Start 3 requests
      pool.request({
        url: 'https://partner1.example.com/api/1',
        method: 'GET',
      })
      pool.request({
        url: 'https://partner1.example.com/api/2',
        method: 'GET',
      })
      pool.request({
        url: 'https://partner1.example.com/api/3',
        method: 'GET',
      })

      // Drain should wait for all to complete
      await pool.drain()

      expect(resolveCount).toBe(3)
      const stats = pool.getStats()
      expect(stats.activeRequests).toBe(0)
    })

    it('should reject queued requests on shutdown', async () => {
      // Mock fetch to never resolve
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))

      // Create more requests than can be executed
      const request1 = pool.request({
        url: 'https://partner1.example.com/api/1',
        method: 'GET',
      })
      const request2 = pool.request({
        url: 'https://partner1.example.com/api/2',
        method: 'GET',
      })
      const request3 = pool.request({
        url: 'https://partner1.example.com/api/3',
        method: 'GET',
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      pool.shutdown()

      // Queued requests should be rejected
      await expect(request3).rejects.toThrow('Federation pool shutdown')
    })

    it('should reject new requests after shutdown', async () => {
      pool.shutdown()

      await expect(
        pool.request({
          url: 'https://partner1.example.com/api/test',
          method: 'GET',
        })
      ).rejects.toThrow('Federation pool is shutdown')
    })
  })

  describe('Factory and Singleton', () => {
    it('should create pool with custom config', () => {
      const customPool = createFederationPool({
        maxConcurrentPerInstance: 10,
        requestTimeoutMs: 60000,
      })

      expect(customPool).toBeInstanceOf(FederationPool)
    })

    it('should provide default singleton', () => {
      expect(defaultPool).toBeInstanceOf(FederationPool)
    })
  })

  describe('Error Handling', () => {
    it('should throw on invalid URL', async () => {
      await expect(
        pool.request({
          url: 'not-a-valid-url',
          method: 'GET',
        })
      ).rejects.toThrow('Invalid URL')
    })

    it('should handle fetch timeout', async () => {
      // Create a pool with very short timeout
      const timeoutPool = createFederationPool({
        requestTimeoutMs: 10,
        retryAttempts: 0,
      })

      vi.mocked(fetch).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response('ok', { status: 200 }))
          }, 1000) // Much longer than timeout
        })
      })

      await expect(
        timeoutPool.request({
          url: 'https://partner1.example.com/api/slow',
          method: 'GET',
        })
      ).rejects.toThrow()

      timeoutPool.shutdown()
    })
  })
})
