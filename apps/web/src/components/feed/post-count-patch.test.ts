// post-count-patch.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Guards the W1.4 feed onUpdate path: a posts realtime UPDATE patches the matching
// post's counts IN PLACE from the server's absolute counts — no client arithmetic,
// no re-rank, and a non-matching id is a true no-op.

import { describe, it, expect } from 'vitest'
import { applyPostCountPatch, type PostCountPatchRow } from './post-model'

interface TestPost {
  id: string
  likes: number
  comments: number
  slotsRemaining: number | null
}

function post(id: string, likes: number, comments: number, slots: number | null = null): TestPost {
  return { id, likes, comments, slotsRemaining: slots }
}

describe('applyPostCountPatch', () => {
  it('replaces the matched post counts with the server absolute values (not incremented)', () => {
    const posts = [post('a', 1, 2), post('b', 10, 20)]
    const row: PostCountPatchRow = { id: 'b', like_count: 11, comment_count: 25 }
    const next = applyPostCountPatch(posts, row)
    // Absolute server value, not 10+11.
    expect(next[1]).toMatchObject({ id: 'b', likes: 11, comments: 25 })
  })

  it('preserves list order and leaves other posts untouched (no re-rank)', () => {
    const posts = [post('a', 1, 1), post('b', 2, 2), post('c', 3, 3)]
    const next = applyPostCountPatch(posts, { id: 'b', like_count: 99, comment_count: 99 })
    expect(next.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    // Non-target posts are the same object references.
    expect(next[0]).toBe(posts[0])
    expect(next[2]).toBe(posts[2])
  })

  it('is a no-op (same array reference) when the row id is not present', () => {
    const posts = [post('a', 1, 1), post('b', 2, 2)]
    const next = applyPostCountPatch(posts, { id: 'zzz', like_count: 5, comment_count: 5 })
    expect(next).toBe(posts)
  })

  it('maps slots_remaining, including a null (no slot cap)', () => {
    const posts = [post('a', 0, 0, 4)]
    expect(applyPostCountPatch(posts, { id: 'a', like_count: 0, comment_count: 0, slots_remaining: 2 })[0].slotsRemaining).toBe(2)
    expect(applyPostCountPatch(posts, { id: 'a', like_count: 0, comment_count: 0, slots_remaining: null })[0].slotsRemaining).toBeNull()
  })
})
