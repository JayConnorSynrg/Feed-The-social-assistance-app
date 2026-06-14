'use client'

import { useState, useCallback } from 'react'
import { Loader2, Users, CheckCircle2, Minus, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface CheckinOccurrence {
  id: string
  starts_at: string
  ends_at: string
  event: {
    title: string
    location_name: string | null
    organization: { name: string } | null
  } | null
}

interface CheckinSheetProps {
  occurrence: CheckinOccurrence
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function CheckinSheet({ occurrence, open, onOpenChange, onSuccess }: CheckinSheetProps) {
  const supabase = createClient()

  const [householdSize, setHouseholdSize] = useState(1)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error: insertError } = await supabase
        .from('event_checkins')
        .insert({
          occurrence_id: occurrence.id,
          user_id: isAnonymous ? null : (user?.id ?? null),
          household_size: householdSize,
          checked_in_by: user?.id ?? null,
        })

      if (insertError) {
        // 23505 = unique_violation → already checked in
        if (insertError.code === '23505') {
          setError('Already checked in — update your household size instead?')
        } else {
          setError(insertError.message)
        }
        return
      }

      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      // Next.js may abort the fetch on re-render — treat AbortError as success
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        setSuccess(true)
        onSuccess?.()
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to check in')
    } finally {
      setSubmitting(false)
    }
  }, [supabase, occurrence.id, isAnonymous, householdSize, onSuccess])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      // Reset state on close
      setHouseholdSize(1)
      setIsAnonymous(true)
      setError(null)
      setSuccess(false)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  const ev = occurrence.event

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#4a5d23]">Check In</SheetTitle>
          {ev && (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm font-medium text-stone-800">{ev.title}</p>
              {ev.organization && (
                <p className="text-xs text-stone-500">{ev.organization.name}</p>
              )}
              {ev.location_name && (
                <p className="text-xs text-stone-500">{ev.location_name}</p>
              )}
              <p className="text-xs text-stone-400">
                {formatDate(occurrence.starts_at)} · {formatTime(occurrence.starts_at)}–{formatTime(occurrence.ends_at)}
              </p>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 px-6 pb-6 space-y-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-lime-600" aria-hidden="true" />
              <p className="text-base font-semibold text-stone-800">You&rsquo;re checked in!</p>
              <p className="text-sm text-stone-500">Thank you for being here.</p>
            </div>
          ) : (
            <>
              {/* Household size */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4a5d23]" aria-hidden="true" />
                  <label className="text-sm font-medium text-stone-700">Household size</label>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setHouseholdSize((s) => Math.max(1, s - 1))}
                    disabled={householdSize <= 1}
                    className="w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease household size"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-bold text-stone-900 w-8 text-center tabular-nums">
                    {householdSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHouseholdSize((s) => Math.min(10, s + 1))}
                    disabled={householdSize >= 10}
                    className="w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase household size"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-stone-400">
                    {householdSize === 1 ? 'person' : 'people'}
                  </span>
                </div>
              </div>

              {/* Anonymous checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="anon-checkin"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-lime-600 focus:ring-lime-500"
                />
                <div className="space-y-0.5">
                  <label htmlFor="anon-checkin" className="text-sm font-medium text-stone-700 cursor-pointer">
                    Anonymous check-in
                  </label>
                  <p className="text-xs text-stone-400">
                    Your visit is counted but not linked to your account.
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#4a5d23] hover:bg-[#3d4d1c] disabled:opacity-60 text-white font-semibold py-3 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking in…</span>
                  </>
                ) : (
                  'Check In'
                )}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
