'use client'

// apps/web/src/hooks/use-community-impact.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One read of community_impact_summary() per shell mount. The card it feeds renders under every panel and
// the shell stays mounted while panels switch, so the read is tied to the mount, not to the panel: a
// re-render reuses the answer, and the in-flight read is shared (React's development double-run of effects
// makes no second call). Retry starts one new read.
//
// Logged first-party: one impact.summary.fetch.complete / .error row per read (withMetric) with
// duration_ms, outcome (ok | failed) and suppressed_count.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withMetric } from '@/lib/logger'
import { parseImpactSummary, suppressedCount, type ImpactSummary } from '@/lib/community-impact'

export type ImpactSurface = 'overview'

export type ImpactState =
  | { status: 'loading' }
  | { status: 'ready'; summary: ImpactSummary }
  | { status: 'error' }

/** One read, never rejecting: the answer, or the error state. */
export async function fetchCommunityImpact(surface: ImpactSurface): Promise<ImpactState> {
  const attrs: Record<string, string | number> = { surface, outcome: 'failed', suppressed_count: 0 }
  try {
    const summary = await withMetric('impact.summary.fetch', attrs, async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('community_impact_summary')
      if (error) throw error
      const parsed = parseImpactSummary(data)
      if (Object.keys(parsed).length === 0) throw new Error('impact_summary_empty')
      attrs.outcome = 'ok'
      attrs.suppressed_count = suppressedCount(parsed)
      return parsed
    })
    return { status: 'ready', summary }
  } catch {
    return { status: 'error' }
  }
}

export function useCommunityImpact(surface: ImpactSurface = 'overview'): { state: ImpactState; retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ImpactState>({ status: 'loading' })
  // The read for the current attempt, shared by every effect run of this mount.
  const inflight = useRef<{ attempt: number; read: Promise<ImpactState> } | null>(null)

  useEffect(() => {
    let active = true
    if (inflight.current?.attempt !== attempt) inflight.current = { attempt, read: fetchCommunityImpact(surface) }
    void inflight.current.read.then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [attempt, surface])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])

  return { state, retry }
}
