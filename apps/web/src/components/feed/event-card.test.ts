/**
 * event-card.test.ts
 *
 * What a member sees on an event card — the one card the community feed and the Events tab share
 * (components/feed/event-card.tsx) — and the pure model behind it (post-model.ts):
 *   - one card per event, in server order, with the repeat pattern and "Next: …" line
 *   - a shown date that was cancelled reads "Sat, Oct 10 cancelled — next: Sat, Oct 24" (or the
 *     cancelled date alone), offers no check-in, and is filed under the cancelled date's day
 *   - Events tab groups by the VENUE's day; paging never shows an event twice
 *   - the Events tab's loading / error / empty states, heading levels, lang/dir
 * Break-it proofs are named M-… inline; each was run as a mutant of the source (see the report).
 */

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))

import {
  appendNewEvents,
  applyNextDates,
  buildEventCards,
  eventCancelledLine,
  eventRepeatLine,
  groupEventsByVenueDay,
  memberDateText,
  upcomingEventRefs,
  type EventCardItem,
  type EventFeedItem,
  type EventOccurrenceRow,
  type UpcomingEventRow,
} from './post-model'
import { EventCard } from './event-card'
import { EventsTabView, type EventsTabState } from '@/components/panels/events-panel'

const NY = 'America/New_York'
const LA = 'America/Los_Angeles'
const SECOND_SATURDAY = { frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }] }

// Sat Oct 10 2026 10:00 New York = 14:00Z; Sat Oct 24 10:00 New York = 14:00Z.
const OCT10 = '2026-10-10T14:00:00Z'
const OCT10_END = '2026-10-10T16:00:00Z'
const OCT24 = '2026-10-24T14:00:00Z'
const OCT24_END = '2026-10-24T16:00:00Z'

function occ(
  id: string,
  eventId: string,
  o: Partial<Omit<EventOccurrenceRow, 'event'>> & { recurrence?: unknown; tz?: string } = {},
): EventOccurrenceRow {
  return {
    id,
    starts_at: o.starts_at ?? OCT24,
    ends_at: o.ends_at ?? OCT24_END,
    status: o.status ?? 'upcoming',
    notes: o.notes ?? null,
    capacity: o.capacity ?? null,
    source: o.source ?? 'rule',
    event: {
      id: eventId,
      title: 'Food pantry ' + eventId,
      event_type: 'pantry',
      location_name: 'Church hall',
      city: 'Rutland',
      state: 'VT',
      requires_registration: false,
      time_zone: o.tz ?? NY,
      recurrence: o.recurrence ?? null,
      organization: { name: 'Rutland Pantry' },
    },
  }
}

describe('one card per event, in server order (buildEventCards / upcomingEventRefs)', () => {
  it('keeps server order, skips rows RLS did not return, and lists each event once', () => {
    const rows = [occ('o1', 'e1'), occ('o2', 'e2'), occ('o3', 'e1', { starts_at: OCT10, ends_at: OCT10_END })]
    const items = buildEventCards(
      [{ occurrenceId: 'o2' }, { occurrenceId: 'missing' }, { occurrenceId: 'o1' }, { occurrenceId: 'o3' }],
      rows,
    )
    expect(items.map((i) => [i.eventId, i.occurrenceId])).toEqual([['e2', 'o2'], ['e1', 'o1']])
  })

  it('a repeating event carries its rule; a hand-added date of a series is an "extra date"; a one-off is neither', () => {
    const [series, extra, oneOff] = buildEventCards(
      [{ occurrenceId: 'a' }, { occurrenceId: 'b' }, { occurrenceId: 'c' }],
      [
        occ('a', 'e1', { recurrence: SECOND_SATURDAY }),
        occ('b', 'e2', { recurrence: SECOND_SATURDAY, source: 'manual' }),
        occ('c', 'e3', { source: 'manual' }),
      ],
    )
    expect(series.recurrence).toMatchObject({ frequency: 'monthly' })
    expect([series.isExtraDate, extra.isExtraDate, oneOff.isExtraDate]).toEqual([false, true, false])
    expect(oneOff.recurrence).toBeNull()
  })

  it('upcoming_events: an upcoming row shows that date; a cancelled row shows the cancelled date with the following date', () => {
    const rows: UpcomingEventRow[] = [
      { event_id: 'e1', occurrence_id: 'o24', starts_at: OCT24, ends_at: OCT24_END, cancelled_occurrence_id: 'o10', cancelled_starts_at: OCT10 },
      { event_id: 'e2', occurrence_id: null, starts_at: null, ends_at: null, cancelled_occurrence_id: 'p10', cancelled_starts_at: OCT10 },
      { event_id: 'e3', occurrence_id: 'q1', starts_at: OCT24, ends_at: OCT24_END, cancelled_occurrence_id: null, cancelled_starts_at: null },
    ]
    const refs = upcomingEventRefs(rows)
    // The card hydrates COALESCE(cancelled_occurrence_id, occurrence_id) — the feed's row id.
    expect(refs.map((r) => r.occurrenceId)).toEqual(['o10', 'p10', 'q1'])
    const items = buildEventCards(refs, [
      occ('o10', 'e1', { status: 'cancelled', starts_at: OCT10, ends_at: OCT10_END }),
      occ('p10', 'e2', { status: 'cancelled', starts_at: OCT10, ends_at: OCT10_END }),
      occ('q1', 'e3'),
    ])
    expect(items.map((i) => [i.cancelledShown, i.cancelledStartsAt, i.startsAt])).toEqual([
      ['next', OCT10, OCT24],
      ['none', OCT10, OCT10],
      [null, null, OCT24],
    ])
  })
})

