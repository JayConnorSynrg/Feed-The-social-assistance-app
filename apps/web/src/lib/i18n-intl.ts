// apps/web/src/lib/i18n-intl.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Dates, clock times, ages, counts and plural forms in the viewer's language, the same on every
// device. lib/event-time.ts (event cards, forms) and lib/relative-age.ts (posts, comments) both
// format through this file.
//
// Intl has no usable data for three of FEED's 14 locales in at least one runtime FEED runs on
// (probed 2026-10-11: Node 20.20.2 / ICU 78.2, Chromium 148, Firefox 150, WebKit 26.4):
//   ht, hmn  absent in Node, Chromium and Firefox (US English comes back); WebKit says it supports
//            them and then prints placeholders ("2026 M10 9", "-5 min"), so asking
//            supportedLocalesOf is no guard;
//   so       absent in Chromium for dates, relative time and numbers.
// For those three FEED writes the words itself (TIME_WORDS) on every device: Intl lays the parts
// out for en-US and each word part (month, weekday, AM / PM) is replaced. A member reads the same
// text whichever browser they use, and a test in Node pins what a phone shows. The Somali month,
// weekday, day-period and past-age words are CLDR 48's own (the test compares them with Intl where
// the runtime has Somali). Somali "in 5 days" is written here: CLDR 48's has no "in" and a typo.
// ht, hmn and the Somali future ages are machine-drafted, needs native review:
// docs/i18n-native-review.md.
//
// Two more gaps, each closed by one rule:
//   tl  WebKit knows Tagalog as 'fil', not 'tl': it is asked for as 'fil' first (localeTags).
//   ko  ICU 78.2 (Node 20.20.2) prints the Korean day period in English ("PM 3:05"); ICU 77.1 and
//       78.3 print 오후. The day period is written here (DAY_PERIODS), so no runtime shows "PM".

import type { Locale } from './i18n'
import type { PluralForms } from './event-recurrence-format'
import { formatMessage } from './format-message'

export type { PluralForms }
export type RelativeUnit = 'minute' | 'hour' | 'day'
/** Kept for lib/relative-age.ts. */
export type PastUnit = RelativeUnit

type Twelve = readonly [string, string, string, string, string, string, string, string, string, string, string, string]
type Seven = readonly [string, string, string, string, string, string, string]

interface DayPeriods {
  am: string
  pm: string
}

interface TimeWords extends DayPeriods {
  /** January … December as they read inside a date, short and long. */
  months: Twelve
  monthsLong: Twelve
  /** Sunday … Saturday, long and short (the same names as lib/event-recurrence-format.ts). */
  weekdays: Seven
  weekdaysShort: Seven
  /** The day comes before a month name: "9 okt 2026" (en-US order is "Oct 9, 2026"). An
   *  all-digits date keeps the en-US layout. */
  dayFirst?: boolean
  /** Between a date and a clock time. Always FEED's own: en-US puts ", " there in ICU's data
   *  and the English word " at " in Apple's (WebKit). */
  timeJoiner: string
  /** "{n} minutes ago" and "In {n} minutes", per plural form. */
  past: Record<RelativeUnit, PluralForms>
  future: Record<RelativeUnit, PluralForms>
}

