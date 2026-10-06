'use client'

// apps/web/src/app/(admin)/moderation/event-scheduler.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Events tab — used by the organization admin page (selectedOrgId = that org's id) and by the
// main admin (selectedOrgId = 'all' or the header's org). With a real org id it reads ONLY that
// org's events and never calls get_admin_org_list; with 'all' it reads the orgs the caller
// administers (unchanged scope).
//
// Every write is one RPC through lib/event-admin-rpc.ts (privilegedRpc -> one admin_actions row
// + one app_logs row sharing request_id): create (one step, first date included), add dates,
// cancel a date, edit, retire. The client writes no table directly. Times are shown through
// lib/event-time.ts (viewer's time, plus venue time when the zones differ); the calendar files
// each date under the venue's local day.

import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { eventFormT, eventTypeColor, eventTypeLabel, formatMessage } from '@/lib/i18n-event-forms'
import { formatEventWhen, venueDateKey } from '@/lib/event-time'
import { cancelEventOccurrence } from '@/lib/event-admin-rpc'
import { createSubmitController, mintIdempotencyKey, type FieldError } from '@/lib/event-form-model'
import { formatRatePct } from '@/lib/event-checkin'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { OrganizerCheckinDisplay } from './organizer-checkin-display'
import { useAdminOrgs } from './use-admin-orgs'
import { EventCreateDialog, type OrgChoice } from './event-create-dialog'
import { EventDatesDialog, type DatesTarget } from './event-dates-dialog'
import { EventEditDialog, type EditTarget } from './event-edit-dialog'
import { DANGER, EventDialog, FOCUS_RING, PRIMARY, SECONDARY, errorText } from './event-form-ui'
import { restoreFocusAfterPanel } from './org-panel-focus'
import { pickOpener } from './event-focus'

interface EventOccurrence {
  id: string
  event_id: string
  starts_at: string
  ends_at: string
  status: string
  capacity: number | null
  notes: string | null
}

interface AssistanceEvent {
  id: string
  title: string
  event_type: string
  description: string | null
  location_name: string | null
  org_id: string
  time_zone: string
  is_active: boolean
  occurrences: EventOccurrence[]
  org?: { name: string } | null
}

/** One date with its event's display fields. */
type ScheduledDate = EventOccurrence & {
  event_title: string
  event_type: string
  org_id: string
  org_name: string
  time_zone: string
}

const EVENT_SELECT =
  'id, title, event_type, description, location_name, org_id, time_zone, is_active, created_at, org:organizations(name), occurrences:event_occurrences(id, event_id, starts_at, ends_at, status, capacity, notes)'
/** Bounded reads: newest events first, each with its latest dates. */
const EVENT_LIST_LIMIT = 200
const DATES_PER_EVENT = 200

interface AttendanceView {
  occurrence: ScheduledDate
  data: {
    early: number
    confirmed: number
    no_show: number
    anonymous_confirmed: number
    people_confirmed: number
    show_rate: number | null
    ended: boolean
    attendees: Array<{ user_id: string; name: string; status: string; household_size: number; attendance_rate: number | null }>
  } | null
  loading: boolean
  error: string | null
}

const SMALL_BTN =
  'inline-flex min-h-6 w-full items-center justify-center rounded px-1 text-xs font-semibold transition-colors ' + FOCUS_RING
const LINK_BTN =
  'inline-flex min-h-6 items-center rounded px-1 text-xs font-medium text-[#4a5d23] hover:underline ' + FOCUS_RING

interface Props {
  selectedOrgId: string
}

function dayLabel(day: Date, locale: Locale, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, opts).format(day)
}

