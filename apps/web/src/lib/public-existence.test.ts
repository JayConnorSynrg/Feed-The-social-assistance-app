// apps/web/src/lib/public-existence.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// isPublicBusiness / isPublicOrganization answer "is this id public?" for callers that need nothing
// else about the item (the share-preview image routes). They must agree with the full readers the
// public pages use — fetchApprovedBusinessById / fetchOrganizationById — in every state, while reading
// the id column only. Both pairs run one shared query, so the rule cannot be changed for one and not
// the other; these tests fail if the two ever ask the database different questions.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

vi.mock('@/lib/logger', () => ({
  logEvent: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: async (_operation: string, _attrs: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { fetchApprovedBusinessById, isPublicBusiness } from './business-data'
import { fetchOrganizationById, isPublicOrganization } from './org-data'
import { filteringDb, type FakeRow } from './__tests__/filtering-db'

const ID = '11111111-1111-4111-8111-111111111111'
const db = filteringDb()
const client = db.client as unknown as SupabaseClient<Database>

const business: FakeRow = { id: ID, org_type: 'business', status: 'approved', is_active: true, name: 'Corner Cafe', description: 'Coffee', phone: '555-0100' }
const organization: FakeRow = { id: ID, org_type: 'food_bank', status: 'approved', is_active: true, name: 'Food Shelf', description: 'Pantry', phone: '555-0101' }

beforeEach(() => db.reset())

type Case = { state: string; rows: FakeRow[]; isPublic: boolean }

const BUSINESS_STATES: Case[] = [
  { state: 'approved and active', rows: [business], isPublic: true },
  { state: 'pending', rows: [{ ...business, status: 'pending' }], isPublic: false },
  { state: 'rejected', rows: [{ ...business, status: 'rejected' }], isPublic: false },
  { state: 'approved but inactive', rows: [{ ...business, is_active: false }], isPublic: false },
  { state: 'an organization (not a business)', rows: [organization], isPublic: false },
  { state: 'another id', rows: [{ ...business, id: '22222222-2222-4222-8222-222222222222' }], isPublic: false },
  { state: 'no such row', rows: [], isPublic: false },
]

const ORGANIZATION_STATES: Case[] = [
  { state: 'active, non-business type', rows: [organization], isPublic: true },
  { state: 'active, another non-business type', rows: [{ ...organization, org_type: 'mutual_aid' }], isPublic: true },
  { state: 'active, a type outside the vocabulary', rows: [{ ...organization, org_type: 'community_center' }], isPublic: false },
  { state: 'inactive', rows: [{ ...organization, is_active: false }], isPublic: false },
  { state: 'a business (approved and active)', rows: [business], isPublic: false },
  { state: 'another id', rows: [{ ...organization, id: '22222222-2222-4222-8222-222222222222' }], isPublic: false },
  { state: 'no such row', rows: [], isPublic: false },
]

describe('isPublicBusiness agrees with fetchApprovedBusinessById and reads the id only', () => {
  it.each(BUSINESS_STATES)('$state → public: $isPublic', async ({ rows, isPublic }) => {
    db.tables = { organizations: rows }
    const full = await fetchApprovedBusinessById(client, ID)
    const exists = await isPublicBusiness(client, ID)

    expect(full !== null).toBe(isPublic)
    expect(exists).toBe(isPublic)

    const [fullRead, idRead] = db.reads
    expect(db.reads).toHaveLength(2)
    expect(idRead.table).toBe('organizations')
    expect(idRead.columns).toBe('id')
    expect(fullRead.columns.split(',').length).toBeGreaterThan(10) // control: the page reader is the wide one
    // the same question, column list aside
    expect(idRead.filters).toEqual(fullRead.filters)
    expect(idRead.filters).toEqual([
      { op: 'eq', column: 'id', value: ID },
      { op: 'eq', column: 'org_type', value: 'business' },
      { op: 'eq', column: 'status', value: 'approved' },
      { op: 'eq', column: 'is_active', value: true },
    ])
  })

  it('a failed read is "not public" for both', async () => {
    const failing = { from: () => ({ select: () => failing.q }), q: {} as Record<string, unknown> }
    Object.assign(failing.q, { eq: () => failing.q, single: async () => ({ data: null, error: { message: 'permission denied' } }) })
    const c = failing as unknown as SupabaseClient<Database>
    expect(await fetchApprovedBusinessById(c, ID)).toBeNull()
    expect(await isPublicBusiness(c, ID)).toBe(false)
  })
})

describe('isPublicOrganization agrees with fetchOrganizationById and reads the id only', () => {
  it.each(ORGANIZATION_STATES)('$state → public: $isPublic', async ({ rows, isPublic }) => {
    db.tables = { organizations: rows }
    const full = await fetchOrganizationById(client, ID)
    const exists = await isPublicOrganization(client, ID)

    expect(full !== null).toBe(isPublic)
    expect(exists).toBe(isPublic)

    const [fullRead, idRead] = db.reads
    expect(db.reads).toHaveLength(2)
    expect(idRead.table).toBe('organizations')
    expect(idRead.columns).toBe('id')
    expect(fullRead.columns.split(',').length).toBeGreaterThan(10)
    expect(idRead.filters).toEqual(fullRead.filters)
    expect(idRead.filters.map((f) => `${f.op} ${f.column}`)).toEqual(['eq id', 'in org_type', 'eq is_active'])
    expect(idRead.filters[1].value).not.toContain('business')
  })

  it('a failed read is "not public" for both', async () => {
    const failing = { from: () => ({ select: () => failing.q }), q: {} as Record<string, unknown> }
    Object.assign(failing.q, { eq: () => failing.q, in: () => failing.q, single: async () => ({ data: null, error: { message: 'permission denied' } }) })
    const c = failing as unknown as SupabaseClient<Database>
    expect(await fetchOrganizationById(c, ID)).toBeNull()
    expect(await isPublicOrganization(c, ID)).toBe(false)
  })
})
