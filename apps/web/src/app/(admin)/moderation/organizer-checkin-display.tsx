'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, UserCheck, UserPlus, Minus, Plus } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { HOUSEHOLD_MIN, HOUSEHOLD_MAX, formatRatePct } from '@/lib/event-checkin'

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

interface Attendee {
  user_id: string
  name: string
  status: 'early' | 'confirmed'
  household_size: number
  attendance_rate: number | null
}

interface AttendanceData {
  confirmed: number
  early: number
  no_show: number
  anonymous_confirmed: number
  people_confirmed: number
  show_rate: number | null
  ended: boolean
  attendees: Attendee[]
}

export function OrganizerCheckinDisplay({ occurrence, open, onOpenChange }: Props) {
  const supabase = createClient()

  const [data, setData] = useState<AttendanceData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [walkinSize, setWalkinSize] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null) // user_id being confirmed, or 'walkin'
  const [flash, setFlash] = useState<string | null>(null)

  const fetchAttendance = useCallback(async () => {
    const { data: j, error } = await supabase.rpc('event_attendance', { p_occurrence: occurrence.id })
    if (error) {
      setLoadError(error.message)
      return
    }
    if (j && typeof j === 'object') {
      setLoadError(null)
      setData(j as unknown as AttendanceData)
    }
  }, [occurrence.id, supabase])

  useEffect(() => {
    if (!open) return
    const run = () => fetchAttendance()
    void run()
    const interval = setInterval(run, 10_000)
    return () => clearInterval(interval)
  }, [open, fetchAttendance])

  useEffect(() => {
    if (!open) {
      Promise.resolve().then(() => {
        setWalkinSize(1)
        setBusyId(null)
        setFlash(null)
      })
    }
  }, [open])

  // Confirm an identified attendee (the ATTENDEE, never the organizer). checked_in_by /
  // confirmed_by are forced to the organizer server-side.
  const confirmAttendee = useCallback(async (att: Attendee) => {
    if (busyId) return
    setBusyId(att.user_id)
    const { error } = await supabase.rpc('organizer_confirm', {
      p_occurrence: occurrence.id,
      p_user: att.user_id,
      p_household_size: att.household_size,
    })
    if (error) {
      setFlash(error.message)
    } else {
      logger.info('admin.checkin.kiosk.confirm', { occurrence_id: occurrence.id, method: 'organizer_kiosk' })
      setFlash(`Confirmed ${att.name}`)
      await fetchAttendance()
    }
    setBusyId(null)
    setTimeout(() => setFlash(null), 2500)
  }, [busyId, supabase, occurrence.id, fetchAttendance])

  // Add an anonymous household (walk-in with no account). p_user = null.
  const addWalkin = useCallback(async () => {
    if (busyId) return
    setBusyId('walkin')
    const { error } = await supabase.rpc('organizer_confirm', {
      p_occurrence: occurrence.id,
      p_user: undefined,
      p_household_size: walkinSize,
    })
    if (error) {
      setFlash(error.message)
    } else {
      logger.info('admin.checkin.kiosk.walkin', { occurrence_id: occurrence.id, household_size: walkinSize })
      setFlash('Walk-in added')
      setWalkinSize(1)
      await fetchAttendance()
    }
    setBusyId(null)
    setTimeout(() => setFlash(null), 2500)
  }, [busyId, supabase, occurrence.id, walkinSize, fetchAttendance])

  const formattedStart = new Date(occurrence.starts_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const formattedEnd = new Date(occurrence.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const waiting = (data?.attendees ?? []).filter((a) => a.status === 'early')
  const confirmedList = (data?.attendees ?? []).filter((a) => a.status === 'confirmed')

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-stone-900/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-stone-50 overflow-hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-stone-200/80 p-1.5 text-stone-600 hover:bg-stone-300 transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Header */}
          <div className="bg-[#4a5d23] text-white px-5 pt-10 pb-5">
            <DialogPrimitive.Title className="text-2xl sm:text-3xl font-bold leading-tight">
              {occurrence.event_title}
            </DialogPrimitive.Title>
            <p className="text-lime-200 text-sm mt-1">{formattedStart} – {formattedEnd}</p>
            <p className="text-lime-300 text-xs mt-0.5">{occurrence.org_name}</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-lime-300 animate-pulse" />
              <span className="text-sm font-medium">
                {(data?.people_confirmed ?? 0)} {(data?.people_confirmed ?? 0) === 1 ? 'person' : 'people'} confirmed
                {data ? ` · ${data.confirmed + data.anonymous_confirmed} check-in${(data.confirmed + data.anonymous_confirmed) === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {flash && (
              <div className="rounded-lg bg-lime-50 border border-lime-200 px-4 py-2 text-sm text-lime-800">{flash}</div>
            )}
            {loadError && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-2 text-sm text-red-700">{loadError}</div>
            )}

            {/* Waiting to confirm — the "I'm coming" list */}
            <section>
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">
                Waiting to confirm ({waiting.length})
              </h2>
              {waiting.length === 0 ? (
                <p className="text-sm text-stone-400">No one is waiting — early check-ins appear here.</p>
              ) : (
                <div className="space-y-2">
                  {waiting.map((att) => (
                    <div key={att.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 truncate">{att.name}</p>
                        <p className="text-xs text-stone-400">
                          Household {att.household_size} · attendance {formatRatePct(att.attendance_rate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => confirmAttendee(att)}
                        disabled={busyId !== null}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-lime-600 hover:bg-lime-700 disabled:opacity-60 text-white text-sm font-semibold px-3 py-2 transition-colors"
                      >
                        {busyId === att.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        Confirm
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Walk-in — anonymous household add */}
            <section>
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">Add a walk-in</h2>
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setWalkinSize((n) => Math.max(HOUSEHOLD_MIN, n - 1))}
                    className="h-10 w-10 rounded-full border-2 border-stone-300 bg-white text-stone-700 font-bold hover:border-[#4a5d23] flex items-center justify-center"
                    aria-label="Decrease household size"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-3xl font-bold text-stone-900 min-w-[2.5rem] text-center tabular-nums">{walkinSize}</span>
                  <button
                    type="button"
                    onClick={() => setWalkinSize((n) => Math.min(HOUSEHOLD_MAX, n + 1))}
                    className="h-10 w-10 rounded-full border-2 border-stone-300 bg-white text-stone-700 font-bold hover:border-[#4a5d23] flex items-center justify-center"
                    aria-label="Increase household size"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-stone-400">{walkinSize === 1 ? 'person' : 'people'}</span>
                </div>
                <button
                  type="button"
                  onClick={addWalkin}
                  disabled={busyId !== null}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#4a5d23] hover:bg-[#3d4d1c] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                >
                  {busyId === 'walkin' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Add household
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Anonymous walk-ins are counted for the event but not linked to any account.
              </p>
            </section>

            {/* Confirmed list */}
            {confirmedList.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">
                  Confirmed ({confirmedList.length})
                </h2>
                <div className="space-y-1.5">
                  {confirmedList.map((att) => (
                    <div key={att.user_id} className="flex items-center gap-2 rounded-lg bg-white border border-stone-100 px-3 py-2">
                      <UserCheck className="h-4 w-4 text-lime-600 shrink-0" />
                      <span className="text-sm text-stone-700 truncate">{att.name}</span>
                      <span className="ml-auto text-xs text-stone-400">Household {att.household_size}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="px-6 pb-8 pt-2 text-center border-t border-stone-100">
            <p className="text-xs text-stone-400">
              Confirm each person as they arrive. Live count refreshes automatically.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
