'use client'

// apps/web/src/components/map/business-marker.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Leaf marker for an approved local business (P4a). One unclustered pin per business
// (CINV2). Structure mirrors SnapRetailerMarker: a react-map-gl <Marker> with a distinct
// colored badge + a click popup. The business teal is distinct from resource-olive,
// volunteer-amber, SNAP-green and safety-red so the layer reads as its own thing.

import { useCallback } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { MapPin, Leaf, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MappableBusiness } from '@/hooks/use-viewport-businesses'
import { BUSINESS_MARKER_HEX } from '@/lib/map-marker-colors'
import { useFocusedPopup } from './use-focused-popup'

interface BusinessMarkerProps {
  business: MappableBusiness
  /** A followed map deep link landed on this pin: open its popup. */
  focused?: boolean
}

export function BusinessMarker({ business, focused }: BusinessMarkerProps) {
  // Opened by a click, or by a followed map deep link landing on this pin (#map?focus=…).
  const [showPopup, setShowPopup] = useFocusedPopup(focused)

  const handleClick = useCallback((e: { originalEvent: MouseEvent }) => {
    e.originalEvent.stopPropagation()
    setShowPopup(true)
  }, [setShowPopup])

  const fullAddress = [business.address, business.city, business.state].filter(Boolean).join(', ')

  return (
    <>
      <Marker longitude={business.lng} latitude={business.lat} anchor="bottom" onClick={handleClick}>
        <div
          className="cursor-pointer transition-transform hover:scale-110"
          aria-label={`Local business: ${business.name}`}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-md"
            style={{ backgroundColor: BUSINESS_MARKER_HEX }}
          >
            <Leaf className="h-4 w-4" />
          </div>
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={business.lng}
          latitude={business.lat}
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
                style={{ backgroundColor: BUSINESS_MARKER_HEX }}
              >
                Local business
              </div>
              <CardTitle className="text-base">{business.name}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              {business.description && (
                <p className="text-sm text-stone-600 line-clamp-3">{business.description}</p>
              )}
              {fullAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{fullAddress}</span>
                </div>
              )}
              <a
                href={`/s/business/${business.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-lime-700 hover:underline pt-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View details
              </a>
            </CardContent>
          </Card>
        </Popup>
      )}
    </>
  )
}
