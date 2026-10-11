// apps/web/src/app/(admin)/moderation/safety-alerts-review.actions.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 10 — moderators' verify / remove keep working on the contract's shapes. The
// REAL SafetyAlertsReview on the mini hook runtime with a recording Supabase client:
//   - Approve and Remove send the version the row was showing, through privilegedRpc;
//   - the answer (the alert as members see it) updates the row, which keeps its place and is_mine;
//   - a stale version, an ended alert and a self-moderation refusal each say what happened; the list
//     is re-read when it is stale, and nothing is sent a second time;
//   - fix round: the answer's own fields reach the row (version, text, expiry, the server's verdict);
//     the list is read once per mount and once per stale refusal whatever the render rate; a write
//     that never answers gives up after 12 s.

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
vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => null }))

import { mount } from '@/test/mini-react'
import { NOW, alert, iso } from '@/test/alert-fixtures'
import { SafetyAlertsReview, type SafetyAlertsReviewViewProps } from './safety-alerts-review'

const A = alert({ id: 'a', version: 3 })
const B = alert({ id: 'b', version: 1, is_mine: true, created_at: iso(-2 * 3600_000) })

async function review() {
  const c = mount(() => SafetyAlertsReview())
  await c.flush()
  const props = () => (c.rerender() as unknown as { props: SafetyAlertsReviewViewProps }).props
  return { c, props }
}
const lists = () => h.backend.named('safety_alerts_in_view')
const HOUR = 3600_000

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  h.backend.reset()
  h.backend.answers.safety_alerts_in_view = { data: [A, B] }
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SafetyAlertsReview — verify and remove', () => {
  it('the list is read through the alert reader (live + resolved), with the server’s is_mine', async () => {
    const r = await review()
    expect(lists().map((c) => c.args)).toEqual([{ p_limit: 200, p_include_resolved: true }])
    expect(r.props().alerts.map((a) => [a.id, a.is_mine])).toEqual([['a', false], ['b', true]])
  })

  it('Approve sends the version on screen; the answer marks the row verified and it keeps its place', async () => {
    const r = await review()
    // The answer is the alert as members see it (is_mine is the caller's: false for a moderator).
    h.backend.answers.admin_verify_safety_alert = { data: { ...A, verified: true } }
    r.props().onApprove(A)
    await r.c.flush()
    const call = h.backend.named('admin_verify_safety_alert')[0]
    expect(call.args).toEqual({ p_alert_id: 'a', p_expected_version: 3 })
    expect(call.headers['x-request-id']).toBeTruthy()
    const after = r.props()
    expect(after.alerts.map((a) => [a.id, a.verified])).toEqual([['a', true], ['b', false]])
    expect(after.error).toBeNull()
  })

  it('the answer differs from the row on screen: every field the server answered reaches the row; its place and is_mine stay', async () => {
    const r = await review()
    // Verifying also moved the version; meanwhile the reporter had raised the severity and changed the
    // text (the answer is the alert as it is NOW). The moderator's answer says is_mine false for B's
    // reporter view and carries no coordinates worth trusting over the held pin.
    h.backend.answers.admin_verify_safety_alert = {
      data: { ...A, verified: true, version: 4, severity: 4, description: 'Bridge out — both lanes', updated_at: iso(0), update_count: 1, expires_at: iso(72 * HOUR), shown_until: iso(72 * HOUR), confirm_count: 5, lng: Number.NaN, lat: Number.NaN, is_mine: true },
    }
    r.props().onApprove(A)
    await r.c.flush()
    const row = r.props().alerts.find((a) => a.id === 'a')!
    expect(row).toMatchObject({
      verified: true,
      version: 4,
      severity: 4,
      description: 'Bridge out — both lanes',
      updated_at: iso(0),
      update_count: 1,
      expires_at: iso(72 * HOUR),
      shown_state: 'live',
      shown_until: iso(72 * HOUR),
      confirm_count: 5,
      // Kept from the row held: where it is, and whose it is.
      lng: A.lng,
      lat: A.lat,
      is_mine: false,
    })
    expect(r.props().alerts.map((a) => a.id)).toEqual(['a', 'b'])
    // The next action on that row sends the version the answer carried.
    h.backend.answers.admin_remove_safety_alert = { data: null }
    r.props().onRemove(row)
    await r.c.flush()
    expect(h.backend.named('admin_remove_safety_alert')[0].args).toEqual({ p_alert_id: 'a', p_expected_version: 4 })
  })

  it('an answer that carries no alert (an older server) still marks the row verified, and changes nothing else', async () => {
    const r = await review()
    h.backend.answers.admin_verify_safety_alert = { data: null }
    r.props().onApprove(A)
    await r.c.flush()
    expect(r.props().alerts.find((a) => a.id === 'a')).toEqual({ ...A, verified: true })
  })

  it('Remove sends the version on screen; the row leaves', async () => {
    const r = await review()
    h.backend.answers.admin_remove_safety_alert = { data: { ...B, status: 'removed', version: 2 } }
    r.props().onRemove(B)
    await r.c.flush()
    expect(h.backend.named('admin_remove_safety_alert')[0].args).toEqual({ p_alert_id: 'b', p_expected_version: 1 })
    expect(r.props().alerts.map((a) => a.id)).toEqual(['a'])
  })

  it('a stale version: said, the list re-read, nothing sent again', async () => {
    const r = await review()
    h.backend.answers.admin_verify_safety_alert = { error: { code: 'PT409', message: 'edit_conflict', details: '{"current_version": 4}' } }
    h.backend.answers.safety_alerts_in_view = { data: [{ ...A, version: 4, description: 'Changed' }, B] }
    r.props().onApprove(A)
    await r.c.flush()
    const after = r.props()
    expect(after.error).toMatch(/changed since the list was loaded/)
    expect(lists()).toHaveLength(2)
    expect(after.alerts.find((a) => a.id === 'a')).toMatchObject({ version: 4, verified: false })
    expect(h.backend.named('admin_verify_safety_alert')).toHaveLength(1)
  })

  it('an alert that ended meanwhile: said, and the list re-read', async () => {
    const r = await review()
    h.backend.answers.admin_remove_safety_alert = { error: { code: 'PT410', message: 'alert is no longer live', details: '{"status":"withdrawn"}' } }
    h.backend.answers.safety_alerts_in_view = { data: [B] }
    r.props().onRemove(A)
    await r.c.flush()
    expect(r.props().error).toMatch(/no longer live/)
    expect(r.props().alerts.map((a) => a.id)).toEqual(['b'])
  })

  it('the list is read once, however often the page re-renders; each stale refusal reads once more', async () => {
    const r = await review()
    for (let i = 0; i < 50; i++) r.c.rerender()
    await r.c.flush()
    expect(lists()).toHaveLength(1)
    h.backend.answers.admin_verify_safety_alert = { error: { code: 'PT409', message: 'edit_conflict', details: '{"current_version": 4}' } }
    r.props().onApprove(A)
    await r.c.flush()
    for (let i = 0; i < 50; i++) r.c.rerender()
    await r.c.flush()
    expect(lists()).toHaveLength(2)
    r.props().onApprove(A)
    await r.c.flush()
    expect(lists()).toHaveLength(3)
  })

  it('a write that never answers gives up after 12 s: the action is said to have failed and the button is free again', async () => {
    const timeouts: Array<{ ms: number; controller: AbortController }> = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
      const controller = new AbortController()
      timeouts.push({ ms, controller })
      return controller.signal
    })
    try {
      const r = await review()
      h.backend.answers.admin_verify_safety_alert = () => new Promise(() => {})
      r.props().onApprove(A)
      await r.c.flush()
      expect(r.props().approvingId).toBe('a')
      const write = timeouts.at(-1)!
      expect(write.ms).toBe(12_000)
      expect(h.backend.named('admin_verify_safety_alert')[0].signal).toBe(write.controller.signal)
      write.controller.abort()
      await r.c.flush()
      expect(r.props().approvingId).toBeNull()
      expect(r.props().error).toBe('Approve failed')
      expect(lists()).toHaveLength(1)

      h.backend.answers.admin_remove_safety_alert = () => new Promise(() => {})
      r.props().onRemove(A)
      await r.c.flush()
      timeouts.at(-1)!.controller.abort()
      await r.c.flush()
      expect(r.props().removingId).toBeNull()
      expect(r.props().error).toBe('Remove failed')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('self-moderation refused by the server: said in plain words, the list left as it is', async () => {
    const r = await review()
    h.backend.answers.admin_verify_safety_alert = { error: { code: '42501', message: 'self_moderation_refused' } }
    r.props().onApprove(B)
    await r.c.flush()
    expect(r.props().error).toBe('You reported this alert, so another moderator has to verify it.')
    expect(lists()).toHaveLength(1)
  })
})
