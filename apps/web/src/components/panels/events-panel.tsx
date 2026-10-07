'use client'

// events-panel.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The members' Events tab. It lists exactly the events the community feed shows — the
// upcoming_events RPC applies the same server rule as ranked_feed_v2 (each date appears from
// the organizer's "post N days before" day, venue time, until it ends) — one card per event
// (its next shown date), grouped Today / This week / Later by the venue's calendar day. Each
// card is the shared EventCard, so repeating events read "Every week on Saturday · Next: …" and a
// cancelled date that comes first reads "Sat, Oct 10 cancelled — next: Sat, Oct 24".

import { useState, useEffect, useCallback, useRef, type Ref } from 'react'
import { Calendar, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { withMetric } from '@/lib/logger'
import { dir, type Locale } from '@/lib/i18n'
import { eventFormT } from '@/lib/i18n-event-forms'
import { eventMemberT } from '@/lib/i18n-event-member'
import { applyCheckinResult, checkinResultEffect, type CheckinState } from '@/lib/event-checkin-state'
import { loadEventCards } from '@/lib/event-card-data'
import { EventCard } from '@/components/feed/event-card'
import {
  groupEventsByVenueDay,
  upcomingEventRefs,
  type EventCardItem,
  type EventDayGroup,
  type UpcomingEventRow,
} from '@/components/feed/post-model'

const UPCOMING_LIMIT = 50
const QUERY_TIMEOUT_MS = 12_000

export type EventsTabState =
  | { status: 'loading' }
  | { status: 'error' }
  /** loadedAt: the clock the day groups are computed with (the time the list was loaded). */
  | { status: 'ready'; items: EventCardItem[]; checkin: CheckinState; loadedAt: number }

const GROUPS: ReadonlyArray<{ key: EventDayGroup; label: 'groupToday' | 'groupThisWeek' | 'groupLater' }> = [
  { key: 'today', label: 'groupToday' },
  { key: 'week', label: 'groupThisWeek' },
  { key: 'later', label: 'groupLater' },
]

export interface EventsTabViewProps {
  state: EventsTabState
  locale: Locale
  onRetry: () => void
  /** A check-in finished on a card: the date's id and the check_in answer (null = unknown). */
  onCheckedIn: (occurrenceId: string, result: string | null) => void
  /** The tab heading (focused after a reload settles). */
  titleRef?: Ref<HTMLHeadingElement>
  /** False on the first paint: the status region mounts empty, so the first message that
   *  enters it ("Loading events…") is announced. */
  announce?: boolean
  /** The clock the cards read (tests); defaults to their mount time. */
  now?: number
  /** The viewer's zone (tests); defaults to the browser's. */
  viewerTz?: string
}

/** The Events tab's rendering for one load state (pure; EventsPanel owns the loading). */
export function EventsTabView({ state, locale, onRetry, onCheckedIn, titleRef, announce = true, now, viewerTz }: EventsTabViewProps) {
  // One status region, always mounted, so every load / reload outcome is announced.
  const announcement = !announce
    ? ''
    : state.status === 'loading'
      ? eventFormT(locale, 'loading')
      : state.status === 'error'
        ? eventFormT(locale, 'loadError')
        : state.items.length === 0
          ? eventFormT(locale, 'eventsTabEmpty')
          : ''
  return (
    <section lang={locale} dir={dir(locale)} aria-labelledby="events-tab-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-1">
        <Calendar className="w-5 h-5 text-lime-700 flex-shrink-0" aria-hidden="true" />
        <h2 id="events-tab-title" ref={titleRef} tabIndex={-1} className="text-lg font-bold text-stone-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2">
          {eventMemberT(locale, 'eventsTabTitle')}
        </h2>
      </div>

      <p role="status" aria-live="polite" className="sr-only" data-testid="events-tab-status">
        {announcement}
      </p>

      {state.status === 'loading' && (
        <div aria-hidden="true" className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="w-7 h-7 text-lime-700 animate-spin" aria-hidden="true" />
          <p className="text-sm text-stone-600">{eventFormT(locale, 'loading')}</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
          <AlertCircle className="w-7 h-7 text-red-700" aria-hidden="true" />
          <p aria-hidden="true" className="text-sm text-stone-700">{eventFormT(locale, 'loadError')}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-6 min-w-6 px-3 py-1.5 rounded-lg text-sm font-semibold text-lime-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
          >
            {eventFormT(locale, 'retry')}
          </button>
        </div>
      )}

      {state.status === 'ready' && state.items.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
          <Calendar className="w-8 h-8 text-stone-400" aria-hidden="true" />
          <p aria-hidden="true" className="text-sm text-stone-600 font-medium">{eventFormT(locale, 'eventsTabEmpty')}</p>
        </div>
      )}

      {state.status === 'ready' && state.items.length > 0 && (() => {
        const grouped = groupEventsByVenueDay(state.items, now ?? state.loadedAt)
        return GROUPS.filter((g) => grouped[g.key].length > 0).map((g) => (
          <section key={g.key} aria-labelledby={`events-group-${g.key}`} className="flex flex-col gap-3">
            <h3 id={`events-group-${g.key}`} className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
              {eventFormT(locale, g.label)}
            </h3>
            {grouped[g.key].map((item) => (
              <EventCard
                key={item.eventId}
                event={item}
                locale={locale}
                surface="events-tab"
                headingLevel={4}
                myStatus={state.checkin.statuses[item.occurrenceId] ?? 'none'}
                anonymousClaimed={state.checkin.anonClaims.has(item.occurrenceId)}
                onCheckedIn={onCheckedIn}
                now={now}
                viewerTz={viewerTz}
              />
            ))}
          </section>
        ))
      })()}
    </section>
  )
}

