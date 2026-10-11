// apps/web/src/lib/event-recurrence-format.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What an admin and a member read for a repeating event, in each of the 14 locales: the pattern,
// how the series ends, and the cancelled-date notice. Fixed dates and explicit zones only.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import {
  formatCancelledNotice,
  formatRecurrence,
  formatSeriesEnd,
  joinList,
  ordinalWeekday,
  RECURRENCE_GRAMMAR,
  weekdayName,
  type PluralForms,
} from './event-recurrence-format'
import {
  monthlyChoices,
  monthlyPatternRule,
  NTH_OF_PERIOD,
  WEEKDAY_CODES,
  type RecurrenceRule,
  type WeekdayCode,
} from './event-recurrence'

const LOCALES = Object.keys(messages) as Locale[]
const plain = (s: string) => s.replace(/[\u202f\u2009\u00a0]/g, ' ')

const weekly = (days: WeekdayCode[], interval?: number): RecurrenceRule => ({
  frequency: 'weekly',
  ...(interval ? { interval } : {}),
  byDay: days.map((day) => ({ day })),
})

describe('formatRecurrence — English', () => {
  it('weekly, Sunday-first list, interval', () => {
    expect(formatRecurrence(weekly(['th', 'tu']), 'en')).toBe('Every week on Tuesday and Thursday')
    expect(formatRecurrence(weekly(['sa', 'su', 'we'], 2), 'en')).toBe('Every 2 weeks on Sunday, Wednesday, and Saturday')
  })
  it('monthly by position (first-to-last) and by day number (ascending)', () => {
    expect(formatRecurrence({ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }] }, 'en')).toBe('Monthly on the second Saturday')
    expect(
      formatRecurrence({ frequency: 'monthly', byDay: [{ day: 'fr', nthOfPeriod: -1 }, { day: 'sa', nthOfPeriod: 4 }] }, 'en'),
    ).toBe('Monthly on the fourth Saturday and the last Friday')
    expect(formatRecurrence({ frequency: 'monthly', byMonthDay: [15, 1] }, 'en')).toBe('Monthly on day 1 and day 15')
  })
})

describe('monthly radio labels from the start date', () => {
  it('Sat Nov 28 2026 offers day 28, the fourth Saturday, the last Saturday', () => {
    expect(monthlyChoices('2026-11-28').map((c) => formatRecurrence(monthlyPatternRule(c.pattern), 'en'))).toEqual([
      'Monthly on day 28',
      'Monthly on the fourth Saturday',
      'Monthly on the last Saturday',
    ])
  })
})

describe('gender and case agreement (pt, ru)', () => {
  it('pt: masculine sábado, feminine terça-feira', () => {
    expect(ordinalWeekday(2, 'sa', 'pt')).toBe('no segundo sábado')
    expect(ordinalWeekday(2, 'tu', 'pt')).toBe('na segunda terça-feira')
    expect(ordinalWeekday(-1, 'fr', 'pt')).toBe('na última sexta-feira')
    expect(formatRecurrence(weekly(['tu', 'sa']), 'pt')).toBe('Toda semana, às terças-feiras e aos sábados')
  })
  it('ru: masculine / feminine / neuter ordinals with the accusative weekday', () => {
    expect(ordinalWeekday(2, 'tu', 'ru')).toBe('во второй вторник')
    expect(ordinalWeekday(2, 'sa', 'ru')).toBe('во вторую субботу')
    expect(ordinalWeekday(2, 'su', 'ru')).toBe('во второе воскресенье')
    expect(ordinalWeekday(-1, 'we', 'ru')).toBe('в последнюю среду')
    expect(formatRecurrence(weekly(['tu'], 2), 'ru')).toBe('Раз в 2 недели по вторникам')
    expect(formatSeriesEnd({ ...weekly(['tu']), count: 5 }, 'ru')).toBe('Всего 5 раз')
    expect(formatSeriesEnd({ ...weekly(['tu']), count: 3 }, 'ru')).toBe('Всего 3 раза')
  })
})

