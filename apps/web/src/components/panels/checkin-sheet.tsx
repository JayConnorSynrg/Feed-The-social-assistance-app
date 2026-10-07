'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Loader2, Users, CheckCircle2, Minus, Plus, CalendarCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { HOUSEHOLD_MIN, HOUSEHOLD_MAX } from '@/lib/event-checkin'
import { formatEventWhen } from '@/lib/event-time'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir } from '@/lib/i18n'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { checkinErrorKey, eventMemberT, type EventMemberMessages } from '@/lib/i18n-event-member'
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
    /** The venue's IANA zone (assistance_events.time_zone). */
    time_zone: string | null
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
  /**
   * Called when the sheet CLOSES after a successful check-in, with the check_in RPC's answer
   * ('early' | 'already_early' | 'confirmed' | 'already_confirmed' | 'confirmed_anonymous'; null
   * when the request was cut off and the answer is unknown). Calling it on close — not on submit —
   * keeps the confirmation on screen until the member dismisses it.
   */
  onSuccess?: (result: string | null) => void
  /** Where focus goes when the sheet closes (Radix onCloseAutoFocus). */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * What to report when the sheet's open state changes: the check_in answer when it closes after a
 * successful check-in, else nothing. The confirmation therefore stays on screen until the member
 * dismisses it, and the list behind the sheet changes only after that.
 */
export function checkinResultOnClose(
  nextOpen: boolean,
  succeeded: boolean,
  result: string | null,
): { result: string | null } | null {
  return !nextOpen && succeeded ? { result } : null
}

export function CheckinSheet({ occurrence, open, onOpenChange, confirmsPresence, hasTrackedRow = false, onSuccess, onCloseAutoFocus }: CheckinSheetProps) {
  const supabase = createClient()
  const { isAnonymous } = useAuth()
  const locale = useProfileLocale()

  const [householdSize, setHouseholdSize] = useState(1)
  // Default to a TRACKED check-in (R7): anonymous is opt-in and does not count toward
  // attendance or badges — stated inline below.
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // A translated message key — the check_in RPC's own (English) text never reaches the member.
  const [error, setError] = useState<keyof EventMemberMessages | null>(null)
  const [success, setSuccess] = useState(false)
  const [resultKind, setResultKind] = useState<string | null>(null)
  const successHeadingRef = useRef<HTMLParagraphElement>(null)

  // Move focus to the confirmation so it is read out (the submit button it replaces is gone).
  useEffect(() => {
    if (success) successHeadingRef.current?.focus()
  }, [success])

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
        setError(checkinErrorKey(rpcError.message))
        return
      }

      setResultKind(typeof data === 'string' ? data : null)
      setSuccess(true)
    } catch (err) {
      // Next.js may abort the fetch on re-render — treat AbortError as success.
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        setSuccess(true)
        return
      }
      setError('errGeneric')
    } finally {
      setSubmitting(false)
    }
  }, [supabase, occurrence.id, anonymous, householdSize])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    const report = checkinResultOnClose(nextOpen, success, resultKind)
    if (!nextOpen) {
      setHouseholdSize(1)
      setAnonymous(false)
      setError(null)
      setSuccess(false)
      setResultKind(null)
    }
    onOpenChange(nextOpen)
    if (report) onSuccess?.(report.result)
  }, [onOpenChange, onSuccess, success, resultKind])

  const ev = occurrence.event
  const isEarly = resultKind === 'early' || (resultKind === 'already_early')
  const isAnon = resultKind === 'confirmed_anonymous'
  const t = (key: keyof EventMemberMessages) => eventMemberT(locale, key)
  const actionLabel = eventFormT(locale, confirmsPresence ? 'checkinHere' : 'checkinEarly')

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="flex flex-col overflow-y-auto"
        lang={locale}
        dir={dir(locale)}
        hideDefaultClose
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="absolute end-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t('closeSheet')}</span>
        </button>
        <SheetHeader>
          <SheetTitle className="text-[#4a5d23]">
            {actionLabel}
          </SheetTitle>
          {ev && (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm font-medium text-stone-800">{ev.title}</p>
              {ev.organization && (
                <p className="text-xs text-stone-600">{ev.organization.name}</p>
              )}
              {ev.location_name && (
                <p className="text-xs text-stone-600">{ev.location_name}</p>
              )}
              {(() => {
                const when = formatEventWhen(occurrence.starts_at, occurrence.ends_at, ev.time_zone, locale)
                return (
                  <p className="text-xs text-stone-600">
                    {when.text}
                    {when.venue && <span className="block">{when.venue}</span>}
                  </p>
                )
              })()}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 px-6 pb-6 space-y-6">
          {isAnonymous ? (
            // R8: guests cannot check in — offer the account path.
            <div className="pt-4">
              <CreateAccountPrompt message={t('guestPrompt')} linkLabel={t('createAccount')} />
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              {isAnon ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-lime-600" aria-hidden="true" />
                  <p ref={successHeadingRef} tabIndex={-1} className="text-base font-semibold text-stone-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2">{eventFormT(locale, 'checkinAnonymous')}</p>
                  <p className="text-sm text-stone-600">{t('successAnonBody')}</p>
                </>
              ) : isEarly ? (
                <>
                  <CalendarCheck className="w-12 h-12 text-lime-600" aria-hidden="true" />
                  <p ref={successHeadingRef} tabIndex={-1} className="text-base font-semibold text-stone-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2">{t('successEarlyTitle')}</p>
                  <p className="text-sm text-stone-600">
                    {formatMessage(t('successEarlyBody'), { here: eventFormT(locale, 'checkinHere') })}
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-12 h-12 text-lime-600" aria-hidden="true" />
                  <p ref={successHeadingRef} tabIndex={-1} className="text-base font-semibold text-stone-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2">{t('successTitle')}</p>
                  <p className="text-sm text-stone-600">{t('successBody')}</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Household size */}
              <div className="space-y-3" role="group" aria-labelledby="checkin-household-label">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4a5d23]" aria-hidden="true" />
                  <span id="checkin-household-label" className="text-sm font-medium text-stone-700">
                    {t('householdLabel')}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setHouseholdSize((s) => Math.max(HOUSEHOLD_MIN, s - 1))}
                    disabled={householdSize <= HOUSEHOLD_MIN}
                    className="w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('householdDecrease')}
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <output
                    aria-live="polite"
                    aria-labelledby="checkin-household-label"
                    className="text-2xl font-bold text-stone-900 w-8 text-center tabular-nums"
                  >
                    {householdSize}
                  </output>
                  <button
                    type="button"
                    onClick={() => setHouseholdSize((s) => Math.min(HOUSEHOLD_MAX, s + 1))}
                    disabled={householdSize >= HOUSEHOLD_MAX}
                    className="w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('householdIncrease')}
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
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
                      {t('anonLabel')}
                    </label>
                    <p className="text-xs text-stone-600">{t('anonHint')}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3" role="alert">
                  <p className="text-sm text-red-700">{t(error)}</p>
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
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>{t('submitting')}</span>
                  </>
                ) : (
                  actionLabel
                )}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
