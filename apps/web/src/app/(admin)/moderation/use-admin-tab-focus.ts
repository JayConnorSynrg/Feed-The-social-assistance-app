'use client'

// apps/web/src/app/(admin)/moderation/use-admin-tab-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A Manage / Businesses tab's "Edit in admin" landing: reads `?focus=` once on mount (each tab reads
// its own; admin-shell is untouched), and once the tab is `ready` opens the item it names or says why
// not. The lifecycle is AdminTabFocusSession (admin-tab-focus.ts); this hook only forwards React's
// mount / unmount and the tab's readiness to it, and keeps the notice to show.

import { useEffect, useState } from 'react'
import { logEvent } from '@/lib/logger'
import {
  AdminTabFocusSession,
  stripFocusFromLocation,
  type AdminFocusNotice,
  type AdminTabFocusOpen,
  type PlaceFocusTab,
} from './admin-tab-focus'

export interface UseAdminTabFocusOptions<T> extends AdminTabFocusOpen<T> {
  tab: PlaceFocusTab
  /** The tab can decide: it knows the viewer's access and can read the item. */
  ready: boolean
  access: 'allowed' | 'forbidden'
}

/** The notice for a link that opened nothing (null otherwise), and a way to dismiss it. */
export function useAdminTabFocus<T>({ tab, ready, access, read, onFound }: UseAdminTabFocusOptions<T>): {
  notice: AdminFocusNotice | null
  dismissNotice: () => void
} {
  const [notice, setNotice] = useState<AdminFocusNotice | null>(null)
  const [session] = useState(
    () =>
      new AdminTabFocusSession<T>({
        tab,
        log: (attrs) => logEvent('admin.deeplink.resolve', attrs),
        strip: () => stripFocusFromLocation(window),
        onNotice: setNotice,
      })
  )

  useEffect(() => {
    session.remount()
    session.arrive(window.location.search)
    return () => session.unmount()
  }, [session])

  useEffect(() => {
    if (ready) session.ready(access, { read, onFound })
  }, [session, ready, access, read, onFound])

  return { notice, dismissNotice: () => setNotice(null) }
}
