// apps/web/src/lib/admin-editability.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1 — an "Edit in admin" link appears exactly when the admin screen will accept it. The full
// viewer × kind matrix below is the server gate table (docs/admin-tiers.md "Admin edit links"),
// written out cell by cell so a change to either side is a visible diff:
//   post / safety_alert  tier >= community_moderator
//   resource             tier >= resource_admin
//   business             platform admin (canEditBusinesses)
//   organization         platform admin, or an admin of THAT organization
//   event                platform admin, or an admin of the event's organization
// Fail closed: loading, error, logged out, guest, plain member, unknown tier.

import { describe, it, expect } from 'vitest'
import { canEditInAdmin, needsAdminOrgIds, type AdminEditViewer } from './admin-editability'
import type { AdminEditTarget } from './admin-url'
import type { AdminTier } from './admin-tier'

const X = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // an organization the org admin administers
const Y = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // an organization nobody here administers
const ID = '11111111-1111-4111-8111-111111111111'

const targets: Record<string, AdminEditTarget> = {
  post: { kind: 'post', id: ID },
  safety_alert: { kind: 'safety_alert', id: ID },
  resource: { kind: 'resource', id: ID },
  business: { kind: 'business', id: ID },
  org_X: { kind: 'organization', id: X },
  org_Y: { kind: 'organization', id: Y },
  event_X: { kind: 'event', id: ID, orgId: X },
  event_Y: { kind: 'event', id: ID, orgId: Y },
}

const ready = (tier: AdminTier | null, orgs: string[] | null = []): AdminEditViewer => ({
  status: 'ready',
  tier,
  adminOrgIds: orgs === null ? null : new Set(orgs),
})

const viewers: Record<string, AdminEditViewer> = {
  // useAdminViewer resolves a logged-out visitor and a guest to this (no RPC, no tier, no orgs).
  logged_out_or_guest: ready(null),
  member: ready(null),
  community_moderator: ready('community_moderator'),
  resource_admin: ready('resource_admin'),
  // A platform admin's organization list is never fetched (null).
  platform_admin: ready('platform_admin', null),
  org_admin_X: ready(null, [X]),
  moderator_and_org_admin_X: ready('community_moderator', [X]),
  resource_admin_and_org_admin_X: ready('resource_admin', [X]),
  loading: { status: 'loading', tier: 'platform_admin', adminOrgIds: new Set([X]) },
  error: { status: 'error', tier: 'platform_admin', adminOrgIds: new Set([X]) },
  unknown_tier: ready('steward' as AdminTier),
  org_list_not_loaded: ready(null, null),
}

// Expected link presence. Columns: post, safety_alert, resource, business, org_X, org_Y, event_X, event_Y
const COLS = ['post', 'safety_alert', 'resource', 'business', 'org_X', 'org_Y', 'event_X', 'event_Y'] as const
const EXPECTED: Record<keyof typeof viewers, string> = {
  logged_out_or_guest:            '0 0 0 0 0 0 0 0',
  member:                         '0 0 0 0 0 0 0 0',
  community_moderator:            '1 1 0 0 0 0 0 0',
  resource_admin:                 '1 1 1 0 0 0 0 0',
  platform_admin:                 '1 1 1 1 1 1 1 1',
  org_admin_X:                    '0 0 0 0 1 0 1 0',
  moderator_and_org_admin_X:      '1 1 0 0 1 0 1 0',
  resource_admin_and_org_admin_X: '1 1 1 0 1 0 1 0',
  loading:                        '0 0 0 0 0 0 0 0',
  error:                          '0 0 0 0 0 0 0 0',
  unknown_tier:                   '0 0 0 0 0 0 0 0',
  org_list_not_loaded:            '0 0 0 0 0 0 0 0',
}

describe('canEditInAdmin — viewer × kind matrix (I1, both directions)', () => {
  for (const [name, viewer] of Object.entries(viewers)) {
    it(`${name}: ${EXPECTED[name]}`, () => {
      const got = COLS.map((c) => (canEditInAdmin(targets[c], viewer) ? '1' : '0')).join(' ')
      expect(got).toBe(EXPECTED[name])
    })
  }

  it('organization ids match case-insensitively (Postgres prints lower case; a link may carry upper)', () => {
    const viewer = ready(null, [X])
    expect(canEditInAdmin({ kind: 'organization', id: X.toUpperCase() }, viewer)).toBe(true)
    expect(canEditInAdmin({ kind: 'event', id: ID, orgId: X.toUpperCase() }, viewer)).toBe(true)
  })

  it('an event is gated on its organization, not on the event id', () => {
    expect(canEditInAdmin({ kind: 'event', id: X, orgId: Y }, ready(null, [X]))).toBe(false)
  })
})

describe('needsAdminOrgIds — only organization and event links fetch the organization list', () => {
  it('is true exactly for organization and event', () => {
    expect(COLS.map((c) => targets[c].kind).filter((k, i, a) => a.indexOf(k) === i).filter(needsAdminOrgIds)).toEqual([
      'organization',
      'event',
    ])
  })
})
