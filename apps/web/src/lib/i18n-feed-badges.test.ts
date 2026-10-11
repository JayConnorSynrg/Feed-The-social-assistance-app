// apps/web/src/lib/i18n-feed-badges.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The badges dictionary beyond key parity (i18n-feed-subtabs.test.ts):
//   - its four plural tables: 14 locales, placeholders kept, the forms each language needs;
//   - vocabulary at its single source: a badge (the ten category families read from the
//     composer's category chips; the six community badges from here), an appreciation item, the
//     reviewed member's role — each with one label function, checked against the stored values;
//   - accessible names start with the visible word in 14 locales (label in name);
//   - every failure sentence of lib/appreciation.ts and of submitReview is known, both directions;
//   - a score keeps two decimals in the locale's digits.
// What a member reads: components/appreciation/appreciation.i18n.test.ts and
// components/feed/review-modal.i18n.test.ts.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { messages, type Locale } from './i18n'
import {
  APPRECIATION_ERROR_SENTENCES,
  APPRECIATION_ITEM_SLUGS,
  BADGE_CATEGORY_POINTS,
  BADGE_COMMUNITY_POINTS,
  COMMUNITY_BADGES,
  GIFTS_FROM_MORE,
  REVIEW_ERROR_SENTENCES,
  REVIEW_RATING_REQUIRED,
  REVIEW_ROLES,
  REVIEW_SUBMIT_FAILED,
  STALKS,
  appreciationErrorText,
  appreciationItemAlt,
  appreciationItemLabel,
  appreciationItemName,
  badgeAriaText,
  badgeLabel,
  badgeTitleText,
  badgesT,
  feedBadgesMessages,
  giftsFromMessage,
  ratingText,
  reviewDescription,
  reviewErrorText,
  stalksText,
} from './i18n-feed-badges'
import { FRIENDLY_ERROR_SENTENCES } from './i18n-friendly-error'
import { requestCategoryLabel, REQUEST_CATEGORIES } from './i18n-feed-composer'
import { COMMUNITY_META, FAMILY_META, summaryToBadgeList } from './engagement-badges'
import { APPRECIATION_ITEMS } from './appreciation'
import { formatFixed } from './i18n-intl'
import { formatMessage, splitPlaceholders } from './format-message'

const LOCALES = Object.keys(messages) as Locale[]
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A sentence: a quoted literal that starts with a capital, has a space, and ends a sentence. */
const sentences = (source: string) => [...new Set([...source.matchAll(/'([A-Z][^'\n]* [^'\n]*\.)'|"([A-Z][^"\n]* [^"\n]*\.)"/g)].map((m) => m[1] ?? m[2]))]
const ar = (n: number) => new Intl.NumberFormat(['ar', 'en-US']).format(n)

