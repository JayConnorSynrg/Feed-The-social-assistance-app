// apps/web/src/lib/locale-cookie.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed_locale cookie names one of the 14 locales or nothing, and its attributes. The root
// layout's use of it is tested by calling the layout: app/layout.locale.test.ts.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { LOCALE_COOKIE, localeFromCookieHeader, parseLocaleCookie, serializeLocaleCookie } from './locale-cookie'

describe('feed_locale', () => {
  it('only the 14 locales are read; anything else is no cookie', () => {
    expect(parseLocaleCookie('ko')).toBe('ko')
    expect(parseLocaleCookie('hmn')).toBe('hmn')
    for (const bad of ['other', 'KO', 'ko-KR', '', 'en;x', null, undefined]) expect(parseLocaleCookie(bad)).toBeNull()
  })

  it('found among other cookies', () => {
    expect(localeFromCookieHeader(`sb-x=1; ${LOCALE_COOKIE}=ar; theme=light`)).toBe('ar')
    expect(localeFromCookieHeader('sb-x=1')).toBeNull()
    expect(localeFromCookieHeader(`${LOCALE_COOKIE}=xx`)).toBeNull()
  })

  it('attributes: whole site, one year, SameSite=Lax, Secure on https', () => {
    expect(serializeLocaleCookie('ko', true)).toBe('feed_locale=ko; Path=/; Max-Age=31536000; SameSite=Lax; Secure')
    expect(serializeLocaleCookie('ko', false)).toBe('feed_locale=ko; Path=/; Max-Age=31536000; SameSite=Lax')
  })
})
