// apps/web/src/components/feed/sign-up-side-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The rules the feed keeps sign-up side data by, on their own:
//   - a read writes only the entries of the posts it asked about: a page that is added merges,
//     a first page replaces;
//   - latest started wins, per post: a response writes a post's entry only when no read that
//     asked about that post started after it — whichever response arrives last;
//   - a card that leaves drops its entry.

import { describe, it, expect } from 'vitest'
import { createReadOrder, mergeByPost, mergeMapByPost, withoutPost } from './sign-up-side-data'

const all = () => true

describe('a read writes only the posts it asked about', () => {
  const first = { p1: 2, p2: 1 }

  it('a page that is added merges: the posts of earlier pages keep their entries', () => {
    expect(mergeByPost(first, ['q1', 'q2'], { q1: 5 }, all, false)).toEqual({ p1: 2, p2: 1, q1: 5 })
  })

  it('an asked post with no entry in the answer loses the one it had (nobody is signed up any more)', () => {
    expect(mergeByPost(first, ['p1'], {}, all, false)).toEqual({ p2: 1 })
    expect(mergeByPost(first, ['p1'], { p1: 0 }, all, false)).toEqual({ p1: 0, p2: 1 })
  })

  it('a first page replaces: only the asked posts are left', () => {
    expect(mergeByPost(first, ['p2', 'p3'], { p3: 4 }, all, true)).toEqual({ p3: 4 })
    expect(mergeByPost(first, [], {}, all, true)).toEqual({})
  })

  it('a post the read does not own keeps the entry it has, merging or replacing', () => {
    const owns = (id: string) => id !== 'p1'
    expect(mergeByPost(first, ['p1', 'p2'], { p1: 9, p2: 9 }, owns, false)).toEqual({ p1: 2, p2: 9 })
    expect(mergeByPost(first, ['p1', 'p3'], { p1: 9, p3: 9 }, owns, true)).toEqual({ p1: 2, p3: 9 })
  })

  it('the previous record is never changed in place', () => {
    const prev = { p1: 2 }
    mergeByPost(prev, ['p1', 'p2'], { p2: 3 }, all, false)
    expect(prev).toEqual({ p1: 2 })
  })

  it('the same rules for a Map (my own statuses)', () => {
    const prev = new Map([['p1', 'pending'], ['p2', 'accepted']])
    expect([...mergeMapByPost(prev, ['q1'], new Map([['q1', 'pending']]), all, false)]).toEqual([['p1', 'pending'], ['p2', 'accepted'], ['q1', 'pending']])
    expect([...mergeMapByPost(prev, ['p1'], new Map(), all, false)]).toEqual([['p2', 'accepted']])
    expect([...mergeMapByPost(prev, ['p2', 'p3'], new Map([['p3', 'pending']]), all, true)]).toEqual([['p3', 'pending']])
    expect([...mergeMapByPost(prev, ['p1', 'p3'], new Map([['p1', 'x'], ['p3', 'pending']]), (id) => id !== 'p1', true)]).toEqual([['p1', 'pending'], ['p3', 'pending']])
    expect([...prev]).toEqual([['p1', 'pending'], ['p2', 'accepted']])
  })

  it('a card that leaves drops its entry; a post with none leaves the record as it is (the same object)', () => {
    expect(withoutPost(first, 'p1')).toEqual({ p2: 1 })
    expect(withoutPost(first, 'zz')).toBe(first)
  })
})

describe('latest started wins, per post', () => {
  it('a read owns the posts it asked about until a later read asks about them', () => {
    const order = createReadOrder()
    const page = order.start(['p1', 'p2'])
    expect([order.claim(page, 'p1'), order.claim(page, 'p2')]).toEqual(['owns', 'owns'])
    const after = order.start(['p1'])
    // Whichever response arrives last, p1 is the later read's; p2 is still the page's.
    expect([order.claim(page, 'p1'), order.claim(page, 'p2')]).toEqual(['overtaken', 'owns'])
    expect(order.claim(after, 'p1')).toBe('owns')
  })

  it('a later read that asks about OTHER posts overtakes nothing', () => {
    const order = createReadOrder()
    const action = order.start(['p1'])
    order.start(['q1', 'q2'])
    expect(order.claim(action, 'p1')).toBe('owns')
  })

  it('a replacing read (a first page, a refresh) overtakes the posts it asks about, and unlists the rest', () => {
    const order = createReadOrder()
    const older = order.start(['p1', 'p9'])
    const refresh = order.start(['p1', 'p2'], true)
    expect(order.claim(older, 'p1')).toBe('overtaken')
    expect(order.claim(older, 'p9')).toBe('unlisted')
    expect([order.claim(refresh, 'p1'), order.claim(refresh, 'p2')]).toEqual(['owns', 'owns'])
    // A read started after the refresh is not unlisted by it.
    const later = order.start(['p9'])
    expect(order.claim(later, 'p9')).toBe('owns')
  })

  it('each order keeps its own clock (statuses, rows and counts do not overtake each other)', () => {
    const rows = createReadOrder()
    const statuses = createReadOrder()
    const r = rows.start(['p1'])
    statuses.start(['p1'])
    statuses.start(['p1'])
    expect(rows.claim(r, 'p1')).toBe('owns')
  })
})
