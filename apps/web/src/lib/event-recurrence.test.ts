// apps/web/src/lib/event-recurrence.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The repeat rule as the admin form builds it and the database stores it. The validator cases
// are the same 36 the database prototype ran through event_recurrence_problem (recur-r2
// 01_rule_representation): every rule the client accepts the server accepts, and the reverse.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import type { Json } from '@feed/database'
import { eventFormT } from './i18n-event-forms'
import {
  addMonthsClamped,
  announceFromDate,
  ANNOUNCE_LEAD_KEYS,
  ANNOUNCE_LEAD_PRESETS,
  DEFAULT_ANNOUNCE_LEAD,
  defaultRecurrenceForm,
  isoWeekday,
  monthlyChoices,
  monthlyPatternKey,
  parseRecurrenceRule,
  recurrenceFormFromRule,
  recurrenceLabels,
  recurrenceProblem,
  recurrenceRuleFromForm,
  ruleMatchesDate,
  sixMonthsFrom,
  startDateFitsRule,
  weekdayFromIso,
  weekdayOfDate,
  withRecurrenceStartDate,
  WEEK_START,
  WEEKDAY_DISPLAY_ORDER,
  WEEKLY_INTERVAL_KEYS,
  type RecurrenceFormState,
  type RecurrenceRule,
} from './event-recurrence'

// 2026-10-10 is a Saturday (the 2nd Saturday of October 2026); 2026-10-31 is the 5th and last.
const SAT = '2026-10-10'

