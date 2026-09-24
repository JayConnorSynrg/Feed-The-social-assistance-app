'use client'

import { useState, useCallback } from 'react'
import { Loader2, Users, CheckCircle2, Minus, Plus, CalendarCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { HOUSEHOLD_MIN, HOUSEHOLD_MAX } from '@/lib/event-checkin'
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
  /** True when a check-in NOW records confirmed presence ("I'm here"); false for an early "I'm coming". */
  confirmsPresence: boolean
  /**
   * True when the member already holds a tracked (early/confirmed) row for this occurrence.
   * The anonymous option is then hidden — the server refuses an anonymous check-in on top of
   * an existing tracked row (a member is counted at most once per occurrence, M2).
   */
  hasTrackedRow?: boolean
  onSuccess?: () => void
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function CheckinSheet({ occurrence, open, onOpenChange, confirmsPresence, hasTrackedRow = false, onSuccess }: CheckinSheetProps) {
  const supabase = createClient()
  const { isAnonymous } = useAuth()

  const [householdSize, setHouseholdSize] = useState(1)
  // Default to a TRACKED check-in (R7): anonymous is opt-in and does not count toward
  // attendance or badges — stated inline below.
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resultKind, setResultKind] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      // All check-in writes go through the SECDEF RPC (I1) — it enforces the
      // early/confirmed state machine, the guest block, and the credit rules.
      const { data, error: rpcError } = await supabase.rpc('check_in', {
        p_occurrence: occurrence.id,
        p_household_size: householdSize,
        p_anonymous: anonymous,
      })

      if (rpcError) {
        setError(rpcError.message)
        return
      }

      setResultKind(typeof data === 'string' ? data : null)
      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      // Next.js may abort the fetch on re-render — treat AbortError as success.
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
  }, [supabase, occurrence.id, anonymous, householdSize, onSuccess])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setHouseholdSize(1)
      setAnonymous(false)
      setError(null)
      setSuccess(false)
      setResultKind(null)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  const ev = occurrence.event
  const isEarly = resultKind === 'early' || (resultKind === 'already_early')
  const isAnon = resultKind === 'confirmed_anonymous'

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#4a5d23]">
            {confirmsPresence ? "I'm here" : 'Check in early'}
          </SheetTitle>
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
          {isAnonymous ? (
            // R8: guests cannot check in — offer the account path.
            <div className="pt-4">
              <CreateAccountPrompt message="Create a free account to check in to events and track your attendance" />
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              {isAnon ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-lime-600" aria-hidden="true" />
                  <p className="text-base font-semibold text-stone-800">Counted anonymously ✓</p>
                  <p className="text-sm text-stone-500">
                    Your visit was added to the event count, not linked to your account — so it
                    won&rsquo;t appear in your attendance or badges.
                  </p>
                </>
              ) : isEarly ? (
                <>
                  <CalendarCheck className="w-12 h-12 text-lime-600" aria-hidden="true" />
                  <p className="text-base font-semibold text-stone-800">You&rsquo;re on the list!</p>
                  <p className="text-sm text-stone-500">
                    Tap &ldquo;I&rsquo;m here&rdquo; when you arrive to confirm your attendance.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-12 h-12 text-lime-600" aria-hidden="true" />
                  <p className="text-base font-semibold text-stone-800">You&rsquo;re checked in!</p>
                  <p className="text-sm text-stone-500">Thank you for being here.</p>
                </>
              )}
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
                    onClick={() => setHouseholdSize((s) => Math.max(HOUSEHOLD_MIN, s - 1))}
                    disabled={householdSize <= HOUSEHOLD_MIN}
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
                    onClick={() => setHouseholdSize((s) => Math.min(HOUSEHOLD_MAX, s + 1))}
                    disabled={householdSize >= HOUSEHOLD_MAX}
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

              {/* Anonymous checkbox — opt-in, and it does not count toward attendance/badges.
                  Only offered in the window (confirmsPresence): the server accepts an
                  anonymous check-in only from 30 min before start, so before the window we
                  never present an action it would reject. An "early" tap is always tracked.
                  Hidden once the member already holds a tracked row (M2: a second anonymous
                  check-in on top of it is refused). */}
              {confirmsPresence && !hasTrackedRow && (
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="anon-checkin"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-lime-600 focus:ring-lime-500"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="anon-checkin" className="text-sm font-medium text-stone-700 cursor-pointer">
                      Check in anonymously
                    </label>
                    <p className="text-xs text-stone-400">
                      Your visit is counted for the event, but not linked to your account — it won&rsquo;t
                      count toward your attendance or badges.
                    </p>
                  </div>
                </div>
              )}

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
                  confirmsPresence ? "I'm here" : 'Check in early'
                )}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
