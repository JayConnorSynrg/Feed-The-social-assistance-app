// apps/web/src/components/admin/admin-edit-link.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Edit in admin" (I1, I2, I4). Rendered with react-dom/server (no DOM in this suite):
//   - the link renders for exactly the viewer × kind pairs the server accepts, and renders NOTHING
//     for anyone else (members, logged out, guests, loading, error);
//   - one <a> to the contract URL in the reused "feed-admin" tab, no rel noopener/noreferrer, an
//     accessible name naming the item, lime-800 text + focus ring, a 24×24 minimum target;
//   - one click persists exactly one admin.nav.edit_in_admin row with kind + source only.
// The viewer hook is replaced by a fixed value per test; the real hook's lookup sharing is proven in
// hooks/use-admin-viewer.test.ts and the integration case at the bottom.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEditViewer } from '@/lib/admin-editability'

const { events, viewerRef, neededOrgs } = vi.hoisted(() => ({
  events: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
  viewerRef: { current: null as unknown },
  neededOrgs: [] as boolean[],
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => events.push({ name, attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/hooks/use-admin-viewer', () => ({
  useAdminViewer: (needsOrgs: boolean) => {
    neededOrgs.push(needsOrgs)
    return viewerRef.current
  },
}))

import { AdminEditLink, type AdminEditLinkProps } from './admin-edit-link'

const ID = '11111111-1111-4111-8111-111111111111'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const ready = (tier: AdminEditViewer['tier'], orgs: string[] | null = []): AdminEditViewer => ({
  status: 'ready',
  tier,
  adminOrgIds: orgs === null ? null : new Set(orgs),
})

function render(props: AdminEditLinkProps, viewer: AdminEditViewer): string {
  viewerRef.current = viewer
  return renderToStaticMarkup(h(AdminEditLink, props))
}

const post: AdminEditLinkProps = { target: { kind: 'post', id: ID }, itemName: 'Need a ride Tuesday', source: 'post_page' }

beforeEach(() => {
  events.length = 0
  neededOrgs.length = 0
})

describe('AdminEditLink — present exactly when the admin screen accepts it (I1)', () => {
  const kinds: Record<string, AdminEditLinkProps['target']> = {
    post: { kind: 'post', id: ID },
    safety_alert: { kind: 'safety_alert', id: ID },
    resource: { kind: 'resource', id: ID },
    business: { kind: 'business', id: ID },
    organization: { kind: 'organization', id: ORG },
    event: { kind: 'event', id: ID, orgId: ORG },
  }
  const viewers: Record<string, AdminEditViewer> = {
    logged_out_or_guest: ready(null),
    member: ready(null),
    loading: { status: 'loading', tier: null, adminOrgIds: null },
    error: { status: 'error', tier: null, adminOrgIds: null },
    community_moderator: ready('community_moderator'),
    resource_admin: ready('resource_admin'),
    platform_admin: ready('platform_admin', null),
    org_admin: ready(null, [ORG]),
  }
  // Columns: post, safety_alert, resource, business, organization, event
  const EXPECTED: Record<string, string> = {
    logged_out_or_guest: '0 0 0 0 0 0',
    member: '0 0 0 0 0 0',
    loading: '0 0 0 0 0 0',
    error: '0 0 0 0 0 0',
    community_moderator: '1 1 0 0 0 0',
    resource_admin: '1 1 1 0 0 0',
    platform_admin: '1 1 1 1 1 1',
    org_admin: '0 0 0 0 1 1',
  }
  for (const [name, viewer] of Object.entries(viewers)) {
    it(`${name}: ${EXPECTED[name]}`, () => {
      const got = Object.values(kinds).map((target) => {
        const html = render({ target, itemName: 'Item', source: 'map_popup' }, viewer)
        if (html === '') return '0'
        expect(html.match(/<a /g)).toHaveLength(1)
        return '1'
      })
      expect(got.join(' ')).toBe(EXPECTED[name])
    })
  }

  it('a malformed id renders nothing, even for a platform admin', () => {
    expect(render({ ...post, target: { kind: 'post', id: 'not-a-uuid' } }, ready('platform_admin', null))).toBe('')
    expect(
      render({ ...post, target: { kind: 'event', id: ID, orgId: 'x' } }, ready('platform_admin', null))
    ).toBe('')
  })

  it('asks for the organization list only for organization and event links', () => {
    for (const target of Object.values(kinds)) render({ target, itemName: 'Item', source: 'map_popup' }, ready(null))
    expect(neededOrgs).toEqual([false, false, false, false, true, true])
  })
})

describe('AdminEditLink — the link (I2, I4)', () => {
  it('one <a> to the contract URL in the reused feed-admin tab, without rel noopener/noreferrer', () => {
    const html = render(post, ready('community_moderator'))
    const anchors = html.match(/<a [^>]*>/g) ?? []
    expect(anchors).toHaveLength(1)
    expect(anchors[0]).toContain(`href="/moderation?tab=moderation&amp;focus=post:${ID}"`)
    expect(anchors[0]).toContain('target="feed-admin"')
    expect(anchors[0]).not.toMatch(/rel=/)
  })

  it('organization and event URLs follow the viewer: platform admin -> shell, organization admin -> org page', () => {
    const org = { target: { kind: 'organization', id: ORG }, itemName: 'Riverside Pantry', source: 'organization_page' } as const
    expect(render(org, ready('platform_admin', null))).toContain(`href="/moderation?tab=organizations&amp;org=${ORG}&amp;focus=organization:${ORG}"`)
    expect(render(org, ready(null, [ORG]))).toContain(`href="/moderation/org/${ORG}?tab=profile&amp;focus=organization:${ORG}"`)
    const ev = { target: { kind: 'event', id: ID, orgId: ORG }, itemName: 'Food drive', source: 'feed_event_menu' } as const
    // A post card's ⋯ menu item opens the same single-post URL as every other post link.
    expect(render({ target: { kind: 'post', id: ID }, itemName: 'x', source: 'feed_post_menu' }, ready('community_moderator'))).toContain(`href="/moderation?tab=moderation&amp;focus=post:${ID}"`)
    expect(render(ev, ready('platform_admin', null))).toContain(`href="/moderation?tab=events&amp;focus=event:${ID}"`)
    expect(render(ev, ready(null, [ORG]))).toContain(`href="/moderation/org/${ORG}?tab=events&amp;focus=event:${ID}"`)
  })

  it('accessible name = visible label, the item name, then where it opens', () => {
    const html = render(post, ready('community_moderator'))
    expect(html).toContain('aria-label="Edit in admin: Need a ride Tuesday (opens in the admin tab)"')
    expect(html).toMatch(/>Edit in admin<\/a>$/)
  })

  it('follows the viewer locale', () => {
    const html = render({ ...post, locale: 'es' }, ready('community_moderator'))
    expect(html).toContain('aria-label="Editar en administración: Need a ride Tuesday (se abre en la pestaña de administración)"')
    expect(html).toMatch(/>Editar en administración<\/a>$/)
  })

  it('lime-800 text and focus ring (>= 5.6:1 on stone-200/100/50/white), never the 2.8:1 lime-600; 24×24 minimum', () => {
    const cls = /class="([^"]*)"/.exec(render(post, ready('community_moderator')))?.[1].split(' ') ?? []
    expect(cls).toEqual(expect.arrayContaining(['text-lime-800', 'focus-visible:ring-2', 'focus-visible:ring-lime-800', 'min-h-6', 'min-w-6']))
    expect(cls.join(' ')).not.toMatch(/lime-[1-6]00/)
  })
})

