// apps/web/src/app/(admin)/moderation/extend-series-button.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Repeat for 6 more months", as the admin and the database see it: a double tap sends ONE
// extend_event_series call; a retry after a failure re-sends the SAME idempotency key (the
// server answers the first result, replayed, and writes nothing); the next extend after a
// success uses a new key. The button stays focusable while it works. Also: the edit form starts
// from the event's stored series, and the org Overview's ending-soon list offers Extend per row.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { ExtendSeriesButton, extendButtonName, runExtend } from './extend-series-button'
import { StopRepeatConfirm, focusAfterFailedSave, initialEditDraft, placeSaveError, type EditTarget } from '@/components/events/event-edit-dialog'
import { EDIT_FIELD_ORDER, firstErrorField } from '@/lib/event-form-model'
import { EndingSoonView } from './org/org-overview'
import { createSubmitController } from '@/lib/event-form-model'

function fakeSupabase(results: Array<{ data: unknown; error: { code?: string; message: string } | null }>) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      const result = results[calls.length - 1] ?? results[results.length - 1]
      return { setHeader: () => gate.then(() => result) }
    },
  }
  return { client: client as never, calls, release }
}

const ok = { data: { until: '2027-04-30T23:59:59', generated: 26, replayed: false }, error: null }
const keys = () => {
  let n = 0
  return () => `key-${++n}`
}

describe('extend in one tap, exactly once', () => {
  it('a second tap while the first is in flight sends nothing', async () => {
    const sb = fakeSupabase([ok])
    const ctrl = createSubmitController(keys())
    const first = runExtend(ctrl, sb.client, { eventId: 'e-1', orgId: 'org-1' })
    const second = await runExtend(ctrl, sb.client, { eventId: 'e-1', orgId: 'org-1' })
    expect(second).toEqual({ status: 'busy' })
    sb.release()
    expect(await first).toMatchObject({ status: 'done', result: { ok: true, until: '2027-04-30T23:59:59' } })
    expect(sb.calls).toEqual([{ name: 'extend_event_series', args: { p_event_id: 'e-1', p_idempotency_key: 'key-1' } }])
  })

  it('a retry after a failure re-sends the same key; after a success the next extend has a new key', async () => {
    const sb = fakeSupabase([{ data: null, error: { message: 'Failed to fetch' } }, ok, ok])
    sb.release()
    const ctrl = createSubmitController(keys())
    const target = { eventId: 'e-1', orgId: 'org-1' }
    expect(await runExtend(ctrl, sb.client, target)).toMatchObject({ status: 'done', result: { ok: false, errorKey: 'errNetwork' } })
    await runExtend(ctrl, sb.client, target)
    await runExtend(ctrl, sb.client, target)
    expect(sb.calls.map((c) => c.args.p_idempotency_key)).toEqual(['key-1', 'key-1', 'key-2'])
  })

  it('each button is named after its event, starting with its visible text, and is never disabled', () => {
    const html = renderToStaticMarkup(
      h(ExtendSeriesButton, { eventId: 'e-1', orgId: 'org-1', title: 'Saturday pantry', locale: 'en', describedBy: 's', onExtended: () => {} }),
    )
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Repeat for 6 more months: Saturday pantry"[^>]*aria-describedby="s"[^>]*>Repeat for 6 more months<\/button>/)
    expect(html).not.toMatch(/disabled=""/)
  })

  it('busy and other languages: the name still starts with what the button shows', () => {
    expect(extendButtonName('en', 'Clinic', true)).toBe('Extending…: Clinic')
    expect(extendButtonName('es', 'Clínica', false)).toBe('Repetir 6 meses más: Clínica')
    expect(extendButtonName('zh', '诊所', false)).toBe('再重复 6 个月：诊所')
  })
})

describe('edit form starts from the stored series', () => {
  const base: EditTarget = {
    id: 'e-1',
    org_id: 'org-1',
    title: 'Saturday pantry',
    event_type: 'pantry',
    description: null,
    location_name: null,
    time_zone: 'America/New_York',
    is_active: true,
    recurrence: { frequency: 'weekly', byDay: [{ day: 'sa' }], until: '2027-04-10T23:59:59' },
    series_start_local: '2026-10-10T09:00:00',
    series_duration: '02:00:00',
    announce_days_before: 3,
    next: { starts_at: '2026-10-17T13:00:00Z', ends_at: '2026-10-17T15:00:00Z' },
  }

  it('a series: its rule, first date and times, and lead — and saving untouched sends none of them', () => {
    const d = initialEditDraft(base)
    expect(d.recurrence).toMatchObject({ repeat: 'weekly', weekdays: ['sa'], end: 'until', untilDate: '2027-04-10' })
    expect(d.time).toEqual({ date: '2026-10-10', start: '09:00', endDate: '2026-10-10', end: '11:00' })
    expect(d.announce).toBe(3)
    expect(d.stored).toEqual({ rule: base.recurrence, time: d.time, announce: 3 })
  })

  it('a one-off event: its next date on the venue clock is the proposed first date', () => {
    const d = initialEditDraft({ ...base, recurrence: null, series_start_local: null, series_duration: null, announce_days_before: 7 })
    expect(d.recurrence.repeat).toBe('none')
    expect(d.time).toEqual({ date: '2026-10-17', start: '09:00', endDate: '2026-10-17', end: '11:00' })
    expect(d.stored.rule).toBeNull()
  })
})

