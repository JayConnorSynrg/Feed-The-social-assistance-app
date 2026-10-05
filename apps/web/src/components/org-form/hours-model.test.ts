// apps/web/src/components/org-form/hours-model.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Outcomes of the HoursEditor model (the component runs exactly these transitions).

import { describe, it, expect } from 'vitest'
import type { BusinessHours } from '@/lib/business'
import {
  addInterval,
  copyToAllDays,
  copyToWeekdays,
  hoursControlNames,
  isOvernight,
  normalizeLoadedHours,
  presetHours,
  removeInterval,
  rowsForDay,
  setDayOpen,
  setOpen24,
  timeOptions,
  updateInterval,
  validateHours,
} from './hours-model'

const h = (day: number, open: string, close: string): BusinessHours => ({ day_of_week: day, open_time: open, close_time: close })

describe('preset', () => {
  it('mon-fri-9-5 opens Mon–Fri 09:00–17:00 and leaves Sat/Sun closed', () => {
    const rows = presetHours('mon-fri-9-5')
    expect(rows).toEqual([1, 2, 3, 4, 5].map((d) => h(d, '09:00', '17:00')))
    expect(rowsForDay(rows, 0)).toEqual([])
    expect(rowsForDay(rows, 6)).toEqual([])
  })
  it('none starts with every day closed', () => {
    expect(presetHours('none')).toEqual([])
  })
})

describe('open/closed switch', () => {
  it('switching a closed day on fills 09:00–17:00', () => {
    expect(setDayOpen([], 6, true)).toEqual([h(6, '09:00', '17:00')])
  })
  it('switching a day off removes only that day', () => {
    const rows = presetHours('mon-fri-9-5')
    expect(setDayOpen(rows, 3, false).map((r) => r.day_of_week)).toEqual([1, 2, 4, 5])
  })
  it('switching an already-open day on keeps its hours', () => {
    expect(setDayOpen([h(2, '07:00', '11:00')], 2, true)).toEqual([h(2, '07:00', '11:00')])
  })
})

describe('add / update / remove intervals', () => {
  it('Add hours appends a second interval starting at the last close', () => {
    expect(addInterval([h(1, '09:00', '12:00')], 1)).toEqual([h(1, '09:00', '12:00'), h(1, '12:00', '13:00')])
  })
  it('removing the last interval closes the day', () => {
    expect(removeInterval([h(1, '09:00', '12:00')], 1, 0)).toEqual([])
  })
  it('update edits exactly one interval', () => {
    const rows = [h(1, '09:00', '12:00'), h(1, '13:00', '17:00')]
    expect(updateInterval(rows, 1, 1, { close_time: '18:00' })).toEqual([h(1, '09:00', '12:00'), h(1, '13:00', '18:00')])
  })
})

describe('copy + 24 hours', () => {
  it('Copy to weekdays copies the source day onto Mon–Fri only', () => {
    const rows = [h(1, '08:00', '12:00'), h(1, '13:00', '16:00'), h(6, '10:00', '14:00')]
    const out = copyToWeekdays(rows, 1)
    for (const d of [1, 2, 3, 4, 5]) expect(rowsForDay(out, d)).toEqual([h(d, '08:00', '12:00'), h(d, '13:00', '16:00')])
    expect(rowsForDay(out, 6)).toEqual([h(6, '10:00', '14:00')])
    expect(rowsForDay(out, 0)).toEqual([])
  })
  it('Copy to all days copies a closed day as closed too', () => {
    const out = copyToAllDays(presetHours('mon-fri-9-5'), 0)
    expect(out).toEqual([])
  })
  it('Open 24 hours stores 00:00–24:00 and is valid', () => {
    const out = setOpen24(presetHours('mon-fri-9-5'), 3)
    expect(rowsForDay(out, 3)).toEqual([h(3, '00:00', '24:00')])
    expect(validateHours(out)).toEqual([])
  })
})

describe('overnight', () => {
  it('a close before the open ends the next day and does not overlap the next morning', () => {
    const rows = [h(5, '22:00', '02:00'), h(6, '09:00', '17:00')]
    expect(isOvernight(rows[0])).toBe(true)
    expect(isOvernight(h(1, '09:00', '17:00'))).toBe(false)
    expect(isOvernight(h(1, '00:00', '24:00'))).toBe(false)
    expect(validateHours(rows)).toEqual([])
  })
  it('an overnight interval that runs into the next day’s hours is an overlap', () => {
    const issues = validateHours([h(5, '22:00', '02:00'), h(6, '01:00', '05:00')])
    expect(issues.map((i) => [i.day, i.kind])).toEqual([[5, 'overlap'], [6, 'overlap']])
  })
  it('Saturday overnight wrapping into Sunday is checked across the week boundary', () => {
    expect(validateHours([h(6, '22:00', '03:00'), h(0, '02:00', '06:00')]).map((i) => i.kind)).toEqual(['overlap', 'overlap'])
  })
})

