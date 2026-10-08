// apps/web/src/lib/org-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Organization READERS, each proven at the query it issues (mutation-proof, both directions): the
// public single-org and list readers gate to ACTIVE non-business rows, the admin list and detail
// readers keep the non-business guard but include INACTIVE orgs, linked resources keep curator order,
// and every read emits exactly one wide event. Admin writes live in admin_save_organization
// (org-admin-rpc.ts); there is no client-side org writer left to test here.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

// Recorder shared with the mocked logger (mirrors business-data.test.ts). One push per withMetric
// call === one wide event, so removing a withMetric wrap drops the sink count to 0 -> RED.
const { sinks } = vi.hoisted(() => ({
  sinks: [] as Array<{ level: 'info' | 'error'; event: string; attrs: Record<string, unknown> }>,
}))

vi.mock('./logger', () => ({
  withMetric: async (
    operation: string,
    attrs: Record<string, unknown>,
    fn: () => Promise<unknown>,
  ) => {
    try {
      const result = await fn()
      sinks.push({ level: 'info', event: `${operation}.complete`, attrs: { ...attrs } })
      return result
    } catch (err) {
      sinks.push({ level: 'error', event: `${operation}.error`, attrs: { ...attrs } })
      throw err
    }
  },
}))

import {
  fetchOrganizationById,
  fetchOrgResources,
  fetchApprovedOrganizations,
  fetchAdminOrgList,
  fetchAdminOrgDetail,
} from './org-data'
import { NON_BUSINESS_ORG_TYPES } from './org-vocab'

beforeEach(() => {
  sinks.length = 0
})

describe('vocabulary floor', () => {
  it('the non-business vocabulary never contains "business"', () => {
    expect(NON_BUSINESS_ORG_TYPES).not.toContain('business')
  })
})

// ---- recording read client for fetchOrganizationById (select -> eq -> in -> eq -> single) --------
function makeByIdClient(result: { data: unknown; error: { message: string } | null }) {
  const state = {
    table: '',
    selected: '',
    eqs: [] as Array<[string, unknown]>,
    inCol: '',
    inVals: [] as unknown[],
  }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: (cols: string) => {
      state.selected = cols
      return builder
    },
    eq: (col: string, val: unknown) => {
      state.eqs.push([col, val])
      return builder
    },
    in: (col: string, vals: readonly unknown[]) => {
      state.inCol = col
      state.inVals = [...vals]
      return builder
    },
    single: () => Promise.resolve(result),
  })
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

// ---- recording read client for fetchOrgResources (select -> eq -> order -> then) ----------------
function makeResourcesClient(result: { data: unknown; error: { message: string } | null }) {
  const state = { table: '', selected: '', eqCol: '', eqVal: undefined as unknown, orderCol: '' }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: (cols: string) => {
      state.selected = cols
      return builder
    },
    eq: (col: string, val: unknown) => {
      state.eqCol = col
      state.eqVal = val
      return builder
    },
    order: (col: string) => {
      state.orderCol = col
      return builder
    },
    then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
  })
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

const ORG_ROW = {
  id: 'org-42',
  name: 'Helping Hands',
  description: 'We help',
  org_type: 'pantry',
  address: '1 Main St',
  city: 'Burlington',
  state: 'Vermont',
  zip_code: '05401',
  phone: '802-555-0100',
  email: 'hi@example.org',
  website: 'https://example.org',
  location: null,
  resource_id: null,
  is_active: true,
}

