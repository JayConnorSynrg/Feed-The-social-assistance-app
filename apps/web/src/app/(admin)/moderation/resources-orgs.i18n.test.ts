// apps/web/src/app/(admin)/moderation/resources-orgs.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W4: a resource admin reviews, edits and approves resources and businesses in their own
// language, and an organization admin's page, overview, roster and check-in kiosk carry no English.
//   - Rendered: Korean text with lang="ko"; Arabic right-to-left; names a member or a scraper wrote
//     marked lang="" dir="auto" and never translated; no fixed English mark left in the W4 files.
//   - Label in Name, in the 14 locales: every named control's accessible name starts with its text.
//   - Behaviour unchanged: each approve / reject / save / toggle / roster write / kiosk call sends the
//     same RPC (or table write) with the same arguments and the same log rows in every language.
//   - Keyboard and screen reader: each result is announced in a status line mounted from the first
//     render; when a row or a button leaves, focus moves to the next row (else the heading); a busy
//     button is aria-disabled (it keeps focus); a dialog's announcement waits until it has closed.
//   - Diagnostics: a failure shows a translated line, never the server's text, and — where nothing
//     recorded it before — writes exactly one row carrying its code only.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as el, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

type Reply = { data: unknown; error: unknown }
const h = vi.hoisted(() => ({
  calls: [] as unknown[][],
  privileged: [] as Array<{ op: string; fn: string; args: unknown; attrs: unknown }>,
  privReply: { data: null, error: null } as { data: unknown; error: unknown },
  rpc: {} as Record<string, { data: unknown; error: unknown }>,
  from: {} as Record<string, { data: unknown; error: unknown }>,
  frames: [] as Array<() => void>,
  elements: new Map<string, { focus: () => void }>(),
  cookie: undefined as string | undefined,
  pending: [] as unknown[],
  approved: [] as unknown[],
  updateThrows: null as null | Error,
  toggleThrows: false,
  fetchMode: 'ok' as 'ok' | 'http500' | 'throw',
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/privileged-action', () => ({
  privilegedRpc: async (_sb: unknown, op: string, fn: string, args: unknown, attrs: unknown) => {
    h.privileged.push({ op, fn, args, attrs })
    return { ...h.privReply, requestId: 'RID' }
  },
}))
vi.mock('@/hooks/use-admin-tier', () => ({ useAdminTier: () => ({ tier: 'platform_admin', loading: false }) }))
vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => null }))
vi.mock('@/components/map/map-view', () => ({ MapView: () => null }))
vi.mock('@/components/map/resource-marker', () => ({ ResourceMarker: () => null }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (h.cookie ? { value: h.cookie } : undefined) }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc: async () => ({ data: [{ id: 'o1', name: 'منظمة الحي' }, { id: 'o2', name: 'Westside Pantry' }], error: null }) }),
}))
vi.mock('@/lib/business-data', async (orig) => {
  const real = await orig<typeof import('@/lib/business-data')>()
  return {
    ...real,
    fetchPendingBusinesses: async () => h.pending,
    fetchAdminBusinessList: async () => h.approved,
    adminSetBusinessActive: async (_sb: unknown, id: string, active: boolean) => {
      h.calls.push(['set_active', id, active])
      if (h.toggleThrows) throw new real.BusinessWriteError('permission denied for "Corner Cafe"')
    },
    adminUpdateBusiness: async (_sb: unknown, id: string, fields: unknown) => {
      h.calls.push(['update_business', id, fields])
      if (h.updateThrows) throw h.updateThrows
    },
  }
})

/** A PostgREST-ish chain: records every call; awaiting it answers h.from[table]. */
function table(name: string) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m] = (...args: unknown[]) => {
      h.calls.push([name, m, ...args])
      return chain
    }
  }
  chain.then = (res: (v: Reply) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(h.from[name] ?? { data: [], error: null }).then(res, rej)
  return chain
}
const client = {
  auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    getUser: async () => ({ data: { user: { id: 'pa' } } }),
  },
  rpc: (fn: string, args: unknown) => {
    h.calls.push(['rpc', fn, args])
    return Promise.resolve(h.rpc[fn] ?? { data: null, error: null })
  },
  from: (name: string) => {
    h.calls.push(['from', name])
    return table(name)
  },
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => client }))

import { mount, findAll } from '@/test/mini-react'
import { logger } from '@/lib/logger'
import { messages, type Locale } from '@/lib/i18n'
import { markupText, decodeEntities } from '@/test/markup-text'
import { formatDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { orgFormT } from '@/lib/i18n-org-forms'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { eventFormT } from '@/lib/i18n-event-forms'
import { BUSINESS_NOT_SAVED_MESSAGE } from '@/lib/business-data'
import { adminResourcesT, contentTypeLabel, resourceStatusLabel, serviceModeLabel } from '@/lib/i18n-admin-resources'
import { orgAdminT } from '@/lib/i18n-org-admin'
import { DialogContent } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ResourcesTab } from './resources-tab'
import { ResourceEditDialog } from './resource-edit-dialog'
import { ManageResourcesTab } from './manage-resources-tab'
import { BusinessesTab, editButtonId, pendingApproveId } from './businesses-tab'
import { AdminFocusNoticeLine } from './admin-focus-notice'
import { OrgMembers, OrgMembersView, rosterAddInputId, rosterRemoveId } from './orgs-section'
import { OrgOverviewView, EndingSoonView } from './org/org-overview'
import OrgAdminIndexPage from './org/page'
import { OrganizerCheckinDisplay, kioskConfirmId } from './organizer-checkin-display'
import { NO_ANNOUNCEMENT, type Announcement } from './row-focus'

const LOCALES = Object.keys(messages) as Locale[]
const html = (node: unknown) => renderToStaticMarkup(node as ReactElement)
const warn = () => vi.mocked(logger.warn).mock.calls
const text = (node: unknown) => markupText(html(node))
const R = (l: Locale, k: Parameters<typeof adminResourcesT>[1]) => adminResourcesT(l, k)
const O = (l: Locale, k: Parameters<typeof orgAdminT>[1]) => orgAdminT(l, k)
const runFrames = () => {
  for (const f of h.frames.splice(0)) f()
}
const fakeNode = () => ({ focus: vi.fn() })
/** A dialog's content rendered inline (its title / close need the dialog's context, not its portal). */
const inDialog = (children: unknown) => el(DialogPrimitive.Root, { open: true }, el('div', null, children as never))

const PANTRY = '11111111-1111-4111-8111-111111111111'
const CLINIC = '22222222-2222-4222-8222-222222222222'
const FORM = '33333333-3333-4333-8333-333333333333'
const pendingRow = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: 'Comida gratis los sábados',
  category: 'food',
  address: '12 Main St',
  city: 'Burlington',
  state: 'VT',
  zip_code: '05401',
  phone: '802-555-0100',
  email: null,
  website: 'https://pantry.example.org',
  status: 'pending',
  discovery_metadata: { content_type: 'resource', source_url: null, confidence: 'high', corroborating_count: 3, authoritative_domain: false },
  lat: 44.48,
  lng: -73.21,
  service_mode: 'physical',
  geocode_accuracy: 'unlocated',
  ...extra,
})
const QUEUE = [
  pendingRow(PANTRY, 'مخزن الحي'),
  pendingRow(CLINIC, 'Riverside Clinic'),
  pendingRow(FORM, 'SNAP form', { discovery_metadata: { content_type: 'form', source_url: null, confidence: 'medium', corroborating_count: 1, authoritative_domain: true } }),
]
const MANAGE_ROW = { ...pendingRow(PANTRY, 'مخزن الحي'), address_line1: '12 Main St', status: 'approved', geocode_accuracy: 'rooftop' }
const BIZ = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: 'Panadería familiar',
  address: '3 Elm St',
  city: 'Burlington',
  state: 'VT',
  phone: null,
  email: null,
  website: null,
  status: 'approved',
  is_active: true,
  location: null,
  ...extra,
})
const MEMBERS = [
  { id: 'm1', user_id: 'u-admin', role: 'admin', joined_at: '2026-10-01T12:00:00Z' },
  { id: 'm2', user_id: 'u-member', role: 'member', joined_at: '2026-10-02T12:00:00Z' },
]
const OCCURRENCE = { id: 'o1', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T17:00:00Z', event_title: 'Despensa del sábado', org_name: 'منظمة الحي', time_zone: 'America/New_York' }
const ATTENDANCE = {
  confirmed: 1,
  early: 2,
  no_show: 0,
  anonymous_confirmed: 1,
  people_confirmed: 3,
  show_rate: 0.5,
  ended: false,
  attendees: [
    { user_id: 'a1', name: 'Nguyễn An', status: 'early', household_size: 2, attendance_rate: 0.8 },
    { user_id: 'a2', name: 'أمينة', status: 'early', household_size: 1, attendance_rate: null },
    { user_id: 'a3', name: 'Ana', status: 'confirmed', household_size: 4, attendance_rate: 1 },
  ],
}

beforeEach(() => {
  h.calls.length = 0
  h.privileged.length = 0
  h.privReply = { data: null, error: null }
  h.rpc = {
    admin_list_pending_resources: { data: QUEUE, error: null },
    admin_list_resources: { data: [MANAGE_ROW], error: null },
    event_attendance: { data: ATTENDANCE, error: null },
    organizer_confirm: { data: null, error: null },
  }
  h.from = { organization_members: { data: MEMBERS, error: null } }
  h.frames.length = 0
  h.elements.clear()
  h.cookie = undefined
  h.pending = [BIZ('b1', 'مقهى الزاوية', { status: 'pending' }), BIZ('b2', 'Corner Bakery', { status: 'pending' })]
  h.approved = [BIZ('b3', 'Café du Coin'), BIZ('b4', 'Old Mill', { is_active: false })]
  h.updateThrows = null
  h.toggleThrows = false
  h.fetchMode = 'ok'
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
  vi.mocked(logger.error).mockClear()
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => (h.frames.push(f), 0))
  vi.stubGlobal('document', { getElementById: (id: string) => h.elements.get(id) ?? null, querySelector: () => null })
  vi.stubGlobal('fetch', async () => {
    if (h.fetchMode === 'throw') throw new TypeError('Failed to fetch')
    if (h.fetchMode === 'http500') return { ok: false, status: 500, text: async () => 'boom near "food banks in Burlington"' }
    return { ok: true, status: 200, json: async () => ({ staged: { resources: 2, forms: 1 }, rejected: 4 }) }
  })
})

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

