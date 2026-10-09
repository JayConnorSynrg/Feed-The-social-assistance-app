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
//
// Reads are bounded so a repeating event's ~180 generated dates never push near-term dates out:
//   1. events, each with only its NEXT upcoming date (aliased embed, limit 1), and — for the
//      "View in feed" link (components/admin/event-feed-link.tsx) — its organization's is_active and
//      its soonest date that event_feed_next would consider (a second aliased embed, limit 1);
//   2. the dates of the visible window — the week (desktop) and the selected day (phone), one day
//      wider on each side because the calendar files dates by the venue's day;
//   3. past and cancelled dates, newest first, 50 at a time ("Load more").
// Every read is filtered to the organization (or, in 'all', to the orgs the caller administers).
// Each repeating event shows its pattern, how it ends, an "ending soon" warning and "Repeat for 6
// more months"; a hand-added date outside the pattern is marked "Extra date"; a cancelled date of
// a series stays on the calendar as a "Cancelled" chip so the gap is explained.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { addDays, addWeeks, format, isSameDay, startOfDay, startOfWeek, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { eventFormT, eventTypeColor, eventTypeLabel, formatMessage } from '@/lib/i18n-event-forms'
import { browserTimeZone, dateTimeFormat, formatCalendarDate, formatEventWhen, venueDateKey } from '@/lib/event-time'
import { cancelEventOccurrence } from '@/lib/event-admin-rpc'
import {
  canExtendSeries,
  createSubmitController,
  isExtraDate,
  mintIdempotencyKey,
  seriesState,
  type FieldError,
} from '@/lib/event-form-model'
import { WEEK_START } from '@/lib/event-recurrence'
import { formatRecurrence, formatSeriesEnd } from '@/lib/event-recurrence-format'
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
import { ExtendSeriesButton } from './extend-series-button'
import { EventFeedLink, EventStatusNotice } from '@/components/admin/event-feed-link'
import { useAdminFocusSession } from './use-admin-focus'

interface EventOccurrence {
  id: string
  event_id: string
  starts_at: string
  ends_at: string
  status: string
  capacity: number | null
  notes: string | null
  /** 'rule' (generated from the repeat rule) or 'manual' (added by hand). */
  source: string
  cancel_reason: string | null
}

/** The event fields a date carries for display (calendar, past list, Extra date badge). */
interface DateEvent {
  id: string
  title: string
  event_type: string
  org_id: string
  time_zone: string
  recurrence: unknown
  series_start_local: string | null
  org?: { name: string } | null
}

export interface AssistanceEvent extends DateEvent {
  description: string | null
  location_name: string | null
  is_active: boolean
  series_duration: string | null
  announce_days_before: number
  /** Its next upcoming date (0 or 1 row). */
  next: EventOccurrence[]
  /** Its soonest not-ended date that is upcoming or cancelled for a reason other than retired /
   *  org_inactive — the date event_feed_next decides the event by (0 or 1 row). */
  feed_next: EventOccurrence[]
  org?: { name: string; is_active: boolean } | null
}

type DateRow = EventOccurrence & { event: DateEvent }

/** One date with its event's display fields. */
type ScheduledDate = EventOccurrence & {
  event_title: string
  event_type: string
  org_id: string
  org_name: string
  time_zone: string
  event: DateEvent
}

const OCCURRENCE_COLUMNS = 'id, event_id, starts_at, ends_at, status, capacity, notes, source, cancel_reason'
const EVENT_SELECT =
  'id, title, event_type, description, location_name, org_id, time_zone, is_active, created_at, recurrence, series_start_local, series_duration, announce_days_before, ' +
  `org:organizations(name, is_active), next:event_occurrences(${OCCURRENCE_COLUMNS}), feed_next:event_occurrences(${OCCURRENCE_COLUMNS})`
const DATE_SELECT =
  `${OCCURRENCE_COLUMNS}, event:assistance_events!inner(id, title, event_type, org_id, time_zone, recurrence, series_start_local, org:organizations(name))`
/** Newest events first. */
const EVENT_LIST_LIMIT = 200
/** Past and cancelled dates per page. */
export const PAST_PAGE = 50
/** Most dates the calendar window shows (a week of even a busy org is far below this). */
export const WINDOW_LIMIT = 500

