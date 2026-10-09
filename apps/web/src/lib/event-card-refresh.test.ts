// apps/web/src/lib/event-card-refresh.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// R1 invariant 1d — after an admin saves a change from an event card's ⋯ menu, ONLY that card is
// re-read and put back; the list it sits in (community feed, Events tab) is not reloaded:
//   - reloadEventCard asks the server which date the event shows now (upcoming_events — the rows
//     ranked_feed_v2 places) and hydrates exactly that one card; an event no longer shown → null;
//   - replaceEventCard swaps it in place by event id (every other card keeps its object and
//     position; the feed keeps the card's rank score + distance bucket); orderByShownDate re-files
//     the Events tab by date;
//   - useEventCardRefresh (both panels): applies the latest re-read only, announces what the save
//     did, moves focus to the heading when the focused card left, and keeps the card on a failed
//     re-read (one warn row).
// Break-it proofs are listed in the R1 report.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  reload: null as null | ((...a: unknown[]) => Promise<unknown>),
  warn: [] as Array<[string, Record<string, unknown>]>,
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: (name: string, ctx: Record<string, unknown>) => h.warn.push([name, ctx]), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))
vi.mock('@/lib/event-card-data', async (orig) => {
  const actual = await orig<typeof import('@/lib/event-card-data')>()
  return {
    ...actual,
    // The hook's re-read is swapped per test; reloadEventCard itself is tested through `actual`.
    reloadEventCard: (...a: unknown[]) => (h.reload ? h.reload(...a) : actual.reloadEventCard(...(a as Parameters<typeof actual.reloadEventCard>))),
  }
})

import { mount } from '@/test/mini-react'
import { reloadEventCard } from '@/lib/event-card-data'
import { mergeCheckinState, emptyCheckinState } from '@/lib/event-checkin-state'
import {
  buildEventCards,
  orderByShownDate,
  replaceEventCard,
  type EventCardItem,
  type EventFeedItem,
  type EventOccurrenceRow,
  type UpcomingEventRow,
} from '@/components/feed/post-model'
import { useEventCardRefresh } from '@/hooks/use-event-card-refresh'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const NY = 'America/New_York'
const E1 = '11111111-1111-4111-8111-111111111111'
const E2 = '22222222-2222-4222-8222-222222222222'
const E3 = '33333333-3333-4333-8333-333333333333'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function occRow(id: string, eventId: string, startsAt: string, o: Partial<EventOccurrenceRow> & { title?: string } = {}): EventOccurrenceRow {
  return {
    id,
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + 2 * 3600_000).toISOString(),
    status: 'upcoming',
    notes: null,
    capacity: null,
    source: 'rule',
    ...o,
    event: {
      id: eventId,
      org_id: ORG,
      title: o.title ?? `Event ${eventId.slice(0, 4)}`,
      event_type: 'pantry',
      location_name: 'Hall',
      city: 'Rutland',
      state: 'VT',
      requires_registration: false,
      time_zone: NY,
      recurrence: null,
      organization: { name: 'Pantry Org' },
    },
  }
}
const card = (id: string, eventId: string, startsAt: string, title?: string) => buildEventCards([{ occurrenceId: id }], [occRow(id, eventId, startsAt, { title })])[0]

/** A Supabase client double: upcoming_events answers `upcoming`; event_occurrences answers `occurrences`. */
function fakeSupabase({ upcoming, occurrences, rpcError = null }: { upcoming: UpcomingEventRow[]; occurrences: EventOccurrenceRow[]; rpcError?: { code: string } | null }) {
  const rpcCalls: Array<[string, Record<string, unknown>]> = []
  const reads: Array<{ table: string; ops: Array<[string, unknown[]]> }> = []
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push([name, args])
      return { abortSignal: () => Promise.resolve(rpcError ? { data: null, error: rpcError } : { data: upcoming, error: null }) }
    },
    from: (table: string) => {
      const read = { table, ops: [] as Array<[string, unknown[]]> }
      reads.push(read)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'in', 'eq', 'gte', 'order', 'limit', 'abortSignal']) {
        chain[m] = (...a: unknown[]) => {
          read.ops.push([m, a])
          return chain
        }
      }
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(table === 'event_occurrences' ? { data: occurrences, error: null } : { data: [], error: null }).then(res, rej)
      return chain
    },
  }
  return { client: client as never, rpcCalls, reads }
}