async function openQueue(locale: Locale) {
  const c = mount(() => ResourcesTab({ locale }))
  const tree = await c.flush()
  return { c, tree }
}
const byLabelStart = (tree: unknown, start: string) =>
  findAll(tree, (e) => typeof e.props['aria-label'] === 'string' && (e.props['aria-label'] as string).startsWith(start))
/** Register fake DOM nodes for every chevron (ref callbacks) and the queue heading (ref object). */
function wireQueueFocus(tree: unknown) {
  const chevrons = new Map<string, ReturnType<typeof fakeNode>>()
  for (const b of findAll(tree, (e) => typeof e.props['aria-controls'] === 'string')) {
    const id = String(b.props['aria-controls']).replace('resource-details-', '')
    const node = fakeNode()
    chevrons.set(id, node)
    ;(b.props.ref as (n: unknown) => void)(node)
  }
  const heading = findAll(tree, (e) => e.type === 'h2')[0]
  const headingNode = fakeNode()
  ;(heading.props.ref as { current: unknown }).current = headingNode
  return { chevrons, heading: headingNode }
}
/** A status line's words: its AnnouncementText child's text. */
const statusText = (tree: unknown, id: string) =>
  (findAll(tree, (e) => e.props['data-testid'] === id)[0]?.props.children as { props: { announcement: Announcement } } | undefined)?.props.announcement.text

// ---------------------------------------------------------------------------------------------
// Rendered in the admin's language
// ---------------------------------------------------------------------------------------------

describe('the Resources tab in Korean', () => {
  it('Discover, the queue, filters, badges and actions read in Korean, marked ko; no English label is left', async () => {
    const { tree } = await openQueue('ko')
    const out = html(tree)
    expect(out).toMatch(/^<div class="space-y-4" lang="ko" dir="ltr"/)
    const t = markupText(out)
    for (const k of ['discoverTitle', 'nearLabel', 'useMyLocation', 'queryLabel', 'discover', 'filterAll', 'viewList', 'viewMap', 'approve', 'reject', 'confidenceHigh', 'confidenceMedium', 'needsLocation', 'provenanceVerified', 'confirm'] as const) {
      if (k === 'confirm') continue
      expect(t, k).toContain(R('ko', k))
    }
    expect(t).toContain(contentTypeLabel('resource', 'ko'))
    expect(t).toContain(contentTypeLabel('form', 'ko'))
    // Pending items: members cannot see them yet, so each card says why (the admin nav's words).
    expect(t).toContain(adminNavT('ko', 'reasonNotApproved'))
    for (const english of ['Discover Resources', 'Pending review', 'Approve', 'Reject', 'high confidence', 'Needs location', 'Use my location', 'Bulk approve', 'source', 'Searching near']) {
      expect(t).not.toContain(english)
    }
  })

  it('discovered names, descriptions and addresses keep their own language; the chevron has one name and says what it controls', async () => {
    const { tree, c } = await openQueue('ko')
    const out = html(tree)
    expect(out).toContain('<span lang="" dir="auto">مخزن الحي</span>')
    expect(out).toContain('<span lang="" dir="auto">12 Main St, Burlington, VT</span>')
    const chevron = findAll(tree, (e) => e.props['aria-controls'] === `resource-details-${PANTRY}`)[0]
    expect([chevron.props['aria-label'], chevron.props['aria-expanded']]).toEqual([R('ko', 'itemDetails'), false])
    ;(chevron.props.onClick as () => void)()
    const open = c.rerender()
    const details = html(findAll(open, (e) => e.props.id === `resource-details-${PANTRY}`)[0] as never)
    expect(details).toContain('<p lang="" dir="auto" class="line-clamp-4">Comida gratis los sábados</p>')
    expect(markupText(details)).toContain(resourceCategoryLabel('food', 'ko'))
  })

  it('Arabic: right to left; Haitian Creole: translated too', async () => {
    expect(html((await openQueue('ar')).tree)).toMatch(/^<div class="space-y-4" lang="ar" dir="rtl"/)
    expect(text((await openQueue('ht')).tree)).toContain(R('ht', 'discoverTitle'))
  })

  it('Discover’s result line reads in Korean with the locale’s counts', async () => {
    const { c, tree } = await openQueue('ko')
    ;(findAll(tree, (e) => e.props.id === 'resources-discover-query')[0].props.onChange as (e: unknown) => void)({ target: { value: 'food banks' } })
    let t2 = c.rerender()
    ;(findAll(t2, (e) => e.props.className?.toString().includes('bg-lime-700 hover:bg-lime-800 text-white shrink-0'))[0].props.onClick as () => void)()
    t2 = await c.flush()
    expect(text(t2)).toContain('검토할 후보 3개를 추가했습니다 (출처 필터에서 4개 제외됨)')
  })
})

describe('the edit / approve dialog', () => {
  const input = { ...MANAGE_ROW, address_line1: '12 Main St', description: 'x', email: '', website: '', city: 'Burlington', state: 'VT', zip_code: '05401', phone: '', status: 'approved', service_mode: 'physical', geocode_accuracy: 'unlocated' }
  const dialog = (locale: Locale, mode: 'edit' | 'approve' = 'edit') =>
    mount(() => ResourceEditDialog({ open: true, resource: input, mode, locale, onOpenChange: () => {}, onSaved: () => {} }))

  it('Korean: the portalled content carries ko and its close label; labels, options and buttons in Korean', async () => {
    const c = dialog('ko', 'approve')
    const tree = await c.flush()
    const content = findAll(tree, (e) => e.type === DialogContent)[0]
    expect([content.props.lang, content.props.dir, content.props.closeLabel]).toEqual(['ko', 'ltr', R('ko', 'close')])
    const t = text(inDialog(content.props.children))
    for (const k of ['dialogTitleApprove', 'fieldName', 'fieldCategory', 'fieldStatus', 'fieldServiceMode', 'fieldAddress', 'needsLocationLong', 'confirm', 'cancel'] as const) expect(t, k).toContain(R('ko', k))
    expect(t).toContain(resourceCategoryLabel('mental_health', 'ko'))
    expect(t).toContain(resourceStatusLabel('archived', 'ko'))
    expect(t).toContain(serviceModeLabel('hybrid', 'ko'))
    for (const english of ['Review and confirm resource', 'Service mode', 'Physical location', 'Needs location', 'mental health', 'archived']) expect(t).not.toContain(english)
  })

  it('stored values stay the option values; Name is required with a visible marker; the alert is mounted before any error', async () => {
    const tree = await dialog('ko').flush()
    const content = findAll(tree, (e) => e.type === DialogContent)[0]
    const options = findAll(content, (e) => e.type === 'option').map((o) => o.props.value)
    expect(options).toEqual(expect.arrayContaining(['mental_health', 'archived', 'hybrid', 'VT']))
    const name = findAll(content, (e) => typeof e.props.id === 'string' && (e.props.id as string).endsWith('-name'))[0]
    expect([name.props.required, name.props['aria-required']]).toEqual([true, 'true'])
    expect(text(inDialog(content.props.children))).toContain(`(${R('ko', 'required')})`)
    const alert = findAll(content, (e) => e.props['data-testid'] === 'resource-edit-alert')
    expect(alert).toHaveLength(1)
    expect(alert[0].props.role).toBe('alert')
  })

  it('Arabic: right to left', async () => {
    const content = findAll(await dialog('ar').flush(), (e) => e.type === DialogContent)[0]
    expect([content.props.lang, content.props.dir]).toEqual(['ar', 'rtl'])
  })
})