/** The locales whose time words FEED writes itself, on every device. */
export const TIME_WORDS: Partial<Record<Locale, TimeWords>> = {
  // machine-drafted, needs native review
  ht: {
    months: ['jan', 'fev', 'mas', 'avr', 'me', 'jen', 'jiy', 'out', 'sep', 'okt', 'nov', 'des'],
    monthsLong: ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'],
    weekdays: ['dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi', 'samdi'],
    weekdaysShort: ['dim', 'len', 'mad', 'mèk', 'jed', 'van', 'sam'],
    am: 'AM',
    pm: 'PM',
    dayFirst: true,
    timeJoiner: ', ',
    past: {
      minute: { other: 'Sa gen {n} minit' },
      hour: { other: 'Sa gen {n} èdtan' },
      day: { other: 'Sa gen {n} jou' },
    },
    future: {
      minute: { other: 'Nan {n} minit' },
      hour: { other: 'Nan {n} èdtan' },
      day: { other: 'Nan {n} jou' },
    },
  },
  // machine-drafted, needs native review
  hmn: {
    months: ['Lub Ib Hlis', 'Lub Ob Hlis', 'Lub Peb Hlis', 'Lub Plaub Hlis', 'Lub Tsib Hlis', 'Lub Rau Hli', 'Lub Xya Hli', 'Lub Yim Hli', 'Lub Cuaj Hli', 'Lub Kaum Hli', 'Lub Kaum Ib Hlis', 'Lub Kaum Ob Hlis'],
    monthsLong: ['Lub Ib Hlis', 'Lub Ob Hlis', 'Lub Peb Hlis', 'Lub Plaub Hlis', 'Lub Tsib Hlis', 'Lub Rau Hli', 'Lub Xya Hli', 'Lub Yim Hli', 'Lub Cuaj Hli', 'Lub Kaum Hli', 'Lub Kaum Ib Hlis', 'Lub Kaum Ob Hlis'],
    weekdays: ['Hnub Xya', 'Hnub Ib', 'Hnub Ob', 'Hnub Peb', 'Hnub Plaub', 'Hnub Tsib', 'Hnub Rau'],
    // Beside a date the bare number ("Rau", six) is unclear, so the short form is the full name.
    weekdaysShort: ['Hnub Xya', 'Hnub Ib', 'Hnub Ob', 'Hnub Peb', 'Hnub Plaub', 'Hnub Tsib', 'Hnub Rau'],
    am: 'AM',
    pm: 'PM',
    timeJoiner: ', ',
    past: {
      minute: { other: '{n} feeb dhau los' },
      hour: { other: '{n} teev dhau los' },
      day: { other: '{n} hnub dhau los' },
    },
    future: {
      minute: { other: 'Hauv {n} feeb' },
      hour: { other: 'Hauv {n} teev' },
      day: { other: 'Hauv {n} hnub' },
    },
  },
  // Month, weekday, day-period and past-age words: CLDR 48 Somali, written out because Chromium
  // ships no Somali date or relative-time data. Future ages: machine-drafted, needs native review.
  so: {
    months: ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Lul', 'Ogs', 'Seb', 'Okt', 'Nof', 'Dis'],
    monthsLong: ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maayo', 'Juun', 'Luulyo', 'Agosto', 'Sebtembar', 'Oktoobar', 'Noofeembar', 'Diseembar'],
    weekdays: ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimco', 'Sabti'],
    weekdaysShort: ['Axd', 'Isn', 'Tldo', 'Arbc', 'Khms', 'Jmc', 'Sbti'],
    am: 'GH',
    pm: 'GD',
    timeJoiner: ' ee ',
    past: {
      minute: { one: '{n} daqiiqad kahor', other: '{n} daqiiqadood kahor' },
      hour: { one: '{n} saacad kahor', other: '{n} saacadood kahor' },
      day: { one: '{n} maalin kahor', other: '{n} maalmood kahor' },
    },
    future: {
      minute: { one: '{n} daqiiqad kadib', other: '{n} daqiiqadood kadib' },
      hour: { one: '{n} saacad kadib', other: '{n} saacadood kadib' },
      day: { one: '{n} maalin kadib', other: '{n} maalmood kadib' },
    },
  },
}

/**
 * Day-period words for a locale Intl otherwise formats well. Korean: CLDR's own 오전 / 오후, which
 * ICU 78.2 replaces with "AM" / "PM".
 */
export const DAY_PERIODS: Partial<Record<Locale, DayPeriods>> = {
  ko: { am: '오전', pm: '오후' },
}

/** The BCP 47 tags of a FEED locale, most specific first, always ending in 'en-US'. */
export function localeTags(locale: Locale): string[] {
  if (locale === 'en') return ['en-US']
  if (locale === 'tl') return ['fil', 'tl', 'en-US']
  return [locale, 'en-US']
}

