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
// Announcement timing: when focus was inside the card, the notice is set only after focus has
// moved (card left: in the frame that focuses the heading, right before the card is removed; card
// still listed: right after focus is restored, two frames later), so it queues behind the focus
// move; otherwise as soon as the re-read has been applied. A frame from an older save on the same
// card does nothing once a newer save has started.
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

export function useEventCardRefresh({ supabase, surface, userId, isGuest, locale, timeoutMs, apply, root, focusHeading }: EventCardRefreshOptions) {
  const [notice, setNotice] = useState('')
  const reloadSeq = useRef(new Map<string, number>())

  const reread = useCallback(
    async (eventId: string, change: EventCardChange, quiet: boolean) => {
      const seq = (reloadSeq.current.get(eventId) ?? 0) + 1
      reloadSeq.current.set(eventId, seq)
      // Cleared first, so the same sentence twice in a row is announced twice.
      if (!quiet) setNotice('')
      // A later save on the same card started its own re-read (or frame): that one wins.
      const superseded = () => reloadSeq.current.get(eventId) !== seq
      let gone = false
      try {
        const { item, checkin } = await reloadEventCard(supabase, eventId, { surface, userId, isGuest, timeoutMs })
        if (superseded()) return
        gone = item === null
        const hadFocus = !quiet && typeof document !== 'undefined' && eventCardHasFocus(root(), eventId, document.activeElement)
        if (!hadFocus) {
          apply(eventId, item, checkin)
        } else if (gone) {
          // The focused card leaves: in ONE frame, focus the heading first, then remove the card and
          // set the notice — so neither the list's new status ("No upcoming events yet.") nor the
          // notice is queued before the focus move (a screen reader cancels queued polite messages
          // when focus moves), and focus never sits on <body>. The feed's exit animation then plays
          // with focus already on its heading.
          const text = eventChangeNotice(change, true, locale)
          requestAnimationFrame(() => {
            if (superseded()) return
            focusHeading()
            apply(eventId, item, checkin)
            setNotice(text)
          })
          return
        } else {
          // Still listed: React commits the re-read card first (it may be re-filed — remounted —
          // under another day in the Events tab); two frames later focus is restored, and only then
          // is the notice set, so it queues behind the focus move.
          apply(eventId, item, checkin)
          const text = eventChangeNotice(change, false, locale)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (superseded()) return
              restoreCardFocus(root(), eventId, document.activeElement, focusHeading)
              setNotice(text)
            }),
          )
          return
        }
      } catch (err) {
        const e = err as { code?: string; name?: string } | null
        logger.warn('events.card.refresh_failed', { surface, code: e?.code || e?.name || 'unknown' })
        if (superseded()) return
      }
      if (!quiet) setNotice(eventChangeNotice(change, gone, locale))
    },
    [supabase, surface, userId, isGuest, locale, timeoutMs, apply, root, focusHeading],
  )

  const onManaged = useCallback((eventId: string, change: EventCardChange) => reread(eventId, change, false), [reread])
  const refreshQuietly = useCallback((eventId: string, change: EventCardChange) => reread(eventId, change, true), [reread])

  return { notice, setNotice, onManaged, refreshQuietly }
}
