'use client'

// apps/web/src/hooks/use-event-card-refresh.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// After an admin changes an event from its card's ⋯ menu (edit, add dates, cancel a date), the list
// the card sits in — the community feed or the Events tab — re-reads ONLY that card
// (lib/event-card-data.ts reloadEventCard) and puts it back in place. The list is never reloaded, so
// the reader's place and focus stay. One polite announcement says what the save did (and that the
// card left, when the event is no longer listed); focus that was inside a card that left moves to
// the list's heading. The latest re-read per event wins (two saves in a row on one card). A failed
// re-read keeps the card as it was (the save itself went through) and writes one warn row.

import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { logger } from '@/lib/logger'
import type { Locale } from '@/lib/i18n'
import { reloadEventCard } from '@/lib/event-card-data'
import type { CheckinState, CheckinStateSurface } from '@/lib/event-checkin-state'
import type { EventCardItem } from '@/components/feed/post-model'
import { eventCardHasFocus } from '@/components/feed/event-card'
import { eventChangeNotice, type EventCardChange } from '@/components/events/event-card-admin-menu'

export interface EventCardRefreshOptions {
  supabase: SupabaseClient<Database>
  surface: CheckinStateSurface
  userId: string | null
  isGuest: boolean
  locale: Locale
  timeoutMs: number
  /** Put the re-read card in place (null = remove it) and add its check-in state. Must be stable. */
  apply: (eventId: string, item: EventCardItem | null, checkin: CheckinState) => void
  /** Where the list's cards are (to tell whether focus was inside the one that left). Stable. */
  root: () => ParentNode | null
  /** Focus the list's heading (the card focus was in has left). Stable. */
  focusHeading: () => void
}

export function useEventCardRefresh({ supabase, surface, userId, isGuest, locale, timeoutMs, apply, root, focusHeading }: EventCardRefreshOptions) {
  const [notice, setNotice] = useState('')
  const reloadSeq = useRef(new Map<string, number>())

  const onManaged = useCallback(
    async (eventId: string, change: EventCardChange) => {
      const seq = (reloadSeq.current.get(eventId) ?? 0) + 1
      reloadSeq.current.set(eventId, seq)
      // Cleared first, so the same sentence twice in a row is announced twice.
      setNotice('')
      let gone = false
      try {
        const { item, checkin } = await reloadEventCard(supabase, eventId, { surface, userId, isGuest, timeoutMs })
        // A later save on the same card started its own re-read: that one wins.
        if (reloadSeq.current.get(eventId) !== seq) return
        gone = item === null
        const hadFocus = typeof document !== 'undefined' && eventCardHasFocus(root(), eventId, document.activeElement)
        apply(eventId, item, checkin)
        if (gone && hadFocus) requestAnimationFrame(focusHeading)
      } catch (err) {
        const e = err as { code?: string; name?: string } | null
        logger.warn('events.card.refresh_failed', { surface, code: e?.code || e?.name || 'unknown' })
        if (reloadSeq.current.get(eventId) !== seq) return
      }
      setNotice(eventChangeNotice(change, gone, locale))
    },
    [supabase, surface, userId, isGuest, locale, timeoutMs, apply, root, focusHeading],
  )

  return { notice, setNotice, onManaged }
}
