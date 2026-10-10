// apps/web/src/components/feed/report-dialog.behaviour.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Reporting a post: the reason is required (said to assistive tech, and nothing is sent without
// one); after the report is sent the form is replaced by the confirmation and focus moves to it.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
const h = vi.hoisted(() => ({ frames: [] as Array<() => void>, focused: [] as string[] }))
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => (h.frames.push(cb), h.frames.length)

import { mount, findAll } from '@/test/mini-react'
import { ReportDialog } from './report-dialog'
import { DialogContent } from '@/components/ui/dialog'
import { Select, SelectTrigger } from '@/components/ui/select'

type El = { type: unknown; props: Record<string, unknown> }
const one = (tree: unknown, pred: (e: El) => boolean) => findAll(tree, pred as never)[0] as El

beforeEach(() => {
  h.frames.length = 0
  h.focused.length = 0
})

describe('ReportDialog', () => {
  it('the reason is required: marked so, and nothing is sent without it', async () => {
    const sent: unknown[] = []
    const c = mount(() => ReportDialog({ postId: 'p1', locale: 'en', onSubmit: async (...a) => void sent.push(a), onClose: () => {} }))
    const tree = c.tree()
    expect(one(tree, (e) => e.type === Select).props.required).toBe(true)
    expect(one(tree, (e) => e.type === SelectTrigger).props['aria-required']).toBe('true')
    expect(one(tree, (e) => e.props['data-testid'] === 'report-submit-p1').props.disabled).toBe(true)
    ;(one(tree, (e) => e.props['data-testid'] === 'report-submit-p1').props.onClick as () => void)()
    await c.flush()
    expect(sent).toEqual([])
    // A dialog with no description says so (Radix would otherwise point at a missing one).
    const content = one(tree, (e) => e.type === DialogContent)
    expect('aria-describedby' in content.props && content.props['aria-describedby'] === undefined).toBe(true)
  })

  it('after sending, focus moves to the confirmation', async () => {
    const c = mount(() => ReportDialog({ postId: 'p1', locale: 'en', onSubmit: async () => {}, onClose: () => {} }))
    ;(one(c.tree(), (e) => e.type === Select).props.onValueChange as (v: string) => void)('spam')
    c.rerender()
    ;(one(c.tree(), (e) => e.props['data-testid'] === 'report-submit-p1').props.onClick as () => void)()
    const tree = await c.flush()
    const done = one(tree, (e) => e.props['data-testid'] === 'report-done')
    expect(done.props.tabIndex).toBe(-1)
    ;(done.props.ref as { current: unknown }).current = { focus: () => void h.focused.push('report-done') }
    while (h.frames.length) h.frames.shift()!()
    expect(h.focused).toEqual(['report-done'])
  })
})
