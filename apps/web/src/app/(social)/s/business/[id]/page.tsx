import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, Leaf, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminEditLinkIsland } from '@/components/admin/admin-edit-link-island'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'
import { normalizeUrl } from '@/lib/utils/url'
import {
  fetchApprovedBusinessById,
  fetchBusinessHours,
  fetchBusinessServices,
  fetchBusinessPhotos,
} from '@/lib/business-data'
import {
  parseGeographyPoint,
  formatHoursInterval,
  schemaOrgTime,
  DAY_NAMES_SHORT,
  type Business,
  type BusinessHours,
  type BusinessService,
  type BusinessPhoto,
} from '@/lib/business'
import { BUSINESS_CATEGORIES, BUSINESS_ATTRIBUTES, SOCIAL_PLATFORMS } from '@/lib/business-vocab'
import { BUSINESS_MARKER_HEX } from '@/lib/map-marker-colors'
import { OpenNowPill } from '@/components/business/open-now-pill'

interface Props {
  params: Promise<{ id: string }>
}

function staticMapUrl(location: string | { coordinates?: [number, number] } | null): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return null
  const pt = parseGeographyPoint(location)
  if (!pt) return null
  const marker = `pin-l+${BUSINESS_MARKER_HEX.slice(1)}(${pt.lng},${pt.lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${pt.lng},${pt.lat},14/600x300@2x?access_token=${token}`
}