describe('a cancelled shown date in the feed gets its next date from the lookup (applyNextDates)', () => {
  const [cancelled, upcoming] = buildEventCards(
    [{ occurrenceId: 'o10' }, { occurrenceId: 'x1' }],
    [occ('o10', 'e1', { status: 'cancelled', starts_at: OCT10, ends_at: OCT10_END }), occ('x1', 'e2')],
  )

  it('before the lookup the card names only the cancelled date', () => {
    expect(cancelled.cancelledShown).toBe('unknown')
    expect(eventCancelledLine(cancelled, 'en', NY)).toBe('Sat, Oct 10 cancelled')
  })

  it('found → the card times the next date; not found → the cancelled date alone; failed → unchanged', () => {
    const next = new Map([['e1', { id: 'o24', starts_at: OCT24, ends_at: OCT24_END }]])
    const [withNext, untouched] = applyNextDates([cancelled, upcoming], next)
    expect(withNext).toMatchObject({ cancelledShown: 'next', startsAt: OCT24, endsAt: OCT24_END, occurrenceId: 'o10' })
    expect(untouched).toBe(upcoming)
    expect(eventCancelledLine(withNext, 'en', NY)).toBe('Sat, Oct 10 cancelled — next: Sat, Oct 24')
    expect(applyNextDates([cancelled], new Map())[0].cancelledShown).toBe('none')
    expect(applyNextDates([cancelled], null)[0].cancelledShown).toBe('unknown')
  })
})

describe('feed paging never shows an event twice (appendNewEvents)', () => {
  const feedItem = (occurrenceId: string, eventId: string): EventFeedItem => ({
    ...buildEventCards([{ occurrenceId }], [occ(occurrenceId, eventId)])[0],
    score: 1,
    distanceBucket: 'unknown',
  })

  it('skips an event already listed even when its shown date moved on between pages', () => {
    // M-F1 (break-it): de-duplicating by occurrence id lets e1 appear twice here.
    const merged = appendNewEvents([feedItem('o1', 'e1')], [feedItem('o2', 'e1'), feedItem('o3', 'e2')])
    expect(merged.map((e) => e.eventId)).toEqual(['e1', 'e2'])
  })
})

