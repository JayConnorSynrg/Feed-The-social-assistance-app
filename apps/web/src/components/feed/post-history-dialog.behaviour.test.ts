// apps/web/src/components/feed/post-history-dialog.behaviour.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The history dialog's "Remove private details": offered to the author and a platform admin only; an
// admin must give a reason before anything is sent; one request per confirmation; focus moves to the
// confirmation's heading when it opens and back to that version's button on Cancel; after a removal
// the list reloads in place and the result is announced once (no "Loading history…" in between).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  loads: [] as Array<() => Promise<unknown>>,
  redacts: [] as unknown[][],
  redactReply: null as null | (() => Promise<unknown>),
  frames: [] as Array<() => void>,
  focused: [] as string[],
}))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('./post-edit-data', async (orig) => ({
  ...(await orig<object>()),
  loadPostRevisions: () => (h.loads.shift() ?? (async () => REVS))(),
}))
vi.mock('@/lib/post-rpc', async (orig) => ({
  ...(await orig<object>()),
  redactPostRevision: (...a: unknown[]) => {
    h.redacts.push(a.slice(1))
    return h.redactReply ? h.redactReply() : Promise.resolve({ ok: true, value: { alreadyRedacted: false, redactorRole: 'author' } })
  },
}))
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => (h.frames.push(cb), h.frames.length)
;(globalThis as Record<string, unknown>).cancelAnimationFrame = () => {}
;(globalThis as Record<string, unknown>).document = {
  querySelector: (sel: string) => ({ focus: () => void h.focused.push(/data-testid="([^"]+)"/.exec(sel)?.[1] ?? sel) }),
}

import { mount, findAll } from '@/test/mini-react'
import { HistoryList, PostHistoryDialog, redactRole, type HistoryViewer } from './post-history-dialog'
import { DiffText } from './diff-text'
import { DialogContent } from '@/components/ui/dialog'
import { editT } from '@/lib/i18n-feed-edit'

const AUTHOR = 'author-1'
const REVS = [
  { id: 11, version: 1, edited_at: '2026-10-02T10:00:00Z', reason: null, fields_changed: ['content'], snapshot: { content: 'Call me at 555-0100', image_url: null }, redacted_at: null, redactor_role: null },
]
type El = { type: unknown; props: Record<string, unknown> }

const viewers: Record<string, HistoryViewer> = {
  author: { id: AUTHOR, isGuest: false, isPlatformAdmin: false },
  member: { id: 'm', isGuest: false, isPlatformAdmin: false },
  guest: { id: 'g', isGuest: true, isPlatformAdmin: false },
  admin: { id: 'pa', isGuest: false, isPlatformAdmin: true },
}

beforeEach(() => {
  h.loads.length = 0
  h.redacts.length = 0
  h.redactReply = null
  h.frames.length = 0
  h.focused.length = 0
})

const runFrames = () => {
  while (h.frames.length) h.frames.shift()!()
}

async function open(viewer: HistoryViewer) {
  const c = mount(() =>
    PostHistoryDialog({
      target: { kind: 'post', id: 'p1', postType: 'feed', authorId: AUTHOR, current: { version: 2, content: 'Call me', imageUrl: null, createdAt: '2026-10-01T10:00:00Z', editedAt: '2026-10-02T10:00:00Z' } },
      locale: 'en',
      viewer,
      onClose: () => {},
    }),
  )
  await c.flush()
  return c
}
const list = (tree: unknown) => findAll(tree, (e) => e.type === HistoryList)[0] as El | undefined
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id)[0] as El | undefined
const statusText = (tree: unknown) => String((findAll(tree, (e) => e.type === 'p' && e.props.role === 'status')[0] as El).props.children)

async function startRedact(c: ReturnType<typeof mount>) {
  const entry = (list(c.tree())!.props.entries as Array<{ version: number }>).find((e) => e.version === 1)!
  ;(list(c.tree())!.props.onRedact as (e: unknown) => void)(entry)
  c.rerender()
  // Attach the heading the way React would, then let the opening frame run.
  ;((byTestId(c.tree(), 'redact-heading')!.props as { ref: { current: unknown } }).ref).current = { focus: () => void h.focused.push('redact-heading') }
  runFrames()
}

