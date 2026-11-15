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

const { state } = vi.hoisted(() => ({
  state: { language: 'ko', authed: true, messages: [] as unknown[], isRetrying: false, error: null as string | null, isLoading: false },
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: state.authed ? { id: 'me' } : null, isAuthenticated: state.authed, profile: { preferred_language: state.language } }),
}))
vi.mock('@/hooks/use-chat', () => ({
  useChat: () => ({
    messages: state.messages, isLoading: state.isLoading, isRetrying: state.isRetrying, error: state.error, errorKind: state.error ? 'network' : null,
    sendMessage: vi.fn(async () => {}), retrySend: vi.fn(), stopStreaming: vi.fn(),
  }),
}))
vi.mock('@/hooks/use-saved-resources', () => ({ useSavedResources: () => ({ saveResource: vi.fn(async () => true), isResourceSavedByName: () => false }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
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

beforeEach(() => vi.clearAllMocks())

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
    expect(out).toMatch(/<div lang="ko" dir="ltr" class="flex gap-1 flex-shrink-0">/)
    expect(out).toContain(formatClock('2026-10-09T19:05:00Z', 'ko', 'America/New_York'))
    expect(out).toContain('model-x 사용')
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
