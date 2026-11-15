// apps/web/src/lib/i18n-documents.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W9 — Documents & Forms › My Documents / My Resources / vault / viewer words
// (lib/i18n-documents.ts) and the Applications words (lib/i18n-forms.ts) in the 14 FEED locales:
//   - both dictionaries keep the parity rules (test/dictionary-parity.ts);
//   - the hooks' English sentences are read as codes; text the server, storage or the crypto layer
//     wrote is never shown (a translated line instead);
//   - folder labels never change the stored folder value; sizes, counts, dates and ages are in the
//     locale's digits and words, with FEED's own words where Intl has none (ht, hmn) — fixed instants;
//   - every plural table covers the 14 locales with the English placeholders;
//   - Label in Name: the in-progress empty line quotes the Available Forms tab word for word, the
//     review note quotes Back.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import {
  DOCUMENTS_FILE_COUNT,
  documentCategoryLabel,
  documentDate,
  documentSize,
  documentsErrorText,
  documentsFileCount,
  documentsMessages,
  documentsT,
  uploadErrorText,
  vaultErrorText,
} from './i18n-documents'
import {
  FORMS_FILLED_FIELDS,
  FORMS_MORE_DOCUMENTS,
  estimatedTimeText,
  formsCategoryLabel,
  formsFilledFields,
  formsMessages,
  formsT,
  govCategoryLabel,
} from './i18n-forms'
import { friendlyErrorT } from './i18n-friendly-error'
import { formatCount } from './i18n-intl'
import { resourceCategoryLabel } from './i18n-resource-categories'
import { VaultTimeoutError } from './vault'

const LOCALES = Object.keys(messages) as Locale[]
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

// Units and words several languages write as English does are not missing translations.
describeDictionaryParity('documents', documentsMessages, documentsT, new Set(['{n} B', '{n} KB', '{n} MB', 'Document', 'Website', 'Notes', 'Date', 'Medical']))
describeDictionaryParity('forms', formsMessages, formsT, new Set(['Status:', 'Form {number}', 'ZIP code', 'Page {n}', 'Progression', 'No']))

describe('hook sentences read as codes', () => {
  it.each(LOCALES)('%s: time-outs, a wrong password and the two general sentences', (l) => {
    expect(documentsErrorText('Document timed out — please check your connection and retry.', l)).toBe(documentsT(l, 'docTimedOut'))
    expect(uploadErrorText('Upload timed out — please check your connection and retry.', l)).toBe(documentsT(l, 'uploadTimedOut'))
    expect(vaultErrorText('Incorrect password', 'unlock', l)).toBe(documentsT(l, 'incorrectPassword'))
    expect(vaultErrorText(new VaultTimeoutError().message, 'unlock', l)).toBe(documentsT(l, 'vaultTimedOut'))
    expect(documentsErrorText("We're having trouble connecting. Please check your connection and try again.", l)).toBe(friendlyErrorT(l, 'connection'))
  })

  it('a storage, database or crypto message is never shown: the general line instead', () => {
    expect(documentsErrorText('Download failed: Object not found (bucket user-documents/abc/def.enc)', 'ko')).toBe(documentsT('ko', 'docFailed'))
    expect(uploadErrorText('Database error: new row violates row-level security policy for table "user_documents"', 'ko')).toBe(documentsT('ko', 'uploadFailedBody'))
    expect(vaultErrorText('OperationError: The operation failed for an operation-specific reason', 'unlock', 'ar')).toBe(documentsT('ar', 'vaultFailed'))
    expect(vaultErrorText('Failed to setup vault: duplicate key value violates unique constraint "user_vault_pkey"', 'setup', 'ar')).toBe(documentsT('ar', 'setupFailed'))
  })
})

