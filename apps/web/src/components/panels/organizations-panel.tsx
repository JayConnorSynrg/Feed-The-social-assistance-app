'use client'

// apps/web/src/components/panels/organizations-panel.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Community → Organizations subtab. A read-only showcase of every ACTIVE NON-business organization
// (food banks, pantries, shelters, clinics, mutual aid, nonprofits, government, community, other) —
// the admin-curated directory siblings of the member-submitted local businesses. Mirrors the
// BusinessesPanel showcase surface exactly (bucketed-distance sort via the shared haversine
// calculateDistance + the server distance-bucket vocabulary — no new distance formula), but has NO
// submit form: organizations are created through the platform-admin intake, never member-submitted, so
// this panel only lists them. Each row links to the org's public /s/organization/[id] page.
// Platform admins also get an "Add organization" link into the admin setup panel.
//
// Distance origin follows the map panel: device GPS only when the user opted in to location
// sharing (requested once on mount), otherwise the profile's stored lat/lng.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, ExternalLink, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGeolocation, calculateDistance } from '@/hooks/use-geolocation'
import { logger } from '@/lib/logger'
import { distanceBucketLabel } from '@/components/feed/post-model'
import { bucketForKm, parseGeographyPoint, sortByDistanceKm } from '@/lib/business'
import { fetchApprovedOrganizations, type Organization } from '@/lib/org-data'
import { ORG_TYPE_LABELS, isNonBusinessOrgType } from '@/lib/org-vocab'
import { readShareLocationPref } from '@/lib/privacy-prefs'
import { useAuth } from '@/hooks/use-auth'
import { useAdminTier } from '@/hooks/use-admin-tier'
import { canCreateOrganizations } from '@/lib/admin-tier'
import { dir, resolveUserLocale, type Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'

/** Human label for an org_type, falling back to the raw value for any unexpected type. */
function orgTypeLabel(orgType: string): string {
  return isNonBusinessOrgType(orgType) ? ORG_TYPE_LABELS[orgType] : orgType
}

export function OrganizationsPanel() {
  const { position, getCurrentPosition } = useGeolocation()
  const { profile } = useAuth()
  const { tier } = useAdminTier()
  // The admin link speaks the admin's profile language (the rest of this panel is English).
  const adminLocale: Locale = profile
    ? resolveUserLocale((profile as { preferred_language?: string | null }).preferred_language ?? null)
    : 'en'
  const supabase = createClient()

  // Device GPS only with the explicit Share Location opt-in, requested once on mount.
  useEffect(() => {
    if (!readShareLocationPref()) return
    getCurrentPosition()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const rows = await fetchApprovedOrganizations(supabase)
      setOrganizations(rows)
    } catch (err) {
      logger.error('organizations.list.failed', err instanceof Error ? err : new Error(String(err)))
      setLoadError(err instanceof Error ? err.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  // Sort by bucketed distance when a position is available; else keep the name order the reader
  // returned. Distance uses the existing haversine calculateDistance (same as BusinessesPanel).
  const gpsLat = position?.coords?.latitude
  const gpsLng = position?.coords?.longitude
  const origin = useMemo<{ latitude: number; longitude: number } | null>(() => {
    if (gpsLat != null && gpsLng != null) return { latitude: gpsLat, longitude: gpsLng }
    const lat = profile?.latitude
    const lng = profile?.longitude
    if (lat != null && lng != null && (lat !== 0 || lng !== 0)) return { latitude: lat, longitude: lng }
    return null
  }, [gpsLat, gpsLng, profile?.latitude, profile?.longitude])
  const sorted = useMemo(() => {
    if (!origin) return organizations
    const kmOf = (o: Organization): number | null => {
      const pt = parseGeographyPoint(o.location)
      if (!pt) return null
      return calculateDistance(origin.latitude, origin.longitude, pt.lat, pt.lng)
    }
    return sortByDistanceKm(organizations, kmOf)
  }, [organizations, origin])

  const labelFor = useCallback(
    (o: Organization): string | null => {
      if (!origin) return null
      const pt = parseGeographyPoint(o.location)
      if (!pt) return null
      return distanceBucketLabel(bucketForKm(calculateDistance(origin.latitude, origin.longitude, pt.lat, pt.lng)))
    },
    [origin]
  )

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-org/10 text-org">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-stone-800">Local Organizations</h1>
            <p className="text-xs text-stone-500">Food banks, shelters, clinics, and community organizations near you</p>
          </div>
          {canCreateOrganizations(tier) && (
            <a
              href="/moderation?tab=organizations&org=new"
              lang={adminLocale}
              dir={dir(adminLocale)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {orgFormT(adminLocale, 'addOrganization')}
            </a>
          )}
        </div>

        {/* Showcase list */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-stone-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
            {loadError}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
            No organizations yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((o) => {
              const label = labelFor(o)
              const addr = [o.city, o.state].filter(Boolean).join(', ')
              return (
                <li key={o.id}>
                  <a
                    href={`/s/organization/${o.id}`}
                    className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-org/40 hover:bg-org/5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-org text-sm font-semibold uppercase text-white shadow-sm">
                      {o.name.trim().charAt(0) || <Building2 className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-semibold text-stone-800">{o.name}</h3>
                        <ExternalLink className="h-4 w-4 shrink-0 text-stone-400" />
                      </div>
                      {o.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{o.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                        <span className="rounded-full bg-org/10 px-2 py-0.5 font-medium text-org">
                          {orgTypeLabel(o.org_type)}
                        </span>
                        {addr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {addr}
                          </span>
                        )}
                        {label && <span>{label}</span>}
                      </div>
                    </div>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
