import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'
import { ogCardAlt } from '@/lib/og-card-kinds'
import { dir } from '@/lib/i18n'
import { shareT } from '@/lib/i18n-share'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { formatMessage } from '@/lib/format-message'
import { requestPageLocale } from '@/lib/request-locale-server'

interface Props {
  params: Promise<{ id: string }>
}

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-green-100 text-green-800',
  housing: 'bg-blue-100 text-blue-800',
  healthcare: 'bg-red-100 text-red-800',
  employment: 'bg-yellow-100 text-yellow-800',
  education: 'bg-purple-100 text-purple-800',
  legal: 'bg-indigo-100 text-indigo-800',
  transportation: 'bg-cyan-100 text-cyan-800',
  utilities: 'bg-orange-100 text-orange-800',
  clothing: 'bg-pink-100 text-pink-800',
  financial: 'bg-emerald-100 text-emerald-800',
  mental_health: 'bg-violet-100 text-violet-800',
  substance_abuse: 'bg-purple-100 text-purple-800',
  domestic_violence: 'bg-rose-100 text-rose-800',
  childcare: 'bg-amber-100 text-amber-800',
  senior_services: 'bg-indigo-100 text-indigo-800',
  disability_services: 'bg-teal-100 text-teal-800',
  veteran_services: 'bg-blue-100 text-blue-800',
  immigration: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800',
  eitc_tax_filing: 'bg-sky-100 text-sky-800',
  free_legal: 'bg-indigo-100 text-indigo-800',
  prenatal_natal_care: 'bg-pink-100 text-pink-800',
  waste_disposal: 'bg-lime-100 text-lime-800',
  free_camping: 'bg-green-100 text-green-800',
  free_goods_donation: 'bg-rose-100 text-rose-800',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const appUrl = await getAppUrlFromHeaders()

  const { data: resource } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  // FEED's own words in the visitor's language (the root layout's rule); the resource's text as written.
  const locale = await requestPageLocale()
  if (!resource) {
    return { title: shareT(locale, 'resourceNotFound') }
  }

  const description = resource.description
    ? resource.description.length > 160 ? resource.description.slice(0, 157) + '...' : resource.description
    : formatMessage(shareT(locale, 'resourceDescFallback'), { name: resource.name })

  return {
    title: `${resource.name} - FEED`,
    description,
    openGraph: {
      title: resource.name,
      description,
      type: 'website',
      siteName: 'FEED',
      images: [
        {
          url: `${appUrl}/api/og/resource/${id}`,
          width: 1200,
          height: 630,
          // What the fixed preview card shows (the name is in og:title).
          alt: ogCardAlt('resource'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: resource.name,
      description,
      images: [{ url: `${appUrl}/api/og/resource/${id}`, alt: ogCardAlt('resource') }],
    },
  }
}

export default async function SharedResourcePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: resource } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!resource) notFound()

  const locale = await requestPageLocale()
  const t = (key: Parameters<typeof shareT>[1]) => shareT(locale, key)
  const categoryLabel = resourceCategoryLabel(resource.category, locale)
  const categoryClasses = CATEGORY_COLORS[resource.category] || CATEGORY_COLORS.other
  const address = [resource.address_line1, resource.city, resource.state, resource.zip_code]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-6" lang={locale} dir={dir(locale)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-600">{t('communityResource')}</p>
        </div>
        {/* Admins only, rendered in the browser after hydration — never part of this server HTML. */}
        <div className="ms-auto">
          <ClientAdminEditLink target={{ kind: 'resource', id: resource.id }} itemName={resource.name} source="resource_page" />
        </div>
      </div>

      {/* Resource Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-5 space-y-4">
          {/* Category badge */}
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${categoryClasses}`}>
            {categoryLabel}
          </span>

          {/* Name + description */}
          <h2 className="text-2xl font-bold text-stone-800 break-words" lang="" dir="auto">{resource.name}</h2>
          {resource.description && (
            <p className="text-stone-700 leading-relaxed break-words" lang="" dir="auto">{resource.description}</p>
          )}

          {/* Details */}
          <div className="space-y-3 pt-2">
            {address && (
              <div className="flex items-start gap-3 text-stone-700">
                <MapPin aria-hidden="true" className="h-5 w-5 mt-0.5 shrink-0 text-stone-600" />
                <span lang="" dir="auto">{address}</span>
              </div>
            )}
            {resource.phone && (
              <div className="flex items-center gap-3 text-stone-700">
                <Phone aria-hidden="true" className="h-5 w-5 shrink-0 text-stone-600" />
                <a href={`tel:${resource.phone}`} dir="ltr" className="inline-flex min-h-6 items-center underline text-lime-800">
                  {resource.phone}
                </a>
              </div>
            )}
            {resource.website && (
              <div className="flex items-center gap-3 text-stone-700">
                <Globe aria-hidden="true" className="h-5 w-5 shrink-0 text-stone-600" />
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="inline-flex min-h-6 items-center min-w-0 underline text-lime-800 break-all"
                >
                  {resource.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {resource.hours_of_operation && (
              <div className="flex items-start gap-3 text-stone-700">
                <Clock aria-hidden="true" className="h-5 w-5 mt-0.5 shrink-0 text-stone-600" />
                <span className="text-sm">{t('hoursInFeed')}</span>
              </div>
            )}
          </div>

          {/* Eligibility */}
          {resource.eligibility_requirements && (
            <div className="pt-2 border-t border-stone-100">
              <h3 className="text-sm font-semibold text-stone-800 mb-1">{t('eligibility')}</h3>
              <p className="text-sm text-stone-700 break-words" lang="" dir="auto">{resource.eligibility_requirements}</p>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 py-4">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-lime-700 px-8 py-3 text-white font-semibold hover:bg-lime-800 transition-colors"
        >
          {t('viewDetails')}
        </a>
        <p className="text-sm text-stone-600">{t('viewDetailsBody')}</p>
      </div>
    </div>
  )
}
