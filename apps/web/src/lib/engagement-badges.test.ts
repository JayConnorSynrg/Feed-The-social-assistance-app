// apps/web/src/lib/engagement-badges.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Unit tests for the badge_summary -> UI display mapping (pure function).

import { describe, it, expect } from 'vitest'
import {
  summaryToBadgeList,
  hasNoBadges,
  levelLabel,
  topBadgesByLevel,
  COMMUNITY_META,
  type BadgeSummary,
} from './engagement-badges'

describe('summaryToBadgeList', () => {
  it('returns [] for null / undefined / empty summary (empty state)', () => {
    expect(summaryToBadgeList(null)).toEqual([])
    expect(summaryToBadgeList(undefined)).toEqual([])
    expect(summaryToBadgeList({})).toEqual([])
    expect(summaryToBadgeList({ families: {}, badges: {} })).toEqual([])
    expect(hasNoBadges(null)).toBe(true)
    expect(hasNoBadges({ families: { food: { count: 5, level: 1 } } })).toBe(false)
  })

  it('maps families and community badges with label, color, and icon', () => {
    const summary: BadgeSummary = {
      families: { food: { count: 12, level: 2 } },
      badges: { helper: { count: 4, level: 1 } },
    }
    const list = summaryToBadgeList(summary)
    expect(list).toHaveLength(2)

    const food = list.find((b) => b.key === 'food')!
    expect(food.group).toBe('family')
    expect(food.label).toBe('Food')
    expect(food.level).toBe(2)
    expect(food.count).toBe(12)
    expect(food.colorHex).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(food.iconName).toBe('Apple')

    const helper = list.find((b) => b.key === 'helper')!
    expect(helper.group).toBe('community')
    expect(helper.label).toBe('Helper')
    expect(helper.iconName).toBe('HandHeart')
  })

  it('omits level-0 dimensions (never-earned)', () => {
    const summary: BadgeSummary = {
      families: { food: { count: 2, level: 0 }, housing: { count: 10, level: 2 } },
      badges: { voice: { count: 0, level: 0 } },
    }
    const list = summaryToBadgeList(summary)
    expect(list.map((b) => b.key)).toEqual(['housing'])
  })

  it('ignores unknown dimension keys (forward-compatible, no blank badges)', () => {
    const summary = {
      families: { unknownfam: { count: 99, level: 3 } },
      badges: { appreciation: { count: 5, level: 2 } }, // reserved P2.1b kind, no meta yet
    } as unknown as BadgeSummary
    expect(summaryToBadgeList(summary)).toEqual([])
  })

  it('sorts families before community, then by level desc, count desc, label', () => {
    const summary: BadgeSummary = {
      families: {
        food: { count: 5, level: 1 },
        housing: { count: 30, level: 3 },
        health: { count: 12, level: 2 },
      },
      badges: {
        helper: { count: 3, level: 1 },
        voice: { count: 26, level: 3 },
      },
    }
    const order = summaryToBadgeList(summary).map((b) => `${b.group}:${b.key}`)
    expect(order).toEqual([
      'family:housing', // level 3
      'family:health', // level 2
      'family:food', // level 1
      'community:voice', // level 3
      'community:helper', // level 1
    ])
  })

  it('breaks a level tie by count desc', () => {
    const summary: BadgeSummary = {
      families: {
        food: { count: 5, level: 1 },
        housing: { count: 9, level: 1 },
      },
    }
    expect(summaryToBadgeList(summary).map((b) => b.key)).toEqual(['housing', 'food'])
  })
})

describe('summaryToBadgeList — public and private summaries map identically', () => {
  it('maps a PUBLIC summary — LEVELS ONLY, no counts (privacy floor)', () => {
    const pub: BadgeSummary = {
      families: { food: { level: 2 } },
      badges: { helper: { level: 1 }, voice: { level: 3 } },
    }
    const list = summaryToBadgeList(pub)
    expect(list.map((b) => `${b.group}:${b.key}`)).toEqual([
      'family:food',
      'community:voice',
      'community:helper',
    ])
    // public badges carry no count
    expect(list.every((b) => b.count === undefined)).toBe(true)
  })

  it('maps a PRIVATE summary WITH counts using the same pure mapper', () => {
    const priv: BadgeSummary = {
      families: { housing: { count: 10, level: 2 } }, // receiving help / saves
      badges: { advocate: { count: 5, level: 1 }, watcher: { count: 3, level: 1 } }, // petition + alert-verify (both private)
    }
    const list = summaryToBadgeList(priv)
    expect(list).toHaveLength(3)
    const advocate = list.find((b) => b.key === 'advocate')!
    expect(advocate.label).toBe('Advocate')
    expect(advocate.iconName).toBe('Megaphone')
    expect(advocate.count).toBe(5)
    const watcher = list.find((b) => b.key === 'watcher')!
    expect(watcher.label).toBe('Watcher')
    expect(watcher.count).toBe(3)
    const housing = list.find((b) => b.key === 'housing')!
    expect(housing.level).toBe(2)
    expect(housing.count).toBe(10)
  })

  it('an empty private summary yields no badges (empty private section)', () => {
    expect(summaryToBadgeList({ families: {}, badges: {} })).toEqual([])
  })
})

describe('levelLabel', () => {
  it('maps 1/2/3 to roman numerals', () => {
    expect(levelLabel(1)).toBe('I')
    expect(levelLabel(2)).toBe('II')
    expect(levelLabel(3)).toBe('III')
  })
})

describe('appreciated community badge (P2.1b)', () => {
  it('the "appreciated" key is a known community badge, so it is NOT dropped', () => {
    // Regression guard: summaryToBadgeList silently drops keys absent from COMMUNITY_META.
    expect(COMMUNITY_META.appreciated).toBeDefined()
    const list = summaryToBadgeList({ badges: { appreciated: { level: 2 } } })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ group: 'community', key: 'appreciated', level: 2 })
  })
})

describe('topBadgesByLevel (author-row strip)', () => {
  const summary: BadgeSummary = {
    families: { food: { level: 1 }, housing: { level: 3 } },
    badges: { helper: { level: 2 }, appreciated: { level: 3 }, voice: { level: 1 } },
  }

  it('returns the top N purely by level desc, across family AND community groups', () => {
    const top = topBadgesByLevel(summary, 3)
    expect(top).toHaveLength(3)
    // Both level-3 badges (housing family, appreciated community) must rank above helper(2).
    expect(top.map((b) => b.level)).toEqual([3, 3, 2])
    const keys = top.map((b) => b.key)
    expect(keys).toContain('housing')
    expect(keys).toContain('appreciated')
    expect(keys).toContain('helper')
    // The level-1 badges (food, voice) must be excluded by the top-3 cut.
    expect(keys).not.toContain('food')
    expect(keys).not.toContain('voice')
  })

  it('returns [] for an empty/missing summary and respects the limit', () => {
    expect(topBadgesByLevel(null)).toEqual([])
    expect(topBadgesByLevel(summary, 0)).toEqual([])
    expect(topBadgesByLevel(summary, 1)).toHaveLength(1)
    expect(topBadgesByLevel(summary, 1)[0].level).toBe(3)
  })
})
