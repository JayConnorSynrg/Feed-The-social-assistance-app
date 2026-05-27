'use client'

import { Marker } from 'react-map-gl/mapbox'
import { User } from 'lucide-react'
import type { Resource } from './resource-marker'

interface VolunteerMarkerProps {
  resource: Resource
  onClick?: (resource: Resource) => void
}

export function VolunteerMarker({ resource, onClick }: VolunteerMarkerProps) {
  return (
    <Marker
      longitude={resource.longitude}
      latitude={resource.latitude}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation()
        onClick?.(resource)
      }}
    >
      <div className="cursor-pointer transition-transform hover:scale-110">
        <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-400 shadow-md flex items-center justify-center">
          <User className="w-4 h-4 text-amber-700" />
        </div>
      </div>
    </Marker>
  )
}
