// apps/web/src/app/(admin)/moderation/reports-queue.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// ReportsQueue after the shared-actions refactor (I3 + L1), on the mini hook runtime with a mocked
// client: Remove takes the post out of the list through moderatePost (one admin_remove_post), then
// tells the tab (onPostChanged) so the linked-post panel re-reads; a refused RPC keeps the post,
// shows the queue's generic line and does not tell the tab. Remove is red-700 (6.4:1).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const POST = '11111111-1111-4111-8111-111111111111'
const h = vi.hoisted(() => ({ rpcs: [] as string[], refuse: false }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      const filters: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'in']) chain[m] = () => chain
      chain.eq = (c: string, v: unknown) => ((filters[c] = v), chain)
      chain.then = (res: (v: unknown) => unknown) => {
        const p = '11111111-1111-4111-8111-111111111111'
        let data: unknown[] = []
        if (table === 'content_reports')
          data = [{ id: 'r1', reporter_id: 'u', content_type: 'post', content_id: p, reason: 'spam', details: null, status: 'open', created_at: '2026-10-01T00:00:00Z' }]
        else if (table === 'posts' && filters.is_hidden !== true) data = [{ id: p, content: 'Buy now', user_id: 'a', is_hidden: false }]
        return Promise.resolve({ data, error: null }).then(res)
      }
      return chain
    },
    rpc: (fn: string) => {
      h.rpcs.push(fn)
      return Promise.resolve(h.refuse ? { data: null, error: { code: '42501', message: 'denied' } } : { data: { success: true }, error: null })
    },
  }),
}))

import { mount, findAll } from '@/test/mini-react'
import { ReportsQueue } from './reports-queue'

const changed: string[] = []
beforeEach(() => {
  h.rpcs.length = 0
  h.refuse = false
  changed.length = 0
})

async function openGroup() {
  const c = mount(() => ReportsQueue({ onPostChanged: (id) => changed.push(id) }))
  let tree = await c.flush()
  const expand = findAll(tree, (el) => el.props.variant === 'ghost')[0]
  ;(expand.props.onClick as () => void)()
  tree = c.rerender()
  const remove = findAll(tree, (el) => el.props['data-testid'] === `remove-post-${POST}`)[0]
  return { c, remove }
}

describe('ReportsQueue post actions', () => {
  it('Remove: one admin_remove_post, the group leaves the list, the tab is told (linked post re-reads)', async () => {
    const { c, remove } = await openGroup()
    expect(String(remove.props.className)).toContain('bg-red-700')
    ;(remove.props.onClick as () => void)()
    const tree = await c.flush()
    expect(h.rpcs).toEqual(['admin_remove_post'])
    expect(changed).toEqual([POST])
    expect(findAll(tree, (el) => el.props['data-testid'] === `remove-post-${POST}`)).toHaveLength(0)
  })

  it('a refused Remove keeps the post, shows the generic line, and does not tell the tab', async () => {
    h.refuse = true
    const { c, remove } = await openGroup()
    ;(remove.props.onClick as () => void)()
    const tree = await c.flush()
    expect(h.rpcs).toEqual(['admin_remove_post'])
    expect(changed).toEqual([])
    expect(findAll(tree, (el) => el.props.children === 'An error occurred')).toHaveLength(1)
  })
})
