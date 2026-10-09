// apps/web/src/app/(admin)/moderation/admin-focus-tab-gate.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 'forbidden' for a tab the tier does not show: the REAL AdminFocusTabGate, mounted by the REAL
// /moderation page next to the shell, driven by the SSR hook harness. A community moderator (or a
// viewer with no tier) following a Manage / Businesses link gets exactly one forbidden row and the
// focus stripped, once the tier is known; a resource / platform admin gets none from the gate (the
// tab answers); nothing is written while the tier is loading; re-renders never write a second row.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, isValidElement, type ReactElement } from 'react'
import type { AdminEditViewer } from '@/lib/admin-editability'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  return reactWithHarness(await importOriginal<typeof import('react')>())
})

const { events, viewerRef } = vi.hoisted(() => ({
  events: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
  viewerRef: { current: null as unknown },
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => events.push({ name, attrs }),
}))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => viewerRef.current }))
vi.mock('./admin-shell', () => ({ AdminShell: () => null }))

import { harness } from '@/test-utils/ssr-hook-harness'
import { AdminFocusTabGate } from './admin-focus-tab-gate'
import ModerationPage from './page'

const ID = '11111111-1111-4111-8111-111111111111'
const ready = (tier: AdminEditViewer['tier']): AdminEditViewer => ({ status: 'ready', tier, adminOrgIds: null })

const replaceState = vi.fn()
function setUrl(search: string) {
  ;(globalThis as unknown as { window: unknown }).window = {
    location: { pathname: '/moderation', search, hash: '' },
    history: { state: null, replaceState },
  }
}
const rows = () => events.filter((e) => e.name === 'admin.deeplink.resolve').map((e) => e.attrs)

beforeEach(() => {
  harness.reset()
  events.length = 0
  replaceState.mockReset()
})

describe('AdminFocusTabGate', () => {
  it('the /moderation page mounts the gate next to the admin shell', () => {
    const page = ModerationPage() as ReactElement<{ children: ReactElement[] }>
    const types = page.props.children.filter(isValidElement).map((c) => c.type)
    expect(types).toContain(AdminFocusTabGate)
  })

  it('community moderator + a Manage link: one forbidden row, focus stripped', async () => {
    viewerRef.current = ready('community_moderator')
    setUrl(`?tab=manage&focus=resource:${ID}`)
    await harness.settle(h(AdminFocusTabGate))
    await harness.settle(h(AdminFocusTabGate))
    expect(rows()).toEqual([{ kind: 'resource', outcome: 'forbidden', tab: 'manage' }])
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState.mock.calls[0][2]).toBe('/moderation?tab=manage')
  })

  it('no tier (organization admin only) + a Businesses link: one forbidden row', async () => {
    viewerRef.current = ready(null)
    setUrl(`?tab=businesses&focus=business:${ID}`)
    await harness.settle(h(AdminFocusTabGate))
    expect(rows()).toEqual([{ kind: 'business', outcome: 'forbidden', tab: 'businesses' }])
  })

  it('waits for the tier: nothing while loading, one row once known', async () => {
    viewerRef.current = { status: 'loading', tier: null, adminOrgIds: null }
    setUrl(`?tab=manage&focus=resource:${ID}`)
    await harness.settle(h(AdminFocusTabGate))
    expect(rows()).toEqual([])
    viewerRef.current = ready('community_moderator')
    await harness.settle(h(AdminFocusTabGate))
    expect(rows()).toEqual([{ kind: 'resource', outcome: 'forbidden', tab: 'manage' }])
  })

  it('resource admin / platform admin: the tab answers, the gate writes nothing', async () => {
    for (const tier of ['resource_admin', 'platform_admin'] as const) {
      harness.reset()
      viewerRef.current = ready(tier)
      setUrl(`?tab=manage&focus=resource:${ID}`)
      await harness.settle(h(AdminFocusTabGate))
    }
    expect(rows()).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
  })
})
