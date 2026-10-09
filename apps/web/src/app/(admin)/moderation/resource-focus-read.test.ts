// apps/web/src/app/(admin)/moderation/resource-focus-read.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Manage tab's by-id read for "Edit in admin": approved only, and anything other than a readable
// approved row (no row, an error, a throw, an abort) is null -> the tab reports not_found. The happy
// path (row -> edit dialog) is proven through the real tab in manage-resources-tab.focus.test.ts.

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { readFocusResource } from './resource-focus-read'

const ID = '11111111-1111-4111-8111-111111111111'

function client(result: () => Promise<{ data: unknown; error: unknown }>) {
  const eqs: Array<[string, unknown]> = []
  const q = {
    abortSignal: () => q,
    eq: (c: string, v: unknown) => {
      eqs.push([c, v])
      return q
    },
    maybeSingle: result,
  }
  return { c: { from: () => ({ select: () => q }) } as unknown as SupabaseClient<Database>, eqs }
}

describe('readFocusResource', () => {
  it('filters id AND status=approved (a pending or rejected id never reaches the dialog)', async () => {
    const { c, eqs } = client(async () => ({ data: null, error: null }))
    await readFocusResource(c, ID, new AbortController().signal)
    expect(eqs).toEqual([
      ['id', ID],
      ['status', 'approved'],
    ])
  })

  it('no row, an error, or a thrown/aborted read -> null', async () => {
    const signal = new AbortController().signal
    expect(await readFocusResource(client(async () => ({ data: null, error: null })).c, ID, signal)).toBeNull()
    expect(await readFocusResource(client(async () => ({ data: { id: ID, name: 'x' }, error: { code: '42501' } })).c, ID, signal)).toBeNull()
    expect(await readFocusResource(client(() => Promise.reject(new Error('AbortError'))).c, ID, signal)).toBeNull()
  })

  it('a row without a location keeps lat/lng null (the dialog asks for a location)', async () => {
    const row = await readFocusResource(
      client(async () => ({ data: { id: ID, name: 'Pantry', category: 'food', status: 'approved', location: null }, error: null })).c,
      ID,
      new AbortController().signal
    )
    expect(row).toMatchObject({ id: ID, name: 'Pantry', lat: null, lng: null, service_mode: 'physical' })
  })
})
