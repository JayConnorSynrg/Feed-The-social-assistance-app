'use client'

// apps/web/src/hooks/use-safety-strip.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed's alert strip: the top five shown alerts (live first, then resolved for six hours), read
// through the one reader (lib/safety-alert-rpc.ts readSafetyAlertStrip) with the server's is_mine
// and the server's verdict on each row (shown_state): what the strip holds is what the server last
// returned, whatever the browser clock says.
// When it reads (lib/safety-alerts-fetch.ts KeyedPollScheduler, keyed on the viewer — a string):
// once per viewer, every 60 s while the tab is visible, once when the tab becomes visible again,
// once after the member's own update / resolve / withdraw (host.refresh), and once when the earliest
// "shown until" instant passes (the store asks; the server answers). Re-renders schedule nothing.
// Only the latest read's answer is applied. Placing and voting happen on the map panel; panels
// unmount on switch, so coming back to the feed mounts this hook and reads again.
// Each read's difference from the list before is announced by the rule in
// lib/safety-alert-announce.ts; the member's own actions announce their own notice (host.announce).
// What a live region said is cleared a few seconds later, so browse mode does not find stale text.
// When a read fails after one has succeeded, the list stays exactly as the server last returned it
// (nothing is hidden on the browser clock) and the strip says so: `stale` is the instant of the last
// read that succeeded, for the line "Couldn't refresh alerts — last updated HH:MM". It is announced
// once when the strip becomes stale, and cleared by the next read that succeeds. A first read that
// fails has no "last updated" to show: `stale` stays null.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logEvent, logger } from '@/lib/logger'
import { KeyedPollScheduler, createLatestOnlyLoader, sharedPollCounter } from '@/lib/safety-alerts-fetch'
import { SafetyAlertStore, alertsSignature } from '@/lib/safety-alert-store'
import { stripAnnouncement, type StripEvent } from '@/lib/safety-alert-announce'
import { isAlertShown } from '@/lib/safety-alert-live'
import { AlertReadError, STRIP_ALERT_LIMIT, readSafetyAlertById, readSafetyAlertStrip, type SafetyAlert } from '@/lib/safety-alert-rpc'

/** How long a live region keeps its text after speaking it. */
export const LIVE_REGION_CLEAR_MS = 8000

/** What the strip's two live regions hold. `seq` moves with every new message, so the same sentence
 *  twice in a row is still announced. */
export interface StripLive {
  assertive: StripEvent[]
  polite: StripEvent[]
  /** The outcome of the member's own action, for the polite region (already in their language). */
  spoken: string
  /** The same outcome as a visible line: it stays until dismissed or the next action. */
  notice: string
  /** The strip just became stale: the instant of the last read that succeeded, to be said once in
   *  the polite region ("Couldn't refresh alerts — last updated …"). null otherwise. */
  staleSpoken: number | null
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
  /** Say what the member's action did (polite), and show it. */
  announce: (notice: string) => void
  /** Move focus to this alert's own place on the surface (its strip entry, its open popup or its
   *  marker); false when it is not there. */
  focusAlert: (alertId: string) => boolean
  /** Move focus to the place that follows an alert that left (called before the notice). */
  focusAfterLeave: () => void
}

const QUIET: StripLive = { assertive: [], polite: [], spoken: '', notice: '', staleSpoken: null, seq: 0 }

/** The strip item that takes focus when `alertId` leaves: the next one, else the one before. */
export function neighbourOf(alerts: readonly SafetyAlert[], alertId: string): string | null {
  const i = alerts.findIndex((a) => a.id === alertId)
  if (i === -1) return null
  return alerts[i + 1]?.id ?? alerts[i - 1]?.id ?? null
}

const stripItem = (alertId: string) => document.querySelector<HTMLElement>(`[data-testid="safety-strip-item-${alertId}"]`)

// The page's read counter for the strip: one alerts.poll row per 30 reads, and one when the page
// goes away. The counter lives in the page's memory, so a tab hide or leaving the feed panel and
// coming back writes nothing and loses nothing. The first failed read of a window is reported once.
const pollCounter = () =>
  sharedPollCounter(
    'strip',
    (row) => logEvent('alerts.poll', { ...row }),
    (code) => logger.warn('feed.safety_alerts.fetch_failed', { code }),
  )

