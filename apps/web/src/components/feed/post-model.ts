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
import type { Locale } from '@/lib/i18n'
import { eventFormT, formatMessage, type EventFormMessages } from '@/lib/i18n-event-forms'
import { formatShortDate, isKnownTimeZone, relativeTimeText, venueDateKey } from '@/lib/event-time'
import { parseRecurrenceRule, type RecurrenceRule } from '@/lib/event-recurrence'
import { formatCancelledNotice, formatRecurrence } from '@/lib/event-recurrence-format'
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
  /** The venue's IANA zone (create_post / edit_post require it since PR-2). null on a legacy
   *  member event posted before zones existed: its times are shown exactly as entered. */
  timeZone: string | null
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
    timeZone: typeof m.time_zone === 'string' && m.time_zone ? m.time_zone : null,
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
  /** The author's description of the photo (posts.image_alt), or null. */
  imageAlt: string | null
  /** posts.version — the concurrency token every edit sends; it moves only on content edits. */
  version: number
  /** When the post was last visibly edited (posts.edited_at); null = never ("Edited" label hidden). */
  editedAt: Date | null
  /** Number of recorded edits (posts.edit_count). */
  editCount: number
  /** Why a hidden post is hidden ('hold_for_review' | 'admin_removal' | 'community_reports_threshold'
   *  | 'author_deleted'), or null. Only its author (and staff) can read a hidden post. */
  hiddenReason: string | null
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
  'version, edited_at, edit_count, image_alt, hidden_reason, ' +
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
  /** Post-editing columns (PR-2). Optional: a row read before the columns existed has none. */
  version?: number | null
  edited_at?: string | null
  edit_count?: number | null
  image_alt?: string | null
  hidden_reason?: string | null
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
    imageAlt: row.image_alt ?? null,
    version: row.version ?? 1,
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    editCount: row.edit_count ?? 0,
    hiddenReason: row.hidden_reason ?? null,
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

/** One event as a member sees it — the shared card of the community feed and the Events tab.
 *  One card per event: the server picks the event's shown date with the organizer's "post N
 *  days before" window. That shown date is either upcoming (the card times it and offers
 *  check-in) or cancelled (the event stays listed while the cancelled date is announced and not
 *  ended, and the card reads "Sat, Oct 10 cancelled — next: Sat, Oct 24"). */
export interface EventCardItem {
  /** Occurrence id of the shown date — the card's key and the id the check-in RPC acts on. */
  occurrenceId: string
  eventId: string
  /** assistance_events.org_id — whose admins may edit the event ("Edit in admin"). */
  orgId: string
  title: string
  eventType: string
  orgName: string | null
  /** The date the card times: the shown date, or — when the shown date was cancelled — the
   *  event's next upcoming date (the cancelled date itself when there is none). */
  startsAt: string
  endsAt: string
  /** The venue's IANA zone (assistance_events.time_zone) — times are shown with it. */
  timeZone: string
  locationName: string | null
  city: string | null
  state: string | null
  status: string
  requiresRegistration: boolean
  capacity: number | null
  notes: string | null
  /** The repeat rule (assistance_events.recurrence); null for an event with hand-added dates only. */
  recurrence: RecurrenceRule | null
  /** A hand-added date of a repeating event ("Extra date"). */
  isExtraDate: boolean
  /** Start of the shown date when it was cancelled (the date the notice names), else null. */
  cancelledStartsAt: string | null
  /** null: the shown date is upcoming. Otherwise the shown date was cancelled (no check-in) and
   *  the next upcoming date was 'next' found (startsAt/endsAt time it), 'none' (there is none),
   *  or 'unknown' (the lookup failed — the notice names only the cancelled date). */
  cancelledShown: null | 'next' | 'none' | 'unknown'
}

/** An event card placed in the ranked community feed (W1.6b). */
export interface EventFeedItem extends EventCardItem {
  /** ranked_feed_v2 score — used to interleave among posts. */
  score: number
  /** Coarse distance bucket from the RPC ('<2km'…'>50km'|'unknown'). */
  distanceBucket: string
}