describe('the Manage tab in Korean', () => {
  it('filters, header, category and links read in Korean; the resource keeps its own', async () => {
    const c = mount(() => ManageResourcesTab({ locale: 'ko' }))
    const out = html(await c.flush())
    expect(out).toMatch(/^<div class="space-y-4" lang="ko" dir="ltr"/)
    const t = markupText(out)
    for (const k of ['fieldState', 'stateAll', 'fieldCity', 'searchLabel', 'applyFilters', 'approvedTitle', 'showMap'] as const) expect(t, k).toContain(R('ko', k))
    expect(t).toContain(resourceCategoryLabel('food', 'ko'))
    expect(out).toContain('<p lang="" dir="auto" class="text-sm font-medium text-stone-900 leading-snug line-clamp-2">مخزن الحي</p>')
    for (const english of ['Approved resources', 'Apply filters', 'All states', 'Show map', 'View public page', 'View on map']) expect(t).not.toContain(english)
    // Each filter label names its control (for = id).
    for (const id of ['manage-filter-state', 'manage-filter-city', 'manage-filter-search']) expect(out).toContain(`for="${id}"`)
  })
})

describe('the Businesses tab in Korean', () => {
  it('both sections, badges and actions read in Korean; names and descriptions keep their own', async () => {
    const c = mount(() => BusinessesTab({ locale: 'ko' }))
    const out = html(await c.flush())
    expect(out).toMatch(/^<div class="space-y-8" lang="ko" dir="ltr"/)
    const t = markupText(out)
    for (const k of ['awaitingTitle', 'rejectReasonLabel', 'approve', 'reject'] as const) expect(t, k).toContain(R('ko', k))
    for (const k of ['statusActive', 'statusInactive', 'actionEdit', 'actionDeactivate', 'actionReactivate'] as const) expect(t, k).toContain(orgFormT('ko', k))
    expect(out).toContain('<h4 id="pending-title-b1" lang="" dir="auto" class="font-semibold text-stone-800">مقهى الزاوية</h4>')
    expect(out).toContain('<p lang="" dir="auto" class="mt-0.5 text-sm text-stone-600">Panadería familiar</p>')
    for (const english of ['Awaiting review', 'Approved businesses', 'Active', 'Deactivate', 'Reactivate', 'Approve', 'Reject', 'Optional reason']) expect(t).not.toContain(english)
  })
})

describe('the "Edit in admin" miss line', () => {
  it.each(LOCALES)('%s: the line and its Dismiss read in the admin’s language', (l) => {
    const out = text(el(AdminFocusNoticeLine, { notice: 'not_editable', kind: 'business', locale: l, onDismiss: () => {} }))
    expect(out).toContain(R(l, 'noticeBusinessNotEditable'))
    expect(out).toContain(R(l, 'dismiss'))
  })
})

describe('the organization admin screens', () => {
  it('the roster in Korean: labels, roles, date in the locale; user ids read left to right', () => {
    const out = html(
      el(OrgMembersView, {
        orgId: 'org', locale: 'ko', members: MEMBERS, loading: false, loadError: null, rosterError: null, status: NO_ANNOUNCEMENT, readOnly: false,
        add: { userId: '', role: 'member', adding: false, error: null },
        onAddUserIdChange: () => {}, onAddRoleChange: () => {}, onAdd: () => {}, onRemove: () => {}, onChangeRole: () => {},
      }),
    )
    expect(out).toMatch(/^<div lang="ko" dir="ltr"/)
    const t = markupText(out)
    for (const k of ['userIdLabel', 'roleLabel', 'addMember', 'colJoined', 'remove'] as const) expect(t, k).toContain(O('ko', k))
    expect(t).toContain(formatDate('2026-10-01T12:00:00Z', 'ko', browserTimeZone()))
    expect(out).toMatch(/<td dir="ltr"[^>]*>u-admin<\/td>/)
    for (const english of ['User UUID', 'Add Member', 'Joined', 'Remove']) expect(t).not.toContain(english)
  })

  it('Overview and the ending-soon list in Korean; numbers in the locale; the series title keeps its own', () => {
    const overview = html(el(OrgOverviewView, { counts: { members: 1200, activeEvents: 2, upcomingDates: 3, checkinsLast30Days: 4 }, state: 'ready', locale: 'ko', onRetry: () => {} }))
    expect(markupText(overview)).toContain(O('ko', 'overviewTitle'))
    expect(markupText(overview)).toContain(O('ko', 'tileCheckins'))
    expect(overview).toContain('>1,200</dd>')
    const ending = html(el(EndingSoonView, { series: [{ eventId: 'e1', title: 'Despensa', lastDate: '2026-10-31', remaining: 3 }], state: 'ready', notice: NO_ANNOUNCEMENT, orgId: 'o', locale: 'ko', onRetry: () => {}, onExtended: () => {} }))
    expect(markupText(ending)).toContain(O('ko', 'endingTitle'))
    expect(markupText(ending)).toContain(eventFormT('ko', 'seriesExtend').slice(0, 2))
    expect(ending).toContain('<p id="ending-e1-title" lang="" dir="auto" class="text-sm font-medium text-stone-900">Despensa</p>')
    expect(ending).not.toContain('lang="en"')
  })

  it('"Your organizations": the feed_locale cookie decides the language; no cookie is English', async () => {
    h.cookie = 'ar'
    const ar = html(await OrgAdminIndexPage())
    expect(ar).toMatch(/^<main lang="ar" dir="rtl"/)
    expect(markupText(ar)).toContain(O('ar', 'backYours'))
    expect(ar).toContain('<span lang="" dir="auto" class="min-w-0 flex-1 truncate font-medium">منظمة الحي</span>')
    h.cookie = undefined
    expect(markupText(html(await OrgAdminIndexPage()))).toContain('Your organizations')
  })

  it('the kiosk in Korean: counts, sections and buttons in Korean; names keep their own', async () => {
    const c = mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'ko' }))
    const tree = await c.flush()
    const content = findAll(tree, (e) => e.type === DialogPrimitive.Content)[0]
    expect([content.props.lang, content.props.dir]).toEqual(['ko', 'ltr'])
    const out = html(inDialog(content.props.children))
    const t = markupText(out)
    expect(t).toContain('3명 확인됨 · 체크인 2건')
    for (const k of ['walkinTitle', 'addHousehold', 'walkinHint', 'footer', 'confirm'] as const) expect(t, k).toContain(O('ko', k))
    expect(t).toContain('출석률 80%')
    expect(out).toContain('<p lang="" dir="auto" class="font-medium text-stone-800 truncate">أمينة</p>')
    for (const english of ['people confirmed', 'Waiting to confirm', 'Add household', 'Household', 'attendance']) expect(t).not.toContain(english)
  })
})

