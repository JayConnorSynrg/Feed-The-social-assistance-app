// apps/web/src/lib/i18n-feed-petitions.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The petition dictionary's own rules (parity is in i18n-feed-subtabs.test.ts):
//   - advocacy wording in all 14 locales: each sentence that names the signature uses that
//     locale's "verified signature of support", and no value speaks of law, binding or contracts;
//   - the two count tables carry every plural form their language needs;
//   - the category vocabulary and the failure codes each have one sentence per locale.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import {
  PETITION_CATEGORIES,
  PETITION_ERROR_CODES,
  SIGNATURES_OF_TARGET,
  VERIFIED_SIGNATURES,
  feedPetitionsMessages,
  petitionCategoryLabel,
  petitionErrorText,
  petitionsT,
  signatureCountMessage,
  type FeedPetitionsMessages,
} from './i18n-feed-petitions'
import { formatMessage } from './format-message'

const LOCALES = Object.keys(messages) as Locale[]

describe('advocacy wording', () => {
  // The locale's "verified signature of support" (with the forms its grammar gives it).
  const TERM: Record<Locale, RegExp> = {
    en: /verified signature of support/i,
    es: /firma verificada de apoyo/i,
    ht: /siyati verifye pou sipò/i,
    vi: /chữ ký ủng hộ đã xác minh/i,
    ar: /توقيع الدعم المؤكَّد/,
    zh: /经验证的支持签名/,
    so: /saxiixaaga taageerada ee la xaqiijiyay|saxiix taageero oo la xaqiijiyay/i,
    fr: /signature de soutien vérifiée/i,
    pt: /assinatura de apoio verificada/i,
    ru: /подтверждённ(ая|ую) подпись в поддержку/i,
    ko: /확인된 지지 서명/,
    tl: /beripikadong lagda ng suporta/i,
    am: /የተረጋገጠ የድጋፍ ፊርማ/,
    hmn: /kos npe txhawb nqa uas tau txheeb xyuas/i,
  }
  // Every key whose English names the signature.
  const NAMING_KEYS = (Object.keys(feedPetitionsMessages.en) as Array<keyof FeedPetitionsMessages>).filter((k) => TERM.en.test(feedPetitionsMessages.en[k]))

  // Regression guard for the copy rule in petitions-panel.tsx: a petition signature is advocacy.
  // Words of law, obligation and contract, per locale.
  const NOT_ADVOCACY: Record<Locale, RegExp> = {
    en: /legal|binding|contract/i,
    es: /legal|vinculante|contrato|jurídic/i,
    ht: /legal|kontra|obligatwa/i,
    vi: /pháp lý|pháp luật|ràng buộc|hợp đồng/i,
    ar: /قانون|ملزم|عقد/,
    zh: /法律|法定|约束力|合同/,
    so: /sharci|heshiis|qasab/i,
    fr: /légal|juridique|contraignant|contrat/i,
    pt: /legal|jurídic|vinculativ|vinculante|contrato/i,
    ru: /юридическ|законн|обязывающ|договор|контракт/i,
    ko: /법적|구속력|계약/,
    tl: /legal|kontrata|may bisa/i,
    am: /ሕጋዊ|ህጋዊ|ውል|አስገዳጅ/,
    hmn: /lij choj|cog lus/i,
  }

  it('covers the 14 locales and the seven sentences that name the signature', () => {
    expect(Object.keys(TERM).sort()).toEqual([...LOCALES].sort())
    expect(Object.keys(NOT_ADVOCACY).sort()).toEqual([...LOCALES].sort())
    expect(NAMING_KEYS.sort()).toEqual(['errAccountRequired', 'errAffirmationRequired', 'faqVerified', 'guestPrompt', 'retentionNotice', 'sign', 'signInPrompt'])
  })

  it.each(LOCALES)('%s: every sentence that names the signature says "verified signature of support"', (locale) => {
    for (const key of NAMING_KEYS) expect(feedPetitionsMessages[locale][key], `${locale}.${key}`).toMatch(TERM[locale])
  })

  it.each(LOCALES)('%s: no string speaks of law, binding or contracts', (locale) => {
    const all = [
      ...Object.values(feedPetitionsMessages[locale]),
      ...Object.values(SIGNATURES_OF_TARGET[locale]),
      ...Object.values(VERIFIED_SIGNATURES[locale]),
    ]
    for (const text of all) expect(text, `${locale}: ${text}`).not.toMatch(NOT_ADVOCACY[locale])
  })
})

describe('Arabic wording', () => {
  // Fix round, low 6: "موثَّق" can read as notarised. The signature is "confirmed" (مؤكَّد).
  it('says "confirmed" and never uses the root of "certified / notarised"', () => {
    const all = [...Object.values(feedPetitionsMessages.ar), ...Object.values(SIGNATURES_OF_TARGET.ar), ...Object.values(VERIFIED_SIGNATURES.ar)]
    for (const text of all) expect(text, text).not.toMatch(/موث[\u064B-\u0652]*ق|توثيق/)
    expect(feedPetitionsMessages.ar.sign).toBe('أضف توقيع الدعم المؤكَّد الخاص بك')
    expect(Object.values(VERIFIED_SIGNATURES.ar).every((t) => /مؤكَّد/.test(t))).toBe(true)
  })
})

