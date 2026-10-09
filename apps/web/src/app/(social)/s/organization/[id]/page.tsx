import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, Leaf, ExternalLink, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminEditLinkIsland } from '@/components/admin/admin-edit-link-island'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'
import { normalizeUrl } from '@/lib/utils/url'
import {
  fetchOrganizationById,
  fetchOrgResources,
  type Organization,
  type OrgLinkedResource,
} from '@/lib/org-data'
import { fetchBusinessHours, fetchBusinessPhotos } from '@/lib/business-data'
import {
  parseGeographyPoint,
  formatHoursInterval,
  schemaOrgTime,
  DAY_NAMES_SHORT,
  type BusinessHours,
  type BusinessPhoto,
} from '@/lib/business'
import { ORG_TYPE_LABELS, isNonBusinessOrgType } from '@/lib/org-vocab'
import { OpenNowPill } from '@/components/business/open-now-pill'
import { ORG_MARKER_HEX } from '@/lib/map-marker-colors'

interface Props {
  params: Promise<{ id: string }>
}

function staticMapUrl(location: string | { coordinates?: [number, number] } | null): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return null
  const pt = parseGeographyPoint(location)
  if (!pt) return null
  const marker = `pin-l+${ORG_MARKER_HEX.slice(1)}(${pt.lng},${pt.lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${pt.lng},${pt.lat},14/600x300@2x?access_token=${token}`
}

/** The stored org_type → its human label (org-vocab), or null when unknown/absent. */
function orgTypeLabel(value: string | null): string | null {
  if (!value || !isNonBusinessOrgType(value)) return null
  return ORG_TYPE_LABELS[value]
}

/** A linked resource's category string → a human label ("mental_health" → "Mental Health"). */
function resourceCategoryLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// schema.org day URLs indexed by day_of_week (0 = Sunday … 6 = Saturday).
const SCHEMA_DAY_URLS = [
  'https://schema.org/Sunday',
  'https://schema.org/Monday',
  'https://schema.org/Tuesday',
  'https://schema.org/Wednesday',
  'https://schema.org/Thursday',
  'https://schema.org/Friday',
  'https://schema.org/Saturday',
] as const

/**
 * Build the schema.org Organization JSON-LD (INV-G — @type is exactly "Organization", NOT
 * LocalBusiness; no cost/priceRange/offers-pricing fields exist here). Every field whose source is
 * null/empty is OMITTED (never an empty string — Google penalizes those). The well-established core
 * (name/address/geo/openingHoursSpecification) is included whenever its data exists.
 */
