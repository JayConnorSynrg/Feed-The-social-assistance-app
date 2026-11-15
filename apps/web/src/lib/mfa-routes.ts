/**
 * mfa-routes.ts — which request paths require an AAL2 (MFA-verified) session.
 *
 * Only admin surfaces do:
 *   - the (admin) route group: /moderation and the platform-only /federation/* console;
 *   - /federation/directory (app/federation/directory, outside the group, but its page sends
 *     non-admins to / after an is_current_user_admin check), so all of /federation is admin;
 *   - admin-only APIs: /api/admin/* (tier-gated) and /api/community-summary
 *     (is_current_user_admin, 403 otherwise).
 * Members use the SPA at `/` and every other route at AAL1, with or without an enrolled factor.
 * proxy.mfa.test.ts classifies every page and route on disk from its gate, so a new admin-only
 * surface that is missing here fails that test.
 *
 * Matching is per path segment: a listed route matches itself and its descendants
 * (`/moderation`, `/moderation/org/123`), never a sibling that shares a prefix.
 */
export const MFA_REQUIRED_ROUTES = [
  '/moderation',
  '/federation',
  '/api/admin',
  '/api/community-summary',
] as const

export function requiresMfa(pathname: string): boolean {
  return MFA_REQUIRED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}
