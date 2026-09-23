'use client'

/**
 * use-my-badges.ts
 * Owner: Jelal Connor / SYNRG SCALING, LLC
 *
 * Loads the SIGNED-IN user's own engagement badges for the Settings → Profile
 * surface. get_my_profile() does not return badge_summary, so this reads it
 * directly, keyed on the caller's own auth id:
 *   - profiles.badge_summary            (public levels; SELECT granted to authenticated)
 *   - user_private_badge_summary.summary (owner-only via RLS)
 *
 * Both reads are for the caller's OWN id only; RLS enforces owner-only access to
 * the private summary regardless. Mirrors the repo read pattern (use-follows.ts,
 * use-comments.ts):
 *   - AbortSignal.timeout(QUERY_TIMEOUT_MS) on every read
 *   - a timeout ALWAYS surfaces the error state with Retry (never the empty
 *     state) — the card must not imply "No badges yet" on a failed read
 *   - the unmount abort is ignored by the hook's `!active` guard, not here
 *   - logger.error on real failure; loading always resolves in finally
 *   - singleton browser client (see pattern-supabase-singleton-stuck-spinner)
 */

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { logger } from '@/lib/logger'
import type { BadgeSummary } from '@/lib/engagement-badges'

/** User-visible copy for a read that timed out (matches use-follows.ts style). */
export const BADGES_TIMEOUT_MESSAGE =
  'Loading your badges timed out — please check your connection and retry.'

export interface MyBadgesResult {
  summary: BadgeSummary | null
  privateSummary: BadgeSummary | null
  /** User-visible error string, or null on success. */
  error: string | null
}

/**
 * Load the caller's own public + private badge summaries. Pure and node-testable
 * (see use-my-badges.test.ts): it NEVER throws — a timeout or any failure
 * resolves with `error` set and null summaries, so the caller renders the error
 * state and can never fall through to the "No badges yet" empty state on a
 * failed read. The unmount abort is handled by the hook's `!active` guard, so a
 * timeout that reaches here is a genuine read timeout and is surfaced as such.
 */
export async function loadMyBadges(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MyBadgesResult> {
  try {
    const [pub, priv] = await Promise.all([
      supabase
        .from('profiles')
        .select('badge_summary')
        .eq('id', userId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        .maybeSingle(),
      supabase
        .from('user_private_badge_summary')
        .select('summary')
        .eq('user_id', userId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        .maybeSingle(),
    ])

    if (pub.error) throw pub.error
    // A missing private row is normal (user has no private badges yet).
    if (priv.error) throw priv.error

    return {
      summary: (pub.data?.badge_summary as BadgeSummary | null) ?? null,
      privateSummary: (priv.data?.summary as BadgeSummary | null) ?? null,
      error: null,
    }
  } catch (err: unknown) {
    if (isQueryTimeout(err)) {
      // A real read timeout (unmount abort is already filtered by the hook's
      // !active guard). Surface the error with Retry — never the empty state.
      return { summary: null, privateSummary: null, error: BADGES_TIMEOUT_MESSAGE }
    }
    logger.error('my_badges_fetch_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      summary: null,
      privateSummary: null,
      error: getFriendlyErrorMessage(err, "Couldn't load your badges. Please try again."),
    }
  }
}

export interface MyBadgesState {
  summary: BadgeSummary | null
  privateSummary: BadgeSummary | null
  loading: boolean
  /** User-visible error string, or null. */
  error: string | null
  /** Re-run the fetch (used by the retry affordance). */
  reload: () => void
}

export function useMyBadges(userId: string | null | undefined): MyBadgesState {
  const supabase = createClient()
  const [summary, setSummary] = useState<BadgeSummary | null>(null)
  const [privateSummary, setPrivateSummary] = useState<BadgeSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  // All state mutation lives inside this callback (not lexically inside the
  // effect) — the effect below simply invokes it, mirroring use-notifications.ts.
  // `reload` re-runs the same flow for the Retry affordance.
  const reload = useCallback(async () => {
    if (!userId) {
      setSummary(null)
      setPrivateSummary(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await loadMyBadges(supabase, userId)
      setSummary(result.summary)
      setPrivateSummary(result.privateSummary)
      setError(result.error)
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { summary, privateSummary, loading, error, reload }
}
