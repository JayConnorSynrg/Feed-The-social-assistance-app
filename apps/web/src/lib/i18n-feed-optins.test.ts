// apps/web/src/lib/i18n-feed-optins.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The sign-up ("opt-in") dictionary beyond key parity (i18n-feed-subtabs.test.ts):
//   - the two plural tables: 14 locales, placeholders kept, the plural forms each language needs,
//     and the form chosen through Intl.PluralRules;
//   - the status vocabulary (resource_opt_ins.status): four labels per locale;
//   - every failure sentence the card can be handed is known, in both directions, against the
//     feed panel's handlers, the hook, and the opt_in_to_post function;
//   - English is word for word what the card showed before the translation.
// What a member reads on the card: components/feed/feed-post-card.optins.i18n.test.ts.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { messages, type Locale } from './i18n'
import {
  OPTED_IN_COUNT,
  OPT_IN_ERROR_SENTENCES,
  OPT_IN_STATUSES,
  SPOTS_LEFT,
  feedOptInsMessages,
  isOptInStatus,
  optedInCountText,
  optInActionName,
  optInErrorText,
  optInStatusLabel,
  optInsT,
  spotsLeftText,
} from './i18n-feed-optins'
import { FRIENDLY_ERROR_SENTENCES } from './i18n-friendly-error'
import { OPT_IN_REFUSALS } from '@/hooks/use-opt-ins'

const LOCALES = Object.keys(messages) as Locale[]
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A sentence: a quoted literal that starts with a capital and has a space in it. */
const sentences = (source: string) => [...new Set([...source.matchAll(/'([A-Z][^'\n]* [^'\n]*)'|"([A-Z][^"\n]* [^"\n]*)"/g)].map((m) => m[1] ?? m[2]))]

describe('counts', () => {
  const TABLES = [
    ['SPOTS_LEFT', SPOTS_LEFT, ['{left}', '{max}']],
    ['OPTED_IN_COUNT', OPTED_IN_COUNT, ['{count}']],
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

    it('Arabic has its six forms and Russian its four; Spanish, French, Portuguese and Amharic have a singular', () => {
      expect(Object.keys(table.ar).sort()).toEqual(['few', 'many', 'one', 'other', 'two', 'zero'])
      expect(Object.keys(table.ru).sort()).toEqual(['few', 'many', 'one', 'other'])
      for (const locale of ['es', 'fr', 'pt', 'am'] as const) {
        expect(table[locale].one, locale).toBeTruthy()
        expect(table[locale].one, locale).not.toBe(table[locale].other)
      }
    })

    it.each(LOCALES.filter((l) => l !== 'en'))('%s is translated', (locale) => {
      expect(table[locale].other).not.toBe(table.en.other)
    })
  })

  it('English reads exactly as the card did: the noun follows the limit, not what is left', () => {
    expect(spotsLeftText(1, 1, 'en')).toBe('1 of 1 spot left')
    expect(spotsLeftText(0, 1, 'en')).toBe('0 of 1 spot left')
    expect(spotsLeftText(1, 5, 'en')).toBe('1 of 5 spots left')
    expect(spotsLeftText(0, 0, 'en')).toBe('0 of 0 spots left')
    expect(optedInCountText(0, 'en')).toBe('0 opted in')
    expect(optedInCountText(1, 'en')).toBe('1 opted in')
    expect(optedInCountText(12, 'en')).toBe('12 opted in')
  })

  it('each language takes its own plural form', () => {
    expect(spotsLeftText(2, 5, 'es')).toBe('2 de 5 plazas disponibles')
    expect(spotsLeftText(0, 1, 'es')).toBe('0 de 1 plaza disponible')
    expect(spotsLeftText(1, 2, 'fr')).toBe('1 sur 2 places disponibles')
    expect(spotsLeftText(3, 21, 'ru')).toBe('Свободно 3 из 21 места')
    expect(spotsLeftText(3, 22, 'ru')).toBe('Свободно 3 из 22 мест')
    expect(spotsLeftText(3, 25, 'ru')).toBe('Свободно 3 из 25 мест')
    expect(optedInCountText(1, 'ru')).toBe('1 человек записался')
    expect(optedInCountText(3, 'ru')).toBe('3 человека записались')
    expect(optedInCountText(5, 'ru')).toBe('5 человек записались')
    expect(optedInCountText(1, 'pt')).toBe('1 pessoa inscrita')
    expect(optedInCountText(2, 'pt')).toBe('2 pessoas inscritas')
    expect(optedInCountText(4, 'ko')).toBe('4명 신청')
    expect(optedInCountText(7, 'hmn')).toBe('7 tus neeg sau npe lawm')
    expect(spotsLeftText(2, 5, 'ht')).toBe('2 sou 5 plas ki rete')
    // Arabic: two, few (3–10), many (11–99); the digits are the locale's own.
    const ar = (n: number) => new Intl.NumberFormat(['ar', 'en-US']).format(n)
    expect(optedInCountText(2, 'ar')).toBe(`${ar(2)} مسجّلان`)
    expect(optedInCountText(3, 'ar')).toBe(`${ar(3)} مسجّلين`)
    expect(optedInCountText(11, 'ar')).toBe(`${ar(11)} مسجّلًا`)
    expect(spotsLeftText(1, 2, 'ar')).toBe(`${ar(1)} من ${ar(2)} مكانين متاحين`)
  })

  it('a large count takes the locale\'s grouping', () => {
    expect(optedInCountText(1000, 'en')).toBe('1,000 opted in')
    expect(optedInCountText(1000, 'es')).toBe(`${new Intl.NumberFormat(['es', 'en-US']).format(1000)} personas apuntadas`)
  })
})