describe('INV-F — fetchOrganizationById gates to active non-business rows (business id 404s)', () => {
  it('filters org_type to the nine non-business types (business EXCLUDED) and requires is_active=true', async () => {
    const client = makeByIdClient({ data: ORG_ROW, error: null })
    const org = await fetchOrganizationById(client, 'org-42')

    expect(org?.id).toBe('org-42')
    expect(client.state.table).toBe('organizations')
    // The org_type filter is EXACTLY the non-business vocabulary — never 'business'. Removing this
    // .in() filter (so a business id could resolve) turns this assertion RED.
    expect(client.state.inCol).toBe('org_type')
    expect(client.state.inVals).toEqual([...NON_BUSINESS_ORG_TYPES])
    expect(client.state.inVals).not.toContain('business')
    // Active gate + id filter both applied.
    expect(client.state.eqs).toContainEqual(['is_active', true])
    expect(client.state.eqs).toContainEqual(['id', 'org-42'])
    // Explicit columns for the anon read path — the contact fields are projected, never a bare '*'.
    expect(client.state.selected).not.toContain('*')
    expect(client.state.selected).toContain('email')
    expect(client.state.selected).toContain('phone')
    expect(client.state.selected).toContain('website')
    // Exactly one wide event on success.
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'org.read.by_id.complete' })
  })

  it('returns null when the row is filtered out (a business / inactive / missing id) so the caller notFound()s', async () => {
    // A business-typed id never satisfies the non-business .in() filter at the DB, so PostgREST
    // .single() returns no row — modeled here as {data:null,error}. The reader must return null.
    const client = makeByIdClient({ data: null, error: { message: 'PGRST116: 0 rows' } })
    const org = await fetchOrganizationById(client, 'business-id')
    expect(org).toBeNull()
  })
})

// ---- recording read client for fetchApprovedOrganizations (select -> in -> eq -> order -> then) ----
function makeListClient(result: { data: unknown; error: { message: string } | null }) {
  const state = {
    table: '',
    selected: '',
    inCol: '',
    inVals: [] as unknown[],
    eqs: [] as Array<[string, unknown]>,
    orderCol: '',
  }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: (cols: string) => {
      state.selected = cols
      return builder
    },
    in: (col: string, vals: readonly unknown[]) => {
      state.inCol = col
      state.inVals = [...vals]
      return builder
    },
    eq: (col: string, val: unknown) => {
      state.eqs.push([col, val])
      return builder
    },
    order: (col: string) => {
      state.orderCol = col
      return builder
    },
    then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
  })
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

describe('INV-J — Organizations subtab lists ONLY active non-business orgs (disjoint from Businesses)', () => {
  it('filters org_type to the nine non-business types (business EXCLUDED) and requires is_active=true', async () => {
    // Two non-business rows returned; the reader passes them through in name order.
    const client = makeListClient({
      data: [
        { ...ORG_ROW, id: 'org-1', name: 'Alpha Pantry', org_type: 'pantry' },
        { ...ORG_ROW, id: 'org-2', name: 'Beta Shelter', org_type: 'shelter' },
      ],
      error: null,
    })
    const rows = await fetchApprovedOrganizations(client)

    expect(client.state.table).toBe('organizations')
    // The disjointness guard: the org_type filter is EXACTLY the non-business vocabulary and NEVER
    // 'business'. Removing this .in() filter (so a business row could enter the org list) — or adding
    // 'business' to NON_BUSINESS_ORG_TYPES — turns these assertions RED. This is INV-J both directions:
    // orgs never carry a business, and (via the shared vocab) businesses never carry a non-business.
    expect(client.state.inCol).toBe('org_type')
    expect(client.state.inVals).toEqual([...NON_BUSINESS_ORG_TYPES])
    expect(client.state.inVals).not.toContain('business')
    // Active gate applied; ordered by name; explicit columns (never a bare '*').
    expect(client.state.eqs).toContainEqual(['is_active', true])
    expect(client.state.orderCol).toBe('name')
    expect(client.state.selected).not.toContain('*')
    expect(rows.map((r) => r.id)).toEqual(['org-1', 'org-2'])
    // Exactly one wide event on success, count reflecting the returned rows.
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({
      level: 'info',
      event: 'organization.list.fetch.complete',
      attrs: { result_count: 2 },
    })
  })

  it('an empty directory renders no rows (empty state, never a dangling section)', async () => {
    const client = makeListClient({ data: [], error: null })
    expect(await fetchApprovedOrganizations(client)).toEqual([])
  })
})

