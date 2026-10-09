'use client'

// apps/web/src/hooks/use-admin-viewer.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The viewer facts an "Edit in admin" link decides on (lib/admin-editability.ts): the admin tier and,
// only when the link needs it, the organizations the viewer administers.
//
// Cost per page load, however many links render:
//   - logged-out visitor / guest: zero RPCs;
//   - signed-in: the ONE shared tier lookup (resolveAdminTier, shared with useAdminTier);
//   - plus, only when a mounted link is an organization or an event (needsOrgs) and the viewer is
//     not a platform admin: ONE get_admin_org_list per user id, shared the same way. A platform admin
//     needs no list (they may edit every non-business organization).
// While anything it needs is loading, or after a failure, status is not 'ready' and no link shows.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import {
  canHoldTier,
  onAdminTierCacheReset,
  peekAdminTier,
  resetAdminTierCache,
  resolveAdminTier,
  type TierRpcClient,
  type TierUser,
} from '@/hooks/use-admin-tier'
import type { AdminEditViewer } from '@/lib/admin-editability'

type OrgListResult = { data: unknown; error: { code?: string } | null }
export type OrgListRpcClient = { rpc: (fn: 'get_admin_org_list') => PromiseLike<OrgListResult> }

export type AdminOrgIdsSnapshot = { ids: ReadonlySet<string>; ok: boolean }

type OrgEntry = { userId: string; promise: Promise<AdminOrgIdsSnapshot>; settled?: AdminOrgIdsSnapshot }
let orgEntry: OrgEntry | null = null
onAdminTierCacheReset(() => {
  orgEntry = null
})

const NO_ORGS: AdminOrgIdsSnapshot = { ids: new Set(), ok: true }

async function fetchAdminOrgIds(supabase: OrgListRpcClient): Promise<AdminOrgIdsSnapshot> {
  try {
    const { data, error } = await supabase.rpc('get_admin_org_list')
    if (error) {
      logger.warn('org_admin.check.failed', { code: error.code })
      return { ids: new Set(), ok: false }
    }
    const rows = Array.isArray(data) ? (data as Array<{ id?: unknown }>) : []
    return {
      ids: new Set(rows.flatMap((r) => (typeof r.id === 'string' ? [r.id.toLowerCase()] : []))),
      ok: true,
    }
  } catch {
    logger.warn('org_admin.check.failed', { code: 'exception' })
    return { ids: new Set(), ok: false }
  }
}

/**
 * The organizations `user` administers (get_admin_org_list), looked up at most once per user id:
 * concurrent callers share the in-flight promise, later ones the settled value. Zero RPCs for a
 * logged-out visitor or a guest. Cleared with the tier cache; a failed lookup is dropped.
 */
export function resolveAdminOrgIds(supabase: OrgListRpcClient, user: TierUser): Promise<AdminOrgIdsSnapshot> {
  if (!canHoldTier(user)) return Promise.resolve(NO_ORGS)
  if (orgEntry?.userId === user.id) return orgEntry.promise
  const entry: OrgEntry = {
    userId: user.id,
    promise: fetchAdminOrgIds(supabase).then((res) => {
      entry.settled = res
      if (!res.ok && orgEntry === entry) orgEntry = null
      return res
    }),
  }
  orgEntry = entry
  return entry.promise
}

const LOADING: AdminEditViewer = { status: 'loading', tier: null, adminOrgIds: null }
const ERROR: AdminEditViewer = { status: 'error', tier: null, adminOrgIds: null }
const NOT_SIGNED_IN: AdminEditViewer = { status: 'ready', tier: null, adminOrgIds: new Set() }

/** The viewer state already derivable from settled lookups (no RPC), else loading. */
function initialViewer(user: TierUser, needsOrgs: boolean): AdminEditViewer {
  if (!canHoldTier(user)) return LOADING
  const tier = peekAdminTier(user)
  if (!tier) return LOADING
  if (!tier.ok) return ERROR
  if (!needsOrgs || tier.tier === 'platform_admin') return { status: 'ready', tier: tier.tier, adminOrgIds: null }
  const orgs = orgEntry?.userId === user.id ? orgEntry.settled : undefined
  if (!orgs) return LOADING
  return orgs.ok ? { status: 'ready', tier: tier.tier, adminOrgIds: orgs.ids } : ERROR
}

/** `needsOrgs`: the caller's decision depends on administered organizations (organization / event). */
export function useAdminViewer(needsOrgs: boolean): AdminEditViewer {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const isAnonymous = (user as { is_anonymous?: boolean } | null)?.is_anonymous === true
  const key = `${userId ?? ''}|${isAnonymous}|${needsOrgs}`

  // The answer the effect resolved, tagged with the identity + need it was resolved for, so a new
  // identity never shows the previous one's answer while its own lookup runs.
  const [resolved, setResolved] = useState<{ key: string; viewer: AdminEditViewer } | null>(null)

  useEffect(() => {
    let active = true
    const u = userId ? { id: userId, is_anonymous: isAnonymous } : null
    if (!canHoldTier(u)) {
      resetAdminTierCache()
      return () => {
        active = false
      }
    }
    const settle = (viewer: AdminEditViewer) => {
      if (active) setResolved({ key, viewer })
    }
    const supabase = createClient()
    resolveAdminTier(supabase as unknown as TierRpcClient, u).then((tier) => {
      if (!active) return
      if (!tier.ok) return settle(ERROR)
      if (!needsOrgs || tier.tier === 'platform_admin') {
        return settle({ status: 'ready', tier: tier.tier, adminOrgIds: null })
      }
      resolveAdminOrgIds(supabase as unknown as OrgListRpcClient, u).then((orgs) => {
        settle(orgs.ok ? { status: 'ready', tier: tier.tier, adminOrgIds: orgs.ids } : ERROR)
      })
    })
    return () => {
      active = false
    }
  }, [key, userId, isAnonymous, needsOrgs])

  const u = userId ? { id: userId, is_anonymous: isAnonymous } : null
  if (!canHoldTier(u)) return NOT_SIGNED_IN
  if (resolved?.key === key) return resolved.viewer
  return initialViewer(u, needsOrgs)
}
