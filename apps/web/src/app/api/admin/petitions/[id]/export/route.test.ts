// route.test.ts — petition signatures CSV export: gate, pagination, file format, exactly one audit
// row + exactly one admin.petition.export event per attempt. Mocks the server + service clients.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const PETITION = '11111111-2222-4333-8444-555555555555'

type Sig = {
  signer_full_name: string | null
  signer_display_name: string | null
  signed_at: string
  affirmation_text: string
  petition_version_hash: string
  ip_address: string
  user_agent: string
}

const state = vi.hoisted(() => ({
  user: { id: 'actor-pa' } as { id: string } | null,
  isAdmin: true as unknown,
  petitionExists: true,
  signatures: [] as Sig[],
  /** Simulates a server cap below the page size (e.g. max_rows lowered). */
  serverCap: 1000,
  expectedOverride: null as number | null,
  pageError: null as null | { message: string },
  auditError: null as null | { message: string },
  ranges: [] as Array<[number, number]>,
  exportCalls: 0,
  recordCalls: [] as Array<Record<string, unknown>>,
  events: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
}))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'x-request-id' ? 'rid-test-1' : null) }),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => state.events.push({ name, attrs }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    rpc: (name: string) => {
      if (name === 'is_current_user_admin') return Promise.resolve({ data: state.isAdmin, error: null })
      if (name === 'get_petition_signature_count')
        return Promise.resolve({ data: state.expectedOverride ?? state.signatures.length, error: null })
      if (name === 'export_petition_signatures') {
        state.exportCalls++
        return {
          range: async (from: number, to: number) => {
            state.ranges.push([from, to])
            if (state.pageError) return { data: null, error: state.pageError }
            const end = Math.min(to + 1, from + state.serverCap)
            return { data: state.signatures.slice(from, end), error: null }
          },
        }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.petitionExists ? { id: PETITION } : null, error: null }) }),
      }),
    }),
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: async (_name: string, args: Record<string, unknown>) => {
      state.recordCalls.push(args)
      return { data: null, error: state.auditError }
    },
  }),
}))

import { POST } from './route'

function sigs(n: number): Sig[] {
  return Array.from({ length: n }, (_, i) => ({
    signer_full_name: `Signer ${i}`,
    signer_display_name: `display${i}`,
    signed_at: `2026-11-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    affirmation_text: 'I add my verified signature of support.',
    petition_version_hash: 'hash-v1',
    ip_address: `10.0.${Math.floor(i / 256) % 256}.${i % 256}`,
    user_agent: 'Mozilla/5.0 (Secret Device)',
  }))
}

const call = (id = PETITION) =>
  POST(new Request(`http://localhost/api/admin/petitions/${id}/export`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  })

const exportEvents = () => state.events.filter((e) => e.name === 'admin.petition.export')

beforeEach(() => {
  state.user = { id: 'actor-pa' }
  state.isAdmin = true
  state.petitionExists = true
  state.signatures = sigs(3)
  state.serverCap = 1000
  state.expectedOverride = null
  state.pageError = null
  state.auditError = null
  state.ranges = []
  state.exportCalls = 0
  state.recordCalls = []
  state.events = []
})

describe('who can export', () => {
  it('a signed-in member who is not a platform admin gets 403: no signature read, no audit row, one denied event', async () => {
    state.isAdmin = false
    const res = await call()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ code: 'insufficient_tier' })
    expect(state.exportCalls).toBe(0)
    expect(state.recordCalls).toHaveLength(0)
    expect(exportEvents()).toHaveLength(1)
    expect(exportEvents()[0].attrs).toMatchObject({ outcome: 'denied', code: 'insufficient_tier', row_count: 0 })
  })

  it('a signed-out caller gets 401 and nothing is read', async () => {
    state.user = null
    const res = await call()
    expect(res.status).toBe(401)
    expect(state.exportCalls).toBe(0)
    expect(state.recordCalls).toHaveLength(0)
  })
})

describe('the file', () => {
  it('is UTF-8 with a BOM, has only the four organizer columns, and never carries IP, device or display name', async () => {
    state.signatures = [
      { ...sigs(1)[0], signer_full_name: '=HYPERLINK("http://x","y")' },
      { ...sigs(1)[0], signer_full_name: 'مريم, "Ana"' },
      { ...sigs(1)[0], signer_full_name: '@SUM(1)' },
    ]
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
    const lines = text.slice(1).split('\r\n')
    expect(lines[0]).toBe('Full Name,Signed At,Affirmation,Petition Version Hash')
    expect(lines[1].startsWith(`"'=HYPERLINK(""http://x"",""y"")"`)).toBe(true)
    expect(lines[2].startsWith('"مريم, ""Ana"""')).toBe(true)
    expect(lines[3].startsWith("'@SUM(1)")).toBe(true)
    expect(text).not.toMatch(/10\.0\.|Secret Device|display0/)
  })

  it('has a file name with the petition id and date only', async () => {
    const res = await call()
    expect(res.headers.get('Content-Disposition')).toMatch(
      new RegExp(`^attachment; filename="petition-signatures-${PETITION}-\\d{4}-\\d{2}-\\d{2}\\.csv"$`),
    )
  })

  it('exports every signature past 1,000 by reading pages', async () => {
    state.signatures = sigs(2345)
    const res = await call()
    expect(res.status).toBe(200)
    const lines = (await res.text()).split('\r\n')
    expect(lines).toHaveLength(1 + 2345)
    expect(state.ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(res.headers.get('X-Row-Count')).toBe('2345')
    expect(lines[2345]).toMatch(/^Signer 2344,/)
  })

  it('refuses to send a partial file when the server returns fewer rows than the signature count', async () => {
    state.signatures = sigs(1500)
    state.serverCap = 500 // a page comes back short: the export stops at 500 of 1,500
    const res = await call()
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ code: 'incomplete' })
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0]).toMatchObject({ p_outcome: 'error', p_reason: 'incomplete' })
    expect(exportEvents()).toHaveLength(1)
    expect(exportEvents()[0].attrs).toMatchObject({ outcome: 'error', code: 'incomplete', row_count: 500 })
  })
})

