// apps/web/src/components/feed/feed-post-card.optins.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the sign-up ("opt-in") controls and the petition embed of
// a feed post card in that language. The REAL card:
//   - the capacity line, Opt In / Opted In / Withdraw / Full, the author's toggle and list with
//     its status badge, marker and row buttons, the review buttons;
//   - the petition embed with the Petitions sub-tab's own words and the locale's digits;
//   - none of them carries an English mark any more; a status or a failure FEED has no sentence
//     for is shown as stored and marked English;
//   - each row button's accessible name starts with its visible text and names the person, in 14
//     locales; the petition button's name starts with its text and names the petition;
//   - a member's own words (a name, a petition title) are never handed to a translation reader;
//   - the buttons still call the handlers they called before.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('motion/react', () => ({ useReducedMotion: () => false, m: new Proxy({}, { get: () => 'div' }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', async (orig) => ({ ...(await orig<object>()), useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null, isAuthenticated: true }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: (_o: string, _a: unknown, fn: () => unknown) => fn() }))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { optInActionName, optInsT, optInStatusLabel, OPT_IN_STATUSES } from '@/lib/i18n-feed-optins'
import { petitionActionName, petitionsT } from '@/lib/i18n-feed-petitions'
import { AppreciationSheet } from '@/components/appreciation/appreciation-sheet'
import { isolate } from '@/lib/format-message'
import { FeedPostCard, type EnrichedOptIn, type FeedPostCardProps } from './feed-post-card'
import { rowToPost, type FeedPostRow } from './post-model'

const LOCALES = Object.keys(messages) as Locale[]
type El = { type: unknown; props: Record<string, unknown> }
const noop = () => {}

function row(o: Partial<FeedPostRow> = {}): FeedPostRow {
  return {
    id: 'p1', content: 'Free bread', created_at: '2026-10-01T12:00:00.000Z', is_pinned: false, is_hidden: false, image_url: null,
    max_seekers: 5, slots_remaining: 2, post_type: 'feed', petition_id: null, resource_id: null, metadata: null, like_count: 0, comment_count: 0,
    version: 1, edited_at: null, edit_count: 0, image_alt: null, hidden_reason: null,
    user: { id: 'author', first_name: 'Ada', avatar_url: null, admin_tier: null, harmony_score: null, harmony_reviews_count: 0, badge_summary: null },
    resource: null,
    ...o,
  }
}
function props(locale: Locale, o: Partial<FeedPostCardProps> = {}, r: Partial<FeedPostRow> = {}): FeedPostCardProps {
  return {
    post: rowToPost(row(r), { isLiked: false }), locale, formatAge: () => 'x', viewer: { id: 'member', isGuest: false, tier: null }, currentUserId: 'member', optInStatus: undefined,
    onLike: noop, onComment: noop, onShare: noop, onEmbed: noop, onOptIn: noop, onWithdraw: noop, onAction: noop, ...o,
  }
}
/** The card as a member (not the author) sees it, as markup. */
const card = (locale: Locale, o: Partial<FeedPostCardProps> = {}, r: Partial<FeedPostRow> = {}) => renderToStaticMarkup(h(FeedPostCard, props(locale, o, r)))
const optIn = (o: Partial<EnrichedOptIn> = {}): EnrichedOptIn => ({ id: 'o1', postId: 'p1', seekerId: 's1', seekerName: 'مريم', seekerHarmonyScore: null, seekerHarmonyCount: 0, status: 'pending', ...o })
/** The card as its author sees it, with the opt-in list opened: an element tree. */
function authorTree(locale: Locale, optIns: EnrichedOptIn[], o: Partial<FeedPostCardProps> = {}) {
  const p = props(locale, { currentUserId: 'author', viewer: { id: 'author', isGuest: false, tier: null }, optInCount: optIns.length, authorOptIns: optIns, ...o })
  const c = mount(() => FeedPostCard(p))
  ;(findAll(c.tree(), (e) => e.props['data-testid'] === 'opt-in-manage-p1')[0].props.onClick as () => void)()
  return c.rerender()
}
/** Every string in an element tree (child components are not rendered; their children still are). */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement(node) ? textOf((node as El).props.children) : ''
}
/** A string as it appears in rendered markup (the escape character first). */
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
const petition = { title: 'أنقذوا الحديقة', summary: 'ملخص', signatureCount: 1234, targetSignatures: 5000, hasSigned: false, isSigning: false }
const petitionRow = { post_type: 'petition', petition_id: 'pt1', max_seekers: null, slots_remaining: null } as const

