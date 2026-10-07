// apps/web/src/app/(admin)/moderation/event-repeat-field.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The repeat + lead part of the event forms, as the admin meets it:
//   - the preview asks preview_event_recurrence once per pause in typing, drops the answer to an
//     earlier question, aborts the request in flight when the form changes or closes, and a
//     failure only says so (saving never consults it);
//   - one polite announcement per settled change, nothing while loading;
//   - fieldsets with legends, native radios / checkboxes with full weekday names (Sunday first),
//     errors tied to their controls, and the "first date is not one of the dates" message shown
//     before any submit;
//   - "Post to the feed" offers the six presets with an example from the first date.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, withMetric: vi.fn() }))

import {
  LeadField,
  RepeatField,
  RepeatPreview,
  createPreviewController,
  patternMessage,
  previewAnnouncement,
  previewInputOf,
  type PreviewFetch,
  type PreviewState,
} from './event-repeat-field'
import { defaultRecurrenceForm, type RecurrenceFormState } from '@/lib/event-recurrence'
import type { PreviewDate, PreviewInput } from '@/lib/event-admin-rpc'
import { sameDayTime } from '@/lib/event-form-model'

const input = (start: string): PreviewInput => ({
  rule: { frequency: 'weekly', byDay: [{ day: 'sa' }] },
  startsLocal: `2026-10-10T${start}`,
  endsLocal: '2026-10-10T11:00',
  timeZone: 'America/New_York',
  orgId: 'org-1',
})
const date = (d: string): PreviewDate => ({ localDate: d, startsAt: `${d}T13:00:00Z`, endsAt: `${d}T15:00:00Z`, shifted: false })

describe('preview requests', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const pending: Array<{ input: PreviewInput; signal: AbortSignal; resolve: (r: Awaited<ReturnType<PreviewFetch>>) => void }> = []
    const fetchDates: PreviewFetch = (i, signal) => new Promise((resolve) => pending.push({ input: i, signal, resolve }))
    const states: PreviewState[] = []
    const ctrl = createPreviewController(fetchDates, (s) => states.push(s), 400)
    return { pending, states, ctrl }
  }

  it('a burst of changes asks ONCE, after the pause, with the last values', async () => {
    const { pending, ctrl } = setup()
    ctrl.request(input('09:00'))
    ctrl.request(input('09:15'))
    ctrl.request(input('09:30'))
    await vi.advanceTimersByTimeAsync(399)
    expect(pending).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(pending.map((p) => p.input.startsLocal)).toEqual(['2026-10-10T09:30'])
  })

  it('a change while a request is in flight aborts it and ignores its late answer', async () => {
    const { pending, states, ctrl } = setup()
    ctrl.request(input('09:00'))
    await vi.advanceTimersByTimeAsync(400)
    ctrl.request(input('10:00'))
    expect(pending[0].signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(400)
    pending[1].resolve({ ok: true, dates: [date('2026-10-17')] })
    pending[0].resolve({ ok: true, dates: [date('2026-10-10')] }) // late, stale
    await vi.runAllTimersAsync()
    const ready = states.filter((s) => s.status === 'ready')
    expect(ready).toEqual([{ status: 'ready', dates: [date('2026-10-17')] }])
  })

  it('closing the form aborts the request in flight and nothing settles afterwards', async () => {
    const { pending, states, ctrl } = setup()
    ctrl.request(input('09:00'))
    await vi.advanceTimersByTimeAsync(400)
    ctrl.close()
    expect(pending[0].signal.aborted).toBe(true)
    pending[0].resolve({ ok: true, dates: [date('2026-10-10')] })
    await vi.runAllTimersAsync()
    expect(states.map((s) => s.status)).toEqual(['loading'])
  })

  it('closing before the pause ends sends nothing', async () => {
    const { pending, ctrl } = setup()
    ctrl.request(input('09:00'))
    ctrl.close()
    await vi.runAllTimersAsync()
    expect(pending).toHaveLength(0)
  })

  it('a failed preview settles as an error; no rule means idle (no request)', async () => {
    const { pending, states, ctrl } = setup()
    ctrl.request(input('09:00'))
    await vi.advanceTimersByTimeAsync(400)
    pending[0].resolve({ ok: false, aborted: false })
    await vi.runAllTimersAsync()
    expect(states.at(-1)).toEqual({ status: 'error' })
    ctrl.request(null)
    await vi.runAllTimersAsync()
    expect(states.at(-1)).toEqual({ status: 'idle' })
    expect(pending).toHaveLength(1)
  })

  it('the request a form asks for: none while the rule or the times are incomplete', () => {
    const rule = { frequency: 'weekly' as const, byDay: [{ day: 'sa' as const }] }
    expect(previewInputOf(null, sameDayTime('2026-10-10', '09:00', '11:00'), 'America/New_York', 'o')).toBeNull()
    expect(previewInputOf(rule, sameDayTime('2026-10-10', '', '11:00'), 'America/New_York', 'o')).toBeNull()
    expect(previewInputOf(rule, sameDayTime('2026-10-10', '09:00', '11:00'), 'America/New_York', 'o')).toEqual({
      rule,
      startsLocal: '2026-10-10T09:00',
      endsLocal: '2026-10-10T11:00',
      timeZone: 'America/New_York',
      orgId: 'o',
    })
  })
})

