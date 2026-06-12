import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Heart, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const appUrl = await getAppUrlFromHeaders()

  const { data: post } = await supabase
    .from('posts')
    .select('*, user:profiles(first_name, username)')
    .eq('id', id)
    .eq('is_hidden', false)
    .single()

  if (!post) {
    return { title: 'Post Not Found - FEED' }
  }

  const user = post.user as { first_name: string | null; username: string | null } | null
  const authorName = user?.first_name || 'Community Member'
  const description = post.content.length > 160
    ? post.content.slice(0, 157) + '...'
    : post.content

  const canonicalUrl = `${appUrl}/s/post/${id}`
  const oEmbedUrl = `${appUrl}/api/oembed?url=${encodeURIComponent(`${appUrl}/s/embed/${id}`)}`

  return {
    title: `${authorName} on FEED`,
    description,
    openGraph: {
      title: `${authorName} on FEED`,
      description,
      type: 'article',
      siteName: 'FEED',
      url: canonicalUrl,
      images: [
        {
          url: `${appUrl}/api/og/post/${id}`,
          width: 1200,
          height: 630,
          alt: `Post by ${authorName}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${authorName} on FEED`,
      description,
      images: [`${appUrl}/api/og/post/${id}`],
    },
    alternates: {
      types: {
        'application/json+oembed': oEmbedUrl,
      },
    },
  }
}

export default async function SharedPostPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch post with safe public author columns only (PII hardening: no venmo/paypal in FK join)
  const { data: post } = await supabase
    .from('posts')
    .select('*, user:profiles(id, first_name, username, avatar_url)')
    .eq('id', id)
    .eq('is_hidden', false)
    .single()

  if (!post) notFound()

  const user = post.user as {
    id: string
    first_name: string | null
    username: string | null
    avatar_url: string | null
  } | null

  // Fetch donation handles via SECURITY DEFINER RPC — isolated column access
  const [
    { count: likeCount },
    { count: commentCount },
    handlesResult,
  ] = await Promise.all([
    supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', id),
    supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', id),
    user?.id
      ? supabase.rpc('get_donation_handles', { target_id: user.id })
      : Promise.resolve({ data: [] }),
  ])

  const handles = Array.isArray(handlesResult.data) && handlesResult.data.length > 0
    ? handlesResult.data[0] as { paypal_email: string | null; venmo_username: string | null }
    : { paypal_email: null, venmo_username: null }

  const displayName = user?.first_name || 'Community Member'
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const hasPayment = handles.venmo_username || handles.paypal_email

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-stone-800">FEED</h1>
          <p className="text-xs text-stone-500">Mutual Aid Resource Sharing</p>
        </div>
      </div>

      {/* Post Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {/* Author header */}
        <div className="flex items-center gap-3 p-4 pb-2">
          {user?.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={displayName}
              width={44}
              height={44}
              className="rounded-full"
            />
          ) : (
            <div className="h-11 w-11 rounded-full bg-lime-600 flex items-center justify-center text-white font-semibold">
              {initials}
            </div>
          )}
          <div>
            <p className="font-semibold text-stone-800">{displayName}</p>
            {user?.username && (
              <p className="text-sm text-stone-500">@{user.username}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="relative aspect-video">
            <Image
              src={post.image_url}
              alt="Post image"
              fill
              className="object-cover"
              sizes="(max-width: 672px) 100vw, 672px"
            />
          </div>
        )}

        {/* Engagement stats */}
        <div className="flex items-center gap-6 px-4 py-3 border-t border-stone-100 text-stone-500 text-sm">
          <span className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" />
            {likeCount || 0} {likeCount === 1 ? 'like' : 'likes'}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {commentCount || 0} {commentCount === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </div>

      {/* Support section */}
      {hasPayment && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-stone-800">Support {displayName}</h2>
          <p className="text-sm text-stone-500">Send direct support through their preferred payment method.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {handles.venmo_username && (
              <a
                href={`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handles.venmo_username)}`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#008CFF] px-4 py-3 text-white font-medium hover:bg-[#0070cc] transition-colors"
              >
                Venmo @{handles.venmo_username}
              </a>
            )}
            {handles.paypal_email && (
              <a
                href={`https://paypal.me/${encodeURIComponent(handles.paypal_email)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0070BA] px-4 py-3 text-white font-medium hover:bg-[#005ea6] transition-colors"
              >
                PayPal
              </a>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center space-y-3 py-4">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-lime-600 px-8 py-3 text-white font-semibold hover:bg-lime-700 transition-colors"
        >
          Join FEED
        </a>
        <p className="text-sm text-stone-500">
          Find resources, share help, build community.
        </p>
      </div>
    </div>
  )
}
