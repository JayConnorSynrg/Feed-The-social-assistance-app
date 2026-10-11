// apps/web/src/app/(admin)/moderation/safety-alerts-review.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The admin safety-alert review, rendered with react-dom/server (no DOM in this suite):
//   - loading is announced (role="status" + a name; the spinner icon is hidden from assistive tech);
//   - an error is an alert (role="alert"), so a failed approve/remove is announced;
//   - each shown row links to its pin on the members' map (/#map?focus=safety_alert:<id>), and a row
//     the map would not show (past expiry) gets the reason instead of a link (M1);
//   - Release 3.1: a resolved alert is labelled, never counted as live and cannot be verified; no
//     self-moderation — a moderator gets no Approve on an alert they reported; the type and severity
//     names are the alert dictionary's (one source with the member surfaces).

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { alertMessages } from '@/lib/i18n-feed-alerts'
import { ALERT_TYPES } from '@/lib/safety-alert-rpc'
import {
  SafetyAlertsReviewView,
  canVerifyAlert,
  moderationFailure,
  sortForReview,
  type ReviewAlert,
  type SafetyAlertsReviewViewProps,
} from './safety-alerts-review'

const ID = '55555555-5555-4555-8555-555555555555'
const NOW = new Date('2026-10-08T19:00:00.000Z')
const live: ReviewAlert = {
  id: ID,
  status: 'live',
  alert_type: 'road_closure',
  severity: 3,
  description: 'Bridge out',
  lng: -72.97,
  lat: 43.61,
  confirm_count: 2,
  clear_count: 0,
  created_at: '2026-10-08T18:00:00.000Z',
  expires_at: '2026-10-08T21:00:00.000Z',
  verified: false,
  is_mine: false,
  version: 1,
  updated_at: null,
  update_count: 0,
  resolved_at: null,
}
const RESOLVED_ID = '66666666-6666-4666-8666-666666666666'
const resolved: ReviewAlert = { ...live, id: RESOLVED_ID, status: 'resolved', resolved_at: '2026-10-08T18:30:00.000Z', version: 2 }
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
    // After the (empty) linked-alert region, which is rendered in every state.
    expect(html).toMatch(/<\/p><div role="status"[^>]*>/)
    expect(html).not.toMatch(/<div role="status"[^>]*aria-label/)
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

describe('SafetyAlertsReviewView — live and resolved (the shown rule)', () => {
  it('a resolved alert is labelled, has no Approve, keeps Remove and its map link, and is not counted as live', () => {
    const html = render({ alerts: [live, resolved] })
    expect(html).toMatch(new RegExp(`data-testid="admin-alert-resolved-${RESOLVED_ID}"[^>]*>Resolved<`))
    expect(html).not.toContain(`admin-approve-alert-${RESOLVED_ID}`)
    expect(html).toContain(`admin-remove-alert-${RESOLVED_ID}`)
    expect(html).toContain(`href="/#map?focus=safety_alert:${RESOLVED_ID}"`)
    expect(html).toMatch(/data-testid="alert-review-count"[^>]*>1 live alert · 1 resolved</)
    expect(html).toContain(`admin-approve-alert-${ID}`)
  })

  it('a resolved alert past its six hours gets no map link (members no longer see it)', () => {
    const html = render({ alerts: [{ ...resolved, resolved_at: '2026-10-08T13:00:00.000Z' }] })
    expect(html).not.toContain('#map?focus')
    expect(html).toMatch(/data-testid="alert-review-count"[^>]*>0 live alerts</)
  })

  it('review order: live first, then resolved; newest first within each', () => {
    const older = { ...live, id: 'older', created_at: '2026-10-08T17:00:00.000Z' }
    expect(sortForReview([resolved, older, live], NOW.getTime()).map((a) => a.id)).toEqual([ID, 'older', RESOLVED_ID])
  })
})

describe('SafetyAlertsReviewView — no self-moderation', () => {
  it('a moderator gets Approve on someone else’s unverified live alert', () => {
    expect(canVerifyAlert(live, NOW.getTime())).toBe(true)
    expect(render()).toContain(`admin-approve-alert-${ID}`)
  })

  it('a moderator who reported the alert gets no Approve (and is told why); Remove stays', () => {
    const own = { ...live, is_mine: true }
    expect(canVerifyAlert(own, NOW.getTime())).toBe(false)
    const html = render({ alerts: [own] })
    expect(html).not.toContain(`admin-approve-alert-${ID}`)
    expect(html).toMatch(new RegExp(`data-testid="admin-own-alert-${ID}"[^>]*>You reported this alert: another moderator verifies it\\.<`))
    expect(html).toContain(`admin-remove-alert-${ID}`)
  })

  it('a verified alert has no Approve; an expired or resolved one cannot be verified', () => {
    expect(render({ alerts: [{ ...live, verified: true }] })).not.toContain('admin-approve-alert')
    expect(canVerifyAlert({ ...live, expires_at: '2026-10-08T18:59:00.000Z' }, NOW.getTime())).toBe(false)
    expect(canVerifyAlert(resolved, NOW.getTime())).toBe(false)
  })

  it('a refused action says what happened, and re-reads only when the list is stale', () => {
    expect(moderationFailure('verify', { kind: 'forbidden', token: 'self_moderation_refused' })).toEqual({
      message: 'You reported this alert, so another moderator has to verify it.',
      reread: false,
    })
    expect(moderationFailure('verify', { kind: 'conflict', currentVersion: 4, updatedAt: null })).toMatchObject({ reread: true })
    expect(moderationFailure('remove', { kind: 'not_live', resolved: false })).toMatchObject({ reread: true })
    expect(moderationFailure('remove', { kind: 'unknown', code: 'XX000' })).toEqual({ message: 'Remove failed', reread: false })
  })
})

describe('SafetyAlertsReviewView — one source of alert names', () => {
  it.each(ALERT_TYPES.map((t) => [t]))('%s: the card title and the link name are the dictionary’s English labels', (type) => {
    const key = ({ weather: 'typeWeather', road_closure: 'typeRoadClosure', speeding: 'typeSpeeding', general: 'typeGeneral' } as const)[type]
    const html = render({ alerts: [{ ...live, alert_type: type, severity: 4 }] })
    expect(html).toContain(`>${alertMessages.en[key]}</`)
    expect(html).toContain(`>${alertMessages.en.sevCritical}</span>`)
    expect(html).toContain(`aria-label="View on map: ${alertMessages.en[key]}, ${alertMessages.en.sevCritical} (opens in the feed preview tab)"`)
  })

  it('member-written text keeps its own direction', () => {
    expect(render()).toContain('<p lang="" dir="auto" class="text-sm text-stone-700 mb-3">Bridge out</p>')
  })
})
