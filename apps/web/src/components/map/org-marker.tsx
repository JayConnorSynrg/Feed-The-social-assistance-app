'use client'

// apps/web/src/components/map/org-marker.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Leaf marker for an active NON-business organization (food bank, pantry, shelter, clinic, mutual
// aid, nonprofit, government, community, other). One unclustered pin per org. Structure mirrors
// BusinessMarker: a react-map-gl <Marker> with a distinct colored badge + a click popup. The org
// indigo is distinct from business-teal, resource-olive, volunteer-amber, SNAP-green and safety-red,
// and the Building2 icon (vs the business Leaf) reads as its own layer.

import { useState, useCallback } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { MapPin, Building2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ORG_TYPE_LABELS, isNonBusinessOrgType } from '@/lib/org-vocab'
import type { MappableOrg } from '@/hooks/use-viewport-organizations'

interface OrgMarkerProps {
  organization: MappableOrg
}

const ORG_INDIGO = '#4338ca'

/** Human label for an org_type, falling back to the raw value for any unexpected type. */
function orgTypeLabel(orgType: string): string {
  return isNonBusinessOrgType(orgType) ? ORG_TYPE_LABELS[orgType] : orgType
}

export function OrgMarker({ organization }: OrgMarkerProps) {
  const [showPopup, setShowPopup] = useState(false)

  const handleClick = useCallback((e: { originalEvent: MouseEvent }) => {
    e.originalEvent.stopPropagation()
    setShowPopup(true)
  }, [])

  const fullAddress = [organization.address, organization.city, organization.state].filter(Boolean).join(', ')

  return (
    <>
      <Marker longitude={organization.lng} latitude={organization.lat} anchor="bottom" onClick={handleClick}>
        <div
          className="cursor-pointer transition-transform hover:scale-110"
          aria-label={`Organization: ${organization.name}`}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white shadow-md"
            style={{ backgroundColor: ORG_INDIGO }}
          >
            <Building2 className="h-4 w-4" />
          </div>
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={organization.lng}
          latitude={organization.lat}
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
                style={{ backgroundColor: ORG_INDIGO }}
              >
                {orgTypeLabel(organization.org_type)}
              </div>
              <CardTitle className="text-base">{organization.name}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-2">
              {organization.description && (
                <p className="text-sm text-stone-600 line-clamp-3">{organization.description}</p>
              )}
              {fullAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{fullAddress}</span>
                </div>
              )}
              <a
                href={`/s/organization/${organization.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline pt-1"
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
