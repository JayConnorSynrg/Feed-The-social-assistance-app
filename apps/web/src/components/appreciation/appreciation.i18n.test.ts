// apps/web/src/components/appreciation/appreciation.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the author badges of a feed post card and the sheets they
// open in that language. The REAL components:
//   - the Harmony badge and the badge strip: translated, numbers in the locale's digits, and no
//     language mark of their own (they inherit the card's);
//   - the badge list and the "Gifts received" shelf: translated and carrying their own mark, since
//     they also mount in the English Settings panel; with no locale handed in they follow the
//     profile's language;
//   - the author sheet (a portal): its own lang and dir (Arabic: rtl), a translated close label,
//     the tier marker with the card's words, Follow with the card's words, both guest prompts;
//   - the appreciation picker: every item named by the word under it first (label in name, 14
//     locales), failures translated or marked English, the sent check at the inline end;
//   - a member's own name is shown as written, in its own element, and never looked up;
//   - sending still calls what it called.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state } = vi.hoisted(() => ({
  state: {
    language: 'en' as string,
    sent: { ok: true, items: [] as string[] } as { ok: true; items: string[] } | { ok: false; error: string },
    give: { ok: true, created: true, giftId: 'g1' } as { ok: true; created: boolean; giftId: string } | { ok: false; error: string },
    shelf: { ok: true, shelf: [] as unknown[] } as { ok: true; shelf: unknown[] } | { ok: false; error: string },
    gave: [] as unknown[][],
  },
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'me' }, isAnonymous: false, profile: { preferred_language: state.language } }) }))
// One client object for every render, as the real singleton is (the loaders depend on it).
vi.mock('@/lib/supabase/client', () => {
  const client = {}
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))
vi.mock('@/lib/appreciation', async (orig) => ({
  ...(await orig<object>()),
  listSentTo: async () => state.sent,
  giveAppreciation: async (...args: unknown[]) => {
    state.gave.push(args.slice(1))
    return state.give
  },
  myReceivedShelf: async () => state.shelf,
}))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { cardT, roleLabel } from '@/lib/i18n-feed-card'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { APPRECIATION_ITEM_SLUGS, appreciationItemAlt, appreciationItemLabel, appreciationItemName, badgesT } from '@/lib/i18n-feed-badges'
import { SheetContent, SheetTitle } from '@/components/ui/sheet'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { HarmonyBadge } from '@/components/feed/harmony-badge'
import { EngagementBadges } from '@/components/profile/engagement-badges'
import { PixelItemIcon } from './pixel-item-icon'
import { AuthorBadgeStrip } from './author-badge-strip'
import { AppreciatePicker, AppreciationSheet, type AppreciationAuthor } from './appreciation-sheet'
import { GiftsReceivedShelf, GiversLine } from './gifts-received-shelf'

