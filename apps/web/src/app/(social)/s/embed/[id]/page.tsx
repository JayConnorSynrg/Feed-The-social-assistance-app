/**
 * Public embeddable widget — /s/embed/[id]
 *
 * Rendered inside a 3rd-party iframe. Anon SSR: reads posts + resource or petition.
 * No app shell, no nav. Actions link out to the FEED app (target="_top").
 *
 * Supports two post types:
 *   - resource_post / feed: opt-in widget (original behaviour)
 *   - petition: shows petition title, count, and "Sign on FEED" CTA
 *
 * generateMetadata: per-post og:title/description/image/url + oEmbed discovery link.
 */
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'
import { ogLocaleForLang } from '@/lib/og-locale'
import { ogCardAlt, postCardKind } from '@/lib/og-card-kinds'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * The one read of the embedded post. React `cache` keys it by id for the length of a request, so
 * generateMetadata and the widget below send one identical query and share one database round trip.
 * Explicit column list (never select('*') on posts); author columns are the two the metadata needs.
 */
const readEmbedPost = cache(async (id: string) => {
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('posts')
    // Use explicit FK hint to avoid PGRST201 ambiguity (posts has 2 FK paths to profiles)
    .select('id, content, lang, slots_remaining, max_seekers, post_type, petition_id, user:profiles!posts_user_id_fkey(first_name, username), resource:resources(name)')
    .eq('id', id)
    .eq('is_hidden', false)
    .single()
  return post
})

/** The one read of an approved petition (title and summary for the metadata, the rest for the widget). */
const readApprovedPetition = cache(async (petitionId: string) => {
  const supabase = await createClient()
  const { data: petition } = await supabase
    .from('petitions')
    .select('id, title, summary, target_signatures')
    .eq('id', petitionId)
    .eq('status', 'approved')
    .single()
  return petition
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const appUrl = await getAppUrlFromHeaders()
  const post = await readEmbedPost(id)

  if (!post) {
    return { title: 'Post Not Found - FEED' }
  }

  const postType = (post.post_type as string | null) ?? 'feed'
  const petitionId = (post as { petition_id?: string | null }).petition_id ?? null
  const user = post.user as { first_name: string | null; username: string | null } | null
  const authorName = user?.first_name || 'Community Member'

  // For petitions, prefer the petition title as the og title if available
  let title = `${authorName} on FEED`
  let rawDescription = post.content

  if (postType === 'petition' && petitionId) {
    const petition = await readApprovedPetition(petitionId)

    if (petition?.title) {
      title = `${petition.title} — FEED Community Petition`
    }
    if (petition?.summary) {
      rawDescription = petition.summary
    }
  }

  const description = rawDescription.length > 160
    ? rawDescription.slice(0, 157) + '...'
    : rawDescription

  const canonicalUrl = `${appUrl}/s/embed/${id}`
  const oEmbedUrl = `${appUrl}/api/oembed?url=${encodeURIComponent(canonicalUrl)}`
  // og:locale from the post's own language; left out when the post has none or no valid value exists.
  const ogLocale = ogLocaleForLang(post.lang)
  // The preview picture is the fixed card for the post's type; its description says what the card
  // shows (og:image:alt and twitter:image:alt), never the post's text or author.
  const imageAlt = ogCardAlt(postCardKind(postType))

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'FEED',
      url: canonicalUrl,
      ...(ogLocale ? { locale: ogLocale } : {}),
      images: [
        {
          url: `${appUrl}/api/og/post/${id}`,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: `${appUrl}/api/og/post/${id}`, alt: imageAlt }],
    },
    alternates: {
      types: {
        'application/json+oembed': oEmbedUrl,
      },
    },
  }
}

