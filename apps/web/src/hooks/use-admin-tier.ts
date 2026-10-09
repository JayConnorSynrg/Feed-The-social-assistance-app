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
// One lookup per identity per page: every mounted useAdminTier() / useAdminViewer() shares one
// in-flight-then-settled result per signed-in user id (resolveAdminTier below), so the 8 call sites
// plus any number of "Edit in admin" links cost ONE current_user_tier + is_founder pair. A different
// user id replaces the entry; sign-out or a guest session clears it. A failed lookup is not kept, so
// the next consumer to mount retries.
//
// This hook gates VISIBILITY only. The authoritative access gate remains the server-side route
// guard at (admin)/layout.tsx plus the per-RPC tier checks.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import type { AdminTier } from '@/lib/admin-tier'

export type UseAdminTier = { tier: AdminTier | null; isFounder: boolean; loading: boolean }

export type TierUser = { id: string; is_anonymous?: boolean } | null | undefined
type RpcResult = { data: unknown; error: { code?: string } | null }
export type TierRpcClient = { rpc: (fn: 'current_user_tier' | 'is_founder') => PromiseLike<RpcResult> }

/** True only for a signed-in, non-anonymous user — the only callers that can hold a tier. */
export function canHoldTier(user: TierUser): user is { id: string; is_anonymous?: boolean } {
  return !!user && user.is_anonymous !== true
}

/** The tier lookup's outcome. ok=false: the tier RPC failed (or threw), so the tier is unknown. */
export type AdminTierSnapshot = { tier: AdminTier | null; isFounder: boolean; ok: boolean }

const NO_TIER: AdminTierSnapshot = { tier: null, isFounder: false, ok: true }

async function fetchAdminTier(supabase: TierRpcClient): Promise<AdminTierSnapshot> {
  try {
    const [tierRes, founderRes] = await Promise.all([
      supabase.rpc('current_user_tier'),
      supabase.rpc('is_founder'),
    ])
    if (tierRes.error) {
      logger.warn('admin.tier.check_failed', { code: tierRes.error.code })
      return { tier: null, isFounder: false, ok: false }
    }
    return {
      tier: (tierRes.data as AdminTier | null) ?? null,
      isFounder: !founderRes.error && founderRes.data === true,
      ok: true,
    }
  } catch {
    logger.warn('admin.tier.check_failed', { code: 'exception' })
    return { tier: null, isFounder: false, ok: false }
  }
}

/**
 * Resolve the viewer's tier + founder flag. Returns `{ tier: null, isFounder: false }` without
 * any RPC call when the viewer is logged out or a guest. Uncached; components use resolveAdminTier.
 */
export async function loadAdminTier(
  supabase: TierRpcClient,
  user: TierUser
): Promise<{ tier: AdminTier | null; isFounder: boolean }> {
  if (!canHoldTier(user)) return { tier: null, isFounder: false }
  const { tier, isFounder } = await fetchAdminTier(supabase)
  return { tier, isFounder }
}

// ---- Shared single-flight (module scope = one per page load) -----------------------------------
type TierEntry = { userId: string; promise: Promise<AdminTierSnapshot>; settled?: AdminTierSnapshot }
let tierEntry: TierEntry | null = null
const resetListeners = new Set<() => void>()

/** Forget every cached admin lookup (sign-out, guest session). Other admin caches register here. */
export function resetAdminTierCache(): void {
  tierEntry = null
  resetListeners.forEach((fn) => fn())
}

/** Register a cache that must be cleared with the tier cache (returns the unregister function). */
export function onAdminTierCacheReset(fn: () => void): () => void {
  resetListeners.add(fn)
  return () => resetListeners.delete(fn)
}

/**
 * The tier of `user`, looked up at most once per user id however many callers ask: concurrent
 * callers share the in-flight promise, later ones the settled value. Zero RPCs for a logged-out
 * visitor or a guest. A different user id replaces the entry; a failed lookup is dropped.
 */
export function resolveAdminTier(supabase: TierRpcClient, user: TierUser): Promise<AdminTierSnapshot> {
  if (!canHoldTier(user)) return Promise.resolve(NO_TIER)
  if (tierEntry?.userId === user.id) return tierEntry.promise
  const entry: TierEntry = {
    userId: user.id,
    promise: fetchAdminTier(supabase).then((res) => {
      entry.settled = res
      if (!res.ok && tierEntry === entry) tierEntry = null
      return res
    }),
  }
  tierEntry = entry
  return entry.promise
}

/** The settled tier of `user` when already known (no RPC), else undefined. */
export function peekAdminTier(user: TierUser): AdminTierSnapshot | undefined {
  if (!canHoldTier(user)) return NO_TIER
  return tierEntry?.userId === user.id ? tierEntry.settled : undefined
}

export function useAdminTier(): UseAdminTier {
  const { user } = useAuth()

  // Re-resolve when the identity changes (sign-in, sign-out, guest upgrade).
  const userId = user?.id ?? null
  const isAnonymous = (user as { is_anonymous?: boolean } | null)?.is_anonymous === true
  const tierUser = userId ? { id: userId, is_anonymous: isAnonymous } : null

  // A settled lookup for this signed-in user (another consumer resolved it) renders at once.
  const known = canHoldTier(tierUser) ? peekAdminTier(tierUser) : undefined
  const [tier, setTier] = useState<AdminTier | null>(known?.tier ?? null)
  const [isFounder, setIsFounder] = useState(known?.isFounder ?? false)
  const [loading, setLoading] = useState(known === undefined)

  useEffect(() => {
    let active = true
    const u = userId ? { id: userId, is_anonymous: isAnonymous } : null
    if (!canHoldTier(u)) resetAdminTierCache()
    resolveAdminTier(createClient() as unknown as TierRpcClient, u).then((res) => {
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