/** Exactly one organization, or the organizations the caller administers ('all'). */
export type SchedulerScope = { kind: 'org'; orgId: string } | { kind: 'orgs'; orgIds: string[] }

type Client = SupabaseClient<Database>

/** event_feed_next's status clause: upcoming, or cancelled for a reason other than retired /
 *  org_inactive (`IS DISTINCT FROM`, so a NULL reason counts). */
export const FEED_NEXT_STATUS =
  'status.eq.upcoming,and(status.eq.cancelled,or(cancel_reason.is.null,cancel_reason.not.in.(retired,org_inactive)))'

/** Events, each with ONLY its next upcoming (not ended) date, and its soonest feed-eligible date. */
export function eventListQuery(supabase: Client, scope: SchedulerScope, nowIso: string) {
  const base = supabase.from('assistance_events').select(EVENT_SELECT)
  const scoped = scope.kind === 'org' ? base.eq('org_id', scope.orgId) : base.in('org_id', scope.orgIds)
  return scoped
    .eq('next.status', 'upcoming')
    .gte('next.ends_at', nowIso)
    .or(FEED_NEXT_STATUS, { referencedTable: 'feed_next' })
    .gte('feed_next.ends_at', nowIso)
    .order('created_at', { ascending: false })
    .order('starts_at', { referencedTable: 'next', ascending: true })
    .order('starts_at', { referencedTable: 'feed_next', ascending: true })
    .limit(EVENT_LIST_LIMIT)
    .limit(1, { referencedTable: 'next' })
    .limit(1, { referencedTable: 'feed_next' })
}

/** One event by id, with the same embeds as a list row ("Edit in admin" may name an event that is
 *  not among the newest EVENT_LIST_LIMIT). Not scoped: decideEventFocus checks the scope. */
