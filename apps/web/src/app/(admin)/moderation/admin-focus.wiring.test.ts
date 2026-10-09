// apps/web/src/app/(admin)/moderation/admin-focus.wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 wiring, behaviourally: the real screens with the real focus hooks (use-admin-focus.ts), on the
// mini hook runtime, a stubbed window and a mocked Supabase client. Asserts the rows written and the
// URL afterwards:
//   - main shell: the gate waits until BOTH the tier and the organization roles are loaded, then
//     writes forbidden once (and shows the line); nothing when the owning tab is shown;
//   - organization page: a non-event focus is invalid;
//   - each owning tab claims its kind on the contract tab: the post panel (moderation), the safety
//     alerts review (moderation), the event scheduler (events) — one `found` row each, focus dropped.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  tier: { tier: null as string | null, isFounder: false, loading: true },
  org: { isOrgAdmin: false, loaded: false },
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => h.rows.push({ name, ...attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/hooks/use-admin-tier', () => ({ useAdminTier: () => h.tier }))
vi.mock('@/hooks/use-is-org-admin', () => ({ useIsOrgAdminState: () => h.org, useIsOrgAdmin: () => h.org.isOrgAdmin }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: null, loading: false }) }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('./use-admin-orgs', () => ({
  useAdminOrgs: () => ({ orgs: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Pantry', org_type: 'food_bank' }], loading: false, error: null }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'eq', 'in', 'gte', 'gt', 'lt', 'or', 'range']) chain[m] = () => chain
      const row =
        table === 'posts'
          ? { id: 'x', content: 'x', post_type: 'request', created_at: '2026-10-01T00:00:00Z', is_hidden: false, hidden_reason: null, hidden_at: null, author: null }
          : table === 'safety_alerts'
            ? { id: 'x', status: 'live', alert_type: 'general', severity: 1, description: null, confirm_count: 0, clear_count: 0, created_at: '2026-10-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', verified: false }
            : { id: 'x', org_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'T', event_type: 'pantry', description: null, location_name: null, time_zone: 'America/New_York', is_active: true, recurrence: null, series_start_local: null, series_duration: null, announce_days_before: 0, org: { name: 'P', is_active: true }, next: [], feed_next: [] }
      chain.maybeSingle = () => Promise.resolve({ data: row, error: null })
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
      return chain
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
}))

import { mount, findAll } from '@/test/mini-react'
import { AdminShell } from './admin-shell'
import { OrgAdminShell } from './org/[id]/org-admin-shell'
import { AdminFocusGateStatus } from './admin-focus-gate-status'
import { FocusedPost } from './focused-post'
import { SafetyAlertsReview } from './safety-alerts-review'
import { EventScheduler } from './event-scheduler'

const ID = '11111111-1111-4111-8111-111111111111'
let search = ''

beforeEach(() => {
  h.rows.length = 0
  h.tier = { tier: null, isFounder: false, loading: true }
  h.org = { isOrgAdmin: false, loaded: false }
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb())
  vi.stubGlobal('document', { activeElement: null, body: {}, querySelector: () => null })
  vi.stubGlobal('window', {
    get location() {
      return { pathname: '/moderation', search, hash: '' }
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, href: string) => {
        search = href.includes('?') ? href.slice(href.indexOf('?')).split('#')[0] : ''
      },
      pushState: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

const deeplinkRows = () => h.rows.filter((r) => r.name === 'admin.deeplink.resolve')

describe('main shell gate (behaviour)', () => {
  it('waits for the tier AND the organization roles, then writes forbidden once and shows the line', async () => {
    search = `?tab=moderation&focus=post:${ID}`
    const shell = mount(() => AdminShell())
    await shell.flush()
    expect(deeplinkRows()).toEqual([])

    // Tier loaded (no tier) — organization roles still loading: still nothing.
    h.tier = { tier: null, isFounder: false, loading: false }
    shell.rerender()
    await shell.flush()
    expect(deeplinkRows()).toEqual([])

    // An organization admin with no tier: Events only → the Moderation tab is not shown.
    h.org = { isOrgAdmin: true, loaded: true }
    shell.rerender()
    const tree = await shell.flush()
    expect(deeplinkRows()).toEqual([{ name: 'admin.deeplink.resolve', kind: 'post', outcome: 'forbidden', tab: 'moderation' }])
    expect(search).toBe('?tab=moderation')
    const status = findAll(tree, (el) => el.type === AdminFocusGateStatus)
    expect(status).toHaveLength(1)
    expect(status[0].props.row).toMatchObject({ outcome: 'forbidden' })

    shell.rerender()
    await shell.flush()
    expect(deeplinkRows()).toHaveLength(1)
  })

  it('a moderator (owning tab shown): the shell writes nothing', async () => {
    search = `?tab=moderation&focus=post:${ID}`
    h.tier = { tier: 'community_moderator', isFounder: false, loading: false }
    h.org = { isOrgAdmin: false, loaded: true }
    const shell = mount(() => AdminShell())
    await shell.flush()
    expect(deeplinkRows()).toEqual([])
    expect(search).toBe(`?tab=moderation&focus=post:${ID}`)
  })
})

describe('organization page gate (behaviour)', () => {
  it('a post focus on the organization page is invalid', async () => {
    search = `?tab=events&focus=post:${ID}`
    const page = mount(() =>
      OrgAdminShell({ org: { id: ORG, name: 'Pantry', org_type: 'food_bank', is_active: true, city: null, state: null, has_map_location: false }, isPlatformAdmin: false })
    )
    await page.flush()
    expect(deeplinkRows()).toEqual([{ name: 'admin.deeplink.resolve', kind: 'post', outcome: 'invalid', tab: 'events' }])
  })
})

describe('owning tabs claim their kind on the contract tab (behaviour)', () => {
  it.each([
    ['the post panel', `?tab=moderation&focus=post:${ID}`, () => FocusedPost({}), { kind: 'post', tab: 'moderation' }],
    ['the safety alerts review', `?tab=moderation&focus=safety_alert:${ID}`, () => SafetyAlertsReview(), { kind: 'safety_alert', tab: 'moderation' }],
    ['the event scheduler (org page)', `?tab=events&focus=event:${ID}`, () => EventScheduler({ selectedOrgId: ORG, source: 'org_admin_events' }), { kind: 'event', tab: 'events' }],
    ['the event scheduler (main shell)', `?tab=events&focus=event:${ID}`, () => EventScheduler({ selectedOrgId: 'all' }), { kind: 'event', tab: 'events' }],
  ])('%s: one found row, focus dropped', async (_name, url, render, row) => {
    search = url
    const c = mount(render)
    await c.flush()
    expect(deeplinkRows()).toEqual([{ name: 'admin.deeplink.resolve', ...row, outcome: 'found' }])
    expect(search).not.toContain('focus=')
  })

  it('a tab never claims another kind', async () => {
    search = `?tab=moderation&focus=safety_alert:${ID}`
    const c = mount(() => FocusedPost({}))
    await c.flush()
    expect(c.tree()).toBeNull()
    expect(deeplinkRows()).toEqual([])
  })
})
