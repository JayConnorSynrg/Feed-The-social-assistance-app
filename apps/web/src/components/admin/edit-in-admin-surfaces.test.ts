// apps/web/src/components/admin/edit-in-admin-surfaces.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1 on every PR-5b member surface, rendered with react-dom/server: "Edit in admin" appears exactly
// for the viewers the target admin screen accepts and is absent for everyone else (members,
// logged-out visitors, guests, loading, error):
//   - post (feed card, /s/post, petitions are posts): community moderator and up;
//   - safety alert (map popup, feed Active Alerts): community moderator and up;
//   - event (feed event card, Events tab): platform admin, or an admin of THAT event's organization.
// Each link carries the contract URL for its item. The hydration gate is replaced by AdminEditLink
// itself here (its server render is proven empty in client-admin-edit-link.test.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AdminEditViewer } from '@/lib/admin-editability'

const { viewerRef, neededOrgs, closeSpy } = vi.hoisted(() => ({
  viewerRef: { current: null as unknown },
  neededOrgs: [] as boolean[],
  closeSpy: { calls: 0 },
}))
vi.mock('@/hooks/use-admin-viewer', () => ({
  useAdminViewer: (needsOrgs: boolean) => {
    neededOrgs.push(needsOrgs)
    return viewerRef.current
  },
}))
vi.mock('@/components/admin/client-admin-edit-link', async () => {
  const m = await import('@/components/admin/admin-edit-link')
  return { ClientAdminEditLink: m.AdminEditLink, useHydrated: () => true }
})
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
vi.mock('react-map-gl/mapbox', () => ({
  Marker: ({ children }: { children: unknown }) => children,
  Popup: ({ children }: { children: unknown }) => children,
}))
vi.mock('@/components/map/marker-popup', async (orig) => {
  const actual = await orig<typeof import('@/components/map/marker-popup')>()
  return {
    ...actual,
    // The popup is open (a click or a followed map deep link opened it).
    useMarkerPopup: () => ({
      open: true,
      setOpen: () => {},
      triggerRef: { current: null },
      titleId: 'alert-title',
      close: () => closeSpy.calls++,
      onPopupOpen: () => {},
    }),
  }
})

import { PostAdminEditLink, postAdminItemName } from '@/components/feed/post-admin-edit-link'
import { SafetyStrip, safetyStripItemName } from '@/components/feed/safety-strip'
import { postCardFrameClass } from '@/components/feed/post-card-frame'
import { EventCard, eventAdminSource } from '@/components/feed/event-card'
import { SafetyAlertMarker } from '@/components/map/safety-alert-marker'
import { MarkerPopupDialog } from '@/components/map/marker-popup'
import { buildEventCards, type EventOccurrenceRow } from '@/components/feed/post-model'
import type { SafetyAlert } from '@/hooks/use-safety-alerts'

const POST = '11111111-1111-4111-8111-111111111111'
const ALERT = '22222222-2222-4222-8222-222222222222'
const EVENT = '33333333-3333-4333-8333-333333333333'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const ready = (tier: AdminEditViewer['tier'], orgs: string[] | null = []): AdminEditViewer => ({
  status: 'ready',
  tier,
  adminOrgIds: orgs === null ? null : new Set(orgs),
})
const VIEWERS: Record<string, AdminEditViewer> = {
  logged_out_or_guest: ready(null),
  member: ready(null),
  loading: { status: 'loading', tier: null, adminOrgIds: null },
  error: { status: 'error', tier: null, adminOrgIds: null },
  community_moderator: ready('community_moderator'),
  resource_admin: ready('resource_admin'),
  platform_admin: ready('platform_admin', null),
  admin_of_event_org: ready(null, [ORG]),
  admin_of_other_org: ready(null, [OTHER_ORG]),
}

const alert: SafetyAlert = {
  id: ALERT,
  alert_type: 'road_closure',
  severity: 3,
  description: 'Bridge out',
  lng: -72.6,
  lat: 44.2,
  status: 'live',
  confirm_count: 1,
  clear_count: 0,
  is_mine: false,
  created_at: '2026-10-08T18:00:00.000Z',
  expires_at: '2026-10-08T21:00:00.000Z',
  verified: false,
}

