// apps/web/src/components/panels/events-panel.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E3/E4 — a followed "View in feed" link lands on the event in the members' Events list. The panel's
// decision logic, without a DOM: the focus waits for a read that started after it arrived (a list
// already on screen may predate the event), resolves exactly once (found -> that card; absent or
// unreadable -> not_found), and a miss shows one polite, translated status line; the found card is
// ringed. Scroll / focus movement itself is checked in a browser.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
  decideEventFocus,
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
    expect(EVENT_CARD_HIGHLIGHT).toMatch(/ring-lime-500/)
    expect(EVENT_CARD_HIGHLIGHT).not.toMatch(/(^| )transition/) // motion only under motion-safe
  })
})

describe('source contract', () => {
  const panel = readFileSync(fileURLToPath(new URL('./events-panel.tsx', import.meta.url)), 'utf8')
  it('arrival is keyed on the focus object (the subtab reached via alias does not remount)', () => {
    expect(panel).toMatch(/\}, \[focus, load\]\)/)
  })
  it('a resolution logs one nav.deeplink.resolve row with closed labels (no id) and clears the focus', () => {
    expect(panel).toMatch(/logEvent\('nav\.deeplink\.resolve', \{ kind: 'event', outcome: decision\.outcome, panel: 'events' \}\)/)
    expect(panel).toMatch(/prev\.focus === target \? \{ \.\.\.prev, focus: undefined \}/)
  })
  it('reduced motion scrolls without animation', () => {
    expect(panel).toMatch(/behavior: reduceMotion \? 'auto' : 'smooth'/)
    expect(panel).toMatch(/focus\(\{ preventScroll: true \}\)/)
  })
})
