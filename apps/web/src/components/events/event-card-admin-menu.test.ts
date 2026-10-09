// apps/web/src/components/events/event-card-admin-menu.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// R1 — what an admin sees and gets from an event card's ⋯ menu, driven through the real
// EventCardAdminMenu with the mini hook runtime (test/mini-react.ts) and a Supabase double:
//   - nobody but a platform admin / an admin of the event's organization gets a menu;
//   - Edit event opens the scheduler's edit dialog filled from the event READ BY ID (not the card's
//     possibly stale fields), one read per menu open, one dialog per choice; a failed read shows a
//     translated line and logs one warn row;
//   - Add dates opens the scheduler's add-dates dialog for this event; Cancel date confirms the
//     card's shown date; every save is labelled surface=feed_card and reported to the card's owner;
//   - every dialog returns focus to the ⋯ trigger when it closes.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  viewer: null as unknown,
  row: null as unknown,
  readError: null as unknown,
  reads: [] as Array<Array<[string, unknown[]]>>,
  warn: [] as Array<[string, Record<string, unknown>]>,
  release: null as null | (() => void),
}))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => h.viewer }))
vi.mock('@/components/admin/client-admin-edit-link', () => ({
  useHydrated: () => true,
  ClientAdminEditLink: (props: unknown) => props,
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: (n: string, c: Record<string, unknown>) => h.warn.push([n, c]), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const ops: Array<[string, unknown[]]> = [['from', [table]]]
      h.reads.push(ops)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'abortSignal']) {
        chain[m] = (...a: unknown[]) => {
          ops.push([m, a])
          return chain
        }
      }
      chain.maybeSingle = () =>
        new Promise((res) => {
          const answer = () => res(h.readError ? { data: null, error: h.readError } : { data: h.row, error: null })
          // A test may hold the read open (h.release) to choose "Edit event" while it runs.
          if (h.release === null) answer()
          else h.release = answer
        })
      return chain
    },
  }),
}))

import { mount, findAll } from '@/test/mini-react'
import {
  EventCardAdminMenu,
  LazyCancelDateConfirm,
  LazyEventDatesDialog,
  LazyEventEditDialog,
  eventChangeNotice,
  type EventCardChange,
} from './event-card-admin-menu'
import { CardActionsMenu, type CardMenuItem, type CardMenuSection } from '@/components/feed/card-actions-menu'
import { buildEventCards, type EventOccurrenceRow } from '@/components/feed/post-model'
import { EDIT_TARGET_SELECT } from '@/lib/event-edit-target'
import type { AdminEditViewer } from '@/lib/admin-editability'

const EVENT = '33333333-3333-4333-8333-333333333333'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NY = 'America/New_York'

const ready = (tier: AdminEditViewer['tier'], orgs: string[] | null = []): AdminEditViewer => ({
  status: 'ready',
  tier,
  adminOrgIds: orgs === null ? null : new Set(orgs),
})