export function EventScheduler({ selectedOrgId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const locale = useProfileLocale()
  const scoped = selectedOrgId !== 'all'
  // On a single org's screen the cross-org list is never read.
  const { orgs: adminOrgs, loading: orgsLoading } = useAdminOrgs({ enabled: !scoped })

  const [events, setEvents] = useState<AssistanceEvent[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  // "Now" for ended / cancellable decisions, taken when the list was (re)loaded.
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  const [createState, setCreateState] = useState<{ key: number; date?: string } | null>(null)
  const [datesTarget, setDatesTarget] = useState<(DatesTarget & { key: number }) | null>(null)
  const [editTarget, setEditTarget] = useState<(EditTarget & { key: number }) | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ScheduledDate | null>(null)
  const [cancelError, setCancelError] = useState<FieldError | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelController] = useState(() => createSubmitController(mintIdempotencyKey))
  // Every dialog here is opened without a DialogTrigger: remember the control that opened it and
  // return focus there on close, or to "New event" when that control is gone (or, after a date
  // was cancelled, will be gone once the list refreshes).
  const openerRef = useRef<HTMLElement | null>(null)
  const newEventRef = useRef<HTMLButtonElement>(null)
  const focusFallbackRef = useRef(false)
  // Each open gets a fresh dialog key, so every open is a new form (new idempotency key).
  const dialogSeq = useRef(0)
  const rememberOpener = (e?: { currentTarget: unknown }) => {
    openerRef.current = pickOpener(e?.currentTarget, document.activeElement, document.body) as HTMLElement | null
    focusFallbackRef.current = false
  }
  const restoreFocus = (e: Event) => {
    const opener = focusFallbackRef.current ? null : openerRef.current
    restoreFocusAfterPanel(e, opener, { querySelector: () => newEventRef.current })
  }
  const [kiosk, setKiosk] = useState<ScheduledDate | null>(null)
  const [attendance, setAttendance] = useState<AttendanceView | null>(null)

  useEffect(() => {
    if (!scoped && orgsLoading) return
    let cancelled = false
    const base = supabase.from('assistance_events').select(EVENT_SELECT)
    // Scope: exactly this org, or the orgs the caller administers ('all').
    const filtered = scoped ? base.eq('org_id', selectedOrgId) : base.in('org_id', adminOrgs.map((o) => o.id))
    void filtered
      .order('created_at', { ascending: false })
      .order('starts_at', { referencedTable: 'occurrences', ascending: false })
      .limit(EVENT_LIST_LIMIT)
      .limit(DATES_PER_EVENT, { referencedTable: 'occurrences' })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          logger.warn('admin.event.scheduler.load_failed', { code: error.code ?? null, scoped })
          setLoadState('error')
          return
        }
        setEvents((data as unknown as AssistanceEvent[]) ?? [])
        setLoadedAt(Date.now())
        setLoadState('ready')
      })
    return () => {
      cancelled = true
    }
  }, [supabase, scoped, selectedOrgId, adminOrgs, orgsLoading, reload])

  const refresh = () => setReload((n) => n + 1)

  const isEnded = (occ: { status: string; ends_at: string }) => occ.status === 'completed' || new Date(occ.ends_at).getTime() < loadedAt
  // Cancel is offered only on a date that has not ended and is not cancelled (the DB refuses
  // cancelling an ended date — its attendance history is permanent).
  const canCancel = (occ: { status: string; ends_at: string }) => occ.status !== 'cancelled' && !isEnded(occ)

  const allDates: ScheduledDate[] = events.flatMap((event) =>
    (event.occurrences ?? []).map((occ) => ({
      ...occ,
      event_title: event.title,
      event_type: event.event_type,
      org_id: event.org_id,
      org_name: event.org?.name ?? '',
      time_zone: event.time_zone,
    }))
  )
  // The calendar hides cancelled dates; "Past and cancelled" keeps them reachable for Attendance.
  const calendarDates = allDates.filter((o) => o.status !== 'cancelled')
  const pastAndCancelled = allDates
    .filter((o) => o.status === 'cancelled' || isEnded(o))
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  const datesOn = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd')
    return calendarDates
      .filter((o) => venueDateKey(o.starts_at, o.time_zone) === key)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }

  const openCreate = (e: { currentTarget: unknown }, date?: string) => {
    rememberOpener(e)
    setCreateState({ key: ++dialogSeq.current, date })
  }

  async function openAttendance(occ: ScheduledDate, e: { currentTarget: unknown }) {
    rememberOpener(e)
    setAttendance({ occurrence: occ, data: null, loading: true, error: null })
    const { data, error } = await supabase.rpc('event_attendance', { p_occurrence: occ.id })
    if (error) {
      logger.warn('admin.event.attendance.load_failed', { code: error.code ?? null })
      setAttendance({ occurrence: occ, data: null, loading: false, error: error.message })
    } else setAttendance({ occurrence: occ, data: (data as AttendanceView['data']) ?? null, loading: false, error: null })
  }

  function openKiosk(occ: ScheduledDate, e: { currentTarget: unknown }) {
    rememberOpener(e)
    setKiosk(occ)
    logger.info('admin.event.scheduler.kiosk_opened', { occurrence_id: occ.id, event_id: occ.event_id })
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelController.inFlight) return
    setCancelError(null)
    setCancelling(true)
    const target = cancelTarget
    const outcome = await cancelController.submit(() =>
      cancelEventOccurrence(supabase, { occurrenceId: target.id, eventId: target.event_id, orgId: target.org_id })
    )
    setCancelling(false)
    if (outcome.status === 'busy') return
    if (outcome.result.ok) {
      // The cancelled date leaves the calendar on refresh, taking its button with it.
      focusFallbackRef.current = true
      setCancelTarget(null)
      setNotice(eventFormT(locale, 'dateCancelled'))
      refresh()
    } else {
      setCancelError({ key: outcome.result.errorKey })
    }
  }

  const orgChoice: OrgChoice = scoped ? { kind: 'fixed', orgId: selectedOrgId } : { kind: 'pick', orgs: adminOrgs }

  /** Ids of one calendar entry's title / day / time, so each action names the date it acts on. */
  const entryIds = (occ: ScheduledDate, view: 'w' | 'd' | 'p') => ({
    title: `ev-${view}-${occ.id}-title`,
    day: `ev-${view}-${occ.id}-day`,
    time: `ev-${view}-${occ.id}-time`,
  })

  function dateActions(occ: ScheduledDate, stacked: boolean, describedBy: string) {
    const cls = stacked ? `${SMALL_BTN} mt-1` : `${SECONDARY} min-h-9 px-3 text-xs`
    return (
      <>
        <button type="button" aria-describedby={describedBy} onClick={(e) => openKiosk(occ, e)} className={`${cls} bg-white/70 hover:bg-white`}>
          {eventFormT(locale, 'signIn')}
        </button>
        <button type="button" aria-describedby={describedBy} onClick={(e) => void openAttendance(occ, e)} className={`${cls} bg-white/50 hover:bg-white`}>
          {eventFormT(locale, 'attendance')}
        </button>
        {canCancel(occ) && (
          <button
            type="button"
            aria-describedby={describedBy}
            onClick={(e) => {
              rememberOpener(e)
              setCancelError(null)
              setCancelTarget(occ)
            }}
            className={`${cls} bg-white/40 text-red-700 hover:bg-red-50`}
          >
            {eventFormT(locale, 'cancelDate')}
          </button>
        )}
      </>
    )
  }

  if (loadState === 'loading') {
    return (
      <div lang={locale} dir={dir(locale)} className="flex h-48 items-center justify-center text-stone-600" role="status">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">{eventFormT(locale, 'loading')}</span>
      </div>
    )
  }
  if (loadState === 'error') {
    return (
      <div lang={locale} dir={dir(locale)} className="flex h-48 flex-col items-center justify-center gap-3" role="alert">
        <p className="text-sm text-stone-800">{eventFormT(locale, 'loadError')}</p>
        <button type="button" className={SECONDARY} onClick={refresh}>
          {eventFormT(locale, 'retry')}
        </button>
      </div>
    )
  }

  return (
    <div lang={locale} dir={dir(locale)} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#4a5d23]">{eventFormT(locale, 'calendarTitle')}</h2>
        <button ref={newEventRef} type="button" className={PRIMARY} onClick={(e) => openCreate(e)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {eventFormT(locale, 'newEvent')}
        </button>
      </div>

      <p role="status" className="text-sm text-lime-800">
        {notice}
      </p>

      {/* Week view (md+) */}
      <div className="hidden overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm md:block">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
          <button
            type="button"
            onClick={() => setCurrentWeekStart((d) => subWeeks(d, 1))}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{eventFormT(locale, 'prevWeek')}</span>
          </button>
          <span className="text-sm font-medium text-stone-800">
            {dayLabel(currentWeekStart, locale, { month: 'short', day: 'numeric' })} –{' '}
            {dayLabel(addDays(currentWeekStart, 6), locale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => setCurrentWeekStart((d) => addWeeks(d, 1))}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{eventFormT(locale, 'nextWeek')}</span>
          </button>
        </div>
        <div className="grid grid-cols-7 divide-x divide-stone-100">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="border-b border-stone-100 px-2 py-2 text-center">
              <p className="text-xs font-medium text-stone-600">{dayLabel(day, locale, { weekday: 'short' })}</p>
              <p className={`mt-0.5 text-sm font-bold ${isSameDay(day, new Date()) ? 'text-lime-700' : 'text-stone-800'}`}>
                {format(day, 'd')}
              </p>
            </div>
          ))}
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            return (
              <div key={dayKey} className="min-h-[100px] p-1">
                {datesOn(day).map((occ) => {
                  const when = formatEventWhen(occ.starts_at, occ.ends_at, occ.time_zone, locale, { timeOnly: true })
                  const ids = entryIds(occ, 'w')
                  return (
                    <div key={occ.id} className={`mb-1 rounded-lg border border-stone-200 p-1.5 text-xs ${eventTypeColor(occ.event_type)}`}>
                      <p id={ids.title} className="truncate font-medium leading-tight">{occ.event_title}</p>
                      <span id={ids.day} className="sr-only">
                        {dayLabel(day, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      <p id={ids.time}>
                        {when.text}
                        {when.venue && <span className="block text-[11px]">{when.venue}</span>}
                      </p>
                      {dateActions(occ, true, `${ids.title} ${ids.day} ${ids.time}`)}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={(e) => openCreate(e, dayKey)}
                  className={`${SMALL_BTN} text-stone-500 hover:bg-lime-50 hover:text-lime-800`}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">
                    {formatMessage(eventFormT(locale, 'newEventOnDay'), { day: dayLabel(day, locale, { weekday: 'long', month: 'long', day: 'numeric' }) })}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day view (<md) */}
      <div className="block overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm md:hidden">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setSelectedDay((d) => addDays(d, -1))}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{eventFormT(locale, 'prevDay')}</span>
          </button>
          <div className="text-center">
            <p className="text-xs text-stone-600">{dayLabel(selectedDay, locale, { weekday: 'long' })}</p>
            <p className={`text-lg font-bold ${isSameDay(selectedDay, new Date()) ? 'text-lime-700' : 'text-stone-800'}`}>
              {dayLabel(selectedDay, locale, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDay((d) => addDays(d, 1))}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{eventFormT(locale, 'nextDay')}</span>
          </button>
        </div>
        <div className="min-h-[120px] space-y-2 p-4">
          {datesOn(selectedDay).length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-600">{eventFormT(locale, 'noEventsDay')}</p>
          ) : (
            datesOn(selectedDay).map((occ) => {
              const when = formatEventWhen(occ.starts_at, occ.ends_at, occ.time_zone, locale, { timeOnly: true })
              const ids = entryIds(occ, 'd')
              return (
                <div key={occ.id} className={`rounded-xl border border-stone-200 p-3 ${eventTypeColor(occ.event_type)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p id={ids.title} className="font-semibold">{occ.event_title}</p>
                      <span id={ids.day} className="sr-only">
                        {dayLabel(selectedDay, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      <p id={ids.time} className="text-xs">
                        {when.text}
                        {when.venue && <span className="block">{when.venue}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {dateActions(occ, false, `${ids.title} ${ids.day} ${ids.time}`)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Events list */}
      <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-stone-800">
          {formatMessage(eventFormT(locale, 'allEvents'), { count: events.length })}
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-stone-600">{eventFormT(locale, 'noEvents')}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {events.map((event) => {
              const next = [...(event.occurrences ?? [])]
                .filter((o) => o.status !== 'cancelled' && !isEnded(o))
                .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
              const when = next ? formatEventWhen(next.starts_at, next.ends_at, event.time_zone, locale) : null
              return (
                <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">
                      {event.title}
                      {!event.is_active && (
                        <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">
                          {eventFormT(locale, 'statusRetired')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-stone-600">
                      {eventTypeLabel(event.event_type, locale)}
                      {!scoped && event.org?.name ? ` · ${event.org.name}` : ''}
                      {when ? ` · ${when.text}` : ''}
                    </p>
                    {when?.venue && <p className="text-xs text-stone-600">{when.venue}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className={LINK_BTN}
                      aria-label={formatMessage(eventFormT(locale, 'editAria'), { title: event.title })}
                      onClick={(e) => {
                        rememberOpener(e)
                        setEditTarget({
                          key: ++dialogSeq.current,
                          id: event.id,
                          org_id: event.org_id,
                          title: event.title,
                          event_type: event.event_type,
                          description: event.description,
                          location_name: event.location_name,
                          time_zone: event.time_zone,
                          is_active: event.is_active,
                        })
                      }}
                    >
                      {eventFormT(locale, 'edit')}
                    </button>
                    {event.is_active && (
                      <button
                        type="button"
                        className={LINK_BTN}
                        aria-label={formatMessage(eventFormT(locale, 'addDatesAria'), { title: event.title })}
                        onClick={(e) => {
                          rememberOpener(e)
                          setDatesTarget({
                            key: ++dialogSeq.current,
                            id: event.id,
                            title: event.title,
                            org_id: event.org_id,
                            time_zone: event.time_zone,
                          })
                        }}
                      >
                        {eventFormT(locale, 'addDates')}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {pastAndCancelled.length > 0 && (
        <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-stone-800">
            {formatMessage(eventFormT(locale, 'pastCancelled'), { count: pastAndCancelled.length })}
          </h3>
          <ul className="divide-y divide-stone-100">
            {pastAndCancelled.map((occ) => {
              const when = formatEventWhen(occ.starts_at, occ.ends_at, occ.time_zone, locale)
              const ids = entryIds(occ, 'p')
              return (
                <li key={occ.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p id={ids.title} className="truncate text-sm font-medium text-stone-900">
                      {occ.event_title}
                    </p>
                    <p id={ids.time} className="text-xs text-stone-600">
                      {when.text} ·{' '}
                      <span className={occ.status === 'cancelled' ? 'text-red-700' : 'text-stone-700'}>
                        {eventFormT(locale, occ.status === 'cancelled' ? 'statusCancelled' : 'statusEnded')}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-describedby={`${ids.title} ${ids.time}`}
                    onClick={(e) => void openAttendance(occ, e)}
                    className={LINK_BTN}
                  >
                    {eventFormT(locale, 'attendance')}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {createState && (
        <EventCreateDialog
          key={createState.key}
          open
          onOpenChange={(open) => {
            if (!open) setCreateState(null)
          }}
          locale={locale}
          orgChoice={orgChoice}
          initialDate={createState.date}
          onCloseAutoFocus={restoreFocus}
          onCreated={(_id, title) => {
            setNotice(formatMessage(eventFormT(locale, 'createdNotice'), { title }))
            refresh()
          }}
        />
      )}

      {datesTarget && (
        <EventDatesDialog
          key={datesTarget.key}
          open
          onOpenChange={(open) => {
            if (!open) setDatesTarget(null)
          }}
          locale={locale}
          event={datesTarget}
          onCloseAutoFocus={restoreFocus}
          initialDate={format(new Date(), 'yyyy-MM-dd')}
          onAdded={(changed) => {
            setNotice(
              changed > 0
                ? formatMessage(eventFormT(locale, 'datesAdded'), { count: changed })
                : eventFormT(locale, 'datesNoneAdded')
            )
            refresh()
          }}
        />
      )}

      {editTarget && (
        <EventEditDialog
          key={editTarget.key}
          open
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
          locale={locale}
          event={editTarget}
          onCloseAutoFocus={restoreFocus}
          onSaved={(action) => {
            setNotice(eventFormT(locale, action === 'retire' ? 'retiredNotice' : 'savedNotice'))
            refresh()
          }}
        />
      )}

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelTarget(null)
        }}
      >
        <AlertDialogContent lang={locale} dir={dir(locale)} onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{eventFormT(locale, 'cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget &&
                formatMessage(eventFormT(locale, 'cancelConfirmBody'), {
                  title: cancelTarget.event_title,
                  when: formatEventWhen(cancelTarget.starts_at, cancelTarget.ends_at, cancelTarget.time_zone, locale).text,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelError && (
            <p role="alert" className="text-sm text-red-700">
              {errorText(locale, cancelError)}
            </p>
          )}
          <AlertDialogFooter>
            <button type="button" className={SECONDARY} onClick={() => setCancelTarget(null)} disabled={cancelling}>
              {eventFormT(locale, 'keepDate')}
            </button>
            <button type="button" className={DANGER} aria-disabled={cancelling || undefined} onClick={() => void confirmCancel()}>
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {eventFormT(locale, 'cancelDate')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {kiosk && (
        <OrganizerCheckinDisplay
          occurrence={{
            id: kiosk.id,
            starts_at: kiosk.starts_at,
            ends_at: kiosk.ends_at,
            event_title: kiosk.event_title,
            org_name: kiosk.org_name,
            time_zone: kiosk.time_zone,
          }}
          locale={locale}
          open
          onCloseAutoFocus={restoreFocus}
          onOpenChange={(open) => {
            if (!open) setKiosk(null)
          }}
        />
      )}

      {/* Attendance for one date */}
      {attendance && (
        <EventDialog
          open
          onOpenChange={(open) => {
            if (!open) setAttendance(null)
          }}
          title={eventFormT(locale, 'attendance')}
          locale={locale}
          onCloseAutoFocus={restoreFocus}
        >
          <p className="mb-4 text-sm text-stone-700">
            {attendance.occurrence.event_title} ·{' '}
            {formatEventWhen(attendance.occurrence.starts_at, attendance.occurrence.ends_at, attendance.occurrence.time_zone, locale).text}
          </p>
          {attendance.loading ? (
            <p role="status" className="text-sm text-stone-700">
              {eventFormT(locale, 'attLoading')}
            </p>
          ) : attendance.error ? (
            <p role="alert" className="text-sm text-red-700">
              {eventFormT(locale, 'attLoadError')}
            </p>
          ) : !attendance.data ? (
            <p className="text-sm text-stone-700">{eventFormT(locale, 'attNoAccess')}</p>
          ) : (
            <>
              <dl className="mb-4 grid grid-cols-4 gap-2">
                {(
                  [
                    ['attConfirmed', String(attendance.data.confirmed)],
                    ['attEarly', String(attendance.data.early)],
                    ['attNoShow', String(attendance.data.no_show)],
                    ['attShowRate', formatRatePct(attendance.data.show_rate)],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="flex flex-col-reverse rounded-lg border border-stone-100 bg-stone-50 p-2 text-center">
                    <dt className="text-[11px] uppercase text-stone-700">{eventFormT(locale, key)}</dt>
                    <dd className="text-lg font-bold text-stone-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mb-2 text-xs text-stone-700">
                {formatMessage(eventFormT(locale, 'attSummary'), {
                  people: attendance.data.people_confirmed,
                  anonymous: attendance.data.anonymous_confirmed,
                })}
                {attendance.data.ended ? '' : ` · ${eventFormT(locale, 'attInProgress')}`}
              </p>
              {attendance.data.attendees.length === 0 ? (
                <p className="text-sm text-stone-700">{eventFormT(locale, 'attNone')}</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {attendance.data.attendees.map((att) => (
                    <li key={att.user_id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900">{att.name}</p>
                        <p className="text-xs text-stone-700">
                          {formatMessage(eventFormT(locale, 'attHousehold'), { n: att.household_size })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${att.status === 'confirmed' ? 'bg-lime-100 text-lime-800' : 'bg-stone-100 text-stone-700'}`}
                        >
                          {eventFormT(locale, att.status === 'confirmed' ? 'attAttended' : 'attEarly')}
                        </span>
                        <span className="w-10 text-right text-xs text-stone-700">{formatRatePct(att.attendance_rate)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </EventDialog>
      )}
    </div>
  )
}
