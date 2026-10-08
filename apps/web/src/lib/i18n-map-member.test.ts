// i18n-map-member.test.ts
// The map panel's deep-link miss line: parity across the 14 locales and translated (not English copies).

import { describe, it, expect } from 'vitest'
import { mapMemberMessages, mapMemberT } from './i18n-map-member'
import { messages, type Locale } from './i18n'

const LOCALES = Object.keys(messages) as Locale[]

describe('mapMemberMessages', () => {
  it('covers exactly the 14 locales with the same keys, none empty', () => {
    expect(Object.keys(mapMemberMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
    for (const locale of LOCALES) {
      expect(Object.keys(mapMemberMessages[locale]), locale).toEqual(Object.keys(mapMemberMessages.en))
      expect(mapMemberT(locale, 'focusNotOnMap').trim(), locale).not.toBe('')
    }
  })
  it('English reads plainly; other locales are translated', () => {
    expect(mapMemberT('en', 'focusNotOnMap')).toBe("That place isn't on the map right now.")
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      expect(mapMemberT(locale, 'focusNotOnMap'), locale).not.toBe(mapMemberMessages.en.focusNotOnMap)
    }
  })
})
