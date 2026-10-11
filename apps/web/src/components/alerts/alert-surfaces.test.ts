// apps/web/src/components/alerts/alert-surfaces.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The alert surfaces rendered with react-dom/server (the REAL strip, marker popup, history list and
// AdminEditLink; only the viewer lookup, react-map-gl and the popup's open state are stubbed):
//   - who gets which control, per viewer — guest, member, owner, moderator, moderator-owner
//     (invariant 2: owner actions come from the server's is_mine; a guest never owns or votes);
//   - live vs resolved vs no-longer-listed: a resolved alert says "Resolved", takes no vote and no
//     update (invariant 1);
//   - what changed is visible: "Updated …", a full date and time, the expiry (invariant 4);
//   - language: the viewer's locale, own lang / dir on the popup, member text with dir="auto" and an
//     empty lang, and every accessible name starting with its visible text in all 14 locales
//     (invariant 6);
//   - severity as a word, a text label for resolved, the two live regions and what each says, and
//     24 px targets (invariant 7);
//   - fix round: the server's verdict (not the clock) decides what each surface draws; the marker and
//     its popup carry their own lang / dir; the marker face says severity and state without colour;
//     history and the resolved state credit a ROLE, never a name; member text containing {braces} is
//     printed as written; the strip's action buttons say which alert they act on.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEditViewer } from '@/lib/admin-editability'

const { viewerRef, guestRef } = vi.hoisted(() => ({ viewerRef: { current: null as unknown }, guestRef: { current: false } }))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => viewerRef.current }))
// The surfaces ask the session themselves whether the viewer is a guest (no prop to forget).
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: guestRef.current }) }))
vi.mock('@/components/admin/client-admin-edit-link', async () => {
  const m = await import('@/components/admin/admin-edit-link')
  return { ClientAdminEditLink: m.AdminEditLink, useHydrated: () => true }
})
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
vi.mock('react-map-gl/mapbox', () => ({
  Marker: ({ children }: { children: unknown }) => children,
  Popup: ({ children }: { children: unknown }) => children,
}))
vi.mock('@/components/map/marker-popup', async (orig) => ({
  ...(await orig<typeof import('@/components/map/marker-popup')>()),
  // The popup is open (a click or a followed map deep link opened it).
  useMarkerPopup: () => ({ open: true, setOpen: () => {}, triggerRef: { current: null }, titleId: 'alert-title', close: () => {}, onPopupOpen: () => {} }),
}))

import { messages, type Locale } from '@/lib/i18n'
import { alertMessages, alertsT } from '@/lib/i18n-feed-alerts'
import type { AlertHistoryEntry, SafetyAlert } from '@/lib/safety-alert-rpc'
import { HOUR, NOW, alert, iso } from '@/test/alert-fixtures'
import { SafetyStrip, stripActions } from '@/components/feed/safety-strip'
import { SafetyAlertMarker } from '@/components/map/safety-alert-marker'
import { MarkerPopupDialog } from '@/components/map/marker-popup'
import { AlertHistoryList, historyChangeLines, historyEntryTitle } from './alert-history-dialog'
import { AlertSummary, markerFace } from './alert-parts'
import { MapAlertNotice } from './alert-dialogs'

const LOCALES = Object.keys(messages) as Locale[]
const ID = alert().id
const ready = (tier: AdminEditViewer['tier']): AdminEditViewer => ({ status: 'ready', tier, adminOrgIds: new Set() })

interface Viewer {
  isGuest: boolean
  tier: AdminEditViewer['tier']
  /** What the server says about this viewer and the alert. */
  isMine: boolean
}
const VIEWERS: Record<string, Viewer> = {
  guest: { isGuest: true, tier: null, isMine: false },
  member: { isGuest: false, tier: null, isMine: false },
  owner: { isGuest: false, tier: null, isMine: true },
  moderator: { isGuest: false, tier: 'community_moderator', isMine: false },
  moderator_owner: { isGuest: false, tier: 'community_moderator', isMine: true },
}

const strip = (alerts: SafetyAlert[], viewer: Viewer = VIEWERS.member, over: Record<string, unknown> = {}) => {
  viewerRef.current = ready(viewer.tier)
  guestRef.current = viewer.isGuest
  return renderToStaticMarkup(h(SafetyStrip, { alerts, locale: 'en', onViewMap: () => {}, now: NOW, tz: 'UTC', ...over }))
}
const popup = (a: SafetyAlert, viewer: Viewer = VIEWERS.member, over: Record<string, unknown> = {}) => {
  viewerRef.current = ready(viewer.tier)
  guestRef.current = viewer.isGuest
  return renderToStaticMarkup(
    h(SafetyAlertMarker, { alert: a, locale: 'en', onVote: async () => ({ ok: true, value: a, requestId: 'r' }), now: NOW, tz: 'UTC', ...over }),
  )
}
const has = (html: string, testId: string) => html.includes(`data-testid="${testId}"`)

