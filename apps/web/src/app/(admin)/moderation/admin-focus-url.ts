// apps/web/src/app/(admin)/moderation/admin-focus-url.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure `?focus=<kind>:<uuid>` logic for the admin screens an "Edit in admin" link opens (built by
// lib/admin-url.ts). The admin shell (/moderation) and the organization admin page
// (/moderation/org/<id>) read the item to open with readAdminFocus, emit admin.deeplink.resolve once,
// then drop the param with stripAdminFocusHref (history.replaceState) so a reload does not open it
// again. Organizations use `?org=` (readOrgPanelTarget in org-panel-url.ts), not `focus`.

import { ADMIN_FOCUS_KINDS, type AdminFocusKind } from '@/lib/admin-url'
import { isUuid } from '@/lib/org-admin-paths'

export interface AdminFocus {
  kind: AdminFocusKind
  /** Lower-cased, the form Postgres prints. */
  id: string
}

function toParams(search: string | URLSearchParams): URLSearchParams {
  return typeof search === 'string' ? new URLSearchParams(search) : search
}

/**
 * The item a query string names, or null when there is none or it is malformed (unknown kind, not a
 * UUID, a repeated `focus`). Use hasAdminFocusParam to tell "none" from "malformed" (outcome invalid).
 */
export function readAdminFocus(search: string | URLSearchParams): AdminFocus | null {
  const values = toParams(search).getAll('focus')
  if (values.length !== 1) return null
  const value = values[0]
  const sep = value.indexOf(':')
  if (sep < 0) return null
  const kind = value.slice(0, sep)
  const id = value.slice(sep + 1)
  if (!(ADMIN_FOCUS_KINDS as readonly string[]).includes(kind) || !isUuid(id)) return null
  return { kind: kind as AdminFocusKind, id: id.toLowerCase() }
}

/** True when the query string carries a `focus` param at all (valid or not). */
export function hasAdminFocusParam(search: string | URLSearchParams): boolean {
  return toParams(search).has('focus')
}

/** pathname?search#hash with `focus` removed; every other param (tab, org) and the hash kept. */
export function stripAdminFocusHref(location: { pathname: string; search: string; hash: string }): string {
  const params = new URLSearchParams(location.search)
  params.delete('focus')
  const qs = params.toString()
  return `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`
}
