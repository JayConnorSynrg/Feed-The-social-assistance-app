'use client'

// apps/web/src/app/(admin)/moderation/event-create-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One-step event creation: title, type, optional description, date + start + end in the venue's
// time zone, whether and how it repeats (with a preview of its next dates), when each date is
// posted to the feed, and the location — then ONE create_org_event call writes the event with
// its repeat rule, its lead and its first date(s). The parent remounts this dialog (key) every time it opens, so each open is a new form
// with a new idempotency key; retries of that form reuse the key (the server returns the same
// event), and the key is renewed after a successful create. A click while a save is in flight is
// refused before any request (single-flight flag flipped synchronously in the controller).

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'
import { EVENT_TYPES, eventFormT, eventTypeLabel } from '@/lib/i18n-event-forms'
import { browserTimeZone } from '@/lib/event-time'
import { createOrgEvent } from '@/lib/event-admin-rpc'
import {
  DEFAULT_ANNOUNCE_LEAD,
  defaultRecurrenceForm,
  recurrenceRuleFromForm,
  withRecurrenceStartDate,
} from '@/lib/event-recurrence'
import {
  buildCreateArgs,
  createSubmitController,
  defaultLocation,
  firstErrorField,
  locateTimeError,
  mintIdempotencyKey,
  sameDayTime,
  type CreateEventDraft,
  type FieldError,
  type FieldErrors,
} from '@/lib/event-form-model'
import {
  EventDialog,
  FieldErrorText,
  INPUT,
  LABEL,
  PRIMARY,
  RequiredMark,
  SECONDARY,
  TimeFields,
  TimeZoneSelect,
  errorText,
  invalidProps,
  useOrgHasPin,
} from './event-form-ui'
import { EventLocationField } from './event-location-field'
import { LeadField, RepeatField, RepeatPreview, focusField } from './event-repeat-field'
import type { AdminOrg } from './use-admin-orgs'

export type OrgChoice = { kind: 'fixed'; orgId: string } | { kind: 'pick'; orgs: AdminOrg[] }

