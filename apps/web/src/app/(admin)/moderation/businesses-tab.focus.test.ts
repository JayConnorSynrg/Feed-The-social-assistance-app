// apps/web/src/app/(admin)/moderation/businesses-tab.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The REAL BusinessesTab (real useAdminFocusSession from use-admin-focus.ts — the contract shared
// with PR-5b — and real adminUpdateBusiness), driven by the SSR hook harness, Supabase faked:
//   I2 — /moderation?tab=businesses&focus=business:<id> waits for the viewer's tier and the approved
//        list, then opens THAT row in edit mode, scrolled into view with its Name field focused; one
//        admin.deeplink.resolve row; focus stripped. The tab writes only found / not_found /
//        abandoned: an id not in the approved list, or a resource admin (orgs_admin_update is
//        platform-admin only), is one not_found row with a plain line saying why, nothing opened. A
//        malformed focus is the shell gate's (invalid): the tab writes nothing.
//   I3 — a save that RLS filtered to zero rows reports failure (the form stays open with the reason,
//        an error row is written, no reload); a save that changed the row closes the form. No focus
//        param: nothing opens, no row.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import type { AdminEditViewer } from '@/lib/admin-editability'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  return reactWithHarness(await importOriginal<typeof import('react')>())
})

const { events, metrics, errors, viewerRef, buttons, updates, updateResult, listCalls } = vi.hoisted(() => ({
  events: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
  metrics: [] as Array<{ event: string }>,
  errors: [] as string[],
  viewerRef: { current: null as unknown },
  buttons: [] as Array<{ label: string; onClick?: () => void }>,
  updates: [] as Array<{ patch: Record<string, unknown>; eq: [string, unknown]; select: string | null }>,
  updateResult: { current: { data: [{ id: 'x' }] as unknown, error: null as null | { message: string } } },
  listCalls: { count: 0, gate: null as null | Promise<void>, pendingGate: null as null | Promise<void> },
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: (event: string) => errors.push(event) },
  logEvent: (name: string, attrs: Record<string, unknown>) => events.push({ name, attrs }),
  withMetric: async (op: string, _a: unknown, fn: () => Promise<unknown>) => {
    try {
      const r = await fn()
      metrics.push({ event: `${op}.complete` })
      return r
    } catch (e) {
      metrics.push({ event: `${op}.error` })
      throw e
    }
  },
}))
// The tab reads the shell's shared tier lookup; tests set it as an AdminEditViewer-shaped value.
vi.mock('@/hooks/use-admin-tier', () => ({
  useAdminTier: () => {
    const v = viewerRef.current as AdminEditViewer
    return { tier: v.status === 'ready' ? v.tier : null, isFounder: false, loading: v.status === 'loading' }
  },
}))
vi.mock('@/components/admin/member-view-link', () => ({ MemberViewLink: () => null }))
vi.mock('@/lib/privileged-action', () => ({ privilegedRpc: vi.fn() }))
vi.mock('@/components/ui/button', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return {
    Button: (props: { children?: unknown; onClick?: () => void }) => {
      const label = typeof props.children === 'string' ? props.children : ''
      buttons.push({ label, onClick: props.onClick })
      return createElement('button', null, props.children as string)
    },
  }
})

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
function row(id: string, name: string) {
  return {
    id,
    name,
    description: null,
    org_type: 'business',
    address: null,
    city: 'Rutland',
    state: 'VT',
    zip_code: null,
    phone: null,
    email: null,
    website: null,
    business_category: null,
    cost_model: null,
    service_radius_miles: null,
    attributes: {},
    social_links: {},
    location: null,
    resource_id: null,
    is_active: true,
  }
}

vi.mock('@/lib/business-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/business-data')>()
  return {
    ...actual,
    fetchPendingBusinesses: async () => {
      if (listCalls.pendingGate) await listCalls.pendingGate
      return []
    },
    fetchAdminBusinessList: async () => {
      listCalls.count++
      if (listCalls.gate) await listCalls.gate
      return [row(OTHER, 'Bakery'), row(ID, 'Corner Cafe')]
    },
  }
})
vi.mock('@/lib/supabase/client', () => {
  const client = {
    from: () => {
      const rec = { patch: {} as Record<string, unknown>, eq: ['', null] as [string, unknown], select: null as string | null }
      const b = {
        update: (patch: Record<string, unknown>) => {
          rec.patch = patch
          return b
        },
        eq: (c: string, v: unknown) => {
          rec.eq = [c, v]
          return b
        },
        select: (cols: string) => {
          rec.select = cols
          return b
        },
        then: (cb: (r: unknown) => unknown) => {
          updates.push(rec)
          return Promise.resolve(cb(updateResult.current))
        },
      }
      return b
    },
  }
  return { createClient: () => client }
})

