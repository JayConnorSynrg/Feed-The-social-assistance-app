'use client'

// apps/web/src/components/admin/member-view-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one "View …" control admin rows use to open an item exactly as members see it. Given the
// item's member target and its member visibility (lib/member-visibility.ts) it renders EITHER a link
// to the member page OR the reason members cannot see it — never a link to a page that 404s for
// members, never nothing. Every link opens in one reused named tab ("feed-preview"), so repeated
// clicks refresh the same preview instead of piling up tabs. Each click persists one
// admin.nav.member_view row (kind + source only — no ids, no names).
//
// Extra props (role, tabIndex, ref, handlers) are forwarded to the <a>, so a Radix menu item can
// wrap it with asChild.

import { useId, type AnchorHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from 'react'
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
  | 'businesses'
  | 'orgs_section'
  | 'org_admin_profile'
  | 'people'

/** The named browsing context every member view reuses. */
export const FEED_PREVIEW_TARGET = 'feed-preview'

const LINK_CLASS =
  'inline-flex min-h-6 min-w-6 items-center gap-1 rounded-sm text-xs font-medium text-lime-800 underline-offset-2 hover:underline ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-1'
const REASON_CLASS = 'inline-flex min-h-6 items-center text-xs text-stone-500'

export interface MemberViewLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'children'> {
  /** The item, as a member URL target. */
  to: MemberItemTarget
  visibility: MemberVisibility
  /** Visible, verb-first label ("View post", "View public page", "View profile"). */
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
  const noticeId = useId()

  if (!visibility.visible) {
    return (
      <span lang={rest.lang} dir={rest.dir} className={reasonClassName ?? REASON_CLASS}>
        {memberReasonText(locale, visibility.reason)}
      </span>
    )
  }

  const name = itemName.trim()
  return (
    // target names one reused tab. No rel="noopener"/"noreferrer": either one makes every click open a
    // NEW tab instead of reusing "feed-preview". The page is same-origin FEED, so the opener reference
    // gives it nothing it could not already reach — there is no cross-site opener exposure here.
    <a
      {...rest}
      ref={ref}
      href={memberUrl(to)}
      target={FEED_PREVIEW_TARGET}
      aria-label={name ? `${label}: ${name}` : label}
      aria-describedby={noticeId}
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
      <span id={noticeId} className="sr-only">
        {` ${adminNavT(locale, 'opensInPreviewTab')}`}
      </span>
    </a>
  )
}
