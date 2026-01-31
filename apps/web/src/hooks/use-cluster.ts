'use client'

import { useMemo } from 'react'
import Supercluster from 'supercluster'
import type { Resource } from '@/components/map/resource-marker'

interface ClusterProperties {
  cluster: boolean
  cluster_id?: number
  point_count?: number
  resource?: Resource
}

interface ClusterPoint {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: ClusterProperties
}

interface UseClusterOptions {
  resources: Resource[]
  zoom: number
  bounds: [number, number, number, number] | null // [west, south, east, north]
  options?: Supercluster.Options<ClusterProperties, ClusterProperties>
}

interface ClusterResult {
  id: string | number
  longitude: number
  latitude: number
  isCluster: boolean
  pointCount?: number
  clusterId?: number
  resource?: Resource
}

const DEFAULT_OPTIONS: Supercluster.Options<ClusterProperties, ClusterProperties> = {
  radius: 60,
  maxZoom: 16,
  minZoom: 0,
  extent: 512,
  nodeSize: 64,
}

export function useCluster({
  resources,
  zoom,
  bounds,
  options = {},
}: UseClusterOptions): ClusterResult[] {
  const supercluster = useMemo(() => {
    const cluster = new Supercluster<ClusterProperties, ClusterProperties>({
      ...DEFAULT_OPTIONS,
      ...options,
    })

    const points: ClusterPoint[] = resources.map((resource) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [resource.longitude, resource.latitude],
      },
      properties: {
        cluster: false,
        resource,
      },
    }))

    cluster.load(points)
    return cluster
  }, [resources, options])

  const clusters = useMemo(() => {
    if (!bounds) return []

    const rawClusters = supercluster.getClusters(bounds, Math.floor(zoom))

    return rawClusters.map((feature): ClusterResult => {
      const [longitude, latitude] = feature.geometry.coordinates
      const { cluster, cluster_id, point_count, resource } = feature.properties

      if (cluster) {
        return {
          id: `cluster-${cluster_id}`,
          longitude,
          latitude,
          isCluster: true,
          pointCount: point_count,
          clusterId: cluster_id,
        }
      }

      return {
        id: resource!.id,
        longitude,
        latitude,
        isCluster: false,
        resource,
      }
    })
  }, [supercluster, bounds, zoom])

  return clusters
}

export function useClusterExpansion(
  superclusterRef: Supercluster<ClusterProperties, ClusterProperties> | null,
  clusterId: number
): [number, number, number] | null {
  if (!superclusterRef) return null

  try {
    const expansionZoom = superclusterRef.getClusterExpansionZoom(clusterId)
    const children = superclusterRef.getLeaves(clusterId, Infinity)
    if (children.length > 0) {
      const [lng, lat] = children[0].geometry.coordinates
      return [lng, lat, expansionZoom]
    }
  } catch {
    // Cluster not found
  }
  return null
}

export type { ClusterResult, ClusterProperties }
