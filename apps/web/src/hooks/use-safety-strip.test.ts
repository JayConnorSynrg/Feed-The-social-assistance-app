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
//   - the read volume is written as one alerts.poll row per 30 reads, unmount or page hide — never
//     per tab hide, never per read, and one report per window when reads fail (invariant 8);
//   - the server decides what is shown: a browser clock that is ahead or behind hides nothing the
//     server returned and removes nothing by itself (invariant 1).

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
import { ALERTS_POLL_MS, flushPollCounters, resetPollCounters } from '@/lib/safety-alerts-fetch'
import { NOW, HOUR, alert, iso } from '@/test/alert-fixtures'
import { stripActions } from '@/components/feed/safety-strip'
import { LIVE_REGION_CLEAR_MS, neighbourOf, useSafetyStrip } from './use-safety-strip'

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
  resetPollCounters()
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

  it('a reader that fails on every poll for ten minutes: one report, and the failures in the window row', async () => {
    h.backend.answers.safety_alerts_in_view = { error: { code: 'PGRST202', message: 'Could not find the function' } }
    const s = await strip()
    await s.settle(ALERTS_POLL_MS * 10)
    expect(reads()).toHaveLength(11)
    expect(h.warns).toEqual([{ name: 'feed.safety_alerts.fetch_failed', code: 'PGRST202' }])
    expect(h.logs).toEqual([])
    s.c.unmount()
    expect(h.logs).toEqual([{ name: 'alerts.poll', surface: 'strip', reads: 11, changed: 0, errors: 11, last_error: 'PGRST202', result_count: 0, window_s: 600 }])
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

  it('when the server’s "shown until" passes, the strip asks the server once — the answer, not the clock, takes the entry out', async () => {
    // Shown until 90 s from now: between the 60 s and the 120 s poll.
    h.backend.answers.safety_alerts_in_view = { data: [alert({ expires_at: iso(90_000) })] }
    const s = await strip()
    await s.settle(90_000)
    expect(reads()).toHaveLength(2) // mount, the 60 s poll
    // The instant passed (plus the margin): one read, and the server still returns it (its clock is behind ours).
    expect((await s.settle(1_000)).alerts).toHaveLength(1)
    expect(reads()).toHaveLength(3)
    // No second timer for an instant that is already past: the 60 s poll carries on alone.
    await s.settle(28_000)
    expect(reads()).toHaveLength(3)
    h.backend.answers.safety_alerts_in_view = { data: [] }
    expect((await s.settle(1_000)).alerts).toHaveLength(0)
    expect(reads()).toHaveLength(4)
  })

  it('a hidden tab asks nothing when "shown until" passes and keeps the entry; coming back reads once', async () => {
    const s = await strip()
    setVisible(false)
    s.hook().host.applyAnswer(alert({ status: 'resolved', resolved_at: iso(0), version: 2 }))
    expect((await s.settle(6 * HOUR + 5_000)).alerts.map((a) => a.shown_state)).toEqual(['resolved'])
    expect(reads()).toHaveLength(1)
    h.backend.answers.safety_alerts_in_view = { data: [] }
    setVisible(true)
    expect((await s.settle()).alerts).toHaveLength(0)
    expect(reads()).toHaveLength(2)
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
    expect(first).toEqual({ assertive: [], polite: [], spoken: '', notice: '', seq: 0 })

    h.backend.answers.safety_alerts_in_view = { data: [alert(), alert({ id: 'new', alert_type: 'weather', severity: 4 })] }
    const second = (await s.settle(ALERTS_POLL_MS)).live
    expect(second.assertive).toEqual([{ kind: 'new', alert_type: 'weather', severity: 4 }])
    expect(second.polite).toEqual([])
    expect(second.seq).toBe(1)

    // A few seconds later the regions are empty again (browse mode finds no stale sentence)…
    const cleared = (await s.settle(LIVE_REGION_CLEAR_MS)).live
    expect(cleared).toMatchObject({ assertive: [], polite: [], spoken: '', seq: 1 })
    // …and the same answer again leaves the live state the very same object (nothing announced).
    const third = (await s.settle(ALERTS_POLL_MS - LIVE_REGION_CLEAR_MS)).live
    expect(third).toBe(cleared)
  })

  it('an entrant is "new" only when it was created after the list before, or the strip had room', async () => {
    const five = [5, 4, 3, 2, 1].map((n) => alert({ id: `a${n}`, severity: 4, created_at: iso(-n * 60_000) }))
    h.backend.answers.safety_alerts_in_view = { data: five }
    const s = await strip()
    // a1 resolved and sank below a new arrival's cut; an OLDER live alert (created two hours ago) takes
    // the fifth place: it is not new, so nothing is said assertively.
    const older = alert({ id: 'older', severity: 1, created_at: iso(-2 * HOUR) })
    h.backend.answers.safety_alerts_in_view = { data: [...five.slice(0, 4), older] }
    expect((await s.settle(ALERTS_POLL_MS)).live.assertive).toEqual([])
    // An alert created after the newest one held: new.
    const fresh = alert({ id: 'fresh', alert_type: 'weather', severity: 4, created_at: iso(30_000) })
    h.backend.answers.safety_alerts_in_view = { data: [fresh, ...five.slice(0, 4)] }
    expect((await s.settle(ALERTS_POLL_MS)).live.assertive).toEqual([{ kind: 'new', alert_type: 'weather', severity: 4 }])
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
    expect(live).toMatchObject({ assertive: [], polite: [], spoken: 'Alert updated.', notice: 'Alert updated.', seq: 1 })
  })

  it('the spoken outcome is cleared a few seconds later; the visible notice stays until dismissed', async () => {
    const s = await strip()
    s.hook().host.announce('Alert marked resolved.')
    expect((await s.settle(LIVE_REGION_CLEAR_MS - 1)).live).toMatchObject({ spoken: 'Alert marked resolved.', notice: 'Alert marked resolved.' })
    expect((await s.settle(1)).live).toMatchObject({ spoken: '', notice: 'Alert marked resolved.' })
    s.hook().dismissNotice()
    expect(s.hook().live).toMatchObject({ spoken: '', notice: '' })
  })

  it('a second message restarts the few seconds: the first one’s timer never empties the second', async () => {
    const s = await strip()
    s.hook().host.announce('Alert updated.')
    await s.settle(LIVE_REGION_CLEAR_MS - 1000)
    s.hook().host.announce('Alert marked resolved.')
    expect((await s.settle(1000)).live.spoken).toBe('Alert marked resolved.')
    expect((await s.settle(LIVE_REGION_CLEAR_MS - 1000)).live.spoken).toBe('')
  })
})

