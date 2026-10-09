// apps/web/src/app/(admin)/moderation/focused-post.wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// FocusedPost (the component) wired end to end against a mocked Supabase client (I2), on the mini
// hook runtime:
//   - a post link: the post is read by id, the session resolves `found` exactly once, an action calls
//     the moderation RPC once on the id that was READ, and focus then lands on the panel heading;
//   - a not-found id or a post still loading: no action reaches an RPC, even through the handler;
//   - L1: when the queue below changes the same post (reloadKey bumps), the panel re-reads it — it
//     never offers Hold on a post the queue just removed (which would overwrite admin_removal);
//   - closing the panel tells the tab (which moves focus to the selected sub-tab);
//   - no post link: nothing renders and nothing is read.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  session: null as null | { focus: { kind: string; id: string }; resolve: (o: string) => boolean; isOpen: () => boolean },
  resolved: [] as string[],
  postRow: null as unknown,
  reads: [] as string[],
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}))
vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => h.session }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (_c: string, v: string) => (h.reads.push(v), chain),
        maybeSingle: async () => ({ data: h.postRow, error: null }),
      }
      return chain
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args })
      return Promise.resolve({ data: { success: true }, error: null })
    },
  }),
}))

import { mount } from '@/test/mini-react'
import { FocusedPost, type FocusedPostViewProps } from './focused-post'
import { postActionsFor } from './post-moderation-actions'

const LINKED = '11111111-1111-4111-8111-111111111111'
const visible = { id: LINKED, content: 'x', post_type: 'request', created_at: '2026-10-01T00:00:00Z', is_hidden: false, hidden_reason: null, hidden_at: null, author: null }

type View = { props: FocusedPostViewProps } | null
let props: { reloadKey: number; onChanged: () => void; onDismissed: () => void }
const changed: string[] = []

function mountPanel() {
  return mount(() => FocusedPost(props) as unknown as View)
}

beforeEach(() => {
  h.resolved.length = 0
  h.reads.length = 0
  h.rpcs.length = 0
  changed.length = 0
  props = { reloadKey: 0, onChanged: () => changed.push('changed'), onDismissed: () => changed.push('dismissed') }
  h.session = {
    focus: { kind: 'post', id: LINKED },
    isOpen: () => h.resolved.length === 0,
    resolve: (o: string) => (h.resolved.length ? false : (h.resolved.push(o), true)),
  }
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb())
})

describe('FocusedPost wiring', () => {
  it('found: one found; Remove → admin_remove_post once on the read id, focus to the heading, onChanged', async () => {
    h.postRow = visible
    const c = mountPanel()
    expect(c.tree()?.props.state).toEqual({ status: 'loading' })
    const view = (await c.flush())!
    expect(h.reads).toEqual([LINKED])
    expect(h.resolved).toEqual(['found'])
    expect(view.props.state.status).toBe('found')
    const heading = { focus: vi.fn() }
    ;(view.props.headingRef as { current: unknown }).current = heading
    heading.focus.mockClear()
    view.props.onAction('remove')
    const after = (await c.flush())!
    expect(h.rpcs).toEqual([{ fn: 'admin_remove_post', args: { p_post_id: LINKED } }])
    expect(after.props.state).toMatchObject({ status: 'found', post: { is_hidden: true, hidden_reason: 'admin_removal' } })
    expect(after.props.lastAction).toBe('remove')
    expect(heading.focus).toHaveBeenCalledTimes(1)
    expect(changed).toEqual(['changed'])
  })

  it('not found: one not_found; every action is refused before any RPC', async () => {
    h.postRow = null
    const c = mountPanel()
    const view = (await c.flush())!
    expect(h.resolved).toEqual(['not_found'])
    expect(view.props.state).toEqual({ status: 'not_found' })
    for (const a of ['remove', 'hold', 'authorize'] as const) view.props.onAction(a)
    await c.flush()
    expect(h.rpcs).toEqual([])
  })

  it('while loading, an action is refused too', async () => {
    h.postRow = null
    const c = mountPanel()
    c.tree()!.props.onAction('hold')
    await c.flush()
    expect(h.rpcs).toEqual([])
  })

  it('L1: the queue removed the same post → reloadKey bump → re-read; Hold is no longer offered; still one row', async () => {
    h.postRow = visible
    const c = mountPanel()
    await c.flush()
    expect(postActionsFor((c.tree()!.props.state as { post: typeof visible }).post)).toEqual(['remove', 'hold'])
    // The reports queue below removed it.
    h.postRow = { ...visible, is_hidden: true, hidden_reason: 'admin_removal' }
    props = { ...props, reloadKey: 1 }
    c.rerender()
    const view = (await c.flush())!
    expect(h.reads).toEqual([LINKED, LINKED])
    expect(view.props.state).toMatchObject({ status: 'found', post: { hidden_reason: 'admin_removal' } })
    expect(postActionsFor((view.props.state as { post: typeof visible }).post)).toEqual(['authorize'])
    expect(h.resolved).toEqual(['found'])
  })

  it('closing the panel hides it and tells the tab', async () => {
    h.postRow = visible
    const c = mountPanel()
    const view = (await c.flush())!
    view.props.onDismiss()
    expect(c.rerender()).toBeNull()
    expect(changed).toEqual(['dismissed'])
  })

  it('no post link: renders nothing and reads nothing', async () => {
    h.session = null
    const c = mountPanel()
    expect(await c.flush()).toBeNull()
    expect(h.reads).toEqual([])
  })
})
