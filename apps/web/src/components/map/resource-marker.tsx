'use client'

import { useState, useCallback } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { MapPin, Phone, Globe, Clock, Navigation, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { openDirections, formatAddress } from '@/lib/directions'
import { getCategoryHex } from '@/lib/resource-categories'

interface Resource {
  id: string
  name: string
  description?: string | null
  category: string
  address_line1?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  website?: string | null
  hours_of_operation?: Record<string, string> | null
  latitude: number
  longitude: number
  is_volunteer_resource?: boolean
}

interface ResourceMarkerProps {
  resource: Resource
  onClick?: (resource: Resource) => void
}

export function ResourceMarker({ resource, onClick }: ResourceMarkerProps) {
  const [showPopup, setShowPopup] = useState(false)

  const color = getCategoryHex(resource.category)

  const handleClick = useCallback(() => {
    setShowPopup(true)
    onClick?.(resource)
  }, [resource, onClick])

  const handleDirections = useCallback(() => {
    openDirections({
      latitude: resource.latitude,
      longitude: resource.longitude,
      address: formatAddress(resource),
      label: resource.name,
    })
  }, [resource])

  const formatCategory = (category: string) => {
    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <>
      <Marker
        longitude={resource.longitude}
        latitude={resource.latitude}
        anchor="bottom"
        onClick={handleClick}
      >
        <div
          className="cursor-pointer transition-transform hover:scale-110"
          style={{ color }}
        >
          <MapPin className="h-8 w-8 drop-shadow-md" fill={color} />
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={resource.longitude}
          latitude={resource.latitude}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeButton={true}
          closeOnClick={false}
          offset={40}
          maxWidth="320px"
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2 pt-0 px-0">
              <div
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-1 w-fit"
                style={{ backgroundColor: color }}
              >
                {formatCategory(resource.category)}
              </div>
              <CardTitle className="text-base">{resource.name}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              {resource.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {resource.description}
                </p>
              )}

              {resource.address_line1 && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>
                    {resource.address_line1}
                    {resource.city && `, ${resource.city}`}
                    {resource.state && `, ${resource.state}`}
                  </span>
                </div>
              )}

              {resource.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${resource.phone}`} className="hover:underline">
                    {resource.phone}
                  </a>
                </div>
              )}

              {resource.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={resource.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate"
                  >
                    {new URL(resource.website).hostname}
                  </a>
                </div>
              )}

              {resource.hours_of_operation && (
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">See hours</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={handleDirections}>
                  <Navigation className="h-3 w-3 mr-1" />
                  Directions
                </Button>
                {resource.website && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={resource.website} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </Popup>
      )}
    </>
  )
}

export type { Resource }
