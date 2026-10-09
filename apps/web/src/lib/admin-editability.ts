// apps/web/src/lib/admin-editability.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// May this viewer edit this item in admin? The ONE client decision behind every "Edit in admin"
// link. It mirrors the server gate of the admin screen the link opens, so a link appears exactly
// when that screen will accept it (never a link to a refusal or a 404, never a missing link where
// the server allows):
//
//   post, safety_alert  tier >= community_moderator   admin_remove/hold/authorize_post,
//                                                     admin_verify/remove_safety_alert
//   resource            tier >= resource_admin        admin_update_resource
//   business            canEditBusinesses(tier)        orgs_admin_update (platform admin today)
//   organization        platform admin, or an admin    can_admin_org
//                       of that organization
//   event               platform admin, or an admin    org_event_write_gate on the event's org_id
//                       of the event's organization
//
// "Administers" = the organization is in viewer.adminOrgIds, the result of get_admin_org_list for a
// non-platform admin: active, non-business organizations where the viewer's organization_members
// role is 'admin' — exactly the organization-admin branch of can_admin_org / org_event_write_gate.
//
// Fail closed: a viewer that is still loading, failed to load, is logged out or a guest (tier null,
// no organizations), or holds an unknown tier value gets no link. Visibility only — the admin
// screens and their RPCs remain the authority.

import { assertNever } from '@/components/feed/post-model'
import { canEditBusinesses, tierAtLeast, type AdminTier } from './admin-tier'
import type { AdminEditTarget } from './admin-url'

export interface AdminEditViewer {
  /** 'ready' once everything this viewer's decision needs has loaded. */
  status: 'loading' | 'ready' | 'error'
  tier: AdminTier | null
  /** Lower-cased ids of the organizations the viewer administers; null = not loaded (or not needed:
   *  a platform admin may edit every non-business organization). */
  adminOrgIds: ReadonlySet<string> | null
}

function administers(viewer: AdminEditViewer, orgId: string): boolean {
  return viewer.adminOrgIds?.has(orgId.toLowerCase()) ?? false
}

export function canEditInAdmin(target: AdminEditTarget, viewer: AdminEditViewer): boolean {
  if (viewer.status !== 'ready') return false
  const { tier } = viewer
  switch (target.kind) {
    case 'post':
    case 'safety_alert':
      return tierAtLeast(tier, 'community_moderator')
    case 'resource':
      return tierAtLeast(tier, 'resource_admin')
    case 'business':
      return canEditBusinesses(tier)
    case 'organization':
      return tier === 'platform_admin' || administers(viewer, target.id)
    case 'event':
      return tier === 'platform_admin' || administers(viewer, target.orgId)
    default:
      return assertNever(target)
  }
}

/** True for the kinds whose decision needs the administered-organization list (non-platform admins). */
export function needsAdminOrgIds(kind: AdminEditTarget['kind']): boolean {
  return kind === 'organization' || kind === 'event'
}