describe('Events tab groups by the venue\'s calendar day (groupEventsByVenueDay)', () => {
  // now = Sat Oct 10 05:30Z = Fri Oct 9 22:30 in Los Angeles.
  const now = Date.parse('2026-10-10T05:30:00Z')
  const at = (startsAt: string, tz = LA, extra: Partial<EventCardItem> = {}) =>
    ({ startsAt, timeZone: tz, cancelledShown: null, cancelledStartsAt: null, ...extra }) as EventCardItem

  it('files by the venue\'s day, not the viewer\'s or UTC', () => {
    // M-T2 (break-it): grouping by the UTC/viewer day files Sat 09:00 LA (16:00Z) under Today.
    const g = groupEventsByVenueDay([at('2026-10-10T16:00:00Z'), at('2026-10-10T06:00:00Z'), at('2026-10-20T16:00:00Z')], now)
    expect(g.today.map((i) => i.startsAt)).toEqual(['2026-10-10T06:00:00Z'])
    expect(g.week.map((i) => i.startsAt)).toEqual(['2026-10-10T16:00:00Z'])
    expect(g.later.map((i) => i.startsAt)).toEqual(['2026-10-20T16:00:00Z'])
  })

  it('an event that started on an earlier day and is still running is Today', () => {
    expect(groupEventsByVenueDay([at('2026-10-08T16:00:00Z')], now).today).toHaveLength(1)
  })

  it('a cancelled shown date is filed under the cancelled day, not the next date', () => {
    const item = at('2026-10-24T16:00:00Z', LA, { cancelledShown: 'next', cancelledStartsAt: '2026-10-10T06:00:00Z' })
    expect(groupEventsByVenueDay([item], now).today).toHaveLength(1)
  })
})

describe('repeat and cancelled lines (viewer language, viewer dates)', () => {
  const [series] = buildEventCards([{ occurrenceId: 's' }], [occ('s', 'e1', { recurrence: SECOND_SATURDAY })])
  const [oneOff] = buildEventCards([{ occurrenceId: 'o' }], [occ('o', 'e2')])

  it('a repeating event reads "<pattern> · Next: <date>"; a one-off has no repeat line', () => {
    // M-C1 (break-it): always rendering a pattern line would give the one-off a line.
    expect(eventRepeatLine(series, 'en', NY)).toBe('Monthly on the second Saturday · Next: Sat, Oct 24')
    expect(eventRepeatLine(oneOff, 'en', NY)).toBeNull()
    expect(eventRepeatLine(series, 'es', NY)).toMatch(/^.+ · Próxima: .+/)
  })

  it('when the shown date was cancelled the repeat line names the pattern alone (the notice names the next date)', () => {
    expect(eventRepeatLine({ ...series, cancelledShown: 'none' }, 'en', NY)).toBe('Monthly on the second Saturday')
    expect(eventRepeatLine({ ...series, cancelledShown: 'next' }, 'en', NY)).toBe('Monthly on the second Saturday')
  })

  it('no cancelled date → no notice; translated notice in Spanish', () => {
    expect(eventCancelledLine(series, 'en', NY)).toBeNull()
    const c = { ...series, cancelledShown: 'next' as const, cancelledStartsAt: OCT10 }
    expect(eventCancelledLine(c, 'es', NY)).toMatch(/cancelada — próxima: /)
  })
})

describe('dates never contradict the venue day (memberDateText / notices)', () => {
  // Sat Oct 24 01:00 in New York = Fri Oct 23 22:00 in Los Angeles.
  const LATE = '2026-10-24T05:00:00Z'

  it('adds the venue date only when it reads differently from the viewer date', () => {
    // M-V1 (break-it): viewer-only dates show "Fri, Oct 23" for an event filed under the venue's Saturday.
    expect(memberDateText(LATE, NY, 'en', LA)).toBe('Fri, Oct 23 (Venue time: Sat, Oct 24)')
    expect(memberDateText(OCT24, NY, 'en', LA)).toBe('Sat, Oct 24')
    expect(memberDateText(LATE, NY, 'en', NY)).toBe('Sat, Oct 24')
  })

  it('the "Next:" line and the cancelled notice use the same rule', () => {
    const [series] = buildEventCards(
      [{ occurrenceId: 's' }],
      [occ('s', 'e1', { recurrence: SECOND_SATURDAY, starts_at: LATE, ends_at: '2026-10-24T07:00:00Z' })],
    )
    expect(eventRepeatLine(series, 'en', LA)).toBe('Monthly on the second Saturday · Next: Fri, Oct 23 (Venue time: Sat, Oct 24)')
    const cancelled = { ...series, cancelledShown: 'next' as const, cancelledStartsAt: '2026-10-10T05:00:00Z' }
    expect(eventCancelledLine(cancelled, 'en', LA)).toBe(
      'Fri, Oct 9 (Venue time: Sat, Oct 10) cancelled — next: Fri, Oct 23 (Venue time: Sat, Oct 24)',
    )
  })
})