describe('the sign-up controls in the member language', () => {
  it('vi: the capacity line and the Opt In button, with no English mark', () => {
    const out = card('vi')
    expect(out).toContain('<div data-testid="capacity-row-p1" class="mb-3 flex flex-wrap items-center gap-3"><span data-testid="capacity-p1" class="text-xs text-stone-600">Còn 2 trên 5 chỗ</span>')
    expect(out).toMatch(/<button type="button" data-testid="opt-in-btn-p1"[^>]*>Đăng ký<\/button>/)
    expect(out).not.toMatch(/spots? left|>Opt In</)
  })

  it('es: opted in with a pending request shows the state and Withdraw; once accepted, no Withdraw', () => {
    const pending = card('es', { optInStatus: 'pending' })
    expect(pending).toMatch(/<\/svg> Te apuntaste<\/span>/)
    expect(pending).toMatch(/<button type="button" data-testid="withdraw-btn-p1"[^>]*>Retirarme<\/button>/)
    const accepted = card('es', { optInStatus: 'accepted' })
    expect(accepted).toContain('Te apuntaste')
    expect(accepted).not.toContain('withdraw-btn-p1')
  })

  it('fr: a full offer shows the disabled Full button and the singular or plural of the limit', () => {
    const out = card('fr', {}, { max_seekers: 1, slots_remaining: 0 })
    expect(out).toContain('>0 sur 1 place disponible</span>')
    expect(out).toMatch(/<button type="button" disabled="" class="cursor-not-allowed[^"]*">Complet<\/button>/)
  })

  it('ko: the review button for the person who asked, once the exchange is completed', () => {
    const out = card('ko', { optInStatus: 'completed', currentUserOptInId: 'o1', seekerHasReviewed: false })
    expect(out).toMatch(/<div class="mb-3"><button type="button" data-testid="review-sourcer-p1"[^>]*><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>제공자 평가<\/button><\/div>/)
  })

  it('ar: Arabic copy and digits; direction comes from the feed root, the card adds no mark', () => {
    const out = card('ar', { optInStatus: 'pending' })
    const ar = (n: number) => new Intl.NumberFormat(['ar', 'en-US']).format(n)
    expect(out).toContain(`>${ar(2)} من ${ar(5)} أماكن متاحة</span>`)
    expect(out).toContain('تم تسجيلك')
    expect(out).toContain('>انسحاب</button>')
    expect(out).not.toMatch(/\blang="en"/)
  })

  it.each(LOCALES)('%s: every state of the member\'s controls reads from the dictionary', (locale) => {
    expect(card(locale)).toContain(`>${html(optInsT(locale, 'optIn'))}</button>`)
    expect(card(locale, { optInStatus: 'pending' })).toContain(`>${html(optInsT(locale, 'withdraw'))}</button>`)
    expect(card(locale, { optInStatus: 'pending' })).toContain(`</svg> ${html(optInsT(locale, 'optedIn'))}</span>`)
    expect(card(locale, {}, { slots_remaining: 0 })).toContain(`>${html(optInsT(locale, 'full'))}</button>`)
    expect(card(locale, { optInStatus: 'completed', currentUserOptInId: 'o1' })).toContain(`${html(optInsT(locale, 'reviewSourcer'))}</button>`)
  })
})

