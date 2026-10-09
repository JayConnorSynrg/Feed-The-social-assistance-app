// apps/web/src/app/(admin)/moderation/admin-focus-session.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 — every followed "Edit in admin" link writes exactly ONE admin.deeplink.resolve row, then the
// focus param is dropped:
//   - the owning tab's session: found | not_found, or abandoned if it unmounts first — never two;
//   - the shell's gate: invalid (malformed, wrong kind for this screen, ?tab= not the owner) or
//     forbidden (owner tab not shown to this tier); nothing when the owning tab is shown (it takes it).

import { describe, it, expect } from 'vitest'
import {
  adminFocusGateOutcome,
  claimAdminFocus,
  orgPageOwnerTab,
  runAdminFocusGate,
  shellOwnerTab,
  type AdminDeeplinkRow,
  type AdminFocusEnv,
} from './admin-focus-session'

const ID = '11111111-1111-4111-8111-111111111111'

function env(search: string) {
  const rows: AdminDeeplinkRow[] = []
  let current = search
  let strips = 0
  const e: AdminFocusEnv = {
    search: () => current,
    emit: (r) => rows.push(r),
    strip: () => {
      strips++
      const p = new URLSearchParams(current)
      p.delete('focus')
      current = p.toString() ? `?${p}` : ''
    },
  }
  return { e, rows, strips: () => strips, url: () => current }
}

describe('claimAdminFocus — the owning tab writes exactly one row', () => {
  it('claims only its own kind; none, malformed or another kind -> null and nothing written', () => {
    for (const search of ['', '?tab=moderation', '?tab=moderation&focus=post:nope', `?tab=events&focus=event:${ID}`]) {
      const t = env(search)
      expect(claimAdminFocus(t.e, ['post'], 'moderation')).toBeNull()
      expect(t.rows).toEqual([])
    }
  })

  it.each([['found'], ['not_found']] as const)('resolve(%s): one row, focus stripped, tab kept; later calls write nothing', (outcome) => {
    const t = env(`?tab=moderation&focus=post:${ID.toUpperCase()}`)
    const s = claimAdminFocus(t.e, ['post'], 'moderation')!
    expect(s.focus).toEqual({ kind: 'post', id: ID })
    expect(s.resolve(outcome)).toBe(true)
    expect(s.resolve('found')).toBe(false)
    expect(s.abandon()).toBe(false)
    expect(t.rows).toEqual([{ kind: 'post', outcome, tab: 'moderation' }])
    expect(t.strips()).toBe(1)
    expect(t.url()).toBe('?tab=moderation')
  })

  it('abandon before resolving: one abandoned row; a late resolve writes nothing', () => {
    const t = env(`?tab=events&focus=event:${ID}`)
    const s = claimAdminFocus(t.e, ['event'], 'events')!
    expect(s.isOpen()).toBe(true)
    expect(s.abandon()).toBe(true)
    expect(s.isOpen()).toBe(false)
    expect(s.resolve('found')).toBe(false)
    expect(t.rows).toEqual([{ kind: 'event', outcome: 'abandoned', tab: 'events' }])
  })
})

