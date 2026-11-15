// apps/web/src/app/(admin)/moderation/admin-tab-url.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure `?tab=` logic shared by the admin shell (/moderation) and the organization admin page
// (/moderation/org/<id>): the open tab lives in the URL so a reload, a bookmark or a shared link
// lands on the same tab. Tab clicks REPLACE the current history entry (no Back-button entry per
// click); the shells read window.location in an effect (no useSearchParams, so no Suspense boundary
// is needed on these prerendered routes).
//
// A `?tab=` that names no tab of the screen (a bookmark of a removed tab such as the old Settings
// placeholder, or a typo) opens the default tab and writes one admin.deeplink.resolve row,
// { kind: 'tab', outcome: 'invalid', tab: 'unknown' } (invalidTabRow), then the param is dropped
// (withoutTabHref) so a reload does not write it again. A link that also carries `?focus=` is the
// focus gate's (admin-focus-session.ts), which writes that link's one row, so this stays silent.

import type { AdminDeeplinkRow } from './admin-focus-session'
import { hasAdminFocusParam } from './admin-focus-url'

/** The organization admin page's tabs, in tab-bar order. */
export const ORG_ADMIN_TABS = ['overview', 'events', 'profile', 'members'] as const
export type OrgAdminTab = (typeof ORG_ADMIN_TABS)[number]

/** The tab named by `?tab=` when it is one of `valid`, else null (absent / unknown). */
export function readTabParam<T extends string>(search: string, valid: readonly T[]): T | null {
  const tab = new URLSearchParams(search).get('tab')
  return tab !== null && (valid as readonly string[]).includes(tab) ? (tab as T) : null
}

/** pathname?search#hash with `tab` set, every other param (e.g. `org`) and the hash kept. */
export function tabParamHref(location: { pathname: string; search: string; hash: string }, tab: string): string {
  const params = new URLSearchParams(location.search)
  params.set('tab', tab)
  return `${location.pathname}?${params.toString()}${location.hash}`
}

/** The row the shell writes for a `?tab=` naming none of `valid`, or null (absent, valid, or a
 *  focus link, whose one row the focus gate writes). */
export function invalidTabRow(search: string, valid: readonly string[]): AdminDeeplinkRow | null {
  const tab = new URLSearchParams(search).get('tab')
  if (tab === null || valid.includes(tab) || hasAdminFocusParam(search)) return null
  return { kind: 'tab', outcome: 'invalid', tab: 'unknown' }
}

/** pathname?search#hash with `tab` removed; every other param and the hash kept. */
export function withoutTabHref(location: { pathname: string; search: string; hash: string }): string {
  const params = new URLSearchParams(location.search)
  params.delete('tab')
  const query = params.toString()
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`
}
