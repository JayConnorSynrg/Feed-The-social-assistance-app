'use client'

// apps/web/src/app/(admin)/moderation/organizer-checkin-display.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organizer's full-screen check-in kiosk for one event date. P6 W4: portalled to <body>, it
// carries the admin's lang / dir itself and every word is lib/i18n-org-admin.ts; event, organization
// and attendee names keep their own (lang="" dir="auto"). A confirm or walk-in result is announced
// in an always-mounted status line inside the dialog; a failure shows a translated line (never the
// server's text) in an always-mounted alert and writes one admin.checkin.kiosk.failed row with its
// code — the 10-second refresh writes one row per run of failures, not one per poll.

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Loader2, UserCheck, UserPlus, Minus, Plus } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { HOUSEHOLD_MIN, HOUSEHOLD_MAX, formatRatePct } from '@/lib/event-checkin'
import { formatEventWhen } from '@/lib/event-time'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate } from '@/lib/format-message'
import { formatCount, formatPercent, pluralMessage } from '@/lib/i18n-intl'
import { moderationCount } from '@/lib/i18n-admin-moderation'
import { eventMemberT } from '@/lib/i18n-event-member'
import { CHECKIN_COUNT, PEOPLE_CONFIRMED, PEOPLE_WORD, orgAdminT } from '@/lib/i18n-org-admin'
import { namedControl } from '@/lib/i18n-admin-resources'
import { afterLayout, announce, focusAfterRowRemoval } from './row-focus'

/** The walk-in stepper's +/- buttons; at a bound a solid grey (not a dim, so the ring keeps contrast). */
const STEP_CLASS =
  'h-10 w-10 rounded-full border-2 border-stone-500 bg-white text-stone-700 font-bold hover:border-[#4a5d23] flex items-center justify-center aria-disabled:bg-stone-200 aria-disabled:text-stone-700 aria-disabled:hover:border-stone-500'

/** Each waiting row's Confirm button. */
export const kioskConfirmId = (userId: string) => `kiosk-confirm-${userId}`

interface OccurrenceInfo {
  id: string
  starts_at: string
  ends_at: string
  event_title: string
  org_name: string
  /** The venue's IANA zone (assistance_events.time_zone). */
  time_zone: string
}

