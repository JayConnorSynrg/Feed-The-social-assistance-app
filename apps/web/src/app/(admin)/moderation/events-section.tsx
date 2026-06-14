'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type EventType = 'distribution' | 'meal' | 'pantry' | 'clinic' | 'other'
type OccurrenceStatus = 'upcoming' | 'cancelled' | 'completed'

interface AssistanceEvent {
  id: string
  title: string
  event_type: string
  location_name: string | null
  address: string | null
  rrule: string | null
  is_active: boolean
  requires_registration: boolean
  org: { name: string } | null
}

interface EventOccurrence {
  id: string
  event_id: string
  starts_at: string
  ends_at: string
  capacity: number | null
  notes: string | null
  status: string
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  distribution: 'Distribution',
  meal: 'Meal',
  pantry: 'Pantry',
  clinic: 'Clinic',
  other: 'Other',
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  distribution: 'text-[#4a5d23] border-[#4a5d23]/30',
  meal: 'text-orange-700 border-orange-300',
  pantry: 'text-amber-700 border-amber-300',
  clinic: 'text-sky-700 border-sky-300',
  other: 'text-stone-600 border-stone-300',
}

export function EventsSection() {
  const supabase = createClient()

  const [events, setEvents] = useState<AssistanceEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([])
  const [loadingOccurrences, setLoadingOccurrences] = useState(false)

  // Create event form
  const [createTitle, setCreateTitle] = useState('')
  const [createOrgId, setCreateOrgId] = useState('')
  const [createEventType, setCreateEventType] = useState<EventType>('distribution')
  const [createLocationName, setCreateLocationName] = useState('')
  const [createAddress, setCreateAddress] = useState('')
  const [createRrule, setCreateRrule] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Add occurrence form
  const [addStartsAt, setAddStartsAt] = useState('')
  const [addEndsAt, setAddEndsAt] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addCapacity, setAddCapacity] = useState('')
  const [addingOccurrence, setAddingOccurrence] = useState(false)
  const [addOccurrenceError, setAddOccurrenceError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    const { data } = await supabase
      .from('assistance_events')
      .select('id, title, event_type, location_name, address, rrule, is_active, requires_registration, org:organizations(name)')
      .order('created_at', { ascending: false })
    setEvents((data as AssistanceEvent[]) ?? [])
    setLoadingEvents(false)
  }, [supabase])

  const fetchOccurrences = useCallback(async (eventId: string) => {
    setLoadingOccurrences(true)
    const { data } = await supabase
      .from('event_occurrences')
      .select('id, event_id, starts_at, ends_at, capacity, notes, status')
      .eq('event_id', eventId)
      .eq('status', 'upcoming')
      .order('starts_at', { ascending: true })
    setOccurrences((data as EventOccurrence[]) ?? [])
    setLoadingOccurrences(false)
  }, [supabase])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleSelectEvent = useCallback((eventId: string) => {
    if (selectedEventId === eventId) {
      setSelectedEventId(null)
      setOccurrences([])
    } else {
      setSelectedEventId(eventId)
      fetchOccurrences(eventId)
    }
  }, [selectedEventId, fetchOccurrences])

  const handleCreateEvent = useCallback(async () => {
    if (!createTitle.trim() || !createOrgId.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('assistance_events')
        .insert({
          title: createTitle.trim(),
          org_id: createOrgId.trim(),
          event_type: createEventType,
          location_name: createLocationName.trim() || null,
          address: createAddress.trim() || null,
          rrule: createRrule.trim() || null,
          created_by: user?.id ?? null,
        })
      if (error) {
        setCreateError(error.message)
      } else {
        setCreateTitle('')
        setCreateOrgId('')
        setCreateEventType('distribution')
        setCreateLocationName('')
        setCreateAddress('')
        setCreateRrule('')
        await fetchEvents()
      }
    } finally {
      setCreating(false)
    }
  }, [supabase, createTitle, createOrgId, createEventType, createLocationName, createAddress, createRrule, fetchEvents])

  const handleAddOccurrence = useCallback(async () => {
    if (!selectedEventId || !addStartsAt || !addEndsAt) return
    setAddingOccurrence(true)
    setAddOccurrenceError(null)
    try {
      const { error } = await supabase
        .from('event_occurrences')
        .insert({
          event_id: selectedEventId,
          starts_at: new Date(addStartsAt).toISOString(),
          ends_at: new Date(addEndsAt).toISOString(),
          notes: addNotes.trim() || null,
          capacity: addCapacity ? parseInt(addCapacity, 10) : null,
          status: 'upcoming' as OccurrenceStatus,
        })
      if (error) {
        setAddOccurrenceError(error.message)
      } else {
        setAddStartsAt('')
        setAddEndsAt('')
        setAddNotes('')
        setAddCapacity('')
        await fetchOccurrences(selectedEventId)
      }
    } finally {
      setAddingOccurrence(false)
    }
  }, [supabase, selectedEventId, addStartsAt, addEndsAt, addNotes, addCapacity, fetchOccurrences])

  const handleCancelOccurrence = useCallback(async (occurrenceId: string) => {
    const { error } = await supabase
      .from('event_occurrences')
      .update({ status: 'cancelled' as OccurrenceStatus })
      .eq('id', occurrenceId)
    if (!error && selectedEventId) {
      await fetchOccurrences(selectedEventId)
    }
  }, [supabase, selectedEventId, fetchOccurrences])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#4a5d23]">Events</h2>
        <p className="text-stone-600 mt-1 text-sm">
          Manage assistance events and their scheduled occurrences.
        </p>
      </div>

      {/* Create event form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-stone-100 mb-6">
        <h3 className="text-base font-semibold text-[#4a5d23] mb-4">Create Event</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-title" className="text-stone-700 text-sm">Title</Label>
            <Input
              id="event-title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Event title"
              className="text-stone-900 placeholder:text-stone-400"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-org-id" className="text-stone-700 text-sm">Organization ID (UUID)</Label>
            <Input
              id="event-org-id"
              value={createOrgId}
              onChange={(e) => setCreateOrgId(e.target.value)}
              placeholder="Paste org UUID from Organizations above"
              className="text-stone-900 placeholder:text-stone-400 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-type" className="text-stone-700 text-sm">Type</Label>
            <Select value={createEventType} onValueChange={(v) => setCreateEventType(v as EventType)}>
              <SelectTrigger id="event-type" className="text-stone-900">
                <SelectValue placeholder="Select type" />
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
            <Label htmlFor="event-location" className="text-stone-700 text-sm">Location Name</Label>
            <Input
              id="event-location"
              value={createLocationName}
              onChange={(e) => setCreateLocationName(e.target.value)}
              placeholder="Community Center, Church Hall…"
              className="text-stone-900 placeholder:text-stone-400"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-address" className="text-stone-700 text-sm">Address</Label>
            <Input
              id="event-address"
              value={createAddress}
              onChange={(e) => setCreateAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              className="text-stone-900 placeholder:text-stone-400"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-rrule" className="text-stone-700 text-sm">Recurrence (RRULE)</Label>
            <Input
              id="event-rrule"
              value={createRrule}
              onChange={(e) => setCreateRrule(e.target.value)}
              placeholder="FREQ=WEEKLY;BYDAY=SA;COUNT=10"
              className="text-stone-900 placeholder:text-stone-400 font-mono text-sm"
            />
          </div>
        </div>
        {createError && (
          <p className="text-red-600 text-sm mt-2">{createError}</p>
        )}
        <Button
          onClick={handleCreateEvent}
          disabled={creating || !createTitle.trim() || !createOrgId.trim()}
          className="mt-4 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
        >
          {creating ? 'Creating…' : 'Create Event'}
        </Button>
      </div>

      {/* Event list */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-stone-100">
        <h3 className="text-base font-semibold text-[#4a5d23] mb-4">
          Events {!loadingEvents && `(${events.length})`}
        </h3>

        {loadingEvents ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-stone-500 text-sm">No events yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {events.map((event) => (
              <div key={event.id}>
                {/* Event row */}
                <button
                  onClick={() => handleSelectEvent(event.id)}
                  className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-stone-50 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-stone-800">{event.title}</span>
                    <Badge variant="outline" className={`text-xs ${EVENT_TYPE_COLORS[event.event_type] ?? 'text-stone-600 border-stone-300'}`}>
                      {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                    </Badge>
                    {event.org && (
                      <span className="text-xs text-stone-500">{event.org.name}</span>
                    )}
                    {event.location_name && (
                      <span className="text-xs text-stone-400">{event.location_name}</span>
                    )}
                    {!event.is_active && (
                      <Badge variant="outline" className="text-xs text-stone-500 border-stone-300">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <span className="text-stone-400 text-xs ml-2">{selectedEventId === event.id ? '▲' : '▼'}</span>
                </button>

                {/* Expanded occurrences panel */}
                {selectedEventId === event.id && (
                  <div className="pb-4 px-2">
                    {/* Add occurrence form */}
                    <div className="bg-stone-50 rounded-xl p-4 mb-4 border border-stone-100">
                      <p className="text-sm font-medium text-stone-700 mb-3">Add one-off occurrence</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-stone-600 text-xs">Starts at</Label>
                          <input
                            type="datetime-local"
                            value={addStartsAt}
                            onChange={(e) => setAddStartsAt(e.target.value)}
                            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-stone-600 text-xs">Ends at</Label>
                          <input
                            type="datetime-local"
                            value={addEndsAt}
                            onChange={(e) => setAddEndsAt(e.target.value)}
                            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-stone-600 text-xs">Capacity (optional)</Label>
                          <input
                            type="number"
                            value={addCapacity}
                            onChange={(e) => setAddCapacity(e.target.value)}
                            placeholder="e.g. 100"
                            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 bg-white placeholder:text-stone-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-stone-600 text-xs">Notes (optional)</Label>
                          <Textarea
                            value={addNotes}
                            onChange={(e) => setAddNotes(e.target.value)}
                            placeholder="Special instructions…"
                            rows={1}
                            className="text-stone-900 placeholder:text-stone-400 resize-none text-sm"
                          />
                        </div>
                      </div>
                      {addOccurrenceError && (
                        <p className="text-red-600 text-xs mt-2">{addOccurrenceError}</p>
                      )}
                      <Button
                        onClick={handleAddOccurrence}
                        disabled={addingOccurrence || !addStartsAt || !addEndsAt}
                        size="sm"
                        className="mt-3 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                      >
                        {addingOccurrence ? 'Adding…' : 'Add Occurrence'}
                      </Button>
                    </div>

                    {/* Occurrences list */}
                    {loadingOccurrences ? (
                      <p className="text-stone-500 text-sm">Loading occurrences…</p>
                    ) : occurrences.length === 0 ? (
                      <p className="text-stone-500 text-sm">No upcoming occurrences.</p>
                    ) : (
                      <div className="rounded-lg border border-stone-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-stone-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Starts</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Ends</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Capacity</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Notes</th>
                              <th className="px-3 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {occurrences.map((occ) => (
                              <tr key={occ.id} className="hover:bg-stone-50">
                                <td className="px-3 py-2 text-stone-700 text-xs">
                                  {new Date(occ.starts_at).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-stone-700 text-xs">
                                  {new Date(occ.ends_at).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-stone-500 text-xs">
                                  {occ.capacity ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-stone-500 text-xs max-w-[160px] truncate">
                                  {occ.notes ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => handleCancelOccurrence(occ.id)}
                                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
