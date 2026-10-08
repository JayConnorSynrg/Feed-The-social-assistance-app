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
//
// Deep link: #events?focus=event:<id> (an admin's "View in feed", lib/member-url.ts) reaches this
// panel as panelParams.focus. Once per link the list is read fresh, the event's card is scrolled
// into view, focused and ringed in lime (4 s or until it loses focus), one nav.deeplink.resolve row
// records found / not_found, and the focus is cleared. An event not in the list gets a polite
// status line and nothing else moves.

import { useState, useEffect, useCallback, useRef, type Ref } from 'react'
import { Calendar, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { logEvent, withMetric } from '@/lib/logger'
import type { FocusTarget } from '@/lib/deep-link'
import { usePanelContext } from '@/components/layout/feed-shell'
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
  /** A deep link named an event this list does not show (polite status line). */
  focusMiss?: boolean
  /** The event a deep link brought into view (its card is ringed). */
  highlightId?: string | null
  /** The list section (the deep-link focus looks for the card inside it). */
  listRef?: Ref<HTMLElement>
}

export type EventFocusDecision = { outcome: 'found'; eventId: string } | { outcome: 'not_found' }

/** Where a deep-link focus lands in a settled list: the event's card, or nowhere (not listed, or
 *  the list could not be read). */
export function decideEventFocus(target: FocusTarget, state: Exclude<EventsTabState, { status: 'loading' }>): EventFocusDecision {
  if (state.status === 'ready' && state.items.some((item) => item.eventId === target.id)) {
    return { outcome: 'found', eventId: target.id }
  }
  return { outcome: 'not_found' }
}

/** A focus waiting for the list: `staleState` is the list that was on screen when it arrived
 *  (null when a read was already running), which may predate the event. */
export interface PendingFocus {
  target: FocusTarget
  staleState: EventsTabState | null
}

/** Resolve the pending focus against this state? Only once a read that started after it arrived
 *  has settled — never against the loading state or the list it arrived on. */
export function focusSettles(pending: PendingFocus | null, state: EventsTabState): state is Exclude<EventsTabState, { status: 'loading' }> {
  return pending !== null && state.status !== 'loading' && state !== pending.staleState
}

/** A focus link arrives. A list already on screen may predate the event (the admin just created
 *  it), so it is read again (`reread`) and the focus waits for that read; while a read is running
 *  the focus waits for it. */
export function arriveFocus(target: FocusTarget, current: EventsTabState): { pending: PendingFocus; reread: boolean } {
  const settled = current.status !== 'loading'
  return { pending: { target, staleState: settled ? current : null }, reread: settled }
}

/** The focus was never resolved (the member left the Events tab before the list loaded): true once,
 *  so the unmount writes exactly one `abandoned` row. */
export function abandonFocus(pending: { current: PendingFocus | null }): boolean {
  if (!pending.current) return false
  pending.current = null
  return true
}

/** Reduced motion: FEED's own setting (<html data-motion="reduce">, lib/accessibility-prefs.ts) or
 *  the operating system's. */
export function prefersReducedMotion(dataMotion: string | undefined, osReduce: boolean): boolean {
  return dataMotion === 'reduce' || osReduce
}

/** The live highlight: its expiry timer and its blur listener. */
export interface HighlightHandle {
  timer: ReturnType<typeof setTimeout>
  detach: () => void
}

/** End the current highlight's timer and blur listener (a new focus arrived, or the panel left),
 *  so an earlier highlight can never clear a later one early. */
export function endHighlight(handle: HighlightHandle | null, clearTimer: (t: ReturnType<typeof setTimeout>) => void): null {
  if (handle) {
    clearTimer(handle.timer)
    handle.detach()
  }
  return null
}

/** Take the pending focus if this state settles it: returns its target and decision exactly once
 *  (the ref is emptied), null otherwise. */
export function takeSettledFocus(
  pending: { current: PendingFocus | null },
  state: EventsTabState,
): { target: FocusTarget; decision: EventFocusDecision } | null {
  const p = pending.current
  if (!focusSettles(p, state) || !p) return null
  pending.current = null
  return { target: p.target, decision: decideEventFocus(p.target, state) }
}

