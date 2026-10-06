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

import type { EventFormMessages } from './i18n-event-forms'
import { checkLocalTime } from './event-time'
import type { CreateOrgEventArgs, EventErrorField, LocalDate, UpdateEventArgs } from './event-admin-rpc'

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
  time: EventTimeDraft
  location: LocationDraft
}

/** Validate the whole create form; on success the exact create_org_event arguments. */
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
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------------------------

export interface EditEventDraft {
  eventId: string
  title: string
  eventType: string
  description: string
  locationName: string
  location: LocationDraft
}

/** Validate the edit form; on success the exact admin_update_event arguments (no rrule, no
 *  geocode tier, no time zone). A blanked optional text field is cleared through p_clear. */
export function buildUpdateArgs(
  draft: EditEventDraft,
  orgHasPin: boolean,
): { ok: true; args: UpdateEventArgs } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  if (!draft.title.trim()) errors.title = { key: 'errTitleRequired' }
  const loc = resolveLocation(draft.location, orgHasPin)
  if (!loc.ok) errors.location = loc.error
  if (Object.keys(errors).length > 0 || !loc.ok) return { ok: false, errors }
  const clear: string[] = []
  if (!draft.description.trim()) clear.push('description')
  if (!draft.locationName.trim()) clear.push('location_name')
  return {
    ok: true,
    args: {
      p_event_id: draft.eventId,
      p_title: draft.title.trim(),
      p_event_type: draft.eventType,
      p_description: draft.description.trim() || undefined,
      p_location_name: draft.locationName.trim() || undefined,
      ...loc.args,
      p_clear: clear,
    },
  }
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
  'location',
]

export function firstErrorField(errors: FieldErrors): Exclude<EventErrorField, null> | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? null
}