describe('validator parity with event_recurrence_problem (database prototype cases)', () => {
  const ok: Array<[string, string]> = [
    ['weekly Tue+Thu every 2 wks', '{"@type":"RecurrenceRule","frequency":"weekly","interval":2,"byDay":[{"day":"tu"},{"day":"th"}]}'],
    ['monthly 2nd+4th Sat', '{"frequency":"monthly","byDay":[{"@type":"NDay","day":"sa","nthOfPeriod":2},{"day":"sa","nthOfPeriod":4}]}'],
    ['monthly 1st Sat + 3rd Sun', '{"frequency":"monthly","byDay":[{"day":"sa","nthOfPeriod":1},{"day":"su","nthOfPeriod":3}]}'],
    ['monthly last Fri, count 5', '{"frequency":"monthly","byDay":[{"day":"fr","nthOfPeriod":-1}],"count":5}'],
    ['monthly day 31 until', '{"frequency":"monthly","byMonthDay":[31],"until":"2027-04-30T23:59:59","skip":"omit"}'],
  ]
  it.each(ok)('accepts: %s', (_label, json) => {
    expect(recurrenceProblem(JSON.parse(json))).toBeNull()
    expect(parseRecurrenceRule(JSON.parse(json))).not.toBeNull()
  })

  const bad: Array<[string, string, string]> = [
    ['not an object', '[1,2]', 'not_object'],
    ['unknown property', '{"frequency":"weekly","byDay":[{"day":"mo"}],"byHour":[9]}', 'unknown_property'],
    ['daily frequency', '{"frequency":"daily"}', 'bad_frequency'],
    ['frequency as number', '{"frequency":7,"byDay":[{"day":"mo"}]}', 'bad_frequency'],
    ['weekly interval 5', '{"frequency":"weekly","interval":5,"byDay":[{"day":"mo"}]}', 'weekly_interval_range'],
    ['interval 1.5', '{"frequency":"weekly","interval":1.5,"byDay":[{"day":"mo"}]}', 'bad_interval'],
    ['monthly interval 2', '{"frequency":"monthly","interval":2,"byMonthDay":[1]}', 'monthly_interval'],
    ['weekly no byDay', '{"frequency":"weekly"}', 'weekly_needs_day'],
    ['weekly empty byDay', '{"frequency":"weekly","byDay":[]}', 'bad_by_day'],
    ['weekly with byMonthDay', '{"frequency":"weekly","byDay":[{"day":"mo"}],"byMonthDay":[1]}', 'weekly_month_day'],
    ['weekly with nthOfPeriod', '{"frequency":"weekly","byDay":[{"day":"mo","nthOfPeriod":1}]}', 'weekly_nth'],
    ['day name "monday"', '{"frequency":"weekly","byDay":[{"day":"monday"}]}', 'bad_day'],
    ['duplicate day', '{"frequency":"weekly","byDay":[{"day":"mo"},{"day":"mo"}]}', 'duplicate_day'],
    ['monthly both byDay+byMonthDay', '{"frequency":"monthly","byDay":[{"day":"sa","nthOfPeriod":1}],"byMonthDay":[1]}', 'monthly_needs_one_pattern'],
    ['monthly neither', '{"frequency":"monthly"}', 'monthly_needs_one_pattern'],
    ['monthly byDay without nth', '{"frequency":"monthly","byDay":[{"day":"sa"}]}', 'monthly_needs_nth'],
    ['nthOfPeriod 5', '{"frequency":"monthly","byDay":[{"day":"sa","nthOfPeriod":5}]}', 'monthly_needs_nth'],
    ['nthOfPeriod 0', '{"frequency":"monthly","byDay":[{"day":"sa","nthOfPeriod":0}]}', 'monthly_needs_nth'],
    ['byMonthDay 0', '{"frequency":"monthly","byMonthDay":[0]}', 'bad_month_day'],
    ['byMonthDay 32', '{"frequency":"monthly","byMonthDay":[32]}', 'bad_month_day'],
    ['byMonthDay -1', '{"frequency":"monthly","byMonthDay":[-1]}', 'bad_month_day'],
    ['byMonthDay "15"', '{"frequency":"monthly","byMonthDay":["15"]}', 'bad_month_day'],
    ['byMonthDay duplicate', '{"frequency":"monthly","byMonthDay":[15,15]}', 'duplicate_month_day'],
    ['until AND count', '{"frequency":"weekly","byDay":[{"day":"mo"}],"until":"2027-01-01T00:00:00","count":3}', 'until_and_count'],
    ['until date only', '{"frequency":"weekly","byDay":[{"day":"mo"}],"until":"2027-01-01"}', 'bad_until'],
    ['until Feb 30', '{"frequency":"weekly","byDay":[{"day":"mo"}],"until":"2027-02-30T00:00:00"}', 'bad_until'],
    ['until 24:00:00', '{"frequency":"weekly","byDay":[{"day":"mo"}],"until":"2027-02-01T24:00:00"}', 'bad_until'],
    ['count 0', '{"frequency":"weekly","byDay":[{"day":"mo"}],"count":0}', 'bad_count'],
    ['count "5"', '{"frequency":"weekly","byDay":[{"day":"mo"}],"count":"5"}', 'bad_count'],
    ['count 1001 (contract: 1..1000)', '{"frequency":"weekly","byDay":[{"day":"mo"}],"count":1001}', 'bad_count'],
    ['skip forward', '{"frequency":"monthly","byMonthDay":[31],"skip":"forward"}', 'bad_skip'],
    ['@type Event', '{"@type":"Event","frequency":"weekly","byDay":[{"day":"mo"}]}', 'bad_type_marker'],
  ]
  it.each(bad)('rejects: %s', (_label, json, problem) => {
    expect(recurrenceProblem(JSON.parse(json))).toBe(problem)
    expect(parseRecurrenceRule(JSON.parse(json))).toBeNull()
  })

  it('count 1000 is the most a series may have', () => {
    expect(recurrenceProblem({ frequency: 'weekly', byDay: [{ day: 'mo' }], count: 1000 })).toBeNull()
  })

  it('first-date checks (event_recurrence_problem(rule, series_start))', () => {
    const sat: RecurrenceRule = { frequency: 'weekly', byDay: [{ day: 'sa' }] }
    expect(recurrenceProblem(sat, '2026-10-10T10:00')).toBeNull()
    expect(recurrenceProblem({ frequency: 'weekly', byDay: [{ day: 'su' }] }, '2026-10-10T10:00')).toBe('first_date_not_in_pattern')
    expect(recurrenceProblem({ ...sat, until: '2026-10-10T09:59:59' }, '2026-10-10T10:00')).toBe('ends_before_first_date')
    expect(recurrenceProblem({ ...sat, until: '2026-10-10T23:59:59' }, '2026-10-10T10:00')).toBeNull()
    expect(recurrenceProblem({ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 1 }] }, '2026-10-10T10:00')).toBe(
      'first_date_not_in_pattern',
    )
  })

  it('no rule is valid and parses to null; markers and skip are dropped from a parsed rule', () => {
    expect(recurrenceProblem(null)).toBeNull()
    expect(parseRecurrenceRule(null)).toBeNull()
    expect(parseRecurrenceRule(JSON.parse(ok[0][1]))).toEqual({
      frequency: 'weekly',
      interval: 2,
      byDay: [{ day: 'tu' }, { day: 'th' }],
    })
    expect(parseRecurrenceRule(JSON.parse(ok[4][1]))).toEqual({
      frequency: 'monthly',
      byMonthDay: [31],
      until: '2027-04-30T23:59:59',
    })
  })

  it('a parsed rule is a valid p_recurrence Json argument', () => {
    const rule = parseRecurrenceRule(JSON.parse(ok[1][1])) as RecurrenceRule
    const arg: Json = rule // compile-time: rule types are assignable to the generated Json type
    expect(JSON.parse(JSON.stringify(arg))).toEqual(rule)
  })
})

