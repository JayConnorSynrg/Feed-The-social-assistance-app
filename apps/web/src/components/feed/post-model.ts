/**
 * post-model.ts
 *
 * Pure (no-JSX, no-React) domain model for the community feed.
 *
 * This module is the single source of truth for:
 *   - the widened Post type (all 7 post_type discriminants)
 *   - the DB-row → Post transform (`rowToPost`) used by BOTH the paged fetch
 *     and the realtime-insert hydration path, so a live-inserted post has the
 *     exact same type + data fidelity as a refetched one (INV2)
 *   - the explicit feed column select list (INV4)
 *   - metadata parsers for the structured post types (event / request / offer)
 *   - poll view derivation (options + tallies) for the poll card (INV6)
 *   - the exhaustive discriminant router `postBodyKind` guarded by assertNever
 *     so a future 8th post_type is a COMPILE error, not a silent 'feed' stub (INV1)
 *
 * It is deliberately JSX-free so the vitest (node-environment) suite can import
 * and exercise the transform + derivations directly.
 */

import type { Database } from '@feed/database'

// ---------------------------------------------------------------------------
// Discriminant
// ---------------------------------------------------------------------------

/** The full set of post_type enum values, sourced from the generated DB types. */
export type PostType = Database['public']['Enums']['post_type']

/**
 * Every post_type value, as a runtime array. Kept in sync with the enum by the
 * exhaustiveness test (a missing/extra value fails the suite) and by the
 * compile-time assertNever check in `postBodyKind`.
 */
export const POST_TYPE_VALUES = [
  'feed',
  'resource_post',
  'petition',
  'seeker_request',
  'source_offer',
  'event_post',
  'poll',
] as const satisfies readonly PostType[]

/**
 * Exhaustiveness guard for discriminated unions. Calling this with a value the
 * type system believes is `never` is a compile error — so adding a post_type
 * without handling it fails `tsc`, rather than falling through to a blank card.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled post_type discriminant: ${String(x)}`)
}

/** The kind of type-specific body a post renders. Drives the render registry. */
export type PostBodyKind = 'plain' | 'poll' | 'event' | 'request' | 'offer' | 'petition'

/**
 * Map a post_type discriminant to the body kind its card renders. The
 * `default: assertNever` arm makes an unhandled future post_type a compile
 * error (INV1). This is the ONE place the discriminant is switched; the React
 * registry consumes this result.
 */
export function postBodyKind(postType: PostType): PostBodyKind {
  switch (postType) {
    case 'feed':
    case 'resource_post':
      return 'plain'
    case 'petition':
      return 'petition'
    case 'poll':
      return 'poll'
    case 'event_post':
      return 'event'
    case 'seeker_request':
      return 'request'
    case 'source_offer':
      return 'offer'
    default:
      return assertNever(postType)
  }
}

// ---------------------------------------------------------------------------
// Structured metadata parsers (posts.metadata JSONB)
// ---------------------------------------------------------------------------

/** Parsed shape of an event_post's metadata. */
export interface EventMeta {
  /** Always present — parseEventMeta returns null when there is no start time. */
  startsAt: string
  endsAt: string | null
  location: string | null
  isOnline: boolean
}

