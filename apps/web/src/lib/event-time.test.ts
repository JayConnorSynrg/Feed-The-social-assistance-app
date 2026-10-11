// apps/web/src/lib/event-time.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a viewer reads on every event surface, and what the form says about a wall-clock time.
// Fixed instants and explicit zones only, so results are identical on any CI host.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { spawnSync } from 'node:child_process'
import { messages, type Locale } from './i18n'
import {
  checkLocalTime,
  dateTimeFormat,
  formatCalendarDate,
  formatEventWhen as formatRaw,
  formatShortDate,
  intlLocale,
  relativeTimeText,
  timeZoneOptions,
  venueDateKey,
  COMMON_US_ZONES,
  SERVER_UNSUPPORTED_ZONES,
} from './event-time'

// ICU versions differ in the spaces they print (U+202F before AM/PM, U+2009 around the range
// dash); compare with plain spaces so the assertion is about the words, not the ICU build.
const plain = (s: string | null) => (s === null ? null : s.replace(/[\u202f\u2009\u00a0]/g, ' '))
const formatEventWhen: typeof formatRaw = (...args) => {
  const w = formatRaw(...args)
  return { text: plain(w.text) as string, venue: plain(w.venue) }
}

// 2026-11-10 10:00–11:30 in New York (EST, UTC-5) = 15:00–16:30 UTC.
const START = '2026-11-10T15:00:00Z'
const END = '2026-11-10T16:30:00Z'

describe('formatEventWhen — viewer time plus venue time', () => {
  it('a viewer in the venue zone sees one line with the zone abbreviation', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/New_York' })
    expect(w.text).toBe('Tue, Nov 10, 10:00 – 11:30 AM EST')
    expect(w.venue).toBeNull()
  })

  it('a viewer in another zone sees their own time AND the venue time labelled', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/Los_Angeles' })
    expect(w.text).toBe('Tue, Nov 10, 7:00 – 8:30 AM PST')
    expect(w.venue).toBe('Venue time: Tue, Nov 10, 10:00 – 11:30 AM EST')
  })

  it('the same instant renders the same venue line for every viewer', () => {
    const a = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/Chicago' })
    const b = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'Europe/London' })
    expect(a.venue).toBe(b.venue)
    expect(a.text).toBe('Tue, Nov 10, 9:00 – 10:30 AM CST')
  })

  it('a zone with the same offset (Detroit vs New York) needs no second line', () => {
    expect(formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/Detroit' }).venue).toBeNull()
  })

  it('DST boundary day: spring-forward Sunday 2026-03-08, 03:30–05:00 EDT', () => {
    // 03:30 EDT (UTC-4) = 07:30Z. Phoenix has no DST (UTC-7) -> 00:30–02:00 MST.
    const w = formatEventWhen('2026-03-08T07:30:00Z', '2026-03-08T09:00:00Z', 'America/New_York', 'en', {
      viewerTz: 'America/Phoenix',
    })
    expect(w.text).toBe('Sun, Mar 8, 12:30 – 2:00 AM MST')
    expect(w.venue).toBe('Venue time: Sun, Mar 8, 3:30 – 5:00 AM EDT')
  })

  it('DST boundary day: an event spanning the fall-back hour keeps both abbreviations', () => {
    // 2026-11-01 00:30 EDT (04:30Z) – 01:30 EST (06:30Z): three real hours.
    const w = formatEventWhen('2026-11-01T04:30:00Z', '2026-11-01T06:30:00Z', 'America/New_York', 'en', {
      viewerTz: 'America/New_York',
    })
    expect(w.text).toBe('Sun, Nov 1, 12:30 AM EDT – 1:30 AM EST')
  })

  it('offsets that agree at the start but not the end still show the venue line', () => {
    // Phoenix (UTC-7 all year) vs Denver on 2026-03-08: Denver is UTC-7 before 02:00 local, UTC-6 after.
    const w = formatEventWhen('2026-03-08T08:00:00Z', '2026-03-08T10:00:00Z', 'America/Denver', 'en', {
      viewerTz: 'America/Phoenix',
    })
    expect(w.venue).not.toBeNull()
  })

  it('overnight across the fall-back night shows both dates and both abbreviations', () => {
    // 2026-10-31 20:00 EDT (2026-11-01T00:00Z) – 2026-11-01 02:00 EST (07:00Z): seven real hours.
    const w = formatEventWhen('2026-11-01T00:00:00Z', '2026-11-01T07:00:00Z', 'America/New_York', 'en', {
      viewerTz: 'America/New_York',
    })
    expect(w.text).toBe('Sat, Oct 31, 8:00 PM EDT – Sun, Nov 1, 2:00 AM EST')
  })

  it('times only (calendar chip)', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/New_York', timeOnly: true })
    expect(w.text).toBe('10:00 – 11:30 AM EST')
  })

  it('the venue label follows the viewer locale', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'es', { viewerTz: 'America/Los_Angeles' })
    expect(w.venue?.startsWith('Hora del lugar: ')).toBe(true)
  })
})

