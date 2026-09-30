// apps/web/src/lib/org-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Proves the two admin-org-create invariants at the pure boundary where they live, so each test FAILS
// if the invariant is broken (mutation-proof, both directions):
//
//   INV-B (never business): buildOrgInsertPayload throws for org_type='business' or any value outside
//     org-vocab, and pins is_active=true for a valid non-business type — so no admin code path can
//     persist a business row. Break-on-purpose: delete the isNonBusinessOrgType guard in
//     buildOrgInsertPayload → the 'business' and 'unknown' cases stop throwing → RED.
//
//   INV-D (one row per linked resource): buildOrgResourceRows emits exactly one row per DISTINCT
//     resource id, sequential sort_order, org_id stamped. Break-on-purpose: drop the `seen` dedupe (or
//     emit two rows per id) → the duplicate/count assertions go RED.
//
// Also asserts INV-B at the vocabulary floor: 'business' is not a member of NON_BUSINESS_ORG_TYPES, so
// the admin Select (which renders exactly these) can never offer it.

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
  buildOrgInsertPayload,
  buildOrgResourceRows,
  OrgWriteError,
  fetchOrganizationById,
  fetchOrgResources,
} from './org-data'
import { NON_BUSINESS_ORG_TYPES } from './org-vocab'

beforeEach(() => {
  sinks.length = 0
})

describe('INV-B — admin org create is non-business only', () => {
  it('refuses org_type="business" (throws, nothing to insert)', () => {
    expect(() =>
      buildOrgInsertPayload({ name: 'X', org_type: 'business', createdBy: null }),
    ).toThrow(OrgWriteError)
  })

  it('refuses an org_type outside the vocabulary', () => {
    expect(() =>
      buildOrgInsertPayload({ name: 'X', org_type: 'club', createdBy: null }),
    ).toThrow(OrgWriteError)
  })

  it('the Select vocabulary never contains "business"', () => {
    expect((NON_BUSINESS_ORG_TYPES as readonly string[])).not.toContain('business')
  })

  it('accepts every non-business type and pins is_active=true for public visibility (INV-A)', () => {
    for (const t of NON_BUSINESS_ORG_TYPES) {
      const row = buildOrgInsertPayload({ name: '  Helping Hands  ', org_type: t, createdBy: 'u1' })
      expect(row.org_type).toBe(t)
      expect(row.is_active).toBe(true)
      expect(row.name).toBe('Helping Hands') // trimmed
      expect(row.created_by).toBe('u1')
    }
  })
})

describe('INV-D — one org_resources row per distinct linked resource', () => {
  it('emits exactly one row per id with sequential sort_order and the org id stamped', () => {
    const rows = buildOrgResourceRows('org-1', ['a', 'b', 'c'])
    expect(rows).toEqual([
      { org_id: 'org-1', resource_id: 'a', sort_order: 0 },
      { org_id: 'org-1', resource_id: 'b', sort_order: 1 },
      { org_id: 'org-1', resource_id: 'c', sort_order: 2 },
    ])
  })

  it('drops duplicates so a repeated id never produces two rows (PK backstop)', () => {
    const rows = buildOrgResourceRows('org-1', ['a', 'a', 'b'])
    expect(rows.map((r) => r.resource_id)).toEqual(['a', 'b'])
    expect(rows).toHaveLength(2)
  })

  it('an empty selection produces no rows', () => {
    expect(buildOrgResourceRows('org-1', [])).toEqual([])
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

  it('an org with no links renders no rows (empty state, never a dangling section)', async () => {
    const client = makeResourcesClient({ data: [], error: null })
    expect(await fetchOrgResources(client, 'org-42')).toEqual([])
  })
})