export function focusedEventQuery(supabase: Client, eventId: string, nowIso: string) {
  return supabase
    .from('assistance_events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .eq('next.status', 'upcoming')
    .gte('next.ends_at', nowIso)
    .or(FEED_NEXT_STATUS, { referencedTable: 'feed_next' })
    .gte('feed_next.ends_at', nowIso)
    .order('starts_at', { referencedTable: 'next', ascending: true })
    .order('starts_at', { referencedTable: 'feed_next', ascending: true })
    .limit(1, { referencedTable: 'next' })
    .limit(1, { referencedTable: 'feed_next' })
    .maybeSingle()
}

export type EventFocusDecision =
  | { outcome: 'found' }
  | { outcome: 'not_found'; reason: 'missing' | 'org_inactive' | 'other_org' }

/**
 * May this scheduler open the linked event's edit dialog? Only for an event it manages: on an
 * organization's page, an event of that organization; in the main shell, an event of one of the
 * organizations listed for the caller (get_admin_org_list: active, non-business). `event` is null
 * when the read returned nothing (no such event, or RLS hides it from this caller).
 */
export function decideEventFocus(
  event: { org_id: string; org?: { is_active: boolean } | null } | null,
  scope: SchedulerScope
): EventFocusDecision {
  if (!event) return { outcome: 'not_found', reason: 'missing' }
  const orgId = event.org_id.toLowerCase()
  const inScope =
    scope.kind === 'org' ? scope.orgId.toLowerCase() === orgId : scope.orgIds.some((id) => id.toLowerCase() === orgId)
  if (inScope) return { outcome: 'found' }
  return { outcome: 'not_found', reason: event.org?.is_active === false ? 'org_inactive' : 'other_org' }
}

/** The plain line a not-found link leaves in the scheduler's status area. */
export function eventFocusNotice(reason: 'missing' | 'org_inactive' | 'other_org' | 'error', locale: Locale): string {
  return eventFormT(locale, reason === 'org_inactive' ? 'focusEventOrgInactive' : 'focusEventNotFound')
}

/** Every date (any status) starting in [fromIso, toIso), oldest first. */
export function windowDatesQuery(supabase: Client, scope: SchedulerScope, fromIso: string, toIso: string) {
  const base = supabase.from('event_occurrences').select(DATE_SELECT)
  const scoped = scope.kind === 'org' ? base.eq('event.org_id', scope.orgId) : base.in('event.org_id', scope.orgIds)
  // One row past the limit tells the calendar that it is showing only the first WINDOW_LIMIT.
  return scoped.gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at', { ascending: true }).limit(WINDOW_LIMIT + 1)
}

export type WindowResult = { state: 'ready'; dates: DateRow[]; overLimit: boolean } | { state: 'error' }

/** The calendar window's answer: at most WINDOW_LIMIT dates, and whether more exist. */
export function windowResult(res: { data: unknown; error: unknown }): WindowResult {
  if (res.error) return { state: 'error' }
  const rows = (res.data as DateRow[] | null) ?? []
  return { state: 'ready', dates: rows.slice(0, WINDOW_LIMIT), overLimit: rows.length > WINDOW_LIMIT }
}

export interface PastPage {
  rows: DateRow[]
  hasMore: boolean
  /** Announced in the status line ("Loaded 50 more."). */
  notice: string | null
  /** Shown next to "Load more dates" (the button stays, so it can be tried again). */
  error: boolean
  /** The last page removes "Load more dates": focus continues at the list's heading. */
  focusHeading: boolean
}

/** What one "Load more dates" answer does to the list. */
export function pastPage(res: { data: unknown; error: unknown }, locale: Locale): PastPage {
  if (res.error) return { rows: [], hasMore: true, notice: null, error: true, focusHeading: false }
  const rows = (res.data as DateRow[] | null) ?? []
  const hasMore = rows.length === PAST_PAGE
  return {
    rows,
    hasMore,
    notice: formatMessage(eventFormT(locale, 'moreDatesLoaded'), { count: rows.length }),
    error: false,
    focusHeading: !hasMore,
  }
}

/**
 * After "Try again" on the calendar's error, once the read settles: success -> the visible
 * calendar label takes focus (the alert and its button are gone); failure -> focus stays on Try
 * again, which never unmounted, and the alert text comes back (re-announced). Once per retry.
 */
export function focusAfterWindowRetry(
  pending: { current: boolean },
  state: 'loading' | 'ready' | 'error',
  label: { focus: () => void } | null,
): 'label' | 'stay' | null {
  if (!pending.current || state === 'loading') return null
  pending.current = false
  if (state === 'error') return 'stay'
  label?.focus()
  return 'label'
}

/** The calendar label that takes focus after a window retry: the one on screen (the week label
 *  on wide screens, the day label on phones — the other calendar is display:none). */
export function visibleCalendarLabel<T extends { offsetParent: unknown }>(labels: ReadonlyArray<T | null>): T | null {
  return labels.find((l) => l !== null && l.offsetParent !== null) ?? null
}

/** The calendar's own line: a failed window read (with Try again) or "showing the first N" —
 *  inside the calendar, which stays on screen (focus stays on the arrow that was pressed). */
export function CalendarWindowStatus({
  result,
  locale,
  onRetry,
}: {
  /** retrying: a retry of a failed read is in flight (the alert keeps its button, drops its text). */
  result: { state: 'loading' | 'ready' | 'error'; overLimit: boolean; retrying?: boolean }
  locale: Locale
  onRetry: () => void
}) {
  if (result.state === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-2">
        <p className="text-sm text-red-700">{result.retrying ? '' : eventFormT(locale, 'windowLoadError')}</p>
        <button type="button" className={`${SECONDARY} min-h-9 px-3 text-xs`} onClick={onRetry}>
          {eventFormT(locale, 'retry')}
        </button>
      </div>
    )
  }
  if (result.state === 'ready' && result.overLimit) {
    return (
      <p className="border-b border-stone-100 px-4 py-2 text-sm text-stone-800">
        {formatMessage(eventFormT(locale, 'windowTooMany'), { count: WINDOW_LIMIT })}
      </p>
    )
  }
  return null
}

/** Past (ended or completed) and cancelled dates, newest first, one page. */
export function pastDatesQuery(supabase: Client, scope: SchedulerScope, nowIso: string, offset: number) {
  const base = supabase.from('event_occurrences').select(DATE_SELECT)
  const scoped = scope.kind === 'org' ? base.eq('event.org_id', scope.orgId) : base.in('event.org_id', scope.orgIds)
  return scoped
    .or(`status.eq.cancelled,status.eq.completed,ends_at.lt."${nowIso}"`)
    .order('starts_at', { ascending: false })
    .range(offset, offset + PAST_PAGE - 1)
}

