'use client'

/**
 * use-reviews.ts
 *
 * Data layer for post-exchange reviews and harmony scores.
 * Writes go through the submit_review SECDEF RPC — direct table inserts are
 * blocked by RLS (no INSERT policy).
 *
 * Supports two review paths:
 *  - opt-in path: pass optInId (resource-sharing exchange)
 *  - conversation path: pass conversationId (volunteer messaging exchange)
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
  /** Provide exactly one of optInId or conversationId. */
  optInId?: string
  conversationId?: string
  rating: number
  wouldRecommend?: boolean | null
  comment?: string | null
}

/** Map of opt_in_id → ReviewRow for reviews the current user has authored. */
export type ReviewMap = Map<string, ReviewRow>

/** Map of conversation_id → ReviewRow for conversation-path reviews. */
export type ConversationReviewMap = Map<string, ReviewRow>

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviews() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Submit a review via the SECDEF RPC.
   * For the opt-in path: pass optInId.
   * For the conversation path: pass conversationId.
   * The server determines reviewer/reviewee from auth.uid() and participant data.
   */
  const submitReview = useCallback(
    async (params: SubmitReviewParams): Promise<ReviewRow> => {
      setError(null)
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase
          .rpc('submit_review', {
            p_rating: params.rating,
            p_would_recommend: params.wouldRecommend ?? undefined,
            p_comment: params.comment ?? undefined,
            ...(params.optInId ? { p_opt_in_id: params.optInId } : {}),
            ...(params.conversationId ? { p_conversation_id: params.conversationId } : {}),
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
          if (row.opt_in_id) map.set(row.opt_in_id, row)
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

  /**
   * Fetch the current user's review for a specific conversation (or null).
   * Used by the messages panel review-prompt to detect if user already reviewed.
   */
  const fetchMyReviewForConversation = useCallback(
    async (conversationId: string): Promise<ReviewRow | null> => {
      setError(null)
      try {
        const { data, error: rpcError } = await supabase
          .rpc('get_my_conversation_review', { p_conversation_id: conversationId })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (rpcError) {
          const msg = getFriendlyErrorMessage(rpcError, "Couldn't check review status.")
          setError(msg)
          return null
        }
        // PostgREST returns {} (not null) when a RETURNS-composite function returns NULL.
        // Guard against this by checking for a real primary key value.
        const row = data as ReviewRow | null
        return (row && row.id) ? row : null
      } catch {
        return null
      }
    },
    [supabase]
  )

  return { loading, error, submitReview, fetchMyReviewsForOptIns, fetchMyReviewForConversation }
}
