// apps/web/src/app/(admin)/moderation/use-admin-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The React bindings of the focus session (I2): the owning tab claims the focus on mount and its row
// is written exactly once — `abandoned` when the tab unmounts before resolving, nothing extra when
// it already resolved, and React's development double-invoke (mount, cleanup, mount) keeps the same
// session instead of abandoning it. The shell gate runs once, only after the tabs are decided.
// React is replaced by a minimal synchronous harness (no DOM renderer in this repo).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Effect = { fn: () => void | (() => void); cleanup?: void | (() => void) }
type Instance = { state: unknown[]; refs: Array<{ current: unknown }>; i: number; r: number; effects: Effect[] }
let current: Instance | null = null
vi.mock('react', () => ({
  useState: (init: unknown) => {
    const inst = current as Instance
    const i = inst.i++
    if (inst.state.length <= i) inst.state.push(typeof init === 'function' ? (init as () => unknown)() : init)
    return [inst.state[i], (v: unknown) => (inst.state[i] = v)]
  },
  useRef: (init: unknown) => {
    const inst = current as Instance
    const r = inst.r++
    if (inst.refs.length <= r) inst.refs.push({ current: init })
    return inst.refs[r]
  },
  useEffect: (fn: () => void | (() => void)) => {
    ;(current as Instance).effects.push({ fn })
  },
}))

const rows = vi.hoisted(() => [] as Array<Record<string, unknown>>)
vi.mock('@/lib/logger', () => ({
  logEvent: (name: string, attrs: Record<string, unknown>) => rows.push({ name, ...attrs }),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { useAdminFocusGate, useAdminFocusSession } from './use-admin-focus'
import { shellOwnerTab } from './admin-focus-session'

const ID = '11111111-1111-4111-8111-111111111111'
let search = ''
const replaceState = vi.fn((_s: unknown, _t: string, href: string) => {
  search = href.includes('?') ? href.slice(href.indexOf('?')) : ''
})

function mount<T>(hook: () => T) {
  const inst: Instance = { state: [], refs: [], i: 0, r: 0, effects: [] }
  const render = () => {
    inst.i = 0
    inst.r = 0
    inst.effects = []
    current = inst
    try {
      return hook()
    } finally {
      current = null
    }
  }
  const runEffects = () => inst.effects.forEach((e) => (e.cleanup = e.fn()))
  const runCleanups = () => inst.effects.forEach((e) => typeof e.cleanup === 'function' && e.cleanup())
  render()
  runEffects()
  return {
    read: () => {
      const saved = inst.effects
      const v = render()
      inst.effects = saved
      return v
    },
    /** React StrictMode (development): cleanup then re-run every effect of the same instance. */
    strictReinvoke: () => {
      runCleanups()
      runEffects()
    },
    unmount: runCleanups,
    /** Re-render with new inputs and re-run the effects (their deps changed). */
    update: () => {
      runCleanups()
      render()
      runEffects()
    },
  }
}

beforeEach(() => {
  rows.length = 0
  replaceState.mockClear()
  vi.useFakeTimers()
  vi.stubGlobal('window', {
    get location() {
      return { pathname: '/moderation', search, hash: '' }
    },
    history: { state: null, replaceState },
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useAdminFocusSession', () => {
  it('claims its kind on mount; resolving writes one row and strips the focus; unmount adds nothing', () => {
    search = `?tab=moderation&focus=post:${ID}`
    const tab = mount(() => useAdminFocusSession('post', 'moderation'))
    const session = tab.read()
    expect(session?.focus).toEqual({ kind: 'post', id: ID })
    session!.resolve('found')
    tab.unmount()
    vi.runAllTimers()
    expect(rows).toEqual([{ name: 'admin.deeplink.resolve', kind: 'post', outcome: 'found', tab: 'moderation' }])
    expect(search).toBe('?tab=moderation')
  })

  it('unmounted before resolving: exactly one abandoned row (after the deferral)', () => {
    search = `?tab=events&focus=event:${ID}`
    const tab = mount(() => useAdminFocusSession('event', 'events'))
    tab.unmount()
    expect(rows).toEqual([])
    vi.runAllTimers()
    expect(rows).toEqual([{ name: 'admin.deeplink.resolve', kind: 'event', outcome: 'abandoned', tab: 'events' }])
    expect(search).toBe('?tab=events')
  })

  it('development double-invoke keeps the SAME session: no abandoned row, still resolvable once', () => {
    search = `?tab=moderation&focus=safety_alert:${ID}`
    const tab = mount(() => useAdminFocusSession('safety_alert', 'moderation'))
    const first = tab.read()
    tab.strictReinvoke()
    vi.runAllTimers()
    expect(rows).toEqual([])
    expect(tab.read()).toBe(first)
    first!.resolve('not_found')
    expect(rows).toEqual([{ name: 'admin.deeplink.resolve', kind: 'safety_alert', outcome: 'not_found', tab: 'moderation' }])
  })

  it('another kind in the URL: no session, no row, URL untouched', () => {
    search = `?tab=moderation&focus=safety_alert:${ID}`
    const tab = mount(() => useAdminFocusSession('post', 'moderation'))
    expect(tab.read()).toBeNull()
    tab.unmount()
    vi.runAllTimers()
    expect(rows).toEqual([])
    expect(replaceState).not.toHaveBeenCalled()
  })
})

describe('useAdminFocusGate', () => {
  it('waits for the tabs to be decided, then writes forbidden once', () => {
    search = `?tab=moderation&focus=post:${ID}`
    let ready = false
    let tabs: string[] = []
    const shell = mount(() => useAdminFocusGate(ready, tabs, shellOwnerTab))
    expect(rows).toEqual([])
    // Tier and organization roles loaded: an organization admin with no tier sees Events only.
    ready = true
    tabs = ['events']
    shell.update()
    expect(rows).toEqual([{ name: 'admin.deeplink.resolve', kind: 'post', outcome: 'forbidden', tab: 'moderation' }])
    expect(search).toBe('?tab=moderation')
    // Later renders (new tab arrays) never write again.
    search = `?tab=moderation&focus=post:${ID}`
    shell.update()
    shell.strictReinvoke()
    expect(rows).toHaveLength(1)
  })

  it('owning tab shown: the gate writes nothing (the tab resolves it)', () => {
    search = `?tab=moderation&focus=post:${ID}`
    mount(() => useAdminFocusGate(true, ['moderation'], shellOwnerTab))
    expect(rows).toEqual([])
    expect(search).toBe(`?tab=moderation&focus=post:${ID}`)
  })
})
