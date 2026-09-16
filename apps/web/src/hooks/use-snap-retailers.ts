'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger, withMetric } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

/** A SNAP food-access retailer as returned by the bounded snap_retailers_in_bounds RPC. */
export interface SnapRetailer {
  id: string
  retailer_id: string
  name: string
  type: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  incentive_program: string | null
  latitude: number
  longitude: number
}

// Raw row shape from the RPC (lat/lng are derived server-side via st_y/st_x).
interface SnapRetailerRow {
  id: string
  retailer_id: string
  name: string
  type: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  incentive_program: string | null
  lat: number | null
  lng: number | null
}

interface UseSnapRetailersOptions {
  bounds: Bounds | null
  enabled?: boolean
  debounceMs?: number
  limit?: number
}

interface UseSnapRetailersReturn {
  retailers: SnapRetailer[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

/**
 * Viewport-bounded loader for national SNAP food-access retailers.
 *
 * Mirrors useViewportResources but reads the ISOLATED snap_retailers table via the
 * bounded snap_retailers_in_bounds RPC (GiST envelope filter, server-side LIMIT).
 * SNAP retailer data is public food-access data, so this hook does NOT gate on an
 * authenticated user — only on the presence of viewport bounds.
 */
export function useSnapRetailers({
  bounds,
  enabled = true,
  debounceMs = 300,
  limit = 300,
}: UseSnapRetailersOptions): UseSnapRetailersReturn {
  const [retailers, setRetailers] = useState<SnapRetailer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchRetailers = useCallback(
    async (currentBounds: Bounds) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      const controller = abortControllerRef.current
      setLoading(true)
      setError(null)

      logger.debug('snap-retailers.fetch.start', { bounds: currentBounds })

      try {
        const rpcParams = {
          west: currentBounds.west,
          south: currentBounds.south,
          east: currentBounds.east,
          north: currentBounds.north,
          max_results: limit,
        }

        // Combine nav-cancel signal with a hard timeout — whichever fires first aborts the RPC.
        const combinedSignal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(QUERY_TIMEOUT_MS),
        ])

        const { data, error: queryError } = await withMetric<{
          data: SnapRetailerRow[] | null
          error: Error | null
        }>(
          'map.snap_retailers_in_bounds',
          { limit },
          () =>
            supabase
              .rpc('snap_retailers_in_bounds', rpcParams)
              .abortSignal(combinedSignal) as unknown as Promise<{
              data: SnapRetailerRow[] | null
              error: Error | null
            }>
        )

        if (queryError) throw queryError

        const transformed: SnapRetailer[] = ((data || []) as SnapRetailerRow[])
          .map((row) => ({
            id: row.id,
            retailer_id: row.retailer_id,
            name: row.name,
            type: row.type,
            address: row.address,
            city: row.city,
            state: row.state,
            zip: row.zip,
            incentive_program: row.incentive_program,
            latitude: row.lat ?? 0,
            longitude: row.lng ?? 0,
          }))
          .filter((r) => r.latitude !== 0 && r.longitude !== 0)

        logger.info('snap-retailers.fetch.resolved', {
          bounds: currentBounds,
          count: transformed.length,
          result_count: transformed.length,
        })

        setRetailers(transformed)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Nav-cancel: silent, loading cleared by finally guard below
        } else if (isQueryTimeout(err)) {
          logger.warn('snap-retailers.fetch.timeout', { bounds: currentBounds })
          setError(new Error('SNAP retailers timed out. Please try again.'))
        } else {
          logger.error('snap-retailers.fetch.error', err, { bounds: currentBounds })
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    [supabase, limit]
  )

  // Debounced fetch on bounds change
  useEffect(() => {
    if (!enabled || !bounds) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      fetchRetailers(bounds)
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, bounds, debounceMs, fetchRetailers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const refresh = useCallback(() => {
    if (bounds) {
      fetchRetailers(bounds)
    }
  }, [bounds, fetchRetailers])

  return { retailers, loading, error, refresh }
}
