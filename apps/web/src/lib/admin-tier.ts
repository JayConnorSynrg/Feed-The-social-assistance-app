// apps/web/src/lib/admin-tier.ts
// Pure, dependency-free tier logic shared by the client gating, the People tab, and the
// ban/delete routes. The database (migration 20261010000000) is the authoritative gate; these
// functions mirror admin_set_tier / the ban-delete T3 so the UI shows only what the server allows.
//
// Tiers: community_moderator (CM) < resource_admin (RA) < platform_admin (PA). NULL = no tier.

export type AdminTier = 'community_moderator' | 'resource_admin' | 'platform_admin'

export const ADMIN_TIERS: AdminTier[] = ['community_moderator', 'resource_admin', 'platform_admin']

// Public marker labels (T4). Kept intentionally short — shown on feed cards and profiles.
const TIER_LABELS: Record<AdminTier, string> = {
  community_moderator: 'Moderator',
  resource_admin: 'Resource Admin',
  platform_admin: 'Admin',
}

/** Public marker label for a tier, or null for a plain user. */
export function tierLabel(tier: AdminTier | null | undefined): string | null {
  return tier ? TIER_LABELS[tier] : null
}

/** Ordinal rank; NULL (no tier) is lowest (0). */
export function tierRank(tier: AdminTier | null | undefined): number {
  switch (tier) {
    case 'platform_admin':
      return 3
    case 'resource_admin':
      return 2
    case 'community_moderator':
      return 1
    default:
      return 0
  }
}

/** True when `tier` is at least `min` (NULL never meets any tier). */
export function tierAtLeast(
  tier: AdminTier | null | undefined,
  min: AdminTier,
): boolean {
  return tierRank(tier) >= tierRank(min)
}

export type GrantOption = { value: AdminTier | null; label: string }

/**
 * The tier changes an actor may apply to a target, mirroring admin_set_tier exactly:
 *  - anything touching PA is founder-only;
 *  - otherwise the actor must strictly outrank BOTH the target's current tier and the new tier;
 *  - no-op (candidate === target's current tier) is excluded.
 * `null` in the returned value means "revoke" (set tier to none).
 * Returns [] for CM and plain users (they may grant nothing).
 */
export function grantableTiers(
  actorTier: AdminTier | null | undefined,
  isFounder: boolean,
  targetTier: AdminTier | null | undefined,
): GrantOption[] {
  const actorRank = tierRank(actorTier)
  const options: GrantOption[] = []
  // Candidate set: each real tier, plus revoke (null).
  const candidates: (AdminTier | null)[] = [...ADMIN_TIERS, null]
  for (const candidate of candidates) {
    if ((candidate ?? null) === (targetTier ?? null)) continue // no-op
    const touchesPA = candidate === 'platform_admin' || targetTier === 'platform_admin'
    let allowed: boolean
    if (touchesPA) {
      allowed = isFounder
    } else {
      allowed = actorRank > Math.max(tierRank(targetTier), tierRank(candidate))
    }
    if (allowed) {
      options.push({
        value: candidate,
        label: candidate ? `Make ${tierLabel(candidate)}` : 'Revoke tier',
      })
    }
  }
  return options
}

export type UserActionDecision = { allowed: boolean; code?: 'insufficient_tier' | 'self' | 'target_tier' }

/**
 * T3 for ban / delete (PA-only, cannot target an equal-or-higher tier or self). Mirrors the
 * DB/route gate so the button can be disabled and the denial reason surfaced.
 */
export function decideUserAction(
  actorTier: AdminTier | null | undefined,
  targetTier: AdminTier | null | undefined,
  actorId: string,
  targetId: string,
): UserActionDecision {
  if (actorTier !== 'platform_admin') return { allowed: false, code: 'insufficient_tier' }
  if (actorId === targetId) return { allowed: false, code: 'self' }
  if (tierRank(targetTier) >= tierRank('platform_admin')) return { allowed: false, code: 'target_tier' }
  return { allowed: true }
}
