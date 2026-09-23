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
 *   - isQueryTimeout treats a timeout / in-flight-fetch abort as benign so the
 *     spinner is always cleared (see pattern-nextjs-fetch-abort) and a friendly
 *     error is shown for real failures
 *   - logger.error on failure; loading always resolves in finally
 *   - singleton browser client (see pattern-supabase-singleton-stuck-spinner)
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { logger } from '@/lib/logger'
import type { BadgeSummary } from '@/lib/engagement-badges'

export interface MyBadgesState {
  summary: BadgeSummary | null
  privateSummary: BadgeSummary | null
  loading: boolean
  /** User-visible error string, or null. Timeouts/aborts are benign (null). */
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
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!userId) {
      setSummary(null)
      setPrivateSummary(null)
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    void (async () => {
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

        if (!active) return
        if (pub.error) throw pub.error
        // A missing private row is normal (user has no private badges yet).
        if (priv.error) throw priv.error

        setSummary((pub.data?.badge_summary as BadgeSummary | null) ?? null)
        setPrivateSummary((priv.data?.summary as BadgeSummary | null) ?? null)
        setError(null)
      } catch (err: unknown) {
        if (!active) return
        if (isQueryTimeout(err)) {
          // Timeout or an in-flight fetch aborted by a Next.js auth re-render:
          // benign — clear the spinner, keep whatever we already have.
          return
        }
        logger.error('my_badges_fetch_failed', {
          error: err instanceof Error ? err.message : String(err),
        })
        setError(getFriendlyErrorMessage(err, "Couldn't load your badges. Please try again."))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [userId, supabase, nonce])

  return { summary, privateSummary, loading, error, reload }
}