/** The occurrence + event columns both member surfaces hydrate (select on event_occurrences,
 *  by the occurrence ids the server returned). The organization is read by id through the
 *  normal RLS select; no profile column is read. org_id (NOT NULL) is the event's own column, so
 *  "Edit in admin" knows the organization even when the organization embed is not readable. */
export const EVENT_OCCURRENCE_SELECT = `
  id, starts_at, ends_at, status, notes, capacity, source,
  event:assistance_events(
    id, org_id, title, event_type, location_name, city, state, requires_registration, time_zone, recurrence,
    organization:organizations(name)
  )
`

/** One hydrated event_occurrences row of EVENT_OCCURRENCE_SELECT. */
export interface EventOccurrenceRow {
  id: string
  starts_at: string
  ends_at: string
  status: string
  notes?: string | null
  capacity?: number | null
  /** 'rule' (generated from the repeat rule) | 'manual' (added by hand). */
  source?: string | null
  event: {
    id: string
    org_id: string
    title: string
    event_type: string
    location_name: string | null
    city: string | null
    state: string | null
    requires_registration: boolean | null
    time_zone: string
    recurrence?: unknown
    organization: { name: string } | null
  } | null
}

/** One row of the members' upcoming_events RPC (ids + times only). When the event's shown date
 *  was cancelled, cancelled_* is that date and occurrence_id / starts_at / ends_at the event's
 *  next upcoming date (NULL when there is none). */
export interface UpcomingEventRow {
  event_id: string
  occurrence_id: string | null
  starts_at: string | null
  ends_at: string | null
  cancelled_occurrence_id: string | null
  cancelled_starts_at: string | null
}

/** The next upcoming date of an event (event_occurrences, status 'upcoming'). */
export interface NextDateRow {
  id: string
  starts_at: string
  ends_at: string
}

/** A shown date to render, in display order. `next` is the event's next upcoming date when the
 *  shown date was cancelled and the server already returned it (null = there is none);
 *  undefined = not known yet (the loader looks it up). */
export interface ShownEventRef {
  occurrenceId: string
  next?: NextDateRow | null
}

function toEventCardItem(o: EventOccurrenceRow): EventCardItem | null {
  if (!o.event) return null
  const recurrence = parseRecurrenceRule(o.event.recurrence ?? null)
  const shownCancelled = o.status === 'cancelled'
  return {
    occurrenceId: o.id,
    eventId: o.event.id,
    orgId: o.event.org_id,
    title: o.event.title,
    eventType: o.event.event_type,
    orgName: o.event.organization?.name ?? null,
    startsAt: o.starts_at,
    endsAt: o.ends_at,
    timeZone: o.event.time_zone,
    locationName: o.event.location_name ?? null,
    city: o.event.city ?? null,
    state: o.event.state ?? null,
    status: o.status,
    requiresRegistration: o.event.requires_registration ?? false,
    capacity: o.capacity ?? null,
    notes: o.notes ?? null,
    recurrence,
    isExtraDate: recurrence !== null && o.source === 'manual',
    cancelledStartsAt: shownCancelled ? o.starts_at : null,
    // Until the next date is known, a cancelled shown date names only itself.
    cancelledShown: shownCancelled ? 'unknown' : null,
  }
}

/**
 * Build the cards for shown dates in the given order. A shown date the caller's RLS read did not
 * return (or whose event is missing) is skipped (I4 — the same drop-unhydrated rule the posts
 * path uses); a second date of an event already listed is skipped (one card per event).
 */
export function buildEventCards(
  refs: readonly ShownEventRef[],
  rows: readonly EventOccurrenceRow[],
): EventCardItem[] {
  const byId = new Map(rows.map((o) => [o.id, o]))
  const seen = new Set<string>()
  const out: EventCardItem[] = []
  for (const ref of refs) {
    const o = byId.get(ref.occurrenceId)
    const item = o ? toEventCardItem(o) : null
    if (!item || seen.has(item.eventId)) continue
    seen.add(item.eventId)
    if (item.cancelledShown !== null && ref.next !== undefined) {
      out.push(withNextDate(item, ref.next))
    } else {
      out.push(item)
    }
  }
  return out
}

