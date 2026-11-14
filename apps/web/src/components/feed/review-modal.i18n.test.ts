// apps/web/src/components/feed/review-modal.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the review dialog and its wheat-stalk rating in that
// language. The REAL dialog with a faked useReviews:
//   - the dialog (a portal) carries the profile's language and direction and a translated close
//     label, whichever surface opened it;
//   - the title reads around the reviewed member's own name; the description is chosen by role;
//   - the rating is a radio group as the ARIA Authoring Practices describe it: named by the
//     visible caption, one tab stop, arrows move focus and check (ArrowLeft is "next" in Arabic),
//     wrapping, Space checks, and the filled stalks always show the checked value;
//   - closing the dialog returns focus to its opener, or to a stable control once a review is sent;
//   - the Yes / No pair is a group named by its question; the comment box takes the direction of
//     what is typed;
//   - a failure is the member's sentence, or received text marked English;
//   - submitting still sends what it sent.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state } = vi.hoisted(() => ({
  state: { language: 'en' as string, error: null as string | null, loading: false, submit: (() => Promise.resolve({})) as (p: unknown) => Promise<unknown>, submitted: [] as unknown[] },
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'me' }, isAnonymous: false, profile: { preferred_language: state.language } }) }))
vi.mock('@/hooks/use-reviews', () => ({
  useReviews: () => ({
    loading: state.loading,
    error: state.error,
    submitReview: (p: unknown) => {
      state.submitted.push(p)
      return state.submit(p)
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { cardT } from '@/lib/i18n-feed-card'
import { editT } from '@/lib/i18n-feed-edit'
import { REVIEW_ROLES, badgesT, reviewDescription, stalksText } from '@/lib/i18n-feed-badges'
import { DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AlertDescription } from '@/components/ui/alert'
import { MAX_STALKS, WheatStalkRatingDisplay, WheatStalkRatingInteractive, ratingKeyStep, ratingNeighbour, ratingTabStop } from '@/components/ui/wheat-stalk-rating'
import { ReviewModal } from './review-modal'

const LOCALES = Object.keys(messages) as Locale[]
type El = { type: unknown; props: Record<string, unknown> }
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement(node) ? textOf((node as El).props.children) : ''
}
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
const one = (tree: unknown, type: unknown) => (findAll(tree, (e) => e.type === type) as El[])[0]
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

function dialog(language: string, o: Record<string, unknown> = {}) {
  state.language = language
  const props = { open: true, onOpenChange: vi.fn(), optInId: 'o1', revieweeName: 'مريم', revieweeRole: 'seeker', onSubmitted: vi.fn(), ...o }
  const c = mount(() => ReviewModal(props as Parameters<typeof ReviewModal>[0]))
  return { c, props, tree: () => c.tree() }
}

beforeEach(() => {
  state.error = null
  state.loading = false
  state.submit = () => Promise.resolve({})
  state.submitted = []
})

describe('the review dialog in the member language', () => {
  it('ar: the dialog carries lang="ar" dir="rtl" and a translated close label', () => {
    const content = one(dialog('ar').tree(), DialogContent)
    expect(content.props).toMatchObject({ lang: 'ar', dir: 'rtl', closeLabel: 'إغلاق' })
  })

  it.each(LOCALES)('%s: language, direction and close label follow the profile', (locale) => {
    const content = one(dialog(locale).tree(), DialogContent)
    expect(content.props.lang).toBe(locale)
    expect(content.props.dir).toBe(locale === 'ar' ? 'rtl' : 'ltr')
    expect(content.props.closeLabel).toBe(cardT(locale, 'close'))
  })

  it('es: title around the name, description by role, every label and button', () => {
    const tree = dialog('es').tree()
    const title = one(tree, DialogTitle)
    expect(textOf(title)).toBe('Valorar a مريم')
    expect((findAll(title, (e) => e.type === 'bdi') as El[])[0].props).toMatchObject({ lang: '', children: 'مريم' })
    expect(textOf(one(tree, DialogDescription))).toBe('Comparte tu experiencia con quien solicitó esta ayuda. Tu valoración cuenta para su puntuación de Armonía.')
    const text = textOf(tree)
    for (const piece of ['Valoración', '¿Recomendarías a esta persona?', 'Sí', 'Comentario', '(opcional, máx. 1000 caracteres)', 'Cancelar', 'Enviar valoración']) expect(text, piece).toContain(piece)
    expect(byTestId(tree, 'review-comment')[0].props.placeholder).toBe('Describe tu experiencia...')
    expect(text).not.toMatch(/Review |Rating|Would you recommend|Comment|\bCancel\b|Submit/)
  })

  it('en: reads as before (the limit now with its thousands separator)', () => {
    const tree = dialog('en', { revieweeName: 'Ada', revieweeRole: 'sourcer' }).tree()
    expect(textOf(one(tree, DialogTitle))).toBe('Review Ada')
    expect(textOf(one(tree, DialogDescription))).toBe('Share your experience with this sourcer. Your rating contributes to their Harmony Score.')
    const text = textOf(tree)
    for (const piece of ['Rating', 'Would you recommend this person?', 'Yes', 'No', 'Comment (optional, max 1,000 chars)', 'Cancel', 'Submit Review']) expect(text, piece).toContain(piece)
  })

  it.each(LOCALES)('%s: each of the four roles, and any other value, gets its sentence', (locale) => {
    for (const role of [...REVIEW_ROLES, 'x']) {
      expect(textOf(one(dialog(locale, { revieweeRole: role }).tree(), DialogDescription))).toBe(reviewDescription(role, locale))
    }
  })

  it('the name is the member\'s own text unless the caller says it is FEED\'s fallback word', () => {
    const own = (findAll(one(dialog('ru').tree(), DialogTitle), (e) => e.type === 'bdi') as El[])[0]
    expect(own.props.lang).toBe('')
    const fallback = (findAll(one(dialog('ru', { revieweeName: 'Пользователь', revieweeNameLang: undefined }).tree(), DialogTitle), (e) => e.type === 'bdi') as El[])[0]
    expect(fallback.props).toMatchObject({ children: 'Пользователь' })
    // Explicit undefined is "no lang attribute": the word inherits the dialog's language.
    expect(fallback.props.lang === undefined || fallback.props.lang === '').toBe(true)
  })

  it('a name that equals a role or a key is shown as written', () => {
    expect(textOf(one(dialog('es', { revieweeName: 'seeker' }).tree(), DialogTitle))).toBe('Valorar a seeker')
    expect(textOf(one(dialog('es', { revieweeName: 'reviewTitle' }).tree(), DialogTitle))).toBe('Valorar a reviewTitle')
  })
})

describe('the Yes / No pair and the comment box', () => {
  it('the pair is a group named by its question; each button says its word and carries its pressed state', () => {
    const d = dialog('fr')
    const group = (findAll(d.tree(), (e) => e.props.role === 'group') as El[])[0]
    const question = (findAll(d.tree(), (e) => e.props.id === group.props['aria-labelledby']) as El[])[0]
    expect(textOf(question)).toBe('Recommanderiez-vous cette personne ?')
    const buttons = () => findAll((findAll(d.tree(), (e) => e.props.role === 'group') as El[])[0], (e) => e.type === 'button') as El[]
    expect(buttons().map(textOf)).toEqual([editT('fr', 'yes'), editT('fr', 'no')])
    expect(buttons().map((b) => b.props['aria-pressed'])).toEqual([false, false])
    ;(buttons()[0].props.onClick as () => void)()
    d.c.rerender()
    expect(buttons().map((b) => b.props['aria-pressed'])).toEqual([true, false])
  })

  it('the comment box takes the page direction while empty and the text\'s own once typed in', () => {
    const d = dialog('ar')
    const box = () => byTestId(d.tree(), 'review-comment')[0]
    expect(box().props.dir).toBe('rtl')
    ;(box().props.onChange as (e: unknown) => void)({ target: { value: 'thank you' } })
    d.c.rerender()
    expect(box().props.dir).toBe('auto')
    expect(dialog('en').tree() && byTestId(dialog('en').tree(), 'review-comment')[0].props.dir).toBe('ltr')
  })

  it('near the limit the counter shows, in the locale\'s digits', () => {
    const d = dialog('es')
    ;(byTestId(d.tree(), 'review-comment')[0].props.onChange as (e: unknown) => void)({ target: { value: 'x'.repeat(850) } })
    expect(textOf(d.c.rerender())).toContain('850/1000')
    const en = dialog('en')
    ;(byTestId(en.tree(), 'review-comment')[0].props.onChange as (e: unknown) => void)({ target: { value: 'x'.repeat(1200) } })
    expect(textOf(en.c.rerender())).toContain('1,000/1,000')
  })
})

describe('failures', () => {
  const alertOf = (tree: unknown) => one(tree, AlertDescription)

  it('the hook\'s sentence reads in the member language, with no English mark', () => {
    state.error = "Couldn't submit review. Please try again."
    const alert = alertOf(dialog('zh').tree())
    expect(textOf(alert)).toBe('无法提交评价。请重试。')
    expect(alert.props.lang).toBeUndefined()
    expect(alert.props.dir).toBeUndefined()
  })

  it('a general sentence (trouble connecting) reads translated', () => {
    state.error = "We're having trouble connecting. Please check your connection and try again."
    expect(textOf(alertOf(dialog('pt').tree()))).toBe('Estamos com problemas de conexão. Verifique sua conexão e tente novamente.')
  })

  it('text FEED did not write is shown as received and marked English', () => {
    state.error = 'You have already reviewed this exchange'
    const alert = alertOf(dialog('zh').tree())
    expect(textOf(alert)).toBe('You have already reviewed this exchange')
    expect(alert.props).toMatchObject({ lang: 'en', dir: 'ltr' })
  })

  it('a submit that throws with no message from the hook reads as the dialog\'s own failure sentence', async () => {
    state.submit = () => Promise.reject(new Error('boom'))
    const d = dialog('ko')
    ;((findAll(d.tree(), (e) => e.type === WheatStalkRatingInteractive) as El[])[0].props.onChange as (n: number) => void)(4)
    d.c.rerender()
    await (one(d.tree(), 'form').props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault: () => {} })
    expect(textOf(alertOf(d.c.rerender()))).toBe('제출하지 못했습니다. 다시 시도해 주세요.')
  })

  it('submitting with no rating says so in the member language and sends nothing', async () => {
    const d = dialog('ht')
    await (one(d.tree(), 'form').props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault: () => {} })
    expect(textOf(alertOf(d.c.rerender()))).toBe('Tanpri chwazi yon evalyasyon ak zepi anvan ou voye.')
    expect(state.submitted).toEqual([])
  })
})

describe('submitting still sends what it sent', () => {
  it('rating, recommendation and the trimmed comment, for the opt-in; then it closes and reports', async () => {
    const d = dialog('ar')
    ;((findAll(d.tree(), (e) => e.type === WheatStalkRatingInteractive) as El[])[0].props.onChange as (n: number) => void)(5)
    ;(byTestId(d.tree(), 'review-recommend')[0].props.onClick as () => void)()
    ;(byTestId(d.tree(), 'review-comment')[0].props.onChange as (e: unknown) => void)({ target: { value: '  شكرا  ' } })
    d.c.rerender()
    await (one(d.tree(), 'form').props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault: () => {} })
    expect(state.submitted).toEqual([{ optInId: 'o1', conversationId: undefined, rating: 5, wouldRecommend: true, comment: 'شكرا' }])
    expect(d.props.onOpenChange).toHaveBeenCalledWith(false)
    expect(d.props.onSubmitted).toHaveBeenCalledTimes(1)
  })
})

describe('the wheat-stalk rating: a radio group as the ARIA Authoring Practices describe it', () => {
  const interactive = (locale: Locale, value = 2) => renderToStaticMarkup(h(WheatStalkRatingInteractive, { value, onChange: () => {}, testIdPrefix: 'review', locale, labelledBy: 'cap', required: true }))
  /** The group on the mini runtime, each stalk given an element that records focus. */
  function group(locale: Locale, value: number) {
    const onChange = vi.fn((n: number) => {
      current = n
    })
    let current = value
    const focused: number[] = []
    const c = mount(() => WheatStalkRatingInteractive({ value: current, onChange, locale, labelledBy: 'cap' }))
    const radios = () => findAll(c.tree(), (e) => e.props.role === 'radio') as El[]
    radios().forEach((r, i) => (r.props.ref as (el: unknown) => void)({ focus: () => void focused.push(i + 1) }))
    const press = (on: number, key: string) => {
      const prevented = vi.fn()
      ;(radios()[on - 1].props.onKeyDown as (e: unknown) => void)({ key, preventDefault: prevented })
      c.rerender()
      return prevented.mock.calls.length
    }
    const filled = () => radios().filter((r) => (r.props.children as El).props.filled === true).length
    return { c, onChange, focused, radios, press, filled, value: () => current }
  }

  it('vi: the group is named by the caption it is given; each stalk is named in Vietnamese; the chosen one is checked', () => {
    const out = interactive('vi')
    expect(out).toMatch(/^<div data-testid="review-stalks" role="radiogroup" aria-labelledby="cap" aria-required="true"/)
    expect(out).not.toMatch(/<div[^>]*role="radiogroup"[^>]*aria-label=/)
    expect(out).toContain('role="radio" aria-checked="true" aria-label="2 bông lúa" tabindex="0" data-testid="review-stalk-2"')
    expect(out).toContain('role="radio" aria-checked="false" aria-label="5 bông lúa" tabindex="-1" data-testid="review-stalk-5"')
    expect(out).not.toMatch(/Wheat stalk rating|aria-label="\d stalks?"/)
  })

  it('the dialog names the group from its visible caption (so the name contains the word on screen in every locale) and marks it required', () => {
    for (const locale of LOCALES) {
      const tree = dialog(locale).tree()
      const rating = (findAll(tree, (e) => e.type === WheatStalkRatingInteractive) as El[])[0]
      const caption = (findAll(tree, (e) => e.props.id === rating.props.labelledBy) as El[])[0]
      expect(textOf(caption), locale).toBe(badgesT(locale, 'ratingLabel'))
      expect(rating.props.required, locale).toBe(true)
    }
  })

  it.each(LOCALES)('%s: five stalks, five different names from the dictionary', (locale) => {
    const out = interactive(locale)
    const names = [1, 2, 3, 4, 5].map((n) => stalksText(n, locale))
    expect(new Set(names).size).toBe(5)
    for (const [i, name] of names.entries()) expect(out).toMatch(new RegExp(`aria-label="${html(name)}" tabindex="-?\\d" data-testid="review-stalk-${i + 1}"`))
    expect(MAX_STALKS).toBe(5)
  })

  it('one tab stop: the checked stalk, or the first when none is checked', () => {
    const stops = (value: number) => [...interactive('en', value).matchAll(/tabindex="(-?\d)" data-testid="review-stalk-(\d)"/g)].filter((m) => m[1] === '0').map((m) => Number(m[2]))
    expect(stops(0)).toEqual([1])
    for (const value of [1, 2, 3, 4, 5]) expect(stops(value)).toEqual([value])
    expect([0, 1, 3, 5, 9].map(ratingTabStop)).toEqual([1, 1, 3, 5, 1])
  })

  it('which neighbour an arrow means: Down next and Up previous everywhere; Right next in LTR, Left next in RTL', () => {
    for (const locale of LOCALES) {
      expect([ratingKeyStep('ArrowDown', locale), ratingKeyStep('ArrowUp', locale), ratingKeyStep('Enter', locale), ratingKeyStep(' ', locale), ratingKeyStep('a', locale)]).toEqual([1, -1, 0, 0, 0])
      if (locale !== 'ar') expect([ratingKeyStep('ArrowRight', locale), ratingKeyStep('ArrowLeft', locale)]).toEqual([1, -1])
    }
    expect([ratingKeyStep('ArrowRight', 'ar'), ratingKeyStep('ArrowLeft', 'ar')]).toEqual([-1, 1])
    // Wrapping at both ends.
    expect([1, 2, 5].map((n) => ratingNeighbour(n, 1))).toEqual([2, 3, 1])
    expect([1, 2, 5].map((n) => ratingNeighbour(n, -1))).toEqual([5, 1, 4])
  })

  it('an arrow key moves focus to the neighbouring stalk and checks it: focused, checked and filled are one stalk', () => {
    const g = group('en', 0)
    // From the focused first stalk (none checked yet), two presses end on the third.
    expect(g.press(1, 'ArrowRight')).toBe(1)
    expect([g.value(), g.focused.at(-1), g.filled()]).toEqual([2, 2, 2])
    g.press(2, 'ArrowRight')
    expect([g.value(), g.focused.at(-1), g.filled()]).toEqual([3, 3, 3])
    g.press(3, 'ArrowLeft')
    expect([g.value(), g.focused.at(-1), g.filled()]).toEqual([2, 2, 2])
    g.press(2, 'ArrowDown')
    expect([g.value(), g.focused.at(-1)]).toEqual([3, 3])
    g.press(3, 'ArrowUp')
    expect([g.value(), g.focused.at(-1)]).toEqual([2, 2])
    expect(g.onChange).toHaveBeenCalledTimes(5)
    expect(g.focused).toEqual([2, 3, 2, 3, 2])
  })

  it('it wraps at the ends', () => {
    const g = group('en', 5)
    g.press(5, 'ArrowRight')
    expect([g.value(), g.focused.at(-1)]).toEqual([1, 1])
    g.press(1, 'ArrowLeft')
    expect([g.value(), g.focused.at(-1)]).toEqual([5, 5])
  })

  it('Arabic: ArrowLeft is the next stalk and ArrowRight the previous', () => {
    const g = group('ar', 0)
    g.press(1, 'ArrowLeft')
    g.press(2, 'ArrowLeft')
    expect([g.value(), g.focused.at(-1), g.filled()]).toEqual([3, 3, 3])
    g.press(3, 'ArrowRight')
    expect([g.value(), g.focused.at(-1)]).toEqual([2, 2])
  })

  it('any other key is left alone: nothing changes, nothing is swallowed', () => {
    const g = group('en', 2)
    for (const key of ['Tab', 'Enter', ' ', 'Home', 'a']) expect(g.press(2, key), key).toBe(0)
    expect(g.onChange).not.toHaveBeenCalled()
    expect(g.focused).toEqual([])
  })

  it('Space or a click checks the focused stalk (a button fires click on Space)', () => {
    const g = group('en', 0)
    ;(g.radios()[3].props.onClick as () => void)()
    g.c.rerender()
    expect(g.value()).toBe(4)
    expect(g.radios().map((r) => r.props['aria-checked'])).toEqual([false, false, false, true, false])
    expect(g.radios().map((r) => r.props.tabIndex)).toEqual([-1, -1, -1, 0, -1])
    // A real <button>, so the browser turns Space into that click.
    expect(g.radios().every((r) => r.type === 'button' && r.props.type === 'button')).toBe(true)
  })

  it('focus sets no preview; only a pointer does, and a key press clears it', () => {
    const g = group('en', 3)
    for (const r of g.radios()) expect('onFocus' in r.props || 'onBlur' in r.props).toBe(false)
    ;(g.radios()[0].props.onMouseEnter as () => void)()
    g.c.rerender()
    expect(g.filled()).toBe(1)
    // The pointer still rests on the first stalk; the keyboard changes the value: the value shows.
    g.press(3, 'ArrowRight')
    expect([g.value(), g.filled()]).toEqual([4, 4])
    ;(g.radios()[1].props.onMouseEnter as () => void)()
    g.c.rerender()
    ;(g.radios()[1].props.onMouseLeave as () => void)()
    g.c.rerender()
    expect(g.filled()).toBe(4)
  })

  it('the display is an image named by the rating, in the member language', () => {
    expect(renderToStaticMarkup(h(WheatStalkRatingDisplay, { value: 3, locale: 'so' }))).toMatch(/^<span data-testid="stalk-display-row" class="inline-flex items-center gap-0\.5" role="img" aria-label="3 ka mid ah 5 sabuul">/)
    expect(renderToStaticMarkup(h(WheatStalkRatingDisplay, { value: 3, locale: 'en' }))).toContain('aria-label="3 out of 5 stalks"')
  })
})

describe('focus returns when the dialog closes', () => {
  const closeWith = (o: Record<string, unknown>, before: (d: ReturnType<typeof dialog>) => Promise<void> | void = () => {}) => {
    const opener = { isConnected: true, focus: vi.fn() }
    const fallbackFocus = vi.fn()
    const d = dialog('es', { returnFocusRef: { current: opener }, fallbackFocus, ...o })
    return { d, opener, fallbackFocus, before, close: () => {
      const prevented = vi.fn()
      ;(one(d.tree(), DialogContent).props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault: prevented })
      return prevented.mock.calls.length
    } }
  }

  it('closed unsent (Escape, the close button, Cancel): focus goes back to the button that opened it', () => {
    const t = closeWith({})
    expect(t.close()).toBe(1)
    expect(t.opener.focus).toHaveBeenCalledTimes(1)
    expect(t.fallbackFocus).not.toHaveBeenCalled()
  })

  it('the opener has left the page: focus goes to the caller\'s stable control', () => {
    const t = closeWith({})
    t.opener.isConnected = false
    expect(t.close()).toBe(1)
    expect(t.opener.focus).not.toHaveBeenCalled()
    expect(t.fallbackFocus).toHaveBeenCalledTimes(1)
  })

  it('after a review is sent the opener is about to go: focus goes to the stable control, never to the opener', async () => {
    const t = closeWith({})
    ;((findAll(t.d.tree(), (e) => e.type === WheatStalkRatingInteractive) as El[])[0].props.onChange as (n: number) => void)(4)
    t.d.c.rerender()
    await (one(t.d.tree(), 'form').props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault: () => {} })
    expect(state.submitted).toHaveLength(1)
    expect(t.close()).toBe(1)
    expect(t.opener.focus).not.toHaveBeenCalled()
    expect(t.fallbackFocus).toHaveBeenCalledTimes(1)
    // The next close of the same dialog, unsent, goes back to the opener again.
    expect(t.close()).toBe(1)
    expect(t.opener.focus).toHaveBeenCalledTimes(1)
  })

  it('a caller that hands in nothing leaves the close to the dialog (nothing is prevented)', () => {
    const d = dialog('es')
    const prevented = vi.fn()
    ;(one(d.tree(), DialogContent).props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault: prevented })
    expect(prevented).not.toHaveBeenCalled()
  })
})

