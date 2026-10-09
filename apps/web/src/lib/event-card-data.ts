// apps/web/src/lib/event-card-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Loads the event cards for a list of shown dates — one pass shared by the community feed
// (ranked_feed_v2 event rows) and the Events tab (upcoming_events rows):
//   1. hydrate the shown occurrences (event / org fields through the normal RLS selects);
//   2. in parallel:
//      - for a shown date that was cancelled (the server keeps the event listed while that date
//        is announced and not ended) and whose next date the caller does not already have — the
//        feed; upcoming_events returns it for the Events tab: the event's next upcoming,
//        not-ended date (one embedded read: assistance_events -> event_occurrences, filtered,
//        first by start);
//      - the member's own check-in state for the shown upcoming dates (event-checkin-state).
// Step 1 failing fails the load (the caller shows its error state); a step-2 read failing leaves
// the cards up without that piece and is logged.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { logger } from './logger'
import { emptyCheckinState, loadCheckinState, type CheckinState, type CheckinStateSurface } from './event-checkin-state'
import {
  applyNextDates,
  buildEventCards,
  EVENT_OCCURRENCE_SELECT,
  upcomingEventRefs,
  type EventCardItem,
  type EventOccurrenceRow,
  type NextDateRow,
  type ShownEventRef,
  type UpcomingEventRow,
} from '@/components/feed/post-model'

export const EVENT_CARD_TIMEOUT_MS = 12_000

export interface EventCardsResult {
  items: EventCardItem[]
  checkin: CheckinState
}

export interface LoadEventCardsOptions {
  surface: CheckinStateSurface
  userId: string | null
  isGuest: boolean
  nowMs?: number
  timeoutMs?: number
}

function errorCode(error: unknown): string {
  const e = error as { code?: unknown; name?: unknown } | null
  if (e && typeof e.code === 'string' && e.code) return e.code
  if (e && typeof e.name === 'string' && e.name) return e.name
  return 'unknown'
}

/** The next upcoming, not-ended date of each event; null when the read failed. */
export async function loadNextDates(
  supabase: SupabaseClient<Database>,
  eventIds: readonly string[],
  nowMs: number,
  timeoutMs: number,
  surface: CheckinStateSurface,
): Promise<Map<string, NextDateRow> | null> {
  const out = new Map<string, NextDateRow>()
  if (eventIds.length === 0) return out
  try {
    const { data, error } = await supabase
      .from('assistance_events')
      .select('id, next:event_occurrences(id, starts_at, ends_at, status)')
      .in('id', [...new Set(eventIds)])
      .eq('next.status', 'upcoming')
      .gte('next.ends_at', new Date(nowMs).toISOString())
      .order('starts_at', { referencedTable: 'next', ascending: true })
      .limit(1, { referencedTable: 'next' })
      .abortSignal(AbortSignal.timeout(timeoutMs))
    if (error) throw error
    for (const row of (data ?? []) as unknown as Array<{ id: string; next: NextDateRow[] | null }>) {
      const next = row.next?.[0]
      if (next) out.set(row.id, next)
    }
    return out
  } catch (err) {
    logger.warn('events.next_date.load_failed', { surface, code: errorCode(err) })
    return null
  }
}

export async function loadEventCards(
  supabase: SupabaseClient<Database>,
  refs: readonly ShownEventRef[],
  {
    surface,
    userId,
    isGuest,
    nowMs = Date.now(),
    timeoutMs = EVENT_CARD_TIMEOUT_MS,
  }: LoadEventCardsOptions,
): Promise<EventCardsResult> {
  if (refs.length === 0) return { items: [], checkin: { statuses: {}, anonClaims: new Set() } }

  const { data, error } = await supabase
    .from('event_occurrences')
    .select(EVENT_OCCURRENCE_SELECT)
    .in('id', refs.map((r) => r.occurrenceId))
    .abortSignal(AbortSignal.timeout(timeoutMs))
  if (error) throw error
  const cards = buildEventCards(refs, (data ?? []) as unknown as EventOccurrenceRow[])

  const nextUnknown = cards.filter((c) => c.cancelledShown === 'unknown')
  const upcomingShown = cards.filter((c) => c.cancelledShown === null)
  const [nextByEvent, checkin] = await Promise.all([
    nextUnknown.length > 0
      ? loadNextDates(supabase, nextUnknown.map((c) => c.eventId), nowMs, timeoutMs, surface)
      : Promise.resolve(new Map<string, NextDateRow>()),
    // Check-in applies to an upcoming shown date only; a cancelled one has nothing to check in to.
    loadCheckinState(supabase, {
      userId,
      isGuest,
      occurrenceIds: upcomingShown.map((c) => c.occurrenceId),
      surface,
      timeoutMs,
    }),
  ])

  return { items: applyNextDates(cards, nextByEvent), checkin }
}

/** upcoming_events has no upper clamp on p_limit; reading one event's row needs every shown event
 *  (the rule is computed over all of them either way; each row is ids and times only). */
const ALL_SHOWN_EVENTS = 10_000

export interface ReloadedEventCard {
  /** The event's card as the feed / Events tab would now show it; null = the event is no longer
   *  shown (retired, or no announced, not-ended date). */
  item: EventCardItem | null
  checkin: CheckinState
}

/**
 * Re-read ONE event's card after its admin changed it from that card (edit, add dates, cancel a
 * date), without reloading the list it sits in. Which date the card shows is the server's rule
 * (event_feed_next, through upcoming_events — the same rows ranked_feed_v2 places in the feed);
 * the card is then hydrated exactly as a list load hydrates it (loadEventCards with that one shown
 * date). Throws when a read fails (the caller keeps the card it has and logs).
 */
export async function reloadEventCard(
  supabase: SupabaseClient<Database>,
  eventId: string,
  options: LoadEventCardsOptions,
): Promise<ReloadedEventCard> {
  const { data, error } = await supabase
    .rpc('upcoming_events', { p_limit: ALL_SHOWN_EVENTS })
    .abortSignal(AbortSignal.timeout(options.timeoutMs ?? EVENT_CARD_TIMEOUT_MS))
  if (error) throw error
  const row = ((data ?? []) as UpcomingEventRow[]).find((r) => r.event_id === eventId)
  if (!row) return { item: null, checkin: emptyCheckinState() }
  const { items, checkin } = await loadEventCards(supabase, upcomingEventRefs([row]), options)
  return { item: items[0] ?? null, checkin }
}
