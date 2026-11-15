// apps/web/src/lib/i18n-admin-petitions.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The petition download copy: all 14 locales, every key non-empty, the {count} placeholder kept
// wherever English has it, and no English left in a translated value.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { adminPetitionsMessages, type AdminPetitionsMessages } from './i18n-admin-petitions'

const LOCALES = Object.keys(messages) as Locale[]
const KEYS = Object.keys(adminPetitionsMessages.en) as Array<keyof AdminPetitionsMessages>
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('admin petitions dictionary', () => {
  it('covers the 14 locales', () => {
    expect(Object.keys(adminPetitionsMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s: every key present, non-empty, same placeholders as English', (locale) => {
    const dict = adminPetitionsMessages[locale]
    expect(Object.keys(dict).sort()).toEqual([...KEYS].sort())
    for (const key of KEYS) {
      expect(dict[key].trim().length, key).toBeGreaterThan(0)
      expect(placeholders(dict[key]), key).toEqual(placeholders(adminPetitionsMessages.en[key]))
    }
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s: no value is left in English', (locale) => {
    for (const key of KEYS) {
      if (key === 'download' || key === 'downloading') continue // "CSV" is shared; the verb is checked below
      expect(adminPetitionsMessages[locale][key], key).not.toBe(adminPetitionsMessages.en[key])
    }
    expect(adminPetitionsMessages[locale].download).not.toBe('Download CSV')
  })
})
