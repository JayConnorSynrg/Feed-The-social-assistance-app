// apps/web/src/lib/business-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Mutation-proven test for submitBusiness — the core of the truthful-optimistic revert
// (CINV4). The load-bearing case: on a Supabase error the function must return
// { ok:false, error } and NOT fabricate a success. This test goes RED if the error branch is
// swallowed (i.e. if submitBusiness returned ok:true / a fake id when the insert failed),
// because the component's revert path keys on outcome.ok === false.
//
// Client is a hand-built fake recorder (mirrors notification-prefs.test.ts) rather than
// vi.mock, so the chained .from().insert().select().single() shape is asserted directly.

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { submitBusiness } from './business-data'

function makeClient(opts: {
  singleResult?: { data: { id: string } | null; error: { message: string } | null }
}) {
  const state = { table: '', inserted: null as Record<string, unknown> | null, selected: '' }
  const builder = {
    insert(row: Record<string, unknown>) {
      state.inserted = row
      return builder
    },
    select(cols: string) {
      state.selected = cols
      return builder
    },
    single() {
      return Promise.resolve(opts.singleResult ?? { data: { id: 'org-new' }, error: null })
    },
  }
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

const input = { name: '  Corner Cafe  ', description: 'Coffee', city: 'Burlington' }

describe('submitBusiness (CINV4 — never swallows the error)', () => {
  it('returns ok:false with the message when the insert errors', async () => {
    const client = makeClient({ singleResult: { data: null, error: { message: 'permission denied' } } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out).toEqual({ ok: false, error: 'permission denied' })
  })

  it('returns ok:true with the new id on success', async () => {
    const client = makeClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out).toEqual({ ok: true, id: 'org-42' })
  })

  it('always inserts org_type=business and trims the name; never presets moderation fields', async () => {
    const client = makeClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, input, 'user-1')
    expect(client.state.table).toBe('organizations')
    expect(client.state.inserted).toMatchObject({ org_type: 'business', name: 'Corner Cafe', created_by: 'user-1' })
    // The client must NOT try to set status/submitted_by/moderated_* — the DB trigger owns them.
    expect(client.state.inserted).not.toHaveProperty('status')
    expect(client.state.inserted).not.toHaveProperty('submitted_by')
    expect(client.state.inserted).not.toHaveProperty('moderated_by')
  })

  it('treats a missing id as a failure rather than a phantom success', async () => {
    const client = makeClient({ singleResult: { data: null, error: null } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out.ok).toBe(false)
  })
})
