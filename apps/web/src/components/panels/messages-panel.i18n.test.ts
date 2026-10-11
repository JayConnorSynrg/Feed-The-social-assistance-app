// apps/web/src/components/panels/messages-panel.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the Messages sub-tab in that language. The REAL panel with
// a faked useConversations (the hook itself is not changed by the translation work):
//   - inbox, thread, review prompt, confirm dialog and every state in the member's language;
//     each root, and the dialog (a portal), marked with it (Arabic: rtl);
//   - the status badge and the resource category are labels, not stored values;
//   - a message time and a conversation date format for the locale, hand-written for ht / hmn;
//   - names and message bodies keep their own direction and take no page language;
//   - the hook's fixed sentences become the member's sentence; server text is marked English;
//   - what is still English (the rating's name) is marked English;
//   - every icon button has a name, and the message box's name is the text shown in it.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state } = vi.hoisted(() => ({
  state: { language: 'en', guest: false, hook: {} as Record<string, unknown>, review: null as null | { rating: number } },
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'me' }, isAnonymous: state.guest, profile: { preferred_language: state.language } }),
}))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {} }) }))
vi.mock('@/hooks/use-conversations', () => ({ useConversations: () => state.hook }))
vi.mock('@/hooks/use-reviews', () => {
  const fetchMyReviewForConversation = async () => state.review
  return { useReviews: () => ({ fetchMyReviewForConversation }) }
})
vi.mock('@/components/feed/review-modal', () => ({ ReviewModal: () => null }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))
// Times are shown in the viewer's zone; pin it so the assertions do not depend on the machine.
vi.mock('@/lib/event-time', async (orig) => ({ ...(await orig<object>()), browserTimeZone: () => 'America/New_York' }))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { CONVERSATION_ERROR_SENTENCES, CONVERSATION_STATUSES, conversationError, conversationStatusLabel, messagesT } from '@/lib/i18n-feed-messages'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'
import { MessagesPanel } from './messages-panel'

const LOCALES = Object.keys(messages) as Locale[]
type El = { type: unknown; props: Record<string, unknown> }

const conv = (over: Record<string, unknown> = {}) => ({
  id: 'c1', resource_id: 'r1', volunteer_id: 'vol', requester_id: 'me', status: 'active', created_at: '2026-10-09T18:00:00Z', updated_at: '2026-10-09T19:05:00Z',
  volunteer: { first_name: 'Ana' }, requester: { first_name: 'Me' }, resource: { name: 'Rides', category: 'employment' }, counterpartyDisplayName: 'مريم', ...over,
})
const msg = (over: Record<string, unknown> = {}) => ({ id: 'm1', conversation_id: 'c1', sender_id: 'vol', content: 'مرحبا، كيف أساعد؟', is_read: true, created_at: '2026-10-09T19:05:00Z', ...over })
function hook(over: Record<string, unknown> = {}) {
  const conversations = (over.conversations as ReturnType<typeof conv>[] | undefined) ?? [conv()]
  return {
    conversations,
    pendingRequests: conversations.filter((c) => c.volunteer_id === 'me' && c.status === 'pending'),
    activeConversations: conversations.filter((c) => c.status === 'active'),
    completedConversations: conversations.filter((c) => c.status === 'completed'),
    history: conversations.filter((c) => c.status === 'declined' || c.status === 'cancelled'),
    messages: [msg()],
    selectedConversationId: 'c1',
    selectConversation: vi.fn(), sendMessage: vi.fn(), acceptRequest: vi.fn(), declineRequest: vi.fn(), completeConversation: vi.fn(),
    cancelConversation: vi.fn(), withdrawRequest: vi.fn(), isLoading: false, isSending: false, error: null,
    ...over,
  }
}
const html = (language: string, over: Record<string, unknown> = {}) => {
  state.language = language
  state.hook = hook(over)
  return renderToStaticMarkup(h(MessagesPanel))
}
/** Every string in an element tree (child components are not rendered; their children still are). */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement(node) ? textOf((node as El).props.children) : ''
}

beforeEach(() => {
  state.guest = false
  state.review = null
})

