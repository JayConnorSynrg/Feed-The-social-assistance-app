// apps/web/src/app/(admin)/moderation/admin-shell-tabs.ts
// Pure tier -> visible admin-shell tabs mapping (P3.1). No React, so it is unit-testable.
//
// Tiers: community_moderator (CM) < resource_admin (RA) < platform_admin (PA). ORG is the
// org-admin axis, orthogonal to the tiers. Per the P3.1 design §5:
//   CM        -> Moderation only
//   RA        -> + Resources / Manage / People (Discover + form approval stay PA-only, inside Resources)
//   PA        -> all tabs
//   ORG (no tier) -> Events only

import { tierAtLeast, type AdminTier } from '@/lib/admin-tier'

// Canonical left-to-right order of the tab bar (also the set of tab ids `?tab=` may name).
export const TAB_ORDER = [
  'overview',
  'events',
  'moderation',
  'community',
  'organizations',
  'resources',
  'businesses',
  'manage',
  'people',
  'settings',
] as const

export type AdminTabId = (typeof TAB_ORDER)[number]

export function visibleTabs(tier: AdminTier | null, isOrgAdmin: boolean): AdminTabId[] {
  const isPA = tier === 'platform_admin'
  const isRA = tierAtLeast(tier, 'resource_admin')
  const isCM = tierAtLeast(tier, 'community_moderator')

  const rule: Record<AdminTabId, boolean> = {
    overview: isPA,
    events: isPA || isOrgAdmin,
    moderation: isCM,
    community: isPA,
    organizations: isPA,
    resources: isRA,
    businesses: isRA,
    manage: isRA,
    people: isRA,
    settings: isPA,
  }

  return TAB_ORDER.filter((t) => rule[t])
}

/**
 * The tab the shell shows for a requested tab id: the request when this viewer is entitled to it,
 * otherwise the first entitled tab ('events' while the tier is still loading and nothing is entitled).
 * A `?tab=` deep link goes through this too, so a URL can never open a tab the tier does not grant.
 */
export function resolveAdminTab(requested: string, allowed: readonly AdminTabId[]): AdminTabId {
  return (allowed as readonly string[]).includes(requested) ? (requested as AdminTabId) : (allowed[0] ?? 'events')
}
