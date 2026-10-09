// apps/web/src/components/panels/showcase-admin-edit.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1 on the Community showcase rows — the REAL OrganizationsPanel / BusinessesPanel with the REAL
// viewer lookups (useAdminTier, useAdminViewer, ClientAdminEditLink in its browser state); only auth, the list
// readers and Supabase RPCs are faked; driven through mount → effects → re-render by the harness:
//   - each row carries "Edit in admin" exactly for the viewers whose admin screen accepts that item
//     (organizations: platform admin -> shell panel, organization admin -> that organization's page;
//     businesses: platform admin only), nothing for members, logged-out visitors or guests;
//   - the link is a SIBLING of the whole-row link (never an <a> inside an <a>);
//   - lookup cost: N rows add no RPC. Logged out / guest: zero RPCs. Signed in: the ONE shared
//     current_user_tier + is_founder pair, plus ONE get_admin_org_list only on the organizations
//     page and only for a viewer who is not a platform admin.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  const actual = await importOriginal<typeof import('react')>()
  return { ...reactWithHarness(actual), useSyncExternalStore: (_s: unknown, getSnapshot: () => unknown) => getSnapshot() }
})

const { auth, rpcCalls, tiers, orgLists } = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; is_anonymous?: boolean } },
  rpcCalls: [] as string[],
  tiers: {} as Record<string, string | null>,
  orgLists: {} as Record<string, Array<{ id: string }>>,
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: auth.user, isAnonymous: auth.user?.is_anonymous === true, profile: null, loading: false }),
}))
vi.mock('@/lib/supabase/client', () => {
  // A singleton, like the real browser client.
  const client = {
    rpc: (fn: string) => {
      rpcCalls.push(fn)
      const uid = auth.user?.id ?? ''
      if (fn === 'current_user_tier') return Promise.resolve({ data: tiers[uid] ?? null, error: null })
      if (fn === 'is_founder') return Promise.resolve({ data: false, error: null })
      if (fn === 'get_admin_org_list') return Promise.resolve({ data: orgLists[uid] ?? [], error: null })
      return Promise.resolve({ data: null, error: null })
    },
  }
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/hooks/use-geolocation', () => ({
  useGeolocation: () => ({ position: null, getCurrentPosition: vi.fn() }),
  calculateDistance: () => 0,
}))
vi.mock('@/lib/privacy-prefs', () => ({ readShareLocationPref: () => false }))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {} }) }))

const O1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const O2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const O3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const B1 = '11111111-1111-4111-8111-111111111111'
const B2 = '22222222-2222-4222-8222-222222222222'

function place(id: string, name: string, org_type: string) {
  return { id, name, description: null, org_type, address: null, city: 'Rutland', state: 'VT', zip_code: null, location: null }
}
vi.mock('@/lib/org-data', () => ({
  fetchApprovedOrganizations: async () => [place(O1, 'Food Shelf', 'food_bank'), place(O2, 'Shelter', 'shelter'), place(O3, 'Clinic', 'clinic')],
}))
vi.mock('@/lib/business-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/business-data')>()),
  fetchApprovedBusinesses: async () => [place(B1, 'Corner Cafe', 'business'), place(B2, 'Bakery', 'business')],
}))

import { harness } from '@/test-utils/ssr-hook-harness'
import { resetAdminTierCache } from '@/hooks/use-admin-tier'
import { OrganizationsPanel } from './organizations-panel'
import { BusinessesPanel } from './businesses-panel'

const adminHrefs = (html: string) =>
  [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*target="feed-admin"/g)].map((m) => m[1].replace(/&amp;/g, '&'))

/** Each <li>: its row link closes before the admin link opens (siblings, never nested). */
function assertSiblings(html: string) {
  for (const li of html.match(/<li[^>]*>.*?<\/li>/g) ?? []) {
    const at = li.indexOf('target="feed-admin"')
    if (at < 0) continue
    const before = li.slice(0, li.lastIndexOf('<a ', at))
    expect((before.match(/<a /g) ?? []).length).toBe((before.match(/<\/a>/g) ?? []).length)
  }
}

type Who = 'logged_out' | 'guest' | 'member' | 'org_admin_O1' | 'resource_admin' | 'platform_admin'
function signIn(who: Who) {
  auth.user =
    who === 'logged_out' ? null : who === 'guest' ? { id: 'guest', is_anonymous: true } : { id: who, is_anonymous: false }
}

beforeEach(() => {
  harness.reset()
  resetAdminTierCache()
  rpcCalls.length = 0
  Object.assign(tiers, { member: null, org_admin_O1: null, resource_admin: 'resource_admin', platform_admin: 'platform_admin' })
  Object.assign(orgLists, { org_admin_O1: [{ id: O1.toUpperCase() }] })
})

describe('Organizations subtab rows (I1)', () => {
  const EXPECTED: Record<Who, { hrefs: string[]; rpcs: string[] }> = {
    logged_out: { hrefs: [], rpcs: [] },
    guest: { hrefs: [], rpcs: [] },
    member: { hrefs: [], rpcs: ['current_user_tier', 'get_admin_org_list', 'is_founder'] },
    resource_admin: { hrefs: [], rpcs: ['current_user_tier', 'get_admin_org_list', 'is_founder'] },
    org_admin_O1: {
      hrefs: [`/moderation/org/${O1}?tab=profile&focus=organization:${O1}`],
      rpcs: ['current_user_tier', 'get_admin_org_list', 'is_founder'],
    },
    platform_admin: {
      hrefs: [O1, O2, O3].map((o) => `/moderation?tab=organizations&org=${o}&focus=organization:${o}`),
      rpcs: ['current_user_tier', 'is_founder'],
    },
  }
  for (const who of Object.keys(EXPECTED) as Who[]) {
    it(`${who}: ${EXPECTED[who].hrefs.length} link(s); RPCs ${JSON.stringify(EXPECTED[who].rpcs)}`, async () => {
      signIn(who)
      const html = await harness.settle(h(OrganizationsPanel))
      expect(html).toContain('Food Shelf')
      expect(adminHrefs(html)).toEqual(EXPECTED[who].hrefs)
      expect([...rpcCalls].sort()).toEqual(EXPECTED[who].rpcs)
      assertSiblings(html)
    })
  }
})

describe('Businesses showcase rows (I1)', () => {
  const EXPECTED: Record<Who, { hrefs: string[]; rpcs: string[] }> = {
    logged_out: { hrefs: [], rpcs: [] },
    guest: { hrefs: [], rpcs: [] },
    member: { hrefs: [], rpcs: ['current_user_tier', 'is_founder'] },
    org_admin_O1: { hrefs: [], rpcs: ['current_user_tier', 'is_founder'] },
    resource_admin: { hrefs: [], rpcs: ['current_user_tier', 'is_founder'] },
    platform_admin: {
      hrefs: [B1, B2].map((b) => `/moderation?tab=businesses&focus=business:${b}`),
      rpcs: ['current_user_tier', 'is_founder'],
    },
  }
  for (const who of Object.keys(EXPECTED) as Who[]) {
    it(`${who}: ${EXPECTED[who].hrefs.length} link(s); RPCs ${JSON.stringify(EXPECTED[who].rpcs)}`, async () => {
      signIn(who)
      const html = await harness.settle(h(BusinessesPanel))
      expect(html).toContain('Corner Cafe')
      expect(adminHrefs(html)).toEqual(EXPECTED[who].hrefs)
      expect([...rpcCalls].sort()).toEqual(EXPECTED[who].rpcs)
      assertSiblings(html)
    })
  }
})
