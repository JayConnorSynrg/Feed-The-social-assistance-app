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
import { AddressAutocomplete } from './address-autocomplete'
import { useAdminOrgs } from './use-admin-orgs'
import { resolveGeoPointV6, type GeocodeMatch, type AddressSuggestion } from '@/lib/mapbox-geocode-v6'
import { PRECISE_GEOCODE_TIERS } from '@/lib/geocode-accuracy'
import { formatRatePct } from '@/lib/event-checkin'

interface AssistanceEvent {
  id: string
  title: string
  event_type: string
  description: string | null
  location_name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
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

interface AttendanceView {
  occurrence: { id: string; event_title: string; starts_at: string }
  data: {
    early: number
    confirmed: number
    no_show: number
    anonymous_confirmed: number
    people_confirmed: number
    show_rate: number | null
    ended: boolean
    attendees: Array<{ user_id: string; name: string; status: string; household_size: number; attendance_rate: number | null }>
  } | null
  loading: boolean
  error: string | null
}

export function EventScheduler({ selectedOrgId }: Props) {
  const supabase = createClient()
  const { orgs: adminOrgs } = useAdminOrgs()

  const [events, setEvents] = useState<AssistanceEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Attendance view (per occurrence)
  const [attendance, setAttendance] = useState<AttendanceView | null>(null)

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
  const [createInfo, setCreateInfo] = useState<string | null>(null)
  // Address + geocode (reuses the resource-edit Mapbox v6 path; strong-match-only gate)
  const [createAddress, setCreateAddress] = useState('')
  const [createCity, setCreateCity] = useState('')
  const [createState, setCreateState] = useState('')
  const [createZip, setCreateZip] = useState('')
  const [selectedMatch, setSelectedMatch] = useState<GeocodeMatch | null>(null)

  // Add occurrence modal
  const [addOccurrenceEventId, setAddOccurrenceEventId] = useState<string | null>(null)
  const [addStartsAt, setAddStartsAt] = useState('')
  const [addEndsAt, setAddEndsAt] = useState('')
  const [addingOccurrence, setAddingOccurrence] = useState(false)
  const [addOccurrenceError, setAddOccurrenceError] = useState<string | null>(null)

  // Edit event modal state (wires admin_update_event; re-geocodes when the address changes)
  const [editEventId, setEditEventId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editEventType, setEditEventType] = useState('distribution')
  const [editLocationName, setEditLocationName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editZip, setEditZip] = useState('')
  const [editOriginalAddress, setEditOriginalAddress] = useState('')
  const [editSelectedMatch, setEditSelectedMatch] = useState<GeocodeMatch | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editInfo, setEditInfo] = useState<string | null>(null)

