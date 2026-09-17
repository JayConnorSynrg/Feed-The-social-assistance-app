'use client'

// apps/web/src/hooks/use-resource-search.ts
// Shared exhaustive resource-search hook — wraps the `search_resources` RPC
// (Postgres FTS + trigram, ships every approved resource of every source,
// including ungeocoded rows, never viewport/state-limited). Used by both the
// Map/Resources panel and the Programs panel so there is exactly one place
// that knows the RPC's argument/return shape.

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger, withMetric } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import type { Database } from '@feed/database'

export type SearchResourceRow = Database['public']['Functions']['search_resources']['Returns'][number]

export type SearchSurface = 'map' | 'programs'

interface UseResourceSearchOptions {
  /** Raw (un-debounced) search box value. Empty/whitespace clears results and skips the RPC. */
  query: string
  /** Which panel is searching — recorded on every executed-search log line. */
  surface: SearchSurface
  debounceMs?: number
  limit?: number
}

interface UseResourceSearchReturn {
  results: SearchResourceRow[]
  loading: boolean
  error: Error | null
}

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

/**
 * Debounced (~300ms) exhaustive resource search via the `search_resources` RPC.
 * Empty/whitespace-only queries clear results immediately without calling the RPC —
 * callers restore their own browse behavior in that case.
 */
export function useResourceSearch({
  query,
  surface,
  debounceMs = 300,
  limit = 100,
}: UseResourceSearchOptions): UseResourceSearchReturn {
  const [results, setResults] = useState<SearchResourceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(
    async (q: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller
      setLoading(true)
      setError(null)

      try {
        const supabase = getSupabase()
        const combinedSignal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(QUERY_TIMEOUT_MS),
        ])

        const { data, error: rpcError } = await withMetric<{
          data: SearchResourceRow[] | null
          error: Error | null
        }>(
          'search.resources',
          { surface, limit },
          () =>
            supabase
              .rpc('search_resources', { p_query: q, p_limit: limit, p_offset: 0 })
              .abortSignal(combinedSignal) as unknown as Promise<{
              data: SearchResourceRow[] | null
              error: Error | null
            }>
        )

        if (rpcError) throw rpcError

        const rows = data ?? []
        // INV E — measurable search quality/usage over time. No user PII logged.
        logger.info('search.resources.executed', { query: q, result_count: rows.length, surface })
        setResults(rows)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Nav-cancel / superseded by a newer keystroke — silent.
          return
        }
        if (isQueryTimeout(err)) {
          logger.warn('search.resources.timeout', { surface })
          setError(new Error('Search timed out. Please try again.'))
        } else {
          logger.error('search.resources.error', err, { surface })
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    [limit, surface]
  )

  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      // Empty query — clear any in-flight search and reset to the empty state.
      // Callers restore their own browse behavior when there is no active search.
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      runSearch(trimmed)
    }, debounceMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [query, debounceMs, runSearch])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { results, loading, error }
}

/**
 * Convert a `search_resources` row into a full `resources` table Row shape for
 * surfaces (e.g. Programs) that render against the generated table type. Fields
 * the RPC does not return (eligibility_requirements, services_offered, email,
 * application_url, application_form_url, is_verified, timestamps, …) are filled
 * with null — these are genuinely absent from the exhaustive-search response,
 * not a data-loss bug, and the existing tile UI already renders those as
 * optional/absent gracefully.
 */
export function searchRowToResourceRow(
  row: SearchResourceRow
): Database['public']['Tables']['resources']['Row'] {
  return {
    address_line1: row.address_line1,
    address_line2: null,
    application_form_url: null,
    application_url: null,
    category: row.category as Database['public']['Enums']['resource_category'],
    city: row.city,
    country: null,
    created_at: null,
    description: row.description,
    discovery_metadata: null,
    eligibility_requirements: null,
    email: null,
    external_id: null,
    geocode_accuracy: null,
    geocode_confidence: null,
    hours_of_operation: null,
    id: row.id,
    is_verified: false,
    is_volunteer_resource: false,
    languages_served: null,
    last_verified_at: null,
    location: null,
    moderated_at: null,
    moderated_by: null,
    name: row.name,
    phone: row.phone,
    rejection_reason: null,
    search_document: null,
    service_mode: row.service_mode as Database['public']['Enums']['resource_service_mode'],
    services_offered: null,
    source: row.source as Database['public']['Enums']['resource_source'],
    state: row.state,
    status: row.status as Database['public']['Enums']['resource_status'],
    submitted_by: null,
    updated_at: null,
    website: row.website,
    zip_code: row.zip_code,
  }
}
