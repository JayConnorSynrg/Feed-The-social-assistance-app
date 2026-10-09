// apps/web/src/components/feed/event-card-menu.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What an event card's ⋯ menu offers (pure; the menu itself is components/events/event-card-admin-menu.tsx).
// Only someone who may manage the event gets a menu: a platform admin, or an admin of the event's
// organization — the same rule as "Edit in admin" (lib/admin-editability.ts canEditInAdmin 'event',
// mirroring org_event_write_gate). Everyone else (members, guests, logged-out visitors, an admin of
// another organization, and anyone while that lookup is loading or after it failed) gets nothing.
//
// The items mirror the admin scheduler's rules for the same event:
//   Edit event      always (the edit dialog also retires);
//   Add dates       always — a card is shown only for an active event of an active organization
//                   (event_feed_next), which is when the scheduler offers it;
//   Cancel date     the card's shown date, while it is upcoming and has not ended (the database
//                   refuses an ended date). A shown date that is already cancelled, or has ended,
//                   keeps the item with the reason, so the admin learns why;
//   Edit in admin   the event's edit dialog in the admin screen ("feed-admin" tab) — offered only
//                   when both ids are UUIDs, the link's own condition (admin-edit-link.tsx
//                   hasValidIds), so the menu never holds an item that renders nothing.

import { canEditInAdmin, type AdminEditViewer } from '@/lib/admin-editability'
import { isUuid } from '@/lib/org-admin-paths'
import type { EventCardItem } from './post-model'

export type EventMenuEntry =
  | { action: 'edit' }
  | { action: 'add_dates' }
  | { action: 'cancel_date'; unavailable: null | 'cancelled' | 'ended' }
  | { action: 'open_admin' }

/** May this viewer manage the event (and so see its menu)? */
export function canManageEvent(event: Pick<EventCardItem, 'eventId' | 'orgId'>, viewer: AdminEditViewer): boolean {
  return canEditInAdmin({ kind: 'event', id: event.eventId, orgId: event.orgId }, viewer)
}

/** Why the card's shown date cannot be cancelled from here; null = it can. */
export function cancelDateUnavailable(
  event: Pick<EventCardItem, 'cancelledShown' | 'status' | 'endsAt'>,
  nowMs: number,
): null | 'cancelled' | 'ended' {
  // A cancelled shown date: the card times the event's NEXT date, which is not this card's date.
  if (event.cancelledShown !== null || event.status === 'cancelled') return 'cancelled'
  if (event.status === 'completed' || new Date(event.endsAt).getTime() < nowMs) return 'ended'
  return null
}

/** The menu's entries for this viewer, in display order; [] = no menu. */
export function eventMenuEntries(
  event: Pick<EventCardItem, 'eventId' | 'orgId' | 'cancelledShown' | 'status' | 'endsAt'>,
  viewer: AdminEditViewer,
  nowMs: number,
): EventMenuEntry[] {
  if (!canManageEvent(event, viewer)) return []
  return [
    { action: 'edit' },
    { action: 'add_dates' },
    { action: 'cancel_date', unavailable: cancelDateUnavailable(event, nowMs) },
    ...(isUuid(event.eventId) && isUuid(event.orgId) ? [{ action: 'open_admin' } as const] : []),
  ]
}
