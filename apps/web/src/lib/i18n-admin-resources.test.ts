// apps/web/src/lib/i18n-admin-resources.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Resources / Manage / Businesses words (lib/i18n-admin-resources.ts) in the 14 FEED locales:
//   - the dictionary keeps the parity rules (src/test/dictionary-parity.ts);
//   - each count table covers the 14 locales, has an `other` form carrying {n}, differs from English;
//     a count reads in the locale's plural form and digits;
//   - one label per stored value (content type, status, service mode), all distinct per locale;
//   - an accessible name built by namedControl starts with the visible words.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import { moderationCount } from './i18n-admin-moderation'
import {
  BULK_CONFIRM,
  BULK_DONE,
  REJECTED_BY_FILTER,
  SOURCE_COUNT,
  STAGED_CANDIDATES,
  adminResourcesMessages,
  adminResourcesT,
  contentTypeLabel,
  namedControl,
  resourceStatusLabel,
  serviceModeLabel,
} from './i18n-admin-resources'

const LOCALES = Object.keys(messages) as Locale[]

// Words a language writes as English does: the placeholder pair, and loanwords (Link, Form, Email…).
describeDictionaryParity('admin resources', adminResourcesMessages, adminResourcesT, new Set(['{staged} ({rejected})', 'Link', 'Form', 'Email', 'Website', 'Description', 'Status', 'Resource']))

describe.each([
  ['STAGED_CANDIDATES', STAGED_CANDIDATES],
  ['REJECTED_BY_FILTER', REJECTED_BY_FILTER],
  ['SOURCE_COUNT', SOURCE_COUNT],
  ['BULK_CONFIRM', BULK_CONFIRM],
  ['BULK_DONE', BULK_DONE],
] as const)('%s', (_name, table) => {
  it('covers exactly the 14 locales, each with an `other` form carrying {n}', () => {
    expect(Object.keys(table).sort()).toEqual([...LOCALES].sort())
    for (const l of LOCALES) expect(table[l].other, l).toContain('{n}')
  })

  // French writes "{n} sources" as English does.
  it.each(LOCALES.filter((l) => l !== 'en' && !(table === SOURCE_COUNT && l === 'fr')))('%s differs from English', (l) => {
    expect(table[l].other).not.toBe(table.en.other)
  })
})

describe('counts', () => {
  it('English one / other; Russian few / many; Korean one form; Arabic digits grouping as the locale writes them', () => {
    expect(moderationCount(SOURCE_COUNT, 1, 'en')).toBe('1 source')
    expect(moderationCount(SOURCE_COUNT, 3, 'en')).toBe('3 sources')
    expect(moderationCount(BULK_DONE, 3, 'ru')).toBe('Одобрено 3 элемента.')
    expect(moderationCount(BULK_DONE, 5, 'ru')).toBe('Одобрено 5 элементов.')
    expect(moderationCount(STAGED_CANDIDATES, 2, 'ko')).toBe('검토할 후보 2개를 추가했습니다')
    expect(moderationCount(SOURCE_COUNT, 2, 'ar')).toBe('مصدران')
    expect(moderationCount(BULK_CONFIRM, 1200, 'en')).toBe('Approve 1,200 high-confidence items?')
  })
})

describe('stored values keep their value; each has one label', () => {
  it.each(LOCALES)('%s: content types, statuses and service modes are distinct words', (l) => {
    const types = (['resource', 'link', 'form'] as const).map((v) => contentTypeLabel(v, l))
    const statuses = (['approved', 'pending', 'rejected', 'archived'] as const).map((v) => resourceStatusLabel(v, l))
    const modes = (['physical', 'online', 'hybrid'] as const).map((v) => serviceModeLabel(v, l))
    expect(new Set(types).size).toBe(3)
    expect(new Set(statuses).size).toBe(4)
    expect(new Set(modes).size).toBe(3)
  })
})

describe('namedControl', () => {
  it.each(LOCALES)('%s: starts with the visible word, then the isolated name', (l) => {
    const name = namedControl(adminResourcesT(l, 'approve'), 'مخزن الطعام')
    expect(name.startsWith(adminResourcesT(l, 'approve'))).toBe(true)
    expect(name).toContain('\u2068مخزن الطعام\u2069')
  })
})
