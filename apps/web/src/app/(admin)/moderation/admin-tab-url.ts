// apps/web/src/app/(admin)/moderation/admin-tab-url.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure `?tab=` logic shared by the admin shell (/moderation) and the organization admin page
// (/moderation/org/<id>): the open tab lives in the URL so a reload, a bookmark or a shared link
// lands on the same tab. Tab clicks REPLACE the current history entry (no Back-button entry per
// click); the shells read window.location in an effect (no useSearchParams, so no Suspense boundary
// is needed on these prerendered routes).

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