describe('Arabic dual and plural forms', () => {
  it('every two weeks is the dual, three is the plural', () => {
    expect(formatRecurrence(weekly(['sa'], 2), 'ar')).toBe('كل أسبوعين: السبت')
    expect(formatRecurrence(weekly(['sa'], 3), 'ar')).toBe('كل 3 أسابيع: السبت')
  })
  it('count: one / two / few / many', () => {
    const r = (count: number): RecurrenceRule => ({ ...weekly(['sa']), count })
    expect(formatSeriesEnd(r(1), 'ar')).toBe('ينتهي بعد موعد واحد')
    expect(formatSeriesEnd(r(2), 'ar')).toBe('ينتهي بعد موعدين')
    expect(formatSeriesEnd(r(5), 'ar')).toBe('ينتهي بعد 5 مواعيد')
    expect(formatSeriesEnd(r(11), 'ar')).toBe('ينتهي بعد 11 موعدًا')
  })
  it('ordinal follows the weekday', () => {
    expect(formatRecurrence({ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }] }, 'ar')).toBe('كل شهر: السبت الثاني')
  })
})

describe('ht and hmn: own weekday names and list word (no CLDR data)', () => {
  it('ht', () => {
    expect(weekdayName('sa', 'ht')).toBe('samdi')
    expect(joinList(['madi', 'jedi'], 'ht')).toBe('madi ak jedi')
    expect(joinList(['a', 'b', 'c'], 'ht')).toBe('a, b ak c')
    expect(formatRecurrence(weekly(['tu', 'th']), 'ht')).toBe('Chak semèn, madi ak jedi')
  })
  it('hmn', () => {
    expect(formatRecurrence(weekly(['tu', 'th']), 'hmn')).toBe('Txhua lub lim tiam rau Hnub Ob thiab Hnub Plaub')
    expect(formatRecurrence({ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: -1 }] }, 'hmn')).toBe('Txhua lub hli rau Hnub Rau kawg')
  })
  it('a locale with ListFormat data uses it (Arabic joins "و" to the next word)', () => {
    expect(joinList(['الثلاثاء', 'الخميس'], 'ar')).toBe('الثلاثاء والخميس')
  })
})

describe('joinList: the joining word is the same on every device', () => {
  type LF = typeof Intl.ListFormat
  const intl = Intl as unknown as { ListFormat: LF }
  /** A runtime whose Intl.ListFormat claims every locale and joins with commas only: what WebKit
   *  26.4 does for ht and hmn (r3-5b list probe, 2026-10-11). */
  function withStubListFormat<T>(run: () => T): T {
    const real = intl.ListFormat
    class Stub {
      static supportedLocalesOf(tags: string | string[]) {
        return [tags].flat()
      }
      format(items: string[]) {
        return items.join(', ')
      }
    }
    intl.ListFormat = Stub as unknown as LF
    try {
      return run()
    } finally {
      intl.ListFormat = real
    }
  }

  it.each([
    ['ht', 'a ak b', 'a, b ak c'],
    ['hmn', 'a thiab b', 'a, b thiab c'],
    ['so', 'a iyo b', 'a, b iyo c'],
  ] as const)('%s is hand-written: "%s", "%s"', (locale, two, three) => {
    expect(joinList(['a', 'b'], locale)).toBe(two)
    expect(joinList(['a', 'b', 'c'], locale)).toBe(three)
  })

  it('ht, hmn and so never ask Intl.ListFormat, even when the runtime says it supports them', async () => {
    // A fresh module, so no formatter cached by an earlier test is reused.
    vi.resetModules()
    const fresh = await import('./event-recurrence-format')
    withStubListFormat(() => {
      expect(fresh.joinList(['a', 'b', 'c'], 'ht')).toBe('a, b ak c')
      expect(fresh.joinList(['a', 'b', 'c'], 'hmn')).toBe('a, b thiab c')
      expect(fresh.joinList(['a', 'b', 'c'], 'so')).toBe('a, b iyo c')
      // A locale FEED does not write by hand does go through Intl (here: the stub).
      expect(fresh.joinList(['a', 'b', 'c'], 'es')).toBe('a, b, c')
    })
  })

  it('the hand-written Somali joiner equals Intl where the runtime has Somali', () => {
    if (Intl.ListFormat.supportedLocalesOf('so').length === 0) return
    const so = new Intl.ListFormat('so', { type: 'conjunction', style: 'long' })
    expect(joinList(['a', 'b'], 'so')).toBe(so.format(['a', 'b']))
    expect(joinList(['a', 'b', 'c'], 'so')).toBe(so.format(['a', 'b', 'c']))
  })

  it('Tagalog is asked for as fil (the only name WebKit knows it by)', async () => {
    vi.resetModules()
    const asked: string[][] = []
    const real = intl.ListFormat
    class Spy {
      static supportedLocalesOf(tags: string | string[]) {
        return [tags].flat().filter((t) => t !== 'tl')
      }
      constructor(tags: string[]) {
        asked.push(tags)
      }
      format(items: string[]) {
        return items.join(' + ')
      }
    }
    intl.ListFormat = Spy as unknown as LF
    try {
      const fresh = await import('./event-recurrence-format')
      expect(fresh.joinList(['a', 'b'], 'tl')).toBe('a + b')
      expect(asked).toEqual([['fil', 'tl', 'en-US']])
    } finally {
      intl.ListFormat = real
    }
    expect(joinList(['a', 'b', 'c'], 'tl')).toBe('a, b, at c')
  })

  it('one item is itself; none is empty', () => {
    expect(joinList(['a'], 'ht')).toBe('a')
    expect(joinList([], 'so')).toBe('')
  })
})

