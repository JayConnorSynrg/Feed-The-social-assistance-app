// apps/web/src/lib/event-form-model.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The admin's create / add-dates / edit forms: what reaches the RPC (exact arguments, the
// idempotency key), what is refused before any request, and which error the admin sees where.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  buildCreateArgs,
  buildUpdateArgs,
  createSubmitController,
  defaultLocation,
  locateTimeError,
  resolveLocation,
  sameDayTime,
  toLocalDates,
  withStartDate,
  validateDateRows,
  validateTime,
  type CreateEventDraft,
  type DraftPin,
} from './event-form-model'

function keys() {
  let n = 0
  return () => `key-${++n}`
}

describe('exactly-once create — idempotency key + single flight', () => {
  it('a retry after a failure sends the SAME key; the key is renewed only after a success', async () => {
    const ctrl = createSubmitController(keys())
    const sent: string[] = []
    await ctrl.submit(async (k) => (sent.push(k), { ok: false }))
    await ctrl.submit(async (k) => (sent.push(k), { ok: false }))
    await ctrl.submit(async (k) => (sent.push(k), { ok: true }))
    await ctrl.submit(async (k) => (sent.push(k), { ok: true }))
    expect(sent).toEqual(['key-1', 'key-1', 'key-1', 'key-2'])
  })

  it('a thrown network error keeps the key too (the create may have committed)', async () => {
    const ctrl = createSubmitController(keys())
    await expect(ctrl.submit(async () => { throw new Error('offline') })).rejects.toThrow('offline')
    expect(ctrl.key).toBe('key-1')
    expect(ctrl.inFlight).toBe(false)
  })

  it('a second click while the first save is in flight sends nothing', async () => {
    const ctrl = createSubmitController(keys())
    let release: (v: { ok: boolean }) => void = () => {}
    const run = vi.fn(() => new Promise<{ ok: boolean }>((r) => { release = r }))
    const first = ctrl.submit(run)
    // Same tick as the first click: the flag is already set.
    expect(ctrl.inFlight).toBe(true)
    const second = await ctrl.submit(run)
    expect(second).toEqual({ status: 'busy' })
    expect(run).toHaveBeenCalledTimes(1)
    release({ ok: true })
    expect(await first).toEqual({ status: 'done', result: { ok: true } })
    expect(ctrl.inFlight).toBe(false)
  })

  it('opening a new form mints a new key', () => {
    const ctrl = createSubmitController(keys())
    ctrl.reset()
    expect(ctrl.key).toBe('key-2')
  })
})

const confirmed: DraftPin = { lng: -72.9757, lat: 43.6043, status: 'confirmed', source: 'exact' }

describe('location source', () => {
  it('defaults to the organization pin when the org has one, else to an address', () => {
    expect(defaultLocation(true)).toEqual({ source: 'org' })
    expect(defaultLocation(false)).toMatchObject({ source: 'address', pin: null })
  })

  it('org source sends only p_location_source org', () => {
    expect(resolveLocation({ source: 'org' }, true)).toEqual({ ok: true, args: { p_location_source: 'org' } })
  })

  it('org source on an org WITHOUT a pin is refused with the "enter an address" message', () => {
    expect(resolveLocation({ source: 'org' }, false)).toEqual({ ok: false, error: { key: 'errOrgNoPin' } })
  })

  it('an address needs a street and a CONFIRMED pin; only then are coordinates sent', () => {
    const base = { source: 'address' as const, street: '57 Prospect St', city: 'Rutland', state: 'VT', zip: '05701' }
    expect(resolveLocation({ ...base, street: ' ' , pin: confirmed }, true)).toEqual({ ok: false, error: { key: 'errAddressRequired' } })
    expect(resolveLocation({ ...base, pin: null }, true)).toEqual({ ok: false, error: { key: 'errConfirmPin' } })
    expect(resolveLocation({ ...base, pin: { ...confirmed, status: 'draft' } }, true)).toEqual({
      ok: false,
      error: { key: 'errConfirmPin' },
    })
    expect(resolveLocation({ ...base, pin: confirmed }, false)).toEqual({
      ok: true,
      args: {
        p_location_source: 'address',
        p_address: '57 Prospect St',
        p_city: 'Rutland',
        p_state: 'VT',
        p_zip_code: '05701',
        p_lat: 43.6043,
        p_lng: -72.9757,
      },
    })
  })

  it('keep (edit) sends no location argument at all', () => {
    expect(resolveLocation({ source: 'keep' }, false)).toEqual({ ok: true, args: {} })
  })
})