describe('blocked intervals', () => {
  it('zero-length is blocked', () => {
    expect(validateHours([h(1, '09:00', '09:00')])).toEqual([{ day: 1, index: 0, kind: 'zero_length' }])
  })
  it('overlapping intervals on one day are blocked; back-to-back is fine', () => {
    expect(validateHours([h(1, '09:00', '12:00'), h(1, '11:00', '14:00')]).map((i) => i.kind)).toEqual(['overlap', 'overlap'])
    expect(validateHours([h(1, '09:00', '12:00'), h(1, '12:00', '14:00')])).toEqual([])
  })
  it('24:00 closes only an interval that opens at 00:00', () => {
    expect(validateHours([h(1, '09:00', '24:00')])).toEqual([{ day: 1, index: 0, kind: 'invalid_24' }])
  })
})

describe('row order', () => {
  it('emits rows ordered by day, then interval position', () => {
    const out = setDayOpen(setDayOpen(addInterval([h(3, '09:00', '12:00')], 3), 0, true), 1, true)
    expect(out.map((r) => `${r.day_of_week} ${r.open_time}`)).toEqual(['0 09:00', '1 09:00', '3 09:00', '3 12:00'])
  })
})

describe('loaded data', () => {
  it('keeps an off-step value as an extra option so nothing is silently changed', () => {
    const opts = timeOptions(['00:01'])
    expect(opts).toContain('00:01')
    expect(opts.indexOf('00:01')).toBe(1)
    expect(timeOptions()).not.toContain('00:01')
    expect(timeOptions()).toHaveLength(96)
  })
  it('trims HH:MM:SS to HH:MM', () => {
    expect(normalizeLoadedHours([h(2, '09:00:00', '17:30:00')]).rows).toEqual([h(2, '09:00', '17:30')])
  })
  it('drops zero-length intervals (00:00–00:00) and counts them; keeps 00:01–00:00 as overnight', () => {
    const stored = [
      h(0, '00:00:00', '00:00:00'),
      h(1, '00:00:00', '00:00:00'),
      h(2, '00:01:00', '00:00:00'),
      h(3, '00:00:00', '00:00:00'),
    ]
    const { rows, droppedZeroLength } = normalizeLoadedHours(stored)
    expect(droppedZeroLength).toBe(3)
    expect(rows).toEqual([h(2, '00:01', '00:00')])
    expect(isOvernight(rows[0])).toBe(true)
    expect(validateHours(rows)).toEqual([])
  })
})

describe('accessible control names', () => {
  const label = {
    opens: 'Opens',
    closes: 'Closes',
    remove: 'Remove these hours',
    copyWeekdays: 'Copy to weekdays',
    copyAll: 'Copy to all days',
    add: 'Add hours',
    open24: 'Open 24 hours',
    setHours: 'Set hours',
    intervalName: (d: string, n: number) => `${d}, hours ${n}`,
  }
  it('one interval: names carry the day', () => {
    const n = hoursControlNames({ day: 'Monday', index: 0, count: 1, label })
    expect(n.opens).toBe('Monday Opens')
    expect(n.add).toBe('Monday: Add hours')
    expect(n.copyWeekdays).toBe('Monday: Copy to weekdays')
    expect(n.open24).toBe('Monday: Open 24 hours')
    expect(n.setHours).toBe('Monday: Set hours')
    // The switch name is the visible day label, not a state phrase that contradicts "Closed".
    expect(n.toggle).toBe('Monday')
  })
  it('several intervals: every Opens/Closes/Remove name is unique', () => {
    const a = hoursControlNames({ day: 'Monday', index: 0, count: 2, label })
    const b = hoursControlNames({ day: 'Monday', index: 1, count: 2, label })
    expect(b.opens).toBe('Monday, hours 2 Opens')
    expect(new Set([a.opens, b.opens, a.closes, b.closes, a.remove, b.remove]).size).toBe(6)
  })
})