/** `focusFallback` is read once: hand over a stable function (the feed heading's focus). */
export function useSafetyStrip(viewerKey: string | null, focusFallback: () => void) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [live, setLive] = useState<StripLive>(QUIET)
  // The instant of the last read (answered or failed): the clock the strip renders ages with.
  const [now, setNow] = useState(() => Date.now())
  // The latest read failed: when the last one succeeded (null = not stale, or nothing was ever read).
  const [stale, setStale] = useState<number | null>(null)

  const [core] = useState(() => {
    const counter = pollCounter()
    // The viewer whose list the store holds: a new viewer starts from an empty, silent baseline.
    let viewer: string | null = null
    let first = true
    // The strip item that takes focus after an alert left (set by leave, used once).
    let neighbour: string | null = null
    let clearTimer: ReturnType<typeof setTimeout> | null = null
    // When this viewer's last read succeeded, and whether the strip has said it is stale since.
    let lastSuccessAt: number | null = null
    let isStale = false

    /** Put a message in the live regions, and take the spoken text out again a few seconds later. */
    const say = (next: Pick<StripLive, 'assertive' | 'polite' | 'spoken'> & { notice?: string; staleSpoken?: number }) => {
      setLive((l) => ({ assertive: next.assertive, polite: next.polite, spoken: next.spoken, notice: next.notice ?? l.notice, staleSpoken: next.staleSpoken ?? null, seq: l.seq + 1 }))
      if (clearTimer) clearTimeout(clearTimer)
      clearTimer = setTimeout(() => {
        clearTimer = null
        setLive((l) =>
          l.assertive.length === 0 && l.polite.length === 0 && l.spoken === '' && l.staleSpoken === null ? l : { ...l, assertive: [], polite: [], spoken: '', staleSpoken: null },
        )
      }, LIVE_REGION_CLEAR_MS)
    }

    const load = createLatestOnlyLoader<string, SafetyAlert[]>({
      read: () => readSafetyAlertStrip(supabase),
      onStart: () => {},
      onResult: (rows) => {
        counter.record({ signature: alertsSignature(rows), count: rows.length })
        lastSuccessAt = Date.now()
        if (isStale) {
          isStale = false
          setStale(null)
        }
        const before = first ? null : store.list().filter((a) => isAlertShown(a))
        first = false
        store.replace(rows)
        const said = stripAnnouncement(before, rows, STRIP_ALERT_LIMIT)
        if (said.assertive.length > 0 || said.polite.length > 0) say({ assertive: said.assertive, polite: said.polite, spoken: '' })
      },
      onError: (err) => {
        counter.record({ error: err instanceof AlertReadError && err.code ? err.code : 'exception' })
        store.readFailed()
        // Ages keep counting from the present; the list itself stays as the server last returned it.
        setNow(Date.now())
        // Stale: said once, when the first read fails after one that succeeded.
        if (lastSuccessAt !== null && !isStale) {
          isStale = true
          setStale(lastSuccessAt)
          say({ assertive: [], polite: [], spoken: '', staleSpoken: lastSuccessAt })
        }
      },
      onSettled: () => {},
    })

    const scheduler = new KeyedPollScheduler<string>({
      fetch: (key) => {
        if (key !== viewer) {
          viewer = key
          first = true
          lastSuccessAt = null
          isStale = false
          setStale(null)
          store.replace([])
        }
        void load(key)
      },
      isVisible: () => document.visibilityState === 'visible',
      debounceMs: 0,
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
        recheck: (alertId) => readSafetyAlertById(supabase, alertId),
      },
    )

    const host: AlertHost = {
      applyAnswer: (alert) => store.apply(alert),
      leave: (alertId) => {
        neighbour = neighbourOf(store.list(), alertId)
        store.remove(alertId)
      },
      refresh: () => scheduler.refresh(),
      announce: (notice) => say({ assertive: [], polite: [], spoken: notice, notice }),
      focusAlert: (alertId) => {
        const item = stripItem(alertId)
        item?.focus()
        return Boolean(item)
      },
      focusAfterLeave: () => {
        const next = neighbour
        neighbour = null
        const item = next ? stripItem(next) : null
        if (item) item.focus()
        else focusFallback()
      },
    }

    const dispose = () => {
      scheduler.dispose()
      store.dispose()
      if (clearTimer) clearTimeout(clearTimer)
      clearTimer = null
    }
    return { store, scheduler, host, dispose }
  })

  useEffect(() => {
    core.scheduler.set(viewerKey, viewerKey)
  }, [core, viewerKey])

  useEffect(() => () => core.dispose(), [core])

  // A hidden tab skips the poll; coming back reads once at once.
  useEffect(() => {
    const onVisibility = () => core.scheduler.visibilityChanged(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [core])

  const setEngaged = useCallback((alertId: string, engaged: boolean) => core.store.setEngaged(alertId, engaged), [core])
  /** The visible notice is dismissed, or the member started something else. */
  const dismissNotice = useCallback(() => setLive((l) => (l.notice === '' ? l : { ...l, notice: '' })), [])

  return { alerts, live, now, stale, host: core.host, setEngaged, dismissNotice }
}
