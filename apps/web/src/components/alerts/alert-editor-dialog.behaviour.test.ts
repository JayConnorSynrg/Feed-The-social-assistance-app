// apps/web/src/components/alerts/alert-editor-dialog.behaviour.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The alert dialog (update / mark resolved / withdraw) on the mini hook runtime, the server faked at
// the RPC boundary — Release 3.1 invariant 3 (updates never overwrite silently) and the dialog half
// of invariant 7:
//   - the form opens from a fresh read every time, and a parent re-render never reads again;
//   - a save sends the version that read returned and only what changed; a double Save sends once;
//   - a stale version opens the compare step: nothing more is sent until the member chooses; "keep
//     mine" sends once with the version just read; "use current" sends nothing;
//   - "no longer live" closes the dialog, says so, and the surface re-reads;
//   - the reporter is told, before saving, that editing a verified alert returns it to unverified;
//   - after a severity change the notice names the new expiry;
//   - on close: focus first (the opener; the alert's own place when the opener is gone; the next
//     place when the alert left), then the notice;
//   - fix round: a write that never answers gives up after 12 s — the gate is released and the dialog
//     says so; Cancel is there while the alert is being read; the confirmations describe themselves;
//     an answer that arrives after the dialog closed announces nothing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({ backend: null as unknown as import('@/test/alert-fixtures').RpcBackend }))
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

import { mount, findAll } from '@/test/mini-react'
import { ALERT_ID, HOUR, NOW, alert, iso } from '@/test/alert-fixtures'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'
import { alertsT } from '@/lib/i18n-feed-alerts'
import type { SafetyAlert } from '@/lib/safety-alert-rpc'
import { AlertEditorDialog, type AlertActionKind, type AlertActionRequest } from './alert-editor-dialog'
import { AlertSummary } from './alert-parts'

