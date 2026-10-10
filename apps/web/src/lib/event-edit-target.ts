// apps/web/src/lib/event-edit-target.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE builder of the event edit dialog's target (components/events/event-edit-dialog.tsx), used
// by the admin scheduler (its list rows already carry these columns) and by an event card's ⋯ menu
// on the feed / Events tab (which reads the event by id when the menu opens — the card itself
// carries only display fields). The edit form starts from the event's stored values: title, type,
// description, place name, time zone, repeat rule and series time, the post-ahead lead, and the next
// upcoming date (proposed as the first date when a one-off event starts repeating).
//
// Read through the normal RLS select of assistance_events (anyone may read an active event of an
// active organization; the save RPC decides permission).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import type { EditTarget } from '@/components/events/event-edit-dialog'

/** The event row shape the edit target is built from (a scheduler list row is a superset). */
export interface EditTargetRow {
  id: string
  org_id: string
  title: string
  event_type: string
  description: string | null
  location_name: string | null
  time_zone: string
  is_active: boolean
  recurrence: unknown
  series_start_local: string | null
  series_duration: string | null
  announce_days_before: number
  /** The event's next upcoming, not-ended date (0 or 1 row). */
  next: ReadonlyArray<{ starts_at: string; ends_at: string }> | null
}

export const EDIT_TARGET_SELECT =
  'id, org_id, title, event_type, description, location_name, time_zone, is_active, recurrence, series_start_local, series_duration, announce_days_before, ' +
  'next:event_occurrences(starts_at, ends_at)'

/** The edit dialog's target for an event row (scheduler Edit button, "Edit in admin" link, card menu). */
export function toEditTarget(event: EditTargetRow): EditTarget {
  const next = event.next?.[0] ?? null
  return {
    id: event.id,
    org_id: event.org_id,
    title: event.title,
    event_type: event.event_type,
    description: event.description,
    location_name: event.location_name,
    time_zone: event.time_zone,
    is_active: event.is_active,
    recurrence: event.recurrence,
    series_start_local: event.series_start_local,
    series_duration: event.series_duration,
    announce_days_before: event.announce_days_before,
    next: next ? { starts_at: next.starts_at, ends_at: next.ends_at } : null,
  }
}

/** One event by id as an edit target (its next upcoming, not-ended date embedded); null when the
 *  read returned no row. Throws the PostgREST error when the read fails. */
export async function loadEditTarget(
  supabase: SupabaseClient<Database>,
  eventId: string,
  { nowIso = new Date().toISOString(), timeoutMs = 12_000 }: { nowIso?: string; timeoutMs?: number } = {},
): Promise<EditTarget | null> {
  const { data, error } = await supabase
    .from('assistance_events')
    .select(EDIT_TARGET_SELECT)
    .eq('id', eventId)
    .eq('next.status', 'upcoming')
    .gte('next.ends_at', nowIso)
    .order('starts_at', { referencedTable: 'next', ascending: true })
    .limit(1, { referencedTable: 'next' })
    .abortSignal(AbortSignal.timeout(timeoutMs))
    .maybeSingle()
  if (error) throw error
  return data ? toEditTarget(data as unknown as EditTargetRow) : null
}
