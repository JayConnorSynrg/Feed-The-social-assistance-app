// apps/web/src/lib/admin-url.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 — the admin URL contract PR-5a/5b consume verbatim. Each kind's exact URL, the
// platform-admin vs organization-admin split for organizations and events, and that every `?tab=`
// is a tab the admin screen knows.

import { describe, it, expect } from 'vitest'
import { adminEditUrl, ADMIN_FOCUS_KINDS, ADMIN_FOCUS_TAB } from './admin-url'
import { TAB_ORDER } from '@/app/(admin)/moderation/admin-shell-tabs'
import { ORG_ADMIN_TABS } from '@/app/(admin)/moderation/admin-tab-url'

const ID = '11111111-1111-4111-8111-111111111111'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('adminEditUrl — the contract', () => {
  it('resource / business / safety alert / post open their tab with focus=<kind>:<uuid>', () => {
    expect(adminEditUrl({ kind: 'resource', id: ID }, 'resource_admin')).toBe(`/moderation?tab=manage&focus=resource:${ID}`)
    expect(adminEditUrl({ kind: 'business', id: ID }, 'platform_admin')).toBe(`/moderation?tab=businesses&focus=business:${ID}`)
    expect(adminEditUrl({ kind: 'safety_alert', id: ID }, 'community_moderator')).toBe(
      `/moderation?tab=moderation&focus=safety_alert:${ID}`
    )
    expect(adminEditUrl({ kind: 'post', id: ID }, 'community_moderator')).toBe(`/moderation?tab=moderation&focus=post:${ID}`)
  })

  it('organization: platform admin -> the shell panel (?org=); anyone else -> the organization admin page Profile tab', () => {
    expect(adminEditUrl({ kind: 'organization', id: ORG }, 'platform_admin')).toBe(`/moderation?tab=organizations&org=${ORG}`)
    expect(adminEditUrl({ kind: 'organization', id: ORG }, null)).toBe(`/moderation/org/${ORG}?tab=profile`)
    expect(adminEditUrl({ kind: 'organization', id: ORG }, 'resource_admin')).toBe(`/moderation/org/${ORG}?tab=profile`)
  })

  it('event: platform admin -> the shell Events tab; anyone else -> their organization page Events tab', () => {
    expect(adminEditUrl({ kind: 'event', id: ID, orgId: ORG }, 'platform_admin')).toBe(`/moderation?tab=events&focus=event:${ID}`)
    expect(adminEditUrl({ kind: 'event', id: ID, orgId: ORG }, 'community_moderator')).toBe(
      `/moderation/org/${ORG}?tab=events&focus=event:${ID}`
    )
  })

  it('every focus tab exists on the screen it targets', () => {
    for (const kind of ADMIN_FOCUS_KINDS) expect(TAB_ORDER as readonly string[]).toContain(ADMIN_FOCUS_TAB[kind])
    expect(ORG_ADMIN_TABS as readonly string[]).toContain('events')
    expect(ORG_ADMIN_TABS as readonly string[]).toContain('profile')
    expect(TAB_ORDER as readonly string[]).toContain('organizations')
  })

  it('a hostile id cannot add params (it is percent-encoded)', () => {
    expect(adminEditUrl({ kind: 'post', id: 'x&tab=people' }, 'platform_admin')).toBe(
      '/moderation?tab=moderation&focus=post:x%26tab%3Dpeople'
    )
  })
})