describe('folders, sizes, dates', () => {
  it.each(LOCALES)('%s: every stored folder value has its own label; an unknown value reads as Other', (l) => {
    const values = ['all', 'id', 'income', 'residence', 'medical', 'forms', 'other']
    const labels = values.map((v) => documentCategoryLabel(v, l))
    expect(new Set(labels).size).toBe(values.length)
    expect(documentCategoryLabel('passport-scan', l)).toBe(documentsT(l, 'catOther'))
  })

  it('sizes in the locale’s digits and decimal mark', () => {
    expect(documentSize(512, 'en')).toBe('512 B')
    expect(documentSize(1536, 'en')).toBe('1.5 KB')
    expect(documentSize(1536, 'fr')).toBe('1,5 Ko')
    expect(documentSize(3 * 1024 * 1024, 'ru')).toBe('3,0 МБ')
    expect(documentSize(1536, 'ar')).toMatch(/^١٫٥ ك\.ب$|^1\.5 ك\.ب$/)
  })

  const NOW = Date.UTC(2026, 10, 15, 18, 0, 0)
  const at = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000)
  it('Today, Yesterday, an age for a week, then the date — fixed instants, explicit zone', () => {
    expect(documentDate(at(0), 'ko', NOW, 'America/New_York')).toBe('오늘')
    expect(documentDate(at(1), 'ko', NOW, 'America/New_York')).toBe('어제')
    expect(documentDate(at(3), 'ko', NOW, 'America/New_York')).toBe('3일 전')
    expect(documentDate(at(10), 'ko', NOW, 'America/New_York')).toBe('2026년 11월 5일')
    expect(documentDate(at(10), 'en', NOW, 'America/New_York')).toBe('Nov 5, 2026')
  })

  it('Haitian Creole and Hmong (no Intl data) read FEED’s own words, never English', () => {
    for (const l of ['ht', 'hmn'] as const) {
      const age = documentDate(at(3), l, NOW, 'America/New_York')
      const date = documentDate(at(10), l, NOW, 'America/New_York')
      expect(age, l).not.toMatch(/days? ago/)
      expect(date, l).not.toMatch(/Nov/)
    }
    expect(documentDate(at(10), 'ht', NOW, 'America/New_York')).toMatch(/nov/)
  })

  it.each(LOCALES)('%s: the file count is in the locale (one and many)', (l) => {
    expect(documentsFileCount(1, l)).not.toBe('')
    expect(documentsFileCount(12, l)).toContain(formatCount(12, l))
  })
})

describe('forms helpers', () => {
  it('estimated time in the locale', () => {
    expect(estimatedTimeText(45, 'en')).toBe('Est. 45 min')
    expect(estimatedTimeText(90, 'ko')).toBe('약 1시간 30분')
    expect(estimatedTimeText(120, 'es')).toBe('Aprox. 2 h')
  })

  it.each(LOCALES)('%s: category chips come from their one source', (l) => {
    expect(formsCategoryLabel('benefits', l)).toBe(formsT(l, 'catBenefits'))
    expect(formsCategoryLabel('food', l)).toBe(resourceCategoryLabel('food', l))
    expect(govCategoryLabel('veteran', l)).toBe(formsT(l, 'catVeteran'))
    expect(govCategoryLabel('eitc_tax_filing', l)).toBe(resourceCategoryLabel('eitc_tax_filing', l))
  })

  it('Filled n of m fields follows the total’s plural form', () => {
    expect(formsFilledFields(1, 1, 'en')).toBe('Filled 1 of 1 field')
    expect(formsFilledFields(3, 8, 'en')).toBe('Filled 3 of 8 fields')
    expect(formsFilledFields(3, 8, 'ko')).toBe('입력란 8개 중 3개를 채웠습니다')
  })
})

describe('plural tables', () => {
  it.each([
    ['file count', DOCUMENTS_FILE_COUNT],
    ['more documents', FORMS_MORE_DOCUMENTS],
    ['filled fields', FORMS_FILLED_FIELDS],
  ] as const)('%s: the 14 locales, an `other` form, the English placeholders', (_name, table) => {
    expect(Object.keys(table).sort()).toEqual([...LOCALES].sort())
    const en = placeholders(table.en.other)
    for (const l of LOCALES) {
      expect(table[l].other, l).toBeTruthy()
      for (const form of Object.values(table[l])) {
        // A form may drop {n} where the language says the number with a word ("one file").
        for (const p of placeholders(form!)) expect(en, `${l}: ${form}`).toContain(p)
      }
    }
  })
})

describe('label in name', () => {
  it.each(LOCALES)('%s: sentences that name a control carry its placeholder', (l) => {
    expect(formsT(l, 'noInProgressBody')).toContain('{tab}')
    expect(formsT(l, 'reviewIntro')).toContain('{back}')
  })
})
