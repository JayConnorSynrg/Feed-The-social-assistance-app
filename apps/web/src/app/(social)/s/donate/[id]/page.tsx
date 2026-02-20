import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', id)
    .single()

  const name = profile?.full_name || 'a community member'

  return {
    title: `Support ${name} - FEED`,
    description: `Send direct support to ${name} through FEED's mutual aid platform.`,
    openGraph: {
      title: `Support ${name} on FEED`,
      description: `Send direct support to ${name} through FEED's mutual aid platform.`,
      siteName: 'FEED',
    },
    twitter: {
      card: 'summary',
      title: `Support ${name} on FEED`,
      description: `Send direct support to ${name} through FEED's mutual aid platform.`,
    },
  }
}

export default async function DonatePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, bio, venmo_username, paypal_email')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const hasPayment = profile.venmo_username || profile.paypal_email
  if (!hasPayment) notFound()

  const displayName = profile.full_name || 'Community Member'
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-500">Mutual Aid</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 text-center space-y-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={displayName}
            width={80}
            height={80}
            className="rounded-full mx-auto"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-lime-600 flex items-center justify-center text-white text-2xl font-bold mx-auto">
            {initials}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-stone-800">{displayName}</h2>
          {profile.username && (
            <p className="text-stone-500">@{profile.username}</p>
          )}
        </div>
        {profile.bio && (
          <p className="text-stone-600 text-sm max-w-md mx-auto">{profile.bio}</p>
        )}
      </div>

      {/* Payment buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 space-y-4">
        <h3 className="text-lg font-semibold text-stone-800 text-center">
          Support {displayName}
        </h3>
        <p className="text-sm text-stone-500 text-center">
          Send direct support through their preferred payment method.
        </p>
        <div className="space-y-3">
          {profile.venmo_username && (
            <a
              href={`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(profile.venmo_username)}`}
              className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#008CFF] px-6 py-4 text-white text-lg font-semibold hover:bg-[#0070cc] transition-colors"
            >
              Send via Venmo
              <span className="text-sm font-normal opacity-80">
                @{profile.venmo_username}
              </span>
            </a>
          )}
          {profile.paypal_email && (
            <a
              href={`https://paypal.me/${encodeURIComponent(profile.paypal_email)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#0070BA] px-6 py-4 text-white text-lg font-semibold hover:bg-[#005ea6] transition-colors"
            >
              Send via PayPal
            </a>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 py-4">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-lime-600 px-8 py-3 text-white font-semibold hover:bg-lime-700 transition-colors"
        >
          Download FEED
        </a>
        <p className="text-sm text-stone-500">
          Join the community. Share resources. Build mutual aid.
        </p>
      </div>
    </div>
  )
}