/**
 * The locale list handed to Intl for formatting. A hand-written locale gets 'en-US' alone: Intl
 * supplies its digits, grouping and layout, TIME_WORDS supplies every word.
 */
export function intlTags(locale: Locale): string[] {
  return TIME_WORDS[locale] ? ['en-US'] : localeTags(locale)
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
  return cached(`plural|${locale}`, () => new Intl.PluralRules(localeTags(locale))).select(n) as keyof PluralForms
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

// ---------------------------------------------------------------------------
// Dates and clock times
// ---------------------------------------------------------------------------

/** What every caller uses of an Intl.DateTimeFormat. `formatRange` is absent for a hand-written
 *  locale (the caller joins its two ends itself). */
export interface DateTimeFormatter {
  format(date: Date | number): string
  formatToParts(date: Date | number): Intl.DateTimeFormatPart[]
  formatRange?: (start: Date | number, end: Date | number) => string
  resolvedOptions(): Intl.ResolvedDateTimeFormatOptions
}

interface WallClock {
  month: number
  weekday: number
  hour: number
}

function wallClock(instant: Date | number, tz: string): WallClock {
  const parts = cached(
    `wall|${tz}`,
    () => new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }),
  ).formatToParts(instant)
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return { month: n('month'), weekday: new Date(Date.UTC(n('year'), n('month') - 1, n('day'))).getUTCDay(), hour: n('hour') % 24 }
}

/**
 * Put FEED's words into parts Intl laid out for en-US: month, weekday and day-period words, the
 * day before the month where the language wants it, and FEED's own joiner between a date and a
 * time. No English word of the en-US layout survives (exported for its test, which feeds it the
 * layouts of other runtimes).
 */
export function localizeParts(parts: Intl.DateTimeFormatPart[], instant: Date | number, tz: string, words: TimeWords, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  const w = wallClock(instant, tz)
  const longMonth = options.month === 'long' || options.dateStyle === 'long' || options.dateStyle === 'full'
  const longWeekday = options.weekday === 'long' || options.dateStyle === 'full'
  const out = parts.map((p) => {
    if (p.type === 'month' && !/^\d+$/.test(p.value)) return { ...p, value: (longMonth ? words.monthsLong : words.months)[w.month - 1] }
    if (p.type === 'weekday') return { ...p, value: (longWeekday ? words.weekdays : words.weekdaysShort)[w.weekday] }
    if (p.type === 'dayPeriod') return { ...p, value: w.hour < 12 ? words.am : words.pm }
    // One plain space wherever a runtime's en-US data uses a no-break one ("3:05 PM").
    if (p.type === 'literal') return { ...p, value: p.value.replace(/[  ]/g, ' ') }
    return p
  })
  for (let i = 0; i < out.length; i++) {
    const [a, b, c] = [out[i], out[i + 1], out[i + 2]]
    if (words.dayFirst && a.type === 'month' && !/^\d+$/.test(a.value) && b?.type === 'literal' && c?.type === 'day') {
      // "Sat, Oct 9, 2026" → "sam 9 okt 2026": the day first, and no comma around the date.
      out[i] = c
      out[i + 2] = a
      out[i + 1] = { ...b, value: ' ' }
      if (out[i - 1]?.type === 'literal' && out[i - 2]?.type === 'weekday') out[i - 1] = { ...out[i - 1], value: ' ' }
      if (out[i + 3]?.type === 'literal' && out[i + 4]?.type === 'year') out[i + 3] = { ...out[i + 3], value: ' ' }
    }
  }
  // Second pass, on the final order: the joiner between a date and a time, and no English word
  // left in any other literal.
  return out.map((p, i) => {
    if (p.type !== 'literal') return p
    const [before, after] = [out[i - 1]?.type, out[i + 1]?.type]
    if (after === 'hour' && (before === 'day' || before === 'year' || before === 'month')) return { ...p, value: words.timeJoiner }
    return /\p{L}/u.test(p.value) ? { ...p, value: p.value.replace(/\p{L}+/gu, '').replace(/\s+/g, ' ') } : p
  })
}

