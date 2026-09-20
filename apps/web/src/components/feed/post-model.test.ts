/**
 * post-model.test.ts
 *
 * Outcome tests for the feed rich-rendering model (W1.1). Each test asserts an
 * observable OUTCOME a user would see, not code shape:
 *   (a) a poll produces poll options + a usable vote control
 *   (b) an event_post exposes its event fields from metadata
 *   (c) a realtime-inserted non-feed post keeps its TRUE type (same rowToPost
 *       transform the realtime hydration path uses) — never a 'feed' stub
 *   (d) displayed counts come from the denormalized like_count/comment_count
 *
 * Plus the exhaustive-registry guard: every one of the 7 post_type values maps
 * to a body kind, and the discriminant router never silently drops a type.
 */

import { describe, it, expect } from 'vitest'
import {
  rowToPost,
  parseEventMeta,
  parseCategories,
  derivePollView,
  pollHasEnded,
  canCastVote,
  postBodyKind,
  POST_TYPE_VALUES,
  type FeedPostRow,
  type PostType,
} from './post-model'

// A minimal valid joined row; override per test.
function makeRow(overrides: Partial<FeedPostRow> = {}): FeedPostRow {
  return {
    id: 'p1',
    content: 'hello',
    created_at: '2026-09-01T12:00:00.000Z',
    is_pinned: false,
    is_hidden: false,
    max_seekers: null,
    slots_remaining: null,
    post_type: 'feed',
    petition_id: null,
    resource_id: null,
    metadata: null,
    like_count: 0,
    comment_count: 0,
    user: {
      id: 'u1',
      first_name: 'Ada',
      avatar_url: null,
      is_staff: false,
      harmony_score: null,
      harmony_reviews_count: 0,
    },
    resource: null,
    ...overrides,
  }
}

describe('rowToPost — discriminant fidelity (INV1/INV2)', () => {
  it('(c) a poll row keeps postType "poll" (not coerced to feed)', () => {
    const post = rowToPost(makeRow({ post_type: 'poll' }), { isLiked: false })
    expect(post.postType).toBe('poll')
  })

  it('(c) a seeker_request row keeps its true type — the realtime path uses this same transform', () => {
    const post = rowToPost(makeRow({ post_type: 'seeker_request' }), { isLiked: false })
    expect(post.postType).toBe('seeker_request')
  })

  it.each(POST_TYPE_VALUES)('preserves post_type "%s" through the transform', (t) => {
    const post = rowToPost(makeRow({ post_type: t }), { isLiked: false })
    expect(post.postType).toBe(t)
  })

  it('coerces an unknown post_type to "feed" (safe fallback)', () => {
    const post = rowToPost(makeRow({ post_type: 'totally_unknown' }), { isLiked: false })
    expect(post.postType).toBe('feed')
  })

  it('coerces a null post_type to "feed"', () => {
    const post = rowToPost(makeRow({ post_type: null }), { isLiked: false })
    expect(post.postType).toBe('feed')
  })
})

describe('rowToPost — counts from denormalized columns (INV3)', () => {
  it('(d) likes/comments come from like_count/comment_count, not a secondary fetch', () => {
    const post = rowToPost(makeRow({ like_count: 7, comment_count: 3 }), { isLiked: true })
    expect(post.likes).toBe(7)
    expect(post.comments).toBe(3)
    expect(post.isLiked).toBe(true)
  })

  it('treats null counts as 0', () => {
    const post = rowToPost(
      makeRow({ like_count: null as unknown as number, comment_count: null as unknown as number }),
      { isLiked: false }
    )
    expect(post.likes).toBe(0)
    expect(post.comments).toBe(0)
  })
})

describe('rowToPost — event body (INV registry / b)', () => {
  it('(b) an event_post exposes its start/location fields parsed from metadata', () => {
    const post = rowToPost(
      makeRow({
        post_type: 'event_post',
        metadata: {
          starts_at: '2026-10-01T18:00:00.000Z',
          ends_at: '2026-10-01T20:00:00.000Z',
          location: 'Town Hall',
          is_online: false,
        },
      }),
      { isLiked: false }
    )
    expect(post.postType).toBe('event_post')
    expect(post.eventMeta).not.toBeNull()
    expect(post.eventMeta?.startsAt).toBe('2026-10-01T18:00:00.000Z')
    expect(post.eventMeta?.location).toBe('Town Hall')
    expect(post.eventMeta?.isOnline).toBe(false)
  })

  it('non-event posts carry no eventMeta', () => {
    const post = rowToPost(makeRow({ post_type: 'feed', metadata: { starts_at: 'x' } }), { isLiked: false })
    expect(post.eventMeta).toBeNull()
  })
})

