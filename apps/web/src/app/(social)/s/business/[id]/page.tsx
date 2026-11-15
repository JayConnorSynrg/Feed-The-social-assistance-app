import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, Leaf, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'
import { ogCardAlt } from '@/lib/og-card-kinds'
import { normalizeUrl } from '@/lib/utils/url'
import { serializeJsonLd } from '@/lib/json-ld'
import {
  fetchApprovedBusinessById,
  fetchBusinessHours,
  fetchBusinessServices,
  fetchBusinessPhotos,
} from '@/lib/business-data'
import {
  parseGeographyPoint,
  schemaOrgTime,
  type Business,
  type BusinessHours,
  type BusinessService,
  type BusinessPhoto,
} from '@/lib/business'
import { BUSINESS_ATTRIBUTES, BUSINESS_CATEGORIES, SOCIAL_PLATFORMS } from '@/lib/business-vocab'
import { businessAttributeLabel, businessCategoryLabel, businessesT } from '@/lib/i18n-feed-businesses'
import { BUSINESS_MARKER_HEX } from '@/lib/map-marker-colors'
import { OpenNowPill } from '@/components/business/open-now-pill'
import { dir, type Locale } from '@/lib/i18n'
import { hoursIntervalText, shareT, weekdayShortText } from '@/lib/i18n-share'
import { formatMessage } from '@/lib/format-message'
import { requestPageLocale } from '@/lib/request-locale-server'

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

/** The stored category in the viewer's language, or null when absent or not one of the categories. */
function categoryLabel(value: string | null, locale: Locale): string | null {
  if (!value || !BUSINESS_CATEGORY_VALUES.has(value)) return null
  return businessCategoryLabel(value, locale)
}
const BUSINESS_CATEGORY_VALUES = new Set(BUSINESS_CATEGORIES.map((c) => c.value as string))

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
  // FEED's own words in the visitor's language (the root layout's rule); member text as written.
  const locale = await requestPageLocale()
  if (!business) {
    return { title: shareT(locale, 'businessNotFound') }
  }

  const description = business.description
    ? business.description.length > 160
      ? business.description.slice(0, 157) + '...'
      : business.description
    : formatMessage(shareT(locale, 'businessDescFallback'), { name: business.name })

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
          // What the fixed preview card shows (the name is in og:title).
          alt: ogCardAlt('business'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: business.name,
      description,
      images: [{ url: `${appUrl}/api/og/business/${id}`, alt: ogCardAlt('business') }],
    },
  }
}