describe('INV-1 — admin Organizations roster lists ONLY non-business orgs (business EXCLUDED)', () => {
  it('filters org_type to the nine non-business types and NEVER gates is_active (admin sees inactive)', async () => {
    const client = makeListClient({
      data: [
        { id: 'org-1', name: 'Alpha Pantry', org_type: 'pantry', city: 'Rutland', state: 'VT', is_active: true },
        { id: 'org-2', name: 'Beta Shelter', org_type: 'shelter', city: null, state: null, is_active: false },
      ],
      error: null,
    })
    const rows = await fetchAdminOrgList(client)

    expect(client.state.table).toBe('organizations')
    // INV-1 mutation guard (forward): the org_type filter is EXACTLY the non-business vocabulary and
    // NEVER 'business'. Deleting this .in() filter from fetchAdminOrgList (so a business row could
    // enter the Organizations tab) — or adding 'business' to NON_BUSINESS_ORG_TYPES — turns these RED.
    expect(client.state.inCol).toBe('org_type')
    expect(client.state.inVals).toEqual([...NON_BUSINESS_ORG_TYPES])
    expect(client.state.inVals).not.toContain('business')
    // The admin roster does NOT filter is_active (an admin manages inactive orgs too) — distinct from
    // the public fetchApprovedOrganizations which DOES gate is_active=true. Adding an is_active eq here
    // would hide inactive orgs from the admin and turns this RED.
    expect(client.state.eqs).not.toContainEqual(['is_active', true])
    expect(client.state.orderCol).toBe('name')
    expect(client.state.selected).not.toContain('*')
    expect(rows.map((r) => r.id)).toEqual(['org-1', 'org-2'])
    // Exactly one wide event on success (removing the withMetric wrap drops the sink count -> RED).
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({
      level: 'info',
      event: 'organization.roster.fetch.complete',
      attrs: { result_count: 2 },
    })
  })

  it('surfaces a load failure as a throw (never a silent empty roster masking an error)', async () => {
    const client = makeListClient({ data: null, error: { message: 'boom' } })
    await expect(fetchAdminOrgList(client)).rejects.toThrow('boom')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'organization.roster.fetch.error' })
  })
})

describe('INV-H — fetchOrgResources lists linked resources, ordered, with null embeds dropped', () => {
  it('unwraps the embed, drops RLS-hidden (null) rows, and preserves curator sort_order', async () => {
    const client = makeResourcesClient({
      data: [
        { sort_order: 0, resource: { id: 'r1', name: 'Food box', category: 'food', description: null, address_line1: null, city: null, state: null, phone: null, website: null, service_mode: 'physical', status: 'approved' } },
        { sort_order: 1, resource: null }, // RLS hid this linked resource — must be dropped, not dangling
        { sort_order: 2, resource: { id: 'r2', name: 'Clinic', category: 'healthcare', description: null, address_line1: null, city: null, state: null, phone: null, website: null, service_mode: 'physical', status: 'approved' } },
      ],
      error: null,
    })
    const rows = await fetchOrgResources(client, 'org-42')

    expect(client.state.table).toBe('org_resources')
    expect(client.state.eqCol).toBe('org_id')
    expect(client.state.eqVal).toBe('org-42')
    expect(client.state.orderCol).toBe('sort_order')
    // The null embed is dropped (INV-H — no dangling entry); the two real resources survive in order.
    expect(rows.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'org.resources.fetch.complete', attrs: { result_count: 2 } })
  })

  it('I4: a pending or rejected linked resource is not returned (an admin sees what members see)', async () => {
    // resources_admin_select lets an admin read non-approved resources through the embed; the public
    // org page must still list only approved ones, like /s/resource/[id] (status='approved').
    const res = (id: string, status: string) => ({ id, name: id, category: 'food', description: null, address_line1: null, city: null, state: null, phone: null, website: null, service_mode: 'physical', status })
    const client = makeResourcesClient({
      data: [
        { sort_order: 0, resource: res('r1', 'approved') },
        { sort_order: 1, resource: res('r2', 'pending') },
        { sort_order: 2, resource: res('r3', 'rejected') },
        { sort_order: 3, resource: null },
        { sort_order: 4, resource: res('r4', 'approved') },
      ],
      error: null,
    })
    const rows = await fetchOrgResources(client, 'org-42')
    expect(rows.map((r) => r.id)).toEqual(['r1', 'r4'])
    expect(sinks[sinks.length - 1]).toMatchObject({ event: 'org.resources.fetch.complete', attrs: { result_count: 2 } })
  })

  it('an org with no links renders no rows (empty state, never a dangling section)', async () => {
    const client = makeResourcesClient({ data: [], error: null })
    expect(await fetchOrgResources(client, 'org-42')).toEqual([])
  })
})

