// apps/web/src/test-utils/ssr-hook-harness.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Drive a client component through mount → effects → re-render in the node test environment (no
// DOM), so a test can prove what the REAL component does, not only its extracted helpers. A test file
// swaps React's useState / useEffect for this store:
//
//   vi.mock('react', async (importOriginal) => {
//     const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
//     return reactWithHarness(await importOriginal<typeof import('react')>())
//   })
//
// then renders with `await harness.settle(element)`: each pass is a react-dom/server render; useState,
// useRef, useMemo and useCallback values are kept between passes by hook call order (one component
// tree per test, rendered in the same order), so a memoized callback keeps its identity as in a
// mounted component; effects run after the pass whose deps changed (cleanup first). settle()
// re-renders until nothing set state. harness.unmount() runs every cleanup. Other hooks (useId,
// useSyncExternalStore, …) are React's own.

import type * as React from 'react'
import type { ReactElement } from 'react'

type Actual = typeof React
type Cleanup = void | (() => void)

const store = {
  states: [] as unknown[],
  stateIndex: 0,
  deps: [] as Array<readonly unknown[] | null | undefined>,
  effectIndex: 0,
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  memos: [] as Array<{ value: unknown; deps: readonly unknown[] | undefined }>,
  memoIndex: 0,
  pending: [] as Array<() => void>,
  cleanups: [] as Cleanup[],
  dirty: false,
}

function depsChanged(prev: readonly unknown[] | null | undefined, next: readonly unknown[] | undefined): boolean {
  if (!next || !prev) return true
  return prev.length !== next.length || next.some((d, k) => !Object.is(d, prev[k]))
}

/** React with useState / useEffect backed by the harness store (use inside vi.mock('react')). */
export function reactWithHarness(actual: Actual): Actual {
  const state = (init: unknown) => {
    const i = store.stateIndex++
    if (!(i in store.states)) store.states[i] = typeof init === 'function' ? (init as () => unknown)() : init
    const set = (value: unknown) => {
      const next = typeof value === 'function' ? (value as (p: unknown) => unknown)(store.states[i]) : value
      if (Object.is(next, store.states[i])) return
      store.states[i] = next
      store.dirty = true
    }
    return [store.states[i], set]
  }
  const effect = (fn: () => Cleanup, deps?: readonly unknown[]) => {
    const i = store.effectIndex++
    if (!depsChanged(store.deps[i], deps)) return
    store.deps[i] = deps ?? null
    store.pending.push(() => {
      const previous = store.cleanups[i]
      if (typeof previous === 'function') previous()
      store.cleanups[i] = fn()
    })
  }
  const ref = (init: unknown) => {
    const i = store.refIndex++
    if (!(i in store.refs)) store.refs[i] = { current: init }
    return store.refs[i]
  }
  const memo = (factory: () => unknown, deps?: readonly unknown[]) => {
    const i = store.memoIndex++
    const prev = store.memos[i]
    if (!prev || depsChanged(prev.deps, deps)) store.memos[i] = { value: factory(), deps }
    return store.memos[i].value
  }
  const callback = (fn: unknown, deps?: readonly unknown[]) => memo(() => fn, deps)
  return {
    ...actual,
    useState: state,
    useEffect: effect,
    useRef: ref,
    useMemo: memo,
    useCallback: callback,
  } as unknown as Actual
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export const harness = {
  /** Forget all state and effects (call in beforeEach). */
  reset(): void {
    store.states = []
    store.deps = []
    store.refs = []
    store.memos = []
    store.pending = []
    store.cleanups = []
    store.dirty = false
  },

  /** One render pass, then the effects whose deps changed. Returns the HTML. */
  async render(element: ReactElement): Promise<string> {
    const { renderToStaticMarkup } = await import('react-dom/server')
    store.stateIndex = 0
    store.effectIndex = 0
    store.refIndex = 0
    store.memoIndex = 0
    store.dirty = false
    const html = renderToStaticMarkup(element)
    const run = store.pending
    store.pending = []
    run.forEach((effect) => effect())
    return html
  },

  /** Render, let promises and timers settle, and re-render until no state changes (max `passes`). */
  async settle(element: ReactElement, passes = 25): Promise<string> {
    let html = await harness.render(element)
    for (let n = 0; n < passes; n++) {
      await flush()
      if (!store.dirty) return html
      html = await harness.render(element)
    }
    throw new Error('harness.settle: state kept changing')
  },

  /** Run every effect cleanup (the component unmounted). */
  unmount(): void {
    store.cleanups.forEach((cleanup) => {
      if (typeof cleanup === 'function') cleanup()
    })
    store.cleanups = []
  },
}
