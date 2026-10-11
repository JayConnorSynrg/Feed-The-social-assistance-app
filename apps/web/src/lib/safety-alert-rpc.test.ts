// apps/web/src/lib/safety-alert-rpc.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one client path to safety alerts, against a recording Supabase client and the REAL logger
// (rows captured at /api/client-log, then passed through the registry as the route does):
//   - each surface's reader call (invariant 1), with gone rows dropped and rows copied field by field
//     (no reporter or verifier id can ride along — invariant 10);
//   - every write sends the version the member saw; a cleared description is sent as the contract's
//     clear value and an untouched field is not sent at all (invariant 3);
//   - each refusal becomes its typed failure (PT409 conflict, PT410 resolved / gone, PT404, guest …);
//   - one persisted wide row per action with its name, labels, duration and request id (invariant 8).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sanitizeClientEvent } from './event-registry'
import { AUDITED_PRIVILEGED, scanForBypasses } from './privileged-action-guard'
import {
  ADMIN_ALERT_LIMIT,
  STRIP_ALERT_LIMIT,
  alertUpdateArgs,
  parseAlertRpcError,
  placeSafetyAlert,
  readSafetyAlertById,
  readSafetyAlertHistory,
  readSafetyAlertList,
  readSafetyAlertStrip,
  readSafetyAlertsInView,
  resolveSafetyAlert,
  toSafetyAlert,
  updateSafetyAlert,
  voteSafetyAlert,
  withdrawSafetyAlert,
  type SafetyAlert,
} from './safety-alert-rpc'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const HOUR = 3600_000
const ID = '55555555-5555-4555-8555-555555555555'

/** A reader row / AlertPublic as the server sends it (the contract's 20 keys). */
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  alert_type: 'road_closure',
  severity: 2,
  description: 'Bridge out',
  lng: -72.97,
  lat: 43.61,
  status: 'live',
  confirm_count: 1,
  clear_count: 0,
  created_at: iso(-HOUR),
  expires_at: iso(5 * HOUR),
  verified: false,
  is_mine: true,
  version: 3,
  updated_at: iso(-600_000),
  update_count: 2,
  resolved_at: null,
  resolved_by_role: null,
  shown_state: 'live',
  shown_until: iso(5 * HOUR),
  ...over,
})
const alert = (over: Partial<SafetyAlert> = {}): SafetyAlert => ({ ...(toSafetyAlert(row()) as SafetyAlert), ...over })

type Answer = { data?: unknown; error?: unknown }
function fakeSupabase(answers: Record<string, Answer | (() => Answer)> = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown>; headers: Record<string, string> }> = []
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      const call = { name, args, headers: {} as Record<string, string> }
      calls.push(call)
      const answer = answers[name]
      const result = Promise.resolve({ data: null, error: null, ...(typeof answer === 'function' ? answer() : answer) })
      const builder = {
        setHeader: (k: string, v: string) => {
          call.headers[k] = v
          return builder
        },
        abortSignal: () => builder,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => result.then(res, rej),
      }
      return builder
    },
  }
  return { client: client as never, calls }
}

type Posted = { level: 'info' | 'warn' | 'error'; event: string; context: Record<string, unknown>; request_id?: string; duration_ms?: number }
let posted: Posted[] = []

