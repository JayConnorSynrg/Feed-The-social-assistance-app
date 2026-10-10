// apps/web/src/components/feed/comment-thread.edit.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Editing a comment while the thread refreshes: the draft and the open editor are held by the thread
// (like reply text), so a realtime refetch — which remounts every row — keeps them, and only choosing
// Edit moves focus into the editor (a remount never steals it). Save does nothing for an empty or
// unchanged text. Each comment's action buttons are described by its author's name.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  loading: false,
  frames: [] as Array<() => void>,
  stable: {} as Record<string, unknown>,
}))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', async (orig) => ({
  ...(await orig<object>()),
  useAuth: () => (h.stable.auth ??= { user: { id: 'me', email: 'me@x' }, isAuthenticated: true, isAnonymous: false }),
}))
vi.mock('@/hooks/use-admin-viewer', async (orig) => ({ ...(await orig<object>()), useAdminViewer: () => (h.stable.viewer ??= { status: 'ready', tier: null }) }))
vi.mock('@/hooks/use-realtime-feed', async (orig) => ({ ...(await orig<object>()), useRealtimeComments: () => {} }))
vi.mock('@/hooks/use-comments', async (orig) => ({
  ...(await orig<object>()),
  useComments: () => ({
    rows: h.rows,
    loading: h.loading,
    error: null,
    submitting: false,
    fetchComments: (h.stable.fetch ??= async () => {}),
    addComment: async () => true,
    addReply: async () => true,
  }),
}))
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => (h.frames.push(cb), h.frames.length)

import { mount, findAll } from '@/test/mini-react'
import { CommentRow, CommentThread, type RowContext } from './comment-thread'
import type { Comment } from '@/hooks/use-comments'

const comment = (o: Partial<Comment> = {}): Comment => ({
  id: 'c1',
  post_id: 'p1',
  user_id: 'me',
  content: 'See you at 5',
  parent_id: null,
  is_hidden: false,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  version: 1,
  edited_at: null,
  edit_count: 0,
  deleted_at: null,
  user: { id: 'me', first_name: 'Ada', avatar_url: null, admin_tier: null } as Comment['user'],
  replies: [],
  ...o,
})

type El = { type: unknown; props: Record<string, unknown> }
const ctxOf = (tree: unknown) => (findAll(tree, (e) => e.type === CommentRow)[0] as El).props.ctx as RowContext

beforeEach(() => {
  h.rows = [comment()]
  h.loading = false
  h.frames.length = 0
})

describe('editing a comment while the thread refreshes', () => {
  it('a refetch (rows remount) keeps the open editor and the draft', async () => {
    const c = mount(() => CommentThread({ postId: 'p1', locale: 'en' }))
    await c.flush()
    ctxOf(c.tree()).onAction(comment(), 'edit', { focus() {} } as HTMLElement)
    c.rerender()
    expect(ctxOf(c.tree()).editDraft).toBe('See you at 5')
    ctxOf(c.tree()).onEditDraftChange('See you at 6')
    c.rerender()
    // A realtime change: the thread re-reads (loading, then fresh row objects).
    h.loading = true
    c.rerender()
    h.loading = false
    h.rows = [comment()]
    c.rerender()
    const ctx = ctxOf(c.tree())
    expect(ctx.editingId).toBe('c1')
    expect(ctx.editDraft).toBe('See you at 6')
  })

  it('focus moves into the editor once, when Edit is chosen — a remounted row does not take it', async () => {
    const c = mount(() => CommentThread({ postId: 'p1', locale: 'en' }))
    await c.flush()
    ctxOf(c.tree()).onAction(comment(), 'edit', { focus() {} } as HTMLElement)
    c.rerender()
    const ctx = ctxOf(c.tree())
    // The first row mounted after Edit takes focus; a later remount (after a refetch) does not.
    mount(() => CommentRow({ comment: comment(), ctx }))
    expect(h.frames).toHaveLength(1)
    mount(() => CommentRow({ comment: comment(), ctx }))
    expect(h.frames).toHaveLength(1)
  })
})

describe('Save', () => {
  const ctxWith = (draft: string, saved: string[]): RowContext => ({
    locale: 'en',
    viewer: { id: 'me', isGuest: false, tier: null },
    isAuthenticated: true,
    submitting: false,
    onReply: async () => true,
    replyOpenIds: new Set(),
    onToggleReply: () => {},
    replyTexts: new Map(),
    onReplyTextChange: () => {},
    editingId: 'c1',
    editDraft: draft,
    onEditDraftChange: () => {},
    takeEditFocus: () => false,
    onAction: () => {},
    onSaveEdit: async (_c, text) => void saved.push(text),
    onCancelEdit: () => {},
    editNotice: null,
  })
  const clickSave = async (draft: string) => {
    const saved: string[] = []
    const r = mount(() => CommentRow({ comment: comment(), ctx: ctxWith(draft, saved) }))
    ;((findAll(r.tree(), (e) => e.props['data-testid'] === 'comment-edit-save-c1')[0] as El).props.onClick as () => void)()
    await r.flush()
    return saved
  }

  it('does nothing for an empty or unchanged text; saves a change', async () => {
    expect(await clickSave('   ')).toEqual([])
    expect(await clickSave('See you at 5')).toEqual([])
    expect(await clickSave('See you at 6')).toEqual(['See you at 6'])
  })
})

describe('markup', () => {
  it("each action button is described by the comment's author", () => {
    const html = renderToStaticMarkup(
      createElement(CommentRow, {
        comment: comment({ user_id: 'me' }),
        ctx: { ...({} as RowContext), locale: 'en', viewer: { id: 'me', isGuest: false, tier: null }, isAuthenticated: true, submitting: false, replyOpenIds: new Set(), replyTexts: new Map(), editingId: null, editDraft: '', editNotice: null, onAction: () => {}, onToggleReply: () => {}, onReplyTextChange: () => {}, onEditDraftChange: () => {}, takeEditFocus: () => false, onReply: async () => true, onSaveEdit: async () => {}, onCancelEdit: () => {} },
      }),
    )
    expect(html).toContain('id="comment-author-c1"')
    expect(html).toMatch(/data-testid="comment-edit-c1" aria-describedby="comment-author-c1"/)
    expect(html).toMatch(/data-testid="reply-btn-c1" aria-describedby="comment-author-c1"/)
  })
})