describe('weekdays', () => {
  it('ISO 1..7 <-> mo..su', () => {
    expect(isoWeekday('mo')).toBe(1)
    expect(isoWeekday('su')).toBe(7)
    expect(weekdayFromIso(6)).toBe('sa')
  })
  it('Sunday-first display order shared with the scheduler (date-fns weekStartsOn 0)', () => {
    expect(WEEK_START).toBe(0)
    expect(WEEKDAY_DISPLAY_ORDER).toEqual(['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'])
  })
  it('weekday of a calendar date, independent of the device zone', () => {
    expect(weekdayOfDate(SAT)).toBe('sa')
    expect(weekdayOfDate('2026-10-05')).toBe('mo')
    expect(weekdayOfDate('2028-02-29')).toBe('tu')
    expect(weekdayOfDate('1969-12-31')).toBe('we')
  })
})

describe('sixMonthsFrom — default series end, month-end clamp', () => {
  it('same day six months later', () => expect(sixMonthsFrom(SAT)).toBe('2027-04-10'))
  it('Aug 31 clamps to the last day of February', () => {
    expect(sixMonthsFrom('2026-08-31')).toBe('2027-02-28')
    expect(sixMonthsFrom('2027-08-31')).toBe('2028-02-29')
  })
  it('crosses the year and keeps a day the month has', () => {
    expect(sixMonthsFrom('2026-12-31')).toBe('2027-06-30')
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
  })
})

describe('monthlyChoices — Google-style, from the start date', () => {
  const labels = (d: string) => monthlyChoices(d).map((c) => c.key)
  it('2nd Saturday: day 10 or the 2nd Saturday (not the last)', () => {
    expect(labels(SAT)).toEqual(['md:10', 'nd:2sa'])
  })
  it('the 4th Saturday that is also the last: all three', () => {
    // 2026-11-28 is the 4th and last Saturday of November 2026.
    expect(labels('2026-11-28')).toEqual(['md:28', 'nd:4sa', 'nd:-1sa'])
  })
  it('a 5th weekday offers "last" only (there is no 5th)', () => {
    expect(labels('2026-10-31')).toEqual(['md:31', 'nd:-1sa'])
  })
  it('the 4th Saturday of a month with five offers no "last"', () => {
    expect(labels('2026-10-24')).toEqual(['md:24', 'nd:4sa'])
  })
  it('a stored pattern that is none of the choices is kept as an extra choice', () => {
    const current = { kind: 'weekday' as const, days: [{ day: 'sa' as const, nthOfPeriod: 2 as const }, { day: 'sa' as const, nthOfPeriod: 4 as const }] }
    expect(monthlyChoices(SAT, current).map((c) => c.key)).toEqual(['md:10', 'nd:2sa', 'nd:2sa+4sa'])
    expect(monthlyChoices(SAT, { kind: 'monthday', days: [10] })).toHaveLength(2)
  })
})

