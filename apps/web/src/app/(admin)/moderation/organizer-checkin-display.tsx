'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface OccurrenceInfo {
  id: string
  starts_at: string
  ends_at: string
  event_title: string
  org_name: string
}

interface Props {
  occurrence: OccurrenceInfo
  open: boolean
  onOpenChange: (open: boolean) => void
}

type CheckinState = 'idle' | 'submitting' | 'success' | 'duplicate'

export function OrganizerCheckinDisplay({ occurrence, open, onOpenChange }: Props) {
  const supabase = createClient()

  const [householdSize, setHouseholdSize] = useState(1)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [totalPeople, setTotalPeople] = useState(0)
  const [totalHouseholds, setTotalHouseholds] = useState(0)
  const [checkinState, setCheckinState] = useState<CheckinState>('idle')
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser({ id: user.id })
    })
  }, [supabase])

  const fetchCount = useCallback(async () => {
    const { data } = await supabase
      .from('event_checkins')
      .select('household_size')
      .eq('occurrence_id', occurrence.id)
    if (data) {
      setTotalPeople(data.reduce((sum, r) => sum + r.household_size, 0))
      setTotalHouseholds(data.length)
    }
  }, [occurrence.id, supabase])

  useEffect(() => {
    if (!open) return
    const run = () => fetchCount()
    void run()
    const interval = setInterval(run, 10_000)
    return () => clearInterval(interval)
  }, [open, fetchCount])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      Promise.resolve().then(() => {
        setHouseholdSize(1)
        setIsAnonymous(true)
        setCheckinState('idle')
      })
    }
  }, [open])

  const handleCheckin = useCallback(async () => {
    if (checkinState === 'submitting') return
    setCheckinState('submitting')

    const { error } = await supabase.from('event_checkins').insert({
      occurrence_id: occurrence.id,
      user_id: isAnonymous ? null : currentUser?.id ?? null,
      household_size: householdSize,
      checked_in_by: currentUser?.id ?? null,
    })

    if (error) {
      if (error.code === '23505') {
        setCheckinState('duplicate')
      } else {
        setCheckinState('idle')
      }
      setTimeout(() => setCheckinState('idle'), 3000)
      return
    }

    logger.info('admin.checkin.kiosk', {
      occurrence_id: occurrence.id,
      household_size: householdSize,
      method: 'organizer_kiosk',
    })

    setCheckinState('success')
    await fetchCount()
    setTimeout(() => {
      setCheckinState('idle')
      setHouseholdSize(1)
      setIsAnonymous(true)
    }, 3000)
  }, [checkinState, supabase, occurrence.id, isAnonymous, currentUser, householdSize, fetchCount])

  const formattedStart = new Date(occurrence.starts_at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const formattedEnd = new Date(occurrence.ends_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-stone-900/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-stone-50 overflow-hidden"
          aria-describedby={undefined}
        >
          {/* Close button — intentionally small to prevent accidental close */}
          <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-stone-200/80 p-1.5 text-stone-600 hover:bg-stone-300 transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Header — ~16% height */}
          <div className="bg-[#4a5d23] text-white px-5 pt-10 pb-5">
            <DialogPrimitive.Title className="text-2xl sm:text-3xl font-bold leading-tight">
              {occurrence.event_title}
            </DialogPrimitive.Title>
            <p className="text-lime-200 text-sm mt-1">
              {formattedStart} – {formattedEnd}
            </p>
            <p className="text-lime-300 text-xs mt-0.5">{occurrence.org_name}</p>

            {/* Live count badge */}
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-lime-300 animate-pulse" />
              <span className="text-sm font-medium">
                {totalPeople} {totalPeople === 1 ? 'person' : 'people'} · {totalHouseholds} {totalHouseholds === 1 ? 'household' : 'households'}
              </span>
            </div>
          </div>

          {/* Center check-in area — grows to fill */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
            {checkinState === 'idle' || checkinState === 'submitting' ? (
              <>
                {/* Household size stepper */}
                <div className="text-center space-y-3">
                  <p className="text-stone-600 text-base font-medium">Household size</p>
                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      onClick={() => setHouseholdSize((n) => Math.max(1, n - 1))}
                      className="h-14 w-14 text-2xl rounded-full border-2 border-stone-300 bg-white text-stone-700 font-bold hover:border-[#4a5d23] hover:text-[#4a5d23] transition-colors flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="text-5xl font-bold text-stone-900 min-w-[3rem] text-center">
                      {householdSize}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHouseholdSize((n) => n + 1)}
                      className="h-14 w-14 text-2xl rounded-full border-2 border-stone-300 bg-white text-stone-700 font-bold hover:border-[#4a5d23] hover:text-[#4a5d23] transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Anonymous toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    role="checkbox"
                    aria-checked={isAnonymous}
                    tabIndex={0}
                    onClick={() => setIsAnonymous((v) => !v)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsAnonymous((v) => !v)}
                    className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${
                      isAnonymous ? 'bg-lime-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        isAnonymous ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-stone-700 text-base">
                    Anonymous visit {isAnonymous ? '(on)' : '(off)'}
                  </span>
                </label>

                {/* Check-in button */}
                <button
                  type="button"
                  onClick={handleCheckin}
                  disabled={checkinState === 'submitting'}
                  className="h-16 w-full max-w-xs rounded-2xl bg-lime-600 text-white text-xl font-bold shadow-lg hover:bg-lime-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {checkinState === 'submitting' ? 'Checking in…' : 'CHECK IN'}
                </button>
              </>
            ) : checkinState === 'success' ? (
              <div className="text-center space-y-4">
                <div className="text-6xl">✓</div>
                <p className="text-2xl font-bold text-[#4a5d23]">Checked In!</p>
                <p className="text-stone-600">
                  {totalPeople} {totalPeople === 1 ? 'person' : 'people'} total
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-5xl">⚠️</div>
                <p className="text-xl font-bold text-amber-700">Already checked in!</p>
                <p className="text-stone-500 text-sm">This household may have already been recorded.</p>
              </div>
            )}
          </div>

          {/* Footer — hint */}
          <div className="px-6 pb-8 pt-2 text-center">
            <p className="text-xs text-stone-400">
              Tap CHECK IN after each household visits. Resets automatically after 3 seconds.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
