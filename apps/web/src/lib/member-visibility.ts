// apps/web/src/lib/member-visibility.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Can a member (signed in, not an admin) see this item at its member URL right now? Each function
// mirrors the predicate of that member surface, from fields the admin row already holds. Admins read
// more than members (the *_admin_select policies), so an admin list cannot assume an item it shows is
// visible to members — these answers decide whether the row offers a "View …" link or a reason.

import type { EventFeedReason } from './event-feed-window'
import { isAlertShown } from './safety-alert-live'

export type ReasonCode =
  | 'hidden'
  | 'inactive'
  | 'not_approved'
  | 'not_found'
  // Events (lib/event-feed-window.ts): why an event is not in the members' Events list.
  | EventFeedReason
  // The members' map (below): why an item has no pin.
  | MapReasonCode

export type MemberVisibility = { visible: true } | { visible: false; reason: ReasonCode }

const VISIBLE: MemberVisibility = { visible: true }
const hiddenBecause = (reason: ReasonCode): MemberVisibility => ({ visible: false, reason })

/** Post: posts_select_public (NOT is_hidden OR owner OR staff) and /s/post/[id] reads is_hidden=false
 *  (a NULL is_hidden matches neither, so it is hidden too). null = the post row was not returned
 *  (deleted), so there is nothing to open. */
export function postVisibility(post: { is_hidden: boolean | null } | null): MemberVisibility {
  if (!post) return hiddenBecause('not_found')
  return post.is_hidden === false ? VISIBLE : hiddenBecause('hidden')
}

/** Organization (non-business): orgs_select_active (is_active AND …) and fetchOrganizationById
 *  (lib/org-data.ts) requires is_active=true. No approval step for non-business orgs. */
export function organizationVisibility(org: { is_active: boolean }): MemberVisibility {
  return org.is_active ? VISIBLE : hiddenBecause('inactive')
}

/** Business (organizations row, org_type='business'): orgs_select_active admits it when is_active AND
 *  status='approved'; fetchApprovedBusinessById (lib/business-data.ts) applies both. */
export function businessVisibility(business: { status: string; is_active: boolean }): MemberVisibility {
  if (business.status !== 'approved') return hiddenBecause('not_approved')
  return business.is_active ? VISIBLE : hiddenBecause('inactive')
}

/** Resource: /s/resource/[id] reads status='approved' (resources public select). */
export function resourceVisibility(resource: { status: string }): MemberVisibility {
  return resource.status === 'approved' ? VISIBLE : hiddenBecause('not_approved')
}

// ---- The members' map ------------------------------------------------------------------------
// "View on map" (/#map?focus=<kind>:<id>) is offered exactly when a member's map would draw the
// item's pin right now. Each predicate mirrors that layer's in-bounds reader (all SECURITY DEFINER,
// so an admin's map shows the same rows) plus the client's drop of a 0 coordinate.

/** Why an item has no pin on the members' map (in addition to inactive / not_approved). */
export type MapReasonCode = 'no_location' | 'expired'

/** A point the map draws: present, with neither coordinate 0 (use-viewport-resources /
 *  -businesses / -organizations drop a 0 lat or lng, the decode of a missing point). */
export function isMapPoint(point: { lng: number; lat: number } | null | undefined): point is { lng: number; lat: number } {
  return point != null && Number.isFinite(point.lng) && Number.isFinite(point.lat) && point.lng !== 0 && point.lat !== 0
}

/** Resource pin: resources_in_bounds (status='approved' AND location NOT NULL), lat/lng non-zero.
 *  A resource a visible business links to lands on that business's pin (the map draws one pin). */
export function resourceMapVisibility(resource: { status: string; lat: number | null; lng: number | null }): MemberVisibility {
  if (resource.status !== 'approved') return hiddenBecause('not_approved')
  const point = resource.lat == null || resource.lng == null ? null : { lat: resource.lat, lng: resource.lng }
  return isMapPoint(point) ? VISIBLE : hiddenBecause('no_location')
}

/** Organization pin (non-business): organizations_in_bounds (is_active AND location NOT NULL). */
export function organizationMapVisibility(org: { is_active: boolean; has_map_location: boolean }): MemberVisibility {
  if (!org.is_active) return hiddenBecause('inactive')
  return org.has_map_location ? VISIBLE : hiddenBecause('no_location')
}

/** Business pin: businesses_in_bounds (status='approved' AND is_active AND location NOT NULL). */
export function businessMapVisibility(business: { status: string; is_active: boolean; has_map_location: boolean }): MemberVisibility {
  if (business.status !== 'approved') return hiddenBecause('not_approved')
  if (!business.is_active) return hiddenBecause('inactive')
  return business.has_map_location ? VISIBLE : hiddenBecause('no_location')
}

/** Safety alert pin: the shown rule (lib/safety-alert-live.ts) — live, or resolved less than 6 hours
 *  ago; the map draws both. A reader row carries the server's verdict (shown_state) and that decides;
 *  `now` is used only for a row without one. A live alert past expires_at (the 5-minute expiry job
 *  has not reached it), an expired one and a resolved one past its 6 hours are expired; a removed,
 *  cleared or withdrawn alert is hidden. */
export function safetyAlertMapVisibility(
  alert: { status: string; expires_at: string; resolved_at?: string | null; shown_state?: string | null },
  now: Date,
): MemberVisibility {
  if (isAlertShown(alert, now.getTime())) return VISIBLE
  return alert.status === 'live' || alert.status === 'expired' || alert.status === 'resolved' ? hiddenBecause('expired') : hiddenBecause('hidden')
}

/** A row shows its "View on map" control (the link, or its reason) unless it would only repeat the
 *  reason the row already shows for the item's page (an inactive org reads "Inactive" once). */
export function showsMapControl(page: MemberVisibility, map: MemberVisibility): boolean {
  return map.visible || page.visible || page.reason !== map.reason
}