describe('Messages sub-tab in the member language', () => {
  it('vi: inbox heading, section with its count, status, category, thread controls; root marked vi, ltr', () => {
    const out = html('vi')
    expect(out).toMatch(/^<div lang="vi" dir="ltr"/)
    expect(out).toContain('Tin nhắn</h2>')
    expect(out).toContain('Đang diễn ra (1)')
    expect(out).toMatch(/<div class="[^"]*bg-green-100 text-green-700">đang diễn ra<\/div>/)
    expect(out).toContain('<span class="text-xs text-stone-600">Việc làm</span>')
    expect(out).toContain('placeholder="Nhập tin nhắn..."')
    expect(out).not.toMatch(/>Messages<|Active \(|>active<|>Jobs<|Type a message/)
  })

  it('ar: Arabic copy, dir="rtl", logical borders and alignment, mirrored arrow and send icons', () => {
    const out = html('ar')
    expect(out).toMatch(/^<div lang="ar" dir="rtl"/)
    expect(out).toContain('الرسائل</h2>')
    expect(out).toContain('نشطة (1)')
    expect(out).toContain('border-e ')
    expect(out).toContain('text-start')
    expect(out).not.toMatch(/\bborder-r\b|\btext-left\b|\bmr-1\b/)
    expect(out).toMatch(/aria-label="العودة إلى المحادثات"[^>]*>\s*<svg[^>]*class="[^"]*rtl:rotate-180/)
    expect(out).toMatch(/aria-label="إرسال الرسالة"[^>]*>\s*<svg[^>]*class="[^"]*rtl:-scale-x-100/)
    // Letter-spacing would break Arabic joining on the section label.
    expect(out).toContain('tracking-wider rtl:tracking-normal')
  })

  it('pending request, as the volunteer: Accept / Decline; as the requester: Withdraw and the waiting line around the name', () => {
    const asVolunteer = html('es', { conversations: [conv({ status: 'pending', volunteer_id: 'me', requester_id: 'r' })] })
    expect(asVolunteer).toContain('Solicitudes pendientes (1)')
    expect(asVolunteer).toMatch(/Aceptar<\/button>/)
    expect(asVolunteer).toMatch(/>\s*Rechazar\s*<\/button>/)
    const asRequester = html('es', { conversations: [conv({ status: 'pending' })] })
    expect(asRequester).toMatch(/>\s*Retirar\s*<\/button>/)
    expect(asRequester).toContain('<span>Esperando a que <bdi lang="">مريم</bdi> acepte tu solicitud...</span>')
  })

  it('history and completed sections, with their counts formatted', () => {
    const out = html('fr', { conversations: [conv({ id: 'a', status: 'completed' }), conv({ id: 'b', status: 'declined' }), conv({ id: 'c', status: 'cancelled' })], selectedConversationId: null })
    expect(out).toContain('Terminées (1)')
    expect(out).toContain('Historique (2)')
    expect(out).toContain('Sélectionnez une conversation pour voir les messages')
  })

  it('a guest gets the translated account prompt and link; an empty inbox its two sentences', () => {
    state.guest = true
    const guest = html('pt')
    expect(guest).toMatch(/^<div lang="pt" dir="ltr"/)
    expect(guest).toContain('Crie uma conta gratuita para enviar mensagens a voluntários e se conectar com a sua comunidade')
    expect(guest).toMatch(/data-testid="create-account-prompt-link"[^>]*>Criar conta gratuita</)
    state.guest = false
    const empty = html('ko', { conversations: [] })
    expect(empty).toMatch(/^<div lang="ko" dir="ltr"/)
    expect(empty).toContain('아직 메시지가 없습니다')
  })
})

describe('time in the member language', () => {
  it.each([
    ['en', '3:05 PM', 'Oct 9, 2026'],
    ['es', '15:05', '9 oct 2026'],
    ['ht', '3:05 PM', '9 okt 2026'],
    ['hmn', '3:05 PM', 'Lub Kaum Hli 9, 2026'],
    ['so', '3:05 GD', 'Okt 9, 2026'],
  ])('%s: a message reads %s and its conversation %s', (locale, clock, date) => {
    const out = html(locale).replace(/[  ]/g, ' ')
    expect(out).toContain(`>${clock}</p>`)
    expect(out).toContain(`<span class="text-[10px] text-stone-600">${date}</span>`)
  })
})

