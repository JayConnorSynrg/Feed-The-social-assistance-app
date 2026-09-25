// apps/web/src/lib/admin-tier.test.ts
// Unit tests for the pure tier logic that mirrors the DB gates (migration 20261010000000).
import { describe, it, expect } from 'vitest'
import {
  tierLabel,
  tierRank,
  tierAtLeast,
  grantableTiers,
  decideUserAction,
  type AdminTier,
} from './admin-tier'

const CM: AdminTier = 'community_moderator'
const RA: AdminTier = 'resource_admin'
const PA: AdminTier = 'platform_admin'

describe('tierLabel', () => {
  it('maps each tier to its public marker', () => {
    expect(tierLabel(CM)).toBe('Moderator')
    expect(tierLabel(RA)).toBe('Resource Admin')
    expect(tierLabel(PA)).toBe('Admin')
    expect(tierLabel(null)).toBeNull()
    expect(tierLabel(undefined)).toBeNull()
  })
})

describe('tierRank / tierAtLeast (full 4x4)', () => {
  const tiers: (AdminTier | null)[] = [null, CM, RA, PA]
  it('ranks NULL lowest, PA highest', () => {
    expect([null, CM, RA, PA].map(tierRank)).toEqual([0, 1, 2, 3])
  })
  it('tierAtLeast holds iff rank(tier) >= rank(min)', () => {
    for (const t of tiers) {
      for (const m of [CM, RA, PA] as AdminTier[]) {
        expect(tierAtLeast(t, m)).toBe(tierRank(t) >= tierRank(m))
      }
    }
    expect(tierAtLeast(null, CM)).toBe(false)
    expect(tierAtLeast(CM, CM)).toBe(true)
    expect(tierAtLeast(PA, CM)).toBe(true)
    expect(tierAtLeast(RA, PA)).toBe(false)
  })
})

describe('grantableTiers (mirrors admin_set_tier)', () => {
  const vals = (actor: AdminTier | null, founder: boolean, target: AdminTier | null) =>
    grantableTiers(actor, founder, target).map((o) => o.value)

  it('CM and plain users may grant nothing', () => {
    expect(vals(CM, false, null)).toEqual([])
    expect(vals(CM, false, CM)).toEqual([])
    expect(vals(null, false, null)).toEqual([])
  })

  it('RA may only make/revoke CM', () => {
    expect(vals(RA, false, null)).toEqual([CM])          // grant CM
    expect(vals(RA, false, CM)).toEqual([null])           // revoke CM
    expect(vals(RA, false, RA)).toEqual([])               // cannot touch equal
    expect(vals(RA, false, PA)).toEqual([])               // cannot touch PA
  })

  it('PA (non-founder) manages CM/RA but never PA', () => {
    expect(vals(PA, false, null)).toEqual([CM, RA])
    expect(vals(PA, false, CM)).toEqual([RA, null])
    expect(vals(PA, false, RA)).toEqual([CM, null])
    expect(vals(PA, false, PA)).toEqual([])               // cannot revoke another PA
  })

  it('founder may also grant/revoke PA', () => {
    expect(vals(PA, true, null)).toEqual([CM, RA, PA])
    expect(vals(PA, true, PA)).toEqual([CM, RA, null])    // demote or revoke a PA
  })

  it('never offers a no-op (candidate === current tier)', () => {
    for (const t of [null, CM, RA, PA] as (AdminTier | null)[]) {
      expect(grantableTiers(PA, true, t).map((o) => o.value)).not.toContain(t)
    }
  })
})

describe('decideUserAction (ban/delete T3)', () => {
  it('denies non-PA actors', () => {
    expect(decideUserAction(RA, CM, 'a', 'b')).toEqual({ allowed: false, code: 'insufficient_tier' })
    expect(decideUserAction(null, null, 'a', 'b')).toEqual({ allowed: false, code: 'insufficient_tier' })
  })
  it('denies self-target', () => {
    expect(decideUserAction(PA, null, 'a', 'a')).toEqual({ allowed: false, code: 'self' })
  })
  it('denies acting on an equal-or-higher tier (another PA)', () => {
    expect(decideUserAction(PA, PA, 'a', 'b')).toEqual({ allowed: false, code: 'target_tier' })
  })
  it('allows a PA acting on CM/RA/plain', () => {
    expect(decideUserAction(PA, null, 'a', 'b')).toEqual({ allowed: true })
    expect(decideUserAction(PA, CM, 'a', 'b')).toEqual({ allowed: true })
    expect(decideUserAction(PA, RA, 'a', 'b')).toEqual({ allowed: true })
  })
})
