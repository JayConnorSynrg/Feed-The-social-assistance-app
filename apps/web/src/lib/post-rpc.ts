// apps/web/src/lib/post-rpc.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE client path for every post and comment write of the post-editing release
// (specs/post-editing-contract.md): create_post, edit_post, delete_own_post, edit_comment,
// delete_own_comment, redact_post_revision, redact_comment_revision and the moderators'
// admin_set_comment_hidden. Each is one privilegedRpc call (lib/privileged-action.ts): one request id
// sent as x-request-id and shared with withMetric, so every action persists exactly one
// `<op>.complete` or `<op>.error` row in app_logs (ids and enums only — never post text). The T5
// source guard (privileged-action-guard.ts AUDITED_PRIVILEGED) fails any call that bypasses this.
//
// Every server error is turned into a typed failure (parsePostRpcError) from the SQLSTATE + the
// stable message token the contract defines, so dialogs show a specific, translated message:
//   PT409 edit_conflict (+ details {"current_version","edited_at"[,"needs_review"]})  -> conflict
//   PT404 post_not_found | comment_not_found | comment_deleted | ...                   -> not_found
//   42501 not_author | post_removed | comments_closed | guest_refused | RLS ...         -> forbidden
//   22023 post_field_locked:<k> (+hint) | _invalid:<k> | _required:<k> | capacity_below_committed
//         (+details {"committed"}) | member-event details {"problems": {...}}           -> locked / invalid / required / capacity / event
// A call that never reached the database (network, timeout) has no code -> network.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@feed/database'
import { privilegedRpc } from '@/lib/privileged-action'
import type { Locale } from '@/lib/i18n'

type Client = SupabaseClient<Database>
export type PostType = Database['public']['Enums']['post_type']

/** The error object supabase-js returns for a failed RPC (privilegedRpc preserves it). */
export interface RpcError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export type EventProblem = 'required' | 'invalid' | 'before_start'

export type PostRpcFailure =
  | { kind: 'conflict'; currentVersion: number | null; editedAt: string | null; needsReview: boolean }
  | { kind: 'not_found'; token: string }
  | { kind: 'forbidden'; token: string }
  | { kind: 'locked'; field: string; hint: string | null }
  | { kind: 'invalid'; field: string }
  | { kind: 'required'; field: string }
  | { kind: 'capacity'; committed: number | null }
  | { kind: 'event'; problems: Partial<Record<'starts_at' | 'ends_at' | 'time_zone', EventProblem>> }
  | { kind: 'network' }
  | { kind: 'unknown'; code: string }

