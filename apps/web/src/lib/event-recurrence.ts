// apps/web/src/lib/event-recurrence.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The repeat rule of an organization event, client side. Pure: no React, no network, no clock.
//
// Wire shape = assistance_events.recurrence, an RFC 8984 (JSCalendar) RecurrenceRule subset that
// the database validates with event_recurrence_problem(jsonb) (CHECK + every writer RPC):
//   { frequency: 'weekly' | 'monthly',
//     interval?: 1..4                      (weekly only; monthly is every month),
//     byDay?: [{ day: 'mo'..'su', nthOfPeriod?: 1 | 2 | 3 | 4 | -1 }]
//                                          (weekly: no nthOfPeriod; monthly: nthOfPeriod required),
//     byMonthDay?: [1..31]                 (monthly only; a month without that day is skipped),
//     until?: 'YYYY-MM-DDTHH:MM:SS'        (venue-local, inclusive) | count?: 1..1000  (not both) }
// and, given the series' first date, that date must itself be one of the rule's dates and must
// not be after `until` (event_recurrence_problem(rule, series_start); RPC contract of migration
// 20261023000000_events_recurring_announce).
// The database also accepts "@type" markers and skip: 'omit'; parseRecurrenceRule accepts them
// and returns the rule without them, and the form never writes them.
//
// Weekdays travel as 'mo'..'su' (ISO 1 = Monday .. 7 = Sunday). They are SHOWN Sunday-first in
// every locale (WEEKDAY_DISPLAY_ORDER, WEEK_START), the same week the scheduler calendar uses.
// Calendar dates are 'YYYY-MM-DD' strings and all date math is done in UTC on those strings, so
// the result never depends on the device's time zone.

import type { FieldError } from './event-form-model'
import type { EventFormMessages } from './i18n-event-forms'

// ---------------------------------------------------------------------------------------------
// Weekdays
// ---------------------------------------------------------------------------------------------

/** Wire codes in ISO order: index + 1 = ISO weekday (1 = Monday .. 7 = Sunday). */
export const WEEKDAY_CODES = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const
export type WeekdayCode = (typeof WEEKDAY_CODES)[number]
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** First day of the displayed week, as date-fns `weekStartsOn` (0 = Sunday). */
export const WEEK_START = 0 as const

/** Weekday checkboxes and weekday lists, Sunday-first, in every locale. */
export const WEEKDAY_DISPLAY_ORDER: readonly WeekdayCode[] = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']

export function isoWeekday(code: WeekdayCode): IsoWeekday {
  return (WEEKDAY_CODES.indexOf(code) + 1) as IsoWeekday
}

export function weekdayFromIso(iso: IsoWeekday): WeekdayCode {
  return WEEKDAY_CODES[iso - 1]
}

export function isWeekdayCode(v: unknown): v is WeekdayCode {
  return typeof v === 'string' && (WEEKDAY_CODES as readonly string[]).includes(v)
}

// ---------------------------------------------------------------------------------------------
// Calendar dates ('YYYY-MM-DD'), UTC arithmetic only
// ---------------------------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** Epoch-day number of a real calendar date, or null for a malformed / impossible one. */
function dayNumber(date: string): number | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const ms = Date.UTC(y, mo - 1, d)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null
  return Math.round(ms / DAY_MS)
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