/**
 * The instants the calendar needs: the shown week and the selected day (both views are in the
 * page), one day wider on each side because dates are filed under the VENUE's day.
 */
export function calendarWindow(weekStart: Date, selectedDay: Date): { fromIso: string; toIso: string } {
  const day = startOfDay(selectedDay)
  const from = Math.min(weekStart.getTime(), day.getTime())
  const to = Math.max(addDays(weekStart, 7).getTime(), addDays(day, 1).getTime())
  return { fromIso: addDays(new Date(from), -1).toISOString(), toIso: addDays(new Date(to), 1).toISOString() }
}

/** The edit dialog's target for an event row (the Edit button and an "Edit in admin" link). */
export function toEditTarget(event: AssistanceEvent): EditTarget {
  const next = event.next?.[0] ?? null
  return {
    id: event.id,
    org_id: event.org_id,
    title: event.title,
    event_type: event.event_type,
    description: event.description,
    location_name: event.location_name,
    time_zone: event.time_zone,
    is_active: event.is_active,
    recurrence: event.recurrence,
    series_start_local: event.series_start_local,
    series_duration: event.series_duration,
    announce_days_before: event.announce_days_before,
    next: next ? { starts_at: next.starts_at, ends_at: next.ends_at } : null,
  }
}

function toScheduled(row: DateRow): ScheduledDate {
  return {
    ...row,
    event_title: row.event.title,
    event_type: row.event.event_type,
    org_id: row.event.org_id,
    org_name: row.event.org?.name ?? '',
    time_zone: row.event.time_zone,
  }
}

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
  /** The admin surface (the `source` of admin.nav.member_view on "View in feed"). */
  source?: 'event_scheduler' | 'org_admin_events'
}

function dayLabel(day: Date, locale: Locale, opts: Intl.DateTimeFormatOptions): string {
  return dateTimeFormat(locale, browserTimeZone(), opts).format(day)
}