beforeEach(() => {
  posted = []
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('window', {})
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: { body: string }) => {
      if (url === '/api/client-log') posted.push(JSON.parse(init.body))
      return Promise.resolve(new Response('{}'))
    }),
  )
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('readers — one call shape per surface', () => {
  it('the strip: top five, resolved included', async () => {
    const { client, calls } = fakeSupabase({ safety_alerts_in_view: { data: [row()] } })
    expect(await readSafetyAlertStrip(client)).toHaveLength(1)
    expect(STRIP_ALERT_LIMIT).toBe(5)
    expect(calls).toEqual([{ name: 'safety_alerts_in_view', args: { p_limit: 5, p_include_resolved: true }, headers: {} }])
  })

  it('the map: the four bounds, resolved included', async () => {
    const { client, calls } = fakeSupabase({ safety_alerts_in_view: { data: [] } })
    await readSafetyAlertsInView(client, { west: -73, south: 43, east: -72, north: 44 })
    expect(calls[0].args).toEqual({ p_min_lng: -73, p_min_lat: 43, p_max_lng: -72, p_max_lat: 44, p_include_resolved: true })
  })

  it('one alert by id (editor, map focus, admin link): the row, or null once it is gone', async () => {
    const found = fakeSupabase({ safety_alerts_in_view: { data: [row()] } })
    expect((await readSafetyAlertById(found.client, ID))?.id).toBe(ID)
    expect(found.calls[0].args).toEqual({ p_alert_id: ID, p_include_resolved: true })
    expect(await readSafetyAlertById(fakeSupabase({ safety_alerts_in_view: { data: [] } }).client, ID)).toBeNull()
  })

  it('the admin list: 200, resolved included', async () => {
    const { client, calls } = fakeSupabase({ safety_alerts_in_view: { data: [] } })
    await readSafetyAlertList(client)
    expect(calls[0].args).toEqual({ p_limit: ADMIN_ALERT_LIMIT, p_include_resolved: true })
    expect(ADMIN_ALERT_LIMIT).toBe(200)
  })

  it('a row the shown rule calls gone never leaves the reader; live and resolved (< 6 h) do', async () => {
    const rows = [
      row({ id: 'live' }),
      row({ id: 'past-expiry', expires_at: iso(-1) }),
      row({ id: 'resolved', status: 'resolved', resolved_at: iso(-HOUR) }),
      row({ id: 'resolved-old', status: 'resolved', resolved_at: iso(-6 * HOUR) }),
      row({ id: 'cleared', status: 'cleared' }),
    ]
    const { client } = fakeSupabase({ safety_alerts_in_view: { data: rows } })
    expect((await readSafetyAlertStrip(client)).map((a) => a.id)).toEqual(['live', 'resolved'])
  })

  it('a failed read throws (the caller keeps what it had)', async () => {
    const { client } = fakeSupabase({ safety_alerts_in_view: { error: { code: '57014', message: 'canceling statement' } } })
    await expect(readSafetyAlertStrip(client)).rejects.toMatchObject({ name: 'AlertReadError', code: '57014' })
  })
})

