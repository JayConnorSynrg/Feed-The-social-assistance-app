// apps/web/src/hooks/use-safety-strip.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 2 — the strip is truthful — on the REAL hook (mini hook runtime, a recording
// Supabase client, fake timers):
//   - reader calls are counted across re-renders, the 60 s poll, a hidden tab, the return to the tab,
//     a refresh after the member's own action, a change of viewer and an unmount;
//   - the list carries the server's is_mine;
//   - an RPC answer changes the list at once with no read; a withdrawal takes the entry out at once
//     and names where focus goes;
//   - what each refresh announces (invariant 7), and that the member's own action is not announced
//     a second time by the read that follows it;
//   - the read volume is written as one alerts.poll row per tab hide / unmount (invariant 8).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  backend: null as unknown as import('@/test/alert-fixtures').RpcBackend,
  logs: [] as Array<Record<string, unknown>>,
  warns: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/supabase/client', async () => {
  const { createRpcBackend, rpcClient } = await import('@/test/alert-fixtures')
  h.backend = createRpcBackend()
  const client = rpcClient(h.backend)
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: (name: string, attrs: Record<string, unknown>) => h.warns.push({ name, ...attrs }), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => h.logs.push({ name, ...attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { mount } from '@/test/mini-react'
import { ALERTS_POLL_MS } from '@/lib/safety-alerts-fetch'
import { NOW, HOUR, alert, iso } from '@/test/alert-fixtures'
import { neighbourOf, useSafetyStrip } from './use-safety-strip'

const doc = {
  visibilityState: 'visible' as 'visible' | 'hidden',
  listeners: new Map<string, () => void>(),
  elements: new Map<string, { focus: () => void }>(),
  addEventListener(type: string, fn: () => void) {
    doc.listeners.set(type, fn)
  },
  removeEventListener(type: string) {
    doc.listeners.delete(type)
  },
  querySelector(selector: string) {
    return doc.elements.get(selector) ?? null
  },
}
const setVisible = (visible: boolean) => {
  doc.visibilityState = visible ? 'visible' : 'hidden'
  doc.listeners.get('visibilitychange')?.()
}

const reads = () => h.backend.named('safety_alerts_in_view')
const focused: string[] = []
const fallback = () => void focused.push('feed-title')

/** Mount the hook for a viewer; `c.settle(ms)` lets time and promises run, then re-renders. */
async function strip(initialViewer: string | null = 'user-1') {
  const state = { viewer: initialViewer }
  const c = mount(() => useSafetyStrip(state.viewer, fallback))
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms)
    return c.rerender()
  }
  await settle()
  return { c, state, settle, hook: () => c.rerender() }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  h.backend.reset()
  h.backend.answers.safety_alerts_in_view = { data: [alert()] }
  h.logs.length = 0
  h.warns.length = 0
  focused.length = 0
  doc.visibilityState = 'visible'
  doc.listeners.clear()
  doc.elements.clear()
  vi.stubGlobal('document', doc)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('when the strip reads', () => {
  it('one read on mount, through the strip reader call; fifty re-renders read nothing more', async () => {
    const s = await strip()
    for (let i = 0; i < 50; i++) s.c.rerender()
    await s.settle()
    expect(reads()).toHaveLength(1)
    expect(reads()[0].args).toEqual({ p_limit: 5, p_include_resolved: true })
    expect(s.hook().alerts.map((a) => a.id)).toEqual([alert().id])
  })

  it('every 60 s while the tab is visible — re-rendering in between changes nothing', async () => {
    const s = await strip()
    for (let second = 0; second < 180; second++) await s.settle(1000)
    expect(reads()).toHaveLength(1 + 3)
  })

  it('a hidden tab reads nothing; coming back reads once, at once', async () => {
    const s = await strip()
    setVisible(false)
    await s.settle(ALERTS_POLL_MS * 5)
    expect(reads()).toHaveLength(1)
    setVisible(true)
    await s.settle()
    expect(reads()).toHaveLength(2)
    await s.settle(ALERTS_POLL_MS)
    expect(reads()).toHaveLength(3)
  })

  it('a refresh after the member’s own action reads once, now', async () => {
    const s = await strip()
    s.hook().host.refresh()
    await s.settle()
    expect(reads()).toHaveLength(2)
  })

  it('no viewer yet (auth loading): nothing is read; each viewer is read once', async () => {
    const s = await strip(null)
    await s.settle(ALERTS_POLL_MS * 2)
    expect(reads()).toHaveLength(0)
    s.state.viewer = 'user-1'
    await s.settle()
    s.state.viewer = 'user-2'
    await s.settle()
    for (let i = 0; i < 10; i++) s.c.rerender()
    expect(reads()).toHaveLength(2)
  })

  it('a new viewer starts from an empty list and a silent baseline', async () => {
    const s = await strip('user-1')
    h.backend.answers.safety_alerts_in_view = { data: [alert({ id: 'other', is_mine: true })] }
    s.state.viewer = 'user-2'
    s.c.rerender() // the viewer changed: the effect reads for the new one
    const hook = await s.settle()
    expect(hook.alerts.map((a) => a.id)).toEqual(['other'])
    expect(hook.live).toMatchObject({ assertive: [], polite: [], seq: 0 })
  })

  it('unmount stops the poll', async () => {
    const s = await strip()
    s.c.unmount()
    await vi.advanceTimersByTimeAsync(ALERTS_POLL_MS * 3)
    expect(reads()).toHaveLength(1)
  })

  it('a failed read keeps the list and is recorded', async () => {
    const s = await strip()
    h.backend.answers.safety_alerts_in_view = { error: { code: '57014', message: 'timeout' } }
    const hook = await s.settle(ALERTS_POLL_MS)
    expect(hook.alerts).toHaveLength(1)
    expect(h.warns).toEqual([{ name: 'feed.safety_alerts.fetch_failed', code: '57014' }])
  })
})

describe('what the strip holds', () => {
  it('the server’s is_mine reaches the list', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ id: 'mine', is_mine: true }), alert({ id: 'theirs', is_mine: false, severity: 1 })] }
    const s = await strip()
    expect(s.hook().alerts.map((a) => [a.id, a.is_mine])).toEqual([['mine', true], ['theirs', false]])
  })

  it('an RPC answer changes the entry at once, with no read', async () => {
    const s = await strip()
    s.hook().host.applyAnswer(alert({ status: 'resolved', resolved_at: iso(0), version: 2 }))
    const hook = s.hook()
    expect(hook.alerts[0]).toMatchObject({ status: 'resolved', version: 2 })
    expect(reads()).toHaveLength(1)
  })

  it('a resolved entry leaves six hours later with no read', async () => {
    const s = await strip()
    setVisible(false) // no poll: only the store's own clock can take it away
    s.hook().host.applyAnswer(alert({ status: 'resolved', resolved_at: iso(0), version: 2 }))
    expect((await s.settle(6 * HOUR - 1)).alerts).toHaveLength(1)
    expect((await s.settle(1)).alerts).toHaveLength(0)
    expect(reads()).toHaveLength(1)
  })

  it('a withdrawal takes the entry out at once; focus then goes to the next entry, or the feed heading', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ id: 'a1', severity: 4 }), alert({ id: 'a2', severity: 3 }), alert({ id: 'a3', severity: 1 })] }
    const s = await strip()
    doc.elements.set('[data-testid="safety-strip-item-a3"]', { focus: () => void focused.push('a3') })
    s.hook().host.leave('a2')
    expect(s.hook().alerts.map((a) => a.id)).toEqual(['a1', 'a3'])
    s.hook().host.focusAfterLeave()
    expect(focused).toEqual(['a3'])
    // The last one left: nothing follows it, so the heading takes focus.
    s.hook().host.leave('a3')
    s.hook().host.leave('a1')
    s.hook().host.focusAfterLeave()
    expect(focused).toEqual(['a3', 'feed-title'])
  })

  it('neighbourOf: the next entry, else the one before, else nothing', () => {
    const list = [alert({ id: 'a1' }), alert({ id: 'a2' }), alert({ id: 'a3' })]
    expect(neighbourOf(list, 'a1')).toBe('a2')
    expect(neighbourOf(list, 'a3')).toBe('a2')
    expect(neighbourOf([alert({ id: 'a1' })], 'a1')).toBeNull()
    expect(neighbourOf(list, 'nope')).toBeNull()
  })
})

