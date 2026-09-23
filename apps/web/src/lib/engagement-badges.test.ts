// apps/web/src/lib/engagement-badges.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Unit tests for the badge_summary -> UI display mapping (pure function).

import { describe, it, expect } from 'vitest'
import {
  summaryToBadgeList,
  hasNoBadges,
  levelLabel,
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
  it('maps a PUBLIC summary (helping + public actions)', () => {
    const pub: BadgeSummary = {
      families: { food: { count: 12, level: 2 } },
      badges: { helper: { count: 4, level: 1 }, voice: { count: 30, level: 3 } },
    }
    const list = summaryToBadgeList(pub)
    expect(list.map((b) => `${b.group}:${b.key}`)).toEqual([
      'family:food',
      'community:voice',
      'community:helper',
    ])
  })

  it('maps a PRIVATE summary (receiving help, saves, advocacy) with the same pure mapper', () => {
    const priv: BadgeSummary = {
      families: { housing: { count: 10, level: 2 } }, // receiving help / saves
      badges: { advocate: { count: 5, level: 1 } }, // petition signatures (private)
    }
    const list = summaryToBadgeList(priv)
    expect(list).toHaveLength(2)
    const advocate = list.find((b) => b.key === 'advocate')!
    expect(advocate.group).toBe('community')
    expect(advocate.label).toBe('Advocate')
    expect(advocate.iconName).toBe('Megaphone')
    const housing = list.find((b) => b.key === 'housing')!
    expect(housing.label).toBe('Housing')
    expect(housing.level).toBe(2)
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
