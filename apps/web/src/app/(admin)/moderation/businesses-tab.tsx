'use client'

// apps/web/src/app/(admin)/moderation/businesses-tab.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P4a RA review queue for member-submitted local businesses. Mirrors resources-tab: load
// the pending queue, then Approve / Reject (with an optional reason) each row. Both writes go
// through privilegedRpc (CINV3) so each carries x-request-id + withMetric telemetry and is
// recorded as ok:false on failure — the RPCs are never called raw.

import { useCallback, useEffect, useState } from 'react'
import { Check, X, Loader2, Leaf, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'
import { privilegedRpc } from '@/lib/privileged-action'
import { fetchPendingBusinesses, type PendingBusiness } from '@/lib/business-data'

export function BusinessesTab() {
  const supabase = createClient()
  const [pending, setPending] = useState<PendingBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const loadPending = useCallback(async () => {
    setLoading(true)
    setQueueError(null)
    try {
      setPending(await fetchPendingBusinesses(supabase))
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to load pending businesses')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const handleApprove = useCallback(
    async (item: PendingBusiness) => {
      setProcessingId(item.id)
      try {
        const { error } = await privilegedRpc(
          supabase,
          'admin.business.approve',
          'approve_business',
          { p_org_id: item.id },
          { action: 'business.approve', target_id: item.id }
        )
        if (error) throw error
        setPending((prev) => prev.filter((p) => p.id !== item.id))
      } catch (err) {
        logger.error('admin.business.approve', err, { org_id: item.id, outcome: 'error' })
        setQueueError(`Approve failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      } finally {
        setProcessingId(null)
      }
    },
    [supabase]
  )

  const handleReject = useCallback(
    async (item: PendingBusiness) => {
      setProcessingId(item.id)
      try {
        const reason = reasons[item.id]?.trim() || null
        const { error } = await privilegedRpc(
          supabase,
          'admin.business.reject',
          'reject_business',
          { p_org_id: item.id, p_reason: reason },
          { action: 'business.reject', target_id: item.id }
        )
        if (error) throw error
        setPending((prev) => prev.filter((p) => p.id !== item.id))
      } catch (err) {
        logger.error('admin.business.reject', err, { org_id: item.id, outcome: 'error' })
        setQueueError(`Reject failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      } finally {
        setProcessingId(null)
      }
    },
    [supabase, reasons]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-stone-600">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {queueError && (
        <div role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
          {queueError}
        </div>
      )}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
          No businesses awaiting review.
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((item) => {
            const isProcessing = processingId === item.id
            const addr = [item.address, item.city, item.state].filter(Boolean).join(', ')
            return (
              <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
                    <Leaf className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-stone-800">{item.name}</h3>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                      {addr && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {addr}
                        </span>
                      )}
                      {item.phone && <span>{item.phone}</span>}
                      {item.website && <span className="truncate">{item.website}</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                  <label htmlFor={`reason-${item.id}`} className="sr-only">
                    Rejection reason for {item.name}
                  </label>
                  <input
                    id={`reason-${item.id}`}
                    value={reasons[item.id] ?? ''}
                    onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                    placeholder="Optional reason (shown to submitter on reject)"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500"
                    disabled={isProcessing}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                      onClick={() => void handleApprove(item)}
                      disabled={isProcessing}
                      aria-label={`Approve ${item.name}`}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                      onClick={() => void handleReject(item)}
                      disabled={isProcessing}
                      aria-label={`Reject ${item.name}`}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
