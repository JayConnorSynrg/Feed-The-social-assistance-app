// apps/web/src/components/panels/events-panel.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E3/E4 — a followed "View in feed" link lands on the event in the members' Events list. The panel's
// decision logic, without a DOM: the focus waits for a read that started after it arrived (a list
// already on screen may predate the event), resolves exactly once (found -> that card; absent or
// unreadable -> not_found), and a miss shows one polite, translated status line; the found card is
// ringed. Scroll / focus movement itself is checked in a browser.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))

import {
  EventsTabView,
  abandonFocus,
  supersedeFocus,
  arriveFocus,
  decideEventFocus,
  endHighlight,
  prefersReducedMotion,
  type HighlightHandle,
  focusSettles,
  takeSettledFocus,
  type EventsTabState,
  type PendingFocus,
} from './events-panel'
import { EVENT_CARD_HIGHLIGHT } from '@/components/feed/event-card'
import { buildEventCards, type EventOccurrenceRow } from '@/components/feed/post-model'

const NY = 'America/New_York'
const E1 = '8f285b5a-4e4f-4bbc-b661-23fcaf84353a'
const E2 = '11111111-1111-4111-8111-111111111111'
const ABSENT = '22222222-2222-4222-8222-222222222222'

function occ(id: string, eventId: string): EventOccurrenceRow {
  return {
    id,
    starts_at: '2026-10-15T13:00:00Z',
    ends_at: '2026-10-15T18:00:00Z',
    status: 'upcoming',
    notes: null,
    capacity: null,
    source: 'rule',
    event: {
      id: eventId,
      title: 'Event ' + eventId.slice(0, 4),
      event_type: 'pantry',
      location_name: 'Hall',
      city: 'Rutland',
      state: 'VT',
      requires_registration: false,
      time_zone: NY,
      recurrence: null,
      organization: { name: 'FEED' },
    },
  }
}
const ready = (...eventIds: string[]): EventsTabState => ({
  status: 'ready',
  items: buildEventCards(eventIds.map((_, i) => ({ occurrenceId: `o${i}` })), eventIds.map((e, i) => occ(`o${i}`, e))),
  checkin: { statuses: {}, anonClaims: new Set() },
  loadedAt: Date.parse('2026-10-08T19:00:00Z'),
})
const target = (id: string) => ({ kind: 'event' as const, id })

describe('decideEventFocus', () => {
  it('the event is in the list -> found, that card', () => {
    expect(decideEventFocus(target(E2), ready(E1, E2))).toEqual({ outcome: 'found', eventId: E2 })
  })
  it('not in the list (beyond LIMIT 50, or out of the window) -> not_found', () => {
    expect(decideEventFocus(target(ABSENT), ready(E1, E2))).toEqual({ outcome: 'not_found' })
    expect(decideEventFocus(target(E1), ready())).toEqual({ outcome: 'not_found' })
  })
  it('the list could not be read -> not_found', () => {
    expect(decideEventFocus(target(E1), { status: 'error' })).toEqual({ outcome: 'not_found' })
  })
})

describe('the focus waits for a fresh read, then resolves exactly once', () => {
  it('never against the loading state, nor the list that was on screen when it arrived', () => {
    const onScreen = ready(E1)
    const pending: PendingFocus = { target: target(E2), staleState: onScreen }
    expect(focusSettles(null, onScreen)).toBe(false)
    expect(focusSettles(pending, onScreen)).toBe(false)
    expect(focusSettles(pending, { status: 'loading' })).toBe(false)
    expect(focusSettles(pending, ready(E1, E2))).toBe(true)
  })
  it('a list re-read after the link finds an event created after the first read', () => {
    const ref = { current: { target: target(E2), staleState: ready(E1) } as PendingFocus | null }
    expect(takeSettledFocus(ref, ref.current!.staleState!)).toBeNull()
    expect(takeSettledFocus(ref, ready(E1, E2))).toEqual({ target: target(E2), decision: { outcome: 'found', eventId: E2 } })
  })
  it('one link -> one resolution, whatever renders follow (one nav.deeplink.resolve row)', () => {
    const ref = { current: { target: target(E1), staleState: null } as PendingFocus | null }
    const states: EventsTabState[] = [{ status: 'loading' }, ready(E1), ready(E1), { status: 'loading' }, ready(E1)]
    const taken = states.map((s) => takeSettledFocus(ref, s)).filter(Boolean)
    expect(taken).toHaveLength(1)
    expect(ref.current).toBeNull()
  })
})

