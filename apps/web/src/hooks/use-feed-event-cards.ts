'use client'

// apps/web/src/hooks/use-feed-event-cards.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The community feed's event cards: the cards in rank order (eventItems) with the member's check-in
// state, and what happens when an admin changes one of those events:
//   - from the card's own ⋯ menu (handleEventManaged): ONLY that card is re-read
//     (useEventCardRefresh → reloadEventCard → upcoming_events) and replaced in place with the rank
//     score and distance bucket it was placed by (keepFeedRank), so it never moves; announced once,
//     focus kept (hooks/use-event-card-refresh.ts). The feed is never reloaded — this hook is not
//     given the feed's reload at all;
//   - from the Events tab (syncFeedEventCard): the feed's copy of that event is re-read quietly, and
//     nothing is read when the feed does not list the event.
// FeedPanel fills eventItems from its ranked page loads (setEventItems & co.).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import type { Locale } from '@/lib/i18n'
import type { MyCheckinStatus } from '@/lib/event-checkin'
import type { CheckinState } from '@/lib/event-checkin-state'
import { keepFeedRank, replaceEventCard, type EventCardItem, type EventFeedItem } from '@/components/feed/post-model'
import type { EventCardChange } from '@/components/events/event-card-admin-menu'
import { useEventCardRefresh } from './use-event-card-refresh'

/**
 * The post cards' announcements through the SAME card-notice region the event cards use (one region,
 * never a second one), with the same rules:
 *   - empty first, then the sentence set once (so the same sentence twice is announced twice);
 *   - when focus moves (a card left, a dialog closed), in ONE frame: `moveFocus` first, then the
 *     notice — a screen reader cancels a polite message queued before a focus move;
 *   - a newer announcement (or a newer event-card change) supersedes the WORDS of an older one
 *     still waiting for its frame; quiet paths simply do not call it;
 *   - `join`: a newer announcement keeps the words still waiting in front of its own, so two
 *     outcomes close together are both said. The sign-up outcomes and a card that leaves after a
 *     member's action use it; supersede() still drops the words;
 *   - a focus step is never dropped. Some carry state (the sign-up step writes the card's alert
 *     lines after focus moves; a leaving card's step removes the card), so replacing or
 *     superseding an announcement may only drop words. Steps wait in a queue; the first frame to
 *     run — its words still current or not, or the frame supersede() schedules — runs every
 *     queued step once, in the order they were queued, before any sentence is set. Focus ends
 *     where the latest step puts it.
 * Pure (the region setter and the frame scheduler are passed in) so the rules are unit-tested.
 */
export function createCardNoticeAnnouncer(
  setNotice: (text: string) => void,
  schedule: (fn: () => void) => void,
): { announce: (text: string, moveFocus?: () => void, options?: { join?: boolean }) => void; supersede: () => void } {
  let seq = 0
  // The words still waiting for their frame, if any.
  let waiting: { text: string } | null = null
  // Focus steps not run yet, in the order they were handed over: each runs exactly once.
  let steps: Array<() => void> = []
  const runSteps = () => {
    const due = steps
    steps = []
    for (const step of due) step()
  }
  return {
    announce(text, moveFocus, options) {
      const mine = ++seq
      const earlier = options?.join ? waiting : null
      const full = earlier ? `${earlier.text} ${text}` : text
      waiting = { text: full }
      if (moveFocus) steps.push(moveFocus)
      setNotice('')
      schedule(() => {
        runSteps()
        if (seq !== mine) return
        waiting = null
        setNotice(full)
      })
    },
    supersede() {
      seq++
      waiting = null
      // The words are dropped; the steps still run, in a frame of their own.
      if (steps.length > 0) schedule(runSteps)
    },
  }
}

export interface FeedEventCardsOptions {
  supabase: SupabaseClient<Database>
  userId: string | null
  isGuest: boolean
  locale: Locale
  timeoutMs: number
  /** Focus the feed's heading (the card focus was in has left the feed). Stable. */
  focusHeading: () => void
  /** The context a card notice belongs to (the feed sub-tab and the signed-in user). When it
   *  changes the notice is cleared — silently — so it is never re-read in another sub-tab visit or
   *  by another account. A reload of the same context leaves it alone. */
  noticeContext: string
}

export function useFeedEventCards({ supabase, userId, isGuest, locale, timeoutMs, focusHeading, noticeContext }: FeedEventCardsOptions) {
  const [eventItems, setEventItems] = useState<EventFeedItem[]>([])
  const [eventMyStatuses, setEventMyStatuses] = useState<Record<string, MyCheckinStatus>>({})
  const [eventAnonClaims, setEventAnonClaims] = useState<Set<string>>(new Set())

  const applyEventCard = useCallback((eventId: string, item: EventCardItem | null, checkin: CheckinState) => {
    setEventItems((prev) => replaceEventCard(prev, eventId, item, keepFeedRank))
    setEventMyStatuses((prev) => ({ ...prev, ...checkin.statuses }))
    setEventAnonClaims((prev) => new Set([...prev, ...checkin.anonClaims]))
  }, [])
  const feedRoot = useCallback(() => (typeof document === 'undefined' ? null : document), [])

  const { notice, setNotice, onManaged, refreshQuietly } = useEventCardRefresh({
    supabase,
    surface: 'feed',
    userId,
    isGuest,
    locale,
    timeoutMs,
    apply: applyEventCard,
    root: feedRoot,
    focusHeading,
  })

  // Post cards announce through the same region (createCardNoticeAnnouncer); an event-card change
  // supersedes a post announcement still waiting for its frame.
  const [postNotices] = useState(() =>
    createCardNoticeAnnouncer(setNotice, (fn) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn)
      else fn()
    }),
  )
  const onCardManaged = useCallback(
    (eventId: string, change: EventCardChange) => {
      postNotices.supersede()
      return onManaged(eventId, change)
    },
    [postNotices, onManaged],
  )

  // Clear the notice when its context changes (render-time, the "previous value" pattern: no stale
  // sentence is ever rendered in the new context, not even for one commit).
  const clearNotice = useCallback(() => setNotice(''), [setNotice])
  const [noticeFor, setNoticeFor] = useState(noticeContext)
  if (noticeFor !== noticeContext) {
    setNoticeFor(noticeContext)
    clearNotice()
  }

  // The latest list, for the Events-tab sync (it must not re-subscribe on every change).
  const eventItemsRef = useRef<EventFeedItem[]>([])
  useEffect(() => {
    eventItemsRef.current = eventItems
  }, [eventItems])
  const syncFeedEventCard = useCallback(
    (eventId: string, change: EventCardChange) => {
      if (!eventItemsRef.current.some((e) => e.eventId === eventId)) return
      void refreshQuietly(eventId, change)
    },
    [refreshQuietly],
  )

  return {
    eventItems,
    setEventItems,
    eventMyStatuses,
    setEventMyStatuses,
    eventAnonClaims,
    setEventAnonClaims,
    /** What the last change from an event card's ⋯ menu did (the feed's card-notice region). Each
     *  save clears it before setting it, so the same sentence twice is announced twice. */
    feedNotice: notice,
    handleEventManaged: onCardManaged,
    /** A post card's announcement (edit saved, deleted, link copied, …) in the card-notice region. */
    announceCardNotice: postNotices.announce,
    syncFeedEventCard,
  }
}
