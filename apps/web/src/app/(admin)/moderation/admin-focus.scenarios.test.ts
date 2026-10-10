// apps/web/src/app/(admin)/moderation/admin-focus.scenarios.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 end to end for places and organizations: every followed "Edit in admin" link writes EXACTLY ONE
// admin.deeplink.resolve row, and the row tells the truth. The real AdminShell (its gate, its tabs,
// its organization panel state) runs on the mini hook runtime with a stubbed window; the claimant the
// shell really shows — the Manage tab, the Businesses tab, or OrgPanelFocus with the props the shell
// passes it — is mounted beside it. The organization admin page is the real OrgAdminShell plus its
// Profile tab's OrgProfileFocus.
//   S1 community moderator, Manage link          -> forbidden (shell gate; Manage not shown)
//   S2 resource admin, Businesses link            -> not_found (tab shown, cannot save a business)
//   S3 resource admin, malformed Manage focus     -> invalid   (shell gate; the tab claims nothing)
//   S4 platform admin, business focus on Manage   -> invalid   (shell gate; the tab claims nothing)
//   S5 resource admin, Manage link                -> found     (Manage opens the resource)
//   S6 organization admin only, Businesses link   -> forbidden (shell gate)
//   S7 organization links: platform admin panel loads -> found; panel read fails -> not_found;
//      resource admin on the platform-admin URL -> forbidden; organization page Profile -> found;
//      organization page focus naming another organization -> not_found
// PRINT_ROWS=1 prints each scenario's rows.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  tier: { tier: null as string | null, isFounder: false, loading: false },
  org: { isOrgAdmin: false, loaded: true },
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => h.rows.push({ name, ...attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/hooks/use-admin-tier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-admin-tier')>()),
  useAdminTier: () => h.tier,
}))
vi.mock('@/hooks/use-is-org-admin', () => ({ useIsOrgAdminState: () => h.org, useIsOrgAdmin: () => h.org.isOrgAdmin }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: null, loading: false }) }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('./use-admin-orgs', () => ({ useAdminOrgs: () => ({ orgs: [], loading: false, error: null }) }))
vi.mock('@/lib/supabase/client', () => {
  const client = {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'eq', 'in', 'gte', 'gt', 'lt', 'or', 'range', 'abortSignal']) chain[m] = () => chain
      chain.maybeSingle = () =>
        Promise.resolve({
          data: table === 'resources' ? { id: '11111111-1111-4111-8111-111111111111', name: 'Pantry', category: 'food', status: 'approved', location: null } : null,
          error: null,
        })
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
      return chain
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  }
  return { createClient: () => client }
})

import { mount, findAll } from '@/test/mini-react'
import { Tabs } from '@/components/ui/tabs'
import { AdminShell } from './admin-shell'
import { ManageResourcesTab } from './manage-resources-tab'
import { BusinessesTab } from './businesses-tab'
import { OrgPanelFocus, OrgProfileFocus, type OrgPanelState } from './org-focus'
import { OrgFormPanel } from '@/components/org-form/org-form-panel'
import { OrgAdminShell } from './org/[id]/org-admin-shell'

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let search = ''

const PA = { tier: 'platform_admin', isFounder: false, loading: false }
const RA = { tier: 'resource_admin', isFounder: false, loading: false }
const CM = { tier: 'community_moderator', isFounder: false, loading: false }
const NONE = { tier: null, isFounder: false, loading: false }

