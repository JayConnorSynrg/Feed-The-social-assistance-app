// apps/web/src/lib/appreciation.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Unit tests for the pure appreciation helpers (item list + shelf aggregation).

import { describe, it, expect } from 'vitest'
import {
  APPRECIATION_ITEMS,
  APPRECIATION_SLUGS,
  isAppreciationSlug,
  aggregateShelf,
} from './appreciation'

describe('APPRECIATION_ITEMS', () => {
  it('is exactly the 12 canonical slugs, matching the migration CHECK', () => {
    expect(APPRECIATION_ITEMS).toHaveLength(12)
    expect(APPRECIATION_SLUGS).toEqual([
      'heart', 'smile', 'cheer', 'flower', 'sunflower', 'leaf',
      'bread', 'apple', 'soup', 'sun', 'seedling', 'tree',
    ])
  })

  it('has a unique slug + non-empty label + alt for every item', () => {
    const slugs = new Set(APPRECIATION_ITEMS.map((i) => i.slug))
    expect(slugs.size).toBe(12)
    for (const i of APPRECIATION_ITEMS) {
      expect(i.label.length).toBeGreaterThan(0)
      expect(i.alt.length).toBeGreaterThan(0)
    }
  })

  it('isAppreciationSlug accepts known slugs and rejects unknown', () => {
    expect(isAppreciationSlug('heart')).toBe(true)
    expect(isAppreciationSlug('tree')).toBe(true)
    expect(isAppreciationSlug('banana')).toBe(false)
    expect(isAppreciationSlug('')).toBe(false)
  })
})

describe('aggregateShelf', () => {
  const g = (id: string, name: string) => ({ id, first_name: name, avatar_url: null })

  it('groups by item, counts per item, and lists givers most-recent-first', () => {
    const rows = [
      { item: 'heart', created_at: '2026-01-01T00:00:00Z', giver: g('a', 'Ada') },
      { item: 'heart', created_at: '2026-01-03T00:00:00Z', giver: g('b', 'Ben') },
      { item: 'apple', created_at: '2026-01-02T00:00:00Z', giver: g('c', 'Cy') },
    ]
    const shelf = aggregateShelf(rows)
    // Two distinct items; heart (count 2) ranks before apple (count 1).
    expect(shelf.map((e) => e.slug)).toEqual(['heart', 'apple'])
    const heart = shelf.find((e) => e.slug === 'heart')!
    // MUTATION-PROOF ANCHOR: count is the number of gift rows for the item (each gift counts).
    expect(heart.count).toBe(2)
    // Ben's gift is later than Ada's → Ben leads the giver list (most-recent-first).
    expect(heart.givers.map((x) => x.name)).toEqual(['Ben', 'Ada'])
    expect(shelf.find((e) => e.slug === 'apple')!.count).toBe(1)
  })

  it('skips unknown item slugs (a future item never renders unlabelled)', () => {
    const rows = [
      { item: 'heart', created_at: '2026-01-01T00:00:00Z', giver: g('a', 'Ada') },
      { item: 'diamond', created_at: '2026-01-02T00:00:00Z', giver: g('b', 'Ben') },
    ]
    const shelf = aggregateShelf(rows)
    expect(shelf.map((e) => e.slug)).toEqual(['heart'])
  })

  it('falls back to "Someone" when a giver name is missing', () => {
    const rows = [{ item: 'heart', created_at: '2026-01-01T00:00:00Z', giver: null }]
    const shelf = aggregateShelf(rows)
    expect(shelf[0].givers[0].name).toBe('Someone')
  })

  it('returns [] for no rows (genuine empty shelf)', () => {
    expect(aggregateShelf([])).toEqual([])
  })
})
