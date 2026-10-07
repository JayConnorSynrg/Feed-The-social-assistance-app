// apps/web/src/app/(admin)/moderation/org/org-overview-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization admin page's Overview numbers. Each count is filtered to ONE organization:
// directly on org_id, or on the org_id of the embedded event through an inner join (so a row of
// another organization's event is excluded, not just hidden). Head-only counts: no rows travel.
// "Upcoming event dates" counts the next 30 days only: a repeating event already holds about six
// months of generated dates, which would make an all-future count meaningless.
//
// fetchEndingSoon: this organization's repeating events whose last date is within 30 days (or
// already passed) — org_events_ending_soon, same gate as the page. A failed load is logged
// (admin.event.ending_soon.load_failed, warn) and shown as an error, never as an empty list.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { logger } from '@/lib/logger'

export interface OrgOverviewCounts {
  members: number
  activeEvents: number
  upcomingDates: number
  checkinsLast30Days: number
}

const DAY_MS = 24 * 60 * 60 * 1000
/** Look-ahead of the "Upcoming event dates" tile and of the ending-soon list. */
export const UPCOMING_DAYS = 30

export async function fetchOrgOverview(
  supabase: SupabaseClient<Database>,
  orgId: string,
  now: Date = new Date()
): Promise<OrgOverviewCounts> {
  const nowIso = now.toISOString()
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString()
  const until = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString()
  const head = { count: 'exact' as const, head: true }

  const [members, events, dates, checkins] = await Promise.all([
    supabase.from('organization_members').select('id', head).eq('org_id', orgId),
    supabase.from('assistance_events').select('id', head).eq('org_id', orgId).eq('is_active', true),
    supabase
      .from('event_occurrences')
      .select('id, event:assistance_events!inner(org_id)', head)
      .eq('event.org_id', orgId)
      .eq('status', 'upcoming')
      .gte('ends_at', nowIso)
      .lt('starts_at', until),
    supabase
      .from('event_checkins')
      .select('id, occurrence:event_occurrences!inner(event:assistance_events!inner(org_id))', head)
      .eq('occurrence.event.org_id', orgId)
      .gte('checked_in_at', since),
  ])

  const failed = [members, events, dates, checkins].find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)

  return {
    members: members.count ?? 0,
    activeEvents: events.count ?? 0,
    upcomingDates: dates.count ?? 0,
    checkinsLast30Days: checkins.count ?? 0,
  }
}

export interface EndingSoonSeries {
  eventId: string
  title: string
  /** The venue-local date of the series' last date, YYYY-MM-DD (null when it cannot be told). */
  lastDate: string | null
  /** Dates left from today through the last one (0 once it passed). */
  remaining: number
}

/** This organization's repeating events ending within 30 days (or already ended), soonest first. */
export async function fetchEndingSoon(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<{ ok: true; series: EndingSoonSeries[] } | { ok: false }> {
  const { data, error } = await supabase.rpc('org_events_ending_soon', { p_org_id: orgId, p_within_days: UPCOMING_DAYS })
  if (error) {
    logger.warn('admin.event.ending_soon.load_failed', { code: error.code ?? null, org_id: orgId })
    return { ok: false }
  }
  return {
    ok: true,
    series: (data ?? []).map((r) => ({
      eventId: r.event_id,
      title: r.title,
      lastDate: r.last_local_date ?? null,
      remaining: r.remaining_dates ?? 0,
    })),
  }
}