const upcomingRow = (eventId: string, occurrenceId: string, startsAt: string): UpcomingEventRow => ({
  event_id: eventId,
  occurrence_id: occurrenceId,
  starts_at: startsAt,
  ends_at: startsAt,
  cancelled_occurrence_id: null,
  cancelled_starts_at: null,
})

describe('reloadEventCard — the server picks the date, one card is hydrated', () => {
  const opts = { surface: 'feed' as const, userId: null, isGuest: false }

  it('the event is shown: only ITS shown date is hydrated, with the values the server has now', async () => {
    const sb = fakeSupabase({
      upcoming: [upcomingRow(E2, 'occ-2', '2026-10-20T14:00:00Z'), upcomingRow(E1, 'occ-1b', '2026-10-24T14:00:00Z')],
      occurrences: [occRow('occ-1b', E1, '2026-10-24T14:00:00Z', { title: 'Saturday pantry (renamed)' })],
    })
    const r = await reloadEventCard(sb.client, E1, opts)
    expect(r.item).toMatchObject({ eventId: E1, occurrenceId: 'occ-1b', title: 'Saturday pantry (renamed)', startsAt: '2026-10-24T14:00:00Z' })
    expect(sb.rpcCalls.map(([n]) => n)).toEqual(['upcoming_events'])
    // Every shown event is considered, not only the Events tab's first 50.
    expect(sb.rpcCalls[0][1].p_limit as number).toBeGreaterThan(50)
    const occRead = sb.reads.find((r) => r.table === 'event_occurrences')
    expect(occRead?.ops.find(([m]) => m === 'in')?.[1]).toEqual(['id', ['occ-1b']])
  })

  it('a cancelled shown date: the card names it and times the next date the server returned', async () => {
    const sb = fakeSupabase({
      upcoming: [{ event_id: E1, occurrence_id: 'occ-next', starts_at: '2026-10-31T14:00:00Z', ends_at: '2026-10-31T16:00:00Z', cancelled_occurrence_id: 'occ-x', cancelled_starts_at: '2026-10-24T14:00:00Z' }],
      occurrences: [occRow('occ-x', E1, '2026-10-24T14:00:00Z', { status: 'cancelled' })],
    })
    const r = await reloadEventCard(sb.client, E1, opts)
    expect(r.item).toMatchObject({ occurrenceId: 'occ-x', cancelledShown: 'next', cancelledStartsAt: '2026-10-24T14:00:00Z', startsAt: '2026-10-31T14:00:00Z' })
  })

  it('the event is no longer shown (retired, no announced date): null, and nothing is hydrated', async () => {
    const sb = fakeSupabase({ upcoming: [upcomingRow(E2, 'occ-2', '2026-10-20T14:00:00Z')], occurrences: [] })
    expect((await reloadEventCard(sb.client, E1, opts)).item).toBeNull()
    expect(sb.reads).toHaveLength(0)
  })

  it('the read fails: it throws (the caller keeps the card it has)', async () => {
    const sb = fakeSupabase({ upcoming: [], occurrences: [], rpcError: { code: '57014' } })
    await expect(reloadEventCard(sb.client, E1, opts)).rejects.toMatchObject({ code: '57014' })
  })
})