describe('no fixed English mark is left in a W4 file (the island guard)', () => {
  const SRC = fileURLToPath(new URL('.', import.meta.url))
  const code = (f: string) =>
    readFileSync(SRC + f, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const marks = (f: string) => (code(f).match(/\blang=(?:"en"|'en'|\{'en'\}|\{"en"\})/g) ?? []).length

  it.each([
    'org/[id]/org-admin-shell.tsx',
    'org/org-overview.tsx',
    'org/page.tsx',
    'orgs-section.tsx',
    'organizer-checkin-display.tsx',
    'resources-tab.tsx',
    'resource-edit-dialog.tsx',
    'address-autocomplete.tsx',
    'businesses-tab.tsx',
    'admin-focus-notice.tsx',
  ])('%s: none', (f) => {
    expect(marks(f)).toBe(0)
    expect(code(f)).not.toMatch(/adminNavT\('en'|eventFormT\('en'|locale="en"/)
  })

  it('manage-resources-tab.tsx: exactly one — the US state names, proper nouns kept as written', () => {
    expect(marks('manage-resources-tab.tsx')).toBe(1)
    expect(code('manage-resources-tab.tsx')).toMatch(/<option key=\{st\} value=\{st\} lang="en">/)
  })
})

describe('contrast and targets on the lines this wave touched', () => {
  // stone-300/400 text, white on lime-600 / green-600, the theme's destructive red and red-500/600
  // text are under 4.5:1; borders lighter than stone-500 on a control are under 3:1.
  const LOW = /\btext-stone-(300|400)\b|\bbg-(lime|green)-600\b|\bbg-destructive\b|\btext-red-(500|600)\b|placeholder:text-stone-400|\bborder-stone-200 rounded-lg px-3 py-2\b/

  it('the Resources, Manage and Businesses tabs, the dialog, the roster and the kiosk', async () => {
    const outs = [
      html((await openQueue('ko')).tree),
      html(await mount(() => ManageResourcesTab({ locale: 'ko' })).flush()),
      html(await mount(() => BusinessesTab({ locale: 'ko' })).flush()),
    ]
    const dlg = findAll(await mount(() => ResourceEditDialog({ open: true, resource: { ...MANAGE_ROW, address_line1: '', email: '', website: '', phone: '', description: '', zip_code: '' }, mode: 'edit', locale: 'ko', onOpenChange: () => {}, onSaved: () => {} })).flush(), (e) => e.type === DialogContent)[0]
    outs.push(html(inDialog(dlg.props.children)))
    const kiosk = findAll(await mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'ko' })).flush(), (e) => e.type === DialogPrimitive.Content)[0]
    outs.push(html(inDialog(kiosk.props.children)))
    for (const out of outs) expect(out).not.toMatch(LOW)
  })
})

// ---------------------------------------------------------------------------------------------
// Label in Name, 14 locales
// ---------------------------------------------------------------------------------------------

describe('Label in Name', () => {
  const visible = (b: { props: Record<string, unknown> }) => markupText(html(el('span', null, b.props.children as never)))

  it.each(LOCALES)('%s: the queue’s Approve / Reject name the item after the visible word', async (l) => {
    const { tree } = await openQueue(l)
    for (const k of ['approve', 'reject'] as const) {
      const buttons = byLabelStart(tree, R(l, k))
      expect(buttons.length, k).toBeGreaterThan(0)
      for (const b of buttons) {
        expect(String(b.props['aria-label']).startsWith(visible(b)), `${l} ${k}`).toBe(true)
        expect(visible(b)).toBe(R(l, k))
      }
    }
  })

  it.each(LOCALES)('%s: Businesses — Approve, Reject, Edit, Deactivate / Reactivate', async (l) => {
    const tree = await mount(() => BusinessesTab({ locale: l })).flush()
    const named = findAll(tree, (e) => typeof e.props['aria-label'] === 'string' && (e.type === 'button' || typeof e.type !== 'string'))
    const withText = named.filter((b) => visible(b) !== '')
    expect(withText.length).toBeGreaterThanOrEqual(2 * 2 + 2 * 2)
    for (const b of withText) expect(String(b.props['aria-label']).startsWith(visible(b)), `${l}: ${b.props['aria-label']}`).toBe(true)
  })

  it.each(LOCALES)('%s: the roster’s Remove and the kiosk’s Confirm', async (l) => {
    const roster = await mount(() =>
      OrgMembersView({
        orgId: 'org', locale: l, members: MEMBERS, loading: false, loadError: null, rosterError: null, status: NO_ANNOUNCEMENT, readOnly: false,
        add: { userId: '', role: 'member', adding: false, error: null },
        onAddUserIdChange: () => {}, onAddRoleChange: () => {}, onAdd: () => {}, onRemove: () => {}, onChangeRole: () => {},
      }),
    ).flush()
    const removes = findAll(roster, (e) => typeof e.props.id === 'string' && (e.props.id as string).startsWith('roster-org-remove-'))
    expect(removes).toHaveLength(2)
    for (const b of removes) expect(String(b.props['aria-label']).startsWith(visible(b))).toBe(true)
    const kiosk = await mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: l })).flush()
    const confirms = findAll(kiosk, (e) => typeof e.props.id === 'string' && (e.props.id as string).startsWith('kiosk-confirm-'))
    expect(confirms).toHaveLength(2)
    for (const b of confirms) expect(String(b.props['aria-label']).startsWith(visible(b))).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// Behaviour unchanged: the same calls in every language
// ---------------------------------------------------------------------------------------------

function record() {
  return JSON.parse(
    JSON.stringify({
      calls: h.calls,
      privileged: h.privileged,
      warn: warn(),
      info: vi.mocked(logger.info).mock.calls,
      error: vi.mocked(logger.error).mock.calls.map(([n, , a]) => [n, a]),
    }),
  )
}
function reset() {
  h.calls.length = 0
  h.privileged.length = 0
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
  vi.mocked(logger.error).mockClear()
}

describe('the calls are the same in Korean, Arabic and English', () => {
  async function queueRun(l: Locale, act: (tree: unknown, c: ReturnType<typeof mount>) => Promise<void> | void) {
    const { c, tree } = await openQueue(l)
    reset()
    await act(tree, c)
    await c.flush()
    return record()
  }

  it('Resources: reject, the one-click form approve and bulk approve', async () => {
    const runs = []
    for (const l of ['en', 'ko', 'ar'] as Locale[]) {
      runs.push(
        await queueRun(l, async (tree, c) => {
          ;(byLabelStart(tree, R(l, 'reject'))[0].props.onClick as () => void)()
          await c.flush()
          ;(byLabelStart(c.tree(), R(l, 'approve')).at(-1)!.props.onClick as () => void)()
        }),
      )
    }
    expect(runs[0].privileged).toEqual([
      { op: 'admin.resource.reject', fn: 'reject_resource', args: { p_resource_id: PANTRY, p_reason: 'Admin rejected from discovery queue' }, attrs: { action: 'resource.reject', target_id: PANTRY } },
      { op: 'admin.form_template.approve', fn: 'approve_form_template', args: { p_id: FORM }, attrs: { action: 'form_template.approve', target_id: FORM } },
    ])
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
  })

  it('Resources: the dialog-confirmed approve calls approve_resource with the English audit reason', async () => {
    const runs = []
    for (const l of ['en', 'ko'] as Locale[]) {
      const { tree } = await openQueue(l)
      reset()
      const dialog = findAll(tree, (e) => e.type === ResourceEditDialog)[0]
      await (dialog.props.onConfirm as (id: string) => Promise<void>)(CLINIC)
      runs.push(record())
    }
    expect(runs[0].privileged).toEqual([
      { op: 'admin.resource.approve', fn: 'approve_resource', args: { p_resource_id: CLINIC, p_reason: 'Admin approved from discovery queue' }, attrs: { action: 'resource.approve', target_id: CLINIC } },
    ])
    expect(runs[1]).toEqual(runs[0])
  })

  it('Manage: the first read and Apply filters send the same admin_list_resources arguments', async () => {
    const runs = []
    for (const l of ['en', 'ko'] as Locale[]) {
      reset()
      const c = mount(() => ManageResourcesTab({ locale: l }))
      await c.flush()
      runs.push(record())
    }
    expect(runs[0].calls).toEqual([['rpc', 'admin_list_resources', { p_status: 'approved', p_limit: 100, p_offset: 0 }]])
    expect(runs[1]).toEqual(runs[0])
  })

  it('Businesses: approve, reject (with its reason), toggle and save', async () => {
    const runs = []
    for (const l of ['en', 'ko', 'ar'] as Locale[]) {
      const c = mount(() => BusinessesTab({ locale: l }))
      let tree = await c.flush()
      reset()
      ;(findAll(tree, (e) => e.props.id === 'reason-b2')[0].props.onChange as (e: unknown) => void)({ target: { value: 'Duplicate listing' } })
      tree = c.rerender()
      ;(byLabelStart(tree, R(l, 'approve'))[0].props.onClick as () => void)()
      tree = await c.flush()
      ;(byLabelStart(tree, R(l, 'reject'))[0].props.onClick as () => void)()
      tree = await c.flush()
      ;(byLabelStart(tree, orgFormT(l, 'actionDeactivate'))[0].props.onClick as () => void)()
      tree = await c.flush()
      ;(byLabelStart(tree, orgFormT(l, 'actionEdit'))[0].props.onClick as () => void)()
      tree = c.rerender()
      ;(findAll(tree, (e) => e.props.children === R(l, 'save'))[0].props.onClick as () => void)()
      await c.flush()
      runs.push(record())
    }
    expect(runs[0].privileged.map((p: { fn: string; args: unknown }) => [p.fn, p.args])).toEqual([
      ['approve_business', { p_org_id: 'b1' }],
      ['reject_business', { p_org_id: 'b2', p_reason: 'Duplicate listing' }],
    ])
    expect(runs[0].calls).toEqual([
      ['set_active', 'b3', false],
      ['update_business', 'b3', { name: 'Café du Coin', description: 'Panadería familiar', phone: '', email: '', website: '' }],
    ])
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
  })

  it('the roster: add, change a role and remove write the same rows', async () => {
    const runs = []
    for (const l of ['en', 'ko'] as Locale[]) {
      const c = mount(() => OrgMembers({ orgId: 'org', locale: l }))
      let tree = await c.flush()
      reset()
      const props = () => (c.tree() as unknown as { props: { onAddUserIdChange: (v: string) => void; onAdd: () => void; onChangeRole: (id: string, r: string) => Promise<void>; onRemove: (id: string) => Promise<void> } }).props
      props().onAddUserIdChange('u-new')
      tree = c.rerender()
      props().onAdd()
      await c.flush()
      h.from.organization_members = { data: [{ id: 'm2' }], error: null }
      await props().onChangeRole('m2', 'admin')
      await props().onRemove('m2')
      h.from.organization_members = { data: MEMBERS, error: null }
      tree = await c.flush()
      void tree
      runs.push(record())
    }
    expect(runs[0].calls).toEqual(
      expect.arrayContaining([
        ['organization_members', 'insert', { org_id: 'org', user_id: 'u-new', role: 'member', invited_by: 'pa' }],
        ['organization_members', 'update', { role: 'admin' }],
        ['organization_members', 'delete'],
        ['organization_members', 'eq', 'id', 'm2'],
        ['organization_members', 'eq', 'org_id', 'org'],
      ]),
    )
    expect(runs[1]).toEqual(runs[0])
  })

  it('the kiosk: confirm and walk-in send the same organizer_confirm calls and log rows', async () => {
    const runs = []
    for (const l of ['en', 'ko'] as Locale[]) {
      const c = mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: l }))
      let tree = await c.flush()
      reset()
      ;(findAll(tree, (e) => e.props.id === kioskConfirmId('a1'))[0].props.onClick as () => void)()
      tree = await c.flush()
      ;(findAll(tree, (e) => e.type === 'button' && Array.isArray(e.props.children) && (e.props.children as unknown[]).includes(O(l, 'addHousehold')))[0].props.onClick as () => void)()
      await c.flush()
      runs.push(record())
    }
    expect(runs[0].calls.filter((x: unknown[]) => x[1] === 'organizer_confirm')).toEqual([
      ['rpc', 'organizer_confirm', { p_occurrence: 'o1', p_user: 'a1', p_household_size: 2 }],
      ['rpc', 'organizer_confirm', { p_occurrence: 'o1', p_household_size: 1 }],
    ])
    expect(runs[1]).toEqual(runs[0])
  })
})

