// apps/web/src/components/admin/client-admin-edit-link.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I3 — no admin link in server-rendered HTML: ClientAdminEditLink renders nothing on the server (and
// in the first, hydrating client render), even for a platform admin whose tier is already known. The
// /s/post page, feed cards, the Events tab and map popups all render their link through it.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/hooks/use-admin-viewer', () => ({
  useAdminViewer: () => ({ status: 'ready', tier: 'platform_admin', adminOrgIds: null }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() }, logEvent: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { ClientAdminEditLink } from './client-admin-edit-link'
import { AdminEditLink } from './admin-edit-link'
import { PostAdminEditLink } from '@/components/feed/post-admin-edit-link'
import { EventCardAdminMenu } from '@/components/events/event-card-admin-menu'
import { buildEventCards } from '@/components/feed/post-model'

const ID = '11111111-1111-4111-8111-111111111111'

describe('ClientAdminEditLink — never in server HTML', () => {
  it('control: the ungated link WOULD render for this platform admin', () => {
    expect(renderToStaticMarkup(h(AdminEditLink, { target: { kind: 'post', id: ID }, itemName: 'x', source: 'post_page' }))).toContain('<a ')
  })

  it('server render of the gated link and of the /s/post island: empty', () => {
    expect(renderToStaticMarkup(h(ClientAdminEditLink, { target: { kind: 'post', id: ID }, itemName: 'x', source: 'post_page' }))).toBe('')
    expect(renderToStaticMarkup(h(PostAdminEditLink, { postId: ID, content: 'x', source: 'post_page' }))).toBe('')
  })

  it("an event card's ⋯ menu (which holds the event's link): nothing in server HTML either", () => {
    const [event] = buildEventCards(
      [{ occurrenceId: 'o1' }],
      [{ id: 'o1', starts_at: '2099-01-01T10:00:00Z', ends_at: '2099-01-01T12:00:00Z', status: 'upcoming', event: { id: ID, org_id: ID, title: 'Pantry', event_type: 'pantry', location_name: null, city: null, state: null, requires_registration: false, time_zone: 'America/New_York', organization: null } }],
    )
    expect(renderToStaticMarkup(h(EventCardAdminMenu, { event, locale: 'en', source: 'feed_event_menu' }))).toBe('')
  })
})
