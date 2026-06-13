// apps/web/src/lib/languages.ts
// Single source of truth for the 14 supported display languages + "Other".
// BCP-47 short codes stored in profiles.preferred_language.

export interface Language {
  code: string
  englishName: string
  nativeName: string
}

export const LANGUAGES: Language[] = [
  { code: 'en',    englishName: 'English',             nativeName: 'English' },
  { code: 'es',    englishName: 'Spanish',             nativeName: 'Español' },
  { code: 'ht',    englishName: 'Haitian Creole',      nativeName: 'Kreyòl ayisyen' },
  { code: 'vi',    englishName: 'Vietnamese',          nativeName: 'Tiếng Việt' },
  { code: 'ar',    englishName: 'Arabic',              nativeName: 'العربية' },
  { code: 'zh',    englishName: 'Chinese (Simplified)',nativeName: '中文（简体）' },
  { code: 'so',    englishName: 'Somali',              nativeName: 'Soomaali' },
  { code: 'fr',    englishName: 'French',              nativeName: 'Français' },
  { code: 'pt',    englishName: 'Portuguese',          nativeName: 'Português' },
  { code: 'ru',    englishName: 'Russian',             nativeName: 'Русский' },
  { code: 'ko',    englishName: 'Korean',              nativeName: '한국어' },
  { code: 'tl',    englishName: 'Tagalog',             nativeName: 'Tagalog' },
  { code: 'am',    englishName: 'Amharic',             nativeName: 'አማርኛ' },
  { code: 'hmn',   englishName: 'Hmong',               nativeName: 'Hmoob' },
  { code: 'other', englishName: 'Other',               nativeName: 'Other' },
]

/** All valid BCP-47 codes (including 'other') for validation. */
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code)

/**
 * Returns the display label for a stored BCP-47 code.
 * Falls back to the code itself when not found (defensive for DB values
 * added before this list was extended).
 */
export function languageLabel(code: string | null | undefined): string {
  if (!code) return 'English'
  const match = LANGUAGES.find((l) => l.code === code)
  return match ? `${match.nativeName} (${match.englishName})` : code
}

/**
 * Map a raw navigator.language tag (e.g. "es-419", "zh-Hans-CN") to the
 * nearest code in LANGUAGES. Returns 'en' when no match found.
 */
export function detectBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'en'
  const raw = navigator.language || ''
  // Exact match first
  const exact = LANGUAGES.find((l) => l.code === raw)
  if (exact) return exact.code
  // Prefix match (e.g. "es-419" → "es")
  const prefix = raw.split('-')[0].toLowerCase()
  const prefixMatch = LANGUAGES.find((l) => l.code === prefix)
  return prefixMatch ? prefixMatch.code : 'en'
}

/** localStorage key for guest language preference. */
export const GUEST_LANGUAGE_KEY = 'feed_preferred_language'
