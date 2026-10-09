// post-rpc.test.ts — what the database receives for every post / comment write, and how each server
// refusal reaches the member (the typed failure a dialog renders).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows: Array<{ op: string; ok: boolean; attrs: Record<string, unknown> }> = []
vi.mock('@/lib/logger', () => ({
  withMetric: vi.fn(async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>) => {
    try {
      const r = await fn()
      rows.push({ op, ok: true, attrs })
      return r
    } catch (e) {
      rows.push({ op, ok: false, attrs })
      throw e
    }
  }),
}))

import {
  createPost,
  deleteOwnComment,
  deleteOwnPost,
  editComment,
  editPost,
  parsePostRpcError,
  redactPostRevision,
  setCommentHidden,
} from './post-rpc'

type Call = { name: string; args: Record<string, unknown>; header: [string, string] | null }
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const calls: Call[] = []
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      const call: Call = { name, args, header: null }
      calls.push(call)
      return {
        setHeader: (k: string, v: string) => {
          call.header = [k, v]
          return Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
        },
      }
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls }
}

beforeEach(() => {
  rows.length = 0
})

describe('create_post', () => {
  it('sends the raw text, the type, the resource and the member locale; returns the new id', async () => {
    const { client, calls } = fakeClient({ data: 'post-1' })
    const res = await createPost(client, {
      postType: 'feed',
      fields: { content: 'Tom & Jerry <3 "free" bread', max_seekers: 4 },
      resourceId: 'res-1',
      lang: 'es',
    })
    expect(res).toMatchObject({ ok: true, value: 'post-1' })
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('create_post')
    expect(calls[0].args).toEqual({
      p_post_type: 'feed',
      p_fields: { content: 'Tom & Jerry <3 "free" bread', max_seekers: 4 },
      p_resource_id: 'res-1',
      p_lang: 'es',
    })
    expect(calls[0].header?.[0]).toBe('x-request-id')
    // one wide event, ids and enums only
    expect(rows).toEqual([{ op: 'feed.post.create', ok: true, attrs: expect.objectContaining({ post_type: 'feed', lang: 'es', has_resource: true }) }])
    expect(JSON.stringify(rows)).not.toContain('Jerry')
  })

  it('a refused create records one error row and returns the typed failure', async () => {
    const { client } = fakeClient({ error: { code: '42501', message: 'guest_refused' } })
    const res = await createPost(client, { postType: 'poll', fields: { content: 'Q?', options: ['a', 'b'] }, lang: 'en' })
    expect(res).toMatchObject({ ok: false, failure: { kind: 'forbidden', token: 'guest_refused' } })
    expect(rows.map((r) => [r.op, r.ok])).toEqual([['feed.post.create', false]])
  })
})

describe('edit_post', () => {
  it('sends the version the dialog opened with and only the changed keys', async () => {
    const { client, calls } = fakeClient({
      data: { grace: false, changed: ['content'], post_id: 'p', version: 3, edited_at: '2026-10-09T21:53:18Z', edit_count: 2, revision_id: 17 },
    })
    const res = await editPost(client, { postId: 'p', postType: 'feed', expectedVersion: 2, changes: { content: 'new' }, reason: '  typo ' })
    expect(calls[0]).toMatchObject({
      name: 'edit_post',
      args: { p_post_id: 'p', p_expected_version: 2, p_changes: { content: 'new' }, p_reason: 'typo' },
    })
    expect(res).toMatchObject({ ok: true, value: { version: 3, editedAt: '2026-10-09T21:53:18Z', editCount: 2, grace: false, changed: ['content'] } })
    expect(rows[0]).toMatchObject({ op: 'feed.post.edit', attrs: { post_type: 'feed', fields_count: 1, target_id: 'p' } })
  })

  it('a stale version comes back as a conflict carrying the current version', async () => {
    const { client } = fakeClient({
      error: { code: 'PT409', message: 'edit_conflict', details: '{"edited_at": "2026-10-09T21:53:18.95109+00:00", "current_version": 4}' },
    })
    const res = await editPost(client, { postId: 'p', postType: 'feed', expectedVersion: 2, changes: { content: 'x' } })
    expect(res).toMatchObject({ ok: false, failure: { kind: 'conflict', currentVersion: 4, editedAt: '2026-10-09T21:53:18.95109+00:00', needsReview: false } })
  })
})

