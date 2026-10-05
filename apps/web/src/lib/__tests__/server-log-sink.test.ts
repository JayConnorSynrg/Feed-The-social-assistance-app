// server-log-sink.test.ts — the SERVER branch of the logger sink (window undefined).
// Asserts what actually reaches app_logs: the captured service-role insert.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Row = { level: string; event: string; context: Record<string, unknown>; request_id?: string; duration_ms?: number | null }
const inserted: Row[] = []
let rejectInsert = false
const insertCalls = { n: 0 }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (row: Row) => {
        insertCalls.n++
        if (table === 'app_logs') inserted.push(row)
        return rejectInsert ? Promise.reject(new Error('db down')) : Promise.resolve({ error: null })
      },
    }),
  }),
}))

import { logger } from '@/lib/logger'
import { onRequestError } from '@/instrumentation'
import { GET as oauthCallback } from '@/app/auth/callback/route'

const flush = () => new Promise((r) => setTimeout(r, 0))
async function settle(expected: number) {
  await vi.waitFor(() => expect(insertCalls.n).toBeGreaterThanOrEqual(expected))
  // let any stray detached writes land before asserting "exactly"
  for (let i = 0; i < 5; i++) await flush()
}

beforeEach(() => {
  inserted.length = 0
  insertCalls.n = 0
  rejectInsert = false
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('onRequestError — one PII-free request.error row', () => {
  it('writes exactly one row with the request id and only route-level fields', async () => {
    expect(typeof window).toBe('undefined')
    await onRequestError(
      new Error('a@b.org'),
      { path: '/x', method: 'GET', headers: { 'x-request-id': 'rid1' } },
      { routePath: '/p/[id]', routeType: 'render', routerKind: 'App Router', renderSource: 'react-server-components', revalidateReason: undefined }
    )
    await settle(1)
    expect(insertCalls.n).toBe(1)
    const row = inserted[0]
    expect(row).toMatchObject({ level: 'error', event: 'request.error', request_id: 'rid1' })
    const allowed = ['error_code', 'route', 'route_type', 'method', 'digest']
    expect(Object.keys(row.context).filter((k) => !allowed.includes(k))).toEqual([])
    expect(row.context).toMatchObject({ route: '/p/[id]', route_type: 'render', method: 'GET', error_code: 'Error' })
    expect(JSON.stringify(row)).not.toContain('a@b.org')
  })

  it('a rejecting insert never throws to the caller and is attempted exactly once', async () => {
    rejectInsert = true
    expect(() =>
      onRequestError(
        new Error('boom'),
        { path: '/x', method: 'POST', headers: {} },
        { routePath: '/api/x', routeType: 'route', routerKind: 'App Router', revalidateReason: undefined }
      )
    ).not.toThrow()
    await settle(1)
    expect(insertCalls.n).toBe(1)
  })
})

describe('server logger.error — closed vocabulary + no stack', () => {
  it('an unregistered event writes no row', async () => {
    logger.error('x', new Error('boom'))
    logger.error('post.image.upload', new Error('boom')) // registered control
    await settle(1)
    expect(insertCalls.n).toBe(1)
    expect(inserted.map((r) => r.event)).toEqual(['post.image.upload'])
  })

  it('a registered error row carries error_code/error_message but never the stack', async () => {
    logger.error('post.image.upload', new Error('boom'))
    await settle(1)
    expect(inserted[0].context).toEqual({ error_code: 'Error', error_name: 'Error', error_message: 'boom' })
    expect(inserted[0].context).not.toHaveProperty('stack')
  })

  it('unregistered label keys and free text are dropped on the server path too', async () => {
    logger.error('oauth.callback.provider_error', undefined, {
      error: 'x',
      error_description: 'attacker text a@b.org',
      userId: 'u-1',
      provider_error: 'access_denied',
    })
    await settle(1)
    expect(inserted[0].context).toEqual({ error_code: 'UnknownError', provider_error: 'access_denied' })
    expect(JSON.stringify(inserted[0])).not.toContain('attacker')
  })
})

describe('GET /auth/callback — caller-supplied error text is never persisted', () => {
  it('?error=<x>&error_description=<attacker text> stores only a closed code + presence flag', async () => {
    const res = await oauthCallback(
      new Request('http://localhost/auth/callback?error=x&error_description=' + encodeURIComponent('<script>attacker a@b.org</script>'))
    )
    expect(res.status).toBe(307)
    await settle(1)
    const rows = inserted.filter((r) => r.event === 'oauth.callback.provider_error')
    expect(rows).toHaveLength(1)
    expect(rows[0].context).toEqual({ error_code: 'UnknownError', provider_error: 'other', has_description: true })
    expect(JSON.stringify(inserted)).not.toMatch(/attacker|a@b\.org|<script/)
  })
})
