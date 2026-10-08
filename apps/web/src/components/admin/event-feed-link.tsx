'use client'

// apps/web/src/components/admin/event-feed-link.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// An admin event row's member view. "View in feed" opens the members' Events list focused on this
// event (memberUrl kind 'event', in the reused feed-preview tab) exactly when
// public.event_feed_next(now()) lists it (lib/event-feed-window.ts). Otherwise the row says when it
// will be listed — "Appears in feed <venue-local date>" — or why it is not: retired, organization
// inactive, no upcoming dates.

import type { Locale } from '@/lib/i18n'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { formatMessage } from '@/lib/i18n-event-forms'
import { formatCalendarDate, venueDateKey } from '@/lib/event-time'
import { eventFeedStatus, type FeedWindowEvent, type FeedWindowOccurrence } from '@/lib/event-feed-window'
import { MemberViewLink, REASON_CLASS, type MemberViewSource } from './member-view-link'

export interface EventFeedLinkEvent extends FeedWindowEvent {
  id: string
  title: string
  /** The event's organization (null when not returned: treated as inactive — never a dead link). */
  org?: { is_active: boolean } | null
  /** Its soonest not-ended date that event_feed_next would consider (0 or 1 row). */
  feed_next?: FeedWindowOccurrence[] | null
}

export interface EventFeedLinkProps {
  event: EventFeedLinkEvent
  /** The clock the decision is made with (the scheduler's load time). */
  now: number
  locale: Locale
  source: MemberViewSource
}

export function EventFeedLink({ event, now, locale, source }: EventFeedLinkProps) {
  const status = eventFeedStatus(event, event.feed_next?.[0] ?? null, event.org?.is_active === true, new Date(now))
  if (!status.listed && 'appearsAt' in status) {
    const date = formatCalendarDate(venueDateKey(status.appearsAt.toISOString(), event.time_zone), locale)
    return <span className={REASON_CLASS}>{formatMessage(adminNavT(locale, 'appearsInFeed'), { date })}</span>
  }
  return (
    <MemberViewLink
      to={{ kind: 'event', id: event.id }}
      visibility={status.listed ? { visible: true } : { visible: false, reason: status.reason }}
      label={adminNavT(locale, 'viewInFeed')}
      itemName={event.title}
      source={source}
      locale={locale}
    />
  )
}
