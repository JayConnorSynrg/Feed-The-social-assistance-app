'use client'

// apps/web/src/components/feed/post-card-actions.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// INTEGRATION POINT for the post card's ⋯ menu. The accessible menu-button primitive
// (components/feed/card-actions-menu.tsx, Radix DropdownMenu) ships with Release 1; until it is on
// this branch this component renders nothing, so the card header is unchanged and the build stays
// green. Everything behind the menu is already wired: the item list (post-actions.ts postMenuItems),
// the item labels (lib/i18n-feed-card.ts menuItemLabel), and every item's behaviour through
// `onSelect(itemId, trigger)` in FeedPanel (edit / history / delete dialogs, report, copy link,
// moderation, the create-account prompt), each returning focus to `trigger`.
//
// When Release 1 lands, this component renders
//   <CardActionsMenu sections={buildPostMenuSections(items, { locale, onSelect, adminLink })}
//     triggerLabel={cardT(locale, 'menuTriggerAria')} testId={postMenuTriggerTestId(postId)} triggerRef={…} />
// (post-menu-content.ts already returns Release 1's CardMenuSection shape: translated labels, the
// destructive flag on Delete / Remove, item test ids post-menu-<item>-<postId>), where adminLink is the
// existing PostAdminEditLink (same href, target="feed-admin", no rel) with source 'feed_post_menu'
// (added to AdminEditSource + docs/observability.md), keeping "(opens in the admin tab)" in its name.
// Then POST_MENU_RENDERS turns true: the card's footer "Edit in admin" link and Report button leave.

import type { Locale } from '@/lib/i18n'
import type { PostMenuItem, PostMenuItemId } from './post-actions'

export interface PostCardActionsProps {
  postId: string
  items: readonly PostMenuItem[]
  locale: Locale
  /** Run an item; `trigger` is the menu button focus returns to. */
  onSelect: (id: PostMenuItemId, trigger: HTMLElement | null) => void
  /** Post text / author / time: the "Edit in admin" item's accessible name. */
  adminItem: { content: string; author: string; createdAt: Date }
}

/** True while the menu primitive is not on this branch: the card keeps its footer actions. */
export const POST_MENU_RENDERS = false

export function PostCardActions(props: PostCardActionsProps): null {
  void props
  return null
}
