// apps/web/src/hooks/use-chat.locale.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The assistant answers in the viewer's locale — the one every surface reads (useProfileLocale) —
// and follows a saved language on the next message. Driven with the mini hook runtime: send a
// message, read the preferredLanguage the chat request carries.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
const auth = vi.hoisted(() => ({ value: { profile: null as unknown } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  createOpId: () => 'op',
}))
vi.mock('@/lib/supabase/client', () => {
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } }
  return { createClient: () => client }
})

import { mount } from '@/test/mini-react'
import { useChat } from './use-chat'

const sent: Array<Record<string, unknown>> = []

beforeEach(() => {
  sent.length = 0
  vi.stubGlobal('localStorage', { getItem: () => null })
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body))
    // A refused request (400, not retried) ends the send at once.
    return { ok: false, status: 400, text: async () => '{"error":"stop"}' }
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('the language the assistant is asked to answer in', () => {
  it('is the profile locale, and the next message follows a saved language', async () => {
    auth.value = { profile: { id: 'u1', preferred_language: 'ko', location_city: null, location_state: null } }
    const m = mount(() => useChat())
    await m.tree().sendMessage('hello')
    await m.flush()
    expect(sent.at(-1)?.preferredLanguage).toBe('ko')

    auth.value = { profile: { id: 'u1', preferred_language: 'es', location_city: null, location_state: null } }
    m.rerender()
    await m.tree().sendMessage('hola')
    await m.flush()
    expect(sent.at(-1)?.preferredLanguage).toBe('es')
  })

  it("with no supported profile language: the device's choice, as on every other surface", async () => {
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'feed_preferred_language' ? 'vi' : null) })
    auth.value = { profile: { id: 'g1', preferred_language: null, location_city: null, location_state: null } }
    const m = mount(() => useChat())
    await m.tree().sendMessage('xin chào')
    await m.flush()
    expect(sent.at(-1)?.preferredLanguage).toBe('vi')
  })
})
