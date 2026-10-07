// apps/web/src/lib/event-admin-rpc.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE typed boundary for every event write. Each write is a single SECURITY DEFINER RPC that
// decides permission in the database and writes one admin_actions row; each goes through
// privilegedRpc, so the RPC receives x-request-id (-> admin_actions.request_id) and withMetric
// persists exactly one app_logs row (<op>.complete with duration_ms, or <op>.error with
// error_code = the SQLSTATE) carrying the same request_id. The client never writes
// event_occurrences or assistance_events directly.
//
//   create_org_event        op admin.event.create      -> event id
//   add_event_dates         op admin.event.add_dates   -> dates added or restored
//   cancel_event_occurrence op admin.occurrence.cancel -> void
//   admin_update_event      op admin.event.update      -> event id   (label action: update|retire)
//   extend_event_series     op admin.event.extend_series -> the series' new end
//   preview_event_recurrence op admin.event.preview (withMetric; reads, writes nothing)
//
// Labels are ids, enums and counts only (frequency, series_end, announce_days_before, rule_edit);
// the repeat rule itself never reaches a log row.
//
// mapEventError turns a SQLSTATE + stable message prefix into a dictionary key and the form
// field it belongs to, so raw database text never reaches the UI.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { privilegedRpc } from './privileged-action'
import { withMetric } from './logger'
import type { EventFormMessages } from './i18n-event-forms'
import { parseRecurrenceRule, recurrenceLabels, type RecurrenceRule } from './event-recurrence'

type Rpc = Database['public']['Functions']
export type CreateOrgEventArgs = Rpc['create_org_event']['Args']
export type UpdateEventArgs = Rpc['admin_update_event']['Args']

export type EventErrorField =
  | 'title'
  | 'org'
  | 'date'
  | 'start'
  | 'endDate'
  | 'end'
  | 'timeZone'
  | 'interval'
  | 'weekdays'
  | 'monthly'
  | 'pattern'
  | 'until'
  | 'count'
  | 'lead'
  | 'location'
  | null

export interface MappedEventError {
  errorKey: keyof EventFormMessages
  field: EventErrorField
  /** 'YYYY-MM-DD HH:MM' named by the error (DST gap / repeat; the start of an end-before-start
   *  or a cancelled-date-has-check-ins refusal). */
  localTime: string | null
}

export type EventRpcFailure = { ok: false; code: string | null } & MappedEventError

/** SQLSTATE of a failed call; null when the database never answered (postgrest-js code ""). */
function sqlstateOf(error: { code?: string | null }): string | null {
  return error.code || null
}

/** SQLSTATE + message prefix -> dictionary key + field. Never surfaces database text. */
export function mapEventError(error: { code?: string | null; message?: string | null }): MappedEventError {
  const code = sqlstateOf(error)
  const message = error.message ?? ''
  const lower = message.toLowerCase()
  const localTime = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(message)?.[1] ?? null
  const out = (errorKey: keyof EventFormMessages, field: EventErrorField = null): MappedEventError => ({
    errorKey,
    field,
    localTime,
  })

  if (!code) return out('errNetwork')
  if (code === '42501') return out(lower.includes('inactive') ? 'errDeniedInactive' : 'errDenied')
  if (code === 'P0002') return out('errNotFound')
  if (code === 'P0001') {
    if (lower.startsWith('event_retired:')) return out('errRetired')
    if (lower.includes('cannot be reopened')) return out('errReopenCheckins', 'start')
    if (lower.includes('has ended')) return out('errCancelEnded')
    return out('errGeneric')
  }
  if (code === '22023') {
    if (lower.startsWith('event_recurrence_invalid:')) {
      if (lower.includes('first date must be one of')) return out('errRepeatStartNotInPattern', 'pattern')
      if (lower.includes('at most 24 hours')) return out('errRepeatTooLong', 'end')
      if (lower.includes('no upcoming dates')) return out('errRepeatNoDates', 'pattern')
      if (lower.includes('ends before its first date')) return out('errRepeatUntilBeforeStart', 'until')
      if (lower.includes('only a repeating event that ends')) return out('errExtendNoEnd')
      return out('errInvalid')
    }
    if (lower.startsWith('event_time_invalid:')) {
      return out(lower.includes('happens twice') ? 'errTimeRepeat' : 'errTimeGap', 'start')
    }
    if (lower.startsWith('event_invalid:')) {
      if (lower.includes('post to the feed')) return out('errLeadPreset', 'lead')
      if (lower.includes('end time must be after')) return out('errEndBeforeStart', 'end')
      if (lower.includes('iana time zone')) return out('errTimeZone', 'timeZone')
      if (lower.includes('title')) return out('errTitleRequired', 'title')
      if (lower.includes('time zone is fixed')) return out('errTimeZone', 'timeZone')
      return out('errInvalid')
    }
    if (lower.startsWith('event_location_invalid:')) {
      if (lower.includes('no map pin')) return out('errOrgNoPin', 'location')
      if (lower.includes('street address is required')) return out('errAddressRequired', 'location')
      return out('errConfirmPin', 'location')
    }
    // w1_6a_validate_geo: 'Event coordinates are out of range or point to null island.'
    if (lower.includes('coordinates')) return out('errCoordinates', 'location')
    return out('errInvalid')
  }
  if (code === '23514' || code === '22P02') return out('errInvalid')
  return out('errGeneric')
}