describe('org Overview: repeating events ending within 30 days', () => {
  it('one row per series with its last date (or "ended") and Extend; the status line is polite', () => {
    const html = renderToStaticMarkup(
      h(EndingSoonView, {
        series: [
          { eventId: 'e-1', title: 'Saturday pantry', lastDate: '2026-10-31', remaining: 4 },
          { eventId: 'e-2', title: 'Clinic', lastDate: '2026-09-30', remaining: 0 },
        ],
        state: 'ready',
        notice: '',
        orgId: 'org-1',
        onRetry: () => {},
        onExtended: () => {},
      }),
    )
    expect(html).toContain('Ending soon: the last date is Sat, Oct 31, 2026.')
    expect(html).toContain('The repeating dates have ended.')
    expect(html.match(/>Repeat for 6 more months<\/button>/g)).toHaveLength(2)
    expect(html).toMatch(/aria-label="Repeat for 6 more months: Saturday pantry"[^>]*aria-describedby="ending-e-1-end"/)
    expect(html).toMatch(/aria-label="Repeat for 6 more months: Clinic"/)
    expect(html).toMatch(/<p role="status"/)
    expect(html).toMatch(/<h2 id="org-ending-soon-heading" tabindex="-1"/)
  })

  it('a failed load is an error with Try again, not an empty list', () => {
    const html = renderToStaticMarkup(
      h(EndingSoonView, { series: null, state: 'error', notice: '', orgId: 'org-1', onRetry: () => {}, onExtended: () => {} }),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
    expect(html).not.toContain('No repeating event ends')
  })
})

describe('stop-repeating confirmation and edit focus', () => {
  const confirm = (busy: boolean) =>
    renderToStaticMarkup(h(StopRepeatConfirm, { idPrefix: 's', locale: 'en', busy, onConfirm: () => {}, onCancel: () => {} }))

  it('the confirm button says what it does (not the form\'s "Save changes"); "Saving…" while it runs', () => {
    expect(confirm(false)).toMatch(/<button type="button"[^>]*>Stop repeating and save<\/button>/)
    expect(confirm(false)).not.toContain('Save changes')
    expect(confirm(true)).toMatch(/aria-disabled="true"[^>]*>.*Saving…<\/button>/)
    expect(confirm(false)).toMatch(/role="group" aria-labelledby="s-title" aria-describedby="s-body"/)
    // Stopping keeps the next date as a one-off event; later repeat dates without check-ins go.
    expect(confirm(false)).toContain(
      'The next date stays as a single event. Later repeat dates without check-ins are removed; dates that already have check-ins are kept.',
    )
  })

  it('a failed stop-confirm save with no field message returns focus to Save changes', () => {
    expect(focusAfterFailedSave(placeSaveError(null), true)).toBe('submit')
    expect(focusAfterFailedSave(placeSaveError('timeZone'), true)).toBe('submit')
    expect(focusAfterFailedSave(placeSaveError('pattern'), true)).toBe('field')
    expect(focusAfterFailedSave(placeSaveError(null), false)).toBe('stay')
  })

  it('Edit focuses the first error in ITS document order: the repeat section before the first date’s times', () => {
    const errors = { date: { key: 'errDateRequired' as const }, pattern: { key: 'errRepeatStartNotInPattern' as const } }
    expect(firstErrorField(errors, EDIT_FIELD_ORDER)).toBe('pattern')
    expect(firstErrorField(errors)).toBe('date')
    // Then the times, then "Post to the feed", then the location — as they appear in Edit.
    expect(firstErrorField({ lead: { key: 'errLeadPreset' }, end: { key: 'errRepeatTooLong' } }, EDIT_FIELD_ORDER)).toBe('end')
    expect(firstErrorField({ location: { key: 'errConfirmPin' }, lead: { key: 'errLeadPreset' } }, EDIT_FIELD_ORDER)).toBe('lead')
  })
})
