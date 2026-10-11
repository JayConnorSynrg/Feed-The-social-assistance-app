// apps/web/src/components/alerts/alert-interactions.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What the alert surfaces do when a member acts, on the mini hook runtime (children are not rendered;
// the test calls the handlers the components hand to their elements):
//   - the strip: an entry opens the map on that alert; an action hands over the button it came from
//     (focus returns there); focus OR the pointer entering / leaving an entry is reported, so an
//     alert never leaves under the member (invariant 7); when the server drops the alert whose button
//     held focus, focus moves to the entry itself; the visible notice has a Dismiss control;
//   - the marker: an open popup is reported the same way; a counted vote is announced once, politely;
//     a vote that clears the alert, or one the server answers "no longer live", moves focus first and
//     then says why; any other refusal stays in the popup as a sentence; closing the popup of an
//     ended alert sends focus to the map; an alert that ends under an open popup hands focus to the
//     popup itself;
//   - the history dialog: one read per opening, newest first, "History loaded" announced with the
//     number of entries, focus on its title and back;
//   - the panels hand those callbacks to the store, the dialogs and the status regions.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  backend: null as unknown as import('@/test/alert-fixtures').RpcBackend,
  popup: { open: true, closed: 0, setOpen: [] as boolean[] },
  guest: false,
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: h.guest }) }))
vi.mock('@/lib/supabase/client', async () => {
  const { createRpcBackend, rpcClient } = await import('@/test/alert-fixtures')
  h.backend = createRpcBackend()
  const client = rpcClient(h.backend)
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('react-map-gl/mapbox', () => ({ Marker: 'map-marker', Popup: 'map-popup' }))
vi.mock('@/components/map/marker-popup', async (orig) => ({
  ...(await orig<typeof import('@/components/map/marker-popup')>()),
  useMarkerPopup: () => ({
    open: h.popup.open,
    setOpen: (open: boolean) => void h.popup.setOpen.push(open),
    triggerRef: { current: null },
    titleId: 'alert-title',
    close: () => void h.popup.closed++,
    onPopupOpen: () => {},
  }),
}))

import { mount, findAll } from '@/test/mini-react'
import { HOUR, NOW, alert, iso } from '@/test/alert-fixtures'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'
import { alertsT } from '@/lib/i18n-feed-alerts'
import { formatMessage } from '@/lib/format-message'
import type { AlertOutcome, SafetyAlert } from '@/lib/safety-alert-rpc'
import { SafetyStrip } from '@/components/feed/safety-strip'
import { SafetyAlertMarker } from '@/components/map/safety-alert-marker'
import { MarkerPopupDialog } from '@/components/map/marker-popup'
import { AlertHistoryDialog, AlertHistoryList } from './alert-history-dialog'
import { MapAlertNotice, useAlertDialog } from './alert-dialogs'

type El = { type: unknown; props: Record<string, unknown> }
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
const textOf = (el: El | undefined): string => {
  const walk = (n: unknown): string => (Array.isArray(n) ? n.map(walk).join('') : typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' && 'props' in n ? walk((n as El).props.children) : '')
  return el ? walk(el.props.children) : ''
}
const ID = alert().id

/** The page, as far as these components look at it: what has focus, and one element per selector. */
const page = {
  activeElement: null as unknown,
  body: { name: 'body' },
  elements: new Map<string, unknown>(),
  querySelector: (selector: string) => page.elements.get(selector) ?? null,
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => (cb(0), 0))
  page.activeElement = page.body
  page.elements.clear()
  vi.stubGlobal('document', page)
  h.backend.reset()
  h.popup = { open: true, closed: 0, setOpen: [] }
  h.guest = false
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the strip', () => {
  function strip(alerts: SafetyAlert[], live?: Parameters<typeof SafetyStrip>[0]['live']) {
    const seen = { map: [] as Array<string | undefined>, actions: [] as Array<[string, string, unknown]>, engaged: [] as Array<[string, boolean]>, dismissed: 0 }
    const state = { alerts }
    const c = mount(() =>
      SafetyStrip({
        alerts: state.alerts,
        locale: 'en',
        live,
        now: NOW,
        tz: 'UTC',
        onViewMap: (a) => void seen.map.push(a?.id),
        onAction: (action, a, trigger) => void seen.actions.push([action, a.id, trigger]),
        onEngage: (id, on) => void seen.engaged.push([id, on]),
        onDismissNotice: () => void seen.dismissed++,
      }),
    )
    return { c, seen, state }
  }
  const entryOf = (tree: unknown) => findAll(tree, (e) => e.type === 'li')[0] as El

  it('an entry opens the map on that alert; the header link opens the map as it is', () => {
    const { c, seen } = strip([alert()])
    ;(byTestId(c.tree(), `safety-strip-item-${ID}`)[0].props.onClick as () => void)()
    ;(byTestId(c.tree(), 'safety-strip-view-map')[0].props.onClick as () => void)()
    expect(seen.map).toEqual([ID, undefined])
  })

  it('an owner action hands over the alert and the button it came from (focus returns there)', () => {
    const { c, seen } = strip([alert({ is_mine: true, version: 2 })])
    const button = { id: 'the-button' }
    for (const action of ['edit', 'resolve', 'withdraw', 'history']) {
      ;(byTestId(c.tree(), `safety-strip-${action}-${ID}`)[0].props.onClick as (e: unknown) => void)({ currentTarget: button })
    }
    expect(seen.actions).toEqual([['edit', ID, button], ['resolve', ID, button], ['withdraw', ID, button], ['history', ID, button]])
  })

  it('focus entering an entry engages it; moving inside it changes nothing; leaving it lets go', () => {
    const { c, seen } = strip([alert()])
    const item = entryOf(c.tree())
    const inside = { name: 'a button of this entry' }
    const entry = { contains: (node: unknown) => node === inside }
    ;(item.props.onFocus as () => void)()
    ;(item.props.onFocus as () => void)() // focus moving between its buttons is not a second hold
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: inside })
    expect(seen.engaged).toEqual([[ID, true]])
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: { name: 'elsewhere' } })
    expect(seen.engaged).toEqual([[ID, true], [ID, false]])
  })

  it('focus that went nowhere (its button was taken away) is decided once the page settles', async () => {
    const { c, seen } = strip([alert()])
    const item = entryOf(c.tree())
    const inside = { name: 'the entry button' }
    const entry = { contains: (node: unknown) => node === inside }
    ;(item.props.onFocus as () => void)()
    // The entry took focus back before the page settled: still held.
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: null })
    page.activeElement = inside
    await c.flush(1)
    expect(seen.engaged).toEqual([[ID, true]])
    // Focus really left: released.
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: null })
    page.activeElement = page.body
    await c.flush(1)
    expect(seen.engaged).toEqual([[ID, true], [ID, false]])
  })

  it('the pointer over an entry holds it too; it is released only when neither focus nor the pointer is on it', () => {
    const { c, seen } = strip([alert()])
    const item = entryOf(c.tree())
    ;(item.props.onMouseEnter as () => void)()
    expect(seen.engaged).toEqual([[ID, true]])
    ;(item.props.onFocus as () => void)() // already held: nothing new
    ;(item.props.onMouseLeave as () => void)() // focus still holds it
    expect(seen.engaged).toEqual([[ID, true]])
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: { contains: () => false }, relatedTarget: { name: 'elsewhere' } })
    expect(seen.engaged).toEqual([[ID, true], [ID, false]])
    ;(item.props.onMouseEnter as () => void)()
    ;(item.props.onMouseLeave as () => void)()
    expect(seen.engaged).toEqual([[ID, true], [ID, false], [ID, true], [ID, false]])
  })

  describe('the server drops the alert whose action button held focus', () => {
    const gone = () => alert({ is_mine: true, shown_state: 'gone', shown_until: null })
    function focusable() {
      const focused: string[] = []
      page.elements.set(`[data-testid="safety-strip-item-${ID}"]`, { focus: () => void focused.push('entry') })
      return focused
    }

    it('its button is gone and focus fell to the page: focus moves to the entry itself (still there, marked "No longer listed")', () => {
      const s = strip([alert({ is_mine: true })])
      const focused = focusable()
      ;(entryOf(s.c.tree()).props.onFocus as () => void)()
      s.state.alerts = [gone()]
      page.activeElement = page.body // the focused button was removed
      s.c.rerender()
      expect(focused).toEqual(['entry'])
      expect(byTestId(s.c.tree(), `safety-strip-ended-${ID}`)).toHaveLength(1)
      expect(byTestId(s.c.tree(), `safety-strip-resolve-${ID}`)).toHaveLength(0)
      // No element at all has focus (some browsers report null): the same.
      const again = strip([alert({ is_mine: true })])
      ;(entryOf(again.c.tree()).props.onFocus as () => void)()
      again.state.alerts = [gone()]
      page.activeElement = null
      again.c.rerender()
      expect(focused).toEqual(['entry', 'entry'])
    })

    it('focus that is somewhere real — still on the entry, or in the composer — is never taken', () => {
      const s = strip([alert({ is_mine: true })])
      const focused = focusable()
      ;(entryOf(s.c.tree()).props.onFocus as () => void)()
      s.state.alerts = [gone()]
      page.activeElement = { name: 'the entry button itself' }
      s.c.rerender()
      expect(focused).toEqual([])

      // The member tabbed on to the composer and left the pointer resting on the entry (it is held by
      // hover): when the alert ends, their typing is not interrupted — even if focus later falls to
      // the page for another reason.
      const t = strip([alert({ is_mine: true })])
      const item = entryOf(t.c.tree())
      ;(item.props.onMouseEnter as () => void)()
      ;(item.props.onFocus as () => void)()
      ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: { contains: () => false }, relatedTarget: { name: 'composer' } })
      page.activeElement = { name: 'composer' }
      t.state.alerts = [gone()]
      t.c.rerender()
      page.activeElement = page.body
      t.state.alerts = [gone()]
      t.c.rerender()
      expect(focused).toEqual([])
    })

    it('an entry the member was never on does not take focus; nor does one that is still shown', () => {
      const s = strip([alert({ is_mine: true })])
      const focused = focusable()
      s.state.alerts = [gone()]
      s.c.rerender()
      expect(focused).toEqual([])
      const still = strip([alert({ is_mine: true })])
      ;(entryOf(still.c.tree()).props.onFocus as () => void)()
      still.state.alerts = [alert({ is_mine: true, version: 2, description: 'Detour' })]
      still.c.rerender()
      expect(focused).toEqual([])
    })
  })

  it('the visible notice has a Dismiss control that tells the surface', () => {
    const { c, seen } = strip([alert()], { assertive: [], polite: [], spoken: '', notice: 'Alert updated.', seq: 1 })
    ;(byTestId(c.tree(), 'safety-strip-notice-dismiss')[0].props.onClick as () => void)()
    expect(seen.dismissed).toBe(1)
  })
})

