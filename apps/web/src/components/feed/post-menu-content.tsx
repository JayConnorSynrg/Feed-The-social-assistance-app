// apps/web/src/components/feed/post-menu-content.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The CONTENT of a post card's ⋯ menu as Release 1's shared menu sections
// (components/feed/card-actions-menu.tsx CardMenuSection). Which items a viewer gets is
// post-actions.ts postMenuItems (pure, tested); this adds the translated labels, the icons, the
// destructive flag (Delete / Remove), the stable test ids post-menu-<item>-<postId> and the item →
// handler wiring. "Edit in admin" is a 'link' item: the caller passes the existing PostAdminEditLink
// element (source 'feed_post_menu'), which keeps its href, target and accessible name; Radix gives it
// role="menuitem" through Slot.

import type { ReactElement } from 'react'
import { Clock, Flag, Link as LinkIcon, Pencil, PauseCircle, RotateCcw, Trash2, UserPlus, XCircle, ExternalLink } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { menuItemLabel } from '@/lib/i18n-feed-card'
import type { CardMenuItem, CardMenuSection } from './card-actions-menu'
import type { PostMenuGroup, PostMenuItem, PostMenuItemId } from './post-actions'

const GROUP_ORDER: readonly PostMenuGroup[] = ['main', 'destructive', 'moderation']

const ICONS: Record<Exclude<PostMenuItemId, 'edit_in_admin'>, typeof Pencil> = {
  edit: Pencil,
  history: Clock,
  copy_link: LinkIcon,
  report: Flag,
  signup_to_report: UserPlus,
  delete: Trash2,
  hold: PauseCircle,
  remove: XCircle,
  restore: RotateCcw,
}

export { ExternalLink as AdminLinkIcon }

export function buildPostMenuSections(
  items: readonly PostMenuItem[],
  opts: { locale: Locale; onSelect: (id: PostMenuItemId) => void; adminLink: ReactElement | null },
): CardMenuSection[] {
  return GROUP_ORDER.map((group) => ({
    id: group,
    items: items
      .filter((i) => i.group === group)
      .flatMap((i): CardMenuItem[] => {
        if (i.id === 'edit_in_admin') return opts.adminLink ? [{ kind: 'link', id: 'edit_in_admin', element: opts.adminLink }] : []
        const Icon = ICONS[i.id]
        return [
          {
            kind: 'action',
            id: i.id,
            label: menuItemLabel(i.id, opts.locale),
            icon: <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />,
            onSelect: () => opts.onSelect(i.id),
            destructive: i.id === 'delete' || i.id === 'remove' ? true : undefined,
            testId: i.testId,
          },
        ]
      }),
  })).filter((s) => s.items.length > 0)
}
