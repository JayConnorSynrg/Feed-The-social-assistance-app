// apps/web/src/lib/locale-cookie.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed_locale cookie names one of the 14 locales or nothing; its attributes; and the root
// layout renders <html lang dir> from it while the app's own content stays marked English until
// each surface's root says otherwise.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

  it('the root layout sets <html lang dir> from the cookie and keeps #app-content English by default', () => {
    const layout = readFileSync(fileURLToPath(new URL('../app/layout.tsx', import.meta.url)), 'utf8')
    expect(layout).toMatch(/parseLocaleCookie\(\(await cookies\(\)\)\.get\(LOCALE_COOKIE\)\?\.value\)/)
    expect(layout).toMatch(/<html lang=\{documentLocale\} dir=\{dir\(documentLocale\)\}/)
    expect(layout).toMatch(/<Providers initialUser=\{initialUser\} initialLocale=\{initialLocale\}>/)
    expect(layout).toMatch(/<div id="app-content" lang="en" dir="ltr"/)
  })
})
