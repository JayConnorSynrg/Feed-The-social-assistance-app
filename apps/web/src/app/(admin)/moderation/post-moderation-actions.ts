'use client'

// apps/web/src/app/(admin)/moderation/post-moderation-actions.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE client path for the three post moderation actions, shared by the reports queue
// (reports-queue.tsx) and the single-post view an "Edit in admin" link opens (focused-post.tsx).
// Each is one privileged RPC (lib/privileged-action.ts: one admin_actions row + one app_logs row
// sharing request_id); a refusal also writes admin.denied.
//
// Every action sends the version the moderator is looking at (posts.version, p_expected_version).
// When the author edited the post since it was read, the RPC refuses with PT409 (+ details
// {"current_version", "edited_at", "needs_review"}); the result then carries `conflict` so the caller
// re-reads the post and the moderator decides on the version members would see. A deleted post
// answers PT404 post_deleted (hold / authorize).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { privilegedRpc } from '@/lib/privileged-action'
import { logger } from '@/lib/logger'

export type PostModerationAction = 'remove' | 'hold' | 'authorize'

/** The destructive (Remove) buttons: white on red-700, 6.4:1 (the theme's destructive red is 3.6:1). */
export const DESTRUCTIVE_BUTTON_CLASS = 'bg-red-700 text-white hover:bg-red-800'

/** The admin_actions / admin.denied action label of each. */
const ACTION_LABEL: Record<PostModerationAction, string> = {
  remove: 'post.remove',
  hold: 'post.hold',
  authorize: 'post.authorize',
}

// One literal privilegedRpc call per action (the T5 source guard and the event registry read the op
// and RPC names from the call site).
function callAction(supabase: SupabaseClient<Database>, action: PostModerationAction, postId: string, expectedVersion: number | null) {
  const v = expectedVersion ?? undefined
  switch (action) {
    case 'remove':
      return privilegedRpc(supabase, 'admin.post.remove', 'admin_remove_post', { p_post_id: postId, p_expected_version: v }, { action: 'post.remove', target_id: postId })
    case 'hold':
      return privilegedRpc(supabase, 'admin.post.hold', 'admin_hold_post', { p_post_id: postId, p_expected_version: v }, { action: 'post.hold', target_id: postId })
    case 'authorize':
      return privilegedRpc(supabase, 'admin.post.authorize', 'admin_authorize_post', { p_post_id: postId, p_expected_version: v }, { action: 'post.authorize', target_id: postId })
  }
}

/** The author changed the post since the moderator read it (PT409): re-read before deciding. */
export interface ModerationConflict {
  currentVersion: number | null
  /** The author edited the hidden post and no moderator has reviewed that version yet. */
  needsReview: boolean
}

export type PostModerationResult =
  | { ok: true }
  | { ok: false; message: string; conflict?: ModerationConflict; gone?: true }

/** The moderator-facing line for a version conflict (the admin screens are English). */
export const MODERATION_CONFLICT_MESSAGE =
  'The author changed this post since you opened it. The latest version is shown — review it and choose again.'

/** Map a moderation RPC error to the result (exported for the reports queue's resolve path). */
export function moderationFailure(error: { code?: string; message: string; details?: string | null }): Exclude<PostModerationResult, { ok: true }> {
  if (error.code === 'PT409') {
    let d: Record<string, unknown> = {}
    try {
      d = JSON.parse(error.details ?? '{}') as Record<string, unknown>
    } catch {
      d = {}
    }
    return {
      ok: false,
      message: MODERATION_CONFLICT_MESSAGE,
      conflict: { currentVersion: typeof d.current_version === 'number' ? d.current_version : null, needsReview: d.needs_review === true },
    }
  }
  if (error.code === 'PT404') return { ok: false, message: 'This post was deleted by its author.', gone: true }
  // The queue has always shown this generic line for a refused RPC (its error is not an Error).
  return { ok: false, message: 'An error occurred' }
}

/**
 * Run one moderation action on a post. Never throws. `expectedVersion` is the posts.version the
 * moderator is looking at (null only for a caller that has not read it — the server then refuses to
 * publish an unseen author edit).
 */
export async function moderatePost(
  supabase: SupabaseClient<Database>,
  action: PostModerationAction,
  postId: string,
  expectedVersion: number | null = null
): Promise<PostModerationResult> {
  try {
    const { error, requestId } = await callAction(supabase, action, postId, expectedVersion)
    if (error) {
      logger.warn('admin.denied', { action: ACTION_LABEL[action], code: error.code ?? 'unknown', request_id: requestId })
      return moderationFailure(error as { code?: string; message: string; details?: string | null })
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'An error occurred' }
  }
}

/** The post state the single-post view needs to offer actions. */
export interface ModeratedPostState {
  is_hidden: boolean | null
  hidden_reason: string | null
  /** posts.version — sent with every action (p_expected_version). */
  version?: number | null
}

/**
 * The actions offered on a post, in button order: Remove unless it is already removed; Hold while
 * members can see it; Authorize (make it visible again) while it is hidden for any reason.
 */
export function postActionsFor(post: ModeratedPostState): PostModerationAction[] {
  const hidden = post.is_hidden !== false
  const out: PostModerationAction[] = []
  if (post.hidden_reason !== 'admin_removal' || !hidden) out.push('remove')
  if (!hidden) out.push('hold')
  if (hidden) out.push('authorize')
  return out
}