import { harness } from '@/test-utils/ssr-hook-harness'
import { BusinessesTab } from './businesses-tab'
import { BUSINESS_NOT_SAVED_MESSAGE } from '@/lib/business-data'

const ready = (tier: AdminEditViewer['tier']): AdminEditViewer => ({ status: 'ready', tier, adminOrgIds: null })

const replaceState = vi.fn()
const field = { scrollIntoView: vi.fn(), focus: vi.fn() }
const getElementById = vi.fn((id: string) => (id === `edit-name-${ID}` ? field : null))
function setUrl(search: string) {
  const location = { pathname: '/moderation', search, hash: '' }
  replaceState.mockImplementation((_s: unknown, _u: string, url: string) => {
    const q = url.indexOf('?')
    location.search = q < 0 ? '' : url.slice(q)
  })
  ;(globalThis as unknown as { window: unknown }).window = { location, history: { state: null, replaceState } }
  ;(globalThis as unknown as { document: unknown }).document = { getElementById }
}

const resolveRows = () => events.filter((e) => e.name === 'admin.deeplink.resolve').map((e) => e.attrs)
const editFormsOpen = (html: string) => [...html.matchAll(/id="edit-name-([0-9a-f-]+)"/g)].map((m) => m[1])
const lastButton = (label: string) => [...buttons].reverse().find((b) => b.label === label)

beforeEach(() => {
  harness.reset()
  events.length = 0
  metrics.length = 0
  errors.length = 0
  buttons.length = 0
  updates.length = 0
  listCalls.count = 0
  listCalls.gate = null
  listCalls.pendingGate = null
  replaceState.mockReset()
  getElementById.mockClear()
  field.scrollIntoView.mockClear()
  field.focus.mockClear()
  updateResult.current = { data: [{ id: ID }], error: null }
  viewerRef.current = ready('platform_admin')
})

