// apps/web/src/lib/org-admin-paths.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// URLs of the organization admin page. The page itself (app/(admin)/moderation/org/[id]) decides
// access with can_admin_org; these helpers only build the links that lead there.

import type { AdminTier } from './admin-tier'

/** The list of organizations the signed-in user administers (redirects when there is exactly one). */
export const ORG_ADMIN_INDEX = '/moderation/org'

/** The admin page of one organization. */
export function orgAdminHref(orgId: string): string {
  return `${ORG_ADMIN_INDEX}/${encodeURIComponent(orgId)}`
}

/**
 * Where the Settings "Administration" entry leads: any admin tier keeps the moderation dashboard;
 * an organization admin with no tier goes to their organization admin page(s).
 */
export function adminEntryHref(tier: AdminTier | null | undefined): string {
  return tier ? '/moderation' : ORG_ADMIN_INDEX
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a canonical UUID string (the only shape an organization id takes). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
