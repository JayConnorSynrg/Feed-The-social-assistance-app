import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'
import { fetchApprovedBusinessById } from '@/lib/business-data'
import { parseGeographyPoint } from '@/lib/business'

interface Props {
  params: Promise<{ id: string }>
}

function staticMapUrl(location: string | { coordinates?: [number, number] } | null): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return null
  const pt = parseGeographyPoint(location)
  if (!pt) return null
  const marker = `pin-l+0f766e(${pt.lng},${pt.lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${pt.lng},${pt.lat},14/600x300@2x?access_token=${token}`
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

  const business = await fetchApprovedBusinessById(supabase, id)
  if (!business) notFound()

  const address = [business.address, business.city, business.state].filter(Boolean).join(', ')
  const mapUrl = staticMapUrl(business.location)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-500">Local Business</p>
        </div>
      </div>

      {/* Business Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-5 space-y-4">
          {/* Category badge */}
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
            <Leaf className="h-3.5 w-3.5" />
            Local business
          </span>

          {/* Name + description */}
          <h2 className="text-2xl font-bold text-stone-800">{business.name}</h2>
          {business.description && (
            <p className="text-stone-600 leading-relaxed">{business.description}</p>
          )}

          {/* Static map */}
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

          {/* Details */}
          <div className="space-y-3 pt-2">
            {address && (
              <div className="flex items-start gap-3 text-stone-600">
                <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-stone-400" />
                <span>{address}</span>
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-3 text-stone-600">
                <Phone className="h-5 w-5 shrink-0 text-stone-400" />
                <a href={`tel:${business.phone}`} className="hover:underline text-lime-700">
                  {business.phone}
                </a>
              </div>
            )}
            {business.website && (
              <div className="flex items-center gap-3 text-stone-600">
                <Globe className="h-5 w-5 shrink-0 text-stone-400" />
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-lime-700 truncate"
                >
                  {business.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
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