const occ: EventOccurrenceRow = {
  id: 'occ-1',
  starts_at: '2099-10-24T14:00:00Z',
  ends_at: '2099-10-24T16:00:00Z',
  status: 'upcoming',
  notes: null,
  capacity: null,
  source: 'rule',
  event: {
    id: EVENT,
    org_id: ORG,
    // The card's copy may be stale: the dialog must start from the event read by id.
    title: 'Saturday pantry (card copy)',
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
const [item] = buildEventCards([{ occurrenceId: 'occ-1' }], [occ])

const EVENT_ROW = {
  id: EVENT,
  org_id: ORG,
  title: 'Saturday pantry',
  event_type: 'pantry',
  description: 'Bring bags',
  location_name: 'Hall',
  time_zone: NY,
  is_active: true,
  recurrence: { frequency: 'weekly', byDay: [{ day: 'sa' }] },
  series_start_local: '2099-10-03T10:00:00',
  series_duration: '02:00:00',
  announce_days_before: 7,
  next: [{ starts_at: '2099-10-24T14:00:00Z', ends_at: '2099-10-24T16:00:00Z' }],
}

beforeEach(() => {
  h.viewer = ready('platform_admin', null)
  h.row = EVENT_ROW
  h.readError = null
  h.reads = []
  h.warn = []
  h.release = null
})

type El = { type: unknown; props: Record<string, unknown> }
function setup(event = item) {
  const changes: Array<[string, EventCardChange]> = []
  const m = mount(() =>
    EventCardAdminMenu({ event, locale: 'en', source: 'feed_event_menu', onChanged: (id, c) => changes.push([id, c]) }),
  )
  const menu = () => findAll(m.tree(), (el) => el.type === CardActionsMenu)[0] as El | undefined
  const sections = () => (menu()?.props.sections ?? []) as CardMenuSection[]
  const itemById = (id: string) => sections().flatMap((s) => s.items).find((i) => i.id === id) as CardMenuItem | undefined
  const choose = (id: string) => {
    const it = itemById(id)
    if (!it || it.kind !== 'action') throw new Error(`no action ${id}`)
    it.onSelect()
  }
  const one = (type: unknown) => findAll(m.tree(), (el) => el.type === type) as El[]
  const open = () => (menu()!.props.onOpenChange as (o: boolean) => void)(true)
  // The ⋯ trigger the dialogs must return focus to.
  const trigger = { focus: vi.fn() }
  const attachTrigger = () => {
    ;(menu()!.props.triggerRef as { current: unknown }).current = trigger
  }
  return { m, changes, menu, sections, itemById, choose, one, open, trigger, attachTrigger }
}

describe('who gets the menu', () => {
  it.each([
    ['logged out / guest / member', ready(null)],
    ['loading', { status: 'loading', tier: null, adminOrgIds: null }],
    ['error', { status: 'error', tier: null, adminOrgIds: null }],
    ['community moderator', ready('community_moderator')],
    ['resource admin', ready('resource_admin')],
    ['admin of ANOTHER organization', ready(null, [OTHER_ORG])],
  ])('%s: no menu at all', (_name, viewer) => {
    h.viewer = viewer
    const { m } = setup()
    expect(m.tree()).toBeNull()
  })

  it.each([
    ['platform admin', ready('platform_admin', null)],
    ['admin of the event organization', ready(null, [ORG])],
  ])('%s: Edit event · Add dates | Edit in admin | Cancel date, the trigger named for the event', (_name, viewer) => {
    h.viewer = viewer
    const { sections, menu } = setup()
    expect(sections().map((s) => [s.id, s.items.map((i) => i.id)])).toEqual([
      ['manage', ['edit', 'add_dates']],
      ['admin', ['open_admin']],
      ['danger', ['cancel_date']],
    ])
    expect(menu()!.props.triggerLabel).toBe('Manage event: Saturday pantry (card copy)')
    const labels = sections().flatMap((s) => s.items).map((i) => (i.kind === 'link' ? 'link' : i.label))
    expect(labels).toEqual(['Edit event', 'Add dates', 'link', 'Cancel date'])
  })
})

describe('Edit event', () => {
  it('opens the edit dialog with the event read by id — current values, not the card copy — labelled feed_card', async () => {
    const s = setup()
    s.open()
    await s.m.flush()
    s.choose('edit')
    await s.m.flush()
    const [dialog] = s.one(LazyEventEditDialog)
    expect(dialog.props.event).toMatchObject({
      id: EVENT,
      org_id: ORG,
      title: 'Saturday pantry',
      description: 'Bring bags',
      time_zone: NY,
      series_start_local: '2099-10-03T10:00:00',
      announce_days_before: 7,
      next: { starts_at: '2099-10-24T14:00:00Z', ends_at: '2099-10-24T16:00:00Z' },
    })
    expect(dialog.props.surface).toBe('feed_card')
    // The one read: this event, by id, with its next upcoming date embedded.
    expect(h.reads).toHaveLength(1)
    expect(h.reads[0]).toEqual(expect.arrayContaining([['from', ['assistance_events']], ['select', [EDIT_TARGET_SELECT]], ['eq', ['id', EVENT]]]))
  })

  it('choosing Edit twice while the read runs: one read, one dialog; "Loading…" is announced meanwhile', async () => {
    h.release = () => {}
    const s = setup()
    const status = () => findAll(s.m.tree(), (el) => el.props.role === 'status')
    expect(status().map((el) => el.props.children)).toEqual([''])
    s.open()
    s.choose('edit')
    s.choose('edit')
    s.m.rerender()
    expect(s.menu()!.props.busy).toBe(true)
    expect(status().map((el) => [el.props['aria-live'], el.props.children])).toEqual([['polite', 'Loading…']])
    h.release!()
    await s.m.flush()
    expect(h.reads).toHaveLength(1)
    expect(s.one(LazyEventEditDialog)).toHaveLength(1)
    expect(s.menu()!.props.busy).toBe(false)
    expect(status().map((el) => el.props.children)).toEqual([''])
  })

  it('each menu open reads the event fresh (a save in between is reflected)', async () => {
    const s = setup()
    s.open()
    await s.m.flush()
    s.open()
    await s.m.flush()
    expect(h.reads).toHaveLength(2)
  })

  it('saved → the card owner hears "updated"; retired → "retired"', async () => {
    const s = setup()
    s.choose('edit')
    await s.m.flush()
    const save = s.one(LazyEventEditDialog)[0].props.onSaved as (a: 'update' | 'retire') => void
    save('update')
    save('retire')
    expect(s.changes).toEqual([
      [EVENT, { kind: 'updated' }],
      [EVENT, { kind: 'retired' }],
    ])
  })

  it('the read fails: no dialog, a translated line under the ⋯ button, one warn row (no database text)', async () => {
    h.readError = { code: '57014', message: 'canceling statement due to statement timeout' }
    const s = setup()
    s.choose('edit')
    await s.m.flush()
    expect(s.one(LazyEventEditDialog)).toHaveLength(0)
    const alerts = findAll(s.m.tree(), (el) => el.type === 'p' && el.props.role === 'alert')
    expect(alerts.map((a) => a.props.children)).toEqual(['The event could not be opened for editing. Try again.'])
    expect(JSON.stringify(s.m.tree())).not.toContain('statement timeout')
    expect(h.warn).toEqual([['events.card.edit_load_failed', { code: '57014' }]])
  })
})

describe('Add dates / Cancel date', () => {
  it('Add dates: the scheduler dialog for THIS event (id, title, organization, zone), labelled feed_card', async () => {
    const s = setup()
    s.choose('add_dates')
    s.m.rerender()
    const [dialog] = s.one(LazyEventDatesDialog)
    expect(dialog.props.event).toEqual({ id: EVENT, title: 'Saturday pantry (card copy)', org_id: ORG, time_zone: NY })
    expect(dialog.props.surface).toBe('feed_card')
    expect(dialog.props.initialDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    ;(dialog.props.onAdded as (n: number) => void)(3)
    expect(s.changes).toEqual([[EVENT, { kind: 'dates_added', changed: 3 }]])
  })

  it('Cancel date: confirms the card\'s shown date; once cancelled, the dialog closes and the owner re-reads', async () => {
    const s = setup()
    s.choose('cancel_date')
    s.m.rerender()
    const [confirm] = s.one(LazyCancelDateConfirm)
    expect(confirm.props.target).toEqual({
      occurrenceId: 'occ-1',
      eventId: EVENT,
      orgId: ORG,
      title: 'Saturday pantry (card copy)',
      startsAt: '2099-10-24T14:00:00Z',
      endsAt: '2099-10-24T16:00:00Z',
      timeZone: NY,
    })
    expect(confirm.props.surface).toBe('feed_card')
    ;(confirm.props.onCancelled as () => void)()
    s.m.rerender()
    expect(s.one(LazyCancelDateConfirm)).toHaveLength(0)
    expect(s.changes).toEqual([[EVENT, { kind: 'date_cancelled' }]])
  })

  it('a shown date already cancelled: Cancel date stays in the menu with the reason, and does nothing', () => {
    const s = setup({ ...item, cancelledShown: 'next', status: 'cancelled' })
    expect(s.itemById('cancel_date')).toMatchObject({ kind: 'unavailable', reason: 'This date is already cancelled.' })
  })
})

describe('focus returns to the ⋯ trigger when any dialog closes', () => {
  it.each([
    ['edit', LazyEventEditDialog],
    ['add_dates', LazyEventDatesDialog],
    ['cancel_date', LazyCancelDateConfirm],
  ])('%s', async (id, type) => {
    const s = setup()
    s.attachTrigger()
    s.choose(id)
    await s.m.flush()
    const [dialog] = s.one(type)
    const e = { preventDefault: vi.fn() }
    ;(dialog.props.onCloseAutoFocus as (e: unknown) => void)(e)
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
    expect(s.trigger.focus).toHaveBeenCalledTimes(1)
  })
})

describe('announcements after a save', () => {
  it.each([
    [{ kind: 'updated' }, false, 'Changes saved.'],
    [{ kind: 'retired' }, true, 'Event retired. This event is no longer listed.'],
    [{ kind: 'dates_added', changed: 2 }, false, 'Dates added: 2.'],
    [{ kind: 'dates_added', changed: 0 }, false, 'Those dates were already scheduled. Nothing changed.'],
    [{ kind: 'date_cancelled' }, false, 'Date cancelled.'],
  ] as Array<[EventCardChange, boolean, string]>)('%j gone=%s → %s', (change, gone, text) => {
    expect(eventChangeNotice(change, gone, 'en')).toBe(text)
  })

  it('in the viewer language', () => {
    expect(eventChangeNotice({ kind: 'retired' }, true, 'es')).toBe('Evento retirado. Este evento ya no aparece en la lista.')
  })
})