const occ: EventOccurrenceRow = {
  id: 'occ-1',
  starts_at: '2026-10-24T14:00:00Z',
  ends_at: '2026-10-24T16:00:00Z',
  status: 'upcoming',
  notes: null,
  capacity: null,
  source: 'rule',
  event: {
    id: EVENT,
    org_id: ORG,
    title: 'Saturday pantry',
    event_type: 'pantry',
    location_name: 'Hall',
    city: 'Rutland',
    state: 'VT',
    requires_registration: false,
    time_zone: 'America/New_York',
    recurrence: null,
    organization: { name: 'Pantry Org' },
  },
}
const [eventItem] = buildEventCards([{ occurrenceId: 'occ-1' }], [occ])

const SURFACES = {
  post_feed_card: () => h(PostAdminEditLink, { postId: POST, content: 'Need a ride', source: 'feed_post' }),
  post_page: () => h(PostAdminEditLink, { postId: POST, content: 'Need a ride', source: 'post_page' }),
  alert_feed_strip: () => h(SafetyStrip, { alerts: [alert], onViewMap: () => {}, formatAge: () => '1h ago' }),
  alert_map_popup: () => h(SafetyAlertMarker, { alert, onVote: async () => {} }),
  event_feed_card: () =>
    h(EventCard, { event: eventItem, locale: 'en', surface: 'feed', myStatus: 'none', anonymousClaimed: false, onCheckedIn: () => {}, now: Date.parse('2026-10-22T14:00:00Z'), viewerTz: 'America/New_York' }),
  event_events_tab: () =>
    h(EventCard, { event: eventItem, locale: 'en', surface: 'events-tab', myStatus: 'none', anonymousClaimed: false, onCheckedIn: () => {}, now: Date.parse('2026-10-22T14:00:00Z'), viewerTz: 'America/New_York' }),
}

function linkHrefs(html: string): string[] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*target="feed-admin"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
}

beforeEach(() => {
  neededOrgs.length = 0
  closeSpy.calls = 0
})

describe('I1 — present exactly for the viewers the admin screen accepts', () => {
  const POST_URL = `/moderation?tab=moderation&focus=post:${POST}`
  const ALERT_URL = `/moderation?tab=moderation&focus=safety_alert:${ALERT}`
  const EVENT_PA = `/moderation?tab=events&focus=event:${EVENT}`
  const EVENT_ORG = `/moderation/org/${ORG}?tab=events&focus=event:${EVENT}`
  // Expected link per viewer (columns: post, alert, event); '' = no link.
  const EXPECTED: Record<string, [string, string, string]> = {
    logged_out_or_guest: ['', '', ''],
    member: ['', '', ''],
    loading: ['', '', ''],
    error: ['', '', ''],
    community_moderator: [POST_URL, ALERT_URL, ''],
    resource_admin: [POST_URL, ALERT_URL, ''],
    platform_admin: [POST_URL, ALERT_URL, EVENT_PA],
    admin_of_event_org: ['', '', EVENT_ORG],
    admin_of_other_org: ['', '', ''],
  }
  const column: Record<keyof typeof SURFACES, 0 | 1 | 2> = {
    post_feed_card: 0,
    post_page: 0,
    alert_feed_strip: 1,
    alert_map_popup: 1,
    event_feed_card: 2,
    event_events_tab: 2,
  }

  for (const [viewerName, viewer] of Object.entries(VIEWERS)) {
    for (const [surface, el] of Object.entries(SURFACES) as Array<[keyof typeof SURFACES, () => ReturnType<typeof h>]>) {
      const want = EXPECTED[viewerName][column[surface]]
      it(`${surface} × ${viewerName}: ${want ? 'link' : 'no link'}`, () => {
        viewerRef.current = viewer
        expect(linkHrefs(renderToStaticMarkup(el()))).toEqual(want ? [want] : [])
      })
    }
  }

  it('event links ask for the administered-organization list; post and alert links never do', () => {
    viewerRef.current = VIEWERS.member
    renderToStaticMarkup(SURFACES.post_feed_card())
    renderToStaticMarkup(SURFACES.alert_feed_strip())
    expect(neededOrgs.every((n) => n === false)).toBe(true)
    neededOrgs.length = 0
    renderToStaticMarkup(SURFACES.event_feed_card())
    expect(neededOrgs).toEqual([true])
  })
})

