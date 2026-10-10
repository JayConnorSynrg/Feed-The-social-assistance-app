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
  groupEventsByVenueDay,
  keepFeedRank,
  orderByShownDate,
  replaceEventCard,
  type EventCardItem,
  type EventFeedItem,
  type EventOccurrenceRow,
  type UpcomingEventRow,
} from '@/components/feed/post-model'
import { useEventCardRefresh } from '@/hooks/use-event-card-refresh'
import { withFeedSync } from '@/components/panels/events-panel'
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
  const keepRank = keepFeedRank

  it('keepFeedRank: the re-read card\'s fields with the score and bucket the feed placed it by', () => {
    const was: EventFeedItem = { ...b, score: 7.5, distanceBucket: '2-5km' }
    const next: EventCardItem = { ...b, title: 'Renamed', startsAt: '2026-12-01T14:00:00Z' }
    expect(keepFeedRank(was, next)).toEqual({ ...next, score: 7.5, distanceBucket: '2-5km' })
  })

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

  /**
   * A list with E1's card in it. `dom.card` is the mounted card (null once it left), `dom.trigger`
   * its ⋯ button; `remount()` replaces both, as React does when the Events tab files the card under
   * another day (the old elements are detached, focus falls to <body>).
   */
  function harness() {
    const applied: Array<[string, EventCardItem | null]> = []
    const headingFocus = { calls: 0 }
    const makeCard = () => {
      const trigger = { id: 'trigger', focus: vi.fn(() => { focused = trigger }) }
      const card = { contains: (el: unknown) => el === trigger }
      return { card, trigger }
    }
    const dom: { card: { contains: (el: unknown) => boolean } | null; trigger: { focus: () => void } | null } = makeCard()
    const root = () =>
      ({
        querySelector: (sel: string) =>
          !sel.includes(E1) ? null : sel.startsWith('[data-event-id=') ? dom.card : sel.startsWith('[data-testid="event-menu-') ? dom.trigger : null,
      }) as unknown as ParentNode
    const remount = () => Object.assign(dom, makeCard())
    const leave = () => Object.assign(dom, { card: null, trigger: null })
    let onApply: () => void = () => {}
    const m = mount(() =>
      useEventCardRefresh({
        supabase: {} as never,
        surface: 'events_tab',
        userId: 'u1',
        isGuest: false,
        locale: 'en',
        timeoutMs: 1000,
        apply: (id, item) => {
          applied.push([id, item])
          onApply()
        },
        root,
        focusHeading: () => headingFocus.calls++,
      }),
    )
    return { m, applied, headingFocus, dom, remount, leave, setOnApply: (f: () => void) => (onApply = f) }
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

  it('Events tab: the card moves to another day group (remounted) — focus goes to its NEW ⋯ trigger', async () => {
    // The scenario: the date moves from this week to later, so the card is filed under another group.
    const before = card('occ-1', E1, '2026-10-24T14:00:00Z')
    const after = { ...before, startsAt: '2026-11-20T14:00:00Z', endsAt: '2026-11-20T16:00:00Z' }
    const now = Date.parse('2026-10-22T12:00:00Z')
    expect(groupEventsByVenueDay([before], now).week).toHaveLength(1)
    expect(groupEventsByVenueDay([after], now).later).toHaveLength(1)
    h.reload = async () => ({ item: after, checkin: emptyCheckinState() })
    const { m, dom, remount, setOnApply, headingFocus } = harness()
    focused = dom.trigger // focus came back to the ⋯ trigger when the dialog closed
    setOnApply(() => {
      remount()
      focused = null // the old trigger was detached with its card
    })
    await m.tree().onManaged(E1, { kind: 'updated' })
    expect(dom.trigger!.focus).toHaveBeenCalledTimes(1)
    expect(focused).toBe(dom.trigger)
    expect(headingFocus.calls).toBe(0)
  })

  it('the card stays mounted (same day group / the feed): focus is left where it is', async () => {
    h.reload = async () => ({ item: renamed, checkin: emptyCheckinState() })
    const { m, dom, headingFocus } = harness()
    const trigger = dom.trigger!
    focused = trigger
    await m.tree().onManaged(E1, { kind: 'updated' })
    expect(trigger.focus).not.toHaveBeenCalled()
    expect(focused).toBe(trigger)
    expect(headingFocus.calls).toBe(0)
  })

  it('the event is no longer listed: the card is removed, focus that was in it goes to the heading, the notice says so', async () => {
    h.reload = async () => ({ item: null, checkin: emptyCheckinState() })
    const { m, applied, headingFocus, dom, leave, setOnApply } = harness()
    focused = dom.trigger
    setOnApply(() => {
      leave()
      focused = null
    })
    await m.tree().onManaged(E1, { kind: 'retired' })
    await m.flush()
    expect(applied).toEqual([[E1, null]])
    expect(headingFocus.calls).toBe(1)
    expect(m.tree().notice).toBe('Event retired. This event is no longer listed.')
  })

  it('the focused card left: focus moves to the heading FIRST, and the notice is set in that same frame, right after', async () => {
    h.reload = async () => ({ item: null, checkin: emptyCheckinState() })
    const frames: Array<() => void> = []
    g.requestAnimationFrame = (cb: () => void) => frames.push(cb)
    const trigger = { id: 'trigger' }
    focused = trigger
    const order: string[] = []
    const root = () =>
      ({ querySelector: (sel: string) => (sel.includes(E1) && sel.startsWith('[data-event-id=') ? { contains: (el: unknown) => el === trigger } : null) }) as unknown as ParentNode
    const m = mount(() =>
      useEventCardRefresh({
        supabase: {} as never,
        surface: 'feed',
        userId: 'u1',
        isGuest: false,
        locale: 'en',
        timeoutMs: 1000,
        apply: (id, item) => order.push(`apply ${id} ${item === null ? 'removed' : 'kept'} (notice: "${m.rerender().notice}")`),
        root,
        focusHeading: () => order.push(`focus heading (notice: "${m.rerender().notice}")`),
      }),
    )
    await m.tree().onManaged(E1, { kind: 'retired' })
    await m.flush()
    // Before the frame: the card is still listed, nothing announced, focus not moved.
    expect(m.tree().notice).toBe('')
    expect(order).toEqual([])
    expect(frames).toHaveLength(1)
    frames.splice(0).forEach((f) => f())
    m.rerender()
    // In the frame: heading first, then the list update, then the notice.
    expect(order).toEqual(['focus heading (notice: "")', `apply ${E1} removed (notice: "")`])
    expect(m.tree().notice).toBe('Event retired. This event is no longer listed.')
  })

  it('a newer save on the same card wins over an older save\'s pending frame (no stale notice, no focus move)', async () => {
    const frames: Array<() => void> = []
    g.requestAnimationFrame = (cb: () => void) => frames.push(cb)
    const answers = [
      { item: null, checkin: emptyCheckinState() }, // save A: the card left
      { item: card('occ-1', E1, '2026-10-24T14:00:00Z', 'Back again'), checkin: emptyCheckinState() }, // save B
    ]
    h.reload = async () => answers.shift()!
    const { m, applied, headingFocus, dom } = harness()
    focused = dom.trigger
    await m.tree().onManaged(E1, { kind: 'retired' }) // A resolves gone; its frame is pending
    expect(frames).toHaveLength(1)
    await m.tree().onManaged(E1, { kind: 'updated' }) // B resolves, still listed
    await m.flush()
    // A's frame, then B's two frames.
    while (frames.length) frames.splice(0).forEach((f) => f())
    m.rerender()
    expect(m.tree().notice).toBe('Changes saved.')
    expect(headingFocus.calls).toBe(0)
    expect(applied.map(([, i]) => i?.title ?? null)).toEqual(['Back again'])
  })

  it('a still-listed card re-filed under another day: the notice stays empty until focus has landed on its new ⋯ trigger', async () => {
    const frames: Array<() => void> = []
    g.requestAnimationFrame = (cb: () => void) => frames.push(cb)
    h.reload = async () => ({ item: renamed, checkin: emptyCheckinState() })
    const { m, dom, remount, setOnApply } = harness()
    focused = dom.trigger
    setOnApply(() => {
      remount()
      focused = null
    })
    const noticeAtFocus: string[] = []
    await m.tree().onManaged(E1, { kind: 'updated' })
    await m.flush()
    const newTrigger = dom.trigger as { focus: ReturnType<typeof vi.fn> }
    newTrigger.focus.mockImplementation(() => {
      focused = newTrigger
      noticeAtFocus.push(m.rerender().notice)
    })
    expect(m.tree().notice).toBe('')
    frames.splice(0).forEach((f) => f()) // first frame: React commits
    m.rerender()
    expect(m.tree().notice).toBe('')
    frames.splice(0).forEach((f) => f()) // second frame: focus, then the notice
    m.rerender()
    expect(noticeAtFocus).toEqual([''])
    expect(m.tree().notice).toBe('Changes saved.')
  })

  it('feed: the card left but its exit animation still holds it in the DOM — focus goes to the heading anyway', async () => {
    h.reload = async () => ({ item: null, checkin: emptyCheckinState() })
    const { m, applied, headingFocus, dom, setOnApply } = harness()
    focused = dom.trigger
    // AnimatePresence keeps the leaving card mounted (and focus inside it) for its exit animation.
    setOnApply(() => {})
    await m.tree().onManaged(E1, { kind: 'retired' })
    await m.flush()
    expect(applied).toEqual([[E1, null]])
    expect(headingFocus.calls).toBe(1)
  })

  it('focus elsewhere when the card changes: focus is not moved', async () => {
    h.reload = async () => ({ item: null, checkin: emptyCheckinState() })
    const { m, headingFocus, leave, setOnApply } = harness()
    focused = { id: 'somewhere-else' }
    setOnApply(leave)
    await m.tree().onManaged(E1, { kind: 'date_cancelled' })
    expect(headingFocus.calls).toBe(0)
  })

  it('quietly (the feed while the Events tab is on screen): same re-read and apply, no announcement, no focus move', async () => {
    h.reload = async () => ({ item: { ...renamed, status: 'cancelled', cancelledShown: 'none', cancelledStartsAt: renamed.startsAt }, checkin: emptyCheckinState() })
    const { m, applied, headingFocus, dom, leave, setOnApply } = harness()
    focused = dom.trigger
    setOnApply(leave)
    await m.tree().refreshQuietly(E1, { kind: 'date_cancelled' })
    await m.flush()
    expect(applied).toEqual([[E1, expect.objectContaining({ cancelledShown: 'none' })]])
    expect(m.tree().notice).toBe('')
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
    expect(h.warn).toEqual([['events.card.refresh_failed', { surface: 'events_tab', code: 'TimeoutError' }]])
    expect(m.tree().notice).toBe('Date cancelled.')
  })
})

