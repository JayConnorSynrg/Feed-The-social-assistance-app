'use client'

// event-card.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one event card members see — in the ranked community feed (W1.6b) and in the Events tab.
// It shows the event's next shown date (one card per event), its repeat pattern ("Every week on
// Saturday · Next: Sat, Oct 24"), the cancelled date that comes before it ("Sat, Oct 10
// cancelled — next: Sat, Oct 24"), and reuses the W1.6a check-in logic end-to-end: the button
// state comes from computeCheckinButton and tapping opens the CheckinSheet, which calls the
// check_in SECDEF RPC and shows guests the create-account prompt. A platform admin or an admin of
// the event's organization also gets the card's ⋯ menu (edit the event, add dates, cancel this
// date, Edit in admin — components/events/event-card-admin-menu.tsx); everyone else sees no menu.

import { useId, useRef, useState } from 'react'
import { Calendar, CalendarClock, CalendarX, MapPin, Repeat, Users } from 'lucide-react'
import { CheckinSheet, type CheckinOccurrence } from '@/components/panels/checkin-sheet'
import {
  computeCheckinButton,
  type MyCheckinStatus,
  type OccurrenceStatus,
} from '@/lib/event-checkin'
import {
  type EventCardItem,
  eventCancelledLine,
  eventCardHasDate,
  eventRepeatLine,
  eventTimingLabel,
  distanceBucketLabel,
} from '@/components/feed/post-model'
import { dir, type Locale } from '@/lib/i18n'
import { formatEventWhen } from '@/lib/event-time'
import { checkinButtonLabel, eventFormT, eventTypeColor, eventTypeLabel, formatMessage } from '@/lib/i18n-event-forms'
import { eventMemberT } from '@/lib/i18n-event-member'
import { EventCardAdminMenu, type EventCardChange, type EventMenuSource } from '@/components/events/event-card-admin-menu'

export interface EventCardProps {
  event: EventCardItem
  /** The viewer's locale (useProfileLocale); the card sets lang/dir from it. */
  locale: Locale
  /** 'feed' adds the "Event" marker (the card sits among posts) and the distance bucket. */
  surface: 'feed' | 'events-tab'
  /** Card title level: h3 in the feed, h4 under the Events tab's day-group h3. */
  headingLevel?: 3 | 4
  /** Coarse distance bucket from ranked_feed_v2 (feed only). */
  distanceBucket?: string | null
  /** The member's own check-in state for this date ('none' for guests). */
  myStatus: MyCheckinStatus
  /** True when the member already spent their one anonymous check-in here. */
  anonymousClaimed: boolean
  /** After a successful check-in (when the sheet closes): the date's id and the check_in answer
   *  (null when unknown — the caller re-reads). */
  onCheckedIn: (occurrenceId: string, result: string | null) => void
  /** The clock the card reads (tests); defaults to the time the card mounts. */
  now?: number
  /** The viewer's zone (tests); defaults to the browser's. */
  viewerTz?: string
  /** A deep link (#events?focus=event:<id>) brought this card into view: a lime ring marks it. */
  highlighted?: boolean
  /** Its admin changed the event from the card's ⋯ menu: the owner re-reads this card. */
  onManaged?: (eventId: string, change: EventCardChange) => void
}

/** The deep-link highlight: a lime-700 ring outside the card (4.96:1 on the white offset, 4.75:1 on
 *  stone-50 — WCAG 1.4.11), fading in only when motion is allowed. */
export const EVENT_CARD_HIGHLIGHT = 'ring-4 ring-lime-700 ring-offset-2 motion-safe:transition-shadow motion-safe:duration-300'

/** True when focus is inside the event's card under `root` (a re-read that removes the card must
 *  then move focus somewhere that still exists). */
export function eventCardHasFocus(root: ParentNode | null, eventId: string, active: Element | null): boolean {
  if (!root || !active) return false
  const card = root.querySelector(`[data-event-id="${CSS.escape(eventId)}"]`)
  return card?.contains(active) ?? false
}

