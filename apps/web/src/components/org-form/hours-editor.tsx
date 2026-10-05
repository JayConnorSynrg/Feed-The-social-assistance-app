// apps/web/src/components/org-form/hours-editor.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Weekly opening-hours editor shared by the admin organization panel (and the member business form
// in a later PR). Controlled by a flat BusinessHours[]; every edit runs through the pure transitions
// in hours-model.ts and emits rows ordered by day, then interval. Each day is a fieldset with a
// legend, an Open/Closed switch (role="switch"), one or more intervals with 15-minute <select>s,
// "Open 24 hours", and copy-to-weekdays / copy-to-all-days. Zero-length, overlapping and invalid
// 24:00 intervals are flagged inline; the parent blocks the save while validateHours() reports any.

'use client'

import { useCallback, useId, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { logEvent } from '@/lib/logger'
import type { BusinessHours } from '@/lib/business'
import type { Locale } from '@/lib/i18n'
import { orgFormT, formatMessage, type OrgFormMessages } from '@/lib/i18n-org-forms'
import {
  DISPLAY_DAY_ORDER,
  addInterval,
  copyToAllDays,
  copyToWeekdays,
  hoursControlNames,
  is24Hours,
  isOvernight,
  minutesOf,
  removeInterval,
  rowsForDay,
  setDayOpen,
  setOpen24,
  timeOptions,
  updateInterval,
  validateHours,
  type HoursIssue,
  type HoursIssueKind,
} from './hours-model'

export interface HoursEditorProps {
  value: BusinessHours[]
  onChange: (next: BusinessHours[]) => void
  locale: Locale
  /** Shown above the days (e.g. "some saved hours were cleared"). */
  notice?: string | null
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const SELECT =
  'h-10 min-w-[7.5rem] rounded-lg border border-stone-500 bg-white px-2 text-sm text-stone-900 ' + FOCUS_RING
const LINK_BUTTON =
  'inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-brand hover:bg-stone-100 ' + FOCUS_RING
const ICON_BUTTON =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-600 hover:bg-stone-200 hover:text-stone-900 ' +
  FOCUS_RING

const ISSUE_KEYS: Record<HoursIssueKind, keyof OrgFormMessages> = {
  zero_length: 'hoursErrZero',
  overlap: 'hoursErrOverlap',
  invalid_24: 'hoursErr24',
}

/** Localized weekday name for day_of_week (0 = Sunday). 2023-01-01 was a Sunday. */
function dayName(locale: Locale, day: number): string {
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, 1 + day))
    )
  } catch {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
  }
}

/** Localized clock label for 'HH:MM' ('24:00' reads as midnight). */
function clockLabel(locale: Locale, value: string, midnight: string): string {
  const minutes = minutesOf(value)
  if (minutes === null) return value
  if (minutes === 1440) return midnight
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, 1, Math.floor(minutes / 60), minutes % 60))
    )
  } catch {
    return value
  }
}

