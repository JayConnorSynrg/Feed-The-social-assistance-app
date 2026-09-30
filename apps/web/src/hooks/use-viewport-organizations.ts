'use client'

// apps/web/src/hooks/use-viewport-organizations.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Viewport reader for the org map leaf layer. Mirrors useViewportBusinesses' lifecycle
// (debounce + abort + timeout) but calls the SECDEF organizations_in_bounds RPC through
// lib/org-data (the controlled type boundary). Unlike businessesInBounds, organizationsInBounds
// already emits the map.orgs_in_bounds wide event (with result_count) itself, so this hook calls
// it directly — a second withMetric wrapper here would double-count the fetch. Returns active
// NON-business located orgs with parsed [lng,lat]. The resource and business paths are untouched:
// this is an additive, independent hook that clusters nothing (one unclustered leaf per org).

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { isQueryTimeout } from '@/lib/vault'
import { parseGeographyPoint } from '@/lib/business'
import { organizationsInBounds, type OrgInBoundsRow } from '@/lib/org-data'

interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MappableOrg extends OrgInBoundsRow {
  lng: number
  lat: number
}

interface UseViewportOrganizationsOptions {
  bounds: Bounds | null
  enabled?: boolean
  debounceMs?: number
  limit?: number
}

interface UseViewportOrganizationsReturn {
  organizations: MappableOrg[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

export function useViewportOrganizations({
  bounds,
  enabled = true,
  debounceMs = 300,
  limit = 500,
}: UseViewportOrganizationsOptions): UseViewportOrganizationsReturn {
  const [organizations, setOrganizations] = useState<MappableOrg[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchOrganizations = useCallback(
    async (currentBounds: Bounds) => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()
      const controller = abortControllerRef.current
      setLoading(true)
      setError(null)

      try {
        // organizationsInBounds already wraps the read in the map.orgs_in_bounds wide event
        // (with result_count), so it is called directly here — a second wrapper would double-emit.
        const rows = await organizationsInBounds(supabase, currentBounds, limit)

        const mappable: MappableOrg[] = []
        for (const o of rows) {
          const pt = parseGeographyPoint(o.location)
          if (pt && pt.lng !== 0 && pt.lat !== 0) mappable.push({ ...o, lng: pt.lng, lat: pt.lat })
        }

        logger.info('viewport-organizations.fetch.resolved', {
          bounds: currentBounds,
          count: mappable.length,
          result_count: mappable.length,
        })

        if (!controller.signal.aborted) setOrganizations(mappable)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // nav-cancel: silent
        } else if (isQueryTimeout(err)) {
          logger.warn('viewport-organizations.fetch.timeout', { bounds: currentBounds })
          setError(new Error('Map organizations timed out. Please try again.'))
        } else {
          logger.error('viewport-organizations.fetch.error', err, { bounds: currentBounds })
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
      fetchOrganizations(bounds)
    }, debounceMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [enabled, bounds, debounceMs, fetchOrganizations])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const refresh = useCallback(() => {
    if (bounds) fetchOrganizations(bounds)
  }, [bounds, fetchOrganizations])

  return { organizations, loading, error, refresh }
}