describe('rows are copied field by field — no identity can ride along', () => {
  it('an answer carrying created_by / verified_by / anything else yields exactly the named fields', () => {
    const mapped = toSafetyAlert(row({ created_by: 'user-1', verified_by: 'mod-1', verified_at: iso(0), location: '0101…', actor_id: 'x' }))
    expect(Object.keys(mapped as object).sort()).toEqual(
      ['alert_type', 'clear_count', 'confirm_count', 'created_at', 'description', 'expires_at', 'id', 'is_mine', 'lat', 'lng', 'resolved_at', 'severity', 'status', 'update_count', 'updated_at', 'verified', 'version'].sort(),
    )
    expect(JSON.stringify(mapped)).not.toMatch(/user-1|mod-1|created_by|verified_by|actor/)
  })

  it('is_mine is true only when the server says so; a raw row without coordinates maps to non-finite ones', () => {
    expect(toSafetyAlert(row({ is_mine: undefined }))?.is_mine).toBe(false)
    expect(toSafetyAlert(row({ is_mine: 'true' }))?.is_mine).toBe(false)
    const raw = toSafetyAlert({ id: ID, alert_type: 'general', severity: 1, status: 'live', location: '0101000020E6…', expires_at: iso(HOUR) })
    expect(Number.isFinite(raw?.lng)).toBe(false)
    expect(Number.isFinite(raw?.lat)).toBe(false)
    expect(toSafetyAlert(null)).toBeNull()
    expect(toSafetyAlert({ alert_type: 'general' })).toBeNull()
  })

  it('history: what changed and when, newest first — no role, no note, no id of anyone', async () => {
    const message = (version: number, over: Record<string, unknown> = {}) => ({
      version,
      msg_type: 'update',
      supersedes_version: version - 1,
      sent_at: iso(-version * 1000),
      alert_type: 'road_closure',
      severity: 3,
      description: 'Bridge out',
      lng: -72.97,
      lat: 43.61,
      expires_at: iso(24 * HOUR),
      changed: ['severity', 'expires_at'],
      severity_change: 'escalated',
      actor_role: 'moderator',
      actor_id: 'mod-1',
      note: 'private note',
      ...over,
    })
    const { client, calls } = fakeSupabase({ safety_alert_history: { data: [message(1, { msg_type: 'alert', changed: [], severity_change: 'same' }), message(3), message(2)] } })
    const entries = await readSafetyAlertHistory(client, ID, 'strip')
    expect(calls[0]).toMatchObject({ name: 'safety_alert_history', args: { p_alert_id: ID } })
    expect(entries.map((e) => e.version)).toEqual([3, 2, 1])
    expect(Object.keys(entries[0]).sort()).toEqual(['alert_type', 'changed', 'description', 'expires_at', 'msg_type', 'sent_at', 'severity', 'severity_change', 'version'])
    expect(JSON.stringify(entries)).not.toMatch(/moderator|mod-1|private note|actor/)
  })
})

describe('writes — what is sent', () => {
  const answered = () => fakeSupabase({ update_safety_alert: { data: row({ version: 4 }) }, resolve_safety_alert: { data: row({ status: 'resolved', resolved_at: iso(0), version: 4 }) }, vote_safety_alert: { data: row({ confirm_count: 2 }) }, place_safety_alert: { data: row({ version: 1 }) } })

  it('update sends the version the form opened with, and only what changed', async () => {
    const { client, calls } = answered()
    const res = await updateSafetyAlert(client, alert(), { description: 'Bridge out, detour on Elm' }, 'strip')
    expect(res).toMatchObject({ ok: true, value: { version: 4 } })
    expect(calls[0].name).toBe('update_safety_alert')
    expect(calls[0].args).toEqual({ p_alert_id: ID, p_expected_version: 3, p_description: 'Bridge out, detour on Elm' })
    expect(calls[0].headers['x-request-id']).toBeTruthy()
  })

  it('a cleared description is sent as the clear value (never the old text, never a kept field); an untouched one is not sent', () => {
    expect(alertUpdateArgs({ id: ID, version: 3 }, { description: null })).toEqual({ p_alert_id: ID, p_expected_version: 3, p_description: '' })
    expect(alertUpdateArgs({ id: ID, version: 3 }, { severity: 4 })).toEqual({ p_alert_id: ID, p_expected_version: 3, p_severity: 4 })
    expect('p_description' in alertUpdateArgs({ id: ID, version: 3 }, { type: 'weather' })).toBe(false)
  })

  it('a move sends both coordinates together, or neither', () => {
    expect(alertUpdateArgs({ id: ID, version: 3 }, { lng: -72.5, lat: 44.1 })).toMatchObject({ p_lng: -72.5, p_lat: 44.1 })
    const half = alertUpdateArgs({ id: ID, version: 3 }, { lng: -72.5 })
    expect('p_lng' in half || 'p_lat' in half).toBe(false)
  })

  it('resolve sends the version; withdraw names only the alert; vote names the vote; place sends the five fields', async () => {
    const { client, calls } = answered()
    await resolveSafetyAlert(client, alert(), 'map')
    await withdrawSafetyAlert(client, alert(), 'map')
    await voteSafetyAlert(client, alert(), 'clear', 'map')
    await placeSafetyAlert(client, { type: 'weather', severity: 2, description: 'Ice', lng: -72.9, lat: 43.6 }, 'map')
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['resolve_safety_alert', { p_alert_id: ID, p_expected_version: 3 }],
      ['delete_safety_alert', { p_alert_id: ID }],
      ['vote_safety_alert', { p_alert_id: ID, p_vote: 'clear' }],
      ['place_safety_alert', { p_type: 'weather', p_severity: 2, p_description: 'Ice', p_lng: -72.9, p_lat: 43.6 }],
    ])
  })
})

