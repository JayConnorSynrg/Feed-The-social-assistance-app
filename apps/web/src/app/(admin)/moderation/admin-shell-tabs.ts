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

// Canonical left-to-right order of the tab bar.
const TAB_ORDER = [
  'overview',
  'events',
  'moderation',
  'community',
  'organizations',
  'resources',
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
    manage: isRA,
    people: isRA,
    settings: isPA,
  }

  return TAB_ORDER.filter((t) => rule[t])
}
