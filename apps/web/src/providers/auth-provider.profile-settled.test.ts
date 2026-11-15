// apps/web/src/providers/auth-provider.profile-settled.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// profileSettled on the auth context: true once the CURRENT user's background profile read has
// finished — loaded, failed or thrown (a timeout aborts the read and lands in the same path) — and
// false again when the user changes until that user's read finishes. The real AuthProvider, driven
// with the mini hook runtime and a Supabase double whose onAuthStateChange the test fires.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
const logged = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>)
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => logged.push([name, attrs]),
  withMetric: async (_op: string, _attrs: unknown, fn: () => Promise<unknown>) => fn(),
}))

type Answer = { data: unknown; error: { message: string; code?: string } | null }
const h = vi.hoisted(() => ({
  onChange: null as null | ((event: string, session: unknown) => Promise<void>),
  /** How get_my_profile answers for the next read. */
  profile: null as null | (() => Promise<unknown>),
  /** The session refreshSession() returns (reconciliation). */
  refreshed: null as unknown,
  /** How the profiles UPDATE … RETURNING id answers (a language save). */
  write: null as null | (() => Promise<unknown>),
  rpcCalls: [] as string[],
  /** Every profiles UPDATE payload. */
  updates: [] as unknown[],
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
    from: () => ({
      update: (values: unknown) => {
        h.updates.push(values)
        // updateProfile awaits .eq() itself (no error); a language save goes on to .select('id').
        return { eq: () => ({ error: null, select: () => ({ abortSignal: () => h.write!() }) }) }
      },
    }),
    rpc: (name: string) => (h.rpcCalls.push(name), {
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
  h.write = null
  h.rpcCalls = []
  h.updates = []
  logged.length = 0
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

describe('sign-out and account switch never carry one account\'s state to the next', () => {
  type P = { id?: string }
  const view = (m: { tree: () => unknown }) => {
    const c = ctx(m) as unknown as { user: { id: string } | null; profile: P | null; profileSettled: boolean }
    return { u: c.user?.id ?? null, settled: c.profileSettled, profile: c.profile?.id ?? null }
  }

  it('the same account signs out and back in: not settled until its NEW read ends', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'A' }], error: null })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    await h.onChange!('SIGNED_OUT', null)
    await m.flush()
    expect(view(m)).toEqual({ u: null, settled: false, profile: null })
    let release: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (release = r))
    await h.onChange!('SIGNED_IN', { user: { id: 'A' } })
    await m.flush()
    expect(view(m)).toEqual({ u: 'A', settled: false, profile: null })
    release({ data: [{ id: 'A' }], error: null })
    await m.flush()
    expect(view(m)).toEqual({ u: 'A', settled: true, profile: 'A' })
  })

  it('direct switch A → B (no sign-out): A\'s profile is gone at once; B unsettled with no profile until its read ends', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'A' }], error: null })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    expect(view(m)).toEqual({ u: 'A', settled: true, profile: 'A' })
    let release: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (release = r))
    await h.onChange!('SIGNED_IN', { user: { id: 'B' } })
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: false, profile: null })
    release({ data: [{ id: 'B' }], error: null })
    await m.flush()
    expect(view(m)).toEqual({ u: 'B', settled: true, profile: 'B' })
  })

  it('a re-read for the SAME user (USER_UPDATED) keeps the profile throughout', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'A' }], error: null })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
    await m.flush()
    let release: (a: Answer) => void = () => {}
    h.profile = () => new Promise<Answer>((r) => (release = r))
    await h.onChange!('USER_UPDATED', { user: { id: 'A' } })
    await m.flush()
    expect(view(m)).toEqual({ u: 'A', settled: true, profile: 'A' })
    release({ data: [{ id: 'A' }], error: null })
    await m.flush()
    expect(view(m)).toEqual({ u: 'A', settled: true, profile: 'A' })
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

describe('the language in memory (the locale every surface reads)', () => {
  type C = { profile: { id: string; preferred_language?: string | null } | null; saveLanguage: (c: string) => Promise<string> }
  const c = (m: { tree: () => unknown }) => ctx(m) as unknown as C
  const signedIn = async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'u1', preferred_language: 'en' }], error: null })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    return m
  }
  const profileReads = () => h.rpcCalls.filter((n) => n === 'get_my_profile').length

  it('save 한국어: the profile is Korean while the write runs and after it, with no profile re-read', async () => {
    const m = await signedIn()
    const readsBefore = profileReads()
    let answer: (a: unknown) => void = () => {}
    h.write = () => new Promise((r) => (answer = r))
    const done = c(m).saveLanguage('ko')
    await m.flush()
    expect(c(m).profile?.preferred_language).toBe('ko')
    answer({ data: [{ id: 'u1' }], error: null })
    expect(await done).toBe('ok')
    await m.flush()
    expect(c(m).profile?.preferred_language).toBe('ko')
    expect(profileReads()).toBe(readsBefore)
  })

  it('a save that updates no row: the profile is English again', async () => {
    const m = await signedIn()
    h.write = () => Promise.resolve({ data: [], error: null })
    expect(await c(m).saveLanguage('ko')).toBe('no_row')
    await m.flush()
    expect(c(m).profile?.preferred_language).toBe('en')
  })

  it('the tab comes back (SIGNED_IN) and the re-read fails: the profile, and its Korean, stay', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = () => Promise.resolve<Answer>({ data: [{ id: 'u1', preferred_language: 'ko' }], error: null })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    h.profile = () => Promise.resolve<Answer>({ data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } })
    await h.onChange!('SIGNED_IN', { user: { id: 'u1' } })
    await m.flush()
    expect(c(m).profile).toMatchObject({ id: 'u1', preferred_language: 'ko' })
    h.profile = () => Promise.reject(new Error('network'))
    await h.onChange!('USER_UPDATED', { user: { id: 'u1' } })
    await m.flush()
    expect(c(m).profile).toMatchObject({ id: 'u1', preferred_language: 'ko' })
  })

  it('one auth.profile.read row per read, with its trigger and outcome', async () => {
    const m = await signedIn()
    h.profile = () => Promise.resolve<Answer>({ data: null, error: { message: 'boom' } })
    await h.onChange!('SIGNED_IN', { user: { id: 'u1' } })
    await m.flush()
    const reads = logged.filter(([n]) => n === 'auth.profile.read').map(([, a]) => [a.trigger, a.outcome, a.had_language])
    expect(reads).toEqual([
      ['INITIAL_SESSION', 'ok', true],
      ['SIGNED_IN', 'error', false],
    ])
  })
})