describe('an Events-tab cancel also updates the feed copy of that event', () => {
  it('the Events tab handler runs its own re-read, then the feed sync, with the same event and change', () => {
    const calls: string[] = []
    const handler = withFeedSync(
      (id, c) => calls.push(`tab:${id}:${c.kind}`),
      (id, c) => calls.push(`feed:${id}:${c.kind}`),
    )
    handler(E1, { kind: 'date_cancelled' })
    expect(calls).toEqual([`tab:${E1}:date_cancelled`, `feed:${E1}:date_cancelled`])
    // Without a feed (the tab mounted alone) it still works.
    expect(() => withFeedSync(() => {})(E1, { kind: 'updated' })).not.toThrow()
  })

  it('the feed state: its card for that event becomes the re-read (cancelled) card, rank kept, others untouched', () => {
    const shown = card('occ-1', E1, '2026-10-24T14:00:00Z')
    const other = card('occ-2', E2, '2026-10-25T14:00:00Z')
    const feed: EventFeedItem[] = [
      { ...shown, score: 9, distanceBucket: '<2km' },
      { ...other, score: 4, distanceBucket: '5-10km' },
    ]
    const reread = { ...shown, status: 'cancelled', cancelledShown: 'next' as const, cancelledStartsAt: shown.startsAt, startsAt: '2026-10-31T14:00:00Z' }
    const out = replaceEventCard(feed, E1, reread, keepFeedRank)
    expect(out[0]).toMatchObject({ eventId: E1, cancelledShown: 'next', startsAt: '2026-10-31T14:00:00Z', score: 9, distanceBucket: '<2km' })
    expect(out[1]).toBe(feed[1])
  })
})