describe('AdminEditLink — logging (I4)', () => {
  function renderedAnchor(props: AdminEditLinkProps, viewer: AdminEditViewer) {
    viewerRef.current = viewer
    let el: ReactElement | null = null
    function Probe() {
      el = AdminEditLink(props) as ReactElement
      return el
    }
    renderToStaticMarkup(h(Probe))
    return el as unknown as ReactElement<Record<string, (e: unknown) => void>>
  }

  it('one click writes exactly one admin.nav.edit_in_admin row with kind + source and no ids', () => {
    const a = renderedAnchor(
      { target: { kind: 'resource', id: ID }, itemName: 'Pantry', source: 'resource_page' },
      ready('resource_admin')
    )
    a.props.onClick({})
    expect(events).toEqual([{ name: 'admin.nav.edit_in_admin', attrs: { kind: 'resource', source: 'resource_page' } }])
  })

  it('a middle click writes exactly one row; a right click writes none', () => {
    const a = renderedAnchor(post, ready('platform_admin', null))
    a.props.onAuxClick({ button: 2 })
    expect(events).toHaveLength(0)
    a.props.onAuxClick({ button: 1 })
    expect(events).toEqual([{ name: 'admin.nav.edit_in_admin', attrs: { kind: 'post', source: 'post_page' } }])
  })

  it("a post card's ⋯ menu item: the menu's own click handler runs and exactly one row says feed_post_menu", () => {
    const menuSelect = vi.fn()
    const a = renderedAnchor({ target: { kind: 'post', id: ID }, itemName: 'Need a ride', source: 'feed_post_menu', onClick: menuSelect, role: 'menuitem' }, ready('community_moderator'))
    a.props.onClick({})
    expect(menuSelect).toHaveBeenCalledTimes(1)
    expect(events).toEqual([{ name: 'admin.nav.edit_in_admin', attrs: { kind: 'post', source: 'feed_post_menu' } }])
  })

  it("a wrapper's own onClick still runs, with one row", () => {
    const outer = vi.fn()
    const a = renderedAnchor({ ...post, onClick: outer }, ready('platform_admin', null))
    a.props.onClick({})
    expect(outer).toHaveBeenCalledTimes(1)
    expect(events).toHaveLength(1)
  })
})
