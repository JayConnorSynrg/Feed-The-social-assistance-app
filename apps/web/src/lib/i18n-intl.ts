// apps/web/src/lib/i18n-intl.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Dates, clock times, past ages, counts and plural forms in the viewer's language, the same on
// every device.
//
// Intl has no usable data for three of FEED's 14 locales in at least one runtime FEED runs on
// (probed 2026-10-11: Node 20.20.2 / ICU 78.2, Chromium 148, Firefox 150, WebKit 26.4):
//   ht, hmn  absent in Node, Chromium and Firefox (US English comes back); WebKit says it supports
//            them and then prints placeholders ("2026 M10 9", "-5 min"), so asking
//            supportedLocalesOf is no guard;
//   so       absent in Chromium for dates, relative time and numbers.
// For those three FEED writes the words itself (TIME_WORDS) on every device, so a member reads the
// same text whichever browser they use and a test in Node pins what a phone shows. The Somali
// words are CLDR 48's own (the test compares them with Intl where the runtime has Somali).
// ht and hmn are machine-drafted, needs native review: docs/i18n-native-review.md.
//
// Tagalog is asked for as 'fil' first: WebKit knows 'fil' and not 'tl'.

import type { Locale } from './i18n'
import type { PluralForms } from './event-recurrence-format'
import { browserTimeZone } from './event-time'
import { formatMessage } from './format-message'

export type { PluralForms }
export type PastUnit = 'minute' | 'hour' | 'day'

interface TimeWords {
  /** January … December, as they read inside a date. */
  months: readonly [string, string, string, string, string, string, string, string, string, string, string, string]
  /** {day} {month} {year} in the language's order. */
  date: string
  /** {hour}:{minute} with the day-period word. */
  clock: string
  am: string
  pm: string
  /** "{n} minutes ago", per plural form. */
  past: Record<PastUnit, PluralForms>
}

/** The locales whose time words FEED writes itself, on every device. */
export const TIME_WORDS: Partial<Record<Locale, TimeWords>> = {
  // machine-drafted, needs native review
  ht: {
    months: ['jan', 'fev', 'mas', 'avr', 'me', 'jen', 'jiy', 'out', 'sep', 'okt', 'nov', 'des'],
    date: '{day} {month} {year}',
    clock: '{hour}:{minute} {period}',
    am: 'AM',
    pm: 'PM',
    past: {
      minute: { other: 'Sa gen {n} minit' },
      hour: { other: 'Sa gen {n} èdtan' },
      day: { other: 'Sa gen {n} jou' },
    },
  },
  // machine-drafted, needs native review
  hmn: {
    months: ['Ib Hlis', 'Ob Hlis', 'Peb Hlis', 'Plaub Hlis', 'Tsib Hlis', 'Rau Hli', 'Xya Hli', 'Yim Hli', 'Cuaj Hli', 'Kaum Hli', 'Kaum Ib Hlis', 'Kaum Ob Hlis'],
    date: 'Lub {month} {day}, {year}',
    clock: '{hour}:{minute} {period}',
    am: 'AM',
    pm: 'PM',
    past: {
      minute: { other: '{n} feeb dhau los' },
      hour: { other: '{n} teev dhau los' },
      day: { other: '{n} hnub dhau los' },
    },
  },
  // CLDR 48 Somali, written out because Chromium ships no Somali date or relative-time data.
  so: {
    months: ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Lul', 'Ogs', 'Seb', 'Okt', 'Nof', 'Dis'],
    date: '{month} {day}, {year}',
    clock: '{hour}:{minute} {period}',
    am: 'GH',
    pm: 'GD',
    past: {
      minute: { one: '{n} daqiiqad kahor', other: '{n} daqiiqadood kahor' },
      hour: { one: '{n} saacad kahor', other: '{n} saacadood kahor' },
      day: { one: '{n} maalin kahor', other: '{n} maalmood kahor' },
    },
  },
}

/**
 * The locale list handed to Intl. It always ends in 'en-US', so an unknown locale formats the same
 * on every device. A hand-written locale gets 'en-US' alone: Intl supplies its digits and
 * grouping, TIME_WORDS supplies every word.
 */
