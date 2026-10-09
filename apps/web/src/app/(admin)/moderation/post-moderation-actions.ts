'use client'

// apps/web/src/app/(admin)/moderation/post-moderation-actions.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE client path for the three post moderation actions, shared by the reports queue
// (reports-queue.tsx) and the single-post view an "Edit in admin" link opens (focused-post.tsx).
// Each is one privileged RPC (lib/privileged-action.ts: one admin_actions row + one app_logs row
// sharing request_id); a refusal also writes admin.denied.
//
// The RPCs act on ANY post id and do not check that it exists (a wrong id still succeeds and still
// writes an admin_actions row), so callers act only on a post they have read.

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
function callAction(supabase: SupabaseClient<Database>, action: PostModerationAction, postId: string) {
  switch (action) {
    case 'remove':
      return privilegedRpc(supabase, 'admin.post.remove', 'admin_remove_post', { p_post_id: postId }, { action: 'post.remove', target_id: postId })
    case 'hold':
      return privilegedRpc(supabase, 'admin.post.hold', 'admin_hold_post', { p_post_id: postId }, { action: 'post.hold', target_id: postId })
    case 'authorize':
      return privilegedRpc(supabase, 'admin.post.authorize', 'admin_authorize_post', { p_post_id: postId }, { action: 'post.authorize', target_id: postId })
  }
}

export type PostModerationResult = { ok: true } | { ok: false; message: string }

/** Run one moderation action on a post. Never throws. */
export async function moderatePost(
  supabase: SupabaseClient<Database>,
  action: PostModerationAction,
  postId: string
): Promise<PostModerationResult> {
  try {
    const { error, requestId } = await callAction(supabase, action, postId)
    if (error) {
      logger.warn('admin.denied', { action: ACTION_LABEL[action], code: error.code ?? 'unknown', request_id: requestId })
      // The queue has always shown this generic line for a refused RPC (its error is not an Error).
      return { ok: false, message: 'An error occurred' }
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
