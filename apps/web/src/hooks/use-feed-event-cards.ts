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

export interface FeedEventCardsOptions {
  supabase: SupabaseClient<Database>
  userId: string | null
  isGuest: boolean
  locale: Locale
  timeoutMs: number
  /** Focus the feed's heading (the card focus was in has left the feed). Stable. */
  focusHeading: () => void
}

export function useFeedEventCards({ supabase, userId, isGuest, locale, timeoutMs, focusHeading }: FeedEventCardsOptions) {
  const [eventItems, setEventItems] = useState<EventFeedItem[]>([])
  const [eventMyStatuses, setEventMyStatuses] = useState<Record<string, MyCheckinStatus>>({})
  const [eventAnonClaims, setEventAnonClaims] = useState<Set<string>>(new Set())

  const applyEventCard = useCallback((eventId: string, item: EventCardItem | null, checkin: CheckinState) => {
    setEventItems((prev) => replaceEventCard(prev, eventId, item, keepFeedRank))
    setEventMyStatuses((prev) => ({ ...prev, ...checkin.statuses }))
    setEventAnonClaims((prev) => new Set([...prev, ...checkin.anonClaims]))
  }, [])
  const feedRoot = useCallback(() => (typeof document === 'undefined' ? null : document), [])

  const { notice, onManaged, refreshQuietly } = useEventCardRefresh({
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
    handleEventManaged: onManaged,
    syncFeedEventCard,
  }
}