export function intlTags(locale: Locale): string[] {
  if (locale === 'en' || TIME_WORDS[locale]) return ['en-US']
  if (locale === 'tl') return ['fil', 'tl', 'en-US']
  return [locale, 'en-US']
}

const cache = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  let value = cache.get(key) as T | undefined
  if (value === undefined) {
    value = make()
    cache.set(key, value)
  }
  return value
}

/** The plural form a count takes in the locale. Haitian Creole and Hmong nouns have one form. */
export function pluralCategory(n: number, locale: Locale): keyof PluralForms {
  if (locale === 'ht' || locale === 'hmn') return 'other'
  const tags = locale === 'so' ? ['so', 'en-US'] : intlTags(locale)
  return cached(`plural|${locale}`, () => new Intl.PluralRules(tags)).select(n) as keyof PluralForms
}

/** The form of a plural message for a count ({n} and any other placeholder still to fill). */
export function pluralMessage(forms: PluralForms, n: number, locale: Locale): string {
  return forms[pluralCategory(n, locale)] ?? forms.other
}

/** "12,345" in the locale's digits and grouping. */
export function formatCount(n: number, locale: Locale): string {
  return cached(`count|${locale}`, () => new Intl.NumberFormat(intlTags(locale))).format(n)
}

/** "45%" for a whole percentage (0–100). */
export function formatPercent(percent: number, locale: Locale): string {
  return cached(
    `percent|${locale}`,
    () => new Intl.NumberFormat(intlTags(locale), { style: 'percent', maximumFractionDigits: 0 }),
  ).format(percent / 100)
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function wallClock(instant: Date, tz: string): WallClock {
  const parts = cached(
    `wall|${tz}`,
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }),
  ).formatToParts(instant)
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour') % 24, minute: n('minute') }
}

/** "Oct 9, 2026" — the calendar date of an instant in the viewer's zone (default: the browser's). */
export function formatDate(iso: string, locale: Locale, tz: string = browserTimeZone()): string {
  const instant = new Date(iso)
  const words = TIME_WORDS[locale]
  if (words) {
    const w = wallClock(instant, tz)
    return formatMessage(words.date, { day: w.day, month: words.months[w.month - 1], year: w.year })
  }
  return cached(
    `date|${locale}|${tz}`,
    () => new Intl.DateTimeFormat(intlTags(locale), { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }),
  ).format(instant)
}

/** "3:05 PM" — the clock time of an instant in the viewer's zone (default: the browser's). */
export function formatClock(iso: string, locale: Locale, tz: string = browserTimeZone()): string {
  const instant = new Date(iso)
  const words = TIME_WORDS[locale]
  if (words) {
    const w = wallClock(instant, tz)
    return formatMessage(words.clock, {
      hour: w.hour % 12 || 12,
      minute: String(w.minute).padStart(2, '0'),
      period: w.hour < 12 ? words.am : words.pm,
    })
  }
  return cached(
    `clock|${locale}|${tz}`,
    () => new Intl.DateTimeFormat(intlTags(locale), { timeZone: tz, hour: 'numeric', minute: '2-digit' }),
  ).format(instant)
}

/**
 * "5 minutes ago" for a past amount, sentence-cased. FEED's own words for ht, hmn and so;
 * Intl.RelativeTimeFormat (each language's plural forms) for the rest. null when this runtime has
 * no relative-time data for a locale FEED does not write by hand: the caller then uses its own
 * dictionary phrase.
 */
export function relativePast(n: number, unit: PastUnit, locale: Locale): string | null {
  const words = TIME_WORDS[locale]
  if (words) return formatMessage(pluralMessage(words.past[unit], n, locale), { n })
  const tags = intlTags(locale)
  const f = cached(`past|${locale}`, () =>
    typeof Intl.RelativeTimeFormat === 'function' && Intl.RelativeTimeFormat.supportedLocalesOf(tags[0]).length > 0
      ? new Intl.RelativeTimeFormat(tags, { numeric: 'always', style: 'long' })
      : null,
  )
  if (!f) return null
  const text = f.format(-n, unit)
  return text.charAt(0).toLocaleUpperCase(f.resolvedOptions().locale) + text.slice(1)
}
