// post-count-patch.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Guards the W1.4 feed onUpdate path: a posts realtime UPDATE patches the matching
// post IN PLACE from the full posts WAL row — absolute counts (no client
// arithmetic), refreshed on-row fields, preserved JOIN/client fields, no re-rank,
// and a non-matching id is a true no-op.

import { describe, it, expect } from 'vitest'
import { applyPostRowPatch, type PostRowPatch, type Post } from './post-model'

function basePost(over: Partial<Post> = {}): Post {
  return {
    id: 'a',
    author: { id: 'u1', name: 'Ada', role: 'Community Member', harmonyScore: null, harmonyReviewsCount: 0, badgeSummary: null },
    content: 'hello',
    timestamp: new Date('2026-01-01T00:00:00Z'),
    likes: 1,
    comments: 2,
    isLiked: false,
    category: 'update',
    resourceId: 'r1',
    resourceName: 'Food Bank',
    resourceCategory: 'food',
    maxSeekers: null,
    slotsRemaining: null,
    postType: 'feed',
    petitionId: null,
    isHidden: false,
    imageUrl: null,
    eventMeta: null,
    requestCategories: [],
    distanceBucket: '<2km',
    ...over,
  }
}

describe('applyPostRowPatch', () => {
  it('applies the server absolute counts (not incremented)', () => {
    const posts = [basePost({ id: 'a', likes: 1, comments: 2 }), basePost({ id: 'b', likes: 10, comments: 20 })]
    const row: PostRowPatch = { id: 'b', like_count: 11, comment_count: 25 }
    const next = applyPostRowPatch(posts, row)
    expect(next[1]).toMatchObject({ id: 'b', likes: 11, comments: 25 })
  })

  it('preserves list order and leaves other posts untouched (no re-rank)', () => {
    const posts = [basePost({ id: 'a' }), basePost({ id: 'b' }), basePost({ id: 'c' })]
    const next = applyPostRowPatch(posts, { id: 'b', like_count: 99 })
    expect(next.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(next[0]).toBe(posts[0])
    expect(next[2]).toBe(posts[2])
  })

  it('is a no-op (same array reference) when the row id is not present', () => {
    const posts = [basePost({ id: 'a' }), basePost({ id: 'b' })]
    expect(applyPostRowPatch(posts, { id: 'zzz', like_count: 5 })).toBe(posts)
  })

  it('refreshes on-row fields: content, category (from is_pinned), image_url, petitionId', () => {
    const posts = [basePost({ id: 'a', content: 'old', category: 'update', imageUrl: null, petitionId: null })]
    const next = applyPostRowPatch(posts, {
      id: 'a',
      content: 'edited',
      is_pinned: true,
      image_url: 'https://cdn/x.webp',
      petition_id: 'pet-1',
    })
    expect(next[0]).toMatchObject({
      content: 'edited',
      category: 'announcement',
      imageUrl: 'https://cdn/x.webp',
      petitionId: 'pet-1',
    })
  })

  it('re-derives eventMeta from metadata when post_type is event_post', () => {
    const posts = [basePost({ id: 'a', postType: 'feed', eventMeta: null })]
    const next = applyPostRowPatch(posts, {
      id: 'a',
      post_type: 'event_post',
      metadata: { starts_at: '2026-02-01T10:00:00Z', is_online: true },
    })
    expect(next[0].postType).toBe('event_post')
    expect(next[0].eventMeta).toMatchObject({ startsAt: '2026-02-01T10:00:00Z', isOnline: true })
  })

  it('preserves JOIN/client fields not on the WAL row: author, resource name/category, distanceBucket', () => {
    const posts = [basePost({ id: 'a', resourceName: 'Food Bank', resourceCategory: 'food', distanceBucket: '2-10km' })]
    const next = applyPostRowPatch(posts, { id: 'a', like_count: 7 })
    expect(next[0].author.name).toBe('Ada')
    expect(next[0].resourceName).toBe('Food Bank')
    expect(next[0].resourceCategory).toBe('food')
    expect(next[0].distanceBucket).toBe('2-10km')
  })

  it('keeps the prior slot cap when the row omits slots_remaining (forward-safe), and applies a provided value', () => {
    const posts = [basePost({ id: 'a', slotsRemaining: 4 })]
    // omitted -> keep prior
    expect(applyPostRowPatch(posts, { id: 'a', like_count: 0 })[0].slotsRemaining).toBe(4)
    // provided -> apply
    expect(applyPostRowPatch(posts, { id: 'a', slots_remaining: 1 })[0].slotsRemaining).toBe(1)
  })
})
