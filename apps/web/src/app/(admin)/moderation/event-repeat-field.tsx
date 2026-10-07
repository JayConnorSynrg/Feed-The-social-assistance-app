'use client'

// apps/web/src/app/(admin)/moderation/event-repeat-field.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The repeat + feed-lead part of the event create / edit forms:
//   RepeatField   — Repeat (does not repeat / weekly / monthly), How often, Days of the week (full
//                   day names, Sunday first), Day of the month (choices derived from the first
//                   date), Ends (on a date — six months by default / after N dates / never). Each
//                   group is a fieldset with a legend; native radios and checkboxes on rows at
//                   least 40 px tall. Says before submit when the first date is not one of the
//                   pattern's dates.
//   RepeatPreview — the pattern in words and its next 5 dates from preview_event_recurrence:
//                   debounced, the previous request aborted on every change and on close, stale
//                   answers ignored, DST-shifted dates flagged, one polite announcement per
//                   settled change. A failed preview only says so; saving never waits for it.
//   LeadField     — "Post to the feed": on the day / 1 / 3 / 7 / 14 / 30 days before, with an
//                   example built from the first date.
// Focus targets carry data-field="<field>" so a dialog can move focus to the first error.

import { useEffect, useId, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import type { Locale } from '@/lib/i18n'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { formatCalendarDate, formatEventWhen } from '@/lib/event-time'
import { formatRecurrence, formatSeriesEnd, weekdayName } from '@/lib/event-recurrence-format'
import {
  ANNOUNCE_LEAD_KEYS,
  ANNOUNCE_LEAD_PRESETS,
  WEEKDAY_DISPLAY_ORDER,
  WEEKLY_INTERVAL_KEYS,
  announceFromDate,
  isAnnounceLead,
  isCalendarDate,
  monthlyChoices,
  monthlyPatternKey,
  monthlyPatternRule,
  recurrenceRuleFromForm,
  type RecurrenceFormState,
  type RecurrenceRule,
  type RepeatChoice,
  type SeriesEndChoice,
} from '@/lib/event-recurrence'
import { previewEventRecurrence, type PreviewDate, type PreviewInput } from '@/lib/event-admin-rpc'
import { localTimestamp, type EventTimeDraft, type FieldError, type FieldErrors } from '@/lib/event-form-model'
import { createDebouncedRunner } from './debounced-runner'
import { FieldErrorText, INPUT, LABEL, errorText, invalidProps } from './event-form-ui'

const CHOICE_ROW = 'flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-stone-900 hover:bg-stone-50'
const CHOICE_INPUT = 'h-5 w-5 shrink-0 accent-brand'
const GROUP = 'space-y-1 rounded-lg border border-stone-200 p-3'
const LEGEND = 'px-1 text-sm font-semibold text-stone-800'

// ---------------------------------------------------------------------------------------------
// Repeat
// ---------------------------------------------------------------------------------------------

/** The pattern / first-date message to show: the submit error, or — before any submit — the
 *  live finding that the first date is not one of the pattern's dates. */
export function patternMessage(value: RecurrenceFormState, startDate: string, errors: FieldErrors): FieldError | null {
  if (errors.pattern) return errors.pattern
  if (value.repeat === 'none' || !isCalendarDate(startDate)) return null
  const built = recurrenceRuleFromForm(value, startDate)
  return !built.ok && built.errors.pattern ? built.errors.pattern : null
}

export function RepeatField({
  idPrefix,
  locale,
  value,
  onChange,
  startDate,
  errors,
}: {
  idPrefix: string
  locale: Locale
  value: RecurrenceFormState
  onChange: (next: RecurrenceFormState) => void
  /** The first date (YYYY-MM-DD); weekly / monthly choices and the default end follow it. */
  startDate: string
  errors: FieldErrors
}) {
  const set = <K extends keyof RecurrenceFormState>(k: K, v: RecurrenceFormState[K]) => onChange({ ...value, [k]: v })
  const id = (part: string) => `${idPrefix}-${part}`
  const pattern = patternMessage(value, startDate, errors)
  const patternId = id('pattern-err')
  const choices = useMemo(
    () => (isCalendarDate(startDate) ? monthlyChoices(startDate, value.monthly) : []),
    [startDate, value.monthly],
  )
  const currentMonthlyKey = monthlyPatternKey(value.monthly)
  const repeatOptions: Array<{ v: RepeatChoice; key: 'repeatNone' | 'repeatWeekly' | 'repeatMonthly' }> = [
    { v: 'none', key: 'repeatNone' },
    { v: 'weekly', key: 'repeatWeekly' },
    { v: 'monthly', key: 'repeatMonthly' },
  ]
  const endOptions: Array<{ v: SeriesEndChoice; key: 'endOnDate' | 'endAfterCount' | 'endNever' }> = [
    { v: 'until', key: 'endOnDate' },
    { v: 'count', key: 'endAfterCount' },
    { v: 'never', key: 'endNever' },
  ]
  const skippedDay = value.monthly.kind === 'monthday' ? value.monthly.days.find((d) => d >= 29) : undefined
  // The first checked weekday (or the first weekday) takes focus for a weekdays / pattern error.
  const firstChecked = WEEKDAY_DISPLAY_ORDER.find((d) => value.weekdays.includes(d)) ?? WEEKDAY_DISPLAY_ORDER[0]
  const intervalErrIds = errors.interval ? id('interval-err') : undefined
  const weekdaysErrIds = [errors.weekdays ? id('weekdays-err') : null, pattern ? patternId : null].filter(Boolean).join(' ') || undefined
  const monthlyErrIds = [errors.monthly ? id('monthly-err') : null, pattern ? patternId : null].filter(Boolean).join(' ') || undefined
  // The control that takes focus for a group's error is itself marked invalid and described by
  // the message (a screen reader announces it on focus, not only the fieldset).
  const errProps = (isTarget: boolean, ids: string | undefined) =>
    isTarget && ids ? { 'aria-invalid': true as const, 'aria-describedby': ids } : {}

  return (
    <div className="space-y-3">
      <fieldset className={GROUP}>
        <legend className={LEGEND}>{eventFormT(locale, 'repeatLegend')}</legend>
        {repeatOptions.map((o) => (
          <label key={o.v} className={CHOICE_ROW}>
            <input
              type="radio"
              name={id('repeat')}
              className={CHOICE_INPUT}
              checked={value.repeat === o.v}
              onChange={() => set('repeat', o.v)}
            />
            {eventFormT(locale, o.key)}
          </label>
        ))}
      </fieldset>

      {value.repeat === 'weekly' && (
        <>
          <fieldset className={GROUP} aria-describedby={intervalErrIds}>
            <legend className={LEGEND}>{eventFormT(locale, 'repeatIntervalLabel')}</legend>
            {([1, 2, 3, 4] as const).map((n) => (
              <label key={n} className={CHOICE_ROW}>
                <input
                  type="radio"
                  name={id('interval')}
                  className={CHOICE_INPUT}
                  checked={value.interval === n}
                  onChange={() => set('interval', n)}
                  data-field={value.interval === n ? 'interval' : undefined}
                  {...errProps(value.interval === n, intervalErrIds)}
                />
                {eventFormT(locale, WEEKLY_INTERVAL_KEYS[n])}
              </label>
            ))}
            <FieldErrorText id={id('interval-err')} locale={locale} error={errors.interval} />
          </fieldset>

          <fieldset className={GROUP} aria-describedby={weekdaysErrIds}>
            <legend className={LEGEND}>{eventFormT(locale, 'repeatOnDays')}</legend>
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              {WEEKDAY_DISPLAY_ORDER.map((d) => (
                <label key={d} className={CHOICE_ROW}>
                  <input
                    type="checkbox"
                    className={CHOICE_INPUT}
                    checked={value.weekdays.includes(d)}
                    onChange={(e) =>
                      set('weekdays', e.target.checked ? [...value.weekdays, d] : value.weekdays.filter((w) => w !== d))
                    }
                    data-field={d === firstChecked ? 'weekdays pattern' : undefined}
                    {...errProps(d === firstChecked, weekdaysErrIds)}
                  />
                  {weekdayName(d, locale, 'long')}
                </label>
              ))}
            </div>
            <FieldErrorText id={id('weekdays-err')} locale={locale} error={errors.weekdays} />
          </fieldset>
        </>
      )}

      {value.repeat === 'monthly' && (
        <fieldset className={GROUP} aria-describedby={monthlyErrIds}>
          <legend className={LEGEND}>{eventFormT(locale, 'repeatMonthlyOn')}</legend>
          {choices.map((c) => (
            <label key={c.key} className={CHOICE_ROW}>
              <input
                type="radio"
                name={id('monthly')}
                className={CHOICE_INPUT}
                checked={c.key === currentMonthlyKey}
                onChange={() => set('monthly', c.pattern)}
                data-field={c.key === currentMonthlyKey ? 'monthly pattern' : undefined}
                {...errProps(c.key === currentMonthlyKey, monthlyErrIds)}
              />
              {formatRecurrence(monthlyPatternRule(c.pattern), locale)}
            </label>
          ))}
          {skippedDay !== undefined && (
            <p className="px-2 text-xs text-stone-700">
              {formatMessage(eventFormT(locale, 'repeatMonthDaySkipped'), { day: skippedDay })}
            </p>
          )}
          <FieldErrorText id={id('monthly-err')} locale={locale} error={errors.monthly} />
        </fieldset>
      )}

      {pattern && (
        <p id={patternId} className="text-sm text-red-700">
          {errorText(locale, pattern)}
        </p>
      )}

      {value.repeat !== 'none' && (
        <>
          <p className="text-xs text-stone-700">{eventFormT(locale, 'repeatTimesNote')}</p>
          <fieldset className={GROUP} aria-describedby={id('end-hint')}>
            <legend className={LEGEND}>{eventFormT(locale, 'endLegend')}</legend>
            {endOptions.map((o) => (
              <label key={o.v} className={CHOICE_ROW}>
                <input
                  type="radio"
                  name={id('end')}
                  className={CHOICE_INPUT}
                  checked={value.end === o.v}
                  onChange={() => set('end', o.v)}
                />
                {eventFormT(locale, o.key)}
              </label>
            ))}
            {value.end === 'until' && (
              <div className="space-y-1 px-2 pt-1">
                <label htmlFor={id('until')} className={LABEL}>
                  {eventFormT(locale, 'endUntilLabel')}
                </label>
                <input
                  id={id('until')}
                  type="date"
                  className={INPUT}
                  min={isCalendarDate(startDate) ? startDate : undefined}
                  value={value.untilDate}
                  onChange={(e) => set('untilDate', e.target.value)}
                  data-field="until"
                  {...invalidProps(id('until-err'), errors.until)}
                />
                <FieldErrorText id={id('until-err')} locale={locale} error={errors.until} />
              </div>
            )}
            {value.end === 'count' && (
              <div className="space-y-1 px-2 pt-1">
                <label htmlFor={id('count')} className={LABEL}>
                  {eventFormT(locale, 'endCountLabel')}
                </label>
                <input
                  id={id('count')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  className={INPUT}
                  value={value.count}
                  onChange={(e) => set('count', e.target.value)}
                  data-field="count"
                  {...invalidProps(id('count-err'), errors.count)}
                />
                <FieldErrorText id={id('count-err')} locale={locale} error={errors.count} />
              </div>
            )}
            <p id={id('end-hint')} className="px-2 text-xs text-stone-700">
              {eventFormT(locale, 'endDefaultHint')}
            </p>
          </fieldset>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------------------------

export type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; dates: PreviewDate[] }
  | { status: 'error' }

export type PreviewFetch = (
  input: PreviewInput,
  signal: AbortSignal,
) => Promise<{ ok: true; dates: PreviewDate[] } | { ok: false; aborted: boolean }>

export interface PreviewController {
  /** The form changed: abort the request in flight, forget its answer, and ask again after the
   *  debounce (null = nothing to preview). */
  request(input: PreviewInput | null): void
  /** The form closed: abort and forget everything pending. */
  close(): void
}

/** Debounced, abortable, last-answer-wins preview requests. Pure (no React) so it is testable
 *  with fake timers. */
export function createPreviewController(fetchDates: PreviewFetch, onState: (s: PreviewState) => void, delayMs = 400): PreviewController {
  const runner = createDebouncedRunner(delayMs)
  let seq = 0
  let inFlight: AbortController | null = null
  const stop = () => {
    seq++
    runner.cancel()
    inFlight?.abort()
    inFlight = null
  }
  return {
    request(input) {
      stop()
      if (!input) {
        onState({ status: 'idle' })
        return
      }
      const mine = seq
      onState({ status: 'loading' })
      runner.schedule(() => {
        const ctrl = new AbortController()
        inFlight = ctrl
        void fetchDates(input, ctrl.signal).then((r) => {
          if (mine !== seq || ctrl.signal.aborted) return
          inFlight = null
          onState(r.ok ? { status: 'ready', dates: r.dates } : { status: 'error' })
        })
      })
    },
    close: stop,
  }
}

/** The text announced (politely, once) when a preview settles; null while loading / idle so a
 *  change is announced once, when its answer is in. */
export function previewAnnouncement(state: PreviewState, summary: string, firstDate: string | null, locale: Locale): string | null {
  if (state.status === 'error') return eventFormT(locale, 'previewError')
  if (state.status !== 'ready') return null
  if (state.dates.length === 0 || !firstDate) return eventFormT(locale, 'previewEmpty')
  return `${summary}. ${eventFormT(locale, 'previewTitle')}: ${firstDate}`
}

/** The preview request a form state asks for, or null when it does not repeat / is not valid. */
export function previewInputOf(
  rule: RecurrenceRule | null,
  time: EventTimeDraft,
  timeZone: string,
  orgId: string,
): PreviewInput | null {
  if (!rule || !time.date || !time.start || !time.endDate || !time.end || !timeZone) return null
  return {
    rule,
    startsLocal: localTimestamp(time.date, time.start),
    endsLocal: localTimestamp(time.endDate, time.end),
    timeZone,
    orgId,
  }
}

export function RepeatPreview({
  supabase,
  locale,
  rule,
  time,
  timeZone,
  orgId,
}: {
  supabase: SupabaseClient<Database>
  locale: Locale
  /** The rule the form would save now (null = not repeating or not yet valid). */
  rule: RecurrenceRule | null
  time: EventTimeDraft
  timeZone: string
  orgId: string
}) {
  const uid = useId()
  const [state, setState] = useState<PreviewState>({ status: 'idle' })
  const [controller] = useState(() =>
    createPreviewController((input, signal) => previewEventRecurrence(supabase, input, signal), setState),
  )
  const input = previewInputOf(rule, time, timeZone, orgId)
  const inputKey = input ? JSON.stringify(input) : ''
  useEffect(() => {
    controller.request(inputKey ? (JSON.parse(inputKey) as PreviewInput) : null)
  }, [controller, inputKey])
  useEffect(() => () => controller.close(), [controller])

  const summary = rule ? `${formatRecurrence(rule, locale)}. ${formatSeriesEnd(rule, locale)}` : ''
  const when = (d: PreviewDate) => formatEventWhen(d.startsAt, d.endsAt, timeZone, locale)
  const first = state.status === 'ready' && state.dates[0] ? when(state.dates[0]).text : null
  // Empty while loading, so each change is announced once: when its answer is in.
  const announcement = previewAnnouncement(state, summary, first, locale) ?? ''

  if (!rule) return null
  return (
    <section aria-labelledby={`${uid}-title`} className="space-y-2 rounded-lg bg-stone-50 p-3">
      <h3 id={`${uid}-title`} className="text-sm font-semibold text-stone-900">
        {eventFormT(locale, 'previewTitle')}
      </h3>
      <p className="text-sm text-stone-800">{summary}</p>
      {state.status === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-stone-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {eventFormT(locale, 'previewLoading')}
        </p>
      )}
      {state.status === 'error' && <p className="text-sm text-stone-800">{eventFormT(locale, 'previewError')}</p>}
      {state.status === 'ready' &&
        (state.dates.length === 0 ? (
          <p className="text-sm text-stone-800">{eventFormT(locale, 'previewEmpty')}</p>
        ) : (
          <ol className="space-y-1 text-sm text-stone-900">
            {state.dates.map((d) => {
              const w = when(d)
              return (
                <li key={d.localDate}>
                  {w.text}
                  {w.venue && <span className="block text-xs text-stone-700">{w.venue}</span>}
                  {d.shifted && <span className="block text-xs text-stone-700">{eventFormT(locale, 'previewShifted')}</span>}
                </li>
              )
            })}
          </ol>
        ))}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// Feed lead
// ---------------------------------------------------------------------------------------------

export function LeadField({
  id,
  locale,
  value,
  onChange,
  firstDate,
  error,
}: {
  id: string
  locale: Locale
  value: number
  onChange: (lead: number) => void
  /** The first date (YYYY-MM-DD), for "Sat, Oct 10 will appear from Sat, Oct 3." */
  firstDate: string
  error?: FieldError | null
}) {
  const hintId = `${id}-hint`
  const exampleId = `${id}-example`
  const example =
    isCalendarDate(firstDate) && isAnnounceLead(value)
      ? formatMessage(eventFormT(locale, 'leadExample'), {
          date: formatCalendarDate(firstDate, locale),
          from: formatCalendarDate(announceFromDate(firstDate, value), locale),
        })
      : null
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={LABEL}>
        {eventFormT(locale, 'leadLegend')}
      </label>
      <select
        id={id}
        className={INPUT}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-field="lead"
        {...invalidProps(`${id}-err`, error, example ? `${hintId} ${exampleId}` : hintId)}
      >
        {ANNOUNCE_LEAD_PRESETS.map((n) => (
          <option key={n} value={n}>
            {eventFormT(locale, ANNOUNCE_LEAD_KEYS[n])}
          </option>
        ))}
      </select>
      <p id={hintId} className="text-xs text-stone-700">
        {eventFormT(locale, 'leadHint')}
      </p>
      {example && (
        <p id={exampleId} className="text-xs text-stone-700">
          {example}
        </p>
      )}
      <FieldErrorText id={`${id}-err`} locale={locale} error={error} />
    </div>
  )
}

/** Focus the first control of a field marked data-field (a space-separated list) in `root`. */
export function focusField(root: ParentNode | null, field: string): void {
  root?.querySelector<HTMLElement>(`[data-field~="${field}"]`)?.focus()
}
