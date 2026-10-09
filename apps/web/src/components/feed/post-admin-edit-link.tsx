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

/** The post's accessible name in the link: the start of its text. */
export function postAdminItemName(content: string | null | undefined): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

export function PostAdminEditLink({
  postId,
  content,
  source,
  locale = 'en',
}: {
  postId: string
  content: string | null | undefined
  source: Extract<AdminEditSource, 'feed_post' | 'post_page'>
  locale?: Locale
}) {
  return (
    <ClientAdminEditLink
      target={{ kind: 'post', id: postId }}
      itemName={postAdminItemName(content)}
      source={source}
      locale={locale}
      data-testid={`admin-edit-post-${postId}`}
    />
  )
}
