// apps/web/src/app/(admin)/moderation/safety-alerts-review.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The admin safety-alert review, rendered with react-dom/server (no DOM in this suite):
//   - loading is announced (role="status" + a name; the spinner icon is hidden from assistive tech);
//   - an error is an alert (role="alert"), so a failed approve/remove is announced;
//   - each live, unexpired row links to its pin on the members' map (/#map?focus=safety_alert:<id>),
//     and a row the map would not show (past expiry) gets the reason instead of a link (M1).

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { SafetyAlertsReviewView, type LiveAlert, type SafetyAlertsReviewViewProps } from './safety-alerts-review'

const ID = '55555555-5555-4555-8555-555555555555'
const NOW = new Date('2026-10-08T19:00:00.000Z')
const live: LiveAlert = {
  id: ID,
  status: 'live',
  alert_type: 'road_closure',
  severity: 3,
  description: 'Bridge out',
  confirm_count: 2,
  clear_count: 0,
  created_at: '2026-10-08T18:00:00.000Z',
  expires_at: '2026-10-08T21:00:00.000Z',
  verified: false,
}
const base: SafetyAlertsReviewViewProps = {
  alerts: [live],
  loading: false,
  error: null,
  approvingId: null,
  removingId: null,
  now: NOW,
  onApprove: () => {},
  onRemove: () => {},
}
const render = (over: Partial<SafetyAlertsReviewViewProps> = {}) => renderToStaticMarkup(h(SafetyAlertsReviewView, { ...base, ...over }))

describe('SafetyAlertsReviewView — a11y', () => {
  it('loading is a status region whose announced text is in the region (not an aria-label)', () => {
    const html = render({ loading: true })
    expect(html).toMatch(/^<div role="status"[^>]*>/)
    expect(html).not.toMatch(/^<div role="status"[^>]*aria-label/)
    expect(html).toMatch(/<span class="sr-only">Loading safety alerts<\/span><\/div>$/)
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('an error banner is role="alert"; no banner without an error', () => {
    expect(render({ error: 'Remove failed' })).toMatch(/<div role="alert"[^>]*>Remove failed<\/div>/)
    expect(render()).not.toContain('role="alert"')
  })
})

describe('SafetyAlertsReviewView — View on map', () => {
  it('a live, unexpired alert links to its pin in the reused feed-preview tab', () => {
    const html = render()
    const anchor = (html.match(/<a [^>]*>/g) ?? []).find((a) => a.includes('#map'))
    expect(anchor).toContain(`href="/#map?focus=safety_alert:${ID}"`)
    expect(anchor).toContain('target="feed-preview"')
    expect(anchor).toContain('aria-label="View on map: Road Closure, High (opens in the feed preview tab)"')
  })

  it('an alert past expires_at gets the reason and no map link', () => {
    const html = render({ alerts: [{ ...live, expires_at: '2026-10-08T18:59:00.000Z' }] })
    expect(html).not.toContain('#map?focus')
    expect(html).toContain('Expired — not on the map')
  })
})