describe('surface details', () => {
  it('the feed strip: each alert is a real <button> named by its visible text; the link is its sibling', () => {
    viewerRef.current = VIEWERS.community_moderator
    const html = renderToStaticMarkup(SURFACES.alert_feed_strip())
    const button = html.indexOf(`data-testid="safety-strip-item-${ALERT}"`)
    const link = html.indexOf(`data-testid="admin-edit-alert-${ALERT}"`)
    expect(button).toBeGreaterThan(-1)
    expect(link).toBeGreaterThan(button)
    // A <button> element (no div role=button, no aria-label overriding its text) that closes before the link.
    const open = html.slice(html.lastIndexOf('<', button), html.indexOf('>', button) + 1)
    expect(open).toMatch(/^<button type="button"/)
    expect(open).not.toMatch(/aria-label|role=/)
    expect(html.slice(button, link)).toMatch(/<\/button><a [^>]*$/)
    expect(html.slice(button, link)).not.toMatch(/<(div|p)\b/)
  })

  it('the feed strip: 5 alerts of 4 types get 5 distinct link names (age + description start)', () => {
    viewerRef.current = VIEWERS.community_moderator
    const alerts = [
      { ...alert, id: '22222222-2222-4222-8222-000000000001', alert_type: 'road_closure' as const, description: 'Bridge out on Main Street near the old mill and the river crossing' },
      { ...alert, id: '22222222-2222-4222-8222-000000000002', alert_type: 'road_closure' as const, description: 'Route 4 closed' },
      { ...alert, id: '22222222-2222-4222-8222-000000000003', alert_type: 'weather' as const, description: null },
      { ...alert, id: '22222222-2222-4222-8222-000000000004', alert_type: 'speeding' as const, description: null },
      { ...alert, id: '22222222-2222-4222-8222-000000000005', alert_type: 'general' as const, description: 'Downed line' },
    ]
    const ages = ['5m ago', '1h ago', '2h ago', '3h ago', '4h ago']
    let i = 0
    const html = renderToStaticMarkup(h(SafetyStrip, { alerts, onViewMap: () => {}, formatAge: () => ages[i++ % 5] }))
    const names = [...html.matchAll(/aria-label="Edit in admin: ([^"]*) \(opens/g)].map((m) => m[1])
    expect(names).toHaveLength(5)
    expect(new Set(names).size).toBe(5)
    expect(names[0]).toMatch(/^Road Closure, 5m ago: Bridge out on Main Street/)
    expect(names[0].split(': ')[1]).toHaveLength(40) // 39 characters + …
    expect(names[2]).toBe('Weather Hazard, 2h ago')
    expect(safetyStripItemName('Road Closure', '  Route   4 closed ', '1h ago')).toBe('Road Closure, 1h ago: Route 4 closed')
  })

  it('map popup: the link is inside the dialog, Tab-reachable, and Escape on the dialog still closes it', () => {
    viewerRef.current = VIEWERS.community_moderator
    const html = renderToStaticMarkup(SURFACES.alert_map_popup())
    const dialog = html.indexOf('role="dialog"')
    const link = html.indexOf(`data-testid="admin-edit-alert-${ALERT}"`)
    expect(dialog).toBeGreaterThan(-1)
    expect(link).toBeGreaterThan(dialog)
    expect(html.slice(link - 400, link + 400)).not.toMatch(/<a [^>]*tabindex="-1"/)
    // Escape pressed on the link bubbles to the dialog's own key handler, which closes the popup.
    let closed = 0
    let stopped = 0
    const el = MarkerPopupDialog({ titleId: 't', onClose: () => closed++, children: null }) as {
      props: { onKeyDown: (e: { key: string; stopPropagation: () => void }) => void }
    }
    el.props.onKeyDown({ key: 'Escape', stopPropagation: () => stopped++ })
    el.props.onKeyDown({ key: 'Tab', stopPropagation: () => stopped++ })
    expect([closed, stopped]).toEqual([1, 1])
  })

  it('the event card link names the event; feed vs Events tab are separate sources', () => {
    viewerRef.current = VIEWERS.platform_admin
    expect(renderToStaticMarkup(SURFACES.event_feed_card())).toMatch(/aria-label="Edit in admin: Saturday pantry/)
    expect(eventAdminSource('feed')).toBe('feed_event')
    expect(eventAdminSource('events-tab')).toBe('events_panel')
  })

  it('post item name: the start of the text, collapsed and capped', () => {
    expect(postAdminItemName('  Need\n a   ride ')).toBe('Need a ride')
    expect(postAdminItemName('x'.repeat(80))).toHaveLength(58)
    // An image-only post: "post by <author>, <date>" instead of an empty name.
    expect(postAdminItemName(null, 'Ada', '2026-10-01T12:00:00Z')).toBe('post by Ada, Oct 1, 2026')
    expect(postAdminItemName('   ', 'Ada', new Date('2026-10-01T12:00:00Z'))).toBe('post by Ada, Oct 1, 2026')
    expect(postAdminItemName(null)).toBe('post by a member')
    viewerRef.current = VIEWERS.community_moderator
    expect(renderToStaticMarkup(h(PostAdminEditLink, { postId: POST, content: '', author: 'Ada', createdAt: '2026-10-01T12:00:00Z', source: 'post_page' }))).toContain(
      'aria-label="Edit in admin: post by Ada, Oct 1, 2026 (opens in the admin tab)"'
    )
  })
})

