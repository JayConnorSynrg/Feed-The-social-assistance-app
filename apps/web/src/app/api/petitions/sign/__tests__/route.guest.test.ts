// route.guest.test.ts — vitest unit test for the /api/petitions/sign guest guard
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Wave: feed-fullfeed-p2-0-integrity (Invariant I2 — a guest is_anonymous user can
// write no user-data row). The route inserts petition_signatures via a service-role
// client (bypasses RLS), so the guest block is enforced in-code. This test drives the
// REAL POST handler with mocked Supabase clients and asserts:
//   1. is_anonymous user → 403 account_required, and the service-role INSERT is
//      NEVER called.
//   2. a normal authenticated user → 200 and the INSERT is called exactly once.
// Mutation-check: deleting the `user.is_anonymous` guard in route.ts makes case 1 fail.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  user: null as { id: string; is_anonymous: boolean } | null,
  insert: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
  }),
}))

vi.mock('@supabase/supabase-js', () => {
  const makeQuery = (data: unknown) => {
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = () => q
    q.abortSignal = () => q
    q.single = async () => ({ data, error: null })
    return q
  }
  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === 'petitions')
          return makeQuery({ id: 'p1', body_version_hash: 'v-hash', status: 'approved' })
        if (table === 'profiles')
          return makeQuery({ first_name: 'Ada', username: 'ada', full_name: 'Ada Lovelace' })
        if (table === 'petition_signatures') return { insert: h.insert }
        return makeQuery(null)
      },
      rpc: async () => ({ data: 1, error: null }),
    }),
  }
})

// Imported AFTER the mocks are registered.
import { POST } from '../route'

function makeReq(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  h.insert.mockClear()
})

describe('petition sign route — guest guard (I2)', () => {
  it('anonymous (is_anonymous) user → 403 account_required, INSERT never called', async () => {
    h.user = { id: 'u-anon', is_anonymous: true }
    const res = await POST(makeReq({ petitionId: 'p1', affirmed: true }))
    expect(res.status).toBe(403)
    const json = (await res.json()) as { error?: string; message?: string }
    expect(json.error).toBe('account_required')
    expect(json.message).toBeTruthy()
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('normal authenticated user → 200 ok, INSERT called exactly once', async () => {
    h.user = { id: 'u-real', is_anonymous: false }
    const res = await POST(makeReq({ petitionId: 'p1', affirmed: true }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok?: boolean }
    expect(json.ok).toBe(true)
    expect(h.insert).toHaveBeenCalledTimes(1)
  })
})
