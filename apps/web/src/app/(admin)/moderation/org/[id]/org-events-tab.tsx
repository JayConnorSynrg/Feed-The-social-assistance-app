'use client'

// apps/web/src/app/(admin)/moderation/org/[id]/org-events-tab.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Events tab of the organization admin page. Contract: OrgEventsTab({ orgId }) shows and creates
// events for that one organization only. Today it renders the shared EventScheduler with
// selectedOrgId = orgId: given a concrete org id (not 'all'), the scheduler loads only that
// organization's events, creates new events for it, and hides its organization picker.

import { EventScheduler } from '../../event-scheduler'

export function OrgEventsTab({ orgId }: { orgId: string }) {
  return <EventScheduler selectedOrgId={orgId} source="org_admin_events" />
}
