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
//     24 px targets (invariant 7).

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEditViewer } from '@/lib/admin-editability'

const { viewerRef } = vi.hoisted(() => ({ viewerRef: { current: null as unknown } }))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => viewerRef.current }))
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
import { AlertHistoryList, historyChangeLines } from './alert-history-dialog'
import { AlertSummary } from './alert-parts'

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
  return renderToStaticMarkup(h(SafetyStrip, { alerts, locale: 'en', isGuest: viewer.isGuest, onViewMap: () => {}, now: NOW, tz: 'UTC', ...over }))
}
const popup = (a: SafetyAlert, viewer: Viewer = VIEWERS.member, over: Record<string, unknown> = {}) => {
  viewerRef.current = ready(viewer.tier)
  return renderToStaticMarkup(
    h(SafetyAlertMarker, { alert: a, locale: 'en', isGuest: viewer.isGuest, onVote: async () => ({ ok: true, value: a, requestId: 'r' }), now: NOW, tz: 'UTC', ...over }),
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

  it('a guest whose session reported the alert still gets no owner action', () => {
    expect(stripActions(alert({ is_mine: true }), { isGuest: true }, NOW)).toEqual([])
    expect(stripActions(alert({ is_mine: true }), { isGuest: false }, NOW)).toEqual(['edit', 'resolve', 'withdraw'])
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

  it('the history: newest first, what changed and the expiry each version carries — never who', () => {
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
      ...over,
    })
    const entries = [
      entry(4, { msg_type: 'all_clear', changed: ['status'], expires_at: iso(6 * HOUR), severity: 4 }),
      entry(3, { changed: ['severity', 'expires_at'], severity_change: 'escalated', severity: 4, expires_at: iso(72 * HOUR) }),
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
    expect(html).toContain('>Marked resolved · <time')
    // Member text keeps its own direction and declares no language.
    expect(html).toContain('<p lang="" dir="auto" class="mt-2 whitespace-pre-wrap break-words text-sm text-stone-800">مغلق الجسر</p>')
    // Never who: no role word, no "by …".
    expect(html).not.toMatch(/moderator|reporter|owner|\bby\b/i)
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

  it('the popup carries its own language and direction (a Mapbox popup would inherit the document’s)', () => {
    expect(popup(alert(), VIEWERS.member, { locale: 'ar' })).toMatch(new RegExp(`<div lang="ar" dir="rtl" data-testid="safety-alert-popup-${ID}">`))
    expect(popup(alert(), VIEWERS.member, { locale: 'ar' })).toContain('aria-label="إغلاق"')
    expect(popup(alert(), VIEWERS.member, { locale: 'vi' })).toMatch(new RegExp(`<div lang="vi" dir="ltr" data-testid="safety-alert-popup-${ID}">`))
  })

  it('member-written text carries dir="auto" and an empty lang on the strip, the popup and the dialog summary', () => {
    const text = 'جسر مغلق'
    expect(strip([alert({ description: text })])).toMatch(new RegExp(`<span class="[^"]*" lang="" dir="auto">${text}</span>`))
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
      expect(button, action).toContain(`aria-describedby="safety-strip-title-${ID}"`)
    }
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
      expect(html).toContain('<p role="status" data-testid="safety-strip-status" class="sr-only"></p>')
      // role="alert" is never combined with aria-live (double speech on VoiceOver).
      expect(html).not.toMatch(/role="alert"[^>]*aria-live/)
    }
    expect(strip([])).not.toContain('data-testid="safety-strip"')
  })

  it('a new or raised alert speaks in the alert region; an update, a resolution and an ended alert in the status region', () => {
    const live = (over: Record<string, unknown>) => strip([alert()], VIEWERS.member, { live: { assertive: [], polite: [], notice: '', seq: 1, ...over } })
    const region = (html: string, id: string) => new RegExp(`data-testid="${id}"[^>]*>(?:<span>)?([^<]*)`).exec(html)?.[1]
    const fresh = live({ assertive: [{ kind: 'new', alert_type: 'weather', severity: 4 }] })
    expect(region(fresh, 'safety-strip-alert')).toBe('New safety alert: Weather Hazard, Critical.')
    expect(region(fresh, 'safety-strip-status')).toBe('')
    expect(region(live({ assertive: [{ kind: 'raised', alert_type: 'road_closure', severity: 3 }] }), 'safety-strip-alert')).toBe('Safety alert raised to High: Road Closure.')

    const quiet = live({ polite: [{ kind: 'updated', alert_type: 'road_closure', severity: 2 }, { kind: 'resolved', alert_type: 'weather', severity: 1 }, { kind: 'ended', alert_type: 'general', severity: 1 }] })
    expect(region(quiet, 'safety-strip-alert')).toBe('')
    expect(region(quiet, 'safety-strip-status')).toBe('Safety alert updated: Road Closure. Safety alert resolved: Weather Hazard. Safety alert no longer listed: Safety Alert.')
  })

  it('the member’s own outcome is a polite status that is also shown as a line', () => {
    const html = strip([alert()], VIEWERS.owner, { live: { assertive: [], polite: [], notice: 'Alert updated.', seq: 2 } })
    expect(html).toMatch(/<p role="status" data-testid="safety-strip-status" class="mb-2 [^"]*"><span>Alert updated\.<\/span><\/p>/)
    expect(html).toContain('<p role="alert" class="sr-only" data-testid="safety-strip-alert"></p>')
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
    expect(p).toMatch(new RegExp(`<button type="button" class="[^"]*" aria-label="Road Closure, Moderate" aria-haspopup="dialog" aria-expanded="true" data-testid="safety-alert-marker-${ID}">`))
    expect(p).toContain('role="dialog"')
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