function draft(over: Partial<CreateEventDraft> = {}): CreateEventDraft {
  return {
    orgId: 'org-1',
    title: '  Food distribution ',
    eventType: 'distribution',
    description: '',
    locationName: '',
    timeZone: 'America/New_York',
    time: { date: '2026-11-10', start: '10:00', endDate: '2026-11-10', end: '11:30' },
    location: { source: 'org' },
    ...over,
  }
}

describe('create arguments', () => {
  it('one call carries the event, its first date as venue wall clock, the zone and the key', () => {
    const r = buildCreateArgs(draft(), 'k-1', true)
    expect(r).toEqual({
      ok: true,
      args: {
        p_org_id: 'org-1',
        p_idempotency_key: 'k-1',
        p_title: 'Food distribution',
        p_event_type: 'distribution',
        p_description: undefined,
        p_location_name: undefined,
        p_time_zone: 'America/New_York',
        p_starts_local: '2026-11-10T10:00',
        p_ends_local: '2026-11-10T11:30',
        p_location_source: 'org',
      },
    })
  })

  it('refuses before any request: no title, no org, end before start, org without a pin', () => {
    const r = buildCreateArgs(
      draft({ title: '', orgId: '', time: { date: '2026-11-10', start: '11:00', endDate: '2026-11-10', end: '10:00' } }),
      'k',
      false,
    )
    expect(r).toEqual({
      ok: false,
      errors: {
        title: { key: 'errTitleRequired' },
        org: { key: 'errOrgRequired' },
        end: { key: 'errEndBeforeStart' },
        location: { key: 'errOrgNoPin' },
      },
    })
  })
})

describe('time validation (venue zone)', () => {
  it('names the skipped and the repeated time next to the field', () => {
    expect(validateTime({ date: '2026-03-08', start: '02:30', endDate: '2026-03-08', end: '04:00' }, 'America/New_York')).toEqual({
      start: { key: 'errTimeGap', vars: { time: '02:30' } },
    })
    expect(validateTime({ date: '2026-11-01', start: '00:30', endDate: '2026-11-01', end: '01:15' }, 'America/New_York')).toEqual({
      end: { key: 'errTimeRepeat', vars: { time: '01:15' } },
    })
  })

  it('missing parts are required', () => {
    expect(validateTime({ date: '', start: '', endDate: '', end: '' }, 'America/New_York')).toEqual({
      date: { key: 'errDateRequired' },
      start: { key: 'errStartRequired' },
      endDate: { key: 'errDateRequired' },
      end: { key: 'errEndRequired' },
    })
  })

  it('add-dates rows are validated one by one', () => {
    const rows = [
      { date: '2026-11-10', start: '10:00', endDate: '2026-11-10', end: '11:00' },
      { date: '2026-11-11', start: '12:00', endDate: '2026-11-11', end: '12:00' },
    ]
    expect(validateDateRows(rows, 'America/New_York')).toEqual({ 1: { end: { key: 'errEndBeforeStart' } } })
  })

  it('a server time error is placed on the row and field it names', () => {
    const rows = [
      { date: '2026-03-01', start: '10:00', endDate: '2026-03-01', end: '11:00' },
      { date: '2026-03-08', start: '01:00', endDate: '2026-03-08', end: '02:30' },
    ]
    expect(locateTimeError('2026-03-08 02:30', rows, 'start')).toEqual({ row: 1, field: 'end' })
    expect(locateTimeError('2026-03-08 01:00', rows, 'start')).toEqual({ row: 1, field: 'start' })
    expect(locateTimeError(null, rows, 'start')).toEqual({ row: 0, field: 'start' })
  })
})

