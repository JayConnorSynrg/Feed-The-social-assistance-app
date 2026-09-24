'use client'

// event-feed-card.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One community-event row inside the ranked community feed (W1.6b). Renders the
// event's next occurrence and reuses the W1.6a check-in logic end-to-end: the
// button state comes from computeCheckinButton (identical to the Events panel),
// and tapping opens the same CheckinSheet, which calls the check_in SECDEF RPC
// and shows guests the create-account prompt. So a signed-in member checks in
// ("Check in early" / "I'm here") straight from the feed card.

import { useState } from 'react'
import { Calendar, MapPin, CalendarClock } from 'lucide-react'
import { CheckinSheet, type CheckinOccurrence } from '@/components/panels/checkin-sheet'
import {
  computeCheckinButton,
  type MyCheckinStatus,
  type OccurrenceStatus,
} from '@/lib/event-checkin'
import {
  type EventFeedItem,
  eventTimingLabel,
  distanceBucketLabel,
} from '@/components/feed/post-model'

const EVENT_TYPE_COLORS: Record<string, string> = {
  distribution: 'bg-lime-100 text-lime-800',
  meal:         'bg-orange-100 text-orange-800',
  pantry:       'bg-amber-100 text-amber-800',
  clinic:       'bg-sky-100 text-sky-800',
  other:        'bg-stone-100 text-stone-700',
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  distribution: 'Distribution',
  meal:         'Meal',
  pantry:       'Pantry',
  clinic:       'Clinic',
  other:        'Other',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

interface EventFeedCardProps {
  event: EventFeedItem
  /** The member's own check-in state for this occurrence ('none' for guests). */
  myStatus: MyCheckinStatus
  /** True when the member already spent their one anonymous check-in here. */
  anonymousClaimed: boolean
  /** Re-fetch the feed after a successful check-in (mirrors the Events panel). */
  onCheckedIn: () => void
}

export function EventFeedCard({ event, myStatus, anonymousClaimed, onCheckedIn }: EventFeedCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [checkinOccurrence, setCheckinOccurrence] = useState<CheckinOccurrence | null>(null)
  const [confirmsPresence, setConfirmsPresence] = useState(false)
  const [hasTracked, setHasTracked] = useState(false)

  // Mount-time "now" (lazy initializer — pure at render; the feed re-fetches after a
  // check-in and on mount, which remounts the card with a fresh clock). Drives the
  // check-in button window + timing label exactly as the Events panel's render does.
  const [nowMs] = useState(() => Date.now())
  const typeColor = EVENT_TYPE_COLORS[event.eventType] ?? 'bg-stone-100 text-stone-700'
  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType
  const location = [event.locationName, event.city, event.state].filter(Boolean).join(', ')
  const distanceLabel = distanceBucketLabel(event.distanceBucket)
  const timing = eventTimingLabel(nowMs, new Date(event.startsAt).getTime(), new Date(event.endsAt).getTime())

  const btn = computeCheckinButton({
    status: event.status as OccurrenceStatus,
    startsAtMs: new Date(event.startsAt).getTime(),
    endsAtMs: new Date(event.endsAt).getTime(),
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
        organization: event.orgName ? { name: event.orgName } : null,
      },
    })
    setConfirmsPresence(btn.confirmsPresence)
    // Hide the anonymous option once the member already holds a tracked row (M2).
    setHasTracked(myStatus !== 'none')
    setSheetOpen(true)
  }

  return (
    <div className="bg-stone-50/95 border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
      {/* Event marker so the row reads as an event amid posts */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime-800 bg-lime-100 px-2 py-0.5 rounded-full">
          <Calendar className="w-3 h-3" aria-hidden="true" /> Event
        </span>
        {timing.isLive && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#4a5d23] px-2 py-0.5 rounded-full">
            <CalendarClock className="w-3 h-3" aria-hidden="true" /> {timing.label}
          </span>
        )}
      </div>

      {event.orgName && <p className="text-xs text-stone-500 font-medium">{event.orgName}</p>}

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-900 leading-snug">{event.title}</h3>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
          {typeLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-stone-700">
        <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" aria-hidden="true" />
        <span>
          {formatDate(event.startsAt)} · {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
          {!timing.isLive && <span className="text-stone-400"> · {timing.label}</span>}
        </span>
      </div>

      {location && (
        <div className="flex items-center gap-1.5 text-sm text-stone-600">
          <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" aria-hidden="true" />
          <span>
            {location}
            {distanceLabel && <span className="text-stone-400"> · {distanceLabel}</span>}
          </span>
        </div>
      )}

      {!event.requiresRegistration && (
        <span className="self-start text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
          Walk-in welcome
        </span>
      )}

      {btn.actionable ? (
        <button
          type="button"
          onClick={openSheet}
          className="self-start text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#4a5d23] hover:bg-[#3d4d1c] text-white transition-colors"
        >
          {btn.label}
        </button>
      ) : (
        <span
          className={`self-start text-xs font-semibold px-3 py-1.5 rounded-xl ${
            btn.kind === 'attended' || btn.kind === 'checked_early' || btn.kind === 'anonymous'
              ? 'bg-lime-100 text-lime-800'
              : 'bg-stone-100 text-stone-500'
          }`}
        >
          {btn.label}
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
          onSuccess={onCheckedIn}
        />
      )}
    </div>
  )
}
