// apps/web/src/lib/i18n-org-forms.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Parity guard for the org-forms dictionary: every locale carries exactly the English key set, every
// value is non-empty, and every translation keeps the English {placeholders}. Also covers the shared
// translate() fallback, resolveUserLocale(), and RTL direction.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { orgFormMessages, orgFormT, formatMessage, type OrgFormMessages } from './i18n-org-forms'
import { dir, translate, resolveUserLocale, RTL_LOCALES, messages, type Locale } from './i18n'
import { GUEST_LANGUAGE_KEY } from './languages'

const LOCALES = Object.keys(messages) as Locale[]
const EN_KEYS = Object.keys(orgFormMessages.en).sort()
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('orgFormMessages parity', () => {
  it('covers exactly the 14 locales of lib/i18n.ts', () => {
    expect(Object.keys(orgFormMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s has exactly the English key set, all non-empty', (locale) => {
    const dict = orgFormMessages[locale] as unknown as Record<string, unknown>
    expect(Object.keys(dict).sort()).toEqual(EN_KEYS)
    for (const key of EN_KEYS) {
      expect(typeof dict[key], `${locale}.${key}`).toBe('string')
      expect((dict[key] as string).trim(), `${locale}.${key}`).not.toBe('')
    }
  })

  it.each(LOCALES)('%s keeps the English {placeholders}', (locale) => {
    for (const key of EN_KEYS as Array<keyof OrgFormMessages>) {
      expect(placeholders(orgFormMessages[locale][key]), `${locale}.${key}`).toEqual(
        placeholders(orgFormMessages.en[key])
      )
    }
  })
})

describe('direction', () => {
  it('RTL locales report rtl; all others ltr', () => {
    expect(dir('ar')).toBe('rtl')
    for (const locale of LOCALES) {
      expect(dir(locale)).toBe(RTL_LOCALES.has(locale) ? 'rtl' : 'ltr')
    }
  })
})

describe('translate()', () => {
  it('returns the locale value', () => {
    expect(orgFormT('es', 'dirLoadMore')).toBe('Cargar más')
  })

  it('falls back to English when a locale value is missing', () => {
    const dict = {
      ...orgFormMessages,
      fr: { ...orgFormMessages.fr, dirLoadMore: '' },
    }
    expect(translate(dict, 'fr', 'dirLoadMore')).toBe('Load more')
  })

  it('formatMessage fills placeholders', () => {
    expect(formatMessage(orgFormMessages.en.dirShowing, { shown: 50, total: 141 })).toBe('Showing 50 of 141')
  })
})

describe('resolveUserLocale()', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
      },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
      configurable: true,
    })
  })

  it('prefers a supported profile language', () => {
    localStorage.setItem(GUEST_LANGUAGE_KEY, 'fr')
    expect(resolveUserLocale('so')).toBe('so')
  })

  it('falls back to resolveLocale() for an unsupported or missing profile language', () => {
    localStorage.setItem(GUEST_LANGUAGE_KEY, 'fr')
    expect(resolveUserLocale('other')).toBe('fr')
    expect(resolveUserLocale(null)).toBe('fr')
  })
})
