// post-writes.test.ts — every post / poll / comment write goes through the post-editing RPCs, the
// stored text is raw, and the comment thread keeps a deleted comment's replies.
//   SOURCE: no file in apps/web/src inserts / updates / deletes posts or polls directly, or updates /
//           deletes post_comments (their client grants are revoked by the contract migration); the
//           post paths never HTML-escape (sanitizeInput) the member's text.
//   MODEL:  visibleCommentTree, commentAge.
import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))

import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildCommentTree, commentThreadView, liveCommentCount, visibleCommentTree, type Comment } from '@/hooks/use-comments'
import { CommentRow, commentAge, moderateComment, type RowContext } from './comment-thread'
import type { ActionViewer } from './post-actions'

const noop = () => {}

const SRC = path.resolve(__dirname, '../..')
function sources(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue
      sources(full, acc)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.smoke\.ts$/.test(e.name)) acc.push(full)
  }
  return acc
}

/** `.from('<table>')` followed (within the same chained call) by one of the write methods. */
function directWrites(text: string, table: string, methods: string[]): number {
  const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)([\\s\\S]{0,160}?)\\.(${methods.join('|')})\\(`, 'g')
  let n = 0
  for (const m of text.matchAll(re)) if (!/\.from\(/.test(m[1])) n++
  return n
}

describe('post writes go through the RPCs', () => {
  const files = sources(SRC).map((f) => ({ f: path.relative(SRC, f), text: fs.readFileSync(f, 'utf8') }))

  it('no direct insert / update / delete / upsert on posts or polls anywhere in apps/web/src', () => {
    const offenders = files.flatMap(({ f, text }) => [
      ...(directWrites(text, 'posts', ['insert', 'update', 'delete', 'upsert']) ? [`${f}: posts`] : []),
      ...(directWrites(text, 'polls', ['insert', 'update', 'delete', 'upsert']) ? [`${f}: polls`] : []),
    ])
    expect(offenders).toEqual([])
  })

  it('comments are edited / deleted only through edit_comment / delete_own_comment', () => {
    const offenders = files.filter(({ text }) => directWrites(text, 'post_comments', ['update', 'delete', 'upsert'])).map(({ f }) => f)
    expect(offenders).toEqual([])
  })

  it('the post create paths store raw text (no sanitizeInput) and pass the member locale', () => {
    for (const rel of ['components/panels/feed-panel.tsx', 'components/panels/post-type-wizard.tsx', 'components/panels/programs-panel.tsx']) {
      const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
      expect(text, rel).not.toMatch(/sanitizeInput\(/)
      expect(text, rel).toMatch(/createPost\((supabase|createClient\(\)), \{/)
      expect(text, rel).toMatch(/lang: (locale|eventLocale)/)
    }
  })

  it('polls are created only with their post (createPoll is gone)', () => {
    expect(fs.readFileSync(path.join(SRC, 'hooks/use-poll.ts'), 'utf8')).not.toMatch(/export async function createPoll/)
  })
})

function c(id: string, o: Partial<Comment> = {}): Comment {
  return {
    id,
    post_id: 'p',
    user_id: 'u',
    content: `text ${id}`,
    parent_id: null,
    is_hidden: false,
    created_at: `2026-10-01T00:00:0${id.length}Z`,
    updated_at: '2026-10-01T00:00:00Z',
    version: 1,
    edited_at: null,
    edit_count: 0,
    deleted_at: null,
    user: null,
    replies: [],
    ...o,
  }
}

describe('deleted comments keep their replies', () => {
  it('a deleted comment with replies stays (as "Comment deleted") holding them; a deleted leaf is left out', () => {
    const tree = visibleCommentTree(
      buildCommentTree([
        c('a', { deleted_at: '2026-10-02T00:00:00Z', content: '' }),
        c('a1', { parent_id: 'a' }),
        c('b', { deleted_at: '2026-10-02T00:00:00Z', content: '' }),
        c('cc'),
      ]),
    )
    expect(tree.map((t) => [t.id, t.deleted_at != null, t.replies.map((r) => r.id)])).toEqual([
      ['a', true, ['a1']],
      ['cc', false, []],
    ])
  })

  it('a deleted comment whose only replies were deleted too is left out', () => {
    const tree = visibleCommentTree(buildCommentTree([c('a', { deleted_at: 'x' }), c('a1', { parent_id: 'a', deleted_at: 'x' })]))
    expect(tree).toEqual([])
  })
})

describe('comment time in the member’s language', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  it('just now, minutes, hours, days', () => {
    expect(commentAge('2026-10-09T11:59:50Z', 'en', now)).toBe('just now')
    expect(commentAge('2026-10-09T11:55:00Z', 'en', now)).toBe('5 minutes ago')
    expect(commentAge('2026-10-09T09:00:00Z', 'es', now)).toBe('Hace 3 horas')
    expect(commentAge('2026-10-07T12:00:00Z', 'en', now)).toBe('2 days ago')
  })
})

// Moderators hide comments, so they unhide them where they hid them: staff see a hidden comment in
// the thread, marked, with Unhide (admin_set_comment_hidden false); members and guests never see it.
describe('hidden comments: staff only, with Unhide', () => {
  const flat = () => [c('v'), c('h', { is_hidden: true, content: 'rude' }), c('hr', { parent_id: 'h' })]

  it('a member gets no row for a hidden comment (its reply still shows); staff get the row', () => {
    expect(commentThreadView(flat(), { includeHidden: false }).map((t) => t.id).sort()).toEqual(['hr', 'v'])
    const staff = commentThreadView(flat(), { includeHidden: true })
    expect(staff.map((t) => t.id).sort()).toEqual(['h', 'v'])
    expect(staff.find((t) => t.id === 'h')!.replies.map((r) => r.id)).toEqual(['hr'])
  })

  const ctx = (viewer: ActionViewer): RowContext => ({
    locale: 'es',
    viewer,
    isAuthenticated: true,
    submitting: false,
    onReply: async () => true,
    replyOpenIds: new Set(),
    onToggleReply: noop,
    replyTexts: new Map(),
    onReplyTextChange: noop,
    editingId: null,
    onAction: noop,
    onSaveEdit: async () => {},
    onCancelEdit: noop,
    editNotice: null,
  })
  const row = (viewer: ActionViewer) =>
    renderToStaticMarkup(h(CommentRow, { comment: c('h', { is_hidden: true, content: 'rude', user_id: 'someone' }), ctx: ctx(viewer) }))

  it('staff see the translated "Hidden by a moderator" marker and an Unhide action (no Reply)', () => {
    const html = row({ id: 'mod', isGuest: false, tier: 'community_moderator' })
    expect(html).toContain('data-testid="comment-hidden-h"')
    expect(html).toContain('Ocultado por un moderador')
    expect(html).toMatch(/data-testid="comment-unhide-h"[^>]*>Mostrar</)
    expect(html).not.toContain('reply-btn-h')
  })

  it('Unhide calls admin_set_comment_hidden with p_hidden false; Hide with true', async () => {
    const calls: Array<[string, Record<string, unknown>]> = []
    const client = {
      rpc: (n: string, a: Record<string, unknown>) => ({ setHeader: () => (calls.push([n, a]), Promise.resolve({ data: {}, error: null })) }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await moderateComment(client as any, 'h', 'unhide')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await moderateComment(client as any, 'v', 'hide')
    expect(calls).toEqual([
      ['admin_set_comment_hidden', { p_comment_id: 'h', p_hidden: false }],
      ['admin_set_comment_hidden', { p_comment_id: 'v', p_hidden: true }],
    ])
  })

  it('the thread shows hidden rows exactly to staff (community moderator and up, never a guest)', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/feed/comment-thread.tsx'), 'utf8')
    expect(src).toContain("const isStaff = !isAnonymous && tierAtLeast(viewer.tier, 'community_moderator')")
    expect(src).toContain('commentThreadView(rows, { includeHidden: isStaff })')
  })

  it('the count everyone sees leaves out deleted and hidden comments (replies included)', () => {
    expect(liveCommentCount([c('a'), c('b', { deleted_at: 'x' }), c('d', { is_hidden: true }), c('r', { parent_id: 'a' })])).toBe(2)
  })
})
