// apps/web/src/app/(admin)/moderation/event-scheduler.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A followed "Edit in admin" event link opens THAT event's edit dialog (I2), driven through the real
// EventScheduler with a mocked Supabase client and the mini hook runtime:
//   (a) an event this scheduler manages: the edit dialog renders with that event id, one `found`;
//   (b) another organization's event: `not_found`, no dialog, one plain status line;
//   (c) the list read fails but the by-id read succeeds: the dialog still renders (it sits outside
//       the loading / error / ready branches) — the row never says found without a dialog;
//   (d) the status region exists before its text arrives (so the line is announced).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  session: null as null | { focus: { kind: string; id: string }; isOpen: () => boolean; resolve: (o: string) => boolean },
  resolved: [] as string[],
  listFails: false,
  focusedRow: null as unknown,
  byIdReads: 0,
}))
vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => h.session }))
vi.mock('./use-admin-orgs', () => ({ useAdminOrgs: () => ({ orgs: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Pantry', org_type: 'food_bank' }], loading: false, error: null }) }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ loading: false, profile: null, user: null }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'eq', 'in', 'gte', 'lt', 'or', 'range']) chain[m] = () => chain
      chain.maybeSingle = () => {
        h.byIdReads++
        return Promise.resolve({ data: h.focusedRow, error: null })
      }
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(
          table === 'assistance_events' && h.listFails ? { data: null, error: { code: '57014' } } : { data: [], error: null }
        ).then(res, rej)
      return chain
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
}))

import { mount, findAll } from '@/test/mini-react'
import { EventScheduler } from './event-scheduler'
import { EventEditDialog } from '@/components/events/event-edit-dialog'

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const EVENT = '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a'

const row = (orgId: string, orgActive = true) => ({
  id: EVENT,
  org_id: orgId,
  title: 'Saturday pantry',
  event_type: 'pantry',
  description: null,
  location_name: 'Hall',
  time_zone: 'America/New_York',
  is_active: true,
  recurrence: null,
  series_start_local: null,
  series_duration: null,
  announce_days_before: 0,
  org: { name: 'Pantry', is_active: orgActive },
  next: [{ id: 'o1', event_id: EVENT, starts_at: '2026-10-24T14:00:00Z', ends_at: '2026-10-24T16:00:00Z', status: 'upcoming' }],
  feed_next: [],
})

beforeEach(() => {
  h.resolved.length = 0
  h.listFails = false
  h.byIdReads = 0
  h.session = {
    focus: { kind: 'event', id: EVENT },
    isOpen: () => h.resolved.length === 0,
    resolve: (o: string) => (h.resolved.length ? false : (h.resolved.push(o), true)),
  }
})

const dialogs = (tree: unknown) => findAll(tree, (el) => el.type === EventEditDialog)
const statusText = (tree: unknown) =>
  findAll(tree, (el) => el.props['data-testid'] === 'event-focus-status').map((el) => (el.props.children as string | null) ?? '')

describe.each([
  ['main shell (all)', 'all'],
  ["organization's page", ORG],
])('Edit in admin → event, %s', (_label, selectedOrgId) => {
  it('(a) an event it manages: its edit dialog renders with that event, exactly one found', async () => {
    h.focusedRow = row(ORG)
    const c = mount(() => EventScheduler({ selectedOrgId }))
    const tree = await c.flush()
    expect(h.byIdReads).toBe(1)
    expect(h.resolved).toEqual(['found'])
    const d = dialogs(tree)
    expect(d).toHaveLength(1)
    expect((d[0].props.event as { id: string; org_id: string }).id).toBe(EVENT)
    expect(statusText(tree)).toEqual([''])
  })

  it("(b) another organization's event: not_found, no dialog, one plain line", async () => {
    h.focusedRow = row(OTHER_ORG)
    const c = mount(() => EventScheduler({ selectedOrgId }))
    const tree = await c.flush()
    expect(h.resolved).toEqual(['not_found'])
    expect(dialogs(tree)).toHaveLength(0)
    expect(statusText(tree)).toEqual(['This event could not be opened: it no longer exists or is not one you manage.'])
  })

  it('(c) the list read fails, the by-id read succeeds: the dialog still renders (found is true)', async () => {
    h.listFails = true
    h.focusedRow = row(ORG)
    const c = mount(() => EventScheduler({ selectedOrgId }))
    const tree = await c.flush()
    // The tab shows its load error…
    expect(findAll(tree, (el) => el.props.role === 'alert')).toHaveLength(1)
    // …and the linked event's dialog is open over it.
    expect(h.resolved).toEqual(['found'])
    expect(dialogs(tree)).toHaveLength(1)
  })
})

describe('the focus status region is mounted before its text', () => {
  it('(d) present (empty) on the first render, while the list is loading; filled later in place', async () => {
    h.focusedRow = row(OTHER_ORG, false)
    const c = mount(() => EventScheduler({ selectedOrgId: 'all' }))
    expect(statusText(c.tree())).toEqual([''])
    const tree = await c.flush()
    expect(statusText(tree)).toEqual(["This event's organization is inactive, so the event cannot be edited here."])
  })

  it('no link: no by-id read, the region stays empty', async () => {
    h.session = null
    const c = mount(() => EventScheduler({ selectedOrgId: ORG }))
    const tree = await c.flush()
    expect(h.byIdReads).toBe(0)
    expect(dialogs(tree)).toHaveLength(0)
    expect(statusText(tree)).toEqual([''])
  })
})