type El = { type: unknown; props: Record<string, unknown> }
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
const one = (tree: unknown, id: string) => {
  const found = byTestId(tree, id)
  expect(found, id).toHaveLength(1)
  return found[0]
}
const textOf = (el: El | undefined): string => {
  const walk = (n: unknown): string => (Array.isArray(n) ? n.map(walk).join('') : typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' && 'props' in n ? walk((n as El).props.children) : '')
  return el ? walk(el.props.children) : ''
}

/** What the dialog asked of its surface, in order. */
let trail: string[] = []
const host = {
  applyAnswer: (a: SafetyAlert) => void trail.push(`apply:v${a.version}:${a.status}`),
  leave: (id: string) => void trail.push(`leave:${id === ALERT_ID ? 'alert' : id}`),
  refresh: () => void trail.push('refresh'),
  announce: (notice: string) => void trail.push(`announce:${notice}`),
  focusAlert: (id: string) => (trail.push(`focus:alert:${id === ALERT_ID ? 'alert' : id}`), surfaceHasAlert.current),
  focusAfterLeave: () => void trail.push('focus:next-place'),
}
/** Whether the surface still shows the alert (its strip entry, its open popup or its marker). */
const surfaceHasAlert = { current: true }
const opener = { isConnected: true, focus: () => void trail.push('focus:opener') }

const reads = () => h.backend.named('safety_alerts_in_view')
const updates = () => h.backend.named('update_safety_alert')
const serve = (row: SafetyAlert | null) => (h.backend.answers.safety_alerts_in_view = { data: row ? [row] : [] })
const conflict = (version: number) => ({ error: { code: 'PT409', message: 'edit_conflict', details: JSON.stringify({ current_version: version, updated_at: iso(0) }) } })
const notLive = (status: string) => ({ error: { code: 'PT410', message: 'alert is no longer live', details: JSON.stringify({ code: 'alert_not_live', status }) } })

async function open(kind: AlertActionKind = 'edit') {
  const state: { request: AlertActionRequest | null; closed: number } = { request: { kind, alertId: ALERT_ID }, closed: 0 }
  const c = mount(() =>
    AlertEditorDialog({
      request: state.request,
      locale: 'en',
      surface: 'strip',
      host: { ...host }, // a new object every render, as a parent might hand over
      onClose: () => {
        state.closed++
        state.request = null
      },
      returnFocusRef: { current: opener as unknown as HTMLElement },
      tz: 'UTC',
    }),
  )
  await c.flush()
  const set = (testId: string, value: string) => {
    ;(one(c.tree(), testId).props.onChange as (e: unknown) => void)({ target: { value } })
    c.rerender()
  }
  const submit = () => (one(c.tree(), 'alert-edit-form').props.onSubmit as (e: unknown) => void)({ preventDefault() {} })
  const click = (testId: string) => (one(c.tree(), testId).props.onClick as () => void)()
  /** Radix has closed the dialog and asks where focus goes. */
  const closed = () => {
    c.rerender()
    ;((findAll(c.tree(), (e) => e.type === DialogContent)[0] as El).props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault() {} })
  }
  return { c, state, set, submit, click, closed }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => (cb(0), 0))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  h.backend.reset()
  trail = []
  opener.isConnected = true
  surfaceHasAlert.current = true
  serve(alert({ is_mine: true, version: 3 }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the form starts from a fresh read', () => {
  it('each opening reads the alert by id and shows what the server holds now', async () => {
    const d = await open()
    expect(reads()).toHaveLength(1)
    expect(reads()[0].args).toEqual({ p_alert_id: ALERT_ID, p_include_resolved: true })
    expect(one(d.c.tree(), 'alert-edit-description').props.value).toBe('Bridge out')

    // Closed; someone else changes the alert; opened again: the form shows the new text.
    d.state.request = null
    d.c.rerender()
    serve(alert({ is_mine: true, version: 4, description: 'Bridge out, detour on Elm', severity: 4 }))
    d.state.request = { kind: 'edit', alertId: ALERT_ID }
    d.c.rerender()
    await d.c.flush()
    expect(reads()).toHaveLength(2)
    expect(one(d.c.tree(), 'alert-edit-description').props.value).toBe('Bridge out, detour on Elm')
    expect(one(d.c.tree(), 'alert-edit-severity').props.value).toBe('4')
  })

  it('a parent re-render (new callbacks, new host object) reads nothing and keeps what was typed', async () => {
    const d = await open()
    d.set('alert-edit-description', 'Typed by the member')
    for (let i = 0; i < 20; i++) d.c.rerender()
    await d.c.flush()
    expect(reads()).toHaveLength(1)
    expect(one(d.c.tree(), 'alert-edit-description').props.value).toBe('Typed by the member')
  })

  it('an alert that is gone when the dialog opens: it closes, says so, and leaves the surface', async () => {
    serve(null)
    const d = await open()
    expect(d.state.closed).toBe(1)
    d.closed()
    expect(trail).toEqual(['leave:alert', 'refresh', 'focus:next-place', `announce:${alertsT('en', 'notLiveNotice')}`])
  })

  it('an alert already resolved cannot be updated: it closes and shows resolved', async () => {
    serve(alert({ status: 'resolved', resolved_at: iso(-HOUR), version: 4 }))
    const d = await open()
    expect(d.state.closed).toBe(1)
    d.closed()
    expect(trail).toEqual(['apply:v4:resolved', 'refresh', 'focus:opener', `announce:${alertsT('en', 'nowResolvedNotice')}`])
    expect(updates()).toHaveLength(0)
  })
})

