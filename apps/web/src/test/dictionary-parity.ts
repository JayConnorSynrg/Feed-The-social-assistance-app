// apps/web/src/test/dictionary-parity.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Test-only: the parity rules every Record<Locale, M> dictionary keeps, as one describe block a
// sibling test registers (the same rules as lib/i18n-feed-subtabs.test.ts):
//   - exactly the 14 locales of lib/i18n.ts;
//   - the English key set in every locale, no empty value, the English {placeholders};
//   - translated: at most 5% of a locale's values equal English, besides `sameAsEnOk` (words a
//     language writes the same: US program names, a brand, a range of placeholders);
//   - the reader falls back to English for a missing or empty value and writes one
//     i18n.translation_fallback row naming the key and the locale.
// The calling test file mocks the logger: vi.mock('./logger', …) (or '@/lib/logger').

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger } from '@/lib/logger'
import { messages, type Locale } from '@/lib/i18n'

const LOCALES = Object.keys(messages) as Locale[]
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

export function describeDictionaryParity<M extends object>(
  name: string,
  dict: Record<Locale, M>,
  reader: (locale: Locale, key: keyof M & string) => string,
  sameAsEnOk: ReadonlySet<string> = new Set(),
) {
  describe(`${name} dictionary parity`, () => {
    const en = dict.en as unknown as Record<string, string>
    const keys = Object.keys(en).sort()

    it('covers exactly the 14 locales of lib/i18n.ts', () => {
      expect(Object.keys(dict).sort()).toEqual([...LOCALES].sort())
      expect(LOCALES).toHaveLength(14)
    })

    it.each(LOCALES)('%s: the English key set, every value non-empty, the English {placeholders}', (locale) => {
      const d = dict[locale] as unknown as Record<string, string>
      expect(Object.keys(d).sort()).toEqual(keys)
      for (const k of keys) {
        expect(typeof d[k], `${locale}.${k}`).toBe('string')
        expect(d[k].trim(), `${locale}.${k}`).not.toBe('')
        expect(placeholders(d[k]), `${locale}.${k}`).toEqual(placeholders(en[k]))
      }
    })

    it.each(LOCALES.filter((l) => l !== 'en'))('%s is translated (at most 5% of values equal English)', (locale) => {
      const d = dict[locale] as unknown as Record<string, string>
      const copies = keys.filter((k) => d[k] === en[k] && !sameAsEnOk.has(en[k]))
      expect(copies.length, `${locale}: ${copies.join(', ')}`).toBeLessThanOrEqual(Math.floor(keys.length * 0.05))
    })

    describe('a missing value', () => {
      const key = keys[0]
      const fr = dict.fr as unknown as Record<string, string | undefined>
      const saved = fr[key]
      beforeEach(() => {
        vi.mocked(logger.warn).mockClear()
        fr[key] = saved
      })

      it.each([
        ['empty', ''],
        ['absent', undefined],
      ])('%s: the reader shows English and writes one i18n.translation_fallback row', (_case, value) => {
        fr[key] = value
        try {
          expect(reader('fr', key as keyof M & string)).toBe(en[key])
          expect(logger.warn).toHaveBeenCalledTimes(1)
          expect(logger.warn).toHaveBeenCalledWith('i18n.translation_fallback', { key, locale: 'fr' })
        } finally {
          fr[key] = saved
        }
      })
    })
  })
}
