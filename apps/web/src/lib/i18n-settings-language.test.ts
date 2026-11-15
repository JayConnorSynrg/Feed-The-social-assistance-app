// apps/web/src/lib/i18n-settings-language.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Parity for the Language section's dictionary: exactly the 14 locales, the English key set,
// non-empty values, the English {placeholders}, and translated (not a copy of English).

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { settingsLanguageMessages, settingsLanguageT } from './i18n-settings-language'

const LOCALES = Object.keys(messages) as Locale[]
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
const en = settingsLanguageMessages.en as unknown as Record<string, string>
const keys = Object.keys(en).sort()

describe('settings language dictionary', () => {
  it('covers exactly the 14 locales of lib/i18n.ts', () => {
    expect(Object.keys(settingsLanguageMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s: the English key set, every value non-empty, the English {placeholders}', (locale) => {
    const d = settingsLanguageMessages[locale] as unknown as Record<string, string>
    expect(Object.keys(d).sort()).toEqual(keys)
    for (const k of keys) {
      expect(d[k].trim(), `${locale}.${k}`).not.toBe('')
      expect(placeholders(d[k]), `${locale}.${k}`).toEqual(placeholders(en[k]))
    }
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s is translated', (locale) => {
    const d = settingsLanguageMessages[locale] as unknown as Record<string, string>
    expect(keys.filter((k) => d[k] === en[k])).toEqual([])
  })

  it('lookups', () => {
    expect(settingsLanguageT('ko', 'heading')).toBe('선호 언어')
    expect(settingsLanguageT('es', 'saved')).toBe('Idioma guardado')
  })
})
