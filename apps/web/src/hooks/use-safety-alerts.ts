'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'

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

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(
    async (bounds: ViewportBounds) => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcError } = await supabase
          .rpc('safety_alerts_in_view', {
            p_min_lng: bounds.west,
            p_min_lat: bounds.south,
            p_max_lng: bounds.east,
            p_max_lat: bounds.north,
          })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

        if (rpcError) throw rpcError

        const rows = data ?? []
        const alerts = rows.map((r): SafetyAlert => ({
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
        const newMap = new Map<string, SafetyAlert>()
        alerts.forEach((r) => newMap.set(r.id, r))
        alertMapRef.current = newMap
        setAlerts(alerts)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.fetch.error', { message: e.message })
        setError(e)
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── Debounced refetch on viewport change ───────────────────────────────────

  useEffect(() => {
    if (!viewportBounds) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchAlerts(viewportBounds)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [viewportBounds, fetchAlerts])

  // ── Polling refetch (replaces realtime) ────────────────────────────────────
  //
  // safety_alerts is intentionally NOT in the supabase_realtime publication
  // (migration 20260619000400) so created_by never transits the WAL payload —
  // this preserves reporter anonymity. Without realtime, a stationary map viewer
  // would not see new hazard pins until they pan/zoom. A conservative 60s poll
  // re-invokes the existing in-view fetch to keep pins and vote counts fresh.
  //
  // The poll only fires when there is an active viewport AND the tab is visible
  // (no background polling). The interval is cleared on unmount and re-created on
  // bounds change so intervals never stack. The viewport-change refetch above is
  // untouched and remains the primary freshness path for pan/zoom.

  useEffect(() => {
    if (!viewportBounds) return
    const bounds = viewportBounds
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAlerts(bounds)
      }
    }, 60000)
    return () => {
      clearInterval(intervalId)
    }
  }, [viewportBounds, fetchAlerts])

  // ── Place alert ────────────────────────────────────────────────────────────

  const placeAlert = useCallback(
    async (input: PlaceAlertInput): Promise<SafetyAlert | null> => {
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
        // The RPC returns the full safety_alerts row (with geography location column,
        // not decomposed lng/lat). We do NOT add it to local state optimistically
        // because the Marker needs numeric lng/lat. The realtime subscription
        // (INSERT event) will pick it up with coordinates from the RPC response
        // via a follow-up in-view fetch. Log the success.
        const row = data as unknown as { id: string }
        if (row?.id) {
          logger.info('pin.place', { type: input.type, severity: input.severity, id: row.id })
        }
        return data as unknown as SafetyAlert
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.place.error', { message: e.message })
        throw e
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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
    async (alertId: string, input: UpdateAlertInput): Promise<void> => {
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
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        logger.error('safety-alerts.update.error', { message: e.message })
        throw e
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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
        // Optimistically remove from local state
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