describe('preview announcement (polite, once per settled change)', () => {
  it('nothing while loading or idle; the summary + first date when ready; the error / empty sentence otherwise', () => {
    expect(previewAnnouncement({ status: 'loading' }, 'S', null, 'en')).toBeNull()
    expect(previewAnnouncement({ status: 'idle' }, 'S', null, 'en')).toBeNull()
    expect(previewAnnouncement({ status: 'ready', dates: [date('2026-10-10')] }, 'Every week on Saturday', 'Sat, Oct 10', 'en')).toBe(
      'Every week on Saturday. Next dates: Sat, Oct 10',
    )
    expect(previewAnnouncement({ status: 'ready', dates: [] }, 'S', null, 'en')).toBe(
      'This pattern has no upcoming dates. Check the start date and when it ends.',
    )
    expect(previewAnnouncement({ status: 'error' }, 'S', null, 'en')).toBe('The next dates could not be shown. You can still save.')
  })

  it('the preview section renders a polite status region and the pattern in words', () => {
    const html = renderToStaticMarkup(
      h(RepeatPreview, {
        supabase: {} as never,
        locale: 'en',
        rule: { frequency: 'weekly', byDay: [{ day: 'sa' }], until: '2027-04-10T23:59:59' },
        time: sameDayTime('2026-10-10', '09:00', '11:00'),
        timeZone: 'America/New_York',
        orgId: 'org-1',
      }),
    )
    expect(html).toMatch(/<p role="status" class="sr-only"><\/p>/)
    expect(html).toContain('Every week on Saturday. Ends Sat, Apr 10, 2027')
  })
})

function repeatHtml(value: RecurrenceFormState, startDate: string, errors = {}) {
  return renderToStaticMarkup(h(RepeatField, { idPrefix: 'r', locale: 'en', value, onChange: () => {}, startDate, errors }))
}

