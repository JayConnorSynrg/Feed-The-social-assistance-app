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

/**
 * What a read of the current user's opt-ins answers. "The read failed" is not "no opt-ins": a
 * caller that wrote an empty map for a failed read would show Opt In on posts the member is
 * signed up to.
 */
export type OptInsRead = { ok: true; statuses: OptInMap } | { ok: false }

/**
 * What opt_in_to_post answers when it refuses for a reason the member can act on. Each is handed
 * to the card as it is — a code the card turns into the member's sentence
 * (lib/i18n-feed-optins.ts) — so "This offer is full" is no longer replaced by the plain
 * "Couldn't opt in". Any other server text still becomes the plain failure and is never shown.
 */
export const OPT_IN_REFUSALS: readonly string[] = ['This offer is full', 'This post is closed', 'You cannot opt in to your own post', 'Already opted in']

/** The member's sentence as the thrown error, with the server's code kept for the log row
 *  (lib/with-metric-core.mjs serializeError reads `code`). */
function withCode(error: Error, code: string | undefined): Error {
  return code ? Object.assign(error, { code }) : error
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOptIns() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch the current user's opt-in rows for a list of post IDs.
   * Answers { ok: true, statuses: Map<post_id, status> } — a post with no entry has no opt-in —
   * or { ok: false } when the read failed (the caller keeps what it has).
   * Applies the project timeout pattern.
   */
  const fetchOptInsForPosts = useCallback(
    async (postIds: string[]): Promise<OptInsRead> => {
      if (postIds.length === 0) return { ok: true, statuses: new Map() }
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return { ok: true, statuses: new Map() }

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
        return { ok: true, statuses: map }
      } catch (err: unknown) {
        const msg = isQueryTimeout(err)
          ? 'Opt-in data timed out — please check your connection and retry.'
          : getFriendlyErrorMessage(err, "Couldn't load opt-in status. Please try again.")
        setError(msg)
        return { ok: false }
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Opt in to a post via the server-side RPC.
   * Returns the inserted row on success, or throws a friendly error string (carrying the
   * server's code, for the caller's log row). `requestId`, when given, is sent as x-request-id.
   */
  const optIn = useCallback(
    async (postId: string, requestId?: string): Promise<OptInRow> => {
      setError(null)
      const call = supabase.rpc('opt_in_to_post', {
        p_post_id: postId,
      })
      const { data, error: rpcError } = await (requestId ? call.setHeader('x-request-id', requestId) : call)
      if (rpcError) {
        const msg = OPT_IN_REFUSALS.includes(rpcError.message)
          ? rpcError.message
          : getFriendlyErrorMessage(rpcError, "Couldn't opt in. Please try again.")
        setError(msg)
        throw withCode(new Error(msg), rpcError.code)
      }
      return data as OptInRow
    },
    [supabase]
  )

  /**
   * Withdraw a pending opt-in via the server-side RPC.
   * Returns true if a row was deleted (`requestId`, when given, is sent as x-request-id). FALSE IS NOT A FAILURE OF THE CALL: withdraw_opt_in deletes
   * only a pending row and answers false, with no error, when there was none (the request was
   * accepted, declined or already withdrawn meanwhile). The caller must not report it as done.
   */
  const withdrawOptIn = useCallback(
    async (postId: string, requestId?: string): Promise<boolean> => {
      setError(null)
      const call = supabase.rpc('withdraw_opt_in', {
        p_post_id: postId,
      })
      const { data, error: rpcError } = await (requestId ? call.setHeader('x-request-id', requestId) : call)
      if (rpcError) {
        const msg = getFriendlyErrorMessage(rpcError, "Couldn't withdraw opt-in. Please try again.")
        setError(msg)
        throw withCode(new Error(msg), rpcError.code)
      }
      return data === true
    },
    [supabase]
  )

  return { loading, error, fetchOptInsForPosts, optIn, withdrawOptIn }
}
