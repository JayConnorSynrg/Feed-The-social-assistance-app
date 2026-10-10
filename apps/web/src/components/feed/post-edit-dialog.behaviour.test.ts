// apps/web/src/components/feed/post-edit-dialog.behaviour.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// PostEditDialog on the mini hook runtime, the server answers faked at editPost / loadEditSource:
// a double Save sends one edit; a post found gone shows "gone" and leaves the feed however the
// dialog closes; a field that locked while the dialog was open (a vote landed) is put back to its
// saved value, explained, and never sent again; nothing is sent while a photo is uploading.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  sources: [] as unknown[],
  edits: [] as Array<{ changes: Record<string, unknown>; expectedVersion: number }>,
  editReplies: [] as Array<() => Promise<unknown>>,
  picker: { imageUploading: false } as Record<string, unknown>,
}))

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('./post-edit-data', async (orig) => ({
  ...(await orig<object>()),
  loadEditSource: async () => h.sources.shift() ?? { status: 'error' },
  loadFeedRow: async () => null,
}))
vi.mock('@/lib/post-rpc', async (orig) => ({
  ...(await orig<object>()),
  editPost: (_c: unknown, input: { changes: Record<string, unknown>; expectedVersion: number }) => {
    h.edits.push({ changes: input.changes, expectedVersion: input.expectedVersion })
    const next = h.editReplies.shift()
    return next ? next() : Promise.resolve({ ok: true, value: { version: 2, editedAt: null, editCount: 1, grace: false, changed: [] } })
  },
}))
vi.mock('./post-image-picker', async (orig) => ({
  ...(await orig<object>()),
  usePostImagePicker: () => h.picker,
}))
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: (t: number) => void) => (cb(0), 0)

import { mount, findAll } from '@/test/mini-react'
import { PostEditDialog } from './post-edit-dialog'
import { PostFormFields } from './post-form-fields'
import { Dialog } from '@/components/ui/dialog'
import { fieldLabel, lockReasonText } from '@/lib/i18n-feed-edit'

const POLL = {
  id: 'p1',
  post_type: 'poll',
  content: 'Which day works?',
  metadata: {},
  image_url: null,
  image_alt: null,
  max_seekers: null,
  resource_id: null,
  version: 4,
  edited_at: null,
  is_hidden: false,
  hidden_reason: null,
  poll: { question: 'Which day works?', options: ['Sat', 'Sun'], ends_at: null },
}
const NOTE = { ...POLL, post_type: 'feed', content: 'Soup at 5', poll: undefined }
const found = (source: unknown, pollVotes = 0) => ({ status: 'found', source, facts: { pollVotes, committedOptIns: 0, pollEndsAt: null } })

type El = { type: unknown; props: Record<string, unknown> }
const calls = { saved: [] as unknown[], gone: [] as string[], closed: 0 }

beforeEach(() => {
  h.sources.length = 0
  h.edits.length = 0
  h.editReplies.length = 0
  h.picker = {
    imageUploading: false,
    imageUrl: null,
    previewUrl: null,
    imageError: null,
    fileInputRef: { current: null },
    handleFileSelect: () => {},
    clearImage: () => {},
    resetAfterPost: () => {},
  }
  calls.saved = []
  calls.gone = []
  calls.closed = 0
})

async function open(postType: string) {
  const c = mount(() =>
    PostEditDialog({
      post: { id: 'p1', postType: postType as 'poll' },
      locale: 'en',
      onClose: () => void calls.closed++,
      onSaved: (...a: unknown[]) => void calls.saved.push(a),
      onGone: (id: string) => void calls.gone.push(id),
    }),
  )
  await c.flush()
  return c
}
const fields = (tree: unknown) => findAll(tree, (e) => e.type === PostFormFields)[0] as El
const form = (tree: unknown) => findAll(tree, (e) => e.type === 'form')[0] as El
const submit = (tree: unknown) => (form(tree).props.onSubmit as (e: unknown) => void)({ preventDefault() {} })
const type = (c: ReturnType<typeof mount>, patch: Record<string, unknown>) => {
  const f = fields(c.tree())
  ;(f.props.onChange as (d: unknown) => void)({ ...(f.props.draft as object), ...patch })
  c.rerender()
}
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id)

describe('PostEditDialog', () => {
  it('a double Save sends one edit', async () => {
    h.sources.push(found(NOTE))
    let release!: (v: unknown) => void
    h.editReplies.push(() => new Promise((r) => (release = r)))
    const c = await open('feed')
    type(c, { content: 'Soup at 6' })
    const tree = c.tree()
    submit(tree)
    submit(tree)
    await Promise.resolve()
    release({ ok: true, value: { version: 5, editedAt: null, editCount: 1, grace: false, changed: ['content'] } })
    await c.flush()
    expect(h.edits).toHaveLength(1)
    expect(h.edits[0]).toEqual({ changes: { content: 'Soup at 6' }, expectedVersion: 4 })
  })

  it('a post found gone (PT404) says so, and closing the dialog any way takes its card out', async () => {
    h.sources.push(found(NOTE))
    h.editReplies.push(async () => ({ ok: false, failure: { kind: 'not_found', token: 'post_not_found' } }))
    const c = await open('feed')
    type(c, { content: 'Soup at 6' })
    submit(c.tree())
    await c.flush()
    expect(byTestId(c.tree(), 'edit-gone')).toHaveLength(1)
    expect(calls.gone).toEqual([])
    // Escape / the X / an outside close all arrive as onOpenChange(false).
    ;((findAll(c.tree(), (e) => e.type === Dialog)[0] as El).props.onOpenChange as (o: boolean) => void)(false)
    expect(calls.gone).toEqual(['p1'])
    expect(calls.closed).toBe(1)
  })

  it('a field that locked while open (a vote landed) is reset, explained, and never sent again', async () => {
    h.sources.push(found(POLL, 0), found(POLL, 1))
    h.editReplies.push(async () => ({ ok: false, failure: { kind: 'locked', field: 'content', hint: null } }))
    const c = await open('poll')
    type(c, { content: 'Which weekend day works?' })
    submit(c.tree())
    await c.flush()
    // The question is back to its saved text, and the banner names the field and why it locked.
    expect((fields(c.tree()).props.draft as { content: string }).content).toBe('Which day works?')
    const banner = findAll(c.tree(), (e) => e.type === 'p' && e.props.role === 'alert')[0] as El
    const text = ([] as unknown[]).concat(banner.props.children).join('')
    expect(text).toContain(`${fieldLabel('en', 'poll', 'content')}: ${lockReasonText('poll_voted', 'en')}`)
    // Even if the locked text comes back into the draft, a later Save does not send it.
    type(c, { content: 'Which weekend day works?' })
    submit(c.tree())
    await c.flush()
    expect(h.edits.map((e) => Object.keys(e.changes))).toEqual([['content']])
  })

  it('nothing is sent while a photo is uploading', async () => {
    h.sources.push(found(NOTE))
    const c = await open('feed')
    type(c, { content: 'Soup at 6' })
    h.picker.imageUploading = true
    c.rerender()
    submit(c.tree())
    await c.flush()
    expect(h.edits).toEqual([])
  })
})
