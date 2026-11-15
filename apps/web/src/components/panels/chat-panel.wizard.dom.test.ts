// @vitest-environment jsdom
// apps/web/src/components/panels/chat-panel.wizard.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W7 review F1 — arriving at the Assistant from the Get Help wizard, in a real DOM (jsdom,
// createRoot, act). The wizard's panel has unmounted, so focus is on <body>. The Assistant sends the
// wizard's message and keyboard focus lands on the conversation's message box — for a visitor with
// no session too, whose greeting box is disabled. Never <body>.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  authed: false,
  sent: [] as string[],
  panelParams: {} as Record<string, unknown>,
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
vi.mock('@/hooks/use-saved-resources', () => ({ useSavedResources: () => ({ saveResource: vi.fn(async () => true), isResourceSavedByName: () => false }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ functions: { invoke: vi.fn() } }) }))
vi.mock('@/components/layout/feed-shell', () => ({
  usePanelContext: () => ({ panelParams: h.panelParams, setPanelParams: (p: Record<string, unknown>) => { h.panelParams = p }, setActivePanel: vi.fn() }),
}))
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

beforeEach(() => {
  h.sent = []
  h.panelParams = { flow: 'food', wizardContext: JSON.stringify({ category: 'food', answers: { 'assistance-type': ['food pantries'], state: 'Ohio' } }) }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

async function arrive(authed: boolean) {
  h.authed = authed
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  expect(document.activeElement).toBe(document.body)
  await act(async () => root.render(el(ChatPanel, {})))
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

describe('arriving from the Get Help wizard', () => {
  it.each([
    ['a visitor with no session', false],
    ['a signed-in member', true],
  ])('%s: the message is sent once and focus is on the conversation’s message box', async (_who, authed) => {
    await arrive(authed)
    expect(h.sent).toEqual(['I need help finding Food resources.\n- Type of help: food pantries\n- State: Ohio\nPlease suggest relevant local programs and resources for this need.'])
    const box = container.querySelector(`input[aria-label="${assistantT('ko', 'replyPlaceholder')}"]`) as HTMLInputElement
    expect(box).toBeTruthy()
    expect(box.disabled).toBe(false)
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(box)
  })
})
