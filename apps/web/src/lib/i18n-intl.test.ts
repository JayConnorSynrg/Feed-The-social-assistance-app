// apps/web/src/lib/i18n-intl.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Dates, clock times and past ages read in the viewer's language in all 14 locales, pinned at
// fixed instants in an explicit zone. A locale that silently falls back to English fails here:
//   - ht, hmn and so never touch the runtime's locale data (FEED writes their words), so what this
//     Node run pins is what Chromium, Firefox and WebKit show;
//   - the Somali words are CLDR's: where the runtime has Somali, they equal Intl's output;
//   - Tagalog is asked for as 'fil' first (WebKit has no 'tl');
//   - counts choose a plural form through Intl.PluralRules (Arabic's six, Russian's four).
// Intl-backed strings are compared with spacing normalised (CLDR mixes in no-break spaces).

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import {
  TIME_WORDS,
  formatClock,
  formatCount,
  formatDate,
  formatPercent,
  intlTags,
  pluralCategory,
  pluralMessage,
  relativePast,
} from './i18n-intl'
import { relativeAge } from './relative-age'

const LOCALES = Object.keys(messages) as Locale[]
const TZ = 'America/New_York'
const AFTERNOON = '2026-10-09T19:05:00Z' // 3:05 PM in New York
const MORNING = '2026-01-05T14:07:00Z' // 9:07 AM in New York
/** No-break and thin spaces → a plain space; bidi marks dropped. */
const norm = (s: string | null) => (s ?? '').replace(/[   ]/g, ' ').replace(/[‎‏؜]/g, '')

// [date, afternoon clock, morning clock, 1 min, 5 min, 1 h, 5 h, 1 d, 5 d, a date 69 days old]
const PINNED: Record<Locale, readonly string[]> = {
  en: ['Oct 9, 2026', '3:05 PM', '9:07 AM', '1 minute ago', '5 minutes ago', '1 hour ago', '5 hours ago', '1 day ago', '5 days ago', 'Aug 1, 2026'],
  es: ['9 oct 2026', '15:05', '9:07', 'Hace 1 minuto', 'Hace 5 minutos', 'Hace 1 hora', 'Hace 5 horas', 'Hace 1 día', 'Hace 5 días', '1 ago 2026'],
  ht: ['9 okt 2026', '3:05 PM', '9:07 AM', 'Sa gen 1 minit', 'Sa gen 5 minit', 'Sa gen 1 èdtan', 'Sa gen 5 èdtan', 'Sa gen 1 jou', 'Sa gen 5 jou', '1 out 2026'],
  vi: ['9 thg 10, 2026', '15:05', '9:07', '1 phút trước', '5 phút trước', '1 giờ trước', '5 giờ trước', '1 ngày trước', '5 ngày trước', '1 thg 8, 2026'],
  ar: ['9 أكتوبر 2026', '3:05 م', '9:07 ص', 'قبل دقيقة واحدة', 'قبل 5 دقائق', 'قبل ساعة واحدة', 'قبل 5 ساعات', 'قبل يوم واحد', 'قبل 5 أيام', '1 أغسطس 2026'],
  zh: ['2026年10月9日', '15:05', '9:07', '1分钟前', '5分钟前', '1小时前', '5小时前', '1天前', '5天前', '2026年8月1日'],
  so: ['Okt 9, 2026', '3:05 GD', '9:07 GH', '1 daqiiqad kahor', '5 daqiiqadood kahor', '1 saacad kahor', '5 saacadood kahor', '1 maalin kahor', '5 maalmood kahor', 'Ogs 1, 2026'],
  fr: ['9 oct. 2026', '15:05', '9:07', 'Il y a 1 minute', 'Il y a 5 minutes', 'Il y a 1 heure', 'Il y a 5 heures', 'Il y a 1 jour', 'Il y a 5 jours', '1 août 2026'],
  pt: ['9 de out. de 2026', '15:05', '9:07', 'Há 1 minuto', 'Há 5 minutos', 'Há 1 hora', 'Há 5 horas', 'Há 1 dia', 'Há 5 dias', '1 de ago. de 2026'],
  ru: ['9 окт. 2026 г.', '15:05', '9:07', '1 минуту назад', '5 минут назад', '1 час назад', '5 часов назад', '1 день назад', '5 дней назад', '1 авг. 2026 г.'],
  ko: ['2026년 10월 9일', 'PM 3:05', 'AM 9:07', '1분 전', '5분 전', '1시간 전', '5시간 전', '1일 전', '5일 전', '2026년 8월 1일'],
  tl: ['Okt 9, 2026', '3:05 PM', '9:07 AM', '1 minuto ang nakalipas', '5 minuto ang nakalipas', '1 oras ang nakalipas', '5 oras ang nakalipas', '1 araw ang nakalipas', '5 araw ang nakalipas', 'Ago 1, 2026'],
  am: ['ኦክቶ 9 2026', '3:05 ከሰዓት', '9:07 ጥዋት', 'ከ1 ደቂቃ በፊት', 'ከ5 ደቂቃዎች በፊት', 'ከ1 ሰዓት በፊት', 'ከ5 ሰዓቶች በፊት', 'ከ1 ቀን በፊት', 'ከ5 ቀናት በፊት', 'ኦገስ 1 2026'],
  hmn: ['Lub Kaum Hli 9, 2026', '3:05 PM', '9:07 AM', '1 feeb dhau los', '5 feeb dhau los', '1 teev dhau los', '5 teev dhau los', '1 hnub dhau los', '5 hnub dhau los', 'Lub Yim Hli 1, 2026'],
}

