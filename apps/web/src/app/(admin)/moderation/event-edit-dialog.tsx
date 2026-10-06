'use client'

// apps/web/src/app/(admin)/moderation/event-edit-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Edit an event's title, type, description, place name and location (keep / organization pin /
// confirmed address) through admin_update_event — no recurrence, no geocode tier, no time zone
// (the zone is fixed at create and shown read-only). Retire = the same RPC with p_is_active false
// after an inline confirmation: dates that have not started are cancelled, an in-progress date
// runs to its end. One RPC per save; a second click while a save is in flight is refused.

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'
import { EVENT_TYPES, eventFormT, eventTypeLabel, formatMessage } from '@/lib/i18n-event-forms'
import { zoneLabel } from '@/lib/event-time'
import { updateEvent } from '@/lib/event-admin-rpc'
import {
  buildUpdateArgs,
  createSubmitController,
  firstErrorField,
  mintIdempotencyKey,
  type EditEventDraft,
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
  errorText,
  invalidProps,
  useOrgHasPin,
} from './event-form-ui'
import { EventLocationField } from './event-location-field'

export interface EditTarget {
  id: string
  org_id: string
  title: string
  event_type: string
  description: string | null
  location_name: string | null
  time_zone: string
  is_active: boolean
}

export function EventEditDialog({
  open,
  onOpenChange,
  locale,
  event,
  onSaved,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  event: EditTarget
  onSaved: (action: 'update' | 'retire') => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const uid = useId()
  const [controller] = useState(() => createSubmitController(mintIdempotencyKey))
  const [draft, setDraft] = useState<EditEventDraft>(() => ({
    eventId: event.id,
    title: event.title,
    eventType: event.event_type,
    description: event.description ?? '',
    locationName: event.location_name ?? '',
    location: { source: 'keep' },
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<FieldError | null>(null)
  const [saving, setSaving] = useState<'update' | 'retire' | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const orgHasPin = useOrgHasPin(event.org_id)

  const titleRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
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

  const showErrors = (next: FieldErrors) => {
    setErrors(next)
    const first = firstErrorField(next)
    if (first === 'title') requestAnimationFrame(() => titleRef.current?.focus())
    else if (first === 'location') requestAnimationFrame(() => locationRef.current?.focus())
  }

  async function run(action: 'update' | 'retire') {
    if (controller.inFlight) return
    let args
    if (action === 'retire') {
      args = { p_event_id: event.id, p_is_active: false }
    } else {
      const built = buildUpdateArgs(draft, orgHasPin === true)
      if (!built.ok) {
        setFormError(null)
        showErrors(built.errors)
        return
      }
      args = built.args
    }
    setErrors({})
    setFormError(null)
    setSaving(action)
    const outcome = await controller.submit(() => updateEvent(supabase, { orgId: event.org_id, action, args }))
    setSaving(null)
    if (outcome.status === 'busy') return
    const r = outcome.result
    if (r.ok) {
      onSaved(action)
      onOpenChange(false)
      return
    }
    setConfirmRetire(false)
    if (r.field === 'title' || r.field === 'location') showErrors({ [r.field]: { key: r.errorKey } })
    else setFormError({ key: r.errorKey })
  }

  const titleId = `${uid}-title`
  const typeId = `${uid}-type`
  const descId = `${uid}-desc`
  const placeId = `${uid}-place`

  return (
    <EventDialog open={open} onOpenChange={onOpenChange} title={eventFormT(locale, 'editTitle')} locale={locale} onCloseAutoFocus={onCloseAutoFocus}>
      <form
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

        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-800">
          {formatMessage(eventFormT(locale, 'zoneFixed'), { zone: zoneLabel(event.time_zone, locale) })}
        </p>

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
          <button type="submit" className={PRIMARY} aria-disabled={saving !== null || undefined}>
            {saving === 'update' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {eventFormT(locale, saving === 'update' ? 'saving' : 'saveChanges')}
          </button>
        </div>

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
