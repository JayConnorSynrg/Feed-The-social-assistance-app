// apps/web/src/lib/request-locale.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The locale a page request renders in before any profile is known — the one rule the root layout
// (app/layout.tsx) applies, feeding InitialLocaleContext:
//   1. the feed_locale cookie (lib/locale-cookie.ts), written when a member or guest chooses a language;
//   2. else the browser's Accept-Language header, in q-value order, by exact tag then primary subtag
//      ("es-419" → es, "zh-TW" → zh, "fil" → tl);
//   3. else none (the layout renders English).
// A loaded profile's language still wins afterwards (lib/i18n.ts resolveProfileLocale). Pure: no I/O,
// never throws — a malformed header is read as no header.

import { isLocale, type Locale } from './i18n'
import { parseLocaleCookie } from './locale-cookie'

export type RequestLocaleSource = 'cookie' | 'header'

export interface RequestLocale {
  locale: Locale | null
  source: RequestLocaleSource | null
}

/** Language tags browsers send that FEED knows under another code. */
const TAG_ALIASES: Record<string, Locale> = { fil: 'tl' }

function tagLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase()
  if (isLocale(lower)) return lower
  const primary = lower.split('-')[0]
  if (isLocale(primary)) return primary
  return Object.prototype.hasOwnProperty.call(TAG_ALIASES, primary) ? TAG_ALIASES[primary] : null
}

/** The first FEED locale the Accept-Language header asks for, highest q first; null when none. */
export function localeFromAcceptLanguage(header: unknown): Locale | null {
  if (typeof header !== 'string' || !header.trim()) return null
  try {
    const ranked: Array<{ tag: string; q: number; at: number }> = []
    header.split(',').forEach((part, at) => {
      const [rawTag, ...params] = part.trim().split(';')
      const tag = rawTag.trim()
      if (!/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/.test(tag)) return
      let q = 1
      for (const p of params) {
        const [name, value] = p.trim().split('=')
        if (name?.trim().toLowerCase() !== 'q') continue
        q = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test((value ?? '').trim()) ? Number(value) : -1
      }
      if (q > 0) ranked.push({ tag, q, at })
    })
    ranked.sort((a, b) => b.q - a.q || a.at - b.at)
    for (const { tag } of ranked) {
      const locale = tagLocale(tag)
      if (locale) return locale
    }
    return null
  } catch {
    return null
  }
}

/** Cookie first, then Accept-Language; `source` says which decided (null: neither). */
export function requestLocale(cookieValue: unknown, acceptLanguage: unknown): RequestLocale {
  const fromCookie = parseLocaleCookie(typeof cookieValue === 'string' ? cookieValue : null)
  if (fromCookie) return { locale: fromCookie, source: 'cookie' }
  const fromHeader = localeFromAcceptLanguage(acceptLanguage)
  return fromHeader ? { locale: fromHeader, source: 'header' } : { locale: null, source: null }
}
