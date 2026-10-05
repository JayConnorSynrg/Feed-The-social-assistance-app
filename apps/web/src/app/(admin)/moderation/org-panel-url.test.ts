// apps/web/src/app/(admin)/moderation/org-panel-url.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// URL sync for the organization panel: deep-link parsing, the pushed/replaced URL, and how a close
// restores history (pop the pushed entry, strip a deep link, or do nothing after Back).

import { describe, it, expect } from 'vitest'
import { closeUrlAction, orgPanelHref, readOrgPanelTarget, readsOrganizationsTab } from './org-panel-url'

const ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const loc = (search: string, hash = '') => ({ pathname: '/moderation', search, hash })

describe('readOrgPanelTarget', () => {
  it('reads new and a uuid; ignores a missing or malformed org', () => {
    expect(readOrgPanelTarget('?tab=organizations&org=new')).toBe('new')
    expect(readOrgPanelTarget(`?org=${ID.toUpperCase()}`)).toBe(ID)
    expect(readOrgPanelTarget('?tab=organizations')).toBeNull()
    expect(readOrgPanelTarget('?org=42')).toBeNull()
    expect(readOrgPanelTarget('?org=<script>')).toBeNull()
  })
  it('detects the organizations tab', () => {
    expect(readsOrganizationsTab('?tab=organizations')).toBe(true)
    expect(readsOrganizationsTab('?tab=events')).toBe(false)
  })
})

describe('orgPanelHref', () => {
  it('opening sets tab + org and keeps unrelated params and the hash', () => {
    expect(orgPanelHref(loc('?foo=1', '#x'), 'new')).toBe('/moderation?foo=1&tab=organizations&org=new#x')
    expect(orgPanelHref(loc('?tab=events'), ID)).toBe(`/moderation?tab=organizations&org=${ID}`)
  })
  it('closing strips only org', () => {
    expect(orgPanelHref(loc(`?tab=organizations&org=${ID}`), null)).toBe('/moderation?tab=organizations')
    expect(orgPanelHref(loc('?org=new'), null)).toBe('/moderation')
  })
})

describe('closeUrlAction', () => {
  it('pops the entry the panel pushed', () => {
    expect(closeUrlAction(true, false)).toBe('back')
  })
  it('replaces in place for a deep-linked panel (nothing to pop)', () => {
    expect(closeUrlAction(false, false)).toBe('replace')
  })
  it('does nothing when the close came from Back (the browser already moved)', () => {
    expect(closeUrlAction(true, true)).toBe('none')
    expect(closeUrlAction(false, true)).toBe('none')
  })
})