/** The shown dates of a ranked_feed_v2 page, in rank order. */
export function rankedEventRefs(ranked: readonly RankedFeedV2Row[]): ShownEventRef[] {
  return ranked.filter((r) => r.kind === 'event').map((r) => ({ occurrenceId: r.id }))
}

/** Attach each card's ranked_feed_v2 score and distance bucket (cards built in rank order). */
export function rankEventCards(ranked: readonly RankedFeedV2Row[], cards: readonly EventCardItem[]): EventFeedItem[] {
  const rankById = new Map(ranked.filter((r) => r.kind === 'event').map((r) => [r.id, r]))
  const out: EventFeedItem[] = []
  for (const c of cards) {
    const r = rankById.get(c.occurrenceId)
    if (r) out.push({ ...c, score: r.score, distanceBucket: r.distance_bucket })
  }
  return out
}


/**
 * The Events tab's shown dates in upcoming_events order (by the shown date's start). For an event
 * whose shown date was cancelled the RPC returns that date as cancelled_* and the event's next
 * upcoming date (or NULL) as occurrence_id / starts_at / ends_at.
 */
export function upcomingEventRefs(upcoming: readonly UpcomingEventRow[]): ShownEventRef[] {
  const refs: ShownEventRef[] = []
  for (const u of upcoming) {
    if (u.cancelled_occurrence_id) {
      const next = u.occurrence_id && u.starts_at && u.ends_at
        ? { id: u.occurrence_id, starts_at: u.starts_at, ends_at: u.ends_at }
        : null
      refs.push({ occurrenceId: u.cancelled_occurrence_id, next })
    } else if (u.occurrence_id) {
      refs.push({ occurrenceId: u.occurrence_id })
    }
  }
  return refs
}

/** A cancelled shown date with its next upcoming date known: null = there is none. */
function withNextDate<T extends EventCardItem>(item: T, next: NextDateRow | null): T {
  if (!next) return { ...item, cancelledShown: 'none' }
  return { ...item, cancelledShown: 'next', startsAt: next.starts_at, endsAt: next.ends_at }
}

/**
 * Fill in the next upcoming date of each card whose shown date was cancelled and whose next date
 * is not known yet. `nextByEvent` is null when the lookup failed (the card then names only the
 * cancelled date); an event missing from the map has no upcoming date.
 */
export function applyNextDates<T extends EventCardItem>(
  items: readonly T[],
  nextByEvent: ReadonlyMap<string, NextDateRow> | null,
): T[] {
  return items.map((item) => {
    if (item.cancelledShown !== 'unknown' || nextByEvent === null) return item
    return withNextDate(item, nextByEvent.get(item.eventId) ?? null)
  })
}

/**
 * Append the next feed page's events, keeping one card per event across pages: an event already
 * listed is skipped even when its shown date moved on between the two page loads (a different
 * occurrence id for the same event).
 */
export function appendNewEvents(
  prev: readonly EventFeedItem[],
  next: readonly EventFeedItem[],
): EventFeedItem[] {
  const seen = new Set(prev.map((e) => e.eventId))
  const out = [...prev]
  for (const e of next) {
    if (seen.has(e.eventId)) continue
    seen.add(e.eventId)
    out.push(e)
  }
  return out
}

export type EventDayGroup = 'today' | 'week' | 'later'

/** The instant a card is filed under: the cancelled date for a card whose shown date was
 *  cancelled (that is the date the notice is about), else the date it times. */
export function eventCardDay(item: Pick<EventCardItem, 'startsAt' | 'cancelledShown' | 'cancelledStartsAt'>): string {
  return item.cancelledShown !== null && item.cancelledStartsAt ? item.cancelledStartsAt : item.startsAt
}