export default async function SharedBusinessPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // INV(a): a missing / not-approved business notFound()s before any child read.
  const business = await fetchApprovedBusinessById(supabase, id)
  if (!business) notFound()

  const locale = await requestPageLocale()
  const t = (key: Parameters<typeof shareT>[1]) => shareT(locale, key)
  const named = (key: Parameters<typeof shareT>[1]) => formatMessage(t(key), { name: business.name })

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

  const catLabel = categoryLabel(business.business_category, locale)
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
    <div className="space-y-6" lang={locale} dir={dir(locale)}>
      {/* JSON-LD — server-rendered structured data for search engines. serializeJsonLd keeps
          member-written text (name, description, contact) from closing the script element. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* FEED wordmark */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-600">{t('localBusiness')}</p>
        </div>
        {/* Admins only, rendered in the browser after hydration — never part of this server HTML. */}
        <div className="ms-auto">
          <ClientAdminEditLink target={{ kind: 'business', id: business.id }} itemName={business.name} source="business_page" />
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
              alt={named('coverAlt')}
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-lime-200 via-stone-100 to-amber-100" />
          )}
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={named('logoAlt')}
              className="absolute -bottom-8 start-5 h-20 w-20 rounded-xl border-4 border-white object-cover shadow-md"
            />
          )}
        </div>

        <div className={`p-5 space-y-4 ${logoUrl ? 'pt-11' : ''}`}>
          {/* Category badge — from business_category, falls back to a neutral "Local business". */}
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
            <Leaf aria-hidden="true" className="h-3.5 w-3.5" />
            {catLabel ?? t('localBusiness')}
          </span>

          {/* Name */}
          <h2 className="text-2xl font-bold text-stone-800 break-words" lang="" dir="auto">{business.name}</h2>

          {/* 2. PRIMARY ACTIONS + OPEN-NOW */}
          <div className="flex flex-wrap items-center gap-2">
            <OpenNowPill hours={hours} locale={locale} />
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
                {t('visitWebsite')}
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            )}
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-500 bg-white px-4 py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Phone aria-hidden="true" className="h-4 w-4" />
                {t('call')}
              </a>
            )}
            {business.email && (
              <a
                href={`mailto:${business.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-500 bg-white px-4 py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {t('email')}
              </a>
            )}
          </div>

          {/* 3. LOCATION — static map + address */}
          {mapUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mapUrl}
              alt={named('mapAlt')}
              width={600}
              height={300}
              className="w-full rounded-lg border border-stone-200"
            />
          )}
          {address && (
            <div className="flex items-start gap-3 text-stone-600">
              <MapPin aria-hidden="true" className="h-5 w-5 mt-0.5 shrink-0 text-stone-600" />
              <span lang="" dir="auto">{address}</span>
            </div>
          )}

          {/* 4. ABOUT */}
          {business.description && (
            <p className="text-stone-700 leading-relaxed break-words" lang="" dir="auto">{business.description}</p>
          )}

          {/* 5. PHOTOS — gallery strip (hidden entirely when there are none) */}
          {galleryPhotos.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">
                {businessesT(locale, 'sectionPhotos')}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {galleryPhotos.map((photo) => (
                  <figure key={photo.storage_path} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? named('photoAlt')}
                      className="aspect-square w-full rounded-lg border border-stone-200 object-cover"
                    />
                    {photo.caption && (
                      <figcaption className="text-xs text-stone-600" lang="" dir="auto">{photo.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* 6. HOURS — 7-day table (hidden when no hours) */}
          {hours.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">
                {businessesT(locale, 'sectionHours')}
              </h3>
              <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                  const intervals = hours
                    .filter((h) => h.day_of_week === dayIndex)
                    .map((h) => hoursIntervalText(h, locale))
                    .filter((s): s is string => s !== null)
                  return (
                    <div key={dayIndex} className="flex flex-wrap justify-between gap-x-4 px-3 py-2 text-sm">
                      <dt className="font-medium text-stone-800">{weekdayShortText(dayIndex, locale)}</dt>
                      <dd className="text-end text-stone-700">
                        {intervals.length > 0 ? intervals.join(', ') : businessesT(locale, 'hoursClosed')}
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
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">
                {businessesT(locale, 'sectionServices')}
              </h3>
              <ul className="space-y-2">
                {services.map((service, i) => (
                  <li key={`${service.name}-${i}`} className="rounded-lg bg-stone-50 px-3 py-2">
                    <p className="font-medium text-stone-800 break-words" lang="" dir="auto">{service.name}</p>
                    {service.description && (
                      <p className="text-sm text-stone-700 break-words" lang="" dir="auto">{service.description}</p>
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
                <ul aria-label={t('businessFeatures')} className="flex flex-wrap gap-2">
                  {activeAttributes.map((attr) => (
                    <li
                      key={attr.key}
                      className="inline-flex items-center rounded-full bg-lime-50 px-3 py-1 text-sm font-medium text-lime-800"
                    >
                      {businessAttributeLabel(attr.key, locale)}
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
                      className="inline-flex min-h-6 items-center gap-1.5 text-sm font-medium text-stone-700 underline hover:text-lime-800"
                    >
                      {social.label}
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
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
          {t('exploreMore')}
        </a>
        <p className="text-sm text-stone-600">{t('exploreBody')}</p>
      </div>
    </div>
  )
}
