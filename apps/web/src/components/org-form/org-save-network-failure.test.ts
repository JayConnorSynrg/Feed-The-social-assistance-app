// apps/web/src/components/org-form/org-save-network-failure.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A REAL network failure, end to end: the real postgrest-js client (pointed at a closed local
// port) -> privilegedRpc -> adminSaveOrganization -> runOrgSave. postgrest-js reports the failure
// with error.code === "" (not null). That is an ambiguous failure — the save may have committed —
// so this attempt's uploads must be KEPT (a committed save references them).

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))

import { PostgrestClient } from '@supabase/postgrest-js'
import { createSingleFlight } from '@/components/feed/composer-guards'
import { adminSaveOrganization, sqlstateOf } from '@/lib/org-admin-rpc'
import { emptyFormValues, runOrgSave, type PhotoItem } from './org-form-model'

const ORG = '11111111-2222-4333-8444-555555555555'
const file = new File(['x'], 'a.png', { type: 'image/png' })
const item = (key: string): PhotoItem => ({ key, source: 'new', file, previewUrl: `blob:${key}` })

describe('save over a dead network', () => {
  it('postgrest-js reports code "" and the uploads are kept', async () => {
    const sb = new PostgrestClient('http://127.0.0.1:9/rest/v1')
    const raw = await sb.rpc('admin_save_organization' as never, {} as never)
    // Pin the client behavior this guard depends on.
    expect((raw.error as { code?: unknown } | null)?.code).toBe('')

    const removed: string[][] = []
    let n = 0
    const out = await runOrgSave({
      orgId: ORG,
      values: { ...emptyFormValues(), name: 'Probe', logo: item('L'), gallery: [item('G1')] },
      hadLocation: false,
      flight: createSingleFlight(),
      deps: {
        upload: async () => {
          n++
          return { url: `u${n}`, path: `${ORG}/u${n}.webp` }
        },
        save: (payload) => adminSaveOrganization(sb as never, ORG, payload, 'create'),
        remove: async (p) => {
          removed.push(p)
        },
      },
    })
    expect(out).toMatchObject({ ok: false, stage: 'save', code: null, errorKey: 'saveErrNetwork' })
    expect(removed).toEqual([])
  })

  it('sqlstateOf: empty or missing code is "no SQLSTATE"', () => {
    expect(sqlstateOf({ code: '' })).toBeNull()
    expect(sqlstateOf({})).toBeNull()
    expect(sqlstateOf({ code: null })).toBeNull()
    expect(sqlstateOf({ code: '22023' })).toBe('22023')
  })
})
