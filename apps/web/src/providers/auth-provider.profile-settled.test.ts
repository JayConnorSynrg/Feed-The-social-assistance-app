// apps/web/src/providers/auth-provider.profile-settled.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// profileSettled on the auth context: true once the CURRENT user's background profile read has
// finished — loaded, failed or thrown (a timeout aborts the read and lands in the same path) — and
// false again when the user changes until that user's read finishes. The real AuthProvider, driven
// with the mini hook runtime and a Supabase double whose onAuthStateChange the test fires.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

type Answer = { data: unknown; error: { message: string; code?: string } | null }
const h = vi.hoisted(() => ({
  onChange: null as null | ((event: string, session: unknown) => Promise<void>),
  /** How get_my_profile answers for the next read. */
  profile: null as null | (() => Promise<unknown>),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => Promise<void>) => {
        h.onChange = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      refreshSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    rpc: (name: string) => ({
      abortSignal: () =>
        name === 'get_my_profile' ? h.profile!() : Promise.resolve<Answer>({ data: [{ latitude: null, longitude: null }], error: null }),
    }),
  }
  return { createClient: () => client }
})

import { mount } from '@/test/mini-react'
import { AuthProvider } from './auth-provider'

type Ctx = { user: { id: string } | null; profile: unknown; profileSettled: boolean }
const ctx = (m: { tree: () => unknown }) => (m.tree() as { props: { value: Ctx } }).props.value

beforeEach(() => {
  h.onChange = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('AuthProvider profileSettled', () => {
  it('no user: false; a failed profile read: true with profile null; a new user: false until its read ends', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    expect(ctx(m)).toMatchObject({ user: null, profileSettled: false })

    // The read fails (an error answer): the profile stays null, but the read has settled.
    h.profile = () => Promise.resolve<Answer>({ data: null, error: { message: 'boom', code: '57014' } })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    expect(ctx(m)).toMatchObject({ user: { id: 'u1' }, profile: null, profileSettled: true })

    // Account switch: the new user's read is still running → false (not the previous user's true).
    let release: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((res) => (release = res))
    await h.onChange!('SIGNED_IN', { user: { id: 'u2' } })
    await m.flush()
    expect(ctx(m)).toMatchObject({ user: { id: 'u2' }, profileSettled: false })
    release({ data: [{ id: 'u2', preferred_language: 'es' }], error: null })
    await m.flush()
    expect(ctx(m)).toMatchObject({ user: { id: 'u2' }, profileSettled: true, profile: expect.objectContaining({ preferred_language: 'es' }) })
  })

  it('a read that throws (an aborted / timed-out request) also settles', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.reject(Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }))
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    expect(ctx(m)).toMatchObject({ profile: null, profileSettled: true })
  })

  it('signing out: no user, so not settled', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'u1' }], error: null })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    expect(ctx(m).profileSettled).toBe(true)
    await h.onChange!('SIGNED_OUT', null)
    await m.flush()
    expect(ctx(m)).toMatchObject({ user: null, profileSettled: false })
  })
})