export function EventScheduler({ selectedOrgId, source = 'event_scheduler' }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const locale = useProfileLocale()
  const scoped = selectedOrgId !== 'all'
  // On a single org's screen the cross-org list is never read.
  const { orgs: adminOrgs, loading: orgsLoading } = useAdminOrgs({ enabled: !scoped })

  const [events, setEvents] = useState<AssistanceEvent[]>([])
  const [windowDates, setWindowDates] = useState<ScheduledDate[]>([])
  const [pastDates, setPastDates] = useState<ScheduledDate[]>([])
  const [pastHasMore, setPastHasMore] = useState(false)
  const [pastLoadingMore, setPastLoadingMore] = useState(false)
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [windowState, setWindowState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [windowOverLimit, setWindowOverLimit] = useState(false)
  const [windowReload, setWindowReload] = useState(0)
  const [pastError, setPastError] = useState(false)
  // A failed calendar window is shown inside the calendar (CalendarWindowStatus); only the events
  // read replaces the whole tab with an error.
  const loadState = listState === 'error' ? 'error' : listState === 'loading' || windowState === 'loading' ? 'loading' : 'ready'
  const [reload, setReload] = useState(0)
  // "Now" for ended / cancellable decisions, taken when the list was (re)loaded.
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [notice, setNoticeText] = useState<string | null>(null)
  // The event a "created" notice is about: the notice then also offers "View in feed" (or when it
  // will appear). Any other notice replaces it.
  const [noticeEventId, setNoticeEventId] = useState<string | null>(null)
  const setNotice = (text: string | null) => {
    setNoticeText(text)
    setNoticeEventId(null)
  }

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: WEEK_START }))
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const { fromIso, toIso } = calendarWindow(currentWeekStart, selectedDay)

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
  const pastHeadingRef = useRef<HTMLHeadingElement>(null)
  // After "Try again" on the calendar's own error, focus its label once the reload settles (the
  // button is gone on success) — the same rule as the org Overview's retry.
  const weekLabelRef = useRef<HTMLSpanElement>(null)
  const dayLabelRef = useRef<HTMLDivElement>(null)
  const windowRetryPending = useRef(false)
  const [windowSettled, setWindowSettled] = useState(0)
  // While a retry is in flight the alert's text is empty, so the same message is announced again
  // if the retry fails too.
  const [windowRetrying, setWindowRetrying] = useState(false)
  useEffect(() => {
    if (windowSettled === 0) return
    focusAfterWindowRetry(windowRetryPending, windowState, visibleCalendarLabel([weekLabelRef.current, dayLabelRef.current]))
  }, [windowSettled, windowState])
  const retryWindow = () => {
    windowRetryPending.current = true
    setWindowRetrying(true)
    setWindowReload((n) => n + 1)
  }
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

  // Scope: exactly this org, or the orgs the caller administers ('all').
  const scope: SchedulerScope | null = useMemo(
    () =>
      scoped
        ? { kind: 'org', orgId: selectedOrgId }
        : orgsLoading
          ? null
          : { kind: 'orgs', orgIds: adminOrgs.map((o) => o.id) },
    [scoped, selectedOrgId, orgsLoading, adminOrgs],
  )

  // "Edit in admin" (?focus=event:<id>): once the scope is known, read that event by id (it may be
  // beyond the newest EVENT_LIST_LIMIT) and open its edit dialog when this scheduler manages it;
  // otherwise leave a plain line and keep the calendar usable. One admin.deeplink.resolve row.
  const focusSession = useAdminFocusSession('event', 'events')
  useEffect(() => {
    if (!focusSession || !scope || !focusSession.isOpen()) return
    let active = true
    void focusedEventQuery(supabase, focusSession.focus.id, new Date().toISOString()).then(({ data, error }) => {
      if (!active || !focusSession.isOpen()) return
      if (error) {
        logger.warn('admin.deeplink.load_failed', { kind: 'event', code: error.code ?? 'unknown' })
        focusSession.resolve('not_found')
        setNotice(eventFocusNotice('error', locale))
        return
      }
      const event = (data as unknown as AssistanceEvent | null) ?? null
      const decision = decideEventFocus(event, scope)
      focusSession.resolve(decision.outcome)
      if (decision.outcome === 'found' && event) {
        // No control opened it: closing returns focus to "New event".
        openerRef.current = null
        focusFallbackRef.current = false
        setEditTarget({ key: ++dialogSeq.current, ...toEditTarget(event) })
      } else if (decision.outcome === 'not_found') {
        setNotice(eventFocusNotice(decision.reason, locale))
      }
    })
    return () => {
      active = false
    }
  }, [focusSession, scope, supabase, locale])

  // 1 + 3: the events (each with its next date) and the first page of past / cancelled dates.
  useEffect(() => {
    if (!scope) return
    let cancelled = false
    const nowIso = new Date().toISOString()
    void Promise.all([eventListQuery(supabase, scope, nowIso), pastDatesQuery(supabase, scope, nowIso, 0)]).then(
      ([list, past]) => {
        if (cancelled) return
        const error = list.error ?? past.error
        if (error) {
          logger.warn('admin.event.scheduler.load_failed', { code: error.code ?? null, scoped })
          setListState('error')
          return
        }
        const pastRows = (past.data as unknown as DateRow[]) ?? []
        setEvents((list.data as unknown as AssistanceEvent[]) ?? [])
        setPastDates(pastRows.map(toScheduled))
        setPastHasMore(pastRows.length === PAST_PAGE)
        setLoadedAt(Date.parse(nowIso))
        setListState('ready')
      },
    )
    return () => {
      cancelled = true
    }
  }, [supabase, scope, scoped, reload])

  // 2: the dates of the visible week / day. Navigating keeps the current dates on screen until
  // the new window arrives (focus stays on the arrow the admin pressed).
  useEffect(() => {
    if (!scope) return
    let cancelled = false
    void windowDatesQuery(supabase, scope, fromIso, toIso).then((res) => {
      if (cancelled) return
      const r = windowResult(res)
      if (r.state === 'error') {
        logger.warn('admin.event.scheduler.load_failed', { code: res.error?.code ?? null, scoped })
        setWindowState('error')
        setWindowRetrying(false)
        setWindowSettled((n) => n + 1)
        return
      }
      setWindowDates(r.dates.map(toScheduled))
      setWindowOverLimit(r.overLimit)
      setWindowState('ready')
      setWindowRetrying(false)
      setWindowSettled((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, scope, scoped, fromIso, toIso, reload, windowReload])

  const refresh = () => setReload((n) => n + 1)
  const retry = () => {
    setListState('loading')
    setWindowState('loading')
    refresh()
  }

  async function loadMorePast() {
    if (!scope || pastLoadingMore) return
    setPastLoadingMore(true)
    setPastError(false)
    // Cleared first so the same sentence ("Loaded 50 more.") is announced again next time.
    setNotice(null)
    const res = await pastDatesQuery(supabase, scope, new Date(loadedAt).toISOString(), pastDates.length)
    setPastLoadingMore(false)
    if (res.error) logger.warn('admin.event.scheduler.load_failed', { code: res.error.code ?? null, scoped })
    const page = pastPage(res, locale)
    setPastError(page.error)
    if (page.error) return
    setPastDates((prev) => [...prev, ...page.rows.map(toScheduled)])
    setPastHasMore(page.hasMore)
    setNotice(page.notice)
    if (page.focusHeading) requestAnimationFrame(() => pastHeadingRef.current?.focus())
  }

  const isEnded = (occ: { status: string; ends_at: string }) => occ.status === 'completed' || new Date(occ.ends_at).getTime() < loadedAt
  // Cancel is offered only on a date that has not ended and is not cancelled (the DB refuses
  // cancelling an ended date — its attendance history is permanent).
  const canCancel = (occ: { status: string; ends_at: string }) => occ.status !== 'cancelled' && !isEnded(occ)

  // The calendar hides a cancelled one-off date ("Past and cancelled" keeps it reachable for
  // Attendance); a cancelled date of a series stays as a "Cancelled" chip so the gap in the
  // pattern is explained.
  const calendarDates = windowDates.filter((o) => o.status !== 'cancelled' || o.event.recurrence != null)
  // The created event, once the refreshed list has it.
  const noticeEvent = noticeEventId ? events.find((e) => e.id === noticeEventId) ?? null : null
  const pastAndCancelled = pastDates

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

  /** "Cancelled" on a cancelled series date; "Extra date" on a hand-added date outside the
   *  pattern. Part of the entry's time line, so every action that names the date names them. */
  function dateBadges(occ: ScheduledDate) {
    const badges: string[] = []
    if (occ.status === 'cancelled') badges.push(eventFormT(locale, 'statusCancelled'))
    else if (isExtraDate(occ, occ.event)) badges.push(eventFormT(locale, 'extraDateBadge'))
    return badges.map((b) => (
      <span key={b} className="me-1 mt-0.5 inline-block rounded-full border border-stone-500 bg-white px-1.5 text-[11px] font-semibold text-stone-800">
        {b}
      </span>
    ))
  }

  function dateActions(occ: ScheduledDate, stacked: boolean, describedBy: string) {
    const cls = stacked ? `${SMALL_BTN} mt-1` : `${SECONDARY} min-h-9 px-3 text-xs`
    const cancelled = occ.status === 'cancelled'
    return (
      <>
        {!cancelled && (
          <button type="button" aria-describedby={describedBy} onClick={(e) => openKiosk(occ, e)} className={`${cls} bg-white/70 hover:bg-white`}>
            {eventFormT(locale, 'signIn')}
          </button>
        )}
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
        <button type="button" className={SECONDARY} onClick={retry}>
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

      <div className="flex flex-wrap items-baseline gap-x-2">
        <EventStatusNotice text={notice} event={noticeEvent} now={loadedAt} locale={locale} source={source} className="text-sm text-lime-800" />
      </div>

      {/* Week view (md+) */}
      <div className="hidden overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm md:block">
        <CalendarWindowStatus result={{ state: windowState, overLimit: windowOverLimit, retrying: windowRetrying }} locale={locale} onRetry={retryWindow} />
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
          <button
            type="button"
            onClick={() => setCurrentWeekStart((d) => subWeeks(d, 1))}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{eventFormT(locale, 'prevWeek')}</span>
          </button>
          <span ref={weekLabelRef} tabIndex={-1} className={`rounded-sm text-sm font-medium text-stone-800 ${FOCUS_RING}`}>
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
                    <div
                      key={occ.id}
                      className={`mb-1 rounded-lg border p-1.5 text-xs ${occ.status === 'cancelled' ? 'border-dashed border-stone-500 bg-stone-50 text-stone-800' : `border-stone-200 ${eventTypeColor(occ.event_type)}`}`}
                    >
                      <p id={ids.title} className={`truncate font-medium leading-tight ${occ.status === 'cancelled' ? 'line-through' : ''}`}>{occ.event_title}</p>
                      <span id={ids.day} className="sr-only">
                        {dayLabel(day, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      <p id={ids.time}>
                        {when.text}
                        {when.venue && <span className="block text-[11px]">{when.venue}</span>}
                        {dateBadges(occ)}
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
        <CalendarWindowStatus result={{ state: windowState, overLimit: windowOverLimit, retrying: windowRetrying }} locale={locale} onRetry={retryWindow} />
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setSelectedDay((d) => addDays(d, -1))}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{eventFormT(locale, 'prevDay')}</span>
          </button>
          <div ref={dayLabelRef} tabIndex={-1} className={`rounded-sm text-center ${FOCUS_RING}`}>
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
                <div
                  key={occ.id}
                  className={`rounded-xl border p-3 ${occ.status === 'cancelled' ? 'border-dashed border-stone-500 bg-stone-50 text-stone-800' : `border-stone-200 ${eventTypeColor(occ.event_type)}`}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p id={ids.title} className={`font-semibold ${occ.status === 'cancelled' ? 'line-through' : ''}`}>{occ.event_title}</p>
                      <span id={ids.day} className="sr-only">
                        {dayLabel(selectedDay, locale, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      <p id={ids.time} className="text-xs">
                        {when.text}
                        {when.venue && <span className="block">{when.venue}</span>}
                        {dateBadges(occ)}
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
              const next = event.next?.[0]
              const when = next ? formatEventWhen(next.starts_at, next.ends_at, event.time_zone, locale) : null
              const series = seriesState(event.recurrence, event.series_start_local, venueDateKey(new Date(loadedAt).toISOString(), event.time_zone))
              const titleId = `ev-l-${event.id}-title`
              const seriesId = `ev-l-${event.id}-series`
              return (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p id={titleId} className="text-sm font-medium text-stone-900">
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
                    {series.kind !== 'none' && (
                      <p id={seriesId} className="text-xs text-stone-700">
                        {formatRecurrence(series.rule, locale)} · {formatSeriesEnd(series.rule, locale)}
                        {series.kind === 'ends' && (series.ended || series.endingSoon) && (
                          <span className="font-semibold text-red-800">
                            {' · '}
                            {series.ended || !series.lastDate
                              ? eventFormT(locale, 'seriesEnded')
                              : formatMessage(eventFormT(locale, 'seriesEndingSoon'), { date: formatCalendarDate(series.lastDate, locale) })}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <EventFeedLink event={event} now={loadedAt} locale={locale} source={source} />
                    {canExtendSeries(event) && (
                      <ExtendSeriesButton
                        eventId={event.id}
                        orgId={event.org_id}
                        title={event.title}
                        locale={locale}
                        describedBy={seriesId}
                        onStart={() => setNotice(null)}
                        onExtended={(r) => {
                          setNotice(formatMessage(eventFormT(locale, 'seriesExtended'), { date: formatCalendarDate(r.until.slice(0, 10), locale) }))
                          refresh()
                        }}
                      />
                    )}
                    <button
                      type="button"
                      className={LINK_BTN}
                      aria-label={formatMessage(eventFormT(locale, 'editAria'), { title: event.title })}
                      onClick={(e) => {
                        rememberOpener(e)
                        setEditTarget({ key: ++dialogSeq.current, ...toEditTarget(event) })
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
          <h3 ref={pastHeadingRef} tabIndex={-1} className={`mb-3 rounded-sm text-sm font-semibold text-stone-800 ${FOCUS_RING}`}>
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
          {pastHasMore && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={SECONDARY}
                aria-disabled={pastLoadingMore || undefined}
                aria-describedby={pastError ? 'ev-past-more-err' : undefined}
                onClick={() => void loadMorePast()}
              >
                {pastLoadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {eventFormT(locale, 'loadMoreDates')}
              </button>
              {pastError && (
                <p id="ev-past-more-err" role="alert" className="text-sm text-red-700">
                  {eventFormT(locale, 'loadMoreError')}
                </p>
              )}
            </div>
          )}
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
          onCreated={(id, title) => {
            setNotice(formatMessage(eventFormT(locale, 'createdNotice'), { title }))
            setNoticeEventId(id)
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
