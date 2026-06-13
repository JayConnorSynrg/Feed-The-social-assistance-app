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
import { logger } from '@/lib/logger'
import type { Database } from '@feed/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Petition = Database['public']['Tables']['petitions']['Row']

export interface PetitionWithMeta extends Petition {
  signatureCount: number
  hasSigned: boolean
  /** True once the organizer has exported the signer list — withdrawal is then locked. */
  isLocked: boolean
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
          'id, title, summary, body, cause_category, external_ref, target_signatures, body_version_hash, status, created_by, created_at, updated_at, exported_at, exported_by'
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
          isLocked: r.exported_at != null,
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
   * sign(petitionId) — optimistic count++ + mark signed.
   *
   * Catch order:
   *   1. AbortError / signal → reconcile from server truth (do NOT roll back —
   *      the server insert likely completed before the abort fired).
   *   2. Genuine error → roll back optimistic state, surface signError.
   *
   * Single source of truth: signedMap + countMap. Derives PetitionWithMeta on render.
   */
  const sign = useCallback(
    async (petitionId: string) => {
      const start = performance.now()
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

      logger.info('petition.sign.attempt', { petitionId })

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

        logger.info('petition.sign.success', {
          petitionId,
          latencyMs: Math.round(performance.now() - start),
          count: json.count,
        })
      } catch (err: unknown) {
        const isAbort =
          err instanceof DOMException ||
          (err instanceof Error && err.message.includes('signal'))

        if (isAbort) {
          // Do NOT roll back — the server insert likely completed before the abort.
          // Reconcile from server truth so the UI reflects actual state.
          try {
            const [{ data: signedTruth }, { data: countTruth }] = await Promise.all([
              supabase.rpc('has_signed_petition', { p_petition_id: petitionId }),
              supabase.rpc('get_petition_signature_count', { p_petition_id: petitionId }),
            ])
            if (typeof (signedTruth as boolean | null) === 'boolean') {
              const sv = signedTruth as boolean
              setSignedMap((prev) => new Map(prev).set(petitionId, sv))
              setPetitions((prev) =>
                prev.map((p) =>
                  p.id === petitionId ? { ...p, hasSigned: sv } : p
                )
              )
            }
            if (typeof (countTruth as number | null) === 'number') {
              const cv = countTruth as number
              setCountMap((prev) => new Map(prev).set(petitionId, cv))
              setPetitions((prev) =>
                prev.map((p) =>
                  p.id === petitionId ? { ...p, signatureCount: cv } : p
                )
              )
            }
          } catch {
            // Reconcile threw — leave optimistic state intact (do not revert)
          }
          logger.info('petition.sign.aborted', {
            petitionId,
            latencyMs: Math.round(performance.now() - start),
          })
          return
        }

        // Genuine error — roll back to pre-optimistic state
        setSignedMap((prev) => new Map(prev).set(petitionId, prevSigned))
        setCountMap((prev) => new Map(prev).set(petitionId, prevCount))
        setPetitions((prev) =>
          prev.map((p) =>
            p.id === petitionId
              ? { ...p, hasSigned: prevSigned, signatureCount: prevCount }
              : p
          )
        )

        setSignError('Unable to add your signature. Please try again.')
        logger.error('petition.sign.failed', {
          petitionId,
          error: err instanceof Error ? err.message : String(err),
        })
        console.error('use-petitions sign error:', err)
      } finally {
        setSigningId(null)
      }
    },
    [signedMap, countMap, supabase]
  )

  /**
   * withdraw(petitionId) — removes the current user's signature via the
   * withdraw_petition_signature SECDEF RPC. The RPC enforces ownership
   * (auth.uid()) AND the per-petition export lock (raises if exported).
   * On success: decrement count + mark not-signed. Surfaces the "locked"
   * error gracefully if the organizer has already exported the list.
   */
  const withdraw = useCallback(
    async (petitionId: string) => {
      setSigningId(petitionId)
      setSignError(null)

      const prevSigned = signedMap.get(petitionId) ?? false
      const prevCount = countMap.get(petitionId) ?? 0

      if (!prevSigned) {
        setSigningId(null)
        return
      }

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'withdraw_petition_signature',
          { p_petition_id: petitionId }
        )

        if (rpcError) throw rpcError

        const newCount = typeof data === 'number' ? data : Math.max(0, prevCount - 1)

        setSignedMap((prev) => new Map(prev).set(petitionId, false))
        setCountMap((prev) => new Map(prev).set(petitionId, newCount))
        setPetitions((prev) =>
          prev.map((p) =>
            p.id === petitionId
              ? { ...p, hasSigned: false, signatureCount: newCount }
              : p
          )
        )
      } catch (err: unknown) {
        if (
          err instanceof DOMException ||
          (err instanceof Error && err.message.includes('signal'))
        ) {
          setSigningId(null)
          return
        }

        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('locked') || msg.includes('exported')) {
          setSignError(
            'Signatures are final — the organizer has exported this list.'
          )
        } else {
          setSignError('Unable to withdraw your signature. Please try again.')
        }
        console.error('use-petitions withdraw error:', err)
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
    withdraw,
    signingId,
    signError,
    refresh: fetchPetitions,
  }
}
