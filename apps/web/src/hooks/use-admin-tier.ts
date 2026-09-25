'use client'

// apps/web/src/hooks/use-admin-tier.ts
// Client-side tier signal for conditional UI (nav + admin shell tabs + People tab).
//
// Source of truth: the current_user_tier() SECURITY DEFINER RPC — the same value the database
// derives is_admin/is_staff from. We call the RPC rather than reading profiles.admin_tier directly
// because the tier column is SELECT-only for clients and reading it for the current user through a
// helper keeps a single supported path (mirrors use-is-admin.ts).
//
// This hook gates VISIBILITY only. The authoritative access gate remains the server-side route
// guard at (admin)/layout.tsx plus the per-RPC tier checks.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { AdminTier } from '@/lib/admin-tier'

export type UseAdminTier = { tier: AdminTier | null; isFounder: boolean; loading: boolean }

export function useAdminTier(): UseAdminTier {
  const [tier, setTier] = useState<AdminTier | null>(null)
  const [isFounder, setIsFounder] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    Promise.all([
      supabase.rpc('current_user_tier'),
      supabase.rpc('is_founder'),
    ]).then(([tierRes, founderRes]) => {
      if (!active) return
      if (tierRes.error) {
        // Guests lack EXECUTE on current_user_tier() -> treated as no tier.
        logger.warn('admin.tier.check_failed', { code: tierRes.error.code })
      } else {
        setTier((tierRes.data as AdminTier | null) ?? null)
      }
      if (!founderRes.error) setIsFounder(founderRes.data === true)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  return { tier, isFounder, loading }
}
