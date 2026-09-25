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
import type { BadgeSummary } from '@/lib/engagement-badges'
import { tierLabel, type AdminTier } from '@/lib/admin-tier'

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
  /** Public tier marker label ('Moderator' | 'Resource Admin' | 'Admin'), or 'Community Member'. */
  role: string
  /** Raw tier for threading to profile surfaces (appreciation sheet). null/undefined = plain user. */
  authorTier?: AdminTier | null
  harmonyScore: number | null
  harmonyReviewsCount: number
  /** Public engagement badges (levels only) for the compact author-row strip + profile
   *  sheet (P2.1b). null when the author has earned none / summary absent. */
  badgeSummary: BadgeSummary | null
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
  /** Public URL of an attached photo (W1.2), or null when the post has none. */
  imageUrl: string | null
  /** Parsed event fields (event_post only; null otherwise). */
  eventMeta: EventMeta | null
  /** Category chips (seeker_request / source_offer). */
  requestCategories: string[]
  /**
   * Coarse distance label from the ranked_feed RPC ('<2km' | '2-10km' | '10-50km'
   * | '>50km' | 'unknown'). Present ONLY in ranked mode with caller geo; the raw
   * coordinate/distance is never sent to the client (W1.3 INV-A). Undefined in the
   * chronological feed and in the single-row realtime hydration path.
   */
  distanceBucket?: string
  /**
   * The ranked_feed_v2 score for this post (W1.6b). Present ONLY in ranked mode;
   * used to interleave events at their true rank position (mergeRankedFeedItems).
   * Undefined for a live realtime-inserted post (kept ahead of scored rows) and in
   * the chronological feed.
   */
  score?: number
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
  'user:profiles!posts_user_id_fkey(id, first_name, avatar_url, is_staff, admin_tier, harmony_score, harmony_reviews_count, badge_summary), ' +
  'resource:resources(id, name, category)'

/** The joined row shape returned by FEED_POST_SELECT. */
export interface FeedPostRow {
  id: string
  content: string
  created_at: string | null
  is_pinned: boolean | null
  is_hidden: boolean | null
  image_url: string | null
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
    admin_tier: AdminTier | null
    harmony_score: number | null
    harmony_reviews_count: number | null
    badge_summary: BadgeSummary | null
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
      role: tierLabel(row.user?.admin_tier) ?? 'Community Member',
      authorTier: row.user?.admin_tier ?? null,
      harmonyScore: row.user?.harmony_score ?? null,
      harmonyReviewsCount: row.user?.harmony_reviews_count ?? 0,
      badgeSummary: (row.user?.badge_summary as BadgeSummary | null) ?? null,
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
    imageUrl: row.image_url ?? null,
    eventMeta: postType === 'event_post' ? parseEventMeta(row.metadata) : null,
    requestCategories:
      postType === 'seeker_request' || postType === 'source_offer'
        ? parseCategories(row.metadata)
        : [],
  }
}

// ---------------------------------------------------------------------------
// Ranked feed (W1.3) — client re-sort + distance-bucket attach
// ---------------------------------------------------------------------------

/** One row from the ranked_feed RPC. The RPC emits ONLY these three fields — no
 *  latitude/longitude/distance ever reaches the client (W1.3 INV-A). */
export interface RankedFeedRow {
  id: string
  score: number
  distance_bucket: string
}

/**
 * Re-order the hydrated posts to match the RPC's exact score order and attach each
 * row's distance bucket by id (W1.3). The RPC returns ids already ordered by
 * (score DESC, id DESC); the hydrate fetch (`.in('id', ids)`) returns them in an
 * arbitrary order, so this restores rank order and drops any id the RPC returned but
 * the hydrate did not surface (e.g. a row filtered by the explicit-column read).
 * Pure + JSX-free so the ranked-ordering invariant is unit-testable directly.
 */
export function orderByRankAndAttachBucket(
  ranked: readonly RankedFeedRow[],
  hydrated: readonly Post[]
): Post[] {
  const byId = new Map(hydrated.map((p) => [p.id, p]))
  const out: Post[] = []
  for (const r of ranked) {
    const p = byId.get(r.id)
    if (p) out.push({ ...p, distanceBucket: r.distance_bucket, score: r.score })
  }
  return out
}

// ---------------------------------------------------------------------------
// Events in the ranked feed (W1.6b)
// ---------------------------------------------------------------------------