describe('status vocabulary (resource_opt_ins.status)', () => {
  it('the four stored values, as the CHECK constraint lists them', () => {
    expect(OPT_IN_STATUSES).toEqual(['pending', 'accepted', 'declined', 'completed'])
    const migration = read('../../../../supabase/migrations/20260604140000_resource_opt_ins_and_capacity.sql')
    for (const status of OPT_IN_STATUSES) expect(migration, status).toContain(`'${status}'`)
  })

  it.each(LOCALES)('%s: each state has its own label; an unknown value is shown as stored', (locale) => {
    const labels = OPT_IN_STATUSES.map((s) => optInStatusLabel(s, locale))
    expect(new Set(labels).size).toBe(4)
    if (locale !== 'en') expect(labels).not.toEqual(OPT_IN_STATUSES)
    expect(optInStatusLabel('waitlisted', locale)).toBe('waitlisted')
    expect(isOptInStatus('waitlisted')).toBe(false)
    expect(isOptInStatus('toString')).toBe(false)
    expect(optInStatusLabel('constructor', locale)).toBe('constructor')
  })

  it('English shows the stored word itself, as before', () => {
    expect(OPT_IN_STATUSES.map((s) => optInStatusLabel(s, 'en'))).toEqual(OPT_IN_STATUSES)
  })
})

describe('accessible names of the row buttons (label in name)', () => {
  const ACTIONS = ['accept', 'decline', 'markCompleted', 'unblock', 'reviewSeeker'] as const

  it('has the 14 locales', () => expect(LOCALES).toHaveLength(14))

  it.each(LOCALES)('%s: each name starts with the text on the button, then says whom', (locale) => {
    for (const action of ACTIONS) {
      const name = optInActionName(locale, action, 'مريم')
      expect(name.startsWith(optInsT(locale, action)), `${action}: ${name}`).toBe(true)
      expect(name).toContain('مريم')
      expect(name).not.toMatch(/\{\w+\}/)
    }
    expect(new Set(ACTIONS.map((a) => optInActionName(locale, a, 'x'))).size).toBe(ACTIONS.length)
  })

  it('the name is the member\'s own text, isolated and never looked up', () => {
    expect(optInActionName('es', 'accept', 'pending')).toBe('Aceptar: \u2068pending\u2069')
    expect(optInActionName('es', 'accept', 'Decline')).toBe('Aceptar: \u2068Decline\u2069')
    // A name cannot close the isolate or flip what follows it.
    expect(optInActionName('en', 'decline', 'A\u2069\u202eB')).toBe('Decline: \u2068AB\u2069')
  })
})

