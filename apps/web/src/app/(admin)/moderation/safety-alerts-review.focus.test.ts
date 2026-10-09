// apps/web/src/app/(admin)/moderation/safety-alerts-review.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Edit in admin" on a safety alert (I2): the Moderation tab opens on Safety Alerts, the alert is read
// by id while live and pinned at the top ONCE (even when it is not among the newest 50), with its
// Approve / Remove; a removed or expired alert (unreadable by RLS) is not_found with a plain line.
// One resolve per link. Wiring runs SafetyAlertsReview itself against a mocked client.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Instance = { state: unknown[]; i: number; effects: Array<() => unknown> }
let current: Instance | null = null
let harness = false
vi.mock('react', async (orig) => {
  const actual = await orig<typeof import('react')>()
  return {
    ...actual,
    useState: (init: unknown) => {
      if (!harness || !current) return actual.useState(init)
      const inst = current
      const i = inst.i++
      if (inst.state.length <= i) inst.state.push(typeof init === 'function' ? (init as () => unknown)() : init)
      return [inst.state[i], (v: unknown) => (inst.state[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(inst.state[i]) : v)]
    },
    useEffect: (fn: () => unknown, deps?: unknown[]) => {
      if (!harness || !current) return actual.useEffect(fn as never, deps)
      current.effects.push(fn)
    },
    useCallback: (fn: unknown, deps: unknown[]) => (harness && current ? fn : actual.useCallback(fn as never, deps)),
    useMemo: (fn: () => unknown, deps: unknown[]) => (harness && current ? fn() : actual.useMemo(fn, deps)),
  }
})

const h = vi.hoisted(() => ({
  session: null as null | { focus: { kind: string; id: string }; resolve: (o: string) => boolean; isOpen: () => boolean },
  resolved: [] as string[],
  list: [] as unknown[],
  focused: null as unknown,
  focusedCalls: [] as Array<[string, ...unknown[]]>,
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
      const calls: Array<[string, ...unknown[]]> = []
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gt', 'order', 'limit']) {
        chain[m] = (...a: unknown[]) => (calls.push([m, ...a]), chain)
      }
      chain.maybeSingle = async () => {
        h.focusedCalls.push(...calls)
        return { data: h.focused, error: null }
      }
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: h.list, error: null }).then(res)
      return chain
    },
  }),
}))

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  SafetyAlertsReview,
  SafetyAlertsReviewView,
  focusedAlertNotice,
  pinFocusedAlert,
  type LiveAlert,
  type SafetyAlertsReviewViewProps,
} from './safety-alerts-review'
import { initialModerationSubtab } from './moderation-tab'

const NOW = new Date('2026-10-08T19:00:00.000Z')
const alert = (id: string, extra: Partial<LiveAlert> = {}): LiveAlert => ({
  id,
  status: 'live',
  alert_type: 'road_closure',
  severity: 3,
  description: `Alert ${id.slice(0, 4)}`,
  confirm_count: 0,
  clear_count: 0,
  created_at: '2026-10-08T18:00:00.000Z',
  expires_at: '2026-10-08T21:00:00.000Z',
  verified: false,
  ...extra,
})
const A = '55555555-5555-4555-8555-555555555555'
const B = '66666666-6666-4666-8666-666666666666'
const C = '77777777-7777-4777-8777-777777777777'

const view = (over: Partial<SafetyAlertsReviewViewProps>) =>
  renderToStaticMarkup(
    createElement(SafetyAlertsReviewView, {
      alerts: [],
      loading: false,
      error: null,
      approvingId: null,
      removingId: null,
      now: NOW,
      onApprove: () => {},
      onRemove: () => {},
      ...over,
    })
  )

beforeEach(() => {
  harness = false
  h.resolved.length = 0
  h.focusedCalls.length = 0
  h.list = []
  h.focused = null
  h.session = {
    focus: { kind: 'safety_alert', id: C },
    isOpen: () => h.resolved.length === 0,
    resolve: (o: string) => (h.resolved.length ? false : (h.resolved.push(o), true)),
  }
})

