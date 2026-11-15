// apps/web/src/lib/i18n-org-admin.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization admin words (lib/i18n-org-admin.ts) in the 14 FEED locales: the parity rules
// (src/test/dictionary-parity.ts), the kiosk's count tables, and the roster's role names.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import { moderationCount } from './i18n-admin-moderation'
import { pluralMessage } from './i18n-intl'
import { CHECKIN_COUNT, PEOPLE_CONFIRMED, PEOPLE_WORD, orgAdminMessages, orgAdminT, orgRoleLabel } from './i18n-org-admin'

const LOCALES = Object.keys(messages) as Locale[]

// Words a language writes as English does (loanwords for "Profile", "User ID", "Admin", "Actions").
describeDictionaryParity('org admin', orgAdminMessages, orgAdminT, new Set(['Profile', 'User ID', 'Admin', 'Actions']))

describe.each([
  ['PEOPLE_CONFIRMED', PEOPLE_CONFIRMED],
  ['CHECKIN_COUNT', CHECKIN_COUNT],
] as const)('%s', (_name, table) => {
  it('covers exactly the 14 locales, each with an `other` form carrying {n}', () => {
    expect(Object.keys(table).sort()).toEqual([...LOCALES].sort())
    for (const l of LOCALES) expect(table[l].other, l).toContain('{n}')
  })
})

describe('PEOPLE_WORD (the word after the stepper’s number)', () => {
  it('covers the 14 locales; English and Russian change with the count', () => {
    expect(Object.keys(PEOPLE_WORD).sort()).toEqual([...LOCALES].sort())
    expect(pluralMessage(PEOPLE_WORD.en, 1, 'en')).toBe('person')
    expect(pluralMessage(PEOPLE_WORD.en, 3, 'en')).toBe('people')
    expect(pluralMessage(PEOPLE_WORD.ru, 3, 'ru')).toBe('человека')
  })
})

describe('counts', () => {
  it('reads in the locale’s plural form', () => {
    expect(moderationCount(PEOPLE_CONFIRMED, 1, 'en')).toBe('1 person confirmed')
    expect(moderationCount(PEOPLE_CONFIRMED, 12, 'en')).toBe('12 people confirmed')
    expect(moderationCount(CHECKIN_COUNT, 5, 'ru')).toBe('5 отметок')
    expect(moderationCount(PEOPLE_CONFIRMED, 3, 'ko')).toBe('3명 확인됨')
  })
})

describe('roster roles', () => {
  it.each(LOCALES)('%s: admin and member are two words; anything else reads as member', (l) => {
    expect(orgRoleLabel('admin', l)).not.toBe(orgRoleLabel('member', l))
    expect(orgRoleLabel('owner', l)).toBe(orgRoleLabel('member', l))
  })
})
