// apps/web/src/components/admin/admin-edit-link-island.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1/I3 — the island never puts an admin link in server HTML: react-dom/server renders its server
// snapshot (nothing), even for a platform admin whose lookup is already settled; in the browser
// (after hydration) it renders the real AdminEditLink, which still renders nothing for a member.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEditViewer } from '@/lib/admin-editability'

const { mode, viewerRef } = vi.hoisted(() => ({ mode: { client: false }, viewerRef: { current: null as unknown } }))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useSyncExternalStore: (subscribe: () => () => void, getSnapshot: () => unknown, getServerSnapshot?: () => unknown) =>
      mode.client ? getSnapshot() : actual.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  }
})
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => viewerRef.current }))
vi.mock('@/lib/logger', () => ({ logEvent: vi.fn(), logger: { warn: vi.fn() } }))

import { AdminEditLinkIsland } from './admin-edit-link-island'

const ID = '11111111-1111-4111-8111-111111111111'
const PA: AdminEditViewer = { status: 'ready', tier: 'platform_admin', adminOrgIds: null }
const MEMBER: AdminEditViewer = { status: 'ready', tier: null, adminOrgIds: new Set() }
const link = () =>
  renderToStaticMarkup(h(AdminEditLinkIsland, { target: { kind: 'resource', id: ID }, itemName: 'Pantry', source: 'resource_page' }))

beforeEach(() => {
  mode.client = false
})

describe('AdminEditLinkIsland', () => {
  it('server render: nothing, even for a platform admin', () => {
    viewerRef.current = PA
    expect(link()).toBe('')
  })
  it('browser: the real link for a platform admin, nothing for a member', () => {
    mode.client = true
    viewerRef.current = PA
    expect(link()).toContain(`href="/moderation?tab=manage&amp;focus=resource:${ID}"`)
    viewerRef.current = MEMBER
    expect(link()).toBe('')
  })
})