describe('Moderation tab opens on the right sub-tab', () => {
  it('Safety Alerts for a safety-alert link; Reports otherwise', () => {
    expect(initialModerationSubtab(`?tab=moderation&focus=safety_alert:${A}`)).toBe('safety')
    expect(initialModerationSubtab(`?tab=moderation&focus=post:${A}`)).toBe('reports')
    expect(initialModerationSubtab('?tab=moderation')).toBe('reports')
    expect(initialModerationSubtab('?tab=moderation&focus=safety_alert:junk')).toBe('reports')
  })
})

describe('pinning', () => {
  it('the linked alert comes first and appears once', () => {
    expect(pinFocusedAlert([alert(A), alert(B)], alert(B)).map((a) => a.id)).toEqual([B, A])
    expect(pinFocusedAlert([alert(A), alert(B)], alert(C)).map((a) => a.id)).toEqual([C, A, B])
    expect(pinFocusedAlert([alert(A)], null).map((a) => a.id)).toEqual([A])
  })

  it('the view marks the pinned card and keeps Approve / Remove on it', () => {
    const html = view({ alerts: pinFocusedAlert([alert(A)], alert(C)), pinnedId: C })
    expect(html.indexOf('data-testid="focused-alert"')).toBeLessThan(html.indexOf(`admin-approve-alert-${A}`))
    expect(html.match(/Opened from link/g)).toHaveLength(1)
    expect(html).toContain(`admin-approve-alert-${C}`)
    expect(html).toContain(`admin-remove-alert-${C}`)
  })

  it('a not-live alert: a plain status line, the list still there, nothing pinned', () => {
    const html = view({ alerts: [alert(A)], focusNotice: focusedAlertNotice({ status: 'not_found' }) })
    expect(html).toContain('no longer live')
    expect(html).toContain('role="status"')
    expect(html).toContain(`admin-remove-alert-${A}`)
    expect(html).not.toContain('Opened from link')
    expect(focusedAlertNotice({ status: 'found' })).toBeNull()
    expect(focusedAlertNotice({ status: 'none' })).toBeNull()
  })
})

describe('SafetyAlertsReview wiring (mocked client)', () => {
  async function run() {
    harness = true
    const inst: Instance = { state: [], i: 0, effects: [] }
    const render = () => {
      inst.i = 0
      inst.effects = []
      current = inst
      try {
        return SafetyAlertsReview() as { props: SafetyAlertsReviewViewProps }
      } finally {
        current = null
      }
    }
    render()
    inst.effects.forEach((fn) => fn())
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    return render().props
  }

  it('reads the linked alert by id while live, resolves found once, pins it above the newest 50', async () => {
    h.list = Array.from({ length: 50 }, (_, i) => alert(`${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`))
    h.focused = alert(C)
    const props = await run()
    expect(h.focusedCalls).toEqual([
      ['select', expect.stringContaining('id, status, alert_type')],
      ['eq', 'id', C],
      ['eq', 'status', 'live'],
      ['gt', 'expires_at', expect.any(String)],
    ])
    expect(h.resolved).toEqual(['found'])
    expect(props.pinnedId).toBe(C)
    expect(props.alerts[0].id).toBe(C)
    expect(props.alerts).toHaveLength(51)
  })

  it('removed or expired (no readable row): not_found once, a plain line, nothing pinned', async () => {
    h.list = [alert(A)]
    h.focused = null
    const props = await run()
    expect(h.resolved).toEqual(['not_found'])
    expect(props.pinnedId).toBeNull()
    expect(props.focusNotice).toMatch(/no longer live/)
    expect(props.alerts.map((a) => a.id)).toEqual([A])
  })

  it('no alert link: no by-id read', async () => {
    h.session = null
    h.list = [alert(A)]
    const props = await run()
    expect(h.focusedCalls).toEqual([])
    expect(props.pinnedId).toBeNull()
  })
})
