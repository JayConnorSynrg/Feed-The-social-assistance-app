'use client'

import { Marker } from 'react-map-gl/mapbox'

interface ClusterMarkerProps {
  longitude: number
  latitude: number
  pointCount: number
  onClick?: () => void
}

export function ClusterMarker({
  longitude,
  latitude,
  pointCount,
  onClick,
}: ClusterMarkerProps) {
  // Size based on point count
  const size = Math.min(Math.max(pointCount / 2, 30), 60)

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={onClick}
    >
      <div
        className="flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold cursor-pointer transition-transform hover:scale-110 shadow-lg"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
        }}
      >
        {pointCount}
      </div>
    </Marker>
  )
}