describe('checkLocalTime — the form names a DST gap or repeat before submit', () => {
  it('a normal time maps to its instant', () => {
    const r = checkLocalTime('2026-11-10', '10:00', 'America/New_York')
    expect(r).toEqual({ kind: 'ok', instant: new Date('2026-11-10T15:00:00Z') })
  })
  it('spring-forward gap: 02:30 on 2026-03-08 does not exist in New York', () => {
    expect(checkLocalTime('2026-03-08', '02:30', 'America/New_York').kind).toBe('gap')
  })
  it('fall-back repeat: 01:30 on 2026-11-01 happens twice in New York', () => {
    expect(checkLocalTime('2026-11-01', '01:30', 'America/New_York').kind).toBe('repeat')
  })
  it('the minutes either side of the gap are fine', () => {
    expect(checkLocalTime('2026-03-08', '01:59', 'America/New_York')).toEqual({ kind: 'ok', instant: new Date('2026-03-08T06:59:00Z') })
    expect(checkLocalTime('2026-03-08', '03:00', 'America/New_York')).toEqual({ kind: 'ok', instant: new Date('2026-03-08T07:00:00Z') })
  })
  it('a 30-minute DST shift (Lord Howe) is detected too', () => {
    // Lord Howe: +11 -> +10:30 at 02:00 local on 2026-04-05 (01:30–02:00 repeats).
    expect(checkLocalTime('2026-04-05', '01:45', 'Australia/Lord_Howe').kind).toBe('repeat')
    // +10:30 -> +11 at 02:00 local on 2026-10-04 (02:00–02:30 skipped).
    expect(checkLocalTime('2026-10-04', '02:15', 'Australia/Lord_Howe').kind).toBe('gap')
  })
  it('a zone with no DST never reports a gap', () => {
    expect(checkLocalTime('2026-03-08', '02:30', 'America/Phoenix').kind).toBe('ok')
  })
  it('an unknown zone or malformed time is invalid', () => {
    expect(checkLocalTime('2026-03-08', '02:30', 'Mars/Olympus').kind).toBe('invalid')
    expect(checkLocalTime('2026-3-8', '2:30', 'America/New_York').kind).toBe('invalid')
  })
})

describe('venueDateKey / timeZoneOptions', () => {
  it('files a date under the venue’s local day', () => {
    // 2026-11-11 03:00Z is still Nov 10 in Los Angeles and already Nov 11 in London.
    expect(venueDateKey('2026-11-11T03:00:00Z', 'America/Los_Angeles')).toBe('2026-11-10')
    expect(venueDateKey('2026-11-11T03:00:00Z', 'Europe/London')).toBe('2026-11-11')
  })
  it('lists the common US zones first and every other IANA Area/Location zone after', () => {
    const o = timeZoneOptions('en', 'America/New_York', new Date('2026-11-10T15:00:00Z'))
    expect(o.common.map((z) => z.value)).toEqual([...COMMON_US_ZONES])
    expect(o.common[0].label).toBe('Eastern Standard Time (America/New_York)')
    expect(o.all.some((z) => z.value === 'Europe/London')).toBe(true)
    expect(o.all.some((z) => z.value === 'UTC' || z.value === 'America/New_York')).toBe(false)
  })
})

describe('intlLocale — the tag list ends in en-US, so raw Intl never takes the device language', () => {
  it('every FEED locale ends with en-US', () => {
    expect(intlLocale('en')).toEqual(['en-US'])
    expect(intlLocale('ht')).toEqual(['ht', 'en-US'])
    expect(intlLocale('hmn')).toEqual(['hmn', 'en-US'])
    expect(intlLocale('es')).toEqual(['es', 'en-US'])
  })

  it('on a device whose own language is Spanish, ht dates are English, not Spanish', () => {
    // The ICU default locale comes from the process environment, so this runs in a child Node
    // with a Spanish default and hands it the exact list intlLocale returns.
    const sat = Date.UTC(2026, 9, 10, 12)
    const script = `const t = JSON.parse(process.argv[1]); process.stdout.write(new Intl.DateTimeFormat(t, { weekday: 'long', timeZone: 'UTC' }).format(new Date(${sat})))`
    const run = (tags: unknown) =>
      spawnSync(process.execPath, ['-e', script, JSON.stringify(tags)], {
        env: { ...process.env, LC_ALL: 'es_ES.UTF-8', LANG: 'es_ES.UTF-8' },
        encoding: 'utf8',
      }).stdout
    expect(run('ht')).toBe('sábado') // control: a bare 'ht' takes the device language
    expect(run(intlLocale('ht'))).toBe('Saturday')
    expect(run(intlLocale('hmn'))).toBe('Saturday')
    // ...and FEED's own formatter writes the Creole word whatever the device language is.
    expect(dateTimeFormat('ht', 'UTC', { weekday: 'long' }).format(new Date(sat))).toBe('samdi')
  })
})

