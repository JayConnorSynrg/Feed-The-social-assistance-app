// apps/web/src/lib/event-feed-window.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E2 — the scheduler offers "View in feed" exactly when public.event_feed_next(now()) lists the
// event, and otherwise says when it will be listed or why not. Fixed instants and explicit zones,
// so the result is the same on every machine whatever its own zone.

import { describe, it, expect } from 'vitest'
import { eventFeedStatus, startOfVenueDate, type FeedWindowEvent, type FeedWindowOccurrence } from './event-feed-window'
import { formatCalendarDate, venueDateKey } from './event-time'

const NY = 'America/New_York'
const ev = (over: Partial<FeedWindowEvent> = {}): FeedWindowEvent => ({ is_active: true, time_zone: NY, announce_days_before: 7, ...over })
const occ = (starts: string, over: Partial<FeedWindowOccurrence> = {}): FeedWindowOccurrence => ({
  starts_at: starts,
  ends_at: new Date(Date.parse(starts) + 5 * 3600_000).toISOString(),
  status: 'upcoming',
  cancel_reason: null,
  ...over,
})
const at = (iso: string) => new Date(iso)

describe('production row: FEED INFO (America/New_York, 7 days, next 2026-10-15T13:00Z)', () => {
  const next = occ('2026-10-15T13:00:00Z')
  it('listed at 2026-10-08T19:12Z (event_feed_next returned it)', () => {
    expect(eventFeedStatus(ev(), next, true, at('2026-10-08T19:12:00Z'))).toEqual({ listed: true })
  })
  it('not listed at 2026-10-07T03:00Z; appears 00:00 EDT Oct 8 = 04:00Z (event_feed_next returned no row)', () => {
    expect(eventFeedStatus(ev(), next, true, at('2026-10-07T03:00:00Z'))).toEqual({ listed: false, appearsAt: at('2026-10-08T04:00:00Z') })
  })
})

describe('the exact venue-midnight boundary', () => {
  const next = occ('2026-10-15T13:00:00Z')
  it('one millisecond before 00:00 venue time: not listed; at 00:00: listed', () => {
    expect(eventFeedStatus(ev(), next, true, at('2026-10-08T03:59:59.999Z'))).toEqual({ listed: false, appearsAt: at('2026-10-08T04:00:00Z') })
    expect(eventFeedStatus(ev(), next, true, at('2026-10-08T04:00:00Z'))).toEqual({ listed: true })
  })
})

describe('venue zone differs from the admin zone', () => {
  // 09:00 PDT Oct 15 in Los Angeles; announce day Oct 8 starts 00:00 PDT = 07:00Z.
  const next = occ('2026-10-15T16:00:00Z')
  const la = ev({ time_zone: 'America/Los_Angeles' })
  it('already Oct 8 in New York / Tokyo, still Oct 7 at the venue: not listed', () => {
    expect(eventFeedStatus(la, next, true, at('2026-10-08T05:00:00Z'))).toEqual({ listed: false, appearsAt: at('2026-10-08T07:00:00Z') })
  })
  it('the date shown to the admin is the venue date (Oct 8), even for an admin in Tokyo', () => {
    const s = eventFeedStatus(la, next, true, at('2026-10-08T05:00:00Z'))
    if (s.listed || !('appearsAt' in s)) throw new Error('expected appearsAt')
    expect(formatCalendarDate(venueDateKey(s.appearsAt.toISOString(), la.time_zone), 'en')).toBe('Thu, Oct 8, 2026')
    // The same instant in Tokyo is already Oct 8 16:00 — the label does not follow the viewer.
    expect(venueDateKey(s.appearsAt.toISOString(), 'Asia/Tokyo')).toBe('2026-10-08')
  })
  it('listed from 07:00Z', () => {
    expect(eventFeedStatus(la, next, true, at('2026-10-08T07:00:00Z'))).toEqual({ listed: true })
  })
})

describe('DST transitions (America/New_York)', () => {
  it('fall back 2026-11-01: a 7-day lead across the change starts at 00:00 EDT (04:00Z), not 05:00Z', () => {
    const next = occ('2026-11-08T14:00:00Z') // 09:00 EST Nov 8
    expect(eventFeedStatus(ev(), next, true, at('2026-11-01T03:59:00Z'))).toEqual({ listed: false, appearsAt: at('2026-11-01T04:00:00Z') })
    expect(eventFeedStatus(ev(), next, true, at('2026-11-01T04:00:00Z'))).toEqual({ listed: true })
  })
  it('the day after fall back: Nov 2 starts at 00:00 EST (05:00Z)', () => {
    const next = occ('2026-11-02T14:00:00Z')
    expect(eventFeedStatus(ev({ announce_days_before: 0 }), next, true, at('2026-11-02T04:30:00Z'))).toEqual({ listed: false, appearsAt: at('2026-11-02T05:00:00Z') })
  })
  it('spring forward 2026-03-08: Mar 8 starts at 00:00 EST (05:00Z); a 7-day lead from Mar 15 09:00 EDT', () => {
    const next = occ('2026-03-15T13:00:00Z') // 09:00 EDT Mar 15
    expect(eventFeedStatus(ev(), next, true, at('2026-03-08T04:59:00Z'))).toEqual({ listed: false, appearsAt: at('2026-03-08T05:00:00Z') })
    expect(eventFeedStatus(ev(), next, true, at('2026-03-08T05:00:00Z'))).toEqual({ listed: true })
  })
  it('the day after spring forward: Mar 9 starts at 00:00 EDT (04:00Z)', () => {
    const next = occ('2026-03-09T13:00:00Z')
    expect(eventFeedStatus(ev({ announce_days_before: 0 }), next, true, at('2026-03-09T03:00:00Z'))).toEqual({ listed: false, appearsAt: at('2026-03-09T04:00:00Z') })
  })
  it('a zone that skips midnight (America/Havana, 2026-03-08 00:00 -> 01:00): the day starts at 01:00 CDT = 05:00Z', () => {
    expect(startOfVenueDate('2026-03-08', 'America/Havana')).toEqual(at('2026-03-08T05:00:00Z'))
    expect(venueDateKey('2026-03-08T04:59:00Z', 'America/Havana')).toBe('2026-03-07')
  })
})