describe('what the member sees', () => {
  const view = (state: EventsTabState, extra: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en') =>
    renderToStaticMarkup(
      h(EventsTabView, { state, locale, onRetry: () => {}, onCheckedIn: () => {}, now: Date.parse('2026-10-08T19:00:00Z'), viewerTz: NY, ...extra }),
    )
  const statusRegion = (html: string) => html.match(/<p role="status"[^>]*data-testid="events-tab-status"[^>]*>([^<]*)<\/p>/)?.[1]

  it('not found: one polite status line in the member\'s language; the list stays as it is', () => {
    const html = view(ready(E1), { focusMiss: true })
    expect(statusRegion(html)).toBe('That event isn&#x27;t in the upcoming list right now.')
    expect(html).toContain('data-testid="events-focus-miss"')
    expect(html.match(/role="(status|alert)"/g)).toHaveLength(1)
    expect(html).toContain(`data-event-id="${E1}"`)
    expect(html).not.toContain(EVENT_CARD_HIGHLIGHT)
    expect(statusRegion(view(ready(E1), { focusMiss: true }, 'es'))).toBe('Ese evento no está en la lista de próximos eventos en este momento.')
  })
  it('no miss line while the list is loading or failed (those have their own message)', () => {
    expect(view({ status: 'loading' }, { focusMiss: true })).not.toContain('events-focus-miss')
    expect(statusRegion(view({ status: 'error' }, { focusMiss: true }))).toBe('Events could not be loaded.')
  })
  it('found: only that card carries the lime highlight ring', () => {
    const html = view(ready(E1, E2), { highlightId: E2 })
    const cards = html.match(/<article [^>]*>/g) ?? []
    expect(cards).toHaveLength(2)
    expect(cards.find((c) => c.includes(E2))).toContain(EVENT_CARD_HIGHLIGHT)
    expect(cards.find((c) => c.includes(E1))).not.toContain(EVENT_CARD_HIGHLIGHT)
    expect(EVENT_CARD_HIGHLIGHT).toMatch(/(^| )ring-lime-700( |$)/) // 4.96:1 on the white offset (1.4.11)
    expect(EVENT_CARD_HIGHLIGHT).not.toMatch(/(^| )transition/) // motion only under motion-safe
  })
})

describe('arrival (arriveFocus)', () => {
  it('a list already on screen: the focus waits for a re-read, never that list', () => {
    const onScreen = ready(E1)
    const { pending, reread } = arriveFocus(target(E2), onScreen)
    expect(reread).toBe(true)
    expect(pending.staleState).toBe(onScreen)
    expect(pending.target).toEqual(target(E2))
    // The event created after that list was read is found once the re-read settles.
    const ref = { current: pending as PendingFocus | null }
    expect(takeSettledFocus(ref, onScreen)).toBeNull()
    expect(takeSettledFocus(ref, ready(E1, E2))?.decision).toEqual({ outcome: 'found', eventId: E2 })
  })
  it('a failed list on screen is read again too', () => {
    const failed: EventsTabState = { status: 'error' }
    expect(arriveFocus(target(E1), failed)).toEqual({ pending: { target: target(E1), staleState: failed }, reread: true })
  })
  it('while a read is running: no second read; that read resolves it', () => {
    const { pending, reread } = arriveFocus(target(E1), { status: 'loading' })
    expect(reread).toBe(false)
    expect(pending.staleState).toBeNull()
    expect(takeSettledFocus({ current: pending }, ready(E1))?.decision).toEqual({ outcome: 'found', eventId: E1 })
  })
})

describe('leaving before the list loads (abandonFocus)', () => {
  it('a waiting focus is abandoned exactly once (one `abandoned` row)', () => {
    const ref = { current: arriveFocus(target(E1), { status: 'loading' }).pending as PendingFocus | null }
    expect([abandonFocus(ref), abandonFocus(ref)]).toEqual([true, false])
  })
  it('a resolved focus is not abandoned (its row is already written)', () => {
    const ref = { current: arriveFocus(target(E1), { status: 'loading' }).pending as PendingFocus | null }
    expect(takeSettledFocus(ref, ready(E1))).not.toBeNull()
    expect(abandonFocus(ref)).toBe(false)
  })
})

describe('reduced motion (prefersReducedMotion)', () => {
  it("FEED's own setting or the operating system's", () => {
    expect(prefersReducedMotion('reduce', false)).toBe(true)
    expect(prefersReducedMotion(undefined, true)).toBe(true)
    expect(prefersReducedMotion(undefined, false)).toBe(false)
  })
})

describe('the highlight lasts 4 s from the latest link (endHighlight)', () => {
  it('a re-click within 4 s ends the first timer, so it cannot clear the new highlight early', () => {
    vi.useFakeTimers()
    try {
      let shown = 0
      const detach = vi.fn()
      let handle: HighlightHandle | null = { timer: setTimeout(() => (shown = 0), 4000), detach }
      shown = 1
      vi.advanceTimersByTime(3000)
      handle = endHighlight(handle, clearTimeout) // the second link arrives
      expect(detach).toHaveBeenCalledTimes(1)
      handle = { timer: setTimeout(() => (shown = 0), 4000), detach: () => {} }
      shown = 2
      vi.advanceTimersByTime(1500) // past the first timer's 4 s
      expect(shown).toBe(2)
      vi.advanceTimersByTime(2500) // the second timer's own 4 s
      expect(shown).toBe(0)
      expect(endHighlight(null, clearTimeout)).toBeNull()
      void handle
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a second link before the list loads (supersedeFocus)', () => {
  it('the waiting focus is abandoned once, the new one waits (a row per arrival)', () => {
    const ref = { current: null as PendingFocus | null }
    const first = arriveFocus(target(E1), { status: 'loading' }).pending
    const second = arriveFocus(target(E1), { status: 'loading' }).pending
    expect(supersedeFocus(ref, first)).toBe(false)
    expect(supersedeFocus(ref, second)).toBe(true)
    expect(ref.current).toBe(second)
  })
  it('a resolved focus is not abandoned when the next link arrives', () => {
    const ref = { current: arriveFocus(target(E1), { status: 'loading' }).pending as PendingFocus | null }
    expect(takeSettledFocus(ref, ready(E1))).not.toBeNull()
    expect(supersedeFocus(ref, arriveFocus(target(E1), { status: 'loading' }).pending)).toBe(false)
  })
})