describe('the fix round: no profile, re-reads, a read mid-save, a switch mid-save', () => {
  type C = {
    profile: { id: string; preferred_language?: string | null; full_name?: string } | null
    profileOrigin: string | null
    saveLanguage: (c: string) => Promise<string>
    refreshSession: () => Promise<void>
    updateProfile: (u: Record<string, unknown>) => Promise<void>
  }
  const c = (m: { tree: () => unknown }) => ctx(m) as unknown as C
  const fails = () => Promise.resolve<Answer>({ data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } })
  const loads = (row: Record<string, unknown>) => () => Promise.resolve<Answer>({ data: [row], error: null })

  it('no profile in memory (its read failed), save 한국어: the profile is read now and the screen switches', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = fails
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    expect(c(m).profile).toBeNull()
    h.profile = loads({ id: 'u1', preferred_language: 'en' })
    h.write = () => Promise.resolve({ data: [{ id: 'u1' }], error: null })
    expect(await c(m).saveLanguage('ko')).toBe('ok')
    await m.flush()
    expect(c(m).profile?.preferred_language).toBe('ko')
    expect(h.updates).toEqual([{ preferred_language: 'ko' }])
  })

  it('no profile in memory and it still cannot be read: a failure, and nothing is written', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = fails
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    h.write = () => Promise.resolve({ data: [{ id: 'u1' }], error: null })
    expect(await c(m).saveLanguage('ko')).toBe('no_profile')
    await m.flush()
    expect(c(m).profile).toBeNull()
    expect(h.updates).toEqual([])
  })

  it('refreshSession whose re-read fails keeps the loaded profile', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = loads({ id: 'u1', preferred_language: 'ko', full_name: 'Min' })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    h.refreshed = { user: { id: 'u1' } }
    h.profile = fails
    await c(m).refreshSession()
    await m.flush()
    expect(c(m).profile).toMatchObject({ id: 'u1', preferred_language: 'ko', full_name: 'Min' })
  })

  it('updateProfile whose re-read fails keeps the loaded profile', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = loads({ id: 'u1', preferred_language: 'ko', full_name: 'Min' })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    h.profile = fails
    await c(m).updateProfile({ bio: 'hello' })
    await m.flush()
    expect(h.updates).toEqual([{ bio: 'hello' }])
    expect(c(m).profile).toMatchObject({ id: 'u1', preferred_language: 'ko', full_name: 'Min' })
  })

  it('a profile read that lands mid-save keeps the new language on screen, origin still save', async () => {
    const m = mount(() => AuthProvider({ children: null }))
    h.profile = loads({ id: 'u1', preferred_language: 'en' })
    await h.onChange!('INITIAL_SESSION', { user: { id: 'u1' } })
    await m.flush()
    let answer: (a: unknown) => void = () => {}
    h.write = () => new Promise((r) => (answer = r))
    const done = c(m).saveLanguage('ko')
    await m.flush()
    // The tab comes back while the write runs; the database still says English.
    await h.onChange!('SIGNED_IN', { user: { id: 'u1' } })
    await m.flush()
    expect(c(m).profile?.preferred_language).toBe('ko')
    expect(c(m).profileOrigin).toBe('save')
    answer({ data: [{ id: 'u1' }], error: null })
    expect(await done).toBe('ok')
    await m.flush()
    expect(c(m).profile?.preferred_language).toBe('ko')
  })

  it("an account switch mid-save: the previous member's cookie is not written, the new member's profile is untouched", async () => {
    const jar = { cookie: '' }
    vi.stubGlobal('document', jar)
    vi.stubGlobal('location', { protocol: 'https:' })
    try {
      const m = mount(() => AuthProvider({ children: null }))
      h.profile = loads({ id: 'A', preferred_language: 'en' })
      await h.onChange!('INITIAL_SESSION', { user: { id: 'A' } })
      await m.flush()
      let answer: (a: unknown) => void = () => {}
      h.write = () => new Promise((r) => (answer = r))
      const done = c(m).saveLanguage('ko')
      await m.flush()
      h.profile = loads({ id: 'B', preferred_language: 'es' })
      await h.onChange!('SIGNED_IN', { user: { id: 'B' } })
      await m.flush()
      answer({ data: [{ id: 'A' }], error: null })
      expect(await done).toBe('ok')
      await m.flush()
      expect(jar.cookie).toBe('')
      expect(c(m).profile).toMatchObject({ id: 'B', preferred_language: 'es' })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
