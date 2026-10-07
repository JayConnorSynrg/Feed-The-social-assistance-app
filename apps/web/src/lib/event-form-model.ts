// apps/web/src/lib/event-form-model.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure form logic for the admin event forms (create, add dates, edit). No React, no network:
// the components hold state and call these to validate and to build the exact RPC arguments.
//
//   createSubmitController — exactly-once create: an idempotency key minted when the form opens,
//     reused by every retry of that form, renewed only after a successful create; plus a
//     single-flight flag set synchronously before the first await (a second click while a save is
//     in flight is refused without a second request).
//   validateTime / validateDateRows — wall clock in the venue zone: required parts, DST gap,
//     DST repeat, end after start (same rule the server enforces with 22023).
//   resolveLocation — 'org' (the organization's pin) or 'address' (a Census draft pin the admin
//     confirmed); 'keep' on edit. Only confirmed coordinates are ever sent.
//   Repeat + feed lead — the create form sends the repeat rule (lib/event-recurrence.ts) and
//     "post N days before"; the edit form sends only what changed (the rule, the first date and
//     times every upcoming date takes, the lead) or p_clear 'recurrence' to stop repeating.
//   Series display — a series' last date, whether it ends within 30 days, whether it can be
//     extended, and whether a hand-added date sits outside the pattern ("Extra date").

import type { EventFormMessages } from './i18n-event-forms'
import { checkLocalTime, dateTimeFormat } from './event-time'
import type { CreateOrgEventArgs, EventErrorField, LocalDate, UpdateEventArgs } from './event-admin-rpc'
import {
  isAnnounceLead,
  isMonthlyDayRule,
  parseRecurrenceRule,
  recurrenceRuleFromForm,
  ruleMatchesDate,
  type AnnounceLead,
  type RecurrenceFormState,
  type RecurrenceRule,
} from './event-recurrence'

export interface FieldError {
  key: keyof EventFormMessages
  vars?: Record<string, string>
}
export type FieldErrors = Partial<Record<Exclude<EventErrorField, null>, FieldError>>

// ---------------------------------------------------------------------------------------------
// Exactly-once submit
// ---------------------------------------------------------------------------------------------

export type SubmitOutcome<R> = { status: 'busy' } | { status: 'done'; result: R }

export interface SubmitController {
  /** The idempotency key the next submit sends. */
  readonly key: string
  /** True while a submit is in flight. */
  readonly inFlight: boolean
  /** A new form was opened: mint a fresh key. */
  reset(): void
  /**
   * Run one submit. Refused ('busy') while another is in flight — the flag flips before `run`
   * is called, so a second click in the same tick never reaches the network. The key is renewed
   * only when `run` reports ok; a failure or a throw keeps it, so a retry returns the same event.
   */
  submit<R extends { ok: boolean }>(run: (key: string) => Promise<R>): Promise<SubmitOutcome<R>>
}

export function createSubmitController(mintKey: () => string): SubmitController {
  let key = mintKey()
  let inFlight = false
  return {
    get key() {
      return key
    },
    get inFlight() {
      return inFlight
    },
    reset() {
      key = mintKey()
    },
    async submit<R extends { ok: boolean }>(run: (k: string) => Promise<R>): Promise<SubmitOutcome<R>> {
      if (inFlight) return { status: 'busy' }
      inFlight = true
      try {
        const result = await run(key)
        if (result.ok) key = mintKey()
        return { status: 'done', result }
      } finally {
        inFlight = false
      }
    },
  }
}