export function isCalendarDate(date: string): boolean {
  return dayNumber(date) !== null
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

/** The weekday of a calendar date. Throws on a malformed date (callers validate first). */
export function weekdayOfDate(date: string): WeekdayCode {
  const n = dayNumber(date)
  if (n === null) throw new RangeError(`not a calendar date: ${date}`)
  // Epoch day 0 (1970-01-01) was a Thursday (ISO 4).
  const iso = ((((n + 3) % 7) + 7) % 7) + 1
  return weekdayFromIso(iso as IsoWeekday)
}

/** `months` calendar months after `date`; a day the target month lacks clamps to its last day
 *  (Aug 31 + 6 months = Feb 28/29), the same as Postgres date + interval 'N months'. */
export function addMonthsClamped(date: string, months: number): string {
  const m = DATE_RE.exec(date)
  if (!m || dayNumber(date) === null) throw new RangeError(`not a calendar date: ${date}`)
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + months
  const y = Math.floor(total / 12)
  const mo = (total % 12) + 1
  const d = Math.min(Number(m[3]), daysInMonth(y, mo))
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Default series end: six months after the start date (month-end clamp). */
export function sixMonthsFrom(date: string): string {
  return addMonthsClamped(date, 6)
}

/** The rule's `until` for a last calendar date: the whole day is included. */
export function untilFromDate(date: string): string {
  return `${date}T23:59:59`
}

// ---------------------------------------------------------------------------------------------
// Rule type
// ---------------------------------------------------------------------------------------------

export type NthOfPeriod = 1 | 2 | 3 | 4 | -1
export const NTH_OF_PERIOD: readonly NthOfPeriod[] = [1, 2, 3, 4, -1]

// Object type aliases (not interfaces) so a rule is assignable to the generated `Json` type of
// the p_recurrence RPC argument.
export type RuleEnd = { until?: string; count?: number }
export type WeeklyRule = RuleEnd & {
  frequency: 'weekly'
  /** 2..4; absent = every week. */
  interval?: number
  byDay: Array<{ day: WeekdayCode }>
}
export type MonthlyWeekdayRule = RuleEnd & {
  frequency: 'monthly'
  byDay: Array<{ day: WeekdayCode; nthOfPeriod: NthOfPeriod }>
}
export type MonthlyDayRule = RuleEnd & {
  frequency: 'monthly'
  byMonthDay: number[]
}
export type RecurrenceRule = WeeklyRule | MonthlyWeekdayRule | MonthlyDayRule

export function isMonthlyDayRule(rule: RecurrenceRule): rule is MonthlyDayRule {
  return rule.frequency === 'monthly' && 'byMonthDay' in rule
}

// ---------------------------------------------------------------------------------------------
// Parse / validate — mirrors public.event_recurrence_problem(jsonb)
// ---------------------------------------------------------------------------------------------

export type RecurrenceProblem =
  | 'not_object'
  | 'unknown_property'
  | 'bad_type_marker'
  | 'bad_frequency'
  | 'bad_interval'
  | 'weekly_interval_range'
  | 'monthly_interval'
  | 'bad_skip'
  | 'until_and_count'
  | 'bad_count'
  | 'bad_until'
  | 'weekly_month_day'
  | 'weekly_needs_day'
  | 'monthly_needs_one_pattern'
  | 'bad_by_day'
  | 'bad_day'
  | 'weekly_nth'
  | 'monthly_needs_nth'
  | 'duplicate_day'
  | 'bad_month_day'
  | 'duplicate_month_day'
  | 'ends_before_first_date'
  | 'first_date_not_in_pattern'

const RULE_KEYS = new Set(['@type', 'frequency', 'interval', 'byDay', 'byMonthDay', 'until', 'count', 'skip'])
const NDAY_KEYS = new Set(['@type', 'day', 'nthOfPeriod'])
const UNTIL_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isWholeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

function untilIsReal(until: string): boolean {
  const m = UNTIL_RE.exec(until)
  if (!m || dayNumber(m[1]) === null) return false
  return Number(m[2]) <= 23 && Number(m[3]) <= 59 && Number(m[4]) <= 59
}

/**
 * Why a stored or built rule is not one the database accepts; null when it is valid. `null` /
 * `undefined` input (no rule) is valid. Same checks, in the same order, as
 * event_recurrence_problem(p_rule, p_series_start). `firstStart` ('YYYY-MM-DDTHH:MM', the first
 * date's venue-local start) adds the two first-date checks.
 */
export function recurrenceProblem(value: unknown, firstStart?: string): RecurrenceProblem | null {
  if (value === null || value === undefined) return null
  if (!isPlainObject(value)) return 'not_object'
  for (const k of Object.keys(value)) if (!RULE_KEYS.has(k)) return 'unknown_property'
  if ('@type' in value && value['@type'] !== 'RecurrenceRule') return 'bad_type_marker'
  const freq = value.frequency
  if (freq !== 'weekly' && freq !== 'monthly') return 'bad_frequency'
  let interval = 1
  if ('interval' in value) {
    if (!isWholeNumber(value.interval) || value.interval < 0 || value.interval > 99) return 'bad_interval'
    interval = value.interval
  }
  if (freq === 'weekly' && (interval < 1 || interval > 4)) return 'weekly_interval_range'
  if (freq === 'monthly' && interval !== 1) return 'monthly_interval'
  if ('skip' in value && value.skip !== 'omit') return 'bad_skip'
  if ('until' in value && 'count' in value) return 'until_and_count'
  if ('count' in value && (!isWholeNumber(value.count) || value.count < 1 || value.count > 1000)) {
    return 'bad_count'
  }
  if ('until' in value && (typeof value.until !== 'string' || !untilIsReal(value.until))) return 'bad_until'
  if (freq === 'weekly') {
    if ('byMonthDay' in value) return 'weekly_month_day'
    if (!('byDay' in value)) return 'weekly_needs_day'
  } else if (('byDay' in value) === ('byMonthDay' in value)) {
    return 'monthly_needs_one_pattern'
  }
  if ('byDay' in value) {
    const list = value.byDay
    if (!Array.isArray(list) || list.length === 0) return 'bad_by_day'
    const seen = new Set<string>()
    for (const entry of list) {
      if (!isPlainObject(entry)) return 'bad_by_day'
      for (const k of Object.keys(entry)) if (!NDAY_KEYS.has(k)) return 'bad_by_day'
      if ('@type' in entry && entry['@type'] !== 'NDay') return 'bad_by_day'
      if (!isWeekdayCode(entry.day)) return 'bad_day'
      if (freq === 'weekly' && 'nthOfPeriod' in entry) return 'weekly_nth'
      if (freq === 'monthly' && !(NTH_OF_PERIOD as readonly unknown[]).includes(entry.nthOfPeriod)) {
        return 'monthly_needs_nth'
      }
      const key = `${entry.day}:${'nthOfPeriod' in entry ? String(entry.nthOfPeriod) : ''}`
      if (seen.has(key)) return 'duplicate_day'
      seen.add(key)
    }
  }
  if ('byMonthDay' in value) {
    const list = value.byMonthDay
    if (!Array.isArray(list) || list.length === 0) return 'bad_month_day'
    if (list.some((d) => !isWholeNumber(d) || d < 1 || d > 31)) return 'bad_month_day'
    if (new Set(list).size !== list.length) return 'duplicate_month_day'
  }
  if (firstStart !== undefined) {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(firstStart)
    if (!m || dayNumber(m[1]) === null) return 'first_date_not_in_pattern'
    const rule = parseRecurrenceRule(value) as RecurrenceRule
    if (rule.until !== undefined && rule.until < `${m[1]}T${m[2]}:00`) return 'ends_before_first_date'
    if (!startDateFitsRule(rule, m[1], m[2])) return 'first_date_not_in_pattern'
  }
  return null
}

/** A valid rule (markers and skip dropped), or null when `value` is absent or invalid. */
export function parseRecurrenceRule(value: unknown): RecurrenceRule | null {
  if (value === null || value === undefined || recurrenceProblem(value) !== null) return null
  const v = value as Record<string, unknown>
  const end: RuleEnd = {}
  if (typeof v.until === 'string') end.until = v.until
  if (typeof v.count === 'number') end.count = v.count
  if (v.frequency === 'weekly') {
    const interval = typeof v.interval === 'number' ? v.interval : 1
    return {
      frequency: 'weekly',
      ...(interval > 1 ? { interval } : {}),
      byDay: (v.byDay as Array<{ day: WeekdayCode }>).map((e) => ({ day: e.day })),
      ...end,
    }
  }
  if (Array.isArray(v.byMonthDay)) {
    return { frequency: 'monthly', byMonthDay: [...(v.byMonthDay as number[])], ...end }
  }
  return {
    frequency: 'monthly',
    byDay: (v.byDay as Array<{ day: WeekdayCode; nthOfPeriod: NthOfPeriod }>).map((e) => ({
      day: e.day,
      nthOfPeriod: e.nthOfPeriod,
    })),
    ...end,
  }
}

// ---------------------------------------------------------------------------------------------
// Does a date fall on the rule? — mirrors public.event_rule_dates for one date
// ---------------------------------------------------------------------------------------------

/** Position of a date's weekday in its month (1..5) and whether it is the month's last one. */
export function weekdayPosition(date: string): { nth: number; isLast: boolean } {
  const m = DATE_RE.exec(date)
  if (!m || dayNumber(date) === null) throw new RangeError(`not a calendar date: ${date}`)
  const day = Number(m[3])
  return {
    nth: Math.floor((day - 1) / 7) + 1,
    isLast: day + 7 > daysInMonth(Number(m[1]), Number(m[2])),
  }
}

/**
 * True when `date` is one of the rule's dates for a series that starts on `startDate` at
 * `startTime` (venue wall clock, 'HH:MM'). "Every N weeks" counts Monday–Sunday weeks from the
 * week of the start date (as the server does). `until` is inclusive of the date's start time.
 * `count` is not applied (it needs the whole series); a date before the start is never a date.
 */
export function ruleMatchesDate(rule: RecurrenceRule, startDate: string, date: string, startTime = '00:00'): boolean {
  const d = dayNumber(date)
  const d0 = dayNumber(startDate)
  if (d === null || d0 === null || d < d0) return false
  if (rule.until !== undefined && `${date}T${startTime}:00` > rule.until) return false
  const wd = weekdayOfDate(date)
  if (rule.frequency === 'weekly') {
    if (!rule.byDay.some((e) => e.day === wd)) return false
    const mondayOf = (n: number, code: WeekdayCode) => n - (isoWeekday(code) - 1)
    const weeks = (mondayOf(d, wd) - mondayOf(d0, weekdayOfDate(startDate))) / 7
    return weeks % (rule.interval ?? 1) === 0
  }
  if (isMonthlyDayRule(rule)) return rule.byMonthDay.includes(Number(date.slice(8, 10)))
  const pos = weekdayPosition(date)
  return rule.byDay.some((e) => e.day === wd && (e.nthOfPeriod === -1 ? pos.isLast : e.nthOfPeriod === pos.nth))
}

/** False when the first date is not one of the rule's dates; the server refuses such a rule
 *  ('the first date must be one of the repeating dates'). */
export function startDateFitsRule(rule: RecurrenceRule, startDate: string, startTime = '00:00'): boolean {
  return ruleMatchesDate(rule, startDate, startDate, startTime)
}

// ---------------------------------------------------------------------------------------------
// Monthly choices (Google Calendar style), derived from the start date
// ---------------------------------------------------------------------------------------------

export type MonthlyPattern =
  | { kind: 'monthday'; days: number[] }
  | { kind: 'weekday'; days: Array<{ day: WeekdayCode; nthOfPeriod: NthOfPeriod }> }

export interface MonthlyChoice {
  /** Stable radio value. */
  key: string
  pattern: MonthlyPattern
}

/** Stable key of a pattern ('md:10', 'nd:2sa', 'nd:-1sa', 'nd:2sa+4sa'); order-insensitive. */
export function monthlyPatternKey(p: MonthlyPattern): string {
  if (p.kind === 'monthday') return `md:${[...p.days].sort((a, b) => a - b).join('+')}`
  return `nd:${p.days.map((e) => `${e.nthOfPeriod}${e.day}`).sort().join('+')}`
}

/** The rule fragment of a monthly pattern (also the input for its radio label:
 *  formatRecurrence(monthlyPatternRule(choice.pattern), locale) -> "Monthly on day 10"). */
export function monthlyPatternRule(p: MonthlyPattern): MonthlyWeekdayRule | MonthlyDayRule {
  return p.kind === 'monthday'
    ? { frequency: 'monthly', byMonthDay: [...p.days].sort((a, b) => a - b) }
    : { frequency: 'monthly', byDay: p.days.map((e) => ({ day: e.day, nthOfPeriod: e.nthOfPeriod })) }
}

/**
 * The monthly options a start date offers: "day 10", then "the 2nd Saturday" (only when the
 * date is the 1st–4th of its weekday that month; there is no 5th), then "the last Saturday"
 * (only when the date is the last one). `current` (a stored pattern that is none of these, for
 * example 2nd + 4th Saturday) is appended so the edit form can keep it.
 */
export function monthlyChoices(startDate: string, current?: MonthlyPattern | null): MonthlyChoice[] {
  const day = Number(startDate.slice(8, 10))
  const wd = weekdayOfDate(startDate)
  const pos = weekdayPosition(startDate)
  const patterns: MonthlyPattern[] = [{ kind: 'monthday', days: [day] }]
  if (pos.nth <= 4) patterns.push({ kind: 'weekday', days: [{ day: wd, nthOfPeriod: pos.nth as NthOfPeriod }] })
  if (pos.isLast) patterns.push({ kind: 'weekday', days: [{ day: wd, nthOfPeriod: -1 }] })
  const out = patterns.map((pattern) => ({ key: monthlyPatternKey(pattern), pattern }))
  if (current && !out.some((c) => c.key === monthlyPatternKey(current))) {
    out.push({ key: monthlyPatternKey(current), pattern: current })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Feed lead ("post to the feed N days before each date")
// ---------------------------------------------------------------------------------------------

/** assistance_events.announce_days_before CHECK presets, in display order. */
export const ANNOUNCE_LEAD_PRESETS = [0, 1, 3, 7, 14, 30] as const
export type AnnounceLead = (typeof ANNOUNCE_LEAD_PRESETS)[number]
export const DEFAULT_ANNOUNCE_LEAD: AnnounceLead = 7

/** Option label of each preset ("1 week before"). */
export const ANNOUNCE_LEAD_KEYS: Record<AnnounceLead, keyof EventFormMessages> = {
  0: 'leadSameDay',
  1: 'lead1Day',
  3: 'lead3Days',
  7: 'lead7Days',
  14: 'lead14Days',
  30: 'lead30Days',
}

/** Option label of each weekly interval ("Every 2 weeks"). */
export const WEEKLY_INTERVAL_KEYS: Record<1 | 2 | 3 | 4, keyof EventFormMessages> = {
  1: 'repeatEveryWeek',
  2: 'repeatEvery2Weeks',
  3: 'repeatEvery3Weeks',
  4: 'repeatEvery4Weeks',
}

export function isAnnounceLead(v: unknown): v is AnnounceLead {
  return (ANNOUNCE_LEAD_PRESETS as readonly unknown[]).includes(v)
}

/** The venue-local calendar date a date first shows on the feed: `lead` days before it, from
 *  00:00 venue time. */
export function announceFromDate(localDate: string, lead: AnnounceLead): string {
  const n = dayNumber(localDate)
  if (n === null) throw new RangeError(`not a calendar date: ${localDate}`)
  return fromDayNumber(n - lead)
}

// ---------------------------------------------------------------------------------------------
// Form state <-> rule
// ---------------------------------------------------------------------------------------------

export type RepeatChoice = 'none' | 'weekly' | 'monthly'
export type SeriesEndChoice = 'until' | 'count' | 'never'

export interface RecurrenceFormState {
  repeat: RepeatChoice
  /** Weekly: every 1..4 weeks. */
  interval: number
  /** Weekly: checked weekdays (any order; the rule lists them Sunday-first). */
  weekdays: WeekdayCode[]
  /** Monthly: the chosen pattern (one of monthlyChoices). */
  monthly: MonthlyPattern
  end: SeriesEndChoice
  /** 'until': the last calendar date (inclusive), YYYY-MM-DD. */
  untilDate: string
  /** 'count': the input text. */
  count: string
}

/** 'pattern' = the start date is not one of the pattern's dates (the weekdays or monthly choice
 *  must include it, or the start date must change). */
export type RecurrenceField = 'weekdays' | 'interval' | 'monthly' | 'until' | 'count' | 'pattern'
export type RecurrenceErrors = Partial<Record<RecurrenceField, FieldError>>

const DEFAULT_COUNT = '10'

/** A new event's repeat section: off; weekly on the start weekday and monthly on its day are
 *  pre-chosen for when the admin turns it on; the series ends six months after the start. */
export function defaultRecurrenceForm(startDate: string): RecurrenceFormState {
  return {
    repeat: 'none',
    interval: 1,
    weekdays: [weekdayOfDate(startDate)],
    monthly: monthlyChoices(startDate)[0].pattern,
    end: 'until',
    untilDate: sixMonthsFrom(startDate),
    count: DEFAULT_COUNT,
  }
}

/** The edit form for a stored rule (null = does not repeat). */
export function recurrenceFormFromRule(rule: RecurrenceRule | null, startDate: string): RecurrenceFormState {
  const base = defaultRecurrenceForm(startDate)
  if (!rule) return base
  const end: Pick<RecurrenceFormState, 'end' | 'untilDate' | 'count'> =
    rule.until !== undefined
      ? { end: 'until', untilDate: rule.until.slice(0, 10), count: base.count }
      : rule.count !== undefined
        ? { end: 'count', untilDate: base.untilDate, count: String(rule.count) }
        : { end: 'never', untilDate: base.untilDate, count: base.count }
  if (rule.frequency === 'weekly') {
    return { ...base, ...end, repeat: 'weekly', interval: rule.interval ?? 1, weekdays: rule.byDay.map((e) => e.day) }
  }
  const monthly: MonthlyPattern = isMonthlyDayRule(rule)
    ? { kind: 'monthday', days: [...rule.byMonthDay] }
    : { kind: 'weekday', days: rule.byDay.map((e) => ({ ...e })) }
  return { ...base, ...end, repeat: 'monthly', monthly }
}

/**
 * The start date changed: selections that only echoed the old start date follow the new one
 * (weekly on its weekday, the same kind of monthly choice, the six-month default end).
 * Selections the admin made on purpose stay.
 */
export function withRecurrenceStartDate(
  form: RecurrenceFormState,
  oldStart: string,
  newStart: string,
): RecurrenceFormState {
  if (!isCalendarDate(oldStart) || !isCalendarDate(newStart)) return form
  const next = { ...form }
  if (form.weekdays.length === 1 && form.weekdays[0] === weekdayOfDate(oldStart)) {
    next.weekdays = [weekdayOfDate(newStart)]
  }
  const oldChoices = monthlyChoices(oldStart)
  const idx = oldChoices.findIndex((c) => c.key === monthlyPatternKey(form.monthly))
  if (idx >= 0) {
    const newChoices = monthlyChoices(newStart)
    const wanted = oldChoices[idx].pattern
    const lastWanted = wanted.kind === 'weekday' && wanted.days[0].nthOfPeriod === -1
    const same =
      newChoices.find((c) =>
        wanted.kind === 'monthday'
          ? c.pattern.kind === 'monthday'
          : c.pattern.kind === 'weekday' && (c.pattern.days[0].nthOfPeriod === -1) === lastWanted,
      ) ?? newChoices[0]
    next.monthly = same.pattern
  }
  if (form.untilDate === sixMonthsFrom(oldStart)) next.untilDate = sixMonthsFrom(newStart)
  return next
}

const COUNT_RE = /^[1-9]\d{0,3}$/

/**
 * Validate the repeat section and build the exact p_recurrence argument (null = does not
 * repeat). Weekdays are written Sunday-first; interval only when it is above 1. The start date
 * (the series' first date) must be one of the pattern's dates, as the server requires.
 */
export function recurrenceRuleFromForm(
  form: RecurrenceFormState,
  startDate: string,
): { ok: true; rule: RecurrenceRule | null } | { ok: false; errors: RecurrenceErrors } {
  if (form.repeat === 'none') return { ok: true, rule: null }
  const errors: RecurrenceErrors = {}
  let pattern: WeeklyRule | MonthlyWeekdayRule | MonthlyDayRule | null = null
  if (form.repeat === 'weekly') {
    if (!Number.isInteger(form.interval) || form.interval < 1 || form.interval > 4) {
      errors.interval = { key: 'errRepeatInterval' }
    }
    const days = WEEKDAY_DISPLAY_ORDER.filter((d) => form.weekdays.includes(d))
    if (days.length === 0) errors.weekdays = { key: 'errRepeatNoDays' }
    pattern = {
      frequency: 'weekly',
      ...(form.interval > 1 ? { interval: form.interval } : {}),
      byDay: days.map((day) => ({ day })),
    }
  } else if (form.monthly.days.length === 0) {
    errors.monthly = { key: 'errRepeatMonthly' }
  } else {
    pattern = monthlyPatternRule(form.monthly)
  }
  let end: RuleEnd = {}
  if (form.end === 'until') {
    if (!isCalendarDate(form.untilDate)) errors.until = { key: 'errRepeatUntilRequired' }
    else if (isCalendarDate(startDate) && form.untilDate < startDate) errors.until = { key: 'errRepeatUntilBeforeStart' }
    else end = { until: untilFromDate(form.untilDate) }
  } else if (form.end === 'count') {
    const text = form.count.trim()
    if (!COUNT_RE.test(text) || Number(text) > 1000) errors.count = { key: 'errRepeatCount' }
    else end = { count: Number(text) }
  }
  if (Object.keys(errors).length > 0 || pattern === null) return { ok: false, errors }
  if (isCalendarDate(startDate) && !startDateFitsRule(pattern, startDate)) {
    return { ok: false, errors: { pattern: { key: 'errRepeatStartNotInPattern' } } }
  }
  const rule = { ...pattern, ...end } as RecurrenceRule
  // The form can only build valid rules; this keeps it honest against the server's validator.
  if (recurrenceProblem(rule) !== null) return { ok: false, errors: { monthly: { key: 'errInvalid' } } }
  return { ok: true, rule }
}

/** Log-label summary of a rule (enums and counts only). */
export function recurrenceLabels(rule: RecurrenceRule | null): {
  frequency: 'none' | 'weekly' | 'monthly'
  series_end: 'none' | 'until' | 'count' | 'never'
} {
  if (!rule) return { frequency: 'none', series_end: 'none' }
  return {
    frequency: rule.frequency,
    series_end: rule.until !== undefined ? 'until' : rule.count !== undefined ? 'count' : 'never',
  }
}
