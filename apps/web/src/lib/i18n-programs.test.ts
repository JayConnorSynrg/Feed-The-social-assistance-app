// apps/web/src/lib/i18n-programs.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Browse Programs' words (lib/i18n-programs.ts) and the US state names (lib/i18n-us-states.ts) in the
// 14 FEED locales: both dictionaries keep the parity rules; the hooks' English sentences are read as
// codes and text FEED did not write is never shown; every state picker option keeps its 2-letter code.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import { programsErrorText, programsMessages, programsT, savedErrorText, searchErrorText } from './i18n-programs'
import { US_STATE_CODES, usStateMessages, usStateName, usStateOptions } from './i18n-us-states'
import { friendlyErrorT } from './i18n-friendly-error'
import { STATE_TO_ABBR, US_STATES } from './us-states'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('programs', programsMessages, programsT)
// State names many languages write as English does are not missing translations.
describeDictionaryParity('US states', usStateMessages, (l, k) => usStateName(k, l), new Set(Object.values(usStateMessages.en)))

describe('hook sentences read as codes', () => {
  it.each(LOCALES)('%s: the programs hook lines', (l) => {
    expect(programsErrorText('Programs timed out. Please try again.', l)).toBe(programsT(l, 'programsTimeout'))
    expect(programsErrorText('Failed to load programs. Please try again.', l)).toBe(programsT(l, 'programsLoadFailed'))
    expect(programsErrorText("We're having trouble connecting. Please check your connection and try again.", l)).toBe(friendlyErrorT(l, 'connection'))
  })

  it('a database message is never shown: the general line instead', () => {
    expect(programsErrorText('relation "resources" does not exist', 'ko')).toBe(programsT('ko', 'programsLoadFailed'))
    expect(savedErrorText('new row violates row-level security policy for table "saved_resources"', 'ko')).toBe(programsT('ko', 'savedFailed'))
    expect(searchErrorText(new Error('function search_resources(text) does not exist'), 'ko')).toBe(programsT('ko', 'searchFailed'))
  })

  it('saved and search lines', () => {
    expect(savedErrorText('Saved resources timed out. Please try again.', 'ar')).toBe(programsT('ar', 'savedTimeout'))
    expect(savedErrorText('Must be authenticated to remove resources', 'ar')).toBe(programsT('ar', 'signInToSave'))
    expect(searchErrorText(new Error('Search timed out. Please try again.'), 'ar')).toBe(programsT('ar', 'searchTimeout'))
  })
})

describe('US state picker', () => {
  it('covers exactly the 56 codes of lib/us-states.ts, in its order', () => {
    expect([...US_STATE_CODES].sort()).toEqual(Object.values(STATE_TO_ABBR).sort())
    expect(usStateOptions('en').map((o) => o.code)).toEqual(US_STATES.map((n) => STATE_TO_ABBR[n]))
    expect(usStateOptions('en').map((o) => o.name)).toEqual(US_STATES)
  })

  it.each(LOCALES)('%s: every option value is its code; only the name is translated', (l) => {
    for (const o of usStateOptions(l)) {
      expect(o.code).toMatch(/^[A-Z]{2}$/)
      expect(o.name).toBe(usStateName(o.code, l))
    }
  })

  it('names read in the locale; an unknown code is returned as given', () => {
    expect(usStateName('CA', 'ko')).toBe('캘리포니아')
    expect(usStateName('NC', 'es')).toBe('Carolina del Norte')
    expect(usStateName('ZZ', 'ko')).toBe('ZZ')
  })
})

describe('label in name', () => {
  it.each(LOCALES)('%s: the empty Saved list quotes the Save button word for word', (l) => {
    expect(programsT(l, 'savedEmptyBody')).toContain('{action}')
  })
})