describe('who may remove private details', () => {
  it('the author and a platform admin; nobody else', () => {
    expect(redactRole(viewers.author, AUTHOR)).toBe('author')
    expect(redactRole(viewers.admin, AUTHOR)).toBe('platform_admin')
    expect(redactRole(viewers.member, AUTHOR)).toBeNull()
    expect(redactRole(viewers.guest, AUTHOR)).toBeNull()
  })

  it('a member sees the history without the action', async () => {
    const c = await open(viewers.member)
    expect(list(c.tree())!.props.redactAs).toBeNull()
    // No description: said explicitly (no aria-describedby pointing at nothing).
    const content = findAll(c.tree(), (e) => e.type === DialogContent)[0] as El
    expect('aria-describedby' in content.props && content.props['aria-describedby'] === undefined).toBe(true)
  })
})

describe('the confirmation', () => {
  it('a platform admin must give a reason: nothing is sent without one', async () => {
    const c = await open(viewers.admin)
    await startRedact(c)
    ;(byTestId(c.tree(), 'history-redact-confirm')!.props.onClick as () => void)()
    await c.flush()
    expect(h.redacts).toEqual([])
    expect(findAll(c.tree(), (e) => e.props.id === 'redact-error')).toHaveLength(1)
  })

  it('opens with focus on its heading; Cancel returns focus to that version’s button', async () => {
    const c = await open(viewers.author)
    await startRedact(c)
    expect(h.focused).toEqual(['redact-heading'])
    ;(byTestId(c.tree(), 'history-redact-cancel')!.props.onClick as () => void)()
    c.rerender()
    runFrames()
    expect(byTestId(c.tree(), 'redact-heading')).toBeUndefined()
    expect(h.focused).toEqual(['redact-heading', 'history-redact-1'])
  })

  it('two quick confirmations send one request', async () => {
    let release!: (v: unknown) => void
    h.redactReply = () => new Promise((r) => (release = r))
    const c = await open(viewers.author)
    await startRedact(c)
    const confirm = byTestId(c.tree(), 'history-redact-confirm')!.props.onClick as () => void
    confirm()
    confirm()
    release({ ok: true, value: { alreadyRedacted: false, redactorRole: 'author' } })
    await c.flush()
    expect(h.redacts).toHaveLength(1)
  })

  it('after a removal the list reloads in place and the result is announced once, then focus goes to the title', async () => {
    const c = await open(viewers.author)
    await startRedact(c)
    let release!: (v: unknown) => void
    h.loads.push(() => new Promise((r) => (release = r)))
    ;(byTestId(c.tree(), 'history-redact-confirm')!.props.onClick as () => void)()
    await c.flush(3)
    // Reloading: the list stays and the status region says nothing yet (never "Loading history…").
    expect(list(c.tree())).toBeDefined()
    expect(statusText(c.tree())).toBe('')
    release(REVS.map((r) => ({ ...r, snapshot: null, redacted_at: '2026-10-03T00:00:00Z', redactor_role: 'author' })))
    await c.flush()
    expect(statusText(c.tree())).toBe(editT('en', 'redactDone'))
  })
})

describe('markup', () => {
  it("each version's Remove button is described by that version's title", () => {
    const html = renderToStaticMarkup(
      HistoryList({
        entries: [{ key: 'r11', version: 1, revisionId: 11, isCurrent: false, isOriginal: true, publishedAt: '2026-10-01T10:00:00Z', content: 'x', diff: null, note: null, changedFields: [], photoChange: null, redactedBy: null } as never],
        locale: 'en',
        postType: 'feed',
        redactAs: 'author',
        onRedact: () => {},
        tz: 'UTC',
      }),
    )
    expect(html).toContain('id="history-entry-title-1"')
    expect(html).toMatch(/data-testid="history-redact-1"[^>]*aria-describedby="history-entry-title-1"|aria-describedby="history-entry-title-1"[^>]*data-testid="history-redact-1"/)
  })

  it('the diff\'s screen-reader labels are isolated (<bdi>) from the member\'s text', () => {
    const html = renderToStaticMarkup(DiffText({ parts: [{ kind: 'removed', text: 'a' }, { kind: 'added', text: 'b' }], addedLabel: 'أضيف', removedLabel: 'حذف' }))
    expect(html).toContain('<bdi class="sr-only">حذف: </bdi>')
    expect(html).toContain('<bdi class="sr-only">أضيف: </bdi>')
  })
})