interface Props {
  occurrence: OccurrenceInfo
  open: boolean
  onOpenChange: (open: boolean) => void
  locale?: Locale
  /** The kiosk is opened without a DialogTrigger: the opener restores focus here. */
  onCloseAutoFocus?: (event: Event) => void
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

export function OrganizerCheckinDisplay({ occurrence, open, onOpenChange, locale = 'en', onCloseAutoFocus }: Props) {
  const supabase = createClient()

  const [data, setData] = useState<AttendanceData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [walkinSize, setWalkinSize] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null) // user_id being confirmed, or 'walkin'
  const [flash, setFlash] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const t = (key: Parameters<typeof orgAdminT>[1]) => orgAdminT(locale, key)
  // One log row per run of failed refreshes (the kiosk polls every 10 s).
  const loadFailing = useRef(false)
  // A confirmed person leaves the waiting list: focus their next neighbour's Confirm, else Add household.
  const walkinButton = useRef<HTMLButtonElement | null>(null)
  // The result line clears 2.5 s after the LAST result: one timer, replaced by each new result.
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showFlash = useCallback((text: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    // Emptied, then filled after layout: a repeated identical result is announced again.
    announce(setFlash, text)
    flashTimer.current = setTimeout(() => {
      flashTimer.current = null
      setFlash(null)
    }, 2500)
  }, [])
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  const fetchAttendance = useCallback(async () => {
    const { data: j, error } = await supabase.rpc('event_attendance', { p_occurrence: occurrence.id })
    if (error) {
      if (!loadFailing.current) logger.warn('admin.checkin.kiosk.failed', { op: 'load', code: error.code || 'unknown' })
      loadFailing.current = true
      setLoadError(orgAdminT(locale, 'kioskLoadFailed'))
      return
    }
    loadFailing.current = false
    if (j && typeof j === 'object') {
      setLoadError(null)
      setData(j as unknown as AttendanceData)
    }
  }, [occurrence.id, supabase, locale])

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
        setActionError(null)
      })
    }
  }, [open])

  // Confirm an identified attendee (the ATTENDEE, never the organizer). checked_in_by /
  // confirmed_by are forced to the organizer server-side.
  const confirmAttendee = useCallback(async (att: Attendee) => {
    if (busyId) return
    setBusyId(att.user_id)
    setActionError(null)
    const { error } = await supabase.rpc('organizer_confirm', {
      p_occurrence: occurrence.id,
      p_user: att.user_id,
      p_household_size: att.household_size,
    })
    if (error) {
      logger.warn('admin.checkin.kiosk.failed', { op: 'confirm', code: error.code || 'unknown' })
      setActionError(formatMessage(orgAdminT(locale, 'kioskConfirmFailed'), { name: isolate(att.name) }))
    } else {
      logger.info('admin.checkin.kiosk.confirm', { occurrence_id: occurrence.id, method: 'organizer_kiosk' })
      showFlash(formatMessage(orgAdminT(locale, 'flashConfirmed'), { name: isolate(att.name) }))
      const waitingIds = (data?.attendees ?? []).filter((a) => a.status === 'early').map((a) => a.user_id)
      const next = focusAfterRowRemoval(waitingIds, att.user_id)
      await fetchAttendance()
      afterLayout(() => {
        ;((next ? document.getElementById(kioskConfirmId(next)) : null) ?? walkinButton.current)?.focus()
      })
    }
    setBusyId(null)
  }, [busyId, supabase, occurrence.id, fetchAttendance, locale, data, showFlash])

  // Add an anonymous household (walk-in with no account). p_user = null.
  const addWalkin = useCallback(async () => {
    if (busyId) return
    setBusyId('walkin')
    setActionError(null)
    const { error } = await supabase.rpc('organizer_confirm', {
      p_occurrence: occurrence.id,
      p_user: undefined,
      p_household_size: walkinSize,
    })
    if (error) {
      logger.warn('admin.checkin.kiosk.failed', { op: 'walkin', code: error.code || 'unknown' })
      setActionError(orgAdminT(locale, 'kioskWalkinFailed'))
    } else {
      logger.info('admin.checkin.kiosk.walkin', { occurrence_id: occurrence.id, household_size: walkinSize })
      showFlash(orgAdminT(locale, 'flashWalkin'))
      setWalkinSize(1)
      await fetchAttendance()
    }
    setBusyId(null)
  }, [busyId, supabase, occurrence.id, walkinSize, fetchAttendance, locale, showFlash])

  const atMin = walkinSize <= HOUSEHOLD_MIN
  const atMax = walkinSize >= HOUSEHOLD_MAX
  const when = formatEventWhen(occurrence.starts_at, occurrence.ends_at, occurrence.time_zone, locale)

  const rate = (r: number | null) => (r === null || Number.isNaN(r) ? formatRatePct(r) : formatPercent(Math.round(r * 100), locale))
  const checkins = data ? data.confirmed + data.anonymous_confirmed : 0
  const waiting = (data?.attendees ?? []).filter((a) => a.status === 'early')
  const confirmedList = (data?.attendees ?? []).filter((a) => a.status === 'confirmed')

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-stone-900/90" />
        {/* Portalled to <body>: it carries the admin's language itself, not the page's. */}
        <DialogPrimitive.Content
          lang={locale}
          dir={dir(locale)}
          className="fixed inset-0 z-50 flex flex-col bg-stone-50 overflow-hidden"
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogPrimitive.Close className="absolute end-3 top-3 z-10 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-stone-200/80 p-1.5 text-stone-700 hover:bg-stone-300 transition-colors">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('close')}</span>
          </DialogPrimitive.Close>

          {/* Header */}
          <div className="bg-[#4a5d23] text-white px-5 pt-10 pb-5">
            <DialogPrimitive.Title className="text-2xl sm:text-3xl font-bold leading-tight">
              <span lang="" dir="auto">{occurrence.event_title}</span>
            </DialogPrimitive.Title>
            <p className="text-lime-200 text-sm mt-1">{when.text}</p>
            {when.venue && <p className="text-lime-200 text-xs">{when.venue}</p>}
            <p lang="" dir="auto" className="text-lime-200 text-xs mt-0.5">{occurrence.org_name}</p>
            <div className="mt-3 inline-flex flex-wrap items-center gap-2 bg-white/15 rounded-full px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-lime-300 animate-pulse" aria-hidden="true" />
              <span className="text-sm font-medium">
                {moderationCount(PEOPLE_CONFIRMED, data?.people_confirmed ?? 0, locale)}
                {data ? ` · ${moderationCount(CHECKIN_COUNT, checkins, locale)}` : ''}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Inside the dialog (the page behind it is aria-hidden) and always mounted, so each
                result and each failure is announced when its line appears. */}
            <div role="status" className={flash ? 'rounded-lg bg-lime-50 border border-lime-700 px-4 py-2 text-sm text-lime-900' : 'sr-only'}>
              {flash ?? ''}
            </div>
            <div role="alert" className={actionError || loadError ? 'rounded-lg bg-red-50 border border-red-700 px-4 py-2 text-sm text-red-800' : 'sr-only'}>
              {actionError ?? loadError ?? ''}
            </div>

            {/* Waiting to confirm — the "I'm coming" list */}
            <section>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-2">
                {formatMessage(t('waitingTitle'), { count: formatCount(waiting.length, locale) })}
              </h2>
              {waiting.length === 0 ? (
                <p className="text-sm text-stone-600">{t('waitingEmpty')}</p>
              ) : (
                <div className="space-y-2">
                  {waiting.map((att) => (
                    <div key={att.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p lang="" dir="auto" className="font-medium text-stone-800 truncate">{att.name}</p>
                        <p className="text-xs text-stone-600">
                          {formatMessage(t('householdSize'), { size: formatCount(att.household_size, locale) })}
                          {' · '}
                          {formatMessage(t('attendance'), { rate: rate(att.attendance_rate) })}
                        </p>
                      </div>
                      {/* aria-disabled while a confirm runs (not disabled): the pressed button keeps focus. */}
                      <button
                        type="button"
                        id={kioskConfirmId(att.user_id)}
                        onClick={() => confirmAttendee(att)}
                        aria-disabled={busyId !== null || undefined}
                        aria-label={namedControl(t('confirm'), att.name)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-lime-700 hover:bg-lime-800 text-white text-sm font-semibold px-3 py-2 transition-colors"
                      >
                        {busyId === att.user_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
                        {t('confirm')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Walk-in — anonymous household add */}
            <section>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-2">{t('walkinTitle')}</h2>
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-4 flex flex-wrap items-center justify-between gap-4">
                {/* Two buttons and a live value (not the APG spinbutton): the kiosk is used by touch at a
                    door, where two large +/- targets beat arrow keys on a focused number, and each press
                    is heard as the new size with its word ("3 people"). At a bound the button is
                    aria-disabled (it keeps focus) and its press does nothing. */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    data-testid="walkin-decrease"
                    onClick={() => { if (!atMin) setWalkinSize((n) => Math.max(HOUSEHOLD_MIN, n - 1)) }}
                    aria-disabled={atMin || undefined}
                    className={STEP_CLASS}
                    aria-label={eventMemberT(locale, 'householdDecrease')}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span data-testid="walkin-size" aria-live="polite" aria-atomic="true" className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-stone-900 min-w-[2.5rem] text-center tabular-nums">{formatCount(walkinSize, locale)}</span>
                    <span className="text-xs text-stone-600">{pluralMessage(PEOPLE_WORD[locale] ?? PEOPLE_WORD.en, walkinSize, locale)}</span>
                  </span>
                  <button
                    type="button"
                    data-testid="walkin-increase"
                    onClick={() => { if (!atMax) setWalkinSize((n) => Math.min(HOUSEHOLD_MAX, n + 1)) }}
                    aria-disabled={atMax || undefined}
                    className={STEP_CLASS}
                    aria-label={eventMemberT(locale, 'householdIncrease')}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  ref={walkinButton}
                  onClick={() => { if (busyId === null) void addWalkin() }}
                  aria-disabled={busyId !== null || undefined}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#4a5d23] hover:bg-[#3d4d1c] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                >
                  {busyId === 'walkin' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                  {t('addHousehold')}
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-600">{t('walkinHint')}</p>
            </section>

            {/* Confirmed list */}
            {confirmedList.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-2">
                  {formatMessage(t('confirmedTitle'), { count: formatCount(confirmedList.length, locale) })}
                </h2>
                <div className="space-y-1.5">
                  {confirmedList.map((att) => (
                    <div key={att.user_id} className="flex items-center gap-2 rounded-lg bg-white border border-stone-100 px-3 py-2">
                      <UserCheck className="h-4 w-4 text-lime-700 shrink-0" aria-hidden="true" />
                      <span lang="" dir="auto" className="text-sm text-stone-700 truncate">{att.name}</span>
                      <span className="ms-auto text-xs text-stone-600">
                        {formatMessage(t('householdSize'), { size: formatCount(att.household_size, locale) })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="px-6 pb-8 pt-2 text-center border-t border-stone-100">
            <p className="text-xs text-stone-600">{t('footer')}</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
