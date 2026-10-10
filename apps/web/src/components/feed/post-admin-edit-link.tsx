'use client'

// apps/web/src/components/feed/post-admin-edit-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Edit in admin" for one post (petitions included — a petition is a post): the feed card
// (feed-panel.tsx PostCard) and the shared page /s/post/<id> (a server component; this is its client
// island). Community moderators and up see it (canEditInAdmin 'post'); it opens the single-post
// view /moderation?tab=moderation&focus=post:<id>, which works for any post, reported or not.

import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import type { AdminEditLinkProps, AdminEditSource } from '@/components/admin/admin-edit-link'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n-event-forms'
import { cardT } from '@/lib/i18n-feed-card'
import { dateTimeFormat } from '@/lib/event-time'

/** The post's accessible name in the link: the start of its text; for a post with no text (an
 *  image-only post) "post by <author>, <date>" in the viewer's language. */
export function postAdminItemName(
  content: string | null | undefined,
  author?: string | null,
  createdAt?: string | Date | null,
  locale: Locale = 'en'
): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim()
  if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text
  const date = createdAt ? new Date(createdAt) : null
  const when = date && !Number.isNaN(date.getTime())
    ? dateTimeFormat(locale, 'UTC', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : ''
  const name = author?.trim() || cardT(locale, 'adminItemMember')
  const label = formatMessage(cardT(locale, 'adminItemFallback'), { name, date: when })
  return when ? label : label.replace(/[\s,،，፣]+$/u, '')
}

type PassThrough = Omit<AdminEditLinkProps, 'target' | 'itemName' | 'source' | 'locale' | 'icon'>

/** Extra props (the menu item's role, class, roving handlers and ref from Radix Slot) reach the <a>. */
export function PostAdminEditLink({
  postId,
  content,
  author,
  createdAt,
  source,
  locale = 'en',
  icon,
  ...rest
}: {
  postId: string
  content: string | null | undefined
  /** Author display name and post time: the link's name when the post has no text. */
  author?: string | null
  createdAt?: string | Date | null
  source: Extract<AdminEditSource, 'feed_post' | 'feed_post_menu' | 'post_page'>
  locale?: Locale
  /** Leading icon (the menu item shows one, like the other items). */
  icon?: ReactNode
} & PassThrough) {
  return (
    <ClientAdminEditLink
      data-testid={`admin-edit-post-${postId}`}
      {...rest}
      target={{ kind: 'post', id: postId }}
      itemName={postAdminItemName(content, author, createdAt, locale)}
      source={source}
      locale={locale}
      icon={icon}
    />
  )
}
