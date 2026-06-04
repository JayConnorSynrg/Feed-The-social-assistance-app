'use client'

/**
 * use-opt-ins.ts
 *
 * Data layer for resource opt-ins: opt in via RPC, withdraw via RPC,
 * and fetch the current user's opt-in rows for a set of post IDs in
 * a single query (no N+1).
 *
 * Both RPCs are SECURITY DEFINER and enforce caller identity via auth.uid()
 * server-side — client simply calls them.
 */

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import type { Database } from '@feed/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OptInRow = Database['public']['Tables']['resource_opt_ins']['Row']

/** Map of post_id → status for the current user's existing opt-ins. */
export type OptInMap = Map<string, OptInRow['status']>

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOptIns() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch the current user's opt-in rows for a list of post IDs.
   * Returns a Map<post_id, status> for fast lookup in the UI.
   * Applies the project timeout pattern.
   */
  const fetchOptInsForPosts = useCallback(
    async (postIds: string[]): Promise<OptInMap> => {
      if (postIds.length === 0) return new Map()
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return new Map()

        const { data, error: fetchError } = await supabase
          .from('resource_opt_ins')
          .select('post_id, status')
          .in('post_id', postIds)
          .eq('seeker_id', user.id)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

        if (fetchError) throw fetchError

        const map: OptInMap = new Map()
        for (const row of data ?? []) {
          map.set(row.post_id, row.status)
        }
        return map
      } catch (err: unknown) {
        const msg = isQueryTimeout(err)
          ? 'Opt-in data timed out — please check your connection and retry.'
          : getFriendlyErrorMessage(err, "Couldn't load opt-in status. Please try again.")
        setError(msg)
        return new Map()
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Opt in to a post via the server-side RPC.
   * Returns the inserted row on success, or throws a friendly error string.
   */
  const optIn = useCallback(
    async (postId: string): Promise<OptInRow> => {
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('opt_in_to_post', {
        p_post_id: postId,
      })
      if (rpcError) {
        const msg = getFriendlyErrorMessage(rpcError, "Couldn't opt in. Please try again.")
        setError(msg)
        throw new Error(msg)
      }
      return data as OptInRow
    },
    [supabase]
  )

  /**
   * Withdraw a pending opt-in via the server-side RPC.
   * Returns true if a row was deleted.
   */
  const withdrawOptIn = useCallback(
    async (postId: string): Promise<boolean> => {
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('withdraw_opt_in', {
        p_post_id: postId,
      })
      if (rpcError) {
        const msg = getFriendlyErrorMessage(rpcError, "Couldn't withdraw opt-in. Please try again.")
        setError(msg)
        throw new Error(msg)
      }
      return data as boolean
    },
    [supabase]
  )

  return { loading, error, fetchOptInsForPosts, optIn, withdrawOptIn }
}
