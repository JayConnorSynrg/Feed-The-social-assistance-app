'use client'

/**
 * use-poll.ts
 *
 * Data layer for community poll posts.
 * - createPoll(postId, question, options, endsAt?) → INSERT into polls
 * - castVote(pollId, optionIndex) → INSERT into poll_votes (UNIQUE enforces single-choice)
 * - revokeVote(pollId) → DELETE from poll_votes for current user
 * - usePollData(postId) → fetches poll + live vote tallies via Realtime subscription
 *
 * Design: tallies are derived client-side from poll_votes rows fetched per poll.
 * Realtime INSERT/DELETE events on poll_votes recompute tallies without a full refetch.
 *
 * Schema (live DB):
 *   polls:      id, post_id, question, options (Json), ends_at, multiple_choice, created_at
 *   poll_votes: id, poll_id, user_id, option_index, created_at
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { logger } from '@/lib/logger'
import type { Database } from '@feed/database'
import type { PollVoteState } from '@/components/feed/post-model'

// ---------------------------------------------------------------------------
// Types derived from generated schema
// ---------------------------------------------------------------------------

type PollRow = Database['public']['Tables']['polls']['Row']
type PollVoteRow = Database['public']['Tables']['poll_votes']['Row']
type PollInsert = Database['public']['Tables']['polls']['Insert']
type PollVoteInsert = Database['public']['Tables']['poll_votes']['Insert']

/** Poll row extended with per-option vote counts and total. */
export interface PollWithTallies extends PollRow {
  tallies: number[]
  totalVotes: number
}

// Re-export for consumers
export type { PollRow, PollVoteRow }

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

/**
 * createPoll — INSERT a new poll linked to a feed post.
 */
export async function createPoll(
  postId: string,
  question: string,
  options: string[],
  endsAt?: Date,
  multipleChoice = false
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const payload: PollInsert = {
    post_id: postId,
    question,
    options,
    ends_at: endsAt ? endsAt.toISOString() : null,
    multiple_choice: multipleChoice,
  }

  const { error } = await supabase
    .from('polls')
    .insert(payload)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

  if (error) {
    logger.error('poll.create.error', error, { postId })
    return { error: error.message }
  }

  logger.info('poll.create.success', { postId })
  return { error: null }
}

/**
 * castVote — INSERT a vote for a poll option.
 * The UNIQUE(poll_id, user_id) constraint prevents double-voting.
 */
export async function castVote(
  pollId: string,
  optionIndex: number
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const payload: PollVoteInsert = {
    poll_id: pollId,
    option_index: optionIndex,
    user_id: user.id,
  }

  const { error } = await supabase
    .from('poll_votes')
    .insert(payload)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

  if (error) {
    // Postgres unique violation code
    if (error.code === '23505') {
      return { error: 'Already voted' }
    }
    logger.error('poll.castVote.error', error, { pollId, optionIndex })
    return { error: error.message }
  }

  logger.info('poll.castVote.success', { pollId, optionIndex })
  return { error: null }
}

/**
 * revokeVote — DELETE the current user's vote for a poll.
 */
export async function revokeVote(pollId: string): Promise<{ error: string | null }> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('user_id', user.id)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

  if (error) {
    logger.error('poll.revokeVote.error', error, { pollId })
    return { error: error.message }
  }

  logger.info('poll.revokeVote.success', { pollId })
  return { error: null }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * usePollData — fetch poll + live tallies for a given postId.
 *
 * Returns:
 *   poll       — PollWithTallies or null (null while loading or when post has no poll)
 *   userVote   — option_index the current user voted for, or null if not voted
 *   loading    — true during the initial fetch
 *   error      — error string or null
 *
 * Realtime: subscribes to poll_votes INSERT/DELETE for this poll so tallies
 * update live. Subscription is cleaned up on unmount.
 */