describe('the shared card (render)', () => {
  const now = Date.parse('2026-10-22T14:00:00Z') // two days before Sat Oct 24
  const render = (item: EventCardItem, extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      h(EventCard, {
        event: item,
        locale: 'en',
        surface: 'events-tab',
        headingLevel: 4,
        myStatus: 'none',
        anonymousClaimed: false,
        onCheckedIn: () => {},
        now,
        viewerTz: NY,
        ...extra,
      }),
    )
  const [series] = buildEventCards(
    [{ occurrenceId: 's' }],
    [occ('s', 'e1', { recurrence: SECOND_SATURDAY, tz: LA, capacity: 40 })],
  )

  it('repeating event: title at the given level, pattern + next, venue time before the timing label, check-in offered', () => {
    const html = render(series)
    expect(html).toMatch(/<h4[^>]*>Food pantry e1<\/h4>/)
    expect(html).toContain('Monthly on the second Saturday · Next: Sat, Oct 24')
    expect(html).toContain('Capacity: 40')
    expect(html.indexOf('Venue time')).toBeGreaterThan(-1)
    expect(html.indexOf('Venue time')).toBeLessThan(html.indexOf('In 2 days'))
    expect(html).toMatch(/<button[^>]*>Check in early<\/button>/)
    expect(html).not.toContain('>Event<') // the "Event" marker is for the feed only
  })

  it('feed surface shows the Event marker and an h3 title', () => {
    const html = render(series, { surface: 'feed', headingLevel: 3, distanceBucket: '<2km' })
    expect(html).toContain('Event</span>')
    expect(html).toMatch(/<h3[^>]*>Food pantry e1<\/h3>/)
    expect(html).toContain('Within 2 km')
  })

  it('cancelled shown date with a next date: the notice, the next date\'s time, and no check-in', () => {
    // M-C3 (break-it): offering check-in on a cancelled shown date renders a button here.
    const [c] = applyNextDates(
      buildEventCards([{ occurrenceId: 'o10' }], [occ('o10', 'e1', { status: 'cancelled', starts_at: OCT10, ends_at: OCT10_END, recurrence: SECOND_SATURDAY })]),
      new Map([['e1', { id: 'o24', starts_at: OCT24, ends_at: OCT24_END }]]),
    )
    const html = renderToStaticMarkup(
      h(EventCard, { event: c, locale: 'en', surface: 'feed', myStatus: 'none', anonymousClaimed: false, onCheckedIn: () => {}, now: Date.parse('2026-10-10T12:00:00Z'), viewerTz: NY }),
    )
    expect(html).toContain('Sat, Oct 10 cancelled — next: Sat, Oct 24')
    // M-R1 (break-it): the repeat line's "Next:" or a dated time line would repeat the next date.
    expect(html.match(/Oct 24/g)).toHaveLength(1)
    expect(html).toContain('Monthly on the second Saturday<')
    expect(html).toMatch(/10:00\s?AM/)
    expect(html).not.toContain('<button')
    expect(html).not.toContain('>Cancelled<')
  })

  it('cancelled shown date with no following date: the cancelled date alone, no time line, no check-in', () => {
    const [c] = buildEventCards(
      [{ occurrenceId: 'p10', next: null }],
      [occ('p10', 'e2', { status: 'cancelled', starts_at: OCT10, ends_at: OCT10_END })],
    )
    const html = render(c, { now: Date.parse('2026-10-10T12:00:00Z') })
    expect(html).toContain('Sat, Oct 10 cancelled<')
    expect(html).not.toContain('next:')
    expect(html).not.toContain('10:00')
    expect(html).not.toContain('<button')
  })

  it('the card is a named region: the article is labelled by its title', () => {
    // M-A3 (break-it): dropping aria-labelledby leaves the article unnamed.
    const html = render(series)
    const labelledBy = html.match(/<article[^>]*aria-labelledby="([^"]+)"/)?.[1]
    expect(labelledBy).toBeTruthy()
    expect(html).toMatch(new RegExp(`<h4 id="${labelledBy}"[^>]*>Food pantry e1</h4>`))
    expect(html).toMatch(/<article[^>]*tabindex="-1"/)
  })

  it('lang/dir follow the locale (Arabic is right-to-left)', () => {
    const html = render(series, { locale: 'ar' })
    expect(html).toMatch(/<article[^>]*lang="ar"[^>]*dir="rtl"/)
  })
})

