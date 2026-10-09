'use client'

// apps/web/src/components/admin/client-admin-edit-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// AdminEditLink for member surfaces that may be server-rendered (the /s/post page, feed cards, the
// Events tab, map popups): it renders only after hydration, so an admin link is never part of
// server HTML or of a cached page, and the first client render matches the server's (nothing).
// After mount it is exactly AdminEditLink (the canEditInAdmin gate, the shared viewer lookup, the
// reused "feed-admin" tab, one admin.nav.edit_in_admin row per click).

import { useSyncExternalStore } from 'react'
import { AdminEditLink, type AdminEditLinkProps } from './admin-edit-link'

const noSubscribe = () => () => {}

/** False on the server and during hydration, true once mounted in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  )
}

export function ClientAdminEditLink(props: AdminEditLinkProps) {
  const hydrated = useHydrated()
  if (!hydrated) return null
  return <AdminEditLink {...props} />
}
