// apps/web/src/lib/i18n-get-help.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Get Help wizard's words (lib/i18n-get-help.ts) in the 14 FEED locales: the dictionary keeps the
// parity rules; the filter's count table covers every locale with {n} in each form and reads in the
// locale's plural form and digits; every option label source (this dictionary, the Assistant's
// words, state names, dollar ranges) reads in the member's language.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import { FILTER_MATCHES, filterMatches, getHelpMessages, getHelpT, wizardCategoryLabel, wizardLabelText } from './i18n-get-help'
import { assistantT } from './i18n-assistant'
import { resourceCategoryLabel } from './i18n-resource-categories'
import { usStateName } from './i18n-us-states'
import { formatUsd } from './i18n-intl'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('get help', getHelpMessages, getHelpT)

describe('the filter count', () => {
  it.each(LOCALES)('%s: an `other` form, and {n} in every form', (l) => {
    const forms = FILTER_MATCHES[l] as Record<string, string>
    expect(forms.other).toBeTruthy()
    for (const f of Object.values(forms)) expect(f).toContain('{n}')
  })

  it('reads in the plural form and digits of the locale', () => {
    expect(filterMatches(1, 'en')).toBe('1 match')
    expect(filterMatches(3, 'en')).toBe('3 matches')
    expect(filterMatches(3, 'ru')).toBe('3 совпадения')
    expect(filterMatches(5, 'ru')).toBe('5 совпадений')
    expect(filterMatches(2, 'ar')).toContain('نتيجتان')
    expect(filterMatches(2, 'ko')).toBe('일치 항목 2개')
  })
})

describe('option labels from their one source', () => {
  it.each(LOCALES)('%s: each kind of label', (l) => {
    expect(wizardLabelText({ kind: 'getHelp', key: 'oFoodPantries' }, l)).toBe(getHelpT(l, 'oFoodPantries'))
    expect(wizardLabelText({ kind: 'assistant', key: 'ecMedicaid', lang: 'en' }, l)).toBe('Medicaid')
    expect(wizardLabelText({ kind: 'state', name: 'California' }, l)).toBe(usStateName('CA', l))
    expect(wizardLabelText({ kind: 'usdRange', from: 17000, to: 25000 }, l)).toBe(
      assistantT(l, 'ecIncomeRange').replace('{from}', formatUsd(17000, l)).replace('{to}', formatUsd(25000, l)),
    )
    expect(wizardLabelText({ kind: 'usdUnder', amount: 17000 }, l)).toContain(formatUsd(17000, l))
  })

  it('a category is named by its resource category (the Jobs wizard is employment)', () => {
    expect(wizardCategoryLabel('food', 'ko')).toBe(resourceCategoryLabel('food', 'ko'))
    expect(wizardCategoryLabel('jobs', 'ko')).toBe(resourceCategoryLabel('employment', 'ko'))
    expect(wizardCategoryLabel('jobs', 'en')).toBe('Jobs')
  })
})
