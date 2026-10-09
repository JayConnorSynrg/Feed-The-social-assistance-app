'use client'

// apps/web/src/app/(admin)/moderation/focused-post.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The single-post view an "Edit in admin" link opens (/moderation?tab=moderation&focus=post:<id>):
// that one post — reported or not — with Remove / Hold / Authorize, above the reports queue.
//   - The post is read by id first (staff read any post, hidden or held, through posts_select_public;
//     every column but location is granted). The moderation RPCs accept any id and do not check it
//     exists, so the actions render only for a post that was read, and act on the id that was read.
//   - One admin.deeplink.resolve row: found, or not_found (no such post, or the read failed); a
//     moderator who leaves the tab first writes abandoned (use-admin-focus.ts).
//   - Actions go through moderatePost (post-moderation-actions.ts), the reports queue's own path.
// FocusedPostView is the stateless rendering (tested with react-dom/server).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { postVisibility } from '@/lib/member-visibility'
import { useAdminFocusSession } from './use-admin-focus'
import {
  moderatePost,
  postActionsFor,
  type ModeratedPostState,
  type PostModerationAction,
} from './post-moderation-actions'

/** Columns of the linked post (no location). The author embed names its FK: posts reach profiles
 *  two ways (lib/supabase/embed-fk-hint.test.ts). */
export const FOCUSED_POST_SELECT =
  'id, content, post_type, created_at, is_hidden, hidden_reason, hidden_at, author:profiles!posts_user_id_fkey(first_name, username)'

export interface FocusedPostRow extends ModeratedPostState {
  id: string
  content: string | null
  post_type: string | null
  created_at: string
  hidden_at: string | null
  author: { first_name: string | null; username: string | null } | null
}

export type FocusedPostState =
  | { status: 'loading' }
  | { status: 'found'; post: FocusedPostRow }
  | { status: 'not_found' }
  | { status: 'error' }

type PostReader = Pick<SupabaseClient<Database>, 'from'>

/** Read the linked post by id: found, not_found (no row), or error (the read failed). */
export async function loadFocusedPost(supabase: PostReader, postId: string): Promise<Exclude<FocusedPostState, { status: 'loading' }>> {
  try {
    const { data, error } = await supabase.from('posts').select(FOCUSED_POST_SELECT).eq('id', postId).maybeSingle()
    if (error) {
      logger.warn('admin.deeplink.load_failed', { kind: 'post', code: error.code ?? 'unknown' })
      return { status: 'error' }
    }
    return data ? { status: 'found', post: data as unknown as FocusedPostRow } : { status: 'not_found' }
  } catch {
    logger.warn('admin.deeplink.load_failed', { kind: 'post', code: 'exception' })
    return { status: 'error' }
  }
}

/** The post after a successful action — the same columns the RPC sets. */
export function applyPostAction<T extends ModeratedPostState>(post: T, action: PostModerationAction): T {
  switch (action) {
    case 'remove':
      return { ...post, is_hidden: true, hidden_reason: 'admin_removal' }
    case 'hold':
      return { ...post, is_hidden: true, hidden_reason: 'hold_for_review' }
    case 'authorize':
      return { ...post, is_hidden: false, hidden_reason: null }
  }
}

/** What members see of the post now. */
export function postStatusLabel(post: ModeratedPostState): string {
  if (post.is_hidden === false) return 'Visible to members'
  if (post.hidden_reason === 'admin_removal') return 'Removed'
  if (post.hidden_reason === 'hold_for_review') return 'Held for review'
  return 'Hidden from members'
}

const ACTION_LABELS: Record<PostModerationAction, string> = {
  remove: 'Remove Post',
  hold: 'Hold for Review',
  authorize: 'Authorize Post',
}

export interface FocusedPostViewProps {
  state: FocusedPostState
  processing: PostModerationAction | null
  error: string | null
  onAction: (action: PostModerationAction) => void
  onDismiss: () => void
  headingRef?: React.Ref<HTMLHeadingElement>
}

