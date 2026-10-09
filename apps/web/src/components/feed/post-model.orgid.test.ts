// apps/web/src/components/feed/post-model.orgid.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I3 — event cards carry their organization id (for "Edit in admin") from the one hydration select,
// with every existing field unchanged: the feed and the Events tab build cards from the same rows.

import { describe, it, expect } from 'vitest'
import { buildEventCards, EVENT_OCCURRENCE_SELECT, type EventOccurrenceRow } from './post-model'

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const row: EventOccurrenceRow = {
  id: 'occ-1',
  starts_at: '2026-10-24T14:00:00Z',
  ends_at: '2026-10-24T16:00:00Z',
  status: 'upcoming',
  notes: 'Bring a bag',
  capacity: 40,
  source: 'rule',
  event: {
    id: 'ev-1',
    org_id: ORG,
    title: 'Saturday pantry',
    event_type: 'pantry',
    location_name: 'Hall',
    city: 'Rutland',
    state: 'VT',
    requires_registration: true,
    time_zone: 'America/New_York',
    recurrence: null,
    organization: { name: 'Pantry Org' },
  },
}

describe('EventCardItem.orgId', () => {
  it("the select reads the event's own org_id next to its id, and keeps every existing column", () => {
    const compact = EVENT_OCCURRENCE_SELECT.replace(/\s+/g, ' ')
    expect(compact).toContain(
      'event:assistance_events( id, org_id, title, event_type, location_name, city, state, requires_registration, time_zone, recurrence, organization:organizations(name) )'
    )
    expect(compact).toContain('id, starts_at, ends_at, status, notes, capacity, source,')
  })

  it('the card carries orgId from the row; the other fields are unchanged', () => {
    const [card] = buildEventCards([{ occurrenceId: 'occ-1' }], [row])
    expect(card).toEqual({
      occurrenceId: 'occ-1',
      eventId: 'ev-1',
      orgId: ORG,
      title: 'Saturday pantry',
      eventType: 'pantry',
      orgName: 'Pantry Org',
      startsAt: '2026-10-24T14:00:00Z',
      endsAt: '2026-10-24T16:00:00Z',
      timeZone: 'America/New_York',
      locationName: 'Hall',
      city: 'Rutland',
      state: 'VT',
      status: 'upcoming',
      requiresRegistration: true,
      capacity: 40,
      notes: 'Bring a bag',
      recurrence: null,
      isExtraDate: false,
      cancelledStartsAt: null,
      cancelledShown: null,
    })
  })
})