function actual(locale: Locale): string[] {
  return [
    formatDate(AFTERNOON, locale, TZ),
    formatClock(AFTERNOON, locale, TZ),
    formatClock(MORNING, locale, TZ),
    relativePast(1, 'minute', locale),
    relativePast(5, 'minute', locale),
    relativePast(1, 'hour', locale),
    relativePast(5, 'hour', locale),
    relativePast(1, 'day', locale),
    relativePast(5, 'day', locale),
    relativeAge('2026-08-01T12:00:00Z', locale, Date.parse(AFTERNOON), TZ),
  ].map(norm)
}

describe('time in the viewer language, all 14 locales', () => {
  it('pins every locale of lib/i18n.ts', () => {
    expect(LOCALES).toHaveLength(14)
    expect(Object.keys(PINNED).sort()).toEqual([...LOCALES].sort())
  })

  it.each(LOCALES)('%s: date, clock time (afternoon, morning), ages of 1 and 5 minutes / hours / days, an old date', (locale) => {
    expect(actual(locale)).toEqual(PINNED[locale])
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s: the date and every age differ from the English text (no silent fallback)', (locale) => {
    const en = actual('en')
    const got = actual(locale)
    for (const i of [0, 3, 4, 5, 6, 7, 8, 9]) expect(got[i], `${locale}[${i}]`).not.toBe(en[i])
  })

  it('an age is never the runtime placeholder for a locale without data ("-5 min", "M10")', () => {
    for (const locale of LOCALES) {
      const all = actual(locale).join(' | ')
      expect(all, locale).not.toMatch(/-\d|\bM\d\d\b/)
    }
  })
})

