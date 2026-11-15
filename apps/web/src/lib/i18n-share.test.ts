// apps/web/src/lib/i18n-share.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The share pages' words (lib/i18n-share.ts) in the 14 FEED locales: the dictionary keeps the
// parity rules; the like / comment count tables cover every locale with {count} in each form and
// read in the locale's plural form and digits; opening hours read in the locale's clock and
// weekday words, Haitian Creole and Hmong included (FEED's own words: Intl has none), with the
// English lines exactly as before (lib/business.test.ts).

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import { COMMENTS_COUNT, LIKES_COUNT, clockText, hoursIntervalText, openNowText, shareCount, shareMessages, shareT, weekdayShortText } from './i18n-share'

const LOCALES = Object.keys(messages) as Locale[]

// "Email" is written the same in a few languages.
describeDictionaryParity('share pages', shareMessages, shareT, new Set(['Email']))

describe.each([
  ['likes', LIKES_COUNT],
  ['comments', COMMENTS_COUNT],
] as const)('the %s count', (_name, table) => {
  it.each(LOCALES)('%s: an `other` form, and {count} in every form', (l) => {
    const forms = table[l] as Record<string, string>
    expect(forms.other).toBeTruthy()
    for (const f of Object.values(forms)) expect(f).toContain('{count}')
  })
})

describe('counts read in the plural form and digits of the locale', () => {
  it('English keeps its two forms', () => {
    expect(shareCount(LIKES_COUNT, 1, 'en')).toBe('1 like')
    expect(shareCount(LIKES_COUNT, 0, 'en')).toBe('0 likes')
    expect(shareCount(COMMENTS_COUNT, 1, 'en')).toBe('1 comment')
    expect(shareCount(COMMENTS_COUNT, 12, 'en')).toBe('12 comments')
  })
  it('Russian, Korean and Arabic', () => {
    expect(shareCount(COMMENTS_COUNT, 5, 'ru')).toBe('5 комментариев')
    expect(shareCount(COMMENTS_COUNT, 3, 'ru')).toBe('3 комментария')
    expect(shareCount(LIKES_COUNT, 4, 'ko')).toBe('좋아요 4개')
    expect(shareCount(COMMENTS_COUNT, 2, 'ar')).toContain('تعليقان')
  })
})

describe('opening hours in the viewer\'s language', () => {
  const row = (open: string, close: string) => ({ day_of_week: 1, open_time: open, close_time: close })

  it('Korean: CLDR clock with 오전 / 오후 and Korean weekday', () => {
    expect(clockText(540, 'ko')).toBe('오전 9:00')
    expect(clockText(1020, 'ko')).toBe('오후 5:00')
    expect(weekdayShortText(1, 'ko')).toBe('월')
    expect(hoursIntervalText(row('22:00', '02:00'), 'ko')).toBe('오후 10:00 – 오전 2:00 (다음 날)')
    expect(openNowText({ open: false, openDay: 1, openMinute: 540 }, 'ko')).toBe('영업 종료 · 월 오전 9:00에 시작')
  })

  it('French: a 24-hour clock', () => {
    expect(clockText(1020, 'fr')).toBe('17:00')
    expect(openNowText({ open: true, closeDay: 1, closeMinute: 1020 }, 'fr')).toBe('Ouvert · ferme à 17:00')
  })

  it('Haitian Creole and Hmong use FEED\'s own weekday words, never the English ones', () => {
    expect(weekdayShortText(1, 'ht')).toBe('len')
    expect(weekdayShortText(1, 'hmn')).toBe('Hnub Ib')
    expect(openNowText({ open: false, openDay: 1, openMinute: 540 }, 'ht')).toBe('Fèmen · ouvri len a 9:00 AM')
    for (const l of ['ht', 'hmn'] as const) {
      for (let d = 0; d < 7; d++) expect(weekdayShortText(d, l)).not.toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
    }
  })

  it('every locale: open all day is the locale\'s own line, and a zero-length or broken row is omitted', () => {
    for (const l of LOCALES) {
      expect(hoursIntervalText(row('00:00', '24:00'), l)).toBe(shareT(l, 'open24h'))
      expect(hoursIntervalText(row('09:00', '09:00'), l)).toBeNull()
      expect(hoursIntervalText(row('09:00', 'bad'), l)).toBeNull()
    }
  })
})
