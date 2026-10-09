// apps/web/src/app/(admin)/moderation/admin-focus-url.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 round trip: every URL adminEditUrl builds reads back, on the screen it opens, as the same kind
// and id; malformed input reads as null; stripping focus keeps everything else.

import { describe, it, expect } from 'vitest'
import { adminEditUrl, type AdminEditTarget } from '@/lib/admin-url'
import { readAdminFocus, hasAdminFocusParam, stripAdminFocusHref } from './admin-focus-url'
import { readOrgPanelTarget } from './org-panel-url'
import { readTabParam, ORG_ADMIN_TABS } from './admin-tab-url'
import { TAB_ORDER } from './admin-shell-tabs'

const ID = '11111111-1111-4111-8111-111111111111'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function parse(href: string) {
  const url = new URL(href, 'https://feed.example')
  return { pathname: url.pathname, search: url.search }
}

describe('round trip: build -> read gives back the same kind and id', () => {
  const focusTargets: AdminEditTarget[] = [
    { kind: 'resource', id: ID },
    { kind: 'business', id: ID },
    { kind: 'safety_alert', id: ID },
    { kind: 'post', id: ID },
    { kind: 'event', id: ID, orgId: ORG },
  ]

  for (const target of focusTargets) {
    it(`${target.kind} (platform admin, main shell)`, () => {
      const { pathname, search } = parse(adminEditUrl(target, 'platform_admin'))
      expect(pathname).toBe('/moderation')
      expect(readAdminFocus(search)).toEqual({ kind: target.kind, id: ID })
      expect(readTabParam(search, TAB_ORDER)).not.toBeNull()
    })
  }

  it('event (organization admin, organization page): org id in the path, event in focus, Events tab', () => {
    const { pathname, search } = parse(adminEditUrl({ kind: 'event', id: ID, orgId: ORG }, null))
    expect(pathname).toBe(`/moderation/org/${ORG}`)
    expect(readAdminFocus(search)).toEqual({ kind: 'event', id: ID })
    expect(readTabParam(search, ORG_ADMIN_TABS)).toBe('events')
  })

  it('organization (platform admin): the existing ?org= reader returns the id', () => {
    const { search } = parse(adminEditUrl({ kind: 'organization', id: ORG }, 'platform_admin'))
    expect(readOrgPanelTarget(search)).toBe(ORG)
    expect(readAdminFocus(search)).toBeNull()
  })

  it('organization (organization admin): the page path carries the id, Profile tab', () => {
    const { pathname, search } = parse(adminEditUrl({ kind: 'organization', id: ORG }, null))
    expect(pathname).toBe(`/moderation/org/${ORG}`)
    expect(readTabParam(search, ORG_ADMIN_TABS)).toBe('profile')
  })

  it('an upper-case id reads back lower-cased (the form Postgres prints)', () => {
    const { search } = parse(adminEditUrl({ kind: 'post', id: ID.toUpperCase() }, 'platform_admin'))
    expect(readAdminFocus(search)).toEqual({ kind: 'post', id: ID })
  })

  it('accepts URLSearchParams as well as a query string', () => {
    expect(readAdminFocus(new URLSearchParams(`focus=resource:${ID}`))).toEqual({ kind: 'resource', id: ID })
  })
})

describe('readAdminFocus — invalid input yields null (the screen reports outcome invalid)', () => {
  const cases: Array<[string, string]> = [
    ['no focus', '?tab=manage'],
    ['empty', '?focus='],
    ['no separator', `?focus=${ID}`],
    ['unknown kind', `?focus=person:${ID}`],
    ['organization is not a focus kind', `?focus=organization:${ID}`],
    ['not a uuid', '?focus=post:123'],
    ['uuid with trailing junk', `?focus=post:${ID}x`],
    ['repeated focus', `?focus=post:${ID}&focus=post:${ID}`],
  ]
  for (const [name, search] of cases) {
    it(name, () => expect(readAdminFocus(search)).toBeNull())
  }

  it('hasAdminFocusParam tells "none" from "malformed"', () => {
    expect(hasAdminFocusParam('?tab=manage')).toBe(false)
    expect(hasAdminFocusParam('?focus=post:123')).toBe(true)
  })
})

describe('stripAdminFocusHref', () => {
  it('drops focus and keeps tab, other params and the hash', () => {
    expect(stripAdminFocusHref({ pathname: '/moderation', search: `?tab=manage&focus=resource:${ID}&x=1`, hash: '#top' })).toBe(
      '/moderation?tab=manage&x=1#top'
    )
  })

  it('leaves no dangling "?" when focus was the only param', () => {
    expect(stripAdminFocusHref({ pathname: `/moderation/org/${ORG}`, search: `?focus=event:${ID}`, hash: '' })).toBe(
      `/moderation/org/${ORG}`
    )
  })
})
