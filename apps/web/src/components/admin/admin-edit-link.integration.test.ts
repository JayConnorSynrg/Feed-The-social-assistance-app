// apps/web/src/components/admin/admin-edit-link.integration.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// AdminEditLink with the REAL useAdminViewer / useAdminTier (only auth and the Supabase client are
// stubbed): once one consumer has resolved the viewer's tier, every link on the page renders from
// the shared answer — many links, one RPC pair — and a member sees no link.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let authUser: { id: string; is_anonymous?: boolean } | null = null
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: authUser }) }))
const rpcCalls: string[] = []
const TIERS: Record<string, string | null> = { pa: 'platform_admin', member: null }
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (fn: string) => {
      rpcCalls.push(fn)
      if (fn === 'current_user_tier') return Promise.resolve({ data: TIERS[authUser?.id ?? ''] ?? null, error: null })
      return Promise.resolve({ data: fn === 'get_admin_org_list' ? [] : false, error: null })
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }, logEvent: vi.fn() }))

import { AdminEditLink } from './admin-edit-link'
import { resetAdminTierCache, resolveAdminTier, type TierRpcClient } from '@/hooks/use-admin-tier'
import { createClient } from '@/lib/supabase/client'

const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]

function page() {
  return renderToStaticMarkup(
    h(
      Fragment,
      null,
      ...ids.map((id) => h(AdminEditLink, { key: id, target: { kind: 'resource', id }, itemName: id, source: 'map_popup' })),
      h(AdminEditLink, { key: 'b', target: { kind: 'business', id: ids[0] }, itemName: 'Shop', source: 'map_popup' })
    )
  )
}

beforeEach(() => {
  rpcCalls.length = 0
  resetAdminTierCache()
})

describe('AdminEditLink with the real shared lookup', () => {
  it('platform admin: 4 links render from one tier RPC pair', async () => {
    authUser = { id: 'pa', is_anonymous: false }
    await resolveAdminTier(createClient() as unknown as TierRpcClient, authUser)
    const html = page()
    expect(html.match(/<a /g)).toHaveLength(4)
    expect([...rpcCalls].sort()).toEqual(['current_user_tier', 'is_founder'])
  })

  it('member: no link at all', async () => {
    authUser = { id: 'member', is_anonymous: false }
    await resolveAdminTier(createClient() as unknown as TierRpcClient, authUser)
    expect(page()).toBe('')
  })

  it('logged out: no link and no RPC', () => {
    authUser = null
    expect(page()).toBe('')
    expect(rpcCalls).toEqual([])
  })
})
