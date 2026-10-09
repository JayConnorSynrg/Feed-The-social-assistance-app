// apps/web/src/components/events/cancel-date-confirm.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The cancel-date confirmation shared by the admin scheduler and the event card menu (extracted from
// event-scheduler.tsx in R1), driven with the mini hook runtime: one cancel_event_occurrence call
// per confirmation however fast the clicks, the save labelled with the surface it came from, a
// refusal shown translated in the dialog (never database text) and dropped on close.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  calls: [] as unknown[],
  answer: { ok: true } as unknown,
  hold: null as null | ((v: unknown) => void),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/event-admin-rpc', () => ({
  cancelEventOccurrence: (_sb: unknown, input: unknown) => {
    h.calls.push(input)
    return new Promise((res) => {
      if (h.hold === null) res(h.answer)
      else h.hold = res
    })
  },
}))

import { mount, findAll } from '@/test/mini-react'
import { CancelDateConfirm, type CancelDateTarget } from './cancel-date-confirm'

const TARGET: CancelDateTarget = {
  occurrenceId: 'occ-1',
  eventId: 'ev-1',
  orgId: 'org-1',
  title: 'Saturday pantry',
  startsAt: '2099-10-24T14:00:00Z',
  endsAt: '2099-10-24T16:00:00Z',
  timeZone: 'America/New_York',
}

beforeEach(() => {
  h.calls = []
  h.answer = { ok: true }
  h.hold = null
})

type El = { type: unknown; props: Record<string, unknown> }
function setup(target: CancelDateTarget | null = TARGET) {
  const events: string[] = []
  const props = { target, closes: 0 }
  const m = mount(() =>
    CancelDateConfirm({
      target: props.target,
      locale: 'en',
      surface: 'feed_card',
      onClose: () => {
        events.push('close')
        props.target = null
      },
      onCancelled: (t) => events.push(`cancelled:${t.occurrenceId}`),
    }),
  )
  const buttons = () => findAll(m.tree(), (el) => el.type === 'button') as El[]
  const confirmButton = () => buttons().find((b) => JSON.stringify(b.props.children).includes('Cancel date'))!
  const keepButton = () => buttons().find((b) => JSON.stringify(b.props.children).includes('Keep'))!
  const alerts = () => findAll(m.tree(), (el) => el.props.role === 'alert') as El[]
  return { m, events, props, confirmButton, keepButton, alerts }
}

describe('CancelDateConfirm', () => {
  it('confirm: ONE call for this date with the surface label, then the owner hears it', async () => {
    const s = setup()
    ;(s.confirmButton().props.onClick as () => void)()
    await s.m.flush()
    expect(h.calls).toEqual([{ occurrenceId: 'occ-1', eventId: 'ev-1', orgId: 'org-1', surface: 'feed_card' }])
    expect(s.events).toEqual(['cancelled:occ-1'])
  })

  it('a double click while the call runs: still one call', async () => {
    h.hold = () => {}
    const s = setup()
    const click = s.confirmButton().props.onClick as () => void
    click()
    click()
    expect(h.calls).toHaveLength(1)
    h.hold!({ ok: true })
    await s.m.flush()
    expect(s.events).toEqual(['cancelled:occ-1'])
  })

  it('refused: the translated reason in the dialog; closing drops it, so reopening starts clean', async () => {
    h.answer = { ok: false, code: 'P0001', errorKey: 'errCancelEnded', field: null, localTime: null }
    const s = setup()
    ;(s.confirmButton().props.onClick as () => void)()
    await s.m.flush()
    expect(s.alerts().map((a) => a.props.children)).toEqual([expect.stringMatching(/\S/)])
    expect(JSON.stringify(s.m.tree())).not.toContain('P0001')
    ;(s.keepButton().props.onClick as () => void)()
    expect(s.events).toEqual(['close'])
    s.props.target = TARGET
    s.m.rerender()
    expect(s.alerts()).toEqual([])
  })
})
