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
  FEED_POST_SELECT,
  parseEventMeta,
  parseCategories,
  derivePollView,
  pollHasEnded,
  canCastVote,
  applyVote,
  removeVote,
  postBodyKind,
  POST_TYPE_VALUES,
  orderByRankAndAttachBucket,
  type FeedPostRow,
  type PostType,
  type PollVoteState,
  type RankedFeedRow,
} from './post-model'

// A minimal valid joined row; override per test.
function makeRow(overrides: Partial<FeedPostRow> = {}): FeedPostRow {
  return {
    id: 'p1',
    content: 'hello',
    created_at: '2026-09-01T12:00:00.000Z',
    is_pinned: false,
    is_hidden: false,
    image_url: null,
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
      admin_tier: null,
      harmony_score: null,
      harmony_reviews_count: 0,
      badge_summary: null,
    },
    resource: null,
    ...overrides,
  }
}

describe('rowToPost — public tier marker (P3.1 T4)', () => {
  it('FEED_POST_SELECT embeds admin_tier on the author join', () => {
    expect(FEED_POST_SELECT).toContain('admin_tier')
  })
  it('maps a moderator/resource-admin/platform-admin tier to the public label', () => {
    expect(rowToPost(makeRow({ user: { ...makeRow().user!, admin_tier: 'community_moderator' } }), { isLiked: false }).author.role).toBe('Moderator')
    expect(rowToPost(makeRow({ user: { ...makeRow().user!, admin_tier: 'resource_admin' } }), { isLiked: false }).author.role).toBe('Resource Admin')
    expect(rowToPost(makeRow({ user: { ...makeRow().user!, admin_tier: 'platform_admin' } }), { isLiked: false }).author.role).toBe('Admin')
  })
  it('a plain author (no tier) is Community Member, never Admin', () => {
    const post = rowToPost(makeRow(), { isLiked: false })
    expect(post.author.role).toBe('Community Member')
    expect(post.author.authorTier).toBeNull()
  })
})

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

describe('rowToPost — attached photo (W1.2 INV-M3 read side)', () => {
  it('maps image_url from the row onto post.imageUrl so the card can render it', () => {
    const url = 'https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/u1/abc.webp'
    const post = rowToPost(makeRow({ image_url: url }), { isLiked: false })
    expect(post.imageUrl).toBe(url)
  })

  it('leaves imageUrl null when the post has no photo (no broken/empty image)', () => {
    const post = rowToPost(makeRow({ image_url: null }), { isLiked: false })
    expect(post.imageUrl).toBeNull()
  })

  it('preserves image_url through the SAME transform the realtime hydration path uses', () => {
    // A live-inserted post must surface its photo identically to a refetched one.
    const url = 'https://cdn.example/post-images/u1/live.webp'
    const post = rowToPost(makeRow({ post_type: 'feed', image_url: url }), { isLiked: false })
    expect(post.postType).toBe('feed')
    expect(post.imageUrl).toBe(url)
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

describe('applyVote / removeVote — optimistic vote transitions (INV6, FIX1)', () => {
  it('casting a fresh vote sets userVote and increments that option + total', () => {
    const before: PollVoteState = { tallies: [0, 0, 0], totalVotes: 0, userVote: null }
    const after = applyVote(before, 1)
    expect(after.userVote).toBe(1)
    expect(after.tallies).toEqual([0, 1, 0])
    expect(after.totalVotes).toBe(1)
    // purity: input untouched
    expect(before.tallies).toEqual([0, 0, 0])
    expect(before.userVote).toBeNull()
  })

  it('switching choice moves the tally and keeps the total (one effective vote)', () => {
    const before: PollVoteState = { tallies: [1, 0], totalVotes: 1, userVote: 0 }
    const after = applyVote(before, 1)
    expect(after.userVote).toBe(1)
    expect(after.tallies).toEqual([0, 1])
    expect(after.totalVotes).toBe(1)
  })

  it('re-casting the same option is a no-op', () => {
    const before: PollVoteState = { tallies: [0, 1], totalVotes: 1, userVote: 1 }
    expect(applyVote(before, 1)).toBe(before)
  })

  it('an out-of-range option index is a no-op', () => {
    const before: PollVoteState = { tallies: [0, 0], totalVotes: 0, userVote: null }
    expect(applyVote(before, 5)).toBe(before)
    expect(applyVote(before, -1)).toBe(before)
  })

  it('revoking clears userVote and decrements that option + total', () => {
    const before: PollVoteState = { tallies: [0, 1], totalVotes: 1, userVote: 1 }
    const after = removeVote(before)
    expect(after.userVote).toBeNull()
    expect(after.tallies).toEqual([0, 0])
    expect(after.totalVotes).toBe(0)
    // purity: input untouched
    expect(before.tallies).toEqual([0, 1])
    expect(before.userVote).toBe(1)
  })

  it('revoking with no current vote is a no-op', () => {
    const before: PollVoteState = { tallies: [2, 3], totalVotes: 5, userVote: null }
    expect(removeVote(before)).toBe(before)
  })

  it('total never goes negative on revoke', () => {
    const before: PollVoteState = { tallies: [0], totalVotes: 0, userVote: 0 }
    expect(removeVote(before).totalVotes).toBe(0)
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

describe('ranked feed client re-sort + distance-bucket attach (W1.3)', () => {
  // Build a Post through the real rowToPost transform so the test exercises the
  // same shape the feed renders (compounds on the makeRow/rowToPost coverage above).
  const post = (id: string) => rowToPost(makeRow({ id }), { isLiked: false })

  it('returns posts in the RPC score order, not the hydrate order', () => {
    // RPC order (score DESC): c, a, b. Hydrate arrives in an unrelated order.
    const ranked: RankedFeedRow[] = [
      { id: 'c', score: 9, distance_bucket: '<2km' },
      { id: 'a', score: 5, distance_bucket: '2-10km' },
      { id: 'b', score: 1, distance_bucket: '>50km' },
    ]
    const hydrated = [post('a'), post('b'), post('c')]
    const out = orderByRankAndAttachBucket(ranked, hydrated)
    expect(out.map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })

  it('attaches each row its own distance bucket by id', () => {
    const ranked: RankedFeedRow[] = [
      { id: 'a', score: 5, distance_bucket: '2-10km' },
      { id: 'b', score: 1, distance_bucket: 'unknown' },
    ]
    const out = orderByRankAndAttachBucket(ranked, [post('b'), post('a')])
    const byId = Object.fromEntries(out.map((p) => [p.id, p.distanceBucket]))
    expect(byId).toEqual({ a: '2-10km', b: 'unknown' })
  })

  it('drops a ranked id that the hydrate did not surface (RLS-filtered row)', () => {
    const ranked: RankedFeedRow[] = [
      { id: 'a', score: 5, distance_bucket: '<2km' },
      { id: 'gone', score: 4, distance_bucket: '<2km' },
    ]
    const out = orderByRankAndAttachBucket(ranked, [post('a')])
    expect(out.map((p) => p.id)).toEqual(['a'])
  })

  it('does not mutate the input posts (attach is a copy)', () => {
    const original = post('a')
    orderByRankAndAttachBucket([{ id: 'a', score: 5, distance_bucket: '<2km' }], [original])
    expect(original.distanceBucket).toBeUndefined()
  })

  it('returns empty when the RPC returned no rows', () => {
    expect(orderByRankAndAttachBucket([], [post('a')])).toEqual([])
  })
})
