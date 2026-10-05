// apps/web/src/components/org-form/hours-model.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure state transitions behind <HoursEditor>. The editor is controlled by a flat BusinessHours[]
// (the exact shape admin_save_organization's `hours` key takes), so every edit here is
// rows -> rows and the result is always emitted ordered by day, then by interval position.
//
// Rules mirror the save RPC: an interval may not open and close at the same minute, '24:00' only
// closes an all-day interval that opens at '00:00', and a close at or before the open is an
// overnight interval that ends the next day. Two intervals overlapping anywhere in the week
// (overnight spill included) are rejected here so the editor can block the save inline.

import type { BusinessHours } from '@/lib/business'

export type HoursPreset = 'mon-fri-9-5' | 'none'
export type HoursIssueKind = 'zero_length' | 'overlap' | 'invalid_24'
export interface HoursIssue {
  day: number
  index: number
  kind: HoursIssueKind
}

export const DEFAULT_OPEN = '09:00'
export const DEFAULT_CLOSE = '17:00'
/** Display order: Monday first, Sunday last (day_of_week 0 = Sunday). */
export const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
export const WEEKDAYS = [1, 2, 3, 4, 5] as const
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const
const DAY = 1440
const WEEK = 10080
export const STEP_MINUTES = 15

/** 'HH:MM' | 'HH:MM:SS' -> minutes (0..1440, '24:00' -> 1440), or null when malformed. */
export function minutesOf(t: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h === 24 && min === 0) return DAY
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** minutes (0..1440) -> 'HH:MM'. */
export function hhmm(minutes: number): string {
  if (minutes >= DAY) return '24:00'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Postgres time 'HH:MM:SS' -> 'HH:MM' (stored values arrive with seconds in edit mode). */
export function trimSeconds(t: string): string {
  const m = /^(\d{2}:\d{2})(?::\d{2})?$/.exec(t.trim())
  return m ? m[1] : t.trim()
}

export function is24Hours(row: Pick<BusinessHours, 'open_time' | 'close_time'>): boolean {
  return row.open_time === '00:00' && row.close_time === '24:00'
}

/** Close at or before open (and not the all-day 00:00–24:00) => the interval ends the next day. */
export function isOvernight(row: Pick<BusinessHours, 'open_time' | 'close_time'>): boolean {
  const open = minutesOf(row.open_time)
  const close = minutesOf(row.close_time)
  if (open === null || close === null || close === DAY) return false
  return close < open || (close === 0 && open > 0)
}

/** Interval length in minutes; 0 for a zero-length or unparseable interval. */
export function durationOf(row: Pick<BusinessHours, 'open_time' | 'close_time'>): number {
  const open = minutesOf(row.open_time)
  const close = minutesOf(row.close_time)
  if (open === null || close === null) return 0
  if (close === DAY) return open === 0 ? DAY : DAY - open
  return (((close - open) % DAY) + DAY) % DAY
}

/** Stable sort by day — the interval order within a day is preserved. */
export function orderRows(rows: readonly BusinessHours[]): BusinessHours[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.day_of_week - b.r.day_of_week || a.i - b.i)
    .map((x) => x.r)
}

export function presetHours(preset: HoursPreset): BusinessHours[] {
  if (preset === 'none') return []
  return WEEKDAYS.map((day) => ({ day_of_week: day, open_time: DEFAULT_OPEN, close_time: DEFAULT_CLOSE }))
}

/**
 * Normalize hours loaded from the database for editing: trim seconds, drop zero-length intervals
 * (the save RPC rejects them, so re-saving them would fail), drop exact duplicates, order by day.
 * `droppedZeroLength` lets the editor tell the admin their hours need attention.
 */
