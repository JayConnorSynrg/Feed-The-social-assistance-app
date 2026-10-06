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
import {
  addEventDates,
  cancelEventOccurrence,
  createOrgEvent,
  mapEventError,
  updateEvent,
} from './event-admin-rpc'
import { EVENT_REGISTRY, sanitizeClientEvent } from './event-registry'
import { AUDITED_PRIVILEGED } from './privileged-action-guard'

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
      request_id: sb.calls[0].headers['x-request-id'],
    })
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

  it('every event RPC is an audited privileged action (must go through privilegedRpc)', () => {
    expect(AUDITED_PRIVILEGED).toEqual(
      expect.arrayContaining(['create_org_event', 'add_event_dates', 'cancel_event_occurrence', 'admin_update_event'])
    )
  })
})
