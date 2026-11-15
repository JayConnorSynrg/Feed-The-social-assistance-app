// apps/web/src/components/panels/chat-panel.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set lands on the AI Assistant and reads it in that language:
//   - the greeting, the three action cards, the quick tags, the message box and the sign-in prompt
//     (its link stays a link inside the translated sentence); the panel marked with the language,
//     Arabic right-to-left; no English mark left (the "Retrying…" island is gone);
//   - Label in Name: each action card is named by its visible title first; the message box is
//     named by the words shown in it; the icon-only Send and Stop buttons have names;
//   - in a conversation, the buttons FEED adds to a suggested resource, the quick replies, the time
//     and the model line are in the member's language, while the message itself keeps its own
//     direction and takes no page language;
//   - the guided flow (components/chat/guided-flow.tsx) reads in the language, and an option still
//     answers with its value.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state, spies } = vi.hoisted(() => ({
  state: { language: 'ko', authed: true, messages: [] as unknown[], isRetrying: false, error: null as string | null, isLoading: false },
  spies: {
    sendMessage: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
    invoke: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  },
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: state.authed ? { id: 'me' } : null, isAuthenticated: state.authed, profile: { preferred_language: state.language } }),
}))
vi.mock('@/hooks/use-chat', () => ({
  useChat: () => ({
    messages: state.messages, isLoading: state.isLoading, isRetrying: state.isRetrying, error: state.error, errorKind: state.error ? 'network' : null,
    sendMessage: spies.sendMessage, retrySend: vi.fn(), stopStreaming: vi.fn(),
  }),
}))
vi.mock('@/hooks/use-saved-resources', () => ({ useSavedResources: () => ({ saveResource: vi.fn(async () => true), isResourceSavedByName: () => false }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ functions: { invoke: (...a: unknown[]) => spies.invoke(...a) } }) }))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {}, setPanelParams: vi.fn(), setActivePanel: vi.fn() }) }))
vi.mock('next/link', () => ({ default: (p: { href: string; className?: string; children?: unknown }) => h('a', { href: p.href, className: p.className }, p.children as never) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), createOpId: () => 'op' }))
vi.mock('@/lib/event-time', async (orig) => ({ ...(await orig<object>()), browserTimeZone: () => 'America/New_York' }))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { assistantT } from '@/lib/i18n-assistant'
import { formatClock } from '@/lib/i18n-intl'
import { resourceFinderFlow } from '@/lib/ai/guided-flows'
import { GuidedFlowComponent, StepComponent } from '@/components/chat/guided-flow'
import { ChatPanel, ChatErrorBanner } from './chat-panel'

const LOCALES = Object.keys(messages) as Locale[]
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim()
const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null

function html(language: string, over: Partial<typeof state> = {}) {
  Object.assign(state, { language, authed: true, messages: [], isRetrying: false, error: null, isLoading: false }, over)
  return renderToStaticMarkup(h(ChatPanel))
}
/** Each <button>: its own attributes and its visible text. */
function buttons(markup: string) {
  return [...markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: strip(m[2]) }))
}
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')

beforeEach(() => {
  vi.clearAllMocks()
  spies.sendMessage = vi.fn(async () => {})
  spies.invoke = vi.fn(async () => ({ data: { programs: [] }, error: null }))
})

