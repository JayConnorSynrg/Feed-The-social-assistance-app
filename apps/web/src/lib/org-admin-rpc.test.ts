// apps/web/src/lib/org-admin-rpc.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The org admin RPC wrapper: both RPCs go through privilegedRpc with their audited op names, the
// x-request-id header is set, and SQLSTATE / upload status codes map to translated messages
// (raw database text never reaches the UI).

import { describe, it, expect, vi } from 'vitest'

const { sinks } = vi.hoisted(() => ({ sinks: [] as Array<{ op: string; attrs: Record<string, unknown> }> }))
vi.mock('./logger', () => ({
  withMetric: async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } finally {
      sinks.push({ op, attrs })
    }
  },
  logEvent: vi.fn(),
}))

import { adminSaveOrganization, adminSetOrgActive, mapSaveError } from './org-admin-rpc'
import { uploadErrorKey } from './org-photo-upload'

function client(result: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<{ name: string; args: unknown; headers: Record<string, string> }> = []
  const supabase = {
    rpc: (name: string, args: unknown) => {
      const entry = { name, args, headers: {} as Record<string, string> }
      calls.push(entry)
      const builder = {
        setHeader(k: string, v: string) {
          entry.headers[k] = v
          return builder
        },
        then(resolve: (r: unknown) => void) {
          resolve(result)
        },
      }
      return builder
    },
  }
  return { supabase: supabase as never, calls }
}

const payload = {
  name: 'X',
  org_type: 'community',
  description: null,
  address: null,
  city: null,
  state: null,
  zip_code: null,
  phone: null,
  email: null,
  website: null,
  hours: [],
  photos: [],
  resource_ids: [],
}

describe('adminSaveOrganization', () => {
  it('calls admin_save_organization via privilegedRpc (op admin.org.save) with x-request-id', async () => {
    const { supabase, calls } = client({ data: { id: 'o1', created: true, removed_photo_paths: ['o1/a.webp'] }, error: null })
    const res = await adminSaveOrganization(supabase, 'o1', payload, 'create')
    expect(res).toEqual({ ok: true, result: { id: 'o1', created: true, removed_photo_paths: ['o1/a.webp'] } })
    expect(calls[0].name).toBe('admin_save_organization')
    expect(calls[0].args).toEqual({ p_org_id: 'o1', p_payload: payload })
    expect(calls[0].headers['x-request-id']).toBeTruthy()
    const row = sinks.find((s) => s.op === 'admin.org.save')!
    expect(row.attrs).toMatchObject({ mode: 'create', location_op: 'keep', target_id: 'o1' })
    expect(JSON.stringify(row.attrs)).not.toContain('"X"')
  })
  it('a 22023 failure maps to a field message', async () => {
    const { supabase } = client({ data: null, error: { code: '22023', message: 'org_save_invalid: website must start with http:// or https://' } })
    expect(await adminSaveOrganization(supabase, 'o1', payload, 'edit')).toEqual({ ok: false, code: '22023', errorKey: 'saveErrWebsite' })
  })
})

describe('adminSetOrgActive', () => {
  it('calls admin_set_org_active via privilegedRpc (op admin.org.set_active)', async () => {
    const { supabase, calls } = client({ data: null, error: null })
    expect(await adminSetOrgActive(supabase, 'o1', false)).toEqual({ ok: true })
    expect(calls[0]).toMatchObject({ name: 'admin_set_org_active', args: { p_org_id: 'o1', p_active: false } })
    expect(sinks.some((s) => s.op === 'admin.org.set_active' && s.attrs.active === false)).toBe(true)
  })
  it('a denial is reported as a failure', async () => {
    const { supabase } = client({ data: null, error: { code: '42501', message: 'org_save_denied' } })
    expect(await adminSetOrgActive(supabase, 'o1', true)).toEqual({ ok: false, code: '42501', errorKey: 'saveErrDenied' })
  })
})

describe('mapSaveError', () => {
  it.each([
    [{ code: '42501', message: 'denied' }, 'saveErrDenied'],
    [{ code: '42501', message: 'org_save_denied: only a platform admin can change the organization type' }, 'saveErrDenied'],
    [{ code: '', message: 'org_save_denied: platform admin or an admin of this organization only' }, 'saveErrDenied'],
    [{ code: '22023', message: 'org_save_invalid: name is required' }, 'saveErrName'],
    [{ code: '22023', message: 'org_save_invalid: email is not a valid address' }, 'saveErrEmail'],
    [{ code: '22023', message: 'org_save_invalid: an hours interval cannot open and close at the same time' }, 'saveErrHours'],
    [{ code: '22023', message: 'org_save_invalid: close 24:00 is only valid with open 00:00 (open 24 hours)' }, 'saveErrHours'],
    [{ code: '22023', message: 'org_save_invalid: location must be {lng: -180..180, lat: -90..90} or null' }, 'saveErrLocation'],
    [{ code: '22023', message: 'org_save_invalid: photo url must be the public org-photos URL of its storage_path' }, 'saveErrPhotos'],
    [{ code: '22023', message: 'org_save_invalid: every linked resource must be an approved resource' }, 'saveErrResources'],
    [{ code: '22023', message: 'org_save_invalid: org_type x is not allowed' }, 'saveErrInvalid'],
    [{ code: 'P0002', message: 'org_save_failed' }, 'saveErrGeneric'],
    [{ message: 'TypeError: Failed to fetch' }, 'saveErrNetwork'],
  ])('%j -> %s', (err, key) => {
    expect(mapSaveError(err)).toBe(key)
  })
  it('upload status codes map to upload messages', () => {
    expect(uploadErrorKey(413)).toBe('saveErrUploadTooLarge')
    expect(uploadErrorKey(415)).toBe('saveErrUploadType')
    expect(uploadErrorKey(403)).toBe('saveErrUploadDenied')
    expect(uploadErrorKey(500)).toBe('saveErrUpload')
  })
})
