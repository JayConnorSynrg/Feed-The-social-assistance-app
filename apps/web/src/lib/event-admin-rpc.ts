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
//
// mapEventError turns a SQLSTATE + stable message prefix into a dictionary key and the form
// field it belongs to, so raw database text never reaches the UI.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { privilegedRpc } from './privileged-action'
import type { EventFormMessages } from './i18n-event-forms'

type Rpc = Database['public']['Functions']
export type CreateOrgEventArgs = Rpc['create_org_event']['Args']
export type UpdateEventArgs = Rpc['admin_update_event']['Args']

export type EventErrorField = 'title' | 'org' | 'date' | 'start' | 'endDate' | 'end' | 'timeZone' | 'location' | null

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
    if (lower.startsWith('event_time_invalid:')) {
      return out(lower.includes('happens twice') ? 'errTimeRepeat' : 'errTimeGap', 'start')
    }
    if (lower.startsWith('event_invalid:')) {
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
    },
  )
  if (error) return fail(error)
  return { ok: true }
}
