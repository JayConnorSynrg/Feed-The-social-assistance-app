'use client'

// apps/web/src/hooks/use-is-org-admin.ts
// Client-side signal: does the signed-in user administer at least one organization?
//
// Source of truth: the is_org_admin_any() SECURITY DEFINER RPC (granted EXECUTE to
// authenticated only). Used to reveal the admin entry point + shell for a NON-platform-
// admin org admin. This gates VISIBILITY only; the authoritative access gate remains the
// server-side route guard at (admin)/layout.tsx, and every org-scoped write is enforced by
// the SECDEF RPCs (is_org_admin) at the Postgres layer.
//
// The RPC runs only for a signed-in, non-anonymous user: anon has no EXECUTE (every logged-out view
// got a 42501 and an org_admin.check.failed row) and a guest cannot administer an organization
// (can_admin_org / org_event_write_gate refuse guests), so both resolve to false with no call.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'

export function useIsOrgAdmin(): boolean {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const isAnonymous = (user as { is_anonymous?: boolean } | null)?.is_anonymous === true
  // The answer, tagged with the user it is for: a new identity reads false until its own call lands.
  const [answer, setAnswer] = useState<{ userId: string; isOrgAdmin: boolean } | null>(null)

  useEffect(() => {
    if (!userId || isAnonymous) return
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
        setAnswer({ userId, isOrgAdmin: data === true })
      })

    return () => {
      active = false
    }
  }, [userId, isAnonymous])

  return !!userId && !isAnonymous && answer?.userId === userId && answer.isOrgAdmin
}
