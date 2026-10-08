// apps/web/src/lib/member-visibility.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Can a member (signed in, not an admin) see this item at its member URL right now? Each function
// mirrors the predicate of that member surface, from fields the admin row already holds. Admins read
// more than members (the *_admin_select policies), so an admin list cannot assume an item it shows is
// visible to members — these answers decide whether the row offers a "View …" link or a reason.

import type { EventFeedReason } from './event-feed-window'

export type ReasonCode =
  | 'hidden'
  | 'inactive'
  | 'not_approved'
  | 'not_found'
  // Events (lib/event-feed-window.ts): why an event is not in the members' Events list.
  | EventFeedReason

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
