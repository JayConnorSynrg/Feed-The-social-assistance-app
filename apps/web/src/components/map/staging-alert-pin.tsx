'use client'

import { Marker } from 'react-map-gl/mapbox'
import { Cloud, Construction, Gauge, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const STAGING_ICONS: Record<StagingAlertPinProps['type'], LucideIcon> = {
  weather: Cloud,
  road_closure: Construction,
  speeding: Gauge,
  general: AlertTriangle,
}

interface StagingAlertPinProps {
  lng: number
  lat: number
  type: 'weather' | 'road_closure' | 'speeding' | 'general'
  onDragEnd: (coords: { lng: number; lat: number }) => void
}

export function StagingAlertPin({ lng, lat, type, onDragEnd }: StagingAlertPinProps) {
  const IconComp = STAGING_ICONS[type] ?? AlertTriangle
  return (
    <Marker
      longitude={lng}
      latitude={lat}
      anchor="bottom"
      draggable
      onDragEnd={(e) => onDragEnd({ lng: e.lngLat.lng, lat: e.lngLat.lat })}
    >
      <div className="relative flex flex-col items-center" style={{ width: 44, height: 56 }}>
        {/* Pin body */}
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 border-2 border-amber-700 text-white shadow-lg cursor-grab active:cursor-grabbing">
          <IconComp className="w-5 h-5" />
        </div>
        {/* Pulse ring below pin — indicates "not confirmed" */}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-400/70 animate-ping" />
      </div>
    </Marker>
  )
}
