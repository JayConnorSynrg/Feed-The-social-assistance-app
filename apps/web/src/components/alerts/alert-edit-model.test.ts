// apps/web/src/components/alerts/alert-edit-model.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The plain rules of the alert dialogs: what a save changes, what "keep my changes" saves after a
// conflict (only the member's own changes, on top of the newer version), and the notices.

import { describe, it, expect } from 'vitest'
import { HOUR, alert, iso } from '@/test/alert-fixtures'
import { alertDraftChanges, alertDraftOf, formatAlertDateTime, rebaseAlertDraft, resolvedNoticeText, savedNoticeText, staleNoticeText } from './alert-edit-model'

describe('alertDraftChanges', () => {
  it('nothing touched: nothing to save', () => {
    expect(alertDraftChanges(alert(), alertDraftOf(alert()))).toEqual({})
    // Surrounding spaces are not a change.
    expect(alertDraftChanges(alert(), { ...alertDraftOf(alert()), description: '  Bridge out ' })).toEqual({})
  })

  it('each field on its own; an emptied description is null (clear), never an empty text', () => {
    const base = alert()
    expect(alertDraftChanges(base, { ...alertDraftOf(base), severity: 4 })).toEqual({ severity: 4 })
    expect(alertDraftChanges(base, { ...alertDraftOf(base), type: 'weather' })).toEqual({ type: 'weather' })
    expect(alertDraftChanges(base, { ...alertDraftOf(base), description: ' Detour ' })).toEqual({ description: 'Detour' })
    expect(alertDraftChanges(base, { ...alertDraftOf(base), description: '   ' })).toEqual({ description: null })
    expect(alertDraftChanges(alert({ description: null }), { ...alertDraftOf(alert({ description: null })), description: '' })).toEqual({})
  })
})

describe('rebaseAlertDraft — "keep my changes" after someone else saved', () => {
  const opened = alert({ severity: 2, description: 'Bridge out' })

  it('a field the member left alone takes the newer version’s value', () => {
    const mine = { ...alertDraftOf(opened), description: 'My text' }
    const current = alert({ severity: 4, description: 'Their text', alert_type: 'weather' })
    expect(rebaseAlertDraft(opened, mine, current)).toEqual({ type: 'weather', severity: 4, description: 'My text' })
  })

  it('a field both changed keeps the member’s value (the compare step shows both)', () => {
    const mine = { ...alertDraftOf(opened), severity: 3 }
    expect(rebaseAlertDraft(opened, mine, alert({ severity: 4 })).severity).toBe(3)
  })

  it('a description the member cleared stays cleared', () => {
    const mine = { ...alertDraftOf(opened), description: '' }
    expect(rebaseAlertDraft(opened, mine, alert({ description: 'Their text' })).description).toBe('')
  })

  it('the member changed nothing: the result is the newer version', () => {
    const current = alert({ severity: 1, description: null })
    expect(rebaseAlertDraft(opened, alertDraftOf(opened), current)).toEqual(alertDraftOf(current))
  })
})

describe('the stale line: "Couldn’t refresh alerts — last updated …"', () => {
  const at = (iso8601: string) => Date.parse(iso8601)

  it('the clock time of the last read that succeeded, in the viewer’s language and zone', () => {
    const last = at('2026-10-11T19:04:00.000Z')
    const now = at('2026-10-11T21:30:00.000Z')
    expect(staleNoticeText(last, 'en', now, 'UTC')).toBe('Couldn’t refresh alerts — last updated 7:04 PM.')
    expect(staleNoticeText(last, 'en', now, 'America/New_York')).toBe('Couldn’t refresh alerts — last updated 3:04 PM.')
    expect(staleNoticeText(last, 'fr', now, 'UTC')).toBe('Impossible d’actualiser les alertes. Dernière mise à jour : 19:04.')
    expect(staleNoticeText(last, 'es', now, 'UTC')).toMatch(/^No se pudieron actualizar las alertas\. Última actualización: 19:04\.$/)
  })

  it('with its date when the last success was not today (in the viewer’s zone): a time alone would name the wrong day', () => {
    const last = at('2026-10-10T23:50:00.000Z')
    const now = at('2026-10-11T08:00:00.000Z')
    expect(staleNoticeText(last, 'en', now, 'UTC')).toBe('Couldn’t refresh alerts — last updated Oct 10, 2026, 11:50 PM.')
    // The same two instants are one calendar day in New York (7:50 PM and 4:00 AM are not): still dated.
    expect(staleNoticeText(last, 'en', now, 'America/New_York')).toBe('Couldn’t refresh alerts — last updated Oct 10, 2026, 7:50 PM.')
    // Honolulu: 1:50 PM and 10:00 PM on Oct 10 — the same day, so the time alone.
    expect(staleNoticeText(last, 'en', now, 'Pacific/Honolulu')).toBe('Couldn’t refresh alerts — last updated 1:50 PM.')
  })

  it('every locale has the sentence, with the time in it', () => {
    const last = at('2026-10-11T19:04:00.000Z')
    for (const locale of ['en', 'es', 'ht', 'vi', 'ar', 'zh', 'so', 'fr', 'pt', 'ru', 'ko', 'tl', 'am', 'hmn'] as const) {
      const text = staleNoticeText(last, locale, last + 60_000, 'UTC')
      expect(text, locale).not.toContain('{time}')
      expect(text, locale).toMatch(/04/)
      if (locale !== 'en') expect(text, locale).not.toContain('refresh alerts')
    }
  })
})

describe('notices', () => {
  it('a full date and time in the viewer’s language and zone', () => {
    expect(formatAlertDateTime('2026-10-09T21:15:00.000Z', 'en', 'UTC')).toBe('Oct 9, 2026, 9:15 PM')
    expect(formatAlertDateTime('2026-10-09T21:15:00.000Z', 'en', 'America/New_York')).toBe('Oct 9, 2026, 5:15 PM')
    expect(formatAlertDateTime('2026-10-09T21:15:00.000Z', 'fr', 'UTC')).toBe('9 oct. 2026, 21:15')
    expect(formatAlertDateTime('not a date', 'en', 'UTC')).toBe('not a date')
  })

  it('saved: plain when the expiry stayed; the new expiry when it moved; "unverified" when the mark was lost', () => {
    const before = alert({ verified: true })
    expect(savedNoticeText(before, alert({ verified: true, description: 'x' }), 'en', 'UTC')).toBe('Alert updated.')
    expect(savedNoticeText(before, alert({ verified: true, severity: 4, expires_at: iso(72 * HOUR) }), 'en', 'UTC')).toBe('Alert updated. It now expires Oct 14, 2026, 12:00 PM.')
    expect(savedNoticeText(before, alert({ verified: false }), 'en', 'UTC')).toBe('Alert updated. It is unverified until a moderator checks it again.')
  })

  it('resolved: until when it stays visible (resolved + 6 h)', () => {
    expect(resolvedNoticeText(alert({ status: 'resolved', resolved_at: iso(0) }), 'en', 'UTC')).toBe('Alert marked resolved. It stays visible as resolved until Oct 11, 2026, 6:00 PM.')
  })
})
