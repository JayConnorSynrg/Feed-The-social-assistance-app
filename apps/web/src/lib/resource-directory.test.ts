// apps/web/src/lib/resource-directory.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Proves the directory reader's query shape and its PII-free metric labels against a recording
// PostgREST builder. Break-on-purpose checks (each turns this file RED):
//   * delete `.eq('status', 'approved')` from fetchDirectoryPage → the APPROVED-ONLY tests fail.
//   * add the search text to the withMetric attrs (e.g. `q: f.q`) → the PII-FREE tests fail.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

const { sinks } = vi.hoisted(() => ({
  sinks: [] as Array<{ event: string; attrs: Record<string, unknown>; errorMessage?: string }>,
}))

// Mirrors the real runWithMetric contract: attrs are read AFTER fn settles.
vi.mock('./logger', () => ({
  withMetric: async (operation: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>) => {
    try {
      const result = await fn()
      sinks.push({ event: `${operation}.complete`, attrs: { ...attrs } })
      return result
    } catch (err) {
      sinks.push({
        event: `${operation}.error`,
        attrs: { ...attrs },
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },
}))

import {
  fetchDirectoryPage,
  activeFilterNames,
  resultBucket,
  queryLenBucket,
  DirectoryReadError,
  DIRECTORY_COLUMNS,
  DIRECTORY_PAGE_SIZE,
} from './resource-directory'

type Call = { method: string; args: unknown[] }

function makeClient(result: {
  data: unknown
  error: { code?: string; message: string } | null
  count: number | null
}) {
  const calls: Call[] = []
  let table = ''
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'textSearch', 'ilike', 'order', 'range']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.then = (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result))
  const client = {
    from(t: string) {
      table = t
      return builder
    },
  }
  return {
    client: client as unknown as SupabaseClient<Database>,
    calls,
    table: () => table,
  }
}

const ROW = {
  id: 'r1',
  name: 'Rutland Food Shelf',
  category: 'food',
  city: 'Rutland',
  state: 'VT',
  address_line1: '1 Main St',
  service_mode: 'physical',
}

const ok = (count: number, rows: unknown[] = [ROW]) => ({ data: rows, error: null, count })

const callsOf = (calls: Call[], method: string) => calls.filter((c) => c.method === method)

beforeEach(() => {
  sinks.length = 0
})

describe('APPROVED-ONLY — every query filters status=approved', () => {
  it('with no filters', async () => {
    const m = makeClient(ok(19118))
    await fetchDirectoryPage(m.client, {})
    expect(m.table()).toBe('resources')
    expect(callsOf(m.calls, 'eq')).toContainEqual({ method: 'eq', args: ['status', 'approved'] })
  })

  it('with every filter active', async () => {
    const m = makeClient(ok(3))
    await fetchDirectoryPage(m.client, { q: 'food', state: 'Vermont', city: 'Rut', category: 'food' }, 50)
    expect(callsOf(m.calls, 'eq')).toContainEqual({ method: 'eq', args: ['status', 'approved'] })
  })
})

describe('query shape', () => {
  it('selects explicit columns with an exact count', async () => {
    const m = makeClient(ok(1))
    await fetchDirectoryPage(m.client, {})
    expect(callsOf(m.calls, 'select')).toEqual([
      { method: 'select', args: [DIRECTORY_COLUMNS, { count: 'exact' }] },
    ])
    expect(DIRECTORY_COLUMNS).toBe('id, name, category, city, state, address_line1, service_mode')
  })

  it('runs websearch only when q is non-empty', async () => {
    const empty = makeClient(ok(1))
    await fetchDirectoryPage(empty.client, { q: '   ' })
    expect(callsOf(empty.calls, 'textSearch')).toHaveLength(0)

    const m = makeClient(ok(1))
    await fetchDirectoryPage(m.client, { q: '  food pantry ' })
    expect(callsOf(m.calls, 'textSearch')).toEqual([
      { method: 'textSearch', args: ['search_document', 'food pantry', { type: 'websearch', config: 'english' }] },
    ])
  })

  it('normalizes state to the stored 2-letter code', async () => {
    const m = makeClient(ok(357))
    await fetchDirectoryPage(m.client, { state: 'Vermont' })
    expect(callsOf(m.calls, 'eq')).toContainEqual({ method: 'eq', args: ['state', 'VT'] })
  })

  it('filters city by case-insensitive PREFIX, with LIKE wildcards escaped', async () => {
    const m = makeClient(ok(141))
    await fetchDirectoryPage(m.client, { city: ' Rut ' })
    expect(callsOf(m.calls, 'ilike')).toEqual([{ method: 'ilike', args: ['city', 'Rut%'] }])

    const w = makeClient(ok(0, []))
    await fetchDirectoryPage(w.client, { city: '50%_' })
    expect(callsOf(w.calls, 'ilike')).toEqual([{ method: 'ilike', args: ['city', '50\\%\\_%'] }])

    // PostgREST reads `*` as `%` in like/ilike values: a typed `*` must never become a wildcard.
    const star = makeClient(ok(0, []))
    await fetchDirectoryPage(star.client, { city: 'R*t*' })
    expect(callsOf(star.calls, 'ilike')).toEqual([{ method: 'ilike', args: ['city', 'Rt%'] }])
  })

  it('filters category only when set', async () => {
    const none = makeClient(ok(1))
    await fetchDirectoryPage(none.client, {})
    expect(callsOf(none.calls, 'eq').map((c) => c.args[0])).toEqual(['status'])

    const m = makeClient(ok(1))
    await fetchDirectoryPage(m.client, { category: 'housing' })
    expect(callsOf(m.calls, 'eq')).toContainEqual({ method: 'eq', args: ['category', 'housing'] })
  })

  it('orders by name and pages 50 rows at the offset', async () => {
    const m = makeClient(ok(200))
    const page = await fetchDirectoryPage(m.client, {}, 100)
    expect(callsOf(m.calls, 'order')[0]).toEqual({ method: 'order', args: ['name', { ascending: true }] })
    expect(callsOf(m.calls, 'range')).toEqual([{ method: 'range', args: [100, 100 + DIRECTORY_PAGE_SIZE - 1] }])
    expect(page).toMatchObject({ total: 200, offset: 100, hasMore: true })
  })

  it('reports hasMore=false on the last page', async () => {
    const m = makeClient(ok(51))
    const page = await fetchDirectoryPage(m.client, {}, 50)
    expect(page).toMatchObject({ total: 51, hasMore: false, rows: [ROW] })
  })
})

describe('PII-FREE metrics', () => {
  const SECRET_Q = 'zxqv-secret-search'
  const SECRET_CITY = 'Qwertyville'

  it('labels carry only the closed vocabulary — never the query or city text', async () => {
    const m = makeClient(ok(141))
    await fetchDirectoryPage(m.client, { q: SECRET_Q, city: SECRET_CITY, state: 'VT', category: 'food' })
    expect(sinks).toHaveLength(1)
    expect(sinks[0].event).toBe('directory.picker.query.complete')
    expect(sinks[0].attrs).toEqual({
      filters: 'category,city,q,state',
      query_len_bucket: '11+',
      result_bucket: '50+',
    })
    const serialized = JSON.stringify(sinks)
    expect(serialized).not.toContain(SECRET_Q)
    expect(serialized).not.toContain(SECRET_CITY)
    expect(serialized).not.toContain(ROW.id)
  })

  it('a failed read logs no input text and throws a bucketed error', async () => {
    const m = makeClient({
      data: null,
      error: { code: '57014', message: `canceling statement: ${SECRET_Q}` },
      count: null,
    })
    await expect(fetchDirectoryPage(m.client, { q: SECRET_Q })).rejects.toBeInstanceOf(DirectoryReadError)
    expect(sinks[0].event).toBe('directory.picker.query.error')
    expect(JSON.stringify(sinks)).not.toContain(SECRET_Q)
    expect(sinks[0].errorMessage).toBe('directory query failed (57014)')
  })

  it('no filters → filters label "none"', async () => {
    const m = makeClient(ok(0, []))
    await fetchDirectoryPage(m.client, {})
    expect(sinks[0].attrs).toEqual({ filters: 'none', query_len_bucket: '0', result_bucket: '0' })
  })
})

describe('bucket helpers', () => {
  it('activeFilterNames is sorted and ignores blank values', () => {
    expect(activeFilterNames({ state: 'VT', q: 'x', city: '  ', category: null })).toEqual(['q', 'state'])
  })

  it('resultBucket boundaries', () => {
    expect([0, 1, 10, 11, 50, 51].map(resultBucket)).toEqual(['0', '1-10', '1-10', '11-50', '11-50', '50+'])
  })

  it('queryLenBucket boundaries', () => {
    expect([0, 1, 3, 4, 10, 11].map(queryLenBucket)).toEqual(['0', '1-3', '1-3', '4-10', '4-10', '11+'])
  })
})