describe('member-written text', () => {
  it('a message body and a name keep their direction and take no page language', () => {
    const out = html('en')
    expect(out).toContain('<p lang="" dir="auto" class="text-sm leading-relaxed">مرحبا، كيف أساعد؟</p>')
    expect(out).toContain('<p lang="" dir="auto" class="font-medium text-stone-800 text-sm">مريم</p>')
    expect(out).toContain('<p lang="" dir="auto" class="text-sm font-medium text-stone-800 truncate">مريم</p>')
    expect(out).toMatch(/<input[^>]*dir="auto"/)
  })

  it('with no name, the fallback word is FEED’s own text in the member language (no lang="")', () => {
    const out = html('ru', { conversations: [conv({ counterpartyDisplayName: null, volunteer: null })] })
    expect(out).toContain('<p dir="auto" class="font-medium text-stone-800 text-sm">Пользователь</p>')
    expect(out).toContain('<p dir="auto" class="text-sm font-medium text-stone-800 truncate">Пользователь</p>')
  })
})

describe('failures', () => {
  it("the hook's own sentence reads in the member language, with no English mark", () => {
    const out = html('zh', { error: 'This volunteer already has a pending request. Please try again later.' })
    expect(out).toMatch(/<div class="absolute bottom-4[^"]*">这位志愿者已有一个待处理的请求。请稍后再试。<\/div>/)
    expect(out).not.toContain('This volunteer already')
  })

  it("the server's own text is shown as received and marked English", () => {
    const out = html('zh', { error: 'new row violates row-level security policy for table "messages"' })
    expect(out).toMatch(/<div lang="en" dir="ltr" class="absolute bottom-4[^"]*">new row violates row-level security policy/)
  })

  it('every sentence use-conversations.ts can report has a key, and no key is stale', () => {
    const src = readFileSync(fileURLToPath(new URL('../../hooks/use-conversations.ts', import.meta.url)), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // A sentence: a quoted literal that starts with a capital and has a space in it.
    const sentences = [...code.matchAll(/'([A-Z][^'\n]* [^'\n]*)'|"([A-Z][^"\n]* [^"\n]*)"/g)].map((m) => m[1] ?? m[2])
    expect([...new Set(sentences)].sort()).toEqual(Object.keys(CONVERSATION_ERROR_SENTENCES).sort())
    expect(Object.keys(CONVERSATION_ERROR_SENTENCES)).toHaveLength(15)
  })

  it.each(LOCALES)('%s: each sentence has its own text', (locale) => {
    const texts = Object.keys(CONVERSATION_ERROR_SENTENCES).map((s) => conversationError(s, locale))
    expect(texts.every((t) => t.translated)).toBe(true)
    expect(new Set(texts.map((t) => t.text)).size).toBe(15)
    if (locale !== 'en') for (const [i, s] of Object.keys(CONVERSATION_ERROR_SENTENCES).entries()) expect(texts[i].text, s).not.toBe(s)
  })

  it('English members read the sentences exactly as before', () => {
    for (const sentence of Object.keys(CONVERSATION_ERROR_SENTENCES)) expect(conversationError(sentence, 'en').text).toBe(sentence)
  })
})

describe('status vocabulary (conversations.status)', () => {
  it.each(LOCALES)('%s: the five states each have a label; an unknown value is shown as stored', (locale) => {
    expect(CONVERSATION_STATUSES).toEqual(['pending', 'active', 'completed', 'declined', 'cancelled'])
    const labels = CONVERSATION_STATUSES.map((s) => conversationStatusLabel(s, locale))
    expect(new Set(labels).size).toBe(5)
    if (locale !== 'en') expect(labels).not.toEqual(CONVERSATION_STATUSES)
    expect(conversationStatusLabel('archived', locale)).toBe('archived')
  })
})

describe('accessible names', () => {
  it.each(LOCALES)('%s: the message box is named by the text shown in it; back and send have names', (locale) => {
    const out = html(locale)
    const placeholder = messagesT(locale, 'inputPlaceholder')
    const input = out.match(/<input[^>]*>/)?.[0] ?? ''
    expect(input).toContain(`placeholder="${placeholder}"`)
    expect(input).toContain(`aria-label="${placeholder}"`)
    expect(out).toContain(`aria-label="${messagesT(locale, 'backToList')}"`)
    expect(out).toContain(`aria-label="${messagesT(locale, 'send')}"`)
  })

  it('a button with visible text has no separate name', () => {
    const out = html('es', { conversations: [conv({ status: 'pending', volunteer_id: 'me', requester_id: 'r' })] })
    const buttons = out.match(/<button[^>]*>(?:(?!<\/button>).)*(?:Aceptar|Rechazar)<\/button>/g) ?? []
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button).not.toContain('aria-label')
  })
})

