// apps/web/src/lib/appreciation.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Unit tests for the pure appreciation helpers (item list + shelf aggregation) AND the
// error≠empty contract of the async reads/writes (MEDIUM-3): a failed read must resolve
// { ok:false } with an error, NEVER an empty success — otherwise the UI shows "No gifts yet"
// on a failed read. The client slug guard must reject an invalid item WITHOUT an RPC call.

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import {
  APPRECIATION_ITEMS,
  APPRECIATION_SLUGS,
  isAppreciationSlug,
  aggregateShelf,
  giveAppreciation,
  listSentTo,
  myReceivedShelf,
} from './appreciation'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Mock Supabase client. The terminal call in every appreciation read/write is
// `.abortSignal(...)`, which the real PostgREST client RESOLVES (never throws) with
// { data, error } — the code keys on the returned `error` object. rpc(...) exposes the
// same terminal. `rpcCalled` records whether the RPC was reached (for the slug-guard test).
// ---------------------------------------------------------------------------
type Result = { data: unknown; error: unknown }

function makeClient(result: Result) {
  const state = { rpcCalled: false, eq: [] as Array<[string, unknown]> }
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = (col: string, val: unknown) => {
    state.eq.push([col, val])
    return builder
  }
  builder.abortSignal = () => Promise.resolve(result)
  const client = {
    state,
    from: () => builder,
    rpc: () => {
      state.rpcCalled = true
      return { abortSignal: () => Promise.resolve(result) }
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

const READ_ERROR: Result = { data: null, error: { message: 'permission denied', code: '42501' } }

describe('APPRECIATION_ITEMS', () => {
  it('is exactly the 12 canonical slugs, matching the migration CHECK', () => {
    expect(APPRECIATION_ITEMS).toHaveLength(12)
    expect(APPRECIATION_SLUGS).toEqual([
      'heart', 'smile', 'cheer', 'flower', 'sunflower', 'leaf',
      'bread', 'apple', 'soup', 'sun', 'seedling', 'tree',
    ])
  })

  it('has a unique slug + non-empty label + alt for every item', () => {
    const slugs = new Set(APPRECIATION_ITEMS.map((i) => i.slug))
    expect(slugs.size).toBe(12)
    for (const i of APPRECIATION_ITEMS) {
      expect(i.label.length).toBeGreaterThan(0)
      expect(i.alt.length).toBeGreaterThan(0)
    }
  })

  it('isAppreciationSlug accepts known slugs and rejects unknown', () => {
    expect(isAppreciationSlug('heart')).toBe(true)
    expect(isAppreciationSlug('tree')).toBe(true)
    expect(isAppreciationSlug('banana')).toBe(false)
    expect(isAppreciationSlug('')).toBe(false)
  })
})

describe('aggregateShelf', () => {
  const g = (id: string, name: string) => ({ id, first_name: name, avatar_url: null })

  it('groups by item, counts per item, and lists givers most-recent-first', () => {
    const rows = [
      { item: 'heart', created_at: '2026-01-01T00:00:00Z', giver: g('a', 'Ada') },
      { item: 'heart', created_at: '2026-01-03T00:00:00Z', giver: g('b', 'Ben') },
      { item: 'apple', created_at: '2026-01-02T00:00:00Z', giver: g('c', 'Cy') },
    ]
    const shelf = aggregateShelf(rows)
    // Two distinct items; heart (count 2) ranks before apple (count 1).
    expect(shelf.map((e) => e.slug)).toEqual(['heart', 'apple'])
    const heart = shelf.find((e) => e.slug === 'heart')!
    // MUTATION-PROOF ANCHOR: count is the number of gift rows for the item (each gift counts).
    expect(heart.count).toBe(2)
    // Ben's gift is later than Ada's → Ben leads the giver list (most-recent-first).
    expect(heart.givers.map((x) => x.name)).toEqual(['Ben', 'Ada'])
    expect(shelf.find((e) => e.slug === 'apple')!.count).toBe(1)
  })

  it('skips unknown item slugs (a future item never renders unlabelled)', () => {
    const rows = [
      { item: 'heart', created_at: '2026-01-01T00:00:00Z', giver: g('a', 'Ada') },
      { item: 'diamond', created_at: '2026-01-02T00:00:00Z', giver: g('b', 'Ben') },
    ]
    const shelf = aggregateShelf(rows)
    expect(shelf.map((e) => e.slug)).toEqual(['heart'])
  })

  it('falls back to "Someone" when a giver name is missing', () => {
    const rows = [{ item: 'heart', created_at: '2026-01-01T00:00:00Z', giver: null }]
    const shelf = aggregateShelf(rows)
    expect(shelf[0].givers[0].name).toBe('Someone')
  })

  it('returns [] for no rows (genuine empty shelf)', () => {
    expect(aggregateShelf([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// MEDIUM-3: error ≠ empty for the async reads/writes + the client slug guard.
// Each error-path test FAILS if the source turns a read error into an empty success
// (mutation-proven: break appreciation.ts:~215 / ~:127 / the slug guard → red → restore → green).
// ---------------------------------------------------------------------------
describe('myReceivedShelf — error ≠ empty (shelf read, appreciation.ts ~:215)', () => {
  it('a read ERROR resolves { ok:false } with a message, NEVER an empty shelf', async () => {
    const client = makeClient(READ_ERROR)
    const res = await myReceivedShelf(client, 'receiver-1')
    // MUTATION ANCHOR: if `if (error) throw error` is turned into an empty success, this
    // resolves { ok:true, shelf:[] } and the assertion below fails.
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0)
  })

  it('a genuinely empty read resolves { ok:true, shelf:[] } (distinct from the error)', async () => {
    const res = await myReceivedShelf(makeClient({ data: [], error: null }), 'receiver-1')
    expect(res).toEqual({ ok: true, shelf: [] })
  })
})

describe('listSentTo — error ≠ empty (sent-list read, appreciation.ts ~:127)', () => {
  it('a read ERROR resolves { ok:false } with a message, NEVER an empty item list', async () => {
    const client = makeClient(READ_ERROR)
    const res = await listSentTo(client, 'giver-1', 'receiver-1')
    // MUTATION ANCHOR: turning the shelf/sent read error into an empty success makes this
    // resolve { ok:true, items:[] }; the assertion catches it.
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0)
  })

  it('a genuinely empty read resolves { ok:true, items:[] } (distinct from the error)', async () => {
    const res = await listSentTo(makeClient({ data: [], error: null }), 'giver-1', 'receiver-1')
    expect(res).toEqual({ ok: true, items: [] })
  })
})

describe('giveAppreciation — client slug guard (appreciation.ts ~:76)', () => {
  it('rejects an invalid slug with { ok:false } WITHOUT calling the RPC', async () => {
    const client = makeClient({ data: { id: 'x', created: true }, error: null })
    const res = await giveAppreciation(client, 'receiver-1', 'banana')
    // MUTATION ANCHOR: if the `isAppreciationSlug` guard is removed, the invalid slug reaches
    // the RPC (rpcCalled true) and returns ok:true from the mock; both assertions catch it.
    expect(res.ok).toBe(false)
    expect(client.state.rpcCalled).toBe(false)
  })

  it('a valid slug calls the RPC and returns the created gift', async () => {
    const client = makeClient({ data: { id: 'gift-1', created: true }, error: null })
    const res = await giveAppreciation(client, 'receiver-1', 'heart')
    expect(res).toEqual({ ok: true, created: true, giftId: 'gift-1' })
    expect(client.state.rpcCalled).toBe(true)
  })
})
