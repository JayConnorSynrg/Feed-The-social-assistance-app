// apps/web/src/components/feed/event-card-menu.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// R1 invariant 1a/1b — what an event card's ⋯ menu offers, by viewer and by the state of the card's
// shown date: exactly the viewers "Edit in admin" accepts for an event (platform admin, or an admin
// of THAT event's organization) get Edit event / Add dates / Cancel date / Edit in admin; Cancel
// date mirrors the scheduler (not cancelled, not ended) and otherwise says why.

import { describe, it, expect } from 'vitest'
import { cancelDateUnavailable, eventMenuEntries } from './event-card-menu'
import type { AdminEditViewer } from '@/lib/admin-editability'

const EVENT = '33333333-3333-4333-8333-333333333333'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = Date.parse('2026-10-24T15:00:00Z')

const ready = (tier: AdminEditViewer['tier'], orgs: string[] | null = []): AdminEditViewer => ({
  status: 'ready',
  tier,
  adminOrgIds: orgs === null ? null : new Set(orgs),
})
const upcoming = { eventId: EVENT, orgId: ORG, cancelledShown: null, status: 'upcoming', endsAt: '2026-10-24T16:00:00Z' } as const

describe('who gets the menu', () => {
  const ALL = ['edit', 'add_dates', 'cancel_date', 'open_admin']
  it.each([
    ['logged out / guest / member', ready(null), []],
    ['loading', { status: 'loading', tier: null, adminOrgIds: null } as AdminEditViewer, []],
    ['error', { status: 'error', tier: null, adminOrgIds: null } as AdminEditViewer, []],
    ['community moderator', ready('community_moderator'), []],
    ['resource admin', ready('resource_admin'), []],
    ['admin of another organization', ready(null, [OTHER]), []],
    ['platform admin', ready('platform_admin', null), ALL],
    ['admin of the event organization', ready(null, [ORG]), ALL],
    ['admin of the event organization (id case differs)', ready(null, [ORG.toLowerCase()]), ALL],
  ])('%s', (_n, viewer, want) => {
    expect(eventMenuEntries({ ...upcoming, orgId: ORG.toUpperCase() }, viewer, NOW).map((e) => e.action)).toEqual(want)
  })
})

describe('Cancel date follows the scheduler rule for the card\'s shown date', () => {
  it.each([
    ['upcoming, not started', { endsAt: '2026-10-24T18:00:00Z' }, null],
    ['in progress (not ended)', { endsAt: '2026-10-24T15:00:00Z' }, null],
    ['ended a minute ago', { endsAt: '2026-10-24T14:59:00Z' }, 'ended'],
    ['completed', { status: 'completed' }, 'ended'],
    ['shown date cancelled, next date timed', { cancelledShown: 'next' }, 'cancelled'],
    ['shown date cancelled, no next date', { cancelledShown: 'none' }, 'cancelled'],
    ['shown date cancelled, next unknown', { cancelledShown: 'unknown' }, 'cancelled'],
  ] as const)('%s → %s', (_n, patch, want) => {
    expect(cancelDateUnavailable({ ...upcoming, ...patch } as never, NOW)).toBe(want)
    const entry = eventMenuEntries({ ...upcoming, ...patch } as never, ready('platform_admin', null), NOW).find((e) => e.action === 'cancel_date')
    expect(entry).toEqual({ action: 'cancel_date', unavailable: want })
  })
})