describe('counts', () => {
  const TABLES = [
    ['STALKS', STALKS, ['{n}']],
    ['BADGE_CATEGORY_POINTS', BADGE_CATEGORY_POINTS, ['{label}', '{level}', '{count}']],
    ['BADGE_COMMUNITY_POINTS', BADGE_COMMUNITY_POINTS, ['{label}', '{level}', '{count}']],
    ['GIFTS_FROM_MORE', GIFTS_FROM_MORE, ['{a}', '{b}', '{n}']],
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

  it('a rating button and a rating: English as before, each language its own form', () => {
    expect([1, 2, 5].map((n) => stalksText(n, 'en'))).toEqual(['1 stalk', '2 stalks', '5 stalks'])
    expect(ratingText(4, 5, 'en')).toBe('4 out of 5 stalks')
    expect(stalksText(1, 'es')).toBe('1 espiga')
    expect(stalksText(3, 'es')).toBe('3 espigas')
    expect([1, 2, 5].map((n) => stalksText(n, 'ru'))).toEqual(['1 колосок', '2 колоска', '5 колосков'])
    expect(stalksText(2, 'ar')).toBe(`${ar(2)} سنبلتان`)
    expect(stalksText(3, 'ar')).toBe(`${ar(3)} سنابل`)
    expect(ratingText(4, 5, 'ko')).toBe('이삭 5개 중 4개')
    expect(ratingText(4, 5, 'hmn')).toBe('4 ntawm 5 tus nplej')
  })

  it('who sent a gift: the sentence for 0, 1, 2, 3 givers, and two names plus the others from 4 on', () => {
    expect([0, 1, 2, 3, 4, 7].map((n) => giftsFromMessage(n, 'en'))).toEqual(['from the community', 'from {a}', 'from {a} & {b}', 'from {a}, {b} & {c}', 'from {a}, {b} & 2 others', 'from {a}, {b} & 5 others'])
    expect(giftsFromMessage(3, 'es')).toBe('de {a}, {b} y {c}')
    expect(giftsFromMessage(4, 'fr')).toBe('de la part de {a}, {b} et 2 autres personnes')
    expect(giftsFromMessage(23, 'ru')).toBe('от: {a}, {b} и ещё 21 человек')
    expect(giftsFromMessage(5, 'ru')).toBe('от: {a}, {b} и ещё 3 человека')
    expect(giftsFromMessage(4, 'ar')).toBe(`من {a} و{b} و${ar(2)} آخرَين`)
    expect(giftsFromMessage(6, 'ht')).toBe('nan men {a}, {b} ak 4 lòt moun')
    for (const locale of LOCALES) for (const n of [0, 1, 2, 3, 4, 12]) expect(giftsFromMessage(n, locale), `${locale} ${n}`).not.toMatch(/\{n\}/)
  })
})

describe('badge vocabulary (profiles.badge_summary)', () => {
  const families = Object.entries(FAMILY_META).map(([key, meta]) => ({ group: 'family' as const, key, label: meta.label }))
  const community = Object.entries(COMMUNITY_META).map(([key, meta]) => ({ group: 'community' as const, key, label: meta.label }))

  it('the ten families are the composer\'s ten category chips: one translation', () => {
    expect(families.map((f) => f.label).sort()).toEqual([...REQUEST_CATEGORIES].sort())
    for (const locale of LOCALES) for (const f of families) expect(badgeLabel(f, locale), `${locale} ${f.key}`).toBe(requestCategoryLabel(f.label, locale))
  })

  it('the six community badges are the stored keys, each with its own name in every locale', () => {
    expect(COMMUNITY_BADGES.sort()).toEqual(Object.keys(COMMUNITY_META).sort())
    for (const locale of LOCALES) {
      const names = community.map((c) => badgeLabel(c, locale))
      expect(new Set(names).size, locale).toBe(6)
      if (locale !== 'en') for (const [i, c] of community.entries()) expect(names[i], `${locale} ${c.key}`).not.toBe(c.label)
    }
  })

  it('English names are the stored labels; a badge neither source knows keeps its label', () => {
    for (const b of [...families, ...community]) expect(badgeLabel(b, 'en')).toBe(b.label)
    expect(badgeLabel({ group: 'community', key: 'mentor', label: 'Mentor' }, 'es')).toBe('Mentor')
    expect(badgeLabel({ group: 'community', key: 'toString', label: 'X' }, 'es')).toBe('X')
  })

  it('tooltip and screen-reader text: English as before; the owner\'s points take the plural form', () => {
    const food = summaryToBadgeList({ families: { food: { level: 2 } } })[0]
    const helper = summaryToBadgeList({ badges: { helper: { level: 3 } } })[0]
    expect(badgeTitleText(food, 'en')).toBe('Food · level 2')
    expect(badgeAriaText(food, 'en')).toBe('Food category badge, level 2')
    expect(badgeAriaText(helper, 'en')).toBe('Helper community badge, level 3')
    expect(badgeAriaText({ ...food, count: 12 }, 'en')).toBe('Food category badge, level 2, 12 points earned')
    expect(badgeAriaText({ ...helper, count: 1 }, 'en')).toBe('Helper community badge, level 3, 1 point earned')
    expect(badgeAriaText({ ...helper, count: 0 }, 'en')).toBe('Helper community badge, level 3, 0 points earned')
    expect(badgeAriaText(food, 'es')).toBe(`Insignia de categoría ${requestCategoryLabel('Food', 'es')}, nivel 2`)
    expect(badgeAriaText({ ...helper, count: 1 }, 'fr')).toBe('Badge communautaire Entraide, niveau 3, 1 point gagné')
    expect(badgeAriaText({ ...helper, count: 3 }, 'ru')).toBe('Значок сообщества «Помощник», уровень 3, получено 3 балла')
    expect(badgeAriaText({ ...helper, count: 21 }, 'ru')).toBe('Значок сообщества «Помощник», уровень 3, получен 21 балл')
  })

  it.each(LOCALES)('%s: a badge sentence has no placeholder left, with or without points', (locale) => {
    for (const b of [...families, ...community]) {
      for (const text of [badgeTitleText({ ...b, level: 2 }, locale), badgeAriaText({ ...b, level: 2 }, locale), badgeAriaText({ ...b, level: 2, count: 5 }, locale)]) {
        expect(text).not.toMatch(/\{\w+\}/)
        expect(text).toContain(badgeLabel(b, locale))
      }
    }
  })
})

describe('appreciation items (lib/appreciation.ts slugs)', () => {
  it('the twelve stored slugs, in the library\'s order; English is the library\'s own label and alt', () => {
    expect(APPRECIATION_ITEM_SLUGS).toEqual(APPRECIATION_ITEMS.map((i) => i.slug))
    for (const item of APPRECIATION_ITEMS) {
      expect(appreciationItemLabel(item.slug, 'en')).toBe(item.label)
      expect(appreciationItemAlt(item.slug, 'en')).toBe(item.alt)
    }
  })

  it.each(LOCALES)('%s: twelve different words; an unknown slug is shown as stored', (locale) => {
    const labels = APPRECIATION_ITEM_SLUGS.map((s) => appreciationItemLabel(s, locale))
    expect(new Set(labels).size).toBe(12)
    if (locale !== 'en') for (const [i, item] of APPRECIATION_ITEMS.entries()) expect(labels[i], item.slug).not.toBe(item.label)
    for (const slug of APPRECIATION_ITEM_SLUGS) expect(appreciationItemAlt(slug, locale).trim()).not.toBe('')
    expect(appreciationItemLabel('diamond', locale)).toBe('diamond')
    expect(appreciationItemAlt('toString', locale)).toBe('toString')
  })

  it.each(LOCALES)('%s: a picker button\'s name starts with the word under its icon (label in name), sent or not', (locale) => {
    for (const slug of APPRECIATION_ITEM_SLUGS) {
      const visible = appreciationItemLabel(slug, locale)
      const send = appreciationItemName(slug, false, locale)
      const sent = appreciationItemName(slug, true, locale)
      expect(send.startsWith(visible), send).toBe(true)
      expect(sent.startsWith(visible), sent).toBe(true)
      expect(send).not.toBe(sent)
      expect(send.length).toBeGreaterThan(visible.length)
    }
  })

  it('English names', () => {
    expect(appreciationItemName('heart', false, 'en')).toBe('Heart — send')
    expect(appreciationItemName('heart', true, 'en')).toBe('Heart — already sent')
  })
})

describe('the reviewed member\'s role', () => {
  it('four roles, as the two callers pass them', () => {
    expect(REVIEW_ROLES).toEqual(['sourcer', 'seeker', 'requester', 'volunteer'])
    const feed = read('../components/panels/feed-panel.tsx')
    expect([...feed.matchAll(/setReviewModalRevieweeRole\('(\w+)'\)/g)].map((m) => m[1]).sort()).toEqual(['seeker', 'sourcer'])
    expect(read('../components/panels/messages-panel.tsx')).toContain("revieweeRole={isVolunteer ? 'requester' : 'volunteer'}")
  })

  it.each(LOCALES)('%s: a sentence per role, and a neutral one for any other value', (locale) => {
    const texts = [...REVIEW_ROLES, 'someone-else'].map((r) => reviewDescription(r, locale))
    expect(new Set(texts).size).toBe(5)
    expect(reviewDescription('', locale)).toBe(badgesT(locale, 'reviewDescPerson'))
    expect(reviewDescription('toString', locale)).toBe(badgesT(locale, 'reviewDescPerson'))
  })

  it('English reads as before for the two feed roles', () => {
    expect(reviewDescription('sourcer', 'en')).toBe('Share your experience with this sourcer. Your rating contributes to their Harmony Score.')
    expect(reviewDescription('seeker', 'en')).toBe('Share your experience with this seeker. Your rating contributes to their Harmony Score.')
  })
})

describe('failures', () => {
  it('lib/appreciation.ts: every sentence it can report has a key, and no key is stale', () => {
    const lib = code(read('./appreciation.ts'))
    // Its item list also holds sentences-shaped alt texts; failures are what the two wrappers return.
    const found = sentences(lib.slice(lib.indexOf('export type GiveResult')))
    expect(found.sort()).toEqual(Object.keys(APPRECIATION_ERROR_SENTENCES).sort())
    expect(found).toHaveLength(7)
  })

  it('hooks/use-reviews.ts: the sentences submitReview can report are known; the lookup sentences reach no member', () => {
    const hook = code(read('../hooks/use-reviews.ts'))
    const submit = hook.slice(hook.indexOf('const submitReview = useCallback'), hook.indexOf('const fetchMyReviewsForOptIns = useCallback'))
    expect(sentences(submit).sort()).toEqual(["Couldn't submit review. Please try again.", 'Review submission timed out — please check your connection and retry.'])
    for (const s of sentences(submit)) expect(Object.keys(REVIEW_ERROR_SENTENCES)).toContain(s)
    // The dialog reads `error` from its own hook instance and calls submitReview only.
    const modal = read('../components/feed/review-modal.tsx')
    expect(modal).toContain('const { submitReview, loading, error } = useReviews()')
    expect(modal).not.toMatch(/fetchMyReview/)
  })

  it.each(LOCALES)('%s: each known failure has its own text; none is left in English', (locale) => {
    const appreciation = Object.keys(APPRECIATION_ERROR_SENTENCES).map((s) => appreciationErrorText(s, locale))
    const review = Object.keys(REVIEW_ERROR_SENTENCES).map((s) => reviewErrorText(s, locale))
    for (const got of [...appreciation, ...review]) expect(got.translated).toBe(true)
    expect(new Set(appreciation.map((t) => t.text)).size).toBe(7)
    expect(new Set(review.map((t) => t.text)).size).toBe(4)
    for (const s of Object.keys(FRIENDLY_ERROR_SENTENCES)) {
      expect(appreciationErrorText(s, locale).translated).toBe(true)
      expect(reviewErrorText(s, locale).translated).toBe(true)
    }
    if (locale !== 'en') for (const s of Object.keys(APPRECIATION_ERROR_SENTENCES)) expect(appreciationErrorText(s, locale).text, s).not.toBe(s)
  })

  it('English members read each sentence as written; the dialog\'s two codes read as its own sentences', () => {
    for (const s of Object.keys(APPRECIATION_ERROR_SENTENCES)) expect(appreciationErrorText(s, 'en').text).toBe(s)
    expect(reviewErrorText(REVIEW_RATING_REQUIRED, 'en').text).toBe('Please select a stalk rating before submitting.')
    expect(reviewErrorText(REVIEW_SUBMIT_FAILED, 'en').text).toBe('Submission failed. Please try again.')
    expect(reviewErrorText("Couldn't submit review. Please try again.", 'en').text).toBe("Couldn't submit review. Please try again.")
  })

  it('anything else is returned as received, flagged as not FEED\'s own text', () => {
    for (const other of ['You have already reviewed this exchange', 'Recipient not found', 'toString', '']) {
      expect(appreciationErrorText(other, 'ko')).toEqual({ text: other, translated: false })
      expect(reviewErrorText(other, 'ko')).toEqual({ text: other, translated: false })
    }
  })
})

describe('machinery added for these surfaces', () => {
  it('formatFixed keeps the decimals in the locale\'s digits and decimal mark', () => {
    expect(formatFixed(4.5, 2, 'en')).toBe('4.50')
    expect(formatFixed(5, 2, 'en')).toBe('5.00')
    expect(formatFixed(4.456, 2, 'en')).toBe('4.46')
    expect(formatFixed(4.5, 2, 'es')).toBe('4,50')
    expect(formatFixed(4.5, 2, 'fr')).toBe('4,50')
    expect(formatFixed(4.5, 2, 'ru')).toBe('4,50')
    expect(formatFixed(4.5, 2, 'ht')).toBe('4.50')
    expect(formatFixed(4.5, 2, 'hmn')).toBe('4.50')
    expect(formatFixed(4.5, 2, 'so')).toBe('4.50')
    expect(formatFixed(4.5, 2, 'ar')).toBe(new Intl.NumberFormat(['ar', 'en-US'], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(4.5))
    expect(formatFixed(4.5, 0, 'en')).toBe(new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(4.5))
  })

  it('splitPlaceholders cuts a value at every placeholder, in order', () => {
    expect(splitPlaceholders('from {a} & {b}')).toEqual(['from ', { name: 'a' }, ' & ', { name: 'b' }])
    expect(splitPlaceholders('{a}, {b}, {c} 님이 보냄')).toEqual([{ name: 'a' }, ', ', { name: 'b' }, ', ', { name: 'c' }, ' 님이 보냄'])
    expect(splitPlaceholders('no gap')).toEqual(['no gap'])
    expect(splitPlaceholders('')).toEqual([])
    expect(splitPlaceholders('{a}{b}')).toEqual([{ name: 'a' }, { name: 'b' }])
    expect(splitPlaceholders('a { b } c')).toEqual(['a { b } c'])
  })

  it.each(LOCALES)('%s: putting the parts back together is formatMessage', (locale) => {
    for (const n of [1, 2, 3, 6]) {
      const template = giftsFromMessage(n, locale)
      const vars = { a: 'A', b: 'B', c: 'C' }
      const joined = splitPlaceholders(template).map((p) => (typeof p === 'string' ? p : vars[p.name as 'a'])).join('')
      expect(joined).toBe(formatMessage(template, vars))
      expect(joined).not.toMatch(/\{\w+\}/)
    }
  })

  it('English wording the surfaces showed before', () => {
    const en = feedBadgesMessages.en
    expect([en.harmonyNew, en.ratingGroupLabel, en.badgesHeading, en.privateHeading]).toEqual(['New', 'Wheat stalk rating', 'Community Badges', 'Private — only you can see this'])
    expect([en.giftsHeading, en.giftsLoading, en.sendAppreciation, en.appreciateSelf]).toEqual(['Gifts received', 'Loading your gifts…', 'Send appreciation', 'This is you — appreciation comes from the community.'])
    expect([en.ratingLabel, en.recommendQuestion, en.commentLabel, en.commentPlaceholder, en.submitReview]).toEqual(['Rating', 'Would you recommend this person?', 'Comment', 'Describe your experience...', 'Submit Review'])
    expect(formatMessage(en.levelShort, { level: 'II' })).toBe('Lv II')
    expect(formatMessage(en.badgesEmpty, { name: 'Ada' })).toBe('No badges yet — Ada earns badges by helping, connecting, and taking part.')
  })
})