const LOCALES = Object.keys(messages) as Locale[]
type El = { type: unknown; props: Record<string, unknown> }
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const code = (source: string) => source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** Every string in an element tree (child components are not rendered; their children still are). */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement(node) ? textOf((node as El).props.children) : ''
}
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
/** A string as it appears in rendered markup (the escape character first). */
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const ar = (n: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(['ar', 'en-US'], o).format(n)

const author = (o: Partial<AppreciationAuthor> = {}): AppreciationAuthor => ({ id: 'author', name: 'مريم', harmonyScore: 4.5, harmonyReviewsCount: 3, badgeSummary: { families: { food: { level: 2 } } }, authorTier: null, ...o })
function sheet(locale: Locale, o: Record<string, unknown> = {}) {
  const props = { open: true, onOpenChange: () => {}, author: author(), currentUserId: 'me', isGuest: false, isFollowing: false, onFollow: vi.fn(), onUnfollow: vi.fn(), postId: 'p1', locale, ...o }
  const c = mount(() => AppreciationSheet(props as Parameters<typeof AppreciationSheet>[0]))
  return { c, props, tree: () => c.tree() }
}

beforeEach(() => {
  state.language = 'en'
  state.sent = { ok: true, items: [] }
  state.give = { ok: true, created: true, giftId: 'g1' }
  state.shelf = { ok: true, shelf: [] }
  state.gave = []
})

describe('the Harmony badge', () => {
  const badge = (locale: Locale, o: Record<string, unknown> = {}) => renderToStaticMarkup(h(HarmonyBadge, { score: 4.5, count: 3, userId: 'u', locale, ...o }))

  it('vi: a new member reads "Mới"; no language mark of its own', () => {
    const out = badge('vi', { score: null, count: 0 })
    expect(out).toMatch(/^<span data-testid="harmony-badge-u" class="[^"]*"><span>Mới<\/span><\/span>$/)
    expect(out).not.toMatch(/\blang=|\bdir=/)
  })

  it('es: the rating is an image named in Spanish; score and count in Spanish digits', () => {
    const out = badge('es')
    expect(out).toContain('<span data-testid="harmony-badge-stalks-u-row" class="inline-flex items-center gap-0.5" role="img" aria-label="5 de 5 espigas">')
    expect(out).toContain('<span>4,50</span>')
    expect(out).toContain('>(3)</span>')
    expect(out).not.toMatch(/out of 5 stalks|4\.50/)
  })

  it('ar: Arabic name and the locale\'s digits; still no mark of its own', () => {
    const out = badge('ar', { score: 3.2, count: 12 })
    expect(out).toContain(`aria-label="${ar(3)} من ${ar(5)} سنابل"`)
    expect(out).toContain(`<span>${ar(3.2, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`)
    expect(out).toContain(`>(${ar(12)})</span>`)
    expect(out).not.toMatch(/\blang=|\bdir=/)
  })

  it('en: reads as before', () => {
    const out = badge('en')
    expect(out).toContain('aria-label="5 out of 5 stalks"')
    expect(out).toContain('<span>4.50</span>')
    expect(badge('en', { score: null, count: 0 })).toContain('<span>New</span>')
  })

  it.each(LOCALES)('%s: the word for a new member comes from the dictionary', (locale) => {
    expect(badge(locale, { score: null, count: 0 })).toContain(`<span>${html(badgesT(locale, 'harmonyNew'))}</span>`)
  })
})

describe('the author badge strip', () => {
  const strip = (locale: Locale) => renderToStaticMarkup(h(AuthorBadgeStrip, { summary: { families: { food: { level: 2 } }, badges: { helper: { level: 3 } } }, userId: 'u', locale }))

  it('fr: tooltip and screen-reader text in French; the roman numeral is for sighted readers only', () => {
    const out = strip('fr')
    expect(out).toMatch(/^<span class="inline-flex items-center gap-1" data-testid="author-badge-strip-u">/)
    expect(out).toContain('title="Entraide · niveau 3"')
    expect(out).toContain('<span class="text-[9px] font-semibold leading-none" aria-hidden="true">III</span><span class="sr-only">Badge communautaire Entraide, niveau 3</span>')
    expect(out).toMatch(/<span class="sr-only">Badge de catégorie [^<]+, niveau 2<\/span>/)
    expect(out).not.toMatch(/badge, level|· level/)
  })

  it('en: reads as before', () => {
    const out = strip('en')
    expect(out).toContain('title="Helper · level 3"')
    expect(out).toContain('<span class="sr-only">Helper community badge, level 3</span>')
    expect(out).toContain('<span class="sr-only">Food category badge, level 2</span>')
  })

  it.each(LOCALES)('%s: no language mark of its own, and no placeholder left', (locale) => {
    const out = strip(locale)
    expect(out).not.toMatch(/\blang=|\bdir=/)
    expect(out).not.toMatch(/\{\w+\}/)
  })

  it('no badges, no strip', () => {
    expect(renderToStaticMarkup(h(AuthorBadgeStrip, { summary: null, userId: 'u', locale: 'es' }))).toBe('')
  })
})

describe('the badge list (author sheet and Settings)', () => {
  const list = (o: Record<string, unknown>) => renderToStaticMarkup(h(EngagementBadges, { summary: { badges: { voice: { level: 1 } } }, displayName: 'مريم', ...o }))

  it('pt: heading, badge name, short level and the sentence a screen reader hears; its own mark', () => {
    const out = list({ locale: 'pt' })
    expect(out).toMatch(/^<div lang="pt" dir="ltr" class="space-y-4" data-testid="engagement-badges">/)
    expect(out).toContain('>Selos da comunidade</h2>')
    expect(out).toContain('<span class="text-sm font-medium text-stone-800" aria-hidden="true">Voz</span>')
    expect(out).toMatch(/aria-hidden="true">Nv\. I<\/span><span class="sr-only">Selo comunitário Voz, nível 1<\/span>/)
  })

  it('ar: rtl; with no badge the sentence reads around the member\'s own name, which keeps its own direction', () => {
    const out = list({ locale: 'ar', summary: null, displayName: 'Ada' })
    expect(out).toMatch(/^<div lang="ar" dir="rtl"/)
    expect(out).toContain('<span>لا توجد شارات بعد — يحصل <bdi lang="">Ada</bdi> على الشارات بالمساعدة والتواصل والمشاركة.</span>')
  })

  it('with no locale handed in (Settings) it follows the profile language', () => {
    state.language = 'ko'
    const out = list({})
    expect(out).toMatch(/^<div lang="ko" dir="ltr"/)
    expect(out).toContain('>커뮤니티 배지</h2>')
  })

  it('the owner\'s private section: translated, with the points in the sentence', () => {
    const out = list({ locale: 'es', isOwnProfile: true, privateSummary: { badges: { helper: { level: 2, count: 7 } } } })
    expect(out).toContain('>Privado: solo tú puedes verlo</h2>')
    expect(out).toContain('Reconocimiento por la ayuda que recibes y por lo que guardas y marcas. No se muestra a nadie más.')
    expect(out).toContain('<span class="sr-only">Insignia comunitaria Ayudante, nivel 2, 7 puntos ganados</span>')
  })

  it('a name that equals a badge key is shown as written', () => {
    expect(list({ locale: 'es', summary: null, displayName: 'helper' })).toContain('<bdi lang="">helper</bdi>')
  })

  it.each(LOCALES)('%s: no English copy is left', (locale) => {
    const out = list({ locale, isOwnProfile: true, privateSummary: { badges: { helper: { level: 2, count: 7 } } } }) + list({ locale, summary: null })
    if (locale !== 'en') expect(out).not.toMatch(/Community Badges|No badges yet|Private —|Credit for the help|badge, level|points earned|Lv /)
    expect(out).not.toMatch(/\{\w+\}/)
  })
})

describe('the author sheet (a portal)', () => {
  it('ar: the sheet carries lang="ar" dir="rtl" and a translated close label', () => {
    const content = (findAll(sheet('ar').tree(), (e) => e.type === SheetContent) as El[])[0]
    expect(content.props).toMatchObject({ lang: 'ar', dir: 'rtl', closeLabel: 'إغلاق' })
  })

  it.each(LOCALES)('%s: the close button is named in the member language', (locale) => {
    const content = (findAll(sheet(locale).tree(), (e) => e.type === SheetContent) as El[])[0]
    expect(content.props.lang).toBe(locale)
    expect(content.props.closeLabel).toBe(cardT(locale, 'close'))
    if (locale !== 'en') expect(content.props.closeLabel).not.toBe('Close')
  })

  it('the author\'s name is the title, as written: no page language, its own direction', () => {
    const title = (findAll(sheet('es').tree(), (e) => e.type === SheetTitle) as El[])[0]
    expect(title.props).toMatchObject({ lang: '', dir: 'auto', children: 'مريم' })
  })

  it('the badges inside get the sheet language', () => {
    const tree = sheet('so').tree()
    expect((findAll(tree, (e) => e.type === HarmonyBadge) as El[])[0].props.locale).toBe('so')
    expect((findAll(tree, (e) => e.type === EngagementBadges) as El[])[0].props).toMatchObject({ locale: 'so', displayName: 'مريم' })
  })

  it('the tier marker uses the card\'s words; a plain member has none', () => {
    expect(byTestId(sheet('es').tree(), 'author-sheet-tier')).toHaveLength(0)
    for (const tier of ['community_moderator', 'resource_admin', 'platform_admin'] as const) {
      expect(textOf(byTestId(sheet('es', { author: author({ authorTier: tier }) }).tree(), 'author-sheet-tier')[0])).toBe(roleLabel(tier, 'es'))
    }
    expect(textOf(byTestId(sheet('es', { author: author({ authorTier: 'platform_admin' }) }).tree(), 'author-sheet-tier')[0])).not.toBe('Admin\u0000')
  })

  it('vi: Follow / Following with the card\'s words; the heading reads around the name; Send appreciation', () => {
    const s = sheet('vi')
    expect(textOf(byTestId(s.tree(), 'sheet-follow-btn-author')[0])).toBe(cardT('vi', 'follow'))
    expect(textOf(byTestId(sheet('vi', { isFollowing: true }).tree(), 'sheet-follow-btn-author')[0])).toBe(cardT('vi', 'following'))
    const heading = (findAll(s.tree(), (e) => e.props.id === 'appreciate-heading') as El[])[0]
    expect(textOf(heading)).toBe('Cảm ơn مريم')
    expect((findAll(heading, (e) => e.type === 'bdi') as El[])[0].props).toMatchObject({ lang: '', children: 'مريم' })
    expect(textOf(byTestId(s.tree(), 'appreciate-open-picker')[0])).toBe('Gửi lời cảm ơn')
  })

  it('your own sheet says so, in the member language', () => {
    expect(textOf(sheet('fr', { currentUserId: 'author' }).tree())).toContain("C'est vous — les remerciements viennent de la communauté.")
  })

  it('a guest gets both prompts in the member language, with a translated link; the name is isolated, not looked up', () => {
    const s = sheet('es', { isGuest: true })
    const prompts = () => findAll(s.tree(), (e) => e.type === CreateAccountPrompt) as El[]
    expect(prompts()).toHaveLength(1)
    expect(prompts()[0].props).toEqual({ message: 'Crea una cuenta gratuita para enviar tu agradecimiento', linkLabel: feedChromeT('es', 'createAccount') })
    ;(byTestId(s.tree(), 'sheet-follow-btn-author')[0].props.onClick as () => void)()
    s.c.rerender()
    expect(prompts()).toHaveLength(2)
    expect(prompts()[0].props).toEqual({ message: 'Crea una cuenta gratuita para seguir a \u2068مريم\u2069', linkLabel: 'Crear cuenta gratuita' })
    expect(s.props.onFollow).not.toHaveBeenCalled()
  })

  it('Follow still calls the feed\'s handlers with the author id', () => {
    const s = sheet('ar')
    ;(byTestId(s.tree(), 'sheet-follow-btn-author')[0].props.onClick as () => void)()
    expect(s.props.onFollow).toHaveBeenCalledWith('author')
    const following = sheet('ar', { isFollowing: true })
    ;(byTestId(following.tree(), 'sheet-follow-btn-author')[0].props.onClick as () => void)()
    expect(following.props.onUnfollow).toHaveBeenCalledWith('author')
  })

  it.each(LOCALES)('%s: nothing the sheet itself writes is English', (locale) => {
    const text = textOf(sheet(locale).tree()) + textOf(sheet(locale, { currentUserId: 'author' }).tree())
    if (locale !== 'en') expect(text).not.toMatch(/Follow|Appreciate |Send appreciation|This is you/)
    expect(text).not.toMatch(/\{\w+\}/)
  })
})

describe('the appreciation picker', () => {
  async function picker(locale: Locale) {
    const c = mount(() => AppreciatePicker({ receiverId: 'author', currentUserId: 'me', postId: 'p1', locale }))
    const first = c.tree()
    await c.flush()
    return { c, first, tree: () => c.tree() }
  }

  it('while loading: a status line in the member language', async () => {
    const { first } = await picker('fr')
    const line = byTestId(first, 'appreciate-picker-loading')[0]
    expect(line.props.role).toBe('status')
    expect(textOf(line)).toBe('Chargement…')
  })

  it('ko: twelve items, each with its word, its icon title and a name that starts with the word', async () => {
    state.sent = { ok: true, items: ['heart'] }
    const { tree } = await picker('ko')
    const buttons = findAll(tree(), (e) => String(e.props['data-testid'] ?? '').startsWith('appreciate-item-')) as El[]
    expect(buttons).toHaveLength(12)
    const heart = byTestId(tree(), 'appreciate-item-heart')[0]
    expect(heart.props['aria-label']).toBe('하트 — 이미 보냄')
    expect(heart.props.disabled).toBe(true)
    const bread = byTestId(tree(), 'appreciate-item-bread')[0]
    expect(bread.props['aria-label']).toBe('빵 — 보내기')
    expect((findAll(bread, (e) => e.type === PixelItemIcon) as El[])[0].props.title).toBe('빵 한 덩이')
    expect(textOf(bread)).toBe('빵')
  })

  it.each(LOCALES)('%s: label in name for all twelve, sent and unsent', async (locale) => {
    state.sent = { ok: true, items: ['heart', 'tree'] }
    const { tree } = await picker(locale)
    for (const slug of APPRECIATION_ITEM_SLUGS) {
      const button = byTestId(tree(), `appreciate-item-${slug}`)[0]
      const visible = textOf(button)
      expect(visible, slug).toBe(appreciationItemLabel(slug, locale))
      expect(String(button.props['aria-label']).startsWith(visible), slug).toBe(true)
      expect(button.props['aria-label'], slug).toBe(appreciationItemName(slug, slug === 'heart' || slug === 'tree', locale))
      expect((findAll(button, (e) => e.type === PixelItemIcon) as El[])[0].props.title, slug).toBe(appreciationItemAlt(slug, locale))
    }
  })

  it('the sent check sits at the inline end', async () => {
    state.sent = { ok: true, items: ['heart'] }
    const { tree } = await picker('ar')
    const check = (findAll(byTestId(tree(), 'appreciate-item-heart')[0], (e) => e.type === 'span' && String(e.props.className).includes('rounded-full bg-lime-600')) as El[])[0]
    expect(check.props.className).toMatch(/\babsolute end-1 top-1\b/)
    expect(check.props.className).not.toMatch(/\bright-1\b/)
  })

  it('sending calls the library with the receiver, the slug and the post, and marks the item sent', async () => {
    const { c, tree } = await picker('es')
    ;(byTestId(tree(), 'appreciate-item-soup')[0].props.onClick as () => void)()
    await c.flush()
    expect(state.gave).toEqual([['author', 'soup', 'p1']])
    expect(byTestId(tree(), 'appreciate-item-soup')[0].props).toMatchObject({ 'data-sent': 'true', 'aria-label': 'Sopa: ya enviado' })
  })

  it('a failed send: the library\'s sentence in the member language, as an alert; the item is unsent again', async () => {
    state.give = { ok: false, error: "Couldn't send appreciation. Please try again." }
    const { c, tree } = await picker('es')
    ;(byTestId(tree(), 'appreciate-item-soup')[0].props.onClick as () => void)()
    await c.flush()
    const failure = (findAll(tree(), (e) => e.props.error !== undefined) as El[])[0]
    expect(failure.props).toMatchObject({ error: "Couldn't send appreciation. Please try again.", locale: 'es', alert: true, testId: 'appreciate-give-error' })
    const rendered = renderToStaticMarkup(h(failure.type as never, failure.props))
    expect(rendered).toBe('<p role="alert" class="mt-2 text-xs text-red-700" data-testid="appreciate-give-error">No se pudo enviar el agradecimiento. Inténtalo de nuevo.</p>')
    expect(byTestId(tree(), 'appreciate-item-soup')[0].props['data-sent']).toBe('false')
  })

  it('a failure FEED did not write is shown as received and marked English', async () => {
    state.give = { ok: false, error: 'Recipient not found' }
    const { c, tree } = await picker('es')
    ;(byTestId(tree(), 'appreciate-item-soup')[0].props.onClick as () => void)()
    await c.flush()
    const failure = (findAll(tree(), (e) => e.props.error !== undefined) as El[])[0]
    expect(renderToStaticMarkup(h(failure.type as never, failure.props))).toBe('<p role="alert" lang="en" dir="ltr" class="mt-2 text-xs text-red-700" data-testid="appreciate-give-error">Recipient not found</p>')
  })

  it('a failed load: the sentence and Retry in the member language', async () => {
    state.sent = { ok: false, error: 'Loading sent gifts timed out — please try again.' }
    const { tree } = await picker('pt')
    const box = byTestId(tree(), 'appreciate-picker-error')[0]
    const failure = (findAll(box, (e) => e.props.error !== undefined) as El[])[0]
    expect(renderToStaticMarkup(h(failure.type as never, failure.props))).toBe('<p role="alert" class="text-sm text-stone-600">O carregamento dos presentes enviados demorou demais. Tente novamente.</p>')
    expect(textOf(box)).toBe('Tentar novamente')
  })
})

describe('the "Gifts received" shelf (Settings)', () => {
  async function shelf(language: string) {
    state.language = language
    const c = mount(() => GiftsReceivedShelf({ userId: 'me' }))
    const first = c.tree()
    await c.flush()
    return { first, tree: c.tree() }
  }
  const entry = (slug: string, names: Array<string | null>) => ({ slug, label: 'x', count: names.length, givers: names.map((name, i) => ({ id: `g${i}`, name, avatar: null })) })
  const givers = (names: Array<string | null>, locale: Locale) => renderToStaticMarkup(h(GiversLine, { names, locale }))

  it('ht: its own mark (Settings is English), heading and loading line; then the empty sentence', async () => {
    const { first, tree } = await shelf('ht')
    const root = byTestId(first, 'gifts-received-shelf')[0]
    expect(root.props).toMatchObject({ lang: 'ht', dir: 'ltr' })
    expect(textOf(first)).toBe('Kado ou resevwaN ap chaje kado ou yo…')
    expect((findAll(first, (e) => e.props.role === 'status') as El[])).toHaveLength(1)
    expect(textOf(tree)).toBe('Kado ou resevwaPoko gen kado — remèsiman kominote a ap parèt isit la.')
  })

  it('ar: rtl; an item reads with its translated word and the count in the locale\'s digits', async () => {
    state.shelf = { ok: true, shelf: [entry('bread', ['Ada', 'Ben'])] }
    const { tree } = await shelf('ar')
    expect(byTestId(tree, 'gifts-received-shelf')[0].props).toMatchObject({ lang: 'ar', dir: 'rtl' })
    const item = byTestId(tree, 'gift-received-bread')[0]
    expect(textOf(item)).toContain(`خبز ×${ar(2)}`)
    expect((findAll(item, (e) => e.type === PixelItemIcon) as El[])[0].props.title).toBe('خبز')
    expect((findAll(item, (e) => e.type === GiversLine) as El[])[0].props).toEqual({ names: ['Ada', 'Ben'], locale: 'ar' })
  })

  it('who sent it: each name in its own element, as written; the sentence around them translated', () => {
    expect(givers(['Ada'], 'es')).toBe('de <bdi lang="">Ada</bdi>')
    expect(givers(['Ada', 'مريم'], 'es')).toBe('de <bdi lang="">Ada</bdi> y <bdi lang="">مريم</bdi>')
    expect(givers(['Ada', 'Ben', 'Cy'], 'en')).toBe('from <bdi lang="">Ada</bdi>, <bdi lang="">Ben</bdi> &amp; <bdi lang="">Cy</bdi>')
    expect(givers(['Ada', 'Ben', 'Cy', 'Di', 'Ed'], 'en')).toBe('from <bdi lang="">Ada</bdi>, <bdi lang="">Ben</bdi> &amp; 3 others')
    expect(givers(['Ada', 'Ben', 'Cy', 'Di'], 'ko')).toBe('<bdi lang="">Ada</bdi>, <bdi lang="">Ben</bdi> 님 외 2명이 보냄')
    expect(givers([], 'fr')).toBe('de la communauté')
  })

  it('a giver with no name reads "Someone" in the member language, as FEED text', () => {
    expect(givers([null], 'es')).toBe('de <span>Alguien</span>')
    expect(givers(['Ada', null], 'vi')).toBe('từ <bdi lang="">Ada</bdi> và <span>Ai đó</span>')
  })

  it('a member really named "Someone", or named like a key, is shown as written', () => {
    expect(givers(['Someone'], 'es')).toBe('de <bdi lang="">Someone</bdi>')
    expect(givers(['someone', 'heart'], 'es')).toBe('de <bdi lang="">someone</bdi> y <bdi lang="">heart</bdi>')
  })

  it('a failed read: the library\'s sentence and Retry in the member language; other text marked English', async () => {
    state.shelf = { ok: false, error: "Couldn't load your gifts." }
    const failed = (await shelf('ru')).tree
    const line = byTestId(failed, 'gifts-received-error')[0]
    expect(line.props).toMatchObject({ role: 'alert', lang: undefined, dir: undefined })
    expect(textOf(line)).toBe('Не удалось загрузить ваши подарки.')
    expect(textOf(failed)).toContain('Повторить')
    state.shelf = { ok: false, error: 'permission denied for table appreciation_gifts' }
    const other = byTestId((await shelf('ru')).tree, 'gifts-received-error')[0]
    expect(other.props).toMatchObject({ lang: 'en', dir: 'ltr' })
    expect(textOf(other)).toBe('permission denied for table appreciation_gifts')
  })

  it.each(LOCALES)('%s: every sentence about givers is filled, for 0 to 6 givers', (locale) => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F']
    for (let n = 0; n <= 6; n++) {
      const out = givers(names.slice(0, n), locale)
      expect(out, `${locale} ${n}`).not.toMatch(/\{\w+\}/)
      expect((out.match(/<bdi/g) ?? []).length, `${locale} ${n}`).toBe(n <= 3 ? n : 2)
    }
  })
})