describe('refusals become typed failures', () => {
  it.each([
    [{ code: 'PT409', message: 'edit_conflict', details: '{"current_version": 7, "updated_at": "2026-10-11T11:59:00Z"}' }, { kind: 'conflict', currentVersion: 7, updatedAt: '2026-10-11T11:59:00Z' }],
    [{ code: 'PT410', message: 'alert is no longer live', details: '{"code":"alert_not_live","status":"resolved"}' }, { kind: 'not_live', resolved: true }],
    [{ code: 'PT410', message: 'alert is no longer live', details: '{"code":"alert_not_live","status":"cleared"}' }, { kind: 'not_live', resolved: false }],
    [{ code: 'PT410', message: 'alert is no longer live' }, { kind: 'not_live', resolved: false }],
    [{ code: 'PT404', message: 'alert_not_found' }, { kind: 'not_found' }],
    [{ code: '42501', message: 'Account required for this action' }, { kind: 'guest' }],
    [{ code: '42501', message: 'guest_refused' }, { kind: 'guest' }],
    [{ code: '42501', message: 'not_alert_owner' }, { kind: 'forbidden', token: 'not_alert_owner' }],
    [{ code: '42501', message: 'self_moderation_refused' }, { kind: 'forbidden', token: 'self_moderation_refused' }],
    [{ code: '22023', message: 'alert_field_invalid:severity' }, { kind: 'invalid', field: 'severity' }],
    [{ code: '22023', message: 'alert_field_required:expected_version' }, { kind: 'invalid', field: 'expected_version' }],
    [{ message: 'Failed to fetch' }, { kind: 'network' }],
    [{ code: 'XX000', message: 'boom' }, { kind: 'unknown', code: 'XX000' }],
  ])('%j', (error, failure) => {
    expect(parseAlertRpcError(error)).toEqual(failure)
  })

  it('a refused write comes back as a failure, not a throw', async () => {
    const { client } = fakeSupabase({ update_safety_alert: { error: { code: 'PT409', message: 'edit_conflict', details: '{"current_version": 4}' } } })
    expect(await updateSafetyAlert(client, alert(), { severity: 4 }, 'map')).toMatchObject({ ok: false, failure: { kind: 'conflict', currentVersion: 4 } })
  })
})