describe('replaceEventCard / orderByShownDate — in place, nothing else moves', () => {
  const a = card('occ-a', E1, '2026-10-20T14:00:00Z')
  const b = card('occ-b', E2, '2026-10-21T14:00:00Z')
  const c = card('occ-c', E3, '2026-10-22T14:00:00Z')
  const feed: EventFeedItem[] = [
    { ...a, score: 9, distanceBucket: '<2km' },
    { ...b, score: 7, distanceBucket: '2-5km' },
    { ...c, score: 5, distanceBucket: '>50km' },
  ]
  const keepRank = (was: EventFeedItem, next: EventCardItem): EventFeedItem => ({ ...next, score: was.score, distanceBucket: was.distanceBucket })

  it('feed: the re-read card takes its place with its rank score + distance bucket; the others are the same objects', () => {
    const renamed = { ...b, title: 'Renamed', startsAt: '2026-11-30T14:00:00Z' }
    const out = replaceEventCard(feed, E2, renamed, keepRank)
    expect(out.map((e) => e.eventId)).toEqual([E1, E2, E3])
    expect(out[1]).toMatchObject({ title: 'Renamed', score: 7, distanceBucket: '2-5km' })
    expect(out[0]).toBe(feed[0])
    expect(out[2]).toBe(feed[2])
  })

  it('null removes only that card; an event not in the list leaves the list untouched (same array)', () => {
    expect(replaceEventCard(feed, E2, null, keepRank).map((e) => e.eventId)).toEqual([E1, E3])
    expect(replaceEventCard(feed, 'not-listed', a, keepRank)).toBe(feed)
  })

  it('Events tab: a date moved later is re-filed where a fresh load would put it (date, then id)', () => {
    const moved = { ...a, startsAt: '2026-10-21T15:00:00Z' }
    expect(orderByShownDate(replaceEventCard([a, b, c], E1, moved, (_w, n) => n)).map((e) => e.eventId)).toEqual([E2, E1, E3])
    // Same start: the occurrence id breaks the tie (upcoming_events ORDER BY starts_at, occurrence_id).
    const tie = { ...c, startsAt: b.startsAt }
    expect(orderByShownDate([tie, b]).map((e) => e.occurrenceId)).toEqual(['occ-b', 'occ-c'])
    // A cancelled shown date is filed under the cancelled date.
    const cancelled = { ...c, cancelledShown: 'next' as const, cancelledStartsAt: '2026-10-19T14:00:00Z', startsAt: '2026-11-02T14:00:00Z' }
    expect(orderByShownDate([a, b, cancelled]).map((e) => e.eventId)).toEqual([E3, E1, E2])
  })

  it('check-in state: a re-read adds to the list state, never forgets a claim', () => {
    const prev = { statuses: { 'occ-a': 'early' as const }, anonClaims: new Set(['occ-c']) }
    const next = { statuses: { 'occ-b': 'confirmed' as const }, anonClaims: new Set<string>() }
    const merged = mergeCheckinState(prev, next)
    expect(merged.statuses).toEqual({ 'occ-a': 'early', 'occ-b': 'confirmed' })
    expect([...merged.anonClaims]).toEqual(['occ-c'])
  })
})

describe('useEventCardRefresh — what both panels do after a save from a card', () => {
  const g = globalThis as unknown as { document?: unknown; requestAnimationFrame?: unknown; CSS?: unknown }
  let focused: object | null = null
  beforeEach(() => {
    h.warn = []
    focused = null
    g.document = { get activeElement() { return focused } }
    g.requestAnimationFrame = (cb: () => void) => cb()
    g.CSS = { escape: (s: string) => s }
  })
  afterEach(() => {
    h.reload = null
    delete g.document
    delete g.requestAnimationFrame
    delete g.CSS
  })

  function harness() {
    const applied: Array<[string, EventCardItem | null]> = []
    const headingFocus = { calls: 0 }
    const cardEl = { contains: (el: unknown) => el === cardChild }
    const cardChild = { id: 'trigger' }
    const root = () => ({ querySelector: (sel: string) => (sel.includes(E1) ? cardEl : null) }) as unknown as ParentNode
    const m = mount(() =>
      useEventCardRefresh({
        supabase: {} as never,
        surface: 'feed',
        userId: 'u1',
        isGuest: false,
        locale: 'en',
        timeoutMs: 1000,
        apply: (id, item) => applied.push([id, item]),
        root,
        focusHeading: () => headingFocus.calls++,
      }),
    )
    return { m, applied, headingFocus, cardChild }
  }
  const renamed = card('occ-1', E1, '2026-10-24T14:00:00Z', 'Renamed')

  it('a save re-reads that card, applies it once, and announces what the save did', async () => {
    h.reload = async (_sb, id) => ({ item: { ...renamed, eventId: id as string }, checkin: emptyCheckinState() })
    const { m, applied } = harness()
    await m.tree().onManaged(E1, { kind: 'updated' })
    await m.flush()
    expect(applied).toEqual([[E1, expect.objectContaining({ title: 'Renamed' })]])
    expect(m.tree().notice).toBe('Changes saved.')
  })

  it('two saves in a row on one card: only the later re-read is applied', async () => {
    const resolvers: Array<(v: unknown) => void> = []
    h.reload = () => new Promise((res) => resolvers.push(res))
    const { m, applied } = harness()
    const first = m.tree().onManaged(E1, { kind: 'updated' })
    const second = m.tree().onManaged(E1, { kind: 'dates_added', changed: 2 })
    resolvers[1]({ item: { ...renamed, title: 'Second' }, checkin: emptyCheckinState() })
    resolvers[0]({ item: { ...renamed, title: 'First (stale)' }, checkin: emptyCheckinState() })
    await Promise.all([first, second])
    await m.flush()
    expect(applied.map(([, i]) => i?.title)).toEqual(['Second'])
    expect(m.tree().notice).toBe('Dates added: 2.')
  })

  it('the event is no longer listed: the card is removed, focus that was in it goes to the heading, the notice says so', async () => {
    h.reload = async () => ({ item: null, checkin: emptyCheckinState() })
    const { m, applied, headingFocus, cardChild } = harness()
    focused = cardChild
    await m.tree().onManaged(E1, { kind: 'retired' })
    await m.flush()
    expect(applied).toEqual([[E1, null]])
    expect(headingFocus.calls).toBe(1)
    expect(m.tree().notice).toBe('Event retired. This event is no longer listed.')
  })

  it('focus elsewhere when the card leaves: focus is not moved', async () => {
    h.reload = async () => ({ item: null, checkin: emptyCheckinState() })
    const { m, headingFocus } = harness()
    focused = { id: 'somewhere-else' }
    await m.tree().onManaged(E1, { kind: 'date_cancelled' })
    expect(headingFocus.calls).toBe(0)
  })

  it('the re-read fails: the card stays as it was, one warn row, the save is still announced', async () => {
    h.reload = async () => {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    }
    const { m, applied } = harness()
    await m.tree().onManaged(E1, { kind: 'date_cancelled' })
    await m.flush()
    expect(applied).toEqual([])
    expect(h.warn).toEqual([['events.card.refresh_failed', { surface: 'feed', code: 'TimeoutError' }]])
    expect(m.tree().notice).toBe('Date cancelled.')
  })
})

