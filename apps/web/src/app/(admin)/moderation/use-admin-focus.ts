'use client'

// apps/web/src/app/(admin)/moderation/use-admin-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// React bindings of admin-focus-session.ts.
//   useAdminFocusSession(kind, tab): the owning admin tab claims a `?focus=<kind>:<uuid>` on mount
//     (window.location exists only after mount) and resolves it; unmounting before that writes
//     `abandoned`. The abandon is deferred one task so React's development double-invoke of effects
//     (mount, cleanup, mount) keeps the same session instead of abandoning it.
//   useAdminFocusGate(...): the shell writes invalid / forbidden once the viewer's tabs are decided.

import { useEffect, useRef, useState } from 'react'
import { logEvent } from '@/lib/logger'
import type { AdminFocusKind } from '@/lib/admin-url'
import {
  browserAdminFocusEnv,
  claimAdminFocus,
  runAdminFocusGate,
  type AdminDeeplinkRow,
  type AdminFocusSession,
} from './admin-focus-session'

function emitResolve(row: AdminDeeplinkRow) {
  logEvent('admin.deeplink.resolve', { kind: row.kind, outcome: row.outcome, tab: row.tab })
}

/** The focus of `kind` this tab opens, or null (none in the URL, or another kind). */
export function useAdminFocusSession(kind: AdminFocusKind, tab: string): AdminFocusSession | null {
  const [session, setSession] = useState<AdminFocusSession | null>(null)
  const sessionRef = useRef<AdminFocusSession | null>(null)
  const claimedRef = useRef(false)
  const abandonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (abandonTimer.current !== null) {
      clearTimeout(abandonTimer.current)
      abandonTimer.current = null
    }
    if (!claimedRef.current) {
      claimedRef.current = true
      sessionRef.current = claimAdminFocus(browserAdminFocusEnv(emitResolve), [kind], tab)
      // window.location is readable only after mount, so the claimed session becomes state here.
      if (sessionRef.current) setSession(sessionRef.current)
    }
    return () => {
      const s = sessionRef.current
      if (s?.isOpen()) abandonTimer.current = setTimeout(() => s.abandon(), 0)
    }
  }, [kind, tab])

  return session
}

/**
 * The shell's half: once `ready` (tier and organization roles loaded, so `visibleTabs` is final),
 * write invalid / forbidden for a focus no shown tab will take. Runs once per mount. Returns that
 * row (the shell shows AdminFocusGateStatus for it), or null.
 */
export function useAdminFocusGate(
  ready: boolean,
  visibleTabs: readonly string[],
  ownerTab: (kind: AdminFocusKind) => string | null
): AdminDeeplinkRow | null {
  const ranRef = useRef(false)
  const [row, setRow] = useState<AdminDeeplinkRow | null>(null)
  useEffect(() => {
    if (!ready || ranRef.current) return
    ranRef.current = true
    const written = runAdminFocusGate(browserAdminFocusEnv(emitResolve), { visibleTabs, ownerTab })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (written) setRow(written)
  }, [ready, visibleTabs, ownerTab])
  return row
}
