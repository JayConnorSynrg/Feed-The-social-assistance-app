'use client'

/**
 * use-reviews.ts
 *
 * Data layer for post-exchange reviews and harmony scores.
 * Writes go through the submit_review SECDEF RPC — direct table inserts are
 * blocked by RLS (no INSERT policy).
 *
 * PII note: comment content is never logged.
 */

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import type { Database } from '@feed/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewRow = Database['public']['Tables']['reviews']['Row']

export interface SubmitReviewParams {
  optInId: string
  rating: number
  wouldRecommend?: boolean | null
  comment?: string | null
}

/** Map of opt_in_id → ReviewRow for reviews the current user has authored. */
export type ReviewMap = Map<string, ReviewRow>

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviews() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Submit a review for a completed opt-in exchange via the SECDEF RPC.
   * The server determines the reviewer/reviewee from auth.uid() and opt-in
   * participant data — the client never sends PII directly.
   */
  const submitReview = useCallback(
    async (params: SubmitReviewParams): Promise<ReviewRow> => {
      setError(null)
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase
          .rpc('submit_review', {
            p_opt_in_id: params.optInId,
            p_rating: params.rating,
            p_would_recommend: params.wouldRecommend ?? undefined,
            p_comment: params.comment ?? undefined,
          })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (rpcError) {
          const msg = isQueryTimeout(rpcError)
            ? 'Review submission timed out — please check your connection and retry.'
            : getFriendlyErrorMessage(rpcError, "Couldn't submit review. Please try again.")
          setError(msg)
          throw new Error(msg)
        }
        return data as ReviewRow
      } catch (err: unknown) {
        if (isQueryTimeout(err)) {
          const msg = 'Review submission timed out — please check your connection and retry.'
          setError(msg)
          throw new Error(msg)
        }
        throw err
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Fetch the current user's reviews for a set of opt-in IDs in one query.
   * Returns a Map<opt_in_id, ReviewRow> for O(1) lookup per opt-in in the UI.
   * Used to determine which completed exchanges the current user has already reviewed.
   */
  const fetchMyReviewsForOptIns = useCallback(
    async (optInIds: string[]): Promise<ReviewMap> => {
      if (optInIds.length === 0) return new Map()
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return new Map()

        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select('*')
          .in('opt_in_id', optInIds)
          .eq('reviewer_id', user.id)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

        if (fetchError) throw fetchError

        const map: ReviewMap = new Map()
        for (const row of data ?? []) {
          map.set(row.opt_in_id, row)
        }
        return map
      } catch (err: unknown) {
        const msg = isQueryTimeout(err)
          ? 'Review data timed out — please check your connection and retry.'
          : getFriendlyErrorMessage(err, "Couldn't load review status. Please try again.")
        setError(msg)
        return new Map()
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  return { loading, error, submitReview, fetchMyReviewsForOptIns }
}
