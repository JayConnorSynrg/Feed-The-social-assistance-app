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
//   - every icon button has a name, and the message box's name is the text shown in it;
//   - a member's own words are never handed to a translation function;
//   - loading says so to a screen reader, a failure is an alert, the confirm dialog has a
//     description, a translated close label, and returns focus to the button that opened it;
//   - Accept accepts and Decline asks first (the handlers are wired to the right buttons).

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
import { cardT } from '@/lib/i18n-feed-card'
import { DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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
  })

  it('is never handed to a translation function: text that equals a code or a known sentence is shown as written', () => {
    // A message that is, word for word, one of the hook's failure sentences; a name that is a status.
    const out = html('es', { messages: [msg({ content: 'Failed to send message' })], conversations: [conv({ counterpartyDisplayName: 'pending' })] })
    expect(out).toContain('<p lang="" dir="auto" class="text-sm leading-relaxed">Failed to send message</p>')
    expect(out).not.toContain('No se pudo enviar el mensaje')
    expect(out).toContain('<p lang="" dir="auto" class="font-medium text-stone-800 text-sm">pending</p>')
    expect(out).toContain('<p lang="" dir="auto" class="text-sm font-medium text-stone-800 truncate">pending</p>')
    expect(out).not.toMatch(/>pendiente<\/p>/)
  })

  it('the message box follows what is typed; while empty it takes the page direction, so the placeholder sits on the right side', () => {
    expect(html('ar')).toMatch(/<input[^>]*placeholder="اكتب رسالة..."[^>]*dir="rtl"/)
    expect(html('en')).toMatch(/<input[^>]*dir="ltr"/)
    state.language = 'ar'
    state.hook = hook()
    const c = mount(() => MessagesPanel())
    const input = () => (findAll(c.tree(), (e: El) => typeof e.props.placeholder === 'string') as El[])[0]
    expect(input().props.dir).toBe('rtl')
    ;(input().props.onChange as (e: unknown) => void)({ target: { value: 'hello' } })
    c.rerender()
    expect(input().props.dir).toBe('auto')
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
    expect(out).toMatch(/<div role="alert" class="absolute bottom-4[^"]*">这位志愿者已有一个待处理的请求。请稍后再试。<\/div>/)
    expect(out).not.toContain('This volunteer already')
  })

  it("the server's own text is shown as received and marked English", () => {
    const out = html('zh', { error: 'new row violates row-level security policy for table "messages"' })
    expect(out).toMatch(/<div role="alert" lang="en" dir="ltr" class="absolute bottom-4[^"]*">new row violates row-level security policy/)
  })

  it('a failure is announced: the banner is an alert', () => {
    expect(html('zh', { error: 'Failed to send message' })).toMatch(/<div role="alert" class="absolute bottom-4/)
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

describe('a stored value FEED has no label for', () => {
  it('is shown as stored and marked English: an unknown status, an unknown category', () => {
    const out = html('es', { conversations: [conv({ status: 'archived', resource: { name: 'Rides', category: 'pet_care' } })] })
    expect(out).toMatch(/<div class="[^"]*" lang="en">archived<\/div>/)
    expect(out.match(/<span lang="en" class="text-xs text-stone-600">Pet Care<\/span>/g)).toHaveLength(1)
  })

  it('a labelled status and category carry no English mark', () => {
    const out = html('es')
    expect(out).toMatch(/<div class="[^"]*bg-green-100 text-green-700">activa<\/div>/)
    expect(out).toContain('<span class="text-xs text-stone-600">Empleo</span>')
    expect(out).not.toMatch(/lang="en"/)
  })
})

describe('loading', () => {
  it('the inbox spinner is a status with the word "Loading" for a screen reader', () => {
    const out = html('fr', { isLoading: true })
    expect(out).toMatch(/<div role="status" class="flex items-center justify-center py-12"><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span class="sr-only">Chargement…<\/span><\/div>/)
  })

  it('the review check on a completed conversation says so too', () => {
    // First render: the review lookup has not answered yet.
    const out = html('ko', { conversations: [conv({ status: 'completed' })] })
    expect(out).toMatch(/<div role="status" class="flex items-center justify-center py-3">.*?<span class="sr-only">불러오는 중…<\/span><\/div>/)
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
    const opener = { isConnected: true, focus: vi.fn() }
    const c = mount(() => MessagesPanel())
    const button = (findAll(c.tree(), (e: El) => typeof e.props.onClick === 'function' && textOf(e).trim() === buttonText) as El[])[0]
    ;(button.props.onClick as (e: unknown) => void)({ currentTarget: opener })
    const tree = c.rerender()
    const content = (findAll(tree, (e: El) => e.type === DialogContent) as El[])[0]
    return {
      c,
      opener,
      content,
      title: textOf((findAll(content, (e: El) => e.type === DialogTitle) as El[])[0]),
      description: (findAll(content, (e: El) => e.type === DialogDescription) as El[]).map(textOf),
      text: textOf(content),
    }
  }
  const asVolunteerPending = { conversations: [conv({ status: 'pending', volunteer_id: 'me', requester_id: 'r' })] }

  it('ar: the dialog carries lang="ar" dir="rtl" and reads in Arabic', () => {
    const d = open('ar', asVolunteerPending, 'رفض')
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

  it('the body is the dialog description (so it is read with the title)', () => {
    const d = open('es', asVolunteerPending, 'Rechazar')
    expect(d.description).toEqual(['Se avisará a quien hizo la solicitud de que fue rechazada.'])
    // Radix wires aria-describedby to it; the dialog must not opt out.
    expect('aria-describedby' in d.content.props).toBe(false)
  })

  it.each(LOCALES)('%s: the close button of the dialog is named in the member language', (locale) => {
    const d = open(locale, asVolunteerPending, messagesT(locale, 'decline'))
    expect(d.content.props.closeLabel).toBe(cardT(locale, 'close'))
    if (locale !== 'en') expect(d.content.props.closeLabel).not.toBe('Close')
  })

  it('closing returns focus to the button that opened it', () => {
    const d = open('en', { conversations: [conv({ status: 'pending' })] }, 'Withdraw')
    const prevented = vi.fn()
    ;(d.content.props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault: prevented })
    expect(d.opener.focus).toHaveBeenCalledTimes(1)
    expect(prevented).toHaveBeenCalledTimes(1)
  })

  it('when that button has left the page, focus is left to the dialog (no call on a detached element)', () => {
    const d = open('en', { conversations: [conv({ status: 'pending' })] }, 'Withdraw')
    d.opener.isConnected = false
    const prevented = vi.fn()
    ;(d.content.props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault: prevented })
    expect(d.opener.focus).not.toHaveBeenCalled()
    expect(prevented).not.toHaveBeenCalled()
  })
})

describe('the buttons do what they say', () => {
  const click = (c: { tree: () => unknown }, label: string) => {
    const button = (findAll(c.tree(), (e: El) => typeof e.props.onClick === 'function' && textOf(e).trim() === label) as El[])[0]
    ;(button.props.onClick as (e: unknown) => void)({ currentTarget: { isConnected: true, focus: () => {} } })
  }

  it('Accept accepts the request at once; nothing else is called', () => {
    state.language = 'en'
    const h0 = hook({ conversations: [conv({ status: 'pending', volunteer_id: 'me', requester_id: 'r' })] })
    state.hook = h0
    const c = mount(() => MessagesPanel())
    click(c, 'Accept')
    expect(h0.acceptRequest).toHaveBeenCalledWith('c1')
    for (const other of [h0.declineRequest, h0.withdrawRequest, h0.completeConversation, h0.cancelConversation]) expect(other).not.toHaveBeenCalled()
  })

  it.each([
    ['Decline', 'Decline Request', 'declineRequest', { status: 'pending', volunteer_id: 'me', requester_id: 'r' }],
    ['Withdraw', 'Withdraw Request', 'withdrawRequest', { status: 'pending' }],
    ['End & review', 'End & review', 'completeConversation', { status: 'active', volunteer_id: 'me', requester_id: 'r' }],
  ] as const)('%s asks first; confirming calls only %s', (label, confirmLabel, method, over) => {
    state.language = 'en'
    const h0 = hook({ conversations: [conv(over)] })
    state.hook = h0
    const c = mount(() => MessagesPanel())
    click(c, label)
    const methods = ['acceptRequest', 'declineRequest', 'withdrawRequest', 'completeConversation', 'cancelConversation'] as const
    for (const m of methods) expect(h0[m], `${m} before confirming`).not.toHaveBeenCalled()
    const content = (findAll(c.rerender(), (e: El) => e.type === DialogContent) as El[])[0]
    const confirm = (findAll(content, (e: El) => e.props['data-testid'] === 'confirm-end-btn') as El[])[0]
    expect(textOf(confirm).trim()).toBe(confirmLabel)
    ;(confirm.props.onClick as () => void)()
    expect(h0[method]).toHaveBeenCalledWith('c1')
    for (const m of methods.filter((x) => x !== method)) expect(h0[m], m).not.toHaveBeenCalled()
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

  it('the review modal it opens is still English and marks itself English (a portal has no translated parent)', () => {
    const modal = readFileSync(fileURLToPath(new URL('../feed/review-modal.tsx', import.meta.url)), 'utf8')
    expect(modal).toMatch(/<DialogContent lang="en" dir="ltr"/)
    expect(modal.match(/<DialogContent\b/g)).toHaveLength(1)
  })

  it('status and category go through their label functions', () => {
    expect(code).toContain('{conversationStatusLabel(selectedConv.status, locale)}')
    expect(code.match(/resourceCategoryLabel\(/g)).toHaveLength(2)
  })

  it('no translation reader is given a member\'s own words', () => {
    const READERS = 'messagesT|feedChromeT|cardT|conversationError|conversationStatusLabel|resourceCategoryLabel'
    const MEMBER_TEXT = 'msg\\.content|otherUserName|otherName|counterpartyDisplayName|first_name|resource\\.name'
    expect(code).not.toMatch(new RegExp(`\\b(${READERS})\\([^()]*\\b(${MEMBER_TEXT})\\b`))
  })
})
