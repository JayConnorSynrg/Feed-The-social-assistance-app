// apps/web/src/hooks/use-feed-event-cards.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The community feed's event-card wiring (hooks/use-feed-event-cards.ts), mounted with the mini hook
// runtime and a Supabase double that records every RPC and table read:
//   - a save from a card re-reads ONLY that card (upcoming_events + its occurrence) — never the
//     ranked feed;
//   - the re-read card keeps the rank score and distance bucket the feed placed it by;
//   - a save made in the Events tab re-reads the feed's copy only when the feed lists that event.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))

import { mount } from '@/test/mini-react'
import { useFeedEventCards } from './use-feed-event-cards'
import { buildEventCards, type EventFeedItem, type EventOccurrenceRow } from '@/components/feed/post-model'
import { feedStatusAnnouncement } from '@/components/feed/feed-chrome'

const E1 = '11111111-1111-4111-8111-111111111111'
const E2 = '22222222-2222-4222-8222-222222222222'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function occRow(id: string, eventId: string, title: string): EventOccurrenceRow {
  return {
    id,
    starts_at: '2099-10-24T14:00:00Z',
    ends_at: '2099-10-24T16:00:00Z',
    status: 'upcoming',
    notes: null,
    capacity: null,
    source: 'rule',
    event: {
      id: eventId,
      org_id: ORG,
      title,
      event_type: 'pantry',
      location_name: 'Hall',
      city: 'Rutland',
      state: 'VT',
      requires_registration: false,
      time_zone: 'America/New_York',
      recurrence: null,
      organization: { name: 'Pantry Org' },
    },
  }
}

let rpcs: string[] = []
let tables: string[] = []
const supabase = {
  rpc: (name: string) => {
    rpcs.push(name)
    const data = name === 'upcoming_events'
      ? [{ event_id: E1, occurrence_id: 'occ-1', starts_at: '2099-10-24T14:00:00Z', ends_at: '2099-10-24T16:00:00Z', cancelled_occurrence_id: null, cancelled_starts_at: null }]
      : []
    const answer = Promise.resolve({ data, error: null })
    return Object.assign(answer, { abortSignal: () => answer })
  },
  from: (table: string) => {
    tables.push(table)
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'eq', 'gte', 'order', 'limit', 'abortSignal']) chain[m] = () => chain
    chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: table === 'event_occurrences' ? [occRow('occ-1', E1, 'Saturday pantry (renamed)')] : [], error: null }).then(res, rej)
    return chain
  },
}

const listed = (eventId: string, title: string, score: number, bucket: string): EventFeedItem => ({
  ...buildEventCards([{ occurrenceId: `occ-${eventId.slice(0, 1)}` }], [occRow(`occ-${eventId.slice(0, 1)}`, eventId, title)])[0],
  score,
  distanceBucket: bucket,
})

function setup(initial: EventFeedItem[]) {
  const m = mount(() =>
    useFeedEventCards({ supabase: supabase as never, userId: null, isGuest: false, locale: 'en', timeoutMs: 1000, focusHeading: () => {} }),
  )
  m.tree().setEventItems(initial)
  m.rerender()
  return m
}

beforeEach(() => {
  rpcs = []
  tables = []
})

describe('useFeedEventCards', () => {
  it('a save from a feed card re-reads ONLY that card: upcoming_events + its occurrence, never the ranked feed', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km'), listed(E2, 'Other', 0.3, '<2km')])
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    expect(rpcs).toEqual(['upcoming_events'])
    expect(tables).toEqual(['event_occurrences'])
    expect(m.tree().feedNotice).toBe('Changes saved.')
  })

  it('the re-read card keeps the score and distance bucket the feed placed it by, in the same place', async () => {
    const before = [listed(E1, 'Saturday pantry', 0.42, '2-5km'), listed(E2, 'Other', 0.3, '<2km')]
    const m = setup(before)
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    const after = m.tree().eventItems
    expect(after.map((e) => e.eventId)).toEqual([E1, E2])
    expect(after[0]).toMatchObject({ title: 'Saturday pantry (renamed)', score: 0.42, distanceBucket: '2-5km' })
    expect(after[1]).toBe(before[1])
  })

  it('an Events-tab save: the feed re-reads its copy when it lists the event — quietly — and reads nothing otherwise', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    m.tree().syncFeedEventCard(E2, { kind: 'date_cancelled' })
    await m.flush()
    expect(rpcs).toEqual([])
    m.tree().syncFeedEventCard(E1, { kind: 'date_cancelled' })
    await m.flush()
    expect(rpcs).toEqual(['upcoming_events'])
    expect(m.tree().eventItems[0]).toMatchObject({ title: 'Saturday pantry (renamed)', score: 0.42 })
    // Quiet: the feed is not on screen, so nothing is announced there.
    expect(m.tree().feedNotice).toBe('')
  })

  it('a new first page clears the card notice: the region then says loading, then the empty sentence — never the old notice', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    expect(m.tree().feedNotice).toBe('Changes saved.')
    // FeedPanel's first-page branch (any filter / order / Retry / realtime refresh).
    m.tree().clearNotice()
    m.rerender()
    const notice = m.tree().feedNotice
    const said = [
      feedStatusAnnouncement({ loading: true, error: false, empty: true, notice }, 'en'),
      feedStatusAnnouncement({ loading: false, error: false, empty: true, notice }, 'en'),
      feedStatusAnnouncement({ loading: false, error: false, empty: false, notice }, 'en'),
    ]
    expect(said).toEqual(['Loading posts…', 'No posts to show. Be the first to share something!', ''])
    expect(said).not.toContain('Changes saved.')
  })
})
