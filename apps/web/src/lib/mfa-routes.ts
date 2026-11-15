/**
 * mfa-routes.ts — which request paths require an AAL2 (MFA-verified) session.
 *
 * Only admin surfaces do: the (admin) route group (/moderation and the platform-only
 * /federation/* console) and the admin API (/api/admin/*). Members use the SPA at `/`
 * and every other route at AAL1, with or without an enrolled factor.
 *
 * /federation/directory is the member-facing public directory (app/federation/directory,
 * outside the (admin) group), so the federation console is listed by segment, not by
 * the bare /federation prefix.
 *
 * Matching is per path segment: a listed route matches itself and its descendants
 * (`/moderation`, `/moderation/org/123`), never a sibling that shares a prefix.
 */
export const MFA_REQUIRED_ROUTES = [
  '/moderation',
  '/federation/conflicts',
  '/federation/dashboard',
  '/federation/discover',
  '/federation/search-analytics',
  '/federation/sync',
  '/federation/sync-config',
  '/api/admin',
] as const

/** Exact-match only: the (admin) federation index page, not the public /federation/directory. */
const MFA_REQUIRED_EXACT = ['/federation'] as const

export function requiresMfa(pathname: string): boolean {
  if ((MFA_REQUIRED_EXACT as readonly string[]).includes(pathname)) return true
  return MFA_REQUIRED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}