// ---------------------------------------------------------------------------------------------
// Keyboard and screen reader: never lose your place, always hear the result
// ---------------------------------------------------------------------------------------------

describe('Resources: focus and announcements', () => {
  it('the status line is mounted from the first render; Reject announces and focuses the next card, the last one the heading', async () => {
    const { c, tree } = await openQueue('ko')
    expect(findAll(tree, (e) => e.props['data-testid'] === 'resources-queue-status')[0].props.role).toBe('status')
    const { chevrons, heading } = wireQueueFocus(tree)
    ;(byLabelStart(tree, R('ko', 'reject'))[0].props.onClick as () => void)()
    let after = await c.flush()
    runFrames()
    after = c.rerender()
    expect(chevrons.get(CLINIC)!.focus).toHaveBeenCalledTimes(1)
    expect(statusText(after, 'resources-queue-status')).toContain('مخزن الحي')
    expect(statusText(after, 'resources-queue-status')).toContain(R('ko', 'rejectedStatus').replace('{name}', '').trim().slice(-4))
    // Reject the clinic, then approve the form: the queue empties, focus goes to the heading.
    ;(byLabelStart(after, R('ko', 'reject'))[0].props.onClick as () => void)()
    after = await c.flush()
    runFrames()
    expect(chevrons.get(FORM)!.focus).toHaveBeenCalledTimes(1)
    ;(byLabelStart(after, R('ko', 'approve'))[0].props.onClick as () => void)()
    after = await c.flush()
    runFrames()
    expect(heading.focus).toHaveBeenCalledTimes(1)
  })

  it('while an action runs, its buttons are aria-disabled (never disabled), and a second press does nothing', async () => {
    const { c, tree } = await openQueue('ko')
    ;(byLabelStart(tree, R('ko', 'reject'))[0].props.onClick as () => void)()
    // Rendered before the call answers: the row's buttons are busy.
    const busy = c.rerender()
    const buttons = findAll(busy, (e) => String(e.props['aria-label'] ?? '').includes('مخزن'))
    expect(buttons).toHaveLength(2)
    for (const b of buttons) {
      expect(b.props['aria-disabled']).toBe(true)
      expect(b.props.disabled).toBeUndefined()
    }
    ;(buttons[1].props.onClick as () => void)()
    await c.flush()
    expect(h.privileged.filter((p) => p.fn === 'reject_resource')).toHaveLength(1)
  })

  it('an approve confirmed in the dialog is announced and focused only once the dialog has closed', async () => {
    const { c, tree } = await openQueue('ko')
    const { chevrons } = wireQueueFocus(tree)
    const dialog = findAll(tree, (e) => e.type === ResourceEditDialog)[0]
    ;(dialog.props.onSaved as (row: unknown) => void)({ id: PANTRY, name: 'مخزن الحي' })
    let after = c.rerender()
    expect(statusText(after, 'resources-queue-status')).toBe('')
    const preventDefault = vi.fn()
    ;(findAll(after, (e) => e.type === ResourceEditDialog)[0].props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault })
    runFrames()
    after = c.rerender()
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(chevrons.get(CLINIC)!.focus).toHaveBeenCalledTimes(1)
    expect(statusText(after, 'resources-queue-status')).toContain('مخزن الحي')
  })

  it('Cancel on the dialog leaves focus to Radix (the card’s Approve is still there)', async () => {
    const { tree } = await openQueue('ko')
    const preventDefault = vi.fn()
    ;(findAll(tree, (e) => e.type === ResourceEditDialog)[0].props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
  })
})

describe('Businesses: focus and announcements', () => {
  it('Approve announces, focuses the next pending row’s Approve, and the last one focuses the heading', async () => {
    const c = mount(() => BusinessesTab({ locale: 'ko' }))
    let tree = await c.flush()
    expect(findAll(tree, (e) => e.props['data-testid'] === 'businesses-status')[0].props.role).toBe('status')
    const next = fakeNode()
    h.elements.set(pendingApproveId('b2'), next)
    ;(byLabelStart(tree, R('ko', 'approve'))[0].props.onClick as () => void)()
    tree = await c.flush()
    runFrames()
    tree = c.rerender()
    expect(next.focus).toHaveBeenCalledTimes(1)
    expect(statusText(tree, 'businesses-status')).toContain('مقهى الزاوية')
    const heading = fakeNode()
    ;(findAll(tree, (e) => e.type === 'h3')[0].props.ref as { current: unknown }).current = heading
    ;(byLabelStart(tree, R('ko', 'reject'))[0].props.onClick as () => void)()
    tree = await c.flush()
    runFrames()
    expect(heading.focus).toHaveBeenCalledTimes(1)
  })

  it('Save returns focus to the row’s Edit button and announces; Cancel returns it too; the toggle keeps focus (aria-disabled)', async () => {
    const c = mount(() => BusinessesTab({ locale: 'ko' }))
    let tree = await c.flush()
    const edit = fakeNode()
    h.elements.set(editButtonId('b3'), edit)
    ;(byLabelStart(tree, orgFormT('ko', 'actionEdit'))[0].props.onClick as () => void)()
    tree = c.rerender()
    ;(findAll(tree, (e) => e.props.children === R('ko', 'cancel'))[0].props.onClick as () => void)()
    tree = await c.flush()
    runFrames()
    expect(edit.focus).toHaveBeenCalledTimes(1)
    ;(byLabelStart(tree, orgFormT('ko', 'actionEdit'))[0].props.onClick as () => void)()
    tree = c.rerender()
    ;(findAll(tree, (e) => e.props.children === R('ko', 'save'))[0].props.onClick as () => void)()
    tree = await c.flush()
    runFrames()
    tree = c.rerender()
    expect(edit.focus).toHaveBeenCalledTimes(2)
    expect(statusText(tree, 'businesses-status')).toBe(orgFormT('ko', 'savedUpdated').replace('{name}', '\u2068Café du Coin\u2069'))
    const toggle = byLabelStart(tree, orgFormT('ko', 'actionDeactivate'))[0]
    ;(toggle.props.onClick as () => void)()
    const busy = c.rerender()
    const during = byLabelStart(busy, orgFormT('ko', 'actionDeactivate')).concat(byLabelStart(busy, orgFormT('ko', 'actionReactivate')))
    expect(during.some((b) => b.props['aria-disabled'] === true)).toBe(true)
    expect(during.every((b) => b.props.disabled === undefined)).toBe(true)
    tree = await c.flush()
    runFrames()
    tree = c.rerender()
    expect(statusText(tree, 'businesses-status')).toBe(orgFormT('ko', 'orgDeactivated').replace('{name}', '\u2068Café du Coin\u2069'))
  })
})

