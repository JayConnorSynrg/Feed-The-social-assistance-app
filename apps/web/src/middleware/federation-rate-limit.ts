/**
 * Federation Rate Limiting Middleware
 *
 * Implements per-instance rate limiting for federation API endpoints.
 * Uses in-memory sliding window counters with Redis-compatible interface
 * for easy backend swapping in production.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limit categories with their respective limits (requests per minute)
 */
export type RateLimitCategory =
  | 'instance-metadata'  // 10 req/min
  | 'resource-api'       // 100 req/min
  | 'search'             // 50 req/min
  | 'webhooks';          // 200 req/min

/**
 * Configuration for rate limiting per category
 */
export interface RateLimitConfig {
  category: RateLimitCategory;
  requestsPerMinute: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Internal tracking structure for rate limit windows
 */
interface RateLimitWindow {
  count: number;
  resetAt: number;
}

/**
 * Rate limit configurations for federation endpoints
 */
export const RATE_LIMIT_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  'instance-metadata': {
    category: 'instance-metadata',
    requestsPerMinute: 10,
  },
  'resource-api': {
    category: 'resource-api',
    requestsPerMinute: 100,
  },
  'search': {
    category: 'search',
    requestsPerMinute: 50,
  },
  'webhooks': {
    category: 'webhooks',
    requestsPerMinute: 200,
  },
};

/**
 * In-memory rate limiter with Redis-compatible interface
 *
 * Uses sliding window counters to track requests per instance per category.
 * Automatically cleans up expired entries every 60 seconds.
 */
export class RateLimiter {
  private store: Map<string, RateLimitWindow>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, window] of this.store.entries()) {
        if (window.resetAt < now) {
          this.store.delete(key);
        }
      }
    }, 60_000); // Run every 60 seconds

    // Prevent the interval from keeping the process alive in serverless
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate cache key for instance + category combination
   */
  private getKey(instanceId: string, category: RateLimitCategory): string {
    return `ratelimit:${instanceId}:${category}`;
  }

  /**
   * Check if request is within rate limit
   *
   * @param instanceId - Unique identifier for the federated instance
   * @param category - Rate limit category for the endpoint
   * @returns Rate limit check result
   */
  public checkLimit(
    instanceId: string,
    category: RateLimitCategory
  ): RateLimitResult {
    const config = RATE_LIMIT_CONFIGS[category];
    const key = this.getKey(instanceId, category);
    const now = Date.now();
    const windowMs = 60_000; // 1 minute window

    let window = this.store.get(key);

    // Initialize or reset window if expired
    if (!window || window.resetAt < now) {
      window = {
        count: 0,
        resetAt: now + windowMs,
      };
      this.store.set(key, window);
    }

    // Check if limit exceeded
    const allowed = window.count < config.requestsPerMinute;

    // Increment counter if allowed
    if (allowed) {
      window.count += 1;
    }

    return {
      allowed,
      remaining: Math.max(0, config.requestsPerMinute - window.count),
      resetAt: window.resetAt,
      limit: config.requestsPerMinute,
    };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  public clear(): void {
    this.store.clear();
  }
}

// Singleton instance for in-memory rate limiting
const rateLimiter = new RateLimiter();

/**
 * Extract instance ID from request
 *
 * Priority:
 * 1. X-Federation-Instance header
 * 2. IP address from headers
 * 3. Fallback to 'unknown'
 */
function extractInstanceId(request: NextRequest): string {
  // Check custom federation header
  const federationInstance = request.headers.get('x-federation-instance');
  if (federationInstance) {
    return federationInstance;
  }

  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Last resort fallback
  return 'unknown';
}

/**
 * Determine rate limit category from request path
 *
 * @param pathname - URL pathname to categorize
 * @returns Matching rate limit category
 */
export function getCategoryFromPath(pathname: string): RateLimitCategory {
  if (pathname.includes('/api/federation/metadata') || pathname.includes('/api/federation/instance')) {
    return 'instance-metadata';
  }

  if (pathname.includes('/api/federation/search')) {
    return 'search';
  }

  if (pathname.includes('/api/federation/webhook')) {
    return 'webhooks';
  }

  // Default to resource API for other federation endpoints
  return 'resource-api';
}

/**
 * Rate limit middleware wrapper for Next.js API routes
 *
 * @param handler - The API route handler to wrap
 * @param category - Optional explicit category (will auto-detect if not provided)
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```typescript
 * export const GET = withRateLimit(async (request: NextRequest) => {
 *   // Your handler logic
 *   return NextResponse.json({ data: 'success' });
 * }, 'resource-api');
 * ```
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  category?: RateLimitCategory
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Determine category
    const limitCategory = category || getCategoryFromPath(request.nextUrl.pathname);

    // Extract instance identifier
    const instanceId = extractInstanceId(request);

    // Check rate limit
    const result = rateLimiter.checkLimit(instanceId, limitCategory);

    // If rate limited, return 429
    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests for ${limitCategory}. Please try again later.`,
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSeconds.toString(),
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.toString(),
          },
        }
      );
    }

    // Allow request and add rate limit headers
    const response = await handler(request);

    // Add rate limit headers to successful response
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toString());

    return response;
  };
}

/**
 * Export singleton instance for direct usage
 */
export { rateLimiter };