describe('formatSeriesEnd', () => {
  it('until / count / never', () => {
    expect(plain(formatSeriesEnd({ ...weekly(['sa']), until: '2027-04-30T23:59:59' }, 'en'))).toBe('Ends Fri, Apr 30, 2027')
    expect(formatSeriesEnd({ ...weekly(['sa']), count: 1 }, 'en')).toBe('Ends after 1 date')
    expect(formatSeriesEnd({ ...weekly(['sa']), count: 10 }, 'en')).toBe('Ends after 10 dates')
    expect(formatSeriesEnd(weekly(['sa']), 'en')).toBe('No end date')
  })
  it('the until date is the venue calendar date in every viewer zone', () => {
    // A date with no time: never shifted to Apr 29 or May 1 by the device zone.
    expect(plain(formatSeriesEnd({ ...weekly(['sa']), until: '2027-04-30T23:59:59' }, 'es'))).toContain('30')
  })
})

describe('formatCancelledNotice — "{date} cancelled — next: {next}"', () => {
  // Sat Oct 10 and Sat Oct 24 2026, 10:00 in New York.
  const OCT10 = '2026-10-10T14:00:00Z'
  const OCT24 = '2026-10-24T14:00:00Z'
  it('names the cancelled date and the next one in the viewer zone', () => {
    expect(formatCancelledNotice(OCT10, OCT24, 'en', 'America/New_York')).toBe('Sat, Oct 10 cancelled — next: Sat, Oct 24')
  })
  it('no later date: the cancellation alone', () => {
    expect(formatCancelledNotice(OCT10, null, 'en', 'America/New_York')).toBe('Sat, Oct 10 cancelled')
  })
  it('follows the viewer locale; ht dates read in Creole too (FEED writes them, lib/i18n-intl.ts)', () => {
    expect(formatCancelledNotice(OCT10, OCT24, 'es', 'America/New_York')).toBe('sáb, 10 oct cancelada — próxima: sáb, 24 oct')
    expect(formatCancelledNotice(OCT10, OCT24, 'ht', 'America/New_York')).toBe('sam 10 okt anile — pwochen: sam 24 okt')
  })
  it('adds the venue date when it reads differently from the viewer date (never a date that contradicts the venue day)', () => {
    // Sat Oct 10 01:00 in New York = Fri Oct 9 22:00 in Los Angeles.
    const EARLY = '2026-10-10T05:00:00Z'
    expect(formatCancelledNotice(EARLY, OCT24, 'en', 'America/Los_Angeles', 'America/New_York')).toBe(
      'Fri, Oct 9 (Venue time: Sat, Oct 10) cancelled — next: Sat, Oct 24',
    )
    // Same calendar day in both zones: no venue date, even though the offsets differ.
    expect(formatCancelledNotice(OCT10, OCT24, 'en', 'America/Los_Angeles', 'America/New_York')).toBe(
      'Sat, Oct 10 cancelled — next: Sat, Oct 24',
    )
    expect(formatCancelledNotice(EARLY, null, 'es', 'America/Los_Angeles', 'America/New_York')).toMatch(/^vie, 9 oct \(.+: sáb, 10 oct\) cancelada$/)
  })
})