describe('the roster and the kiosk: focus and announcements', () => {
  it('Remove announces and focuses the next row’s Remove; the last row hands focus to the add box', async () => {
    const c = mount(() => OrgMembers({ orgId: 'org', locale: 'ko' }))
    const tree = await c.flush()
    const view = tree as unknown as { props: { onRemove: (id: string) => Promise<void> } }
    const next = fakeNode()
    h.elements.set(rosterRemoveId('org', 'm2'), next)
    h.from.organization_members = { data: [{ id: 'm1' }], error: null }
    await view.props.onRemove('m1')
    h.from.organization_members = { data: [MEMBERS[1]], error: null }
    let after = await c.flush()
    runFrames()
    after = c.rerender()
    expect(next.focus).toHaveBeenCalledTimes(1)
    expect((after as unknown as { props: { status: Announcement } }).props.status.text).toBe(O('ko', 'memberRemoved'))
    const add = fakeNode()
    h.elements.set(rosterAddInputId('org'), add)
    h.from.organization_members = { data: [{ id: 'm2' }], error: null }
    await (after as unknown as { props: { onRemove: (id: string) => Promise<void> } }).props.onRemove('m2')
    h.from.organization_members = { data: [], error: null }
    after = await c.flush()
    runFrames()
    expect(add.focus).toHaveBeenCalledTimes(1)
  })

  it('the kiosk: Confirm announces inside the dialog and focuses the next waiting person’s Confirm', async () => {
    const c = mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'ko' }))
    let tree = await c.flush()
    const content = () => findAll(c.tree(), (e) => e.type === DialogPrimitive.Content)[0]
    expect(findAll(content(), (e) => e.props.role === 'status')).toHaveLength(1)
    expect(findAll(content(), (e) => e.props.role === 'alert')).toHaveLength(1)
    const next = fakeNode()
    h.elements.set(kioskConfirmId('a2'), next)
    ;(findAll(tree, (e) => e.props.id === kioskConfirmId('a1'))[0].props.onClick as () => void)()
    tree = await c.flush()
    runFrames()
    c.rerender()
    expect(next.focus).toHaveBeenCalledTimes(1)
    const status = findAll(content(), (e) => e.props.role === 'status')[0]
    expect(markupText(html(el('div', null, status.props.children as never)))).toContain('Nguyễn An')
  })
})

// ---------------------------------------------------------------------------------------------
// Diagnostics: a translated line, one row with the code, never the text
// ---------------------------------------------------------------------------------------------

const logged = () => JSON.stringify(warn())

