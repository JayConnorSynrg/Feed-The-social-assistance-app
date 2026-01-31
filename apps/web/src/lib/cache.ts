// apps/web/src/lib/cache.ts
// Client-side caching utilities

/**
 * Simple in-memory cache with TTL support
 */
class MemoryCache<T> {
  private cache: Map<string, { value: T; expiresAt: number }> = new Map()
  private defaultTTL: number

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTLMs
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL)
    this.cache.set(key, { value, expiresAt })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  /**
   * Get with automatic fetch on miss
   */
  async getOrFetch<R extends T>(
    key: string,
    fetchFn: () => Promise<R>,
    ttlMs?: number
  ): Promise<R> {
    const cached = this.get(key) as R | null
    if (cached !== null) return cached

    const value = await fetchFn()
    this.set(key, value, ttlMs)
    return value
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

/**
 * Global cache instances for different data types
 */
export const caches = {
  // Short-lived cache for frequently changing data (1 minute)
  feed: new MemoryCache(60 * 1000),

  // Medium-lived cache for user data (5 minutes)
  user: new MemoryCache(5 * 60 * 1000),

  // Longer-lived cache for reference data (15 minutes)
  resources: new MemoryCache(15 * 60 * 1000),

  // Long-lived cache for static data (1 hour)
  static: new MemoryCache(60 * 60 * 1000),
}

/**
 * Stale-while-revalidate pattern
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  cache: MemoryCache<T> = caches.user as MemoryCache<T>,
  staleTTL: number = 5 * 60 * 1000,
  revalidateTTL: number = 60 * 1000
): Promise<T> {
  const cached = cache.get(key)

  // If we have cached data, return it immediately
  if (cached !== null) {
    // Schedule background revalidation
    setTimeout(async () => {
      try {
        const fresh = await fetchFn()
        cache.set(key, fresh, staleTTL)
      } catch (error) {
        console.error('Background revalidation failed:', error)
      }
    }, revalidateTTL)

    return cached
  }

  // No cache, fetch fresh
  const value = await fetchFn()
  cache.set(key, value, staleTTL)
  return value
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  profile: (userId: string) => `profile:${userId}`,
  posts: (page: number) => `posts:page:${page}`,
  post: (postId: string) => `post:${postId}`,
  resources: (bounds: string) => `resources:${bounds}`,
  resource: (resourceId: string) => `resource:${resourceId}`,
  applications: (userId: string) => `applications:${userId}`,
  application: (appId: string) => `application:${appId}`,
  documents: (userId: string) => `documents:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  formTemplates: () => 'form-templates',
  formTemplate: (templateId: string) => `form-template:${templateId}`,
}

/**
 * Invalidate cache by pattern
 */
export function invalidateByPattern(pattern: string): void {
  const regex = new RegExp(pattern)

  for (const cache of Object.values(caches)) {
    const { keys } = cache.stats()
    for (const key of keys) {
      if (regex.test(key)) {
        cache.delete(key)
      }
    }
  }
}

/**
 * Invalidate all user-related caches
 */
export function invalidateUserCaches(userId: string): void {
  invalidateByPattern(`user:${userId}`)
  invalidateByPattern(`profile:${userId}`)
  invalidateByPattern(`applications:${userId}`)
  invalidateByPattern(`documents:${userId}`)
  invalidateByPattern(`notifications:${userId}`)
}

/**
 * LocalStorage-backed persistent cache
 */
export const persistentCache = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null

    try {
      const item = localStorage.getItem(`feed_cache_${key}`)
      if (!item) return null

      const { value, expiresAt } = JSON.parse(item)
      if (Date.now() > expiresAt) {
        localStorage.removeItem(`feed_cache_${key}`)
        return null
      }

      return value as T
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T, ttlMs: number = 24 * 60 * 60 * 1000): void {
    if (typeof window === 'undefined') return

    try {
      const item = JSON.stringify({
        value,
        expiresAt: Date.now() + ttlMs,
      })
      localStorage.setItem(`feed_cache_${key}`, item)
    } catch (error) {
      // Handle quota exceeded
      console.warn('LocalStorage quota exceeded, clearing old cache')
      this.cleanup()
    }
  },

  delete(key: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(`feed_cache_${key}`)
  },

  cleanup(): void {
    if (typeof window === 'undefined') return

    const now = Date.now()
    const keys = Object.keys(localStorage).filter(k => k.startsWith('feed_cache_'))

    for (const key of keys) {
      try {
        const item = localStorage.getItem(key)
        if (item) {
          const { expiresAt } = JSON.parse(item)
          if (now > expiresAt) {
            localStorage.removeItem(key)
          }
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
  },
}

// Run cleanup on module load (client-side only)
if (typeof window !== 'undefined') {
  // Cleanup expired entries periodically
  setInterval(() => {
    for (const cache of Object.values(caches)) {
      cache.cleanup()
    }
    persistentCache.cleanup()
  }, 5 * 60 * 1000) // Every 5 minutes
}
