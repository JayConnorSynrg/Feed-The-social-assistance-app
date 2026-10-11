'use client'

// apps/web/src/hooks/use-safety-strip.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed's alert strip: the top five shown alerts (live first, then resolved for six hours), read
// through the one reader (lib/safety-alert-rpc.ts readSafetyAlertStrip) with the server's is_mine.
// When it reads (lib/safety-alerts-fetch.ts KeyedPollScheduler, keyed on the viewer — a string):
// once per viewer, every 60 s while the tab is visible, once when the tab becomes visible again, and
// once after the member's own update / resolve / withdraw (host.refresh). Re-renders schedule
// nothing. Only the latest read's answer is applied. Placing and voting happen on the map panel;
// panels unmount on switch, so coming back to the feed mounts this hook and reads again.
// Between reads the store (lib/safety-alert-store.ts) drops an alert at its "shown until" instant.
// Each read's difference from the list before is announced by the rule in
// lib/safety-alert-announce.ts; the member's own actions announce their own notice (host.announce).

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logEvent, logger } from '@/lib/logger'
import { KeyedPollScheduler, PollCounter, createLatestOnlyLoader } from '@/lib/safety-alerts-fetch'
import { SafetyAlertStore, alertsSignature } from '@/lib/safety-alert-store'
import { stripAnnouncement, type StripEvent } from '@/lib/safety-alert-announce'
import { isAlertShown } from '@/lib/safety-alert-live'
import { AlertReadError, readSafetyAlertStrip, type SafetyAlert } from '@/lib/safety-alert-rpc'

/** What the strip's two live regions hold. `seq` moves with every new message, so the same sentence
 *  twice in a row is still announced. */
export interface StripLive {
  assertive: StripEvent[]
  polite: StripEvent[]
  /** The outcome of the member's own action (already in their language). */
  notice: string
  seq: number
}

/** What an alert dialog asks of the surface that opened it. */
export interface AlertHost {
  /** An RPC answer: merge it onto the alert held (the pin keeps its place). */
  applyAnswer: (alert: SafetyAlert) => void
  /** The alert is gone (withdrawn, or found ended): take it out at once. */
  leave: (alertId: string) => void
  /** Read again now (settle from the server after the member's own action). */
  refresh: () => void
  /** Say what the member's action did (polite). */
  announce: (notice: string) => void
  /** Move focus to the place that follows an alert that left (called before the notice). */
  focusAfterLeave: () => void
}

const QUIET: StripLive = { assertive: [], polite: [], notice: '', seq: 0 }

/** The strip item that takes focus when `alertId` leaves: the next one, else the one before. */
export function neighbourOf(alerts: readonly SafetyAlert[], alertId: string): string | null {
  const i = alerts.findIndex((a) => a.id === alertId)
  if (i === -1) return null
  return alerts[i + 1]?.id ?? alerts[i - 1]?.id ?? null
}

export function useSafetyStrip(viewerKey: string | null, focusFallback: () => void) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [live, setLive] = useState<StripLive>(QUIET)
  // The instant of the last change to the list: the clock the strip renders ages and states with.
  const [now, setNow] = useState(() => Date.now())
  const [store] = useState(
    () =>
      new SafetyAlertStore((list) => {
        setAlerts(list)
        setNow(Date.now())
      })
  )
  const [counter] = useState(() => new PollCounter('strip', (row) => logEvent('alerts.poll', { ...row })))
  const [scheduler] = useState(() => {
    // The viewer whose list the store holds: a new viewer starts from an empty, silent baseline.
    let viewer: string | null = null
    let first = true
    const load = createLatestOnlyLoader<string, SafetyAlert[]>({
      read: () => readSafetyAlertStrip(supabase),
      onStart: () => {},
      onResult: (rows) => {
        counter.record({ signature: alertsSignature(rows), count: rows.length })
        const now = Date.now()
        const before = first ? null : store.list().filter((a) => isAlertShown(a, now))
        first = false
        store.replace(rows)
        const said = stripAnnouncement(before, rows, now)
        if (said.assertive.length > 0 || said.polite.length > 0) {
          setLive((l) => ({ assertive: said.assertive, polite: said.polite, notice: '', seq: l.seq + 1 }))
        }
      },
      onError: (err) => {
        counter.record({ signature: null, count: 0 })
        logger.warn('feed.safety_alerts.fetch_failed', { code: err instanceof AlertReadError && err.code ? err.code : 'exception' })
      },
      onSettled: () => {},
    })
    return new KeyedPollScheduler<string>({
      fetch: (key) => {
        if (key !== viewer) {
          viewer = key
          first = true
          store.replace([])
        }
        void load(key)
      },
      isVisible: () => document.visibilityState === 'visible',
      debounceMs: 0,
    })
  })

  useEffect(() => {
    scheduler.set(viewerKey, viewerKey)
  }, [scheduler, viewerKey])

  useEffect(
    () => () => {
      scheduler.dispose()
      store.dispose()
      counter.flush()
    },
    [scheduler, store, counter],
  )

  // A hidden tab skips the poll (and writes its read count); coming back reads once at once.
  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible'
      if (!visible) counter.flush()
      scheduler.visibilityChanged(visible)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [scheduler, counter])

  // `focusFallback` is read once: hand over a stable function (the feed heading's focus).
  const [host] = useState<AlertHost>(() => {
    // The strip item that takes focus after an alert left (set by leave, used once).
    let neighbour: string | null = null
    return {
      applyAnswer: (alert) => store.apply(alert),
      leave: (alertId) => {
        neighbour = neighbourOf(store.list(), alertId)
        store.remove(alertId)
      },
      refresh: () => scheduler.refresh(),
      announce: (notice) => setLive((l) => ({ assertive: [], polite: [], notice, seq: l.seq + 1 })),
      focusAfterLeave: () => {
        const next = neighbour
        neighbour = null
        const item = next ? document.querySelector<HTMLElement>(`[data-testid="safety-strip-item-${next}"]`) : null
        if (item) item.focus()
        else focusFallback()
      },
    }
  })

  const setEngaged = useCallback((alertId: string, engaged: boolean) => store.setEngaged(alertId, engaged), [store])

  return { alerts, live, now, host, setEngaged }
}