export function normalizeLoadedHours(rows: readonly BusinessHours[]): {
  rows: BusinessHours[]
  droppedZeroLength: number
} {
  let droppedZeroLength = 0
  const seen = new Set<string>()
  const out: BusinessHours[] = []
  for (const r of rows) {
    const row = { day_of_week: r.day_of_week, open_time: trimSeconds(r.open_time), close_time: trimSeconds(r.close_time) }
    if (minutesOf(row.open_time) === null || minutesOf(row.close_time) === null) continue
    if (durationOf(row) === 0) {
      droppedZeroLength++
      continue
    }
    const key = `${row.day_of_week}|${row.open_time}|${row.close_time}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return { rows: orderRows(out), droppedZeroLength }
}

export function rowsForDay(rows: readonly BusinessHours[], day: number): BusinessHours[] {
  return rows.filter((r) => r.day_of_week === day)
}

/** Replace one day's intervals, keeping the result ordered by day. */
export function replaceDay(
  rows: readonly BusinessHours[],
  day: number,
  intervals: ReadonlyArray<Pick<BusinessHours, 'open_time' | 'close_time'>>
): BusinessHours[] {
  return orderRows([
    ...rows.filter((r) => r.day_of_week !== day),
    ...intervals.map((iv) => ({ day_of_week: day, open_time: iv.open_time, close_time: iv.close_time })),
  ])
}

/** Switch a day open (filling 09:00–17:00 when it has no hours) or closed (removing its hours). */
export function setDayOpen(rows: readonly BusinessHours[], day: number, open: boolean): BusinessHours[] {
  if (!open) return replaceDay(rows, day, [])
  if (rowsForDay(rows, day).length > 0) return orderRows(rows)
  return replaceDay(rows, day, [{ open_time: DEFAULT_OPEN, close_time: DEFAULT_CLOSE }])
}

/** Append one more interval to a day: from the last close, one hour long. */
export function addInterval(rows: readonly BusinessHours[], day: number): BusinessHours[] {
  const current = rowsForDay(rows, day)
  if (current.length === 0) return setDayOpen(rows, day, true)
  const last = current[current.length - 1]
  const lastClose = minutesOf(last.close_time) ?? 17 * 60
  const start = lastClose % DAY
  const end = (start + 60) % DAY
  return replaceDay(rows, day, [...current, { open_time: hhmm(start), close_time: hhmm(end) }])
}

export function updateInterval(
  rows: readonly BusinessHours[],
  day: number,
  index: number,
  patch: Partial<Pick<BusinessHours, 'open_time' | 'close_time'>>
): BusinessHours[] {
  const current = rowsForDay(rows, day)
  if (!current[index]) return orderRows(rows)
  return replaceDay(rows, day, current.map((iv, i) => (i === index ? { ...iv, ...patch } : iv)))
}

/** Remove one interval; removing the last one closes the day. */
export function removeInterval(rows: readonly BusinessHours[], day: number, index: number): BusinessHours[] {
  return replaceDay(rows, day, rowsForDay(rows, day).filter((_, i) => i !== index))
}

export function setOpen24(rows: readonly BusinessHours[], day: number): BusinessHours[] {
  return replaceDay(rows, day, [{ open_time: '00:00', close_time: '24:00' }])
}

/** Copy one day's hours (or its closed state) onto each target day. */
export function copyDay(rows: readonly BusinessHours[], from: number, targets: readonly number[]): BusinessHours[] {
  const source = rowsForDay(rows, from)
  let next: BusinessHours[] = [...rows]
  for (const day of targets) {
    if (day === from) continue
    next = replaceDay(next, day, source)
  }
  return orderRows(next)
}

export const copyToWeekdays = (rows: readonly BusinessHours[], from: number) => copyDay(rows, from, WEEKDAYS)
export const copyToAllDays = (rows: readonly BusinessHours[], from: number) => copyDay(rows, from, ALL_DAYS)

/** Every 15-minute step of the day, plus any off-step value in `keep` so nothing is silently changed. */
export function timeOptions(keep: readonly string[] = []): string[] {
  const set = new Set<string>()
  for (let m = 0; m < DAY; m += STEP_MINUTES) set.add(hhmm(m))
  for (const v of keep) if (minutesOf(v) !== null) set.add(v)
  return [...set].sort((a, b) => (minutesOf(a) ?? 0) - (minutesOf(b) ?? 0))
}

/** Every rule the save RPC enforces, plus week-wide overlap. One issue per offending interval. */
export function validateHours(rows: readonly BusinessHours[]): HoursIssue[] {
  const issues: HoursIssue[] = []
  const spans: { day: number; index: number; start: number; end: number }[] = []
  for (const day of ALL_DAYS) {
    rowsForDay(rows, day).forEach((row, index) => {
      if (row.close_time === '24:00' && row.open_time !== '00:00') {
        issues.push({ day, index, kind: 'invalid_24' })
        return
      }
      const dur = durationOf(row)
      if (dur === 0) {
        issues.push({ day, index, kind: 'zero_length' })
        return
      }
      const start = day * DAY + (minutesOf(row.open_time) ?? 0)
      spans.push({ day, index, start, end: start + dur })
    })
  }
  const overlapping = new Set<number>()
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i]
      const b = spans[j]
      const hit = [-WEEK, 0, WEEK].some((shift) => a.start < b.end + shift && b.start + shift < a.end)
      if (hit) {
        overlapping.add(i)
        overlapping.add(j)
      }
    }
  }
  for (const i of [...overlapping].sort((x, y) => x - y)) {
    issues.push({ day: spans[i].day, index: spans[i].index, kind: 'overlap' })
  }
  return issues
}

/**
 * Accessible names for one day's hours controls. With more than one interval the interval number is
 * part of each name ("Monday, hours 2 Opens"), so two selects never share a name.
 */
export function hoursControlNames(args: {
  day: string
  index: number
  count: number
  label: {
    opens: string
    closes: string
    remove: string
    copyWeekdays: string
    copyAll: string
    add: string
    open24: string
    intervalName: (day: string, n: number) => string
  }
}): { opens: string; closes: string; remove: string; copyWeekdays: string; copyAll: string; add: string; open24: string } {
  const { day, index, count, label } = args
  const subject = count > 1 ? label.intervalName(day, index + 1) : day
  return {
    opens: `${subject} ${label.opens}`,
    closes: `${subject} ${label.closes}`,
    remove: `${subject}: ${label.remove}`,
    copyWeekdays: `${day}: ${label.copyWeekdays}`,
    copyAll: `${day}: ${label.copyAll}`,
    add: `${day}: ${label.add}`,
    open24: `${day}: ${label.open24}`,
  }
}