describe('rowToPost — request/offer categories', () => {
  it('parses category chips for seeker_request', () => {
    const post = rowToPost(
      makeRow({ post_type: 'seeker_request', metadata: { categories: ['Food', 'Housing'] } }),
      { isLiked: false }
    )
    expect(post.requestCategories).toEqual(['Food', 'Housing'])
  })

  it('non-request/offer posts carry no categories', () => {
    const post = rowToPost(
      makeRow({ post_type: 'feed', metadata: { categories: ['Food'] } }),
      { isLiked: false }
    )
    expect(post.requestCategories).toEqual([])
  })
})

describe('parseEventMeta', () => {
  it('returns null without a start time', () => {
    expect(parseEventMeta({ location: 'x' })).toBeNull()
    expect(parseEventMeta(null)).toBeNull()
    expect(parseEventMeta('not-an-object')).toBeNull()
    expect(parseEventMeta(['array'])).toBeNull()
  })

  it('defaults is_online to false when absent', () => {
    expect(parseEventMeta({ starts_at: 'z' })?.isOnline).toBe(false)
  })
})

describe('parseCategories', () => {
  it('returns [] for malformed metadata', () => {
    expect(parseCategories(null)).toEqual([])
    expect(parseCategories({ categories: 'nope' })).toEqual([])
    expect(parseCategories({})).toEqual([])
  })
  it('filters non-strings out', () => {
    expect(parseCategories({ categories: ['a', 2, null, 'b'] })).toEqual(['a', 'b'])
  })
})

describe('derivePollView (INV6)', () => {
  it('(a) produces one view per option with tallies, percents and the user choice', () => {
    const views = derivePollView(['Yes', 'No', 'Maybe'], [3, 1, 0], 4, 0)
    expect(views).toHaveLength(3)
    expect(views[0]).toMatchObject({ index: 0, label: 'Yes', count: 3, pct: 75, isUserChoice: true })
    expect(views[1]).toMatchObject({ label: 'No', count: 1, pct: 25, isUserChoice: false })
    expect(views[2]).toMatchObject({ label: 'Maybe', count: 0, pct: 0 })
  })

  it('yields 0% for all options when there are no votes yet', () => {
    const views = derivePollView(['A', 'B'], [0, 0], 0, null)
    expect(views.every((v) => v.pct === 0)).toBe(true)
    expect(views.every((v) => !v.isUserChoice)).toBe(true)
  })
})

describe('poll vote gating (INV6)', () => {
  it('(a) an authenticated user on an open poll may cast a vote (control shown)', () => {
    expect(canCastVote(true, null)).toBe(true)
  })
  it('an unauthenticated user may not vote', () => {
    expect(canCastVote(false, null)).toBe(false)
  })
  it('nobody may vote on an ended poll', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(pollHasEnded(past)).toBe(true)
    expect(canCastVote(true, past)).toBe(false)
  })
  it('a future end date is still open', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(pollHasEnded(future)).toBe(false)
    expect(canCastVote(true, future)).toBe(true)
  })
})

describe('exhaustive render registry (INV1)', () => {
  it('POST_TYPE_VALUES enumerates exactly the 7 post_type values', () => {
    expect(POST_TYPE_VALUES).toHaveLength(7)
    expect([...POST_TYPE_VALUES].sort()).toEqual(
      ['event_post', 'feed', 'petition', 'poll', 'resource_post', 'seeker_request', 'source_offer'].sort()
    )
  })

  it('every post_type maps to a defined body kind (no silent drop)', () => {
    for (const t of POST_TYPE_VALUES) {
      expect(postBodyKind(t as PostType)).toBeDefined()
    }
  })

  it('maps each discriminant to its expected body kind', () => {
    expect(postBodyKind('poll')).toBe('poll')
    expect(postBodyKind('event_post')).toBe('event')
    expect(postBodyKind('seeker_request')).toBe('request')
    expect(postBodyKind('source_offer')).toBe('offer')
    expect(postBodyKind('petition')).toBe('petition')
    expect(postBodyKind('feed')).toBe('plain')
    expect(postBodyKind('resource_post')).toBe('plain')
  })
})
