'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Resource } from '@/components/map/resource-marker'

interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

interface UseViewportResourcesOptions {
  bounds: Bounds | null
  enabled?: boolean
  debounceMs?: number
  limit?: number
  category?: string | null
}

interface UseViewportResourcesReturn {
  resources: Resource[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

// Type for resource row from database
interface ResourceRow {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  hours_of_operation: Record<string, string> | null
  // Supabase REST returns PostGIS GEOGRAPHY as EWKB hex string; may also be GeoJSON in tests
  location: string | { coordinates?: [number, number] } | null
  is_volunteer_resource: boolean | null
}

/**
 * Parse an EWKB hex string (PostGIS GEOGRAPHY Point) into [lng, lat].
 * EWKB layout for a Point with SRID:
 *   byte  0      : endianness (01 = LE)
 *   bytes 1-4    : type (01000020 with SRID flag)
 *   bytes 5-8    : SRID (e.g. 4326)
 *   bytes 9-16   : X = longitude (float64)
 *   bytes 17-24  : Y = latitude  (float64)
 * Minimum 25 bytes → 50 hex chars.
 */
function parseEWKBPoint(hex: string): [number, number] | null {
  if (!hex || typeof hex !== 'string' || hex.length < 50) return null
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    const view = new DataView(bytes.buffer)
    const littleEndian = bytes[0] === 1
    const lng = view.getFloat64(9, littleEndian)
    const lat = view.getFloat64(17, littleEndian)
    if (isNaN(lng) || isNaN(lat)) return null
    return [lng, lat]
  } catch {
    return null
  }
}

export function useViewportResources({
  bounds,
  enabled = true,
  debounceMs = 300,
  limit = 200,
  category = null,
}: UseViewportResourcesOptions): UseViewportResourcesReturn {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchResources = useCallback(
    async (currentBounds: Bounds) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      setLoading(true)
      setError(null)

      try {
        // Build the query
        let query = (supabase as any)
          .from('resources')
          .select(`
            id,
            name,
            description,
            category,
            address_line1,
            city,
            state,
            phone,
            website,
            hours_of_operation,
            location,
            is_volunteer_resource
          `)
          .eq('status', 'approved')
          .limit(limit)

        // Filter by category if specified
        if (category) {
          query = query.eq('category', category as never)
        }

        // Note: For proper geospatial queries, we'd use PostGIS
        // This is a simplified bounding box filter using the ST_MakeEnvelope function
        // In production, you'd use: .rpc('resources_in_bounds', { ... })

        const { data, error: queryError } = await query

        if (queryError) throw queryError

        // Transform data to include lat/lng from PostGIS geography
        // The location field is stored as GEOGRAPHY(POINT, 4326)
        const transformedResources: Resource[] = ((data || []) as ResourceRow[]).map((row) => {
          // Parse the geography point if available
          // Format: POINT(lng lat) or GeoJSON
          let latitude = 0
          let longitude = 0

          if (row.location) {
            const coords =
              typeof row.location === 'string'
                ? parseEWKBPoint(row.location)
                : (row.location.coordinates ?? null)
            if (coords) {
              ;[longitude, latitude] = coords
            }
          }

          return {
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category,
            address_line1: row.address_line1,
            city: row.city,
            state: row.state,
            phone: row.phone,
            website: row.website,
            hours_of_operation: row.hours_of_operation,
            latitude,
            longitude,
            is_volunteer_resource: row.is_volunteer_resource ?? false,
          }
        }).filter((r) => r.latitude !== 0 && r.longitude !== 0)

        // Filter by bounds client-side (until we add proper RPC function)
        const boundsFiltered = transformedResources.filter(
          (r) =>
            r.longitude >= currentBounds.west &&
            r.longitude <= currentBounds.east &&
            r.latitude >= currentBounds.south &&
            r.latitude <= currentBounds.north
        )

        setResources(boundsFiltered)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        setLoading(false)
      }
    },
    [supabase, limit, category]
  )

  // Debounced fetch on bounds change
  useEffect(() => {
    if (!enabled || !bounds) return

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      fetchResources(bounds)
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, bounds, debounceMs, fetchResources])

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
      fetchResources(bounds)
    }
  }, [bounds, fetchResources])

  return { resources, loading, error, refresh }
}