describe('dateTimeFormat — one Intl.DateTimeFormat per (locale, zone, options)', () => {
  it('returns the same formatter for the same inputs and a new one when any differs', () => {
    const o = { hour: 'numeric', minute: '2-digit' } as const
    const a = dateTimeFormat('en', 'America/New_York', o)
    expect(dateTimeFormat('en', 'America/New_York', { ...o })).toBe(a)
    expect(dateTimeFormat('es', 'America/New_York', o)).not.toBe(a)
    expect(dateTimeFormat('en', 'America/Chicago', o)).not.toBe(a)
    expect(dateTimeFormat('en', 'America/New_York', { ...o, weekday: 'short' })).not.toBe(a)
  })

  it('rendering many cards builds a handful of formatters, not one per card', () => {
    // Count real constructions (a subclass, so cached instances keep working) for a zone pair no
    // other test uses, so the cache starts cold for it.
    const Real = Intl.DateTimeFormat
    let built = 0
    class Counting extends Real {
      constructor(...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
        super(...args)
        built++
      }
    }
    ;(Intl as { DateTimeFormat: unknown }).DateTimeFormat = Counting
    try {
      for (let i = 0; i < 50; i++) {
        formatEventWhen(START, END, 'Asia/Kathmandu', 'en', { viewerTz: 'Pacific/Chatham' })
      }
    } finally {
      ;(Intl as { DateTimeFormat: unknown }).DateTimeFormat = Real
    }
    expect(built).toBeGreaterThan(0) // control: the counter sees the first card's formatters
    expect(built).toBeLessThan(10)
  })
})

