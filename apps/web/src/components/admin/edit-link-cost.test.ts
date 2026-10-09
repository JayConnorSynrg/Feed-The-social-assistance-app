// apps/web/src/components/admin/edit-link-cost.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1 cost, with the REAL shared lookups (useAdminViewer / useAdminTier; only auth and the Supabase
// client are stubbed): a feed page of N post links + N alert links + N event links costs
//   - logged out / guest: zero RPCs;
//   - any signed-in viewer: ONE current_user_tier + is_founder pair for every post / alert link;
//   - get_admin_org_list at most ONCE per identity, only when an event link renders and the viewer
//     is not a platform admin (an organization admin may hold no tier, so a member's page with event
//     cards does ask once).
// Also: useIsOrgAdminState reports `loaded` (the admin shell's focus gate waits on it).
// React is replaced by a minimal synchronous harness (state slots; effects run once at mount).

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Instance = { state: unknown[]; i: number; effects: Array<() => void | (() => void)> }
let current: Instance | null = null
vi.mock('react', () => ({
  useState: (init: unknown) => {
    const inst = current as Instance
    const i = inst.i++
    if (inst.state.length <= i) inst.state.push(typeof init === 'function' ? (init as () => unknown)() : init)
    return [inst.state[i], (v: unknown) => (inst.state[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(inst.state[i]) : v)]
  },
  useEffect: (fn: () => void | (() => void)) => {
    ;(current as Instance).effects.push(fn)
  },
}))

let authUser: { id: string; is_anonymous?: boolean } | null = null
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: authUser }) }))
const TIERS: Record<string, string | null> = { pa: 'platform_admin', cm: 'community_moderator', member: null }
const rpcCalls: string[] = []
let orgAdminFails = false
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (fn: string) => {
      rpcCalls.push(fn)
      if (fn === 'current_user_tier') return Promise.resolve({ data: TIERS[authUser?.id ?? ''] ?? null, error: null })
      if (fn === 'is_founder') return Promise.resolve({ data: false, error: null })
      if (fn === 'get_admin_org_list') return Promise.resolve({ data: [], error: null })
      if (fn === 'is_org_admin_any') return Promise.resolve(orgAdminFails ? { data: null, error: { code: '57014' } } : { data: false, error: null })
      return Promise.resolve({ data: null, error: { code: 'unknown' } })
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { useAdminViewer } from '@/hooks/use-admin-viewer'
import { resetAdminTierCache } from '@/hooks/use-admin-tier'
import { useIsOrgAdminState } from '@/hooks/use-is-org-admin'

function mount<T>(hook: () => T) {
  const inst: Instance = { state: [], i: 0, effects: [] }
  const render = () => {
    inst.i = 0
    current = inst
    try {
      return hook()
    } finally {
      current = null
    }
  }
  render()
  inst.effects.splice(0).forEach((fn) => fn())
  return {
    read: () => {
      const v = render()
      inst.effects.length = 0
      return v
    },
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
}

/** One feed page: N post links, N alert links (needsOrgs false), N event links (needsOrgs true). */
function feedPage(n: number, withEvents: boolean) {
  for (let i = 0; i < n; i++) {
    mount(() => useAdminViewer(false))
    mount(() => useAdminViewer(false))
    if (withEvents) mount(() => useAdminViewer(true))
  }
}

beforeEach(() => {
  rpcCalls.length = 0
  orgAdminFails = false
  resetAdminTierCache()
})

describe('Edit-in-admin link cost per page', () => {
  it('logged out and guest: zero RPCs', async () => {
    for (const u of [null, { id: 'guest', is_anonymous: true }]) {
      authUser = u
      feedPage(20, true)
      await flush()
    }
    expect(rpcCalls).toEqual([])
  })

  it('signed-in member, posts + alerts only: exactly the one tier pair', async () => {
    authUser = { id: 'member' }
    feedPage(20, false)
    await flush()
    expect([...rpcCalls].sort()).toEqual(['current_user_tier', 'is_founder'])
  })

  it('signed-in member with event cards: the tier pair + ONE get_admin_org_list', async () => {
    authUser = { id: 'member' }
    feedPage(20, true)
    await flush()
    expect([...rpcCalls].sort()).toEqual(['current_user_tier', 'get_admin_org_list', 'is_founder'])
  })

  it('platform admin with event cards: the tier pair only (no organization list)', async () => {
    authUser = { id: 'pa' }
    feedPage(20, true)
    await flush()
    expect([...rpcCalls].sort()).toEqual(['current_user_tier', 'is_founder'])
  })
})

describe('useIsOrgAdminState', () => {
  it('logged out: loaded at once, no call', () => {
    authUser = null
    expect(mount(useIsOrgAdminState).read()).toEqual({ isOrgAdmin: false, loaded: true })
    expect(rpcCalls).toEqual([])
  })

  it('signed in: not loaded until is_org_admin_any settles; a failed call settles as false', async () => {
    authUser = { id: 'member' }
    const ok = mount(useIsOrgAdminState)
    expect(ok.read()).toEqual({ isOrgAdmin: false, loaded: false })
    await flush()
    expect(ok.read()).toEqual({ isOrgAdmin: false, loaded: true })
    orgAdminFails = true
    const failed = mount(useIsOrgAdminState)
    await flush()
    expect(failed.read()).toEqual({ isOrgAdmin: false, loaded: true })
  })
})
