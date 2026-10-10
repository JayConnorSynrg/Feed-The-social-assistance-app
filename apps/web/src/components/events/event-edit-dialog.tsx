'use client'

// apps/web/src/components/events/event-edit-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Edit an event's title, type, description, place name and location (keep / organization pin /
// confirmed address), its repeat pattern and end, the time every upcoming date takes, and when
// each date is posted to the feed — through admin_update_event, sending only what changed (no
// geocode tier, no time zone: the zone is fixed at create and shown read-only). Stopping a series
// (Repeat: does not repeat) asks first. Retire = the same RPC with p_is_active false after an
// inline confirmation: dates that have not started are cancelled, an in-progress date runs to its
// end. One RPC per save; a second click while a save is in flight is refused.

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type Ref } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'
import { EVENT_TYPES, eventFormT, eventTypeLabel, formatMessage } from '@/lib/i18n-event-forms'
import { venueDateKey, zoneLabel } from '@/lib/event-time'
import { updateEvent, type EventErrorField, type EventWriteSurface } from '@/lib/event-admin-rpc'
import {
  DEFAULT_ANNOUNCE_LEAD,
  isAnnounceLead,
  parseRecurrenceRule,
  recurrenceFormFromRule,
  recurrenceRuleFromForm,
  withRecurrenceStartDate,
} from '@/lib/event-recurrence'
import {
  EDIT_FIELD_ORDER,
  buildUpdateArgs,
  createSubmitController,
  firstErrorField,
  mintIdempotencyKey,
  sameDayTime,
  sameRule,
  seriesTimeFromStored,
  stopsRepeating,
  timeDraftFromInstants,
  type EditEventDraft,
  type EventTimeDraft,
  type FieldError,
  type FieldErrors,
} from '@/lib/event-form-model'
import {
  DANGER,
  EventDialog,
  FieldErrorText,
  INPUT,
  LABEL,
  PRIMARY,
  RequiredMark,
  SECONDARY,
  TimeFields,
  errorText,
  invalidProps,
  useOrgHasPin,
} from './event-form-ui'
import { EventLocationField } from './event-location-field'
import { LeadField, RepeatField, RepeatPreview, focusField } from './event-repeat-field'

export interface EditTarget {
  id: string
  org_id: string
  title: string
  event_type: string
  description: string | null
  location_name: string | null
  time_zone: string
  is_active: boolean
  /** assistance_events.recurrence / series_start_local / series_duration / announce_days_before. */
  recurrence: unknown
  series_start_local: string | null
  series_duration: string | null
  announce_days_before: number
  /** The next upcoming date, proposed as the first date when a one-off event starts repeating. */
  next: { starts_at: string; ends_at: string } | null
}

/** The edit form's starting state for an event: its stored rule, first date + times and lead. */
export function initialEditDraft(event: EditTarget, now: Date = new Date()): EditEventDraft {
  const rule = parseRecurrenceRule(event.recurrence)
  const proposed: EventTimeDraft = event.next
    ? timeDraftFromInstants(event.next.starts_at, event.next.ends_at, event.time_zone)
    : sameDayTime(venueDateKey(now.toISOString(), event.time_zone), '09:00', '11:00')
  const time = (rule && seriesTimeFromStored(event.series_start_local, event.series_duration)) || proposed
  const announce = isAnnounceLead(event.announce_days_before) ? event.announce_days_before : DEFAULT_ANNOUNCE_LEAD
  return {
    eventId: event.id,
    title: event.title,
    eventType: event.event_type,
    description: event.description ?? '',
    locationName: event.location_name ?? '',
    location: { source: 'keep' },
    timeZone: event.time_zone,
    recurrence: recurrenceFormFromRule(rule, time.date),
    time,
    announce,
    stored: { rule, time, announce },
  }
}