  function openEditEvent(ev: AssistanceEvent) {
    setEditEventId(ev.id)
    setEditTitle(ev.title)
    setEditEventType(ev.event_type)
    setEditLocationName(ev.location_name ?? '')
    setEditAddress(ev.address ?? '')
    setEditCity(ev.city ?? '')
    setEditState(ev.state ?? '')
    setEditZip(ev.zip_code ?? '')
    setEditOriginalAddress([ev.address, ev.city, ev.state, ev.zip_code].filter(Boolean).join(', '))
    setEditSelectedMatch(null)
    setEditError(null)
    setEditInfo(null)
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const query = supabase
      .from('assistance_events')
      .select('id, title, event_type, description, location_name, address, city, state, zip_code, org_id, rrule, is_active, org:organizations(name), occurrences:event_occurrences(id, event_id, starts_at, ends_at, status, capacity, notes)')
      .eq('is_active', true)

    if (selectedOrgId !== 'all') {
      query.eq('org_id', selectedOrgId)
    } else {
      // M4: the "All Organizations" default must not leak other orgs' events. A non-platform
      // org admin's adminOrgs are exactly the orgs they administer; a platform admin's
      // adminOrgs are all active orgs, so this filter is a no-op for them (unchanged).
      query.in('org_id', adminOrgs.map((o) => o.id))
    }

    const { data } = await query
    setEvents((data as AssistanceEvent[]) ?? [])
    setLoading(false)
  }, [supabase, selectedOrgId, adminOrgs])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Sync createOrgId when selectedOrgId changes
  useEffect(() => {
    if (selectedOrgId !== 'all') {
      setCreateOrgId(selectedOrgId)
    }
  }, [selectedOrgId])

  // Collect all occurrences with event info. Include ended (completed / past) occurrences —
  // not just upcoming — so the organizer can reach Attendance for events that already ran.
  // Cancelled occurrences are excluded (no attendance to review).
  const allOccurrences = events.flatMap((event) =>
    (event.occurrences ?? [])
      .filter((occ) => occ.status !== 'cancelled')
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
    setCreateInfo(null)
    try {
      // Resolve a geocode for the address. Prefer the classified match from a chosen
      // autocomplete suggestion; else forward-geocode the typed address on save. The
      // server writes a location ONLY for a strong (precise-tier) match (I5).
      let match: GeocodeMatch | null = selectedMatch
      const fullAddress = [createAddress, createCity, createState, createZip].filter(Boolean).join(', ')
      if (!match && createAddress.trim()) {
        match = await resolveGeoPointV6(fullAddress, process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
      }
      const isStrong = !!match && PRECISE_GEOCODE_TIERS.has(match.accuracy)

      const { data, error } = await supabase.rpc('admin_create_event', {
        p_org_id: createOrgId.trim(),
        p_title: createTitle.trim(),
        p_event_type: createEventType,
        p_location_name: createLocationName.trim() || undefined,
        p_address: createAddress.trim() || undefined,
        p_city: createCity.trim() || undefined,
        p_state: createState.trim() || undefined,
        p_zip_code: createZip.trim() || undefined,
        p_rrule: createRrule ?? undefined,
        p_requires_registration: false,
        p_lat: match?.lat,
        p_lng: match?.lng,
        p_geocode_accuracy: match?.accuracy,
        p_geocode_confidence: match?.confidence,
      })

      if (error) {
        setCreateError(error.message)
        return
      }

      logger.info('admin.event.created', {
        event_id: typeof data === 'string' ? data : null,
        org_id: createOrgId,
        rrule: createRrule,
        event_type: createEventType,
        geocode_accuracy: match?.accuracy ?? 'none',
      })

      // Surface the geocode outcome so the organizer knows whether the venue is mapped.
      if (createAddress.trim()) {
        setCreateInfo(isStrong
          ? `Event created and located on the map (${match!.accuracy}).`
          : 'Event created. The address did not resolve precisely, so it will show as an unknown location until edited.')
      }

      setShowCreateModal(false)
      setCreateTitle('')
      setCreateEventType('distribution')
      setCreateLocationName('')
      setCreateRrule(null)
      setCreateAddress('')
      setCreateCity('')
      setCreateState('')
      setCreateZip('')
      setSelectedMatch(null)
      await fetchEvents()
    } finally {
      setCreating(false)
    }
  }

  function applySuggestion(s: AddressSuggestion) {
    setCreateAddress(s.address_line1 || s.label)
    if (s.city) setCreateCity(s.city)
    if (s.state) setCreateState(s.state)
    if (s.zip) setCreateZip(s.zip)
    setSelectedMatch(s.match)
  }

  // F5: an occurrence with check-ins can never be DELETED (the DB guard refuses); cancelling
  // is the correct action — it preserves the attendance history and drops the occurrence from
  // the member feed + active accounting. We expose Cancel (never Delete) so the UI can only
  // reach the allowed path. Cancellation is always permitted, even once people have checked in.
  async function handleCancelOccurrence(occ: { id: string; event_title: string }) {
    if (!confirm(`Cancel this occurrence of "${occ.event_title}"? It will be removed from the schedule and members will no longer see it. Attendance already recorded is kept.`)) return
    const { error } = await supabase
      .from('event_occurrences')
      .update({ status: 'cancelled' })
      .eq('id', occ.id)
    if (error) {
      logger.error('admin.occurrence.cancel_failed', { occurrence_id: occ.id, error: error.message })
      alert(error.message)
      return
    }
    logger.info('admin.occurrence.cancelled', { occurrence_id: occ.id })
    await fetchEvents()
  }

  async function openAttendance(occ: { id: string; event_title: string; starts_at: string }) {
    setAttendance({ occurrence: occ, data: null, loading: true, error: null })
    const { data, error } = await supabase.rpc('event_attendance', { p_occurrence: occ.id })
    if (error) {
      setAttendance({ occurrence: occ, data: null, loading: false, error: error.message })
    } else {
      setAttendance({ occurrence: occ, data: (data as AttendanceView['data']) ?? null, loading: false, error: null })
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

  async function handleEditEvent() {
    if (!editEventId || !editTitle.trim()) return
    setSavingEdit(true)
    setEditError(null)
    setEditInfo(null)
    try {
      const fullAddress = [editAddress, editCity, editState, editZip].filter(Boolean).join(', ')
      const addressChanged = fullAddress !== editOriginalAddress
      // Re-geocode only when the address actually changed. The server writes location ONLY
      // from a strong (precise-tier) match (I5); a weak/failed re-geocode clears location
      // and tags 'approximate'.
      let match: GeocodeMatch | null = editSelectedMatch
      if (addressChanged && !match && editAddress.trim()) {
        match = await resolveGeoPointV6(fullAddress, process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
      }
      const isStrong = !!match && PRECISE_GEOCODE_TIERS.has(match.accuracy)

      // Explicit-clear semantics: a blanked optional text field is nulled via p_clear (a
      // NULL argument alone would only be COALESCE'd back to the stored value). Clearing an
      // already-empty field is a harmless no-op.
      const clear: string[] = []
      if (!editLocationName.trim()) clear.push('location_name')
      if (!editAddress.trim()) clear.push('address')
      if (!editCity.trim()) clear.push('city')
      if (!editState.trim()) clear.push('state')
      if (!editZip.trim()) clear.push('zip_code')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('admin_update_event', {
        p_event_id: editEventId,
        p_title: editTitle.trim(),
        p_event_type: editEventType,
        p_location_name: editLocationName.trim() || undefined,
        p_address: editAddress.trim() || undefined,
        p_city: editCity.trim() || undefined,
        p_state: editState.trim() || undefined,
        p_zip_code: editZip.trim() || undefined,
        p_lat: addressChanged ? match?.lat : undefined,
        p_lng: addressChanged ? match?.lng : undefined,
        p_geocode_accuracy: addressChanged ? match?.accuracy : undefined,
        p_geocode_confidence: addressChanged ? match?.confidence : undefined,
        p_regeocode: addressChanged,
        p_clear: clear,
      })

      if (error) {
        setEditError(error.message)
        return
      }

      logger.info('admin.event.updated', {
        event_id: editEventId,
        regeocode: addressChanged,
        geocode_accuracy: addressChanged ? (match?.accuracy ?? 'none') : 'unchanged',
      })

      if (addressChanged) {
        setEditInfo(isStrong
          ? `Saved and re-located on the map (${match!.accuracy}).`
          : 'Saved. The new address did not resolve precisely, so it will show as an unknown location until edited.')
      }

      setEditEventId(null)
      await fetchEvents()
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleRetireEvent() {
    if (!editEventId) return
    // Retire = set is_active=false. The event drops off the member feed and the scheduler
    // default; occurrences with check-ins keep their history. Reversible from the DB.
    if (!confirm('Retire this event? It will no longer appear to members or in the scheduler.')) return
    setSavingEdit(true)
    setEditError(null)
    setEditInfo(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('admin_update_event', {
        p_event_id: editEventId,
        p_is_active: false,
      })
      if (error) {
        setEditError(error.message)
        return
      }
      logger.info('admin.event.retired', { event_id: editEventId })
      setEditEventId(null)
      await fetchEvents()
    } finally {
      setSavingEdit(false)
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
        <button
          type="button"
          onClick={() => openAttendance({ id: occ.id, event_title: occ.event_title, starts_at: occ.starts_at })}
          className="mt-1 w-full text-center text-[10px] font-semibold bg-white/40 hover:bg-white/80 rounded px-1 py-0.5 transition-colors"
        >
          Attendance
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
                    <div className="shrink-0 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => openKiosk(occ)}
                        className="rounded-lg bg-white/60 hover:bg-white/90 px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        Sign-In
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttendance({ id: occ.id, event_title: occ.event_title, starts_at: occ.starts_at })}
                        className="rounded-lg bg-white/40 hover:bg-white/80 px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        Attendance
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelOccurrence({ id: occ.id, event_title: occ.event_title })}
                        className="rounded-lg bg-white/30 hover:bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
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
                <div className="shrink-0 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEditEvent(event)}
                    className="text-xs text-stone-500 hover:text-[#4a5d23] hover:underline font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddOccurrenceEventId(event.id)
                      const today = format(new Date(), "yyyy-MM-dd'T'09:00")
                      const todayEnd = format(new Date(), "yyyy-MM-dd'T'11:00")
                      setAddStartsAt(today)
                      setAddEndsAt(todayEnd)
                    }}
                    className="text-xs text-[#4a5d23] hover:underline font-medium"
                  >
                    + Occurrence
                  </button>
                </div>
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

              {/* Address — autocompleted + geocoded on save (strong-match-only) */}
              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Address</Label>
                <AddressAutocomplete
                  value={createAddress}
                  onChange={(v) => { setCreateAddress(v); setSelectedMatch(null) }}
                  onSelect={applySuggestion}
                />
              </div>
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-stone-700 text-sm">City</Label>
                  <Input value={createCity} onChange={(e) => setCreateCity(e.target.value)} className="text-stone-900" />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-stone-700 text-sm">State</Label>
                  <Input value={createState} onChange={(e) => setCreateState(e.target.value)} className="text-stone-900" maxLength={2} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-stone-700 text-sm">ZIP</Label>
                  <Input value={createZip} onChange={(e) => setCreateZip(e.target.value)} className="text-stone-900" />
                </div>
              </div>

              {selectedOrgId === 'all' && (
                <div className="space-y-1.5">
                  <Label className="text-stone-700 text-sm">Organization</Label>
                  <Select value={createOrgId} onValueChange={setCreateOrgId}>
                    <SelectTrigger className="text-stone-900">
                      <SelectValue placeholder="Select an organization you manage" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminOrgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Recurrence</Label>
                <RecurrencePicker value={createRrule} onChange={setCreateRrule} />
              </div>

              {createError && <p className="text-red-600 text-sm">{createError}</p>}
              {createInfo && <p className="text-lime-700 text-sm">{createInfo}</p>}

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

      {/* Edit Event Modal — wires admin_update_event (re-geocodes on address change) */}
      {editEventId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white">
              <h3 className="font-bold text-stone-800">Edit Event</h3>
              <button
                type="button"
                onClick={() => setEditEventId(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Event title"
                  className="text-stone-900 placeholder:text-stone-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Event type</Label>
                <Select value={editEventType} onValueChange={setEditEventType}>
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
                  value={editLocationName}
                  onChange={(e) => setEditLocationName(e.target.value)}
                  placeholder="Community Center, Church Hall…"
                  className="text-stone-900 placeholder:text-stone-400"
                />
              </div>

              {/* Address — editing it re-geocodes on save (strong-match-only) */}
              <div className="space-y-1.5">
                <Label className="text-stone-700 text-sm">Address</Label>
                <AddressAutocomplete
                  value={editAddress}
                  onChange={(v) => { setEditAddress(v); setEditSelectedMatch(null) }}
                  onSelect={(s) => {
                    setEditAddress(s.address_line1 || s.label)
                    if (s.city) setEditCity(s.city)
                    if (s.state) setEditState(s.state)
                    if (s.zip) setEditZip(s.zip)
                    setEditSelectedMatch(s.match)
                  }}
                />
              </div>
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-stone-700 text-sm">City</Label>
                  <Input value={editCity} onChange={(e) => { setEditCity(e.target.value); setEditSelectedMatch(null) }} className="text-stone-900" />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-stone-700 text-sm">State</Label>
                  <Input value={editState} onChange={(e) => { setEditState(e.target.value); setEditSelectedMatch(null) }} className="text-stone-900" maxLength={2} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-stone-700 text-sm">ZIP</Label>
                  <Input value={editZip} onChange={(e) => { setEditZip(e.target.value); setEditSelectedMatch(null) }} className="text-stone-900" />
                </div>
              </div>

              {editError && <p className="text-red-600 text-sm">{editError}</p>}
              {editInfo && <p className="text-lime-700 text-sm">{editInfo}</p>}

              <Button
                onClick={handleEditEvent}
                disabled={savingEdit || !editTitle.trim()}
                className="w-full bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </Button>
              <button
                type="button"
                onClick={handleRetireEvent}
                disabled={savingEdit}
                className="w-full text-sm font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 py-1"
              >
                Retire event
              </button>
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

      {/* Attendance view (per occurrence) */}
      {attendance && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setAttendance(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-stone-800">Attendance</h3>
                <p className="text-xs text-stone-400">{attendance.occurrence.event_title} · {format(parseISO(attendance.occurrence.starts_at), 'MMM d, h:mm a')}</p>
              </div>
              <button type="button" onClick={() => setAttendance(null)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {attendance.loading ? (
                <p className="text-sm text-stone-400">Loading attendance…</p>
              ) : attendance.error ? (
                <p className="text-sm text-red-600">{attendance.error}</p>
              ) : !attendance.data ? (
                <p className="text-sm text-stone-500">You do not have access to this event&rsquo;s attendance.</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                      <p className="text-lg font-bold text-stone-800">{attendance.data.confirmed}</p>
                      <p className="text-[10px] text-stone-500 uppercase">Confirmed</p>
                    </div>
                    <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                      <p className="text-lg font-bold text-stone-800">{attendance.data.early}</p>
                      <p className="text-[10px] text-stone-500 uppercase">Early</p>
                    </div>
                    <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                      <p className="text-lg font-bold text-stone-800">{attendance.data.no_show}</p>
                      <p className="text-[10px] text-stone-500 uppercase">No-show</p>
                    </div>
                    <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                      <p className="text-lg font-bold text-[#4a5d23]">{formatRatePct(attendance.data.show_rate)}</p>
                      <p className="text-[10px] text-stone-500 uppercase">Show rate</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 mb-2">
                    {attendance.data.people_confirmed} people confirmed · {attendance.data.anonymous_confirmed} anonymous
                    {attendance.data.ended ? '' : ' · in progress'}
                  </p>
                  {attendance.data.attendees.length === 0 ? (
                    <p className="text-sm text-stone-400">No identified check-ins yet.</p>
                  ) : (
                    <div className="divide-y divide-stone-50">
                      {attendance.data.attendees.map((att) => (
                        <div key={att.user_id} className="py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-stone-800 truncate">{att.name}</p>
                            <p className="text-xs text-stone-400">Household {att.household_size}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${att.status === 'confirmed' ? 'bg-lime-100 text-lime-800' : 'bg-stone-100 text-stone-500'}`}>
                              {att.status === 'confirmed' ? 'Attended' : 'Early'}
                            </span>
                            <span className="text-xs text-stone-500 w-10 text-right">{formatRatePct(att.attendance_rate)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
