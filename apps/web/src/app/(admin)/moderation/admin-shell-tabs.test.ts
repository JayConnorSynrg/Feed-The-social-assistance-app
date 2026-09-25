// admin-shell-tabs.test.ts — tier -> visible admin tabs (pure). Mirrors design §5.
import { describe, it, expect } from 'vitest'
import { visibleTabs } from './admin-shell-tabs'
import type { AdminTier } from '@/lib/admin-tier'

const CM: AdminTier = 'community_moderator'
const RA: AdminTier = 'resource_admin'
const PA: AdminTier = 'platform_admin'

const set = (a: string[]) => [...a].sort()

describe('visibleTabs', () => {
  it('CM sees Moderation only', () => {
    expect(set(visibleTabs(CM, false))).toEqual(set(['moderation']))
  })
  it('CM + org admin adds Events', () => {
    expect(set(visibleTabs(CM, true))).toEqual(set(['events', 'moderation']))
  })
  it('RA adds the resource queue, manage and people (Discover/forms stay PA, inside Resources)', () => {
    expect(set(visibleTabs(RA, false))).toEqual(set(['moderation', 'resources', 'manage', 'people']))
  })
  it('RA + org admin also sees Events', () => {
    expect(set(visibleTabs(RA, true))).toEqual(
      set(['events', 'moderation', 'resources', 'manage', 'people']),
    )
  })
  it('PA sees every tab', () => {
    expect(set(visibleTabs(PA, false))).toEqual(
      set(['overview', 'events', 'moderation', 'community', 'organizations', 'resources', 'manage', 'people', 'settings']),
    )
  })
  it('an org-admin with no tier sees Events only', () => {
    expect(set(visibleTabs(null, true))).toEqual(set(['events']))
  })
  it('a plain user with no tier and no org sees nothing', () => {
    expect(visibleTabs(null, false)).toEqual([])
  })
})
