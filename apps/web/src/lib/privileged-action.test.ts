// privileged-action.test.ts
// CONTROL: privilegedRpc mints one id, sends it as x-request-id, and shares it with withMetric.
// GUARD: no audited privileged RPC is called bare (bypassing the helper) anywhere in src.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// --- withMetric mock captures the correlation plumbing ------------------------------------------
const metricCalls: Array<{ op: string; attrs: Record<string, unknown>; rid?: string }> = []
vi.mock('@/lib/logger', () => ({
  withMetric: vi.fn(async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>, rid?: string) => {
    metricCalls.push({ op, attrs, rid })
    return fn()
  }),
}))

import { privilegedRpc, privilegedFetch, newRequestId } from './privileged-action'

beforeEach(() => {
  metricCalls.length = 0
})

describe('privilegedRpc (control — proves the guard targets real plumbing)', () => {
  it('mints one id, sets it as x-request-id, and passes the SAME id to withMetric', async () => {
    const header: Array<[string, string]> = []
    const fakeSupabase = {
      rpc: (_n: string, _a: Record<string, unknown>) => ({
        setHeader: (k: string, v: string) => {
          header.push([k, v])
          return Promise.resolve({ data: { ok: true }, error: null })
        },
      }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await privilegedRpc(fakeSupabase as any, 'admin.post.remove', 'admin_remove_post', { p_post_id: '1' }, { target_id: '1' })

    expect(header).toHaveLength(1)
    expect(header[0][0]).toBe('x-request-id')
    const rid = header[0][1]
    expect(metricCalls).toHaveLength(1)
    expect(metricCalls[0].op).toBe('admin.post.remove')
    expect(metricCalls[0].rid).toBe(rid)
    expect(metricCalls[0].attrs.request_id).toBe(rid)
    expect(res.requestId).toBe(rid)
    expect(res.data).toEqual({ ok: true })
  })
})

describe('privilegedFetch (control)', () => {
  it('sends x-request-id and shares it with withMetric', async () => {
    const seen: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = vi.fn(async (_url: string, init: RequestInit) => {
      Object.assign(seen, init.headers)
      return new Response('{}', { status: 200 })
    })
    const { requestId } = await privilegedFetch('admin.user.ban', '/api/admin/users/x/ban', { method: 'POST' }, { target_id: 'x' })
    expect(seen['x-request-id']).toBe(requestId)
    expect(metricCalls[0].rid).toBe(requestId)
  })
})

describe('newRequestId', () => {
  it('produces a bounded token that request_id() will accept (<=64, [A-Za-z0-9_-])', () => {
    const id = newRequestId()
    expect(id.length).toBeLessThanOrEqual(64)
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

// --- source guard -------------------------------------------------------------------------------
// Every AUDITED privileged RPC (writes an admin_actions row) must go through privilegedRpc. Bare
// supabase.rpc('<name>') for these outside the helper + tests is a T5 bypass. Read-only list RPCs
// (admin_list_*, current_user_tier, is_founder) are intentionally excluded.
const AUDITED = [
  'admin_remove_post', 'admin_hold_post', 'admin_authorize_post', 'admin_resolve_report',
  'admin_verify_safety_alert', 'admin_remove_safety_alert', 'approve_resource', 'reject_resource',
  'admin_update_resource', 'approve_form_template', 'admin_set_tier',
]

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__' || e.name === 'smoke') continue
      walk(full, acc)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.smoke\.ts$/.test(e.name)) {
      acc.push(full)
    }
  }
  return acc
}

describe('T5 source guard — no audited privileged RPC bypasses privilegedRpc', () => {
  it('finds zero bare supabase.rpc calls to an audited privileged fn', () => {
    const srcRoot = path.resolve(__dirname, '..')
    const offenders: string[] = []
    const rpcRe = /\.rpc\(\s*['"]([a-z_]+)['"]/g
    for (const file of walk(srcRoot)) {
      if (file.endsWith(path.join('lib', 'privileged-action.ts'))) continue // the helper itself
      const text = fs.readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      while ((m = rpcRe.exec(text)) !== null) {
        if (AUDITED.includes(m[1])) offenders.push(`${path.relative(srcRoot, file)} -> ${m[1]}`)
      }
    }
    expect(offenders, `bare privileged rpc calls found:\n${offenders.join('\n')}`).toEqual([])
  })
})
