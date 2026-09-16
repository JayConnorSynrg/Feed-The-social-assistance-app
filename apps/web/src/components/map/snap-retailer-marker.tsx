'use client'

import { useState, useCallback } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { MapPin, Navigation, ShoppingBasket, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { openDirections, formatAddress } from '@/lib/directions'
import type { SnapRetailer } from '@/hooks/use-snap-retailers'

interface SnapRetailerMarkerProps {
  retailer: SnapRetailer
  onClick?: (retailer: SnapRetailer) => void
}

// SNAP food-access green — distinct from the FEED olive resource palette and the
// amber volunteer markers, so the food-access layer reads as its own thing.
const SNAP_GREEN = '#15803d'

export function SnapRetailerMarker({ retailer, onClick }: SnapRetailerMarkerProps) {
  const [showPopup, setShowPopup] = useState(false)

  const handleClick = useCallback(
    (e: { originalEvent: MouseEvent }) => {
      e.originalEvent.stopPropagation()
      setShowPopup(true)
      onClick?.(retailer)
    },
    [retailer, onClick]
  )

  const handleDirections = useCallback(() => {
    openDirections({
      latitude: retailer.latitude,
      longitude: retailer.longitude,
      address: formatAddress({
        address_line1: retailer.address,
        city: retailer.city,
        state: retailer.state,
        zip: retailer.zip,
      }),
      label: retailer.name,
    })
  }, [retailer])

  const fullAddress = [retailer.address, retailer.city, retailer.state, retailer.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <Marker
        longitude={retailer.longitude}
        latitude={retailer.latitude}
        anchor="bottom"
        onClick={handleClick}
      >
        {/* Distinct SNAP pin: green rounded badge with a food-basket glyph */}
        <div
          className="cursor-pointer transition-transform hover:scale-110"
          aria-label={`SNAP food-access retailer: ${retailer.name}`}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-md"
            style={{ backgroundColor: SNAP_GREEN }}
          >
            <ShoppingBasket className="h-4 w-4" />
          </div>
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={retailer.longitude}
          latitude={retailer.latitude}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeButton={true}
          closeOnClick={false}
          offset={28}
          maxWidth="320px"
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2 pt-0 px-0">
              <div
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-1 w-fit"
                style={{ backgroundColor: SNAP_GREEN }}
              >
                SNAP food access
              </div>
              <CardTitle className="text-base">{retailer.name}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              {fullAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{fullAddress}</span>
                </div>
              )}

              {retailer.type && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShoppingBasket className="h-4 w-4 flex-shrink-0" />
                  <span>{retailer.type}</span>
                </div>
              )}

              {retailer.incentive_program && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Tag className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{retailer.incentive_program}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={handleDirections}>
                  <Navigation className="h-3 w-3 mr-1" />
                  Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        </Popup>
      )}
    </>
  )
}
