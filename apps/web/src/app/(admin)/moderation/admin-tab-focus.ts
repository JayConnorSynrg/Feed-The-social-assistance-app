// apps/web/src/app/(admin)/moderation/admin-tab-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The admin side of "Edit in admin" for places: a followed link
// (/moderation?tab=manage&focus=resource:<uuid>, /moderation?tab=businesses&focus=business:<uuid>,
// built by lib/admin-url.ts) opens that exact item in its tab. Pure logic, no React:
//
//  1. decideTabFocus — whose link is this? A tab owns a focus only when the URL's `tab` is that tab;
//     a `focus` that is present but malformed (or names another kind) is 'invalid'.
//  2. AdminTabFocusSession — the one-shot lifecycle the tab's hook forwards to: arrive (read the URL
//     once) → ready (the tab knows whether this viewer may edit here, and can read the item) →
//     found | not_found | forbidden; 'invalid' at arrival; 'abandoned' when the tab unmounts first.
//     Every followed link settles exactly once: one admin.deeplink.resolve row, the focus param
//     stripped from the URL (so a reload does not reopen it), and a notice for the misses.
//  3. hiddenTabFocus — the link names a tab this viewer's tier does not show (the tab never mounts,
//     so it cannot answer): AdminFocusTabGate settles it as 'forbidden'.
//
// Organizations need none of this: the platform-admin link uses the shell's existing ?org= panel and
// the organization-admin link the organization's own admin page.

import { visibleTabs } from './admin-shell-tabs'
import { hasAdminFocusParam, readAdminFocus, stripAdminFocusHref, type AdminFocus } from './admin-focus-url'
import type { AdminTier } from '@/lib/admin-tier'

/** The tabs that open a place by `?focus=`, and the one kind each accepts. */
export const PLACE_FOCUS_TABS = { manage: 'resource', businesses: 'business' } as const
export type PlaceFocusTab = keyof typeof PLACE_FOCUS_TABS
export type PlaceFocusKind = (typeof PLACE_FOCUS_TABS)[PlaceFocusTab]

export type AdminFocusOutcome = 'found' | 'not_found' | 'forbidden' | 'invalid' | 'abandoned'
/** What the tab tells the admin when the link did not open an item. */
export type AdminFocusNotice = 'not_found' | 'forbidden' | 'invalid'

export type TabFocusDecision = { type: 'none' } | { type: 'invalid' } | { type: 'focus'; focus: AdminFocus }

function isPlaceFocusTab(tab: string | null): tab is PlaceFocusTab {
  return tab === 'manage' || tab === 'businesses'
}

/**
 * Whether `search` is a link for `tab`: 'none' when the URL names another tab or carries no `focus`;
 * 'invalid' when `focus` is present but malformed, repeated, or of another kind; else the item.
 */
export function decideTabFocus(search: string, tab: PlaceFocusTab): TabFocusDecision {
  const params = new URLSearchParams(search)
  if (params.get('tab') !== tab || !hasAdminFocusParam(params)) return { type: 'none' }
  const focus = readAdminFocus(params)
  if (!focus || focus.kind !== PLACE_FOCUS_TABS[tab]) return { type: 'invalid' }
  return { type: 'focus', focus }
}

/**
 * A place link whose tab this viewer's tier does not show (Manage and Businesses: resource admin and
 * up), so no tab will ever read it: the tab and kind to report as 'forbidden', else null.
 */
export function hiddenTabFocus(search: string, tier: AdminTier | null): { tab: PlaceFocusTab; kind: PlaceFocusKind } | null {
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  if (!isPlaceFocusTab(tab) || !hasAdminFocusParam(params)) return null
  // Neither tab depends on the organization-admin axis, so isOrgAdmin does not change the answer.
  if (visibleTabs(tier, false).includes(tab)) return null
  return { tab, kind: PLACE_FOCUS_TABS[tab] }
}

/** Remove `focus` from the address bar in place (no history entry), keeping tab and everything else. */
export function stripFocusFromLocation(win: {
  location: { pathname: string; search: string; hash: string }
  history: { state: unknown; replaceState: (data: unknown, unused: string, url: string) => void }
}): void {
  if (!hasAdminFocusParam(win.location.search)) return
  win.history.replaceState(win.history.state, '', stripAdminFocusHref(win.location))
}