const join = (parts: Array<{ value: string }>) => parts.map((p) => p.value).join('')

/**
 * An Intl.DateTimeFormat for a FEED locale in a zone, cached per (locale, zone, options). For
 * ht, hmn and so the month, weekday and day-period words are FEED's own; for ko the day period
 * is. `locale` null = the fixed 'en-US' used for wall-clock arithmetic.
 */
export function dateTimeFormatter(locale: Locale | null, tz: string, options: Intl.DateTimeFormatOptions): DateTimeFormatter {
  return cached(`dtf|${locale}|${tz}|${JSON.stringify(options)}`, (): DateTimeFormatter => {
    const words = locale ? TIME_WORDS[locale] : undefined
    const periods = locale ? DAY_PERIODS[locale] : undefined
    const base = new Intl.DateTimeFormat(locale === null || words ? ['en-US'] : localeTags(locale), { ...options, timeZone: tz })
    if (words) {
      const formatToParts = (date: Date | number) => localizeParts(base.formatToParts(date), date, tz, words, options)
      return { format: (date) => join(formatToParts(date)), formatToParts, resolvedOptions: () => base.resolvedOptions() }
    }
    if (periods) {
      const word = (date: Date | number) => (wallClock(date, tz).hour < 12 ? periods.am : periods.pm)
      const formatToParts = (date: Date | number) => base.formatToParts(date).map((p) => (p.type === 'dayPeriod' ? { ...p, value: word(date) } : p))
      return {
        format: (date) => join(formatToParts(date)),
        formatToParts,
        formatRange: (start, end) =>
          join(base.formatRangeToParts(start, end).map((p) => (p.type === 'dayPeriod' ? { ...p, value: word(p.source === 'endRange' ? end : start) } : p))),
        resolvedOptions: () => base.resolvedOptions(),
      }
    }
    return base
  })
}

/** "Oct 9, 2026" — the calendar date of an instant in a zone. */
export function formatDate(iso: string, locale: Locale, tz: string): string {
  return dateTimeFormatter(locale, tz, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

/** "3:05 PM" — the clock time of an instant in a zone. */
export function formatClock(iso: string, locale: Locale, tz: string): string {
  return dateTimeFormatter(locale, tz, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

// ---------------------------------------------------------------------------
// Ages
// ---------------------------------------------------------------------------

function relative(n: number, unit: RelativeUnit, locale: Locale, direction: 'past' | 'future'): string | null {
  const words = TIME_WORDS[locale]
  if (words) return formatMessage(pluralMessage(words[direction][unit], n, locale), { n })
  const tags = localeTags(locale)
  const f = cached(`relative|${locale}`, () =>
    typeof Intl.RelativeTimeFormat === 'function' && Intl.RelativeTimeFormat.supportedLocalesOf(tags[0]).length > 0
      ? new Intl.RelativeTimeFormat(tags, { numeric: 'always', style: 'long' })
      : null,
  )
  if (!f) return null
  const text = f.format(direction === 'past' ? -n : n, unit)
  return text.charAt(0).toLocaleUpperCase(f.resolvedOptions().locale) + text.slice(1)
}

/**
 * "5 minutes ago" for a past amount, sentence-cased. FEED's own words for ht, hmn and so;
 * Intl.RelativeTimeFormat (each language's plural forms) for the rest. null when this runtime has
 * no relative-time data for a locale FEED does not write by hand: the caller then uses its own
 * dictionary phrase.
 */
export function relativePast(n: number, unit: RelativeUnit, locale: Locale): string | null {
  return relative(n, unit, locale, 'past')
}

/** "In 5 minutes" for a coming amount; the same sources and the same null as relativePast. */
export function relativeFuture(n: number, unit: RelativeUnit, locale: Locale): string | null {
  return relative(n, unit, locale, 'future')
}
