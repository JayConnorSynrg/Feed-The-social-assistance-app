// privileged-action.test.ts
// CONTROL: privilegedRpc/privilegedFetch mint one id, send x-request-id, share it with withMetric,
//          and record a denied/failed call as a FAILURE exactly once (finding 2).
// GUARD:   no privileged call bypasses the helper, however it is written (finding 3).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// withMetric mock mirrors runWithMetric's contract: fn resolves -> exactly one info row (ok:true);
// fn throws -> exactly one error row (ok:false) then rethrows. (runWithMetric's one-row-per-outcome
// invariant is proven separately in with-metric-core's own tests.)
type Rec = { op: string; level: 'info' | 'error'; ok: boolean; rid?: string; request_id?: unknown }
const records: Rec[] = []
vi.mock('@/lib/logger', () => ({
  withMetric: vi.fn(async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>, rid?: string) => {
    try {
      const r = await fn()
      records.push({ op, level: 'info', ok: true, rid, request_id: attrs.request_id })
      return r
    } catch (e) {
      records.push({ op, level: 'error', ok: false, rid, request_id: attrs.request_id })
      throw e
    }
  }),
}))

import { privilegedRpc, privilegedFetch, newRequestId } from './privileged-action'
import { scanForBypasses, AUDITED_PRIVILEGED } from './privileged-action-guard'

beforeEach(() => {
  records.length = 0
})

// ── CONTROL: request-id plumbing + telemetry outcome (finding 1 request-id, finding 2) ──────────
describe('privilegedRpc', () => {
  const okSupabase = (result: { data?: unknown; error?: unknown }) => ({
    rpc: () => ({ setHeader: (_k: string, _v: string) => Promise.resolve(result) }),
  })

  it('SUCCESS: one info record, x-request-id set, same id shared with withMetric', async () => {
    const header: Array<[string, string]> = []
    const supa = { rpc: () => ({ setHeader: (k: string, v: string) => { header.push([k, v]); return Promise.resolve({ data: { ok: true }, error: null }) } }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await privilegedRpc(supa as any, 'admin.post.remove', 'admin_remove_post', { p_post_id: '1' })
    expect(header[0][0]).toBe('x-request-id')
    expect(records).toEqual([{ op: 'admin.post.remove', level: 'info', ok: true, rid: header[0][1], request_id: header[0][1] }])
    expect(res).toMatchObject({ data: { ok: true }, error: null, requestId: header[0][1] })
  })

  it('SUPABASE ERROR: one error record, caller still gets {data:null,error}', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await privilegedRpc(okSupabase({ data: null, error: { code: '42501', message: 'denied' } }) as any, 'admin.tier.set', 'admin_set_tier', {})
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', ok: false })
    expect(res.error).toEqual({ code: '42501', message: 'denied' })
    expect(res.data).toBeNull()
  })

  it('THROWN EXCEPTION: one error record, caller gets an error result', async () => {
    const supa = { rpc: () => ({ setHeader: () => { throw new Error('boom') } }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await privilegedRpc(supa as any, 'admin.post.hold', 'admin_hold_post', {})
    expect(records).toHaveLength(1)
    expect(records[0].ok).toBe(false)
    expect(res.error?.message).toBe('boom')
  })
})

describe('privilegedFetch', () => {
  it('SUCCESS (200): one info record, x-request-id sent', async () => {
    const seen: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = vi.fn(async (_u: string, init: RequestInit) => { Object.assign(seen, init.headers); return new Response('{}', { status: 200 }) })
    const { requestId, response } = await privilegedFetch('admin.user.ban', '/api/admin/users/x/ban', { method: 'POST' })
    expect(seen['x-request-id']).toBe(requestId)
    expect(response.status).toBe(200)
    expect(records).toEqual([{ op: 'admin.user.ban', level: 'info', ok: true, rid: requestId, request_id: requestId }])
  })

  it('FETCH 403: one error record, caller still gets the response', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = vi.fn(async () => new Response('forbidden', { status: 403 }))
    const { response } = await privilegedFetch('admin.user.delete', '/api/admin/users/x/delete', { method: 'DELETE' })
    expect(response.status).toBe(403)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', ok: false })
  })
})

describe('newRequestId', () => {
  it('is a bounded token request_id() accepts (<=64, [A-Za-z0-9_-])', () => {
    const id = newRequestId()
    expect(id.length).toBeLessThanOrEqual(64)
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

// ── GUARD (finding 3): catches every bypass form; leaves legit privilegedRpc calls alone ────────
describe('scanForBypasses — catches every bypass form', () => {
  const legit = `await privilegedRpc(supabase, 'admin.resource.approve', 'approve_resource', { p_resource_id: id })`
  it('is clean for a legit privilegedRpc call', () => {
    expect(scanForBypasses(legit)).toEqual([])
  })
  const forms: Record<string, string> = {
    'plain dot .rpc': `await supabase.rpc('admin_remove_post', {})`,
    'V1 bound alias': `const rpc = supabase.rpc.bind(supabase); await rpc('admin_remove_post', {})`,
    'V2 template literal': 'await supabase.rpc(`admin_hold_post`, {})',
    'V3 variable': `const n = 'admin_authorize_post'; await supabase.rpc(n, {})`,
    'V4 audited unlisted': `await supabase.rpc('set_resource_location_by_id', {})`,
    'V5 bracket access': `await supabase['rpc']('admin_resolve_report', {})`,
    'V6 bare route fetch': `await fetch('/api/admin/users/x/ban', { method: 'POST' })`,
  }
  for (const [name, src] of Object.entries(forms)) {
    it(`flags: ${name}`, () => {
      expect(scanForBypasses(src).length).toBeGreaterThan(0)
    })
  }
  it('AUDITED list includes set_resource_location_by_id and approve_form_template', () => {
    expect(AUDITED_PRIVILEGED).toContain('set_resource_location_by_id')
    expect(AUDITED_PRIVILEGED).toContain('approve_form_template')
  })
})

// ── GUARD applied to the real tree ──────────────────────────────────────────────────────────────
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

describe('T5 source guard — no privileged call bypasses the helper', () => {
  it('finds zero bypasses across apps/web/src', () => {
    const srcRoot = path.resolve(__dirname, '..')
    const offenders: string[] = []
    for (const file of walk(srcRoot)) {
      // the helper + its guard module are the sanctioned home of these names
      if (file.endsWith(path.join('lib', 'privileged-action.ts'))) continue
      if (file.endsWith(path.join('lib', 'privileged-action-guard.ts'))) continue
      const hits = scanForBypasses(fs.readFileSync(file, 'utf8'))
      for (const h of hits) offenders.push(`${path.relative(srcRoot, file)} -> ${h}`)
    }
    expect(offenders, `bypasses found:\n${offenders.join('\n')}`).toEqual([])
  })
})
