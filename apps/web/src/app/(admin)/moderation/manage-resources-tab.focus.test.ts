// apps/web/src/app/(admin)/moderation/manage-resources-tab.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 wiring — the REAL ManageResourcesTab (with the real useAdminFocusSession from use-admin-focus.ts,
// the contract shared with PR-5b), driven through mount → effects → re-render by the SSR hook harness,
// the Supabase client faked:
//   - /moderation?tab=manage&focus=resource:<id> reads that resource BY ID (approved only) and opens
//     it in the edit dialog — not the list — even though it is not on the list's first page;
//   - the tab writes only found / not_found / abandoned, exactly one admin.deeplink.resolve row each;
//     not_found shows a plain notice with the list still loaded; a malformed focus is left to the
//     shell's gate (useAdminFocusGate writes invalid), so the tab writes nothing for it;
//   - the focus param is stripped (replaceState), the rest of the URL kept;
//   - I3: without a focus param the list loads exactly as before and no resolve row is written.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  return reactWithHarness(await importOriginal<typeof import('react')>())
})

const { events, rpcCalls, reads, dialogProps, readResult } = vi.hoisted(() => ({
  events: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  reads: [] as Array<{ table: string; columns: string; eq: Array<[string, unknown]>; signal: boolean }>,
  dialogProps: [] as Array<Record<string, unknown>>,
  readResult: { current: null as null | (() => Promise<{ data: unknown; error: unknown }>) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => events.push({ name, attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

const LIST_ROW = {
  id: '99999999-9999-4999-8999-999999999999',
  name: 'Aardvark Pantry (page 1)',
  description: null,
  category: 'food',
  address_line1: null,
  city: 'Rutland',
  state: 'VT',
  zip_code: null,
  phone: null,
  email: null,
  website: null,
  status: 'approved',
  source: null,
  is_verified: null,
  moderated_at: null,
  lat: null,
  lng: null,
  service_mode: 'physical',
  geocode_accuracy: null,
}

vi.mock('@/lib/supabase/client', () => {
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: [LIST_ROW], error: null })
    },
    from: (table: string) => ({
      select: (columns: string) => {
        const rec = { table, columns, eq: [] as Array<[string, unknown]>, signal: false }
        reads.push(rec)
        let signal: AbortSignal | null = null
        const q = {
          abortSignal: (s: AbortSignal) => {
            rec.signal = s instanceof AbortSignal
            signal = s
            return q
          },
          eq: (c: string, v: unknown) => {
            rec.eq.push([c, v])
            return q
          },
          // Like postgrest-js 2.106.2 (dist/index.cjs:293-330): an aborted request RESOLVES with
          // data null and an AbortError-shaped error; it does not reject.
          maybeSingle: () => {
            const aborted = new Promise<{ data: unknown; error: unknown }>((resolve) => {
              const settle = () =>
                resolve({
                  data: null,
                  error: { message: 'AbortError: This operation was aborted', details: '', hint: 'Request was aborted (timeout or manual cancellation)', code: '' },
                })
              if (signal?.aborted) settle()
              else signal?.addEventListener('abort', settle)
            })
            return Promise.race([readResult.current!(), aborted])
          },
        }
        return q
      },
    }),
  }
  return { createClient: () => client }
})
vi.mock('@/components/map/map-view', () => ({ MapView: () => null }))
vi.mock('@/components/map/resource-marker', () => ({ ResourceMarker: () => null }))
vi.mock('@/components/admin/member-view-link', () => ({ MemberViewLink: () => null }))
vi.mock('./resource-edit-dialog', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return {
    ResourceEditDialog: (props: { open: boolean; resource: { id: string } | null }) => {
      dialogProps.push(props as unknown as Record<string, unknown>)
      return createElement('div', { 'data-dialog-open': String(props.open), 'data-resource-id': props.resource?.id ?? '' })
    },
  }
})

import { harness } from '@/test-utils/ssr-hook-harness'
import { ManageResourcesTab } from './manage-resources-tab'

const ID = '11111111-1111-4111-8111-111111111111'

/** EWKB hex for SRID 4326 POINT(lng lat), the form PostgREST returns a geography in. */
function ewkb(lng: number, lat: number): string {
  const b = Buffer.alloc(25)
  b.writeUInt8(1, 0)
  b.writeUInt32LE(0x20000001, 1)
  b.writeUInt32LE(4326, 5)
  b.writeDoubleLE(lng, 9)
  b.writeDoubleLE(lat, 17)
  return b.toString('hex')
}

const FOCUS_ROW = {
  id: ID,
  name: 'Riverside Pantry',
  description: 'Weekly groceries',
  category: 'food',
  address_line1: '1 Main St',
  city: 'Burlington',
  state: 'VT',
  zip_code: '05401',
  phone: null,
  email: 'pantry@example.org',
  website: null,
  status: 'approved',
  source: 'manual',
  is_verified: true,
  moderated_at: null,
  location: ewkb(-73.21, 44.48),
  service_mode: 'physical',
  geocode_accuracy: 'rooftop',
}

const replaceState = vi.fn()
function setUrl(search: string) {
  const location = { pathname: '/moderation', search, hash: '' }
  replaceState.mockImplementation((_s: unknown, _u: string, url: string) => {
    const q = url.indexOf('?')
    location.search = q < 0 ? '' : url.slice(q)
  })
  ;(globalThis as unknown as { window: unknown }).window = { location, history: { state: null, replaceState } }
}

const resolveRows = () => events.filter((e) => e.name === 'admin.deeplink.resolve').map((e) => e.attrs)
const resourceReads = () => reads.filter((r) => r.table === 'resources')
type CloseFocus = (event: { preventDefault: () => void }) => void
const lastDialog = () => dialogProps[dialogProps.length - 1] as { open: boolean; resource: Record<string, unknown> | null }

beforeEach(() => {
  harness.reset()
  events.length = 0
  rpcCalls.length = 0
  reads.length = 0
  dialogProps.length = 0
  replaceState.mockReset()
  readResult.current = async () => ({ data: FOCUS_ROW, error: null })
})

function fakeDoc(present: Record<string, { focus: () => void }>) {
  ;(globalThis as unknown as { document: unknown }).document = { querySelector: (sel: string) => present[sel] ?? null }
}

describe('ManageResourcesTab — "Edit in admin" landing', () => {
  it('found: reads the resource by id (approved only) and opens THAT resource in the edit dialog', async () => {
    setUrl(`?tab=manage&focus=resource:${ID}`)
    const html = await harness.settle(h(ManageResourcesTab))

    expect(resourceReads()).toHaveLength(1)
    expect(resourceReads()[0].eq).toEqual([
      ['id', ID],
      ['status', 'approved'],
    ])
    expect(resourceReads()[0].columns).toContain('location')
    expect(resourceReads()[0].signal).toBe(true)

    // The dialog is open on the linked resource, not on a list row; the location became lat/lng.
    expect(html).toContain(`data-dialog-open="true" data-resource-id="${ID}"`)
    expect(lastDialog().resource).toMatchObject({ id: ID, name: 'Riverside Pantry', email: 'pantry@example.org', status: 'approved' })
    expect(lastDialog().resource?.lat).toBeCloseTo(44.48)
    expect(lastDialog().resource?.lng).toBeCloseTo(-73.21)

    expect(resolveRows()).toEqual([{ kind: 'resource', outcome: 'found', tab: 'manage' }])
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState.mock.calls[0][2]).toBe('/moderation?tab=manage')
    // Each listed row's Edit button carries its resource id (where focus returns after an edit).
    expect(html).toContain(`data-resource-edit="${LIST_ROW.id}"`)
    // The list itself still loaded, page 1, unchanged.
    expect(rpcCalls.filter((c) => c.fn === 'admin_list_resources')).toHaveLength(1)
    expect(html).toContain('Aardvark Pantry (page 1)')
  })

  it('closing a link-opened dialog keeps focus in the tab: its row Edit button when listed, else the Manage tab trigger', async () => {
    setUrl(`?tab=manage&focus=resource:${ID}`)
    await harness.settle(h(ManageResourcesTab))
    const onCloseAutoFocus = (lastDialog() as unknown as { onCloseAutoFocus?: CloseFocus }).onCloseAutoFocus
    expect(typeof onCloseAutoFocus).toBe('function')

    const tabTrigger = { focus: vi.fn() }
    const rowEdit = { focus: vi.fn() }
    // The linked resource is not on page 1: no row button -> the active tab trigger, never <body>.
    fakeDoc({ '[role="tab"][aria-selected="true"]': tabTrigger })
    const event = { preventDefault: vi.fn() }
    onCloseAutoFocus!(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(tabTrigger.focus).toHaveBeenCalledTimes(1)
    // Listed: its row's Edit button.
    fakeDoc({ [`[data-resource-edit="${ID}"]`]: rowEdit, '[role="tab"][aria-selected="true"]': tabTrigger })
    onCloseAutoFocus!({ preventDefault: vi.fn() })
    expect(rowEdit.focus).toHaveBeenCalledTimes(1)
    expect(tabTrigger.focus).toHaveBeenCalledTimes(1)
  })

  it('not_found (missing, pending or rejected): one row, a plain notice, dialog closed, list usable', async () => {
    readResult.current = async () => ({ data: null, error: null })
    setUrl(`?tab=manage&focus=resource:${ID}`)
    const html = await harness.settle(h(ManageResourcesTab))
    expect(resolveRows()).toEqual([{ kind: 'resource', outcome: 'not_found', tab: 'manage' }])
    expect(html).toMatch(/<p role="status" class="flex-1">That resource couldn&#x27;t be found, or it isn&#x27;t editable here/)
    expect(html).toContain('data-dialog-open="false"')
    expect(html).toContain('Aardvark Pantry (page 1)')
    expect(replaceState.mock.calls[0][2]).toBe('/moderation?tab=manage')
  })

  it('a malformed focus is the shell gate\'s (invalid): the tab reads nothing and writes no row', async () => {
    for (const focus of ['resource:12345', `business:${ID}`]) {
      harness.reset()
      setUrl(`?tab=manage&focus=${focus}`)
      const html = await harness.settle(h(ManageResourcesTab))
      expect(html).toContain('<p role="status" class="sr-only"></p>')
    }
    expect(resolveRows()).toEqual([])
    expect(resourceReads()).toHaveLength(0)
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('abandoned: the tab unmounts before the read returns -> one abandoned row (the aborted read answers nothing)', async () => {
    let resolveRead!: (v: { data: unknown; error: unknown }) => void
    readResult.current = () => new Promise((r) => (resolveRead = r))
    setUrl(`?tab=manage&focus=resource:${ID}`)
    // Pass 1 claims the focus; pass 2 starts the by-id read; the tab unmounts while it is in flight.
    await harness.render(h(ManageResourcesTab))
    await harness.render(h(ManageResourcesTab))
    expect(resourceReads()).toHaveLength(1)
    harness.unmount()
    await new Promise((r) => setTimeout(r, 0))
    resolveRead({ data: FOCUS_ROW, error: null })
    await new Promise((r) => setTimeout(r, 0))
    expect(resolveRows()).toEqual([{ kind: 'resource', outcome: 'abandoned', tab: 'manage' }])
    // The late answer set nothing: rendering the kept state again still shows the dialog closed.
    const html = await harness.render(h(ManageResourcesTab))
    expect(html).toContain('data-dialog-open="false"')
    expect(dialogProps.every((p) => p.open === false)).toBe(true)
  })

  it('I3 — no focus param: the list loads as before, no by-id read, no resolve row, URL untouched', async () => {
    setUrl('?tab=manage')
    const html = await harness.settle(h(ManageResourcesTab))
    expect(rpcCalls).toEqual([
      {
        fn: 'admin_list_resources',
        args: { p_state: undefined, p_city: undefined, p_search: undefined, p_status: 'approved', p_limit: 100, p_offset: 0 },
      },
    ])
    expect(resourceReads()).toHaveLength(0)
    expect(resolveRows()).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
    // The notice's live region is mounted (empty) before any notice, so a later one is announced.
    expect(html).toContain('<p role="status" class="sr-only"></p>')
    expect(html).toContain('data-dialog-open="false"')
    expect(html).toContain('Aardvark Pantry (page 1)')
  })
})