/** A UUID for p_idempotency_key (the column is uuid). */
export function mintIdempotencyKey(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------------------------

export interface EventTimeDraft {
  /** Start date, YYYY-MM-DD (input type=date) */
  date: string
  /** HH:MM (input type=time) */
  start: string
  /** End date, YYYY-MM-DD — the start date by default; the next day for an overnight event. */
  endDate: string
  end: string
}

/** A date row starting and ending on `date`. */
export function sameDayTime(date: string, start: string, end: string): EventTimeDraft {
  return { date, start, endDate: date, end }
}

/**
 * Change the start date. An end date that still equals the old start date follows it (so the
 * default "ends the same day" holds); an end date the admin set on purpose stays.
 */
export function withStartDate(t: EventTimeDraft, date: string): EventTimeDraft {
  return { ...t, date, endDate: !t.endDate || t.endDate === t.date ? date : t.endDate }
}

/** The local timestamp string the RPCs take (timestamp without time zone). */
export function localTimestamp(date: string, time: string): string {
  return `${date}T${time}`
}

/** Field errors for one date in the venue zone; empty when it is valid. End may fall on a later
 *  date (overnight); it must be after the start, as real instants in the venue zone. */
export function validateTime(t: EventTimeDraft, tz: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!t.date) errors.date = { key: 'errDateRequired' }
  if (!t.start) errors.start = { key: 'errStartRequired' }
  if (!t.endDate) errors.endDate = { key: 'errDateRequired' }
  if (!t.end) errors.end = { key: 'errEndRequired' }
  if (errors.date || errors.start || errors.endDate || errors.end) return errors
  const s = checkLocalTime(t.date, t.start, tz)
  const e = checkLocalTime(t.endDate, t.end, tz)
  if (s.kind === 'invalid' || e.kind === 'invalid') {
    errors.timeZone = { key: 'errTimeZone' }
    return errors
  }
  if (s.kind === 'gap') errors.start = { key: 'errTimeGap', vars: { time: t.start } }
  if (s.kind === 'repeat') errors.start = { key: 'errTimeRepeat', vars: { time: t.start } }
  if (e.kind === 'gap') errors.end = { key: 'errTimeGap', vars: { time: t.end } }
  if (e.kind === 'repeat') errors.end = { key: 'errTimeRepeat', vars: { time: t.end } }
  if (s.kind === 'ok' && e.kind === 'ok' && e.instant.getTime() <= s.instant.getTime()) {
    errors.end = { key: 'errEndBeforeStart' }
  }
  return errors
}

/** Per-row errors for the add-dates form (index -> errors); empty object when every row is valid. */
export function validateDateRows(rows: readonly EventTimeDraft[], tz: string): Record<number, FieldErrors> {
  const out: Record<number, FieldErrors> = {}
  rows.forEach((r, i) => {
    const e = validateTime(r, tz)
    if (Object.keys(e).length > 0) out[i] = e
  })
  return out
}

export function toLocalDates(rows: readonly EventTimeDraft[]): LocalDate[] {
  return rows.map((r) => ({ startsLocal: localTimestamp(r.date, r.start), endsLocal: localTimestamp(r.endDate, r.end) }))
}

/**
 * Which row / field a server error belongs to. The message names 'YYYY-MM-DD HH:MM': a row's
 * start (end-before-start and "cancelled date has check-ins" name the start; a DST error names
 * the time it is about) or a row's end. A start match keeps the mapper's field ('end' for
 * end-before-start, else 'start'); an end match is the end field. No match -> row 0.
 */
export function locateTimeError(
  localTime: string | null,
  rows: readonly EventTimeDraft[],
  fallback: EventErrorField,
): { row: number; field: EventErrorField } {
  if (localTime) {
    const [date, time] = localTime.split(' ')
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].date === date && rows[i].start === time) return { row: i, field: fallback === 'end' ? 'end' : 'start' }
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].endDate === date && rows[i].end === time) return { row: i, field: 'end' }
    }
  }
  return { row: 0, field: fallback }
}

// ---------------------------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------------------------

export interface DraftPin {
  lng: number
  lat: number
  /** Only a confirmed pin may be saved. */
  status: 'draft' | 'confirmed'
  /** Census exact match, Census approximate match, or a click / drag on the map. */
  source: 'exact' | 'approximate' | 'manual'
}

