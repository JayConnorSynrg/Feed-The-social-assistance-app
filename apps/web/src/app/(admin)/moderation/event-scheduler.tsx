'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  isSameDay,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RecurrencePicker } from './recurrence-picker'
import { OrganizerCheckinDisplay } from './organizer-checkin-display'

interface AssistanceEvent {
  id: string
  title: string
  event_type: string
  location_name: string | null
  org_id: string
  rrule: string | null
  is_active: boolean
  occurrences: EventOccurrence[]
  org?: { name: string } | null
}

interface EventOccurrence {
  id: string
  event_id: string
  starts_at: string
  ends_at: string
  status: string
  capacity: number | null
  notes: string | null
}

interface KioskTarget {
  occurrence: {
    id: string
    starts_at: string
    ends_at: string
    event_title: string
    org_name: string
  }
}

interface Props {
  selectedOrgId: string
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  distribution: 'bg-[#4a5d23]/10 text-[#4a5d23] border-[#4a5d23]/30',
  meal: 'bg-orange-50 text-orange-700 border-orange-200',
  pantry: 'bg-amber-50 text-amber-700 border-amber-200',
  clinic: 'bg-sky-50 text-sky-700 border-sky-200',
  other: 'bg-stone-100 text-stone-600 border-stone-200',
}

