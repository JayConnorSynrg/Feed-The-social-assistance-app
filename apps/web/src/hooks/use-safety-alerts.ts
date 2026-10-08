'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { SafetyAlertsFetchScheduler, createLatestOnlyLoader } from '@/lib/safety-alerts-fetch'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyAlert {
  id: string
  alert_type: 'weather' | 'road_closure' | 'speeding' | 'general'
  severity: number
  description: string | null
  lng: number
  lat: number
  status: string
  confirm_count: number
  clear_count: number
  /** True when this alert was placed by the current authenticated user.
   *  Computed server-side by safety_alerts_in_view (auth.uid() = created_by) so
   *  created_by never reaches the client. The in-view fetch (viewport change +
   *  60s poll) is the sole source of this flag. */
  is_mine: boolean
  created_at: string
  expires_at: string
  verified: boolean
}

export interface ViewportBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface PlaceAlertInput {
  type: 'weather' | 'road_closure' | 'speeding' | 'general'
  severity: number
  description: string
  lng: number
  lat: number
}

export interface UpdateAlertInput {
  type?: 'weather' | 'road_closure' | 'speeding' | 'general'
  severity?: number
  description?: string
  lng?: number
  lat?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSafetyAlerts(viewportBounds: ViewportBounds | null) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track per-alert vote state (single-source-of-truth; avoids ?? stale-state)
  const alertMapRef = useRef<Map<string, SafetyAlert>>(new Map())


  // ── Fetch ──────────────────────────────────────────────────────────────────

  // Only the latest read's answer is applied: a slow answer for an older viewport is dropped.
  const [fetchAlerts] = useState(() =>
    createLatestOnlyLoader<ViewportBounds, SafetyAlert[]>({
      read: (bounds) => readSafetyAlertsInView(supabase, bounds),
      onStart: () => {
        setLoading(true)
        setError(null)
      },
      onResult: (alerts) => {
        const newMap = new Map<string, SafetyAlert>()
        alerts.forEach((r) => newMap.set(r.id, r))
        alertMapRef.current = newMap
        setAlerts(alerts)
      },
      onError: (err) => {
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.fetch.error', { message: e.message })
        setError(e)
      },
      onSettled: () => setLoading(false),
    })
  )

  // ── When to read (lib/safety-alerts-fetch.ts) ─────────────────────────────
  // One read per real viewport change (debounced 400 ms, keyed on the four bound numbers, so a
  // re-render with the same bounds schedules nothing), a 60 s poll while the tab is visible
  // (safety_alerts is intentionally NOT in the realtime publication — migration 20260619000400 —
  // so created_by never transits the WAL), and a read right after the member places or edits an
  // alert. Timers stop on unmount.

  const [scheduler] = useState(
    () =>
      new SafetyAlertsFetchScheduler({
        fetch: (bounds) => void fetchAlerts(bounds),
        isVisible: () => document.visibilityState === 'visible',
      })
  )

  useEffect(() => {
    scheduler.setBounds(viewportBounds)
  }, [scheduler, viewportBounds])

  useEffect(() => () => scheduler.dispose(), [scheduler])