describe("the author's list in the member language", () => {
  it('pt: the toggle counts the people, the status is a label, the row buttons are translated', () => {
    const tree = authorTree('pt', [optIn(), optIn({ id: 'o2', seekerId: 's2', seekerName: 'Ben', status: 'accepted' })])
    expect(textOf(byTestId(tree, 'opt-in-manage-p1')[0])).toBe('2 pessoas inscritas')
    expect(textOf(byTestId(tree, 'opt-in-status-o1')[0])).toBe('pendente')
    expect(textOf(byTestId(tree, 'opt-in-status-o2')[0])).toBe('aceita')
    expect(textOf(byTestId(tree, 'accept-optin-o1')[0])).toBe('Aceitar')
    expect(textOf(byTestId(tree, 'decline-optin-o1')[0])).toBe('Recusar')
    expect(textOf(byTestId(tree, 'complete-optin-o2')[0])).toBe('Marcar como concluída')
    expect(textOf(byTestId(tree, 'opt-in-list-p1')[0])).not.toMatch(/pending|accepted|Accept|Decline|Mark Completed/)
  })

  it('so: a declined person shows Unblock and the "declined before" marker with its tooltip; a completed one the review button', () => {
    const tree = authorTree('so', [optIn({ status: 'declined' }), optIn({ id: 'o2', seekerId: 's2', status: 'completed' })], { authorDeclinedSeekerIds: new Set(['s1']) })
    expect(textOf(byTestId(tree, 'unblock-optin-o1')[0])).toBe('Ka qaad xannibaadda — mar kale ayuu codsan karaa')
    const marker = byTestId(tree, 'declined-before-marker-s1')[0]
    expect(textOf(marker)).toBe('Hore loo diiday')
    expect(marker.props.title).toBe('Qofkan hore ayaad u diiday')
    expect(textOf(byTestId(tree, 'review-seeker-o2')[0])).toBe('Qiimee codsadaha')
    expect(textOf(byTestId(tree, 'opt-in-status-o2')[0])).toBe('la dhammeeyay')
  })

  it('the list, the capacity row and the review block carry no language mark', () => {
    const tree = authorTree('ar', [optIn()])
    for (const id of ['opt-in-list-p1', 'capacity-row-p1']) {
      const el = byTestId(tree, id)[0]
      expect('lang' in el.props || 'dir' in el.props, id).toBe(false)
    }
    expect(byTestId(tree, 'opt-in-status-o1')[0].props.lang).toBeUndefined()
  })

  it('a stored status FEED has no label for is shown as stored and marked English', () => {
    const status = byTestId(authorTree('es', [optIn({ status: 'waitlisted' })]), 'opt-in-status-o1')[0]
    expect(textOf(status)).toBe('waitlisted')
    expect(status.props.lang).toBe('en')
  })

  it.each(LOCALES)('%s: the four statuses are four labels on the card', (locale) => {
    const tree = authorTree(locale, OPT_IN_STATUSES.map((status, i) => optIn({ id: `o${i}`, seekerId: `s${i}`, status })))
    expect(OPT_IN_STATUSES.map((_, i) => textOf(byTestId(tree, `opt-in-status-o${i}`)[0]))).toEqual(OPT_IN_STATUSES.map((s) => optInStatusLabel(s, locale)))
  })
})