export interface AdminTabFocusDeps {
  tab: PlaceFocusTab
  /** One admin.deeplink.resolve row (kind, outcome, tab — never the id). */
  log: (attrs: { kind: PlaceFocusKind; outcome: AdminFocusOutcome; tab: PlaceFocusTab }) => void
  /** Drop `focus` from the URL. */
  strip: () => void
  /** Show the admin why nothing opened. */
  onNotice: (notice: AdminFocusNotice) => void
}

/** What the tab supplies once it can answer: the by-id read and how to open the item. */
export interface AdminTabFocusOpen<T> {
  /** The item when this screen can edit it, else null (a failed read counts as null). */
  read: (id: string, signal: AbortSignal) => Promise<T | null>
  /** Open the item for editing (the dialog, or the row in edit mode). */
  onFound: (item: T) => void
}

type State = 'idle' | 'waiting' | 'reading' | 'settled'

/**
 * One tab's handling of one followed link. The tab's hook forwards to it: arrive (mount), ready
 * (the tab can decide), unmount / remount. arrive acts once per tab instance; every accepted link is
 * settled exactly once; a read result that arrives after the link settled does nothing. An unmount
 * is confirmed a tick later, so a StrictMode unmount + remount keeps the link.
 */
export class AdminTabFocusSession<T> {
  private state: State = 'idle'
  private focus: AdminFocus | null = null
  private abort: AbortController | null = null
  private mounted = true

  constructor(private readonly deps: AdminTabFocusDeps) {}

  /** Read the URL once. */
  arrive(search: string): void {
    if (this.state !== 'idle') return
    const decision = decideTabFocus(search, this.deps.tab)
    if (decision.type === 'none') {
      this.state = 'settled'
    } else if (decision.type === 'invalid') {
      this.state = 'waiting'
      this.settle('invalid')
    } else {
      this.focus = decision.focus
      this.state = 'waiting'
    }
  }

  /** The tab can answer: 'forbidden' when this viewer may not edit here, else read the item. */
  ready(access: 'allowed' | 'forbidden', open: AdminTabFocusOpen<T>): void {
    if (this.state !== 'waiting' || !this.focus) return
    if (access === 'forbidden') {
      this.settle('forbidden')
      return
    }
    this.state = 'reading'
    const abort = new AbortController()
    this.abort = abort
    const settleRead = (item: T | null) => {
      if (this.state !== 'reading' || this.abort !== abort) return
      if (item === null) {
        this.settle('not_found')
        return
      }
      this.settle('found')
      open.onFound(item)
    }
    open.read(this.focus.id, abort.signal).then(settleRead, () => settleRead(null))
  }

  unmount(): void {
    this.mounted = false
    setTimeout(() => {
      if (!this.mounted && (this.state === 'waiting' || this.state === 'reading')) this.settle('abandoned')
    }, 0)
  }

  remount(): void {
    this.mounted = true
  }

  private settle(outcome: AdminFocusOutcome): void {
    this.state = 'settled'
    this.abort?.abort()
    this.deps.log({ kind: PLACE_FOCUS_TABS[this.deps.tab], outcome, tab: this.deps.tab })
    this.deps.strip()
    if (outcome === 'not_found' || outcome === 'forbidden' || outcome === 'invalid') this.deps.onNotice(outcome)
  }
}

/** The plain line each miss shows (the Manage and Businesses tabs are English). */
export const ADMIN_FOCUS_NOTICE_TEXT: Record<AdminFocusNotice, Record<PlaceFocusKind, string>> = {
  not_found: {
    resource: "That resource couldn't be found, or it isn't editable here (only approved resources are listed in Manage).",
    business: "That business couldn't be found, or it isn't editable here (only approved businesses can be edited).",
  },
  forbidden: {
    resource: "Your admin role can't edit resources.",
    business: 'Only platform admins can edit businesses.',
  },
  invalid: {
    resource: "That link doesn't name a resource, so nothing was opened.",
    business: "That link doesn't name a business, so nothing was opened.",
  },
}