export function EventScheduler({ selectedOrgId }: Props) {
  const supabase = createClient()

  const [events, setEvents] = useState<AssistanceEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Calendar navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  // Kiosk
  const [kioskTarget, setKioskTarget] = useState<KioskTarget | null>(null)
  const [kioskOpen, setKioskOpen] = useState(false)

  // Create event modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createEventType, setCreateEventType] = useState('distribution')
  const [createLocationName, setCreateLocationName] = useState('')
  const [createRrule, setCreateRrule] = useState<string | null>(null)
  const [createOrgId, setCreateOrgId] = useState(selectedOrgId === 'all' ? '' : selectedOrgId)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Add occurrence modal
  const [addOccurrenceEventId, setAddOccurrenceEventId] = useState<string | null>(null)
  const [addStartsAt, setAddStartsAt] = useState('')
  const [addEndsAt, setAddEndsAt] = useState('')
  const [addingOccurrence, setAddingOccurrence] = useState(false)
  const [addOccurrenceError, setAddOccurrenceError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const query = supabase
      .from('assistance_events')
      .select('id, title, event_type, location_name, org_id, rrule, is_active, org:organizations(name), occurrences:event_occurrences(id, event_id, starts_at, ends_at, status, capacity, notes)')
      .eq('is_active', true)

    if (selectedOrgId !== 'all') {
      query.eq('org_id', selectedOrgId)
    }

    const { data } = await query
    setEvents((data as AssistanceEvent[]) ?? [])
    setLoading(false)
  }, [supabase, selectedOrgId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Sync createOrgId when selectedOrgId changes
  useEffect(() => {
    if (selectedOrgId !== 'all') {
      setCreateOrgId(selectedOrgId)
    }
  }, [selectedOrgId])

  // Collect all occurrences with event info
  const allOccurrences = events.flatMap((event) =>
    (event.occurrences ?? [])
      .filter((occ) => occ.status === 'upcoming')
      .map((occ) => ({
        ...occ,
        event_title: event.title,
        event_type: event.event_type,
        org_name: event.org?.name ?? '',
      }))
  )

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  function getOccurrencesForDay(day: Date) {
    return allOccurrences.filter((occ) => isSameDay(parseISO(occ.starts_at), day))
  }

  function openKiosk(occ: (typeof allOccurrences)[0]) {
    setKioskTarget({
      occurrence: {
        id: occ.id,
        starts_at: occ.starts_at,
        ends_at: occ.ends_at,
        event_title: occ.event_title,
        org_name: occ.org_name,
      },
    })
    setKioskOpen(true)
    logger.info('admin.event.scheduler.kiosk_opened', {
      occurrence_id: occ.id,
      event_id: occ.event_id,
    })
  }

  async function handleCreateEvent() {
    if (!createTitle.trim() || !createOrgId.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('assistance_events')
        .insert({
          title: createTitle.trim(),
          org_id: createOrgId.trim(),
          event_type: createEventType,
          location_name: createLocationName.trim() || null,
          rrule: createRrule,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single()

      if (error) {
        setCreateError(error.message)
        return
      }

      logger.info('admin.event.created', {
        event_id: data?.id,
        org_id: createOrgId,
        rrule: createRrule,
        event_type: createEventType,
      })

      setShowCreateModal(false)
      setCreateTitle('')
      setCreateEventType('distribution')
      setCreateLocationName('')
      setCreateRrule(null)
      await fetchEvents()
    } finally {
      setCreating(false)
    }
  }

  async function handleAddOccurrence() {
    if (!addOccurrenceEventId || !addStartsAt || !addEndsAt) return
    setAddingOccurrence(true)
    setAddOccurrenceError(null)
    try {
      const { data, error } = await supabase
        .from('event_occurrences')
        .insert({
          event_id: addOccurrenceEventId,
          starts_at: new Date(addStartsAt).toISOString(),
          ends_at: new Date(addEndsAt).toISOString(),
          status: 'upcoming',
        })
        .select('id')
        .single()

      if (error) {
        setAddOccurrenceError(error.message)
        return
      }

      logger.info('admin.occurrence.created', {
        occurrence_id: data?.id,
        event_id: addOccurrenceEventId,
        starts_at: addStartsAt,
      })

      setAddOccurrenceEventId(null)
      setAddStartsAt('')
      setAddEndsAt('')
      await fetchEvents()
    } finally {
      setAddingOccurrence(false)
    }
  }

  // Occurrence chip
  function OccurrenceChip({ occ }: { occ: (typeof allOccurrences)[0] }) {
    const colorClass = EVENT_TYPE_COLORS[occ.event_type] ?? EVENT_TYPE_COLORS.other
    const timeStr = format(parseISO(occ.starts_at), 'h:mm a')
    return (
      <div className={`rounded-lg border p-1.5 text-xs mb-1 ${colorClass}`}>
        <p className="font-medium leading-tight truncate">{occ.event_title}</p>
        <p className="opacity-70">{timeStr}</p>
        <button
          type="button"
          onClick={() => openKiosk(occ)}
          className="mt-1 w-full text-center text-[10px] font-semibold bg-white/60 hover:bg-white/90 rounded px-1 py-0.5 transition-colors"
        >
          Sign-In
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-stone-400">
        <span className="text-sm animate-pulse">Loading events…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#4a5d23]">Event Calendar</h2>
        <Button
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> New Event
        </Button>
      </div>

      {/* Week navigation — visible on md+ */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        {/* Nav bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
          <button
            type="button"
            onClick={() => setCurrentWeekStart((d) => subWeeks(d, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-stone-700">
            {format(currentWeekStart, 'MMM d')} – {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            type="button"
            onClick={() => setCurrentWeekStart((d) => addWeeks(d, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 8-column grid: time label + 7 days */}
        <div className="grid grid-cols-8 divide-x divide-stone-100">
          {/* Day headers */}
          <div className="col-span-1" /> {/* Empty time column header */}
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="py-2 px-2 text-center border-b border-stone-100">
              <p className="text-xs font-medium text-stone-500">{format(day, 'EEE')}</p>
              <p className={`text-sm font-bold mt-0.5 ${isSameDay(day, new Date()) ? 'text-lime-600' : 'text-stone-800'}`}>
                {format(day, 'd')}
              </p>
            </div>
          ))}

          {/* Time-range rows (simplified: one row per day, all-day style) */}
          <div className="col-span-1 py-2 px-2 text-xs text-stone-400 text-right">All</div>
          {weekDays.map((day) => {
            const occs = getOccurrencesForDay(day)
            return (
              <div key={day.toISOString()} className="min-h-[100px] p-1 align-top">
                {occs.map((occ) => (
                  <OccurrenceChip key={occ.id} occ={occ} />
                ))}
                {/* Add occurrence quick button */}
                <button
                  type="button"
                  title="Add occurrence"
                  onClick={() => {
                    const dateStr = format(day, "yyyy-MM-dd'T'09:00")
                    setAddStartsAt(dateStr)
                    setAddEndsAt(format(day, "yyyy-MM-dd'T'11:00"))
                    if (events.length > 0) {
                      setAddOccurrenceEventId(events[0].id)
                    }
                  }}
                  className="w-full text-center text-xs text-stone-300 hover:text-lime-600 hover:bg-lime-50 rounded py-1 transition-colors"
                >
                  +
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day view — visible on mobile (<md) */}
      <div className="block md:hidden bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <button
            type="button"
            onClick={() => setSelectedDay((d) => addDays(d, -1))}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-xs text-stone-500">{format(selectedDay, 'EEEE')}</p>
            <p className={`text-lg font-bold ${isSameDay(selectedDay, new Date()) ? 'text-lime-600' : 'text-stone-800'}`}>
              {format(selectedDay, 'MMM d, yyyy')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDay((d) => addDays(d, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 min-h-[120px] space-y-2">
          {getOccurrencesForDay(selectedDay).length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">No events today</p>
          ) : (
            getOccurrencesForDay(selectedDay).map((occ) => {
              const colorClass = EVENT_TYPE_COLORS[occ.event_type] ?? EVENT_TYPE_COLORS.other
              return (
                <div key={occ.id} className={`rounded-xl border p-3 ${colorClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{occ.event_title}</p>
                      <p className="text-xs opacity-70">
                        {format(parseISO(occ.starts_at), 'h:mm a')} – {format(parseISO(occ.ends_at), 'h:mm a')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openKiosk(occ)}
                      className="shrink-0 rounded-lg bg-white/60 hover:bg-white/90 px-3 py-1.5 text-xs font-semibold transition-colors"
                    >
                      Sign-In
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Events list with add-occurrence shortcut */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">All Events ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-stone-400">No events yet. Create one above.</p>
        ) : (
          <div className="divide-y divide-stone-50">
            {events.map((event) => (
              <div key={event.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">{event.title}</p>
                  <p className="text-xs text-stone-400">{event.event_type} · {event.org?.name ?? ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddOccurrenceEventId(event.id)
                    const today = format(new Date(), "yyyy-MM-dd'T'09:00")
                    const todayEnd = format(new Date(), "yyyy-MM-dd'T'11:00")
                    setAddStartsAt(today)
                    setAddEndsAt(todayEnd)
                  }}
                  className="shrink-0 text-xs text-[#4a5d23] hover:underline font-medium"
                >
                  + Occurrence
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Create Event</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Title</Label>
                <Input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Event title"
                  className="text-stone-900 placeholder:text-stone-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Event type</Label>
                <Select value={createEventType} onValueChange={setCreateEventType}>
                  <SelectTrigger className="text-stone-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distribution">Distribution</SelectItem>
                    <SelectItem value="meal">Meal</SelectItem>
                    <SelectItem value="pantry">Pantry</SelectItem>
                    <SelectItem value="clinic">Clinic</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Location name</Label>
                <Input
                  value={createLocationName}
                  onChange={(e) => setCreateLocationName(e.target.value)}
                  placeholder="Community Center, Church Hall…"
                  className="text-stone-900 placeholder:text-stone-400"
                />
              </div>

              {selectedOrgId === 'all' && (
                <div className="space-y-1.5">
                  <Label className="text-stone-700 text-sm">Organization ID</Label>
                  <Input
                    value={createOrgId}
                    onChange={(e) => setCreateOrgId(e.target.value)}
                    placeholder="Paste org UUID"
                    className="text-stone-900 placeholder:text-stone-400 font-mono text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Recurrence</Label>
                <RecurrencePicker value={createRrule} onChange={setCreateRrule} />
              </div>

              {createError && <p className="text-red-600 text-sm">{createError}</p>}

              <Button
                onClick={handleCreateEvent}
                disabled={creating || !createTitle.trim() || !createOrgId.trim()}
                className="w-full bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
              >
                {creating ? 'Creating…' : 'Create Event'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Occurrence Modal */}
      {addOccurrenceEventId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Add Occurrence</h3>
              <button
                type="button"
                onClick={() => setAddOccurrenceEventId(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {events.length > 1 && (
              <div className="px-5 pt-4">
                <Label className="text-stone-700 text-sm">Event</Label>
                <Select
                  value={addOccurrenceEventId}
                  onValueChange={setAddOccurrenceEventId}
                >
                  <SelectTrigger className="text-stone-900 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-stone-700 text-sm">Starts at</Label>
                  <input
                    type="datetime-local"
                    value={addStartsAt}
                    onChange={(e) => setAddStartsAt(e.target.value)}
                    className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-stone-700 text-sm">Ends at</Label>
                  <input
                    type="datetime-local"
                    value={addEndsAt}
                    onChange={(e) => setAddEndsAt(e.target.value)}
                    className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 bg-white"
                  />
                </div>
              </div>

              {addOccurrenceError && <p className="text-red-600 text-sm">{addOccurrenceError}</p>}

              <Button
                onClick={handleAddOccurrence}
                disabled={addingOccurrence || !addStartsAt || !addEndsAt}
                className="w-full bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
              >
                {addingOccurrence ? 'Adding…' : 'Add Occurrence'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Organizer kiosk */}
      {kioskTarget && (
        <OrganizerCheckinDisplay
          occurrence={kioskTarget.occurrence}
          open={kioskOpen}
          onOpenChange={(open) => {
            setKioskOpen(open)
            if (!open) setKioskTarget(null)
          }}
        />
      )}
    </div>
  )
}