describe('review prompt and the still-English rating', () => {
  async function completed(language: string) {
    state.language = language
    state.hook = hook({ conversations: [conv({ status: 'completed' })] })
    const c = mount(() => MessagesPanel())
    await c.flush()
    return c.rerender()
  }

  it('not reviewed yet: the prompt in the member language, around the name in its own element', async () => {
    const tree = await completed('pt')
    const text = textOf(tree)
    expect(text).toContain('Como foi?')
    expect(text).toContain('Deixe uma avaliação para مريم')
    expect(text).toContain('Avalie sua experiência')
    const name = findAll(tree, (e: El) => e.type === 'span' && e.props.dir === 'auto' && e.props.lang === '') as El[]
    expect(name.map((e) => e.props.children)).toContain('مريم')
  })

  it('reviewed: the sentence is translated and the rating display sits inside an English mark', async () => {
    state.review = { rating: 4 }
    const tree = await completed('tl')
    expect(textOf(tree)).toContain('Naipasa na ang iyong review')
    const island = findAll(tree, (e: El) => e.props['data-english-only'] === 'rating') as El[]
    expect(island).toHaveLength(1)
    expect(island[0].props.lang).toBe('en')
    expect(island[0].props.dir).toBe('ltr')
    expect((island[0].props.children as El).props.value).toBe(4)
  })
})

describe('confirm dialog (a portal)', () => {
  function open(language: string, over: Record<string, unknown>, buttonText: string) {
    state.language = language
    state.hook = hook(over)
    const c = mount(() => MessagesPanel())
    const button = (findAll(c.tree(), (e: El) => typeof e.props.onClick === 'function' && textOf(e).trim() === buttonText) as El[])[0]
    ;(button.props.onClick as () => void)()
    const tree = c.rerender()
    const content = (findAll(tree, (e: El) => e.type === DialogContent) as El[])[0]
    return { content, title: textOf((findAll(content, (e: El) => e.type === DialogTitle) as El[])[0]), text: textOf(content) }
  }

  it('ar: the dialog carries lang="ar" dir="rtl" and reads in Arabic', () => {
    const d = open('ar', { conversations: [conv({ status: 'pending', volunteer_id: 'me', requester_id: 'r' })] }, 'رفض')
    expect(d.content.props.lang).toBe('ar')
    expect(d.content.props.dir).toBe('rtl')
    expect(d.title).toBe('رفض هذا الطلب؟')
    expect(d.text).toContain('سيُبلَّغ صاحب الطلب بأن طلبه رُفض.')
    expect(d.text).toContain('متابعة المحادثة')
    expect(d.text).toContain('رفض الطلب')
  })

  it('hmn: withdraw and end-and-review confirmations', () => {
    const withdraw = open('hmn', { conversations: [conv({ status: 'pending' })] }, 'Thim')
    expect(withdraw.title).toBe('Thim koj qhov kev thov?')
    expect(withdraw.text).toContain('Thim kev thov')
    const end = open('hmn', { conversations: [conv({ status: 'active', volunteer_id: 'me', requester_id: 'r' })] }, 'Xaus thiab ntsuam xyuas')
    expect(end.title).toBe('Xaus kev sib tham?')
    expect(end.content.props.lang).toBe('hmn')
    expect(end.content.props.dir).toBe('ltr')
  })
})

describe('messages-panel.tsx source', () => {
  const src = readFileSync(fileURLToPath(new URL('./messages-panel.tsx', import.meta.url)), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('no English copy, no copied vocabulary and no device-language formatting is left', () => {
    for (const literal of ['CATEGORY_LABELS', 'No messages yet', 'Pending Requests', '> Accept', 'Type a message', 'Keep chatting', 'Decline Request', 'How did it go', 'Leave a review for', 'Waiting for', "'User'", 'toLocaleTimeString', 'toLocaleDateString', '{selectedConv.status}\n']) {
      expect(code, literal).not.toContain(literal)
    }
  })

  it('status and category go through their label functions', () => {
    expect(code).toContain('{conversationStatusLabel(selectedConv.status, locale)}')
    expect(code.match(/resourceCategoryLabel\(/g)).toHaveLength(2)
  })
})