describe('Events tab: the list status and the card notice are two regions', () => {
  const render = async (state: Parameters<typeof import('@/components/panels/events-panel').EventsTabView>[0]['state'], notice: string) => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { EventsTabView } = await import('@/components/panels/events-panel')
    const html = renderToStaticMarkup(createElement(EventsTabView, { state, locale: 'en', onRetry: () => {}, onCheckedIn: () => {}, notice }))
    const region = (id: string) => html.match(new RegExp(`data-testid="${id}">([^<]*)<`))?.[1]
    return { status: region('events-tab-status'), notice: region('events-tab-notice') }
  }

  it('a save removed the last card: the status says the empty sentence AND the notice region holds the notice', async () => {
    expect(await render({ status: 'ready', items: [], checkin: emptyCheckinState(), loadedAt: 0 }, 'Event retired. This event is no longer listed.')).toEqual({
      status: 'No upcoming events yet.',
      notice: 'Event retired. This event is no longer listed.',
    })
  })

  it('a load after a save: the status says loading, the notice is untouched', async () => {
    expect(await render({ status: 'loading' }, 'Date cancelled.')).toEqual({ status: 'Loading events…', notice: 'Date cancelled.' })
  })

  it('cards on screen: the status is quiet, the notice speaks', async () => {
    const items = [card('occ-a', E1, '2099-10-20T14:00:00Z')]
    expect(await render({ status: 'ready', items, checkin: emptyCheckinState(), loadedAt: 0 }, 'Date cancelled.')).toEqual({ status: '', notice: 'Date cancelled.' })
  })
})

describe('wiring — the Events tab re-reads one card and never reloads the list for a card change', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('Events tab: the card change re-files the one card and never re-runs the list load', () => {
    const src = read('../components/panels/events-panel.tsx')
    const start = src.indexOf('const applyCard = useCallback(')
    const block = src.slice(start, src.indexOf('const reload = useCallback(', start))
    expect(block).toContain('orderByShownDate(replaceEventCard(prev.items, eventId, item, (_was, next) => next))')
    expect(block).not.toMatch(/load\(\)|status: 'loading'/)
    expect(src).toMatch(/onManaged=\{onManaged\}/)
  })
})