/** One row from the ranked_feed_v2 RPC. Adds `kind` to distinguish a post row
 *  (id = post id) from an event row (id = the event's next occurrence id). Like
 *  RankedFeedRow, it carries no coordinate/distance — only the coarse bucket. */
export interface RankedFeedV2Row {
  id: string
  kind: 'post' | 'event'
  score: number
  distance_bucket: string
}

/** A hydrated event occurrence rendered as one feed row (W1.6b). The occurrence
 *  id is the feed-row id; the check-in button reuses the W1.6a event-checkin logic. */
export interface EventFeedItem {
  /** Occurrence id — the feed-row id and the id the check-in RPC acts on. */
  occurrenceId: string
  eventId: string
  title: string
  eventType: string
  orgName: string | null
  startsAt: string
  endsAt: string
  locationName: string | null
  city: string | null
  state: string | null
  status: string
  requiresRegistration: boolean
  /** ranked_feed_v2 score — used to interleave among posts. */
  score: number
  /** Coarse distance bucket from the RPC ('<2km'…'>50km'|'unknown'). */
  distanceBucket: string
}

/** A single rendered feed row: a post card or an event card. Discriminated so the
 *  render loop switches exhaustively (no field is shared across the two shapes). */
export type FeedItem =
  | { kind: 'post'; post: Post }
  | { kind: 'event'; event: EventFeedItem }

/** Split the ranked_feed_v2 rows into the post ids and event (occurrence) ids to
 *  hydrate on their own tables. Pure — order within each list preserves the RPC's
 *  rank order so the caller can attach scores back by id. */
export function partitionRankedRows(rows: readonly RankedFeedV2Row[]): {
  postIds: string[]
  eventIds: string[]
} {
  const postIds: string[] = []
  const eventIds: string[] = []
  for (const r of rows) {
    if (r.kind === 'event') eventIds.push(r.id)
    else postIds.push(r.id)
  }
  return { postIds, eventIds }
}

/**
 * Whether events are mixed into the feed for this view (W1.6b ruling): events
 * appear ONLY in ranked mode under the "All" filter — never in the chronological
 * "Recent" mode, and never under Following / My Posts / Announcements (those are
 * author-scoped and events have no post author).
 */
export function feedIncludesEvents(
  rankMode: 'ranked' | 'recent',
  activeFilter: string
): boolean {
  return rankMode === 'ranked' && activeFilter === 'all'
}

/**
 * Merge already-rank-ordered posts and events into one rendered list in global
 * (score DESC, id DESC) order — a two-pointer merge of two pre-sorted inputs, so
 * it reproduces the RPC's cross-kind keyset order exactly (INV I4: every ranked
 * row renders once, in rank order).
 *
 * A post whose `score` is undefined (a live realtime insert not part of the ranked
 * page, or the chronological feed) sorts BEFORE every scored row — preserving the
 * current "new post appears on top" behaviour. Events always carry a score, so a
 * scoreless post never sinks below an event. Stable within equal keys (input order
 * kept), and the two inputs are consumed in order so post order is never disturbed.
 */
export function mergeRankedFeedItems(
  posts: readonly Post[],
  events: readonly EventFeedItem[]
): FeedItem[] {
  // key compare: returns true when `a` should come BEFORE `b`.
  // Undefined post score = +∞ (always first). Otherwise (score DESC, id DESC).
  const postBefore = (p: Post, e: EventFeedItem): boolean => {
    if (p.score === undefined) return true
    if (p.score !== e.score) return p.score > e.score
    // id DESC tiebreak: the RPC's row id for an event is its occurrence id.
    return p.id > e.occurrenceId
  }
  const out: FeedItem[] = []
  let i = 0
  let j = 0
  while (i < posts.length && j < events.length) {
    if (postBefore(posts[i], events[j])) {
      out.push({ kind: 'post', post: posts[i] })
      i++
    } else {
      out.push({ kind: 'event', event: events[j] })
      j++
    }
  }
  while (i < posts.length) { out.push({ kind: 'post', post: posts[i] }); i++ }
  while (j < events.length) { out.push({ kind: 'event', event: events[j] }); j++ }
  return out
}

/**
 * Coarse timing label for an event feed card, derived from now vs the occurrence's
 * start/end (the "age" the ranking peaks on). Pure + unit-testable. `isLive` marks
 * an in-progress occurrence (start passed, not yet ended) so the card can flag it.
 */
