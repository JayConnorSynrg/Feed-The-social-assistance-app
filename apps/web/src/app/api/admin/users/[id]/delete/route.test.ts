// route.test.ts — delete route T3 + single-audit-row, D7 write-after (P3.1).
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  actorId: 'actor-pa',
  actorTier: 'platform_admin' as string | null,
  targetTier: 'community_moderator' as string | null,
  deleteErr: null as null | { message: string },
  recordCalls: [] as Array<Record<string, unknown>>,
  deleteCalls: 0,
}))

vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'rid-test' }) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.actorId } } }) },
    rpc: async () => ({ data: state.actorTier, error: null }),
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: state.targetErr ? null : { admin_tier: state.targetTier }, error: state.targetErr }) }),
      }),
    }),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      state.recordCalls.push(args)
      return { data: null, error: null }
    },
    auth: { admin: { deleteUser: async () => { state.deleteCalls++; return { error: state.deleteErr } } } },
  }),
}))

import { DELETE } from './route'

const call = (target: string) =>
  DELETE(new Request('http://localhost/x', { method: 'DELETE' }), { params: Promise.resolve({ id: target }) })

beforeEach(() => {
  state.actorId = 'actor-pa'
  state.actorTier = 'platform_admin'
  state.targetTier = 'community_moderator'
  state.deleteErr = null
  state.targetErr = null
  state.recordCalls = []
  state.deleteCalls = 0
})

describe('delete route (T3 + audit, D7)', () => {
  it('PA deleting another PA is denied 403, one denied row, no delete', async () => {
    state.targetTier = 'platform_admin'
    const res = await call('target-pa')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ code: 'target_tier' })
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('denied')
    expect(state.deleteCalls).toBe(0)
  })

  it('PA deleting a CM succeeds 200 with exactly one ok row written after the delete', async () => {
    const res = await call('target-cm')
    expect(res.status).toBe(200)
    expect(state.deleteCalls).toBe(1)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('ok')
    expect(state.recordCalls[0].p_action).toBe('user.delete')
  })

  it('a delete failure writes exactly one error row and returns 500', async () => {
    state.deleteErr = { message: 'boom' }
    const res = await call('target-cm')
    expect(res.status).toBe(500)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('error')
  })
  it('fails CLOSED (500) with exactly one error row when the target-tier lookup errors', async () => {
    state.targetErr = { message: 'db down' }
    const res = await call('target-cm')
    expect(res.status).toBe(500)
    expect(state.deleteCalls).toBe(0)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('error')
  })
})
