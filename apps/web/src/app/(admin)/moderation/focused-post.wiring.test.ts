// apps/web/src/app/(admin)/moderation/focused-post.wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// FocusedPost (the component) wired end to end against a mocked Supabase client (I2):
//   - a post link: the post is read by id, the session resolves `found` exactly once, and an action
//     calls the moderation RPC once on the id that was READ;
//   - a not-found id: the session resolves `not_found`, and no action can reach an RPC — not even
//     one invoked directly through the view's handler;
//   - no post link: nothing renders and nothing is read.
// React is replaced by a minimal synchronous harness (state slots, refs, effects run on mount).

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Instance = { state: unknown[]; refs: Array<{ current: unknown }>; i: number; r: number; effects: Array<() => unknown> }
let current: Instance | null = null
vi.mock('react', async (orig) => {
  const actual = await orig<typeof import('react')>()
  return {
    ...actual,
    useState: (init: unknown) => {
      const inst = current as Instance
      const i = inst.i++
      if (inst.state.length <= i) inst.state.push(typeof init === 'function' ? (init as () => unknown)() : init)
      return [inst.state[i], (v: unknown) => (inst.state[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(inst.state[i]) : v)]
    },
    useRef: (init: unknown) => {
      const inst = current as Instance
      const r = inst.r++
      if (inst.refs.length <= r) inst.refs.push({ current: init })
      return inst.refs[r]
    },
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => unknown) => {
      ;(current as Instance).effects.push(fn)
    },
  }
})

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

import { FocusedPost, type FocusedPostViewProps } from './focused-post'

const LINKED = '11111111-1111-4111-8111-111111111111'

function mountFocusedPost() {
  const inst: Instance = { state: [], refs: [], i: 0, r: 0, effects: [] }
  const render = () => {
    inst.i = 0
    inst.r = 0
    inst.effects = []
    current = inst
    try {
      return FocusedPost({}) as { props: FocusedPostViewProps } | null
    } finally {
      current = null
    }
  }
  render()
  inst.effects.forEach((fn) => fn())
  return { render }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  h.resolved.length = 0
  h.reads.length = 0
  h.rpcs.length = 0
  h.session = {
    focus: { kind: 'post', id: LINKED },
    isOpen: () => h.resolved.length === 0,
    resolve: (o: string) => (h.resolved.length ? false : (h.resolved.push(o), true)),
  }
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb())
})

describe('FocusedPost wiring', () => {
  it('found: resolves found once; Remove calls admin_remove_post once on the id that was read', async () => {
    h.postRow = { id: LINKED, content: 'x', post_type: 'request', created_at: '2026-10-01T00:00:00Z', is_hidden: false, hidden_reason: null, hidden_at: null, author: null }
    const c = mountFocusedPost()
    expect(c.render()?.props.state).toEqual({ status: 'loading' })
    await flush()
    expect(h.reads).toEqual([LINKED])
    expect(h.resolved).toEqual(['found'])
    const view = c.render()!
    expect(view.props.state.status).toBe('found')
    view.props.onAction('remove')
    await flush()
    expect(h.rpcs).toEqual([{ fn: 'admin_remove_post', args: { p_post_id: LINKED } }])
    expect(c.render()!.props.state).toMatchObject({ status: 'found', post: { is_hidden: true, hidden_reason: 'admin_removal' } })
  })

  it('not found: resolves not_found; every action is refused before any RPC', async () => {
    h.postRow = null
    const c = mountFocusedPost()
    await flush()
    expect(h.resolved).toEqual(['not_found'])
    const view = c.render()!
    expect(view.props.state).toEqual({ status: 'not_found' })
    for (const a of ['remove', 'hold', 'authorize'] as const) view.props.onAction(a)
    await flush()
    expect(h.rpcs).toEqual([])
  })

  it('while loading, an action is refused too', async () => {
    h.postRow = null
    const c = mountFocusedPost()
    c.render()!.props.onAction('hold')
    await flush()
    expect(h.rpcs).toEqual([])
  })

  it('no post link: renders nothing and reads nothing', async () => {
    h.session = null
    const c = mountFocusedPost()
    await flush()
    expect(c.render()).toBeNull()
    expect(h.reads).toEqual([])
  })
})