describe('saving', () => {
  it('sends the version the form opened with and only what changed; then applies, re-reads, closes', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = { data: alert({ is_mine: true, version: 4, description: 'Detour on Elm', updated_at: iso(0) }) }
    d.set('alert-edit-description', 'Detour on Elm')
    d.submit()
    await d.c.flush()
    expect(updates()).toHaveLength(1)
    expect(updates()[0].args).toEqual({ p_alert_id: ALERT_ID, p_expected_version: 3, p_description: 'Detour on Elm' })
    expect(d.state.closed).toBe(1)
    d.closed()
    // Focus first, then the notice.
    expect(trail).toEqual(['apply:v4:live', 'refresh', 'focus:opener', `announce:${alertsT('en', 'savedNotice')}`])
  })

  it('a double Save sends one update', async () => {
    const d = await open()
    let release!: (v: unknown) => void
    h.backend.answers.update_safety_alert = () => new Promise((r) => (release = r)) as never
    d.set('alert-edit-description', 'Detour on Elm')
    d.submit()
    d.submit()
    await d.c.flush()
    d.submit()
    release({ data: alert({ version: 4 }) })
    await d.c.flush()
    expect(updates()).toHaveLength(1)
  })

  it('a cleared description is sent as the clear value; the fields left alone are not sent', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = { data: alert({ version: 4, description: null }) }
    d.set('alert-edit-description', '   ')
    d.submit()
    await d.c.flush()
    expect(updates()[0].args).toEqual({ p_alert_id: ALERT_ID, p_expected_version: 3, p_description: '' })
  })

  it('nothing changed: Save is marked disabled and sends nothing', async () => {
    const d = await open()
    expect(one(d.c.tree(), 'alert-editor-save').props['aria-disabled']).toBe(true)
    d.submit()
    await d.c.flush()
    expect(updates()).toHaveLength(0)
    expect(d.state.closed).toBe(0)
  })

  it('a raised severity: the notice names the new expiry the server answered', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = { data: alert({ version: 4, severity: 4, expires_at: iso(72 * HOUR) }) }
    d.set('alert-edit-severity', '4')
    // Before saving, the form says what a severity change does to the clock.
    expect(findAll(d.c.tree(), (e) => e.props.id === `alert-edit-${ALERT_ID}-expiry`).map((e) => textOf(e as El))).toEqual([alertsT('en', 'expiryHint')])
    d.submit()
    await d.c.flush()
    expect(updates()[0].args).toEqual({ p_alert_id: ALERT_ID, p_expected_version: 3, p_severity: 4 })
    d.closed()
    expect(trail.at(-1)).toBe('announce:Alert updated. It now expires Oct 14, 2026, 12:00 PM.')
  })

  it('the reporter’s own verified alert: told before saving; the notice afterwards says it is unverified again', async () => {
    serve(alert({ is_mine: true, verified: true, version: 3 }))
    const d = await open()
    expect(textOf(one(d.c.tree(), 'alert-verified-notice'))).toBe(alertsT('en', 'verifiedNotice'))
    h.backend.answers.update_safety_alert = { data: alert({ version: 4, verified: false, description: 'Detour' }) }
    d.set('alert-edit-description', 'Detour')
    d.submit()
    await d.c.flush()
    d.closed()
    expect(trail.at(-1)).toBe(`announce:${alertsT('en', 'savedNotice')} ${alertsT('en', 'unverifiedNotice')}`)
  })

  it('no such warning on an unverified alert, or on someone else’s verified one', async () => {
    const d = await open()
    expect(byTestId(d.c.tree(), 'alert-verified-notice')).toHaveLength(0)
    serve(alert({ is_mine: false, verified: true }))
    const other = await open()
    expect(byTestId(other.c.tree(), 'alert-verified-notice')).toHaveLength(0)
  })

  it('a refusal that is not about the version stays in the dialog as a translated sentence', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = { error: { code: '42501', message: 'not_alert_owner' } }
    d.set('alert-edit-description', 'Detour')
    d.submit()
    await d.c.flush()
    const error = one(d.c.tree(), 'alert-editor-error')
    expect(error.props.role).toBe('alert')
    expect(textOf(error)).toBe(alertsT('en', 'failNotOwner'))
    expect(d.state.closed).toBe(0)
  })
})