describe('time-zone picker leaves out zones the server converts differently', () => {
  it('America/Asuncion and America/Coyhaique are not offered', () => {
    expect([...SERVER_UNSUPPORTED_ZONES].sort()).toEqual(['America/Asuncion', 'America/Coyhaique'])
    const ids = timeZoneOptions('en', 'America/New_York').all.map((z) => z.value)
    expect(ids).not.toContain('America/Asuncion')
    expect(ids).not.toContain('America/Coyhaique')
    // control: Intl does list Asuncion, and its neighbours stay in the picker
    expect((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone')).toContain('America/Asuncion')
    expect(ids).toContain('America/Montevideo')
  })
  it('an event already in one of them still shows its own zone', () => {
    expect(timeZoneOptions('en', 'America/Asuncion').all.map((z) => z.value)).toContain('America/Asuncion')
  })
})

describe('calendar dates and relative time', () => {
  it('a venue calendar date reads the same in every device zone', () => {
    expect(plain(formatCalendarDate('2027-04-30', 'en'))).toBe('Fri, Apr 30, 2027')
    expect(plain(formatCalendarDate('2027-04-30', 'ht'))).toBe('van 30 avr 2027')
  })
  it('the short date of an instant follows the viewer zone', () => {
    // 2026-10-11 03:00Z is still Oct 10 in Los Angeles.
    expect(formatShortDate('2026-10-11T03:00:00Z', 'en', 'America/Los_Angeles')).toBe('Sat, Oct 10')
    expect(formatShortDate('2026-10-11T03:00:00Z', 'en', 'Europe/London')).toBe('Sun, Oct 11')
    expect(formatShortDate('2026-10-11T03:00:00Z', 'ht', 'America/Los_Angeles')).toBe('sam 10 okt')
    expect(formatShortDate('2026-10-11T03:00:00Z', 'ht', 'Europe/London')).toBe('dim 11 okt')
  })
  it('relative time: sentence-cased; FEED\'s own words where Intl has none; a negative amount is past', () => {
    expect(relativeTimeText(3, 'day', 'en')).toBe('In 3 days')
    expect(relativeTimeText(2, 'hour', 'ru')).toBe('Через 2 часа')
    expect(relativeTimeText(3, 'day', 'ht')).toBe('Nan 3 jou')
    expect(relativeTimeText(3, 'day', 'hmn')).toBe('Hauv 3 hnub')
    expect(relativeTimeText(-3, 'day', 'en')).toBe('3 days ago')
    expect(relativeTimeText(-3, 'day', 'ht')).toBe('Sa gen 3 jou')
  })
})

describe('an event reads in the viewer language, all 14 locales', () => {
  // Saturday 2026-10-10, 3:05–4:30 PM in New York, seen from New York.
  const WHEN_START = '2026-10-10T19:05:00Z'
  const WHEN_END = '2026-10-10T20:30:00Z'
  const NY = 'America/New_York'
  // CLDR 47 (Node 22) abbreviates Vietnamese weekdays "Th 7"; CLDR 48 writes "Thứ 7". Both are
  // Vietnamese; compare on the CLDR 48 spelling.
  const cldr48 = (s: string | null) => (plain(s) ?? '').replace(/\bTh (\d)/g, 'Thứ $1')

  // [start–end with its zone, short date, calendar date, in 20 minutes, in 1 hour, in 3 days]
  const PINNED: Record<Locale, readonly string[]> = {
    en: ['Sat, Oct 10, 3:05 – 4:30 PM EDT', 'Sat, Oct 10', 'Fri, Apr 30, 2027', 'In 20 minutes', 'In 1 hour', 'In 3 days'],
    es: ['sáb, 10 oct, 15:05–16:30 GMT-4', 'sáb, 10 oct', 'vie, 30 abr 2027', 'Dentro de 20 minutos', 'Dentro de 1 hora', 'Dentro de 3 días'],
    ht: ['sam 10 okt, 3:05 PM – 4:30 PM EDT', 'sam 10 okt', 'van 30 avr 2027', 'Nan 20 minit', 'Nan 1 èdtan', 'Nan 3 jou'],
    vi: ['15:05–16:30 EDT Thứ 7, 10 thg 10', 'Thứ 7, 10 thg 10', 'Thứ 6, 30 thg 4, 2027', 'Sau 20 phút nữa', 'Sau 1 giờ nữa', 'Sau 3 ngày nữa'],
    ar: ['السبت، 10 أكتوبر، 3:05–4:30 م غرينتش-4', 'السبت، 10 أكتوبر', 'الجمعة، 30 أبريل 2027', 'خلال 20 دقيقة', 'خلال ساعة واحدة', 'خلال 3 أيام'],
    zh: ['10/10周六 GMT-4 15:05–16:30', '10月10日周六', '2027年4月30日周五', '20分钟后', '1小时后', '3天后'],
    so: ['Sbti, Okt 10 ee 3:05 GD – 4:30 GD EDT', 'Sbti, Okt 10', 'Jmc, Abr 30, 2027', '20 daqiiqadood kadib', '1 saacad kadib', '3 maalmood kadib'],
    fr: ['sam. 10 oct., 15:05 – 16:30 UTC−4', 'sam. 10 oct.', 'ven. 30 avr. 2027', 'Dans 20 minutes', 'Dans 1 heure', 'Dans 3 jours'],
    pt: ['sáb., 10 de out. 15:05 – 16:30 GMT-4', 'sáb., 10 de out.', 'sex., 30 de abr. de 2027', 'Em 20 minutos', 'Em 1 hora', 'Em 3 dias'],
    ru: ['сб, 10 окт., 15:05–16:30 GMT-4', 'сб, 10 окт.', 'пт, 30 апр. 2027 г.', 'Через 20 минут', 'Через 1 час', 'Через 3 дня'],
    ko: ['10월 10일 (토) 오후 3:05~4:30 GMT-4', '10월 10일 (토)', '2027년 4월 30일 (금)', '20분 후', '1시간 후', '3일 후'],
    tl: ['Sab, Okt 10, 3:05–4:30 PM GMT-4', 'Sab, Okt 10', 'Biy, Abr 30, 2027', 'Sa 20 minuto', 'Sa 1 oras', 'Sa 3 araw'],
    am: ['ቅዳሜ፣ ኦክቶ 10 3:05 – 4:30 ከሰዓት ጂ ኤም ቲ-4', 'ቅዳሜ፣ ኦክቶ 10', 'ዓርብ፣ ኤፕሪ 30 2027', 'በ20 ደቂቃዎች ውስጥ', 'በ1 ሰዓት ውስጥ', 'በ3 ቀናት ውስጥ'],
    hmn: ['Hnub Rau, Lub Kaum Hli 10, 3:05 PM – 4:30 PM EDT', 'Hnub Rau, Lub Kaum Hli 10', 'Hnub Tsib, Lub Plaub Hlis 30, 2027', 'Hauv 20 feeb', 'Hauv 1 teev', 'Hauv 3 hnub'],
  }
  const LOCALES = Object.keys(PINNED) as Locale[]
  const actual = (locale: Locale) =>
    [
      formatRaw(WHEN_START, WHEN_END, NY, locale, { viewerTz: NY }).text,
      formatShortDate(WHEN_START, locale, NY),
      formatCalendarDate('2027-04-30', locale),
      relativeTimeText(20, 'minute', locale),
      relativeTimeText(1, 'hour', locale),
      relativeTimeText(3, 'day', locale),
    ].map(cldr48)

  it('pins the 14 locales of lib/i18n.ts', () => {
    expect([...LOCALES].sort()).toEqual(Object.keys(messages).sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s: start–end, short date, calendar date, in 20 minutes / 1 hour / 3 days', (locale) => {
    expect(actual(locale)).toEqual(PINNED[locale])
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s: no cell is the English text or a runtime placeholder', (locale) => {
    const en = actual('en')
    const got = actual(locale)
    for (let i = 0; i < got.length; i++) {
      expect(got[i], `${locale}[${i}]`).not.toBe(en[i])
      expect(got[i], `${locale}[${i}]`).not.toMatch(/\bM\d\d\b|^[+-]\d/)
    }
    // No English month or weekday name anywhere in the line.
    expect(got.join(' | '), locale).not.toMatch(/\b(Sat|Fri|Oct|Apr|Saturday|October)\b/)
  })

  it('the venue line of a far-away viewer reads in the locale too', () => {
    const w = formatRaw(WHEN_START, WHEN_END, NY, 'ht', { viewerTz: 'America/Los_Angeles' })
    expect(plain(w.text)).toBe('sam 10 okt, 12:05 PM – 1:30 PM PDT')
    expect(plain(w.venue)).toContain('sam 10 okt, 3:05 PM – 4:30 PM EDT')
  })

  it('a range across a clock change still names each zone (hand-written locale)', () => {
    // 2026-11-01 in New York: 1:30 AM EDT … 1:30 AM EST (clocks fall back at 2:00).
    const w = formatRaw('2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z', NY, 'ht', { viewerTz: NY })
    expect(plain(w.text)).toBe('dim 1 nov, 1:30 AM EDT – 1:30 AM EST')
  })

  it('a range that runs into another year names the year on both ends — in the hand-written locales too', () => {
    // Thu 2026-12-31 11:30 PM … Fri 2027-01-01 1:30 AM in New York.
    const range = (locale: Locale) => plain(formatRaw('2027-01-01T04:30:00Z', '2027-01-01T06:30:00Z', NY, locale, { viewerTz: NY }).text)
    expect(range('en')).toBe('Thu, Dec 31, 2026, 11:30 PM EST – Fri, Jan 1, 2027, 1:30 AM EST')
    expect(range('ht')).toBe('jed 31 des 2026, 11:30 PM – van 1 jan 2027, 1:30 AM EST')
    expect(range('hmn')).toBe('Hnub Plaub, Lub Kaum Ob Hlis 31, 2026, 11:30 PM – Hnub Tsib, Lub Ib Hlis 1, 2027, 1:30 AM EST')
    expect(range('so')).toBe('Khms, Dis 31, 2026 ee 11:30 GD – Jmc, Jan 1, 2027 ee 1:30 GH EST')
    for (const locale of ['ht', 'hmn', 'so'] as const) {
      expect(range(locale), locale).toContain('2026')
      expect(range(locale), locale).toContain('2027')
    }
  })

  it('a range across two days of the same year prints no year (hand-written locale)', () => {
    const w = plain(formatRaw('2026-10-11T03:30:00Z', '2026-10-11T05:30:00Z', NY, 'ht', { viewerTz: NY }).text)
    expect(w).toBe('sam 10 okt, 11:30 PM – dim 11 okt, 1:30 AM EDT')
  })

  it('a times-only range (calendar chip) never prints a date or a year', () => {
    const w = plain(formatRaw('2027-01-01T04:30:00Z', '2027-01-01T06:30:00Z', NY, 'ht', { viewerTz: NY, timeOnly: true }).text)
    expect(w).toBe('11:30 PM – 1:30 AM EST')
  })

  it("Intl is asked for the locale itself, Tagalog as 'fil' first, en-US last", () => {
    expect(intlLocale('en')).toEqual(['en-US'])
    expect(intlLocale('tl')).toEqual(['fil', 'tl', 'en-US'])
    expect(intlLocale('ht')).toEqual(['ht', 'en-US'])
    expect(intlLocale('ko')).toEqual(['ko', 'en-US'])
  })
})
