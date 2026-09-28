// apps/web/src/lib/business-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Two things are proven here:
//   1. CINV4 (truthful revert): submitBusiness returns { ok:false, error } on a Supabase error and
//      NEVER fabricates a success — the component's revert keys on outcome.ok === false.
//   2. W2 logging (INV3): each wrapped client path (submitBusiness / fetchApprovedBusinesses /
//      fetchPendingBusinesses) emits EXACTLY ONE wide event on success AND exactly one on error,
//      with bounded, PII-free labels only. `./logger` is mocked with a recorder so that removing a
//      withMetric wrap makes the sink count go to 0 → RED (mutation-proof, both directions).
//
// The Supabase client is a hand-built fake recorder (mirrors notification-prefs.test.ts) rather
// than vi.mock, so the chained builder shape is asserted directly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

// Recorder shared with the mocked logger. vi.hoisted lets the vi.mock factory (hoisted above the
// imports) reference it. One push per withMetric call === one wide event.
const { sinks } = vi.hoisted(() => ({
  sinks: [] as Array<{ level: 'info' | 'error'; event: string; attrs: Record<string, unknown> }>,
}))

// Mock the metric wrapper with a faithful recorder: run fn, record .complete on success and
// .error on throw (re-throwing so the caller's own try/catch still runs). Labels are snapshotted
// AFTER fn resolves, so an attrs object mutated in place (result_count) is captured with its final
// value — exactly how the real with-metric-core spreads attrs post-resolution.
vi.mock('./logger', () => ({
  withMetric: async (
    operation: string,
    attrs: Record<string, unknown>,
    fn: () => Promise<unknown>
  ) => {
    try {
      const result = await fn()
      sinks.push({ level: 'info', event: `${operation}.complete`, attrs: { ...attrs } })
      return result
    } catch (err) {
      sinks.push({ level: 'error', event: `${operation}.error`, attrs: { ...attrs } })
      throw err
    }
  },
}))

import {
  submitBusiness,
  fetchApprovedBusinesses,
  fetchPendingBusinesses,
} from './business-data'

beforeEach(() => {
  sinks.length = 0
})

// Only bounded, non-identifying labels may ever appear on a business wide-event. A string value or
// any key outside this set (a name, email, address, website URL, or user_id) fails the assertion.
const ALLOWED_LABELS = ['result_count', 'has_website']
function assertBoundedPiiFreeLabels(attrs: Record<string, unknown>) {
  for (const [key, value] of Object.entries(attrs)) {
    expect(ALLOWED_LABELS).toContain(key)
    expect(['number', 'boolean']).toContain(typeof value)
  }
}

// ---- write client (insert -> select -> single) --------------------------------------------------
function makeWriteClient(opts: {
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

// ---- read client (select -> eq -> eq -> order -> then) ------------------------------------------
function makeReadClient(result: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
  })
  const client = { from: () => builder }
  return client as unknown as SupabaseClient<Database>
}

const input = { name: '  Corner Cafe  ', description: 'Coffee', city: 'Burlington' }

describe('submitBusiness (CINV4 — never swallows the error)', () => {
  it('returns ok:false with the message when the insert errors', async () => {
    const client = makeWriteClient({ singleResult: { data: null, error: { message: 'permission denied' } } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out).toEqual({ ok: false, error: 'permission denied' })
  })

  it('returns ok:true with the new id on success', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out).toEqual({ ok: true, id: 'org-42' })
  })

  it('always inserts org_type=business and trims the name; never presets moderation fields', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, input, 'user-1')
    expect(client.state.table).toBe('organizations')
    expect(client.state.inserted).toMatchObject({ org_type: 'business', name: 'Corner Cafe', created_by: 'user-1' })
    // The client must NOT try to set status/submitted_by/moderated_* — the DB trigger owns them.
    expect(client.state.inserted).not.toHaveProperty('status')
    expect(client.state.inserted).not.toHaveProperty('submitted_by')
    expect(client.state.inserted).not.toHaveProperty('moderated_by')
  })

  it('treats a missing id as a failure rather than a phantom success', async () => {
    const client = makeWriteClient({ singleResult: { data: null, error: null } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out.ok).toBe(false)
  })
})

describe('submitBusiness (INV2 — normalize-at-write)', () => {
  it('prefixes a scheme-less website with https:// before insert', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: 'corner.example.com' }, 'user-1')
    expect(client.state.inserted).toMatchObject({ website: 'https://corner.example.com' })
  })

  it('preserves an explicit http:// website unchanged', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: 'http://corner.example.com' }, 'user-1')
    expect(client.state.inserted).toMatchObject({ website: 'http://corner.example.com' })
  })

  it('stores null for an empty/whitespace website — never a bare or empty string', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: '   ' }, 'user-1')
    expect(client.state.inserted).toMatchObject({ website: null })
  })
})

describe('W2 logging (INV3 — exactly one wide event, PII-free labels)', () => {
  it('submitBusiness: EXACTLY ONE .complete on success, has_website label, no PII', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: 'corner.example.com' }, 'user-1')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.submit.complete' })
    expect(sinks[0].attrs).toEqual({ has_website: true })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('submitBusiness: EXACTLY ONE .error on insert failure (typed error_code path), no PII', async () => {
    const client = makeWriteClient({ singleResult: { data: null, error: { message: 'permission denied' } } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out.ok).toBe(false)
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.submit.error' })
    expect(sinks[0].attrs).toEqual({ has_website: false })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchApprovedBusinesses: EXACTLY ONE .complete with result_count, no PII', async () => {
    const client = makeReadClient({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    const rows = await fetchApprovedBusinesses(client)
    expect(rows).toHaveLength(2)
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.list.fetch.complete' })
    expect(sinks[0].attrs).toEqual({ result_count: 2 })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchApprovedBusinesses: EXACTLY ONE .error and throws on a Supabase error', async () => {
    const client = makeReadClient({ data: null, error: { message: 'boom' } })
    await expect(fetchApprovedBusinesses(client)).rejects.toThrow('boom')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.list.fetch.error' })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchPendingBusinesses: EXACTLY ONE .complete with result_count, no PII', async () => {
    const client = makeReadClient({ data: [{ id: 'p' }], error: null })
    const rows = await fetchPendingBusinesses(client)
    expect(rows).toHaveLength(1)
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.pending.fetch.complete' })
    expect(sinks[0].attrs).toEqual({ result_count: 1 })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchPendingBusinesses: EXACTLY ONE .error and throws on a Supabase error', async () => {
    const client = makeReadClient({ data: null, error: { message: 'denied' } })
    await expect(fetchPendingBusinesses(client)).rejects.toThrow('denied')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.pending.fetch.error' })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })
})