describe('lead lengths', () => {
  it('a 0-day lead: shown from 00:00 venue time on the day itself', () => {
    const next = occ('2026-10-15T13:00:00Z')
    expect(eventFeedStatus(ev({ announce_days_before: 0 }), next, true, at('2026-10-15T03:00:00Z'))).toEqual({ listed: false, appearsAt: at('2026-10-15T04:00:00Z') })
    expect(eventFeedStatus(ev({ announce_days_before: 0 }), next, true, at('2026-10-15T04:00:00Z'))).toEqual({ listed: true })
  })
  it('a 30-day lead: the announce day decides; the 32-day scan cap is earlier and never clips it', () => {
    const next = occ('2026-12-31T23:30:00Z') // 18:30 EST Dec 31 (the latest start of that local day is no different)
    // Dec 31 - 30 = Dec 1, 00:00 EST = 05:00Z; starts_at - 32 days = Nov 29 23:30Z (earlier).
    expect(eventFeedStatus(ev({ announce_days_before: 30 }), next, true, at('2026-11-30T12:00:00Z'))).toEqual({ listed: false, appearsAt: at('2026-12-01T05:00:00Z') })
    expect(eventFeedStatus(ev({ announce_days_before: 30 }), next, true, at('2026-12-01T05:00:00Z'))).toEqual({ listed: true })
  })
  it('clause fidelity: the 32-day scan cap is applied (reachable only with a lead above the 30-day preset)', () => {
    const next = occ('2026-12-31T23:30:00Z')
    // A 40-day lead is announced on Nov 21, but event_feed_next does not scan past now + 32 days.
    expect(eventFeedStatus(ev({ announce_days_before: 40 }), next, true, at('2026-11-25T00:00:00Z'))).toEqual({ listed: false, appearsAt: at('2026-11-29T23:30:00Z') })
    expect(eventFeedStatus(ev({ announce_days_before: 40 }), next, true, at('2026-11-29T23:30:00Z'))).toEqual({ listed: true })
  })
})

describe('the soonest date is cancelled', () => {
  const now = at('2026-10-10T12:00:00Z')
  it('cancelled by an admin (event and org active): still listed — members see it as cancelled', () => {
    expect(eventFeedStatus(ev(), occ('2026-10-15T13:00:00Z', { status: 'cancelled', cancel_reason: 'admin' }), true, now)).toEqual({ listed: true })
    expect(eventFeedStatus(ev(), occ('2026-10-15T13:00:00Z', { status: 'cancelled', cancel_reason: 'rule_changed' }), true, now)).toEqual({ listed: true })
    expect(eventFeedStatus(ev(), occ('2026-10-15T13:00:00Z', { status: 'cancelled', cancel_reason: null }), true, now)).toEqual({ listed: true })
  })
  it('cancelled because retired / organization inactive: that date does not count', () => {
    expect(eventFeedStatus(ev(), occ('2026-10-15T13:00:00Z', { status: 'cancelled', cancel_reason: 'retired' }), true, now)).toEqual({ listed: false, reason: 'no_upcoming' })
    expect(eventFeedStatus(ev(), occ('2026-10-15T13:00:00Z', { status: 'cancelled', cancel_reason: 'org_inactive' }), true, now)).toEqual({ listed: false, reason: 'no_upcoming' })
  })
})

describe('reasons', () => {
  const next = occ('2026-10-15T13:00:00Z')
  const now = at('2026-10-10T12:00:00Z')
  it('retired event', () => {
    expect(eventFeedStatus(ev({ is_active: false }), next, true, now)).toEqual({ listed: false, reason: 'retired' })
  })
  it('inactive organization', () => {
    expect(eventFeedStatus(ev(), next, false, now)).toEqual({ listed: false, reason: 'org_inactive' })
  })
  it('no upcoming date', () => {
    expect(eventFeedStatus(ev(), null, true, now)).toEqual({ listed: false, reason: 'no_upcoming' })
  })
  it('the date has ended (ends_at < now): no upcoming date; still running (ends_at = now): listed', () => {
    const running = occ('2026-10-10T08:00:00Z', { ends_at: '2026-10-10T12:00:00Z' })
    expect(eventFeedStatus(ev(), running, true, now)).toEqual({ listed: true })
    expect(eventFeedStatus(ev(), running, true, at('2026-10-10T12:00:00.001Z'))).toEqual({ listed: false, reason: 'no_upcoming' })
  })
})
