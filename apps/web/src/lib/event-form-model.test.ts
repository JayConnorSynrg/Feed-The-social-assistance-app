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
  canExtendSeries,
  createSubmitController,
  defaultLocation,
  firstErrorField,
  intervalMinutes,
  isExtraDate,
  locateTimeError,
  resolveLocation,
  sameDayTime,
  sameRule,
  seriesLastDate,
  seriesState,
  seriesTimeFromStored,
  stopsRepeating,
  timeDraftFromInstants,
  toLocalDates,
  withStartDate,
  validateDateRows,
  validateTime,
  type CreateEventDraft,
  type DraftPin,
  type EditEventDraft,
} from './event-form-model'
import { defaultRecurrenceForm, recurrenceFormFromRule, type RecurrenceFormState, type RecurrenceRule } from './event-recurrence'

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
    recurrence: defaultRecurrenceForm('2026-11-10'),
    announce: 7,
    ...over,
  }
}

/** The create form with its repeat section switched on (2026-11-10 is a Tuesday). */
function repeating(over: Partial<RecurrenceFormState>, base = '2026-11-10'): RecurrenceFormState {
  return { ...defaultRecurrenceForm(base), ...over }
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
        p_announce_days_before: 7,
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

const oneOffStored = { rule: null, time: sameDayTime('2026-11-10', '10:00', '11:30'), announce: 7 as const }

function editDraft(over: Partial<EditEventDraft> = {}): EditEventDraft {
  return {
    eventId: 'e-1',
    title: 'Meal',
    eventType: 'meal',
    description: '',
    locationName: '',
    location: { source: 'keep' },
    timeZone: 'America/New_York',
    recurrence: defaultRecurrenceForm('2026-11-10'),
    time: oneOffStored.time,
    announce: 7,
    stored: oneOffStored,
    ...over,
  }
}

describe('edit arguments', () => {
  it('no geocode tier, no time zone, no unchanged series field; blanked text fields are cleared', () => {
    const r = buildUpdateArgs(editDraft(), true)
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

describe('create — repeat and "post to the feed"', () => {
  it('weekly on the start weekday, ending after six months by default: ONE call carries the rule and the lead', () => {
    const r = buildCreateArgs(draft({ recurrence: repeating({ repeat: 'weekly' }), announce: 14 }), 'k-1', true)
    expect(r.ok && r.args.p_recurrence).toEqual({ frequency: 'weekly', byDay: [{ day: 'tu' }], until: '2027-05-10T23:59:59' })
    expect(r.ok && r.args.p_announce_days_before).toBe(14)
    expect(r.ok && [r.args.p_starts_local, r.args.p_ends_local]).toEqual(['2026-11-10T10:00', '2026-11-10T11:30'])
  })

  it('every 2 weeks on Tuesday and Thursday, after 12 dates: days written Sunday-first, interval only above 1', () => {
    const r = buildCreateArgs(
      draft({ recurrence: repeating({ repeat: 'weekly', interval: 2, weekdays: ['th', 'tu'], end: 'count', count: '12' }) }),
      'k',
      true,
    )
    expect(r.ok && r.args.p_recurrence).toEqual({ frequency: 'weekly', interval: 2, byDay: [{ day: 'tu' }, { day: 'th' }], count: 12 })
  })

  it('monthly on the second Tuesday, never ending', () => {
    const r = buildCreateArgs(
      draft({
        recurrence: repeating({ repeat: 'monthly', monthly: { kind: 'weekday', days: [{ day: 'tu', nthOfPeriod: 2 }] }, end: 'never' }),
      }),
      'k',
      true,
    )
    expect(r.ok && r.args.p_recurrence).toEqual({ frequency: 'monthly', byDay: [{ day: 'tu', nthOfPeriod: 2 }] })
  })

  it('a one-off event sends no rule at all (NULL = one date) but still its lead', () => {
    const r = buildCreateArgs(draft({ announce: 0 }), 'k', true)
    expect(r.ok && 'p_recurrence' in r.args).toBe(false)
    expect(r.ok && r.args.p_announce_days_before).toBe(0)
  })

  it('the first date must be one of the pattern’s dates — refused before any request', () => {
    // Tuesday start, Saturday pattern.
    const r = buildCreateArgs(draft({ recurrence: repeating({ repeat: 'weekly', weekdays: ['sa'] }) }), 'k', true)
    expect(r).toEqual({ ok: false, errors: { pattern: { key: 'errRepeatStartNotInPattern' } } })
  })

  it('a repeating date longer than 24 hours is refused on End; a one-off may run longer', () => {
    const time = { date: '2026-11-10', start: '20:00', endDate: '2026-11-11', end: '21:00' }
    expect(buildCreateArgs(draft({ time, recurrence: repeating({ repeat: 'weekly' }) }), 'k', true)).toEqual({
      ok: false,
      errors: { end: { key: 'errRepeatTooLong' } },
    })
    expect(buildCreateArgs(draft({ time }), 'k', true).ok).toBe(true)
  })

  it('a lead outside the presets is refused', () => {
    expect(buildCreateArgs(draft({ announce: 5 }), 'k', true)).toEqual({ ok: false, errors: { lead: { key: 'errLeadPreset' } } })
  })

  it('focus order: the repeat section comes after the times and before the lead and the location', () => {
    expect(firstErrorField({ location: { key: 'errConfirmPin' }, lead: { key: 'errLeadPreset' }, pattern: { key: 'errRepeatStartNotInPattern' } })).toBe('pattern')
    expect(firstErrorField({ weekdays: { key: 'errRepeatNoDays' }, end: { key: 'errRepeatTooLong' } })).toBe('end')
  })
})

describe('edit — only what changed is sent', () => {
  const weeklySat: RecurrenceRule = { frequency: 'weekly', byDay: [{ day: 'sa' }], until: '2027-04-10T23:59:59' }
  const satTime = sameDayTime('2026-10-10', '09:00', '11:00')
  const stored = { rule: weeklySat, time: satTime, announce: 7 as const }
  const series = (over: Partial<EditEventDraft> = {}) =>
    editDraft({ recurrence: recurrenceFormFromRule(weeklySat, '2026-10-10'), time: satTime, stored, ...over })

  it('a repeating event saved untouched sends no rule, no first date and no lead', () => {
    const r = buildUpdateArgs(series(), true)
    expect(r.ok && Object.keys(r.args).filter((k) => /recurrence|series|announce/.test(k))).toEqual([])
    expect(r.ok && r.args.p_clear).toEqual(['description', 'location_name'])
  })

  it('a new lead only: p_announce_days_before alone', () => {
    const r = buildUpdateArgs(series({ announce: 1 }), true)
    expect(r.ok && r.args.p_announce_days_before).toBe(1)
    expect(r.ok && [r.args.p_recurrence, r.args.p_series_starts_local]).toEqual([undefined, undefined])
  })

  it('a new time for every upcoming date: the stored first DATE with the new times, no rule', () => {
    const r = buildUpdateArgs(series({ time: sameDayTime('2026-10-10', '10:30', '12:00') }), true)
    expect(r.ok && [r.args.p_series_starts_local, r.args.p_series_ends_local, r.args.p_recurrence]).toEqual([
      '2026-10-10T10:30',
      '2026-10-10T12:00',
      undefined,
    ])
  })

  it('a new pattern that still includes the first date: p_recurrence only', () => {
    const r = buildUpdateArgs(series({ recurrence: { ...recurrenceFormFromRule(weeklySat, '2026-10-10'), weekdays: ['sa', 'we'] } }), true)
    expect(r.ok && r.args.p_recurrence).toEqual({ frequency: 'weekly', byDay: [{ day: 'we' }, { day: 'sa' }], until: '2027-04-10T23:59:59' })
    expect(r.ok && r.args.p_series_starts_local).toBeUndefined()
  })

  it('a new pattern that leaves out the first date is refused until the first date moves', () => {
    const sunOnly = { ...recurrenceFormFromRule(weeklySat, '2026-10-10'), weekdays: ['su' as const] }
    expect(buildUpdateArgs(series({ recurrence: sunOnly }), true)).toEqual({
      ok: false,
      errors: { pattern: { key: 'errRepeatStartNotInPattern' } },
    })
    const r = buildUpdateArgs(series({ recurrence: sunOnly, time: sameDayTime('2026-10-11', '09:00', '11:00') }), true)
    expect(r.ok && [r.args.p_recurrence, r.args.p_series_starts_local]).toEqual([
      { frequency: 'weekly', byDay: [{ day: 'su' }], until: '2027-04-10T23:59:59' },
      '2026-10-11T09:00',
    ])
  })

  it('a one-off event that starts repeating sends the rule AND its first date', () => {
    const r = buildUpdateArgs(editDraft({ recurrence: repeating({ repeat: 'weekly' }) }), true)
    expect(r.ok && [r.args.p_recurrence, r.args.p_series_starts_local, r.args.p_series_ends_local]).toEqual([
      { frequency: 'weekly', byDay: [{ day: 'tu' }], until: '2027-05-10T23:59:59' },
      '2026-11-10T10:00',
      '2026-11-10T11:30',
    ])
  })

  it('Repeat: does not repeat on a series = stop repeating: p_clear recurrence and nothing else of the series', () => {
    const d = series({ recurrence: { ...recurrenceFormFromRule(weeklySat, '2026-10-10'), repeat: 'none' } })
    expect(stopsRepeating(d)).toBe(true)
    const r = buildUpdateArgs(d, true)
    expect(r.ok && r.args.p_clear).toEqual(['description', 'location_name', 'recurrence'])
    expect(r.ok && [r.args.p_recurrence, r.args.p_series_starts_local]).toEqual([undefined, undefined])
    expect(stopsRepeating(editDraft())).toBe(false)
  })

  it('the same rule written in another order is the same rule', () => {
    expect(sameRule({ frequency: 'weekly', interval: 1, byDay: [{ day: 'sa' }, { day: 'tu' }] }, { frequency: 'weekly', byDay: [{ day: 'tu' }, { day: 'sa' }] })).toBe(true)
    expect(sameRule({ frequency: 'monthly', byMonthDay: [15, 1] }, { frequency: 'monthly', byMonthDay: [1, 15] })).toBe(true)
    expect(sameRule(weeklySat, { ...weeklySat, until: '2027-04-11T23:59:59' })).toBe(false)
  })
})

describe('stored series -> form', () => {
  it('reads the PostgREST interval text of series_duration', () => {
    expect(intervalMinutes('01:30:00')).toBe(90)
    expect(intervalMinutes('1 day')).toBe(1440)
    expect(intervalMinutes('06:00:00')).toBe(360)
    expect(intervalMinutes('PT1H')).toBeNull()
    expect(intervalMinutes(null)).toBeNull()
  })

  it('first date + times from series_start_local and the length (overnight rolls to the next day)', () => {
    expect(seriesTimeFromStored('2026-10-10T09:00:00', '02:00:00')).toEqual(sameDayTime('2026-10-10', '09:00', '11:00'))
    expect(seriesTimeFromStored('2026-10-10T20:00:00', '06:00:00')).toEqual({ date: '2026-10-10', start: '20:00', endDate: '2026-10-11', end: '02:00' })
  })

  it('a one-off event’s next date on the VENUE clock (viewer zone does not matter)', () => {
    expect(timeDraftFromInstants('2026-11-10T15:00:00Z', '2026-11-10T16:30:00Z', 'America/New_York')).toEqual(
      sameDayTime('2026-11-10', '10:00', '11:30'),
    )
  })
})

describe('series display', () => {
  const sat: RecurrenceRule = { frequency: 'weekly', byDay: [{ day: 'sa' }], until: '2026-11-03T23:59:59' }

  it('the last date of an until series is the last pattern date on or before until; of a count series the count-th', () => {
    expect(seriesLastDate(sat, '2026-10-10', '09:00')).toBe('2026-10-31')
    expect(seriesLastDate({ frequency: 'weekly', byDay: [{ day: 'sa' }], count: 3 }, '2026-10-10')).toBe('2026-10-24')
    expect(seriesLastDate({ frequency: 'monthly', byMonthDay: [31], count: 2 }, '2026-10-31')).toBe('2026-12-31')
    expect(seriesLastDate({ frequency: 'weekly', byDay: [{ day: 'sa' }] }, '2026-10-10')).toBeNull()
  })

  it('ending soon within 30 days, ended once the last date passed, never for an open series', () => {
    expect(seriesState(sat, '2026-10-10T09:00:00', '2026-10-07')).toMatchObject({ kind: 'ends', lastDate: '2026-10-31', endingSoon: true, ended: false })
    expect(seriesState(sat, '2026-10-10T09:00:00', '2026-09-01')).toMatchObject({ kind: 'ends', endingSoon: false, ended: false })
    expect(seriesState(sat, '2026-10-10T09:00:00', '2026-11-01')).toMatchObject({ kind: 'ends', ended: true })
    expect(seriesState({ frequency: 'weekly', byDay: [{ day: 'sa' }] }, '2026-10-10T09:00:00', '2026-10-07')).toMatchObject({ kind: 'never' })
    expect(seriesState(null, null, '2026-10-07')).toEqual({ kind: 'none' })
  })

  it('"Repeat for 6 more months" only on an ACTIVE series that ENDS', () => {
    expect(canExtendSeries({ is_active: true, recurrence: sat })).toBe(true)
    expect(canExtendSeries({ is_active: false, recurrence: sat })).toBe(false)
    expect(canExtendSeries({ is_active: true, recurrence: { frequency: 'weekly', byDay: [{ day: 'sa' }] } })).toBe(false)
    expect(canExtendSeries({ is_active: true, recurrence: null })).toBe(false)
  })

  it('"Extra date": a hand-added date off the pattern (or at another time); never a rule date or a one-off date', () => {
    const ev = { recurrence: sat, series_start_local: '2026-10-10T09:00:00', time_zone: 'America/New_York' }
    // Wed Oct 14 09:00 EDT, added by hand.
    expect(isExtraDate({ source: 'manual', starts_at: '2026-10-14T13:00:00Z' }, ev)).toBe(true)
    // Sat Oct 17 at the series time, added by hand: on the pattern.
    expect(isExtraDate({ source: 'manual', starts_at: '2026-10-17T13:00:00Z' }, ev)).toBe(false)
    // Sat Oct 17 at 18:00: same day, another time.
    expect(isExtraDate({ source: 'manual', starts_at: '2026-10-17T22:00:00Z' }, ev)).toBe(true)
    expect(isExtraDate({ source: 'rule', starts_at: '2026-10-14T13:00:00Z' }, ev)).toBe(false)
    expect(isExtraDate({ source: 'manual', starts_at: '2026-10-14T13:00:00Z' }, { ...ev, recurrence: null })).toBe(false)
  })
})
