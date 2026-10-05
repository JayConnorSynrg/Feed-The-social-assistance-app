// apps/web/src/components/org-form/org-pin-map.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Small map for placing an organization's pin. Mapbox TILES only (display) — no Mapbox geocoding
// anywhere in this form, and Mapbox telemetry is off. Click the map to place the pin; drag the
// pin to adjust it. Keyboard path: focus the map, move it with the arrow keys, then "Place pin at
// map center" (a crosshair marks the center). Every placement is a draft the person confirms. The marker is controlled (it follows the drag locally and commits on drag end,
// so it never snaps back), and the camera recenters whenever `recenterKey` changes (a new
// geocoded draft). The container may resize as the panel slides in, so a ResizeObserver keeps
// the canvas sized.

'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useId, useRef, useState } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox'
import { Crosshair, MapPin } from 'lucide-react'
import { hidePinFromAssistiveTech } from './org-pin-a11y'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const US_CENTER = { longitude: -98.5795, latitude: 39.8283, zoom: 3 }

export interface OrgPinMapProps {
  pin: { lng: number; lat: number } | null
  /** Changing this value recenters the camera on `pin`. */
  recenterKey: number
  /** Map click: place (or move) the pin here. */
  onPlace: (coords: { lng: number; lat: number }) => void
  /** Short accessible name of the map region. */
  label: string
  /** Visible instructions (arrow keys + "Place pin at map center"), referenced as the description. */
  instructions: string
  /** Text of the "Place pin at map center" button. */
  placeCenterLabel: string
  /** Translations for Mapbox's own control names. */
  mapLocale: { title: string; zoomIn: string; zoomOut: string; attribution: string; logo: string }
  /** Runs after a keyboard/button placement (the panel moves focus to "Confirm pin"). */
  onPlacedAtCenter?: () => void
  approximate?: boolean
}

export default function OrgPinMap({ pin, recenterKey, onPlace, label, instructions, placeCenterLabel, mapLocale, onPlacedAtCenter, approximate }: OrgPinMapProps) {
  const instructionsId = useId()
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

  const placeAtCenter = () => {
    const center = mapRef.current?.getCenter()
    if (!center) return
    onPlace({ lng: center.lng, lat: center.lat })
    onPlacedAtCenter?.()
  }

  return (
    <div className="flex flex-col gap-2">
    <p id={instructionsId} className="text-sm text-stone-700">
      {instructions}
    </p>
    {/* The focus ring lives on this unclipped wrapper; the map box below clips its tiles. */}
    <div className="rounded-xl focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      aria-describedby={instructionsId}
      className="relative h-64 w-full overflow-hidden rounded-xl border border-stone-200"
    >
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
        locale={{
          'Map.Title': mapLocale.title,
          'NavigationControl.ZoomIn': mapLocale.zoomIn,
          'NavigationControl.ZoomOut': mapLocale.zoomOut,
          'AttributionControl.ToggleAttribution': mapLocale.attribution,
          'LogoControl.Title': mapLocale.logo,
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {shown && (
          <Marker
            ref={hidePinFromAssistiveTech}
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
      {/* Map-center crosshair for "Place pin at map center". */}
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-stone-900/70" />
        <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-stone-900/70" />
      </span>
    </div>
    </div>
    <div>
      <button
        type="button"
        onClick={placeAtCenter}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-500 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <Crosshair className="h-4 w-4" aria-hidden="true" />
        {placeCenterLabel}
      </button>
    </div>
    </div>
  )
}