describe('the Events tab (render)', () => {
  const tab = (state: EventsTabState, locale: 'en' | 'es' = 'en', now = Date.parse('2026-10-22T14:00:00Z')) =>
    renderToStaticMarkup(h(EventsTabView, { state, locale, onRetry: () => {}, onCheckedIn: () => {}, now, viewerTz: NY }))

  const statusRegion = (html: string) => html.match(/<p role="status"[^>]*data-testid="events-tab-status"[^>]*>([^<]*)<\/p>/)?.[1]

  it('one status region is always mounted and announces each load outcome, translated', () => {
    // M-T5 (break-it): mounting the region only while loading drops the error / empty announcements.
    expect(statusRegion(tab({ status: 'loading' }))).toBe('Loading events…')
    expect(statusRegion(tab({ status: 'loading' }, 'es'))).toBe('Cargando eventos…')
    expect(statusRegion(tab({ status: 'error' }))).toBe('Events could not be loaded.')
    expect(statusRegion(tab({ status: 'ready', items: [], checkin: { statuses: {}, anonClaims: new Set() }, loadedAt: 0 }))).toBe('No upcoming events yet.')
    const items = buildEventCards([{ occurrenceId: 'a' }], [occ('a', 'e1')])
    expect(statusRegion(tab({ status: 'ready', items, checkin: { statuses: {}, anonClaims: new Set() }, loadedAt: 0 }))).toBe('')
    // The list's live region plus the (empty) card-notice region — the visible copies are hidden
    // from assistive tech, so nothing is announced twice.
    expect(tab({ status: 'error' }).match(/role="(status|alert)"/g)).toHaveLength(2)
    expect(tab({ status: 'error' })).toMatch(/data-testid="events-tab-notice"><\/p>/)
  })

  it('the tab heading can take focus (it receives focus after a reload settles), with a visible focus ring', () => {
    const h2 = tab({ status: 'loading' }).match(/<h2 id="events-tab-title" tabindex="-1"[^>]*>/)?.[0] ?? ''
    expect(h2).toMatch(/focus-visible:ring-2 focus-visible:ring-lime-700/)
  })

  it('the status region is mounted empty on first paint, then carries "Loading events…"', () => {
    // M-T9 (break-it): ignoring `announce` mounts the region together with its first text.
    const first = renderToStaticMarkup(h(EventsTabView, { state: { status: 'loading' }, locale: 'en', onRetry: () => {}, onCheckedIn: () => {}, announce: false }))
    expect(statusRegion(first)).toBe('')
    expect(statusRegion(tab({ status: 'loading' }))).toBe('Loading events…')
    const panel = readFileSync(fileURLToPath(new URL('../panels/events-panel.tsx', import.meta.url)), 'utf8')
    expect(panel).toMatch(/useState\(false\)\s+useEffect\(\(\) => \{\s+const id = requestAnimationFrame\(\(\) => setAnnounce\(true\)\)/)
    expect(panel).toMatch(/announce=\{announce\}/)
  })

  it('error: translated message and a Retry of at least 24px with a focus ring', () => {
    const html = tab({ status: 'error' })
    expect(html).toContain('>Events could not be loaded.</p>')
    const retry = html.match(/<button[^>]*>Try again<\/button>/)?.[0] ?? ''
    expect(retry).toMatch(/min-h-6/)
    expect(retry).toMatch(/min-w-6/)
    expect(retry).toMatch(/focus-visible:ring-2/)
  })

  it('empty state does not claim "in your area"', () => {
    const html = tab({ status: 'ready', items: [], checkin: { statuses: {}, anonClaims: new Set() }, loadedAt: 0 })
    expect(html).toContain('No upcoming events yet.')
    expect(html).not.toMatch(/in your area/i)
  })

  it('headings: tab h2 → day group h3 → card h4, grouped by venue day', () => {
    const items = buildEventCards(
      [{ occurrenceId: 'a' }, { occurrenceId: 'b' }],
      [
        occ('a', 'e1', { starts_at: '2026-10-22T20:00:00Z', ends_at: '2026-10-22T22:00:00Z' }),
        occ('b', 'e2', { starts_at: '2026-11-05T20:00:00Z', ends_at: '2026-11-05T22:00:00Z' }),
      ],
    )
    const html = tab({ status: 'ready', items, checkin: { statuses: {}, anonClaims: new Set() }, loadedAt: 0 })
    expect(html).toMatch(/<h2[^>]*>Community events<\/h2>/)
    expect(html).toMatch(/<h3[^>]*>Today<\/h3>/)
    expect(html).toMatch(/<h3[^>]*>Later<\/h3>/)
    expect(html).not.toMatch(/<h3[^>]*>This week<\/h3>/)
    expect(html.match(/<h4/g)).toHaveLength(2)
    expect(html.indexOf('Food pantry e1')).toBeLessThan(html.indexOf('>Later<'))
  })

  it('member state reaches the card: an own early check-in shows as checked in, not as a button', () => {
    const items = buildEventCards([{ occurrenceId: 'a' }], [occ('a', 'e1')])
    const html = tab({ status: 'ready', items, checkin: { statuses: { a: 'early' }, anonClaims: new Set() }, loadedAt: 0 })
    expect(html).toContain('Checked in ✓ (early)')
  })
})

describe('Events tab source contract', () => {
  const panel = readFileSync(fileURLToPath(new URL('../panels/events-panel.tsx', import.meta.url)), 'utf8')
  const feed = readFileSync(fileURLToPath(new URL('../panels/feed-panel.tsx', import.meta.url)), 'utf8')

  it('reads the server rule (upcoming_events) through the shared loader, logged with withMetric', () => {
    expect(panel).toMatch(/\.rpc\('upcoming_events', \{ p_limit: UPCOMING_LIMIT \}\)/)
    expect(panel).toMatch(/withMetric\('events\.tab\.load'/)
    expect(panel).toMatch(/loadEventCards\(/)
    expect(panel).not.toMatch(/thirtyDaysOut|\.lte\('starts_at'/)
    // M-T3 (break-it): rendering an error message from the database would need a message in state.
    expect(panel).not.toMatch(/status: 'error'; message/)
  })

  it('both surfaces render the one shared card; the feed pages with appendNewEvents and the shared loader', () => {
    expect(panel).toMatch(/<EventCard\b/)
    expect(feed).toMatch(/<EventCard\b/)
    expect(feed).toMatch(/appendNewEvents\(prev, events\)/)
    expect(feed).toMatch(/loadEventCards\(supabase, rankedEventRefs\(ranked\)/)
    expect(feed).not.toMatch(/my_anonymous_claims|as any\)\('my_anonymous_claims'/)
  })

  it('a check-in updates the card in place (server answer) and re-reads only when the answer is unknown', () => {
    // M-H2 (break-it): wiring onCheckedIn straight to a reload unmounts the cards and the open sheet.
    expect(panel).toMatch(/onCheckedIn=\{onCheckedIn\}/)
    expect(panel).not.toMatch(/onCheckedIn=\{reload\}/)
    expect(panel).toMatch(/applyCheckinResult\(prev\.checkin, occurrenceId, result\)/)
    expect(feed).not.toMatch(/onCheckedIn=\{refreshFeed\}/)
    // M-H3 (break-it): the feed's handler must re-read ONLY when the answer is unknown.
    const handler = feed.slice(feed.indexOf('onCheckedIn={(occurrenceId, result) => {'), feed.indexOf('onCheckedIn={(occurrenceId, result) => {') + 700)
    expect(handler).toMatch(/const effect = checkinResultEffect\(result\)\s+if \(!effect\) \{ refreshFeed\(\); return \}/)
    expect(handler.match(/refreshFeed\(\)/g)).toHaveLength(1)
    expect(handler).toMatch(/setEventMyStatuses\(\(prev\) => \(\{ \.\.\.prev, \[occurrenceId\]: effect\.status \}\)\)/)
    expect(handler).toMatch(/setEventAnonClaims\(\(prev\) => new Set\(prev\)\.add\(occurrenceId\)\)/)
    // After a reload settles, focus goes to the tab heading.
    expect(panel).toMatch(/focusTitleAfterLoad\.current = true/)
    expect(panel).toMatch(/titleRef\.current\?\.focus\(\)/)
  })

  it('secondary text is stone-600 or darker on the card and the tab', () => {
    const cardSrc = readFileSync(fileURLToPath(new URL('./event-card.tsx', import.meta.url)), 'utf8')
    for (const src of [cardSrc, panel]) {
      expect(src).not.toMatch(/<(p|span|h\d)[^>]*text-stone-(300|400|500)/)
    }
  })
})
