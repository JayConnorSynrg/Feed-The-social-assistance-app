// apps/web/src/components/org-form/org-form-load-result.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization setup panel reports its own read of the organization it opened (onLoadResult) —
// what an organization "Edit in admin" link resolves from (OrgPanelFocus, app/(admin)/moderation/
// org-focus.tsx): ok when fetchAdminOrgDetail returns the row, not ok when it returns nothing or
// fails; nothing for a create, and nothing after the body unmounted (a cancelled read).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
const h = vi.hoisted(() => ({ detail: null as null | (() => Promise<unknown>) }))
vi.mock('@/lib/org-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/org-data')>()),
  fetchAdminOrgDetail: () => h.detail!(),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = {}
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { mount } from '@/test/mini-react'
import { OrgFormBody, type BodyProps } from './org-form-panel'

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function body(mode: 'edit' | 'create', onLoadResult: BodyProps['onLoadResult']) {
  const props: BodyProps = {
    mode,
    kind: 'org',
    orgId: mode === 'edit' ? ORG : null,
    locale: 'en',
    tr: (k) => String(k),
    requestClose: () => {},
    checkDuplicateNames: false,
    canChangeType: true,
    onDirtyChange: () => {},
    onSavingChange: () => {},
    onSaveAttempt: () => {},
    registerBackToForm: () => {},
    consumeFocusName: () => false,
    onSaved: () => {},
    onLoadResult,
  }
  return mount(() => OrgFormBody(props))
}

beforeEach(() => {
  h.detail = null
})

describe('OrgFormBody onLoadResult', () => {
  it('edit: the row loaded -> (id, true)', async () => {
    h.detail = async () => ({ id: ORG, name: 'Pantry' })
    const onLoadResult = vi.fn()
    await body('edit', onLoadResult).flush()
    expect(onLoadResult.mock.calls).toEqual([[ORG, true]])
  })
  it('edit: no row, or the read fails -> (id, false)', async () => {
    const onLoadResult = vi.fn()
    h.detail = async () => null
    await body('edit', onLoadResult).flush()
    h.detail = () => Promise.reject(new Error('network'))
    await body('edit', onLoadResult).flush()
    expect(onLoadResult.mock.calls).toEqual([
      [ORG, false],
      [ORG, false],
    ])
  })
  it('create: no read, no result', async () => {
    const onLoadResult = vi.fn()
    await body('create', onLoadResult).flush()
    expect(onLoadResult).not.toHaveBeenCalled()
  })
  it('unmounted before the read settled: no result', async () => {
    let resolve!: (v: unknown) => void
    h.detail = () => new Promise((r) => (resolve = r))
    const onLoadResult = vi.fn()
    const b = body('edit', onLoadResult)
    await b.flush()
    b.unmount()
    resolve({ id: ORG })
    await new Promise((r) => setTimeout(r, 0))
    expect(onLoadResult).not.toHaveBeenCalled()
  })
})
