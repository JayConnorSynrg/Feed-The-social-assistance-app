'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'

// ─────────────────────────────────────────────────────────────────────────────
// EWKB parser — mirrors use-viewport-resources.ts
// Realtime payloads return location as EWKB hex; decompose to [lng, lat].
// ─────────────────────────────────────────────────────────────────────────────
function parseEWKBPoint(hex: string): [number, number] | null {
  if (!hex || typeof hex !== 'string' || hex.length < 50) return null
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    const view = new DataView(bytes.buffer)
    const littleEndian = bytes[0] === 1
    const lng = view.getFloat64(9, littleEndian)
    const lat = view.getFloat64(17, littleEndian)
    if (isNaN(lng) || isNaN(lat)) return null
    return [lng, lat]
  } catch {
    return null
  }
}

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
  created_by: string | null
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

        const rows = (data ?? []) as SafetyAlert[]
        const newMap = new Map<string, SafetyAlert>()
        rows.forEach((r) => newMap.set(r.id, r))
        alertMapRef.current = newMap
        setAlerts(rows)
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

  // ── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('safety_alerts_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'safety_alerts' },
        (payload) => {
          // Realtime payload has raw DB row: location is EWKB hex, NOT decomposed lng/lat.
          // Decompose it before adding to local state so SafetyAlertMarker gets numeric coords.
          const raw = payload.new as Record<string, unknown>
          const locationHex = typeof raw.location === 'string' ? raw.location : ''
          const coords = parseEWKBPoint(locationHex)
          if (!coords) {
            // Cannot decompose coordinates — skip adding to local map; next viewport
            // fetch will pick it up with correct lng/lat from the in-view RPC.
            return
          }
          const row: SafetyAlert = {
            id: raw.id as string,
            alert_type: raw.alert_type as SafetyAlert['alert_type'],
            severity: raw.severity as number,
            description: raw.description as string | null,
            lng: coords[0],
            lat: coords[1],
            status: raw.status as string,
            confirm_count: raw.confirm_count as number,
            clear_count: raw.clear_count as number,
            created_by: raw.created_by as string | null,
            created_at: raw.created_at as string,
            expires_at: raw.expires_at as string,
            verified: (raw.verified as boolean) ?? false,
          }
          alertMapRef.current.set(row.id, row)
          setAlerts(Array.from(alertMapRef.current.values()))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'safety_alerts' },
        (payload) => {
          // UPDATE payload also has EWKB location; same parse strategy.
          const raw = payload.new as Record<string, unknown>
          const locationHex = typeof raw.location === 'string' ? raw.location : ''
          const coords = parseEWKBPoint(locationHex)
          const status = raw.status as string
          if (status !== 'live' || !coords) {
            alertMapRef.current.delete(raw.id as string)
          } else {
            const existing = alertMapRef.current.get(raw.id as string)
            const row: SafetyAlert = {
              ...(existing ?? {}),
              id: raw.id as string,
              alert_type: raw.alert_type as SafetyAlert['alert_type'],
              severity: raw.severity as number,
              description: raw.description as string | null,
              lng: coords[0],
              lat: coords[1],
              status,
              confirm_count: raw.confirm_count as number,
              clear_count: raw.clear_count as number,
              created_by: raw.created_by as string | null,
              created_at: raw.created_at as string,
              expires_at: raw.expires_at as string,
              verified: (raw.verified as boolean) ?? false,
            }
            alertMapRef.current.set(row.id, row)
          }
          setAlerts(Array.from(alertMapRef.current.values()))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          // and unmounts the popup mid-interaction.
          if (row.status !== 'live') {
            alertMapRef.current.delete(row.id)
          } else {
            const existing = alertMapRef.current.get(row.id)
            alertMapRef.current.set(row.id, {
              ...(existing ?? {}),
              ...row,
              lng: existing?.lng ?? row.lng,
              lat: existing?.lat ?? row.lat,
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
