/**
 * Public embeddable opt-in widget — /s/embed/[id]
 *
 * Rendered inside a 3rd-party iframe. Anon SSR: reads posts + approved resource
 * name. No app shell, no nav. Opt-In pops out to the FEED app (target="_top").
 */
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EmbedWidgetPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const appUrl = await getAppUrlFromHeaders()

  const { data: post } = await supabase
    .from('posts')
    .select('id, content, slots_remaining, max_seekers, resource:resources(name)')
    .eq('id', id)
    .eq('is_hidden', false)
    .single()

  if (!post) notFound()

  const resource = post.resource as { name: string } | null

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
        <p className="text-xs font-semibold text-lime-700 uppercase tracking-wide mb-1">
          {resource.name}
        </p>
      )}

      {/* Post content */}
      <p className="text-stone-800 leading-snug line-clamp-3 mb-2">
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
          href={`${appUrl}/?post=${id}`}
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