describe('ruleMatchesDate / startDateFitsRule — same dates as event_rule_dates', () => {
  const tuThEvery2: RecurrenceRule = { frequency: 'weekly', interval: 2, byDay: [{ day: 'tu' }, { day: 'th' }] }
  it('every 2 weeks counts Monday–Sunday weeks from the start week', () => {
    // Start Thu 2026-10-08 (week of Mon Oct 5). Tue Oct 6 is before the start; Oct 13/15 are the
    // off week; Oct 20/22 are on.
    expect(ruleMatchesDate(tuThEvery2, '2026-10-08', '2026-10-06')).toBe(false)
    expect(ruleMatchesDate(tuThEvery2, '2026-10-08', '2026-10-08')).toBe(true)
    expect(ruleMatchesDate(tuThEvery2, '2026-10-08', '2026-10-13')).toBe(false)
    expect(ruleMatchesDate(tuThEvery2, '2026-10-08', '2026-10-20')).toBe(true)
    expect(ruleMatchesDate(tuThEvery2, '2026-10-08', '2026-10-22')).toBe(true)
  })
  it('every 2 weeks on Sunday: a Sunday belongs to the week that began the Monday before', () => {
    const sun2: RecurrenceRule = { frequency: 'weekly', interval: 2, byDay: [{ day: 'su' }] }
    // Start Sat Oct 10 (week Mon Oct 5 – Sun Oct 11): Sun Oct 11 is week 0, Oct 18 week 1, Oct 25 week 2.
    expect(ruleMatchesDate(sun2, SAT, '2026-10-11')).toBe(true)
    expect(ruleMatchesDate(sun2, SAT, '2026-10-18')).toBe(false)
    expect(ruleMatchesDate(sun2, SAT, '2026-10-25')).toBe(true)
  })
  it('monthly last Friday and day 31 (a month without day 31 has no date)', () => {
    const lastFri: RecurrenceRule = { frequency: 'monthly', byDay: [{ day: 'fr', nthOfPeriod: -1 }] }
    expect(ruleMatchesDate(lastFri, SAT, '2026-10-30')).toBe(true)
    expect(ruleMatchesDate(lastFri, SAT, '2026-10-23')).toBe(false)
    const d31: RecurrenceRule = { frequency: 'monthly', byMonthDay: [31] }
    expect(ruleMatchesDate(d31, SAT, '2026-10-31')).toBe(true)
    expect(ruleMatchesDate(d31, SAT, '2026-11-30')).toBe(false)
  })
  it('until is inclusive of the date’s start time', () => {
    const r: RecurrenceRule = { frequency: 'weekly', byDay: [{ day: 'sa' }], until: '2026-10-17T10:00:00' }
    expect(ruleMatchesDate(r, SAT, '2026-10-17', '10:00')).toBe(true)
    expect(ruleMatchesDate(r, SAT, '2026-10-17', '10:30')).toBe(false)
  })
  it('the start date fits, or the series begins on the next date that does', () => {
    expect(startDateFitsRule({ frequency: 'weekly', byDay: [{ day: 'sa' }] }, SAT)).toBe(true)
    expect(startDateFitsRule({ frequency: 'weekly', byDay: [{ day: 'su' }] }, SAT)).toBe(false)
    expect(startDateFitsRule({ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }] }, SAT)).toBe(true)
    expect(startDateFitsRule({ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 1 }] }, SAT)).toBe(false)
  })
})

