import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'

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

  if (!resource) {
    return { title: 'Resource Not Found - FEED' }
  }

  const description = resource.description
    ? resource.description.length > 160 ? resource.description.slice(0, 157) + '...' : resource.description
    : `${resource.name} - Community resource on FEED`

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
          alt: resource.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: resource.name,
      description,
      images: [`${appUrl}/api/og/resource/${id}`],
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

  const categoryLabel = resource.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const categoryClasses = CATEGORY_COLORS[resource.category] || CATEGORY_COLORS.other
  const address = [resource.address_line1, resource.city, resource.state, resource.zip_code]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-500">Community Resource</p>
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
          <h2 className="text-2xl font-bold text-stone-800">{resource.name}</h2>
          {resource.description && (
            <p className="text-stone-600 leading-relaxed">{resource.description}</p>
          )}

          {/* Details */}
          <div className="space-y-3 pt-2">
            {address && (
              <div className="flex items-start gap-3 text-stone-600">
                <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-stone-400" />
                <span>{address}</span>
              </div>
            )}
            {resource.phone && (
              <div className="flex items-center gap-3 text-stone-600">
                <Phone className="h-5 w-5 shrink-0 text-stone-400" />
                <a href={`tel:${resource.phone}`} className="hover:underline text-lime-700">
                  {resource.phone}
                </a>
              </div>
            )}
            {resource.website && (
              <div className="flex items-center gap-3 text-stone-600">
                <Globe className="h-5 w-5 shrink-0 text-stone-400" />
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-lime-700 truncate"
                >
                  {resource.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {resource.hours_of_operation && (
              <div className="flex items-start gap-3 text-stone-600">
                <Clock className="h-5 w-5 mt-0.5 shrink-0 text-stone-400" />
                <span className="text-sm">Hours available - see full details in FEED</span>
              </div>
            )}
          </div>

          {/* Eligibility */}
          {resource.eligibility_requirements && (
            <div className="pt-2 border-t border-stone-100">
              <h3 className="text-sm font-semibold text-stone-700 mb-1">Eligibility</h3>
              <p className="text-sm text-stone-600">{resource.eligibility_requirements}</p>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 py-4">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-lime-600 px-8 py-3 text-white font-semibold hover:bg-lime-700 transition-colors"
        >
          View Full Details in FEED
        </a>
        <p className="text-sm text-stone-500">
          Find more resources and community support.
        </p>
      </div>
    </div>
  )
}
