// apps/web/src/test/mini-react.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Test-only: a tiny hook runtime for driving ONE component function in vitest's node environment
// (this repo has no DOM renderer). Hooks keep their slots across renders, effects run after each
// render when their deps changed (cleanup first), and setState marks the instance for a re-render.
// Child components in the returned tree are NOT rendered — tests read their props. Out of scope: the
// ordering of effects ACROSS components (each mount() is one component; React's parent/child commit
// order is not modelled), context, and concurrent rendering.
//
// Use in a test file:
//   vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
//   import { mount, findAll } from '@/test/mini-react'
// Outside mount() every hook falls through to real React (react-dom/server renders still work).

type Deps = readonly unknown[] | undefined
type EffectSlot = { deps: Deps; cleanup?: void | (() => void) }
type Pending = { i: number; fn: () => void | (() => void); deps: Deps }

interface Instance {
  slots: unknown[]
  idx: number
  pending: Pending[]
  dirty: boolean
}

let current: Instance | null = null

function depsChanged(prev: Deps, next: Deps): boolean {
  if (!prev || !next) return true
  return prev.length !== next.length || prev.some((v, i) => !Object.is(v, next[i]))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any

export function miniReact(actual: ReactModule): ReactModule {
  const slot = <T>(init: () => T): { v: T } => {
    const inst = current as Instance
    const i = inst.idx++
    if (!(i in inst.slots)) inst.slots[i] = { v: init() }
    return inst.slots[i] as { v: T }
  }
  const memo = (fn: () => unknown, deps: Deps) => {
    if (!current) return actual.useMemo(fn, deps)
    const s = slot<{ deps: Deps; value: unknown } | null>(() => null)
    if (!s.v || depsChanged(s.v.deps, deps)) s.v = { deps, value: fn() }
    return s.v.value
  }
  const effect = (fn: () => void | (() => void), deps?: Deps) => {
    if (!current) return actual.useEffect(fn, deps)
    const inst = current
    const i = inst.idx++
    inst.pending.push({ i, fn, deps })
  }
  return {
    ...actual,
    useState: (init: unknown) => {
      if (!current) return actual.useState(init)
      const inst = current
      const s = slot(() => (typeof init === 'function' ? (init as () => unknown)() : init))
      return [
        s.v,
        (v: unknown) => {
          const next = typeof v === 'function' ? (v as (p: unknown) => unknown)(s.v) : v
          if (!Object.is(next, s.v)) {
            s.v = next
            inst.dirty = true
          }
        },
      ]
    },
    useRef: (init: unknown) => (current ? slot(() => ({ current: init })).v : actual.useRef(init)),
    useMemo: memo,
    useCallback: (fn: unknown, deps: Deps) => (current ? memo(() => fn, deps) : actual.useCallback(fn, deps)),
    useEffect: effect,
    useLayoutEffect: effect,
    useId: () => (current ? slot(() => `mr-${Math.random().toString(36).slice(2, 8)}`).v : actual.useId()),
    useSyncExternalStore: (s: unknown, get: () => unknown, server?: () => unknown) =>
      current ? get() : actual.useSyncExternalStore(s, get, server),
  }
}

export interface Mounted<T> {
  /** The latest rendered output. */
  tree: () => T
  /** Re-render now (e.g. after changing the inputs the render closure reads) and commit effects. */
  rerender: () => T
  /** Let promises / timers settle, re-rendering while state changed. */
  flush: (rounds?: number) => Promise<T>
  unmount: () => void
}

/** Render `render` (which calls one component function) with the mini runtime. */
export function mount<T>(render: () => T): Mounted<T> {
  const inst: Instance = { slots: [], idx: 0, pending: [], dirty: false }
  const effects = new Map<number, EffectSlot>()
  let out: T
  const commit = () => {
    const pending = inst.pending
    inst.pending = []
    for (const p of pending) {
      const prev = effects.get(p.i)
      if (prev && !depsChanged(prev.deps, p.deps)) continue
      if (prev && typeof prev.cleanup === 'function') prev.cleanup()
      effects.set(p.i, { deps: p.deps, cleanup: p.fn() })
    }
  }
  const renderOnce = () => {
    inst.idx = 0
    inst.dirty = false
    current = inst
    try {
      out = render()
    } finally {
      current = null
    }
    commit()
    return out
  }
  const settle = () => {
    let guard = 0
    while (inst.dirty && guard++ < 50) renderOnce()
    return out
  }
  renderOnce()
  settle()
  return {
    tree: () => out,
    rerender: () => {
      renderOnce()
      return settle()
    },
    flush: async (rounds = 8) => {
      for (let r = 0; r < rounds; r++) {
        await new Promise((res) => setTimeout(res, 0))
        settle()
      }
      return out
    },
    unmount: () => {
      for (const e of effects.values()) if (typeof e.cleanup === 'function') e.cleanup()
      effects.clear()
    },
  }
}

type El = { type?: unknown; props?: Record<string, unknown> } | null | undefined

/** Every element in a rendered tree (descending through props.children only) matching `pred`. */
export function findAll(node: unknown, pred: (el: { type: unknown; props: Record<string, unknown> }) => boolean): Array<{ type: unknown; props: Record<string, unknown> }> {
  const out: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk)
    const el = n as El
    if (!el || typeof el !== 'object' || !el.props) return
    if (pred(el as { type: unknown; props: Record<string, unknown> })) out.push(el as { type: unknown; props: Record<string, unknown> })
    walk(el.props.children)
  }
  walk(node)
  return out
}
