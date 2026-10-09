// apps/web/src/hooks/use-admin-viewer.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I3 — admin status is looked up at most once per signed-in identity per page load, however many
// consumers are mounted: the 8 existing useAdminTier() call sites plus any number of
// useAdminViewer() links share ONE current_user_tier + is_founder pair; organization / event links
// of a non-platform admin add ONE get_admin_org_list. Zero calls for logged-out visitors and guests.
// A new identity gets a fresh pair.
//
// React is replaced by a minimal synchronous harness (no DOM renderer in this repo): each mounted
// instance owns its useState slots; useEffect callbacks run once at mount, as React would.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Instance = { state: unknown[]; i: number; effects: Array<() => void | (() => void)> }
let current: Instance | null = null
vi.mock('react', () => ({
  useState: (init: unknown) => {
    const inst = current as Instance
    const i = inst.i++
    if (inst.state.length <= i) inst.state.push(typeof init === 'function' ? (init as () => unknown)() : init)
    return [
      inst.state[i],
      (v: unknown) => {
        inst.state[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(inst.state[i]) : v
      },
    ]
  },
  useEffect: (fn: () => void | (() => void)) => {
    ;(current as Instance).effects.push(fn)
  },
}))

let authUser: { id: string; is_anonymous?: boolean } | null = null
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: authUser }) }))

// Per-user RPC answers.
const TIERS: Record<string, string | null> = { pa: 'platform_admin', cm: 'community_moderator', member: null, orgadmin: null }
const ORGS: Record<string, Array<{ id: string }>> = { orgadmin: [{ id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }] }
let failTier = false
const rpcCalls: string[] = []
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (fn: string) => {
      rpcCalls.push(fn)
      const uid = authUser?.id ?? ''
      if (fn === 'current_user_tier') {
        return Promise.resolve(failTier ? { data: null, error: { code: '57014' } } : { data: TIERS[uid] ?? null, error: null })
      }
      if (fn === 'is_founder') return Promise.resolve({ data: false, error: null })
      if (fn === 'get_admin_org_list') return Promise.resolve({ data: ORGS[uid] ?? [], error: null })
      if (fn === 'is_org_admin_any') return Promise.resolve({ data: uid === 'orgadmin', error: null })
      return Promise.resolve({ data: null, error: { code: 'unknown' } })
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { useAdminTier, resetAdminTierCache } from './use-admin-tier'
import { useAdminViewer } from './use-admin-viewer'
import { useIsOrgAdmin } from './use-is-org-admin'

function mount<T>(hook: () => T): { read: () => T } {
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
  const mountEffects = inst.effects.splice(0)
  mountEffects.forEach((fn) => fn())
  return {
    read: () => {
      const v = render()
      inst.effects.length = 0 // read-only re-render: effects already ran at mount
      return v
    },
  }
}

async function flush() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
}

const tierPairs = () => rpcCalls.filter((c) => c === 'current_user_tier').length
const orgLists = () => rpcCalls.filter((c) => c === 'get_admin_org_list').length

beforeEach(() => {
  rpcCalls.length = 0
  failTier = false
  resetAdminTierCache()
})

