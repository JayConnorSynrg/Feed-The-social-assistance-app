/**
 * Federation Cache - Zero-dependency in-memory LRU cache with TTL
 *
 * Provides caching for federated resources, search results, and instance metadata.
 * Can be swapped for Redis in production without changing the interface.
 *
 * @module federation-cache
 */

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
}

interface FederationCacheConfig {
  maxResourceEntries: number;    // default 500
  maxSearchEntries: number;      // default 200
  maxInstanceEntries: number;    // default 100
  resourceTtlMs: number;         // default 15 * 60 * 1000 (15 min)
  searchTtlMs: number;           // default 5 * 60 * 1000 (5 min)
  instanceTtlMs: number;         // default 60 * 60 * 1000 (1 hour)
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

/**
 * Generic LRU (Least Recently Used) cache with TTL support
 *
 * Features:
 * - Automatic eviction of expired entries
 * - LRU overflow handling
 * - Pattern-based invalidation
 * - Performance statistics tracking
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Get value from cache
   * Returns null if key doesn't exist or is expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update last accessed time (for LRU)
    entry.lastAccessed = Date.now();

    // Move to end of map (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with optional TTL
   * If TTL is not provided, entry never expires (expiresAt = Infinity)
   */
  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttlMs ? now + ttlMs : Infinity,
      lastAccessed: now,
    };

    // Remove existing entry if present
    this.cache.delete(key);

    // Add new entry
    this.cache.set(key, entry);

    // Evict if over capacity
    this.evictIfNeeded();
  }

  /**
   * Delete specific key from cache
   * Returns true if key existed, false otherwise
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a glob-style pattern
   * Supports wildcards: * (any characters)
   *
   * Examples:
   * - "federation:resources:*" matches all resource caches
   * - "federation:*:abc123" matches all cache types for instance abc123
   *
   * Returns number of entries deleted
   */
  invalidatePattern(pattern: string): number {
    const regex = this.patternToRegex(pattern);
    let deletedCount = 0;

    // Convert iterator to array to avoid downlevelIteration requirement
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      evictions: this.stats.evictions,
    };
  }

  /**
   * Evict oldest entries if cache is over capacity
   * Also removes expired entries during cleanup
   */
  private evictIfNeeded(): void {
    const now = Date.now();

    // First pass: remove expired entries
    // Convert iterator to array to avoid downlevelIteration requirement
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.stats.evictions++;
      }
    }

    // Second pass: remove LRU entries if still over capacity
    while (this.cache.size > this.maxEntries) {
      // Map maintains insertion order, first entry is least recently used
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Convert glob-style pattern to RegExp
   * Supports * wildcard
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Convert * to .*
    const regexPattern = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * DJB2 hash algorithm for query hashing
 * Fast, simple, and produces reasonably distributed hashes
 *
 * @param str - String to hash
 * @returns 32-bit hash as hexadecimal string
 */
export function djb2Hash(str: string): string {
  let hash = 5381;

  for (let i = 0; i < str.length; i++) {
    // hash * 33 + charCode
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    // Keep within 32-bit range
    hash = hash >>> 0;
  }

  return hash.toString(16);
}

/**
 * Hash a query string with optional filters for cache key generation
 * Produces consistent hashes for identical queries
 *
 * @param query - Search query string
 * @param filters - Optional filter object
 * @returns Hash string
 */
export function hashQuery(
  query: string,
  filters?: Record<string, unknown>
): string {
  // Normalize query
  const normalizedQuery = query.trim().toLowerCase();

  // Serialize filters in deterministic order
  let filterStr = '';
  if (filters) {
    const sortedKeys = Object.keys(filters).sort();
    filterStr = sortedKeys
      .map(key => `${key}:${JSON.stringify(filters[key])}`)
      .join('|');
  }

  const combined = `${normalizedQuery}::${filterStr}`;
  return djb2Hash(combined);
}

// ============================================================================
// Federation Cache
// ============================================================================

/**
 * Domain-specific cache for federation resources
 *
 * Manages three separate caches:
 * - Resources: Federated resource lists by instance
 * - Search: Search results by query hash
 * - Instances: Instance metadata by domain
 */
export class FederationCache {
  private resourceCache: LRUCache<unknown[]>;
  private searchCache: LRUCache<unknown>;
  private instanceCache: LRUCache<unknown>;
  private config: FederationCacheConfig;

  constructor(config?: Partial<FederationCacheConfig>) {
    this.config = {
      maxResourceEntries: config?.maxResourceEntries ?? 500,
      maxSearchEntries: config?.maxSearchEntries ?? 200,
      maxInstanceEntries: config?.maxInstanceEntries ?? 100,
      resourceTtlMs: config?.resourceTtlMs ?? 15 * 60 * 1000, // 15 min
      searchTtlMs: config?.searchTtlMs ?? 5 * 60 * 1000,      // 5 min
      instanceTtlMs: config?.instanceTtlMs ?? 60 * 60 * 1000, // 1 hour
    };

    this.resourceCache = new LRUCache<unknown[]>(this.config.maxResourceEntries);
    this.searchCache = new LRUCache<unknown>(this.config.maxSearchEntries);
    this.instanceCache = new LRUCache<unknown>(this.config.maxInstanceEntries);
  }

  // ========================================================================
  // Resource Cache Methods
  // ========================================================================

  /**
   * Cache resources for a specific instance
   * Key format: federation:resources:{instance_id}
   */
  cacheResources(instanceId: string, resources: unknown[]): void {
    const key = `federation:resources:${instanceId}`;
    this.resourceCache.set(key, resources, this.config.resourceTtlMs);
  }

  /**
   * Get cached resources for an instance
   * Returns null if not found or expired
   */
  getResources(instanceId: string): unknown[] | null {
    const key = `federation:resources:${instanceId}`;
    return this.resourceCache.get(key);
  }

  // ========================================================================
  // Search Cache Methods
  // ========================================================================

  /**
   * Cache search results with query hash
   * Key format: federation:search:{query_hash}
   */
  cacheSearchResults(queryHash: string, results: unknown): void {
    const key = `federation:search:${queryHash}`;
    this.searchCache.set(key, results, this.config.searchTtlMs);
  }

  /**
   * Get cached search results by query hash
   * Returns null if not found or expired
   */
  getSearchResults(queryHash: string): unknown | null {
    const key = `federation:search:${queryHash}`;
    return this.searchCache.get(key);
  }

  // ========================================================================
  // Instance Cache Methods
  // ========================================================================

  /**
   * Cache instance metadata by domain
   * Key format: federation:instance:{domain}
   */
  cacheInstance(domain: string, metadata: unknown): void {
    const key = `federation:instance:${domain}`;
    this.instanceCache.set(key, metadata, this.config.instanceTtlMs);
  }

  /**
   * Get cached instance metadata by domain
   * Returns null if not found or expired
   */
  getInstance(domain: string): unknown | null {
    const key = `federation:instance:${domain}`;
    return this.instanceCache.get(key);
  }

  // ========================================================================
  // Invalidation Methods
  // ========================================================================

  /**
   * Invalidate all caches for a specific instance
   * Clears resources and any related data
   */
  invalidateInstance(instanceId: string): void {
    // Invalidate resource cache
    this.resourceCache.delete(`federation:resources:${instanceId}`);

    // Invalidate any search results that might include this instance
    // (We can't know which searches included this instance, so clear all)
    this.invalidateAllSearch();
  }

  /**
   * Invalidate all search result caches
   * Useful when federation data changes
   */
  invalidateAllSearch(): void {
    this.searchCache.invalidatePattern('federation:search:*');
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.resourceCache.clear();
    this.searchCache.clear();
    this.instanceCache.clear();
  }

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  /**
   * Get aggregate statistics across all caches
   */
  getStats(): {
    resources: CacheStats;
    search: CacheStats;
    instances: CacheStats;
    overall: CacheStats;
  } {
    const resourceStats = this.resourceCache.getStats();
    const searchStats = this.searchCache.getStats();
    const instanceStats = this.instanceCache.getStats();

    const totalHits = resourceStats.hits + searchStats.hits + instanceStats.hits;
    const totalMisses = resourceStats.misses + searchStats.misses + instanceStats.misses;
    const totalRequests = totalHits + totalMisses;
    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      resources: resourceStats,
      search: searchStats,
      instances: instanceStats,
      overall: {
        hits: totalHits,
        misses: totalMisses,
        size: resourceStats.size + searchStats.size + instanceStats.size,
        hitRate: Math.round(overallHitRate * 10000) / 100,
        evictions: resourceStats.evictions + searchStats.evictions + instanceStats.evictions,
      },
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default singleton instance with standard configuration
 * Use this for most cases unless custom config is needed
 */
export const federationCache = new FederationCache();

/**
 * Factory function to create custom cache instances
 * Useful for testing or custom configurations
 */
export function createFederationCache(
  config?: Partial<FederationCacheConfig>
): FederationCache {
  return new FederationCache(config);
}

// ============================================================================
// Exports
// ============================================================================

export type {
  CacheEntry,
  CacheStats,
  FederationCacheConfig,
};
