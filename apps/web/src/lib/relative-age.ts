// apps/web/src/lib/relative-age.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "5 minutes ago" for a post or a comment, in the viewer's language: Intl.RelativeTimeFormat (each
// language's plural forms), with the translated short forms of lib/i18n-feed-comments.ts where the
// runtime has no relative-time data (ht, hmn). From 30 days on, the date itself.

import type { Locale } from './i18n'
import { formatMessage } from './i18n-event-forms'
import { commentsT } from './i18n-feed-comments'
import { browserTimeZone, dateTimeFormat, relativeTimeText } from './event-time'

export function relativeAge(iso: string, locale: Locale, now: number = Date.now(), tz: string = browserTimeZone()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (mins < 1) return commentsT(locale, 'justNow')
  const pick = (n: number, unit: 'minute' | 'hour' | 'day') =>
    relativeTimeText(-n, unit, locale) ??
    formatMessage(commentsT(locale, unit === 'minute' ? 'minutesAgo' : unit === 'hour' ? 'hoursAgo' : 'daysAgo'), { n })
  if (mins < 60) return pick(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return pick(hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 30) return pick(days, 'day')
  return dateTimeFormat(locale, tz, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}
