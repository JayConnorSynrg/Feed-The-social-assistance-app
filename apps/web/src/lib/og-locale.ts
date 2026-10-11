// apps/web/src/lib/og-locale.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// posts.lang (one of FEED's 14 locale codes, or null) → the og:locale value for a share page, so a
// link preview's title and description are marked with the language they are written in.
//
// Sources for the values (both read 2026-10-11):
//   - The Open Graph protocol, https://ogp.me/#optional — og:locale is "Of the format
//     language_TERRITORY. Default is en_US."
//   - Meta for Developers, "Locales and Languages Supported by Facebook",
//     https://developers.facebook.com/docs/javascript/internationalization#locales — "Languages on
//     Facebook use the format ll_CC, where ll is a two-letter language code, and CC is a two-letter
//     country code ... There are two exceptions that do not follow the ISO standard: ar_AR and es_LA",
//     Meta's umbrella locales for Arabic and for Spanish.
//
// A post stores a language, not a country, so each language maps to one territory: Meta's umbrella
// locale where it defines one (ar_AR, es_LA), otherwise the territory the language is named for.
// Hmong (hmn) has no two-letter ISO 639-1 code, so no ll_CC value exists for it: the tag is left out
// rather than written wrong.

import type { Locale } from './i18n'

// Record<Locale, …>: a 15th locale fails the type check here until its value is decided.
const OG_LOCALE: Record<Locale, string | null> = {
  en: 'en_US',
  es: 'es_LA',
  ht: 'ht_HT',
  vi: 'vi_VN',
  ar: 'ar_AR',
  zh: 'zh_CN',
  so: 'so_SO',
  fr: 'fr_FR',
  pt: 'pt_BR',
  ru: 'ru_RU',
  ko: 'ko_KR',
  tl: 'tl_PH',
  am: 'am_ET',
  hmn: null,
}

/** The og:locale value for a post's language, or undefined when the tag must be omitted. */
export function ogLocaleForLang(lang: string | null | undefined): string | undefined {
  if (lang == null || !Object.prototype.hasOwnProperty.call(OG_LOCALE, lang)) return undefined
  return OG_LOCALE[lang as Locale] ?? undefined
}