export function HoursEditor({ value, onChange, locale, notice }: HoursEditorProps) {
  const tr = useCallback((key: keyof OrgFormMessages) => orgFormT(locale, key), [locale])
  const uid = useId()
  const issues = useMemo(() => validateHours(value), [value])

  // Emit, and record each newly-introduced kind of invalid interval (kind only — no times, no ids).
  const emit = useCallback(
    (next: BusinessHours[]) => {
      const before = new Set(issues.map((i) => i.kind))
      const after = new Set(validateHours(next).map((i) => i.kind))
      for (const kind of after) if (!before.has(kind)) logEvent('admin.hours.invalid', { kind })
      onChange(next)
    },
    [issues, onChange]
  )

  const issueFor = (day: number, index: number): HoursIssue | undefined =>
    issues.find((i) => i.day === day && i.index === index)
  const namesFor = (day: string, index: number, count: number) =>
    hoursControlNames({
      day,
      index,
      count,
      label: {
        opens: tr('hoursOpens'),
        closes: tr('hoursCloses'),
        remove: tr('hoursRemove'),
        copyWeekdays: tr('hoursCopyWeekdays'),
        copyAll: tr('hoursCopyAll'),
        add: tr('hoursAdd'),
        open24: tr('hours24'),
        setHours: tr('hours24Undo'),
        intervalName: (d, n) => formatMessage(tr('hoursIntervalName'), { day: d, n }),
      },
    })

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}
      {DISPLAY_DAY_ORDER.map((day) => {
        const intervals = rowsForDay(value, day)
        const open = intervals.length > 0
        const allDay = intervals.length === 1 && is24Hours(intervals[0])
        const name = dayName(locale, day)
        const dayNames = namesFor(name, 0, intervals.length)
        const dayIssues = [...new Set(issues.filter((i) => i.day === day).map((i) => tr(ISSUE_KEYS[i.kind])))]
        return (
          <fieldset
            key={day}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5"
          >
            <legend className="sr-only">{name}</legend>
            {/* Inline errors for this day, announced as they appear. */}
            <p aria-live="polite" className="sr-only">
              {dayIssues.join(' ')}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span aria-hidden="true" className="w-28 text-sm font-semibold text-stone-900">
                {name}
              </span>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <Switch
                  checked={open}
                  onCheckedChange={(checked) => emit(setDayOpen(value, day, checked))}
                  aria-label={dayNames.toggle}
                  className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-stone-500"
                />
                <span aria-hidden="true">{open ? tr('hoursOpen') : tr('hoursClosed')}</span>
              </label>
              {open && (
                <div className="ms-auto flex flex-wrap gap-1">
                  <button type="button" className={LINK_BUTTON} aria-label={dayNames.copyWeekdays} onClick={() => emit(copyToWeekdays(value, day))}>
                    {tr('hoursCopyWeekdays')}
                  </button>
                  <button type="button" className={LINK_BUTTON} aria-label={dayNames.copyAll} onClick={() => emit(copyToAllDays(value, day))}>
                    {tr('hoursCopyAll')}
                  </button>
                </div>
              )}
            </div>

            {open && allDay && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-stone-900">{tr('hours24')}</span>
                <button
                  type="button"
                  className={LINK_BUTTON}
                  aria-label={dayNames.setHours}
                  onClick={() => emit(setDayOpen(setDayOpen(value, day, false), day, true))}
                >
                  {tr('hours24Undo')}
                </button>
              </div>
            )}

            {open && !allDay && (
              <div className="mt-2 flex flex-col gap-2">
                {intervals.map((iv, index) => {
                  const issue = issueFor(day, index)
                  const errorId = `${uid}-err-${day}-${index}`
                  const options = timeOptions([iv.open_time, iv.close_time])
                  const names = namesFor(name, index, intervals.length)
                  const overnight = isOvernight(iv)
                  const nextDayId = `${uid}-next-${day}-${index}`
                  const closeDescribedBy = [issue ? errorId : null, overnight ? nextDayId : null].filter(Boolean).join(' ') || undefined
                  const openOptions = options.filter((o) => o !== '24:00')
                  return (
                    <div key={index} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm text-stone-700">
                          <span className="sr-only">{names.opens}</span>
                          <span aria-hidden="true">{tr('hoursOpens')}</span>
                          <select
                            className={SELECT}
                            value={iv.open_time}
                            aria-invalid={issue ? true : undefined}
                            aria-describedby={issue ? errorId : undefined}
                            onChange={(e) => emit(updateInterval(value, day, index, { open_time: e.target.value }))}
                          >
                            {openOptions.map((o) => (
                              <option key={o} value={o}>
                                {clockLabel(locale, o, tr('hoursMidnight'))}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-stone-700">
                          <span className="sr-only">{names.closes}</span>
                          <span aria-hidden="true">{tr('hoursCloses')}</span>
                          <select
                            className={SELECT}
                            value={iv.close_time}
                            aria-invalid={issue ? true : undefined}
                            aria-describedby={closeDescribedBy}
                            onChange={(e) => emit(updateInterval(value, day, index, { close_time: e.target.value }))}
                          >
                            {options.map((o) => (
                              <option key={o} value={o}>
                                {clockLabel(locale, o, tr('hoursMidnight'))}
                              </option>
                            ))}
                          </select>
                        </label>
                        {overnight && (
                          <span id={nextDayId} className="text-sm text-stone-600">
                            {tr('hoursNextDay')}
                          </span>
                        )}
                        {intervals.length > 1 && (
                          <button
                            type="button"
                            className={ICON_BUTTON}
                            aria-label={names.remove}
                            onClick={() => emit(removeInterval(value, day, index))}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {issue && (
                        <p id={errorId} className="text-sm text-red-700">
                          {tr(ISSUE_KEYS[issue.kind])}
                        </p>
                      )}
                    </div>
                  )
                })}
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={LINK_BUTTON} aria-label={dayNames.add} onClick={() => emit(addInterval(value, day))}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {tr('hoursAdd')}
                  </button>
                  <button type="button" className={LINK_BUTTON} aria-label={dayNames.open24} onClick={() => emit(setOpen24(value, day))}>
                    {tr('hours24')}
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        )
      })}
    </div>
  )
}
