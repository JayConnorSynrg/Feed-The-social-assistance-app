'use client'

// apps/web/src/app/(admin)/moderation/org-focus.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Edit in admin" for an organization writes its one admin.deeplink.resolve row here (the claim rule
// is the shared one in admin-focus-session.ts: `?tab=` must name the claiming tab):
//   - main shell, platform admin: /moderation?tab=organizations&org=<id>&focus=organization:<id>.
//     OrgPanelFocus is mounted while the Organizations tab is shown (as a tab would be) and resolves
//     from the setup panel itself: found once the panel has loaded THAT organization; not_found when
//     the panel is for another id (or none) or its read fails / finds nothing; abandoned when the
//     panel is closed before it loaded (or the shell unmounts — the hook's own abandon).
//   - organization admin page: /moderation/org/<id>?tab=profile&focus=organization:<id>.
//     OrgProfileFocus sits in the Profile tab; the page is server-gated by can_admin_org and has
//     already read the organization, so the focus is found when it names this page's organization,
//     else not_found. (A refused or unknown id is the server's notFound() — no client, no row; see
//     docs/admin-tiers.md.)

import { useEffect, useRef } from 'react'
import { useAdminFocusSession } from './use-admin-focus'

/** What the shell's panel says about the organization it opened. */
export interface OrgPanelState {
  /** The organization the edit panel is open for, or null (closed / creating). */
  openOrgId: string | null
  /** The panel's own read of that organization: ok = loaded, !ok = failed or not found. */
  load: { orgId: string; ok: boolean } | null
}

export type OrgPanelFocusDecision = 'found' | 'not_found' | 'abandoned' | 'wait'

/**
 * The row for a claimed organization focus, given the panel now and whether it was ever open for
 * that id. Ids are compared lower-cased (readAdminFocus lower-cases; the panel id may not be).
 */
export function decideOrgPanelFocus(focusId: string, panel: OrgPanelState, wasOpenForFocus: boolean): OrgPanelFocusDecision {
  const open = panel.openOrgId?.toLowerCase() === focusId
  if (!open) return wasOpenForFocus ? 'abandoned' : 'not_found'
  if (!panel.load || panel.load.orgId.toLowerCase() !== focusId) return 'wait'
  return panel.load.ok ? 'found' : 'not_found'
}

/** Main shell: render only while the Organizations tab is shown to this viewer. */
export function OrgPanelFocus({ panel }: { panel: OrgPanelState }) {
  const session = useAdminFocusSession('organization', 'organizations')
  const wasOpen = useRef(false)
  useEffect(() => {
    if (!session?.isOpen()) return
    const decision = decideOrgPanelFocus(session.focus.id, panel, wasOpen.current)
    if (decision === 'wait') {
      wasOpen.current = true
      return
    }
    if (decision === 'abandoned') session.abandon()
    else session.resolve(decision)
  }, [session, panel])
  return null
}

/** Organization admin page: render inside its Profile tab. */
export function OrgProfileFocus({ orgId }: { orgId: string }) {
  const session = useAdminFocusSession('organization', 'profile')
  useEffect(() => {
    if (!session?.isOpen()) return
    session.resolve(session.focus.id === orgId.toLowerCase() ? 'found' : 'not_found')
  }, [session, orgId])
  return null
}