export function EventEditDialog({
  open,
  onOpenChange,
  locale,
  event,
  onSaved,
  onCloseAutoFocus,
  surface = 'admin',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  event: EditTarget
  onSaved: (action: 'update' | 'retire') => void
  onCloseAutoFocus?: (event: Event) => void
  /** Where the dialog was opened (the save's `surface` log label). */
  surface?: EventWriteSurface
}) {
  const supabase = useMemo(() => createClient(), [])
  const uid = useId()
  const [controller] = useState(() => createSubmitController(mintIdempotencyKey))
  const [draft, setDraft] = useState<EditEventDraft>(() => initialEditDraft(event))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<FieldError | null>(null)
  const [saving, setSaving] = useState<'update' | 'retire' | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const orgHasPin = useOrgHasPin(event.org_id)

  const formRef = useRef<HTMLFormElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const stopConfirmRef = useRef<HTMLButtonElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const retireConfirmRef = useRef<HTMLButtonElement>(null)
  const retireRef = useRef<HTMLButtonElement>(null)
  // Opening the confirmation focuses its Retire button; backing out returns to "Retire event".
  const retireToggled = useRef(false)
  useEffect(() => {
    if (!retireToggled.current) return
    if (confirmRetire) retireConfirmRef.current?.focus()
    else retireRef.current?.focus()
  }, [confirmRetire])
  const toggleRetire = (next: boolean) => {
    retireToggled.current = true
    setConfirmRetire(next)
  }

  const set = <K extends keyof EditEventDraft>(k: K, v: EditEventDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setTime = (time: EventTimeDraft) =>
    setDraft((d) => ({
      ...d,
      time,
      recurrence: time.date === d.time.date ? d.recurrence : withRecurrenceStartDate(d.recurrence, d.time.date, time.date),
    }))
  const repeating = draft.recurrence.repeat !== 'none'
  const built = recurrenceRuleFromForm(draft.recurrence, draft.time.date)
  const formRule = built.ok ? built.rule : null
  const seriesChanged =
    draft.stored.rule !== null &&
    repeating &&
    (!sameRule(formRule, draft.stored.rule) ||
      draft.time.date !== draft.stored.time.date ||
      draft.time.start !== draft.stored.time.start ||
      draft.time.endDate !== draft.stored.time.endDate ||
      draft.time.end !== draft.stored.time.end)

  const showErrors = (next: FieldErrors) => {
    setErrors(next)
    // Document order of THIS form: the repeat section comes before the first date's times.
    const first = firstErrorField(next, EDIT_FIELD_ORDER)
    if (!first) return
    const refs: Partial<Record<typeof first, { current: { focus: () => void } | null }>> = {
      title: titleRef,
      location: locationRef,
      date: dateRef,
      start: startRef,
      endDate: endDateRef,
      end: endRef,
    }
    const ref = refs[first]
    requestAnimationFrame(() => (ref ? ref.current?.focus() : focusField(formRef.current, first)))
  }

  async function run(action: 'update' | 'retire', stopConfirmed = false) {
    if (controller.inFlight) return
    let args
    if (action === 'retire') {
      args = { p_event_id: event.id, p_is_active: false }
    } else {
      const built = buildUpdateArgs(draft, orgHasPin === true)
      if (!built.ok) {
        setFormError(null)
        setConfirmStop(false)
        showErrors(built.errors)
        return
      }
      // Stopping a series removes its upcoming dates: confirm first.
      if (stopsRepeating(draft) && !stopConfirmed) {
        setConfirmStop(true)
        requestAnimationFrame(() => stopConfirmRef.current?.focus())
        return
      }
      args = built.args
    }
    setErrors({})
    setFormError(null)
    setSaving(action)
    const outcome = await controller.submit(() => updateEvent(supabase, { orgId: event.org_id, action, args, surface }))
    setSaving(null)
    if (outcome.status === 'busy') return
    const r = outcome.result
    if (r.ok) {
      onSaved(action)
      onOpenChange(false)
      return
    }
    setConfirmRetire(false)
    setConfirmStop(false)
    const placed = placeSaveError(r.field)
    if (placed) {
      const time = r.localTime?.split(' ')[1]
      showErrors({ [placed]: { key: r.errorKey, vars: time ? { time } : undefined } })
    } else {
      setFormError({ key: r.errorKey })
    }
    if (focusAfterFailedSave(placed, stopConfirmed) === 'submit') requestAnimationFrame(() => submitRef.current?.focus())
  }

  const titleId = `${uid}-title`
  const typeId = `${uid}-type`
  const descId = `${uid}-desc`
  const placeId = `${uid}-place`

  return (
    <EventDialog open={open} onOpenChange={onOpenChange} title={eventFormT(locale, 'editTitle')} locale={locale} onCloseAutoFocus={onCloseAutoFocus}>
      <form
        ref={formRef}
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void run('update')
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label htmlFor={titleId} className={LABEL}>
            {eventFormT(locale, 'fieldTitle')}
            <RequiredMark locale={locale} />
          </label>
          <input
            id={titleId}
            ref={titleRef}
            required
            className={INPUT}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            {...invalidProps(`${titleId}-err`, errors.title)}
          />
          <FieldErrorText id={`${titleId}-err`} locale={locale} error={errors.title} />
        </div>

        <div className="space-y-1">
          <label htmlFor={typeId} className={LABEL}>
            {eventFormT(locale, 'fieldType')}
          </label>
          <select id={typeId} className={INPUT} value={draft.eventType} onChange={(e) => set('eventType', e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {eventTypeLabel(t, locale)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor={descId} className={LABEL}>
            {eventFormT(locale, 'fieldDescription')}
          </label>
          <textarea id={descId} rows={3} className={`${INPUT} py-2`} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <p id={`${uid}-zone`} className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-800">
          {formatMessage(eventFormT(locale, 'zoneFixed'), { zone: zoneLabel(event.time_zone, locale) })}
        </p>

        <RepeatField
          idPrefix={`${uid}-repeat`}
          locale={locale}
          value={draft.recurrence}
          onChange={(r) => {
            set('recurrence', r)
            setConfirmStop(false)
          }}
          startDate={draft.time.date}
          errors={errors}
        />
        {repeating && (
          <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
            <legend className="px-1 text-sm font-semibold text-stone-800">{eventFormT(locale, 'whenLegend')}</legend>
            <TimeFields
              idPrefix={`${uid}-when`}
              locale={locale}
              value={draft.time}
              onChange={setTime}
              errors={errors}
              refs={{ date: dateRef, start: startRef, endDate: endDateRef, end: endRef }}
              describedBy={`${uid}-zone`}
            />
            {seriesChanged && <p className="text-sm text-stone-800">{eventFormT(locale, 'ruleChangeNote')}</p>}
          </fieldset>
        )}
        <RepeatPreview
          supabase={supabase}
          locale={locale}
          rule={formRule}
          time={draft.time}
          timeZone={event.time_zone}
          orgId={event.org_id}
        />
        <LeadField
          id={`${uid}-lead`}
          locale={locale}
          value={draft.announce}
          onChange={(n) => set('announce', n)}
          firstDate={event.next ? venueDateKey(event.next.starts_at, event.time_zone) : draft.time.date}
          error={errors.lead}
        />

        <div className="space-y-1">
          <label htmlFor={placeId} className={LABEL}>
            {eventFormT(locale, 'fieldLocationName')}
          </label>
          <input id={placeId} className={INPUT} value={draft.locationName} onChange={(e) => set('locationName', e.target.value)} />
        </div>

        <EventLocationField
          locale={locale}
          value={draft.location}
          onChange={(next) => set('location', next)}
          orgHasPin={orgHasPin}
          allowKeep
          error={errors.location}
          firstRef={locationRef}
        />

        {formError && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(locale, formError)}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" className={SECONDARY} onClick={() => onOpenChange(false)}>
            {orgFormT(locale, 'panelCancel')}
          </button>
          <button ref={submitRef} type="submit" className={PRIMARY} aria-disabled={saving !== null || undefined}>
            {saving === 'update' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {eventFormT(locale, saving === 'update' ? 'saving' : 'saveChanges')}
          </button>
        </div>

        {confirmStop && (
          <StopRepeatConfirm
            idPrefix={`${uid}-stop`}
            locale={locale}
            busy={saving === 'update'}
            confirmRef={stopConfirmRef}
            onConfirm={() => void run('update', true)}
            onCancel={() => {
              setConfirmStop(false)
              requestAnimationFrame(() => submitRef.current?.focus())
            }}
          />
        )}

        {/* A retired event stays reachable for its in-progress / ended dates; Retire is offered
            only while it is active. */}
        {event.is_active && (
          <div className="border-t border-stone-200 pt-4">
            {!confirmRetire ? (
              <button ref={retireRef} type="button" className={DANGER} onClick={() => toggleRetire(true)}>
                {eventFormT(locale, 'retire')}
              </button>
            ) : (
              <div
                role="group"
                aria-labelledby={`${uid}-retire-title`}
                aria-describedby={`${uid}-retire-body`}
                className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p id={`${uid}-retire-title`} className="text-sm font-semibold text-red-800">
                  {eventFormT(locale, 'retireConfirmTitle')}
                </p>
                <p id={`${uid}-retire-body`} className="text-sm text-stone-800">
                  {eventFormT(locale, 'retireConfirmBody')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    ref={retireConfirmRef}
                    type="button"
                    className={DANGER}
                    aria-disabled={saving !== null || undefined}
                    onClick={() => void run('retire')}
                  >
                    {saving === 'retire' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {eventFormT(locale, 'retire')}
                  </button>
                  <button type="button" className={SECONDARY} onClick={() => toggleRetire(false)}>
                    {orgFormT(locale, 'panelCancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </EventDialog>
  )
}

/** Which field a refused save's message belongs on (null = a form-level message). The org and
 *  the zone are not editable here, so their messages are form-level too. */
export function placeSaveError(field: EventErrorField): Exclude<EventErrorField, null | 'org' | 'timeZone'> | null {
  return field && field !== 'org' && field !== 'timeZone' ? field : null
}

/**
 * Where focus goes after a refused save: the field the message is on ('field', handled by
 * showErrors); Save changes when the save came from the stop-repeating confirmation, which (with
 * the button that had focus) is gone and left only a form-level message ('submit'); otherwise it
 * stays where it is ('stay').
 */
export function focusAfterFailedSave(placed: EventErrorField, fromStopConfirm: boolean): 'field' | 'submit' | 'stay' {
  if (placed) return 'field'
  return fromStopConfirm ? 'submit' : 'stay'
}

/** "Stop repeating?" — its confirm button says what it does ("Stop repeating and save"), not the
 *  form's own "Save changes"; while the save runs it reads "Saving…". */
export function StopRepeatConfirm({
  idPrefix,
  locale,
  busy,
  confirmRef,
  onConfirm,
  onCancel,
}: {
  idPrefix: string
  locale: Locale
  busy: boolean
  confirmRef?: Ref<HTMLButtonElement>
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="group"
      aria-labelledby={`${idPrefix}-title`}
      aria-describedby={`${idPrefix}-body`}
      className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <p id={`${idPrefix}-title`} className="text-sm font-semibold text-red-800">
        {eventFormT(locale, 'stopRepeatTitle')}
      </p>
      <p id={`${idPrefix}-body`} className="text-sm text-stone-800">
        {eventFormT(locale, 'stopRepeatBody')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button ref={confirmRef} type="button" className={DANGER} aria-disabled={busy || undefined} onClick={onConfirm}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {eventFormT(locale, busy ? 'saving' : 'stopRepeatConfirm')}
        </button>
        <button type="button" className={SECONDARY} onClick={onCancel}>
          {orgFormT(locale, 'panelCancel')}
        </button>
      </div>
    </div>
  )
}