export function eventTimingLabel(
  nowMs: number,
  startsAtMs: number,
  endsAtMs: number
): { label: string; isLive: boolean } {
  if (nowMs >= startsAtMs && nowMs <= endsAtMs) return { label: 'Happening now', isLive: true }
  if (nowMs > endsAtMs) return { label: 'Ended', isLive: false }
  const mins = Math.round((startsAtMs - nowMs) / 60000)
  if (mins <= 60) return { label: `Starts in ${Math.max(1, mins)} min`, isLive: false }
  const hours = Math.round(mins / 60)
  if (hours < 24) return { label: `Starts in ${hours} h`, isLive: false }
  const days = Math.round(hours / 24)
  return { label: `In ${days} day${days === 1 ? '' : 's'}`, isLive: false }
}

/** Human distance-bucket label for an event card; null hides the row when unknown. */
export function distanceBucketLabel(bucket: string | null | undefined): string | null {
  switch (bucket) {
    case '<2km':    return 'Within 2 km'
    case '2-10km':  return '2–10 km away'
    case '10-50km': return '10–50 km away'
    case '>50km':   return 'Over 50 km away'
    default:        return null // 'unknown' or absent → no distance shown
  }
}

// ---------------------------------------------------------------------------
// Realtime count patch (W1.4)
// ---------------------------------------------------------------------------

/**
 * The posts-row columns a realtime UPDATE carries (the posts publication column
 * list). All are physically on the posts row, so a WAL UPDATE ships every one of
 * them — the patch below re-derives the on-row view fields from them while
 * preserving the fields that come from JOINs or the client (see applyPostRowPatch).
 */
export interface PostRowPatch {
  id: string
  content?: string | null
  is_pinned?: boolean | null
  post_type?: string | null
  metadata?: unknown
  image_url?: string | null
  petition_id?: string | null
  max_seekers?: number | null
  like_count?: number | null
  comment_count?: number | null
  slots_remaining?: number | null
}

/**
 * Patch a single post in place from a posts realtime UPDATE row (W1.4).
 *
 * A posts WAL UPDATE carries the full posts row, so this refreshes every on-row
 * view field — content, category (from is_pinned), postType, the metadata-derived
 * eventMeta / requestCategories, imageUrl, petitionId, maxSeekers — and takes the
 * SERVER's absolute counts (like_count -> likes, comment_count -> comments). No
 * client-side arithmetic, so a dropped or duplicated event cannot drift a count.
 *
 * PRESERVED (not on the WAL row): author/profile, the joined resource name and
 * category, and distanceBucket (a ranked-feed-only derived value). The post is
 * matched by id; every other post is returned untouched and list ORDER is
 * preserved (an update must never re-rank the feed under the reader). When the
 * row's id is not present the original array is returned unchanged — a true no-op
 * (same reference); the caller handles the not-present case (e.g. an unhide
 * restore) separately.
 *
 * Generic over the view model so it stays pure and unit-testable without React.
 */
export function applyPostRowPatch<
  T extends {
    id: string
    content: string
    likes: number
    comments: number
    category: Post['category']
    postType: PostType
    slotsRemaining: number | null
    maxSeekers: number | null
    petitionId: string | null
    imageUrl: string | null
    eventMeta: EventMeta | null
    requestCategories: string[]
  }
>(posts: readonly T[], row: PostRowPatch): T[] {
  if (!posts.some((p) => p.id === row.id)) {
    return posts as T[]
  }
  return posts.map((p) => {
    if (p.id !== row.id) return p
    const postType = row.post_type != null ? coercePostType(row.post_type) : p.postType
    return {
      ...p,
      content: row.content ?? p.content,
      // Absolute server counts — never incremented.
      likes: row.like_count ?? p.likes,
      comments: row.comment_count ?? p.comments,
      category: row.is_pinned != null ? (row.is_pinned ? 'announcement' : 'update') : p.category,
      postType,
      imageUrl: row.image_url ?? null,
      petitionId: row.petition_id ?? p.petitionId,
      maxSeekers: row.max_seekers ?? p.maxSeekers,
      // Forward-safe: keep the prior cap when the row omits slots_remaining.
      slotsRemaining: row.slots_remaining ?? p.slotsRemaining,
      eventMeta: postType === 'event_post' ? parseEventMeta(row.metadata) : null,
      requestCategories:
        postType === 'seeker_request' || postType === 'source_offer'
          ? parseCategories(row.metadata)
          : [],
    }
  })
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
