// apps/web/src/components/feed/post-edit-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The reads behind the edit, conflict and history dialogs. Every read names its columns (no
// select('*')), none touches profile columns (history is attributed by role), and each returns a
// typed status so a dialog can say "this post was deleted" instead of failing.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { FEED_POST_SELECT, type FeedPostRow } from './post-model'
import type { EditFacts, EditSource } from './post-edit-model'
import type { CommentRevisionRow, PostRevisionRow } from './post-history'
import type { PostType } from '@/lib/post-rpc'

type Reader = Pick<SupabaseClient<Database>, 'from'>

/** The post columns the edit dialog starts from (server truth, never card state). */
export const EDIT_SOURCE_SELECT =
  'id, post_type, content, metadata, image_url, image_alt, max_seekers, resource_id, version, edited_at, is_hidden, hidden_reason'

export interface LoadedEditSource extends EditSource {
  id: string
  resource_id: string | null
  version: number
  edited_at: string | null
  is_hidden: boolean
  hidden_reason: string | null
}

export type EditSourceResult =
  | { status: 'found'; source: LoadedEditSource; facts: EditFacts }
  | { status: 'gone' }
  | { status: 'error' }

const signal = () => AbortSignal.timeout(QUERY_TIMEOUT_MS)

/** Read the post (and its poll + the counts its locks depend on) the dialog edits. */
export async function loadEditSource(client: Reader, postId: string): Promise<EditSourceResult> {
  try {
    const { data, error } = await client.from('posts').select(EDIT_SOURCE_SELECT).eq('id', postId).abortSignal(signal()).maybeSingle()
    if (error) return { status: 'error' }
    if (!data) return { status: 'gone' }
    const row = data as unknown as Omit<LoadedEditSource, 'poll'> & { post_type: PostType }
    const facts: EditFacts = { pollVotes: 0, committedOptIns: 0, pollEndsAt: null }
    let poll: LoadedEditSource['poll'] = null
    if (row.post_type === 'poll') {
      const { data: p, error: pErr } = await client
        .from('polls')
        .select('id, question, options, ends_at')
        .eq('post_id', postId)
        .abortSignal(signal())
        .maybeSingle()
      if (pErr) return { status: 'error' }
      if (p) {
        poll = { question: p.question, options: p.options, ends_at: p.ends_at }
        facts.pollEndsAt = p.ends_at
        const { count, error: vErr } = await client
          .from('poll_votes')
          .select('id', { count: 'exact', head: true })
          .eq('poll_id', p.id)
          .abortSignal(signal())
        if (vErr) return { status: 'error' }
        facts.pollVotes = count ?? 0
      }
    }
    if (row.max_seekers != null) {
      // Every opt-in row of the post holds a slot until it is deleted (edit_post's capacity rule).
      const { count, error: oErr } = await client
        .from('resource_opt_ins')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)
        .abortSignal(signal())
      if (oErr) return { status: 'error' }
      facts.committedOptIns = count ?? 0
    }
    return { status: 'found', source: { ...row, poll }, facts }
  } catch {
    return { status: 'error' }
  }
}

/** Re-read one post with the feed's own column list, to settle a card from server truth. */
export async function loadFeedRow(client: Reader, postId: string): Promise<FeedPostRow | null> {
  try {
    const { data, error } = await client.from('posts').select(FEED_POST_SELECT).eq('id', postId).abortSignal(signal()).maybeSingle()
    if (error || !data) return null
    return data as unknown as FeedPostRow
  } catch {
    return null
  }
}

export const POST_REVISION_SELECT = 'id, version, edited_at, reason, fields_changed, snapshot, redacted_at, redactor_role'
export const COMMENT_REVISION_SELECT = 'id, version, edited_at, content, redacted_at, redactor_role'

export async function loadPostRevisions(client: Reader, postId: string): Promise<PostRevisionRow[] | null> {
  try {
    const { data, error } = await client
      .from('post_revisions')
      .select(POST_REVISION_SELECT)
      .eq('post_id', postId)
      .order('version', { ascending: false })
      .abortSignal(signal())
    if (error) return null
    return (data ?? []) as unknown as PostRevisionRow[]
  } catch {
    return null
  }
}

export async function loadCommentRevisions(client: Reader, commentId: string): Promise<CommentRevisionRow[] | null> {
  try {
    const { data, error } = await client
      .from('post_comment_revisions')
      .select(COMMENT_REVISION_SELECT)
      .eq('comment_id', commentId)
      .order('version', { ascending: false })
      .abortSignal(signal())
    if (error) return null
    return (data ?? []) as unknown as CommentRevisionRow[]
  } catch {
    return null
  }
}
