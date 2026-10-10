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
import { createCardNoticeAnnouncer, useFeedEventCards } from './use-feed-event-cards'
import { buildEventCards, type EventFeedItem, type EventOccurrenceRow } from '@/components/feed/post-model'

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

let noticeContext = 'feed|'
function setup(initial: EventFeedItem[]) {
  noticeContext = 'feed|'
  const m = mount(() =>
    useFeedEventCards({ supabase: supabase as never, userId: null, isGuest: false, locale: 'en', timeoutMs: 1000, focusHeading: () => {}, noticeContext }),
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

  it('the same sentence twice (two identical saves) is announced twice: the notice empties, then speaks again', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    const heard: string[] = []
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    heard.push(m.tree().feedNotice)
    const second = m.tree().handleEventManaged(E1, { kind: 'updated' })
    m.rerender()
    heard.push(m.tree().feedNotice)
    await second
    await m.flush()
    heard.push(m.tree().feedNotice)
    expect(heard).toEqual(['Changes saved.', '', 'Changes saved.'])
  })

  it('a first-page reload after a save (the feed resets its event cards) leaves the notice untouched', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    // What fetchPosts / fetchRankedPosts do to this hook on a first page.
    m.tree().setEventItems([])
    m.tree().setEventMyStatuses({})
    m.rerender()
    expect(m.tree().feedNotice).toBe('Changes saved.')
  })

  it('leaving the sub-tab clears the card notice (silently), and coming back does not bring it back', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    expect(m.tree().feedNotice).toBe('Changes saved.')
    noticeContext = 'events|'
    m.rerender()
    expect(m.tree().feedNotice).toBe('')
    noticeContext = 'feed|'
    m.rerender()
    expect(m.tree().feedNotice).toBe('')
  })

  it('another account (user change) never finds the previous account\'s notice', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    noticeContext = 'feed|u1'
    m.rerender()
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    expect(m.tree().feedNotice).toBe('Changes saved.')
    noticeContext = 'feed|u2'
    m.rerender()
    expect(m.tree().feedNotice).toBe('')
  })

  it('the clear is not exposed: only a context change empties the notice; a same-context rerender keeps it', async () => {
    const m = setup([listed(E1, 'Saturday pantry', 0.42, '2-5km')])
    await m.tree().handleEventManaged(E1, { kind: 'updated' })
    await m.flush()
    expect('clearNotice' in m.tree()).toBe(false)
    m.rerender()
    expect(m.tree().feedNotice).toBe('Changes saved.')
    noticeContext = 'businesses|'
    m.rerender()
    expect(m.tree().feedNotice).toBe('')
  })
})

// Release 2: the post cards announce through the SAME card-notice region, by the same rules.
describe('createCardNoticeAnnouncer — post card notices share the card-notice region', () => {
  function harness() {
    const log: string[] = []
    const frames: Array<() => void> = []
    const a = createCardNoticeAnnouncer(
      (t) => log.push(`notice:${t}`),
      (fn) => frames.push(fn),
    )
    return { a, log, frames, runFrames: () => frames.splice(0).forEach((f) => f()) }
  }

  it('empty first, then the sentence set once (the same sentence twice is announced twice)', () => {
    const { a, log, runFrames } = harness()
    a.announce('Post updated.')
    expect(log).toEqual(['notice:'])
    runFrames()
    a.announce('Post updated.')
    runFrames()
    expect(log).toEqual(['notice:', 'notice:Post updated.', 'notice:', 'notice:Post updated.'])
  })

  it('when focus moves: in one frame, focus first, then the notice', () => {
    const { a, log, runFrames } = harness()
    a.announce('Post deleted.', () => log.push('focus:next card'))
    runFrames()
    expect(log).toEqual(['notice:', 'focus:next card', 'notice:Post deleted.'])
  })

  it('a newer announcement (or an event-card change) supersedes one still waiting for its frame', () => {
    const { a, log, runFrames } = harness()
    a.announce('Link copied.', () => log.push('focus:old'))
    a.announce('Post held for review.')
    runFrames()
    expect(log).toEqual(['notice:', 'notice:', 'notice:Post held for review.'])
    const h2 = harness()
    h2.a.announce('Post restored.')
    h2.a.supersede()
    h2.runFrames()
    expect(h2.log).toEqual(['notice:'])
  })

  it('one region: no feed post surface renders its own polite status region', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')
    for (const rel of ['../components/panels/feed-panel.tsx', '../components/feed/feed-post-card.tsx', '../components/feed/comment-thread.tsx']) {
      expect(src(rel), rel).not.toMatch(/role="status"/)
    }
    const panel = src('../components/panels/feed-panel.tsx')
    expect(panel).toContain('<FeedStatusRegions')
    // Both announcers in the feed — the composer and every comment thread — use the card notice.
    expect(panel).toMatch(/<CommentThread[\s\S]{0,200}onAnnounce=\{announceCardNotice\}/)
    expect(panel).toMatch(/<CreatePostCard[\s\S]{0,300}onAnnounce=\{announceCardNotice\}/)
    expect(panel).not.toMatch(/\bannounce\(/)
  })
})
