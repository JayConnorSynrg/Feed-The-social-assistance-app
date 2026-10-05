// route.test.ts — /api/client-log closed vocabulary + client-IP rate limit.
// Asserts outcomes at the persisted row (the captured app_logs insert), not at
// the HTTP status alone.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const inserted: Array<Record<string, unknown>> = []
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push({ table, ...row })
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

import { POST } from './route'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/client-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '198.51.100.1', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  inserted.length = 0
})

describe('POST /api/client-log — event allowlist', () => {
  it('accepts a registered event and persists it with only its registered labels', async () => {
    const res = await POST(
      req({ level: 'info', event: 'feed.load.complete', context: { mode: 'ranked', page: 0, userId: 'u-1', email: 'a@b.org' }, duration_ms: 42 })
    )
    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ table: 'app_logs', level: 'info', event: 'feed.load.complete', duration_ms: 42 })
    expect(inserted[0].context).toEqual({ mode: 'ranked', page: 0, _source: 'client' })
  })

  it('rejects an unknown event name and persists nothing', async () => {
    const res = await POST(req({ level: 'warn', event: 'totally.made.up', context: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'unknown_event' })
    expect(inserted).toHaveLength(0)
  })

  it('keeps error fields only on error-level rows and caps error_message at 120 chars', async () => {
    await POST(
      req({ level: 'error', event: 'feed.load.error', context: { mode: 'ranked', error_code: '42501', error_message: 'x'.repeat(500), stack: 'at foo' } })
    )
    expect(inserted[0].context).toEqual({ mode: 'ranked', error_code: '42501', error_message: 'x'.repeat(120), _source: 'client' })

    inserted.length = 0
    await POST(req({ level: 'warn', event: 'admin.tier.check_failed', context: { code: '42501', error_message: 'leak' } }))
    expect(inserted[0].context).toEqual({ code: '42501', _source: 'client' })
  })

  it('drops non-primitive label values', async () => {
    await POST(req({ level: 'info', event: 'feed.load.complete', context: { mode: { nested: true }, page: 1 } }))
    expect(inserted[0].context).toEqual({ page: 1, _source: 'client' })
  })
})

describe('POST /api/client-log — rate limit keyed by client IP only', () => {
  it('a client rotating x-federation-instance still hits its per-IP limit (120/min)', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 121; i++) {
      const r = await POST(
        req({ level: 'info', event: 'feed.load.complete', context: {} }, { 'x-real-ip': '203.0.113.7', 'x-federation-instance': `spoof-${i}` })
      )
      statuses.push(r.status)
    }
    expect(statuses.slice(0, 120).every((s) => s === 200)).toBe(true)
    expect(statuses[120]).toBe(429)

    // A different client IP has its own budget.
    const other = await POST(req({ level: 'info', event: 'feed.load.complete', context: {} }, { 'x-real-ip': '203.0.113.8' }))
    expect(other.status).toBe(200)
  })
})
