// apps/web/src/lib/query-utils.ts
// Database query optimization utilities

import { createClient } from '@/lib/supabase/client'

/**
 * Query configuration for optimized fetching
 */
export interface QueryConfig {
  /** Number of items per page */
  pageSize?: number
  /** Page number (1-indexed) */
  page?: number
  /** Order by column */
  orderBy?: string
  /** Order direction */
  ascending?: boolean
  /** Select only specific columns (reduces payload) */
  select?: string
}

/**
 * Calculate pagination offset
 */
export function getPaginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}

/**
 * Default query configurations by entity type
 */
export const QUERY_DEFAULTS = {
  posts: {
    pageSize: 20,
    select: 'id, content, image_url, created_at, user_id, profiles(id, full_name, avatar_url)',
    orderBy: 'created_at',
    ascending: false,
  },
  resources: {
    pageSize: 50,
    select: 'id, name, category, address, city, state, latitude, longitude, phone, hours, verified',
    orderBy: 'created_at',
    ascending: false,
  },
  applications: {
    pageSize: 20,
    select: 'id, user_id, template_id, status, submitted_at, updated_at, created_at, notes, form_templates(name)',
    orderBy: 'updated_at',
    ascending: false,
  },
  documents: {
    pageSize: 50,
    select: 'id, user_id, name, file_path, file_type, file_size, category, description, uploaded_at',
    orderBy: 'uploaded_at',
    ascending: false,
  },
  notifications: {
    pageSize: 50,
    select: 'id, user_id, type, title, message, is_read, created_at',
    orderBy: 'created_at',
    ascending: false,
  },
} as const

/**
 * Build optimized query with pagination and ordering
 */
export function buildOptimizedQuery(
  table: string,
  config: QueryConfig = {}
) {
  const supabase = createClient()
  const defaults = QUERY_DEFAULTS[table as keyof typeof QUERY_DEFAULTS] || {}

  const pageSize = config.pageSize ?? defaults.pageSize ?? 20
  const page = config.page ?? 1
  const offset = getPaginationOffset(page, pageSize)
  const select = config.select ?? defaults.select ?? '*'
  const orderBy = config.orderBy ?? defaults.orderBy ?? 'created_at'
  const ascending = config.ascending ?? defaults.ascending ?? false

  // Dynamic table name from caller — cannot be typed statically without generics refactor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as unknown as any)
    .from(table)
    .select(select, { count: 'exact' })
    .order(orderBy, { ascending })
    .range(offset, offset + pageSize - 1)
}

/**
 * Batch fetch related data to avoid N+1 queries
 */
export async function batchFetchRelated<T extends { id: string }>(
  items: T[],
  relatedTable: string,
  foreignKey: string,
  select: string = '*'
): Promise<Map<string, unknown[]>> {
  if (items.length === 0) return new Map()

  const ids = items.map(item => item.id)
  const supabase = createClient()

  // Dynamic table name from caller — cannot be typed statically without generics refactor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as unknown as any)
    .from(relatedTable)
    .select(select)
    .in(foreignKey, ids)

  if (error) {
    console.error(`Error batch fetching ${relatedTable}:`, error)
    return new Map()
  }

  // Group by foreign key
  const grouped = new Map<string, unknown[]>()
  for (const item of (data || [])) {
    const key = item[foreignKey]
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(item)
  }

  return grouped
}

/**
 * Cache key generator for React Query or SWR
 */
export function generateCacheKey(
  table: string,
  filters: Record<string, unknown> = {},
  config: QueryConfig = {}
): string[] {
  return [
    table,
    JSON.stringify(filters),
    String(config.page ?? 1),
    String(config.pageSize ?? 20),
  ]
}

/**
 * Debounce function for search queries
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

/**
 * Viewport-based query for map resources
 * Only fetches resources within the visible map bounds
 */
export async function fetchResourcesInViewport(
  bounds: {
    north: number
    south: number
    east: number
    west: number
  },
  limit: number = 100
) {
  const supabase = createClient()

  // Use PostGIS functions for efficient spatial queries
  const { data, error } = await supabase
    .from('resources')
    .select(QUERY_DEFAULTS.resources.select)
    .gte('latitude', bounds.south)
    .lte('latitude', bounds.north)
    .gte('longitude', bounds.west)
    .lte('longitude', bounds.east)
    .limit(limit)

  if (error) {
    console.error('Error fetching resources in viewport:', error)
    return []
  }

  return data || []
}

/**
 * Prefetch utility for anticipated navigation
 */
export function prefetchQuery(
  table: string,
  filters: Record<string, unknown> = {},
  config: QueryConfig = {}
) {
  // Return a promise that can be used with React's cache or SWR
  return async () => {
    const query = buildOptimizedQuery(table, config)

    // Apply filters
    let filteredQuery = query
    for (const [key, value] of Object.entries(filters)) {
      filteredQuery = filteredQuery.eq(key, value)
    }

    const { data, error, count } = await filteredQuery

    if (error) throw error

    return { data, count }
  }
}