/** The stored category string → its human label (BUSINESS_CATEGORIES), or null when unknown/absent. */
function categoryLabel(value: string | null): string | null {
  if (!value) return null
  return BUSINESS_CATEGORIES.find((c) => c.value === value)?.label ?? null
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

// cost_model → schema.org priceRange (LocalBusiness). Omitted when cost_model is null.
const PRICE_RANGE: Record<string, string> = {
  free: 'Free',
  sliding_scale: '$ - $$ (sliding scale)',
  paid: '$$',
}

/**
 * Build the schema.org LocalBusiness JSON-LD. Every field whose source is null/empty is OMITTED
 * (never an empty string — Google penalizes those). The well-established core (name/address/geo/
 * openingHoursSpecification) is included whenever its data exists; speculative fields are left out.
 */
function buildJsonLd(args: {
  business: Business
  hours: BusinessHours[]
  services: BusinessService[]
  photos: BusinessPhoto[]
  pageUrl: string
  websiteHref: string | null
}): Record<string, unknown> {
  const { business, hours, services, photos, pageUrl, websiteHref } = args
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url: pageUrl,
  }

  if (business.description) ld.description = business.description
  if (websiteHref) ld.url = websiteHref
  if (business.phone) ld.telephone = business.phone
  if (business.email) ld.email = business.email

  // image[]: logo, cover, then gallery — only urls that exist.
  const logoUrl = photos.find((p) => p.kind === 'logo')?.url ?? null
  const coverUrl = photos.find((p) => p.kind === 'cover')?.url ?? null
  const galleryUrls = photos.filter((p) => p.kind === 'gallery').map((p) => p.url)
  const images = [logoUrl, coverUrl, ...galleryUrls].filter((u): u is string => !!u)
  if (images.length > 0) ld.image = images
  if (logoUrl) ld.logo = logoUrl

  if (business.cost_model && PRICE_RANGE[business.cost_model]) {
    ld.priceRange = PRICE_RANGE[business.cost_model]
  }

  // PostalAddress — include only the parts present; emit the node only if at least one part exists.
  const addressParts: Record<string, string> = { addressCountry: 'US' }
  if (business.address) addressParts.streetAddress = business.address
  if (business.city) addressParts.addressLocality = business.city
  if (business.state) addressParts.addressRegion = business.state
  if (business.zip_code) addressParts.postalCode = business.zip_code
  if (Object.keys(addressParts).length > 1) {
    ld.address = { '@type': 'PostalAddress', ...addressParts }
  }

  // geo — parsed from the same geography point the static map uses.
  const pt = parseGeographyPoint(business.location)
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

  // hasOfferCatalog — services as Offer→Service.
  if (services.length > 0) {
    ld.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: services.map((s) => {
        const service: Record<string, unknown> = { '@type': 'Service', name: s.name }
        if (s.description) service.description = s.description
        return { '@type': 'Offer', itemOffered: service }
      }),
    }
  }

  // sameAs — social links (values are already normalized absolute URLs at write).
  const sameAs = Object.values(business.social_links ?? {}).filter((v) => !!v)
  if (sameAs.length > 0) ld.sameAs = sameAs

  return ld
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const appUrl = await getAppUrlFromHeaders()

  const business = await fetchApprovedBusinessById(supabase, id)
  if (!business) {
    return { title: 'Business Not Found - FEED' }
  }

  const description = business.description
    ? business.description.length > 160
      ? business.description.slice(0, 157) + '...'
      : business.description
    : `${business.name} - Local business on FEED`

  return {
    title: `${business.name} - FEED`,
    description,
    openGraph: {
      title: business.name,
      description,
      type: 'website',
      siteName: 'FEED',
      images: [
        {
          url: `${appUrl}/api/og/business/${id}`,
          width: 1200,
          height: 630,
          alt: business.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: business.name,
      description,
      images: [`${appUrl}/api/og/business/${id}`],
    },
  }
}

export default async function SharedBusinessPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // INV(a): a missing / not-approved business notFound()s before any child read.
  const business = await fetchApprovedBusinessById(supabase, id)
  if (!business) notFound()

  // Parallelize the child reads — no N+1 waterfall (they are independent of one another).
  const [hours, services, photos] = await Promise.all([
    fetchBusinessHours(supabase, id),
    fetchBusinessServices(supabase, id),
    fetchBusinessPhotos(supabase, id),
  ])

  const appUrl = await getAppUrlFromHeaders()
  const pageUrl = `${appUrl}/s/business/${id}`

  const address = [business.address, business.city, business.state, business.zip_code]
    .filter(Boolean)
    .join(', ')
  const mapUrl = staticMapUrl(business.location)
  // Same helper as the submit-time write, so the CTA href is always absolute + external (INV1/e).
  const websiteHref = normalizeUrl(business.website)

  const catLabel = categoryLabel(business.business_category)
  const coverUrl = photos.find((p) => p.kind === 'cover')?.url ?? null
  const logoUrl = photos.find((p) => p.kind === 'logo')?.url ?? null
  const galleryPhotos = photos.filter((p) => p.kind === 'gallery')

  // Attribute chips: only keys set true, resolved to their controlled label.
  const activeAttributes = BUSINESS_ATTRIBUTES.filter((a) => business.attributes?.[a.key] === true)
  // Social links present on this business, resolved to their controlled label.
  const activeSocials = SOCIAL_PLATFORMS.map((p) => ({
    ...p,
    href: business.social_links?.[p.key] ?? null,
  })).filter((p): p is typeof p & { href: string } => !!p.href)

  const jsonLd = buildJsonLd({ business, hours, services, photos, pageUrl, websiteHref })

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
          <p className="text-xs text-stone-500">Local Business</p>
        </div>
        {/* Admins only, rendered in the browser after hydration — never part of this server HTML. */}
        <div className="ml-auto">
          <AdminEditLinkIsland target={{ kind: 'business', id: business.id }} itemName={business.name} source="business_page" />
        </div>
      </div>

      {/* Business Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {/* 1. HEADER — cover banner (or themed gradient fallback) with logo + name overlay */}
        <div className="relative">
          {coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={coverUrl}
              alt={`${business.name} cover`}
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-lime-200 via-stone-100 to-amber-100" />
          )}
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={`${business.name} logo`}
              className="absolute -bottom-8 left-5 h-20 w-20 rounded-xl border-4 border-white object-cover shadow-md"
            />
          )}
        </div>

        <div className={`p-5 space-y-4 ${logoUrl ? 'pt-11' : ''}`}>
          {/* Category badge — from business_category, falls back to a neutral "Local business". */}
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
            <Leaf className="h-3.5 w-3.5" />
            {catLabel ?? 'Local business'}
          </span>

          {/* Name */}
          <h2 className="text-2xl font-bold text-stone-800">{business.name}</h2>

          {/* 2. PRIMARY ACTIONS + OPEN-NOW */}
          <div className="flex flex-wrap items-center gap-2">
            <OpenNowPill hours={hours} />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Prominent external-website CTA — opens the business's OWN site in a new tab (INV1/e).
                Rendered only when a website is present, so there is never a broken/empty href. */}
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
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            )}
            {business.email && (
              <a
                href={`mailto:${business.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
            )}
          </div>

          {/* 3. LOCATION — static map + address */}
          {mapUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mapUrl}
              alt={`Map showing ${business.name}`}
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

          {/* 4. ABOUT */}
          {business.description && (
            <p className="text-stone-600 leading-relaxed">{business.description}</p>
          )}

          {/* 5. PHOTOS — gallery strip (hidden entirely when there are none) */}
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
                      alt={photo.caption ?? `${business.name} photo`}
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

          {/* 6. HOURS — 7-day table (hidden when no hours) */}
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

          {/* 7. SERVICES — name + one-line description (hidden when none) */}
          {services.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                Services
              </h3>
              <ul className="space-y-2">
                {services.map((service, i) => (
                  <li key={`${service.name}-${i}`} className="rounded-lg bg-stone-50 px-3 py-2">
                    <p className="font-medium text-stone-800">{service.name}</p>
                    {service.description && (
                      <p className="text-sm text-stone-600">{service.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 8. ATTRIBUTES + SOCIAL (hidden when both empty) */}
          {(activeAttributes.length > 0 || activeSocials.length > 0) && (
            <div className="space-y-3 border-t border-stone-100 pt-4">
              {activeAttributes.length > 0 && (
                <ul aria-label="Business features" className="flex flex-wrap gap-2">
                  {activeAttributes.map((attr) => (
                    <li
                      key={attr.key}
                      role="listitem"
                      aria-label={attr.label}
                      className="inline-flex items-center rounded-full bg-lime-50 px-3 py-1 text-sm font-medium text-lime-800"
                    >
                      {attr.label}
                    </li>
                  ))}
                </ul>
              )}
              {activeSocials.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {activeSocials.map((social) => (
                    <a
                      key={social.key}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-lime-700 hover:underline"
                    >
                      {social.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              )}
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