describe('edit arguments', () => {
  it('no rrule, no geocode tier, no time zone; blanked text fields are cleared', () => {
    const r = buildUpdateArgs(
      { eventId: 'e-1', title: 'Meal', eventType: 'meal', description: '', locationName: '', location: { source: 'keep' } },
      true,
    )
    expect(r).toEqual({
      ok: true,
      args: {
        p_event_id: 'e-1',
        p_title: 'Meal',
        p_event_type: 'meal',
        p_description: undefined,
        p_location_name: undefined,
        p_clear: ['description', 'location_name'],
      },
    })
  })
})

describe('overnight events — an end date after the start date', () => {
  it('8 PM – 2 AM next day is valid and sends the end on the next date', () => {
    const time = { date: '2026-11-10', start: '20:00', endDate: '2026-11-11', end: '02:00' }
    expect(validateTime(time, 'America/New_York')).toEqual({})
    const r = buildCreateArgs(draft({ time }), 'k', true)
    expect(r.ok && [r.args.p_starts_local, r.args.p_ends_local]).toEqual(['2026-11-10T20:00', '2026-11-11T02:00'])
    expect(toLocalDates([time])).toEqual([{ startsLocal: '2026-11-10T20:00', endsLocal: '2026-11-11T02:00' }])
  })

  it('the same times on ONE date are still refused as end-before-start', () => {
    expect(validateTime(sameDayTime('2026-11-10', '20:00', '02:00'), 'America/New_York')).toEqual({
      end: { key: 'errEndBeforeStart' },
    })
  })

  it('DST night in New York (2026-10-31 → 2026-11-01): ending at 02:00 is valid; 01:30 repeats', () => {
    expect(validateTime({ date: '2026-10-31', start: '20:00', endDate: '2026-11-01', end: '02:00' }, 'America/New_York')).toEqual({})
    expect(validateTime({ date: '2026-10-31', start: '20:00', endDate: '2026-11-01', end: '01:30' }, 'America/New_York')).toEqual({
      end: { key: 'errTimeRepeat', vars: { time: '01:30' } },
    })
  })

  it('an end date before the start date is refused', () => {
    expect(validateTime({ date: '2026-11-10', start: '20:00', endDate: '2026-11-09', end: '23:00' }, 'America/New_York')).toEqual({
      end: { key: 'errEndBeforeStart' },
    })
  })

  it('the end date follows the start date until the admin sets it', () => {
    const t = sameDayTime('2026-11-10', '20:00', '22:00')
    expect(withStartDate(t, '2026-11-12').endDate).toBe('2026-11-12')
    const overnight = { ...t, endDate: '2026-11-11' }
    expect(withStartDate(overnight, '2026-11-12').endDate).toBe('2026-11-11')
  })

  it('an error naming an overnight row’s end is placed on that row’s end field', () => {
    const rows = [
      sameDayTime('2026-11-07', '10:00', '11:00'),
      { date: '2026-10-31', start: '20:00', endDate: '2026-11-01', end: '01:30' },
    ]
    expect(locateTimeError('2026-11-01 01:30', rows, 'start')).toEqual({ row: 1, field: 'end' })
  })

  it('"cancelled date has check-ins" names a row’s start -> that row’s Start field; no match -> row 1', () => {
    const rows = [sameDayTime('2026-11-07', '10:00', '11:00'), sameDayTime('2026-11-14', '10:00', '11:00')]
    expect(locateTimeError('2026-11-14 10:00', rows, 'start')).toEqual({ row: 1, field: 'start' })
    expect(locateTimeError('2026-12-01 10:00', rows, 'start')).toEqual({ row: 0, field: 'start' })
  })
})