describe('RECURRENCE_GRAMMAR parity — 14 locales', () => {
  it('covers exactly the locales of lib/i18n.ts', () => {
    expect(Object.keys(RECURRENCE_GRAMMAR).sort()).toEqual([...LOCALES].sort())
  })

  const forms = (p: PluralForms) => Object.values(p) as string[]

  it.each(LOCALES)('%s: every weekday, ordinal and template is present with its slots', (locale) => {
    const g = RECURRENCE_GRAMMAR[locale]
    for (const d of WEEKDAY_CODES) {
      for (const table of [g.weekday, g.weekdayShort, g.weeklyDay, g.ordinalDay ?? g.weekday]) {
        expect(table[d]?.trim(), `${locale} ${d}`).toBeTruthy()
      }
    }
    for (const n of NTH_OF_PERIOD) {
      const o = g.ordinal[String(n) as '1']
      if (typeof o !== 'string') {
        expect(g.dayGender, `${locale}: gendered ordinals need dayGender`).toBeDefined()
        for (const d of WEEKDAY_CODES) expect(o[g.dayGender![d]] ?? o.m).toBeTruthy()
      }
    }
    expect(g.ordinalWeekday).toMatch(/\{ordinal\}/)
    expect(g.ordinalWeekday).toMatch(/\{day\}/)
    expect(g.monthDay).toMatch(/\{n\}/)
    for (const t of [g.weekly, g.monthlyByDay, g.monthlyByMonthDay, ...forms(g.weeklyInterval)]) expect(t).toMatch(/\{days\}/)
    expect(g.weeklyInterval.other).toMatch(/\{n\}/)
    expect(g.count.other).toMatch(/\{n\}/)
    expect(g.until).toMatch(/\{date\}/)
    expect(g.never.trim()).toBeTruthy()
  })

  const RULES: RecurrenceRule[] = [
    weekly(['su', 'sa']),
    weekly(['mo', 'we', 'fr'], 2),
    weekly(['tu'], 3),
    weekly(['th'], 4),
    { frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }, { day: 'sa', nthOfPeriod: 4 }] },
    { frequency: 'monthly', byDay: NTH_OF_PERIOD.map((n, i) => ({ day: WEEKDAY_CODES[i], nthOfPeriod: n })) },
    { frequency: 'monthly', byMonthDay: [31], until: '2027-04-30T23:59:59' },
    { frequency: 'monthly', byMonthDay: [1, 15], count: 2 },
  ]

  it.each(LOCALES)('%s: every phrase renders with no unfilled slot', (locale) => {
    for (const rule of RULES) {
      for (const text of [formatRecurrence(rule, locale), formatSeriesEnd(rule, locale)]) {
        expect(text.trim(), `${locale}`).not.toBe('')
        expect(text, `${locale}: ${text}`).not.toMatch(/[{}]|undefined/)
      }
    }
    for (const count of [1, 2, 3, 5, 11, 21, 100]) {
      expect(formatSeriesEnd({ ...weekly(['sa']), count }, locale)).not.toMatch(/[{}]|undefined/)
    }
  })
})
