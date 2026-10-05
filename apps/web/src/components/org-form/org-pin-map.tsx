// apps/web/src/components/org-form/org-pin-map.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Small map for placing an organization's pin. Mapbox TILES only (display) — no Mapbox geocoding
// anywhere in this form, and Mapbox telemetry is off. Click the map to place the pin; drag the
// pin to adjust it. The marker is controlled (it follows the drag locally and commits on drag end,
// so it never snaps back), and the camera recenters whenever `recenterKey` changes (a new
// geocoded draft). The container may resize as the panel slides in, so a ResizeObserver keeps
// the canvas sized.

'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef, useState } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const US_CENTER = { longitude: -98.5795, latitude: 39.8283, zoom: 3 }

export interface OrgPinMapProps {
  pin: { lng: number; lat: number } | null
  /** Changing this value recenters the camera on `pin`. */
  recenterKey: number
  /** Map click: place (or move) the pin here. */
  onPlace: (coords: { lng: number; lat: number }) => void
  label: string
  approximate?: boolean
}

export default function OrgPinMap({ pin, recenterKey, onPlace, label, approximate }: OrgPinMapProps) {
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewState, setViewState] = useState(() =>
    pin ? { longitude: pin.lng, latitude: pin.lat, zoom: 15 } : US_CENTER
  )
  const [dragPos, setDragPos] = useState<{ lng: number; lat: number } | null>(null)

  useEffect(() => {
    if (!pin) return
    // A controlled map must move its viewState as well as the camera, or it snaps back.
    setViewState({ longitude: pin.lng, latitude: pin.lat, zoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recenter only on a new draft
  }, [recenterKey])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!MAPBOX_TOKEN) return null
  const shown = dragPos ?? pin

  return (
    <div ref={containerRef} role="group" aria-label={label} className="h-64 w-full overflow-hidden rounded-xl border border-stone-200">
      <Map
        performanceMetricsCollection={false}
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        onClick={(e) => onPlace({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        cursor="crosshair"
      >
        <NavigationControl position="top-right" showCompass={false} />
        {shown && (
          <Marker
            longitude={shown.lng}
            latitude={shown.lat}
            anchor="bottom"
            draggable
            onDrag={(e) => setDragPos({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
            onDragEnd={(e) => {
              setDragPos(null)
              onPlace({ lng: e.lngLat.lng, lat: e.lngLat.lat })
            }}
          >
            <MapPin
              aria-hidden="true"
              className={`h-9 w-9 drop-shadow ${approximate ? 'fill-amber-400 text-amber-700' : 'fill-org text-white'}`}
            />
          </Marker>
        )}
      </Map>
    </div>
  )
}
