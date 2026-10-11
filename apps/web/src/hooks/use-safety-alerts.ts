'use client'

// apps/web/src/hooks/use-safety-alerts.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The members' map layer of safety alerts: every shown alert in the viewport (live, and resolved for
// six hours), read through the one reader (lib/safety-alert-rpc.ts readSafetyAlertsInView).
// When it reads (lib/safety-alerts-fetch.ts): one read per real viewport change (debounced 400 ms,
// keyed on the four bound NUMBERS, so a re-render with the same bounds schedules nothing), a 60 s
// poll while the tab is visible (alerts are not in the realtime publication, so the reporter's id
// never transits the WAL), one read when the tab becomes visible again, and one right after the
// member's own place / vote / update / resolve / withdraw. Only the latest read's answer is applied.
// Between reads the store (lib/safety-alert-store.ts) merges RPC answers onto the pins it holds
// (coordinates and is_mine kept) and drops a pin at its "shown until" instant.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logEvent, logger } from '@/lib/logger'
import { PollCounter, SafetyAlertsFetchScheduler, createLatestOnlyLoader } from '@/lib/safety-alerts-fetch'
import { SafetyAlertStore, alertsSignature } from '@/lib/safety-alert-store'
import {
  placeSafetyAlert,
  readSafetyAlertsInView,
  voteSafetyAlert,
  type AlertOutcome,
  type AlertVote,
  type PlaceAlertInput,
  type SafetyAlert,
  type ViewportBounds,
} from '@/lib/safety-alert-rpc'
import type { AlertHost } from '@/hooks/use-safety-strip'

export type { PlaceAlertInput, SafetyAlert, ViewportBounds }

/** The map's polite notice for alert actions. `seq` moves with every message. */
export interface AlertNotice {
  text: string
  seq: number
}

export function useSafetyAlerts(viewportBounds: ViewportBounds | null) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [notice, setNotice] = useState<AlertNotice>({ text: '', seq: 0 })
  // The instant of the last change to the list: the clock the markers render ages and states with.
  const [now, setNow] = useState(() => Date.now())
  const [store] = useState(
    () =>
      new SafetyAlertStore((list) => {
        setAlerts(list)
        setNow(Date.now())
      })
  )
  const [counter] = useState(() => new PollCounter('map', (row) => logEvent('alerts.poll', { ...row })))

  // Only the latest read's answer is applied: a slow answer for an older viewport is dropped.
  const [fetchAlerts] = useState(() =>
    createLatestOnlyLoader<ViewportBounds, SafetyAlert[]>({
      read: (bounds) => readSafetyAlertsInView(supabase, bounds),
      onStart: () => {
        setLoading(true)
        setError(null)
      },
      onResult: (rows) => {
        counter.record({ signature: alertsSignature(rows), count: rows.length })
        store.replace(rows)
      },
      onError: (err) => {
        counter.record({ signature: null, count: 0 })
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.fetch.error', e)
        setError(e)
      },
      onSettled: () => setLoading(false),
    })
  )

  const [scheduler] = useState(
    () =>
      new SafetyAlertsFetchScheduler({
        fetch: (bounds) => void fetchAlerts(bounds),
        isVisible: () => document.visibilityState === 'visible',
      })
  )

  // The four numbers, not the bounds object: an effect keyed on an object's identity re-runs on every
  // render that builds a new one.
  const west = viewportBounds?.west ?? null
  const south = viewportBounds?.south ?? null
  const east = viewportBounds?.east ?? null
  const north = viewportBounds?.north ?? null
  useEffect(() => {
    scheduler.setBounds(west === null || south === null || east === null || north === null ? null : { west, south, east, north })
  }, [scheduler, west, south, east, north])

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

  /** Place an alert: the answer carries the pin (coordinates, is_mine), so it appears at once; the
   *  viewport is read again to settle. A refusal changes nothing and reads nothing. */
  const placeAlert = useCallback(
    async (input: PlaceAlertInput): Promise<AlertOutcome<SafetyAlert>> => {
      const res = await placeSafetyAlert(supabase, input, 'map')
      if (res.ok) {
        store.apply(res.value)
        scheduler.refresh()
      }
      return res
    },
    [supabase, store, scheduler]
  )

  /** "Still here" / "Gone now". The answer is merged onto the pin (it keeps its place and its open
   *  popup); an answer that ends the alert (three "Gone now" votes) takes the pin out at once. */
  const voteAlert = useCallback(
    async (alert: SafetyAlert, vote: AlertVote): Promise<AlertOutcome<SafetyAlert>> => {
      const res = await voteSafetyAlert(supabase, alert, vote, 'map')
      if (res.ok) store.apply(res.value)
      else if (res.failure.kind === 'not_found' || (res.failure.kind === 'not_live' && !res.failure.resolved)) store.remove(alert.id)
      if (res.ok || res.failure.kind === 'not_live' || res.failure.kind === 'not_found') scheduler.refresh()
      return res
    },
    [supabase, store, scheduler]
  )

  const [host] = useState<AlertHost>(() => ({
    applyAnswer: (alert) => store.apply(alert),
    leave: (alertId) => store.remove(alertId),
    refresh: () => scheduler.refresh(),
    announce: (text) => setNotice((n) => ({ text, seq: n.seq + 1 })),
    // The pin is gone: the map itself is the next place (its canvas takes the arrow keys). Focus
    // moves only when it would otherwise be lost — it is nowhere, or inside the popup / marker that
    // is leaving — so a pin that ends never pulls focus out of, say, the search box.
    focusAfterLeave: () => {
      const active = document.activeElement
      const adrift = !active || active === document.body || active.closest('.mapboxgl-popup, .mapboxgl-marker') !== null
      if (adrift) document.querySelector<HTMLElement>('.mapboxgl-canvas')?.focus({ preventScroll: true })
    },
  }))

  const setEngaged = useCallback((alertId: string, engaged: boolean) => store.setEngaged(alertId, engaged), [store])

  return { alerts, loading, error, notice, now, placeAlert, voteAlert, host, setEngaged }
}
