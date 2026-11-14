// apps/web/src/components/feed/post-edit-data.read.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// After a save the card settles from a re-read with the feed's own column list (FEED_POST_SELECT):
// a narrower read would leave the card without its counts, author and type data.

import { describe, it, expect } from 'vitest'
import { loadFeedRow, readFeedRow } from './post-edit-data'
import { FEED_POST_SELECT } from './post-model'

describe('loadFeedRow', () => {
  it("re-reads one post with the feed's column list", async () => {
    const seen: unknown[] = []
    const chain = {
      select: (cols: string) => (seen.push(['select', cols]), chain),
      eq: (c: string, v: string) => (seen.push(['eq', c, v]), chain),
      abortSignal: () => chain,
      maybeSingle: async () => ({ data: { id: 'p1' }, error: null }),
    }
    const row = await loadFeedRow({ from: (t: string) => (seen.push(['from', t]), chain) } as never, 'p1')
    expect(row).toEqual({ id: 'p1' })
    expect(seen).toEqual([['from', 'posts'], ['select', FEED_POST_SELECT], ['eq', 'id', 'p1']])
  })
})

describe('readFeedRow: gone is not the same as failed', () => {
  const client = (answer: () => Promise<{ data: unknown; error: unknown }>) => {
    const seen: unknown[] = []
    const chain = {
      select: (cols: string) => (seen.push(['select', cols]), chain),
      eq: (c: string, v: string) => (seen.push(['eq', c, v]), chain),
      abortSignal: () => chain,
      maybeSingle: answer,
    }
    return { seen, client: { from: (t: string) => (seen.push(['from', t]), chain) } as never }
  }

  it('found: the row, read with the feed\'s own column list', async () => {
    const c = client(async () => ({ data: { id: 'p1' }, error: null }))
    expect(await readFeedRow(c.client, 'p1')).toEqual({ status: 'found', row: { id: 'p1' } })
    expect(c.seen).toEqual([['from', 'posts'], ['select', FEED_POST_SELECT], ['eq', 'id', 'p1']])
  })

  it('no row and no error: gone', async () => {
    expect(await readFeedRow(client(async () => ({ data: null, error: null })).client, 'p1')).toEqual({ status: 'gone' })
  })

  it('an error from the read, or a thrown one: failed — never "gone"', async () => {
    const refused = { code: '57014', message: 'timeout' }
    expect(await readFeedRow(client(async () => ({ data: null, error: refused })).client, 'p1')).toEqual({ status: 'error', error: refused })
    const thrown = new Error('network')
    expect(await readFeedRow(client(async () => Promise.reject(thrown)).client, 'p1')).toEqual({ status: 'error', error: thrown })
  })

  it('loadFeedRow keeps its contract: the row, or null for anything else', async () => {
    expect(await loadFeedRow(client(async () => ({ data: null, error: null })).client, 'p1')).toBeNull()
    expect(await loadFeedRow(client(async () => ({ data: null, error: { message: 'x' } })).client, 'p1')).toBeNull()
  })
})