function parseDetails(details: string | null | undefined): Record<string, unknown> | null {
  if (!details) return null
  try {
    const v = JSON.parse(details) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The key after "<prefix>:" in a contract token ("post_field_locked:options" -> "options"). */
function tokenKey(message: string, prefix: string): string | null {
  const m = new RegExp(`^${prefix}:([a-z_]+)`).exec(message)
  return m ? m[1] : null
}

/** Map a failed RPC's error to the typed failure a dialog renders. */
export function parsePostRpcError(error: RpcError): PostRpcFailure {
  const code = error.code ?? ''
  const message = (error.message ?? '').trim()
  if (!code) return { kind: 'network' }
  if (code === 'PT409') {
    const d = parseDetails(error.details)
    return {
      kind: 'conflict',
      currentVersion: typeof d?.current_version === 'number' ? d.current_version : null,
      editedAt: typeof d?.edited_at === 'string' ? d.edited_at : null,
      needsReview: d?.needs_review === true,
    }
  }
  if (code === 'PT404') return { kind: 'not_found', token: message }
  if (code === '42501') {
    const token = /row-level security/i.test(message)
      ? 'closed'
      : /^[a-z0-9_:]+$/.test(message)
        ? message
        : 'permission'
    return { kind: 'forbidden', token }
  }
  if (code === '22023') {
    const d = parseDetails(error.details)
    const problems = d?.problems
    if (problems && typeof problems === 'object' && !Array.isArray(problems)) {
      return { kind: 'event', problems: problems as Partial<Record<'starts_at' | 'ends_at' | 'time_zone', EventProblem>> }
    }
    if (message === 'capacity_below_committed') {
      return { kind: 'capacity', committed: typeof d?.committed === 'number' ? d.committed : null }
    }
    const locked = tokenKey(message, 'post_field_locked')
    if (locked) return { kind: 'locked', field: locked, hint: error.hint ?? null }
    const required = tokenKey(message, 'post_field_required') ?? tokenKey(message, 'comment_field_required')
    if (required) return { kind: 'required', field: required }
    const invalid =
      tokenKey(message, 'post_field_invalid') ??
      tokenKey(message, 'post_field_not_editable') ??
      tokenKey(message, 'comment_invalid')
    if (invalid) return { kind: 'invalid', field: invalid }
    if (message === 'reason_required') return { kind: 'required', field: 'reason' }
  }
  return { kind: 'unknown', code }
}

export type RpcOutcome<T> = { ok: true; value: T; requestId: string } | { ok: false; failure: PostRpcFailure; requestId: string }

function outcome<T>(res: { data: unknown; error: { code?: string; message: string } | null; requestId: string }, map: (d: unknown) => T): RpcOutcome<T> {
  if (res.error) return { ok: false, failure: parsePostRpcError(res.error as RpcError), requestId: res.requestId }
  return { ok: true, value: map(res.data), requestId: res.requestId }
}

const asRecord = (d: unknown): Record<string, unknown> => (d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {})
const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback)
const str = (v: unknown) => (typeof v === 'string' ? v : null)

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/** The fields create_post / edit_post accept (contract "Per-type fields"). Only the keys present are sent. */
export interface PostFields {
  content?: string
  image_url?: string | null
  image_alt?: string | null
  max_seekers?: number | null
  categories?: string[]
  starts_at?: string
  ends_at?: string | null
  location?: string | null
  is_online?: boolean
  time_zone?: string
  options?: string[]
}

export interface CreatePostInput {
  postType: Exclude<PostType, 'petition' | 'resource_post'>
  fields: PostFields
  resourceId?: string | null
  /** The member's effective app locale; stored as posts.lang for share previews. */
  lang: Locale
}

/** The create_post arguments: raw text (React escapes on render), the member's locale. */
export function createPostArgs(input: CreatePostInput) {
  return {
    p_post_type: input.postType,
    p_fields: input.fields as unknown as Json,
    p_resource_id: input.resourceId ?? undefined,
    p_lang: input.lang,
  }
}

/** create_post -> the new post id. */
export async function createPost(supabase: Client, input: CreatePostInput): Promise<RpcOutcome<string>> {
  const res = await privilegedRpc(supabase, 'feed.post.create', 'create_post', createPostArgs(input), {
    post_type: input.postType,
    has_image: !!input.fields.image_url,
    has_resource: !!input.resourceId,
    lang: input.lang,
  })
  return outcome(res, (d) => String(d))
}

export interface EditPostResult {
  version: number
  editedAt: string | null
  editCount: number
  /** A quiet edit (first 5 minutes, before anyone engaged): no history row and no "Edited" label. */
  grace: boolean
  changed: string[]
}

export interface EditPostInput {
  postId: string
  postType: PostType
  /** The version the dialog opened with (posts.version). */
  expectedVersion: number
  /** Only the keys that changed. */
  changes: PostFields
  /** Optional public edit note (<= 500 chars). */
  reason?: string | null
}

export function editPostArgs(input: EditPostInput) {
  const reason = input.reason?.trim()
  return {
    p_post_id: input.postId,
    p_expected_version: input.expectedVersion,
    p_changes: input.changes as unknown as Json,
    p_reason: reason ? reason : undefined,
  }
}

export function toEditResult(d: unknown): EditPostResult {
  const r = asRecord(d)
  return {
    version: num(r.version),
    editedAt: str(r.edited_at),
    editCount: num(r.edit_count),
    grace: r.grace === true,
    changed: Array.isArray(r.changed) ? r.changed.filter((x): x is string => typeof x === 'string') : [],
  }
}

export async function editPost(supabase: Client, input: EditPostInput): Promise<RpcOutcome<EditPostResult>> {
  const res = await privilegedRpc(supabase, 'feed.post.edit', 'edit_post', editPostArgs(input), {
    post_type: input.postType,
    fields_count: Object.keys(input.changes).length,
    has_reason: !!input.reason?.trim(),
    target_id: input.postId,
  })
  return outcome(res, toEditResult)
}

export async function deleteOwnPost(supabase: Client, postId: string, postType: PostType): Promise<RpcOutcome<true>> {
  const res = await privilegedRpc(supabase, 'feed.post.delete', 'delete_own_post', { p_post_id: postId }, {
    post_type: postType,
    target_id: postId,
  })
  return outcome(res, () => true as const)
}

export interface RedactResult {
  alreadyRedacted: boolean
  redactorRole: string | null
}

const toRedact = (d: unknown): RedactResult => {
  const r = asRecord(d)
  return { alreadyRedacted: r.already_redacted === true, redactorRole: str(r.redactor_role) }
}

export async function redactPostRevision(
  supabase: Client,
  revisionId: number,
  postId: string,
  reason: string | null,
): Promise<RpcOutcome<RedactResult>> {
  const res = await privilegedRpc(
    supabase,
    'feed.post.revision.redact',
    'redact_post_revision',
    { p_revision_id: revisionId, p_reason: reason?.trim() || undefined },
    { has_reason: !!reason?.trim(), target_id: postId },
  )
  return outcome(res, toRedact)
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface EditCommentResult {
  version: number
  editedAt: string | null
  grace: boolean
  changed: boolean
}

export async function editComment(
  supabase: Client,
  commentId: string,
  expectedVersion: number,
  content: string,
): Promise<RpcOutcome<EditCommentResult>> {
  const res = await privilegedRpc(
    supabase,
    'feed.comment.edit',
    'edit_comment',
    { p_comment_id: commentId, p_expected_version: expectedVersion, p_content: content },
    { target_id: commentId },
  )
  return outcome(res, (d) => {
    const r = asRecord(d)
    return { version: num(r.version), editedAt: str(r.edited_at), grace: r.grace === true, changed: r.changed === true }
  })
}

export async function deleteOwnComment(supabase: Client, commentId: string): Promise<RpcOutcome<true>> {
  const res = await privilegedRpc(supabase, 'feed.comment.delete', 'delete_own_comment', { p_comment_id: commentId }, {
    target_id: commentId,
  })
  return outcome(res, () => true as const)
}

export async function redactCommentRevision(
  supabase: Client,
  revisionId: number,
  commentId: string,
  reason: string | null,
): Promise<RpcOutcome<RedactResult>> {
  const res = await privilegedRpc(
    supabase,
    'feed.comment.revision.redact',
    'redact_comment_revision',
    { p_revision_id: revisionId, p_reason: reason?.trim() || undefined },
    { has_reason: !!reason?.trim(), target_id: commentId },
  )
  return outcome(res, toRedact)
}

/** Moderators (community moderator and up): hide or unhide one comment (one admin_actions row). */
export async function setCommentHidden(supabase: Client, commentId: string, hidden: boolean): Promise<RpcOutcome<true>> {
  const res = await privilegedRpc(
    supabase,
    'admin.comment.hide',
    'admin_set_comment_hidden',
    { p_comment_id: commentId, p_hidden: hidden },
    { action: hidden ? 'comment.hide' : 'comment.unhide', target_id: commentId },
  )
  return outcome(res, () => true as const)
}