function todayIn(tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function EventCreateDialog({
  open,
  onOpenChange,
  locale,
  orgChoice,
  initialDate,
  onCreated,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  orgChoice: OrgChoice
  /** YYYY-MM-DD to prefill (a calendar day); defaults to today in the chosen zone. */
  initialDate?: string
  onCreated: (eventId: string, title: string) => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const uid = useId()
  // The controller object is stable for this form instance and holds the key + in-flight flag.
  const [controller] = useState(() => createSubmitController(mintIdempotencyKey))
  const [draft, setDraft] = useState<CreateEventDraft>(() => {
    const tz = browserTimeZone()
    const date = initialDate ?? todayIn(tz)
    return {
      orgId: orgChoice.kind === 'fixed' ? orgChoice.orgId : '',
      title: '',
      eventType: 'distribution',
      description: '',
      locationName: '',
      timeZone: tz,
      time: sameDayTime(date, '09:00', '11:00'),
      location: defaultLocation(false),
      recurrence: defaultRecurrenceForm(date),
      announce: DEFAULT_ANNOUNCE_LEAD,
    }
  })
  const [locationTouched, setLocationTouched] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<FieldError | null>(null)
  const [saving, setSaving] = useState(false)

  const orgHasPin = useOrgHasPin(draft.orgId || null)
  // Until the admin picks a location, follow the default: the org's pin when it has one.
  const location = locationTouched ? draft.location : defaultLocation(orgHasPin === true)

  const orgRef = useRef<HTMLSelectElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const timeZoneRef = useRef<HTMLSelectElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const showErrors = (next: FieldErrors) => {
    setErrors(next)
    const first = firstErrorField(next)
    const target: Partial<Record<NonNullable<typeof first>, { current: { focus: () => void } | null }>> = {
      org: orgRef,
      title: titleRef,
      date: dateRef,
      start: startRef,
      endDate: endDateRef,
      end: endRef,
      timeZone: timeZoneRef,
      location: locationRef,
    }
    if (!first) return
    const ref = target[first]
    requestAnimationFrame(() => (ref ? ref.current?.focus() : focusField(formRef.current, first)))
  }

  const set = <K extends keyof CreateEventDraft>(k: K, v: CreateEventDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  // A new start date carries the repeat choices that only echoed the old one (its weekday, its
  // day of the month, the six-month end) along with it.
  const setTime = (time: CreateEventDraft['time']) =>
    setDraft((d) => ({
      ...d,
      time,
      recurrence: time.date === d.time.date ? d.recurrence : withRecurrenceStartDate(d.recurrence, d.time.date, time.date),
    }))
  const built = recurrenceRuleFromForm(draft.recurrence, draft.time.date)
  const previewRule = built.ok ? built.rule : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (controller.inFlight) return
    const built = buildCreateArgs({ ...draft, location }, controller.key, orgHasPin === true)
    if (!built.ok) {
      setFormError(null)
      showErrors(built.errors)
      return
    }
    setErrors({})
    setFormError(null)
    setSaving(true)
    const outcome = await controller.submit((key) => createOrgEvent(supabase, { ...built.args, p_idempotency_key: key }))
    setSaving(false)
    if (outcome.status === 'busy') return
    const r = outcome.result
    if (r.ok) {
      onCreated(r.eventId, built.args.p_title)
      onOpenChange(false)
      return
    }
    if (r.field === 'start' || r.field === 'end') {
      const at = locateTimeError(r.localTime, [draft.time], r.field)
      const time = r.localTime?.split(' ')[1]
      showErrors({ [at.field ?? 'start']: { key: r.errorKey, vars: time ? { time } : undefined } })
    } else if (r.field) {
      showErrors({ [r.field]: { key: r.errorKey } })
    } else {
      setFormError({ key: r.errorKey })
    }
  }

  const titleId = `${uid}-title`
  const typeId = `${uid}-type`
  const descId = `${uid}-desc`
  const orgId = `${uid}-org`
  const placeId = `${uid}-place`

  return (
    <EventDialog open={open} onOpenChange={onOpenChange} title={eventFormT(locale, 'createTitle')} locale={locale} onCloseAutoFocus={onCloseAutoFocus}>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-4">
        {orgChoice.kind === 'pick' && (
          <div className="space-y-1">
            <label htmlFor={orgId} className={LABEL}>
              {eventFormT(locale, 'fieldOrg')}
              <RequiredMark locale={locale} />
            </label>
            <select
              id={orgId}
              ref={orgRef}
              required
              className={INPUT}
              value={draft.orgId}
              onChange={(e) => {
                set('orgId', e.target.value)
                setLocationTouched(false)
              }}
              {...invalidProps(`${orgId}-err`, errors.org)}
            >
              <option value="">{eventFormT(locale, 'fieldOrgPlaceholder')}</option>
              {orgChoice.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <FieldErrorText id={`${orgId}-err`} locale={locale} error={errors.org} />
          </div>
        )}

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
          <textarea
            id={descId}
            rows={3}
            className={`${INPUT} py-2`}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
          <legend className="px-1 text-sm font-semibold text-stone-800">{eventFormT(locale, 'whenLegend')}</legend>
          <TimeFields
            idPrefix={`${uid}-when`}
            locale={locale}
            value={draft.time}
            onChange={setTime}
            errors={errors}
            refs={{ date: dateRef, start: startRef, endDate: endDateRef, end: endRef }}
            describedBy={`${uid}-tz-hint`}
          />
          <TimeZoneSelect
            id={`${uid}-tz`}
            locale={locale}
            value={draft.timeZone}
            onChange={(tz) => set('timeZone', tz)}
            error={errors.timeZone}
            selectRef={timeZoneRef}
          />
        </fieldset>

        <RepeatField
          idPrefix={`${uid}-repeat`}
          locale={locale}
          value={draft.recurrence}
          onChange={(r) => set('recurrence', r)}
          startDate={draft.time.date}
          errors={errors}
        />
        <RepeatPreview
          supabase={supabase}
          locale={locale}
          rule={previewRule}
          time={draft.time}
          timeZone={draft.timeZone}
          orgId={draft.orgId}
        />
        <LeadField
          id={`${uid}-lead`}
          locale={locale}
          value={draft.announce}
          onChange={(n) => set('announce', n)}
          firstDate={draft.time.date}
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
          value={location}
          onChange={(next) => {
            setLocationTouched(true)
            set('location', next)
          }}
          orgHasPin={draft.orgId ? orgHasPin : null}
          noOrgChosen={!draft.orgId}
          allowKeep={false}
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
          <button type="submit" className={PRIMARY} aria-disabled={saving || undefined}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {eventFormT(locale, saving ? 'creating' : 'createSubmit')}
          </button>
        </div>
      </form>
    </EventDialog>
  )
}
