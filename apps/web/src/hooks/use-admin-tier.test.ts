// use-admin-tier.test.ts — the hook's wiring from useAuth() to the tier RPCs.
// React is replaced by a minimal synchronous harness (no DOM renderer in this
// repo): useState records values, useEffect collects effects to run by hand.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: unknown[] = []
const effects: Array<() => void | (() => void)> = []
vi.mock('react', () => ({
  useState: (init: unknown) => {
    const i = state.length
    state.push(typeof init === 'function' ? (init as () => unknown)() : init)
    return [state[i], (v: unknown) => { state[i] = v }]
  },
  useEffect: (fn: () => void | (() => void)) => { effects.push(fn) },
}))

let authUser: { id: string; is_anonymous?: boolean } | null = null
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: authUser }) }))

const rpcCalls: string[] = []
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (fn: string) => {
      rpcCalls.push(fn)
      return Promise.resolve({ data: fn === 'is_founder' ? true : 'steward', error: null })
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

import { useAdminTier } from './use-admin-tier'

// The harness calls the hook as a plain function (one synchronous "render").
const runHook: () => unknown = useAdminTier

async function renderOnce() {
  state.length = 0
  effects.length = 0
  runHook()
  effects.forEach((fn) => fn())
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  const [tier, isFounder, loading] = state
  return { tier, isFounder, loading }
}

beforeEach(() => {
  rpcCalls.length = 0
})

describe('useAdminTier — hook wiring', () => {
  it('logged out: no RPC call, settles to no tier', async () => {
    authUser = null
    expect(await renderOnce()).toEqual({ tier: null, isFounder: false, loading: false })
    expect(rpcCalls).toEqual([])
  })

  it('guest (anonymous auth user): no RPC call, settles to no tier', async () => {
    authUser = { id: 'g1', is_anonymous: true }
    expect(await renderOnce()).toEqual({ tier: null, isFounder: false, loading: false })
    expect(rpcCalls).toEqual([])
  })

  it('signed-in member: calls both RPCs and exposes their result', async () => {
    authUser = { id: 'u1', is_anonymous: false }
    expect(await renderOnce()).toEqual({ tier: 'steward', isFounder: true, loading: false })
    expect([...rpcCalls].sort()).toEqual(['current_user_tier', 'is_founder'])
  })
})
