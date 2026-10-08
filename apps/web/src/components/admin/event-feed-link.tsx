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
import { adminNavT, memberReasonText } from '@/lib/i18n-admin-nav'
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

function statusOf(event: EventFeedLinkEvent, now: number) {
  return eventFeedStatus(event, event.feed_next?.[0] ?? null, event.org?.is_active === true, new Date(now))
}

/** What the row says when there is no link: "Appears in feed <venue date>" or the reason. null when
 *  the event is listed (the row shows "View in feed"). */
export function eventFeedText(event: EventFeedLinkEvent, now: number, locale: Locale): string | null {
  const status = statusOf(event, now)
  if (status.listed) return null
  if ('appearsAt' in status) {
    const date = formatCalendarDate(venueDateKey(status.appearsAt.toISOString(), event.time_zone), locale)
    return formatMessage(adminNavT(locale, 'appearsInFeed'), { date })
  }
  return memberReasonText(locale, status.reason)
}

export function EventFeedLink({ event, now, locale, source }: EventFeedLinkProps) {
  const status = statusOf(event, now)
  if (!status.listed && 'appearsAt' in status) {
    return <span className={REASON_CLASS}>{eventFeedText(event, now, locale)}</span>
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

export interface EventStatusNoticeProps {
  /** The status text ("Event “X” created."), or null (nothing to say). */
  text: string | null
  /** The event the text is about, once the list has it (or null). */
  event: EventFeedLinkEvent | null
  now: number
  locale: Locale
  source: MemberViewSource
  className?: string
}

/**
 * The scheduler's status line. One always-mounted live region holding only plain text — the notice,
 * plus "Appears in feed <date>" or the reason when it is about an event that is not listed — so it is
 * announced once; when the event is listed, "View in feed" sits right after the region, outside it.
 */
export function EventStatusNotice({ text, event, now, locale, source, className }: EventStatusNoticeProps) {
  const extra = text && event ? eventFeedText(event, now, locale) : null
  return (
    <>
      {/* aria-atomic="false": when the appear date / reason is added after the refresh, only that
          addition is read, not the created notice a second time. */}
      <p role="status" aria-atomic="false" className={className}>
        {text}
        {text && extra && <span> {extra}</span>}
      </p>
      {text && event && extra === null && <EventFeedLink event={event} now={now} locale={locale} source={source} />}
    </>
  )
}
