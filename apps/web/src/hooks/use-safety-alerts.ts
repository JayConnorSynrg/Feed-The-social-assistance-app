'use client'

// apps/web/src/hooks/use-safety-alerts.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The members' map layer of safety alerts: every shown alert in the viewport (live, and resolved for
// six hours), read through the one reader (lib/safety-alert-rpc.ts readSafetyAlertsInView). Each row
// carries the server's verdict (shown_state): the map draws what the server last returned, whatever
// the browser clock says.
// When it reads (lib/safety-alerts-fetch.ts): one read per real viewport change (debounced 400 ms,
// keyed on the four bound NUMBERS, so a re-render with the same bounds schedules nothing), a 60 s
// poll while the tab is visible (alerts are not in the realtime publication, so the reporter's id
// never transits the WAL), one read when the tab becomes visible again, one right after the member's
// own place / vote / update / resolve / withdraw, and one when the earliest "shown until" instant
// passes. Only the latest read's answer is applied.
// Between reads the store (lib/safety-alert-store.ts) merges RPC answers onto the pins it holds
// (coordinates and is_mine kept).

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logEvent, logger } from '@/lib/logger'
import { SafetyAlertsFetchScheduler, createLatestOnlyLoader, sharedPollCounter } from '@/lib/safety-alerts-fetch'
import { SafetyAlertStore, alertsSignature } from '@/lib/safety-alert-store'
import {
  AlertReadError,
  placeSafetyAlert,
  readSafetyAlertById,
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

// The page's read counter for the map: one alerts.poll row per 30 reads, and one when the page goes
// away. The counter lives in the page's memory, so a tab hide or leaving the map panel and coming
// back writes nothing and loses nothing. The first failed read of a window is reported once.
const pollCounter = () =>
  sharedPollCounter(
    'map',
    (row) => logEvent('alerts.poll', { ...row }),
    (code) => logger.error('safety-alerts.fetch.error', { code, message: 'alert read failed' }),
  )

/** The popup of an alert, when it is open: its dialog container. */
const popupDialog = (alertId: string) =>
  document.querySelector<HTMLElement>(`[data-testid="safety-alert-popup-${alertId}"]`)?.closest<HTMLElement>('[role="dialog"]') ?? null

/** Where focus goes when the map notice's Dismiss button (which had it) is taken away: the map
 *  itself; in the list view (no map drawn), the selected view tab. */
export function focusMapSurface(): void {
  const target =
    document.querySelector<HTMLElement>('.mapboxgl-canvas') ?? document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"][id^="map-tab-"]')
  target?.focus({ preventScroll: true })
}

export function useSafetyAlerts(viewportBounds: ViewportBounds | null) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [notice, setNotice] = useState<AlertNotice>({ text: '', seq: 0 })
  // The instant of the last change to the list: the clock the markers render ages with.
  const [now, setNow] = useState(() => Date.now())

  const [core] = useState(() => {
    const counter = pollCounter()
    // Only the latest read's answer is applied: a slow answer for an older viewport is dropped.
    const fetchAlerts = createLatestOnlyLoader<ViewportBounds, SafetyAlert[]>({
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
        counter.record({ error: err instanceof AlertReadError && err.code ? err.code : 'exception' })
        setError(err instanceof Error ? err : new Error(String(err)))
      },
      onSettled: () => setLoading(false),
    })

    const scheduler = new SafetyAlertsFetchScheduler({
      fetch: (bounds) => void fetchAlerts(bounds),
      isVisible: () => document.visibilityState === 'visible',
    })

    const store: SafetyAlertStore = new SafetyAlertStore(
      (list) => {
        setAlerts(list)
        setNow(Date.now())
      },
      {
        // A "shown until" instant passed: ask the server (a hidden tab asks when it comes back).
        onDue: () => {
          if (document.visibilityState === 'visible') scheduler.refresh()
        },
        // An alert whose popup is open left the viewport's answer: is it still shown?
        recheck: (alertId) => readSafetyAlertById(supabase, alertId),
      },
    )

    const host: AlertHost = {
      applyAnswer: (alert) => store.apply(alert),
      leave: (alertId) => store.remove(alertId),
      refresh: () => scheduler.refresh(),
      announce: (text) => setNotice((n) => ({ text, seq: n.seq + 1 })),
      // The alert is still on the map: its open popup takes focus (Escape closes it), else its marker.
      focusAlert: (alertId) => {
        const target = popupDialog(alertId) ?? document.querySelector<HTMLElement>(`[data-testid="safety-alert-marker-${alertId}"]`)
        target?.focus({ preventScroll: true })
        return Boolean(target)
      },
      // The pin is gone: the map itself is the next place (its canvas takes the arrow keys). Focus
      // moves only when it would otherwise be lost — it is nowhere, or inside the popup / marker that
      // is leaving — so a pin that ends never pulls focus out of, say, the search box.
      focusAfterLeave: () => {
        const active = document.activeElement
        const adrift = !active || active === document.body || active.closest('.mapboxgl-popup, .mapboxgl-marker') !== null
        if (adrift) document.querySelector<HTMLElement>('.mapboxgl-canvas')?.focus({ preventScroll: true })
      },
    }

    const dispose = () => {
      scheduler.dispose()
      store.dispose()
    }
    return { store, scheduler, host, dispose }
  })

  // The four numbers, not the bounds object: an effect keyed on an object's identity re-runs on every
  // render that builds a new one.
  const west = viewportBounds?.west ?? null
  const south = viewportBounds?.south ?? null
  const east = viewportBounds?.east ?? null
  const north = viewportBounds?.north ?? null
  useEffect(() => {
    core.scheduler.setBounds(west === null || south === null || east === null || north === null ? null : { west, south, east, north })
  }, [core, west, south, east, north])

  useEffect(() => () => core.dispose(), [core])

  // A hidden tab skips the poll; coming back reads once at once.
  useEffect(() => {
    const onVisibility = () => core.scheduler.visibilityChanged(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [core])

  /** The notice is dismissed, or the member started something else. */
  const clearNotice = useCallback(() => setNotice((n) => (n.text === '' ? n : { text: '', seq: n.seq })), [])

  /** Place an alert: the answer carries the pin (coordinates, is_mine, the server's verdict), so it
   *  appears at once; the viewport is read again to settle. A refusal changes nothing and reads nothing. */
  const placeAlert = useCallback(
    async (input: PlaceAlertInput): Promise<AlertOutcome<SafetyAlert>> => {
      clearNotice()
      const res = await placeSafetyAlert(supabase, input, 'map')
      if (res.ok) {
        core.store.apply(res.value)
        core.scheduler.refresh()
      }
      return res
    },
    [supabase, core, clearNotice]
  )

  /** "Still here" / "Gone now". The answer is merged onto the pin (it keeps its place and its open
   *  popup); an answer that ends the alert (three "Gone now" votes) takes the pin out at once. */
  const voteAlert = useCallback(
    async (alert: SafetyAlert, vote: AlertVote): Promise<AlertOutcome<SafetyAlert>> => {
      clearNotice()
      const res = await voteSafetyAlert(supabase, alert, vote, 'map')
      if (res.ok) core.store.apply(res.value)
      else if (res.failure.kind === 'not_found' || (res.failure.kind === 'not_live' && !res.failure.resolved)) core.store.remove(alert.id)
      if (res.ok || res.failure.kind === 'not_live' || res.failure.kind === 'not_found') core.scheduler.refresh()
      return res
    },
    [supabase, core, clearNotice]
  )

  const setEngaged = useCallback((alertId: string, engaged: boolean) => core.store.setEngaged(alertId, engaged), [core])

  return { alerts, loading, error, notice, now, placeAlert, voteAlert, host: core.host, setEngaged, clearNotice, focusMap: focusMapSurface }
}
