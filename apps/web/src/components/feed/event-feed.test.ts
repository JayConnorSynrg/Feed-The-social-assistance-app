/**
 * event-feed.test.ts
 *
 * Outcome tests for the W1.6b "events in the ranked feed" pure model:
 *   - partitionRankedRows splits the cross-kind page into post ids / event ids
 *   - feedIncludesEvents gates events to ranked-mode + "All" only
 *   - mergeRankedFeedItems interleaves events among posts in global rank order,
 *     keeps a live (score-less) post on top, and preserves post order exactly
 *     (I4 — every ranked row renders once, in rank order; posts never regress)
 *   - eventTimingLabel / distanceBucketLabel produce the card's timing + distance
 *     copy from now-vs-start math and the coarse bucket
 *
 * Two MUTATION PROOFS are called out inline (M-A, M-B): each asserts a property
 * that flips if the implementation regresses in a specific, named way.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { checkinButtonLabel, eventFormMessages } from '@/lib/i18n-event-forms'
import {
  partitionRankedRows,
  feedIncludesEvents,
  mergeRankedFeedItems,
  eventTimingLabel,
  distanceBucketLabel,
  hydrateEventFeedItems,
  type FeedEventOccurrenceRow,
  type RankedFeedV2Row,
  type Post,
  type EventFeedItem,
} from './post-model'

function post(id: string, score?: number): Post {
  return {
    id,
    author: { id: 'u', name: 'U', role: 'Community Member', harmonyScore: null, harmonyReviewsCount: 0, badgeSummary: null },
    content: '', timestamp: new Date(0), likes: 0, comments: 0, isLiked: false,
    category: 'update', resourceId: null, resourceName: null, resourceCategory: null,
    maxSeekers: null, slotsRemaining: null, postType: 'feed', petitionId: null,
    isHidden: false, imageUrl: null, eventMeta: null, requestCategories: [],
    score,
  }
}

function eventItem(occId: string, score: number): EventFeedItem {
  return {
    occurrenceId: occId, eventId: 'e-' + occId, title: 'T', eventType: 'meal', orgName: null,
    startsAt: new Date().toISOString(), endsAt: new Date().toISOString(), timeZone: 'America/New_York',
    locationName: null, city: null, state: null, status: 'upcoming', requiresRegistration: false,
    score, distanceBucket: 'unknown',
  }
}

describe('W1.6b — partitionRankedRows', () => {
  it('splits post and event rows preserving each list order', () => {
    const rows: RankedFeedV2Row[] = [
      { id: 'p1', kind: 'post', score: 9, distance_bucket: 'unknown' },
      { id: 'o1', kind: 'event', score: 8, distance_bucket: '<2km' },
      { id: 'p2', kind: 'post', score: 7, distance_bucket: '2-10km' },
      { id: 'o2', kind: 'event', score: 6, distance_bucket: 'unknown' },
    ]
    const { postIds, eventIds } = partitionRankedRows(rows)
    expect(postIds).toEqual(['p1', 'p2'])
    expect(eventIds).toEqual(['o1', 'o2'])
  })
})

describe('W1.6b — feedIncludesEvents (filter rules)', () => {
  it('includes events ONLY in ranked mode under "all"', () => {
    expect(feedIncludesEvents('ranked', 'all')).toBe(true)
  })
  it('excludes events in Recent mode and under author-scoped filters', () => {
    expect(feedIncludesEvents('recent', 'all')).toBe(false)
    expect(feedIncludesEvents('ranked', 'following')).toBe(false)
    expect(feedIncludesEvents('ranked', 'mine')).toBe(false)
    expect(feedIncludesEvents('ranked', 'announcements')).toBe(false)
  })
})

describe('W1.6b — mergeRankedFeedItems', () => {
  it('interleaves events among posts in (score DESC, id DESC) order', () => {
    const posts = [post('p_a', 10), post('p_b', 5)]      // pre-sorted desc
    const events = [eventItem('o_x', 8), eventItem('o_y', 3)]
    const merged = mergeRankedFeedItems(posts, events)
    expect(merged.map((m) => (m.kind === 'post' ? m.post.id : m.event.occurrenceId)))
      .toEqual(['p_a', 'o_x', 'p_b', 'o_y'])
  })

  it('keeps a live (score-undefined) post ahead of every scored row', () => {
    const posts = [post('live'), post('p1', 100)]        // live insert has no score
    const events = [eventItem('o1', 1000)]               // higher score than any post
    const merged = mergeRankedFeedItems(posts, events)
    // M-A (MUTATION PROOF): if the undefined-score branch were dropped (treated as
    // -Infinity or 0), 'live' would sink below the score-1000 event. It must stay first.
    expect(merged[0].kind === 'post' && merged[0].post.id).toBe('live')
    expect(merged.map((m) => (m.kind === 'post' ? m.post.id : m.event.occurrenceId)))
      .toEqual(['live', 'o1', 'p1'])
  })

  it('preserves post order exactly and drops nothing (I4)', () => {
    const posts = [post('p1', 9), post('p2', 7), post('p3', 5)]
    const events = [eventItem('o1', 8)]
    const merged = mergeRankedFeedItems(posts, events)
    const postSeq = merged.filter((m) => m.kind === 'post').map((m) => (m as { post: Post }).post.id)
    // Post subsequence identical to input order → posts never regress when events mix in.
    expect(postSeq).toEqual(['p1', 'p2', 'p3'])
    expect(merged.length).toBe(4) // every row rendered once
  })

  it('breaks a score tie by id DESC (deterministic, matches the RPC keyset)', () => {
    // M-B (MUTATION PROOF): equal scores — the id DESC tiebreak decides. A post with
    // id 'p_zzz' > event id 'o_aaa', so the post comes first. If the tiebreak were
    // dropped (or reversed to id ASC), the order flips and this assertion fails.
    const posts = [post('z_post', 5)]                    // post id > event id → post first
    const events = [eventItem('a_occ', 5)]
    const merged = mergeRankedFeedItems(posts, events)
    expect(merged[0].kind).toBe('post')
    const events2 = [eventItem('z_occ', 5)]              // event id now > post id → event first
    const merged2 = mergeRankedFeedItems([post('a_post', 5)], events2)
    expect(merged2[0].kind).toBe('event')
  })

  it('returns posts alone when there are no events', () => {
    const merged = mergeRankedFeedItems([post('p1', 3), post('p2', 1)], [])
    expect(merged.map((m) => (m as { post: Post }).post.id)).toEqual(['p1', 'p2'])
  })
})

describe('W1.6b — eventTimingLabel (age math)', () => {
  const start = 1_000_000_000_000
  const end = start + 2 * 3600_000
  it('flags an in-progress occurrence as live', () => {
    const r = eventTimingLabel(start + 3600_000, start, end)
    expect(r.isLive).toBe(true)
    expect(r.label).toBe('Happening now')
  })
  it('labels minutes / hours / days before the start', () => {
    expect(eventTimingLabel(start - 20 * 60_000, start, end)).toMatchObject({ isLive: false, label: 'Starts in 20 min' })
    expect(eventTimingLabel(start - 3 * 3600_000, start, end)).toMatchObject({ isLive: false, label: 'Starts in 3 h' })
    expect(eventTimingLabel(start - 2 * 86_400_000, start, end)).toMatchObject({ isLive: false, label: 'In 2 days' })
  })
  it('labels an ended occurrence', () => {
    expect(eventTimingLabel(end + 60_000, start, end)).toMatchObject({ isLive: false, label: 'Ended' })
  })
})

describe('W1.6b — distanceBucketLabel', () => {
  it('maps each known bucket and hides unknown/absent', () => {
    expect(distanceBucketLabel('<2km')).toBe('Within 2 km')
    expect(distanceBucketLabel('2-10km')).toBe('2–10 km away')
    expect(distanceBucketLabel('10-50km')).toBe('10–50 km away')
    expect(distanceBucketLabel('>50km')).toBe('Over 50 km away')
    expect(distanceBucketLabel('unknown')).toBeNull()
    expect(distanceBucketLabel(undefined)).toBeNull()
  })
})

describe('hydrateEventFeedItems — the venue time zone reaches the card', () => {
  const occ = (id: string, tz: string): FeedEventOccurrenceRow => ({
    id, starts_at: '2026-11-10T15:00:00Z', ends_at: '2026-11-10T16:30:00Z', status: 'upcoming',
    event: {
      id: 'e-' + id, title: 'Meal ' + id, event_type: 'meal', location_name: null, city: 'Rutland', state: 'VT',
      requires_registration: null, time_zone: tz, organization: { name: 'FEED' },
    },
  })

  it('maps each ranked event row in RPC order and carries time_zone as timeZone', () => {
    const ranked: RankedFeedV2Row[] = [
      { id: 'p1', kind: 'post', score: 9, distance_bucket: 'unknown' },
      { id: 'o2', kind: 'event', score: 8, distance_bucket: '<2km' },
      { id: 'o1', kind: 'event', score: 7, distance_bucket: 'unknown' },
    ]
    const items = hydrateEventFeedItems(ranked, [occ('o1', 'America/Chicago'), occ('o2', 'America/New_York')])
    expect(items.map((i) => [i.occurrenceId, i.timeZone, i.score, i.distanceBucket])).toEqual([
      ['o2', 'America/New_York', 8, '<2km'],
      ['o1', 'America/Chicago', 7, 'unknown'],
    ])
    expect(items[0]).toMatchObject({ eventId: 'e-o2', orgName: 'FEED', requiresRegistration: false })
  })

  it('drops an event row the caller could not read (RLS) or whose event is missing', () => {
    const ranked: RankedFeedV2Row[] = [
      { id: 'o1', kind: 'event', score: 8, distance_bucket: 'unknown' },
      { id: 'o3', kind: 'event', score: 7, distance_bucket: 'unknown' },
    ]
    const orphan = { ...occ('o3', 'America/New_York'), event: null }
    expect(hydrateEventFeedItems(ranked, [orphan]).map((i) => i.occurrenceId)).toEqual([])
  })
})

const card = readFileSync(fileURLToPath(new URL('./event-feed-card.tsx', import.meta.url)), 'utf8')

describe('feed card copy is translated', () => {
  // The card is what every feed viewer sees; its labels come from lib/i18n-event-forms.ts.
  it('renders "Event" and "Walk-in welcome" through the event dictionary, not English literals', () => {
    expect(card).toMatch(/eventFormT\(locale, 'cardEventBadge'\)/)
    expect(card).toMatch(/eventFormT\(locale, 'cardWalkIn'\)/)
    expect(card).not.toMatch(/Walk-in welcome/)
    expect(card).not.toMatch(/\/>\s*Event\s*</)
  })
  it('every locale has both labels', () => {
    for (const m of Object.values(eventFormMessages)) {
      expect(m.cardEventBadge.trim()).not.toBe('')
      expect(m.cardWalkIn.trim()).not.toBe('')
    }
    expect(eventFormMessages.es.cardWalkIn).toBe('Sin cita previa')
  })
})

describe('timing / distance / check-in labels follow the viewer locale', () => {
  const now = Date.UTC(2026, 10, 10, 12, 0)
  it('timing', () => {
    expect(eventTimingLabel(now, now + 5 * 60000, now + 65 * 60000, 'es').label).toBe('Empieza en 5 min')
    expect(eventTimingLabel(now, now + 3 * 3600000, now + 4 * 3600000, 'fr').label).toBe('Commence dans 3 h')
    expect(eventTimingLabel(now, now + 24 * 3600000, now + 25 * 3600000, 'en').label).toBe('In 1 day')
    expect(eventTimingLabel(now, now + 72 * 3600000, now + 73 * 3600000, 'ko').label).toBe('3일 후')
    expect(eventTimingLabel(now, now - 60000, now + 60000, 'ar')).toEqual({ label: 'يجري الآن', isLive: true })
  })
  it('distance', () => {
    expect(distanceBucketLabel('<2km', 'fr')).toBe('À moins de 2 km')
    expect(distanceBucketLabel('unknown', 'fr')).toBeNull()
  })
  it('check-in button: every kind has a translation; an unknown kind keeps its English label', () => {
    expect(checkinButtonLabel('in_window', "I'm here", 'es')).toBe('Ya llegué')
    expect(checkinButtonLabel('early', 'Check in early', 'zh')).toBe('提前签到')
    expect(checkinButtonLabel('mystery', 'Mystery', 'es')).toBe('Mystery')
  })
  it('the card and the Events panel render those labels in the viewer locale, with readable contrast', () => {
    const panel = readFileSync(fileURLToPath(new URL('../panels/events-panel.tsx', import.meta.url)), 'utf8')
    for (const src of [card, panel]) {
      expect(src.match(/checkinButtonLabel\(btn\.kind, btn\.label, locale\)/g)?.length).toBe(2)
      expect(src).not.toMatch(/\{btn\.label\}/)
    }
    expect(card).toMatch(/distanceBucketLabel\(event\.distanceBucket, locale\)/)
    expect(card).toMatch(/new Date\(event\.endsAt\)\.getTime\(\), locale\)/)
    // Distance text and the inert check-in pill: stone-600 (4.5:1+) on the card's light stone.
    expect(card).not.toMatch(/text-stone-400"> · \{distanceLabel\}/)
    expect(card).not.toMatch(/bg-stone-100 text-stone-500/)
    // Venue time is read before the timing label.
    expect(card.indexOf('{when.venue &&')).toBeLessThan(card.indexOf('{!timing.isLive &&'))
  })
})
