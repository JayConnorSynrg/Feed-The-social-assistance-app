// apps/web/src/app/(admin)/moderation/event-scheduler.scope.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What the Events tab reads. Security: on an organization's own page (EventScheduler given a real
// org id) EVERY read is filtered to that org and get_admin_org_list (which would read every org's
// name) is never called; in the main admin ('all') every read is filtered to the orgs the caller
// administers. Completeness: the reads are bounded without losing near-term dates — events with
// only their next date, the visible calendar window (one day wider each side), past and cancelled
// newest first, 50 at a time.
//
// No DOM here (vitest env node): React's hooks are replaced by synchronous stand-ins so the
// component function runs its effects once, against a recording Supabase client.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Call = [string, ...unknown[]]
const rec = vi.hoisted(() => ({
  rpc: [] as string[],
  queries: [] as Array<{ table: string; calls: Call[] }>,
  // "Edit in admin": the claimed focus session (null = no ?focus=) and what the by-id read returns.
  session: null as null | { focus: { kind: string; id: string }; isOpen: () => boolean; resolve: (o: string) => boolean },
  resolved: [] as string[],
  focusedRow: null as unknown,
}))
vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => rec.session }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, () => {}],
    useEffect: (fn: () => void) => {
      fn()
    },
    useMemo: (fn: () => unknown) => fn(),
    useRef: (v: unknown) => ({ current: v }),
    useCallback: (fn: unknown) => fn,
    useId: () => 'id',
  }
})

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ loading: false, profile: null }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, withMetric: vi.fn(), logEvent: vi.fn() }))

function recordingClient() {
  return {
    from: (table: string) => {
      const q = { table, calls: [] as Call[] }
      rec.queries.push(q)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'eq', 'in', 'gte', 'lt', 'or', 'range']) {
        chain[m] = (...args: unknown[]) => {
          q.calls.push([m, ...args])
          return chain
        }
      }
      chain.then = () => undefined
      chain.maybeSingle = () => {
        q.calls.push(['maybeSingle'])
        return { then: (res: (v: unknown) => unknown) => res({ data: rec.focusedRow, error: null }) }
      }
      return chain
    },
    rpc: (name: string) => {
      rec.rpc.push(name)
      return { then: () => undefined }
    },
  }
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => recordingClient() }))

import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CalendarWindowStatus,
  EventScheduler,
  PAST_PAGE,
  WINDOW_LIMIT,
  calendarWindow,
  eventListQuery,
  pastDatesQuery,
  pastPage,
  focusAfterWindowRetry,
  visibleCalendarLabel,
  windowDatesQuery,
  windowResult,
  decideEventFocus,
  eventFocusNotice,
  toEditTarget,
} from './event-scheduler'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ORG = '705c100e-77f3-4807-9788-ff1ab4b26bb1'

beforeEach(() => {
  rec.rpc.length = 0
  rec.queries.length = 0
  rec.session = null
  rec.resolved.length = 0
  rec.focusedRow = null
})

const callsOf = (q: { calls: Call[] }, m: string) => q.calls.filter((c) => c[0] === m).map((c) => c.slice(1))

