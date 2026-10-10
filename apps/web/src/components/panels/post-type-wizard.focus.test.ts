// apps/web/src/components/panels/post-type-wizard.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The composer's checks before posting: when a field is wrong, focus moves to the first such field
// (in form order) — its message is linked to it — and nothing is sent.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({ focused: [] as string[], created: 0 }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/post-rpc', async (orig) => ({ ...(await orig<object>()), createPost: async () => (h.created++, { ok: true, value: 'new' }) }))
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => (cb(), 0)
;(globalThis as Record<string, unknown>).document = {
  // The ids the poll form renders: its question and each option (index 0, 1, …).
  getElementById: (id: string) => (/^wizard-poll-(content|options-\d+)$/.test(id) ? { focus: () => void h.focused.push(id) } : null),
  querySelector: () => null,
}

import { mount, findAll } from '@/test/mini-react'
import { StructuredForm } from './post-type-wizard'
import { PostFormFields } from '@/components/feed/post-form-fields'

type El = { type: unknown; props: Record<string, unknown> }

beforeEach(() => {
  h.focused.length = 0
  h.created = 0
})

async function poll(question: string, options: string[]) {
  const c = mount(() => StructuredForm({ kind: 'poll', locale: 'en', resourceOptions: [], onCreated: () => {}, onDone: () => {} }))
  const f = findAll(c.tree(), (e) => e.type === PostFormFields)[0] as El
  ;(f.props.onChange as (d: unknown) => void)({ ...(f.props.draft as object), content: question, options })
  c.rerender()
  const form = findAll(c.tree(), (e) => e.type === 'form')[0] as El
  await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} })
  await c.flush()
  return c
}

describe('the composer focuses the first field with an error', () => {
  it('the question first, when it is too short', async () => {
    await poll('Hi', ['', ''])
    expect(h.focused).toEqual(['wizard-poll-content'])
    expect(h.created).toBe(0)
  })

  it('the first option, when the question is fine and an option is empty', async () => {
    await poll('Which day works?', ['Sat', ''])
    expect(h.focused).toEqual(['wizard-poll-options-0'])
    expect(h.created).toBe(0)
  })

  it('nothing is focused when the post is valid (it is sent)', async () => {
    await poll('Which day works?', ['Sat', 'Sun'])
    expect(h.focused).toEqual([])
    expect(h.created).toBe(1)
  })
})
