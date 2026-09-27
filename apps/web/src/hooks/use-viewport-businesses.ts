'use client'

// apps/web/src/hooks/use-viewport-businesses.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Viewport reader for the P4a business leaf layer. Mirrors useViewportResources' lifecycle
// (debounce + abort + timeout + withMetric) but calls the SECDEF businesses_in_bounds RPC
// (through lib/business-data, the controlled type boundary) and returns approved business
// orgs with parsed [lng,lat]. The resource path is untouched (CINV6): this is an additive,
// independent hook that clusters nothing (one unclustered leaf per business — CINV2).

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger, withMetric } from '@/lib/logger'
import { isQueryTimeout } from '@/lib/vault'
import { businessesInBounds } from '@/lib/business-data'
import { parseGeographyPoint, type Business } from '@/lib/business'

interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MappableBusiness extends Business {
  lng: number
  lat: number
}

interface UseViewportBusinessesOptions {
  bounds: Bounds | null
  enabled?: boolean
  debounceMs?: number
  limit?: number
}

interface UseViewportBusinessesReturn {
  businesses: MappableBusiness[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

export function useViewportBusinesses({
  bounds,
  enabled = true,
  debounceMs = 300,
  limit = 500,
}: UseViewportBusinessesOptions): UseViewportBusinessesReturn {
  const [businesses, setBusinesses] = useState<MappableBusiness[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchBusinesses = useCallback(
    async (currentBounds: Bounds) => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()
      const controller = abortControllerRef.current
      setLoading(true)
      setError(null)

      try {
        const rows = await withMetric<Business[]>(
          'map.businesses_in_bounds',
          { limit },
          () => businessesInBounds(supabase, currentBounds, limit)
        )

        const mappable: MappableBusiness[] = []
        for (const b of rows) {
          const pt = parseGeographyPoint(b.location)
          if (pt && pt.lng !== 0 && pt.lat !== 0) mappable.push({ ...b, lng: pt.lng, lat: pt.lat })
        }

        logger.info('viewport-businesses.fetch.resolved', {
          bounds: currentBounds,
          count: mappable.length,
          result_count: mappable.length,
        })

        if (!controller.signal.aborted) setBusinesses(mappable)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // nav-cancel: silent
        } else if (isQueryTimeout(err)) {
          logger.warn('viewport-businesses.fetch.timeout', { bounds: currentBounds })
          setError(new Error('Map businesses timed out. Please try again.'))
        } else {
          logger.error('viewport-businesses.fetch.error', err, { bounds: currentBounds })
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    [supabase, limit]
  )

  useEffect(() => {
    if (!enabled || !bounds) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      fetchBusinesses(bounds)
    }, debounceMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [enabled, bounds, debounceMs, fetchBusinesses])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const refresh = useCallback(() => {
    if (bounds) fetchBusinesses(bounds)
  }, [bounds, fetchBusinesses])

  return { businesses, loading, error, refresh }
}