describe('one shared tier lookup per identity (I3)', () => {
  it('8 useAdminTier + 5 useAdminViewer consumers for one user: exactly one tier RPC pair', async () => {
    authUser = { id: 'cm', is_anonymous: false }
    const tiers = Array.from({ length: 8 }, () => mount(useAdminTier))
    const viewers = Array.from({ length: 5 }, () => mount(() => useAdminViewer(false)))
    await flush()
    expect([...rpcCalls].sort()).toEqual(['current_user_tier', 'is_founder'])
    for (const t of tiers) expect(t.read()).toEqual({ tier: 'community_moderator', isFounder: false, loading: false })
    for (const v of viewers) expect(v.read()).toMatchObject({ status: 'ready', tier: 'community_moderator' })
  })

  it('a consumer mounted after the lookup settled renders the answer at once with no new call', async () => {
    authUser = { id: 'cm', is_anonymous: false }
    mount(useAdminTier)
    await flush()
    rpcCalls.length = 0
    const late = mount(useAdminTier)
    expect(late.read()).toEqual({ tier: 'community_moderator', isFounder: false, loading: false })
    expect(rpcCalls).toEqual([])
  })

  it('a new identity gets a fresh pair; signing out costs nothing and clears the answer', async () => {
    authUser = { id: 'cm', is_anonymous: false }
    mount(useAdminTier)
    mount(useAdminTier)
    await flush()
    expect(tierPairs()).toBe(1)

    authUser = { id: 'pa', is_anonymous: false }
    const a = mount(useAdminTier)
    mount(() => useAdminViewer(true))
    await flush()
    expect(tierPairs()).toBe(2)
    expect(a.read().tier).toBe('platform_admin')

    rpcCalls.length = 0
    authUser = null
    const out = mount(useAdminTier)
    const outViewer = mount(() => useAdminViewer(true))
    await flush()
    expect(rpcCalls).toEqual([])
    expect(out.read()).toEqual({ tier: null, isFounder: false, loading: false })
    expect(outViewer.read()).toMatchObject({ status: 'ready', tier: null })

    // The same user signing back in is looked up again (the sign-out cleared the cache).
    authUser = { id: 'pa', is_anonymous: false }
    mount(useAdminTier)
    await flush()
    expect(tierPairs()).toBe(1)
  })

  for (const [name, consumer] of [
    ['useAdminTier', () => useAdminTier()],
    ['useAdminViewer', () => useAdminViewer(false)],
  ] as const) {
    it(`a sign-out seen only by ${name} still forgets the answer (same user signing back in is looked up again)`, async () => {
      authUser = { id: 'cm', is_anonymous: false }
      mount(consumer)
      await flush()
      authUser = null
      mount(consumer)
      await flush()
      authUser = { id: 'cm', is_anonymous: false }
      mount(consumer)
      await flush()
      expect(tierPairs()).toBe(2)
    })
  }

  it('logged out: zero RPCs from any consumer', async () => {
    authUser = null
    for (let i = 0; i < 4; i++) {
      mount(useAdminTier)
      mount(() => useAdminViewer(true))
      mount(useIsOrgAdmin)
    }
    await flush()
    expect(rpcCalls).toEqual([])
  })

  it('guest (anonymous auth): zero RPCs from any consumer, and no link-ready tier', async () => {
    authUser = { id: 'orgadmin', is_anonymous: true }
    const v = mount(() => useAdminViewer(true))
    mount(useAdminTier)
    mount(useIsOrgAdmin)
    await flush()
    expect(rpcCalls).toEqual([])
    expect(v.read()).toMatchObject({ status: 'ready', tier: null })
  })

  it('a failed tier lookup reads as error (no link) and is retried by the next consumer to mount', async () => {
    authUser = { id: 'cm', is_anonymous: false }
    failTier = true
    const v = mount(() => useAdminViewer(false))
    mount(() => useAdminViewer(false))
    await flush()
    expect(tierPairs()).toBe(1)
    expect(v.read()).toEqual({ status: 'error', tier: null, adminOrgIds: null })

    failTier = false
    const again = mount(() => useAdminViewer(false))
    await flush()
    expect(tierPairs()).toBe(2)
    expect(again.read()).toMatchObject({ status: 'ready', tier: 'community_moderator' })
  })
})

describe('administered-organization list: lazy, shared, never for platform admins (I3)', () => {
  it('org admin: N organization/event links -> one get_admin_org_list; ids lower-cased', async () => {
    authUser = { id: 'orgadmin', is_anonymous: false }
    const links = Array.from({ length: 6 }, () => mount(() => useAdminViewer(true)))
    await flush()
    expect(tierPairs()).toBe(1)
    expect(orgLists()).toBe(1)
    const v = links[5].read()
    expect(v.status).toBe('ready')
    expect([...(v.adminOrgIds ?? [])]).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])
  })

  it('links that do not need the list (post, resource, …) never fetch it', async () => {
    authUser = { id: 'orgadmin', is_anonymous: false }
    for (let i = 0; i < 5; i++) mount(() => useAdminViewer(false))
    await flush()
    expect(orgLists()).toBe(0)
  })

  it('platform admin: organization/event links fetch no list', async () => {
    authUser = { id: 'pa', is_anonymous: false }
    const v = mount(() => useAdminViewer(true))
    await flush()
    expect(orgLists()).toBe(0)
    expect(v.read()).toEqual({ status: 'ready', tier: 'platform_admin', adminOrgIds: null })
  })

  it('a new identity fetches its own list', async () => {
    authUser = { id: 'orgadmin', is_anonymous: false }
    mount(() => useAdminViewer(true))
    await flush()
    authUser = { id: 'member', is_anonymous: false }
    const v = mount(() => useAdminViewer(true))
    await flush()
    expect(orgLists()).toBe(2)
    expect(v.read()).toEqual({ status: 'ready', tier: null, adminOrgIds: new Set() })
  })
})

describe('useIsOrgAdmin — signed-in only', () => {
  it('signed in: one is_org_admin_any call', async () => {
    authUser = { id: 'orgadmin', is_anonymous: false }
    const h = mount(useIsOrgAdmin)
    await flush()
    expect(rpcCalls).toEqual(['is_org_admin_any'])
    expect(h.read()).toBe(true)
  })
})