describe('who gets which control (the server’s is_mine, never a guest)', () => {
  // Columns: update, mark resolved, withdraw, vote buttons, "Edit in admin".
  const EXPECTED: Record<string, [boolean, boolean, boolean, boolean, boolean]> = {
    guest: [false, false, false, false, false],
    member: [false, false, false, true, false],
    owner: [true, true, true, true, false],
    moderator: [false, false, false, true, true],
    moderator_owner: [true, true, true, true, true],
  }

  for (const [name, viewer] of Object.entries(VIEWERS)) {
    const [update, resolve, withdraw, vote, admin] = EXPECTED[name]
    it(`${name}: the strip`, () => {
      const html = strip([alert({ is_mine: viewer.isMine })], viewer)
      expect(has(html, `safety-strip-edit-${ID}`)).toBe(update)
      expect(has(html, `safety-strip-resolve-${ID}`)).toBe(resolve)
      expect(has(html, `safety-strip-withdraw-${ID}`)).toBe(withdraw)
      expect(has(html, `admin-edit-alert-${ID}`)).toBe(admin)
      // The strip never votes.
      expect(html).not.toMatch(/vote-(confirm|clear)/)
    })
    it(`${name}: the map popup`, () => {
      const html = popup(alert({ is_mine: viewer.isMine }), viewer)
      expect(has(html, `edit-alert-${ID}`)).toBe(update)
      expect(has(html, `resolve-alert-${ID}`)).toBe(resolve)
      expect(has(html, `withdraw-alert-${ID}`)).toBe(withdraw)
      expect(has(html, `vote-confirm-${ID}`)).toBe(vote)
      expect(has(html, `vote-clear-${ID}`)).toBe(vote)
      expect(has(html, `admin-edit-alert-${ID}`)).toBe(admin)
      // A guest is told how to take part instead of being offered a button the server refuses.
      expect(has(html, `alert-guest-hint-${ID}`)).toBe(viewer.isGuest)
    })
  }

  it('a guest session that the server says owns the alert: the strip and the popup offer no owner action and no vote', () => {
    const guestOwner: Viewer = { isGuest: true, tier: null, isMine: true }
    const mine = alert({ is_mine: true, version: 2, updated_at: iso(-60_000) })
    const s = strip([mine], guestOwner)
    for (const action of ['edit', 'resolve', 'withdraw']) expect(has(s, `safety-strip-${action}-${ID}`), action).toBe(false)
    expect(has(s, `safety-strip-history-${ID}`)).toBe(true) // history is for everyone
    const p = popup(mine, guestOwner)
    for (const action of ['edit', 'resolve', 'withdraw']) expect(has(p, `${action}-alert-${ID}`), action).toBe(false)
    expect(p).not.toMatch(/vote-(confirm|clear)/)
    // The same alert for a member session: the three actions are there.
    const member = strip([mine], VIEWERS.owner)
    for (const action of ['edit', 'resolve', 'withdraw']) expect(has(member, `safety-strip-${action}-${ID}`), action).toBe(true)
  })

  it('a guest whose session reported the alert still gets no owner action', () => {
    expect(stripActions(alert({ is_mine: true }), { isGuest: true })).toEqual([])
    expect(stripActions(alert({ is_mine: true }), { isGuest: false })).toEqual(['edit', 'resolve', 'withdraw'])
  })

  it('History is offered to everyone once the alert has changed, and to no one before', () => {
    expect(has(strip([alert({ version: 1 })], VIEWERS.guest), `safety-strip-history-${ID}`)).toBe(false)
    expect(has(strip([alert({ version: 2, updated_at: iso(-60_000), update_count: 1 })], VIEWERS.guest), `safety-strip-history-${ID}`)).toBe(true)
    expect(has(popup(alert({ version: 2, updated_at: iso(-60_000), update_count: 1 }), VIEWERS.member), `history-alert-${ID}`)).toBe(true)
  })
})

