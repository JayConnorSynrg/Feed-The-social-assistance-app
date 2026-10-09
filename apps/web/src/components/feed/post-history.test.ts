// post-history.test.ts — the public edit history a member opens from "Edited": versions newest first,
// when each was published, the author's note, a word diff, and a redacted version shown only as a
// notice naming a role.
import { describe, it, expect } from 'vitest'
import { buildHistory, commentRevisionItem, postRevisionItem, type PostRevisionRow } from './post-history'

const created = '2026-10-01T10:00:00Z'
const rev = (o: Partial<PostRevisionRow> & { id: number; version: number; edited_at: string }): PostRevisionRow => ({
  reason: null,
  fields_changed: ['content'],
  snapshot: { content: '', image_url: null },
  redacted_at: null,
  redactor_role: null,
  ...o,
})

describe('buildHistory', () => {
  const revisions = [
    rev({ id: 11, version: 1, edited_at: '2026-10-02T10:00:00Z', snapshot: { content: 'Free bread at 5', image_url: null }, reason: 'fixed the time' }),
    rev({ id: 12, version: 2, edited_at: '2026-10-03T10:00:00Z', snapshot: { content: 'Free bread at 6', image_url: null }, fields_changed: ['content', 'image_url'] }),
  ].map(postRevisionItem)
  const current = { version: 4, content: 'Free bread and soup at 6', imageUrl: 'https://p/u/a.webp', createdAt: created, editedAt: '2026-10-03T10:00:00Z' }

  it('lists every version newest first, the oldest marked Original', () => {
    const h = buildHistory(current, revisions)
    expect(h.map((e) => e.version)).toEqual([4, 2, 1])
    expect(h[0].isCurrent).toBe(true)
    expect(h[2].isOriginal).toBe(true)
  })

  it('each version shows when it was published and the note the author gave for that edit', () => {
    const h = buildHistory(current, revisions)
    expect(h.map((e) => [e.version, e.publishedAt, e.note])).toEqual([
      [4, '2026-10-03T10:00:00Z', null],
      [2, '2026-10-02T10:00:00Z', 'fixed the time'],
      [1, created, null],
    ])
  })

  it('each edited version carries a word diff against the version before it; a photo change is named', () => {
    const h = buildHistory(current, revisions)
    expect(h[0].diff).toEqual([
      { kind: 'same', text: 'Free bread ' },
      { kind: 'added', text: 'and soup ' },
      { kind: 'same', text: 'at 6' },
    ])
    expect(h[0].photoChange).toBe('added')
    expect(h[2].diff).toBeNull()
  })

  it('a redacted version shows no text and who removed it; the next version diffs against the last readable one', () => {
    const redacted = [
      revisions[0],
      postRevisionItem(rev({ id: 12, version: 2, edited_at: '2026-10-03T10:00:00Z', snapshot: null, reason: null, fields_changed: null, redacted_at: '2026-10-04T00:00:00Z', redactor_role: 'platform_admin' })),
    ]
    const h = buildHistory(current, redacted)
    expect(h[1]).toMatchObject({ version: 2, content: null, diff: null, redactedBy: 'platform_admin' })
    // the current version is compared with version 1 (the last readable one), not with the redacted version 2
    expect(h[0].diff).toEqual([
      { kind: 'same', text: 'Free bread ' },
      { kind: 'added', text: 'and soup ' },
      { kind: 'same', text: 'at ' },
      { kind: 'removed', text: '5' },
      { kind: 'added', text: '6' },
    ])
  })

  it('a never-recorded post (only grace edits) has one Original entry', () => {
    const h = buildHistory({ ...current, editedAt: null }, [])
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ isCurrent: true, isOriginal: true, publishedAt: created, diff: null })
  })

  it('comment revisions use the same model', () => {
    const h = buildHistory(
      { version: 2, content: 'See you at 6', imageUrl: null, createdAt: created, editedAt: '2026-10-02T00:00:00Z' },
      [commentRevisionItem({ id: 5, version: 1, edited_at: '2026-10-02T00:00:00Z', content: 'See you at 5', redacted_at: null, redactor_role: null })],
    )
    expect(h.map((e) => e.content)).toEqual(['See you at 6', 'See you at 5'])
    expect(h[0].diff?.filter((p) => p.kind !== 'same')).toEqual([
      { kind: 'removed', text: '5' },
      { kind: 'added', text: '6' },
    ])
  })
})
