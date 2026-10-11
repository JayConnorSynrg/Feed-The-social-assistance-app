// apps/web/src/components/feed/review-modal.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the review dialog and its wheat-stalk rating in that
// language. The REAL dialog with a faked useReviews:
//   - the dialog (a portal) carries the profile's language and direction and a translated close
//     label, whichever surface opened it;
//   - the title reads around the reviewed member's own name; the description is chosen by role;
//   - the rating group and each rating button are named in the member's language, and the arrow
//     keys follow reading direction (Arabic: ArrowLeft raises);
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
import { MAX_STALKS, WheatStalkRatingDisplay, WheatStalkRatingInteractive, ratingKeyStep } from '@/components/ui/wheat-stalk-rating'
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

describe('the wheat-stalk rating', () => {
  const interactive = (locale: Locale, value = 2) => renderToStaticMarkup(h(WheatStalkRatingInteractive, { value, onChange: () => {}, testIdPrefix: 'review', locale }))

  it('vi: the group and each button are named in Vietnamese; the chosen one is checked', () => {
    const out = interactive('vi')
    expect(out).toMatch(/^<div data-testid="review-stalks" role="radiogroup" aria-label="Đánh giá bằng bông lúa mì"/)
    expect(out).toContain('role="radio" aria-checked="true" aria-label="2 bông lúa" data-testid="review-stalk-2"')
    expect(out).toContain('role="radio" aria-checked="false" aria-label="5 bông lúa" data-testid="review-stalk-5"')
    expect(out).not.toMatch(/Wheat stalk rating|aria-label="\d stalks?"/)
  })

  it.each(LOCALES)('%s: five buttons, five different names from the dictionary', (locale) => {
    const out = interactive(locale)
    const names = [1, 2, 3, 4, 5].map((n) => stalksText(n, locale))
    expect(new Set(names).size).toBe(5)
    for (const [i, name] of names.entries()) expect(out).toContain(`aria-label="${html(name)}" data-testid="review-stalk-${i + 1}"`)
    expect(out).toContain(`aria-label="${html(badgesT(locale, 'ratingGroupLabel'))}"`)
    expect(MAX_STALKS).toBe(5)
  })

  it('the arrow keys follow reading direction: in Arabic ArrowLeft raises and ArrowRight lowers', () => {
    expect([ratingKeyStep('ArrowRight', 'en'), ratingKeyStep('ArrowLeft', 'en')]).toEqual([1, -1])
    expect([ratingKeyStep('ArrowRight', 'ar'), ratingKeyStep('ArrowLeft', 'ar')]).toEqual([-1, 1])
    for (const locale of LOCALES) {
      expect([ratingKeyStep('ArrowUp', locale), ratingKeyStep('ArrowDown', locale), ratingKeyStep('Enter', locale), ratingKeyStep('a', locale)]).toEqual([1, -1, 0, 0])
      if (locale !== 'ar') expect(ratingKeyStep('ArrowRight', locale)).toBe(1)
    }
  })

  it('a key press moves the rating by one within 1..5 and nothing else is swallowed', () => {
    const press = (locale: Locale, value: number, key: string) => {
      const onChange = vi.fn()
      const prevented = vi.fn()
      const c = mount(() => WheatStalkRatingInteractive({ value, onChange, locale }))
      ;((findAll(c.tree(), (e) => e.props.role === 'radio') as El[])[0].props.onKeyDown as (e: unknown) => void)({ key, preventDefault: prevented })
      return { changed: onChange.mock.calls.map((x) => x[0]), prevented: prevented.mock.calls.length }
    }
    expect(press('en', 2, 'ArrowRight')).toEqual({ changed: [3], prevented: 1 })
    expect(press('ar', 2, 'ArrowLeft')).toEqual({ changed: [3], prevented: 1 })
    expect(press('ar', 2, 'ArrowRight')).toEqual({ changed: [1], prevented: 1 })
    expect(press('en', 5, 'ArrowRight')).toEqual({ changed: [5], prevented: 1 })
    expect(press('en', 1, 'ArrowLeft')).toEqual({ changed: [1], prevented: 1 })
    expect(press('en', 2, 'Tab')).toEqual({ changed: [], prevented: 0 })
  })

  it('the display is an image named by the rating, in the member language', () => {
    expect(renderToStaticMarkup(h(WheatStalkRatingDisplay, { value: 3, locale: 'so' }))).toMatch(/^<span data-testid="stalk-display-row" class="inline-flex items-center gap-0\.5" role="img" aria-label="3 ka mid ah 5 sabuul">/)
    expect(renderToStaticMarkup(h(WheatStalkRatingDisplay, { value: 3, locale: 'en' }))).toContain('aria-label="3 out of 5 stalks"')
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