describe('the marker popup', () => {
  function marker(a: SafetyAlert, vote: (a: SafetyAlert, v: string) => Promise<AlertOutcome<SafetyAlert>>) {
    const seen = { engaged: [] as Array<[string, boolean]>, ended: [] as string[], actions: [] as string[] }
    const props = {
      alert: a,
      locale: 'en' as const,
      now: NOW,
      tz: 'UTC',
      onVote: vote as never,
      onEngage: (id: string, on: boolean) => void seen.engaged.push([id, on]),
      onEnded: (notice: string) => void seen.ended.push(notice),
      onAction: (action: string) => void seen.actions.push(action),
    }
    // SafetyAlertMarker guards the coordinates, then renders the component that holds the hooks.
    const guard = SafetyAlertMarker(props) as unknown as { type: (p: typeof props) => unknown; props: typeof props }
    const c = mount(() => guard.type(props))
    return { c, seen, props }
  }
  const voteStatus = (tree: unknown) => textOf(byTestId(tree, `alert-vote-status-${ID}`)[0])
  const ok = (value: SafetyAlert): AlertOutcome<SafetyAlert> => ({ ok: true, value, requestId: 'r' })

  it('a marker without finite coordinates is not drawn at all', () => {
    expect(SafetyAlertMarker({ alert: alert({ lng: Number.NaN }), onVote: async () => ok(alert()) })).toBeNull()
  })

  it('an open popup engages its alert; closing it lets go', () => {
    const m = marker(alert(), async (a) => ok(a))
    expect(m.seen.engaged).toEqual([[ID, true]])
    h.popup.open = false
    m.c.rerender()
    expect(m.seen.engaged).toEqual([[ID, true], [ID, false]])
  })

  it('a vote that leaves the alert live: nothing ends, the popup stays, and "Vote recorded." is said once, politely', async () => {
    const votes: string[] = []
    const m = marker(alert(), async (a, v) => (votes.push(v), ok({ ...a, confirm_count: 2 })))
    const region = byTestId(m.c.tree(), `alert-vote-status-${ID}`)[0]
    expect([region.props.role, textOf(region)]).toEqual(['status', '']) // mounted, empty, before the vote
    ;(byTestId(m.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    expect(votes).toEqual(['confirm'])
    expect(m.seen.ended).toEqual([])
    expect(voteStatus(m.c.tree())).toBe('Vote recorded.')
    // One region says it, as one node: a re-render does not make it a new message…
    const node = () => (byTestId(m.c.tree(), `alert-vote-status-${ID}`)[0].props.children as { key: unknown })?.key
    const first = node()
    m.c.rerender()
    expect(node()).toBe(first)
    expect(findAll(m.c.tree(), (e) => e.props.role === 'status')).toHaveLength(1)
    // …and a second vote is a new node, so it is announced again.
    ;(byTestId(m.c.tree(), `vote-clear-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    expect(voteStatus(m.c.tree())).toBe('Vote recorded.')
    expect(node()).not.toBe(first)
  })

  it('a refused vote announces no "Vote recorded."; in the viewer’s language when it is counted', async () => {
    const refused = marker(alert(), async () => ({ ok: false, failure: { kind: 'unknown', code: 'XX000' }, requestId: 'r' }))
    ;(byTestId(refused.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    await refused.c.flush()
    expect(voteStatus(refused.c.tree())).toBe('')
    const es = marker(alert(), async (a) => ok(a))
    ;(es.props as { locale: string }).locale = 'es'
    es.c.rerender()
    ;(byTestId(es.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    await es.c.flush()
    expect(voteStatus(es.c.tree())).toBe(alertsT('es', 'voteRecorded'))
  })

  it('a second click while a vote is in flight sends nothing', async () => {
    let release!: (v: AlertOutcome<SafetyAlert>) => void
    const votes: string[] = []
    const m = marker(alert(), (_a, v) => (votes.push(v), new Promise((r) => (release = r))))
    ;(byTestId(m.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    m.c.rerender()
    ;(byTestId(m.c.tree(), `vote-clear-${ID}`)[0].props.onClick as () => void)()
    ;(byTestId(m.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    release(ok(alert()))
    await m.c.flush()
    expect(votes).toEqual(['confirm'])
  })

  it('the vote that clears the alert: focus first, then "neighbors reported this hazard gone"', async () => {
    const m = marker(alert(), async (a) => ok({ ...a, status: 'cleared', clear_count: 3, shown_state: 'gone', shown_until: null }))
    ;(byTestId(m.c.tree(), `vote-clear-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    expect(m.seen.ended).toEqual([alertsT('en', 'voteCleared')])
    expect(voteStatus(m.c.tree())).toBe('') // the pin left: the map's notice says why, not the popup
  })

  it('a vote on an alert that ended: the member is told it is no longer active', async () => {
    const m = marker(alert(), async () => ({ ok: false, failure: { kind: 'not_live', resolved: false }, requestId: 'r' }))
    ;(byTestId(m.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    expect(m.seen.ended).toEqual([alertsT('en', 'notLiveNotice')])
  })

  it('any other refusal stays in the popup as a translated sentence (never the server’s words)', async () => {
    const m = marker(alert(), async () => ({ ok: false, failure: { kind: 'unknown', code: 'XX000' }, requestId: 'r' }))
    ;(byTestId(m.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    const error = findAll(m.c.tree(), (e) => e.props.role === 'alert')[0] as El
    expect(textOf(error)).toBe(alertsT('en', 'voteFailed'))
    expect(m.seen.ended).toEqual([])
  })

  it('closing the popup of a shown alert returns focus to its marker; of an ended one, sends focus to the map', () => {
    const live = marker(alert(), async (a) => ok(a))
    ;((findAll(live.c.tree(), (e) => e.type === MarkerPopupDialog)[0] as El).props.onClose as () => void)()
    expect([h.popup.closed, live.seen.ended]).toEqual([1, []])

    const ended = marker(alert({ status: 'ended' }), async (a) => ok(a))
    ;((findAll(ended.c.tree(), (e) => e.type === MarkerPopupDialog)[0] as El).props.onClose as () => void)()
    expect(h.popup.closed).toBe(1) // not the marker's own close: its button is about to leave
    expect(h.popup.setOpen).toEqual([false])
    expect(ended.seen.ended).toEqual([''])
  })

  it('the popup’s Close button is named in the viewer’s language, and the popup is told that language and direction', () => {
    const m = marker(alert(), async (a) => ok(a))
    ;(m.props as { locale: string }).locale = 'ar'
    m.c.rerender()
    const dialog = findAll(m.c.tree(), (e) => e.type === MarkerPopupDialog)[0] as El
    expect([dialog.props.closeLabel, dialog.props.lang, dialog.props.dir]).toEqual([alertsT('ar', 'close'), 'ar', 'rtl'])
    const button = byTestId(m.c.tree(), `safety-alert-marker-${ID}`)[0]
    expect([button.props.lang, button.props.dir]).toEqual(['ar', 'rtl'])
  })

  it('a guest gets the hint and no vote button; a member gets the buttons (the session decides, not a prop)', () => {
    h.guest = true
    const guest = marker(alert({ is_mine: true }), async (a) => ok(a))
    expect(byTestId(guest.c.tree(), `vote-confirm-${ID}`)).toHaveLength(0)
    expect(byTestId(guest.c.tree(), `alert-guest-hint-${ID}`)).toHaveLength(1)
    expect(byTestId(guest.c.tree(), `edit-alert-${ID}`)).toHaveLength(0)
    h.guest = false
    const member = marker(alert({ is_mine: true }), async (a) => ok(a))
    expect(byTestId(member.c.tree(), `vote-confirm-${ID}`)).toHaveLength(1)
    expect(byTestId(member.c.tree(), `edit-alert-${ID}`)).toHaveLength(1)
  })

  describe('the alert ends under its open popup (a poll, not the member’s own action)', () => {
    const gone = () => alert({ is_mine: true, shown_state: 'gone', shown_until: null })
    function withDialog(m: ReturnType<typeof marker>) {
      const focused: unknown[] = []
      const dialog = { focus: (o: unknown) => void focused.push(o) }
      ;(byTestId(m.c.tree(), `safety-alert-popup-${ID}`)[0].props.ref as { current: unknown }).current = {
        closest: (sel: string) => (sel === '[role="dialog"]' ? dialog : null),
      }
      return focused
    }

    it('its buttons are gone and focus fell to the page: focus moves to the popup itself — Escape and Close still work', () => {
      const m = marker(alert({ is_mine: true }), async (a) => ok(a))
      const focused = withDialog(m)
      ;(m.props as { alert: SafetyAlert }).alert = gone()
      page.activeElement = page.body // the focused vote button was removed
      m.c.rerender()
      expect(focused).toEqual([{ preventScroll: true }])
      expect(byTestId(m.c.tree(), `alert-ended-${ID}`)).toHaveLength(1)
      expect(byTestId(m.c.tree(), `vote-confirm-${ID}`)).toHaveLength(0)
      // Once, not on every render.
      m.c.rerender()
      expect(focused).toHaveLength(1)
    })

    it('focus that is somewhere real (on Close, or in the search box) stays where it is; a live alert moves nothing', () => {
      for (const where of ['the popup’s Close button', 'the map’s search box']) {
        const m = marker(alert({ is_mine: true }), async (a) => ok(a))
        const focused = withDialog(m)
        ;(m.props as { alert: SafetyAlert }).alert = gone()
        page.activeElement = { name: where }
        m.c.rerender()
        expect(focused, where).toEqual([])
      }
      const live = marker(alert({ is_mine: true }), async (a) => ok(a))
      const none = withDialog(live)
      ;(live.props as { alert: SafetyAlert }).alert = alert({ is_mine: true, version: 2 })
      page.activeElement = page.body
      live.c.rerender()
      expect(none).toEqual([])
    })
  })
})

describe('the history dialog', () => {
  const message = (version: number, over: Record<string, unknown> = {}) => ({
    version,
    msg_type: 'update',
    sent_at: iso(-version * HOUR),
    alert_type: 'road_closure',
    severity: 2,
    description: 'Bridge out',
    expires_at: iso(5 * HOUR),
    changed: ['description'],
    severity_change: 'same',
    actor_role: 'owner',
    ...over,
  })
  const trail: string[] = []
  const opener = { isConnected: true, focus: () => void trail.push('focus:opener') }
  /** Whether the surface still shows the alert (its strip entry, its popup or its marker). */
  const hostHasAlert = { current: true }

  async function history() {
    const state = { alertId: ID as string | null }
    const c = mount(() =>
      AlertHistoryDialog({
        alertId: state.alertId,
        locale: 'en',
        surface: 'strip',
        host: {
          focusAlert: (id: string) => (trail.push(`focus:alert:${id}`), hostHasAlert.current),
          focusAfterLeave: () => void trail.push('focus:next-place'),
        },
        onClose: () => {
          state.alertId = null
        },
        returnFocusRef: { current: opener as unknown as HTMLElement },
        tz: 'UTC',
      }),
    )
    await c.flush()
    return { c, state }
  }

  beforeEach(() => {
    trail.length = 0
    opener.isConnected = true
    hostHasAlert.current = true
    h.backend.answers.safety_alert_history = { data: [message(1, { msg_type: 'alert', changed: [] }), message(2)] }
  })

  it('one read per opening, newest first; re-renders read nothing', async () => {
    const d = await history()
    for (let i = 0; i < 10; i++) d.c.rerender()
    await d.c.flush()
    expect(h.backend.named('safety_alert_history').map((c) => c.args)).toEqual([{ p_alert_id: ID }])
    const list = findAll(d.c.tree(), (e) => e.type === AlertHistoryList)[0] as El
    expect((list.props.entries as Array<{ version: number }>).map((e) => e.version)).toEqual([2, 1])
  })

  it('says "Loading" and then "History loaded" with the number of entries, in one polite region', async () => {
    let release!: (v: unknown) => void
    h.backend.answers.safety_alert_history = () => new Promise((r) => (release = r as never))
    const d = await history()
    const region = () => byTestId(d.c.tree(), 'alert-history-status')
    expect(region()).toHaveLength(1)
    expect([region()[0].props.role, textOf(region()[0])]).toEqual(['status', alertsT('en', 'historyLoading')])
    release({ data: [message(1, { msg_type: 'alert', changed: [] }), message(2), message(3)] })
    await d.c.flush()
    expect(textOf(region()[0])).toBe('History loaded. Entries: 3.')
    expect(textOf(region()[0])).toBe(formatMessage(alertsT('en', 'historyLoaded'), { n: 3 }))
  })

  it('a failed read announces no "History loaded" (the error speaks for itself)', async () => {
    h.backend.answers.safety_alert_history = { error: { code: '57014', message: 'timeout' } }
    const d = await history()
    expect(textOf(byTestId(d.c.tree(), 'alert-history-status')[0])).toBe('')
  })

  it('each entry carries the role that acted, as the server sent it', async () => {
    h.backend.answers.safety_alert_history = { data: [message(1, { msg_type: 'alert', changed: [] }), message(2, { actor_role: 'moderator' }), message(3, { msg_type: 'all_clear', actor_role: 'owner' })] }
    const d = await history()
    const list = findAll(d.c.tree(), (e) => e.type === AlertHistoryList)[0] as El
    expect((list.props.entries as Array<{ version: number; actor_role: string }>).map((e) => [e.version, e.actor_role])).toEqual([[3, 'owner'], [2, 'moderator'], [1, 'owner']])
  })

  it('opening it again reads again (the history may have grown)', async () => {
    const d = await history()
    d.state.alertId = null
    d.c.rerender()
    h.backend.answers.safety_alert_history = { data: [message(3), message(2), message(1, { msg_type: 'alert' })] }
    d.state.alertId = ID
    d.c.rerender()
    await d.c.flush()
    expect(h.backend.named('safety_alert_history')).toHaveLength(2)
    const list = findAll(d.c.tree(), (e) => e.type === AlertHistoryList)[0] as El
    expect((list.props.entries as unknown[]).length).toBe(3)
  })

  it('an alert that has ended has no history to show, and the dialog says so', async () => {
    h.backend.answers.safety_alert_history = { data: [] }
    const d = await history()
    expect(textOf(byTestId(d.c.tree(), 'alert-history-empty')[0])).toBe(alertsT('en', 'historyEmpty'))
  })

  it('a failed read offers Retry, which reads once more', async () => {
    h.backend.answers.safety_alert_history = { error: { code: '57014', message: 'timeout' } }
    const d = await history()
    const failed = findAll(d.c.tree(), (e) => e.props.role === 'alert')[0] as El
    expect(textOf(failed)).toContain(alertsT('en', 'historyLoadFailed'))
    h.backend.answers.safety_alert_history = { data: [message(1, { msg_type: 'alert' })] }
    const retry = findAll(failed, (e) => typeof e.props.onClick === 'function')[0] as El
    ;(retry.props.onClick as () => void)()
    d.c.rerender()
    await d.c.flush()
    expect(h.backend.named('safety_alert_history')).toHaveLength(2)
    expect(findAll(d.c.tree(), (e) => e.type === AlertHistoryList)).toHaveLength(1)
  })

  it('a proper dialog: titled, focus on the title when it opens, back to the opener when it closes', async () => {
    const d = await history()
    const content = findAll(d.c.tree(), (e) => e.type === DialogContent)[0] as El
    const title = findAll(d.c.tree(), (e) => e.type === DialogTitle)[0] as El
    expect(textOf(title)).toBe(alertsT('en', 'historyTitle'))
    let focusedTitle = 0
    ;(title.props.ref as { current: unknown }).current = { focus: () => void focusedTitle++ }
    ;(content.props.onOpenAutoFocus as (e: unknown) => void)({ preventDefault() {} })
    expect(focusedTitle).toBe(1)
    ;(content.props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault() {} })
    expect(trail).toEqual(['focus:opener'])
    // The title shows where focus is.
    expect(String(title.props.className)).toContain('focus-visible:ring-2')
    expect(String(title.props.className)).not.toContain('outline-none')
  })

  it('the opener is gone when it closes: focus goes to the alert’s own place; if that is gone too, to the next place', async () => {
    const d = await history()
    const content = findAll(d.c.tree(), (e) => e.type === DialogContent)[0] as El
    opener.isConnected = false // the History button left (the alert changed while the history was open)
    ;(content.props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault() {} })
    expect(trail).toEqual([`focus:alert:${ID}`])
    trail.length = 0
    hostHasAlert.current = false // the alert left the surface altogether
    d.state.alertId = null // the dialog is closing: the id is already gone from its props
    d.c.rerender()
    ;((findAll(d.c.tree(), (e) => e.type === DialogContent)[0] as El).props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault() {} })
    expect(trail).toEqual([`focus:alert:${ID}`, 'focus:next-place'])
  })
})

describe('the panels hand the callbacks on', () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, '..', '..', rel), 'utf8').replace(/\s+/g, ' ')

  it('the feed panel: strip → store, dialogs, the dismissed notice and the map focus on that alert', () => {
    const panel = read('components/panels/feed-panel.tsx')
    expect(panel).toContain('<SafetyStrip alerts={safetyAlerts} locale={locale} live={stripLive} now={stripNow} onViewMap={openMapOnAlert} onAction={alertDialog.open} onEngage={setStripEngaged} onDismissNotice={dismissStripNotice} />')
    expect(panel).toContain('<AlertDialogs request={alertDialog.request} locale={locale} surface="strip" host={stripHost} onClose={alertDialog.close} returnFocusRef={alertDialog.triggerRef} />')
    // Starting the next action clears the last outcome's visible line.
    expect(panel).toContain('const alertDialog = useAlertDialog(dismissStripNotice)')
    expect(panel).toContain("if (alert) setPanelParams((prev) => ({ ...prev, focus: { kind: 'safety_alert', id: alert.id } }))")
  })

  it('the map panel: markers → store, dialogs, the notice above the map, and focus-then-notice when an alert ends', () => {
    const panel = read('components/panels/map-panel.tsx')
    expect(panel).toContain('<SafetyAlertMarker key={alert.id} alert={alert} locale={locale} now={alertsNow} onVote={voteAlert} onAction={alertDialog.open} onEngage={setAlertEngaged} onEnded={handleAlertEnded}')
    expect(panel).toContain('<AlertDialogs request={alertDialog.request} locale={locale} surface="map" host={alertHost} onClose={alertDialog.close} returnFocusRef={alertDialog.triggerRef} />')
    // The notice is a sibling BEFORE the map's panel (in the flow: it cannot cover a marker).
    expect(panel).toContain('<MapAlertNotice notice={alertNotice} locale={locale} onDismiss={clearAlertNotice} /> <div id="map-view-panel"')
    expect(panel).toContain('const alertDialog = useAlertDialog(clearAlertNotice)')
    expect(panel).toContain('alertHost.focusAfterLeave() if (notice) requestAnimationFrame(() => alertHost.announce(notice))')
    expect(panel).toContain('<HazardBubbleMenu viewCenter={currentMapCenter} locale={locale} onPlaceAlert={placeAlert}')
  })

  it('the map’s notice: its Dismiss control tells the surface; an empty notice has no control', () => {
    let dismissed = 0
    const state = { notice: { text: 'Alert updated.', seq: 1 } }
    const c = mount(() => MapAlertNotice({ notice: state.notice, locale: 'en', onDismiss: () => void dismissed++ }))
    const button = byTestId(c.tree(), 'map-alert-notice-dismiss')[0]
    expect(button.props['aria-label']).toBe(alertsT('en', 'dismiss'))
    ;(button.props.onClick as () => void)()
    expect(dismissed).toBe(1)
    state.notice = { text: '', seq: 1 }
    c.rerender()
    expect(byTestId(c.tree(), 'map-alert-notice-dismiss')).toHaveLength(0)
    expect(byTestId(c.tree(), 'map-alert-status')).toHaveLength(1) // the region stays mounted
  })

  it('starting an action from a surface clears its last notice, then opens the dialog on that alert', () => {
    const calls: string[] = []
    const c = mount(() => useAlertDialog(() => void calls.push('notice-cleared')))
    const trigger = { name: 'the button' } as unknown as HTMLElement
    c.tree().open('resolve', alert(), trigger)
    const d = c.rerender()
    expect(calls).toEqual(['notice-cleared'])
    expect(d.request).toEqual({ action: 'resolve', alertId: ID })
    expect(d.triggerRef.current).toBe(trigger)
    d.close()
    expect(c.rerender().request).toBeNull()
  })
})