describe('what a refresh announces', () => {
  it('nothing on the first read; a new alert assertively; an unchanged refresh leaves the regions alone', async () => {
    const s = await strip()
    const first = s.hook().live
    expect(first).toEqual({ assertive: [], polite: [], notice: '', seq: 0 })

    h.backend.answers.safety_alerts_in_view = { data: [alert(), alert({ id: 'new', alert_type: 'weather', severity: 4 })] }
    const second = (await s.settle(ALERTS_POLL_MS)).live
    expect(second.assertive).toEqual([{ kind: 'new', alert_type: 'weather', severity: 4 }])
    expect(second.polite).toEqual([])
    expect(second.seq).toBe(1)

    // Same answer again: the live state is the very same object (no new message, nothing announced).
    const third = (await s.settle(ALERTS_POLL_MS)).live
    expect(third).toBe(second)
  })

  it('an update and a resolution are polite; a raised severity is assertive', async () => {
    const s = await strip()
    h.backend.answers.safety_alerts_in_view = { data: [alert({ description: 'Detour on Elm', version: 2 })] }
    expect((await s.settle(ALERTS_POLL_MS)).live).toMatchObject({ assertive: [], polite: [{ kind: 'updated' }] })
    h.backend.answers.safety_alerts_in_view = { data: [alert({ severity: 4, version: 3 })] }
    expect((await s.settle(ALERTS_POLL_MS)).live).toMatchObject({ assertive: [{ kind: 'raised', severity: 4 }], polite: [] })
    h.backend.answers.safety_alerts_in_view = { data: [alert({ severity: 4, version: 4, status: 'resolved', resolved_at: iso(3 * 60_000) })] }
    expect((await s.settle(ALERTS_POLL_MS)).live).toMatchObject({ assertive: [], polite: [{ kind: 'resolved' }] })
  })

  it('the member’s own action is announced once: its notice, and nothing again from the read that follows', async () => {
    const s = await strip()
    const answer = alert({ severity: 4, version: 2, expires_at: iso(72 * HOUR) })
    s.hook().host.applyAnswer(answer)
    s.hook().host.announce('Alert updated.')
    h.backend.answers.safety_alerts_in_view = { data: [answer] }
    s.hook().host.refresh()
    const live = (await s.settle()).live
    expect(live).toMatchObject({ assertive: [], polite: [], notice: 'Alert updated.', seq: 1 })
  })
})

describe('read volume', () => {
  it('one alerts.poll row when the tab is hidden, one on unmount — never one per read', async () => {
    const s = await strip()
    await s.settle(ALERTS_POLL_MS * 3)
    expect(h.logs).toEqual([])
    setVisible(false)
    expect(h.logs).toEqual([{ name: 'alerts.poll', surface: 'strip', reads: 4, changed: 0, errors: 0, result_count: 1, window_s: 180 }])
    setVisible(true)
    await s.settle()
    s.c.unmount()
    expect(h.logs).toHaveLength(2)
    expect(h.logs[1]).toMatchObject({ name: 'alerts.poll', surface: 'strip', reads: 1 })
  })
})
