// apps/web/src/lib/request-locale.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The request's locale before any profile (lib/request-locale.ts): the feed_locale cookie beats
// Accept-Language, the header beats the English default, q-values rank the header's tags, and a
// malformed or unsupported header is no header. Pure, never throws.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { localeFromAcceptLanguage, requestLocale } from './request-locale'

describe('requestLocale', () => {
  it('cookie beats header', () => {
    expect(requestLocale('vi', 'ko')).toEqual({ locale: 'vi', source: 'cookie' })
  })
  it('header beats default when the cookie is missing or not a FEED locale', () => {
    expect(requestLocale(undefined, 'ko-KR')).toEqual({ locale: 'ko', source: 'header' })
    expect(requestLocale('other', 'ko-KR')).toEqual({ locale: 'ko', source: 'header' })
  })
  it('neither: no locale (the layout renders English)', () => {
    expect(requestLocale(undefined, null)).toEqual({ locale: null, source: null })
    expect(requestLocale(42, ['ko'])).toEqual({ locale: null, source: null })
  })
})

describe('localeFromAcceptLanguage', () => {
  it.each([
    ['ko', 'ko'],
    ['es-419', 'es'],
    ['zh-TW', 'zh'],
    ['HMN', 'hmn'],
    ['fil-PH', 'tl'],
    ['pt-BR,pt;q=0.9', 'pt'],
  ])('%j → %s', (header, locale) => {
    expect(localeFromAcceptLanguage(header)).toBe(locale)
  })

  it('respects q-values, not header order', () => {
    expect(localeFromAcceptLanguage('fr;q=0.3, ru;q=0.8, ko;q=0.5')).toBe('ru')
    expect(localeFromAcceptLanguage('de, so;q=0.2, vi;q=0.1')).toBe('so')
  })

  it('equal q keeps header order; q=0 means "not this language"', () => {
    expect(localeFromAcceptLanguage('am;q=0.5, ht;q=0.5')).toBe('am')
    expect(localeFromAcceptLanguage('ko;q=0, es;q=0.1')).toBe('es')
  })

  it.each([
    [''], ['   '], ['de-DE, ja'], ['*'], [';;;,,=q'], ['ko;q=abc'], ['ko;q=1.5'], ['<script>'], [null], [undefined], [7], [{}],
  ])('malformed or unsupported %j → null, without throwing', (header) => {
    expect(() => localeFromAcceptLanguage(header)).not.toThrow()
    expect(localeFromAcceptLanguage(header)).toBeNull()
  })
})
