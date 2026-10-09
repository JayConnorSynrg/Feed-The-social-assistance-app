'use client'

// apps/web/src/components/feed/post-admin-edit-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Edit in admin" for one post (petitions included — a petition is a post): the feed card
// (feed-panel.tsx PostCard) and the shared page /s/post/<id> (a server component; this is its client
// island). Community moderators and up see it (canEditInAdmin 'post'); it opens the single-post
// view /moderation?tab=moderation&focus=post:<id>, which works for any post, reported or not.

import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import type { AdminEditSource } from '@/components/admin/admin-edit-link'
import type { Locale } from '@/lib/i18n'

/** The post's accessible name in the link: the start of its text; for a post with no text (an
 *  image-only post) "post by <author>, <date>". */
export function postAdminItemName(
  content: string | null | undefined,
  author?: string | null,
  createdAt?: string | Date | null
): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim()
  if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text
  const date = createdAt ? new Date(createdAt) : null
  const when = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null
  return [`post by ${author?.trim() || 'a member'}`, when].filter(Boolean).join(', ')
}

export function PostAdminEditLink({
  postId,
  content,
  author,
  createdAt,
  source,
  locale = 'en',
}: {
  postId: string
  content: string | null | undefined
  /** Author display name and post time: the link's name when the post has no text. */
  author?: string | null
  createdAt?: string | Date | null
  source: Extract<AdminEditSource, 'feed_post' | 'post_page'>
  locale?: Locale
}) {
  return (
    <ClientAdminEditLink
      target={{ kind: 'post', id: postId }}
      itemName={postAdminItemName(content, author, createdAt)}
      source={source}
      locale={locale}
      data-testid={`admin-edit-post-${postId}`}
    />
  )
}
