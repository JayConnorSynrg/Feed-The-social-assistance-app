// apps/web/src/components/feed/post-history.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure model of the public edit history of a post or a comment (post_revisions /
// post_comment_revisions). Each revision row holds a SUPERSEDED version: its snapshot is the text as
// it was, `edited_at` is when the next edit replaced it, and `reason` / `fields_changed` describe
// that next edit. buildHistory turns the rows plus the current text into one entry per version,
// newest first, each with when it was published, the author's note for it, a word diff against the
// previous readable version, and — for a redacted version — only who removed it (a role, never a
// name). Grace edits leave no row, so version numbers may skip.

import { diffWords, type DiffPart } from '@/lib/text-diff'

/** One post_revisions row as the client reads it. */
export interface PostRevisionRow {
  id: number
  version: number
  edited_at: string
  reason: string | null
  fields_changed: string[] | null
  snapshot: unknown
  redacted_at: string | null
  redactor_role: string | null
}

/** One post_comment_revisions row. */
export interface CommentRevisionRow {
  id: number
  version: number
  edited_at: string
  content: string | null
  redacted_at: string | null
  redactor_role: string | null
}

/** A superseded version, normalized from either table. */
export interface RevisionItem {
  revisionId: number
  version: number
  /** When the next edit replaced this version. */
  replacedAt: string
  /** null when redacted. */
  content: string | null
  imageUrl: string | null
  /** The note and the fields of the edit that replaced this version (null when redacted). */
  nextNote: string | null
  nextFields: string[] | null
  redactedBy: string | null
}

export interface CurrentVersion {
  version: number
  content: string
  imageUrl: string | null
  /** posts.created_at / post_comments.created_at */
  createdAt: string
  /** posts.edited_at — the fallback publish time of the current version. */
  editedAt: string | null
}

export type PhotoChange = 'added' | 'changed' | 'removed' | null

export interface HistoryEntry {
  key: string
  version: number
  /** The revision row id (what redaction acts on); null for the current version. */
  revisionId: number | null
  isCurrent: boolean
  isOriginal: boolean
  /** When this version became the one people saw. */
  publishedAt: string
  /** The author's public note for this edit, if any. */
  note: string | null
  /** The fields this edit changed (contract keys + 'metadata' / 'poll'); [] for the original. */
  changedFields: string[]
  photoChange: PhotoChange
  /** The text of this version; null when it was redacted. */
  content: string | null
  /** Word diff against the previous readable version; null for the original or a redacted one. */
  diff: DiffPart[] | null
  /** 'author' | 'platform_admin' when this version was redacted, else null. */
  redactedBy: string | null
}

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function postRevisionItem(r: PostRevisionRow): RevisionItem {
  const snap = record(r.snapshot)
  const redacted = r.redacted_at != null
  return {
    revisionId: r.id,
    version: r.version,
    replacedAt: r.edited_at,
    content: redacted || !snap ? null : typeof snap.content === 'string' ? snap.content : '',
    imageUrl: snap && typeof snap.image_url === 'string' ? snap.image_url : null,
    nextNote: r.reason,
    nextFields: r.fields_changed,
    redactedBy: redacted ? r.redactor_role ?? 'author' : null,
  }
}

export function commentRevisionItem(r: CommentRevisionRow): RevisionItem {
  const redacted = r.redacted_at != null
  return {
    revisionId: r.id,
    version: r.version,
    replacedAt: r.edited_at,
    content: redacted ? null : r.content ?? '',
    imageUrl: null,
    nextNote: null,
    nextFields: ['content'],
    redactedBy: redacted ? r.redactor_role ?? 'author' : null,
  }
}

function photoChange(fields: readonly string[], before: string | null, after: string | null): PhotoChange {
  if (!fields.includes('image_url')) return null
  if (!after) return 'removed'
  return before ? 'changed' : 'added'
}

/** One entry per version, NEWEST first. */
export function buildHistory(current: CurrentVersion, revisions: readonly RevisionItem[]): HistoryEntry[] {
  const asc = [...revisions].sort((a, b) => a.version - b.version)
  type State = Omit<HistoryEntry, 'diff'>
  const states: State[] = asc.map((r, i) => {
    const prev = i > 0 ? asc[i - 1] : null
    const fields = prev ? prev.nextFields ?? [] : []
    return {
      key: `rev-${r.revisionId}`,
      version: r.version,
      revisionId: r.revisionId,
      isCurrent: false,
      isOriginal: i === 0,
      publishedAt: prev ? prev.replacedAt : current.createdAt,
      note: prev ? prev.nextNote : null,
      changedFields: fields,
      photoChange: prev ? photoChange(fields, prev.imageUrl, r.imageUrl) : null,
      content: r.content,
      redactedBy: r.redactedBy,
    }
  })
  const last = asc.length > 0 ? asc[asc.length - 1] : null
  const currentFields = last ? last.nextFields ?? [] : []
  states.push({
    key: 'current',
    version: current.version,
    revisionId: null,
    isCurrent: true,
    isOriginal: asc.length === 0,
    publishedAt: last ? last.replacedAt : current.editedAt ?? current.createdAt,
    note: last ? last.nextNote : null,
    changedFields: currentFields,
    photoChange: last ? photoChange(currentFields, last.imageUrl, current.imageUrl) : null,
    content: current.content,
    redactedBy: null,
  })

  // Diff each readable version against the last readable version before it.
  let previousText: string | null = null
  const withDiff: HistoryEntry[] = states.map((s) => {
    let diff: DiffPart[] | null = null
    if (s.content !== null && previousText !== null && !s.isOriginal) diff = diffWords(previousText, s.content)
    if (s.content !== null) previousText = s.content
    return { ...s, diff }
  })
  return withDiff.reverse()
}