describe('live, resolved, no longer listed', () => {
  const resolved = alert({ is_mine: true, status: 'resolved', resolved_at: iso(-HOUR), version: 3 })

  it('a resolved alert says "Resolved" in words on both surfaces', () => {
    const s = strip([resolved], VIEWERS.owner)
    expect(s).toMatch(new RegExp(`data-testid="safety-strip-resolved-${ID}"[^>]*>(<svg[^>]*aria-hidden="true"[\\s\\S]*?</svg>)?Resolved<`))
    const p = popup(resolved, VIEWERS.owner)
    expect(p).toMatch(new RegExp(`data-testid="alert-resolved-${ID}"[^>]*>(<svg[^>]*aria-hidden="true"[\\s\\S]*?</svg>)?Resolved<`))
    expect(p).toContain('Marked resolved Oct 11, 2026, 11:00 AM')
    // The marker itself is named resolved, not by a severity it no longer warns about.
    expect(p).toContain('aria-label="Road Closure, Resolved"')
  })

  it('a resolved alert is never voted on, updated or resolved again; its reporter can still withdraw it', () => {
    const p = popup(resolved, VIEWERS.owner)
    expect(p).not.toMatch(/vote-(confirm|clear)/)
    expect(p).not.toContain('confirmed still here')
    expect(has(p, `edit-alert-${ID}`)).toBe(false)
    expect(has(p, `resolve-alert-${ID}`)).toBe(false)
    expect(has(p, `withdraw-alert-${ID}`)).toBe(true)
    const s = strip([resolved], VIEWERS.owner)
    expect(has(s, `safety-strip-edit-${ID}`)).toBe(false)
    expect(has(s, `safety-strip-resolve-${ID}`)).toBe(false)
    expect(has(s, `safety-strip-withdraw-${ID}`)).toBe(true)
  })

  it('who resolved it is a role, on both surfaces: the reporter, or a moderator — never a name', () => {
    for (const [role, words] of [['owner', 'Resolved by the reporter'], ['moderator', 'Resolved by a moderator']] as const) {
      const a = alert({ status: 'resolved', resolved_at: iso(-HOUR), resolved_by_role: role, version: 2 })
      expect(strip([a])).toMatch(new RegExp(`data-testid="safety-strip-resolved-${ID}"[^>]*>(<svg[\\s\\S]*?</svg>)?${words}<`))
      expect(popup(a)).toMatch(new RegExp(`data-testid="alert-resolved-${ID}"[^>]*>(<svg[\\s\\S]*?</svg>)?${words}<`))
    }
    // es: the role words come from the dictionary.
    const es = strip([alert({ status: 'resolved', resolved_at: iso(-HOUR), resolved_by_role: 'moderator', version: 2 })], VIEWERS.member, { locale: 'es' })
    expect(es).toContain(alertsT('es', 'resolvedByModerator'))
    expect(es).not.toContain('Resolved by')
  })

  it('the server’s verdict decides what is drawn — not the dates on this clock', () => {
    // Dates that look expired here, verdict live (the browser clock is ahead): drawn live, votes and all.
    const liveByServer = alert({ is_mine: true, expires_at: iso(-HOUR), shown_state: 'live', shown_until: iso(-HOUR) })
    expect(has(strip([liveByServer], VIEWERS.owner), `safety-strip-edit-${ID}`)).toBe(true)
    expect(has(popup(liveByServer, VIEWERS.owner), `vote-confirm-${ID}`)).toBe(true)
    expect(strip([liveByServer], VIEWERS.owner)).not.toContain('safety-strip-ended-')
    // Dates that look live here, verdict gone (the browser clock is behind): no longer listed, no action.
    const goneByServer = alert({ is_mine: true, expires_at: iso(5 * HOUR), shown_state: 'gone', shown_until: null })
    expect(strip([goneByServer], VIEWERS.owner)).toContain(`data-testid="safety-strip-ended-${ID}"`)
    expect(popup(goneByServer, VIEWERS.owner)).not.toMatch(/vote-(confirm|clear)|(edit|resolve|withdraw)-alert-/)
    // Resolved by the server's word, even with a resolved_at that is seven hours old on this clock.
    const resolvedByServer = alert({ status: 'resolved', resolved_at: iso(-7 * HOUR), shown_state: 'resolved', shown_until: iso(HOUR) })
    expect(strip([resolvedByServer])).toContain(`data-testid="safety-strip-resolved-${ID}"`)
    expect(has(popup(resolvedByServer), `alert-resolved-${ID}`)).toBe(true)
  })

  it('a resolved alert past its six hours is drawn as no longer listed, with no action at all', () => {
    const old = alert({ is_mine: true, status: 'resolved', resolved_at: iso(-6 * HOUR), version: 3 })
    const s = strip([old], VIEWERS.owner)
    expect(s).toContain(`data-testid="safety-strip-ended-${ID}"`)
    expect(s).not.toMatch(/safety-strip-(edit|resolve|withdraw|history)-/)
    expect(s).not.toContain('safety-strip-resolved-')
  })

  it('an alert kept under the member’s focus after a read dropped it says so and offers nothing', () => {
    const ended = alert({ is_mine: true, status: 'ended', version: 2 })
    const p = popup(ended, VIEWERS.owner)
    expect(p).toContain(alertsT('en', 'endedBody'))
    expect(p).not.toMatch(/vote-(confirm|clear)|(edit|resolve|withdraw|history)-alert-/)
    expect(strip([ended], VIEWERS.owner)).toContain('>No longer listed<')
  })

  it('an unverified live alert says so on both surfaces; a verified one does not', () => {
    expect(strip([alert({ verified: false })])).toContain('Unverified — neighbor report')
    expect(strip([alert({ verified: true })])).not.toContain('Unverified')
    expect(popup(alert({ verified: true }))).toContain('>Verified</p>')
  })
})

