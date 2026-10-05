'use client'

// apps/web/src/hooks/use-admin-tier.ts
// Client-side tier signal for conditional UI (nav + admin shell tabs + People tab).
//
// Source of truth: the current_user_tier() SECURITY DEFINER RPC — the same value the database
// derives is_admin/is_staff from. We call the RPC rather than reading profiles.admin_tier directly
// because the tier column is SELECT-only for clients and reading it for the current user through a
// helper keeps a single supported path (mirrors use-is-admin.ts).
//
// The RPCs run only for a signed-in, non-anonymous user. A logged-out visitor or a guest
// (anonymous auth) has no tier by definition, and guests lack EXECUTE on current_user_tier(), so
// calling it for them only produced a 42501 warn row per page view.
//
// This hook gates VISIBILITY only. The authoritative access gate remains the server-side route
// guard at (admin)/layout.tsx plus the per-RPC tier checks.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import type { AdminTier } from '@/lib/admin-tier'

export type UseAdminTier = { tier: AdminTier | null; isFounder: boolean; loading: boolean }

type TierUser = { id: string; is_anonymous?: boolean } | null | undefined
type RpcResult = { data: unknown; error: { code?: string } | null }
type TierRpcClient = { rpc: (fn: 'current_user_tier' | 'is_founder') => PromiseLike<RpcResult> }

/** True only for a signed-in, non-anonymous user — the only callers that can hold a tier. */
export function canHoldTier(user: TierUser): boolean {
  return !!user && user.is_anonymous !== true
}

/**
 * Resolve the viewer's tier + founder flag. Returns `{ tier: null, isFounder: false }` without
 * any RPC call when the viewer is logged out or a guest.
 */
export async function loadAdminTier(
  supabase: TierRpcClient,
  user: TierUser
): Promise<{ tier: AdminTier | null; isFounder: boolean }> {
  if (!canHoldTier(user)) return { tier: null, isFounder: false }
  const [tierRes, founderRes] = await Promise.all([
    supabase.rpc('current_user_tier'),
    supabase.rpc('is_founder'),
  ])
  let tier: AdminTier | null = null
  if (tierRes.error) {
    logger.warn('admin.tier.check_failed', { code: tierRes.error.code })
  } else {
    tier = (tierRes.data as AdminTier | null) ?? null
  }
  return { tier, isFounder: !founderRes.error && founderRes.data === true }
}

export function useAdminTier(): UseAdminTier {
  const { user } = useAuth()
  const [tier, setTier] = useState<AdminTier | null>(null)
  const [isFounder, setIsFounder] = useState(false)
  const [loading, setLoading] = useState(true)

  // Re-resolve when the identity changes (sign-in, sign-out, guest upgrade).
  const userId = user?.id ?? null
  const isAnonymous = (user as { is_anonymous?: boolean } | null)?.is_anonymous === true

  useEffect(() => {
    let active = true
    const tierUser = userId ? { id: userId, is_anonymous: isAnonymous } : null
    loadAdminTier(createClient() as unknown as TierRpcClient, tierUser).then((res) => {
      if (!active) return
      setTier(res.tier)
      setIsFounder(res.isFounder)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [userId, isAnonymous])

  return { tier, isFounder, loading }
}