describe('failures', () => {
  const KNOWN = Object.keys(OPT_IN_ERROR_SENTENCES)

  it.each(LOCALES)('%s: every known sentence has a text; none is left in English', (locale) => {
    for (const sentence of [...KNOWN, ...Object.keys(FRIENDLY_ERROR_SENTENCES)]) {
      const got = optInErrorText(sentence, locale)
      expect(got.translated, sentence).toBe(true)
      expect(got.text.trim(), sentence).not.toBe('')
      if (locale !== 'en') expect(got.text, sentence).not.toBe(sentence)
    }
    // Seven different member sentences (the two thrown-value fallbacks read as the plain failures).
    expect(new Set(KNOWN.map((s) => optInErrorText(s, locale).text)).size).toBe(7)
  })

  it('English members read each sentence as written (the two fallbacks as the hook\'s own words)', () => {
    for (const sentence of KNOWN.filter((s) => !s.startsWith('Could not'))) expect(optInErrorText(sentence, 'en').text).toBe(sentence)
    expect(optInErrorText('Could not opt in.', 'en').text).toBe("Couldn't opt in. Please try again.")
    expect(optInErrorText('Could not withdraw.', 'en').text).toBe("Couldn't withdraw opt-in. Please try again.")
  })

  it('anything else is returned as received, flagged as not FEED\'s own text', () => {
    for (const other of ['Post not found', 'new row violates row-level security policy', 'toString', '__proto__', '']) {
      expect(optInErrorText(other, 'vi')).toEqual({ text: other, translated: false })
    }
  })

  it('the feed panel\'s handlers: the three sentences they write are known, and they are unchanged', () => {
    const panel = code(read('../components/panels/feed-panel.tsx'))
    const handlers = panel.slice(panel.indexOf('const handleOptIn = async'), panel.indexOf('const handleAuthorUpdateOptIn = async'))
    expect(handlers.length).toBeGreaterThan(500)
    expect(sentences(handlers).sort()).toEqual(['Could not opt in.', 'Could not withdraw.', 'Create a free account to opt in.'])
    for (const s of sentences(handlers)) expect(KNOWN).toContain(s)
    // The handlers hand the hook's message on as it is.
    expect(handlers).toContain("const msg = err instanceof Error ? err.message : 'Could not opt in.'")
    expect(handlers).toContain('setOptInErrors((prev) => ({ ...prev, [postId]: msg }))')
  })

  it('the hook: its two failure sentences and the four refusals it hands through are known; its load sentences reach no member', () => {
    const hook = code(read('../hooks/use-opt-ins.ts'))
    const found = sentences(hook).sort()
    expect(found).toEqual(
      [...OPT_IN_REFUSALS, "Couldn't opt in. Please try again.", "Couldn't withdraw opt-in. Please try again.", "Couldn't load opt-in status. Please try again.", 'Opt-in data timed out — please check your connection and retry.'].sort(),
    )
    for (const s of [...OPT_IN_REFUSALS, "Couldn't opt in. Please try again.", "Couldn't withdraw opt-in. Please try again."]) expect(KNOWN, s).toContain(s)
    // The two load sentences set the hook's `error`, which the feed panel does not read.
    expect(code(read('../components/panels/feed-panel.tsx'))).toContain('const { fetchOptInsForPosts, optIn: doOptIn, withdrawOptIn: doWithdraw } = useOptIns()')
  })

  it('the four refusals are what opt_in_to_post raises; its other texts stay behind the plain failure', () => {
    const sql = read('../../../../supabase/migrations/20261026000000_post_editing_foundation.sql')
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.opt_in_to_post'))
    const raised = [...fn.slice(0, fn.indexOf('$function$;')).matchAll(/RAISE EXCEPTION '([^']+)'/g)].map((m) => m[1]).sort()
    expect(raised).toEqual(['Account required for this action', 'Already opted in', 'Not authenticated', 'Post not found', 'This offer is full', 'This post is closed', 'You cannot opt in to your own post'])
    expect([...OPT_IN_REFUSALS].sort()).toEqual(['Already opted in', 'This offer is full', 'This post is closed', 'You cannot opt in to your own post'])
    for (const refusal of OPT_IN_REFUSALS) expect(raised).toContain(refusal)
  })
})

describe('English is what the card showed before', () => {
  it('each visible word', () => {
    const en = feedOptInsMessages.en
    expect([en.optIn, en.optedIn, en.withdraw, en.full]).toEqual(['Opt In', 'Opted In', 'Withdraw', 'Full'])
    expect([en.accept, en.decline, en.markCompleted, en.unblock]).toEqual(['Accept', 'Decline', 'Mark Completed', 'Unblock — they can request again'])
    expect([en.reviewSeeker, en.reviewSourcer, en.declinedBefore, en.declinedBeforeTitle]).toEqual(['Review seeker', 'Review sourcer', 'Declined before', 'You have declined this person before'])
  })
})