/** The admin.nav.edit_in_admin source of "Edit in admin" in an event card's ⋯ menu. */
export function eventAdminSource(surface: EventCardProps['surface']): EventMenuSource {
  return surface === 'feed' ? 'feed_event_menu' : 'events_panel_menu'
}

export function EventCard({
  event,
  locale,
  surface,
  headingLevel = 3,
  distanceBucket = null,
  myStatus,
  anonymousClaimed,
  onCheckedIn,
  now,
  viewerTz,
  highlighted = false,
  onManaged,
}: EventCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [checkinOccurrence, setCheckinOccurrence] = useState<CheckinOccurrence | null>(null)
  const [confirmsPresence, setConfirmsPresence] = useState(false)
  const [hasTracked, setHasTracked] = useState(false)

  const titleId = useId()
  const articleRef = useRef<HTMLElement>(null)
  // Set when the sheet closes after a check-in: the button that opened it may have become a
  // status pill, so focus returns to the card itself instead.
  const focusCardOnClose = useRef(false)

  // Mount-time "now" (lazy initializer — pure at render; a load remounts the card with a fresh
  // clock). Drives the check-in window + timing label.
  const [nowMs] = useState(() => now ?? Date.now())
  const Title = headingLevel === 4 ? 'h4' : 'h3'
  const startsAtMs = new Date(event.startsAt).getTime()
  const endsAtMs = new Date(event.endsAt).getTime()
  const typeLabel = eventTypeLabel(event.eventType, locale)
  // When the cancelled notice names the next date, the time line gives only its times (the date
  // is read once, in the notice).
  const when = formatEventWhen(event.startsAt, event.endsAt, event.timeZone, locale, {
    viewerTz,
    timeOnly: event.cancelledShown === 'next',
  })
  const location = [event.locationName, event.city, event.state].filter(Boolean).join(', ')
  const distanceLabel = surface === 'feed' ? distanceBucketLabel(distanceBucket, locale) : null
  const timing = eventTimingLabel(nowMs, startsAtMs, endsAtMs, locale)
  const repeatLine = eventRepeatLine(event, locale, viewerTz)
  const cancelledLine = eventCancelledLine(event, locale, viewerTz)
  // A card whose shown date was cancelled times the next date (when there is one) but offers no
  // check-in: the date it was listed for is not happening, and the next one is checked in to from
  // its own card once it is posted.
  const hasDate = eventCardHasDate(event)
  const offersCheckin = event.cancelledShown === null

  const btn = computeCheckinButton({
    status: event.status as OccurrenceStatus,
    startsAtMs,
    endsAtMs,
    myStatus,
    nowMs,
    anonymousClaimed,
  })

  const openSheet = () => {
    setCheckinOccurrence({
      id: event.occurrenceId,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      event: {
        title: event.title,
        location_name: event.locationName,
        time_zone: event.timeZone,
        organization: event.orgName ? { name: event.orgName } : null,
      },
    })
    setConfirmsPresence(btn.confirmsPresence)
    // Hide the anonymous option once the member already holds a tracked row (M2).
    setHasTracked(myStatus !== 'none')
    setSheetOpen(true)
  }

  const live = hasDate && timing.isLive
  const showBadges = surface === 'feed' || live || event.isExtraDate

  return (
    <article
      ref={articleRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      lang={locale}
      dir={dir(locale)}
      data-event-id={event.eventId}
      className={`bg-stone-50/95 border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700${highlighted ? ` ${EVENT_CARD_HIGHLIGHT}` : ''}`}
    >
      {showBadges && (
        <div className="flex flex-wrap items-center gap-2">
          {surface === 'feed' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime-800 bg-lime-100 px-2 py-0.5 rounded-full">
              <Calendar className="w-3 h-3" aria-hidden="true" /> {eventFormT(locale, 'cardEventBadge')}
            </span>
          )}
          {live && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#4a5d23] px-2 py-0.5 rounded-full">
              <CalendarClock className="w-3 h-3" aria-hidden="true" /> {timing.label}
            </span>
          )}
          {event.isExtraDate && (
            <span className="text-xs font-semibold text-stone-700 bg-stone-200 px-2 py-0.5 rounded-full">
              {eventFormT(locale, 'extraDateBadge')}
            </span>
          )}
        </div>
      )}

      {event.orgName && <p className="text-xs text-stone-600 font-medium">{event.orgName}</p>}

      <div className="flex items-start justify-between gap-3">
        <Title id={titleId} className="text-base font-semibold text-stone-900 leading-snug">{event.title}</Title>
        <div className="flex flex-shrink-0 items-center gap-1">
          <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${eventTypeColor(event.eventType)}`}>
            {typeLabel}
          </span>
          {/* Organization / platform admins only (after hydration); nothing for anyone else. */}
          <EventCardAdminMenu event={event} locale={locale} source={eventAdminSource(surface)} onChanged={onManaged} />
        </div>
      </div>

      {repeatLine && (
        <p className="flex items-start gap-1.5 text-sm text-stone-700" data-testid="event-repeat">
          <Repeat className="w-3.5 h-3.5 mt-0.5 text-stone-500 flex-shrink-0" aria-hidden="true" />
          <span>{repeatLine}</span>
        </p>
      )}

      {cancelledLine && (
        <p
          className="flex items-start gap-1.5 text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"
          data-testid="event-cancelled"
        >
          <CalendarX className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{cancelledLine}</span>
        </p>
      )}

      {hasDate && (
        <div className="flex items-start gap-1.5 text-sm text-stone-700">
          <Calendar className="w-3.5 h-3.5 mt-0.5 text-stone-500 flex-shrink-0" aria-hidden="true" />
          <span>
            {when.text}
            {when.venue && <span className="block text-xs text-stone-600">{when.venue}</span>}
            {!timing.isLive && <span className="block text-stone-600">{timing.label}</span>}
          </span>
        </div>
      )}

      {location && (
        <div className="flex items-center gap-1.5 text-sm text-stone-600">
          <MapPin className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" aria-hidden="true" />
          <span>
            {location}
            {distanceLabel && <span className="text-stone-600"> · {distanceLabel}</span>}
          </span>
        </div>
      )}

      {event.capacity != null && (
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <Users className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" aria-hidden="true" />
          <span>{formatMessage(eventMemberT(locale, 'cardCapacity'), { n: event.capacity })}</span>
        </div>
      )}

      {event.notes && <p className="text-xs text-stone-600 leading-relaxed">{event.notes}</p>}

      {!event.requiresRegistration && (
        <span className="self-start text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
          {eventFormT(locale, 'cardWalkIn')}
        </span>
      )}

      {!offersCheckin ? null : btn.actionable ? (
        <button
          type="button"
          onClick={openSheet}
          className="self-start min-h-6 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#4a5d23] hover:bg-[#3d4d1c] text-white transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
        >
          {checkinButtonLabel(btn.kind, btn.label, locale)}
        </button>
      ) : (
        <span
          className={`self-start text-xs font-semibold px-3 py-1.5 rounded-xl ${
            btn.kind === 'attended' || btn.kind === 'checked_early' || btn.kind === 'anonymous'
              ? 'bg-lime-100 text-lime-800'
              : 'bg-stone-100 text-stone-600'
          }`}
        >
          {checkinButtonLabel(btn.kind, btn.label, locale)}
        </span>
      )}

      {checkinOccurrence && (
        <CheckinSheet
          occurrence={checkinOccurrence}
          open={sheetOpen}
          confirmsPresence={confirmsPresence}
          hasTrackedRow={hasTracked}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) setCheckinOccurrence(null)
          }}
          onSuccess={(result) => {
            focusCardOnClose.current = true
            onCheckedIn(event.occurrenceId, result)
          }}
          onCloseAutoFocus={(e) => {
            if (!focusCardOnClose.current) return
            focusCardOnClose.current = false
            e.preventDefault()
            articleRef.current?.focus()
          }}
        />
      )}
    </article>
  )
}