describe('wiring: each surface renders its link through the hydration-gated component', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('the feed PostCard renders PostAdminEditLink for its post; the strip is SafetyStrip', () => {
    const src = read('../panels/feed-panel.tsx')
    const start = src.indexOf('function PostCard(')
    const card = src.slice(start, src.indexOf('\nexport function FeedPanel(', start))
    expect(card).toContain('<PostAdminEditLink postId={post.id} content={post.content} author={post.author.name} createdAt={post.timestamp} source="feed_post" />')
    // The action row is exempt from the hidden-post dimming.
    expect(card).toMatch(/<div data-card-actions="" [^>]*>\s*<PostAdminEditLink/)
    expect(card).toContain('<div className={postCardFrameClass(effectivelyHidden)}>')
    expect(src).toMatch(/<SafetyStrip\s+alerts=\{safetyAlerts\}/)
  })

  it('/s/post (a server component) renders the client island, with the page source', () => {
    const src = read('../../app/(social)/s/post/[id]/page.tsx')
    expect(src).not.toMatch(/^'use client'/)
    expect(src).toContain('<PostAdminEditLink postId={post.id} content={post.content} author={displayName} createdAt={post.created_at} source="post_page" />')
  })

  it.each([
    ['../feed/post-admin-edit-link.tsx'],
    ['../feed/safety-strip.tsx'],
    ['../feed/event-card.tsx'],
    ['../map/safety-alert-marker.tsx'],
  ])('%s uses ClientAdminEditLink (never the ungated AdminEditLink)', (file) => {
    const src = read(file)
    expect(src).toMatch(/<ClientAdminEditLink\b/)
    expect(src).not.toMatch(/<AdminEditLink\b/)
  })

  it('the Events tab renders the shared EventCard (so it carries the link)', () => {
    expect(read('../panels/events-panel.tsx')).toMatch(/<EventCard\b[\s\S]*surface="events-tab"/)
  })
})

describe('hidden-post card: dim the content, not the action row', () => {
  it('a hidden card dims every child except [data-card-actions]; no whole-card opacity', () => {
    const hidden = postCardFrameClass(true).split(/\s+/)
    expect(hidden).toContain('[&>*:not([data-card-actions])]:opacity-70')
    expect(hidden).not.toContain('opacity-70')
    expect(postCardFrameClass(false)).not.toMatch(/opacity/)
  })
})