describe('a stale version opens the compare step — nothing is retried on its own', () => {
  async function conflicted() {
    const d = await open()
    h.backend.answers.update_safety_alert = conflict(4)
    d.set('alert-edit-description', 'My text')
    serve(alert({ is_mine: true, version: 4, description: 'Their text', severity: 3 }))
    d.submit()
    await d.c.flush()
    return d
  }

  it('one update was sent, the alert was read again, and both versions are shown side by side', async () => {
    const d = await conflicted()
    expect(updates()).toHaveLength(1)
    expect(reads()).toHaveLength(2)
    expect(d.state.closed).toBe(0)
    one(d.c.tree(), 'alert-conflict')
    const summaries = findAll(d.c.tree(), (e) => e.type === AlertSummary) as El[]
    expect(summaries.map((s) => [s.props.heading, (s.props.alert as { description: string; severity: number }).description, (s.props.alert as { severity: number }).severity])).toEqual([
      // "Your changes" is what keeping them would save: the member's text on the other save's severity.
      [alertsT('en', 'yourVersion'), 'My text', 3],
      [alertsT('en', 'currentVersion'), 'Their text', 3],
    ])
    // Waiting changes nothing: no second update without the member.
    await d.c.flush()
    await d.c.flush()
    expect(updates()).toHaveLength(1)
  })

  it('"Keep my changes" + Continue sends once, with the version just read', async () => {
    const d = await conflicted()
    h.backend.answers.update_safety_alert = { data: alert({ version: 5, description: 'My text' }) }
    expect(one(d.c.tree(), 'alert-conflict-keep_mine').props.checked).toBe(true)
    d.click('alert-conflict-continue')
    await d.c.flush()
    expect(updates()).toHaveLength(2)
    // The severity the other save set is kept: only the member's own change is sent.
    expect(updates()[1].args).toEqual({ p_alert_id: ALERT_ID, p_expected_version: 4, p_description: 'My text' })
    d.closed()
    expect(trail).toEqual(['apply:v5:live', 'refresh', 'focus:opener', `announce:${alertsT('en', 'savedNotice')}`])
  })

  it('"Use the current version" + Continue sends nothing and shows the current version', async () => {
    const d = await conflicted()
    ;(one(d.c.tree(), 'alert-conflict-use_current').props.onChange as () => void)()
    d.c.rerender()
    d.click('alert-conflict-continue')
    await d.c.flush()
    expect(updates()).toHaveLength(1)
    d.closed()
    expect(trail).toEqual(['apply:v4:live', 'refresh', 'focus:opener', `announce:${alertsT('en', 'notSavedNotice')}`])
  })

  it('a second conflict (it changed again) comes back to the compare step: still one send per choice', async () => {
    const d = await conflicted()
    h.backend.answers.update_safety_alert = conflict(5)
    serve(alert({ is_mine: true, version: 5, description: 'Their newer text' }))
    d.click('alert-conflict-continue')
    await d.c.flush()
    expect(updates()).toHaveLength(2)
    one(d.c.tree(), 'alert-conflict')
    await d.c.flush()
    expect(updates()).toHaveLength(2)
  })

  it('the alert ended while the member was choosing: the conflict read finds it gone', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = conflict(4)
    d.set('alert-edit-description', 'My text')
    serve(null)
    d.submit()
    await d.c.flush()
    expect(d.state.closed).toBe(1)
    expect(trail).toEqual(['leave:alert', 'refresh'])
  })
})

describe('"no longer live" closes the editor with a message and a re-read', () => {
  it('gone (expired, cleared, removed, withdrawn): the alert leaves, the surface re-reads, the member is told', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = notLive('expired')
    d.set('alert-edit-description', 'Detour')
    d.submit()
    await d.c.flush()
    expect(d.state.closed).toBe(1)
    d.closed()
    expect(trail).toEqual(['leave:alert', 'refresh', 'focus:next-place', `announce:${alertsT('en', 'notLiveNotice')}`])
    expect(updates()).toHaveLength(1)
  })

  it('resolved meanwhile: it stays (the re-read shows it resolved) and the member is told', async () => {
    const d = await open()
    h.backend.answers.update_safety_alert = notLive('resolved')
    d.set('alert-edit-description', 'Detour')
    d.submit()
    await d.c.flush()
    d.closed()
    expect(trail).toEqual(['refresh', 'focus:opener', `announce:${alertsT('en', 'nowResolvedNotice')}`])
  })
})