describe('failures show a translated line and write one row with their code only', () => {
  it('the review queue read fails: admin.resources.load_failed with the PostgREST code', async () => {
    h.rpc.admin_list_pending_resources = { data: null, error: { code: '42501', message: 'permission denied near "Amina"' } }
    const { tree } = await openQueue('ko')
    expect(warn()).toEqual([['admin.resources.load_failed', { code: '42501' }]])
    expect(logged()).not.toContain('Amina')
    expect(text(tree)).toContain(R('ko', 'queueLoadFailed'))
    expect(text(tree)).not.toContain('permission denied')
  })

  it('Discover answers 500: code http with the status; the reply text is neither shown nor logged', async () => {
    h.fetchMode = 'http500'
    const { c, tree } = await openQueue('ko')
    ;(findAll(tree, (e) => e.props.id === 'resources-discover-query')[0].props.onChange as (e: unknown) => void)({ target: { value: 'food banks' } })
    const t2 = c.rerender()
    ;(findAll(t2, (e) => String(e.props.className ?? '').includes('bg-lime-700 hover:bg-lime-800 text-white shrink-0'))[0].props.onClick as () => void)()
    const after = await c.flush()
    expect(warn()).toEqual([['admin.resource.discover_failed', { code: 'http', status: 500 }]])
    expect(text(after)).toContain(R('ko', 'discoverFailed'))
    expect(text(after) + logged()).not.toContain('food banks in Burlington')
  })

  it('a reject that fails: the translated line; the path’s own logger.error row, no row added', async () => {
    h.privReply = { data: null, error: { code: 'P0001', message: 'resource "مخزن الحي" locked by trigger' } }
    const { c, tree } = await openQueue('ko')
    ;(byLabelStart(tree, R('ko', 'reject'))[0].props.onClick as () => void)()
    const after = await c.flush()
    expect(warn()).toEqual([])
    expect(vi.mocked(logger.error).mock.calls.map((x) => x[0])).toEqual(['admin.resource.reject'])
    expect(text(after)).toContain(R('ko', 'rejectFailed').split('{name}')[0].trim().slice(0, 3))
    expect(text(after)).not.toContain('locked by trigger')
  })

  it('the Manage read fails: admin.resource.list_failed with the code and page', async () => {
    h.rpc.admin_list_resources = { data: null, error: { code: 'PGRST301', message: 'JWT expired for Amina' } }
    const tree = await mount(() => ManageResourcesTab({ locale: 'ko' })).flush()
    expect(warn()).toEqual([['admin.resource.list_failed', { code: 'PGRST301', page: 'first' }]])
    expect(text(tree)).toContain(R('ko', 'listLoadFailed'))
    expect(logged() + text(tree)).not.toContain('Amina')
  })

  it('a business save changed nothing: the not-saved line in the admin’s language; the data layer’s row, none added', async () => {
    const { BusinessWriteError } = await import('@/lib/business-data')
    h.updateThrows = new BusinessWriteError(BUSINESS_NOT_SAVED_MESSAGE)
    const c = mount(() => BusinessesTab({ locale: 'ko' }))
    let tree = await c.flush()
    ;(byLabelStart(tree, orgFormT('ko', 'actionEdit'))[0].props.onClick as () => void)()
    tree = c.rerender()
    ;(findAll(tree, (e) => e.props.children === R('ko', 'save'))[0].props.onClick as () => void)()
    tree = await c.flush()
    expect(decodeEntities(text(tree))).toContain(R('ko', 'businessNotSaved'))
    expect(text(tree)).not.toContain(BUSINESS_NOT_SAVED_MESSAGE)
    expect(warn()).toEqual([])
  })

  it('a toggle refused: the Organizations tab’s line, reverted; the server’s text is not shown', async () => {
    h.toggleThrows = true
    const c = mount(() => BusinessesTab({ locale: 'ko' }))
    let tree = await c.flush()
    ;(byLabelStart(tree, orgFormT('ko', 'actionDeactivate'))[0].props.onClick as () => void)()
    tree = await c.flush()
    expect(text(tree)).toContain(orgFormT('ko', 'toggleFailed').split('{name}')[1].trim().slice(0, 4))
    expect(text(tree)).not.toContain('permission denied')
  })

  it.each([
    ['23505', 'addDuplicate'],
    ['22P02', 'addInvalid'],
    ['23503', 'addNoAccount'],
    ['XX000', 'addFailed'],
  ] as const)('the roster add fails with %s: its sentence, one admin.org.members_failed row', async (code, key) => {
    const c = mount(() => OrgMembers({ orgId: 'org', locale: 'ko' }))
    let tree = await c.flush()
    vi.mocked(logger.warn).mockClear()
    h.from.organization_members = { data: null, error: { code, message: 'duplicate key value "u-new" violates' } }
    ;(tree as unknown as { props: { onAddUserIdChange: (v: string) => void } }).props.onAddUserIdChange('u-new')
    tree = c.rerender()
    ;(tree as unknown as { props: { onAdd: () => void } }).props.onAdd()
    tree = await c.flush()
    expect(warn()).toEqual([['admin.org.members_failed', { op: 'add', code }]])
    expect((tree as unknown as { props: { add: { error: string } } }).props.add.error).toBe(O('ko', key))
    expect(logged()).not.toContain('u-new')
  })

  it('the kiosk refresh fails twice: one row for the run, the translated line; a confirm failure gets its own row', async () => {
    vi.useFakeTimers()
    try {
      h.rpc.event_attendance = { data: null, error: { code: '42501', message: 'denied for "أمينة"' } }
      const c = mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'ko' }))
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(10_000)
      c.rerender()
      expect(warn()).toEqual([['admin.checkin.kiosk.failed', { op: 'load', code: '42501' }]])
      const content = findAll(c.tree(), (e) => e.type === DialogPrimitive.Content)[0]
      expect(text(inDialog(content.props.children))).toContain(O('ko', 'kioskLoadFailed'))
      expect(logged()).not.toContain('أمينة')
      c.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------------------------
// PR #255 fix round: never lose focus, hear every result exactly once — repeats included
// ---------------------------------------------------------------------------------------------

type RosterProps = {
  status: Announcement
  removingId: string | null
  add: { error: string | null }
  rosterError: string | null
  onRemove: (id: string) => Promise<void>
  onChangeRole: (id: string, role: string) => Promise<void>
  onAddUserIdChange: (v: string) => void
  onAdd: () => Promise<void>
}
const rosterProps = (c: { tree: () => unknown }) => (c.tree() as { props: RosterProps }).props
const rosterView = (over: Record<string, unknown>) =>
  mount(() =>
    OrgMembersView({
      orgId: 'org', locale: 'ko', members: MEMBERS, loading: false, loadError: null, rosterError: null, status: NO_ANNOUNCEMENT, readOnly: false,
      add: { userId: 'u', role: 'member', adding: false, error: null },
      onAddUserIdChange: () => {}, onAddRoleChange: () => {}, onAdd: () => {}, onRemove: () => {}, onChangeRole: () => {},
      ...over,
    } as never),
  ).tree()

describe('B1 — bulk approve: Confirm takes focus and is described by the question', () => {
  it('the confirmation’s Confirm points at the question', async () => {
    const { c, tree } = await openQueue('ko')
    const open = findAll(tree, (e) => e.props.ref && String(markupText(html(el('span', null, e.props.children as never)))).includes(R('ko', 'bulkApprove').split('(')[0].trim()))[0]
    ;(open.props.onClick as () => void)()
    const after = c.rerender()
    const confirm = findAll(after, (e) => e.props['aria-describedby'] === 'resources-bulk-question')
    expect(confirm).toHaveLength(1)
    expect(findAll(after, (e) => e.props.id === 'resources-bulk-question')).toHaveLength(1)
    // That opening moves focus to Confirm is shown with real React in resources-orgs.dom.test.ts.
  })
})

describe('B2 — the roster: re-reads keep the table; role change and Remove keep focus', () => {
  it('a re-read with rows on screen keeps the table (aria-busy), never the loading line; an empty roster shows it', () => {
    const busy = html(rosterView({ loading: true }))
    expect(busy).toContain('<table')
    expect(busy).toContain('aria-busy="true"')
    expect(markupText(busy)).not.toContain(O('ko', 'membersLoading'))
    expect(markupText(html(rosterView({ loading: true, members: [] })))).toContain(O('ko', 'membersLoading'))
  })

  it('after a role change focus returns to that row’s role trigger (stable id)', async () => {
    const c = mount(() => OrgMembers({ orgId: 'org', locale: 'ko' }))
    await c.flush()
    const trigger = fakeNode()
    h.elements.set('roster-org-role-m2', trigger)
    h.from.organization_members = { data: [{ id: 'm2' }], error: null }
    await rosterProps(c).onChangeRole('m2', 'admin')
    h.from.organization_members = { data: MEMBERS, error: null }
    await c.flush()
    runFrames()
    expect(trigger.focus).toHaveBeenCalledTimes(1)
    expect(findAll(rosterView({}), (e) => e.props.id === 'roster-org-role-m2')).toHaveLength(1)
  })

  it('Remove moves focus BEFORE the roster re-reads (never through <body>); a second press on the busy row does nothing', async () => {
    const c = mount(() => OrgMembers({ orgId: 'org', locale: 'ko' }))
    await c.flush()
    const next = { focus: vi.fn(() => h.calls.push(['focus'])) }
    h.elements.set(rosterRemoveId('org', 'm2'), next)
    h.calls.length = 0
    h.from.organization_members = { data: [{ id: 'm1' }], error: null }
    const first = rosterProps(c).onRemove('m1')
    c.rerender()
    expect(rosterProps(c).removingId).toBe('m1')
    await rosterProps(c).onRemove('m1')
    await first
    const order = h.calls.map((x) => (x[0] === 'focus' ? 'focus' : `${x[0]}.${x[1]}`))
    expect(order.filter((x) => x === 'organization_members.delete')).toHaveLength(1)
    expect(order.indexOf('focus')).toBeGreaterThan(order.indexOf('organization_members.delete'))
    expect(order.indexOf('focus')).toBeLessThan(order.lastIndexOf('organization_members.select'))
    const removeBusy = findAll(rosterView({ removingId: 'm1' }), (e) => e.props.id === rosterRemoveId('org', 'm1'))[0]
    expect([removeBusy.props['aria-disabled'], removeBusy.props.disabled]).toEqual([true, undefined])
  })
})

describe('H1 — an add failure is always shown and announced', () => {
  it('the add form has its own always-mounted alert beside the roster’s', () => {
    const quiet = rosterView({})
    expect(findAll(quiet, (e) => e.props['data-testid'] === 'roster-add-alert-org')[0].props.role).toBe('alert')
    const both = rosterView({ rosterError: O('ko', 'removeFailed'), add: { userId: 'u', role: 'member', adding: false, error: O('ko', 'addDuplicate') } })
    const t = markupText(html(both))
    expect(t).toContain(O('ko', 'removeFailed'))
    expect(t).toContain(O('ko', 'addDuplicate'))
  })

  it('starting an add clears an earlier remove failure', async () => {
    const c = mount(() => OrgMembers({ orgId: 'org', locale: 'ko' }))
    await c.flush()
    h.from.organization_members = { data: [], error: null }
    await rosterProps(c).onRemove('m1')
    await c.flush()
    expect(rosterProps(c).rosterError).toBe(O('ko', 'removeFailed'))
    rosterProps(c).onAddUserIdChange('u-new')
    c.rerender()
    h.from.organization_members = { data: null, error: { code: '23505' } }
    await rosterProps(c).onAdd()
    await c.flush()
    expect(rosterProps(c).rosterError).toBeNull()
    expect(rosterProps(c).add.error).toBe(O('ko', 'addDuplicate'))
  })
})

describe('H2 — the walk-in stepper is heard and safe at its bounds', () => {
  const kiosk = () => mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'en' }))
  const get = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id)[0]

  it('one combined string in an sr-only polite live span; the visual number and word are aria-hidden', async () => {
    const c = kiosk()
    const tree = await c.flush()
    const live = get(tree, 'walkin-size-live')
    expect([live.props['aria-live'], live.props['aria-atomic'], live.props.className]).toEqual(['polite', 'true', 'sr-only'])
    expect(live.props.children).toBe('1 person')
    expect(get(tree, 'walkin-size').props['aria-hidden']).toBe('true')
    ;(get(tree, 'walkin-increase').props.onClick as () => void)()
    expect(get(c.rerender(), 'walkin-size-live').props.children).toBe('2 people')
  })

  it('at a bound the button is aria-disabled (never disabled) and its press does nothing', async () => {
    const c = kiosk()
    let tree = await c.flush()
    const dec = get(tree, 'walkin-decrease')
    expect([dec.props['aria-disabled'], dec.props.disabled]).toEqual([true, undefined])
    ;(dec.props.onClick as () => void)()
    tree = c.rerender()
    expect(get(tree, 'walkin-size-live').props.children).toBe('1 person')
    for (let i = 0; i < 25; i++) {
      ;(get(c.tree(), 'walkin-increase').props.onClick as () => void)()
      c.rerender()
    }
    tree = c.tree()
    expect(get(tree, 'walkin-size-live').props.children).toBe('20 people')
    expect(get(tree, 'walkin-increase').props['aria-disabled']).toBe(true)
    expect(get(tree, 'walkin-decrease').props['aria-disabled']).toBeUndefined()
  })
})