describe('what changed is visible', () => {
  it('the strip: age, and "Updated …" only on an alert that has updates', () => {
    const html = strip([alert({ id: 'a', updated_at: iso(-5 * 60_000), version: 2 }), alert({ id: 'b' })])
    expect(html).toMatch(/data-testid="safety-strip-updated-a"[^>]*>Updated 5 minutes ago</)
    expect(html).not.toContain('safety-strip-updated-b')
    expect(html).toContain('1 hour ago')
  })

  it('the popup: a full date and time for "Reported" and the expiry, and "Updated …"', () => {
    const html = popup(alert({ created_at: '2026-10-09T21:15:00.000Z', updated_at: iso(-2 * HOUR), version: 2, expires_at: '2026-10-12T21:15:00.000Z' }))
    expect(html).toContain('Reported Oct 9, 2026, 9:15 PM')
    expect(html).toContain('Expires Oct 12, 2026, 9:15 PM')
    expect(html).toMatch(new RegExp(`data-testid="alert-updated-${ID}"[^>]*>Updated 2 hours ago<`))
  })

  it('the history: newest first, what changed, the expiry each version carries, and which ROLE did it — never a name', () => {
    const entry = (version: number, over: Partial<AlertHistoryEntry> = {}): AlertHistoryEntry => ({
      version,
      msg_type: 'update',
      sent_at: iso(-(5 - version) * HOUR),
      alert_type: 'road_closure',
      severity: 2,
      description: 'Bridge out',
      expires_at: iso(5 * HOUR),
      changed: [],
      severity_change: 'same',
      actor_role: 'owner',
      ...over,
    })
    const entries = [
      entry(4, { msg_type: 'all_clear', changed: ['status'], expires_at: iso(6 * HOUR), severity: 4, actor_role: 'moderator' }),
      entry(3, { changed: ['severity', 'expires_at'], severity_change: 'escalated', severity: 4, expires_at: iso(72 * HOUR), actor_role: 'moderator' }),
      entry(2, { changed: ['description', 'location'], description: 'مغلق الجسر' }),
      entry(1, { msg_type: 'alert' }),
    ]
    const html = renderToStaticMarkup(h(AlertHistoryList, { entries, locale: 'en', tz: 'UTC' }))
    const order = [...html.matchAll(/data-testid="alert-history-entry-(\d)"/g)].map((m) => m[1])
    expect(order).toEqual(['4', '3', '2', '1'])
    expect(historyChangeLines(entries[0], 'en', 'UTC')).toEqual(['Shown as resolved until Oct 11, 2026, 6:00 PM'])
    expect(historyChangeLines(entries[1], 'en', 'UTC')).toEqual(['Severity raised to Critical', 'Expires Oct 14, 2026, 12:00 PM'])
    expect(historyChangeLines(entries[2], 'en', 'UTC')).toEqual(['Description changed', 'Location moved', 'Expires Oct 11, 2026, 5:00 PM'])
    expect(historyChangeLines(entries[3], 'en', 'UTC')).toEqual(['Road Closure, Moderate', 'Expires Oct 11, 2026, 5:00 PM'])
    expect(historyChangeLines(entry(5, { changed: ['severity'], severity_change: 'de_escalated', severity: 1 }), 'en', 'UTC')[0]).toBe('Severity lowered to Low')
    expect(historyChangeLines(entry(5, { changed: ['description'], description: null }), 'en', 'UTC')[0]).toBe('Description removed')
    // Each entry is credited to a role.
    const titles = [...html.matchAll(/<p class="text-sm font-semibold text-stone-900">([^<]*) · <time/g)].map((m) => m[1])
    expect(titles).toEqual(['Marked resolved by a moderator', 'Updated by a moderator', 'Updated by the reporter', 'Reported'])
    expect(alertsT('en', historyEntryTitle({ msg_type: 'all_clear', actor_role: 'owner' }))).toBe('Marked resolved by the reporter')
    // A message with no role (written before roles were recorded) keeps the plain wording.
    expect(alertsT('en', historyEntryTitle({ msg_type: 'update', actor_role: null }))).toBe('Updated')
    expect(alertsT('en', historyEntryTitle({ msg_type: 'all_clear', actor_role: null }))).toBe('Marked resolved')
    // Member text keeps its own direction and declares no language.
    expect(html).toContain('<p lang="" dir="auto" class="mt-2 whitespace-pre-wrap break-words text-sm text-stone-800">مغلق الجسر</p>')
    // A role, never a person: the entry type carries no name or id field, and none is printed.
    expect(Object.keys(entries[0]).filter((k) => /name|user|actor_id|created_by|_by$/.test(k))).toEqual([])
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('every locale credits the role in its own words (history and the resolved chip)', () => {
    for (const locale of LOCALES) {
      const m = alertMessages[locale]
      const six = [m.histUpdatedByReporter, m.histUpdatedByModerator, m.histResolvedByReporter, m.histResolvedByModerator, m.resolvedByReporter, m.resolvedByModerator]
      expect(new Set(six).size, locale).toBe(6)
      if (locale !== 'en') for (const text of six) expect(Object.values(alertMessages.en), `${locale}: ${text}`).not.toContain(text)
    }
  })
})

describe('language', () => {
  it('the strip follows the viewer’s language (es) and leaves no English behind', () => {
    const html = strip([alert({ is_mine: true, updated_at: iso(-5 * 60_000), version: 2 })], VIEWERS.owner, { locale: 'es' })
    expect(html).toContain('Alertas de seguridad')
    expect(html).toContain('Calle cerrada')
    expect(html).toContain('>Moderada<')
    expect(html).toContain('>Marcar como resuelta<')
    expect(html).toMatch(/Actualizada hace 5 minutos/)
    expect(html).not.toMatch(/Safety alerts|Road Closure|Moderate|View on map|>Update<|Withdraw|History|Updated|ago/)
  })

  // A Mapbox marker and popup sit outside the panel: they inherit the document's lang, so a name in
  // Arabic would be read with English rules. The element that CARRIES each name declares its language.
  const attrs = (html: string, pattern: RegExp) => pattern.exec(html)?.[0] ?? ''
  it('the marker button’s name and the popup (its Close name included) carry their own language and direction', () => {
    const ar = popup(alert(), VIEWERS.member, { locale: 'ar' })
    const marker = attrs(ar, new RegExp(`<button[^>]*data-testid="safety-alert-marker-${ID}"[^>]*>`))
    expect(marker).toContain(`aria-label="${alertsT('ar', 'typeRoadClosure')}`)
    expect(marker).toContain('lang="ar"')
    expect(marker).toContain('dir="rtl"')
    // The dialog root holds the Close button and every line of the popup.
    const dialog = attrs(ar, /<div role="dialog"[^>]*>/)
    expect(dialog).toContain('lang="ar"')
    expect(dialog).toContain('dir="rtl"')
    expect(ar).toMatch(/<div role="dialog"[^>]*lang="ar"[^>]*><button type="button" aria-label="إغلاق"/)
    const vi_ = popup(alert(), VIEWERS.member, { locale: 'vi' })
    expect(attrs(vi_, /<div role="dialog"[^>]*>/)).toMatch(/lang="vi" dir="ltr"/)
    expect(attrs(vi_, new RegExp(`<button[^>]*data-testid="safety-alert-marker-${ID}"[^>]*>`))).toMatch(/lang="vi" dir="ltr"/)
  })

  it('the popup dialog is laid out with logical properties (the Close button follows the reading direction); other markers get no lang', () => {
    const html = popup(alert(), VIEWERS.member, { locale: 'ar' })
    const root = (/<div role="dialog"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ')
    expect(root).toEqual(expect.arrayContaining(['pe-7', 'outline-hidden', 'focus-visible:ring-2']))
    expect(root.filter((c) => c === 'pr-7' || c.includes('outline-none'))).toEqual([])
    const close = (/<button type="button" aria-label="إغلاق" class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ')
    expect(close).toEqual(expect.arrayContaining(['absolute', 'end-0', 'top-0', 'h-6', 'w-6', 'focus-visible:outline-hidden']))
    expect(close.filter((c) => c === 'right-0' || c.includes('outline-none'))).toEqual([])
    // A marker that passes no language (resource, organization, business) is rendered as before.
    const plain = renderToStaticMarkup(h(MarkerPopupDialog, { titleId: 't', onClose: () => {}, children: 'x' }))
    expect(plain).toMatch(/^<div role="dialog" aria-labelledby="t" tabindex="0" class="/)
    expect(plain).not.toMatch(/lang=|dir=/)
    expect(plain).toContain('aria-label="Close"')
  })

  it('member text with {braces} is printed exactly as written on the strip, the popup, the summary and the history', () => {
    const text = 'Road {type} closed until {when} — {n}% done {severity}'
    const a = alert({ description: text, version: 2, updated_at: iso(-60_000) })
    expect(strip([a])).toContain(`>${text}</span>`)
    expect(popup(a)).toContain(`>${text}</p>`)
    expect(renderToStaticMarkup(h(AlertSummary, { alert: a, locale: 'en' }))).toContain(`>${text}</p>`)
    const entry: AlertHistoryEntry = { version: 2, msg_type: 'update', sent_at: iso(0), alert_type: 'road_closure', severity: 2, description: text, expires_at: iso(HOUR), changed: ['description'], severity_change: 'same', actor_role: 'owner' }
    expect(renderToStaticMarkup(h(AlertHistoryList, { entries: [entry], locale: 'en', tz: 'UTC' }))).toContain(`>${text}</p>`)
  })

  it('member-written text carries dir="auto" and an empty lang on the strip, the popup and the dialog summary', () => {
    const text = 'جسر مغلق'
    expect(strip([alert({ description: text })])).toMatch(new RegExp(`<span id="safety-strip-text-${ID}" class="[^"]*" lang="" dir="auto">${text}</span>`))
    expect(popup(alert({ description: text }))).toMatch(new RegExp(`<p lang="" dir="auto" class="[^"]*">${text}</p>`))
    expect(renderToStaticMarkup(h(AlertSummary, { alert: alert({ description: text }), locale: 'en' }))).toMatch(new RegExp(`<p lang="" dir="auto" class="[^"]*">${text}</p>`))
  })

  // Every element that has both an accessible name and visible text: the name starts with the text.
  // &amp; is decoded last, so an encoded ampersand is never decoded twice.
  const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  function labelInNameOffenders(html: string): string[] {
    const offenders: string[] = []
    for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const label = /aria-label="([^"]*)"/.exec(m[2])?.[1]
      if (label === undefined) continue
      const visible = decode(m[3].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
      if (visible && !decode(label).startsWith(visible)) offenders.push(`${decode(label)} ≠ ${visible}`)
    }
    return offenders
  }

  it.each(LOCALES)('%s: every accessible name starts with its visible text (strip and popup, as a moderator-owner)', (locale) => {
    const mine = alert({ is_mine: true, updated_at: iso(-5 * 60_000), version: 2, description: 'Bridge out' })
    const s = strip([mine, alert({ id: 'r', status: 'resolved', resolved_at: iso(-HOUR), is_mine: true, version: 2 })], VIEWERS.moderator_owner, { locale })
    const p = popup(mine, VIEWERS.moderator_owner, { locale })
    // Control: the pages do contain named elements with visible text (the "Edit in admin" links).
    expect((s + p).match(/aria-label="[^"]+"[^>]*>[^<]+</g)?.length ?? 0).toBeGreaterThan(0)
    expect(labelInNameOffenders(s)).toEqual([])
    expect(labelInNameOffenders(p)).toEqual([])
    // The strip's own buttons are named by their text alone (no aria-label to drift from it).
    for (const action of ['edit', 'resolve', 'withdraw', 'history']) {
      const button = new RegExp(`<button[^>]*data-testid="safety-strip-${action}-${ID}"[^>]*>`).exec(s)?.[0] ?? ''
      expect(button, action).not.toBe('')
      expect(button, action).not.toMatch(/aria-label/)
      // …and described by its own entry's title, text and time: five entries of one type stay apart.
      expect(button, action).toContain(`aria-describedby="safety-strip-title-${ID} safety-strip-text-${ID} safety-strip-when-${ID}"`)
    }
    for (const id of [`safety-strip-title-${ID}`, `safety-strip-text-${ID}`, `safety-strip-when-${ID}`]) expect(s).toContain(`id="${id}"`)
  })

  it('control: the check does catch a name that does not start with its text', () => {
    expect(labelInNameOffenders('<button aria-label="Close dialog">Cerrar</button>')).toEqual(['Close dialog ≠ Cerrar'])
    expect(labelInNameOffenders('<a aria-label="Edit in admin: Road Closure (opens in the admin tab)">Edit in admin</a>')).toEqual([])
  })
})

describe('accessibility', () => {
  it('severity is a word beside the icon on both surfaces, for every level', () => {
    for (const [severity, word] of [[1, 'Low'], [2, 'Moderate'], [3, 'High'], [4, 'Critical']] as const) {
      expect(strip([alert({ severity })])).toMatch(new RegExp(`data-testid="safety-strip-severity-${ID}"[^>]*>${word}<`))
      expect(popup(alert({ severity }))).toContain(`>${word}</span>`)
      expect(popup(alert({ severity }))).toContain(`aria-label="Road Closure, ${word}"`)
    }
  })

  it('both live regions are mounted empty before anything happens — also when there is no alert at all', () => {
    for (const html of [strip([]), strip([alert()])]) {
      expect(html).toContain('<p role="alert" class="sr-only" data-testid="safety-strip-alert"></p>')
      expect(html).toContain('<p role="status" class="sr-only" data-testid="safety-strip-status"></p>')
      // role="alert" is never combined with aria-live (double speech on VoiceOver).
      expect(html).not.toMatch(/role="alert"[^>]*aria-live/)
    }
    expect(strip([])).not.toContain('data-testid="safety-strip"')
  })

  it('a new or raised alert speaks in the alert region; an update, a resolution and an ended alert in the status region', () => {
    const live = (over: Record<string, unknown>) => strip([alert()], VIEWERS.member, { live: { assertive: [], polite: [], spoken: '', notice: '', seq: 1, ...over } })
    const region = (html: string, id: string) => new RegExp(`data-testid="${id}"[^>]*>(?:<span>)?([^<]*)`).exec(html)?.[1]
    const fresh = live({ assertive: [{ kind: 'new', alert_type: 'weather', severity: 4 }] })
    expect(region(fresh, 'safety-strip-alert')).toBe('New safety alert: Weather Hazard, Critical.')
    expect(region(fresh, 'safety-strip-status')).toBe('')
    expect(region(live({ assertive: [{ kind: 'raised', alert_type: 'road_closure', severity: 3 }] }), 'safety-strip-alert')).toBe('Safety alert raised to High: Road Closure.')

    const quiet = live({ polite: [{ kind: 'updated', alert_type: 'road_closure', severity: 2 }, { kind: 'resolved', alert_type: 'weather', severity: 1 }, { kind: 'ended', alert_type: 'general', severity: 1 }] })
    expect(region(quiet, 'safety-strip-alert')).toBe('')
    expect(region(quiet, 'safety-strip-status')).toBe('Safety alert updated: Road Closure. Safety alert resolved: Weather Hazard. Safety alert no longer listed: Safety Alert.')
  })

  it('the member’s own outcome is spoken politely once, and shown as a line with a Dismiss control', () => {
    const html = strip([alert()], VIEWERS.owner, { live: { assertive: [], polite: [], spoken: 'Alert updated.', notice: 'Alert updated.', seq: 2 } })
    expect(html).toContain('<p role="status" class="sr-only" data-testid="safety-strip-status"><span>Alert updated.</span></p>')
    expect(html).toContain('<p role="alert" class="sr-only" data-testid="safety-strip-alert"></p>')
    // The visible line is not a second live region (it would be read twice).
    const box = /<div data-testid="safety-strip-notice"[\s\S]*?<\/div>/.exec(html)?.[0] ?? ''
    expect(box).toContain('<p class="min-w-0 flex-1">Alert updated.</p>')
    expect(box).not.toMatch(/role=|aria-live/)
    expect(box).toMatch(/<button type="button" aria-label="Dismiss" data-testid="safety-strip-notice-dismiss" class="[^"]*\bh-6 w-6\b/)
    // A few seconds later the spoken text is gone and the line is still there, until dismissed.
    const later = strip([alert()], VIEWERS.owner, { live: { assertive: [], polite: [], spoken: '', notice: 'Alert updated.', seq: 2 } })
    expect(later).toContain('<p role="status" class="sr-only" data-testid="safety-strip-status"></p>')
    expect(later).toContain('data-testid="safety-strip-notice"')
    expect(strip([alert()], VIEWERS.owner)).not.toContain('data-testid="safety-strip-notice"')
    // es: the Dismiss name is translated.
    expect(strip([alert()], VIEWERS.owner, { locale: 'es', live: { assertive: [], polite: [], spoken: '', notice: 'x', seq: 1 } })).toContain(`aria-label="${alertsT('es', 'dismiss')}"`)
  })

  it('the map’s notice: one polite status region, mounted empty, shown in the page’s flow with a Dismiss control', () => {
    const empty = renderToStaticMarkup(h(MapAlertNotice, { notice: { text: '', seq: 0 }, locale: 'en', onDismiss: () => {} }))
    expect(empty).toBe('<div lang="en" dir="ltr" data-testid="map-alert-notice"><p role="status" class="sr-only" data-testid="map-alert-status"></p></div>')
    const shown = renderToStaticMarkup(h(MapAlertNotice, { notice: { text: 'Alert updated.', seq: 1 }, locale: 'ar', onDismiss: () => {} }))
    expect(shown).toMatch(/^<div lang="ar" dir="rtl" data-testid="map-alert-notice" class="[^"]*">/)
    expect(shown).toContain('<p role="status" class="min-w-0 flex-1" data-testid="map-alert-status"><span>Alert updated.</span></p>')
    expect(shown).toContain(`aria-label="${alertsT('ar', 'dismiss')}" data-testid="map-alert-notice-dismiss"`)
    // In the flow, above the map: nothing positions it over a marker or a popup.
    expect(shown).not.toMatch(/\b(absolute|fixed|sticky)\b/)
  })

  it('the popup has its own polite region for a counted vote, mounted empty with the popup', () => {
    expect(popup(alert())).toContain(`<p role="status" class="sr-only" data-testid="alert-vote-status-${ID}"></p>`)
  })

  it('every new control is at least 24 px in both directions', () => {
    const s = strip([alert({ is_mine: true, version: 2 })], VIEWERS.owner)
    for (const action of ['edit', 'resolve', 'withdraw', 'history']) {
      const cls = new RegExp(`<button[^>]*class="([^"]*)"[^>]*data-testid="safety-strip-${action}-${ID}"`).exec(s)?.[1] ?? ''
      expect(cls.split(' '), action).toEqual(expect.arrayContaining(['min-h-6', 'min-w-6']))
    }
    const p = popup(alert({ is_mine: true, version: 2 }), VIEWERS.owner)
    for (const action of ['edit', 'resolve', 'withdraw', 'history']) {
      const cls = new RegExp(`<button[^>]*class="([^"]*)"[^>]*data-testid="${action}-alert-${ID}"`).exec(p)?.[1] ?? ''
      expect(cls.split(' '), action).toEqual(expect.arrayContaining(['min-h-6', 'min-w-6']))
    }
    expect(s).toMatch(/<button[^>]*data-testid="safety-strip-view-map"[^>]*class="[^"]*min-h-6/)
  })

  it('the marker stays a real button that opens a dialog (the keyboard path to an alert’s popup)', () => {
    const p = popup(alert())
    expect(p).toMatch(new RegExp(`<button type="button" lang="en" dir="ltr" class="[^"]*" aria-label="Road Closure, Moderate" aria-haspopup="dialog" aria-expanded="true" data-testid="safety-alert-marker-${ID}"`))
    expect(p).toContain('role="dialog"')
  })

  // Severity and state on the marker face without relying on hue (WCAG 1.4.1): shape, a "!" badge,
  // a check mark, a hollow face.
  describe('the marker face says severity and state without colour', () => {
    const face = (a: SafetyAlert) => {
      const html = popup(a)
      const button = new RegExp(`<button[^>]*data-testid="safety-alert-marker-${ID}"[^>]*>([\\s\\S]*?)</button>`).exec(html)
      const open = button?.[0].slice(0, button[0].indexOf('>') + 1) ?? ''
      return {
        cls: (/class="([^"]*)"/.exec(open)?.[1] ?? '').split(' '),
        face: /data-face="([^"]*)"/.exec(open)?.[1],
        badge: /<span aria-hidden="true" class="[^"]*">([^<]*)<\/span>/.exec(button?.[1] ?? '')?.[1] ?? null,
        inner: button?.[1] ?? '',
      }
    }

    it('the four severities are four different faces, and no two differ by colour alone', () => {
      const faces = [1, 2, 3, 4].map((severity) => face(alert({ severity })))
      expect(faces.map((f) => f.face)).toEqual(['circle', 'square', 'circle:!', 'square:!!'])
      expect(faces.map((f) => f.badge)).toEqual([null, null, '!', '!!'])
      expect(faces.map((f) => f.cls.includes('rounded-full'))).toEqual([true, false, true, false])
      expect(faces.map((f) => f.cls.includes('rounded-md'))).toEqual([false, true, false, true])
      // Low and moderate share a colour: the shape is what tells them apart.
      expect(faces[0].cls.filter((c) => c.startsWith('bg-'))).toEqual(faces[1].cls.filter((c) => c.startsWith('bg-')))
    })

    it('the badge is decorative (the name says the severity) and dark-on-white', () => {
      const f = face(alert({ severity: 3 }))
      expect(f.inner).toMatch(/<span aria-hidden="true" class="[^"]*\bbg-white\b[^"]*\btext-red-900\b[^"]*">!<\/span>/)
      expect(popup(alert({ severity: 3 }))).toContain('aria-label="Road Closure, High"')
    })

    it('a resolved alert shows a check mark; one no longer listed is hollow with a dashed outline', () => {
      const resolved = face(alert({ severity: 4, status: 'resolved', resolved_at: iso(-HOUR) }))
      expect(resolved.face).toBe('circle:check')
      expect(resolved.badge).toBeNull()
      expect(resolved.inner).toContain('lucide-circle-check')
      const gone = face(alert({ severity: 4, shown_state: 'gone', shown_until: null }))
      expect(gone.face).toBe('circle:hollow')
      expect(gone.cls).toEqual(expect.arrayContaining(['bg-white', 'border-dashed', 'border-stone-700']))
    })

    it('the target is 32 px, and the face stands out from the map by a dark 2 px outline', () => {
      for (const a of [alert({ severity: 1 }), alert({ severity: 4 }), alert({ status: 'resolved', resolved_at: iso(-HOUR) }), alert({ shown_state: 'gone', shown_until: null })]) {
        const f = face(a)
        expect(f.cls).toEqual(expect.arrayContaining(['w-8', 'h-8', 'border-2']))
        expect(f.cls.some((c) => /^border-(red-900|amber-900|stone-800|stone-700)$/.test(c)), f.cls.join(' ')).toBe(true)
      }
    })

    it('markerFace: the rule itself', () => {
      expect(markerFace('live', 1)).toEqual({ shape: 'circle', badge: '', check: false, hollow: false })
      expect(markerFace('live', 2)).toEqual({ shape: 'square', badge: '', check: false, hollow: false })
      expect(markerFace('live', 3)).toEqual({ shape: 'circle', badge: '!', check: false, hollow: false })
      expect(markerFace('live', 4)).toEqual({ shape: 'square', badge: '!!', check: false, hollow: false })
      expect(markerFace('resolved', 4)).toEqual({ shape: 'circle', badge: '', check: true, hollow: false })
      expect(markerFace('gone', 4)).toEqual({ shape: 'circle', badge: '', check: false, hollow: true })
    })
  })

  it('every locale has every alert string the surfaces render (no English fallback on a member surface)', () => {
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      const s = strip([alert({ is_mine: true, version: 2, updated_at: iso(-60_000) })], VIEWERS.owner, { locale })
      for (const key of ['stripTitle', 'viewOnMap', 'actionUpdate', 'actionResolve', 'actionWithdraw', 'actionHistory', 'typeRoadClosure', 'sevModerate'] as const) {
        expect(s, `${locale}.${key}`).toContain(alertMessages[locale][key])
      }
    }
  })
})
