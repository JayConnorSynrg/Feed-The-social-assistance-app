// apps/web/src/components/map/marker-admin-edit.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1 on the members' map — the REAL markers, island and AdminEditLink (only the viewer lookup and
// react-map-gl are stubbed; the island is put in its browser state, see admin-edit-link-island.test.ts
// for its server state):
//   - each popup (resource, business, organization) and the resource detail pane carries "Edit in
//     admin" for exactly the viewers whose admin screen accepts that item, built from the entity the
//     surface shows, and nothing for members, logged-out visitors, guests, or while loading / failed;
//   - the link sits INSIDE the popup's dialog (Tab reaches it; Escape on the dialog still closes it);
//   - the resource marker's link is opt-in: the admin tabs' own maps (pending resources) get none.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEditViewer } from '@/lib/admin-editability'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  // The browser snapshot (after hydration), so the island renders its link.
  return { ...actual, useSyncExternalStore: (_s: unknown, getSnapshot: () => unknown) => getSnapshot() }
})
vi.mock('react-map-gl/mapbox', () => ({
  Marker: ({ children }: { children: ReactNode }) => children,
  Popup: ({ children }: { children: ReactNode }) => children,
}))
const { viewerRef } = vi.hoisted(() => ({ viewerRef: { current: null as unknown } }))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => viewerRef.current }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { ResourceMarker } from './resource-marker'
import { BusinessMarker } from './business-marker'
import { OrgMarker } from './org-marker'
import { ResourceDetail } from '@/components/panels/map-panel'

const RID = '11111111-1111-4111-8111-111111111111'
const BID = '22222222-2222-4222-8222-222222222222'
const OID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const ready = (tier: AdminEditViewer['tier'], orgs: string[] | null = []): AdminEditViewer => ({
  status: 'ready',
  tier,
  adminOrgIds: orgs === null ? null : new Set(orgs),
})
const VIEWERS: Record<string, AdminEditViewer> = {
  logged_out_or_guest: ready(null),
  member: ready(null, []),
  loading: { status: 'loading', tier: null, adminOrgIds: null },
  error: { status: 'error', tier: null, adminOrgIds: null },
  community_moderator: ready('community_moderator'),
  resource_admin: ready('resource_admin'),
  platform_admin: ready('platform_admin', null),
  org_admin_of_this_org: ready(null, [OID]),
}

const resource = { id: RID, name: 'Riverside Pantry', category: 'food', latitude: 44.48, longitude: -73.21 }
const business = { id: BID, name: 'Corner Cafe', description: null, address: null, city: 'Rutland', state: 'VT', lat: 43.6, lng: -72.97 }
const organization = { ...business, id: OID, name: 'Food Shelf', org_type: 'food_bank' }

const surfaces = {
  resource_popup: () => h(ResourceMarker, { resource, focused: true, adminEdit: true }),
  resource_detail: () =>
    h(ResourceDetail, {
      resource: { ...resource, address_line1: '1 Main St', city: 'Burlington', state: 'VT' } as never,
      onClose: () => {},
      onGetDirections: () => {},
      onGetHelp: () => {},
      locale: 'en',
    }),
  business_popup: () => h(BusinessMarker, { business: business as never, focused: true }),
  organization_popup: () => h(OrgMarker, { organization: organization as never, focused: true }),
}

function render(surface: keyof typeof surfaces, viewer: AdminEditViewer): string {
  viewerRef.current = viewer
  return renderToStaticMarkup(surfaces[surface]())
}
const adminLinks = (html: string) => html.match(/<a [^>]*target="feed-admin"[^>]*>/g) ?? []

beforeEach(() => {
  viewerRef.current = null
})

describe('map surfaces — "Edit in admin" present exactly when the admin screen accepts it (I1)', () => {
  // Columns: resource_popup, resource_detail, business_popup, organization_popup
  const EXPECTED: Record<string, string> = {
    logged_out_or_guest: '0 0 0 0',
    member: '0 0 0 0',
    loading: '0 0 0 0',
    error: '0 0 0 0',
    community_moderator: '0 0 0 0',
    resource_admin: '1 1 0 0',
    platform_admin: '1 1 1 1',
    org_admin_of_this_org: '0 0 0 1',
  }
  for (const [name, viewer] of Object.entries(VIEWERS)) {
    it(`${name}: ${EXPECTED[name]}`, () => {
      const got = (Object.keys(surfaces) as Array<keyof typeof surfaces>).map((s) => {
        const links = adminLinks(render(s, viewer))
        expect(links.length).toBeLessThanOrEqual(1)
        return String(links.length)
      })
      expect(got.join(' ')).toBe(EXPECTED[name])
    })
  }
})

describe('map surfaces — the target is the entity shown there (I2)', () => {
  it('resource popup and detail pane -> the Manage tab focused on that resource', () => {
    for (const s of ['resource_popup', 'resource_detail'] as const) {
      expect(adminLinks(render(s, VIEWERS.resource_admin))[0]).toContain(`href="/moderation?tab=manage&amp;focus=resource:${RID}"`)
    }
  })
  it('business popup (also the leaf that replaces a linked resource pin) -> the Businesses tab on that business', () => {
    expect(adminLinks(render('business_popup', VIEWERS.platform_admin))[0]).toContain(
      `href="/moderation?tab=businesses&amp;focus=business:${BID}"`
    )
  })
  it('organization popup -> the shell panel for a platform admin, the organization page for its admin', () => {
    expect(adminLinks(render('organization_popup', VIEWERS.platform_admin))[0]).toContain(
      `href="/moderation?tab=organizations&amp;org=${OID}"`
    )
    expect(adminLinks(render('organization_popup', VIEWERS.org_admin_of_this_org))[0]).toContain(
      `href="/moderation/org/${OID}?tab=profile"`
    )
  })
  it('an organization admin of ANOTHER organization gets no link', () => {
    expect(adminLinks(render('organization_popup', ready(null, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])))).toEqual([])
  })
})

describe('map popups keep their dialog behaviour (I3)', () => {
  it('the link is inside the popup dialog, after its title, and not nested in another link', () => {
    for (const s of ['resource_popup', 'business_popup', 'organization_popup'] as const) {
      const html = render(s, VIEWERS.platform_admin)
      const dialogAt = html.indexOf('role="dialog"')
      const linkAt = html.indexOf('target="feed-admin"')
      expect(dialogAt).toBeGreaterThanOrEqual(0)
      expect(linkAt).toBeGreaterThan(dialogAt)
      // Everything after the dialog opens is inside it (the popup content is the dialog).
      expect(html.slice(dialogAt).match(/<a /g)!.length).toBe(html.slice(dialogAt).match(/<\/a>/g)!.length)
      // Every <a> opened before the admin link is closed before it: the link is not nested.
      const before = html.slice(0, html.lastIndexOf('<a ', linkAt))
      expect((before.match(/<a /g) ?? []).length).toBe((before.match(/<\/a>/g) ?? []).length)
    }
  })

  it('the resource marker link is opt-in: without adminEdit (the admin tabs\' maps) there is none, even for a platform admin', () => {
    viewerRef.current = VIEWERS.platform_admin
    expect(adminLinks(renderToStaticMarkup(h(ResourceMarker, { resource, focused: true })))).toEqual([])
  })

  it('the link speaks the viewer locale', () => {
    viewerRef.current = VIEWERS.platform_admin
    const html = renderToStaticMarkup(h(BusinessMarker, { business: business as never, focused: true, locale: 'es' }))
    expect(html).toContain('lang="es"')
    expect(html).toContain('>Editar en administración</a>')
  })
})
