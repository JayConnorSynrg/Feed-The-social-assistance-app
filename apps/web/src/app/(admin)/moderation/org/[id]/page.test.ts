// apps/web/src/app/(admin)/moderation/org/[id]/page.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Route gate of the organization admin page. The Supabase server client is mocked at the module
// boundary with a faithful can_admin_org: true only for ids in `allowed` (the SQL function returns
// false for a non-UUID, an unknown id, a business org and a refused caller). A malformed id, a
// missing org and a refused caller must all get the same notFound() and read no organization row;
// an allowed caller gets the org admin shell for exactly that org. One wide event per load.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const MISSING = '33333333-3333-4333-8333-333333333333'

const state = vi.hoisted(() => ({
  allowed: new Set<string>(),
  isPlatformAdmin: false,
  rpcError: null as null | { message: string; code: string },
  orgs: {} as Record<string, Record<string, unknown>>,
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
  orgReads: [] as string[],
  metrics: [] as Array<{ op: string; attrs: Record<string, unknown>; ok: boolean }>,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>) => {
    try {
      const r = await fn()
      state.metrics.push({ op, attrs: { ...attrs }, ok: true })
      return r
    } catch (e) {
      state.metrics.push({ op, attrs: { ...attrs }, ok: false })
      throw e
    }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (name: string, args: { p_org_id?: string }) => {
      state.rpcCalls.push({ name, args })
      if (name === 'can_admin_org') {
        if (state.rpcError) return { data: null, error: state.rpcError }
        return { data: state.allowed.has(String(args.p_org_id)), error: null }
      }
      if (name === 'is_current_user_admin') return { data: state.isPlatformAdmin, error: null }
      return { data: null, error: { message: `unexpected rpc ${name}`, code: 'X' } }
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            state.orgReads.push(`${table}:${id}`)
            return { data: state.orgs[id] ?? null, error: null }
          },
        }),
      }),
    }),
  }),
}))

vi.mock('./org-admin-shell', () => ({
  OrgAdminShell: function OrgAdminShell() {
    return null
  },
}))

import OrgAdminPage from './page'
import { OrgAdminShell } from './org-admin-shell'

const load = (id: string) => OrgAdminPage({ params: Promise.resolve({ id }) })

async function notFoundMessage(id: string): Promise<string> {
  try {
    await load(id)
  } catch (e) {
    return (e as Error).message
  }
  throw new Error(`expected notFound for ${id}`)
}

beforeEach(() => {
  state.allowed = new Set()
  state.isPlatformAdmin = false
  state.rpcError = null
  state.orgs = {
    [ORG_A]: { id: ORG_A, name: 'Rutland Food Shelf', org_type: 'food_bank', is_active: true, city: 'Rutland', state: 'VT' },
    [ORG_B]: { id: ORG_B, name: 'Other Org', org_type: 'community', is_active: true, city: null, state: null },
  }
  state.rpcCalls = []
  state.orgReads = []
  state.metrics = []
})

describe('/moderation/org/[id] access', () => {
  it('malformed id → notFound, no organization read, one not_found load event', async () => {
    expect(await notFoundMessage('not-a-uuid')).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(state.orgReads).toEqual([])
    expect(state.metrics).toEqual([
      { op: 'admin.org_page.load', attrs: { outcome: 'not_found', org_id: null, reason: 'malformed_id' }, ok: true },
    ])
  })

  it('unknown org id → notFound and no organization read', async () => {
    expect(await notFoundMessage(MISSING)).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(state.orgReads).toEqual([])
  })

  it('a refused caller (admin of another org) → notFound and no read of the org', async () => {
    state.allowed = new Set([ORG_B])
    expect(await notFoundMessage(ORG_A)).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(state.orgReads).toEqual([])
    expect(state.metrics[0].attrs).toEqual({ outcome: 'not_found', org_id: null, reason: 'denied' })
  })

  it('malformed, missing and refused are indistinguishable to the caller', async () => {
    state.allowed = new Set([ORG_B])
    const responses = await Promise.all(['zzz', MISSING, ORG_A].map(notFoundMessage))
    expect(new Set(responses).size).toBe(1)
  })

  it('an org admin of this org gets the org admin shell for exactly this org, read-only roster', async () => {
    state.allowed = new Set([ORG_A])
    const el = (await load(ORG_A)) as { type: unknown; props: { org: { id: string; name: string }; isPlatformAdmin: boolean } }
    expect(el.type).toBe(OrgAdminShell)
    expect(el.props.org).toMatchObject({ id: ORG_A, name: 'Rutland Food Shelf' })
    expect(el.props.isPlatformAdmin).toBe(false)
    expect(state.orgReads).toEqual([`organizations:${ORG_A}`])
    expect(state.rpcCalls[0]).toEqual({ name: 'can_admin_org', args: { p_org_id: ORG_A } })
    expect(state.metrics).toEqual([
      { op: 'admin.org_page.load', attrs: { outcome: 'ok', org_id: ORG_A, reason: null }, ok: true },
    ])
  })

  it('a platform admin gets the shell with roster writes enabled', async () => {
    state.allowed = new Set([ORG_A, ORG_B])
    state.isPlatformAdmin = true
    const el = (await load(ORG_B)) as { props: { org: { id: string }; isPlatformAdmin: boolean } }
    expect(el.props.org.id).toBe(ORG_B)
    expect(el.props.isPlatformAdmin).toBe(true)
  })

  it('a failed access check is an error (not a 404) and records one error load event', async () => {
    state.rpcError = { message: 'connection reset', code: '08006' }
    await expect(load(ORG_A)).rejects.toMatchObject({ name: 'OrgAdminAccessError', code: '08006' })
    expect(state.orgReads).toEqual([])
    expect(state.metrics).toHaveLength(1)
    expect(state.metrics[0]).toMatchObject({ op: 'admin.org_page.load', ok: false })
  })
})
