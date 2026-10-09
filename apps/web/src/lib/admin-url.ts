// apps/web/src/lib/admin-url.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE place member code gets an admin URL for an item ("Edit in admin"). The mirror of
// lib/member-url.ts: every link is built here from a typed target, so an admin route change is one
// edit and a member surface never hand-builds an admin path.
//
// URL contract (the admin screens read these back with readAdminFocus in
// app/(admin)/moderation/admin-focus-url.ts, or readOrgPanelTarget for `?org=`):
//   resource      /moderation?tab=manage&focus=resource:<uuid>
//   business      /moderation?tab=businesses&focus=business:<uuid>
//   safety_alert  /moderation?tab=moderation&focus=safety_alert:<uuid>
//   post          /moderation?tab=moderation&focus=post:<uuid>
//   organization  platform admin: /moderation?tab=organizations&org=<uuid>
//                 organization admin: /moderation/org/<uuid>?tab=profile
//   event         platform admin: /moderation?tab=events&focus=event:<uuid>
//                 organization admin: /moderation/org/<orgUuid>?tab=events&focus=event:<uuid>
// The platform-admin / organization-admin split follows can_admin_org: the main shell's
// Organizations and Events tabs are platform-admin only, and an organization admin manages their
// organization on its own admin page. URLs are relative (same origin).
//
// Adding a kind: add a variant to AdminEditTarget; the exhaustive switches here and in
// lib/admin-editability.ts then fail type-check until the kind has a URL and a gate.

import { assertNever } from '@/components/feed/post-model'
import type { AdminTier } from './admin-tier'
import { orgAdminHref } from './org-admin-paths'

export type AdminEditTarget =
  | { kind: 'post'; id: string }
  | { kind: 'safety_alert'; id: string }
  | { kind: 'resource'; id: string }
  | { kind: 'business'; id: string }
  /** A non-business organization (a business has kind 'business'). */
  | { kind: 'organization'; id: string }
  /** An event; orgId is assistance_events.org_id (NOT NULL), whose admins may edit it. */
  | { kind: 'event'; id: string; orgId: string }

export type AdminEditKind = AdminEditTarget['kind']

/** Kinds an admin screen opens through `?focus=<kind>:<uuid>` (organizations use `?org=` instead). */
export const ADMIN_FOCUS_KINDS = ['resource', 'business', 'safety_alert', 'post', 'event'] as const
export type AdminFocusKind = (typeof ADMIN_FOCUS_KINDS)[number]

/** The `?tab=` each focus kind opens on (the org admin page uses 'events' for an event too). */
export const ADMIN_FOCUS_TAB: Record<AdminFocusKind, 'manage' | 'businesses' | 'moderation' | 'events'> = {
  resource: 'manage',
  business: 'businesses',
  safety_alert: 'moderation',
  post: 'moderation',
  event: 'events',
}

function focusHref(kind: AdminFocusKind, id: string): string {
  return `/moderation?tab=${ADMIN_FOCUS_TAB[kind]}&focus=${kind}:${encodeURIComponent(id)}`
}

/**
 * The admin URL that opens `target`. `tier` picks the screen for organizations and events: a
 * platform admin uses the main shell; anyone else (an organization admin) uses the organization's
 * own admin page. Whether the viewer may follow it at all is canEditInAdmin's call.
 */
export function adminEditUrl(target: AdminEditTarget, tier: AdminTier | null | undefined): string {
  switch (target.kind) {
    case 'resource':
    case 'business':
    case 'safety_alert':
    case 'post':
      return focusHref(target.kind, target.id)
    case 'organization':
      return tier === 'platform_admin'
        ? `/moderation?tab=organizations&org=${encodeURIComponent(target.id)}`
        : `${orgAdminHref(target.id)}?tab=profile`
    case 'event':
      return tier === 'platform_admin'
        ? focusHref('event', target.id)
        : `${orgAdminHref(target.orgId)}?tab=events&focus=event:${encodeURIComponent(target.id)}`
    default:
      return assertNever(target)
  }
}
