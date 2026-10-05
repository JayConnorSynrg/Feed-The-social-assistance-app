// route.privacy.test.ts — a denied ban persists its outcome but never the subject user id.
// The durable admin_actions row (via record_admin_action) records the target; the
// app_logs row joins to it by request_id and carries no target_id.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const TARGET = '11111111-2222-4333-8444-555555555555'
const ACTOR = '99999999-8888-4777-8666-555555555555'

type Row = { level: string; event: string; context: Record<string, unknown>; request_id?: string }
const logRows: Row[] = []
const auditCalls: Array<Record<string, unknown>> = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      if (fn === 'record_admin_action') auditCalls.push(args)
      return Promise.resolve({ error: null })
    },
    from: (table: string) =>
      table === 'app_logs'
        ? { insert: (row: Row) => { logRows.push(row); return Promise.resolve({ error: null }) } }
        : { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { admin_tier: 'platform_admin' }, error: null }) }) }) },
    auth: { admin: { updateUserById: vi.fn() } },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ACTOR } } }) },
    rpc: async () => ({ data: 'platform_admin' }),
  }),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-request-id': 'rid-ban-1' }) }))

import { POST } from './route'

beforeEach(() => {
  logRows.length = 0
  auditCalls.length = 0
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('POST /api/admin/users/[id]/ban — denied ban', () => {
  it('writes one admin.user.ban.denied row with no user id; the audit row keeps the target', async () => {
    const res = await POST(new Request('http://localhost/api/admin/users/x/ban', { method: 'POST', body: '{"ban_duration":"876000h"}' }), {
      params: Promise.resolve({ id: TARGET }),
    })
    expect(res.status).toBe(403) // a platform admin cannot ban another platform admin
    await vi.waitFor(() => expect(logRows.length).toBeGreaterThan(0))
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))

    const denied = logRows.filter((r) => r.event === 'admin.user.ban.denied')
    expect(denied).toHaveLength(1)
    expect(denied[0]).toMatchObject({ request_id: 'rid-ban-1', context: { outcome: 'denied', code: 'target_tier', actor_tier: 'platform_admin' } })
    expect(JSON.stringify(logRows)).not.toContain(TARGET)
    expect(JSON.stringify(logRows)).not.toContain(ACTOR)
    // control: the durable audit record (not app_logs) is where the target lives
    expect(auditCalls).toHaveLength(1)
    expect(auditCalls[0]).toMatchObject({ p_target_id: TARGET, p_outcome: 'denied', p_request_id: 'rid-ban-1' })
  })
})