describe('sources', () => {
  it('no English copy is left in the badge and sheet components', () => {
    const files: Array<[string, string[]]> = [
      ['../feed/harmony-badge.tsx', ['>New<', 'toFixed', 'lang="en"']],
      ['./author-badge-strip.tsx', ['· level', 'badge, level', "'category'", 'lang="en"']],
      ['../profile/engagement-badges.tsx', ['Community Badges', 'No badges yet', 'Private —', 'Credit for the help', 'points earned', 'Lv {', '{badge.label}']],
      ['./appreciation-sheet.tsx', ['Loading…', '>Retry<', 'already sent', '`Send ', "'Following'", "'Follow'", 'Create a free account', 'Appreciate {', 'This is you', 'Send appreciation', '{item.label}', '{item.alt}', 'tierLabel', '>{loadError}<', '          {giveError}\n', 'right-1', 'mr-1.5']],
      ['./gifts-received-shelf.tsx', ['Gifts received', 'Loading your gifts', 'No gifts yet', '{entry.label}', 'from {', "'the community'", ' others', '{error}']],
      ['../ui/wheat-stalk-rating.tsx', ['Wheat stalk rating', 'out of 5 stalks', ' stalk$']],
    ]
    for (const [rel, literals] of files) {
      const src = code(read(rel))
      for (const literal of literals) expect(src, `${rel}: ${literal}`).not.toContain(literal)
    }
  })

  it('no translation reader is given a member\'s own name', () => {
    const READERS = 'badgesT|cardT|feedChromeT|roleLabel|badgeLabel|appreciationItemLabel|appreciationItemAlt|appreciationErrorText|giftsFromMessage'
    const MEMBER_TEXT = 'author\\.name|displayName|g\\.name|name\\b(?!:)'
    for (const rel of ['./appreciation-sheet.tsx', './gifts-received-shelf.tsx', '../profile/engagement-badges.tsx']) {
      expect(code(read(rel)), rel).not.toMatch(new RegExp(`\\b(${READERS})\\([^()]*\\b(${MEMBER_TEXT})`))
    }
    // The one place a name meets a dictionary value: as a variable of formatMessage, isolated.
    expect(code(read('./appreciation-sheet.tsx'))).toContain("formatMessage(badgesT(locale, 'guestFollowPrompt'), { name: isolate(author.name) })")
  })

  it('the library hands a nameless giver on as null, not as an English word', () => {
    const lib = code(read('../../lib/appreciation.ts'))
    expect(lib).toContain('name: row.giver?.first_name || null,')
    expect(lib).not.toContain("'Someone'")
  })
})