function asRecord(metadata: unknown): Record<string, unknown> | null {
  if (metadata != null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return null
}

/**
 * Parse an event_post's metadata into a typed EventMeta, or null when the
 * metadata is absent/malformed. The wizard writes
 * `{ starts_at, ends_at, location, is_online }` (see post-type-wizard EventForm).
 */
export function parseEventMeta(metadata: unknown): EventMeta | null {
  const m = asRecord(metadata)
  if (!m) return null
  const startsAt = typeof m.starts_at === 'string' ? m.starts_at : null
  // An event with no start time carries no useful event body.
  if (!startsAt) return null
  return {
    startsAt,
    endsAt: typeof m.ends_at === 'string' ? m.ends_at : null,
    location: typeof m.location === 'string' ? m.location : null,
    isOnline: m.is_online === true,
  }
}

/**
 * Parse the `categories` string array written by the seeker_request /
 * source_offer wizard forms. Returns [] when absent or malformed.
 */
export function parseCategories(metadata: unknown): string[] {
  const m = asRecord(metadata)
  if (!m || !Array.isArray(m.categories)) return []
  return m.categories.filter((c): c is string => typeof c === 'string')
}

// ---------------------------------------------------------------------------
// Post model
// ---------------------------------------------------------------------------

/** Author sub-object rendered in the card chrome. */
export interface PostAuthor {
  id: string
  name: string
  avatar?: string
  role: string
  harmonyScore: number | null
  harmonyReviewsCount: number
}

/** The feed's view model for a single post — all 7 discriminants supported. */
export interface Post {
  id: string
  author: PostAuthor
  content: string
  timestamp: Date
  likes: number
  comments: number
  isLiked: boolean
  category: 'update' | 'request' | 'offer' | 'announcement'
  resourceId: string | null
  resourceName: string | null
  resourceCategory: string | null
  maxSeekers: number | null
  slotsRemaining: number | null
  postType: PostType
  petitionId: string | null
  isHidden: boolean
  /** Parsed event fields (event_post only; null otherwise). */
  eventMeta: EventMeta | null
  /** Category chips (seeker_request / source_offer). */
  requestCategories: string[]
}

/**
 * The explicit column list for every feed read (INV4). No `select('*')`: a
 * later coordinate/PII column gate must not silently break or over-expose the
 * feed. Includes the denormalized like_count/comment_count (INV3) and the
 * structured metadata + discriminant columns the cards need.
 *
 * Used by BOTH the paged main query and the single-row realtime hydration
 * fetch so the two paths return identical shapes (INV2).
 */
export const FEED_POST_SELECT =
  'id, user_id, content, created_at, is_pinned, is_hidden, image_url, ' +
  'max_seekers, slots_remaining, post_type, petition_id, resource_id, ' +
  'metadata, like_count, comment_count, ' +
  'user:profiles!posts_user_id_fkey(id, first_name, avatar_url, is_staff, harmony_score, harmony_reviews_count), ' +
  'resource:resources(id, name, category)'

/** The joined row shape returned by FEED_POST_SELECT. */
export interface FeedPostRow {
  id: string
  content: string
  created_at: string | null
  is_pinned: boolean | null
  is_hidden: boolean | null
  max_seekers: number | null
  slots_remaining: number | null
  post_type: string | null
  petition_id: string | null
  resource_id: string | null
  metadata: unknown
  like_count: number | null
  comment_count: number | null
  user: {
    id: string
    first_name: string | null
    avatar_url: string | null
    is_staff: boolean | null
    harmony_score: number | null
    harmony_reviews_count: number | null
  } | null
  resource: {
    id: string
    name: string
    category: string | null
  } | null
}

/** Runtime narrowing of an arbitrary string to a valid PostType. */
function coercePostType(raw: string | null | undefined): PostType {
  return (POST_TYPE_VALUES as readonly string[]).includes(raw ?? '')
    ? (raw as PostType)
    : 'feed'
}

/**
 * Transform a DB row (from FEED_POST_SELECT) into the feed view model.
 *
 * This is the SINGLE transform used by the paged fetch and the realtime
 * hydration path (INV2). Counts come straight from the denormalized
 * like_count/comment_count columns — no secondary aggregation fetch (INV3).
 * The discriminant is preserved for all 7 types (never coerced to 'feed'
 * except for a genuinely unknown value) so every type reaches its true card
 * (INV1). `isLiked` is supplied by the caller from the "my likes" query.
 */
export function rowToPost(row: FeedPostRow, opts: { isLiked: boolean }): Post {
  const postType = coercePostType(row.post_type)
  return {
    id: row.id,
    author: {
      id: row.user?.id || '',
      name: row.user?.first_name || 'Anonymous',
      avatar: row.user?.avatar_url || undefined,
      role: row.user?.is_staff ? 'Admin' : 'Community Member',
      harmonyScore: row.user?.harmony_score ?? null,
      harmonyReviewsCount: row.user?.harmony_reviews_count ?? 0,
    },
    content: row.content,
    timestamp: new Date(row.created_at ?? Date.now()),
    likes: row.like_count ?? 0,
    comments: row.comment_count ?? 0,
    isLiked: opts.isLiked,
    category: row.is_pinned ? 'announcement' : 'update',
    resourceId: row.resource?.id ?? null,
    resourceName: row.resource?.name ?? null,
    resourceCategory: row.resource?.category ?? null,
    maxSeekers: row.max_seekers ?? null,
    slotsRemaining: row.slots_remaining ?? null,
    postType,
    petitionId: row.petition_id ?? null,
    isHidden: row.is_hidden ?? false,
    eventMeta: postType === 'event_post' ? parseEventMeta(row.metadata) : null,
    requestCategories:
      postType === 'seeker_request' || postType === 'source_offer'
        ? parseCategories(row.metadata)
        : [],
  }
}

// ---------------------------------------------------------------------------
// Poll view derivation (INV6)
// ---------------------------------------------------------------------------

/** One poll option, enriched with its tally and the current user's choice. */
export interface PollOptionView {
  index: number
  label: string
  count: number
  /** Whole-percent share of total votes (0 when no votes yet). */
  pct: number
  isUserChoice: boolean
}

/**
 * Derive the per-option view (label + tally + user's choice) for a poll card.
 * Pure: given the poll's options, the vote tallies, the total, and the current
 * user's vote index, produce the display rows.
 */
export function derivePollView(
  options: string[],
  tallies: number[],
  totalVotes: number,
  userVote: number | null
): PollOptionView[] {
  return options.map((label, index) => {
    const count = tallies[index] ?? 0
    return {
      index,
      label,
      count,
      pct: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      isUserChoice: userVote === index,
    }
  })
}

/** Whether a poll's voting window has closed. */
export function pollHasEnded(endsAt: string | null): boolean {
  return endsAt != null && new Date(endsAt).getTime() <= Date.now()
}

/**
 * Whether the current user may cast/change a vote: authenticated and the poll
 * has not ended. The one-effective-vote invariant itself is enforced by the
 * DB (UNIQUE(poll_id, user_id)); this gates the control's visibility (INV6).
 */
export function canCastVote(isAuthenticated: boolean, endsAt: string | null): boolean {
  return isAuthenticated && !pollHasEnded(endsAt)
}

// ---------------------------------------------------------------------------
// Optimistic vote transitions (INV6)
// ---------------------------------------------------------------------------

/**
 * The minimal poll state a vote acts on: per-option tallies, the running total,
 * and the current user's chosen option index (null = has not voted). Kept pure
 * and JSX-free so the transition can be unit-tested directly.
 */
export interface PollVoteState {
  tallies: number[]
  totalVotes: number
  userVote: number | null
}

/**
 * Apply the current user casting (or switching to) a vote for `optionIndex`.
 * Pure: returns the next state, never mutates the input.
 *   - fresh vote (no prior choice): increments that option + total, sets userVote
 *   - switch (prior choice differs): decrements the old option, increments the
 *     new one, total unchanged (UNIQUE(poll_id,user_id) → one effective vote)
 *   - re-cast of the same option: no-op
 * An out-of-range index is a no-op. This is the settle-independent optimistic
 * transition the poll body shows immediately, before the fresh server read.
 */
export function applyVote(state: PollVoteState, optionIndex: number): PollVoteState {
  if (optionIndex < 0 || optionIndex >= state.tallies.length) return state
  if (state.userVote === optionIndex) return state
  const tallies = [...state.tallies]
  let totalVotes = state.totalVotes
  if (state.userVote === null) {
    totalVotes += 1
  } else if (state.userVote >= 0 && state.userVote < tallies.length && tallies[state.userVote] > 0) {
    // Switching choice: drop the prior option; total is unchanged.
    tallies[state.userVote] -= 1
  }
  tallies[optionIndex] += 1
  return { tallies, totalVotes, userVote: optionIndex }
}

/**
 * Apply the current user revoking their vote. Pure: clears userVote, decrements
 * that option's tally and the total (floored at 0). A no-op when there is no
 * current vote.
 */
export function removeVote(state: PollVoteState): PollVoteState {
  if (state.userVote === null) return state
  const tallies = [...state.tallies]
  const idx = state.userVote
  if (idx >= 0 && idx < tallies.length && tallies[idx] > 0) {
    tallies[idx] -= 1
  }
  return { tallies, totalVotes: Math.max(0, state.totalVotes - 1), userVote: null }
}
