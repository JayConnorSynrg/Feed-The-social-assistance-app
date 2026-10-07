// event-card-data.test.ts
// The card loader both member surfaces share: hydrate the shown dates, then (in parallel) the
// next date of a cancelled shown date and the member's check-in state.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const warn = vi.fn()
vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: (...a: unknown[]) => warn(...a), error: vi.fn() } }))

import { loadEventCards } from './event-card-data'
import { fakeClient } from './__tests__/fake-supabase'
import { eventCancelledLine } from '@/components/feed/post-model'

const NY = 'America/New_York'
const row = (id: string, eventId: string, status: string, starts_at: string, ends_at: string) => ({
  id, starts_at, ends_at, status, notes: null, capacity: null, source: 'rule',
  event: {
    id: eventId, title: 'T', event_type: 'meal', location_name: null, city: null, state: null,
    requires_registration: false, time_zone: NY, recurrence: null, organization: { name: 'Org' },
  },
})
const OCC = {
  data: [
    row('c10', 'e1', 'cancelled', '2026-10-10T14:00:00Z', '2026-10-10T16:00:00Z'),
    row('u1', 'e2', 'upcoming', '2026-10-11T14:00:00Z', '2026-10-11T16:00:00Z'),
  ],
  error: null,
}
const NOW = Date.parse('2026-10-10T12:00:00Z')
const opts = { surface: 'feed' as const, userId: 'u', isGuest: false, nowMs: NOW }

beforeEach(() => warn.mockReset())

describe('loadEventCards', () => {
  it('feed: a cancelled shown date gets the event\'s next upcoming date from one embedded read', async () => {
    // M-N1 (break-it): skipping the next-date lookup leaves the card reading "Sat, Oct 10 cancelled" alone.
    const f = fakeClient({
      event_occurrences: OCC,
      assistance_events: { data: [{ id: 'e1', next: [{ id: 'n24', starts_at: '2026-10-24T14:00:00Z', ends_at: '2026-10-24T16:00:00Z', status: 'upcoming' }] }], error: null },
    }, { gated: false })
    const { items } = await loadEventCards(f.client, [{ occurrenceId: 'c10' }, { occurrenceId: 'u1' }], opts)
    expect(items.map((i) => [i.occurrenceId, i.cancelledShown])).toEqual([['c10', 'next'], ['u1', null]])
    expect(eventCancelledLine(items[0], 'en', NY)).toBe('Sat, Oct 10 cancelled — next: Sat, Oct 24')

    const embed = f.calls.find((c) => c.name === 'assistance_events')!
    expect(embed.ops).toContainEqual(['select', ['id, next:event_occurrences(id, starts_at, ends_at, status)']])
    expect(embed.ops).toContainEqual(['in', ['id', ['e1']]])
    expect(embed.ops).toContainEqual(['eq', ['next.status', 'upcoming']])
    expect(embed.ops).toContainEqual(['gte', ['next.ends_at', new Date(NOW).toISOString()]])
    expect(embed.ops).toContainEqual(['order', ['starts_at', { referencedTable: 'next', ascending: true }]])
    expect(embed.ops).toContainEqual(['limit', [1, { referencedTable: 'next' }]])
  })

  it('check-in state is read only for the upcoming shown dates (a cancelled date offers no check-in)', async () => {
    const f = fakeClient({ event_occurrences: OCC }, { gated: false })
    await loadEventCards(f.client, [{ occurrenceId: 'c10' }, { occurrenceId: 'u1' }], opts)
    const own = f.calls.find((c) => c.name === 'event_checkins')!
    expect(own.ops).toContainEqual(['in', ['occurrence_id', ['u1']]])
  })

  it('Events tab: the next date the RPC returned is used as is — no lookup', async () => {
    const f = fakeClient({ event_occurrences: OCC }, { gated: false })
    const { items } = await loadEventCards(
      f.client,
      [{ occurrenceId: 'c10', next: null }, { occurrenceId: 'u1' }],
      { ...opts, surface: 'events_tab' },
    )
    expect(f.calls.some((c) => c.name === 'assistance_events')).toBe(false)
    expect(items[0].cancelledShown).toBe('none')
    expect(eventCancelledLine(items[0], 'en', NY)).toBe('Sat, Oct 10 cancelled')
  })

  it('a failed next-date lookup keeps the card (cancelled date alone) and is logged; a failed hydration fails the load', async () => {
    const f = fakeClient({ event_occurrences: OCC, assistance_events: { data: null, error: { code: '57014' } } }, { gated: false })
    const { items } = await loadEventCards(f.client, [{ occurrenceId: 'c10' }], opts)
    expect(items[0].cancelledShown).toBe('unknown')
    expect(eventCancelledLine(items[0], 'en', NY)).toBe('Sat, Oct 10 cancelled')
    expect(warn).toHaveBeenCalledWith('events.next_date.load_failed', { surface: 'feed', code: '57014' })

    const g = fakeClient({ event_occurrences: { data: null, error: { code: '42501' } } }, { gated: false })
    await expect(loadEventCards(g.client, [{ occurrenceId: 'c10' }], opts)).rejects.toMatchObject({ code: '42501' })
  })
})
