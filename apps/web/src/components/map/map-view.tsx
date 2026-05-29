'use client'

import { useRef, useCallback, useState } from 'react'
import Map, { NavigationControl, GeolocateControl, MapRef, ViewStateChangeEvent } from 'react-map-gl/mapbox'
import { Loader2 } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

interface ViewState {
  longitude: number
  latitude: number
  zoom: number
}

interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

interface MapViewProps {
  initialViewState?: ViewState
  onViewStateChange?: (viewState: ViewState) => void
  onBoundsChange?: (bounds: Bounds) => void
  onMapLoad?: () => void
  children?: React.ReactNode
  className?: string
}

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -98.5795, // Center of US
  latitude: 39.8283,
  zoom: 4,
}

export function MapView({
  initialViewState = DEFAULT_VIEW_STATE,
  onViewStateChange,
  onBoundsChange,
  onMapLoad,
  children,
  className = '',
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState<ViewState>(initialViewState)
  const [isLoading, setIsLoading] = useState(true)

  const getBounds = useCallback((): Bounds | null => {
    const map = mapRef.current?.getMap()
    if (!map) return null

    const bounds = map.getBounds()
    if (!bounds) return null

    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    }
  }, [])

  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewState(evt.viewState)
      onViewStateChange?.(evt.viewState)
    },
    [onViewStateChange]
  )

  const handleMoveEnd = useCallback(() => {
    const bounds = getBounds()
    if (bounds) {
      onBoundsChange?.(bounds)
    }
  }, [getBounds, onBoundsChange])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onMapLoad?.()
    // Emit initial bounds immediately — getBounds() is safe once onLoad fires
    const bounds = getBounds()
    if (bounds) {
      onBoundsChange?.(bounds)
    }
  }, [onMapLoad, getBounds, onBoundsChange])

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('placeholder')) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <div className="text-center p-8">
          <p className="text-muted-foreground mb-2">Map unavailable</p>
          <p className="text-sm text-muted-foreground">
            Configure <code className="bg-muted-foreground/10 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onLoad={handleLoad}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation={true}
          showUserHeading={true}
        />
        {children}
      </Map>
    </div>
  )
}

export type { ViewState }
