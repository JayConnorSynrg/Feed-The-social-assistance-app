'use client'

// apps/web/src/components/admin/admin-edit-link-island.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// AdminEditLink, rendered in the browser only. Server-rendered pages (/s/resource, /s/business,
// /s/organization) and the SPA shell (whose server HTML the Capacitor static export bakes in) place
// this island instead of the link itself, so no admin link is ever part of server HTML: the server
// snapshot is "not mounted" (nothing renders), and the browser renders the real link after
// hydration — still nothing unless canEditInAdmin allows this viewer (admin-edit-link.tsx).

import { useSyncExternalStore } from 'react'
import { AdminEditLink, type AdminEditLinkProps } from './admin-edit-link'

const noopSubscribe = () => () => {}

/** True in the browser after hydration; false on the server and during hydration. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

export function AdminEditLinkIsland(props: AdminEditLinkProps) {
  const isClient = useIsClient()
  return isClient ? <AdminEditLink {...props} /> : null
}