describe('the landing screen in the member’s language', () => {
  it('Korean: greeting, cards, tags and message box; the panel is marked ko', () => {
    const out = html('ko')
    expect(out.startsWith('<div lang="ko" dir="ltr"')).toBe(true)
    for (const key of ['greetingTitle', 'greetingSubtitle', 'cardResourcesTitle', 'cardEligibilityBody', 'cardFormsTitle', 'tagHealthcare'] as const) {
      expect(out).toContain(assistantT('ko', key))
    }
    expect(out).toContain(`placeholder="${assistantT('ko', 'inputPlaceholder')}"`)
    expect(out).not.toContain('lang="en"')
    expect(out).not.toMatch(/Hi, This is Feed|Find Resources|Check Eligibility|Type your message/)
  })

  it('Arabic: right-to-left', () => {
    expect(html('ar').startsWith('<div lang="ar" dir="rtl"')).toBe(true)
  })

  it('a guest reads the sign-in sentence in their language, with the link inside it', () => {
    const out = html('es', { authed: false })
    const link = `<a href="/login" class="font-medium underline">${assistantT('es', 'signInLink')}</a>`
    expect(out).toContain(link)
    const sentence = /<p class="text-sm text-amber-700">([\s\S]*?)<\/p>/.exec(out)![1]
    expect(strip(sentence)).toBe(assistantT('es', 'signInPrompt').replace('{link}', assistantT('es', 'signInLink')))
    expect(out).toContain(`placeholder="${assistantT('es', 'inputPlaceholderGuest')}"`)
  })

  it('reconnecting and retrying are in the member’s language (no English mark)', () => {
    expect(html('fr', { isRetrying: true })).toContain(assistantT('fr', 'reconnecting'))
    state.language = 'ru'
    const banner = renderToStaticMarkup(h(ChatErrorBanner, { kind: 'network', onRetry: () => {}, isRetrying: true }))
    expect(banner).toContain(assistantT('ru', 'retrying'))
    expect(banner).not.toContain('lang="en"')
  })

  it.each(LOCALES)('%s: Label in Name — cards by their title, the message box by its words, icon buttons named', (locale) => {
    const out = html(locale)
    const cards = buttons(out).filter((b) => /flex-col items-start/.test(b.attrs))
    expect(cards.map((c) => c.text.slice(0, assistantT(locale, 'cardResourcesTitle').length))[0]).toBe(assistantT(locale, 'cardResourcesTitle'))
    expect(cards[1].text.startsWith(assistantT(locale, 'cardEligibilityTitle'))).toBe(true)
    expect(cards[2].text.startsWith(assistantT(locale, 'cardFormsTitle'))).toBe(true)
    for (const c of cards) expect(attr(c.attrs, 'aria-label')).toBeNull()
    const input = /<input[^>]*>/.exec(out)![0]
    expect(decode(attr(input, 'aria-label')!)).toBe(decode(attr(input, 'placeholder')!))
    const send = buttons(out).find((b) => b.text === '')!
    expect(decode(attr(send.attrs, 'aria-label')!)).toBe(assistantT(locale, 'sendMessage'))
  })
})

describe('a conversation', () => {
  const assistantMessage = {
    id: 'a1',
    role: 'assistant',
    content: 'مرحبا [[RESOURCE:Food Shelf|1 Main St|802-555-0100|example.org|apply.example.org]]',
    timestamp: new Date('2026-10-09T19:05:00Z'),
    model: 'acme/model-x',
    isStreaming: false,
  }

  it('Korean: resource buttons, quick replies, time and model line in Korean; the message keeps its own direction', () => {
    const out = html('ko', { messages: [assistantMessage] })
    for (const key of ['resourceApply', 'resourceVisit', 'resourceDirections', 'resourceSave', 'replyFindMore', 'replyTalk'] as const) {
      expect(out).toContain(assistantT('ko', key))
    }
    expect(out).toContain('<div lang="" dir="auto" class="text-base">')
    expect(out).toMatch(/<div lang="ko" dir="ltr" class="flex flex-wrap gap-1">/)
    expect(out).toContain(formatClock('2026-10-09T19:05:00Z', 'ko', 'America/New_York'))
    // The model's name is isolated (its own direction inside the sentence).
    expect(out).toContain('\u2068model-x\u2069 사용')
    expect(out).toContain(`aria-label="${assistantT('ko', 'replyPlaceholder')}"`)
    expect(out).not.toMatch(/>(Apply|Visit|Directions|Save|Find more resources)</)
  })

  it('the Stop button is named while a reply streams', () => {
    const out = html('es', { messages: [assistantMessage], isLoading: true })
    expect(out).toContain(`aria-label="${assistantT('es', 'stopResponse')}"`)
  })
})

