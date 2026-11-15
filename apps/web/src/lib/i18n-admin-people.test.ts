// apps/web/src/lib/i18n-admin-people.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The People tab's words (lib/i18n-admin-people.ts) in the 14 FEED locales:
//   - the dictionary keeps the parity rules (src/test/dictionary-parity.ts);
//   - Label in Name: a row's tier select is named by its column header first, then the person;
//   - every admin_set_tier refusal code has its sentence, an unknown code is named as it is;
//   - a tier option names the tier by roleLabel, the one source of tier names.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import { formatMessage } from './format-message'
import { roleLabel } from './i18n-feed-card'
import { adminPeopleMessages, adminPeopleT, denialText, grantOptionLabel } from './i18n-admin-people'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('admin people', adminPeopleMessages, adminPeopleT)

describe('Label in Name', () => {
  it.each(LOCALES)('%s: the tier select is named "<Set tier column>…<name>"', (l) => {
    const name = formatMessage(adminPeopleT(l, 'setTierFor'), { name: 'Amina' })
    expect(name.startsWith(adminPeopleT(l, 'colSetTier'))).toBe(true)
    expect(name).toContain('Amina')
  })
})

describe('refusals', () => {
  const CODES = ['self', 'founder_only', 'insufficient_tier', 'no_change', 'target_invalid', 'auth']

  it.each(LOCALES)('%s: each admin_set_tier code has its own sentence', (l) => {
    const texts = CODES.map((c) => denialText(c, l))
    expect(new Set(texts).size).toBe(CODES.length)
    for (const t of texts) expect(t).not.toContain('{')
  })

  it('an unknown code is named as it is', () => {
    expect(denialText('weird_code', 'en')).toBe('Denied (weird_code).')
    expect(denialText('weird_code', 'ko')).toBe('거부됨(weird_code).')
  })
})

describe('tier options', () => {
  it.each(LOCALES)('%s: Make <tier> names the tier as roleLabel does; revoke has its own words', (l) => {
    expect(grantOptionLabel({ value: 'community_moderator', label: 'Make Moderator' }, l)).toContain(roleLabel('community_moderator', l))
    expect(grantOptionLabel({ value: null, label: 'Revoke tier' }, l)).toBe(adminPeopleT(l, 'revokeTier'))
  })

  it('English reads as before', () => {
    expect(grantOptionLabel({ value: 'resource_admin', label: '' }, 'en')).toBe('Make Resource Admin')
    expect(grantOptionLabel({ value: null, label: '' }, 'en')).toBe('Revoke tier')
  })
})
