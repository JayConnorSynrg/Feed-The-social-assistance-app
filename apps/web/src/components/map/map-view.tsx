'use client'

import { useRef, useCallback, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
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

/** Imperative handle exposed via ref for programmatic map control. */
export interface MapViewHandle {
  flyTo(opts: { center: [number, number]; zoom: number; duration?: number }): void
}

interface MapViewProps {
  initialViewState?: ViewState
  onViewStateChange?: (viewState: ViewState) => void
  onBoundsChange?: (bounds: Bounds) => void
  onMapLoad?: () => void
  /** Called once when the user first intentionally drags or zooms the map. */
  onUserInteraction?: () => void
  children?: React.ReactNode
  className?: string
}

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -98.5795, // Center of US
  latitude: 39.8283,
  zoom: 4,
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    initialViewState = DEFAULT_VIEW_STATE,
    onViewStateChange,
    onBoundsChange,
    onMapLoad,
    onUserInteraction,
    children,
    className = '',
  },
  ref
) {
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewState, setViewState] = useState<ViewState>(initialViewState)
  const [isLoading, setIsLoading] = useState(true)

  useImperativeHandle(ref, () => ({
    flyTo(opts) {
      mapRef.current?.flyTo({
        center: opts.center,
        zoom: opts.zoom,
        duration: opts.duration ?? 1000,
      })
    },
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        mapRef.current?.resize()
      })
    })
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

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

  // Only fire onUserInteraction for genuine user gestures.
  // mapbox-gl attaches originalEvent to drag/zoom events initiated by the user,
  // but leaves it undefined for programmatic moves (flyTo, jumpTo, setCenter).
  // Checking its presence prevents the auto-center animation from self-blocking
  // the profile-based center. Cast required: the TS type for ViewStateChangeEvent
  // is the union MapEvent<...> which doesn't declare originalEvent, but mapbox-gl
  // does attach it at runtime on all user-initiated map events.
  const handleUserInteraction = useCallback(
    (e: ViewStateChangeEvent) => {
      if ((e as ViewStateChangeEvent & { originalEvent?: Event }).originalEvent) {
        onUserInteraction?.()
      }
    },
    [onUserInteraction]
  )

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
    <div
      ref={containerRef}
      className={`relative ${className}`}
      data-map-center={`${viewState.latitude.toFixed(4)},${viewState.longitude.toFixed(4)}`}
    >
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
        onDragStart={handleUserInteraction}
        onZoomStart={handleUserInteraction}
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
})

export type { ViewState }