describe('signature counts', () => {
  const TABLES = [
    ['SIGNATURES_OF_TARGET', SIGNATURES_OF_TARGET, ['{count}', '{target}']],
    ['VERIFIED_SIGNATURES', VERIFIED_SIGNATURES, ['{count}']],
  ] as const

  describe.each(TABLES)('%s', (_name, table, placeholders) => {
    it('covers exactly the 14 locales', () => {
      expect(Object.keys(table).sort()).toEqual([...LOCALES].sort())
    })

    it.each(LOCALES)('%s: every form is filled and keeps the placeholders; "other" is always there', (locale) => {
      const forms = table[locale]
      expect(forms.other).toBeTruthy()
      for (const [form, text] of Object.entries(forms)) {
        expect(['zero', 'one', 'two', 'few', 'many', 'other']).toContain(form)
        expect((text.match(/\{\w+\}/g) ?? []).sort(), `${locale}.${form}`).toEqual([...placeholders].sort())
      }
    })

    it('Arabic has its six forms and Russian its four; languages with a singular have "one"', () => {
      expect(Object.keys(table.ar).sort()).toEqual(['few', 'many', 'one', 'other', 'two', 'zero'])
      expect(Object.keys(table.ru).sort()).toEqual(['few', 'many', 'one', 'other'])
      for (const locale of ['en', 'es', 'fr', 'pt', 'am'] as const) {
        expect(table[locale].one, locale).toBeTruthy()
        expect(table[locale].one, locale).not.toBe(table[locale].other)
      }
    })

    it.each(LOCALES.filter((l) => l !== 'en'))('%s is translated', (locale) => {
      expect(table[locale].other).not.toBe(table.en.other)
    })
  })

  it('a target picks the form by the target; no target picks it by the count', () => {
    const line = (count: number, target: number, locale: Locale) => formatMessage(signatureCountMessage(count, target, locale), { count, target })
    expect(line(5, 100, 'en')).toBe('5 of 100 signatures')
    expect(line(0, 1, 'en')).toBe('0 of 1 signature')
    expect(line(1, 0, 'en')).toBe('1 verified signature')
    expect(line(7, 0, 'en')).toBe('7 verified signatures')
    expect(line(1, 2, 'ar')).toBe('1 من 2 توقيعين')
    expect(line(2, 3, 'ar')).toBe('2 من 3 توقيعات')
    expect(line(2, 0, 'ar')).toBe('2 توقيعان مؤكَّدان')
    expect(line(11, 0, 'ar')).toBe('11 توقيعًا مؤكَّدًا')
    expect(line(21, 0, 'ru')).toBe('21 подтверждённая подпись')
    expect(line(4, 22, 'ru')).toBe('4 из 22 подписей')
    expect(line(4, 21, 'ru')).toBe('4 из 21 подписи')
    expect(line(1, 0, 'hmn')).toBe('1 tus kos npe uas tau txheeb xyuas')
    expect(line(9, 0, 'ko')).toBe('확인된 서명 9개')
  })
})

describe('category vocabulary (petitions.cause_category)', () => {
  it('the eight stored categories each have a label in every locale', () => {
    expect(PETITION_CATEGORIES).toEqual(['land_rights', 'infrastructure', 'housing', 'food_access', 'healthcare', 'education', 'environment', 'civil_rights'])
    for (const locale of LOCALES) {
      const labels = PETITION_CATEGORIES.map((c) => petitionCategoryLabel(c, locale))
      expect(new Set(labels).size, locale).toBe(PETITION_CATEGORIES.length)
      for (const [i, label] of labels.entries()) expect(label, `${locale} ${PETITION_CATEGORIES[i]}`).not.toContain('_')
    }
    expect(petitionCategoryLabel('land_rights', 'en')).toBe('Land Rights')
    expect(petitionCategoryLabel('food_access', 'es')).toBe('Acceso a alimentos')
  })

  it('no category reads "Community"; an unknown stored value is shown as stored, opened up', () => {
    expect(petitionCategoryLabel(null, 'fr')).toBe('Communauté')
    expect(petitionCategoryLabel('river_cleanup', 'fr')).toBe('River Cleanup')
    expect(petitionCategoryLabel('constructor', 'en')).toBe('Constructor')
  })
})

describe('failure codes', () => {
  it.each(LOCALES)('%s: each code has its own sentence', (locale) => {
    const sentences = PETITION_ERROR_CODES.map((code) => petitionErrorText(code, locale))
    expect(new Set(sentences).size).toBe(PETITION_ERROR_CODES.length)
    if (locale !== 'en') for (const [i, s] of sentences.entries()) expect(s, PETITION_ERROR_CODES[i]).not.toBe(petitionErrorText(PETITION_ERROR_CODES[i], 'en'))
  })

  it('any other code reads as the plain signing failure', () => {
    for (const code of ['petition_not_found', 'petition_not_available', 'unexpected_error', 'boom', 'toString']) {
      expect(petitionErrorText(code, 'es')).toBe(petitionsT('es', 'errSignFailed'))
    }
  })

  it('every code the sign route sends with a message of its own has a sentence here', () => {
    const route = readFileSync(fileURLToPath(new URL('../app/api/petitions/sign/route.ts', import.meta.url)), 'utf8')
    const withMessage = [...route.matchAll(/error:\s*'([a-z_]+)',\s*message:/g)].map((m) => m[1])
    expect(withMessage.sort()).toEqual(['account_required', 'affirmation_required'])
    for (const code of withMessage) expect(PETITION_ERROR_CODES).toContain(code)
  })
})