export function usePollData(postId: string | null): {
  poll: PollWithTallies | null
  userVote: number | null
  loading: boolean
  error: string | null
  /** Overwrite the displayed vote state (optimistic apply, or revert on error). */
  setVoteState: (next: PollVoteState) => void
  /** Re-read this poll's votes and settle tallies + userVote from server truth. */
  settleVotes: () => Promise<void>
} {
  const supabase = createClient()
  const { loading: authLoading } = useAuth()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [poll, setPoll] = useState<PollWithTallies | null>(null)
  const [userVote, setUserVote] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The current poll's id, kept in a ref so settleVotes can re-read without a
  // stale closure and independently of the (W1.4) realtime channel.
  const pollIdRef = useRef<string | null>(null)

  // Derive tallies from a flat list of vote rows.
  // options is Json so we derive option count separately.
  const computeTallies = useCallback(
    (optionCount: number, votes: PollVoteRow[]): number[] => {
      const tallies = Array<number>(optionCount).fill(0)
      for (const v of votes) {
        if (v.option_index >= 0 && v.option_index < optionCount) {
          tallies[v.option_index]++
        }
      }
      return tallies
    },
    []
  )

  const fetchPollData = useCallback(async () => {
    if (!postId) {
      pollIdRef.current = null
      setPoll(null)
      setUserVote(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch poll row for this post
      const { data: pollRow, error: pollError } = await supabase
        .from('polls')
        .select('id, post_id, question, options, ends_at, multiple_choice, created_at')
        .eq('post_id', postId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        .maybeSingle()

      if (pollError) throw pollError

      if (!pollRow) {
        pollIdRef.current = null
        setPoll(null)
        setUserVote(null)
        setLoading(false)
        return
      }

      // Derive option count from the Json options field (expected to be a string array)
      const optionCount = Array.isArray(pollRow.options) ? (pollRow.options as unknown[]).length : 0

      // Fetch all votes for this poll
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select('id, poll_id, user_id, option_index, created_at')
        .eq('poll_id', pollRow.id)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (votesError) throw votesError

      const voteRows: PollVoteRow[] = votes ?? []
      const tallies = computeTallies(optionCount, voteRows)

      pollIdRef.current = pollRow.id
      setPoll({
        ...pollRow,
        tallies,
        totalVotes: voteRows.length,
      })

      // Identify current user's vote
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const myVote = voteRows.find((v) => v.user_id === user.id)
        setUserVote(myVote ? myVote.option_index : null)
      } else {
        setUserVote(null)
      }

      // Subscribe to live vote changes for this poll
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const channel = supabase
        .channel(`poll_votes_${pollRow.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'poll_votes',
            filter: `poll_id=eq.${pollRow.id}`,
          },
          (payload) => {
            const newVote = payload.new as PollVoteRow
            setPoll((prev) => {
              if (!prev) return prev
              const tallies = [...prev.tallies]
              if (newVote.option_index >= 0 && newVote.option_index < tallies.length) {
                tallies[newVote.option_index]++
              }
              return { ...prev, tallies, totalVotes: prev.totalVotes + 1 }
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'poll_votes',
            filter: `poll_id=eq.${pollRow.id}`,
          },
          (payload) => {
            const oldVote = payload.old as Partial<PollVoteRow>
            if (typeof oldVote.option_index !== 'number') return
            const idx = oldVote.option_index
            setPoll((prev) => {
              if (!prev) return prev
              const tallies = [...prev.tallies]
              if (idx >= 0 && idx < tallies.length && tallies[idx] > 0) {
                tallies[idx]--
              }
              return { ...prev, tallies, totalVotes: Math.max(0, prev.totalVotes - 1) }
            })
          }
        )
        .subscribe()

      channelRef.current = channel
    } catch (err: unknown) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        setLoading(false)
        return
      }
      setError('Unable to load poll. Please try again.')
      logger.error('poll.fetch.error', err, { postId })
    } finally {
      setLoading(false)
    }
  }, [postId, supabase, computeTallies])

  /**
   * Overwrite the displayed vote state. Used by the poll body to apply the pure
   * optimistic transition (applyVote/removeVote) immediately, and to revert to
   * the pre-click snapshot when the DB write fails.
   */
  const setVoteState = useCallback((next: PollVoteState) => {
    setPoll((prev) => (prev ? { ...prev, tallies: next.tallies, totalVotes: next.totalVotes } : prev))
    setUserVote(next.userVote)
  }, [])

  /**
   * Settle from server truth: re-read this poll's votes, recompute tallies +
   * total + the current user's choice, and write them to state. This is what
   * makes a cast/revoke visible without depending on the poll_votes realtime
   * channel (dead until W1.4). Mirrors handleLike's re-read-and-settle.
   */
  const settleVotes = useCallback(async () => {
    const pollId = pollIdRef.current
    if (!pollId) return
    try {
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select('id, poll_id, user_id, option_index, created_at')
        .eq('poll_id', pollId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      if (votesError) throw votesError
      const voteRows: PollVoteRow[] = votes ?? []
      setPoll((prev) => {
        if (!prev) return prev
        const optionCount = Array.isArray(prev.options) ? (prev.options as unknown[]).length : 0
        return { ...prev, tallies: computeTallies(optionCount, voteRows), totalVotes: voteRows.length }
      })
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserVote(user ? voteRows.find((v) => v.user_id === user.id)?.option_index ?? null : null)
    } catch (err: unknown) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('poll.settleVotes.error', err, { pollId })
    }
  }, [supabase, computeTallies])

  // Wait for auth to reconcile (guest OR user) before fetching so the query runs
  // against the reconciled session, not a pre-reconciliation guest session.
  // Gate on !authLoading only (in addition to the existing !postId guard inside
  // fetchPollData): polls are guest-readable — no user required.
  useEffect(() => {
    if (authLoading) return

    fetchPollData()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [authLoading, fetchPollData, supabase])

  return { poll, userVote, loading, error, setVoteState, settleVotes }
}