describe('mark resolved and withdraw', () => {
  it('resolve sends the version; the notice says until when it stays visible', async () => {
    const d = await open('resolve')
    h.backend.answers.resolve_safety_alert = { data: alert({ status: 'resolved', resolved_at: iso(0), version: 4 }) }
    d.click('alert-editor-confirm')
    d.click('alert-editor-confirm') // a double click sends once
    await d.c.flush()
    expect(h.backend.named('resolve_safety_alert').map((c) => c.args)).toEqual([{ p_alert_id: ALERT_ID, p_expected_version: 3 }])
    d.closed()
    expect(trail).toEqual(['apply:v4:resolved', 'refresh', 'focus:opener', 'announce:Alert marked resolved. It stays visible as resolved until Oct 11, 2026, 6:00 PM.'])
  })

  it('a stale version on resolve: the current alert is shown; "leave it" sends nothing, "resolve anyway" sends once', async () => {
    const d = await open('resolve')
    h.backend.answers.resolve_safety_alert = conflict(4)
    serve(alert({ is_mine: true, version: 4, severity: 1, description: 'Mostly clear now' }))
    d.click('alert-editor-confirm')
    await d.c.flush()
    expect(h.backend.named('resolve_safety_alert')).toHaveLength(1)
    const summaries = findAll(d.c.tree(), (e) => e.type === AlertSummary) as El[]
    expect(summaries.map((s) => (s.props.alert as { description: string }).description)).toEqual(['Mostly clear now'])
    h.backend.answers.resolve_safety_alert = { data: alert({ status: 'resolved', resolved_at: iso(0), version: 5 }) }
    d.click('alert-conflict-continue')
    await d.c.flush()
    expect(h.backend.named('resolve_safety_alert').map((c) => c.args.p_expected_version)).toEqual([3, 4])
  })

  it('withdraw: the entry leaves at once; focus goes to the next place, then the notice', async () => {
    const d = await open('withdraw')
    h.backend.answers.delete_safety_alert = { data: null }
    d.click('alert-editor-confirm')
    await d.c.flush()
    expect(h.backend.named('delete_safety_alert').map((c) => c.args)).toEqual([{ p_alert_id: ALERT_ID }])
    expect(trail).toEqual(['leave:alert', 'refresh'])
    d.closed()
    expect(trail).toEqual(['leave:alert', 'refresh', 'focus:next-place', `announce:${alertsT('en', 'withdrawnNotice')}`])
  })

  it('a resolved alert can still be withdrawn', async () => {
    serve(alert({ is_mine: true, status: 'resolved', resolved_at: iso(-HOUR), version: 4 }))
    const d = await open('withdraw')
    expect(d.state.closed).toBe(0)
    one(d.c.tree(), 'alert-withdraw-confirm')
  })
})