describe('accessible names (label in name)', () => {
  it.each(LOCALES)('%s: each row button is named by its visible text, then the person', (locale) => {
    const tree = authorTree(locale, [optIn(), optIn({ id: 'o2', seekerId: 's2', seekerName: 'Ben', status: 'accepted' }), optIn({ id: 'o3', seekerId: 's3', seekerName: 'Cy', status: 'declined' }), optIn({ id: 'o4', seekerId: 's4', seekerName: 'Di', status: 'completed' })])
    const cases = [['accept-optin-o1', 'accept', 'مريم'], ['decline-optin-o1', 'decline', 'مريم'], ['complete-optin-o2', 'markCompleted', 'Ben'], ['unblock-optin-o3', 'unblock', 'Cy'], ['review-seeker-o4', 'reviewSeeker', 'Di']] as const
    for (const [id, action, name] of cases) {
      const button = byTestId(tree, id)[0]
      const visible = textOf(button)
      expect(visible, id).toBe(optInsT(locale, action))
      expect(String(button.props['aria-label']).startsWith(visible), id).toBe(true)
      expect(button.props['aria-label'], id).toBe(optInActionName(locale, action, name))
      expect(String(button.props['aria-label']), id).toContain(name)
    }
  })

  it('two people get two different names for the same action', () => {
    const tree = authorTree('en', [optIn({ seekerName: 'Ada' }), optIn({ id: 'o2', seekerId: 's2', seekerName: 'Ben' })])
    expect(byTestId(tree, 'accept-optin-o1')[0].props['aria-label']).toBe('Accept: \u2068Ada\u2069')
    expect(byTestId(tree, 'accept-optin-o2')[0].props['aria-label']).toBe('Accept: \u2068Ben\u2069')
  })

  it.each(LOCALES)('%s: buttons whose text says it all have no separate name (Opt In, Withdraw, the toggle, Review sourcer)', (locale) => {
    for (const out of [card(locale), card(locale, { optInStatus: 'pending' }), card(locale, { optInStatus: 'completed', currentUserOptInId: 'o1' })]) {
      for (const tag of out.match(/<button[^>]*data-testid="(?:opt-in-btn|withdraw-btn|review-sourcer)-p1"[^>]*>/g) ?? []) expect(tag).not.toContain('aria-label')
    }
    const toggle = byTestId(authorTree(locale, [optIn()]), 'opt-in-manage-p1')[0]
    expect('aria-label' in toggle.props).toBe(false)
    expect(toggle.props['aria-expanded']).toBe(true)
  })
})

describe('the author sheet opens from the card and gets its opener back', () => {
  it.each(['author-open-author', 'author-name-author'])('opened from %s: the sheet is handed that control; when it is gone, focus goes to the card', (testId) => {
    const p = props('es')
    const c = mount(() => FeedPostCard(p))
    const opener = { isConnected: true, focus: vi.fn() }
    const article = { focus: vi.fn() }
    ;((findAll(c.tree(), (e) => e.type === 'article') as El[])[0].props.ref as { current: unknown }).current = article
    ;(byTestId(c.tree(), testId)[0].props.onClick as (e: unknown) => void)({ currentTarget: opener })
    const sheet = (findAll(c.rerender(), (e) => e.type === AppreciationSheet) as El[])[0]
    expect(sheet.props.open).toBe(true)
    expect((sheet.props.returnFocusRef as { current: unknown }).current).toBe(opener)
    ;(sheet.props.fallbackFocus as () => void)()
    expect(article.focus).toHaveBeenCalledTimes(1)
  })

  it('a guest\'s Follow button opens the sheet too, and is its opener', () => {
    const p = props('es', { currentUserIsGuest: true, viewer: { id: 'member', isGuest: true, tier: null }, onFollow: vi.fn(), onUnfollow: vi.fn() })
    const c = mount(() => FeedPostCard(p))
    const opener = { isConnected: true, focus: vi.fn() }
    ;(byTestId(c.tree(), 'follow-btn-author')[0].props.onClick as (e: unknown) => void)({ currentTarget: opener })
    const sheet = (findAll(c.rerender(), (e) => e.type === AppreciationSheet) as El[])[0]
    expect(sheet.props.open).toBe(true)
    expect((sheet.props.returnFocusRef as { current: unknown }).current).toBe(opener)
    // A guest's tap opens the prompt and sends nothing.
    expect(p.onFollow).not.toHaveBeenCalled()
    expect(p.onUnfollow).not.toHaveBeenCalled()
  })
})

