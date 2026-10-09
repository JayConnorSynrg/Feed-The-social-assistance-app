'use client'

// apps/web/src/components/admin/admin-edit-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Edit in admin": the one link a member surface (map popup, /s page, feed card) shows an admin so
// they can open that exact item in the admin screen. The mirror of member-view-link.tsx.
//   - Renders NOTHING unless canEditInAdmin (lib/admin-editability.ts) says this viewer may edit this
//     item there — so members, logged-out visitors and guests never see it, and neither does anyone
//     while the admin lookup is loading or after it failed.
//   - href from adminEditUrl (lib/admin-url.ts); opens in ONE reused tab named "feed-admin".
//   - Every click or auxclick (middle-button) activation persists one admin.nav.edit_in_admin row
//     (kind + source only — no ids, no names). A context-menu "Open in new tab" fires neither.
//   - Accessible name: "<visible label>: <item name> <opens in the admin tab>" (starts with the visible
//     text, WCAG 2.5.3). lime-800 text and focus ring: 5.6:1 on stone-200, 6.5:1 on stone-100, 7.1:1
//     on white (lime-600 is 2.8:1 on stone-100). min 24×24 target.
// The viewer lookup is shared page-wide (hooks/use-admin-viewer.ts): any number of links cost one
// tier lookup, plus one organization-list lookup only for organization / event links of a viewer
// who is not a platform admin.
//
// Extra props (role, tabIndex, handlers, lang/dir) are forwarded to the <a>.

import type { AnchorHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import type { Locale } from '@/lib/i18n'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { logEvent } from '@/lib/logger'
import { adminEditUrl, type AdminEditKind, type AdminEditTarget } from '@/lib/admin-url'
import { canEditInAdmin, needsAdminOrgIds } from '@/lib/admin-editability'
import { isUuid } from '@/lib/org-admin-paths'
import { useAdminViewer } from '@/hooks/use-admin-viewer'

/** The member surface an "Edit in admin" link sits on (the `source` label of admin.nav.edit_in_admin).
 *  Adding a surface: add its name here in the PR that renders the link there. */
export type AdminEditSource =
  | 'map_popup'
  | 'resource_page'
  | 'business_page'
  | 'organization_page'
  | 'post_page'
  | 'feed_post'
  | 'feed_event'

/** The named browsing context every "Edit in admin" link reuses. */
export const FEED_ADMIN_TARGET = 'feed-admin'

export const ADMIN_EDIT_LINK_CLASS =
  'inline-flex min-h-6 min-w-6 items-center gap-1 rounded-sm text-xs font-medium text-lime-800 underline underline-offset-2 ' +
  'hover:text-lime-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-800 focus-visible:ring-offset-1'

export interface AdminEditLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'children'> {
  /** The item, as an admin edit target (an event carries its org_id). */
  target: AdminEditTarget
  /** The item's name for assistive tech ("Edit in admin: Riverside Pantry …"). */
  itemName: string
  source: AdminEditSource
  locale?: Locale
  icon?: ReactNode
  ref?: Ref<HTMLAnchorElement>
}

function logEditInAdmin(kind: AdminEditKind, source: AdminEditSource) {
  logEvent('admin.nav.edit_in_admin', { kind, source })
}

/** True when every id the URL carries is a UUID (anything else renders no link). */
function hasValidIds(target: AdminEditTarget): boolean {
  return isUuid(target.id) && (target.kind !== 'event' || isUuid(target.orgId))
}

export function AdminEditLink({
  target,
  itemName,
  source,
  locale = 'en',
  icon,
  className,
  onClick,
  onAuxClick,
  ref,
  ...rest
}: AdminEditLinkProps) {
  const viewer = useAdminViewer(needsAdminOrgIds(target.kind))
  if (!hasValidIds(target) || !canEditInAdmin(target, viewer)) return null

  const label = adminNavT(locale, 'editInAdmin')
  const notice = adminNavT(locale, 'opensInAdminTab')
  const name = itemName.trim()
  return (
    // target names one reused tab. No rel="noopener"/"noreferrer": either one makes every click open a
    // NEW tab instead of reusing "feed-admin". The admin screen is same-origin FEED, so the opener
    // reference gives it nothing it could not already reach.
    <a
      {...rest}
      ref={ref}
      href={adminEditUrl(target, viewer.tier)}
      target={FEED_ADMIN_TARGET}
      aria-label={name ? `${label}: ${name} ${notice}` : `${label} ${notice}`}
      className={className ?? ADMIN_EDIT_LINK_CLASS}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        // Logged before the browser hands off to the admin tab; logEvent's keepalive request survives.
        logEditInAdmin(target.kind, source)
      }}
      onAuxClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onAuxClick?.(e)
        // A middle click opens the link without a click event — still exactly one row.
        if (e.button === 1) logEditInAdmin(target.kind, source)
      }}
    >
      {icon}
      {label}
    </a>
  )
}