// ---- admin detail reader: one client routing per table ------------------------------------------
function makeDetailClient(results: Record<string, { data: unknown; error: { message: string } | null }>) {
  const seen: Array<{ table: string; eqs: Array<[string, unknown]>; inVals: unknown[] }> = []
  const client = {
    seen,
    from(table: string) {
      const rec = { table, eqs: [] as Array<[string, unknown]>, inVals: [] as unknown[] }
      seen.push(rec)
      const result = results[table]
      const builder: Record<string, unknown> = {}
      Object.assign(builder, {
        select: () => builder,
        eq: (c: string, v: unknown) => {
          rec.eqs.push([c, v])
          return builder
        },
        in: (_c: string, v: readonly unknown[]) => {
          rec.inVals = [...v]
          return builder
        },
        order: () => builder,
        single: () => Promise.resolve(result),
        then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
      })
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { seen: typeof seen }
}

// EWKB hex for POINT(-72.97 43.61), SRID 4326 (little endian).
function ewkb(lng: number, lat: number): string {
  const buf = new ArrayBuffer(25)
  const v = new DataView(buf)
  v.setUint8(0, 1)
  v.setUint32(1, 0x20000001, true)
  v.setUint32(5, 4326, true)
  v.setFloat64(9, lng, true)
  v.setFloat64(17, lat, true)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('fetchAdminOrgDetail — edit prefill includes INACTIVE orgs, children, parsed location', () => {
  it('reads the org without an is_active gate, plus hours (trimmed, ordered), photos and links', async () => {
    const client = makeDetailClient({
      organizations: { data: { ...ORG_ROW, is_active: false, location: ewkb(-72.97, 43.61) }, error: null },
      business_hours: {
        data: [
          { day_of_week: 2, open_time: '13:00:00', close_time: '17:00:00' },
          { day_of_week: 1, open_time: '09:00:00', close_time: '17:00:00' },
          { day_of_week: 2, open_time: '09:00:00', close_time: '12:00:00' },
        ],
        error: null,
      },
      business_photos: { data: [{ kind: 'logo', url: 'u', storage_path: 'org-42/a.webp', sort_order: 0, caption: null }], error: null },
      org_resources: {
        data: [{ sort_order: 0, resource: { id: 'r1', name: 'Pantry', category: 'food', city: 'Rutland', state: 'VT' } }, { sort_order: 1, resource: null }],
        error: null,
      },
    })
    const d = await fetchAdminOrgDetail(client, 'org-42')
    expect(d).not.toBeNull()
    expect(d!.is_active).toBe(false)
    expect(d!.location!.lng).toBeCloseTo(-72.97)
    expect(d!.location!.lat).toBeCloseTo(43.61)
    expect(d!.hours).toEqual([
      { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
      { day_of_week: 2, open_time: '09:00', close_time: '12:00' },
      { day_of_week: 2, open_time: '13:00', close_time: '17:00' },
    ])
    expect(d!.photos).toHaveLength(1)
    expect(d!.resources.map((r) => r.id)).toEqual(['r1'])
    const orgQuery = client.seen.find((q) => q.table === 'organizations')!
    expect(orgQuery.eqs).not.toContainEqual(['is_active', true])
    expect(orgQuery.inVals).toEqual([...NON_BUSINESS_ORG_TYPES])
  })

  it('a missing (or business) id resolves to null', async () => {
    const client = makeDetailClient({ organizations: { data: null, error: { message: 'no rows' } } })
    expect(await fetchAdminOrgDetail(client, 'nope')).toBeNull()
  })
})
