// apps/web/src/hooks/use-realtime-comments.count.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// useRealtimeComments reports the number of comments members can see: a fake client counts the
// post's rows under the filters the hook sends, so a deleted (soft-deleted) or hidden comment that
// the query forgot to exclude shows up in the number.

import { describe, it, expect, vi } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const ROWS = [
  { post_id: 'p1', is_hidden: false, deleted_at: null },
  { post_id: 'p1', is_hidden: false, deleted_at: null },
  { post_id: 'p1', is_hidden: false, deleted_at: '2026-10-01T00:00:00Z' },
  { post_id: 'p1', is_hidden: true, deleted_at: null },
  { post_id: 'p2', is_hidden: false, deleted_at: null },
]
vi.mock('@/lib/supabase/client', () => {
  const client = {
    from: () => {
      let rows = ROWS as Array<Record<string, unknown>>
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), chain),
        is: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), chain),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ count: rows.length, error: null }).then(res),
      }
      return chain
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  }
  return { createClient: () => client }
})

import { mount } from '@/test/mini-react'
import { useRealtimeComments } from './use-realtime-feed'

describe('useRealtimeComments', () => {
  it('counts live, visible comments only (deleted and hidden ones are left out)', async () => {
    const counts: number[] = []
    const onCommentChange = (n: number) => void counts.push(n)
    const c = mount(() => useRealtimeComments({ postId: 'p1', onCommentChange }))
    await c.flush()
    expect(counts).toEqual([2])
  })
})