describe('where focus goes for an alert that is still on the strip', () => {
  it('focusAlert focuses the entry and says so; an entry that is not there is reported, not focused', async () => {
    const s = await strip()
    doc.elements.set('[data-testid="safety-strip-item-a1"]', { focus: () => void focused.push('a1') })
    expect(s.hook().host.focusAlert('a1')).toBe(true)
    expect(s.hook().host.focusAlert('missing')).toBe(false)
    expect(focused).toEqual(['a1'])
  })
})

describe('read volume: alerts.poll rows', () => {
  const polls = () => h.logs.filter((l) => l.name === 'alerts.poll')

  it('ten minutes visible: eleven reads, no row; two hours visible: 121 reads in four rows of thirty', async () => {
    const s = await strip()
    await s.settle(ALERTS_POLL_MS * 10)
    expect([reads().length, polls().length]).toEqual([11, 0])
    await s.settle(ALERTS_POLL_MS * 110)
    expect(reads()).toHaveLength(121)
    expect(polls().map((p) => p.reads)).toEqual([30, 30, 30, 30])
  })

  it('twenty tab hide / show cycles: twenty reads, no row — the counts carry over; unmount writes them as one', async () => {
    const s = await strip()
    for (let i = 0; i < 20; i++) {
      setVisible(false)
      setVisible(true)
      await s.settle()
    }
    expect([reads().length, polls().length]).toEqual([21, 0])
    s.c.unmount()
    expect(h.logs).toEqual([{ name: 'alerts.poll', surface: 'strip', reads: 21, changed: 0, errors: 0, last_error: null, result_count: 1, window_s: 0 }])
    // Nothing is left to write when the page then goes away.
    flushPollCounters()
    expect(polls()).toHaveLength(1)
  })

  it('the page going away writes the open window once; a strip that never read writes nothing', async () => {
    const idle = await strip(null)
    idle.c.unmount()
    flushPollCounters()
    expect(polls()).toEqual([])
    const s = await strip()
    await s.settle(ALERTS_POLL_MS * 3)
    flushPollCounters()
    flushPollCounters()
    expect(polls()).toEqual([{ name: 'alerts.poll', surface: 'strip', reads: 4, changed: 0, errors: 0, last_error: null, result_count: 1, window_s: 180 }])
  })

  it('twenty visits to the panel (mount, one read, unmount): one row per visit, each with its read', async () => {
    for (let i = 0; i < 20; i++) (await strip()).c.unmount()
    expect(reads()).toHaveLength(20)
    expect(polls().map((p) => p.reads)).toEqual(Array(20).fill(1))
  })
})

