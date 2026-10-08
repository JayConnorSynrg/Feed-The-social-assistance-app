// apps/web/src/app/(admin)/moderation/admin-tab-url.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The open admin tab lives in `?tab=` (D5). Reading it: a valid tab id is honoured, still clamped to
// the tabs the viewer's tier is entitled to; an unknown or disallowed value falls back to the first
// entitled tab exactly as before. Writing it: the tab param is set while every other param (the org
// panel's `org`) and the hash survive. The `?tab=organizations&org=…` panel deep link still parses.

import { describe, it, expect } from 'vitest'
import { ORG_ADMIN_TABS, readTabParam, tabParamHref } from './admin-tab-url'
import { resolveAdminTab, TAB_ORDER, visibleTabs } from './admin-shell-tabs'
import { readOrgPanelTarget, readsOrganizationsTab } from './org-panel-url'

const UUID = '11111111-1111-4111-8111-111111111111'

/** The tab the admin shell shows for a URL (mount read + tier clamp), as admin-shell.tsx composes it. */
function shownTab(search: string, tabs: ReturnType<typeof visibleTabs>): string {
  const requested = readsOrganizationsTab(search) || readOrgPanelTarget(search) ? 'organizations' : (readTabParam(search, TAB_ORDER) ?? 'overview')
  return resolveAdminTab(requested, tabs)
}

describe('admin shell ?tab= — read + tier clamp', () => {
  const PA = visibleTabs('platform_admin', false)
  const RA = visibleTabs('resource_admin', false)
  const CM = visibleTabs('community_moderator', false)

  it('an allowed tab id is honoured', () => {
    expect(shownTab('?tab=people', PA)).toBe('people')
    expect(shownTab('?tab=businesses', RA)).toBe('businesses')
    expect(shownTab('?tab=moderation', CM)).toBe('moderation')
  })

  it('a disallowed tab falls back to the first entitled tab (a URL never opens an unentitled tab)', () => {
    expect(shownTab('?tab=people', CM)).toBe('moderation')
    expect(shownTab('?tab=overview', RA)).toBe('moderation')
    expect(shownTab('?tab=events', visibleTabs(null, false))).toBe('events') // nothing entitled yet (tier loading)
  })

  it('an unknown or absent value falls back exactly as without a tab param', () => {
    expect(readTabParam('?tab=nope', TAB_ORDER)).toBeNull()
    expect(readTabParam('', TAB_ORDER)).toBeNull()
    expect(shownTab('?tab=nope', PA)).toBe(shownTab('', PA))
    expect(shownTab('?tab=nope', CM)).toBe(shownTab('', CM))
    expect(shownTab('', PA)).toBe('overview')
  })

  it('the organizations panel deep link still parses (tab + org)', () => {
    expect(shownTab(`?tab=organizations&org=${UUID}`, PA)).toBe('organizations')
    expect(readOrgPanelTarget(`?tab=organizations&org=${UUID}`)).toBe(UUID)
    expect(readOrgPanelTarget('?tab=organizations&org=new')).toBe('new')
  })
})

describe('tabParamHref — write', () => {
  it('sets the tab and keeps every other param and the hash', () => {
    expect(tabParamHref({ pathname: '/moderation', search: '', hash: '' }, 'people')).toBe('/moderation?tab=people')
    expect(tabParamHref({ pathname: '/moderation', search: `?tab=overview&org=${UUID}`, hash: '#x' }, 'organizations')).toBe(
      `/moderation?tab=organizations&org=${UUID}#x`
    )
  })
  it('round-trips through readTabParam', () => {
    const href = tabParamHref({ pathname: '/moderation', search: '?a=1', hash: '' }, 'manage')
    expect(readTabParam(href.slice(href.indexOf('?')), TAB_ORDER)).toBe('manage')
  })
})

describe('organization admin page ?tab=', () => {
  it('each of its four tabs is honoured; another shell’s tab id is not', () => {
    for (const t of ['overview', 'events', 'profile', 'members'] as const) {
      expect(readTabParam(`?tab=${t}`, ORG_ADMIN_TABS)).toBe(t)
    }
    expect(readTabParam('?tab=people', ORG_ADMIN_TABS)).toBeNull()
  })
})
