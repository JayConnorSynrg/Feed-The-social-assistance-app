// apps/web/src/lib/i18n-feed-subtabs.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Community sub-tab dictionaries (one per sub-tab). For each:
//   - parity: exactly the 14 locales, the English key set, no empty value, the English
//     {placeholders}, and translated (a locale is not a copy of English);
//   - its reader falls back to English for a missing or empty value and writes one
//     i18n.translation_fallback row naming the key and the locale.
// What a member reads on screen is asserted in components/panels/*.i18n.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { logger } from './logger'
import { messages, type Locale } from './i18n'
import { feedOrganizationsMessages, orgsT } from './i18n-feed-organizations'
import { feedPetitionsMessages, petitionsT } from './i18n-feed-petitions'
import { feedMessagesMessages, messagesT } from './i18n-feed-messages'
import { businessesT, feedBusinessesMessages } from './i18n-feed-businesses'

const LOCALES = Object.keys(messages) as Locale[]
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

type Reader = (locale: Locale, key: never) => string
const DICTS: Array<[name: string, dict: Record<Locale, object>, reader: Reader]> = [
  ['organizations', feedOrganizationsMessages, orgsT as Reader],
  ['petitions', feedPetitionsMessages, petitionsT as Reader],
  ['messages', feedMessagesMessages, messagesT as Reader],
  ['businesses', feedBusinessesMessages, businessesT as Reader],
]

// The same word in a language (a brand, a loanword, a format) may equal English.
const SAME_AS_EN_OK = new Set<string>(['{action}: {title}', 'Messages', '{state} — {day}', 'Logo', 'Email', 'Website', 'Legal', 'ZIP code'])

describe.each(DICTS)('%s dictionary', (_name, dict, reader) => {
  const en = dict.en as Record<string, string>
  const keys = Object.keys(en).sort()

  it('covers exactly the 14 locales of lib/i18n.ts', () => {
    expect(Object.keys(dict).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s: the English key set, every value non-empty, the English {placeholders}', (locale) => {
    const d = dict[locale] as Record<string, string>
    expect(Object.keys(d).sort()).toEqual(keys)
    for (const k of keys) {
      expect(typeof d[k], `${locale}.${k}`).toBe('string')
      expect(d[k].trim(), `${locale}.${k}`).not.toBe('')
      expect(placeholders(d[k]), `${locale}.${k}`).toEqual(placeholders(en[k]))
    }
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s is translated (at most a few values equal English)', (locale) => {
    const d = dict[locale] as Record<string, string>
    const copies = keys.filter((k) => d[k] === en[k] && !SAME_AS_EN_OK.has(en[k]))
    expect(copies.length, `${locale}: ${copies.join(', ')}`).toBeLessThanOrEqual(Math.floor(keys.length * 0.05))
  })

  describe('a missing value', () => {
    const key = keys[0]
    const fr = dict.fr as Record<string, string | undefined>
    const saved = fr[key]
    beforeEach(() => {
      vi.mocked(logger.warn).mockClear()
      fr[key] = saved
    })

    it.each([
      ['empty', ''],
      ['absent', undefined],
    ])('%s: the reader shows English and writes one i18n.translation_fallback row with key and locale', (_case, value) => {
      fr[key] = value
      try {
        expect(reader('fr', key as never)).toBe(en[key])
        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith('i18n.translation_fallback', { key, locale: 'fr' })
      } finally {
        fr[key] = saved
      }
    })

    it('a present value writes no row', () => {
      expect(reader('fr', key as never)).toBe(saved)
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })
})
