// apps/web/src/components/panels/events-panel.sync.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The real EventsPanel (mini hook runtime, Supabase double): a save made from an event card in the
// Events tab both re-reads that card for the tab AND tells the community feed (onEventChanged), so
// the feed's copy of the event is re-read too — observed through the handler the panel hands to its
// cards, not through its source text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
const h = vi.hoisted(() => ({ rpcs: [] as Array<[string, Record<string, unknown>]>, client: null as unknown }))
// The app's createClient is a singleton: one object for every render.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => (h.client ??= {
    rpc: (name: string, args: Record<string, unknown>) => {
      h.rpcs.push([name, args])
      const answer = Promise.resolve({ data: [], error: null })
      return Object.assign(answer, { abortSignal: () => answer })
    },
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'in', 'eq', 'gte', 'order', 'limit', 'abortSignal']) chain[m] = () => chain
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
      return chain
    },
  }),
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {}, setPanelParams: () => {} }) }))

import { mount } from '@/test/mini-react'
import { EventsPanel } from './events-panel'
import type { EventCardChange } from '@/components/events/event-card-admin-menu'

const E1 = '11111111-1111-4111-8111-111111111111'
const g = globalThis as unknown as { requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown }

beforeEach(() => {
  h.rpcs = []
  g.requestAnimationFrame = () => 0
  g.cancelAnimationFrame = () => {}
})
afterEach(() => {
  delete g.requestAnimationFrame
  delete g.cancelAnimationFrame
})

describe('EventsPanel — a card save reaches both the tab and the feed', () => {
  it('the handler its cards get re-reads the card for the tab and calls onEventChanged with the same event and change', async () => {
    const feed: Array<[string, EventCardChange]> = []
    const m = mount(() => EventsPanel({ onEventChanged: (id, c) => feed.push([id, c]) }))
    await m.flush()
    // The tab's list load.
    expect(h.rpcs.map(([n, a]) => [n, a.p_limit])).toEqual([['upcoming_events', 50]])
    const onManaged = (m.tree() as { props: { onManaged: (id: string, c: EventCardChange) => void } }).props.onManaged
    onManaged(E1, { kind: 'date_cancelled' })
    await m.flush()
    expect(feed).toEqual([[E1, { kind: 'date_cancelled' }]])
    // ...and the tab's own one-card re-read (every shown event considered, not the list's 50).
    expect(h.rpcs).toHaveLength(2)
    expect(h.rpcs[1][0]).toBe('upcoming_events')
    expect(h.rpcs[1][1].p_limit as number).toBeGreaterThan(50)
  })

  it('mounted without a feed, a save still re-reads the card for the tab', async () => {
    const m = mount(() => EventsPanel())
    await m.flush()
    ;(m.tree() as { props: { onManaged: (id: string, c: EventCardChange) => void } }).props.onManaged(E1, { kind: 'updated' })
    await m.flush()
    expect(h.rpcs).toHaveLength(2)
  })
})
