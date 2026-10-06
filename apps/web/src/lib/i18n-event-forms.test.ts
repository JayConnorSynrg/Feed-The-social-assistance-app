// apps/web/src/lib/i18n-event-forms.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Parity guard for the event-forms dictionary (same style as i18n-org-forms.test.ts): every locale
// carries exactly the English key set, every value is non-empty, every translation keeps the
// English {placeholders}; plus the one event-type label map every surface shares.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  eventFormMessages,
  eventFormT,
  eventTypeColor,
  eventTypeLabel,
  formatMessage,
  EVENT_TYPES,
  type EventFormMessages,
} from './i18n-event-forms'
import { messages, translate, type Locale } from './i18n'

const LOCALES = Object.keys(messages) as Locale[]
const EN_KEYS = Object.keys(eventFormMessages.en).sort()
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('eventFormMessages parity', () => {
  it('covers exactly the 14 locales of lib/i18n.ts', () => {
    expect(Object.keys(eventFormMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s has exactly the English key set, all non-empty', (locale) => {
    const dict = eventFormMessages[locale] as unknown as Record<string, unknown>
    expect(Object.keys(dict).sort()).toEqual(EN_KEYS)
    for (const key of EN_KEYS) {
      expect(typeof dict[key], `${locale}.${key}`).toBe('string')
      expect((dict[key] as string).trim(), `${locale}.${key}`).not.toBe('')
    }
  })

  it.each(LOCALES)('%s keeps the English {placeholders}', (locale) => {
    for (const key of EN_KEYS as Array<keyof EventFormMessages>) {
      expect(placeholders(eventFormMessages[locale][key]), `${locale}.${key}`).toEqual(
        placeholders(eventFormMessages.en[key])
      )
    }
  })
})

describe('lookups', () => {
  it('returns the locale value and falls back to English for a missing one', () => {
    expect(eventFormT('es', 'createSubmit')).toBe('Crear evento')
    const dict = { ...eventFormMessages, fr: { ...eventFormMessages.fr, createSubmit: '' } }
    expect(translate(dict, 'fr', 'createSubmit')).toBe('Create event')
  })

  it('formatMessage fills placeholders', () => {
    expect(formatMessage(eventFormMessages.en.datesAdded, { count: 3 })).toBe('Dates added: 3.')
  })

  it('one event-type label + colour map for every surface; unknown values pass through', () => {
    expect(EVENT_TYPES.map((t) => eventTypeLabel(t, 'en'))).toEqual(['Distribution', 'Meal', 'Pantry', 'Clinic', 'Other'])
    expect(eventTypeLabel('meal', 'ko')).toBe('식사')
    expect(eventTypeLabel('bake_sale', 'en')).toBe('bake_sale')
    expect(eventTypeColor('bake_sale')).toBe(eventTypeColor('other'))
  })
})
