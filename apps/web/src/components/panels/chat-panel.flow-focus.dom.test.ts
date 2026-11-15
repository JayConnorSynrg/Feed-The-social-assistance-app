// @vitest-environment jsdom
// apps/web/src/components/panels/chat-panel.flow-focus.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W7 review R1 — after any guided flow completes, focus never lands on <body> (real DOM: jsdom,
// createRoot, act). Check Eligibility waits for benefits-screening (held open here) before it
// sends its result: until then focus is on the message box (signed in) or, for a visitor with no
// session whose greeting box is disabled, on the card that opened the flow. When the result
// replaces the greeting — and the card with it — focus is on the conversation's message box. A
// state FEED cannot read sends nothing, and the card keeps focus.
// The flow itself is stubbed (its steps are covered in chat-panel.i18n.test.ts): it completes with
// fixed answers.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  authed: false,
  sent: [] as string[],
  answers: {} as Record<string, string>,
  resolveScreening: null as null | ((v: unknown) => void),
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: h.authed ? { id: 'me' } : null, isAuthenticated: h.authed, profile: { preferred_language: 'ko' } }),
}))
vi.mock('@/hooks/use-chat', async () => {
  const React = await import('react')
  return {
    useChat: () => {
      const [messages, setMessages] = React.useState<unknown[]>([])
      return {
        messages, isLoading: false, isRetrying: false, error: null, errorKind: null, retrySend: vi.fn(), stopStreaming: vi.fn(),
        sendMessage: async (content: string) => {
          h.sent.push(content)
          setMessages((m) => [...m, { id: `u${m.length}`, role: 'user', content, timestamp: new Date('2026-11-15T10:00:00Z') }])
        },
      }
    },
  }
})
vi.mock('@/components/chat/guided-flow', async () => {
  const React = await import('react')
  return {
    GuidedFlowComponent: (p: { onComplete?: (a: Record<string, string>, r: string) => void }) =>
      React.createElement('button', { type: 'button', 'data-testid': 'finish', onClick: () => p.onComplete?.(h.answers, '') }, 'finish'),
  }
})
vi.mock('@/hooks/use-saved-resources', () => ({ useSavedResources: () => ({ saveResource: vi.fn(async () => true), isResourceSavedByName: () => false }) }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ functions: { invoke: () => new Promise((resolve) => { h.resolveScreening = resolve }) } }),
}))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {}, setPanelParams: vi.fn(), setActivePanel: vi.fn() }) }))
vi.mock('next/link', async () => {
  const React = await import('react')
  return { default: (p: { href: string; children?: React.ReactNode }) => React.createElement('a', { href: p.href }, p.children) }
})
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), createOpId: () => 'op' }))

import { assistantT } from '@/lib/i18n-assistant'
import { ChatPanel } from './chat-panel'

let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom has no layout: the message list's auto-scroll is a no-op here.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {}

const ANSWERS = { 'household-size': '2', children: 'no', pregnant: 'no', income: '0', employment: 'retired', 'current-benefits': 'none', state: 'CA' }

beforeEach(() => {
  h.sent = []
  h.resolveScreening = null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const settle = async () => {
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const eligibilityCard = () =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith(assistantT('ko', 'cardEligibilityTitle'))) as HTMLButtonElement
const conversationBox = () => container.querySelector(`input[aria-label="${assistantT('ko', 'replyPlaceholder')}"]`) as HTMLInputElement | null

async function completeEligibility(authed: boolean, answers: Record<string, string>) {
  h.authed = authed
  h.answers = answers
  await act(async () => root.render(el(ChatPanel, {})))
  await act(async () => eligibilityCard().click())
  await act(async () => (container.querySelector('[data-testid="finish"]') as HTMLButtonElement).click())
  await settle()
}

describe('Check Eligibility completes: focus is never left on <body>', () => {
  it.each([
    ['a visitor with no session', false],
    ['a signed-in member', true],
  ])('%s: while screening runs, focus is held; when the result arrives, it is on the conversation’s box', async (_who, authed) => {
    await completeEligibility(authed, ANSWERS)
    expect(h.resolveScreening).toBeTypeOf('function')
    expect(conversationBox()).toBeNull()
    expect(document.activeElement).not.toBe(document.body)
    if (!authed) expect(document.activeElement).toBe(eligibilityCard())
    await act(async () => h.resolveScreening!({ data: { programs: [] }, error: null }))
    await settle()
    expect(h.sent).toHaveLength(1)
    expect(conversationBox()).toBeTruthy()
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(conversationBox())
  })

  it('a state FEED cannot read: nothing is screened or sent, and the card keeps focus', async () => {
    await completeEligibility(false, { ...ANSWERS, state: 'Калифорния' })
    await settle()
    expect(h.resolveScreening).toBeNull()
    expect(h.sent).toEqual([])
    expect(document.activeElement).toBe(eligibilityCard())
  })
})
