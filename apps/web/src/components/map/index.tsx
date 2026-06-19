'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { ViewState, MapViewHandle } from './map-view'
import type { Resource } from './resource-marker'

// Loading fallback component
function MapLoadingFallback({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-muted ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// Dynamic imports with SSR disabled for mapbox components
export const MapView = dynamic(
  () => import('./map-view').then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => <MapLoadingFallback className="h-full" />,
  }
)

export const ResourceMarker = dynamic(
  () => import('./resource-marker').then((mod) => mod.ResourceMarker),
  { ssr: false }
)

export const ClusterMarker = dynamic(
  () => import('./cluster-marker').then((mod) => mod.ClusterMarker),
  { ssr: false }
)

// Re-export types
export type { ViewState, MapViewHandle, Resource }

// Re-export ResourceSearch (doesn't use mapbox)
export { ResourceSearch } from './resource-search'

export { StagingAlertPin } from './staging-alert-pin'