describe('a proper dialog', () => {
  it('opens with focus on its title; Cancel returns focus to the opener and announces nothing', async () => {
    const d = await open()
    const content = findAll(d.c.tree(), (e) => e.type === DialogContent)[0] as El
    const title = findAll(d.c.tree(), (e) => e.type === DialogTitle)[0] as El
    expect(textOf(title)).toBe(alertsT('en', 'editTitle'))
    expect(title.props.tabIndex).toBe(-1)
    let focusedTitle = 0
    ;(title.props.ref as { current: unknown }).current = { focus: () => void focusedTitle++ }
    let prevented = 0
    ;(content.props.onOpenAutoFocus as (e: unknown) => void)({ preventDefault: () => void prevented++ })
    expect([prevented, focusedTitle]).toEqual([1, 1])
    expect(content.props.lang).toBe('en')
    expect(content.props.dir).toBe('ltr')
    d.state.request = null
    d.closed()
    expect(trail).toEqual(['focus:opener'])
  })

  it('the opener is gone when the dialog closes and so is the alert: focus goes to the next place', async () => {
    const d = await open()
    opener.isConnected = false
    surfaceHasAlert.current = false
    d.state.request = null
    d.closed()
    expect(trail).toEqual(['focus:alert:alert', 'focus:next-place'])
  })

  it('after "Mark resolved" the button that opened the dialog is gone: focus goes to the alert’s own entry or popup, then the notice', async () => {
    const d = await open('resolve')
    h.backend.answers.resolve_safety_alert = { data: alert({ status: 'resolved', resolved_at: iso(0), version: 4, resolved_by_role: 'owner' }) }
    d.click('alert-editor-confirm')
    await d.c.flush()
    opener.isConnected = false // a resolved alert has no "Mark resolved" button any more
    d.closed()
    expect(trail).toEqual(['apply:v4:resolved', 'refresh', 'focus:alert:alert', 'announce:Alert marked resolved. It stays visible as resolved until Oct 11, 2026, 6:00 PM.'])
  })

  it('a withdrawn alert never asks for its own place (it left): the next place, even if the opener were still there', async () => {
    const d = await open('withdraw')
    h.backend.answers.delete_safety_alert = { data: null }
    d.click('alert-editor-confirm')
    await d.c.flush()
    d.closed()
    expect(trail.filter((x) => x.startsWith('focus:'))).toEqual(['focus:next-place'])
  })

  it('Cancel is there while the alert is still being read, and closes the dialog', async () => {
    h.backend.answers.safety_alerts_in_view = () => new Promise(() => {}) // the read never answers
    const d = await open()
    const cancel = one(d.c.tree(), 'alert-editor-cancel-loading')
    expect(textOf(cancel)).toBe(alertsT('en', 'cancel'))
    expect(byTestId(d.c.tree(), 'alert-edit-form')).toHaveLength(0)
    ;(cancel.props.onClick as () => void)()
    expect(d.state.closed).toBe(1)
    d.closed()
    expect(trail).toEqual(['focus:opener'])
  })

  it('the confirmations name their text as the dialog’s description; the form (which has labels) does not', async () => {
    for (const kind of ['resolve', 'withdraw'] as const) {
      const d = await open(kind)
      const content = findAll(d.c.tree(), (e) => e.type === DialogContent)[0] as El
      const id = content.props['aria-describedby'] as string
      expect(id, kind).toBe(`alert-${kind}-${ALERT_ID}-body`)
      const body = findAll(d.c.tree(), (e) => e.props.id === id) as El[]
      expect(body.map(textOf), kind).toEqual([alertsT('en', kind === 'resolve' ? 'resolveBody' : 'withdrawBody')])
    }
    const form = await open('edit')
    expect((findAll(form.c.tree(), (e) => e.type === DialogContent)[0] as El).props['aria-describedby']).toBeUndefined()
  })

  it('the form’s fields have an edge that can be seen (stone-500) and a readable placeholder', async () => {
    const d = await open()
    for (const id of ['alert-edit-type', 'alert-edit-severity']) {
      const cls = String(one(d.c.tree(), id).props.className).split(' ')
      expect(cls, id).toEqual(expect.arrayContaining(['border', 'border-stone-500', 'focus-visible:ring-2']))
      expect(cls, id).not.toContain('border-stone-300')
    }
    expect(String(one(d.c.tree(), 'alert-edit-description').props.className)).toContain('placeholder:text-stone-500')
  })

  it('the title and the comparison heading show their focus ring', async () => {
    const d = await open()
    const title = findAll(d.c.tree(), (e) => e.type === DialogTitle)[0] as El
    expect(String(title.props.className)).toContain('focus-visible:ring-2')
    h.backend.answers.update_safety_alert = conflict(4)
    d.set('alert-edit-description', 'My text')
    d.submit()
    await d.c.flush()
    const heading = findAll(one(d.c.tree(), 'alert-conflict'), (e) => e.type === 'h3')[0] as El
    expect(heading.props.tabIndex).toBe(-1)
    expect(String(heading.props.className)).toContain('focus-visible:ring-2')
  })
})

