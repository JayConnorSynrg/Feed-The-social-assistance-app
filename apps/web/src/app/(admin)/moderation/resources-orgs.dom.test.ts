// @vitest-environment jsdom
// apps/web/src/app/(admin)/moderation/resources-orgs.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W4 (PR #255 round 3), with React's real scheduling in a real DOM (jsdom, createRoot, act):
//   - every announcement inserts exactly one new node in its live region — an identical repeat too
//     (announce() + AnnouncementText key each result by its sequence number; no timing involved);
//   - opening bulk approve moves focus to its Confirm in the same commit (useLayoutEffect);
//   - the walk-in stepper speaks one combined string per press from an sr-only polite region, the
//     visual number and word hidden from assistive tech.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  rpc: {} as Record<string, { data: unknown; error: unknown }>,
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/privileged-action', () => ({ privilegedRpc: async () => ({ data: null, error: null, requestId: 'RID' }) }))
vi.mock('@/hooks/use-admin-tier', () => ({ useAdminTier: () => ({ tier: 'platform_admin', loading: false }) }))
vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => null }))
vi.mock('@/components/map/map-view', () => ({ MapView: () => null }))
vi.mock('@/components/map/resource-marker', () => ({ ResourceMarker: () => null }))
const client = {
  auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
  rpc: async (fn: string) => h.rpc[fn] ?? { data: null, error: null },
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => client }))

import { OrganizerCheckinDisplay } from './organizer-checkin-display'
import { ResourcesTab } from './resources-tab'

const OCCURRENCE = { id: 'o1', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T17:00:00Z', event_title: 'Pantry', org_name: 'Org', time_zone: 'America/New_York' }
const ATTENDANCE = { confirmed: 0, early: 0, no_show: 0, anonymous_confirmed: 0, people_confirmed: 0, show_rate: null, ended: false, attendees: [] }
const queueRow = (id: string, name: string) => ({
  id, name, description: null, category: 'food', address: null, city: null, state: null, zip_code: null, phone: null, email: null, website: null,
  status: 'pending', discovery_metadata: { content_type: 'resource', source_url: null, confidence: 'high', corroborating_count: 2, authoritative_domain: false },
  lat: null, lng: null, service_mode: 'physical', geocode_accuracy: 'rooftop',
})

let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  h.rpc = {
    event_attendance: { data: ATTENDANCE, error: null },
    organizer_confirm: { data: null, error: null },
    admin_list_pending_resources: { data: [queueRow('r1', 'Pantry'), queueRow('r2', 'Clinic')], error: null },
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() })
}
const buttonByText = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined

describe('a repeated identical result inserts a new node in its live region', () => {
  it('two walk-ins in a row: the kiosk status line gets two insertions, each "Walk-in added"', async () => {
    await act(async () => root.render(el(OrganizerCheckinDisplay, { occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'en' })))
    await settle()
    const region = document.querySelector('[role="status"]') as HTMLElement
    expect(region).not.toBeNull()
    const inserted: string[] = []
    const observer = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) inserted.push(n.textContent ?? '')
    })
    observer.observe(region, { childList: true, subtree: true, characterData: true })
    for (let i = 0; i < 2; i++) {
      await act(async () => buttonByText('Add household')!.click())
      await settle()
    }
    await Promise.resolve()
    observer.disconnect()
    expect(inserted).toEqual(['Walk-in added', 'Walk-in added'])
    expect(region.textContent).toBe('Walk-in added')
  })
})

describe('bulk approve', () => {
  it('opening the confirmation puts focus on Confirm, described by the question', async () => {
    await act(async () => root.render(el(ResourcesTab, { locale: 'en' })))
    await settle()
    const open = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Bulk approve high-confidence'))!
    open.focus()
    await act(async () => open.click())
    const confirm = buttonByText('Confirm')!
    expect(document.activeElement).toBe(confirm)
    expect(confirm.getAttribute('aria-describedby')).toBe('resources-bulk-question')
    expect(document.getElementById('resources-bulk-question')?.textContent).toBe('Approve 2 high-confidence items?')
  })
})

describe('the walk-in stepper', () => {
  it('each press changes ONE sr-only polite string; the visual pair is aria-hidden', async () => {
    await act(async () => root.render(el(OrganizerCheckinDisplay, { occurrence: OCCURRENCE, open: true, onOpenChange: () => {}, locale: 'en' })))
    await settle()
    const live = document.querySelector('[data-testid="walkin-size-live"]') as HTMLElement
    expect([live.getAttribute('aria-live'), live.getAttribute('aria-atomic'), live.className]).toEqual(['polite', 'true', 'sr-only'])
    expect(live.textContent).toBe('1 person')
    expect(document.querySelector('[data-testid="walkin-size"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
    await act(async () => (document.querySelector('[data-testid="walkin-increase"]') as HTMLButtonElement).click())
    expect(live.textContent).toBe('2 people')
  })
})
