'use client'

/**
 * use-poll.ts
 *
 * Data layer for community poll posts.
 * - createPoll(postId, question, options, closesAt?) → INSERT into polls
 * - castVote(pollId, choiceIndex) → INSERT into poll_votes (UNIQUE enforces single-choice)
 * - revokeVote(pollId) → DELETE from poll_votes for current user
 * - usePollData(postId) → fetches poll + live vote tallies via Realtime subscription
 *
 * Design: tallies are derived client-side from poll_votes rows fetched per poll.
 * Realtime INSERT/DELETE events on poll_votes recompute tallies without a full refetch.
 *
 * TODO: The `polls` and `poll_votes` tables are not yet present in the generated database
 * types (packages/database/types.ts). Once the migration for post_type='poll' is applied
 * and `supabase gen types typescript` is re-run, replace the `(supabase as any)` casts
 * below with properly-typed calls using Database['public']['Tables']['polls']['Row'] and
 * Database['public']['Tables']['poll_votes']['Row'].
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a row in the polls table. */
export interface PollRow {
  id: string
  post_id: string
  question: string
  options: string[]
  closes_at: string | null
  created_at: string
}

/** Shape of a row in the poll_votes table. */
export interface PollVoteRow {
  id: string
  poll_id: string
  voter_id: string
  choice_index: number
  created_at: string
}

/** Poll row extended with per-option vote counts and total. */
export interface PollWithTallies extends PollRow {
  tallies: number[]
  totalVotes: number
}

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
  closesAt?: Date
): Promise<{ error: string | null }> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('polls')
    .insert({
      post_id: postId,
      question,
      options,
      closes_at: closesAt ? closesAt.toISOString() : null,
    })
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

  if (error) {
    logger.error('poll.create.error', { postId, error: error.message })
    return { error: error.message }
  }

  logger.info('poll.create.success', { postId })
  return { error: null }
}

/**
 * castVote — INSERT a vote for a poll option.
 * The UNIQUE(poll_id, voter_id) constraint prevents double-voting.
 */
export async function castVote(
  pollId: string,
  choiceIndex: number
): Promise<{ error: string | null }> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('poll_votes')
    .insert({ poll_id: pollId, choice_index: choiceIndex })
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

  if (error) {
    // Postgres unique violation code
    if (error.code === '23505') {
      return { error: 'Already voted' }
    }
    logger.error('poll.castVote.error', { pollId, choiceIndex, error: error.message })
    return { error: error.message }
  }

  logger.info('poll.castVote.success', { pollId, choiceIndex })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('voter_id', user.id)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

  if (error) {
    logger.error('poll.revokeVote.error', { pollId, error: error.message })
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
 *   userVote   — choice_index the current user voted for, or null if not voted
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
} {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [poll, setPoll] = useState<PollWithTallies | null>(null)
  const [userVote, setUserVote] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Derive tallies from a flat list of vote rows
  const computeTallies = useCallback(
    (optionCount: number, votes: PollVoteRow[]): number[] => {
      const tallies = Array<number>(optionCount).fill(0)
      for (const v of votes) {
        if (v.choice_index >= 0 && v.choice_index < optionCount) {
          tallies[v.choice_index]++
        }
      }
      return tallies
    },
    []
  )

  const fetchPollData = useCallback(async () => {
    if (!postId) {
      setPoll(null)
      setUserVote(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch poll row for this post
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pollRow, error: pollError } = await (supabase as any)
        .from('polls')
        .select('id, post_id, question, options, closes_at, created_at')
        .eq('post_id', postId)
        .maybeSingle()
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (pollError) throw pollError

      if (!pollRow) {
        setPoll(null)
        setUserVote(null)
        setLoading(false)
        return
      }

      const typedPollRow = pollRow as PollRow

      // Fetch all votes for this poll
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: votes, error: votesError } = await (supabase as any)
        .from('poll_votes')
        .select('id, poll_id, voter_id, choice_index, created_at')
        .eq('poll_id', typedPollRow.id)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (votesError) throw votesError

      const voteRows = (votes ?? []) as PollVoteRow[]
      const tallies = computeTallies(typedPollRow.options.length, voteRows)

      setPoll({
        ...typedPollRow,
        tallies,
        totalVotes: voteRows.length,
      })

      // Identify current user's vote
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const myVote = voteRows.find((v) => v.voter_id === user.id)
        setUserVote(myVote ? myVote.choice_index : null)
      } else {
        setUserVote(null)
      }

      // Subscribe to live vote changes for this poll
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const channel = supabase
        .channel(`poll_votes_${typedPollRow.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'poll_votes',
            filter: `poll_id=eq.${typedPollRow.id}`,
          },
          (payload) => {
            const newVote = payload.new as PollVoteRow
            setPoll((prev) => {
              if (!prev) return prev
              const tallies = [...prev.tallies]
              if (newVote.choice_index >= 0 && newVote.choice_index < tallies.length) {
                tallies[newVote.choice_index]++
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
            filter: `poll_id=eq.${typedPollRow.id}`,
          },
          (payload) => {
            const oldVote = payload.old as Partial<PollVoteRow>
            if (typeof oldVote.choice_index !== 'number') return
            const idx = oldVote.choice_index
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
      console.error('use-poll fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [postId, supabase, computeTallies])

  useEffect(() => {
    fetchPollData()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [fetchPollData, supabase])

  return { poll, userVote, loading, error }
}
