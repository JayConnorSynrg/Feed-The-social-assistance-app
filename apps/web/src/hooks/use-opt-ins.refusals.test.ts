// apps/web/src/hooks/use-opt-ins.refusals.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What the opt-in hook reports when opt_in_to_post refuses. The REAL hook with a faked client:
//   - a refusal the member can act on ("This offer is full", …) is handed on as it is, so the
//     card can say it in the member's language (it used to become the plain "Couldn't opt in");
//   - every other server text still becomes the plain failure and is never shown;
//   - a permission or a network failure still reads as the general sentence;
//   - the call itself is unchanged: one opt_in_to_post / withdraw_opt_in with the post id.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }))

import { mount } from '@/test/mini-react'
import { OPT_IN_REFUSALS, useOptIns } from './use-opt-ins'
import { optInErrorText } from '@/lib/i18n-feed-optins'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const hook = () => mount(() => useOptIns())
const thrown = async (run: () => Promise<unknown>) => {
  try {
    await run()
  } catch (err) {
    return err instanceof Error ? err.message : `not an Error: ${String(err)}`
  }
  return 'did not throw'
}

beforeEach(() => rpc.mockReset())

describe('opt in: what the hook reports', () => {
  it.each([...OPT_IN_REFUSALS])('"%s" is handed on as it is, and the card has the member\'s sentence for it', async (refusal) => {
    rpc.mockResolvedValue({ data: null, error: { message: refusal, code: 'P0001' } })
    const h = hook()
    expect(await thrown(() => h.tree().optIn('p1'))).toBe(refusal)
    expect(h.rerender().error).toBe(refusal)
    expect(optInErrorText(refusal, 'es').translated).toBe(true)
    expect(optInErrorText(refusal, 'es').text).not.toBe(refusal)
  })

  it.each(['Post not found', 'Not authenticated', 'duplicate key value violates unique constraint "x"', 'This offer is full.', 'this offer is full'])(
    'any other server text ("%s") becomes the plain failure',
    async (message) => {
      rpc.mockResolvedValue({ data: null, error: { message, code: 'P0001' } })
      expect(await thrown(() => hook().tree().optIn('p1'))).toBe("Couldn't opt in. Please try again.")
    },
  )

  it('a refused permission and a lost connection still read as the general sentences', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Account required for this action', code: '42501' } })
    expect(await thrown(() => hook().tree().optIn('p1'))).toBe("You don't have permission to view this right now. Please try again or contact support.")
    rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    expect(await thrown(() => hook().tree().optIn('p1'))).toBe("We're having trouble connecting. Please check your connection and try again.")
  })

  it('success returns the row; the call is opt_in_to_post with the post id', async () => {
    rpc.mockResolvedValue({ data: { id: 'o1', post_id: 'p1', status: 'pending' }, error: null })
    expect(await hook().tree().optIn('p1')).toEqual({ id: 'o1', post_id: 'p1', status: 'pending' })
    expect(rpc.mock.calls).toEqual([['opt_in_to_post', { p_post_id: 'p1' }]])
  })
})

describe('withdraw: unchanged', () => {
  it('any failure is the plain withdraw failure; the call is withdraw_opt_in with the post id', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'This offer is full', code: 'P0001' } })
    expect(await thrown(() => hook().tree().withdrawOptIn('p1'))).toBe("Couldn't withdraw opt-in. Please try again.")
    rpc.mockResolvedValue({ data: true, error: null })
    expect(await hook().tree().withdrawOptIn('p1')).toBe(true)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['withdraw_opt_in', 'withdraw_opt_in'])
    expect(rpc.mock.calls[1]).toEqual(['withdraw_opt_in', { p_post_id: 'p1' }])
  })
})
