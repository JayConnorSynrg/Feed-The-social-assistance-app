// apps/web/src/components/feed/post-menu-content.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The CONTENT of a post card's ⋯ menu, in the shape of Release 1's shared menu primitive
// (components/feed/card-actions-menu.tsx: CardMenuSection { id, items: CardMenuItem[] }, items of
// kind 'action' | 'link'). The types below are structurally that API, so post-card-actions.tsx hands
// these sections to <CardActionsMenu> unchanged once the primitive is on this branch.
//
// Which items a viewer gets is post-actions.ts postMenuItems (pure, tested); this adds the
// translated labels, the destructive flag, the stable test ids and the item → handler wiring.
// "Edit in admin" is a 'link' item: the caller passes the existing PostAdminEditLink element
// (source 'feed_post_menu'), which keeps its href, target and accessible name.

import type { ReactElement } from 'react'
import type { Locale } from '@/lib/i18n'
import { menuItemLabel } from '@/lib/i18n-feed-card'
import type { PostMenuGroup, PostMenuItem, PostMenuItemId } from './post-actions'

export type PostMenuEntry =
  | { kind: 'action'; id: PostMenuItemId; label: string; onSelect: () => void; destructive?: boolean; testId: string }
  | { kind: 'link'; id: 'edit_in_admin'; element: ReactElement }

export interface PostMenuSection {
  id: PostMenuGroup
  items: readonly PostMenuEntry[]
}

const GROUP_ORDER: readonly PostMenuGroup[] = ['main', 'destructive', 'moderation']

export function buildPostMenuSections(
  items: readonly PostMenuItem[],
  opts: { locale: Locale; onSelect: (id: PostMenuItemId) => void; adminLink: ReactElement | null },
): PostMenuSection[] {
  return GROUP_ORDER.map((group) => ({
    id: group,
    items: items
      .filter((i) => i.group === group)
      .flatMap((i): PostMenuEntry[] => {
        if (i.id === 'edit_in_admin') return opts.adminLink ? [{ kind: 'link', id: 'edit_in_admin', element: opts.adminLink }] : []
        return [
          {
            kind: 'action',
            id: i.id,
            label: menuItemLabel(i.id, opts.locale),
            onSelect: () => opts.onSelect(i.id),
            destructive: i.id === 'delete' || i.id === 'remove' ? true : undefined,
            testId: i.testId,
          },
        ]
      }),
  })).filter((s) => s.items.length > 0)
}
