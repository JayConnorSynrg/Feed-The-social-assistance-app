'use client'

// apps/web/src/components/feed/post-card-actions.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The post card's ⋯ menu: Release 1's accessible menu button (components/feed/card-actions-menu.tsx,
// Radix DropdownMenu — menu-button pattern, roving focus, Escape back to the trigger) filled with this
// viewer's items (post-actions.ts postMenuItems → post-menu-content.tsx). Choosing an item calls
// `onSelect(id, trigger)`; FeedPanel runs it (edit / history / delete dialogs, report, copy link,
// moderation, the create-account prompt) and returns focus to `trigger`.
//
// "Edit in admin" is a link item: the same PostAdminEditLink (ClientAdminEditLink → canEditInAdmin,
// adminEditUrl, target="feed-admin", no rel, one admin.nav.edit_in_admin per click) with source
// 'feed_post_menu'; Radix makes it role="menuitem" and returns focus to the trigger on close; its
// accessible name ends "(opens in the admin tab)". Nothing renders before hydration (the viewer's
// items depend on the signed-in session), the same rule as the event card menu.

import type { Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n-event-forms'
import { cardT } from '@/lib/i18n-feed-card'
import { useHydrated } from '@/components/admin/client-admin-edit-link'
import { CardActionsMenu } from './card-actions-menu'
import { PostAdminEditLink } from './post-admin-edit-link'
import { AdminLinkIcon, buildPostMenuSections } from './post-menu-content'
import { postMenuTriggerTestId, type PostMenuItem, type PostMenuItemId } from './post-actions'

export interface PostCardActionsProps {
  postId: string
  items: readonly PostMenuItem[]
  locale: Locale
  /** Run an item; `trigger` is the menu button focus returns to. */
  onSelect: (id: PostMenuItemId, trigger: HTMLElement | null) => void
  /** Post text / author / time: the trigger's and "Edit in admin" item's accessible names. */
  adminItem: { content: string; author: string; createdAt: Date }
}

export function PostCardActions({ postId, items, locale, onSelect, adminItem }: PostCardActionsProps) {
  const hydrated = useHydrated()
  if (!hydrated) return null
  // Focus returns to this card's trigger, found when an item is chosen (never read during render).
  const testId = postMenuTriggerTestId(postId)
  const select = (id: PostMenuItemId) =>
    onSelect(id, document.querySelector<HTMLElement>(`[data-testid="${CSS.escape(testId)}"]`))
  const sections = buildPostMenuSections(items, {
    locale,
    onSelect: select,
    adminLink: items.some((i) => i.id === 'edit_in_admin') ? (
      <PostAdminEditLink
        postId={postId}
        content={adminItem.content}
        author={adminItem.author}
        createdAt={adminItem.createdAt}
        source="feed_post_menu"
        locale={locale}
        icon={<AdminLinkIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
      />
    ) : null,
  })
  return (
    <CardActionsMenu
      sections={sections}
      triggerLabel={formatMessage(cardT(locale, 'menuTriggerAria'), { name: adminItem.author })}
      locale={locale}
      testId={testId}
    />
  )
}