describe('form state <-> p_recurrence', () => {
  it('a new form: off, weekly on the start weekday, monthly on its day, ends in six months', () => {
    expect(defaultRecurrenceForm(SAT)).toEqual({
      repeat: 'none',
      interval: 1,
      weekdays: ['sa'],
      monthly: { kind: 'monthday', days: [10] },
      end: 'until',
      untilDate: '2027-04-10',
      count: '10',
    })
    expect(recurrenceRuleFromForm(defaultRecurrenceForm(SAT), SAT)).toEqual({ ok: true, rule: null })
  })

  it('weekly: Sunday-first byDay, interval only above 1, until covers the whole last day', () => {
    const form: RecurrenceFormState = { ...defaultRecurrenceForm(SAT), repeat: 'weekly', weekdays: ['sa', 'th', 'tu', 'su'], interval: 2 }
    expect(recurrenceRuleFromForm(form, SAT)).toEqual({
      ok: true,
      rule: {
        frequency: 'weekly',
        interval: 2,
        byDay: [{ day: 'su' }, { day: 'tu' }, { day: 'th' }, { day: 'sa' }],
        until: '2027-04-10T23:59:59',
      },
    })
    const every: RecurrenceFormState = { ...form, interval: 1, weekdays: ['sa'], end: 'never' }
    expect(recurrenceRuleFromForm(every, SAT)).toEqual({ ok: true, rule: { frequency: 'weekly', byDay: [{ day: 'sa' }] } })
  })

  it('monthly by position and by day number; count end', () => {
    const nth: RecurrenceFormState = {
      ...defaultRecurrenceForm(SAT),
      repeat: 'monthly',
      monthly: monthlyChoices(SAT)[1].pattern,
      end: 'count',
      count: ' 12 ',
    }
    expect(recurrenceRuleFromForm(nth, SAT)).toEqual({
      ok: true,
      rule: { frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }], count: 12 },
    })
    const md: RecurrenceFormState = { ...nth, monthly: { kind: 'monthday', days: [15, 10] }, end: 'never' }
    expect(recurrenceRuleFromForm(md, SAT)).toEqual({ ok: true, rule: { frequency: 'monthly', byMonthDay: [10, 15] } })
  })

  it('every rule the form builds passes the server validator', () => {
    for (const repeat of ['weekly', 'monthly'] as const) {
      for (const end of ['until', 'count', 'never'] as const) {
        for (const choice of monthlyChoices('2026-11-28')) {
          const r = recurrenceRuleFromForm(
            { ...defaultRecurrenceForm('2026-11-28'), repeat, end, monthly: choice.pattern, interval: 3, weekdays: ['mo', 'sa'] },
            '2026-11-28',
          )
          expect(r.ok).toBe(true)
          if (r.ok) expect(recurrenceProblem(r.rule, '2026-11-28T10:00')).toBeNull()
        }
      }
    }
  })

  it('names each missing or wrong field', () => {
    const base = defaultRecurrenceForm(SAT)
    const errs = (f: RecurrenceFormState) => {
      const r = recurrenceRuleFromForm(f, SAT)
      return r.ok ? {} : Object.fromEntries(Object.entries(r.errors).map(([k, v]) => [k, v?.key]))
    }
    expect(errs({ ...base, repeat: 'weekly', weekdays: [] })).toEqual({ weekdays: 'errRepeatNoDays' })
    expect(errs({ ...base, repeat: 'weekly', interval: 5 })).toEqual({ interval: 'errRepeatInterval' })
    expect(errs({ ...base, repeat: 'monthly', monthly: { kind: 'monthday', days: [] } })).toEqual({ monthly: 'errRepeatMonthly' })
    expect(errs({ ...base, repeat: 'weekly', untilDate: '' })).toEqual({ until: 'errRepeatUntilRequired' })
    expect(errs({ ...base, repeat: 'weekly', untilDate: '2026-10-09' })).toEqual({ until: 'errRepeatUntilBeforeStart' })
    expect(errs({ ...base, repeat: 'weekly', untilDate: SAT })).toEqual({}) // the start date itself is allowed
    // The first date must be one of the repeating dates (server: event_recurrence_invalid).
    expect(errs({ ...base, repeat: 'weekly', weekdays: ['su', 'tu'] })).toEqual({ pattern: 'errRepeatStartNotInPattern' })
    expect(errs({ ...base, repeat: 'monthly', monthly: { kind: 'monthday', days: [11] } })).toEqual({
      pattern: 'errRepeatStartNotInPattern',
    })
    expect(errs({ ...base, repeat: 'weekly', end: 'count', count: '1000' })).toEqual({})
    for (const count of ['0', '', '1.5', '-3', 'ten', '1001']) {
      expect(errs({ ...base, repeat: 'weekly', end: 'count', count })).toEqual({ count: 'errRepeatCount' })
    }
  })

  it('a stored rule opens in the edit form and saves back unchanged', () => {
    const rules: Array<[RecurrenceRule, string]> = [
      [{ frequency: 'weekly', interval: 2, byDay: [{ day: 'su' }, { day: 'th' }], until: '2027-01-31T23:59:59' }, '2026-10-11'],
      [{ frequency: 'monthly', byDay: [{ day: 'sa', nthOfPeriod: 2 }, { day: 'sa', nthOfPeriod: 4 }], count: 8 }, SAT],
      [{ frequency: 'monthly', byMonthDay: [1, 15] }, '2026-10-15'],
    ]
    for (const [rule, start] of rules) {
      const form = recurrenceFormFromRule(rule, start)
      expect(recurrenceRuleFromForm(form, start)).toEqual({ ok: true, rule })
    }
    expect(recurrenceFormFromRule(null, SAT).repeat).toBe('none')
  })

  it('changing the start date moves the echoed defaults and keeps deliberate choices', () => {
    const fresh = defaultRecurrenceForm(SAT)
    const moved = withRecurrenceStartDate(fresh, SAT, '2026-10-14') // a Wednesday
    expect(moved.weekdays).toEqual(['we'])
    expect(moved.monthly).toEqual({ kind: 'monthday', days: [14] })
    expect(moved.untilDate).toBe('2027-04-14')

    const nth = { ...fresh, monthly: monthlyChoices(SAT)[1].pattern } // 2nd Saturday
    expect(monthlyPatternKey(withRecurrenceStartDate(nth, SAT, '2026-10-21').monthly)).toBe('nd:3we')

    const deliberate = { ...fresh, weekdays: ['tu' as const, 'th' as const], untilDate: '2026-12-31' }
    const kept = withRecurrenceStartDate(deliberate, SAT, '2026-10-14')
    expect(kept.weekdays).toEqual(['tu', 'th'])
    expect(kept.untilDate).toBe('2026-12-31')
  })
})

