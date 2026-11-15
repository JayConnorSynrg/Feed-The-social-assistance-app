// apps/web/src/lib/i18n-admin-moderation.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Moderation tab's words (lib/i18n-admin-moderation.ts) in the 14 FEED locales:
//   - the dictionary keeps the parity rules (src/test/dictionary-parity.ts);
//   - each count table covers the 14 locales, has an `other` form, and every form carries {n};
//     a count reads in the locale's plural form and digits;
//   - one label per moderation action, shared by the reports queue and the linked post.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import {
  POSTS_WITH_REPORTS,
  REPORT_COUNT,
  THEME_POSTS,
  adminModerationMessages,
  adminModerationT,
  moderationActionDone,
  moderationActionLabel,
  moderationCount,
} from './i18n-admin-moderation'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('admin moderation', adminModerationMessages, adminModerationT, new Set(['Status: {status}.']))

describe.each([
  ['POSTS_WITH_REPORTS', POSTS_WITH_REPORTS],
  ['REPORT_COUNT', REPORT_COUNT],
  ['THEME_POSTS', THEME_POSTS],
] as const)('%s', (_name, table) => {
  it('covers exactly the 14 locales, each with an `other` form, every form carrying {n}', () => {
    expect(Object.keys(table).sort()).toEqual([...LOCALES].sort())
    for (const l of LOCALES) {
      expect(table[l].other, l).toBeTruthy()
      for (const form of Object.values(table[l])) expect(form, l).toContain('{n}')
    }
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s differs from English', (l) => {
    expect(table[l].other).not.toBe(table.en.other)
  })
})

describe('counts', () => {
  it('English: one and other', () => {
    expect(moderationCount(REPORT_COUNT, 1, 'en')).toBe('1 report')
    expect(moderationCount(REPORT_COUNT, 3, 'en')).toBe('3 reports')
    expect(moderationCount(POSTS_WITH_REPORTS, 1, 'en')).toBe('1 post with open reports')
  })

  it('Russian picks one / few / many; Arabic picks two; Korean has one form', () => {
    expect(moderationCount(REPORT_COUNT, 1, 'ru')).toBe('1 жалоба')
    expect(moderationCount(REPORT_COUNT, 3, 'ru')).toBe('3 жалобы')
    expect(moderationCount(REPORT_COUNT, 5, 'ru')).toBe('5 жалоб')
    expect(moderationCount(REPORT_COUNT, 2, 'ar')).toContain('بلاغان')
    expect(moderationCount(REPORT_COUNT, 2, 'ko')).toBe('신고 2건')
  })

  it('a large count is grouped in the locale', () => {
    expect(moderationCount(THEME_POSTS, 1200, 'en')).toBe('1,200 posts')
    expect(moderationCount(THEME_POSTS, 1200, 'fr')).toMatch(/^1\s200 publications$/)
  })
})

describe('moderation actions', () => {
  it.each(LOCALES)('%s: one label and one result line per action, all distinct', (l) => {
    const labels = (['remove', 'hold', 'authorize'] as const).map((a) => moderationActionLabel(a, l))
    const done = (['remove', 'hold', 'authorize'] as const).map((a) => moderationActionDone(a, l))
    expect(new Set(labels).size).toBe(3)
    expect(new Set(done).size).toBe(3)
    expect(labels[0]).toBe(adminModerationT(l, 'actionRemove'))
  })
})
