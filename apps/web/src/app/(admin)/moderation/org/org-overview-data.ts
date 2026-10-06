// apps/web/src/app/(admin)/moderation/org/org-overview-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization admin page's Overview numbers. Each count is filtered to ONE organization:
// directly on org_id, or on the org_id of the embedded event through an inner join (so a row of
// another organization's event is excluded, not just hidden). Head-only counts: no rows travel.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

export interface OrgOverviewCounts {
  members: number
  activeEvents: number
  upcomingDates: number
  checkinsLast30Days: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function fetchOrgOverview(
  supabase: SupabaseClient<Database>,
  orgId: string,
  now: Date = new Date()
): Promise<OrgOverviewCounts> {
  const nowIso = now.toISOString()
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString()
  const head = { count: 'exact' as const, head: true }

  const [members, events, dates, checkins] = await Promise.all([
    supabase.from('organization_members').select('id', head).eq('org_id', orgId),
    supabase.from('assistance_events').select('id', head).eq('org_id', orgId).eq('is_active', true),
    supabase
      .from('event_occurrences')
      .select('id, event:assistance_events!inner(org_id)', head)
      .eq('event.org_id', orgId)
      .eq('status', 'upcoming')
      .gte('ends_at', nowIso),
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
