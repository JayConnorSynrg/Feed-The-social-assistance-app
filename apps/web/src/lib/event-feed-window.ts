// apps/web/src/lib/event-feed-window.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Is this event in the members' Events list right now — and if not, when will it be, or why not?
// A clause-by-clause mirror of public.event_feed_next(now()) — the rule upcoming_events (the Events
// tab) and ranked_feed_v2 share — in supabase/migrations/20261023000000_events_recurring_announce.sql.
// The admin event scheduler shows "View in feed" exactly when this says listed.
//
// The caller passes the event's soonest occurrence that is not ended and is either 'upcoming' or
// cancelled for a reason other than retired / org_inactive (event-scheduler.tsx's feed_next
// embed). That one date decides the event: every other filter of event_feed_next (the 32-day scan
// cap, the announce day) holds for a later date only if it holds for an earlier one, so when the
// soonest qualifying date is not shown yet, no later date is either.

import { venueDateKey } from './event-time'

export interface FeedWindowEvent {
  is_active: boolean
  time_zone: string
  /** Days before its local date that a date is shown (0/1/3/7/14/30). */
  announce_days_before: number
}

export interface FeedWindowOccurrence {
  starts_at: string
  ends_at: string
  status: string
  cancel_reason: string | null
}

export type EventFeedReason = 'retired' | 'org_inactive' | 'no_upcoming'

export type EventFeedStatus =
  | { listed: true }
  | { listed: false; appearsAt: Date }
  | { listed: false; reason: EventFeedReason }

/** event_feed_next: `eo.starts_at <= p_now + interval '32 days'` (the scan cap). */
const SCAN_CAP_MS = 32 * 24 * 60 * 60 * 1000
const MINUTE_MS = 60_000

/** 'YYYY-MM-DD' minus n days (a calendar-date subtraction, like Postgres `date - integer`). */
function minusDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}

const localDateAt = (ms: number, tz: string) => venueDateKey(new Date(ms).toISOString(), tz)

/**
 * The first instant whose venue-local date is >= dateKey: 00:00 venue time, or the first minute
 * after a DST gap where a zone skips midnight. This is the instant
 * `(p_now AT TIME ZONE tz)::date >= dateKey` turns true. UTC offsets lie within -12h..+14h, so
 * that instant lies within 16 hours of the date's UTC midnight; a binary search over minutes
 * (offsets are whole minutes) finds it.
 */
export function startOfVenueDate(dateKey: string, tz: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d)
  let lo = (utcMidnight - 16 * 60 * MINUTE_MS) / MINUTE_MS // local date < dateKey here
  let hi = (utcMidnight + 16 * 60 * MINUTE_MS) / MINUTE_MS // local date >= dateKey here
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (localDateAt(mid * MINUTE_MS, tz) >= dateKey) hi = mid
    else lo = mid
  }
  return new Date(hi * MINUTE_MS)
}

/** event_date_announced (:317-325): `(p_now AT TIME ZONE tz)::date >= (p_starts_at AT TIME ZONE tz)::date - p_days`. */
function announced(now: Date, startsAt: string, tz: string, days: number): boolean {
  return localDateAt(now.getTime(), tz) >= minusDays(venueDateKey(startsAt, tz), days)
}

/** The moment event_date_announced turns true for this date: 00:00 venue time on (local start date - days). */
function announceInstant(startsAt: string, tz: string, days: number): Date {
  return startOfVenueDate(minusDays(venueDateKey(startsAt, tz), days), tz)
}

export function eventFeedStatus(
  event: FeedWindowEvent,
  next: FeedWindowOccurrence | null | undefined,
  orgActive: boolean,
  now: Date,
): EventFeedStatus {
  // event_feed_next :418 `AND ae.is_active`
  if (!event.is_active) return { listed: false, reason: 'retired' }
  // :419 `AND org.is_active`
  if (!orgActive) return { listed: false, reason: 'org_inactive' }
  if (!next) return { listed: false, reason: 'no_upcoming' }
  // :412-415 status = 'upcoming' OR (cancelled AND cancel_reason IS DISTINCT FROM 'retired' / 'org_inactive')
  const shownStatus =
    next.status === 'upcoming' ||
    (next.status === 'cancelled' && next.cancel_reason !== 'retired' && next.cancel_reason !== 'org_inactive')
  if (!shownStatus) return { listed: false, reason: 'no_upcoming' }
  // :416 `AND eo.ends_at >= p_now`
  if (Date.parse(next.ends_at) < now.getTime()) return { listed: false, reason: 'no_upcoming' }

  // :417 `AND eo.starts_at <= p_now + interval '32 days'`
  const withinScan = Date.parse(next.starts_at) <= now.getTime() + SCAN_CAP_MS
  // :420 event_date_announced(p_now, eo.starts_at, ae.time_zone, ae.announce_days_before)
  const isAnnounced = announced(now, next.starts_at, event.time_zone, event.announce_days_before)
  if (withinScan && isAnnounced) return { listed: true }

  // Not yet: both clauses turn (and stay) true at the later of their two instants.
  const announceAt = announceInstant(next.starts_at, event.time_zone, event.announce_days_before).getTime()
  const scanAt = Date.parse(next.starts_at) - SCAN_CAP_MS
  return { listed: false, appearsAt: new Date(Math.max(announceAt, scanAt)) }
}