export type LocationDraft =
  | { source: 'keep' }
  | { source: 'org' }
  | { source: 'address'; street: string; city: string; state: string; zip: string; pin: DraftPin | null }

export function emptyAddress(): LocationDraft {
  return { source: 'address', street: '', city: '', state: '', zip: '', pin: null }
}

/** Create form default: the organization's pin when it has one, else an address. */
export function defaultLocation(orgHasPin: boolean): LocationDraft {
  return orgHasPin ? { source: 'org' } : emptyAddress()
}

export type LocationArgs = Pick<
  CreateOrgEventArgs,
  'p_location_source' | 'p_address' | 'p_city' | 'p_state' | 'p_zip_code' | 'p_lat' | 'p_lng'
>

/**
 * The location part of the RPC arguments, or the error to show. 'keep' -> {} (edit only: no
 * location argument at all, so the stored pin and address stay).
 */
export function resolveLocation(
  draft: LocationDraft,
  orgHasPin: boolean,
): { ok: true; args: Partial<LocationArgs> } | { ok: false; error: FieldError } {
  if (draft.source === 'keep') return { ok: true, args: {} }
  if (draft.source === 'org') {
    if (!orgHasPin) return { ok: false, error: { key: 'errOrgNoPin' } }
    return { ok: true, args: { p_location_source: 'org' } }
  }
  const street = draft.street.trim()
  if (!street) return { ok: false, error: { key: 'errAddressRequired' } }
  if (!draft.pin || draft.pin.status !== 'confirmed') return { ok: false, error: { key: 'errConfirmPin' } }
  return {
    ok: true,
    args: {
      p_location_source: 'address',
      p_address: street,
      p_city: draft.city.trim() || undefined,
      p_state: draft.state.trim() || undefined,
      p_zip_code: draft.zip.trim() || undefined,
      p_lat: draft.pin.lat,
      p_lng: draft.pin.lng,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------

export interface CreateEventDraft {
  orgId: string
  title: string
  eventType: string
  description: string
  locationName: string
  timeZone: string
  /** The first date (and, when it repeats, the time and length of every date). */
  time: EventTimeDraft
  location: LocationDraft
  recurrence: RecurrenceFormState
  /** "Post to the feed N days before each date" (one of ANNOUNCE_LEAD_PRESETS). */
  announce: number
}

/** Minutes of a wall-clock date + time, counted in UTC so no zone or DST enters. */
function wallMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) / 60_000
}

/** A repeating event's dates last at most 24 h each (wall clock, as the server measures it). */
export function lastsOver24Hours(t: EventTimeDraft): boolean {
  return wallMinutes(t.endDate, t.end) - wallMinutes(t.date, t.start) > 24 * 60
}

/** The repeat section + lead of a form: field errors, and the rule to send (null = one date). */
function seriesPart(
  recurrence: RecurrenceFormState,
  time: EventTimeDraft,
  announce: number,
  timeErrors: FieldErrors,
): { errors: FieldErrors; rule: RecurrenceRule | null } {
  const errors: FieldErrors = {}
  const built = recurrenceRuleFromForm(recurrence, time.date)
  if (!built.ok) Object.assign(errors, built.errors)
  if (recurrence.repeat !== 'none' && !timeErrors.end && !timeErrors.start && time.date && time.endDate && time.start && time.end) {
    if (lastsOver24Hours(time)) errors.end = { key: 'errRepeatTooLong' }
  }
  if (!isAnnounceLead(announce)) errors.lead = { key: 'errLeadPreset' }
  return { errors, rule: built.ok ? built.rule : null }
}

/** Validate the whole create form; on success the exact create_org_event arguments: the event,
 *  its first date, the repeat rule when it repeats, and the feed lead — one call. */
export function buildCreateArgs(
  draft: CreateEventDraft,
  idempotencyKey: string,
  orgHasPin: boolean,
): { ok: true; args: CreateOrgEventArgs } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  if (!draft.title.trim()) errors.title = { key: 'errTitleRequired' }
  if (!draft.orgId) errors.org = { key: 'errOrgRequired' }
  if (!draft.timeZone) errors.timeZone = { key: 'errTimeZone' }
  else Object.assign(errors, validateTime(draft.time, draft.timeZone))
  const series = seriesPart(draft.recurrence, draft.time, draft.announce, errors)
  Object.assign(errors, series.errors)
  const loc = resolveLocation(draft.location, orgHasPin)
  if (!loc.ok) errors.location = loc.error
  if (Object.keys(errors).length > 0 || !loc.ok) return { ok: false, errors }
  return {
    ok: true,
    args: {
      p_org_id: draft.orgId,
      p_idempotency_key: idempotencyKey,
      p_title: draft.title.trim(),
      p_event_type: draft.eventType,
      p_description: draft.description.trim() || undefined,
      p_location_name: draft.locationName.trim() || undefined,
      p_time_zone: draft.timeZone,
      p_starts_local: localTimestamp(draft.time.date, draft.time.start),
      p_ends_local: localTimestamp(draft.time.endDate, draft.time.end),
      p_location_source: loc.args.p_location_source ?? 'org',
      ...loc.args,
      ...(series.rule ? { p_recurrence: series.rule } : {}),
      p_announce_days_before: draft.announce,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------------------------

/** What the event has now: its rule, the first date + times every rule date takes (for a
 *  one-off event: the date proposed as the first date if it starts repeating), and its lead. */
export interface StoredSeries {
  rule: RecurrenceRule | null
  time: EventTimeDraft
  announce: AnnounceLead
}

export interface EditEventDraft {
  eventId: string
  title: string
  eventType: string
  description: string
  locationName: string
  location: LocationDraft
  /** The event's own zone (fixed); the first date's times are checked in it. */
  timeZone: string
  recurrence: RecurrenceFormState
  time: EventTimeDraft
  announce: number
  stored: StoredSeries
}

type RuleKey = string

/** Order-insensitive identity of a rule (weekdays / positions / days in any order, interval 1
 *  written or not), so an untouched rule is never sent back. */
function ruleKey(rule: RecurrenceRule | null): RuleKey {
  if (!rule) return 'none'
  const end = rule.until !== undefined ? `u${rule.until}` : rule.count !== undefined ? `c${rule.count}` : 'n'
  if (rule.frequency === 'weekly') {
    return `w${rule.interval ?? 1}:${rule.byDay.map((d) => d.day).sort().join(',')}:${end}`
  }
  if (isMonthlyDayRule(rule)) return `md:${[...rule.byMonthDay].sort((a, b) => a - b).join(',')}:${end}`
  return `mw:${rule.byDay.map((d) => `${d.nthOfPeriod}${d.day}`).sort().join(',')}:${end}`
}

export function sameRule(a: RecurrenceRule | null, b: RecurrenceRule | null): boolean {
  return ruleKey(a) === ruleKey(b)
}

function sameTime(a: EventTimeDraft, b: EventTimeDraft): boolean {
  return a.date === b.date && a.start === b.start && a.endDate === b.endDate && a.end === b.end
}

/** True when saving the form stops a repeating event (the dialog confirms first). */
export function stopsRepeating(draft: Pick<EditEventDraft, 'recurrence' | 'stored'>): boolean {
  return draft.stored.rule !== null && draft.recurrence.repeat === 'none'
}

/**
 * Validate the edit form; on success the exact admin_update_event arguments. Title / type /
 * text fields / location as before (a blanked optional text field is cleared through p_clear).
 * Repeating: only what changed is sent — p_recurrence for a new pattern or end, p_series_starts_local
 * + p_series_ends_local for a new first date or new times (every upcoming date moves to them),
 * p_announce_days_before for a new lead; a one-off event that starts repeating sends the rule and
 * its first date; stopping sends p_clear 'recurrence'. Unchanged series fields are not sent (NULL
 * keeps them on the server).
 */
export function buildUpdateArgs(
  draft: EditEventDraft,
  orgHasPin: boolean,
): { ok: true; args: UpdateEventArgs } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  if (!draft.title.trim()) errors.title = { key: 'errTitleRequired' }
  const repeating = draft.recurrence.repeat !== 'none'
  const timeErrors = repeating ? validateTime(draft.time, draft.timeZone) : {}
  Object.assign(errors, timeErrors)
  const series = seriesPart(draft.recurrence, draft.time, draft.announce, timeErrors)
  Object.assign(errors, series.errors)
  const loc = resolveLocation(draft.location, orgHasPin)
  if (!loc.ok) errors.location = loc.error
  if (Object.keys(errors).length > 0 || !loc.ok) return { ok: false, errors }
  const clear: string[] = []
  if (!draft.description.trim()) clear.push('description')
  if (!draft.locationName.trim()) clear.push('location_name')

  const seriesArgs: Partial<UpdateEventArgs> = {}
  if (stopsRepeating(draft)) clear.push('recurrence')
  if (repeating && series.rule) {
    const isNew = draft.stored.rule === null
    if (isNew || !sameRule(series.rule, draft.stored.rule)) seriesArgs.p_recurrence = series.rule
    if (isNew || !sameTime(draft.time, draft.stored.time)) {
      seriesArgs.p_series_starts_local = localTimestamp(draft.time.date, draft.time.start)
      seriesArgs.p_series_ends_local = localTimestamp(draft.time.endDate, draft.time.end)
    }
  }
  if (draft.announce !== draft.stored.announce) seriesArgs.p_announce_days_before = draft.announce
  return {
    ok: true,
    args: {
      p_event_id: draft.eventId,
      p_title: draft.title.trim(),
      p_event_type: draft.eventType,
      p_description: draft.description.trim() || undefined,
      p_location_name: draft.locationName.trim() || undefined,
      ...loc.args,
      ...seriesArgs,
      p_clear: clear,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Stored series -> form
// ---------------------------------------------------------------------------------------------

/** Wall-clock minutes of a Postgres interval as PostgREST returns it ('01:30:00', '1 day',
 *  '1 day 02:00:00'); null for any other shape. */
export function intervalMinutes(text: string | null | undefined): number | null {
  if (!text) return null
  const m = /^(?:(\d+) days?)?\s*(?:(\d+):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim())
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

function addWallMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const iso = new Date((wallMinutes(date, time) + minutes) * 60_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** The first date of a stored series: series_start_local ('YYYY-MM-DDTHH:MM[:SS]') + its
 *  wall-clock length. null when either is missing or unreadable. */
export function seriesTimeFromStored(startLocal: string | null, duration: string | null): EventTimeDraft | null {
  const minutes = intervalMinutes(duration)
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(startLocal ?? '')
  if (!m || minutes === null) return null
  const end = addWallMinutes(m[1], m[2], minutes)
  return { date: m[1], start: m[2], endDate: end.date, end: end.time }
}

/** 'YYYY-MM-DD' + 'HH:MM' of an instant on the venue's clock. */
export function venueWallClock(iso: string, tz: string): { date: string; time: string } {
  const parts = dateTimeFormat(null, tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${v('year')}-${v('month')}-${v('day')}`, time: `${v('hour')}:${v('minute')}` }
}

/** A date row from two instants, on the venue's clock (a one-off event's next date, proposed as
 *  the first date when it starts repeating). */
export function timeDraftFromInstants(startsAt: string, endsAt: string, tz: string): EventTimeDraft {
  const s = venueWallClock(startsAt, tz)
  const e = venueWallClock(endsAt, tz)
  return { date: s.date, start: s.time, endDate: e.date, end: e.time }
}

// ---------------------------------------------------------------------------------------------
// Series display
// ---------------------------------------------------------------------------------------------

function nextDay(date: string, days = 1): string {
  return addWallMinutes(date, '00:00', days * 1440).date
}

/**
 * The local date of a series' last date: the latest pattern date on or before `until`
 * (consecutive dates are at most 62 days apart), or the count-th date from the first; null when
 * it never ends. Same answer as the server's event_series_last_date.
 */
export function seriesLastDate(rule: RecurrenceRule, startDate: string, startTime = '00:00'): string | null {
  if (rule.until !== undefined) {
    let d = rule.until.slice(0, 10)
    for (let i = 0; i <= 62 && d >= startDate; i++, d = nextDay(d, -1)) {
      if (ruleMatchesDate(rule, startDate, d, startTime)) return d
    }
    return null
  }
  if (rule.count !== undefined) {
    let seen = 0
    let d = startDate
    for (let i = 0; i <= rule.count * 62; i++, d = nextDay(d)) {
      if (ruleMatchesDate(rule, startDate, d, startTime) && ++seen === rule.count) return d
    }
    return null
  }
  return null
}

export type SeriesState =
  | { kind: 'none' }
  | { kind: 'never'; rule: RecurrenceRule }
  | { kind: 'ends'; rule: RecurrenceRule; lastDate: string | null; endingSoon: boolean; ended: boolean }

/** How a stored series stands on `today` (the venue's date): ends within 30 days, already
 *  ended, or not. Unreadable rules count as not repeating. */
export function seriesState(recurrence: unknown, seriesStartLocal: string | null, today: string): SeriesState {
  const rule = parseRecurrenceRule(recurrence)
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(seriesStartLocal ?? '')
  if (!rule || !m) return { kind: 'none' }
  if (rule.until === undefined && rule.count === undefined) return { kind: 'never', rule }
  const lastDate = seriesLastDate(rule, m[1], m[2])
  const ended = lastDate === null || lastDate < today
  return { kind: 'ends', rule, lastDate, ended, endingSoon: ended || lastDate <= nextDay(today, 30) }
}

/** "Repeat for 6 more months" is offered on an active event whose series ends. */
export function canExtendSeries(event: { is_active: boolean; recurrence: unknown }): boolean {
  const rule = parseRecurrenceRule(event.recurrence)
  return event.is_active && rule !== null && (rule.until !== undefined || rule.count !== undefined)
}

/** A hand-added date of a repeating event that is not one of the pattern's dates. */
export function isExtraDate(
  occ: { source?: string | null; starts_at: string },
  event: { recurrence: unknown; series_start_local: string | null; time_zone: string },
): boolean {
  if (occ.source !== 'manual') return false
  const rule = parseRecurrenceRule(event.recurrence)
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(event.series_start_local ?? '')
  if (!rule || !m) return false
  const local = venueWallClock(occ.starts_at, event.time_zone)
  return !(ruleMatchesDate(rule, m[1], local.date, m[2]) && local.time === m[2])
}

/** The first field with an error, in on-screen order (focus moves there on a failed submit). */
export const FIELD_ORDER: ReadonlyArray<Exclude<EventErrorField, null>> = [
  'org',
  'title',
  'date',
  'start',
  'endDate',
  'end',
  'timeZone',
  'interval',
  'weekdays',
  'monthly',
  'pattern',
  'until',
  'count',
  'lead',
  'location',
]

/** The edit form's on-screen order: the repeat section sits above the first date's times there. */
export const EDIT_FIELD_ORDER: ReadonlyArray<Exclude<EventErrorField, null>> = [
  'title',
  'interval',
  'weekdays',
  'monthly',
  'pattern',
  'until',
  'count',
  'date',
  'start',
  'endDate',
  'end',
  'lead',
  'location',
]

export function firstErrorField(
  errors: FieldErrors,
  order: ReadonlyArray<Exclude<EventErrorField, null>> = FIELD_ORDER,
): Exclude<EventErrorField, null> | null {
  return order.find((f) => errors[f]) ?? null
}