describe('EventScheduler scope', () => {
  it('a real org id: no get_admin_org_list call; all three reads filtered to that org only', () => {
    EventScheduler({ selectedOrgId: ORG })
    expect(rec.rpc).not.toContain('get_admin_org_list')
    expect(rec.queries.map((q) => q.table)).toEqual(['assistance_events', 'event_occurrences', 'event_occurrences'])
    const [events, past, window] = rec.queries
    expect(callsOf(events, 'eq')).toContainEqual(['org_id', ORG])
    expect(callsOf(past, 'eq')).toContainEqual(['event.org_id', ORG])
    expect(callsOf(window, 'eq')).toContainEqual(['event.org_id', ORG])
    // Nested org filters only exclude rows through an INNER join.
    for (const q of [past, window]) expect(String(callsOf(q, 'select')[0][0])).toMatch(/event:assistance_events!inner\(/)
    for (const q of rec.queries) expect(callsOf(q, 'in')).toEqual([])
  })

  it("'all' (main admin): reads the caller's admin org list", () => {
    EventScheduler({ selectedOrgId: 'all' })
    expect(rec.rpc).toEqual(['get_admin_org_list'])
  })

  it("'all' once the admin org list is known: every read is filtered to those orgs", () => {
    const client = recordingClient() as never
    const scope = { kind: 'orgs' as const, orgIds: ['o-1', 'o-2'] }
    eventListQuery(client, scope, '2026-10-07T12:00:00.000Z')
    windowDatesQuery(client, scope, 'a', 'b')
    pastDatesQuery(client, scope, '2026-10-07T12:00:00.000Z', 0)
    expect(rec.queries.map((q) => callsOf(q, 'in')[0])).toEqual([
      ['org_id', ['o-1', 'o-2']],
      ['event.org_id', ['o-1', 'o-2']],
      ['event.org_id', ['o-1', 'o-2']],
    ])
  })
})

describe('bounded reads that keep near-term dates', () => {
  const scope = { kind: 'org' as const, orgId: ORG }
  const now = '2026-10-07T12:00:00.000Z'

  it('events: each with ONLY its next upcoming, not-ended date (aliased embed, oldest first, 1 row)', () => {
    eventListQuery(recordingClient() as never, scope, now)
    const q = rec.queries[0]
    expect(String(callsOf(q, 'select')[0][0])).toMatch(/next:event_occurrences\(id, event_id, starts_at, ends_at, status, capacity, notes, source, cancel_reason\)/)
    expect(String(callsOf(q, 'select')[0][0])).toMatch(/recurrence, series_start_local, series_duration, announce_days_before/)
    expect(callsOf(q, 'eq')).toContainEqual(['next.status', 'upcoming'])
    expect(callsOf(q, 'gte')).toEqual([['next.ends_at', now], ['feed_next.ends_at', now]])
    expect(callsOf(q, 'order')).toContainEqual(['starts_at', { referencedTable: 'next', ascending: true }])
    expect(callsOf(q, 'limit')).toContainEqual([1, { referencedTable: 'next' }])
  })

  it('events: for "View in feed", the org is_active and the soonest date event_feed_next considers', () => {
    eventListQuery(recordingClient() as never, scope, now)
    const q = rec.queries[0]
    const select = String(callsOf(q, 'select')[0][0])
    expect(select).toMatch(/org:organizations\(name, is_active\)/)
    expect(select).toMatch(/feed_next:event_occurrences\(id, event_id, starts_at, ends_at, status, capacity, notes, source, cancel_reason\)/)
    // event_feed_next :412-415 — upcoming, or cancelled with a reason IS DISTINCT FROM retired / org_inactive
    // (a NULL reason counts, and `not.in` alone drops NULL, so it is spelled out).
    expect(callsOf(q, 'or')).toEqual([
      ['status.eq.upcoming,and(status.eq.cancelled,or(cancel_reason.is.null,cancel_reason.not.in.(retired,org_inactive)))', { referencedTable: 'feed_next' }],
    ])
    // :416 not ended; soonest first; one row.
    expect(callsOf(q, 'gte')).toContainEqual(['feed_next.ends_at', now])
    expect(callsOf(q, 'order')).toContainEqual(['starts_at', { referencedTable: 'feed_next', ascending: true }])
    expect(callsOf(q, 'limit')).toContainEqual([1, { referencedTable: 'feed_next' }])
  })

  it('calendar: every date starting inside the window, oldest first, no per-event cap, one overall bound', () => {
    windowDatesQuery(recordingClient() as never, scope, '2026-10-03T04:00:00.000Z', '2026-10-12T04:00:00.000Z')
    const q = rec.queries[0]
    expect(callsOf(q, 'gte')).toEqual([['starts_at', '2026-10-03T04:00:00.000Z']])
    expect(callsOf(q, 'lt')).toEqual([['starts_at', '2026-10-12T04:00:00.000Z']])
    expect(callsOf(q, 'order')).toEqual([['starts_at', { ascending: true }]])
    // One row past the bound tells the calendar there are more than it shows.
    expect(callsOf(q, 'limit')).toEqual([[WINDOW_LIMIT + 1]])
  })

  it('over the bound: the first WINDOW_LIMIT dates and a "showing the first N" line; a failed read is an error', () => {
    const rows = Array.from({ length: WINDOW_LIMIT + 1 }, (_, i) => ({ id: `o-${i}` }))
    const over = windowResult({ data: rows, error: null })
    expect(over.state === 'ready' && [over.dates.length, over.overLimit]).toEqual([WINDOW_LIMIT, true])
    const under = windowResult({ data: rows.slice(0, 3), error: null })
    expect(under.state === 'ready' && [under.dates.length, under.overLimit]).toEqual([3, false])
    expect(windowResult({ data: null, error: { code: '57014' } })).toEqual({ state: 'error' })
    const html = renderToStaticMarkup(h(CalendarWindowStatus, { result: { state: 'ready', overLimit: true }, locale: 'en', onRetry: () => {} }))
    expect(html).toContain(`Showing the first ${WINDOW_LIMIT} dates in this view.`)
    expect(renderToStaticMarkup(h(CalendarWindowStatus, { result: { state: 'ready', overLimit: false }, locale: 'en', onRetry: () => {} }))).toBe('')
  })

  it('a failed week read: an inline alert with Try again INSIDE the calendar; the tab itself stays (no full-page error)', () => {
    const html = renderToStaticMarkup(h(CalendarWindowStatus, { result: { state: 'error', overLimit: false }, locale: 'en', onRetry: () => {} }))
    expect(html).toMatch(/^<div role="alert"[^>]*><p[^>]*>The dates for this week could not be loaded\.<\/p><button type="button"[^>]*>Try again<\/button><\/div>$/)
  })

  it('"Load more dates": appends the page and announces it; a failure is shown and keeps the button; the last page hands focus to the heading', () => {
    const full = pastPage({ data: Array.from({ length: PAST_PAGE }, (_, i) => ({ id: `p-${i}` })), error: null }, 'en')
    expect([full.rows.length, full.hasMore, full.notice, full.error, full.focusHeading]).toEqual([50, true, 'Loaded 50 more.', false, false])
    const last = pastPage({ data: [{ id: 'p-1' }, { id: 'p-2' }], error: null }, 'en')
    expect([last.hasMore, last.notice, last.focusHeading]).toEqual([false, 'Loaded 2 more.', true])
    const failed = pastPage({ data: null, error: { code: '' } }, 'en')
    expect([failed.rows, failed.hasMore, failed.notice, failed.error]).toEqual([[], true, null, true])
  })

  it('the window covers the shown week AND the selected day, one day wider on each side', () => {
    const weekStart = new Date(2026, 9, 4) // Sun Oct 4, local midnight
    const w = calendarWindow(weekStart, new Date(2026, 9, 7, 15, 30))
    expect(w).toEqual({ fromIso: new Date(2026, 9, 3).toISOString(), toIso: new Date(2026, 9, 12).toISOString() })
    // A selected day outside the week (phone view moved ahead) widens the window to include it.
    const later = calendarWindow(weekStart, new Date(2026, 9, 20, 9))
    expect(later.toIso).toBe(new Date(2026, 9, 22).toISOString())
  })

  it('past and cancelled: ended / completed / cancelled, newest first, 50 per page', () => {
    pastDatesQuery(recordingClient() as never, scope, now, 50)
    const q = rec.queries[0]
    expect(callsOf(q, 'or')).toEqual([[`status.eq.cancelled,status.eq.completed,ends_at.lt."${now}"`]])
    expect(callsOf(q, 'order')).toEqual([['starts_at', { ascending: false }]])
    expect(callsOf(q, 'range')).toEqual([[50, 50 + PAST_PAGE - 1]])
    expect(PAST_PAGE).toBe(50)
  })
})

describe('after "Try again" on the calendar error', () => {
  const label = (visible: boolean) => ({ offsetParent: visible ? {} : null, focusCalls: 0, focus() { this.focusCalls++ } })

  it('success: focus lands once, on the calendar label that is on screen (week on wide screens, day on phones)', () => {
    const week = label(false)
    const day = label(true)
    const pending = { current: true }
    expect(focusAfterWindowRetry(pending, 'loading', visibleCalendarLabel([week, day]))).toBeNull()
    expect(focusAfterWindowRetry(pending, 'ready', visibleCalendarLabel([week, day]))).toBe('label')
    expect([week.focusCalls, day.focusCalls]).toEqual([0, 1])
    // A later reload (e.g. moving to the next week) does not move focus again.
    expect(focusAfterWindowRetry(pending, 'ready', visibleCalendarLabel([week, day]))).toBeNull()
    expect(day.focusCalls).toBe(1)
    expect(visibleCalendarLabel([label(true), label(true)])).not.toBeNull()
    expect(visibleCalendarLabel([null, label(false)])).toBeNull()
  })
})

describe('a retry that fails again', () => {
  it('focus stays on Try again (nothing else is focused) and the retry is used up', () => {
    const day = { offsetParent: {}, focusCalls: 0, focus() { this.focusCalls++ } }
    const pending = { current: true }
    expect(focusAfterWindowRetry(pending, 'error', day)).toBe('stay')
    expect(day.focusCalls).toBe(0)
    expect(pending.current).toBe(false)
  })

  it('the alert keeps its Try again button while retrying but drops its text, so the failure is announced again', () => {
    const render = (retrying: boolean) =>
      renderToStaticMarkup(h(CalendarWindowStatus, { result: { state: 'error', overLimit: false, retrying }, locale: 'en', onRetry: () => {} }))
    expect(render(true)).toMatch(/^<div role="alert"[^>]*><p class="text-sm text-red-700"><\/p><button type="button"[^>]*>Try again<\/button><\/div>$/)
    expect(render(false)).toContain('>The dates for this week could not be loaded.</p><button')
  })
})

describe('"Edit in admin" event link (I2)', () => {
  const EVENT = '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a'
  const OTHER_ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const claim = () => {
    rec.session = {
      focus: { kind: 'event', id: EVENT },
      isOpen: () => rec.resolved.length === 0,
      resolve: (o: string) => (rec.resolved.length ? false : (rec.resolved.push(o), true)),
    }
  }

  it("the organization's page: reads that event by id with the list's embeds, resolves found once", () => {
    claim()
    rec.focusedRow = { id: EVENT, org_id: ORG, org: { name: 'Pantry', is_active: true }, next: [], feed_next: [] }
    EventScheduler({ selectedOrgId: ORG, source: 'org_admin_events' })
    const byId = rec.queries.find((q) => callsOf(q, 'eq').some((c) => c[0] === 'id'))!
    expect(byId.table).toBe('assistance_events')
    expect(callsOf(byId, 'eq')).toContainEqual(['id', EVENT])
    expect(String(callsOf(byId, 'select')[0][0])).toMatch(/next:event_occurrences\(.*\), feed_next:event_occurrences\(/)
    expect(callsOf(byId, 'maybeSingle')).toHaveLength(1)
    expect(rec.resolved).toEqual(['found'])
  })

  it("another organization's event on this page: not_found (no edit dialog for it)", () => {
    claim()
    rec.focusedRow = { id: EVENT, org_id: OTHER_ORG, org: { name: 'Other', is_active: true }, next: [], feed_next: [] }
    EventScheduler({ selectedOrgId: ORG, source: 'org_admin_events' })
    expect(rec.resolved).toEqual(['not_found'])
  })

  it('no readable event: not_found', () => {
    claim()
    rec.focusedRow = null
    EventScheduler({ selectedOrgId: ORG })
    expect(rec.resolved).toEqual(['not_found'])
  })

  it("main shell: waits for the caller's organization list before reading (no by-id read yet)", () => {
    claim()
    EventScheduler({ selectedOrgId: 'all' })
    expect(rec.queries.some((q) => callsOf(q, 'eq').some((c) => c[0] === 'id'))).toBe(false)
    expect(rec.resolved).toEqual([])
  })

  it('no link: no by-id read', () => {
    EventScheduler({ selectedOrgId: ORG })
    expect(rec.queries.some((q) => callsOf(q, 'eq').some((c) => c[0] === 'id'))).toBe(false)
  })

  it('decideEventFocus: found only for an event this scheduler manages', () => {
    const orgScope = { kind: 'org' as const, orgId: ORG }
    const allScope = { kind: 'orgs' as const, orgIds: [ORG.toUpperCase()] }
    const ev = (org_id: string, is_active = true) => ({ org_id, org: { is_active } })
    expect(decideEventFocus(ev(ORG), orgScope)).toEqual({ outcome: 'found' })
    expect(decideEventFocus(ev(ORG), allScope)).toEqual({ outcome: 'found' })
    expect(decideEventFocus(null, orgScope)).toEqual({ outcome: 'not_found', reason: 'missing' })
    expect(decideEventFocus(ev(OTHER_ORG), orgScope)).toEqual({ outcome: 'not_found', reason: 'other_org' })
    // get_admin_org_list lists active organizations only: an inactive organization's event is not here.
    expect(decideEventFocus(ev(OTHER_ORG, false), allScope)).toEqual({ outcome: 'not_found', reason: 'org_inactive' })
    expect(eventFocusNotice('org_inactive', 'en')).toMatch(/inactive/)
    expect(eventFocusNotice('missing', 'en')).toMatch(/could not be opened/)
    expect(eventFocusNotice('missing', 'es')).not.toBe(eventFocusNotice('missing', 'en'))
  })

  it('the link opens the SAME edit dialog target the Edit button builds (toEditTarget)', () => {
    const event = {
      id: EVENT, org_id: ORG, title: 'Pantry', event_type: 'pantry', description: null, location_name: 'Hall',
      time_zone: 'America/New_York', is_active: true, recurrence: null, series_start_local: null, series_duration: null,
      announce_days_before: 0, next: [{ starts_at: '2026-10-10T14:00:00Z', ends_at: '2026-10-10T16:00:00Z' }], feed_next: [],
    } as never
    expect(toEditTarget(event)).toMatchObject({ id: EVENT, org_id: ORG, title: 'Pantry', next: { starts_at: '2026-10-10T14:00:00Z', ends_at: '2026-10-10T16:00:00Z' } })
    const src = readFileSync(fileURLToPath(new URL('./event-scheduler.tsx', import.meta.url)), 'utf8')
    expect(src.match(/setEditTarget\(\{ key: \+\+dialogSeq\.current, \.\.\.toEditTarget\(event\) \}\)/g)).toHaveLength(2)
  })
})