beforeEach(() => {
  h.rows.length = 0
  h.org = { isOrgAdmin: false, loaded: true }
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb())
  vi.stubGlobal('document', { activeElement: null, body: {}, querySelector: () => null, getElementById: () => null })
  vi.stubGlobal('window', {
    get location() {
      return { pathname: '/moderation', search, hash: '' }
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, href: string) => {
        search = href.includes('?') ? href.slice(href.indexOf('?')).split('#')[0] : ''
      },
      pushState: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

const rows = () => h.rows.filter((r) => r.name === 'admin.deeplink.resolve').map(({ name: _n, ...r }) => r)
function report(name: string) {
  if (process.env.PRINT_ROWS) console.log(`${name}: ${JSON.stringify(rows())}`)
  return rows()
}

/** The main shell plus the claimant it really shows for this URL and tier. */
async function followShellLink(url: string, tier: typeof PA, org = { isOrgAdmin: false, loaded: true }) {
  search = url
  h.tier = tier
  h.org = org
  const shell = mount(() => AdminShell())
  let tree = await shell.flush()
  const shown = findAll(tree, (el) => el.type === Tabs)[0]?.props.value
  if (shown === 'manage') await mount(() => ManageResourcesTab()).flush()
  if (shown === 'businesses') await mount(() => BusinessesTab()).flush()
  tree = await shell.flush()
  return { shell, tree: () => shell.tree(), shown, initialTree: tree }
}

describe('S1–S6: place links, exactly one truthful row', () => {
  it('S1 community moderator, Manage link -> forbidden x1', async () => {
    await followShellLink(`?tab=manage&focus=resource:${ID}`, CM)
    expect(report('S1')).toEqual([{ kind: 'resource', outcome: 'forbidden', tab: 'manage' }])
  })
  it('S2 resource admin, Businesses link -> not_found x1 (the tab is shown, a business cannot be saved)', async () => {
    const { shown } = await followShellLink(`?tab=businesses&focus=business:${ID}`, RA)
    expect(shown).toBe('businesses')
    expect(report('S2')).toEqual([{ kind: 'business', outcome: 'not_found', tab: 'businesses' }])
  })
  it('S3 resource admin, malformed Manage focus -> invalid x1 (the tab claims nothing)', async () => {
    const { shown } = await followShellLink('?tab=manage&focus=resource:not-a-uuid', RA)
    expect(shown).toBe('manage')
    expect(report('S3')).toEqual([{ kind: 'unknown', outcome: 'invalid', tab: 'manage' }])
  })
  it('S4 platform admin, business focus on the Manage tab -> invalid x1', async () => {
    await followShellLink(`?tab=manage&focus=business:${ID}`, PA)
    expect(report('S4')).toEqual([{ kind: 'business', outcome: 'invalid', tab: 'manage' }])
  })
  it('S5 resource admin, Manage link -> found x1', async () => {
    await followShellLink(`?tab=manage&focus=resource:${ID}`, RA)
    expect(report('S5')).toEqual([{ kind: 'resource', outcome: 'found', tab: 'manage' }])
    expect(search).toBe('?tab=manage')
  })
  it('S6 organization admin only, Businesses link -> forbidden x1', async () => {
    await followShellLink(`?tab=businesses&focus=business:${ID}`, NONE, { isOrgAdmin: true, loaded: true })
    expect(report('S6')).toEqual([{ kind: 'business', outcome: 'forbidden', tab: 'businesses' }])
  })
})

describe('S7: organization links, exactly one truthful row', () => {
  const PA_URL = `?tab=organizations&org=${ORG}&focus=organization:${ORG}`

  /** Platform admin: the shell opens the panel; OrgPanelFocus gets the shell's panel prop. */
  async function followOrgPanel(loadOk: boolean | null) {
    const { shell } = await followShellLink(PA_URL, PA)
    const panelProp = () => findAll(shell.tree(), (el) => el.type === OrgPanelFocus)[0]?.props.panel as OrgPanelState
    expect(panelProp()).toMatchObject({ openOrgId: ORG, load: null })
    const claimant = mount(() => OrgPanelFocus({ panel: panelProp() }))
    await claimant.flush()
    expect(rows()).toEqual([]) // waiting for the panel's own read
    if (loadOk !== null) {
      const onLoadResult = findAll(shell.tree(), (el) => el.type === OrgFormPanel)[0].props.onLoadResult as (id: string, ok: boolean) => void
      onLoadResult(ORG, loadOk)
      shell.rerender()
      await shell.flush()
      claimant.rerender()
      await claimant.flush()
    }
    return { shell, claimant }
  }

  it('S7a platform admin: the panel loads that organization -> found x1, focus dropped, org kept', async () => {
    await followOrgPanel(true)
    expect(report('S7a')).toEqual([{ kind: 'organization', outcome: 'found', tab: 'organizations' }])
    expect(search).toBe(`?tab=organizations&org=${ORG}`)
  })
  it('S7b platform admin: the panel read fails or finds nothing -> not_found x1', async () => {
    await followOrgPanel(false)
    expect(report('S7b')).toEqual([{ kind: 'organization', outcome: 'not_found', tab: 'organizations' }])
  })
  it('S7c resource admin on the platform-admin URL -> forbidden x1 (no claimant mounted)', async () => {
    const { tree } = await followShellLink(PA_URL, RA)
    expect(findAll(tree(), (el) => el.type === OrgPanelFocus)).toHaveLength(0)
    expect(report('S7c')).toEqual([{ kind: 'organization', outcome: 'forbidden', tab: 'organizations' }])
  })
  it('S7d organization page, Profile tab, its own organization -> found x1', async () => {
    search = `?tab=profile&focus=organization:${ORG}`
    const org = { id: ORG, name: 'Pantry', org_type: 'food_bank', is_active: true, city: null, state: null, has_map_location: false }
    const page = mount(() => OrgAdminShell({ org, isPlatformAdmin: false }))
    const tree = await page.flush()
    const profile = findAll(tree, (el) => el.type === OrgProfileFocus)
    expect(profile).toHaveLength(1)
    await mount(() => OrgProfileFocus(profile[0].props as { orgId: string })).flush()
    await page.flush()
    expect(report('S7d')).toEqual([{ kind: 'organization', outcome: 'found', tab: 'profile' }])
  })
  it('S7e organization page, a focus naming another organization -> not_found x1', async () => {
    search = `?tab=profile&focus=organization:${OTHER_ORG}`
    await mount(() => OrgProfileFocus({ orgId: ORG })).flush()
    expect(report('S7e')).toEqual([{ kind: 'organization', outcome: 'not_found', tab: 'profile' }])
  })
  it('S7f platform admin closes the panel before it loaded -> abandoned x1', async () => {
    const { shell, claimant } = await followOrgPanel(null)
    const onOpenChange = findAll(shell.tree(), (el) => el.type === OrgFormPanel)[0].props.onOpenChange as (o: boolean) => void
    onOpenChange(false)
    shell.rerender()
    await shell.flush()
    claimant.rerender()
    await claimant.flush()
    expect(report('S7f')).toEqual([{ kind: 'organization', outcome: 'abandoned', tab: 'organizations' }])
  })
})
