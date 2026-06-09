'use client'

/**
 * use-petitions.ts
 *
 * Data layer for community petitions.
 * - Fetches all approved petitions with signature counts and has-signed state.
 * - sign(petitionId) → POST /api/petitions/sign with optimistic update.
 * - Realtime subscription on petition_signatures for live count updates.
 *
 * Design: signed state lives in a single `signedMap` (petition_id → boolean).
 * Counts live in `countMap` (petition_id → number). No dual-state ??-fallback
 * patterns — single source of truth per-petition per-map.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import type { Database } from '@feed/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Petition = Database['public']['Tables']['petitions']['Row']

export interface PetitionWithMeta extends Petition {
  signatureCount: number
  hasSigned: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePetitions() {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [petitions, setPetitions] = useState<PetitionWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-petition signing state: id → { count, hasSigned }
  const [signedMap, setSignedMap] = useState<Map<string, boolean>>(new Map())
  const [countMap, setCountMap] = useState<Map<string, number>>(new Map())
  const [signingId, setSigningId] = useState<string | null>(null)
  const [signError, setSignError] = useState<string | null>(null)

  const fetchPetitions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch approved petitions (enumerate cols — avoid select('*') so coord-revoked
      // cols on joined tables don't surface any issue)
      const { data, error: fetchError } = await supabase
        .from('petitions')
        .select(
          'id, title, summary, body, cause_category, external_ref, target_signatures, body_version_hash, status, created_by, created_at, updated_at'
        )
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError

      const rows = data ?? []

      if (rows.length === 0) {
        setPetitions([])
        setLoading(false)
        return
      }

      const ids = rows.map((r) => r.id)

      // Batch: signature counts + has-signed for each petition in parallel
      const [countResults, signedResults] = await Promise.all([
        Promise.all(
          ids.map((id) =>
            supabase
              .rpc('get_petition_signature_count', { p_petition_id: id })
              .then(({ data: c }) => ({ id, count: (c as number | null) ?? 0 }))
          )
        ),
        Promise.all(
          ids.map((id) =>
            supabase
              .rpc('has_signed_petition', { p_petition_id: id })
              .then(({ data: s }) => ({ id, hasSigned: (s as boolean | null) ?? false }))
          )
        ),
      ])

      const newCountMap = new Map<string, number>(countResults.map((r) => [r.id, r.count]))
      const newSignedMap = new Map<string, boolean>(signedResults.map((r) => [r.id, r.hasSigned]))

      setCountMap(newCountMap)
      setSignedMap(newSignedMap)

      setPetitions(
        rows.map((r) => ({
          ...r,
          signatureCount: newCountMap.get(r.id) ?? 0,
          hasSigned: newSignedMap.get(r.id) ?? false,
        }))
      )
    } catch (err: unknown) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        // Timeout/abort — leave previous data, don't error-wipe
        setLoading(false)
        return
      }
      setError('Unable to load petitions. Please try again.')
      console.error('use-petitions fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Realtime subscription for live count updates
  useEffect(() => {
    fetchPetitions()

    const channel = supabase
      .channel('petition_signatures_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'petition_signatures' },
        (payload) => {
          const newRow = payload.new as { petition_id: string }
          if (!newRow?.petition_id) return
          setCountMap((prev) => {
            const updated = new Map(prev)
            updated.set(newRow.petition_id, (updated.get(newRow.petition_id) ?? 0) + 1)
            return updated
          })
          setPetitions((prev) =>
            prev.map((p) =>
              p.id === newRow.petition_id
                ? { ...p, signatureCount: (p.signatureCount ?? 0) + 1 }
                : p
            )
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [fetchPetitions, supabase])

  /**
   * sign(petitionId) — optimistic count++ + mark signed, rolls back on failure.
   * Single source of truth: signedMap + countMap. Derives PetitionWithMeta on render.
   */
  const sign = useCallback(
    async (petitionId: string) => {
      setSigningId(petitionId)
      setSignError(null)

      // Snapshot for rollback
      const prevSigned = signedMap.get(petitionId) ?? false
      const prevCount = countMap.get(petitionId) ?? 0

      if (prevSigned) {
        setSigningId(null)
        return
      }

      // Optimistic update
      setSignedMap((prev) => new Map(prev).set(petitionId, true))
      setCountMap((prev) => new Map(prev).set(petitionId, prevCount + 1))
      setPetitions((prev) =>
        prev.map((p) =>
          p.id === petitionId
            ? { ...p, hasSigned: true, signatureCount: prevCount + 1 }
            : p
        )
      )

      try {
        const res = await fetch('/api/petitions/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ petitionId, affirmed: true }),
          signal: AbortSignal.timeout(20_000),
        })

        const json = (await res.json()) as {
          ok?: boolean
          alreadySigned?: boolean
          count?: number
          error?: string
        }

        if (!res.ok && !json.alreadySigned) {
          throw new Error(json.error || 'sign_failed')
        }

        // Reconcile server count
        if (typeof json.count === 'number') {
          setCountMap((prev) => new Map(prev).set(petitionId, json.count!))
          setPetitions((prev) =>
            prev.map((p) =>
              p.id === petitionId ? { ...p, signatureCount: json.count! } : p
            )
          )
        }
      } catch (err: unknown) {
        // Rollback
        setSignedMap((prev) => new Map(prev).set(petitionId, prevSigned))
        setCountMap((prev) => new Map(prev).set(petitionId, prevCount))
        setPetitions((prev) =>
          prev.map((p) =>
            p.id === petitionId
              ? { ...p, hasSigned: prevSigned, signatureCount: prevCount }
              : p
          )
        )

        // Ignore abort/timeout silently (network flake)
        if (
          err instanceof DOMException ||
          (err instanceof Error && err.message.includes('signal'))
        ) {
          setSigningId(null)
          return
        }

        setSignError('Unable to add your signature. Please try again.')
        console.error('use-petitions sign error:', err)
      } finally {
        setSigningId(null)
      }
    },
    [signedMap, countMap, supabase]
  )

  // Derive petitions list with current signedMap/countMap values merged
  const derivedPetitions = petitions.map((p) => ({
    ...p,
    hasSigned: signedMap.get(p.id) ?? p.hasSigned,
    signatureCount: countMap.get(p.id) ?? p.signatureCount,
  }))

  return {
    petitions: derivedPetitions,
    loading,
    error,
    sign,
    signingId,
    signError,
    refresh: fetchPetitions,
  }
}
