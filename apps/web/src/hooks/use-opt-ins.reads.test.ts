// apps/web/src/hooks/use-opt-ins.reads.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Two answers of the opt-in hook that a caller must not misread. The REAL hook with a faked client:
//   - a read of the member's own statuses says "the read failed" apart from "no opt-ins" (a
//     caller that wrote an empty map for a failed read showed Opt In on posts the member is
//     signed up to);
//   - withdraw answers true only when withdraw_opt_in deleted a row; false — no row was pending —
//     comes back as false, with no error, and is not a success.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state, rpc } = vi.hoisted(() => ({
  state: { user: { id: 'me' } as { id: string } | null, rows: [] as Array<{ post_id: string; status: string }>, error: null as unknown, throws: false, seen: [] as unknown[] },
  rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => {
  const chain: Record<string, unknown> = {
    select: (cols: string) => (state.seen.push(['select', cols]), chain),
    in: (col: string, ids: string[]) => (state.seen.push(['in', col, ids]), chain),
    eq: (col: string, v: string) => (state.seen.push(['eq', col, v]), chain),
    abortSignal: () => chain,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => (state.throws ? Promise.reject(new Error('network')) : Promise.resolve({ data: state.error ? null : state.rows, error: state.error })).then(res, rej),
  }
  const client = { rpc, auth: { getUser: async () => ({ data: { user: state.user } }) }, from: (t: string) => (state.seen.push(['from', t]), chain) }
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { mount } from '@/test/mini-react'
import { useOptIns } from './use-opt-ins'

const hook = () => mount(() => useOptIns())

beforeEach(() => {
  state.user = { id: 'me' }
  state.rows = []
  state.error = null
  state.throws = false
  state.seen.length = 0
  rpc.mockReset()
})

describe('my statuses: "the read failed" is not "no opt-ins"', () => {
  it('a read that went through: the statuses of the posts asked about; one request, by post and by me', async () => {
    state.rows = [{ post_id: 'p1', status: 'pending' }, { post_id: 'p2', status: 'accepted' }]
    const read = await hook().tree().fetchOptInsForPosts(['p1', 'p2', 'p3'])
    expect(read).toEqual({ ok: true, statuses: new Map([['p1', 'pending'], ['p2', 'accepted']]) })
    expect(state.seen).toEqual([['from', 'resource_opt_ins'], ['select', 'post_id, status'], ['in', 'post_id', ['p1', 'p2', 'p3']], ['eq', 'seeker_id', 'me']])
  })

  it('no opt-ins: ok, with an empty map', async () => {
    expect(await hook().tree().fetchOptInsForPosts(['p1'])).toEqual({ ok: true, statuses: new Map() })
  })

  it.each([['an error from the read', () => void (state.error = { code: '57014', message: 'timeout' })], ['a thrown one', () => void (state.throws = true)]])('%s: not ok — and never an empty map', async (_name, arrange) => {
    arrange()
    const read = await hook().tree().fetchOptInsForPosts(['p1'])
    expect(read).toEqual({ ok: false })
    expect('statuses' in read).toBe(false)
  })

  it('nothing asked, or nobody signed in: ok and empty, with no request', async () => {
    expect(await hook().tree().fetchOptInsForPosts([])).toEqual({ ok: true, statuses: new Map() })
    state.user = null
    expect(await hook().tree().fetchOptInsForPosts(['p1'])).toEqual({ ok: true, statuses: new Map() })
    expect(state.seen).toEqual([])
  })
})

describe('withdraw: true only when a row was deleted', () => {
  it.each([[true, true], [false, false], [null, false]])('withdraw_opt_in answers %j: the hook answers %j, and throws nothing', async (answer, expected) => {
    rpc.mockResolvedValue({ data: answer, error: null })
    expect(await hook().tree().withdrawOptIn('p1')).toBe(expected)
    expect(rpc.mock.calls).toEqual([['withdraw_opt_in', { p_post_id: 'p1' }]])
  })
})
