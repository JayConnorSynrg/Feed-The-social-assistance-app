// apps/web/src/app/(social)/s/admin-edit-island.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1/I3 — the public /s/resource, /s/business and /s/organization pages (server components) place
// the client-only "Edit in admin" island for the entity they show (its database id, its name), and
// their server HTML holds no admin link — even when the viewer lookup would allow one (a platform
// admin). The island's browser half is proven in components/admin/client-admin-edit-link.test.ts.

import { describe, it, expect, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { ID, place } = vi.hoisted(() => {
  const ID = '11111111-1111-4111-8111-111111111111'
  return {
    ID,
    place: {
      id: ID,
      name: 'Corner Cafe',
      description: null,
      org_type: 'food_bank',
      address: null,
      city: 'Rutland',
      state: 'VT',
      zip_code: null,
      phone: null,
      email: null,
      website: null,
      business_category: null,
      attributes: {},
      social_links: {},
      location: null,
    },
  }
})

vi.mock('@/hooks/use-admin-viewer', () => ({
  useAdminViewer: () => ({ status: 'ready', tier: 'platform_admin', adminOrgIds: null }),
}))
vi.mock('@/lib/logger', () => ({
  logEvent: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://www.sourcetofeed.com' }))
vi.mock('@/lib/supabase/server', () => {
  const row = { id: ID, name: 'Riverside Pantry', category: 'food', status: 'approved', description: null }
  const q = { select: () => q, eq: () => q, single: async () => ({ data: row, error: null }) }
  return { createClient: async () => ({ from: () => q }) }
})
vi.mock('@/lib/business-data', () => ({
  fetchApprovedBusinessById: async () => ({ ...place, org_type: 'business' }),
  fetchBusinessHours: async () => [],
  fetchBusinessServices: async () => [],
  fetchBusinessPhotos: async () => [],
}))
vi.mock('@/lib/org-data', () => ({
  fetchOrganizationById: async () => ({ ...place, name: 'Food Shelf' }),
  fetchOrgResources: async () => [],
}))

import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import ResourcePage from './resource/[id]/page'
import BusinessPage from './business/[id]/page'
import OrganizationPage from './organization/[id]/page'

function islands(node: ReactNode, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) node.forEach((n) => islands(n, found))
  else if (isValidElement(node)) {
    if (node.type === ClientAdminEditLink) found.push(node)
    islands((node.props as { children?: ReactNode }).children, found)
  }
  return found
}

const params = Promise.resolve({ id: ID })
const cases = [
  ['/s/resource', () => ResourcePage({ params }), { kind: 'resource', id: ID }, 'Riverside Pantry', 'resource_page'],
  ['/s/business', () => BusinessPage({ params }), { kind: 'business', id: ID }, 'Corner Cafe', 'business_page'],
  ['/s/organization', () => OrganizationPage({ params }), { kind: 'organization', id: ID }, 'Food Shelf', 'organization_page'],
] as const

describe('/s pages — "Edit in admin" is a client-only island', () => {
  for (const [path, page, target, name, source] of cases) {
    it(`${path}: one island for the shown entity; no admin link in the server HTML`, async () => {
      const tree = await page()
      const found = islands(tree)
      expect(found).toHaveLength(1)
      expect(found[0].props).toMatchObject({ target, itemName: name, source })
      const html = renderToStaticMarkup(tree)
      expect(html).toContain(name)
      expect(html).not.toContain('feed-admin')
      expect(html).not.toContain('/moderation')
      expect(html).not.toContain('Edit in admin')
    })
  }
})