/**
 * Group Events-tab cards by the VENUE's calendar day: Today (the venue's today, or started on an
 * earlier day and still running), This week (the next six venue days), Later. Order within a
 * group is kept.
 */
export function groupEventsByVenueDay<T extends Pick<EventCardItem, 'startsAt' | 'timeZone' | 'cancelledShown' | 'cancelledStartsAt'>>(
  items: readonly T[],
  nowMs: number,
): Record<EventDayGroup, T[]> {
  const groups: Record<EventDayGroup, T[]> = { today: [], week: [], later: [] }
  const nowIso = new Date(nowMs).toISOString()
  for (const item of items) {
    const tz = isKnownTimeZone(item.timeZone) ? item.timeZone : 'UTC'
    const day = venueDateKey(eventCardDay(item), tz)
    const today = venueDateKey(nowIso, tz)
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    groups[diff <= 0 ? 'today' : diff < 7 ? 'week' : 'later'].push(item)
  }
  return groups
}

/** Whether the card times a date (and so shows the when line, timing and check-in state). */
export function eventCardHasDate(item: Pick<EventCardItem, 'cancelledShown'>): boolean {
  return item.cancelledShown === null || item.cancelledShown === 'next'
}

/**
 * A date as members read it: the viewer's local date, plus the venue's date whenever that reads
 * differently ("Fri, Oct 9 (Venue time: Sat, Oct 10)"), so a remote viewer never sees a date
 * that contradicts the venue-day group it is filed under. Same rule as formatCancelledNotice.
 */
export function memberDateText(iso: string, venueTz: string | null | undefined, locale: Locale = 'en', viewerTz?: string): string {
  const viewer = formatShortDate(iso, locale, viewerTz)
  if (!venueTz || !isKnownTimeZone(venueTz)) return viewer
  const venue = formatShortDate(iso, locale, venueTz)
  return venue === viewer ? viewer : `${viewer} (${formatMessage(eventFormT(locale, 'whenVenueTime'), { when: venue })})`
}

/** The repeat line of a card: "Every week on Saturday · Next: Sat, Oct 24"; the pattern alone
 *  when the shown date was cancelled (the notice names the next date); null for an event
 *  without a repeat rule. */
export function eventRepeatLine(
  item: Pick<EventCardItem, 'recurrence' | 'startsAt' | 'cancelledShown' | 'timeZone'>,
  locale: Locale = 'en',
  viewerTz?: string,
): string | null {
  if (!item.recurrence) return null
  const pattern = formatRecurrence(item.recurrence, locale)
  // A cancelled shown date's notice already names the next date (or says there is none).
  if (item.cancelledShown !== null) return pattern
  const next = formatMessage(eventFormT(locale, 'nextDate'), {
    when: memberDateText(item.startsAt, item.timeZone, locale, viewerTz),
  })
  return `${pattern} · ${next}`
}

/** The cancelled-date notice of a card: "Sat, Oct 10 cancelled — next: Sat, Oct 24", or
 *  "Sat, Oct 10 cancelled" alone when no following date is known; null when nothing was cancelled. */