describe('the rows of the author\'s list', () => {
  it('each row is findable by its id, and each row button is tall enough to press (py-1.5)', () => {
    const tree = authorTree('en', [optIn(), optIn({ id: 'o2', seekerId: 's2', status: 'accepted' }), optIn({ id: 'o3', seekerId: 's3', status: 'declined' }), optIn({ id: 'o4', seekerId: 's4', status: 'completed' })])
    expect((findAll(tree, (e) => typeof e.props['data-opt-in-row'] === 'string') as El[]).map((r) => r.props['data-opt-in-row'])).toEqual(['o1', 'o2', 'o3', 'o4'])
    const buttons = ['accept-optin-o1', 'decline-optin-o1', 'complete-optin-o2', 'unblock-optin-o3', 'review-seeker-o4'].map((id) => byTestId(tree, id)[0])
    for (const b of buttons) {
      expect(String(b.props.className).split(' ')).toContain('py-1.5')
      expect(String(b.props.className).split(' ')).not.toContain('py-0.5')
    }
    // The row that holds a button is the row with that id.
    const row = (findAll(tree, (e) => e.props['data-opt-in-row'] === 'o2') as El[])[0]
    expect(byTestId(row, 'complete-optin-o2')).toHaveLength(1)
  })

  describe('a row whose action is under way', () => {
    const rows = [optIn(), optIn({ id: 'o2', seekerId: 's2', status: 'accepted' }), optIn({ id: 'o3', seekerId: 's3', status: 'declined' })]
    const WRITES = ['accept-optin-o1', 'decline-optin-o1', 'complete-optin-o2', 'unblock-optin-o3']

    it('is marked busy; its action buttons say they are unavailable but stay focusable (aria-disabled, never disabled); other rows are untouched', () => {
      const tree = authorTree('es', rows, { busyOptInIds: new Set(['o1']) })
      const row = (id: string) => (findAll(tree, (e) => e.props['data-opt-in-row'] === id) as El[])[0]
      expect(row('o1').props['aria-busy']).toBe(true)
      expect(row('o2').props['aria-busy']).toBeUndefined()
      for (const id of ['accept-optin-o1', 'decline-optin-o1']) {
        const b = byTestId(tree, id)[0]
        expect(b.props['aria-disabled'], id).toBe(true)
        expect(b.props.disabled, id).toBeUndefined()
        expect(b.props.tabIndex, id).toBeUndefined()
        expect(String(b.props.className), id).toContain('aria-disabled:opacity-60')
        // Its name is what it was: the action, then the person.
        expect(String(b.props['aria-label']), id).toContain(isolate('مريم'))
      }
      for (const id of ['complete-optin-o2', 'unblock-optin-o3']) expect(byTestId(tree, id)[0].props['aria-disabled'], id).toBeUndefined()
    })

    it('a press on a busy row\'s button calls nothing; the same press on a free row calls its handler once', () => {
      const onAuthorUpdateOptIn = vi.fn()
      const onAuthorUnblockOptIn = vi.fn()
      const press = (tree: unknown, id: string) => (byTestId(tree, id)[0].props.onClick as () => void)()
      const busyTree = authorTree('en', rows, { busyOptInIds: new Set(['o1', 'o2', 'o3']), onAuthorUpdateOptIn, onAuthorUnblockOptIn })
      for (const id of WRITES) press(busyTree, id)
      expect(onAuthorUpdateOptIn).not.toHaveBeenCalled()
      expect(onAuthorUnblockOptIn).not.toHaveBeenCalled()
      const freeTree = authorTree('en', rows, { busyOptInIds: new Set(), onAuthorUpdateOptIn, onAuthorUnblockOptIn })
      for (const id of WRITES) press(freeTree, id)
      expect(onAuthorUpdateOptIn.mock.calls).toEqual([['o1', 'accepted'], ['o1', 'declined'], ['o2', 'completed']])
      expect(onAuthorUnblockOptIn.mock.calls).toEqual([['o3']])
    })
  })
})