describe('BusinessesTab — "Edit in admin" landing (I2)', () => {
  it('platform admin: opens THAT business row in edit mode, scrolled into view, Name focused', async () => {
    setUrl(`?tab=businesses&focus=business:${ID}`)
    const html = await harness.settle(h(BusinessesTab))
    expect(editFormsOpen(html)).toEqual([ID])
    expect(html).toContain('value="Corner Cafe"')
    // The focused Name field is described by its row's heading (the business being edited).
    expect(html).toContain(`id="business-title-${ID}"`)
    expect(html).toMatch(new RegExp(`id="edit-name-${ID}"[^>]*aria-describedby="business-title-${ID}"`))
    expect(getElementById).toHaveBeenCalledWith(`edit-name-${ID}`)
    expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(field.focus).toHaveBeenCalledTimes(1)
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'found', tab: 'businesses' }])
    expect(replaceState.mock.calls.map((c) => c[2])).toEqual(['/moderation?tab=businesses'])
  })

  it('waits for the tier: nothing settles while the viewer is loading', async () => {
    viewerRef.current = { status: 'loading', tier: null, adminOrgIds: null }
    setUrl(`?tab=businesses&focus=business:${ID}`)
    let html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([])
    expect(editFormsOpen(html)).toEqual([])
    viewerRef.current = ready('platform_admin')
    html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'found', tab: 'businesses' }])
    expect(editFormsOpen(html)).toEqual([ID])
  })

  it('waits for the approved list: nothing settles while it loads, then that row opens', async () => {
    let release!: () => void
    listCalls.gate = new Promise<void>((r) => (release = r))
    setUrl(`?tab=businesses&focus=business:${ID}`)
    let html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([])
    expect(editFormsOpen(html)).toEqual([])
    release()
    html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'found', tab: 'businesses' }])
    expect(editFormsOpen(html)).toEqual([ID])
  })

  it('the notice live region exists from the first render, through the loading spinner; a notice arriving then lands in it', async () => {
    let releasePending!: () => void
    listCalls.pendingGate = new Promise<void>((r) => (releasePending = r))
    viewerRef.current = ready('resource_admin')
    setUrl(`?tab=businesses&focus=business:${ID}`)
    const first = await harness.render(h(BusinessesTab))
    expect(first).toContain('animate-spin')
    expect(first).toContain('<p role="status" class="sr-only"></p>')
    // The approved list and tier are in while the pending queue still spins: the notice arrives now.
    let html = await harness.settle(h(BusinessesTab))
    expect(html).toContain('animate-spin')
    expect(html).toMatch(/<p role="status" class="flex-1">Only platform admins can edit businesses\.<\/p>/)
    releasePending()
    html = await harness.settle(h(BusinessesTab))
    expect(html).not.toContain('animate-spin')
    expect(html).toMatch(/^<div class="space-y-8"><div class="[^"]*"><p role="status" class="flex-1">Only platform admins/)
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'not_found', tab: 'businesses' }])
  })

  it('not_found: an id not in the approved list -> one row, a notice, nothing opened', async () => {
    setUrl('?tab=businesses&focus=business:33333333-3333-4333-8333-333333333333')
    const html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'not_found', tab: 'businesses' }])
    expect(html).toContain('That business couldn&#x27;t be found')
    expect(editFormsOpen(html)).toEqual([])
  })

  it('a resource admin sees the tab but cannot save a business -> one not_found row, a plain line, nothing opened', async () => {
    viewerRef.current = ready('resource_admin')
    setUrl(`?tab=businesses&focus=business:${ID}`)
    const html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'not_found', tab: 'businesses' }])
    expect(html).toContain('Only platform admins can edit businesses.')
    expect(editFormsOpen(html)).toEqual([])
    expect(replaceState.mock.calls.map((c) => c[2])).toEqual(['/moderation?tab=businesses'])
  })

  it('a malformed focus is the shell gate\'s (invalid): the tab writes nothing', async () => {
    setUrl('?tab=businesses&focus=business:nope')
    const html = await harness.settle(h(BusinessesTab))
    expect(resolveRows()).toEqual([])
    expect(editFormsOpen(html)).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('abandoned: the tab unmounts while still waiting for the tier -> one abandoned row', async () => {
    viewerRef.current = { status: 'loading', tier: null, adminOrgIds: null }
    setUrl(`?tab=businesses&focus=business:${ID}`)
    await harness.settle(h(BusinessesTab))
    harness.unmount()
    await new Promise((r) => setTimeout(r, 0))
    expect(resolveRows()).toEqual([{ kind: 'business', outcome: 'abandoned', tab: 'businesses' }])
  })

  it('I3 — no focus param: nothing opens, no row, URL untouched', async () => {
    setUrl('?tab=businesses')
    const html = await harness.settle(h(BusinessesTab))
    expect(editFormsOpen(html)).toEqual([])
    expect(resolveRows()).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
    expect(html).toContain('Corner Cafe')
    expect(html).toContain('Bakery')
  })
})

describe('BusinessesTab — saves never report success when nothing was saved (I3)', () => {
  it('an UPDATE that changed 0 rows: "Save failed", the form stays open, an error row, no reload', async () => {
    setUrl(`?tab=businesses&focus=business:${ID}`)
    await harness.settle(h(BusinessesTab))
    updateResult.current = { data: [], error: null }
    lastButton('Save')!.onClick!()
    const html = await harness.settle(h(BusinessesTab))
    expect(updates).toHaveLength(1)
    expect(updates[0].eq).toEqual(['id', ID])
    expect(updates[0].select).toBe('id')
    expect(html).toContain(`Save failed: ${BUSINESS_NOT_SAVED_MESSAGE}`)
    expect(editFormsOpen(html)).toEqual([ID])
    expect(metrics).toContainEqual({ event: 'business.admin.update.error' })
    expect(errors).toContain('admin.business.update')
    expect(listCalls.count).toBe(1)
  })

  it('an UPDATE that changed the row: the form closes and the list reloads', async () => {
    setUrl(`?tab=businesses&focus=business:${ID}`)
    await harness.settle(h(BusinessesTab))
    lastButton('Save')!.onClick!()
    const html = await harness.settle(h(BusinessesTab))
    expect(html).not.toContain('Save failed')
    expect(editFormsOpen(html)).toEqual([])
    expect(metrics).toContainEqual({ event: 'business.admin.update.complete' })
    expect(listCalls.count).toBe(2)
  })
})