describe('contrast of what this dialog colours itself', () => {
  it('a chosen Yes or No is white on lime-700 / red-700, and the comment placeholder is stone-500', () => {
    const d = dialog('en')
    const buttons = () => findAll((findAll(d.tree(), (e) => e.props.role === 'group') as El[])[0], (e) => e.type === 'button') as El[]
    ;(buttons()[0].props.onClick as () => void)()
    d.c.rerender()
    expect(buttons()[0].props.className).toContain('bg-lime-700 text-white border-lime-700')
    ;(buttons()[1].props.onClick as () => void)()
    d.c.rerender()
    expect(buttons()[1].props.className).toContain('bg-red-700 text-white border-red-700')
    for (const b of buttons()) expect(b.props.className).not.toMatch(/bg-lime-600|bg-red-500/)
    const box = byTestId(d.tree(), 'review-comment')[0]
    expect(box.props.className).toContain('placeholder:text-stone-500')
    expect(box.props.className).not.toContain('placeholder:text-stone-400')
  })
})

describe('review-modal.tsx source', () => {
  const src = readFileSync(fileURLToPath(new URL('./review-modal.tsx', import.meta.url)), 'utf8')
  const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('no English copy and no English mark is left', () => {
    for (const literal of ['lang="en"', 'Review {', 'Share your experience', '>Rating<', 'Would you recommend', '\n                  Yes\n', '\n                  No\n', 'Comment{', 'optional, max', 'Describe your experience', '/1000', '\n              Cancel\n', 'Submit Review', 'Please select a stalk rating', 'Submission failed', 'mr-2']) {
      expect(code, JSON.stringify(literal)).not.toContain(literal)
    }
  })

  it('no translation reader is given the reviewed member\'s name', () => {
    expect(code).not.toMatch(/\b(badgesT|cardT|editT|reviewErrorText|reviewDescription)\([^()]*\brevieweeName\b/)
  })
})