describe('member-written text', () => {
  it("a person's name keeps its own direction and takes no page language", () => {
    const name = findAll(authorTree('es', [optIn()]), (e) => e.props['data-member-text'] === 'seeker-name')[0] as El
    expect(name.props).toMatchObject({ lang: '', dir: 'auto', children: 'مريم' })
  })

  it('is never handed to a translation reader: a name that equals a status, a button word or a failure sentence is shown as written', () => {
    for (const written of ['pending', 'Decline', 'This offer is full', 'accept']) {
      const tree = authorTree('es', [optIn({ seekerName: written })])
      const name = findAll(tree, (e) => e.props['data-member-text'] === 'seeker-name')[0] as El
      expect(name.props.children).toBe(written)
      expect(byTestId(tree, 'accept-optin-o1')[0].props['aria-label']).toBe(`Aceptar: \u2068${written}\u2069`)
    }
  })

  it('source: no reader is given a name, a title or a summary', () => {
    const src = readFileSync(fileURLToPath(new URL('./feed-post-card.tsx', import.meta.url)), 'utf8')
    const READERS = 'cardT|optInsT|petitionsT|optInStatusLabel|optInErrorText|badgesT|roleLabel|categoryChipLabel|resourceCategoryLabel'
    const MEMBER_TEXT = 'oi\\.seekerName|authorName|post\\.content|petitionEmbed\\.title|petitionEmbed\\.summary|post\\.resourceName'
    expect(src).not.toMatch(new RegExp(`\\b(${READERS})\\([^()]*\\b(${MEMBER_TEXT})\\b`))
  })
})

describe('the opt-in failure line', () => {
  it('a sentence the handlers or the hook wrote reads in the member language, unmarked', () => {
    expect(card('zh', { optInError: "Couldn't opt in. Please try again." })).toContain('<div role="alert" data-testid="opt-in-error-p1" class="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">无法报名。请重试。</div>')
    expect(card('es', { optInError: 'Create a free account to opt in.' })).toContain('>Crea una cuenta gratuita para apuntarte.</div>')
  })

  it('"This offer is full" — the function\'s own refusal — reaches the member in their language', () => {
    expect(card('en', { optInError: 'This offer is full' })).toContain('>This offer is full</div>')
    expect(card('ht', { optInError: 'This offer is full' })).toContain('>Òf sa a plen</div>')
    expect(card('ru', { optInError: 'You cannot opt in to your own post' })).toContain('>Нельзя записаться на собственную публикацию</div>')
  })

  it('anything else is shown as received and marked English', () => {
    expect(card('zh', { optInError: 'canceling statement due to statement timeout' })).toContain(
      '<div role="alert" lang="en" dir="ltr" data-testid="opt-in-error-p1" class="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">canceling statement due to statement timeout</div>',
    )
  })

  it('no failure, no line', () => {
    expect(card('zh', { optInError: null })).not.toContain('opt-in-error-p1')
  })

  it.each(LOCALES)('%s: the failure line is an alert (nothing else tells a screen-reader user the opt-in did not go through)', (locale) => {
    for (const error of ['Create a free account to opt in.', 'This offer is full', 'some server text']) {
      const line = card(locale, { optInError: error }).match(/<div[^>]*data-testid="opt-in-error-p1"[^>]*>/)?.[0] ?? ''
      expect(line, error).toContain('role="alert"')
    }
    // The Opt In button is still there: focus stays on it.
    expect(card(locale, { optInError: 'This offer is full' })).toContain('data-testid="opt-in-btn-p1"')
  })
})

