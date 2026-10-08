// apps/web/src/components/admin/event-feed-link.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E2 + E4 on the admin event row: "View in feed" (a link to /#events?focus=event:<id> in the reused
// feed-preview tab) if and only if event_feed_next lists the event; otherwise "Appears in feed
// <venue date>" or the reason, with no link. A click writes one admin.nav.member_view row
// (kind=event, view=feed, the surface as source) and no id.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { events } = vi.hoisted(() => ({ events: [] as Array<{ name: string; attrs: Record<string, unknown> }> }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => events.push({ name, attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { EventFeedLink, type EventFeedLinkEvent, type EventFeedLinkProps } from './event-feed-link'
import { MemberViewLink } from './member-view-link'

const ID = '8f285b5a-4e4f-4bbc-b661-23fcaf84353a'
const event: EventFeedLinkEvent = {
  id: ID,
  title: 'FEED INFO',
  is_active: true,
  time_zone: 'America/New_York',
  announce_days_before: 7,
  org: { is_active: true },
  feed_next: [{ starts_at: '2026-10-15T13:00:00Z', ends_at: '2026-10-15T18:00:00Z', status: 'upcoming', cancel_reason: null }],
}
const LISTED = Date.parse('2026-10-08T19:12:00Z')
const BEFORE = Date.parse('2026-10-07T03:00:00Z')
const props = (over: Partial<EventFeedLinkProps> = {}): EventFeedLinkProps => ({ event, now: LISTED, locale: 'en', source: 'event_scheduler', ...over })
const render = (p: EventFeedLinkProps) => renderToStaticMarkup(h(EventFeedLink, p))

beforeEach(() => {
  events.length = 0
})

describe('listed -> View in feed', () => {
  it('one link to the Events list focused on this event, in the feed-preview tab', () => {
    const html = render(props())
    const anchors = html.match(/<a [^>]*>/g) ?? []
    expect(anchors).toHaveLength(1)
    expect(anchors[0]).toContain(`href="/#events?focus=event:${ID}"`)
    expect(anchors[0]).toContain('target="feed-preview"')
    expect(html).toContain('aria-label="View in feed: FEED INFO (opens in the feed preview tab)"')
    expect(html).toMatch(/>View in feed<\/a>$/)
  })
  it('in the admin locale', () => {
    expect(render(props({ locale: 'es' }))).toMatch(/>Ver en el feed<\/a>$/)
  })
})

describe('not listed -> no link', () => {
  it('not yet: "Appears in feed <venue-local date>"', () => {
    const html = render(props({ now: BEFORE }))
    expect(html).not.toContain('<a ')
    expect(html).toBe('<span class="inline-flex min-h-6 items-center text-xs text-stone-600">Appears in feed Thu, Oct 8, 2026</span>')
  })
  it('the date is the venue date: Los Angeles, Oct 8 00:00 PDT is 07:00Z', () => {
    const la = { ...event, time_zone: 'America/Los_Angeles', feed_next: [{ ...event.feed_next![0], starts_at: '2026-10-15T16:00:00Z', ends_at: '2026-10-15T20:00:00Z' }] }
    expect(render(props({ event: la, now: Date.parse('2026-10-08T05:00:00Z') }))).toContain('Appears in feed Thu, Oct 8, 2026')
  })
  it('a venue east of UTC: Tokyo Oct 8 00:00 JST is Oct 7 15:00Z — the line still says the venue date, Oct 8', () => {
    const tokyo = { ...event, time_zone: 'Asia/Tokyo', feed_next: [{ ...event.feed_next![0], starts_at: '2026-10-15T01:00:00Z', ends_at: '2026-10-15T03:00:00Z' }] }
    expect(render(props({ event: tokyo, now: Date.parse('2026-10-07T12:00:00Z') }))).toContain('Appears in feed Thu, Oct 8, 2026')
  })
  for (const [label, ev, text] of [
    ['retired', { ...event, is_active: false }, 'Retired — not in the feed'],
    ['organization inactive', { ...event, org: { is_active: false } }, 'Organization inactive — not in the feed'],
    ['organization not returned', { ...event, org: null }, 'Organization inactive — not in the feed'],
    ['no upcoming dates', { ...event, feed_next: [] }, 'No upcoming dates — not in the feed'],
  ] as const) {
    it(label, () => {
      const html = render(props({ event: ev as EventFeedLinkEvent }))
      expect(html).not.toContain('<a ')
      expect(html).toContain(text)
    })
  }
})

describe('logging (E4)', () => {
  function anchor(p: EventFeedLinkProps): ReactElement<Record<string, (e: unknown) => void>> {
    let el: ReactElement | null = null
    function Probe() {
      const link = EventFeedLink(p) as ReactElement<Parameters<typeof MemberViewLink>[0]>
      el = MemberViewLink(link.props) as ReactElement
      return el
    }
    renderToStaticMarkup(h(Probe))
    return el as unknown as ReactElement<Record<string, (e: unknown) => void>>
  }
  it('one click writes exactly one admin.nav.member_view row: kind=event, view=feed, source, no id', () => {
    anchor(props()).props.onClick({})
    expect(events).toEqual([{ name: 'admin.nav.member_view', attrs: { kind: 'event', source: 'event_scheduler', view: 'feed' } }])
    expect(JSON.stringify(events)).not.toContain(ID)
  })
  it('the organization admin page reports its own source', () => {
    anchor(props({ source: 'org_admin_events' })).props.onClick({})
    expect(events).toEqual([{ name: 'admin.nav.member_view', attrs: { kind: 'event', source: 'org_admin_events', view: 'feed' } }])
  })
})
