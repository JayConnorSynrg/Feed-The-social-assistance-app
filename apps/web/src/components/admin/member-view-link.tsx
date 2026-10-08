'use client'

// apps/web/src/components/admin/member-view-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one "View …" control admin rows use to open an item exactly as members see it. Given the
// item's member target and its member visibility (lib/member-visibility.ts) it renders EITHER a link
// to the member page OR the reason members cannot see it — never a link to a page that 404s for
// members, never nothing. Every link opens in one reused named tab ("feed-preview"), so repeated
// clicks refresh the same preview instead of piling up tabs. Every click or auxclick (middle-button)
// activation persists one admin.nav.member_view row (kind + source only — no ids, no names). A
// context-menu "Open in new tab" fires neither event, so it writes no row.
// The accessible name is "<visible label>: <item name> <opens in the feed preview tab>" — it starts
// with the visible text (WCAG 2.5.3) and carries the new-tab notice in the name itself, which screen
// readers announce in every mode (a description is skipped in browse mode).
//
// Extra props (role, tabIndex, ref, handlers) are forwarded to the <a>, so a Radix menu item can
// wrap it with asChild.

import type { AnchorHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import type { Locale } from '@/lib/i18n'
import { adminNavT, memberReasonText } from '@/lib/i18n-admin-nav'
import { logEvent } from '@/lib/logger'
import { memberUrl, type MemberItemKind, type MemberItemTarget } from '@/lib/member-url'
import type { MemberVisibility } from '@/lib/member-visibility'

/** The admin surface a "View …" link sits on (the `source` label of admin.nav.member_view). */
export type MemberViewSource =
  | 'reports_queue'
  | 'held_posts'
  | 'manage_resources'
  | 'resources_queue'
  | 'businesses'
  | 'orgs_section'
  | 'org_admin_profile'

/** The named browsing context every member view reuses. */
export const FEED_PREVIEW_TARGET = 'feed-preview'

const LINK_CLASS =
  'inline-flex min-h-6 min-w-6 items-center gap-1 rounded-sm text-xs font-medium text-lime-800 underline-offset-2 hover:underline ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-1'
// stone-600: 7.0:1 on stone-100 and white (stone-500 is 4.4:1 on stone-100 — below 1.4.3).
const REASON_CLASS = 'inline-flex min-h-6 items-center text-xs text-stone-600'

export interface MemberViewLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'children'> {
  /** The item, as a member URL target. */
  to: MemberItemTarget
  visibility: MemberVisibility
  /** Visible, verb-first label ("View post", "View public page"). */
  label: string
  /** The item's name for assistive tech ("View public page: Riverside Pantry"). */
  itemName: string
  source: MemberViewSource
  locale?: Locale
  icon?: ReactNode
  reasonClassName?: string
  ref?: Ref<HTMLAnchorElement>
}

function logMemberView(kind: MemberItemKind, source: MemberViewSource) {
  logEvent('admin.nav.member_view', { kind, source, view: 'page' })
}

export function MemberViewLink({
  to,
  visibility,
  label,
  itemName,
  source,
  locale = 'en',
  icon,
  className,
  reasonClassName,
  onClick,
  onAuxClick,
  ref,
  ...rest
}: MemberViewLinkProps) {
  if (!visibility.visible) {
    return (
      <span lang={rest.lang} dir={rest.dir} className={reasonClassName ?? REASON_CLASS}>
        {memberReasonText(locale, visibility.reason)}
      </span>
    )
  }

  const name = itemName.trim()
  const notice = adminNavT(locale, 'opensInPreviewTab')
  return (
    // target names one reused tab. No rel="noopener"/"noreferrer": either one makes every click open a
    // NEW tab instead of reusing "feed-preview". The page is same-origin FEED, so the opener reference
    // gives it nothing it could not already reach — there is no cross-site opener exposure here.
    <a
      {...rest}
      ref={ref}
      href={memberUrl(to)}
      target={FEED_PREVIEW_TARGET}
      aria-label={name ? `${label}: ${name} ${notice}` : `${label} ${notice}`}
      className={className ?? LINK_CLASS}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        // Logged before the browser hands off to the preview tab; logEvent's keepalive request
        // survives the navigation.
        logMemberView(to.kind, source)
      }}
      onAuxClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onAuxClick?.(e)
        // A middle click opens the link without a click event — still exactly one row.
        if (e.button === 1) logMemberView(to.kind, source)
      }}
    >
      {icon}
      {label}
    </a>
  )
}