describe('feed lead and log labels', () => {
  it('presets match the database CHECK; default 7; each has its own label', () => {
    expect([...ANNOUNCE_LEAD_PRESETS]).toEqual([0, 1, 3, 7, 14, 30])
    expect(DEFAULT_ANNOUNCE_LEAD).toBe(7)
    expect(ANNOUNCE_LEAD_PRESETS.map((d) => eventFormT('en', ANNOUNCE_LEAD_KEYS[d]))).toEqual([
      'On the day', '1 day before', '3 days before', '1 week before', '2 weeks before', '30 days before',
    ])
    expect(([1, 2, 3, 4] as const).map((n) => eventFormT('ar', WEEKLY_INTERVAL_KEYS[n]))).toEqual([
      'كل أسبوع', 'كل أسبوعين', 'كل 3 أسابيع', 'كل 4 أسابيع',
    ])
  })
  it('a date shows from midnight venue time N days before', () => {
    expect(announceFromDate(SAT, 7)).toBe('2026-10-03')
    expect(announceFromDate('2026-03-01', 1)).toBe('2026-02-28')
    expect(announceFromDate(SAT, 0)).toBe(SAT)
  })
  it('labels are enums only', () => {
    expect(recurrenceLabels(null)).toEqual({ frequency: 'none', series_end: 'none' })
    expect(recurrenceLabels({ frequency: 'monthly', byMonthDay: [1], count: 3 })).toEqual({ frequency: 'monthly', series_end: 'count' })
    expect(recurrenceLabels({ frequency: 'weekly', byDay: [{ day: 'mo' }] })).toEqual({ frequency: 'weekly', series_end: 'never' })
  })
})