describe('the hand-written locales', () => {
  it('are exactly ht, hmn and so, each with twelve months and every word filled', () => {
    expect(Object.keys(TIME_WORDS).sort()).toEqual(['hmn', 'ht', 'so'])
    for (const [locale, words] of Object.entries(TIME_WORDS)) {
      expect(words.months, locale).toHaveLength(12)
      expect(new Set(words.months).size, locale).toBe(12)
      for (const text of [...words.months, words.am, words.pm]) expect(text.trim(), locale).not.toBe('')
      expect(words.date.match(/\{\w+\}/g)?.sort(), locale).toEqual(['{day}', '{month}', '{year}'])
      expect(words.clock.match(/\{\w+\}/g)?.sort(), locale).toEqual(['{hour}', '{minute}', '{period}'])
      for (const forms of Object.values(words.past)) {
        for (const form of Object.values(forms)) expect(form, locale).toContain('{n}')
      }
    }
  })

  it('never ask the runtime for their words: Intl gets en-US digits only', () => {
    for (const locale of ['ht', 'hmn', 'so'] as const) expect(intlTags(locale)).toEqual(['en-US'])
  })

  it('every month and both day periods: midnight is 12, noon is 12 PM', () => {
    const months = (locale: Locale) => Array.from({ length: 12 }, (_, m) => formatDate(new Date(Date.UTC(2026, m, 15, 12)).toISOString(), locale, 'UTC'))
    expect(months('ht')).toEqual(['15 jan 2026', '15 fev 2026', '15 mas 2026', '15 avr 2026', '15 me 2026', '15 jen 2026', '15 jiy 2026', '15 out 2026', '15 sep 2026', '15 okt 2026', '15 nov 2026', '15 des 2026'])
    expect(months('hmn')[0]).toBe('Lub Ib Hlis 15, 2026')
    expect(months('hmn')[11]).toBe('Lub Kaum Ob Hlis 15, 2026')
    expect(formatClock('2026-10-09T00:00:00Z', 'ht', 'UTC')).toBe('12:00 AM')
    expect(formatClock('2026-10-09T12:00:00Z', 'ht', 'UTC')).toBe('12:00 PM')
    expect(formatClock('2026-10-09T23:59:00Z', 'hmn', 'UTC')).toBe('11:59 PM')
  })

  it('the date follows the zone passed in, not the machine', () => {
    expect(formatDate('2026-10-10T02:30:00Z', 'ht', 'America/New_York')).toBe('9 okt 2026')
    expect(formatDate('2026-10-10T02:30:00Z', 'ht', 'UTC')).toBe('10 okt 2026')
  })

  it('Somali equals CLDR wherever this runtime has Somali data', () => {
    // Node ships full ICU; if a future runtime drops Somali this comparison has nothing to read.
    expect(Intl.DateTimeFormat.supportedLocalesOf(['so'])).toEqual(['so'])
    const date = new Intl.DateTimeFormat('so', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
    const clock = new Intl.DateTimeFormat('so', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' })
    const past = new Intl.RelativeTimeFormat('so', { numeric: 'always', style: 'long' })
    for (let m = 0; m < 12; m++) {
      for (const hour of [0, 9, 12, 15]) {
        const iso = new Date(Date.UTC(2026, m, 15, hour, 7)).toISOString()
        expect(formatDate(iso, 'so', 'UTC')).toBe(norm(date.format(new Date(iso))))
        expect(formatClock(iso, 'so', 'UTC')).toBe(norm(clock.format(new Date(iso))))
      }
    }
    for (const unit of ['minute', 'hour', 'day'] as const) {
      for (const n of [1, 2, 5, 11, 21]) expect(relativePast(n, unit, 'so')).toBe(norm(past.format(-n, unit)))
    }
  })
})

describe('Intl locale list', () => {
  it("ends in en-US, and asks for Tagalog as 'fil' first", () => {
    expect(intlTags('en')).toEqual(['en-US'])
    expect(intlTags('tl')).toEqual(['fil', 'tl', 'en-US'])
    expect(intlTags('ar')).toEqual(['ar', 'en-US'])
    for (const locale of LOCALES) expect(intlTags(locale).at(-1)).toBe('en-US')
  })
})

describe('plural forms, counts and percentages', () => {
  it('Arabic has six forms, Russian four; Haitian Creole and Hmong one', () => {
    expect([0, 1, 2, 3, 11, 100].map((n) => pluralCategory(n, 'ar'))).toEqual(['zero', 'one', 'two', 'few', 'many', 'other'])
    expect([1, 2, 5, 21, 1.5].map((n) => pluralCategory(n, 'ru'))).toEqual(['one', 'few', 'many', 'one', 'other'])
    expect([0, 1, 2].map((n) => pluralCategory(n, 'en'))).toEqual(['other', 'one', 'other'])
    expect([1, 2].map((n) => pluralCategory(n, 'so'))).toEqual(['one', 'other'])
    for (const locale of ['ht', 'hmn'] as const) expect([0, 1, 2, 5].map((n) => pluralCategory(n, locale))).toEqual(['other', 'other', 'other', 'other'])
  })

  it('pluralMessage picks the form and falls back to "other"', () => {
    const forms = { one: '{n} signature', other: '{n} signatures' }
    expect(pluralMessage(forms, 1, 'en')).toBe('{n} signature')
    expect(pluralMessage(forms, 5, 'en')).toBe('{n} signatures')
    expect(pluralMessage(forms, 3, 'ar')).toBe('{n} signatures') // no "few" given
    expect(pluralMessage(forms, 1, 'ht')).toBe('{n} signatures')
  })

  it('counts and percentages use the locale grouping', () => {
    expect(formatCount(12345, 'en')).toBe('12,345')
    expect(formatCount(12345, 'es')).toBe('12.345')
    expect(norm(formatCount(12345, 'fr'))).toBe('12 345')
    for (const locale of ['ht', 'hmn', 'so'] as const) expect(formatCount(12345, locale)).toBe('12,345')
    expect(formatPercent(45, 'en')).toBe('45%')
    expect(norm(formatPercent(45, 'fr'))).toBe('45 %')
    expect(norm(formatPercent(45, 'ar'))).toBe('45%')
    expect(formatPercent(100, 'hmn')).toBe('100%')
  })
})

describe('relativeAge', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()
  const MIN = 60_000

  it('just now, minutes, hours, days, then the date — in English', () => {
    expect(relativeAge(ago(20_000), 'en', now, TZ)).toBe('just now')
    expect(relativeAge(ago(5 * MIN), 'en', now, TZ)).toBe('5 minutes ago')
    expect(relativeAge(ago(120 * MIN), 'en', now, TZ)).toBe('2 hours ago')
    expect(relativeAge(ago(3 * 24 * 60 * MIN), 'en', now, TZ)).toBe('3 days ago')
    expect(relativeAge(ago(45 * 24 * 60 * MIN), 'en', now, TZ)).toBe('Aug 25, 2026')
  })

  it.each([
    ['ht', 'kounye a', 'Sa gen 5 minit', 'Sa gen 2 èdtan', 'Sa gen 3 jou', '25 out 2026'],
    ['hmn', 'tam sim no', '5 feeb dhau los', '2 teev dhau los', '3 hnub dhau los', 'Lub Yim Hli 25, 2026'],
    ['so', 'hadda', '5 daqiiqadood kahor', '2 saacadood kahor', '3 maalmood kahor', 'Ogs 25, 2026'],
  ] as const)('%s reads in its own words at every step', (locale, justNow, minutes, hours, days, date) => {
    expect(relativeAge(ago(20_000), locale, now, TZ)).toBe(justNow)
    expect(relativeAge(ago(5 * MIN), locale, now, TZ)).toBe(minutes)
    expect(relativeAge(ago(120 * MIN), locale, now, TZ)).toBe(hours)
    expect(relativeAge(ago(3 * 24 * 60 * MIN), locale, now, TZ)).toBe(days)
    expect(relativeAge(ago(45 * 24 * 60 * MIN), locale, now, TZ)).toBe(date)
  })
})
