// apps/web/src/lib/event-admin-rpc.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Every event write, as the database and the operator see it:
//   - the ONE RPC called (name + exact args) carries x-request-id, and the client touches no table
//     (supabase.from is never called — event_occurrences is RPC-only);
//   - exactly one persisted app_logs row per action (<op>.complete / <op>.error), with the same
//     request_id as the RPC header, duration_ms, the labels the registry keeps, and on failure the
//     SQLSTATE as error_code;
//   - each SQLSTATE + message prefix becomes the right translated message and field;
//   - the closed registry and the audited-RPC list name the new actions.
// Uses the real privilegedRpc -> withMetric -> /api/client-log sink (fetch captured).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  addEventDates,
  cancelEventOccurrence,
  createOrgEvent,
  extendEventSeries,
  mapEventError,
  previewEventRecurrence,
  ruleEditOf,
  updateEvent,
} from './event-admin-rpc'
import { EVENT_REGISTRY, sanitizeClientEvent } from './event-registry'
import { AUDITED_PRIVILEGED, scanForBypasses } from './privileged-action-guard'

type LogBody = { level: 'info' | 'error'; event: string; context: Record<string, unknown>; duration_ms: number; request_id: string }

let logs: LogBody[] = []
const realFetch = globalThis.fetch

beforeEach(() => {
  logs = []
  // Browser path of the sink: POST /api/client-log.
  ;(globalThis as unknown as { window: unknown }).window = {}
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === '/api/client-log') logs.push(JSON.parse(String(init?.body)))
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

function fakeSupabase(result: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<{ name: string; args: Record<string, unknown>; headers: Record<string, string> }> = []
  const from = vi.fn(() => {
    throw new Error('direct table access')
  })
  const client = {
    from,
    rpc: (name: string, args: Record<string, unknown>) => {
      const call = { name, args, headers: {} as Record<string, string> }
      calls.push(call)
      return {
        setHeader(k: string, v: string) {
          call.headers[k] = v
          return Promise.resolve(result)
        },
      }
    },
  }
  return { client: client as never, calls, from }
}

/** The row /api/client-log would store: the route runs the same registry sanitizer. */
function stored(body: LogBody) {
  const s = sanitizeClientEvent(body.event, body.level, body.context)
  return s.ok ? s.context : null
}

describe('create_org_event — one RPC, one persisted row', () => {
  const args = {
    p_org_id: 'org-1',
    p_idempotency_key: '0f8e3d4c-0000-4000-8000-000000000001',
    p_title: 'Food distribution',
    p_time_zone: 'America/New_York',
    p_starts_local: '2026-11-10T10:00',
    p_ends_local: '2026-11-10T11:30',
    p_location_source: 'org',
    p_event_type: 'meal',
  }

  it('success: returns the event id; app_logs gets admin.event.create.complete with the RPC’s request id', async () => {
    const sb = fakeSupabase({ data: 'event-9', error: null })
    const r = await createOrgEvent(sb.client, args)
    expect(r).toEqual({ ok: true, eventId: 'event-9' })
    expect(sb.calls).toHaveLength(1)
    expect(sb.calls[0].name).toBe('create_org_event')
    expect(sb.calls[0].args).toEqual(args)
    expect(sb.from).not.toHaveBeenCalled()
    expect(logs).toHaveLength(1)
    expect(logs[0].event).toBe('admin.event.create.complete')
    expect(logs[0].request_id).toBe(sb.calls[0].headers['x-request-id'])
    expect(typeof logs[0].duration_ms).toBe('number')
    expect(stored(logs[0])).toEqual({
      org_id: 'org-1',
      event_type: 'meal',
      location_source: 'org',
      frequency: 'none',
      series_end: 'none',
      announce_days_before: 7,
      request_id: sb.calls[0].headers['x-request-id'],
    })
  })

  it('a repeating event: the rule travels in the ONE call; the log row carries its shape, never the rule', async () => {
    const sb = fakeSupabase({ data: 'event-10', error: null })
    const rule = { frequency: 'weekly', interval: 2, byDay: [{ day: 'sa' }], until: '2027-04-10T23:59:59' }
    await createOrgEvent(sb.client, { ...args, p_recurrence: rule, p_announce_days_before: 14 })
    expect(sb.calls.map((c) => c.name)).toEqual(['create_org_event'])
    expect(sb.calls[0].args).toMatchObject({ p_recurrence: rule, p_announce_days_before: 14 })
    expect(stored(logs[0])).toMatchObject({ frequency: 'weekly', series_end: 'until', announce_days_before: 14 })
    expect(JSON.stringify(stored(logs[0]))).not.toContain('2027-04-10')
  })

  it('failure: one admin.event.create.error row with error_code = SQLSTATE; the form shows the DST message on Start', async () => {
    const sb = fakeSupabase({
      data: null,
      error: {
        code: '22023',
        message:
          'event_time_invalid: 2026-03-08 02:30 does not exist in America/New_York (the clocks skip ahead for daylight saving time); choose another time',
      },
    })
    const r = await createOrgEvent(sb.client, args)
    expect(r).toMatchObject({ ok: false, code: '22023', errorKey: 'errTimeGap', field: 'start', localTime: '2026-03-08 02:30' })
    expect(logs.map((l) => l.event)).toEqual(['admin.event.create.error'])
    expect(stored(logs[0])).toMatchObject({ error_code: '22023', org_id: 'org-1' })
    expect(logs[0].request_id).toBe(sb.calls[0].headers['x-request-id'])
  })
})

describe('add_event_dates / cancel_event_occurrence / admin_update_event', () => {
  it('add dates: local wall-clock arrays in one call; returns added + restored (0 is a success)', async () => {
    const sb = fakeSupabase({ data: 0, error: null })
    const r = await addEventDates(sb.client, {
      eventId: 'e-1',
      orgId: 'org-1',
      dates: [
        { startsLocal: '2026-11-17T10:00', endsLocal: '2026-11-17T11:30' },
        { startsLocal: '2026-11-24T10:00', endsLocal: '2026-11-24T11:30' },
      ],
    })
    expect(r).toEqual({ ok: true, changed: 0 })
    expect(sb.calls[0]).toMatchObject({
      name: 'add_event_dates',
      args: {
        p_event_id: 'e-1',
        p_starts_local: ['2026-11-17T10:00', '2026-11-24T10:00'],
        p_ends_local: ['2026-11-17T11:30', '2026-11-24T11:30'],
      },
    })
    expect(sb.from).not.toHaveBeenCalled()
    expect(logs.map((l) => l.event)).toEqual(['admin.event.add_dates.complete'])
    expect(stored(logs[0])).toMatchObject({ event_id: 'e-1', org_id: 'org-1', date_count: 2 })
  })

  it('cancel a date: one RPC, one admin.occurrence.cancel.complete row', async () => {
    const sb = fakeSupabase({ data: null, error: null })
    expect(await cancelEventOccurrence(sb.client, { occurrenceId: 'o-1', eventId: 'e-1', orgId: 'org-1' })).toEqual({ ok: true })
    expect(sb.calls.map((c) => [c.name, c.args])).toEqual([['cancel_event_occurrence', { p_occurrence_id: 'o-1' }]])
    expect(sb.from).not.toHaveBeenCalled()
    expect(logs.map((l) => l.event)).toEqual(['admin.occurrence.cancel.complete'])
    expect(stored(logs[0])).toMatchObject({ occurrence_id: 'o-1', event_id: 'e-1', org_id: 'org-1' })
  })

  it('retire: admin_update_event with p_is_active false, logged as admin.event.update action=retire', async () => {
    const sb = fakeSupabase({ data: 'e-1', error: null })
    await updateEvent(sb.client, { orgId: 'org-1', action: 'retire', args: { p_event_id: 'e-1', p_is_active: false } })
    expect(sb.calls[0]).toMatchObject({ name: 'admin_update_event', args: { p_event_id: 'e-1', p_is_active: false } })
    expect(logs.map((l) => l.event)).toEqual(['admin.event.update.complete'])
    expect(stored(logs[0])).toMatchObject({ action: 'retire', event_id: 'e-1', org_id: 'org-1', location_source: 'keep' })
  })

  it('an org admin of an inactive org: 42501 -> the "inactive" message, one error row', async () => {
    const sb = fakeSupabase({
      data: null,
      error: { code: '42501', message: 'event_denied: this organization is inactive; only a platform admin may manage its events' },
    })
    const r = await updateEvent(sb.client, { orgId: 'org-1', action: 'update', args: { p_event_id: 'e-1', p_title: 'X' } })
    expect(r).toMatchObject({ ok: false, code: '42501', errorKey: 'errDeniedInactive' })
    expect(stored(logs[0])).toMatchObject({ error_code: '42501', action: 'update' })
  })
})

describe('mapEventError — every contract message has a specific, translated answer', () => {
  const cases: Array<[string, string, string, string | null]> = [
    ['22023', 'event_time_invalid: 2026-11-01 01:30 happens twice in America/New_York (the clocks go back when daylight saving time ends); choose a time outside that hour', 'errTimeRepeat', 'start'],
    ['22023', 'event_invalid: the end time must be after the start time', 'errEndBeforeStart', 'end'],
    ['22023', 'event_invalid: the end time must be after the start time (2026-11-17 10:00)', 'errEndBeforeStart', 'end'],
    ['22023', 'event_invalid: EST is not an IANA time zone such as America/New_York', 'errTimeZone', 'timeZone'],
    ['22023', 'event_invalid: a title is required', 'errTitleRequired', 'title'],
    ['22023', 'event_location_invalid: this organization has no map pin; enter the event address instead', 'errOrgNoPin', 'location'],
    ['22023', 'event_location_invalid: a street address is required', 'errAddressRequired', 'location'],
    ['22023', 'event_location_invalid: confirm the address on the map first', 'errConfirmPin', 'location'],
    ['22023', 'Event coordinates are out of range or point to null island.', 'errCoordinates', 'location'],
    ['42501', 'event_denied: only a platform admin or an admin of this organization may manage its events', 'errDenied', null],
    ['42501', 'event_denied: this organization is inactive; only a platform admin may manage its events', 'errDeniedInactive', null],
    ['P0001', 'event_retired: this event is retired; reactivate it before adding dates', 'errRetired', null],
    ['P0001', 'This event has check-ins and cannot be reopened once cancelled or completed. (2026-11-14 10:00)', 'errReopenCheckins', 'start'],
    ['P0001', 'This event has ended; its attendance history is permanent and it can no longer be cancelled.', 'errCancelEnded', null],
    ['P0002', 'event_not_found: 7d0c…', 'errNotFound', null],
    ['', 'TypeError: Failed to fetch', 'errNetwork', null],
  ]
  it.each(cases)('%s %s', (code, message, key, field) => {
    expect(mapEventError({ code, message })).toMatchObject({ errorKey: key, field })
  })
})

describe('P0001 refusals share a SQLSTATE and are told apart by text', () => {
  it('cancelled date with check-ins: the trailing (local start) is kept for row placement', () => {
    expect(
      mapEventError({ code: 'P0001', message: 'This event has check-ins and cannot be reopened once cancelled or completed. (2026-11-14 10:00)' })
    ).toEqual({ errorKey: 'errReopenCheckins', field: 'start', localTime: '2026-11-14 10:00' })
  })
  it('retired event is a different message under the same SQLSTATE', () => {
    expect(mapEventError({ code: 'P0001', message: 'event_retired: this event is retired; reactivate it before adding dates' })).toEqual({
      errorKey: 'errRetired',
      field: null,
      localTime: null,
    })
  })
})

describe('closed vocabulary + audited list', () => {
  it('registers the new wide events and drops the replaced ones', () => {
    for (const name of [
      'admin.event.create.complete',
      'admin.event.create.error',
      'admin.event.add_dates.complete',
      'admin.event.add_dates.error',
      'admin.occurrence.cancel.complete',
      'admin.occurrence.cancel.error',
      'admin.event.update.complete',
      'admin.event.update.error',
    ]) {
      expect(EVENT_REGISTRY, name).toHaveProperty([name])
    }
    for (const gone of ['admin.event.created', 'admin.occurrence.created', 'admin.occurrence.cancelled', 'admin.occurrence.cancel_failed']) {
      expect(EVENT_REGISTRY, gone).not.toHaveProperty([gone])
    }
    expect(Object.values(EVENT_REGISTRY).flat()).not.toContain('rrule')
  })

  it('recurring events: series labels on create / update, extend + preview ops, Events tab load', () => {
    for (const name of ['admin.event.create.complete', 'admin.event.create.error']) {
      expect(EVENT_REGISTRY[name]).toEqual(expect.arrayContaining(['frequency', 'series_end', 'announce_days_before']))
    }
    for (const name of ['admin.event.update.complete', 'admin.event.update.error']) {
      expect(EVENT_REGISTRY[name]).toEqual(expect.arrayContaining(['frequency', 'series_end', 'announce_days_before', 'rule_edit']))
    }
    expect(EVENT_REGISTRY['admin.event.extend_series.complete']).toEqual(['event_id', 'org_id', 'request_id'])
    expect(EVENT_REGISTRY['admin.event.extend_series.error']).toEqual(['event_id', 'org_id', 'request_id'])
    for (const name of [
      'admin.event.preview.complete',
      'admin.event.preview.error',
      'admin.event.ending_soon.load_failed',
      'events.tab.load.complete',
      'events.tab.load.error',
    ]) {
      expect(EVENT_REGISTRY, name).toHaveProperty([name])
    }
    // ids, enums and counts only: no rule JSON, no free text, nothing named rrule.
    const eventNames = Object.keys(EVENT_REGISTRY).filter((n) => /^admin\.event\.|^events\./.test(n))
    expect(eventNames.filter((n) => /rrule/i.test(n))).toEqual([])
    const labels = eventNames.flatMap((n) => EVENT_REGISTRY[n])
    for (const banned of ['recurrence', 'rule', 'title', 'description', 'address', 'location_name']) {
      expect(labels).not.toContain(banned)
    }
  })

  it('every event RPC is an audited privileged action (must go through privilegedRpc)', () => {
    expect(AUDITED_PRIVILEGED).toEqual(
      expect.arrayContaining(['create_org_event', 'add_event_dates', 'cancel_event_occurrence', 'admin_update_event', 'extend_event_series'])
    )
    // A direct call to the extend RPC is a bypass; through privilegedRpc it is clean.
    expect(scanForBypasses(`await supabase.rpc('extend_event_series', { p_event_id: id })`)).toEqual(['extend_event_series'])
    expect(
      scanForBypasses(`await privilegedRpc(supabase, 'admin.event.extend_series', 'extend_event_series', { p_event_id: id })`),
    ).toEqual([])
  })
})

describe('recurring writes — refusals, edits, extend, preview', () => {
  it.each([
    ['event_recurrence_invalid: the first date must be one of the repeating dates', 'errRepeatStartNotInPattern', 'pattern'],
    ['event_recurrence_invalid: a repeating event lasts at most 24 hours per date', 'errRepeatTooLong', 'end'],
    ['event_recurrence_invalid: the repeat gives no upcoming dates', 'errRepeatNoDates', 'pattern'],
    ['event_recurrence_invalid: the repeat ends before its first date', 'errRepeatUntilBeforeStart', 'until'],
    ['event_recurrence_invalid: only a repeating event that ends can be extended', 'errExtendNoEnd', null],
    ['event_recurrence_invalid: byDay lists the same day twice', 'errInvalid', null],
    ['event_invalid: post to the feed 0, 1, 3, 7, 14 or 30 days before each date', 'errLeadPreset', 'lead'],
  ])('22023 %s', (message, key, field) => {
    expect(mapEventError({ code: '22023', message })).toMatchObject({ errorKey: key, field })
  })

  it('edit labels say what happened to the series (ids and enums only)', async () => {
    const cases: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{ p_event_id: 'e-1', p_title: 'X', p_clear: [] }, { rule_edit: 'none', frequency: 'keep', series_end: 'keep', announce_days_before: null }],
      [{ p_event_id: 'e-1', p_announce_days_before: 3 }, { rule_edit: 'none', announce_days_before: 3 }],
      [{ p_event_id: 'e-1', p_series_starts_local: '2026-10-10T10:30', p_series_ends_local: '2026-10-10T12:00' }, { rule_edit: 'time', frequency: 'keep' }],
      [{ p_event_id: 'e-1', p_recurrence: { frequency: 'monthly', byMonthDay: [10], count: 6 } }, { rule_edit: 'pattern', frequency: 'monthly', series_end: 'count' }],
      [{ p_event_id: 'e-1', p_clear: ['recurrence'] }, { rule_edit: 'stop', frequency: 'none', series_end: 'none', cleared_count: 1 }],
    ]
    for (const [a, want] of cases) {
      logs = []
      const sb = fakeSupabase({ data: 'e-1', error: null })
      await updateEvent(sb.client, { orgId: 'org-1', action: 'update', args: a as never })
      expect(sb.calls[0].args).toEqual(a)
      expect(stored(logs[0]), JSON.stringify(a)).toMatchObject(want)
    }
    expect(ruleEditOf({ p_event_id: 'e', p_recurrence: { frequency: 'weekly', byDay: [{ day: 'sa' }] }, p_series_starts_local: 'x', p_series_ends_local: 'y' })).toBe('pattern')
  })

  it('extend: ONE extend_event_series call with the key, one admin.event.extend_series.complete row; returns the new end', async () => {
    const sb = fakeSupabase({
      data: { recurrence: {}, previous_end: '2026-10-31', until: '2027-04-30T23:59:59', generated: 26, replayed: false },
      error: null,
    })
    const r = await extendEventSeries(sb.client, { eventId: 'e-1', orgId: 'org-1', idempotencyKey: 'k-9' })
    expect(r).toEqual({ ok: true, until: '2027-04-30T23:59:59', generated: 26, replayed: false })
    expect(sb.calls.map((c) => [c.name, c.args])).toEqual([['extend_event_series', { p_event_id: 'e-1', p_idempotency_key: 'k-9' }]])
    expect(sb.from).not.toHaveBeenCalled()
    expect(logs.map((l) => l.event)).toEqual(['admin.event.extend_series.complete'])
    expect(stored(logs[0])).toEqual({ event_id: 'e-1', org_id: 'org-1', request_id: sb.calls[0].headers['x-request-id'] })
  })

  it('extend refused (open-ended series): one error row, the translated message', async () => {
    const sb = fakeSupabase({ data: null, error: { code: '22023', message: 'event_recurrence_invalid: only a repeating event that ends can be extended' } })
    const r = await extendEventSeries(sb.client, { eventId: 'e-1', orgId: 'org-1', idempotencyKey: 'k' })
    expect(r).toMatchObject({ ok: false, errorKey: 'errExtendNoEnd' })
    expect(logs.map((l) => l.event)).toEqual(['admin.event.extend_series.error'])
    expect(stored(logs[0])).toMatchObject({ error_code: '22023', event_id: 'e-1' })
  })

  it('the extend button file calls the RPC only through privilegedRpc', () => {
    const file = path.join(__dirname, '../app/(admin)/moderation/extend-series-button.tsx')
    const src = fs.readFileSync(file, 'utf8') + fs.readFileSync(path.join(__dirname, 'event-admin-rpc.ts'), 'utf8')
    expect(scanForBypasses(src)).toEqual([])
  })

  function previewClient(result: { data: unknown; error: { code?: string; message: string } | null }) {
    const calls: Array<{ name: string; args: Record<string, unknown>; signal?: AbortSignal }> = []
    const client = {
      rpc: (name: string, a: Record<string, unknown>) => {
        const call: { name: string; args: Record<string, unknown>; signal?: AbortSignal } = { name, args: a }
        calls.push(call)
        return {
          abortSignal(sig: AbortSignal) {
            call.signal = sig
            return Promise.resolve(result)
          },
        }
      },
    }
    return { client: client as never, calls }
  }

  const input = {
    rule: { frequency: 'weekly' as const, byDay: [{ day: 'sa' as const }] },
    startsLocal: '2026-10-10T09:00',
    endsLocal: '2026-10-10T11:00',
    timeZone: 'America/New_York',
    orgId: 'org-1',
  }

  it('preview: preview_event_recurrence with 5 dates, the abort signal attached, one admin.event.preview.complete row', async () => {
    const sb = previewClient({
      data: [{ local_date: '2026-10-10', starts_at: '2026-10-10T13:00:00+00:00', ends_at: '2026-10-10T15:00:00+00:00', shifted: false, starts_local: '', ends_local: '' }],
      error: null,
    })
    const ctrl = new AbortController()
    const r = await previewEventRecurrence(sb.client, input, ctrl.signal)
    expect(r).toEqual({ ok: true, dates: [{ localDate: '2026-10-10', startsAt: '2026-10-10T13:00:00+00:00', endsAt: '2026-10-10T15:00:00+00:00', shifted: false }] })
    expect(sb.calls[0]).toMatchObject({
      name: 'preview_event_recurrence',
      args: { p_recurrence: input.rule, p_starts_local: '2026-10-10T09:00', p_ends_local: '2026-10-10T11:00', p_time_zone: 'America/New_York', p_limit: 5 },
    })
    expect(sb.calls[0].signal).toBe(ctrl.signal)
    expect(logs.map((l) => l.event)).toEqual(['admin.event.preview.complete'])
    expect(stored(logs[0])).toEqual({ frequency: 'weekly', org_id: 'org-1' })
  })

  it('preview failure resolves (never throws) and records one error row', async () => {
    const sb = previewClient({ data: null, error: { code: '22023', message: 'event_recurrence_invalid: the repeat gives no upcoming dates' } })
    expect(await previewEventRecurrence(sb.client, input, new AbortController().signal)).toEqual({ ok: false, aborted: false })
    expect(logs.map((l) => l.event)).toEqual(['admin.event.preview.error'])
    expect(stored(logs[0])).toMatchObject({ error_code: '22023', frequency: 'weekly' })
  })
})