describe('RepeatField', () => {
  it('weekly: Repeat / How often / Days of the week / Ends are fieldsets with legends; seven native checkboxes, full names, Sunday first', () => {
    const html = repeatHtml({ ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly' }, '2026-10-10')
    const legends = [...html.matchAll(/<legend[^>]*>([^<]*)<\/legend>/g)].map((m) => m[1])
    expect(legends).toEqual(['Repeat', 'How often', 'Days of the week', 'Ends'])
    expect(html.match(/type="checkbox"/g)).toHaveLength(7)
    const days = [...html.matchAll(/type="checkbox"[^>]*\/>([A-Za-z]+)<\/label>/g)].map((m) => m[1])
    expect(days).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    expect(html.match(/type="radio"/g)).toHaveLength(3 + 4 + 3)
    // Targets: every choice row is at least 40 px tall.
    expect(html.match(/class="flex min-h-10 cursor-pointer/g)).toHaveLength(3 + 4 + 7 + 3)
  })

  it('says before any submit that the first date is not one of the dates, tied to the days group', () => {
    // Sat Oct 10 start, Tuesday pattern.
    const value = { ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly' as const, weekdays: ['tu' as const] }
    const html = repeatHtml(value, '2026-10-10')
    expect(html).toContain('<p id="r-pattern-err" class="text-sm text-red-700">The start date is not one of the repeating dates.')
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="r-pattern-err"/)
    expect(patternMessage(value, '2026-10-10', {})).toEqual({ key: 'errRepeatStartNotInPattern' })
    expect(patternMessage({ ...value, weekdays: ['sa'] }, '2026-10-10', {})).toBeNull()
  })

  it('monthly: the choices the first date offers, in words; the last-day note for day 31', () => {
    const html = repeatHtml({ ...defaultRecurrenceForm('2026-10-31'), repeat: 'monthly' }, '2026-10-31')
    const labels = [...html.matchAll(/type="radio"[^>]*name="r-monthly"[^>]*\/>([^<]+)<\/label>/g)].map((m) => m[1])
    expect(labels).toEqual(['Monthly on day 31', 'Monthly on the last Saturday'])
    expect(html).toContain('Months without a day 31 are skipped.')
  })

  it('Ends on a date: the date input is labelled, carries its error and the first-error focus marker', () => {
    const html = repeatHtml({ ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly' }, '2026-10-10', {
      until: { key: 'errRepeatUntilBeforeStart' },
    })
    expect(html).toMatch(/<label for="r-until"[^>]*>Last date<\/label>/)
    expect(html).toMatch(/id="r-until"[^>]*data-field="until"[^>]*aria-invalid="true"[^>]*aria-describedby="r-until-err"/)
    expect(html).toContain('value="2027-04-10"')
  })

  it('does not repeat: only the Repeat group', () => {
    const html = repeatHtml(defaultRecurrenceForm('2026-10-10'), '2026-10-10')
    expect([...html.matchAll(/<legend/g)]).toHaveLength(1)
  })
})

describe('LeadField', () => {
  it('six presets, 1 week before selected by default, and an example from the first date', () => {
    const html = renderToStaticMarkup(h(LeadField, { id: 'l', locale: 'en', value: 7, onChange: () => {}, firstDate: '2026-10-10' }))
    const options = [...html.matchAll(/<option value="(\d+)"[^>]*>([^<]+)<\/option>/g)].map((m) => [m[1], m[2]])
    expect(options).toEqual([
      ['0', 'On the day'],
      ['1', '1 day before'],
      ['3', '3 days before'],
      ['7', '1 week before'],
      ['14', '2 weeks before'],
      ['30', '30 days before'],
    ])
    expect(html).toContain('Sat, Oct 10, 2026 will appear from Sat, Oct 3, 2026.')
    expect(html).toMatch(/aria-describedby="l-hint l-example"/)
  })
})

describe('errors on the control that takes focus (not only the group)', () => {
  it('days of the week: the focused checkbox is invalid and described by the message', () => {
    const value = { ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly' as const, weekdays: [] }
    const html = repeatHtml(value, '2026-10-10', { weekdays: { key: 'errRepeatNoDays' } })
    expect(html).toMatch(/<input type="checkbox"[^>]*data-field="weekdays pattern"[^>]*aria-invalid="true"[^>]*aria-describedby="r-weekdays-err"/)
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1)
  })

  it('pattern: the checked weekday / monthly choice points at the message', () => {
    const weekly = repeatHtml({ ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly', weekdays: ['tu'] }, '2026-10-10')
    expect(weekly).toMatch(/data-field="weekdays pattern"[^>]*aria-invalid="true"[^>]*aria-describedby="r-pattern-err"/)
    const monthly = repeatHtml({ ...defaultRecurrenceForm('2026-10-10'), repeat: 'monthly' }, '2026-10-10', {
      monthly: { key: 'errRepeatMonthly' },
    })
    expect(monthly).toMatch(/data-field="monthly pattern"[^>]*aria-invalid="true"[^>]*aria-describedby="r-monthly-err"/)
  })

  it('how often: the checked interval radio carries its error', () => {
    const html = repeatHtml({ ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly' }, '2026-10-10', { interval: { key: 'errRepeatInterval' } })
    expect(html).toMatch(/data-field="interval"[^>]*aria-invalid="true"[^>]*aria-describedby="r-interval-err"/)
  })

  it('no error: no control is marked invalid', () => {
    expect(repeatHtml({ ...defaultRecurrenceForm('2026-10-10'), repeat: 'weekly' }, '2026-10-10')).not.toContain('aria-invalid')
  })
})
