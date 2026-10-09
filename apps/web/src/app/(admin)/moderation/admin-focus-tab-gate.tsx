'use client'

// apps/web/src/app/(admin)/moderation/admin-focus-tab-gate.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// An "Edit in admin" link to the Manage or Businesses tab, followed by a viewer whose tier does not
// show that tab (e.g. a community moderator): the tab never mounts, so it cannot answer the link.
// This gate, rendered next to the admin shell on /moderation, settles it instead — once the viewer's
// tier is known: one admin.deeplink.resolve row with outcome 'forbidden', and `focus` stripped. When
// the tab is shown, the tab itself answers (use-admin-tab-focus.ts) and this gate does nothing, so
// every link still writes exactly one row. Renders nothing; its tier lookup is the page's shared one.

import { useEffect, useRef } from 'react'
import { logEvent } from '@/lib/logger'
import { useAdminViewer } from '@/hooks/use-admin-viewer'
import type { AdminEditViewer } from '@/lib/admin-editability'
import { hiddenTabFocus, stripFocusFromLocation } from './admin-tab-focus'

/** The gate's one decision for a settled viewer: log + strip when the link's tab is hidden. */
export function settleHiddenTabFocus(
  viewer: AdminEditViewer,
  win: Parameters<typeof stripFocusFromLocation>[0],
  log: typeof logEvent = logEvent
): void {
  // A failed tier lookup leaves the shell with no tier tabs, so the link's tab is hidden too.
  const hit = hiddenTabFocus(win.location.search, viewer.status === 'ready' ? viewer.tier : null)
  if (!hit) return
  log('admin.deeplink.resolve', { kind: hit.kind, outcome: 'forbidden', tab: hit.tab })
  stripFocusFromLocation(win)
}

export function AdminFocusTabGate() {
  const viewer = useAdminViewer(false)
  const done = useRef(false)
  useEffect(() => {
    if (done.current || viewer.status === 'loading') return
    done.current = true
    settleHiddenTabFocus(viewer, window)
  }, [viewer])
  return null
}
