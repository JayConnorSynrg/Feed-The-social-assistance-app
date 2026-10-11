// apps/web/src/components/alerts/alert-edit-model.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The plain rules of the alert dialogs (components/alerts/alert-editor-dialog.tsx): what the form
// holds, what a save sends (only what changed, against the alert the form opened with), and what the
// member is told afterwards. Dates and times go through the app's formatter (lib/i18n-intl.ts), so
// they read the same on every device, in all 14 locales.

import type { Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { browserTimeZone } from '@/lib/event-time'
import { dateTimeFormatter, formatClock, formatDate } from '@/lib/i18n-intl'
import { alertsT } from '@/lib/i18n-feed-alerts'
import { RESOLVED_SHOWN_MS } from '@/lib/safety-alert-live'
import type { AlertChanges, AlertType, SafetyAlert } from '@/lib/safety-alert-rpc'

/** The three fields a member edits. */
export interface AlertDraft {
  type: AlertType
  severity: number
  description: string
}

export function alertDraftOf(alert: Pick<SafetyAlert, 'alert_type' | 'severity' | 'description'>): AlertDraft {
  return { type: alert.alert_type, severity: alert.severity, description: alert.description ?? '' }
}

/** What saving `draft` over `base` changes. An emptied description is `null` (clear the text). */
export function alertDraftChanges(base: Pick<SafetyAlert, 'alert_type' | 'severity' | 'description'>, draft: AlertDraft): AlertChanges {
  const changes: AlertChanges = {}
  if (draft.type !== base.alert_type) changes.type = draft.type
  if (draft.severity !== base.severity) changes.severity = draft.severity
  const text = draft.description.trim()
  if (text !== (base.description ?? '')) changes.description = text === '' ? null : text
  return changes
}

/**
 * The member's changes carried onto a newer version of the alert: every field the member changed
 * (against the alert their form opened with) keeps the member's value; every field they left alone
 * takes the newer version's. "Keep my changes" after a conflict saves exactly this, so someone
 * else's change to a field the member never touched is not undone.
 */
export function rebaseAlertDraft(
  opened: Pick<SafetyAlert, 'alert_type' | 'severity' | 'description'>,
  draft: AlertDraft,
  current: Pick<SafetyAlert, 'alert_type' | 'severity' | 'description'>,
): AlertDraft {
  const mine = alertDraftChanges(opened, draft)
  return {
    type: mine.type ?? current.alert_type,
    severity: mine.severity ?? current.severity,
    description: mine.description !== undefined ? mine.description ?? '' : current.description ?? '',
  }
}

/** A full date and time in the viewer's language and zone ("Oct 11, 2026, 3:04 PM"): an alert can
 *  live 72 hours, so a time of day alone does not say which day. */
export function formatAlertDateTime(iso: string, locale: Locale, tz: string = browserTimeZone()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateTimeFormatter(locale, tz, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
}

/** "Couldn't refresh alerts — last updated 3:04 PM." — when the last read succeeded, in the viewer's
 *  language and zone: the clock time, with its date when that was not today. */
export function staleNoticeText(lastSuccessAt: number, locale: Locale, now: number, tz: string = browserTimeZone()): string {
  const at = new Date(lastSuccessAt).toISOString()
  const today = formatDate(at, locale, tz) === formatDate(new Date(now).toISOString(), locale, tz)
  return formatMessage(alertsT(locale, 'staleNotice'), { time: today ? formatClock(at, locale, tz) : formatAlertDateTime(at, locale, tz) })
}

/** What the member is told after a save: the new expiry when the save moved it (a severity change
 *  does), and that the alert is unverified again when the save took the mark away. */
export function savedNoticeText(before: SafetyAlert, after: SafetyAlert, locale: Locale, tz?: string): string {
  const moved = after.expires_at !== before.expires_at
  const first = moved
    ? formatMessage(alertsT(locale, 'savedExpiryNotice'), { when: formatAlertDateTime(after.expires_at, locale, tz) })
    : alertsT(locale, 'savedNotice')
  return before.verified && !after.verified ? `${first} ${alertsT(locale, 'unverifiedNotice')}` : first
}

/** "Alert marked resolved. It stays visible as resolved until <date time>." */
export function resolvedNoticeText(after: SafetyAlert, locale: Locale, tz?: string): string {
  const until = new Date(Date.parse(after.resolved_at ?? '') + RESOLVED_SHOWN_MS)
  const when = Number.isNaN(until.getTime()) ? '' : formatAlertDateTime(until.toISOString(), locale, tz)
  return formatMessage(alertsT(locale, 'resolvedNotice'), { when })
}