describe('the guided flow', () => {
  it('Korean: name, step line, question, options and Cancel; the card is marked ko', () => {
    Object.assign(state, { language: 'ko', isLoading: false })
    const out = renderToStaticMarkup(h(GuidedFlowComponent, { flow: resourceFinderFlow, onCancel: () => {} }))
    expect(out).toMatch(/^<div [^>]*lang="ko" dir="ltr">/)
    for (const key of ['rfName', 'rfCategoryQ', 'rfFood', 'rfMentalHealth', 'flowCancel'] as const) expect(out).toContain(assistantT('ko', key))
    expect(out).toContain('4단계 중 1단계')
    expect(out).toContain('<span aria-hidden="true" class="me-2">🍎</span>')
    expect(out).not.toMatch(/What type of help|Food Assistance|Step 1 of 4/)
  })

  it('Arabic: right-to-left', () => {
    state.language = 'ar'
    expect(renderToStaticMarkup(h(GuidedFlowComponent, { flow: resourceFinderFlow }))).toMatch(/^<div [^>]*lang="ar" dir="rtl">/)
  })

  it('an option answers with its value, whatever language the member reads it in', () => {
    const onAnswer = vi.fn()
    const step = resourceFinderFlow.steps[0]
    const m = mount(() => StepComponent({ step, onAnswer, locale: 'ar' }))
    const options = findAll(m.tree(), (el) => el.type === 'button')
    expect(options).toHaveLength(step.options!.length)
    ;(options[0].props.onClick as () => void)()
    ;(options[7].props.onClick as () => void)()
    expect(onAnswer.mock.calls).toEqual([['food'], ['mental-health']])
  })
})

describe('Check Eligibility ends on the state the member means — never a guessed one', () => {
  type Mounted = ReturnType<typeof mount<unknown>>
  /** Mount the panel, open Check Eligibility from its card and finish the flow with `typed`. */
  async function finishWith(typed: string, language = 'ru') {
    Object.assign(state, { language, authed: true, messages: [], isRetrying: false, error: null, isLoading: false })
    const m: Mounted = mount(() => ChatPanel({}))
    const card = findAll(m.tree(), (el) => typeof el.props.buttonRef === 'function')[1]
    ;(card.props.onClick as () => void)()
    m.rerender()
    const [flow] = findAll(m.tree(), (el) => el.type === GuidedFlowComponent)
    await (flow.props.onComplete as (a: Record<string, string>, r: string) => Promise<void>)(
      { 'household-size': '2', children: 'no', income: '0', employment: 'retired', 'current-benefits': 'none', state: typed },
      '',
    )
    await m.flush()
    return m
  }
  const notice = (m: Mounted) => findAll(m.tree(), (el) => typeof el.type === 'function' && (el.type as { name?: string }).name === 'UnknownStateNotice')

  it('"Калифорния": nothing is screened or sent, and the member is told in Russian to use the 2-letter code', async () => {
    const m = await finishWith('Калифорния')
    expect(spies.invoke).not.toHaveBeenCalled()
    expect(spies.sendMessage).not.toHaveBeenCalled()
    const [el] = notice(m)
    expect(el.props.state).toBe('Калифорния')
    const text = renderToStaticMarkup(el as never)
    expect(text).toContain('role="alert"')
    expect(text).toContain('<bdi lang="" dir="auto">Калифорния</bdi>')
    expect(strip(text)).toBe(assistantT('ru', 'stateNotRecognised').replace('{state}', 'Калифорния'))
    expect(strip(text)).not.toMatch(/VT\b.*VT/) // the example names VT once; no screening ran for it
  })

  it('"CA" and lowercase "ca" are screened as CA, with no notice', async () => {
    for (const typed of ['CA', 'ca']) {
      spies.invoke.mockClear()
      const m = await finishWith(typed, 'es')
      expect(spies.invoke).toHaveBeenCalledTimes(1)
      expect((spies.invoke.mock.calls[0][1] as { body: { state: string } }).body.state).toBe('CA')
      expect(notice(m)).toHaveLength(0)
    }
  })
})