function fail(error: { code?: string | null; message?: string | null }): EventRpcFailure {
  return { ok: false, code: sqlstateOf(error), ...mapEventError(error) }
}

/**
 * One-step create: the event and its first date, exactly once per idempotency key. A retry with
 * the same key returns the original event id and writes nothing; its app_logs row still records
 * THIS call (admin.event.create.complete with this call's request_id), while the admin_actions
 * audit row exists only once, from the original write, under the original request_id.
 */
export async function createOrgEvent(
  supabase: SupabaseClient<Database>,
  args: CreateOrgEventArgs,
): Promise<{ ok: true; eventId: string } | EventRpcFailure> {
  const { data, error } = await privilegedRpc<Rpc['create_org_event']['Returns']>(
    supabase,
    'admin.event.create',
    'create_org_event',
    args,
    {
      org_id: args.p_org_id,
      event_type: args.p_event_type ?? 'distribution',
      location_source: args.p_location_source,
      ...recurrenceLabels(parseRecurrenceRule(args.p_recurrence)),
      announce_days_before: args.p_announce_days_before ?? 7,
    },
  )
  if (error) return fail(error)
  return { ok: true, eventId: typeof data === 'string' ? data : '' }
}

export interface LocalDate {
  /** 'YYYY-MM-DDTHH:MM' wall clock in the event's own time zone. */
  startsLocal: string
  endsLocal: string
}

/** Add (or restore cancelled) dates. `changed` = dates added + restored; 0 is a success. */
export async function addEventDates(
  supabase: SupabaseClient<Database>,
  input: { eventId: string; orgId: string; dates: readonly LocalDate[] },
): Promise<{ ok: true; changed: number } | EventRpcFailure> {
  const args: Rpc['add_event_dates']['Args'] = {
    p_event_id: input.eventId,
    p_starts_local: input.dates.map((d) => d.startsLocal),
    p_ends_local: input.dates.map((d) => d.endsLocal),
  }
  const { data, error } = await privilegedRpc<Rpc['add_event_dates']['Returns']>(
    supabase,
    'admin.event.add_dates',
    'add_event_dates',
    args,
    { event_id: input.eventId, org_id: input.orgId, date_count: input.dates.length },
  )
  if (error) return fail(error)
  return { ok: true, changed: typeof data === 'number' ? data : 0 }
}

/** Cancel one date. Cancelling an already-cancelled date succeeds and changes nothing. */
export async function cancelEventOccurrence(
  supabase: SupabaseClient<Database>,
  input: { occurrenceId: string; eventId: string; orgId: string },
): Promise<{ ok: true } | EventRpcFailure> {
  const args: Rpc['cancel_event_occurrence']['Args'] = { p_occurrence_id: input.occurrenceId }
  const { error } = await privilegedRpc<Rpc['cancel_event_occurrence']['Returns']>(
    supabase,
    'admin.occurrence.cancel',
    'cancel_event_occurrence',
    args,
    { occurrence_id: input.occurrenceId, event_id: input.eventId, org_id: input.orgId },
  )
  if (error) return fail(error)
  return { ok: true }
}

/** What an edit did to the repeating dates, from the arguments alone: 'stop' (p_clear
 *  recurrence), 'pattern' (a new rule, with or without a new first date), 'time' (only the first
 *  date / times of every upcoming date), 'none'. */
export type RuleEdit = 'stop' | 'pattern' | 'time' | 'none'

export function ruleEditOf(args: UpdateEventArgs): RuleEdit {
  if (args.p_clear?.includes('recurrence')) return 'stop'
  if (args.p_recurrence != null) return 'pattern'
  if (args.p_series_starts_local != null) return 'time'
  return 'none'
}

/** Series labels of an edit: the new rule's shape when one is sent, 'none' when it is stopped,
 *  'keep' when the stored rule is untouched; the lead when it changes, else null. */
