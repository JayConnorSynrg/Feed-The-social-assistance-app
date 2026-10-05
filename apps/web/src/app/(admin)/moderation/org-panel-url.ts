// apps/web/src/app/(admin)/moderation/org-panel-url.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure URL logic for the admin organization panel: `?tab=organizations&org=new|<uuid>` deep-links
// the panel, opening it pushes that entry, closing it pops (or replaces) the entry, and the phone
// Back button closes the panel. The shell reads window.location directly (no useSearchParams).

export type OrgPanelTarget = 'new' | string

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The panel target in a query string, or null (absent / malformed). */
export function readOrgPanelTarget(search: string): OrgPanelTarget | null {
  const params = new URLSearchParams(search)
  const org = params.get('org')
  if (!org) return null
  if (org === 'new') return 'new'
  return UUID_RE.test(org) ? org.toLowerCase() : null
}

/** True when the query string names the Organizations tab. */
export function readsOrganizationsTab(search: string): boolean {
  return new URLSearchParams(search).get('tab') === 'organizations'
}

/** pathname?search#hash with the panel params set (target) or the org param removed (null). */
export function orgPanelHref(
  location: { pathname: string; search: string; hash: string },
  target: OrgPanelTarget | null
): string {
  const params = new URLSearchParams(location.search)
  if (target === null) {
    params.delete('org')
  } else {
    params.set('tab', 'organizations')
    params.set('org', target)
  }
  const qs = params.toString()
  return `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`
}

/**
 * How closing the panel restores the URL:
 *  - 'back'    the panel pushed its own history entry -> pop it (Back lands where the admin was)
 *  - 'replace' the panel was deep-linked -> strip `org` in place (no entry to pop)
 *  - 'none'    the close came FROM a popstate -> the browser already moved the URL
 */
export function closeUrlAction(pushedEntry: boolean, viaPopstate: boolean): 'back' | 'replace' | 'none' {
  if (viaPopstate) return 'none'
  return pushedEntry ? 'back' : 'replace'
}
