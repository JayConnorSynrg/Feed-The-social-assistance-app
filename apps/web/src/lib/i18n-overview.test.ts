// apps/web/src/lib/i18n-overview.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Parity for the Home (Overview) panel's dictionary (src/test/dictionary-parity.ts), and the two
// sentences that carry the member's own words keep exactly one slot for them.
// What a member reads on screen: components/panels/overview-panel.i18n.test.ts.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { overviewMessages, overviewT } from './i18n-overview'
import { describeDictionaryParity } from '@/test/dictionary-parity'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('overview', overviewMessages, overviewT)

describe('member-text slots', () => {
  it.each(LOCALES)('%s: welcome has one {name}, activity lines one {excerpt}', (locale) => {
    expect(overviewT(locale, 'welcomeBack').match(/\{name\}/g)).toHaveLength(1)
    expect(overviewT(locale, 'activityPosted').match(/\{excerpt\}/g)).toHaveLength(1)
    expect(overviewT(locale, 'activityLiked').match(/\{excerpt\}/g)).toHaveLength(1)
  })

  it('lookups', () => {
    expect(overviewT('ko', 'quickActions')).toBe('빠른 작업')
    expect(overviewT('fr', 'recentActivity')).toBe('Activité récente')
  })
})