function buildJsonLd(args: {
  org: Organization
  hours: BusinessHours[]
  photos: BusinessPhoto[]
  pageUrl: string
  websiteHref: string | null
}): Record<string, unknown> {
  const { org, hours, photos, pageUrl, websiteHref } = args
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: pageUrl,
  }

  if (org.description) ld.description = org.description
  if (websiteHref) ld.url = websiteHref
  if (org.phone) ld.telephone = org.phone
  if (org.email) ld.email = org.email

  // image[]: logo, cover, then gallery — only urls that exist.
  const logoUrl = photos.find((p) => p.kind === 'logo')?.url ?? null
  const coverUrl = photos.find((p) => p.kind === 'cover')?.url ?? null
  const galleryUrls = photos.filter((p) => p.kind === 'gallery').map((p) => p.url)
  const images = [logoUrl, coverUrl, ...galleryUrls].filter((u): u is string => !!u)
  if (images.length > 0) ld.image = images
  if (logoUrl) ld.logo = logoUrl

  // PostalAddress — include only the parts present; emit the node only if at least one part exists.
  const addressParts: Record<string, string> = { addressCountry: 'US' }
  if (org.address) addressParts.streetAddress = org.address
  if (org.city) addressParts.addressLocality = org.city
  if (org.state) addressParts.addressRegion = org.state
  if (org.zip_code) addressParts.postalCode = org.zip_code
  if (Object.keys(addressParts).length > 1) {
    ld.address = { '@type': 'PostalAddress', ...addressParts }
  }

  // geo — parsed from the same geography point the static map uses.
  const pt = parseGeographyPoint(org.location)
  if (pt) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: pt.lat, longitude: pt.lng }
  }

  // openingHoursSpecification — one entry per valid hours row.
  const openingHours = hours
    .map((h) => {
      const day = SCHEMA_DAY_URLS[h.day_of_week]
      const opens = schemaOrgTime(h.open_time)
      const closes = schemaOrgTime(h.close_time)
      if (!day || !opens || !closes) return null
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: day,
        opens,
        closes,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
  if (openingHours.length > 0) ld.openingHoursSpecification = openingHours

  return ld
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const appUrl = await getAppUrlFromHeaders()

  const org = await fetchOrganizationById(supabase, id)
  if (!org) {
    return { title: 'Organization Not Found - FEED' }
  }

  const description = org.description
    ? org.description.length > 160
      ? org.description.slice(0, 157) + '...'
      : org.description
    : `${org.name} - Local organization on FEED`

  return {
    title: `${org.name} - FEED`,
    description,
    openGraph: {
      title: org.name,
      description,
      type: 'website',
      siteName: 'FEED',
      images: [
        {
          url: `${appUrl}/api/og/organization/${id}`,
          width: 1200,
          height: 630,
          alt: org.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: org.name,
      description,
      images: [`${appUrl}/api/og/organization/${id}`],
    },
  }
}

export default async function SharedOrganizationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // INV-F: a missing / inactive / business-typed org notFound()s before any child read. The reader
  // filters to active non-business rows, so a business id never resolves here (RLS mirrors the gate).
  const org = await fetchOrganizationById(supabase, id)
  if (!org) notFound()

  // Parallelize the child reads — no N+1 waterfall (they are independent of one another). Hours and
  // photos live in the shared business_* child tables (keyed by org_id; their public_select policies
  // admit active non-business orgs); resources come via org_resources → resources.
  const [hours, photos, resources] = await Promise.all([
    fetchBusinessHours(supabase, id),
    fetchBusinessPhotos(supabase, id),
    fetchOrgResources(supabase, id),
  ])

  const appUrl = await getAppUrlFromHeaders()
  const pageUrl = `${appUrl}/s/organization/${id}`

  const address = [org.address, org.city, org.state, org.zip_code].filter(Boolean).join(', ')
  const mapUrl = staticMapUrl(org.location)
  // Same helper as the intake-time write, so the CTA href is always absolute + external.
  const websiteHref = normalizeUrl(org.website)

  const typeLabel = orgTypeLabel(org.org_type)
  const coverUrl = photos.find((p) => p.kind === 'cover')?.url ?? null
  const logoUrl = photos.find((p) => p.kind === 'logo')?.url ?? null
  const galleryPhotos = photos.filter((p) => p.kind === 'gallery')

  const jsonLd = buildJsonLd({ org, hours, photos, pageUrl, websiteHref })

  return (
    <div className="space-y-6">
      {/* JSON-LD — server-rendered structured data for search engines. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* FEED wordmark */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-500">Local Organization</p>
        </div>
        {/* Admins only, rendered in the browser after hydration — never part of this server HTML. */}
        <div className="ml-auto">
          <AdminEditLinkIsland target={{ kind: 'organization', id: org.id }} itemName={org.name} source="organization_page" />
        </div>
      </div>

      {/* Organization Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {/* 1. HEADER — cover banner (or themed gradient fallback) with logo + name overlay */}
        <div className="relative">
          {coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={coverUrl}
              alt={`${org.name} cover`}
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-lime-200 via-stone-100 to-amber-100" />
          )}
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={`${org.name} logo`}
              className="absolute -bottom-8 left-5 h-20 w-20 rounded-xl border-4 border-white object-cover shadow-md"
            />
          )}
        </div>

        <div className={`p-5 space-y-4 ${logoUrl ? 'pt-11' : ''}`}>
          {/* Type badge — from org_type, falls back to a neutral "Organization". */}
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
            <Leaf className="h-3.5 w-3.5" />
            {typeLabel ?? 'Organization'}
          </span>

          {/* Name */}
          <h2 className="text-2xl font-bold text-stone-800">{org.name}</h2>

          {/* 2. OPEN-NOW */}
          <div className="flex flex-wrap items-center gap-2">
            <OpenNowPill hours={hours} />
          </div>

          {/* 3. CONTACT — website CTA + call + email */}
          <div className="flex flex-wrap gap-2">
            {/* Prominent external-website CTA — opens the org's OWN site in a new tab. Rendered only
                when a website is present, so there is never a broken/empty href. */}
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 min-w-[10rem] items-center justify-center gap-2 rounded-lg bg-lime-600 px-6 py-3 text-white font-semibold hover:bg-lime-700 transition-colors"
              >
                Visit website
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {org.phone && (
              <a
                href={`tel:${org.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            )}
            {org.email && (
              <a
                href={`mailto:${org.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
            )}
          </div>

          {/* 4. LOCATION — static map + address */}
          {mapUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mapUrl}
              alt={`Map showing ${org.name}`}
              width={600}
              height={300}
              className="w-full rounded-lg border border-stone-200"
            />
          )}
          {address && (
            <div className="flex items-start gap-3 text-stone-600">
              <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-stone-400" />
              <span>{address}</span>
            </div>
          )}

          {/* 5. ABOUT */}
          {org.description && (
            <p className="text-stone-600 leading-relaxed">{org.description}</p>
          )}

          {/* 6. PHOTOS — gallery strip (hidden entirely when there are none) */}
          {galleryPhotos.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                Photos
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {galleryPhotos.map((photo) => (
                  <figure key={photo.storage_path} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? `${org.name} photo`}
                      className="aspect-square w-full rounded-lg border border-stone-200 object-cover"
                    />
                    {photo.caption && (
                      <figcaption className="text-xs text-stone-500">{photo.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* 7. HOURS — 7-day table (hidden when no hours) */}
          {hours.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                Hours
              </h3>
              <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {DAY_NAMES_SHORT.map((dayName, dayIndex) => {
                  const intervals = hours
                    .filter((h) => h.day_of_week === dayIndex)
                    .map(formatHoursInterval)
                    .filter((s): s is string => s !== null)
                  return (
                    <div key={dayName} className="flex justify-between gap-4 px-3 py-2 text-sm">
                      <dt className="font-medium text-stone-700">{dayName}</dt>
                      <dd className="text-right text-stone-600">
                        {intervals.length > 0 ? intervals.join(', ') : 'Closed'}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          )}

          {/* 8. RESOURCES OFFERED — each linked catalog resource, linking to its public page (INV-H).
              Hidden entirely when the org has no linked resources (no dangling empty section). */}
          {resources.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                Resources offered
              </h3>
              <ul className="space-y-2">
                {resources.map((resource: OrgLinkedResource) => (
                  <li key={resource.id}>
                    <a
                      href={`/s/resource/${resource.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 hover:bg-stone-100 transition-colors"
                    >
                      <span>
                        <span className="block font-medium text-stone-800">{resource.name}</span>
                        <span className="block text-xs text-stone-500">
                          {resourceCategoryLabel(resource.category)}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="text-center space-y-3 py-4">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-lime-600 px-8 py-3 text-white font-semibold hover:bg-lime-700 transition-colors"
        >
          Explore More on FEED
        </a>
        <p className="text-sm text-stone-500">Find community resources and support near you.</p>
      </div>
    </div>
  )
}
