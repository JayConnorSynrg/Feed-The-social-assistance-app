// apps/web/src/app/(admin)/moderation/org-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization row tells the truth (decideOrgPanelFocus): found only once the setup panel has
// loaded THAT organization; not_found when the panel is for another (or no) organization or its read
// failed; abandoned when the panel closed before it loaded; wait while it is loading. S1–S7 in
// admin-focus.scenarios.test.ts drive the real shell through it.

import { describe, it, expect } from 'vitest'
import { decideOrgPanelFocus } from './org-focus'

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('decideOrgPanelFocus', () => {
  it('panel open for the focus, still loading -> wait', () => {
    expect(decideOrgPanelFocus(ORG, { openOrgId: ORG, load: null }, false)).toBe('wait')
    // A stale result for another organization is not this one's.
    expect(decideOrgPanelFocus(ORG, { openOrgId: ORG, load: { orgId: OTHER, ok: true } }, true)).toBe('wait')
  })
  it('loaded -> found; failed / not found -> not_found (ids compared lower-cased)', () => {
    expect(decideOrgPanelFocus(ORG, { openOrgId: ORG.toUpperCase(), load: { orgId: ORG.toUpperCase(), ok: true } }, true)).toBe('found')
    expect(decideOrgPanelFocus(ORG, { openOrgId: ORG, load: { orgId: ORG, ok: false } }, true)).toBe('not_found')
  })
  it('the panel was never open for the focus (no ?org=, another id) -> not_found', () => {
    expect(decideOrgPanelFocus(ORG, { openOrgId: null, load: null }, false)).toBe('not_found')
    expect(decideOrgPanelFocus(ORG, { openOrgId: OTHER, load: { orgId: OTHER, ok: true } }, false)).toBe('not_found')
  })
  it('closed after it was open, before loading -> abandoned', () => {
    expect(decideOrgPanelFocus(ORG, { openOrgId: null, load: null }, true)).toBe('abandoned')
  })
})