// A write that never answers: lib/safety-alert-rpc.ts bounds every alert write with
// AbortSignal.timeout(QUERY_TIMEOUT_MS). Here the timeout is a controller the test fires.
describe('a write that never answers', () => {
  let timeouts: Array<{ ms: number; controller: AbortController }> = []
  beforeEach(() => {
    timeouts = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
      const controller = new AbortController()
      timeouts.push({ ms, controller })
      return controller.signal
    })
  })
  afterEach(() => vi.restoreAllMocks())
  const stall = (name: string) => (h.backend.answers[name] = () => new Promise(() => {}))
  /** The clock reaches the timeout of the write sent last. */
  const timeOut = () => timeouts.at(-1)!.controller.abort()

  it('update: after 12 s the dialog says the connection failed, Save works again, and the second Save is sent', async () => {
    const d = await open()
    stall('update_safety_alert')
    d.set('alert-edit-description', 'Detour on Elm')
    d.submit()
    await d.c.flush()
    expect(updates()).toHaveLength(1)
    expect(updates()[0].signal).toBeInstanceOf(AbortSignal)
    expect(timeouts.at(-1)!.ms).toBe(12_000)
    expect(one(d.c.tree(), 'alert-editor-save').props['aria-disabled']).toBe(true) // saving…
    d.submit() // still in flight: nothing more is sent
    await d.c.flush()
    expect(updates()).toHaveLength(1)

    timeOut()
    await d.c.flush()
    const error = one(d.c.tree(), 'alert-editor-error')
    expect([error.props.role, textOf(error)]).toEqual(['alert', alertsT('en', 'failNetwork')])
    expect(one(d.c.tree(), 'alert-editor-save').props['aria-disabled']).toBeUndefined()
    expect(one(d.c.tree(), 'alert-edit-description').props.value).toBe('Detour on Elm') // what was typed is kept
    expect(d.state.closed).toBe(0)

    h.backend.answers.update_safety_alert = { data: alert({ is_mine: true, version: 4, description: 'Detour on Elm' }) }
    d.submit()
    await d.c.flush()
    expect(updates()).toHaveLength(2)
    expect(d.state.closed).toBe(1)
  })

  it.each([
    ['resolve', 'resolve_safety_alert'],
    ['withdraw', 'delete_safety_alert'],
  ] as const)('%s: the same — a message, and the button works again', async (kind, rpc) => {
    const d = await open(kind)
    stall(rpc)
    d.click('alert-editor-confirm')
    await d.c.flush()
    expect(h.backend.named(rpc)).toHaveLength(1)
    timeOut()
    await d.c.flush()
    expect(textOf(one(d.c.tree(), 'alert-editor-error'))).toBe(alertsT('en', 'failNetwork'))
    expect(trail).toEqual([]) // nothing was changed on the surface
    d.click('alert-editor-confirm')
    await d.c.flush()
    expect(h.backend.named(rpc)).toHaveLength(2)
  })

  it('Cancel and reopen while the first write is still waiting: the new Save is sent, not swallowed', async () => {
    const d = await open()
    stall('update_safety_alert')
    d.set('alert-edit-description', 'first edit')
    d.submit()
    await d.c.flush()
    d.state.request = null // Cancel
    d.c.rerender()
    d.state.request = { kind: 'edit', alertId: ALERT_ID } // reopen: a fresh read, a fresh gate
    d.c.rerender()
    await d.c.flush()
    expect(one(d.c.tree(), 'alert-editor-save').props['aria-disabled']).toBe(true) // nothing typed yet
    h.backend.answers.update_safety_alert = { data: alert({ is_mine: true, version: 4, description: 'second edit' }) }
    d.set('alert-edit-description', 'second edit')
    d.submit()
    await d.c.flush()
    expect(updates().map((u) => u.args.p_description)).toEqual(['first edit', 'second edit'])
    expect(d.state.closed).toBe(1)
  })

  it('an answer that arrives after the dialog was closed: the surface gets it, nothing is announced, no dialog state moves', async () => {
    const d = await open()
    let release!: (v: unknown) => void
    h.backend.answers.update_safety_alert = () => new Promise((r) => (release = r)) as never
    d.set('alert-edit-description', 'Detour')
    d.submit()
    await d.c.flush()
    d.state.request = null // the member cancelled while it was saving
    d.c.rerender()
    d.closed()
    trail = []
    release({ data: alert({ is_mine: true, version: 4, description: 'Detour' }) })
    await d.c.flush()
    expect(trail).toEqual(['apply:v4:live', 'refresh'])
    expect(d.state.closed).toBe(0) // the late answer closes nothing
  })

  it('a late timeout after the dialog was closed changes nothing but a re-read', async () => {
    const d = await open()
    stall('update_safety_alert')
    d.set('alert-edit-description', 'Detour')
    d.submit()
    await d.c.flush()
    d.state.request = null
    d.c.rerender()
    trail = []
    timeOut()
    await d.c.flush()
    expect(trail).toEqual(['refresh'])
  })
})