export function eventCancelledLine(
  item: Pick<EventCardItem, 'cancelledStartsAt' | 'startsAt' | 'cancelledShown' | 'timeZone'>,
  locale: Locale = 'en',
  viewerTz?: string,
): string | null {
  if (!item.cancelledStartsAt) return null
  const next = item.cancelledShown === 'next' ? item.startsAt : null
  return formatCancelledNotice(item.cancelledStartsAt, next, locale, viewerTz, item.timeZone)
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
 * The label is in the viewer's locale (lib/i18n-event-forms.ts).
 */
export function eventTimingLabel(
  nowMs: number,
  startsAtMs: number,
  endsAtMs: number,
  locale: Locale = 'en'
): { label: string; isLive: boolean } {
  const t = (key: keyof EventFormMessages, n?: number) =>
    n === undefined ? eventFormT(locale, key) : formatMessage(eventFormT(locale, key), { n })
  if (nowMs >= startsAtMs && nowMs <= endsAtMs) return { label: t('timingNow'), isLive: true }
  if (nowMs > endsAtMs) return { label: t('timingEnded'), isLive: false }
  // Intl.RelativeTimeFormat supplies each language's plural forms; the dictionary phrases are
  // used where the runtime has no relative-time data for the locale (ht, hmn).
  const mins = Math.max(1, Math.round((startsAtMs - nowMs) / 60000))
  if (mins <= 60) return { label: relativeTimeText(mins, 'minute', locale) ?? t('timingMinutes', mins), isLive: false }
  const hours = Math.round(mins / 60)
  if (hours < 24) return { label: relativeTimeText(hours, 'hour', locale) ?? t('timingHours', hours), isLive: false }
  const days = Math.round(hours / 24)
  const fallback = days === 1 ? t('timingOneDay') : t('timingDays', days)
  return { label: relativeTimeText(days, 'day', locale) ?? fallback, isLive: false }
}

const DISTANCE_KEYS: Record<string, keyof EventFormMessages> = {
  '<2km': 'distUnder2',
  '2-10km': 'dist2to10',
  '10-50km': 'dist10to50',
  '>50km': 'distOver50',
}

/** Distance-bucket label for an event card in the viewer's locale; null hides the row when unknown. */
export function distanceBucketLabel(bucket: string | null | undefined, locale: Locale = 'en'): string | null {
  const key = bucket ? DISTANCE_KEYS[bucket] : undefined
  return key ? eventFormT(locale, key) : null // 'unknown' or absent → no distance shown
}

// ---------------------------------------------------------------------------
// Realtime patch (W1.4) + post-editing classification (PR-2)
// ---------------------------------------------------------------------------

/**
 * The posts-row columns a realtime UPDATE carries (the posts publication column
 * list). All are physically on the posts row, so a WAL UPDATE ships every one of
 * them — the patch below re-derives the on-row view fields from them while
 * preserving the fields that come from JOINs or the client (see applyPostRowPatch).
 */
export interface PostRowPatch {
  id: string
  user_id?: string | null
  content?: string | null
  is_pinned?: boolean | null
  post_type?: string | null
  metadata?: unknown
  image_url?: string | null
  image_alt?: string | null
  petition_id?: string | null
  max_seekers?: number | null
  like_count?: number | null
  comment_count?: number | null
  slots_remaining?: number | null
  is_hidden?: boolean | null
  hidden_reason?: string | null
  version?: number | null
  edited_at?: string | null
  edit_count?: number | null
  deleted_at?: string | null
}

/**
 * Patch a single post in place from a posts realtime UPDATE row (W1.4), or from the
 * row the author's own edit settled with (PR-2).
 *
 * A posts WAL UPDATE carries the full posts row, so this refreshes every on-row
 * view field — content, category (from is_pinned), postType, the metadata-derived
 * eventMeta / requestCategories, imageUrl / imageAlt, petitionId, maxSeekers, the
 * edit state (version, editedAt, editCount) — and takes the SERVER's absolute counts
 * (like_count -> likes, comment_count -> comments). No client-side arithmetic, so a
 * dropped or duplicated event cannot drift a count.
 *
 * VERSION GUARD (PR-2): `version` moves only on content edits, never on likes,
 * comments or opt-ins. A row whose version is LOWER than the one already shown is a
 * stale echo (e.g. the realtime copy of an edit the author's dialog already settled
 * past): it is ignored entirely, so the card never reverts to older text.
 *
 * PRESERVED (not on the WAL row): author/profile, the joined resource name and
 * category, and distanceBucket / score (ranked-feed-only). The post is matched by id;
 * every other post is returned untouched and list ORDER is preserved (an edit is
 * never a bump). When the row's id is not present, or the row is stale, the original
 * array is returned unchanged — a true no-op (same reference).
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
    imageAlt: string | null
    version: number
    editedAt: Date | null
    editCount: number
    isHidden: boolean
    hiddenReason: string | null
    eventMeta: EventMeta | null
    requestCategories: string[]
  }
>(posts: readonly T[], row: PostRowPatch): T[] {
  const current = posts.find((p) => p.id === row.id)
  if (!current) return posts as T[]
  if (row.version != null && row.version < current.version) return posts as T[]
  return posts.map((p) => {
    if (p.id !== row.id) return p
    const postType = row.post_type != null ? coercePostType(row.post_type) : p.postType
    const metadata = 'metadata' in row ? row.metadata : undefined
    return {
      ...p,
      content: row.content ?? p.content,
      // Absolute server counts — never incremented.
      likes: row.like_count ?? p.likes,
      comments: row.comment_count ?? p.comments,
      category: row.is_pinned != null ? (row.is_pinned ? 'announcement' : 'update') : p.category,
      postType,
      imageUrl: 'image_url' in row ? row.image_url ?? null : p.imageUrl,
      imageAlt: 'image_alt' in row ? row.image_alt ?? null : p.imageAlt,
      petitionId: row.petition_id ?? p.petitionId,
      // max_seekers may be set back to null (unlimited) by an edit: take the row's value when it carries the key.
      maxSeekers: 'max_seekers' in row ? row.max_seekers ?? null : p.maxSeekers,
      // Forward-safe: keep the prior cap when the row omits slots_remaining.
      slotsRemaining: 'slots_remaining' in row ? row.slots_remaining ?? null : p.slotsRemaining,
      version: row.version ?? p.version,
      editedAt: 'edited_at' in row ? (row.edited_at ? new Date(row.edited_at) : null) : p.editedAt,
      editCount: row.edit_count ?? p.editCount,
      isHidden: row.is_hidden ?? p.isHidden,
      hiddenReason: 'hidden_reason' in row ? row.hidden_reason ?? null : p.hiddenReason,
      eventMeta:
        postType === 'event_post' ? (metadata !== undefined ? parseEventMeta(metadata) : p.eventMeta) : null,
      requestCategories:
        postType === 'seeker_request' || postType === 'source_offer'
          ? metadata !== undefined
            ? parseCategories(metadata)
            : p.requestCategories
          : [],
    }
  })
}

/** A FEED_POST_SELECT row as a patch (settle a card from a fresh read of its row). */
export function rowPatchFromFeedRow(row: FeedPostRow): PostRowPatch {
  return {
    id: row.id,
    user_id: row.user?.id ?? null,
    content: row.content,
    is_pinned: row.is_pinned,
    post_type: row.post_type,
    metadata: row.metadata,
    image_url: row.image_url,
    image_alt: row.image_alt ?? null,
    petition_id: row.petition_id,
    max_seekers: row.max_seekers,
    like_count: row.like_count,
    comment_count: row.comment_count,
    slots_remaining: row.slots_remaining,
    is_hidden: row.is_hidden,
    hidden_reason: row.hidden_reason ?? null,
    version: row.version ?? null,
    edited_at: row.edited_at ?? null,
    edit_count: row.edit_count ?? null,
  }
}

/** When the re-read after a save failed: the saved changes + the server's new version / edit time. */
export function editFallbackPatch(
  postId: string,
  result: { version: number; editedAt: string | null; editCount: number },
  changes: Record<string, unknown>,
): PostRowPatch {
  const patch: PostRowPatch = { id: postId, version: result.version, edited_at: result.editedAt, edit_count: result.editCount }
  if (typeof changes.content === 'string') patch.content = changes.content
  if ('image_url' in changes) patch.image_url = (changes.image_url as string | null) ?? null
  if ('image_alt' in changes) patch.image_alt = (changes.image_alt as string | null) ?? null
  if ('max_seekers' in changes) patch.max_seekers = (changes.max_seekers as number | null) ?? null
  return patch
}

/** What the feed does with one posts realtime UPDATE (classifyPostUpdate). */
export type PostUpdateAction =
  /** The post is listed and still readable: patch it in place (version-guarded, no re-rank). */
  | 'patch'
  /** The viewer's OWN post was held / hidden: keep it with its "Hidden pending review" banner. */
  | 'mark_held'
  /** Deleted by its author, or hidden for a viewer who is not its author: take the card out. */
  | 'remove'
  /** A post this session took out because it was hidden is visible again: read it and put it back. */
  | 'restore'
  /** Anything else (a like, comment or edit on a post that is not listed): nothing to do. Never a reload. */
  | 'ignore'

export interface PostUpdateContext {
  /** The id is in the rendered list. */
  inList: boolean
  /** The signed-in viewer's id (null when logged out). */
  viewerId: string | null
  /** Ids this session removed because they became hidden (candidates for 'restore'). */
  removedHiddenIds: ReadonlySet<string>
}

/**
 * Decide what a posts realtime UPDATE does to the feed. Replaces "any UPDATE for a post not on
 * screen reloads the whole feed": every like and comment fires a posts UPDATE (counter triggers),
 * so that rule reloaded every connected feed on every interaction anywhere.
 *
 * Realtime delivers a row only to viewers who can still read it (RLS): a post that becomes hidden
 * reaches its author and staff; a deleted one reaches staff only (and the author's other tabs see
 * the delete through their own list). Staff do not keep hidden posts in the feed — the moderation
 * queue is their review surface.
 */
export function classifyPostUpdate(row: PostRowPatch, ctx: PostUpdateContext): PostUpdateAction {
  const deleted = row.deleted_at != null
  const hidden = row.is_hidden === true || deleted
  const isAuthor = ctx.viewerId != null && row.user_id === ctx.viewerId
  if (hidden) {
    if (!ctx.inList) return 'ignore'
    if (isAuthor && !deleted) return 'mark_held'
    return 'remove'
  }
  if (ctx.inList) return 'patch'
  return ctx.removedHiddenIds.has(row.id) ? 'restore' : 'ignore'
}

// ---------------------------------------------------------------------------
// Member event time line (PR-2)
// ---------------------------------------------------------------------------

/** A member event's when line, as data the card renders. */
export type MemberEventWhen =
  /** Zoned: start/end are instants; render with formatEventWhen (viewer time + venue time). */
  | { kind: 'zoned'; startIso: string; endIso: string | null; timeZone: string }
  /** Legacy (no zone): the wall-clock text exactly as entered, labelled "local time". The end is
   *  shown only when it is after the start (production's legacy row ends before it starts). */
  | { kind: 'local'; start: string; end: string | null }

const LOCAL_WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/

/**
 * Turn an event_post's stored wall-clock times into what the card shows. Zoned: each wall time is
 * resolved in the venue zone (checkLocalTime, the same DST rule as the server); a time that does
 * not resolve falls back to the legacy reading. Legacy: shown as entered.
 */
export function memberEventWhen(
  meta: Pick<EventMeta, 'startsAt' | 'endsAt' | 'timeZone'>,
  resolve: (date: string, time: string, tz: string) => { kind: string; instant?: Date },
): MemberEventWhen {
  const toInstant = (local: string, tz: string): string | null => {
    const m = LOCAL_WALL_CLOCK.exec(local)
    if (!m) return null
    const r = resolve(m[1], m[2], tz)
    return r.kind === 'ok' && r.instant ? r.instant.toISOString() : null
  }
  const endAfterStart = (a: string, b: string | null) => (b != null && b > a ? b : null)
  if (meta.timeZone) {
    const startIso = toInstant(meta.startsAt, meta.timeZone)
    if (startIso) {
      const endIsoRaw = meta.endsAt ? toInstant(meta.endsAt, meta.timeZone) : null
      return { kind: 'zoned', startIso, endIso: endAfterStart(startIso, endIsoRaw), timeZone: meta.timeZone }
    }
  }
  return { kind: 'local', start: meta.startsAt, end: endAfterStart(meta.startsAt, meta.endsAt) }
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
