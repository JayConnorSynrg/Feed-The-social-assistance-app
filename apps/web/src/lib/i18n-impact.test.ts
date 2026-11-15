// apps/web/src/lib/i18n-impact.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Every reader sees the Impact overview card in their language: the 14 locales carry the same keys, none
// empty, one label per figure of community_impact_summary(), and every non-English sentence is translated.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { impactMessages, type ImpactMessages } from './i18n-impact'
import { IMPACT_FIGURE_IDS } from './community-impact'

const LOCALES = Object.keys(messages) as Locale[]
const EN_KEYS = Object.keys(impactMessages.en).sort()

describe('impactMessages parity', () => {
  it('covers exactly the 14 locales', () => {
    expect(LOCALES).toHaveLength(14)
    expect(Object.keys(impactMessages).sort()).toEqual([...LOCALES].sort())
  })

  it('has one label per figure the server returns', () => {
    for (const id of IMPACT_FIGURE_IDS) expect(EN_KEYS).toContain(`label_${id}`)
  })

  it.each(LOCALES)('%s: same keys, none empty', (locale) => {
    const dict = impactMessages[locale] as unknown as Record<string, string>
    expect(Object.keys(dict).sort()).toEqual(EN_KEYS)
    for (const key of EN_KEYS) expect(dict[key].trim(), `${locale}.${key}`).not.toBe('')
  })

  it('every non-English locale is translated (not an English copy)', () => {
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      for (const key of EN_KEYS as Array<keyof ImpactMessages>) {
        expect(impactMessages[locale][key], `${locale}.${key}`).not.toBe(impactMessages.en[key])
      }
    }
  })
})
