'use client'

// apps/web/src/hooks/use-event-card-refresh.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// After an admin changes an event from its card's ⋯ menu (edit, add dates, cancel a date), the list
// the card sits in — the community feed or the Events tab — re-reads ONLY that card
// (lib/event-card-data.ts reloadEventCard) and puts it back in place. The list is never reloaded, so
// the reader's place stays. One polite announcement says what the save did (and that the card left,
// when the event is no longer listed). The latest re-read per event wins (two saves in a row on one
// card). A failed re-read keeps the card as it was (the save itself went through) and writes one
// warn row.
//
// Announcement timing: when the focused card left, the notice is set in the same frame right after
// focus moves to the heading (so it queues behind the heading); otherwise as soon as the re-read
// has been applied.
//
// Focus (only when it was inside the card): a card that left the list → the list's heading, at
// once — the feed's exit animation keeps the leaving card in the DOM for a moment, so "is focus
// still inside it?" would wrongly answer yes. A card still listed → it stays where it is, or, when
// the card was mounted anew (the Events tab files it under another day), its new ⋯ trigger.
//
// `refreshQuietly` re-reads a card for a list that is not on screen (the feed's copy of an event
// changed from the Events tab): same re-read and apply, no announcement, no focus move.

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
  /** Where the list's cards are (to tell whether focus was inside the one that changed). Stable. */
  root: () => ParentNode | null
  /** Focus the list's heading (the card focus was in has left). Stable. */
  focusHeading: () => void
}

/** Where focus goes once a re-read card is on screen, when it was inside that card before:
 *  'stay' (still inside it), 'trigger' (the card was mounted anew: its ⋯ button), or 'heading'. */
function restoreCardFocus(root: ParentNode | null, eventId: string, active: Element | null, focusHeading: () => void): 'stay' | 'trigger' | 'heading' {
  if (eventCardHasFocus(root, eventId, active)) return 'stay'
  const trigger = root?.querySelector<HTMLElement>(`[data-testid="event-menu-${CSS.escape(eventId)}"]`)
  if (trigger) {
    trigger.focus()
    return 'trigger'
  }
  focusHeading()
  return 'heading'
}

/** After the re-read card (still listed) is applied, for focus that was inside it: two frames, so
 *  React commits the re-read card first. */
function scheduleCardFocus(root: () => ParentNode | null, eventId: string, focusHeading: () => void): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => restoreCardFocus(root(), eventId, document.activeElement, focusHeading)),
  )
}

export function useEventCardRefresh({ supabase, surface, userId, isGuest, locale, timeoutMs, apply, root, focusHeading }: EventCardRefreshOptions) {
  const [notice, setNotice] = useState('')
  const reloadSeq = useRef(new Map<string, number>())

  const reread = useCallback(
    async (eventId: string, change: EventCardChange, quiet: boolean) => {
      const seq = (reloadSeq.current.get(eventId) ?? 0) + 1
      reloadSeq.current.set(eventId, seq)
      // Cleared first, so the same sentence twice in a row is announced twice.
      if (!quiet) setNotice('')
      let gone = false
      let hadFocus = false
      try {
        const { item, checkin } = await reloadEventCard(supabase, eventId, { surface, userId, isGuest, timeoutMs })
        // A later save on the same card started its own re-read: that one wins.
        if (reloadSeq.current.get(eventId) !== seq) return
        gone = item === null
        hadFocus = !quiet && typeof document !== 'undefined' && eventCardHasFocus(root(), eventId, document.activeElement)
        apply(eventId, item, checkin)
        if (hadFocus && !gone) scheduleCardFocus(root, eventId, focusHeading)
      } catch (err) {
        const e = err as { code?: string; name?: string } | null
        logger.warn('events.card.refresh_failed', { surface, code: e?.code || e?.name || 'unknown' })
        if (reloadSeq.current.get(eventId) !== seq) return
      }
      if (quiet) return
      const text = eventChangeNotice(change, gone, locale)
      if (gone && hadFocus) {
        // The focused card left: move focus to the heading first, then set the notice in the same
        // frame, so the polite message queues behind the heading's announcement — a screen reader
        // cancels a polite message that was already queued when focus moves.
        requestAnimationFrame(() => {
          focusHeading()
          setNotice(text)
        })
        return
      }
      setNotice(text)
    },
    [supabase, surface, userId, isGuest, locale, timeoutMs, apply, root, focusHeading],
  )

  const onManaged = useCallback((eventId: string, change: EventCardChange) => reread(eventId, change, false), [reread])
  const refreshQuietly = useCallback((eventId: string, change: EventCardChange) => reread(eventId, change, true), [reread])

  return { notice, setNotice, onManaged, refreshQuietly }
}