describe('the petition embed in the member language', () => {
  it('es: label, count line with the locale\'s grouping around a bold count, and the sign button', () => {
    const out = card('es', { petitionEmbed: petition }, petitionRow)
    expect(out).toMatch(/<div data-testid="petition-embed-p1" class="mb-3 flex flex-col gap-2 /)
    expect(out).toContain('<span class="text-xs font-semibold uppercase tracking-wide text-lime-800 rtl:tracking-normal">Petición</span>')
    const grouped = (n: number) => new Intl.NumberFormat(['es', 'en-US']).format(n)
    expect(out).toContain(`<div class="text-xs text-stone-600" data-testid="petition-count-p1"><span class="font-semibold text-stone-800">${grouped(1234)}</span> de ${grouped(5000)} firmas</div>`)
    expect(out).toMatch(/data-testid="petition-sign-btn-p1"[^>]*>Añade tu firma verificada de apoyo<\/button>/)
    expect(out).not.toMatch(/>Petition<| of 5,000 signatures|Add your verified signature/)
  })

  it('en: reads exactly as before', () => {
    const out = card('en', { petitionEmbed: petition }, petitionRow)
    expect(out).toContain('>Petition</span>')
    expect(out).toContain('<span class="font-semibold text-stone-800">1,234</span> of 5,000 signatures</div>')
    expect(out).toContain('Add your verified signature of support</button>')
    expect(card('en', { petitionEmbed: { ...petition, hasSigned: true } }, petitionRow)).toMatch(/<\/svg>Signed<\/div>/)
  })

  it('with no target the embed shows the bare count, as before', () => {
    const out = card('fr', { petitionEmbed: { ...petition, targetSignatures: 0, signatureCount: 7 } }, petitionRow)
    expect(out).toContain('<div class="text-xs text-stone-600" data-testid="petition-count-p1"><span class="font-semibold text-stone-800">7</span></div>')
  })

  it('hmn: signed', () => {
    expect(card('hmn', { petitionEmbed: { ...petition, hasSigned: true } }, petitionRow)).toContain(`</svg>${html(petitionsT('hmn', 'signed'))}</div>`)
  })

  it('the embed carries no English mark; the title and summary are the organiser\'s own text', () => {
    const out = card('vi', { petitionEmbed: petition }, petitionRow)
    const embed = out.slice(out.indexOf('data-testid="petition-embed-p1"'), out.indexOf('data-testid="like-btn-p1"'))
    expect(embed).not.toContain('lang="en"')
    expect(embed).toContain('<p class="line-clamp-2 text-sm font-semibold leading-snug text-stone-900" lang="" dir="auto" data-member-text="petition-title">أنقذوا الحديقة</p>')
    expect(embed).toContain('lang="" dir="auto" data-member-text="petition-summary">ملخص</p>')
  })

  it('a title or a summary that equals a status or a button word is shown as written', () => {
    const out = card('es', { petitionEmbed: { ...petition, title: 'pending', summary: 'accepted' } }, petitionRow)
    expect(out).toContain('data-member-text="petition-title">pending</p>')
    expect(out).toContain('data-member-text="petition-summary">accepted</p>')
  })

  it.each(LOCALES)('%s: the sign button is named by its visible text, then the petition (label in name)', (locale) => {
    const out = card(locale, { petitionEmbed: petition }, petitionRow)
    const button = out.match(/<button[^>]*data-testid="petition-sign-btn-p1"[^>]*>(.*?)<\/button>/)
    expect(button).not.toBeNull()
    const visible = petitionsT(locale, 'sign')
    expect(button![1]).toBe(html(visible))
    const name = petitionActionName(locale, 'sign', petition.title)
    expect(name.startsWith(visible)).toBe(true)
    expect(name).toContain(petition.title)
    expect(button![0]).toContain(`aria-label="${html(name)}"`)
  })

  it.each(LOCALES)('%s: the label is the petition word of that language', (locale) => {
    const label = petitionsT(locale, 'embedLabel')
    expect(card(locale, { petitionEmbed: petition }, petitionRow)).toContain(`rtl:tracking-normal">${html(label)}</span>`)
    if (locale !== 'en') expect(label).not.toBe('Petition')
  })
})

describe('the buttons still call what they called', () => {
  it('Opt In and Withdraw call the panel\'s handlers with the post id', () => {
    const onOptIn = vi.fn()
    const onWithdraw = vi.fn()
    const asMember = mount(() => FeedPostCard(props('es', { onOptIn, onWithdraw })))
    ;(byTestId(asMember.tree(), 'opt-in-btn-p1')[0].props.onClick as () => void)()
    expect(onOptIn).toHaveBeenCalledWith('p1')
    const pending = mount(() => FeedPostCard(props('es', { onOptIn, onWithdraw, optInStatus: 'pending' })))
    ;(byTestId(pending.tree(), 'withdraw-btn-p1')[0].props.onClick as () => void)()
    expect(onWithdraw).toHaveBeenCalledWith('p1')
  })

  it('the row buttons call the author handlers with the opt-in id and the same status codes', () => {
    const onAuthorUpdateOptIn = vi.fn()
    const onAuthorUnblockOptIn = vi.fn()
    const onAuthorReviewSeeker = vi.fn()
    const tree = authorTree('ar', [optIn(), optIn({ id: 'o2', seekerId: 's2', status: 'accepted' }), optIn({ id: 'o3', seekerId: 's3', status: 'declined' }), optIn({ id: 'o4', seekerId: 's4', seekerName: 'Di', status: 'completed' })], { onAuthorUpdateOptIn, onAuthorUnblockOptIn, onAuthorReviewSeeker })
    const click = (id: string) => (byTestId(tree, id)[0].props.onClick as () => void)()
    click('accept-optin-o1')
    click('decline-optin-o1')
    click('complete-optin-o2')
    expect(onAuthorUpdateOptIn.mock.calls).toEqual([['o1', 'accepted'], ['o1', 'declined'], ['o2', 'completed']])
    click('unblock-optin-o3')
    expect(onAuthorUnblockOptIn).toHaveBeenCalledWith('o3')
    click('review-seeker-o4')
    expect(onAuthorReviewSeeker).toHaveBeenCalledWith('o4', 'Di')
  })

  it('the petition button signs that petition', () => {
    const onSignPetition = vi.fn()
    const c = mount(() => FeedPostCard(props('es', { petitionEmbed: petition, onSignPetition }, petitionRow)))
    ;(byTestId(c.tree(), 'petition-sign-btn-p1')[0].props.onClick as () => void)()
    expect(onSignPetition).toHaveBeenCalledWith('pt1')
  })
})

describe('feed-post-card.tsx source', () => {
  const src = readFileSync(fileURLToPath(new URL('./feed-post-card.tsx', import.meta.url)), 'utf8')
  const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('no English copy is left in the sign-up controls or the petition embed', () => {
    for (const literal of ['>Petition<', ' signatures', 'Signed\n', 'Add your verified signature', 'spot{', ' left\n', 'opted in', 'Opted In', '\n                  Withdraw\n', '\n              Full\n', '\n              Opt In\n', '{oi.status}\n', 'You have declined this person before', 'Declined before', 'Unblock —', '\n                      Accept\n', '\n                      Decline\n', 'Mark Completed', 'Review seeker', 'Review sourcer', '{optInError}', 'toLocaleString']) {
      expect(code, JSON.stringify(literal)).not.toContain(literal)
    }
  })

  it('the card writes no English mark; the two conditional ones cover text FEED did not write', () => {
    expect(code).not.toMatch(/lang="en"/)
    expect(code.match(/lang=\{[^}]*'en'\}/g)).toEqual(["lang={isOptInStatus(oi.status) ? undefined : 'en'}", "lang={optInFailure.translated ? undefined : 'en'}"])
  })
})