describe('the guided flow, step by step', () => {
  function steps(flow: typeof resourceFinderFlow, answers: string[], language = 'en') {
    state.language = language
    const m = mount(() => GuidedFlowComponent({ flow }))
    const keys: string[] = []
    const current = () => findAll(m.tree(), (el) => el.type === StepComponent)[0] as { key?: string; props: Record<string, unknown> } & { type: unknown }
    keys.push(String((current() as unknown as { key: string }).key))
    for (const a of answers) {
      void (current().props.onAnswer as (x: string) => Promise<void>)(a)
      m.rerender()
      keys.push(String((current() as unknown as { key: string }).key))
    }
    return { m, keys }
  }

  it('each step is its own StepComponent (keyed by step id), so nothing typed carries over: location → additional', () => {
    const { keys } = steps(resourceFinderFlow, ['food', 'immediate', '05401'])
    expect(keys).toEqual(['category', 'urgency', 'location', 'additional'])
  })

  it('…and nothing picked carries over: children ages → current benefits', async () => {
    const { eligibilityCheckerFlow } = await import('@/lib/ai/guided-flows')
    const { keys } = steps(eligibilityCheckerFlow, ['2', 'yes', 'infant', 'no', '0', 'retired'])
    expect(keys).toEqual(['household-size', 'children', 'children-ages', 'pregnant', 'income', 'employment', 'current-benefits'])
  })

  it('focus lands on the question when the flow opens, after each answer, and after Back', () => {
    state.language = 'ko'
    const focus = vi.fn()
    const m = mount(() => GuidedFlowComponent({ flow: resourceFinderFlow }))
    const heading = () => findAll(m.tree(), (el) => el.type === 'h3')[0]
    const ref = heading().props.ref as { current: unknown }
    expect(heading().props.tabIndex).toBe(-1)
    ref.current = { focus }
    // Opening: the mount effect ran before the ref was set in this harness; an answer and Back
    // re-run it with the element in place.
    const step = findAll(m.tree(), (el) => el.type === StepComponent)[0]
    void (step.props.onAnswer as (x: string) => Promise<void>)('food')
    m.rerender()
    expect(focus).toHaveBeenCalledTimes(1)
    const back = findAll(m.tree(), (el) => typeof el.props.onClick === 'function' && el.props.variant === 'ghost' && !el.props.size)[0]
    ;(back.props.onClick as () => void)()
    m.rerender()
    expect(focus).toHaveBeenCalledTimes(2)
    // The question is the group's and the input's name.
    expect(step.props.questionId).toBe(heading().props.id)
  })

  it('the options are a group named by the question; a text step shows its hint and is described by it', () => {
    const select = renderToStaticMarkup(h(StepComponent, { step: resourceFinderFlow.steps[0], onAnswer: () => {}, locale: 'ru', questionId: 'q1' }))
    expect(select).toMatch(/^<div role="group" aria-labelledby="q1"/)
    const text = renderToStaticMarkup(h(StepComponent, { step: resourceFinderFlow.steps[2], onAnswer: () => {}, locale: 'ru', questionId: 'q2' }))
    const hintId = /<p id="([^"]+)" class="text-sm text-stone-600">/.exec(text)![1]
    expect(text).toContain(`>${assistantT('ru', 'rfLocationPh')}</p>`)
    expect(text).toMatch(new RegExp(`aria-labelledby="q2"[^>]*aria-describedby="${hintId}"|aria-describedby="${hintId}"[^>]*aria-labelledby="q2"`))
  })

  it('Cancel returns focus to the card that opened the flow', () => {
    Object.assign(state, { language: 'en', authed: true, messages: [] })
    const m = mount(() => ChatPanel({}))
    const cards = () => findAll(m.tree(), (el) => typeof el.props.buttonRef === 'function')
    const focus = vi.fn()
    ;(cards()[2].props.buttonRef as (e: unknown) => void)({ focus })
    ;(cards()[2].props.onClick as () => void)()
    m.rerender()
    const [flow] = findAll(m.tree(), (el) => el.type === GuidedFlowComponent)
    ;(flow.props.onCancel as () => void)()
    m.rerender()
    ;(cards()[2].props.buttonRef as (e: unknown) => void)({ focus })
    m.rerender()
    expect(focus).toHaveBeenCalled()
  })
})