function updateSeriesLabels(args: UpdateEventArgs) {
  const ruleEdit = ruleEditOf(args)
  const shape =
    ruleEdit === 'stop'
      ? recurrenceLabels(null)
      : args.p_recurrence != null
        ? recurrenceLabels(parseRecurrenceRule(args.p_recurrence))
        : { frequency: 'keep', series_end: 'keep' }
  return { ...shape, rule_edit: ruleEdit, announce_days_before: args.p_announce_days_before ?? null }
}

/** Edit (action 'update') or retire (action 'retire', p_is_active false) an event. */
export async function updateEvent(
  supabase: SupabaseClient<Database>,
  input: { orgId: string; action: 'update' | 'retire'; args: UpdateEventArgs },
): Promise<{ ok: true } | EventRpcFailure> {
  const { error } = await privilegedRpc<Rpc['admin_update_event']['Returns']>(
    supabase,
    'admin.event.update',
    'admin_update_event',
    input.args,
    {
      event_id: input.args.p_event_id,
      org_id: input.orgId,
      action: input.action,
      location_source: input.args.p_location_source ?? 'keep',
      cleared_count: input.args.p_clear?.length ?? 0,
      ...updateSeriesLabels(input.args),
    },
  )
  if (error) return fail(error)
  return { ok: true }
}

export interface ExtendedSeries {
  /** The series' new end, 'YYYY-MM-DDTHH:MM:SS' venue local (inclusive). */
  until: string
  /** Rule dates written by this call (0 on a replay). */
  generated: number
  /** True when this idempotency key had already extended the series (nothing written). */
  replayed: boolean
}

/**
 * "Repeat for 6 more months": one extend_event_series call, exactly once per idempotency key (a
 * retry with the same key returns the first result with replayed true and writes nothing). One
 * admin_actions row (event.extend_series) and one app_logs row per extending call.
 */
export async function extendEventSeries(
  supabase: SupabaseClient<Database>,
  input: { eventId: string; orgId: string; idempotencyKey: string },
): Promise<({ ok: true } & ExtendedSeries) | EventRpcFailure> {
  const args: Rpc['extend_event_series']['Args'] = {
    p_event_id: input.eventId,
    p_idempotency_key: input.idempotencyKey,
  }
  const { data, error } = await privilegedRpc<Rpc['extend_event_series']['Returns']>(
    supabase,
    'admin.event.extend_series',
    'extend_event_series',
    args,
    { event_id: input.eventId, org_id: input.orgId },
  )
  if (error) return fail(error)
  const r = (data ?? {}) as { until?: unknown; generated?: unknown; replayed?: unknown }
  return {
    ok: true,
    until: typeof r.until === 'string' ? r.until : '',
    generated: typeof r.generated === 'number' ? r.generated : 0,
    replayed: r.replayed === true,
  }
}

/** One previewed date: venue-local calendar date, the instants, and whether a DST gap moved it. */
export interface PreviewDate {
  localDate: string
  startsAt: string
  endsAt: string
  shifted: boolean
}

export interface PreviewInput {
  rule: RecurrenceRule
  /** First date, 'YYYY-MM-DDTHH:MM' venue wall clock. */
  startsLocal: string
  endsLocal: string
  timeZone: string
  /** Label only ('' while the admin has not picked an organization). */
  orgId: string
}

/**
 * The next 5 dates of an unsaved rule (preview_event_recurrence; writes nothing). Recorded as one
 * admin.event.preview.complete / .error row. A call aborted because the admin changed the form
 * resolves { ok: false, aborted: true } and is recorded as complete (its answer is simply unused).
 */
export async function previewEventRecurrence(
  supabase: SupabaseClient<Database>,
  input: PreviewInput,
  signal: AbortSignal,
): Promise<{ ok: true; dates: PreviewDate[] } | { ok: false; aborted: boolean }> {
  const args: Rpc['preview_event_recurrence']['Args'] = {
    p_recurrence: input.rule,
    p_starts_local: input.startsLocal,
    p_ends_local: input.endsLocal,
    p_time_zone: input.timeZone,
    p_limit: 5,
  }
  try {
    return await withMetric('admin.event.preview', { frequency: input.rule.frequency, org_id: input.orgId || null }, async () => {
      const { data, error } = await supabase.rpc('preview_event_recurrence', args).abortSignal(signal)
      if (signal.aborted) return { ok: false as const, aborted: true }
      if (error) {
        const e = new Error(error.message) as Error & { code?: string }
        e.name = 'PreviewError'
        if (error.code) e.code = error.code
        throw e
      }
      return {
        ok: true as const,
        dates: (data ?? []).map((d) => ({
          localDate: String(d.local_date),
          startsAt: String(d.starts_at),
          endsAt: String(d.ends_at),
          shifted: d.shifted === true,
        })),
      }
    })
  } catch {
    return { ok: false, aborted: signal.aborted }
  }
}