describe('Events tab: the change is announced in its one status region', () => {
  it('the notice is the status text once the list is ready (a load or a failure keeps its own message)', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { EventsTabView } = await import('@/components/panels/events-panel')
    const items = [card('occ-a', E1, '2099-10-20T14:00:00Z')]
    const view = (state: Parameters<typeof EventsTabView>[0]['state']) =>
      renderToStaticMarkup(createElement(EventsTabView, { state, locale: 'en', onRetry: () => {}, onCheckedIn: () => {}, notice: 'Date cancelled.' }))
    const status = (html: string) => html.match(/data-testid="events-tab-status">([^<]*)</)?.[1]
    expect(status(view({ status: 'ready', items, checkin: emptyCheckinState(), loadedAt: 0 }))).toBe('Date cancelled.')
    expect(status(view({ status: 'loading' }))).toBe('Loading events…')
    expect(view({ status: 'ready', items, checkin: emptyCheckinState(), loadedAt: 0 }).match(/role="status"/g)).toHaveLength(1)
  })
})

describe('wiring — the panels re-read one card and never reload the list for a card change', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('feed: the card change handler replaces the card in place (rank kept) and never calls refreshFeed', () => {
    const src = read('../components/panels/feed-panel.tsx')
    const start = src.indexOf('const applyEventCard = useCallback(')
    const block = src.slice(start, src.indexOf('// Initial fetch + mode-change refetch', start))
    expect(block).toContain('replaceEventCard(prev, eventId, item, (was, next) => ({ ...next, score: was.score, distanceBucket: was.distanceBucket }))')
    expect(block).not.toMatch(/refreshFeed|fetchRankedPosts|fetchPosts|setLoading/)
    expect(src).toMatch(/onManaged=\{handleEventManaged\}/)
  })

  it('Events tab: the card change re-files the one card and never re-runs the list load', () => {
    const src = read('../components/panels/events-panel.tsx')
    const start = src.indexOf('const applyCard = useCallback(')
    const block = src.slice(start, src.indexOf('const reload = useCallback(', start))
    expect(block).toContain('orderByShownDate(replaceEventCard(prev.items, eventId, item, (_was, next) => next))')
    expect(block).not.toMatch(/load\(\)|status: 'loading'/)
    expect(src).toMatch(/onManaged=\{onManaged\}/)
  })
})
