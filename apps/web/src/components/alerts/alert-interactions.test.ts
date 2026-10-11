// apps/web/src/components/alerts/alert-interactions.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What the alert surfaces do when a member acts, on the mini hook runtime (children are not rendered;
// the test calls the handlers the components hand to their elements):
//   - the strip: an entry opens the map on that alert; an action hands over the button it came from
//     (focus returns there); focus entering / leaving an entry is reported, so an alert never leaves
//     under the member's focus (invariant 7);
//   - the marker: an open popup is reported the same way; a vote that clears the alert, or one the
//     server answers "no longer live", moves focus first and then says why; any other refusal stays in
//     the popup as a sentence; closing the popup of an ended alert sends focus to the map;
//   - the history dialog: one read per opening, newest first, focus on its title and back;
//   - the panels hand those callbacks to the store, the dialogs and the status regions.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  backend: null as unknown as import('@/test/alert-fixtures').RpcBackend,
  popup: { open: true, closed: 0, setOpen: [] as boolean[] },
}))
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
import type { AlertOutcome, SafetyAlert } from '@/lib/safety-alert-rpc'
import { SafetyStrip } from '@/components/feed/safety-strip'
import { SafetyAlertMarker } from '@/components/map/safety-alert-marker'
import { MarkerPopupDialog } from '@/components/map/marker-popup'
import { AlertHistoryDialog, AlertHistoryList } from './alert-history-dialog'

type El = { type: unknown; props: Record<string, unknown> }
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
const textOf = (el: El | undefined): string => {
  const walk = (n: unknown): string => (Array.isArray(n) ? n.map(walk).join('') : typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' && 'props' in n ? walk((n as El).props.children) : '')
  return el ? walk(el.props.children) : ''
}
const ID = alert().id

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => (cb(0), 0))
  h.backend.reset()
  h.popup = { open: true, closed: 0, setOpen: [] }
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the strip', () => {
  function strip(alerts: SafetyAlert[]) {
    const seen = { map: [] as Array<string | undefined>, actions: [] as Array<[string, string, unknown]>, engaged: [] as Array<[string, boolean]> }
    const c = mount(() =>
      SafetyStrip({
        alerts,
        locale: 'en',
        now: NOW,
        tz: 'UTC',
        onViewMap: (a) => void seen.map.push(a?.id),
        onAction: (action, a, trigger) => void seen.actions.push([action, a.id, trigger]),
        onEngage: (id, on) => void seen.engaged.push([id, on]),
      }),
    )
    return { c, seen }
  }

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
    const item = findAll(c.tree(), (e) => e.type === 'li')[0] as El
    const inside = { name: 'a button of this entry' }
    const entry = { contains: (node: unknown) => node === inside }
    ;(item.props.onFocus as () => void)()
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: inside })
    expect(seen.engaged).toEqual([[ID, true]])
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: { name: 'elsewhere' } })
    ;(item.props.onBlur as (e: unknown) => void)({ currentTarget: entry, relatedTarget: null })
    expect(seen.engaged).toEqual([[ID, true], [ID, false], [ID, false]])
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

  it('a vote that leaves the alert live: nothing ends, the popup stays', async () => {
    const votes: string[] = []
    const m = marker(alert(), async (a, v) => (votes.push(v), ok({ ...a, confirm_count: 2 })))
    ;(byTestId(m.c.tree(), `vote-confirm-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    expect(votes).toEqual(['confirm'])
    expect(m.seen.ended).toEqual([])
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
    const m = marker(alert(), async (a) => ok({ ...a, status: 'cleared', clear_count: 3 }))
    ;(byTestId(m.c.tree(), `vote-clear-${ID}`)[0].props.onClick as () => void)()
    await m.c.flush()
    expect(m.seen.ended).toEqual([alertsT('en', 'voteCleared')])
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

  it('the popup’s Close button is named in the viewer’s language', () => {
    const m = marker(alert(), async (a) => ok(a))
    expect((findAll(m.c.tree(), (e) => e.type === MarkerPopupDialog)[0] as El).props.closeLabel).toBe(alertsT('en', 'close'))
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

  async function history() {
    const state = { alertId: ID as string | null }
    const c = mount(() =>
      AlertHistoryDialog({
        alertId: state.alertId,
        locale: 'en',
        surface: 'strip',
        host: { focusAfterLeave: () => void trail.push('focus:next-place') },
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
    opener.isConnected = false // the alert left while the history was open
    ;(content.props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault() {} })
    expect(trail).toEqual(['focus:opener', 'focus:next-place'])
  })
})

describe('the panels hand the callbacks on', () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, '..', '..', rel), 'utf8').replace(/\s+/g, ' ')

  it('the feed panel: strip → store, dialogs and the map focus on that alert', () => {
    const panel = read('components/panels/feed-panel.tsx')
    expect(panel).toContain('<SafetyStrip alerts={safetyAlerts} locale={locale} isGuest={isAnonymous} live={stripLive} now={stripNow} onViewMap={openMapOnAlert} onAction={alertDialog.open} onEngage={setStripEngaged} />')
    expect(panel).toContain('<AlertDialogs request={alertDialog.request} locale={locale} surface="strip" host={stripHost} onClose={alertDialog.close} returnFocusRef={alertDialog.triggerRef} />')
    expect(panel).toContain("if (alert) setPanelParams((prev) => ({ ...prev, focus: { kind: 'safety_alert', id: alert.id } }))")
  })

  it('the map panel: markers → store, dialogs, the polite notice region, and focus-then-notice when an alert ends', () => {
    const panel = read('components/panels/map-panel.tsx')
    expect(panel).toContain('<SafetyAlertMarker key={alert.id} alert={alert} locale={locale} isGuest={isAnonymous} now={alertsNow} onVote={voteAlert} onAction={alertDialog.open} onEngage={setAlertEngaged} onEnded={handleAlertEnded}')
    expect(panel).toContain('<AlertDialogs request={alertDialog.request} locale={locale} surface="map" host={alertHost} onClose={alertDialog.close} returnFocusRef={alertDialog.triggerRef} />')
    expect(panel).toMatch(/<p role="status" lang=\{locale\} dir=\{dir\(locale\)\} data-testid="map-alert-notice"/)
    expect(panel).toContain('alertHost.focusAfterLeave() if (notice) requestAnimationFrame(() => alertHost.announce(notice))')
    expect(panel).toContain('<HazardBubbleMenu viewCenter={currentMapCenter} locale={locale} onPlaceAlert={placeAlert}')
  })
})
