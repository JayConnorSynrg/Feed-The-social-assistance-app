// apps/web/src/providers/auth-provider.profile-settled.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// profileSettled on the auth context: true once the CURRENT user's background profile read has
// finished — loaded, failed or thrown (a timeout aborts the read and lands in the same path) — and
// false again when the user changes until that user's read finishes. The real AuthProvider, driven
// with the mini hook runtime and a Supabase double whose onAuthStateChange the test fires.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

type Answer = { data: unknown; error: { message: string; code?: string } | null }
const h = vi.hoisted(() => ({
  onChange: null as null | ((event: string, session: unknown) => Promise<void>),
  /** How get_my_profile answers for the next read. */
  profile: null as null | (() => Promise<unknown>),
  /** The session refreshSession() returns (reconciliation). */
  refreshed: null as unknown,
}))
vi.mock('@/lib/supabase/client', () => {
  const client = {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => Promise<void>) => {
        h.onChange = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      refreshSession: async () => ({ data: { session: h.refreshed }, error: null }),
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
  h.refreshed = null
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

describe('a late profile read of another account never reaches the current one', () => {
  type P = { id?: string }
  const view = (m: { tree: () => unknown }) => {
    const c = ctx(m) as unknown as { user: { id: string } | null; profile: P | null; profileSettled: boolean }
    return { u: c.user?.id ?? null, settled: c.profileSettled, profile: c.profile?.id ?? null }
  }

  it('A\'s slow read answers AFTER B signed in and B\'s read ended: B keeps its own profile and stays settled', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    let releaseA: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (releaseA = r))
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    await h.onChange!('SIGNED_OUT', null)
    await m.flush()
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'B' }], error: null })
    await h.onChange!('SIGNED_IN', { user: { id: 'B' } })
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: true, profile: 'B' })
    releaseA({ data: [{ id: 'A' }], error: null })
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: true, profile: 'B' })
  })

  it('A\'s slow read answers BEFORE B\'s: B is not settled by it and does not get A\'s profile', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    let releaseA: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (releaseA = r))
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    await h.onChange!('SIGNED_OUT', null)
    await m.flush()
    let releaseB: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (releaseB = r))
    await h.onChange!('SIGNED_IN', { user: { id: 'B' } })
    await m.flush()
    releaseA({ data: [{ id: 'A' }], error: null })
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: false, profile: null })
    releaseB({ data: [{ id: 'B' }], error: null })
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: true, profile: 'B' })
  })

  it('A\'s slow read FAILS after B signed in: B keeps its profile', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    let failA: (e: unknown) => void = () => {}
    h.profile = () => new Promise<Answer>((_r, rej) => (failA = rej))
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    await h.onChange!('SIGNED_OUT', null)
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'B' }], error: null })
    await h.onChange!('SIGNED_IN', { user: { id: 'B' } })
    await m.flush()
    failA(new Error('late'))
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: true, profile: 'B' })
  })
})

describe('signing out drops a profile read still running', () => {
  it('A\'s read answers after A signed out (nobody signed in): no profile is set, nothing is settled', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    let releaseA: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (releaseA = r))
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    await h.onChange!('SIGNED_OUT', null)
    await m.flush()
    releaseA({ data: [{ id: 'A' }], error: null })
    await m.flush()
    expect(ctx(m)).toMatchObject({ user: null, profile: null, profileSettled: false })
  })
})

describe('server-seeded user', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('auth stalls (no auth event; the 10 s safety valve fires): the seeded user counts as settled', () => {
    vi.useFakeTimers()
    const m = mount(() => AuthProvider({ children: null, initialUser: { id: 'u1', email: null, is_anonymous: false } }))
    expect(ctx(m)).toMatchObject({ user: { id: 'u1' }, profileSettled: false })
    vi.advanceTimersByTime(10_000)
    m.rerender()
    expect(ctx(m)).toMatchObject({ user: { id: 'u1' }, profileSettled: true })
  })

  it('reconciliation: a guest client session behind the u1 cookie adopts u1 and its read settles u1', async () => {
    h.refreshed = { user: { id: 'u1', is_anonymous: false } }
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'u1' }], error: null })
    const m = mount(() => AuthProvider({ children: null, initialUser: { id: 'u1', email: null, is_anonymous: false } }))
    await h.onChange!('INITIAL_SESSION', { user: { id: 'guest-1', is_anonymous: true } })
    await m.flush()
    expect(ctx(m)).toMatchObject({ user: { id: 'u1' }, profileSettled: true })
  })
})