export default async function EmbedWidgetPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const appUrl = await getAppUrlFromHeaders()

  const post = await readEmbedPost(id)

  if (!post) notFound()

  // Language of member text. The page itself is lang="en", and text with no lang attribute inherits
  // that, so every piece of member text says what it is:
  //   - the post's own text carries posts.lang — the author's app language when they posted, the best
  //     signal there is, not a detected language — or lang="" (unknown) when the post has none;
  //   - a petition's title and summary and a resource's name are not the post's text and have no
  //     recorded language, so they carry lang="" (unknown).
  // All of it takes its direction from its own first strong character (dir="auto").
  const postLang = post.lang ?? ''

  const postType = (post.post_type as string | null) ?? 'feed'
  const petitionId = (post as { petition_id?: string | null }).petition_id ?? null

  // ── Petition branch ──────────────────────────────────────────────────────
  if (postType === 'petition' && petitionId) {
    const petition = await readApprovedPetition(petitionId)

    const { data: countData } = await supabase
      .rpc('get_petition_signature_count', { p_petition_id: petitionId })

    const signatureCount = (countData as number | null) ?? 0
    const targetSignatures = petition?.target_signatures ?? 0
    const hasTarget = targetSignatures > 0
    const pct = hasTarget ? Math.min(100, Math.round((signatureCount / targetSignatures) * 100)) : 0

    return (
      <div
        data-testid="embed-widget"
        className="p-3 rounded-xl border border-lime-200 bg-lime-50 font-sans text-sm"
      >
        {/* Label */}
        <p className="text-xs font-semibold text-lime-700 uppercase tracking-wide mb-1">
          Community Petition
        </p>

        {/* Title */}
        <p
          className="text-stone-900 font-semibold leading-snug line-clamp-2 mb-1"
          lang={petition?.title ? '' : postLang}
          dir="auto"
        >
          {petition?.title ?? post.content}
        </p>

        {/* Summary */}
        {petition?.summary && (
          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed mb-2" lang="" dir="auto">
            {petition.summary}
          </p>
        )}

        {/* Signature count */}
        <p className="text-xs text-stone-600 mb-1">
          <span className="font-semibold text-stone-800">{signatureCount.toLocaleString()}</span>
          {hasTarget && <> of {targetSignatures.toLocaleString()} signatures &mdash; {pct}%</>}
          {!hasTarget && <> verified signatures</>}
        </p>

        {/* Progress bar */}
        {hasTarget && (
          <div className="w-full bg-lime-200 rounded-full h-1 mb-2">
            <div className="bg-lime-600 h-1 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* CTA: links to FEED app petitions panel */}
        <a
          data-testid="embed-petition-sign-btn"
          href={`${appUrl}/#petitions`}
          target="_top"
          rel="noopener"
          className="inline-block rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-700 transition-colors"
        >
          Sign on FEED
        </a>

        <p className="mt-2 text-[10px] text-stone-400">
          Powered by FEED · Mutual Aid Resource Sharing
        </p>
      </div>
    )
  }

  // ── Resource / feed post branch (original) ───────────────────────────────
  const resource = (post.resource as { name: string } | null)

  const isFull =
    post.max_seekers != null &&
    post.slots_remaining != null &&
    post.slots_remaining <= 0

  const isUnlimited = post.max_seekers == null

  return (
    <div
      data-testid="embed-widget"
      className="p-3 rounded-xl border border-stone-200 bg-white font-sans text-sm"
    >
      {/* Resource label */}
      {resource?.name && (
        <p className="text-xs font-semibold text-lime-700 uppercase tracking-wide mb-1" lang="" dir="auto">
          {resource.name}
        </p>
      )}

      {/* Post content */}
      <p className="text-stone-800 leading-snug line-clamp-3 mb-2" lang={postLang} dir="auto">
        {post.content}
      </p>

      {/* Slot count */}
      {!isUnlimited && (
        <p
          data-testid="embed-slot-count"
          className={`text-xs mb-2 font-medium ${isFull ? 'text-red-600' : 'text-stone-500'}`}
        >
          {isFull
            ? 'Full'
            : `${post.slots_remaining} of ${post.max_seekers} spot${post.max_seekers === 1 ? '' : 's'} left`}
        </p>
      )}

      {/* Opt-In / Full button */}
      {isFull ? (
        <span
          data-testid="embed-full"
          className="inline-block rounded-lg bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-400 cursor-not-allowed"
        >
          Full
        </span>
      ) : (
        <a
          data-testid="embed-opt-in-btn"
          href={`${appUrl}/s/post/${id}`}
          target="_top"
          rel="noopener"
          className="inline-block rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-700 transition-colors"
        >
          Opt In on FEED
        </a>
      )}

      {/* Branding */}
      <p className="mt-2 text-[10px] text-stone-400">
        Powered by FEED · Mutual Aid Resource Sharing
      </p>
    </div>
  )
}