describe('H3 — a repeated identical result is announced again', () => {
  it('announce() gives every call a new sequence number, so its keyed node is new', async () => {
    const { announce } = await import('./row-focus')
    let a: Announcement = NO_ANNOUNCEMENT
    const set = (v: Announcement | ((p: Announcement) => Announcement)) => (a = typeof v === 'function' ? v(a) : v)
    announce(set as never, 'Saved')
    const first = a
    announce(set as never, 'Saved')
    expect([first.text, a.text]).toEqual(['Saved', 'Saved'])
    expect(a.seq).toBe(first.seq + 1)
  })

  it('two identical role changes in a row: same words, a new sequence number (a new node; see the DOM test)', async () => {
    const c = mount(() => OrgMembers({ orgId: 'org', locale: 'ko' }))
    await c.flush()
    h.from.organization_members = { data: [{ id: 'm2' }], error: null }
    await rosterProps(c).onChangeRole('m2', 'admin')
    await c.flush()
    const first = rosterProps(c).status
    expect(first.text).toBe(O('ko', 'roleChanged'))
    h.from.organization_members = { data: [{ id: 'm2' }], error: null }
    await rosterProps(c).onChangeRole('m2', 'member')
    await c.flush()
    expect(rosterProps(c).status).toEqual({ text: O('ko', 'roleChanged'), seq: first.seq + 1 })
  })

  it('every W4 status setter goes through announce()', () => {
    const SRC = fileURLToPath(new URL('.', import.meta.url))
    for (const f of ['resources-tab.tsx', 'manage-resources-tab.tsx', 'businesses-tab.tsx', 'orgs-section.tsx', 'organizer-checkin-display.tsx', 'org/[id]/org-admin-shell.tsx', 'org/org-overview.tsx']) {
      const src = readFileSync(SRC + f, 'utf8')
      // Set only through announce() / clearAnnouncement(), and rendered only through AnnouncementText.
      expect(src, f).not.toMatch(/\bset(Status|Notice|Flash)\(/)
      expect(src, f).toMatch(/<AnnouncementText announcement=\{(status|notice|flash)\} \/>/)
    }
  })

  it('no aria-disabled dim is left in a W4 file (the focus ring keeps full contrast)', () => {
    const SRC = fileURLToPath(new URL('.', import.meta.url))
    for (const f of ['resources-tab.tsx', 'manage-resources-tab.tsx', 'businesses-tab.tsx', 'resource-edit-dialog.tsx', 'orgs-section.tsx', 'organizer-checkin-display.tsx']) {
      expect(readFileSync(SRC + f, 'utf8'), f).not.toMatch(/aria-disabled:(opacity-|bg-[^\s'"`]*\/\d)/)
    }
  })
})

describe('H5 — Discover keeps focus while it runs', () => {
  it('no query: aria-disabled (solid grey), a press sends nothing; running: the boxes are readOnly, the button aria-disabled, a second press sends nothing', async () => {
    let fetches = 0
    vi.stubGlobal('fetch', () => {
      fetches++
      return new Promise(() => {})
    })
    const { c, tree } = await openQueue('ko')
    const button = () => findAll(c.tree(), (e) => e.props['data-testid'] === 'resources-discover')[0]
    expect([button().props['aria-disabled'], button().props.disabled]).toEqual([true, undefined])
    expect(String(button().props.className)).toContain('bg-stone-200 text-stone-700')
    ;(button().props.onClick as () => void)()
    await c.flush(2)
    expect(fetches).toBe(0)
    ;(findAll(tree, (e) => e.props.id === 'resources-discover-query')[0].props.onChange as (e: unknown) => void)({ target: { value: 'food banks' } })
    c.rerender()
    ;(button().props.onClick as () => void)()
    await c.flush(2)
    expect(fetches).toBe(1)
    for (const id of ['resources-discover-query', 'resources-discover-near']) {
      const box = findAll(c.tree(), (e) => e.props.id === id)[0]
      expect([box.props.readOnly, box.props.disabled], id).toEqual([true, undefined])
    }
    expect([button().props['aria-disabled'], button().props.disabled]).toEqual([true, undefined])
    ;(button().props.onClick as () => void)()
    await c.flush(2)
    expect(fetches).toBe(1)
  })
})

describe('security lows', () => {
  it('a busy toggle blocks only its own row: another row’s toggle still runs', async () => {
    const c = mount(() => BusinessesTab({ locale: 'ko' }))
    const tree = await c.flush()
    reset()
    ;(byLabelStart(tree, orgFormT('ko', 'actionDeactivate'))[0].props.onClick as () => void)()
    c.rerender()
    ;(byLabelStart(c.tree(), orgFormT('ko', 'actionReactivate')).find((b) => String(b.props['aria-label']).includes('Old Mill'))!.props.onClick as () => void)()
    await c.flush()
    expect(h.calls).toEqual([['set_active', 'b3', false], ['set_active', 'b4', true]])
  })

  it('the kiosk: fail → recover → fail writes two load rows; a failed confirm writes its own row; a walk-in clears the old error', async () => {
    vi.useFakeTimers()
    try {
      h.rpc.event_attendance = { data: null, error: { code: '42501' } }
      const c = mount(() => OrganizerCheckinDisplay({ occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'ko' }))
      await vi.advanceTimersByTimeAsync(0)
      h.rpc.event_attendance = { data: ATTENDANCE, error: null }
      await vi.advanceTimersByTimeAsync(10_000)
      h.rpc.event_attendance = { data: null, error: { code: '57014' } }
      await vi.advanceTimersByTimeAsync(10_000)
      c.rerender()
      expect(warn().filter(([n]) => n === 'admin.checkin.kiosk.failed')).toEqual([
        ['admin.checkin.kiosk.failed', { op: 'load', code: '42501' }],
        ['admin.checkin.kiosk.failed', { op: 'load', code: '57014' }],
      ])
      vi.mocked(logger.warn).mockClear()
      h.rpc.event_attendance = { data: ATTENDANCE, error: null }
      await vi.advanceTimersByTimeAsync(10_000)
      c.rerender()
      h.rpc.organizer_confirm = { data: null, error: { code: 'P0001', message: 'already confirmed "Nguyễn An"' } }
      ;(findAll(c.tree(), (e) => e.props.id === kioskConfirmId('a1'))[0].props.onClick as () => void)()
      await vi.advanceTimersByTimeAsync(0)
      c.rerender()
      expect(warn()).toEqual([['admin.checkin.kiosk.failed', { op: 'confirm', code: 'P0001' }]])
      const alert = () => findAll(findAll(c.tree(), (e) => e.type === DialogPrimitive.Content)[0], (e) => e.props.role === 'alert')[0]
      expect(markupText(html(el('div', null, alert().props.children as never)))).toContain('Nguyễn An')
      h.rpc.organizer_confirm = { data: null, error: null }
      ;(findAll(c.tree(), (e) => e.type === 'button' && Array.isArray(e.props.children) && (e.props.children as unknown[]).includes(O('ko', 'addHousehold')))[0].props.onClick as () => void)()
      c.rerender()
      expect(markupText(html(el('div', null, alert().props.children as never)))).toBe('')
      c.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the grey invalid state really is stone-700 on stone-200 (classes merged with cn)', () => {
  const addButton = (userId: string) =>
    findAll(rosterView({ add: { userId, role: 'member', adding: false, error: null } }), (e) => e.type === 'button' && e.props.children === O('ko', 'addMember'))[0]

  it('an empty user id: the merged class list has no text-white and no bg-brand', () => {
    const classes = String(addButton('').props.className).split(/\s+/)
    expect(classes).toContain('bg-stone-200')
    expect(classes).toContain('text-stone-700')
    expect(classes).not.toContain('text-white')
    expect(classes).not.toContain('bg-brand')
  })

  it('a user id typed: the brand fill and white text', () => {
    const classes = String(addButton('u-1').props.className).split(/\s+/)
    expect(classes).toContain('text-white')
    expect(classes).toContain('bg-brand')
  })
})