describe('one persisted wide row per action (name, labels, duration, request id)', () => {
  /** What the client-log route would store for a posted row. */
  const stored = (p: Posted) => {
    const checked = sanitizeClientEvent(p.event, p.level, p.context)
    return { event: p.event, level: p.level, ok: checked.ok, context: checked.ok ? checked.context : null }
  }

  it('place, update, escalate, de-escalate, resolve, withdraw, vote, history open', async () => {
    const { client, calls } = fakeSupabase({
      place_safety_alert: { data: row() },
      update_safety_alert: { data: row() },
      resolve_safety_alert: { data: row() },
      vote_safety_alert: { data: row() },
      safety_alert_history: { data: [] },
    })
    await placeSafetyAlert(client, { type: 'weather', severity: 2, description: 'Ice on Main St', lng: -72.9, lat: 43.6 }, 'map')
    await updateSafetyAlert(client, alert(), { description: 'Detour on Elm' }, 'strip')
    await updateSafetyAlert(client, alert({ severity: 2 }), { severity: 4 }, 'strip')
    await updateSafetyAlert(client, alert({ severity: 3, is_mine: false }), { severity: 1 }, 'map')
    await resolveSafetyAlert(client, alert(), 'strip')
    await withdrawSafetyAlert(client, alert(), 'map')
    await voteSafetyAlert(client, alert({ is_mine: false }), 'confirm', 'map')
    await readSafetyAlertHistory(client, ID, 'map')

    expect(posted.map((p) => p.event)).toEqual([
      'alerts.place.complete',
      'alerts.update.complete',
      'alerts.escalate.complete',
      'alerts.deescalate.complete',
      'alerts.resolve.complete',
      'alerts.withdraw.complete',
      'alerts.vote.complete',
      'alerts.history.open.complete',
    ])
    // Every row: registered, info level, a duration, and the request id the RPC carried.
    posted.forEach((p, i) => {
      expect(stored(p).ok, p.event).toBe(true)
      expect(p.level).toBe('info')
      expect(typeof p.duration_ms, p.event).toBe('number')
      expect(typeof p.request_id, p.event).toBe('string')
      if (i < 7) expect(calls[i].headers['x-request-id'], p.event).toBe(p.request_id)
    })
    expect(stored(posted[0]).context).toEqual({ alert_type: 'weather', severity_before: null, severity_after: 2, is_owner: true, surface: 'map', request_id: posted[0].request_id })
    expect(stored(posted[2]).context).toEqual({ target_id: ID, alert_type: 'road_closure', severity_before: 2, severity_after: 4, is_owner: true, surface: 'strip', request_id: posted[2].request_id })
    expect(stored(posted[3]).context).toMatchObject({ severity_before: 3, severity_after: 1, is_owner: false, surface: 'map' })
    expect(stored(posted[5]).context).toMatchObject({ target_id: ID, severity_before: 2, severity_after: null, is_owner: true })
    expect(stored(posted[6]).context).toMatchObject({ target_id: ID, vote: 'confirm', is_owner: false })
    expect(stored(posted[7]).context).toEqual({ target_id: ID, surface: 'map' })
    // Never the member's words or the place.
    expect(JSON.stringify(posted)).not.toMatch(/Ice on Main|Detour|-72\.9|43\.6/)
  })

  it('a refusal is one error row carrying the SQLSTATE as its error class', async () => {
    const { client } = fakeSupabase({ resolve_safety_alert: { error: { code: 'PT410', message: 'alert is no longer live', details: '{"status":"cleared"}' } } })
    await resolveSafetyAlert(client, alert(), 'strip')
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ event: 'alerts.resolve.error', level: 'error' })
    expect(stored(posted[0]).context).toMatchObject({ error_code: 'PT410', target_id: ID, surface: 'strip' })
    expect(typeof posted[0].duration_ms).toBe('number')
  })
})

describe('no alert write can bypass the wrapper', () => {
  const WRITES = ['place_safety_alert', 'update_safety_alert', 'resolve_safety_alert', 'delete_safety_alert', 'vote_safety_alert']

  it.each(WRITES)('%s is audited: a bare .rpc() call of it anywhere in the tree fails the bypass guard', (name) => {
    expect(AUDITED_PRIVILEGED).toContain(name)
    expect(scanForBypasses(`await supabase.rpc('${name}', { p_alert_id: id })`)).toEqual([name])
    expect(scanForBypasses(`await privilegedRpc(supabase, 'alerts.x', '${name}', args, labels)`)).toEqual([])
  })

  it('the wrapper itself and the hooks that use it are clean', () => {
    for (const rel of ['lib/safety-alert-rpc.ts', 'hooks/use-safety-alerts.ts', 'hooks/use-safety-strip.ts', 'components/alerts/alert-editor-dialog.tsx']) {
      expect(scanForBypasses(readFileSync(path.join(__dirname, '..', rel), 'utf8')), rel).toEqual([])
    }
  })
})