describe('delete / comments / moderation', () => {
  it('delete_own_post, edit_comment, delete_own_comment, redact, hide send exactly their contract args', async () => {
    const a = fakeClient({ data: { deleted: true } })
    await deleteOwnPost(a.client, 'p1', 'seeker_request')
    const b = fakeClient({ data: { version: 2, changed: true } })
    await editComment(b.client, 'c1', 1, 'fixed')
    const c = fakeClient({ data: { deleted: true } })
    await deleteOwnComment(c.client, 'c1')
    const d = fakeClient({ data: { redacted: true } })
    await redactPostRevision(d.client, 17, 'p1', ' phone number ')
    const e = fakeClient({ data: { is_hidden: true } })
    await setCommentHidden(e.client, 'c2', true)
    expect([a, b, c, d, e].map((x) => [x.calls[0].name, x.calls[0].args])).toEqual([
      ['delete_own_post', { p_post_id: 'p1' }],
      ['edit_comment', { p_comment_id: 'c1', p_expected_version: 1, p_content: 'fixed' }],
      ['delete_own_comment', { p_comment_id: 'c1' }],
      ['redact_post_revision', { p_revision_id: 17, p_reason: 'phone number' }],
      ['admin_set_comment_hidden', { p_comment_id: 'c2', p_hidden: true }],
    ])
    expect(rows.map((r) => r.op)).toEqual([
      'feed.post.delete',
      'feed.comment.edit',
      'feed.comment.delete',
      'feed.post.revision.redact',
      'admin.comment.hide',
    ])
  })
})

describe('parsePostRpcError — every contract refusal reaches a specific message', () => {
  it.each([
    [{ code: 'PT404', message: 'post_not_found' }, { kind: 'not_found', token: 'post_not_found' }],
    [{ code: 'PT404', message: 'comment_deleted' }, { kind: 'not_found', token: 'comment_deleted' }],
    [{ code: '42501', message: 'post_removed' }, { kind: 'forbidden', token: 'post_removed' }],
    [{ code: '42501', message: 'new row violates row-level security policy "post_likes_insert_post_visible"' }, { kind: 'forbidden', token: 'closed' }],
    [{ code: '22023', message: 'post_field_locked:options', hint: 'Options are locked after the first vote.' }, { kind: 'locked', field: 'options', hint: 'Options are locked after the first vote.' }],
    [{ code: '22023', message: 'post_field_invalid:image_url' }, { kind: 'invalid', field: 'image_url' }],
    [{ code: '22023', message: 'post_field_required:content' }, { kind: 'required', field: 'content' }],
    [{ code: '22023', message: 'comment_invalid:content' }, { kind: 'invalid', field: 'content' }],
    [{ code: '22023', message: 'capacity_below_committed', details: '{"committed": 3}' }, { kind: 'capacity', committed: 3 }],
    [{ code: '22023', message: 'reason_required' }, { kind: 'required', field: 'reason' }],
    [
      { code: '22023', message: 'post_field_required:time_zone', details: '{"problems": {"ends_at": "before_start", "time_zone": "required"}}' },
      { kind: 'event', problems: { ends_at: 'before_start', time_zone: 'required' } },
    ],
    [{ code: 'PT409', message: 'edit_conflict', details: '{"current_version": 5, "edited_at": null, "needs_review": true}' }, { kind: 'conflict', currentVersion: 5, editedAt: null, needsReview: true }],
    [{ message: 'Failed to fetch' }, { kind: 'network' }],
    [{ code: 'XX000', message: 'boom' }, { kind: 'unknown', code: 'XX000' }],
  ])('%j', (error, expected) => {
    expect(parsePostRpcError(error)).toEqual(expected)
  })
})
