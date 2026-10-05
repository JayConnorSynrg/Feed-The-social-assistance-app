// apps/web/src/lib/resource-directory.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Browse reader behind the admin organization form's resource DIRECTORY picker: a paged, filterable
// PostgREST read of `resources` (search_resources cannot browse — an empty query returns 0 rows).
//
// Invariants (proven in resource-directory.test.ts):
//   * APPROVED-ONLY: every query carries .eq('status','approved'). Admins can SELECT non-approved rows
//     under RLS, so the filter is what keeps pending/rejected rows out of an org's linked resources.
//   * PII-FREE METRICS: the withMetric labels are a closed vocabulary (filter names, length bucket,
//     result-count bucket). The search text, city text, and row ids never reach a label, and a failed
//     read throws a sanitized DirectoryReadError so withMetric's error_message carries no input either.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { withMetric } from './logger'
import { normalizeState } from './us-states'

export type ResourceCategory = Database['public']['Enums']['resource_category']
export type ServiceMode = Database['public']['Enums']['resource_service_mode']

export const DIRECTORY_PAGE_SIZE = 50

// Explicit projection — exactly what a directory row renders.
export const DIRECTORY_COLUMNS = 'id, name, category, city, state, address_line1, service_mode'

export interface DirectoryResource {
  id: string
  name: string
  category: ResourceCategory
  city: string | null
  state: string | null
  address_line1: string | null
  service_mode: ServiceMode | null
}

export interface DirectoryFilters {
  /** Free text; websearch syntax over the stored search_document tsvector. */
  q?: string | null
  /** State name or 2-letter code; normalized to the stored 2-letter code. */
  state?: string | null
  /** City prefix (case-insensitive). */
  city?: string | null
  category?: ResourceCategory | null
}

export interface DirectoryPage {
  rows: DirectoryResource[]
  /** Exact count of rows matching the filters (all pages). */
  total: number
  offset: number
  hasMore: boolean
}

/** Bucketed read failure. The message carries only the PostgREST error code — never the input. */
export class DirectoryReadError extends Error {
  constructor(code: string | undefined) {
    super(`directory query failed (${code || 'unknown'})`)
    this.name = 'DirectoryReadError'
  }
}

type FilterName = 'category' | 'city' | 'q' | 'state'

interface NormalizedFilters {
  q: string
  state: string | null
  city: string
  category: ResourceCategory | null
}

export function normalizeDirectoryFilters(filters: DirectoryFilters): NormalizedFilters {
  return {
    q: (filters.q ?? '').trim(),
    state: normalizeState(filters.state ?? null),
    city: (filters.city ?? '').trim(),
    category: filters.category ?? null,
  }
}

/** Sorted names of the filters that are active — the closed-vocabulary `filters` label. */
export function activeFilterNames(filters: DirectoryFilters): FilterName[] {
  const f = normalizeDirectoryFilters(filters)
  const names: FilterName[] = []
  if (f.category) names.push('category')
  if (f.city) names.push('city')
  if (f.q) names.push('q')
  if (f.state) names.push('state')
  return names
}

export function resultBucket(total: number): '0' | '1-10' | '11-50' | '50+' {
  if (total <= 0) return '0'
  if (total <= 10) return '1-10'
  if (total <= 50) return '11-50'
  return '50+'
}

export function queryLenBucket(len: number): '0' | '1-3' | '4-10' | '11+' {
  if (len <= 0) return '0'
  if (len <= 3) return '1-3'
  if (len <= 10) return '4-10'
  return '11+'
}

/** Escapes LIKE wildcards so a typed city is matched literally as a prefix. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/**
 * One page (50 rows) of approved resources matching the filters, ordered by name, with the exact
 * total. offset is the zero-based row index of the page start.
 */
export async function fetchDirectoryPage(
  supabase: SupabaseClient<Database>,
  filters: DirectoryFilters,
  offset = 0
): Promise<DirectoryPage> {
  const f = normalizeDirectoryFilters(filters)
  const start = Math.max(0, Math.floor(offset))
  const names = activeFilterNames(filters)

  // result_bucket is assigned inside fn: withMetric spreads attrs after fn resolves, so the
  // completion event carries the bucket of the rows actually returned.
  const attrs: Record<string, string> = {
    filters: names.length ? names.join(',') : 'none',
    query_len_bucket: queryLenBucket(f.q.length),
  }

  return withMetric('directory.picker.query', attrs, async () => {
    let query = supabase
      .from('resources')
      .select(DIRECTORY_COLUMNS, { count: 'exact' })
      .eq('status', 'approved')

    if (f.q) query = query.textSearch('search_document', f.q, { type: 'websearch', config: 'english' })
    if (f.state) query = query.eq('state', f.state)
    if (f.city) query = query.ilike('city', `${escapeLike(f.city)}%`)
    if (f.category) query = query.eq('category', f.category)

    // id is a tiebreaker so offset pages stay stable when names repeat.
    const { data, error, count } = await query
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(start, start + DIRECTORY_PAGE_SIZE - 1)

    if (error) throw new DirectoryReadError(error.code)

    const rows = (data ?? []) as DirectoryResource[]
    const total = count ?? start + rows.length
    attrs.result_bucket = resultBucket(total)
    return { rows, total, offset: start, hasMore: start + rows.length < total }
  })
}
