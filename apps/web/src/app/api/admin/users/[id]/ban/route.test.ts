// route.test.ts — ban route T3 + single-audit-row (P3.1). Mocks the server + service clients.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  actorId: 'actor-pa',
  actorTier: 'platform_admin' as string | null,
  targetTier: 'community_moderator' as string | null,
  updateErr: null as null | { message: string },
  targetErr: null as null | { message: string },
  recordCalls: [] as Array<Record<string, unknown>>,
  updateCalls: 0,
}))

vi.mock('next/headers', () => ({
  headers: () => ({ get: () => 'rid-test' }),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
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
    auth: {
      admin: {
        updateUserById: async () => {
          state.updateCalls++
          return { error: state.updateErr }
        },
      },
    },
  }),
}))

import { POST } from './route'

function call(target: string, ban_duration = '24h') {
  const req = new Request('http://localhost/api/admin/users/x/ban', {
    method: 'POST',
    body: JSON.stringify({ ban_duration }),
  })
  return POST(req, { params: Promise.resolve({ id: target }) })
}

beforeEach(() => {
  state.actorId = 'actor-pa'
  state.actorTier = 'platform_admin'
  state.targetTier = 'community_moderator'
  state.updateErr = null
  state.targetErr = null
  state.recordCalls = []
  state.updateCalls = 0
})

describe('ban route (T3 + audit)', () => {
  it('PA banning another PA is denied 403 with exactly one denied audit row and no action', async () => {
    state.targetTier = 'platform_admin'
    const res = await call('target-pa')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ code: 'target_tier' })
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('denied')
    expect(state.recordCalls[0].p_reason).toBe('target_tier')
    expect(state.updateCalls).toBe(0)
  })

  it('PA banning a CM succeeds 200 with exactly one ok audit row', async () => {
    state.targetTier = 'community_moderator'
    const res = await call('target-cm')
    expect(res.status).toBe(200)
    expect(state.updateCalls).toBe(1)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('ok')
    expect(state.recordCalls[0].p_action).toBe('user.ban')
    expect(state.recordCalls[0].p_request_id).toBe('rid-test')
  })

  it('a non-PA actor is denied (insufficient_tier)', async () => {
    state.actorTier = 'resource_admin'
    const res = await call('target-cm')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ code: 'insufficient_tier' })
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('denied')
    expect(state.updateCalls).toBe(0)
  })

  it('self-target is denied 400 (self)', async () => {
    const res = await call('actor-pa')
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ code: 'self' })
    expect(state.updateCalls).toBe(0)
  })

  it("ban_duration 'none' records user.unban", async () => {
    const res = await call('target-cm', 'none')
    expect(res.status).toBe(200)
    expect(state.recordCalls[0].p_action).toBe('user.unban')
  })
  it('fails CLOSED (500) with exactly one error row when the target-tier lookup errors', async () => {
    state.targetErr = { message: 'db down' }
    const res = await call('target-cm')
    expect(res.status).toBe(500)
    expect(state.updateCalls).toBe(0)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0].p_outcome).toBe('error')
  })
})