// The server's verdict (shown_state / shown_until) decides, at the server's clock (NOW). The browser's
// clock is set ahead of or behind it; the strip must hold exactly what the server returned.
describe('the browser clock is wrong: the strip still shows what the server returned', () => {
  const MIN = 60_000
  async function skewed(browserNow: number) {
    vi.setSystemTime(browserNow)
    return strip()
  }
  const viewer = { isGuest: false }

  it('+10 min: a live alert with nine minutes left and a resolved one five minutes from leaving are both shown', async () => {
    h.backend.answers.safety_alerts_in_view = {
      data: [
        alert({ id: 'live9', is_mine: true, expires_at: iso(9 * MIN) }),
        alert({ id: 'live60', expires_at: iso(HOUR) }),
        alert({ id: 'res', is_mine: true, status: 'resolved', resolved_at: iso(-(5 * HOUR + 55 * MIN)) }),
      ],
    }
    const s = await skewed(NOW + 10 * MIN)
    const list = s.hook().alerts
    expect(list.map((a) => [a.id, a.shown_state])).toEqual([['live9', 'live'], ['live60', 'live'], ['res', 'resolved']])
    expect(stripActions(list[0], viewer)).toEqual(['edit', 'resolve', 'withdraw'])
    // Both "shown until" instants are already past on this clock: no timer is armed, nothing is
    // removed, and nothing is read before the 60 s poll.
    expect((await s.settle(59_000)).alerts).toHaveLength(3)
    expect(reads()).toHaveLength(1)
  })

  it('+2 h: a live alert the server returns with one hour left is shown, with its owner’s actions', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ is_mine: true, expires_at: iso(HOUR) })] }
    const s = await skewed(NOW + 2 * HOUR)
    expect(s.hook().alerts.map((a) => a.shown_state)).toEqual(['live'])
    expect(stripActions(s.hook().alerts[0], viewer)).toEqual(['edit', 'resolve', 'withdraw'])
    expect((await s.settle(ALERTS_POLL_MS * 5)).alerts).toHaveLength(1)
  })

  it('+3 h: still shown; an answer applied between reads (the member’s own update) is kept too', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ is_mine: true, expires_at: iso(2 * HOUR) })] }
    const s = await skewed(NOW + 3 * HOUR)
    s.hook().host.applyAnswer(alert({ is_mine: true, expires_at: iso(2 * HOUR), description: 'Detour on Elm', version: 2 }))
    expect(s.hook().alerts).toMatchObject([{ shown_state: 'live', description: 'Detour on Elm' }])
  })

  it('-10 min: when the server’s expiry passes on the server, the next read removes the entry — the slow clock keeps nothing', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ expires_at: iso(30_000) })] }
    const s = await skewed(NOW - 10 * MIN)
    h.backend.answers.safety_alerts_in_view = { data: [] }
    // 45 s in the server's expiry is 15 s past; this browser thinks it is ten minutes away. The entry
    // is what the server last said until the poll asks again.
    expect((await s.settle(45_000)).alerts.map((a) => a.shown_state)).toEqual(['live'])
    expect((await s.settle(15_000)).alerts).toEqual([])
  })

  it('-1 day: nothing the server returned is hidden; a resolved row is drawn resolved, never live', async () => {
    h.backend.answers.safety_alerts_in_view = {
      data: [alert({ id: 'a1', is_mine: true }), alert({ id: 'res', is_mine: true, status: 'resolved', resolved_at: iso(-HOUR) })],
    }
    const s = await skewed(NOW - 24 * HOUR)
    const list = s.hook().alerts
    expect(list.map((a) => [a.id, a.shown_state])).toEqual([['a1', 'live'], ['res', 'resolved']])
    expect(stripActions(list[1], viewer)).toEqual(['withdraw'])
  })

  it('a row the server calls gone is never listed, whatever its dates say on this clock', async () => {
    h.backend.answers.safety_alerts_in_view = { data: [alert({ id: 'gone', shown_state: 'gone', shown_until: null }), alert({ id: 'kept' })] }
    const s = await skewed(NOW - 24 * HOUR)
    expect(s.hook().alerts.map((a) => a.id)).toEqual(['kept'])
  })
})
