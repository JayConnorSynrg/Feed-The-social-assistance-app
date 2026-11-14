// apps/web/src/components/feed/follow-error-banner.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads a follow / unfollow failure in that language:
//   - each sentence hooks/use-follows.ts can report, and the two general ones of
//     lib/friendly-error.ts, has the member's sentence in 14 locales; the line is an alert and
//     carries no English mark;
//   - text FEED did not write is shown as received and marked English;
//   - the hook is unchanged, and every sentence in it is known here (both directions).

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from '@/lib/i18n'
import { FOLLOW_ERROR_SENTENCES, followErrorText } from '@/lib/i18n-feed-follows'
import { FRIENDLY_ERROR_SENTENCES, friendlyErrorT, readErrorSentence } from '@/lib/i18n-friendly-error'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { FollowErrorBanner } from './follow-error-banner'

const LOCALES = Object.keys(messages) as Locale[]
const banner = (error: string, locale: Locale) => renderToStaticMarkup(h(FollowErrorBanner, { error, locale }))
const HOOK_SENTENCES = Object.keys(FOLLOW_ERROR_SENTENCES)
const CLASS = 'class="mx-2 mt-1 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md"'

describe('the follow-error line in the member language', () => {
  it('es: the hook\'s sentence reads in Spanish, as an alert with no English mark', () => {
    expect(banner("Couldn't follow. Please try again.", 'es')).toBe(`<div role="alert" data-testid="follow-error" ${CLASS}>No se pudo seguir. Inténtalo de nuevo.</div>`)
  })

  it('ar: Arabic copy; direction comes from the feed root (no mark of its own)', () => {
    const out = banner('You must be signed in to follow someone.', 'ar')
    expect(out).toContain('>يجب تسجيل الدخول لمتابعة أي شخص.</div>')
    expect(out).not.toMatch(/\blang=|\bdir=/)
  })

  it('a general sentence (permission, connection) reads translated too', () => {
    expect(banner("We're having trouble connecting. Please check your connection and try again.", 'fr')).toContain('>Nous avons du mal à nous connecter. Vérifiez votre connexion et réessayez.</div>')
    expect(banner("You don't have permission to view this right now. Please try again or contact support.", 'vi')).not.toMatch(/lang="en"|permission/)
  })

  it('text FEED did not write is shown as received and marked English', () => {
    expect(banner('duplicate key value violates unique constraint "follows_pkey"', 'es')).toBe(
      `<div role="alert" lang="en" dir="ltr" data-testid="follow-error" ${CLASS}>duplicate key value violates unique constraint &quot;follows_pkey&quot;</div>`,
    )
    expect(followErrorText('toString', 'es')).toEqual({ text: 'toString', translated: false })
    expect(followErrorText('constructor', 'es').translated).toBe(false)
  })

  it.each(LOCALES)('%s: each of the eight sentences has its own text; English members read the hook\'s own words', (locale) => {
    const all = [...HOOK_SENTENCES, ...Object.keys(FRIENDLY_ERROR_SENTENCES)]
    const texts = all.map((s) => followErrorText(s, locale))
    expect(texts.every((t) => t.translated)).toBe(true)
    expect(new Set(texts.map((t) => t.text)).size).toBe(8)
    for (const [i, s] of all.entries()) {
      if (locale === 'en') expect(texts[i].text).toBe(s)
      else expect(texts[i].text, s).not.toBe(s)
    }
  })
})

describe('the sources are unchanged and fully known', () => {
  const code = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  /** A sentence: a quoted literal that starts with a capital and has a space in it. */
  const sentences = (source: string) => [...new Set([...source.matchAll(/'([A-Z][^'\n]* [^'\n]*)'|"([A-Z][^"\n]* [^"\n]*)"/g)].map((m) => m[1] ?? m[2]))].sort()

  it('every sentence use-follows.ts can report has a key, and no key is stale', () => {
    expect(sentences(code('../../hooks/use-follows.ts'))).toEqual([...HOOK_SENTENCES].sort())
    expect(HOOK_SENTENCES).toHaveLength(6)
  })

  it('the two general sentences are exactly what lib/friendly-error.ts returns', () => {
    expect(getFriendlyErrorMessage({ code: '42501', message: 'permission denied for table follows' }, 'x')).toBe(friendlyErrorT('en', 'permission'))
    expect(getFriendlyErrorMessage(new Error('The operation timeout was reached'), 'x')).toBe(friendlyErrorT('en', 'connection'))
    expect(getFriendlyErrorMessage(new Error('boom'), "Couldn't follow. Please try again.")).toBe("Couldn't follow. Please try again.")
    // Apart from its default fallback, the file writes no other sentence.
    expect(sentences(code('../../lib/friendly-error.ts'))).toEqual(['Something went wrong. Please try again.', ...Object.keys(FRIENDLY_ERROR_SENTENCES)].sort())
  })

  it('readErrorSentence asks the surface first, then the general table, and never treats other text as a key', () => {
    const own = (s: string) => (s === 'mine' ? 'MINE' : null)
    expect(readErrorSentence('mine', 'es', own)).toEqual({ text: 'MINE', translated: true })
    expect(readErrorSentence(Object.keys(FRIENDLY_ERROR_SENTENCES)[1], 'es', own)).toEqual({ text: friendlyErrorT('es', 'connection'), translated: true })
    for (const other of ['', 'hasOwnProperty', '__proto__', 'Server said no']) expect(readErrorSentence(other, 'es', own)).toEqual({ text: other, translated: false })
  })
})
