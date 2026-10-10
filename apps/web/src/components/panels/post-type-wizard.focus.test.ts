// apps/web/src/components/panels/post-type-wizard.focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The composer's checks before posting: when a field is wrong, focus moves to the first such field
// (in form order) — its message is linked to it — and nothing is sent.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({ focused: [] as string[], created: 0, ids: new Set<string>() }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/post-rpc', async (orig) => ({ ...(await orig<object>()), createPost: async () => (h.created++, { ok: true, value: 'new' }) }))
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => (cb(), 0)
;(globalThis as Record<string, unknown>).document = {
  // Only the ids the poll form really renders (read from its markup below) can be focused.
  getElementById: (id: string) => (h.ids.has(id) ? { focus: () => void h.focused.push(id) } : null),
  querySelector: () => null,
}

import { mount, findAll } from '@/test/mini-react'
import { StructuredForm } from './post-type-wizard'
import { PostFormFields } from '@/components/feed/post-form-fields'
import { EMPTY_DRAFT } from '@/components/feed/post-edit-model'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The element ids in the poll form's real markup (prefix wizard-poll, as StructuredForm renders it).
const markup = renderToStaticMarkup(createElement(PostFormFields, { postType: 'poll', draft: EMPTY_DRAFT, onChange: () => {}, mode: 'create', locale: 'en', idPrefix: 'wizard-poll' }))
for (const m of markup.matchAll(/ id="([^"]+)"/g)) h.ids.add(m[1])

type El = { type: unknown; props: Record<string, unknown> }

beforeEach(() => {
  h.focused.length = 0
  h.created = 0
})

async function poll(question: string, options: string[], pollEndsAt = '') {
  const c = mount(() => StructuredForm({ kind: 'poll', locale: 'en', resourceOptions: [], onCreated: () => {}, onDone: () => {} }))
  const f = findAll(c.tree(), (e) => e.type === PostFormFields)[0] as El
  ;(f.props.onChange as (d: unknown) => void)({ ...(f.props.draft as object), content: question, options, pollEndsAt })
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

  it('the deadline, when it is in the past (its error and its input share the ends_at id)', async () => {
    await poll('Which day works?', ['Sat', 'Sun'], '2020-01-01T10:00')
    expect(h.focused).toEqual(['wizard-poll-ends_at'])
    expect(h.created).toBe(0)
  })

  it('nothing is focused when the post is valid (it is sent)', async () => {
    await poll('Which day works?', ['Sat', 'Sun'])
    expect(h.focused).toEqual([])
    expect(h.created).toBe(1)
  })
})