describe('adminFocusGateOutcome — the shell reports what no tab will take', () => {
  const ALL = ['overview', 'events', 'moderation', 'community', 'organizations', 'resources', 'businesses', 'manage', 'people', 'settings']
  const CM = ['moderation']
  const ORG_ONLY = ['events']
  const gate = (search: string, visibleTabs: string[], owner = shellOwnerTab as (k: never) => string | null) =>
    adminFocusGateOutcome({ search, visibleTabs, ownerTab: owner })

  it('no focus param -> nothing', () => {
    expect(gate('?tab=moderation', CM)).toBeNull()
  })

  it('owning tab shown -> nothing (the tab resolves it)', () => {
    expect(gate(`?tab=moderation&focus=post:${ID}`, CM)).toBeNull()
    expect(gate(`?tab=moderation&focus=safety_alert:${ID}`, ALL)).toBeNull()
    expect(gate(`?tab=events&focus=event:${ID}`, ORG_ONLY)).toBeNull()
  })

  it('forbidden: the tier does not show the owning tab', () => {
    expect(gate(`?tab=moderation&focus=post:${ID}`, ORG_ONLY)).toEqual({ kind: 'post', outcome: 'forbidden', tab: 'moderation' })
    expect(gate(`?tab=moderation&focus=safety_alert:${ID}`, ORG_ONLY)).toEqual({ kind: 'safety_alert', outcome: 'forbidden', tab: 'moderation' })
    expect(gate(`?tab=events&focus=event:${ID}`, CM)).toEqual({ kind: 'event', outcome: 'forbidden', tab: 'events' })
  })

  it('invalid: malformed focus, a repeated focus, or ?tab= that is not the owner', () => {
    expect(gate('?tab=moderation&focus=post:not-a-uuid', CM)).toEqual({ kind: 'unknown', outcome: 'invalid', tab: 'moderation' })
    expect(gate(`?tab=moderation&focus=nope:${ID}`, CM)).toEqual({ kind: 'unknown', outcome: 'invalid', tab: 'moderation' })
    expect(gate(`?tab=moderation&focus=post:${ID}&focus=post:${ID}`, CM)).toEqual({ kind: 'unknown', outcome: 'invalid', tab: 'moderation' })
    expect(gate(`?focus=post:${ID}`, CM)).toEqual({ kind: 'post', outcome: 'invalid', tab: 'unknown' })
    expect(gate(`?tab=events&focus=post:${ID}`, ALL)).toEqual({ kind: 'post', outcome: 'invalid', tab: 'events' })
  })

  it('organization page: only an event focus on its Events tab; anything else is invalid', () => {
    const ORG_TABS = ['overview', 'events', 'profile', 'members']
    expect(gate(`?tab=events&focus=event:${ID}`, ORG_TABS, orgPageOwnerTab)).toBeNull()
    expect(gate(`?tab=events&focus=post:${ID}`, ORG_TABS, orgPageOwnerTab)).toEqual({ kind: 'post', outcome: 'invalid', tab: 'events' })
    expect(gate(`?tab=profile&focus=event:${ID}`, ORG_TABS, orgPageOwnerTab)).toEqual({ kind: 'event', outcome: 'invalid', tab: 'profile' })
  })

  it('runAdminFocusGate writes its row once and strips the focus; nothing when a tab takes it', () => {
    const t = env(`?tab=moderation&focus=post:${ID}`)
    expect(runAdminFocusGate(t.e, { visibleTabs: ORG_ONLY, ownerTab: shellOwnerTab })).toEqual({ kind: 'post', outcome: 'forbidden', tab: 'moderation' })
    expect(t.rows).toEqual([{ kind: 'post', outcome: 'forbidden', tab: 'moderation' }])
    expect(t.url()).toBe('?tab=moderation')
    // A second run finds no focus left.
    expect(runAdminFocusGate(t.e, { visibleTabs: ORG_ONLY, ownerTab: shellOwnerTab })).toBeNull()
    expect(t.rows).toHaveLength(1)

    const taken = env(`?tab=moderation&focus=post:${ID}`)
    expect(runAdminFocusGate(taken.e, { visibleTabs: CM, ownerTab: shellOwnerTab })).toBeNull()
    expect(taken.rows).toEqual([])
    expect(taken.strips()).toBe(0)
  })

  it('exactly one writer per URL: the gate is silent exactly when the owning tab claims', () => {
    const searches = [
      `?tab=moderation&focus=post:${ID}`,
      `?tab=moderation&focus=safety_alert:${ID}`,
      `?tab=events&focus=event:${ID}`,
      `?tab=manage&focus=resource:${ID}`,
      '?tab=moderation&focus=junk',
    ]
    for (const visible of [ALL, CM, ORG_ONLY]) {
      for (const search of searches) {
        const gateRow = gate(search, visible)
        const owner = new URLSearchParams(search).get('focus')?.split(':')[0] ?? ''
        const ownerTab = owner in { post: 1, safety_alert: 1, event: 1, resource: 1 } ? shellOwnerTab(owner as never) : null
        const tabClaims = ownerTab !== null && visible.includes(ownerTab) && claimAdminFocus(env(search).e, [owner as never], ownerTab) !== null
        expect([gateRow !== null, tabClaims].filter(Boolean)).toHaveLength(1)
      }
    }
  })
})
