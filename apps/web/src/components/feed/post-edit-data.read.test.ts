// apps/web/src/components/feed/post-edit-data.read.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// After a save the card settles from a re-read with the feed's own column list (FEED_POST_SELECT):
// a narrower read would leave the card without its counts, author and type data.

import { describe, it, expect } from 'vitest'
import { loadFeedRow } from './post-edit-data'
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