describe('the record', () => {
  it('a successful export writes exactly one ok admin_actions row and one ok event with no personal data', async () => {
    state.signatures = sigs(1200)
    const res = await call()
    expect(res.status).toBe(200)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0]).toEqual({
      p_actor: 'actor-pa',
      p_action: 'petition.export',
      p_target_type: 'petition',
      p_target_id: PETITION,
      p_outcome: 'ok',
      p_reason: null,
      p_details: { row_count: 1200 },
      p_request_id: 'rid-test-1',
    })
    expect(exportEvents()).toHaveLength(1)
    const { attrs } = exportEvents()[0]
    expect(Object.keys(attrs).sort()).toEqual(['code', 'duration_ms', 'outcome', 'request_id', 'row_count'])
    expect(attrs).toMatchObject({ outcome: 'ok', row_count: 1200, request_id: 'rid-test-1', code: null })
    expect(typeof attrs.duration_ms).toBe('number')
  })

  it('no file without a record: when the audit row cannot be written the CSV is not sent', async () => {
    state.auditError = { message: 'insert failed' }
    const res = await call()
    expect(res.status).toBe(500)
    const body = await res.text()
    expect(body).not.toMatch(/Full Name|Signer/)
    expect(exportEvents()).toHaveLength(1)
    expect(exportEvents()[0].attrs).toMatchObject({ outcome: 'error', code: 'audit_failed' })
  })

  it('an unknown or unapproved petition is 404 with one error audit row', async () => {
    state.petitionExists = false
    const res = await call()
    expect(res.status).toBe(404)
    expect(state.exportCalls).toBe(0)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0]).toMatchObject({ p_outcome: 'error', p_reason: 'not_found' })
  })

  it('a read failure is 500 with one error audit row and no file', async () => {
    state.pageError = { message: 'not authorized' }
    const res = await call()
    expect(res.status).toBe(500)
    expect(state.recordCalls).toHaveLength(1)
    expect(state.recordCalls[0]).toMatchObject({ p_outcome: 'error', p_reason: 'read_failed' })
    expect(exportEvents()).toHaveLength(1)
  })
})