export function FocusedPostView({ state, processing, error, onAction, onDismiss, headingRef }: FocusedPostViewProps) {
  return (
    <section
      aria-labelledby="focused-post-title"
      data-testid="focused-post"
      className="mb-4 rounded-xl border-2 border-lime-700 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="focused-post-title" ref={headingRef} tabIndex={-1} className="text-base font-semibold text-stone-900 focus:outline-none">
          Linked post
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close linked post"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {state.status === 'loading' && (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm text-stone-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the linked post…
        </p>
      )}
      {state.status === 'not_found' && (
        <p role="status" className="mt-2 text-sm text-stone-800">
          This post was not found. It may have been deleted.
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          The linked post could not be loaded. The reports queue below still works.
        </p>
      )}
      {state.status === 'found' && (
        <FoundPost post={state.post} processing={processing} error={error} onAction={onAction} />
      )}
    </section>
  )
}

function FoundPost({
  post,
  processing,
  error,
  onAction,
}: {
  post: FocusedPostRow
  processing: PostModerationAction | null
  error: string | null
  onAction: (action: PostModerationAction) => void
}) {
  const author = post.author?.first_name || (post.author?.username ? `@${post.author.username}` : null)
  const text = (post.content ?? '').replace(/\s+/g, ' ').trim()
  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-700">
        <span data-testid="focused-post-status" className="rounded bg-stone-100 px-2 py-0.5 font-medium text-stone-800">
          {postStatusLabel(post)}
        </span>
        {author && <span>Author: {author}</span>}
        <span>{new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <MemberViewLink
          to={{ kind: 'post', id: post.id }}
          visibility={postVisibility(post)}
          label="View post"
          itemName={text.length > 60 ? `${text.slice(0, 57)}…` : text}
          source="focused_post"
        />
      </div>
      {post.content && <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{post.content}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {postActionsFor(post).map((action) => (
          <Button
            key={action}
            size="sm"
            variant={action === 'remove' ? 'destructive' : 'outline'}
            className="h-9 min-h-[44px] text-xs"
            disabled={processing !== null}
            onClick={() => onAction(action)}
            data-testid={`focused-${action}-post`}
          >
            {processing === action && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />}
            {ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * The linked post, when the URL carries `focus=post:<id>`; nothing otherwise. `onChanged` runs after
 * an action succeeded (the moderation tab reloads the queue below).
 */
export function FocusedPost({ onChanged }: { onChanged?: () => void }) {
  const session = useAdminFocusSession('post', 'moderation')
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<FocusedPostState>({ status: 'loading' })
  const [dismissed, setDismissed] = useState(false)
  const [processing, setProcessing] = useState<PostModerationAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    void loadFocusedPost(supabase, session.focus.id).then((next) => {
      if (!active) return
      session.resolve(next.status === 'found' ? 'found' : 'not_found')
      setState(next)
      requestAnimationFrame(() => headingRef.current?.focus())
    })
    return () => {
      active = false
    }
  }, [session, supabase])

  if (!session || dismissed) return null

  const act = async (action: PostModerationAction) => {
    // Only a post that was read gets an action, and only one at a time.
    if (state.status !== 'found' || inFlight.current) return
    inFlight.current = true
    const post = state.post
    setProcessing(action)
    setError(null)
    const result = await moderatePost(supabase, action, post.id)
    if (result.ok) {
      setState({ status: 'found', post: applyPostAction(post, action) })
      onChanged?.()
    } else {
      setError(result.message)
    }
    setProcessing(null)
    inFlight.current = false
  }

  return (
    <FocusedPostView
      state={state}
      processing={processing}
      error={error}
      onAction={(a) => void act(a)}
      onDismiss={() => setDismissed(true)}
      headingRef={headingRef}
    />
  )
}
