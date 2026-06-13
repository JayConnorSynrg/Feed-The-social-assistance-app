'use client'

// apps/web/src/hooks/use-is-admin.ts
// Client-side admin signal for conditional UI (nav + settings entries).
//
// Source of truth: the is_current_user_admin() SECURITY DEFINER RPC — the same
// gate enforced by the server-side (admin)/layout.tsx. We call the RPC rather
// than reading profiles.is_admin directly because the PII-hardening migrations
// revoked direct column SELECT on profiles.is_admin from the authenticated role;
// the RPC (granted EXECUTE to authenticated + anon) is the only supported read.
//
// This hook gates VISIBILITY only. The authoritative access gate remains the
// server-side route guard at (admin)/layout.tsx — a non-admin who reaches
// /moderation is still redirected to '/'.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    supabase
      .rpc('is_current_user_admin')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          logger.warn('admin.check.failed', { code: error.code })
          return
        }
        setIsAdmin(data === true)
      })

    return () => {
      active = false
    }
  }, [])

  return isAdmin
}
