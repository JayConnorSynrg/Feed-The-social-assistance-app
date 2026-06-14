'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Loader2, AlertCircle, MapPin, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CheckinSheet, type CheckinOccurrence } from './checkin-sheet'

interface OccurrenceWithEvent {
  id: string
  starts_at: string
  ends_at: string
  notes: string | null
  capacity: number | null
  status: string
  event: {
    id: string
    title: string
    event_type: string
    location_name: string | null
    address: string | null
    city: string | null
    state: string | null
    requires_registration: boolean
    organization: { name: string } | null
  } | null
}

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
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getDateGroup(dateStr: string): 'today' | 'week' | 'upcoming' {
  const d = new Date(dateStr)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfNextDay = new Date(startOfToday.getTime() + 86400000)
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 86400000)

  if (d >= startOfToday && d < startOfNextDay) return 'today'
  if (d >= startOfNextDay && d < startOfNextWeek) return 'week'
  return 'upcoming'
}

export function EventsPanel() {
  const supabase = createClient()

  const [occurrences, setOccurrences] = useState<OccurrenceWithEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkinOccurrence, setCheckinOccurrence] = useState<CheckinOccurrence | null>(null)
  const [checkinOpen, setCheckinOpen] = useState(false)

  const fetchOccurrences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error: fetchError } = await supabase
        .from('event_occurrences')
        .select(`
          id,
          starts_at,
          ends_at,
          notes,
          capacity,
          status,
          event:assistance_events(
            id,
            title,
            event_type,
            location_name,
            address,
            city,
            state,
            requires_registration,
            organization:organizations(name)
          )
        `)
        .eq('status', 'upcoming')
        .gte('starts_at', now)
        .lte('starts_at', thirtyDaysOut)
        .order('starts_at', { ascending: true })
        .limit(50)

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setOccurrences((data as unknown as OccurrenceWithEvent[]) ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchOccurrences()
  }, [fetchOccurrences])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <Loader2 className="w-7 h-7 text-lime-700 animate-spin" aria-hidden="true" />
        <p className="text-sm text-stone-500">Loading events…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
        <AlertCircle className="w-7 h-7 text-red-400" aria-hidden="true" />
        <p className="text-sm text-stone-700">{error}</p>
        <button
          onClick={fetchOccurrences}
          className="text-sm text-lime-700 underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  if (occurrences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 p-6 text-center">
        <Calendar className="w-8 h-8 text-stone-300" aria-hidden="true" />
        <p className="text-sm text-stone-500 font-medium">No upcoming events in your area</p>
        <p className="text-xs text-stone-600">Check back soon — events are added regularly.</p>
      </div>
    )
  }

  const groups: Array<{ key: 'today' | 'week' | 'upcoming'; label: string; items: OccurrenceWithEvent[] }> = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'week', label: 'This Week', items: [] },
    { key: 'upcoming', label: 'Upcoming', items: [] },
  ]

  for (const occ of occurrences) {
    const group = getDateGroup(occ.starts_at)
    const g = groups.find((g) => g.key === group)
    if (g) g.items.push(occ)
  }

  const nonEmptyGroups = groups.filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center gap-2 pb-1">
        <Calendar className="w-5 h-5 text-lime-700 flex-shrink-0" aria-hidden="true" />
        <h2 className="text-lg font-bold text-stone-900">Community Events</h2>
      </div>

      {nonEmptyGroups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            {group.label}
          </h3>
          {group.items.map((occ) => {
            const ev = occ.event
            if (!ev) return null
            const typeColor = EVENT_TYPE_COLORS[ev.event_type] ?? 'bg-stone-100 text-stone-700'
            const typeLabel = EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type
            const location = [ev.location_name, ev.city, ev.state].filter(Boolean).join(', ')

            return (
              <div
                key={occ.id}
                className="bg-stone-50/95 border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2"
              >
                {ev.organization && (
                  <p className="text-xs text-stone-500 font-medium">{ev.organization.name}</p>
                )}

                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-stone-900 leading-snug">{ev.title}</h3>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                    {typeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-stone-700">
                  <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {formatDate(occ.starts_at)} · {formatTime(occ.starts_at)}–{formatTime(occ.ends_at)}
                  </span>
                </div>

                {location && (
                  <div className="flex items-center gap-1.5 text-sm text-stone-600">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" aria-hidden="true" />
                    <span>{location}</span>
                  </div>
                )}

                {occ.capacity != null && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <Users className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" aria-hidden="true" />
                    <span>Capacity: {occ.capacity}</span>
                  </div>
                )}

                {occ.notes && (
                  <p className="text-xs text-stone-600 leading-relaxed">{occ.notes}</p>
                )}

                {!ev.requires_registration && (
                  <span className="self-start text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    Walk-in welcome
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCheckinOccurrence({
                      id: occ.id,
                      starts_at: occ.starts_at,
                      ends_at: occ.ends_at,
                      event: ev
                        ? {
                            title: ev.title,
                            location_name: ev.location_name ?? null,
                            organization: ev.organization ?? null,
                          }
                        : null,
                    })
                    setCheckinOpen(true)
                  }}
                  className="self-start text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#4a5d23] hover:bg-[#3d4d1c] text-white transition-colors"
                >
                  Check In
                </button>
              </div>
            )
          })}
        </div>
      ))}
      {checkinOccurrence && (
        <CheckinSheet
          occurrence={checkinOccurrence}
          open={checkinOpen}
          onOpenChange={(open) => {
            setCheckinOpen(open)
            if (!open) setCheckinOccurrence(null)
          }}
        />
      )}
    </div>
  )
}