describe('the conversation, for assistive technology and input methods', () => {
  const reply = (over: Record<string, unknown> = {}) => ({ id: 'a1', role: 'assistant', content: 'Bonjour', timestamp: new Date('2026-10-09T19:05:00Z'), model: 'm', isStreaming: false, ...over })
  const mine = { id: 'u1', role: 'user', content: 'Salut', timestamp: new Date('2026-10-09T19:04:00Z') }

  it('the list is a polite log; while a reply streams it is busy and the reply is hidden until complete', () => {
    const streaming = html('fr', { messages: [mine, reply({ isStreaming: true, content: 'Bon' })] })
    expect(streaming).toMatch(/role="log" aria-live="polite" aria-relevant="additions" aria-busy="true" aria-label="Conversation"/)
    expect(streaming).toContain('<div lang="" dir="auto" aria-hidden="true" class="text-base">')
    const done = html('fr', { messages: [mine, reply()] })
    expect(done).toMatch(/role="log"[^>]*aria-busy="false"/)
    expect(done).not.toContain('aria-hidden="true" class="text-base"')
  })

  it('a completed reply is a new element in the log (re-keyed), so it is announced once, whole', () => {
    state.messages = [reply({ isStreaming: true })]
    const m = mount(() => ChatPanel({}))
    const key = () => (findAll(m.tree(), (el) => typeof el.props.onQuickReply === 'function')[0] as unknown as { key: string }).key
    expect(key()).toBe('a1:streaming')
    state.messages = [reply()]
    m.rerender()
    expect(key()).toBe('a1')
  })

  it('the member’s bubble and its time keep their contrast (brand / white, white 80%)', () => {
    const out = html('en', { messages: [mine] })
    expect(out).toContain('bg-brand text-white rounded-ee-md')
    expect(out).toContain('text-[10px] text-white/80')
    expect(html('en', { messages: [reply()] })).toContain('text-[10px] text-stone-600')
  })

  it('both message boxes show their placeholder at a readable contrast', () => {
    expect(html('en')).toMatch(/<input[^>]*placeholder:text-stone-600/)
    expect(html('en', { messages: [reply()] })).toMatch(/<input[^>]*placeholder:text-stone-600/)
  })

  it('a quick tag says whether it is chosen', () => {
    expect(html('en')).toMatch(/<button aria-pressed="false" class="inline-flex/)
  })

  it('Enter while composing (IME) does not send; Enter after composing does', () => {
    Object.assign(state, { language: 'ko', authed: true, messages: [] })
    const m = mount(() => ChatPanel({}))
    const input = () => findAll(m.tree(), (el) => typeof el.props.onKeyDown === 'function')[0]
    ;(input().props.onChange as (e: unknown) => void)({ target: { value: '안녕' } })
    m.rerender()
    ;(input().props.onKeyDown as (e: unknown) => void)({ key: 'Enter', nativeEvent: { isComposing: true } })
    expect(spies.sendMessage).not.toHaveBeenCalled()
    ;(input().props.onKeyDown as (e: unknown) => void)({ key: 'Enter', nativeEvent: { isComposing: false } })
    expect(spies.sendMessage).toHaveBeenCalledWith('안녕')
  })

  it('a suggested resource wraps: the name is whole and the actions move under it on a narrow screen', () => {
    const out = html('ru', { messages: [reply({ content: '[[RESOURCE:Продовольственный банк округа Читтенден|1 Main St|802|example.org|apply.example.org]]' })] })
    expect(out).toContain('<div class="flex flex-wrap items-start gap-2">')
    expect(out).toContain('<h4 class="font-semibold text-base text-stone-900 break-words">')
    expect(out).toMatch(/<div lang="ru" dir="ltr" class="flex flex-wrap gap-1">/)
  })
})