  // A hidden tab skips the poll; coming back reads once at once.
  useEffect(() => {
    const onVisibility = () => scheduler.visibilityChanged(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [scheduler])

  // ── Place alert ────────────────────────────────────────────────────────────

  const placeAlert = useCallback(
    (input: PlaceAlertInput): Promise<SafetyAlert | null> => placeSafetyAlert(supabase, input, () => scheduler.refresh()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduler]
  )

  // ── Vote on alert ──────────────────────────────────────────────────────────

  const voteAlert = useCallback(
    async (alertId: string, vote: 'confirm' | 'clear'): Promise<SafetyAlert | null> => {
      try {
        const { data, error: rpcError } = await supabase
          .rpc('vote_safety_alert', {
            p_alert_id: alertId,
            p_vote: vote,
          })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

        if (rpcError) throw rpcError
        const row = data as unknown as SafetyAlert
        if (row) {
          // Single-source-of-truth update; no ?? stale-state.
          // vote_safety_alert returns the raw safety_alerts row (geography location,
          // NOT decomposed lng/lat).  Merge with the existing entry to preserve the
          // numeric lng/lat values so SafetyAlertMarker never receives NaN coords
          // and unmounts the popup mid-interaction. Also preserve is_mine from the
          // existing entry — the raw row doesn't expose it.
          if (row.status !== 'live') {
            alertMapRef.current.delete(row.id)
          } else {
            const existing = alertMapRef.current.get(row.id)
            alertMapRef.current.set(row.id, {
              ...(existing ?? {}),
              ...row,
              lng: existing?.lng ?? row.lng,
              lat: existing?.lat ?? row.lat,
              is_mine: existing?.is_mine ?? false,
            })
          }
          setAlerts(Array.from(alertMapRef.current.values()))
          logger.info(vote === 'confirm' ? 'pin.confirm' : 'pin.clear', { alertId })
        }
        return row
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.vote.error', { message: e.message })
        throw e
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── Update alert ───────────────────────────────────────────────────────────

  const updateAlert = useCallback(
    (alertId: string, input: UpdateAlertInput): Promise<void> =>
      updateSafetyAlert(supabase, alertId, input, () => scheduler.refresh()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduler]
  )

  // ── Delete alert ───────────────────────────────────────────────────────────

  const deleteAlert = useCallback(
    async (alertId: string): Promise<void> => {
      try {
        const { error: rpcError } = await supabase
          .rpc('delete_safety_alert', {
            p_alert_id: alertId,
          })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (rpcError) throw rpcError
        // Removed from local state here, so the pin goes at once — no read needed (place and edit
        // need one: their RPCs return no lng/lat).
        alertMapRef.current.delete(alertId)
        setAlerts(Array.from(alertMapRef.current.values()))
        logger.info('safety-alerts.delete.success', { alertId })
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.delete.error', { message: e.message })
        throw e
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return { alerts, loading, error, placeAlert, voteAlert, updateAlert, deleteAlert }
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes that need a follow-up read
// ─────────────────────────────────────────────────────────────────────────────
// place_safety_alert / update_safety_alert return the raw safety_alerts row (geography location,
// not lng/lat), so the marker cannot be drawn from it: `onWritten` (the hook's scheduler.refresh)
// re-reads the viewport once after a successful write, and never after a failed one.

export async function placeSafetyAlert(
  supabase: SupabaseClient<Database>,
  input: PlaceAlertInput,
  onWritten: () => void,
): Promise<SafetyAlert | null> {
  try {
    const { data, error: rpcError } = await supabase
      .rpc('place_safety_alert', {
        p_type: input.type,
        p_severity: input.severity,
        p_description: input.description,
        p_lng: input.lng,
        p_lat: input.lat,
      })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

    if (rpcError) throw rpcError
    const row = data as unknown as { id: string }
    if (row?.id) {
      logger.info('pin.place', { type: input.type, severity: input.severity, id: row.id })
    }
    onWritten()
    return data as unknown as SafetyAlert
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    logger.error('safety-alerts.place.error', { message: e.message })
    throw e
  }
}

export async function updateSafetyAlert(
  supabase: SupabaseClient<Database>,
  alertId: string,
  input: UpdateAlertInput,
  onWritten: () => void,
): Promise<void> {
  try {
    const { error: rpcError } = await supabase
      .rpc('update_safety_alert', {
        p_alert_id: alertId,
        p_type: input.type!,
        p_severity: input.severity!,
        p_description: input.description ?? '',
        p_lng: input.lng!,
        p_lat: input.lat!,
      })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    if (rpcError) throw rpcError
    logger.info('safety-alerts.update.success', { alertId })
    onWritten()
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    logger.error('safety-alerts.update.error', { message: e.message })
    throw e
  }
}

/** One safety_alerts_in_view read, mapped to the marker shape. */
export async function readSafetyAlertsInView(
  supabase: SupabaseClient<Database>,
  bounds: ViewportBounds,
): Promise<SafetyAlert[]> {
  const { data, error: rpcError } = await supabase
    .rpc('safety_alerts_in_view', {
      p_min_lng: bounds.west,
      p_min_lat: bounds.south,
      p_max_lng: bounds.east,
      p_max_lat: bounds.north,
    })
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
  if (rpcError) throw rpcError
  return (data ?? []).map((r): SafetyAlert => ({
    id: r.id,
    alert_type: r.alert_type as SafetyAlert['alert_type'],
    severity: r.severity,
    description: r.description,
    lng: r.lng,
    lat: r.lat,
    status: r.status,
    confirm_count: r.confirm_count,
    clear_count: r.clear_count,
    created_at: r.created_at,
    expires_at: r.expires_at,
    verified: r.verified,
    is_mine: r.is_mine ?? false,
  }))
}
