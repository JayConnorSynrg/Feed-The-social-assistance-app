// apps/web/src/lib/locale-cookie.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed_locale cookie: the member's language for the server render of the next page load, so
// the first paint and <html lang dir> are already in that language (app/layout.tsx reads it).
// The profile stays the source of truth: providers/locale-sync.tsx corrects a cookie that
// disagrees with a loaded profile, and the cookie only decides the language until the profile
// has loaded.
//
// Attributes, each for a reason:
//   Path=/          every route renders through the one root layout.
//   Max-Age 1 year  a preference, not a session; refreshed on every save and correction.
//   SameSite=Lax    sent on top-level navigations to FEED (a shared link opens in the member's
//                   language), never on cross-site subrequests.
//   Secure          on https (production); omitted on http://localhost so development works.
//   not HttpOnly    the browser writes it at the moment a save succeeds (document.cookie), so the
//                   next reload is already right with no extra request. HttpOnly cookies cannot be
//                   written by the page. The value is one of 14 language codes, read only after
//                   isLocale() validation on both sides, and carries nothing personal.

import { isLocale, type Locale } from './i18n'

export const LOCALE_COOKIE = 'feed_locale'
export const LOCALE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

/** The locale a raw cookie value names, or null for a missing or unknown value. */
export function parseLocaleCookie(value: string | null | undefined): Locale | null {
  return isLocale(value) ? value : null
}

/** The Set-Cookie / document.cookie string for `locale`. */
export function serializeLocaleCookie(locale: Locale, secure: boolean): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_S}; SameSite=Lax${secure ? '; Secure' : ''}`
}

/** The feed_locale value inside a Cookie header / document.cookie string. */
export function localeFromCookieHeader(header: string | null | undefined): Locale | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === LOCALE_COOKIE) return parseLocaleCookie(rest.join('='))
  }
  return null
}

/** The cookie as the browser holds it now (null on the server). */
export function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null
  return localeFromCookieHeader(document.cookie)
}

/** Writes the cookie in the browser. A no-op on the server. */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return
  const secure = typeof location !== 'undefined' && location.protocol === 'https:'
  document.cookie = serializeLocaleCookie(locale, secure)
}