export function EventsPanel() {
  const supabase = createClient()
  const { loading: authLoading, user, isAnonymous } = useAuth()
  const locale = useProfileLocale()
  const [state, setState] = useState<EventsTabState>({ status: 'loading' })
  const userId = user?.id ?? null

  // The initial state is 'loading'; Retry and a check-in set it again before calling load().
  const load = useCallback(async () => {
    try {
      const loadedAt = Date.now()
      // One wide event per load (events.tab.load.complete / .error) covering the RPC and the
      // card loader (shared with the feed); the member sees the translated message, never the
      // database text.
      const { items, checkin } = await withMetric('events.tab.load', { limit: UPCOMING_LIMIT }, async () => {
        const { data, error } = await supabase
          .rpc('upcoming_events', { p_limit: UPCOMING_LIMIT })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (error) throw error
        return loadEventCards(supabase, upcomingEventRefs((data ?? []) as UpcomingEventRow[]), {
          surface: 'events_tab',
          userId,
          isGuest: isAnonymous,
          timeoutMs: QUERY_TIMEOUT_MS,
        })
      })
      setState({ status: 'ready', items, checkin, loadedAt })
    } catch {
      setState({ status: 'error' })
    }
  }, [supabase, userId, isAnonymous])

  useEffect(() => {
    // load() sets state only after its awaited reads (the initial state is already 'loading').
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!authLoading) void load()
  }, [authLoading, load])

  // A reload replaces the control the member used (Retry, or a card), so once it settles focus
  // goes to the tab heading.
  const titleRef = useRef<HTMLHeadingElement>(null)
  // The always-mounted status region (it carries "Loading events…") starts empty and gets its
  // first text a frame later, so that first message is announced.
  const [announce, setAnnounce] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnnounce(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const focusTitleAfterLoad = useRef(false)
  useEffect(() => {
    if (state.status !== 'loading' && focusTitleAfterLoad.current) {
      focusTitleAfterLoad.current = false
      titleRef.current?.focus()
    }
  }, [state.status])

  const reload = useCallback(() => {
    focusTitleAfterLoad.current = true
    setState({ status: 'loading' })
    void load()
  }, [load])

  // Apply the server's check_in answer to that card in place (the list, the member's place and
  // focus stay); re-read only when the answer is unknown.
  const onCheckedIn = useCallback((occurrenceId: string, result: string | null) => {
    if (checkinResultEffect(result) === null) {
      reload()
      return
    }
    setState((prev) => {
      if (prev.status !== 'ready') return prev
      const checkin = applyCheckinResult(prev.checkin, occurrenceId, result)
      return checkin ? { ...prev, checkin } : prev
    })
  }, [reload])

  return (
    <EventsTabView
      state={state}
      locale={locale}
      onRetry={reload}
      onCheckedIn={onCheckedIn}
      titleRef={titleRef}
      announce={announce}
    />
  )
}
