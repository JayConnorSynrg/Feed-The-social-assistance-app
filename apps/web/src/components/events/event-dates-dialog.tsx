'use client'

// apps/web/src/components/events/event-dates-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Add one or more dates to an existing event, entered as wall-clock times in the EVENT's own time
// zone (fixed at create; shown read-only here). One add_event_dates call per submit: a start time
// the event already has is ignored, a cancelled one is restored, and the result names how many
// dates were added or restored (0 = nothing changed, still a success). A second click while the
// save is in flight is refused before any request.

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { zoneLabel } from '@/lib/event-time'
import { addEventDates, type EventWriteSurface } from '@/lib/event-admin-rpc'
import {
  createSubmitController,
  firstErrorField,
  locateTimeError,
  mintIdempotencyKey,
  sameDayTime,
  toLocalDates,
  validateDateRows,
  type EventTimeDraft,
  type FieldError,
  type FieldErrors,
} from '@/lib/event-form-model'
import { EventDialog, FOCUS_RING, PRIMARY, SECONDARY, TimeFields, errorText } from './event-form-ui'

export interface DatesTarget {
  id: string
  title: string
  org_id: string
  time_zone: string
}

export function EventDatesDialog({
  open,
  onOpenChange,
  locale,
  event,
  initialDate,
  onAdded,
  onCloseAutoFocus,
  surface = 'admin',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  event: DatesTarget
  initialDate: string
  onAdded: (changed: number) => void
  onCloseAutoFocus?: (event: Event) => void
  /** Where the dialog was opened (the save's `surface` log label). */
  surface?: EventWriteSurface
}) {
  const supabase = useMemo(() => createClient(), [])
  const uid = useId()
  // add_event_dates is naturally idempotent (repeated start times are ignored); the controller is
  // used here for its single-flight flag.
  const [controller] = useState(() => createSubmitController(mintIdempotencyKey))
  const [rows, setRows] = useState<EventTimeDraft[]>([sameDayTime(initialDate, '09:00', '11:00')])
  const [rowErrors, setRowErrors] = useState<Record<number, FieldErrors>>({})
  const [formError, setFormError] = useState<FieldError | null>(null)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const zoneNoteId = `${uid}-zone`

  const focusRowField = (row: number, field: string) =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-r${row}-${field}`)}`)?.focus())

  const showRowErrors = (next: Record<number, FieldErrors>) => {
    setRowErrors(next)
    const firstRow = Object.keys(next).map(Number).sort((a, b) => a - b)[0]
    if (firstRow === undefined) return
    const field = firstErrorField(next[firstRow])
    if (field) focusRowField(firstRow, field)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (controller.inFlight) return
    const invalid = validateDateRows(rows, event.time_zone)
    if (Object.keys(invalid).length > 0) {
      setFormError(null)
      showRowErrors(invalid)
      return
    }
    setRowErrors({})
    setFormError(null)
    setSaving(true)
    const outcome = await controller.submit(() =>
      addEventDates(supabase, { eventId: event.id, orgId: event.org_id, dates: toLocalDates(rows), surface })
    )
    setSaving(false)
    if (outcome.status === 'busy') return
    const r = outcome.result
    if (r.ok) {
      onAdded(r.changed)
      onOpenChange(false)
      return
    }
    if (r.field === 'start' || r.field === 'end') {
      const at = locateTimeError(r.localTime, rows, r.field)
      const time = r.localTime?.split(' ')[1]
      showRowErrors({ [at.row]: { [at.field ?? 'start']: { key: r.errorKey, vars: time ? { time } : undefined } } })
    } else {
      setFormError({ key: r.errorKey })
    }
  }

  const updateRow = (i: number, next: EventTimeDraft) => setRows((rs) => rs.map((r, j) => (j === i ? next : r)))
  const addRow = () => {
    const last = rows[rows.length - 1]
    setRows((rs) => [...rs, last ? { ...last } : sameDayTime(initialDate, '09:00', '11:00')])
    requestAnimationFrame(() => {
      const inputs = formRef.current?.querySelectorAll<HTMLInputElement>('input[type="date"]')
      inputs?.[inputs.length - 1]?.focus()
    })
  }
  const removeRow = (i: number) => {
    setRows((rs) => rs.filter((_, j) => j !== i))
    setRowErrors({})
    // The removed row's button is gone: continue at the previous row's start date.
    focusRowField(Math.max(0, i - 1), 'date')
  }

  return (
    <EventDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(eventFormT(locale, 'datesTitle'), { title: event.title })}
      locale={locale}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-4">
        <p id={zoneNoteId} className="text-sm text-stone-700">
          {formatMessage(eventFormT(locale, 'datesZoneNote'), { zone: zoneLabel(event.time_zone, locale) })}
        </p>
        {rows.map((row, i) => {
          const n = String(i + 1)
          return (
            <fieldset key={i} className="relative space-y-2 rounded-lg border border-stone-200 p-3 pt-2">
              <legend className="px-1 text-sm font-semibold text-stone-800">
                {formatMessage(eventFormT(locale, 'dateRowLegend'), { n })}
              </legend>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className={`absolute right-2 top-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{formatMessage(eventFormT(locale, 'removeDate'), { n })}</span>
                </button>
              )}
              <TimeFields
                idPrefix={`${uid}-r${i}`}
                locale={locale}
                value={row}
                onChange={(next) => updateRow(i, next)}
                errors={rowErrors[i] ?? {}}
                describedBy={zoneNoteId}
              />
            </fieldset>
          )
        })}
        <button type="button" className={SECONDARY} onClick={addRow}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {eventFormT(locale, 'addAnotherDate')}
        </button>

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
            {eventFormT(locale, saving ? 'addingDates' : 'datesSubmit')}
          </button>
        </div>
      </form>
    </EventDialog>
  )
}
