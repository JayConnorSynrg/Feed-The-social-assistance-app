// apps/web/src/hooks/use-petitions.codes.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The REAL usePetitions hook, mounted, with a faked Supabase client and a faked fetch: a failure
// is reported as a code, and the sign route's own error code is the one that reaches signError.
// (The panel turns a code into a sentence: components/panels/petitions-panel.i18n.test.ts.)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { db } = vi.hoisted(() => ({
  db: {
    rows: [] as unknown[],
    loadError: null as unknown,
    signed: false,
    count: 3,
    withdrawError: null as unknown,
  },
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ loading: false }) }))
vi.mock('@/lib/vault', () => ({ QUERY_TIMEOUT_MS: 1000 }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => {
  const list = { select: () => list, eq: () => list, order: () => list, abortSignal: async () => (db.loadError ? { data: null, error: db.loadError } : { data: db.rows, error: null }) }
  const channel = { on: () => channel, subscribe: () => channel }
  const client = {
    from: () => list,
    rpc: (fn: string) => {
      if (fn === 'withdraw_petition_signature') return Promise.resolve(db.withdrawError ? { data: null, error: db.withdrawError } : { data: db.count - 1, error: null })
      return Promise.resolve({ data: fn === 'has_signed_petition' ? db.signed : db.count, error: null })
    },
    channel: () => channel,
    removeChannel: () => {},
  }
  return { createClient: () => client }
})

import { mount } from '@/test/mini-react'
import { usePetitions } from './use-petitions'

const PETITION = { id: 'p1', title: 'Save the park', summary: 's', body: 'b', cause_category: null, external_ref: null, target_signatures: 10, body_version_hash: 'h', status: 'approved', created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: null, exported_at: null, exported_by: null }
const respond = (status: number, body: unknown) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response)

async function loaded() {
  const c = mount(() => usePetitions())
  await c.flush()
  return c
}

beforeEach(() => {
  db.rows = [PETITION]
  db.loadError = null
  db.signed = false
  db.count = 3
  db.withdrawError = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('usePetitions reports codes', () => {
  it('a failed read: error is load_failed', async () => {
    db.loadError = new Error('permission denied for table petitions')
    const c = await loaded()
    expect(c.rerender().error).toBe('load_failed')
    expect(c.tree().petitions).toEqual([])
  })

  it.each([
    [403, { error: 'account_required', message: 'Sign in with an account to add your verified signature of support.' }, 'account_required'],
    [400, { error: 'affirmation_required', message: 'You must affirm to add your verified signature of support.' }, 'affirmation_required'],
    [404, { error: 'petition_not_found' }, 'petition_not_found'],
    [500, { error: 'sign_failed' }, 'sign_failed'],
    [500, {}, 'sign_failed'],
  ])('sign refused with %i %j: signError is %s, never the English message, and the optimistic signature is rolled back', async (status, body, code) => {
    vi.stubGlobal('fetch', respond(status, body))
    const c = await loaded()
    expect(c.tree().petitions[0]).toMatchObject({ hasSigned: false, signatureCount: 3 })
    await c.tree().sign('p1')
    await c.flush()
    const after = c.rerender()
    expect(after.signError).toBe(code)
    expect(after.petitions[0]).toMatchObject({ hasSigned: false, signatureCount: 3 })
    expect(after.signingId).toBeNull()
  })

  it('sign accepted: no error, the server count is kept', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true, alreadySigned: false, count: 4 }))
    const c = await loaded()
    await c.tree().sign('p1')
    await c.flush()
    const after = c.rerender()
    expect(after.signError).toBeNull()
    expect(after.petitions[0]).toMatchObject({ hasSigned: true, signatureCount: 4 })
  })

  it.each([
    [new Error('signatures are locked: the list was exported'), 'withdraw_locked'],
    [new Error('petition list already exported'), 'withdraw_locked'],
    [new Error('connection reset'), 'withdraw_failed'],
  ])('withdraw refused (%s): signError is %s', async (error, code) => {
    db.signed = true
    db.withdrawError = error
    const c = await loaded()
    expect(c.tree().petitions[0].hasSigned).toBe(true)
    await c.tree().withdraw('p1')
    await c.flush()
    expect(c.rerender().signError).toBe(code)
  })
})