/** The Events tab's rendering for one load state (pure; EventsPanel owns the loading). */
export function EventsTabView({ state, locale, onRetry, onCheckedIn, titleRef, announce = true, now, viewerTz, focusMiss = false, highlightId = null, listRef }: EventsTabViewProps) {
  const showMiss = focusMiss && state.status === 'ready'
  // One status region, always mounted, so every load / reload outcome is announced.
  const announcement = !announce
    ? ''
    : state.status === 'loading'
      ? eventFormT(locale, 'loading')
      : state.status === 'error'
        ? eventFormT(locale, 'loadError')
        : showMiss
          ? eventMemberT(locale, 'focusNotListed')
          : state.items.length === 0
            ? eventFormT(locale, 'eventsTabEmpty')
            : ''
  return (
    <section ref={listRef} lang={locale} dir={dir(locale)} aria-labelledby="events-tab-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-1">
        <Calendar className="w-5 h-5 text-lime-700 flex-shrink-0" aria-hidden="true" />
        <h2 id="events-tab-title" ref={titleRef} tabIndex={-1} className="text-lg font-bold text-stone-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2">
          {eventMemberT(locale, 'eventsTabTitle')}
        </h2>
      </div>

      <p role="status" aria-live="polite" className="sr-only" data-testid="events-tab-status">
        {announcement}
      </p>

      {showMiss && (
        <p aria-hidden="true" data-testid="events-focus-miss" className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
          {eventMemberT(locale, 'focusNotListed')}
        </p>
      )}

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
                highlighted={item.eventId === highlightId}
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
  const { panelParams, setPanelParams } = usePanelContext()
  const focus = panelParams.focus

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

  // ---- Deep-link focus (#events?focus=event:<id>) ------------------------------------------------
  // Keyed on the focus object itself, not on mount: the feed panel and this subtab stay mounted
  // when a hashchange (a re-click in the reused preview tab) delivers a new focus.
  const listRef = useRef<HTMLElement>(null)
  const pendingFocus = useRef<PendingFocus | null>(null)
  // The latest state for the arrival effect (synced first, in effect order, every commit).
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const [focusMiss, setFocusMiss] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightRef = useRef<HighlightHandle | null>(null)

  // Arrival: remember the target once, end any earlier highlight, and read the list fresh when one
  // is already on screen.
  useEffect(() => {
    if (!focus || focus.kind !== 'event' || pendingFocus.current?.target === focus) return
    const { pending, reread } = arriveFocus(focus, stateRef.current)
    pendingFocus.current = pending
    highlightRef.current = endHighlight(highlightRef.current, clearTimeout)
    // A link arriving from the URL (an external system) replaces the last miss line and highlight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusMiss(false)
    setHighlightId(null)
    if (reread) {
      setState({ status: 'loading' })
      void load()
    }
  }, [focus, load])

  // Leaving the tab with a focus still waiting: one `abandoned` row, so every followed link writes
  // exactly one nav.deeplink.resolve row.
  useEffect(
    () => () => {
      if (abandonFocus(pendingFocus)) {
        logEvent('nav.deeplink.resolve', { kind: 'event', outcome: 'abandoned', panel: 'events' })
      }
      highlightRef.current = endHighlight(highlightRef.current, clearTimeout)
    },
    [],
  )

  // Resolution: once that read settles — one row, then clear the focus so it never runs again.
  useEffect(() => {
    const taken = takeSettledFocus(pendingFocus, state)
    if (!taken) return
    const { target, decision } = taken
    logEvent('nav.deeplink.resolve', { kind: 'event', outcome: decision.outcome, panel: 'events' })
    setPanelParams((prev) => (prev.focus === target ? { ...prev, focus: undefined } : prev))
    if (decision.outcome === 'not_found') {
      // The outcome of the read that just settled.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusMiss(true)
      return
    }
    const card = listRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(decision.eventId)}"]`)
    if (!card) return
    const reduceMotion = prefersReducedMotion(
      document.documentElement.dataset.motion,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
    card.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
    card.focus({ preventScroll: true })
    setHighlightId(decision.eventId)
    // Ringed for 4 s or until the card loses focus, whichever comes first.
    const clear = () => {
      highlightRef.current = endHighlight(highlightRef.current, clearTimeout)
      setHighlightId(null)
    }
    card.addEventListener('blur', clear, { once: true })
    highlightRef.current = { timer: setTimeout(clear, 4000), detach: () => card.removeEventListener('blur', clear) }
  }, [state, setPanelParams])

  return (
    <EventsTabView
      state={state}
      locale={locale}
      onRetry={reload}
      onCheckedIn={onCheckedIn}
      titleRef={titleRef}
      announce={announce}
      focusMiss={focusMiss}
      highlightId={highlightId}
      listRef={listRef}
    />
  )
}
