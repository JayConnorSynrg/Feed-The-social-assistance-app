'use client'

// apps/web/src/hooks/use-is-org-admin.ts
// Client-side signal: does the signed-in user administer at least one organization?
//
// Source of truth: the is_org_admin_any() SECURITY DEFINER RPC (granted EXECUTE to
// authenticated only). Used to reveal the admin entry point + shell for a NON-platform-
// admin org admin. This gates VISIBILITY only; the authoritative access gate remains the
// server-side route guard at (admin)/layout.tsx, and every org-scoped write is enforced by
// the SECDEF RPCs (is_org_admin) at the Postgres layer.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export function useIsOrgAdmin(): boolean {
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    supabase
      .rpc('is_org_admin_any')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          logger.warn('org_admin.check.failed', { code: error.code })
          return
        }
        setIsOrgAdmin(data === true)
      })

    return () => {
      active = false
    }
  }, [])

  return isOrgAdmin
}
