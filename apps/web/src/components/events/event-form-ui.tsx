'use client'

// apps/web/src/components/events/event-form-ui.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Building blocks shared by the event create / add-dates / edit dialogs: the dialog frame (Radix
// focus trap, translated close button, outside clicks keep the draft), a labelled field error,
// the date + start + end inputs, the venue time-zone picker, and useOrgHasPin (reads ONLY the
// one organization's pin, to offer "Use the organization's location").

import { useEffect, useMemo, useState, type ReactNode, type Ref } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { dir, type Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'
import { eventFormT, formatMessage, type EventFormMessages } from '@/lib/i18n-event-forms'
import { timeZoneOptions } from '@/lib/event-time'
import { withStartDate, type EventTimeDraft, type FieldError, type FieldErrors } from '@/lib/event-form-model'

export const FOCUS_RING =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
export const PRIMARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60 ' +
  FOCUS_RING
export const SECONDARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-500 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-60 ' +
  FOCUS_RING
export const DANGER =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-700 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 ' +
  FOCUS_RING
export const INPUT =
  'block w-full min-h-10 rounded-lg border border-stone-500 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500 aria-[invalid=true]:border-red-700 ' +
  FOCUS_RING
export const LABEL = 'block text-sm font-medium text-stone-800'

/** The translated text of a field error. */
export function errorText(locale: Locale, e: FieldError): string {
  const template = eventFormT(locale, e.key)
  return e.vars ? formatMessage(template, e.vars) : template
}

export function FieldErrorText({ id, locale, error }: { id: string; locale: Locale; error?: FieldError | null }) {
  if (!error) return null
  return (
    <p id={id} className="text-sm text-red-700">
      {errorText(locale, error)}
    </p>
  )
}

/** aria props of an input whose error paragraph has id `errId`. */
export function invalidProps(errId: string, error?: FieldError | null, extraDescribedBy?: string) {
  const ids = [error ? errId : null, extraDescribedBy ?? null].filter(Boolean).join(' ')
  return {
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': ids || undefined,
  }
}

/** Visible "(required)" after a required field's label (the input also carries `required`). */
export function RequiredMark({ locale }: { locale: Locale }) {
  return <span className="font-normal text-stone-600"> ({orgFormT(locale, 'fieldRequired')})</span>
}

/**
 * Dialog frame for the event forms. Controlled (no DialogTrigger), so the opener restores focus
 * through `onCloseAutoFocus`. The content is portalled outside the translated tree, so it
 * carries its own lang / dir.
 */
export function EventDialog({
  open,
  onOpenChange,
  title,
  locale,
  onCloseAutoFocus,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  locale: Locale
  onCloseAutoFocus?: (event: Event) => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideDefaultClose
        disableOutsideClose
        aria-describedby={undefined}
        lang={locale}
        dir={dir(locale)}
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[90vh] max-w-lg scroll-pt-16 overflow-y-auto bg-white p-0"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
          <DialogTitle className="text-base font-bold text-stone-900">{title}</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{orgFormT(locale, 'panelClose')}</span>
          </button>
        </div>
        <div className="px-5 pb-5 pt-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

type TimeField = 'date' | 'start' | 'endDate' | 'end'

/** Start date + start time + end date + end time of one event date (local wall clock in the
 *  venue zone). The end date follows the start date until the admin changes it (overnight). */
export function TimeFields({
  idPrefix,
  locale,
  value,
  onChange,
  errors,
  refs,
  describedBy,
}: {
  idPrefix: string
  locale: Locale
  value: EventTimeDraft
  onChange: (next: EventTimeDraft) => void
  errors: FieldErrors
  refs?: Partial<Record<TimeField, Ref<HTMLInputElement>>>
  /** Id of a note (e.g. the time-zone line) every time input is described by. */
  describedBy?: string
}) {
  const fields: Array<{ field: TimeField; label: keyof EventFormMessages; type: 'date' | 'time' }> = [
    { field: 'date', label: 'fieldDate', type: 'date' },
    { field: 'start', label: 'fieldStart', type: 'time' },
    { field: 'endDate', label: 'fieldEndDate', type: 'date' },
    { field: 'end', label: 'fieldEnd', type: 'time' },
  ]
  const change = (field: TimeField, v: string) =>
    onChange(field === 'date' ? withStartDate(value, v) : { ...value, [field]: v })
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ field, label, type }) => {
        const id = `${idPrefix}-${field}`
        const errId = `${id}-err`
        return (
          <div key={field} className="space-y-1">
            <label htmlFor={id} className={LABEL}>
              {eventFormT(locale, label)}
              <RequiredMark locale={locale} />
            </label>
            <input
              id={id}
              ref={refs?.[field]}
              type={type}
              required
              min={field === 'endDate' ? value.date || undefined : undefined}
              value={value[field]}
              onChange={(e) => change(field, e.target.value)}
              className={INPUT}
              {...invalidProps(errId, errors[field], describedBy)}
            />
            <FieldErrorText id={errId} locale={locale} error={errors[field]} />
          </div>
        )
      })}
    </div>
  )
}

/** Venue time-zone picker: common US zones first, then every IANA zone. */
export function TimeZoneSelect({
  id,
  locale,
  value,
  onChange,
  error,
  selectRef,
}: {
  id: string
  locale: Locale
  value: string
  onChange: (tz: string) => void
  error?: FieldError | null
  selectRef?: Ref<HTMLSelectElement>
}) {
  const options = useMemo(() => timeZoneOptions(locale, value), [locale, value])
  const errId = `${id}-err`
  const hintId = `${id}-hint`
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={LABEL}>
        {eventFormT(locale, 'fieldTimeZone')}
      </label>
      <select
        id={id}
        ref={selectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
        {...invalidProps(errId, error, hintId)}
      >
        <optgroup label={eventFormT(locale, 'zoneCommonGroup')}>
          {options.common.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
        <optgroup label={eventFormT(locale, 'zoneAllGroup')}>
          {options.all.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      </select>
      <p id={hintId} className="text-xs text-stone-600">
        {eventFormT(locale, 'zoneHint')}
      </p>
      <FieldErrorText id={errId} locale={locale} error={error} />
    </div>
  )
}

/**
 * Whether the organization has a map pin: true / false, or null while loading. Reads only
 * `organizations.location` of that one org (RLS: active org public, or platform admin).
 */
export function useOrgHasPin(orgId: string | null): boolean | null {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<{ orgId: string; hasPin: boolean } | null>(null)
  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    void supabase
      .from('organizations')
      .select('id, location')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setState({ orgId, hasPin: !error && data?.location != null })
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])
  return state && state.orgId === orgId ? state.hasPin : null
}
