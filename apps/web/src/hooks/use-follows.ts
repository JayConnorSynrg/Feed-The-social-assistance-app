'use client'

/**
 * use-follows.ts
 *
 * Social follows graph: follow/unfollow a user, fetch the set of user IDs
 * the current user follows, and expose an isFollowing helper.
 *
 * Mirrors the style of use-opt-ins.ts:
 *  - auth.getUser() guard before every Supabase query
 *  - AbortSignal.timeout(QUERY_TIMEOUT_MS) on every read
 *  - isQueryTimeout + getFriendlyErrorMessage for user-visible errors
 *  - Optimistic local-state update with revert on error
 *
 * The follows table has:
 *   follower_id uuid  NOT NULL → profiles(id) ON DELETE CASCADE
 *   following_id uuid NOT NULL → profiles(id) ON DELETE CASCADE
 *   created_at  timestamptz
 *   PRIMARY KEY (follower_id, following_id)  -- dedup-safe
 *   RLS: SELECT qual=true (public); INSERT with_check=auth.uid()=follower_id;
 *        DELETE qual=auth.uid()=follower_id
 *
 * No migration needed — table confirmed provisioned in production.
 */

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFollows() {
  const supabase = createClient()

  /** IDs that the current user follows. Empty set when unauthenticated. */
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // fetchFollowing — load the current user's followed-id set from the DB
  // ---------------------------------------------------------------------------
  const fetchFollowing = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setFollowingIds(new Set())
        return
      }

      const { data, error: fetchError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError

      setFollowingIds(new Set((data ?? []).map((r) => r.following_id)))
    } catch (err: unknown) {
      const msg = isQueryTimeout(err)
        ? 'Follows data timed out — please check your connection and retry.'
        : getFriendlyErrorMessage(err, "Couldn't load follows. Please try again.")
      setError(msg)
      setFollowingIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // ---------------------------------------------------------------------------
  // follow — insert a follows row; optimistic add, revert on error
  // ---------------------------------------------------------------------------
  const follow = useCallback(
    async (targetUserId: string): Promise<void> => {
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to follow someone.')
        return
      }
      // Guard: cannot follow yourself
      if (user.id === targetUserId) return

      // Optimistic add
      setFollowingIds((prev) => new Set([...prev, targetUserId]))

      const { error: insertError } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetUserId })

      if (insertError) {
        // Revert optimistic update
        setFollowingIds((prev) => {
          const next = new Set(prev)
          next.delete(targetUserId)
          return next
        })
        const msg = getFriendlyErrorMessage(insertError, "Couldn't follow. Please try again.")
        setError(msg)
      }
    },
    [supabase]
  )

  // ---------------------------------------------------------------------------
  // unfollow — delete the follows row; optimistic remove, revert on error
  // ---------------------------------------------------------------------------
  const unfollow = useCallback(
    async (targetUserId: string): Promise<void> => {
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to unfollow someone.')
        return
      }

      // Optimistic remove
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetUserId)
        return next
      })

      const { error: deleteError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)

      if (deleteError) {
        // Revert optimistic update
        setFollowingIds((prev) => new Set([...prev, targetUserId]))
        const msg = getFriendlyErrorMessage(deleteError, "Couldn't unfollow. Please try again.")
        setError(msg)
      }
    },
    [supabase]
  )

  // ---------------------------------------------------------------------------
  // isFollowing — O(1) lookup helper
  // ---------------------------------------------------------------------------
  const isFollowing = useCallback(
    (targetUserId: string): boolean => followingIds.has(targetUserId),
    [followingIds]
  )

  return {
    followingIds,
    loading,
    error,
    fetchFollowing,
    follow,
    unfollow,
    isFollowing,
  }
}
