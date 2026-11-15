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
// Language: the panel is in the admin's language (lib/i18n-admin-moderation.ts; `locale` comes from
// the moderation tab, default English), marked lang/dir on its own root; the post's text and its
// author's name keep their own language and direction (lang="" dir="auto").

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { Button } from '@/components/ui/button'
import { formatMessage } from '@/lib/format-message'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { postVisibility } from '@/lib/member-visibility'
import { dir, type Locale } from '@/lib/i18n'
import { formatDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { adminModerationT, moderationActionDone, moderationActionLabel } from '@/lib/i18n-admin-moderation'
import { useAdminFocusSession } from './use-admin-focus'
import {
  DESTRUCTIVE_BUTTON_CLASS,
  moderatePost,
  postActionsFor,
  type ModeratedPostState,
  type PostModerationAction,
} from './post-moderation-actions'

/** Columns of the linked post (no location). The author embed names its FK: posts reach profiles
 *  two ways (lib/supabase/embed-fk-hint.test.ts). It reads first_name only — never username /
 *  avatar_url / bio, which Settings C2 revokes from anon and authenticated. */
export const FOCUSED_POST_SELECT =
  'id, user_id, content, post_type, created_at, is_hidden, hidden_reason, hidden_at, version, author:profiles!posts_user_id_fkey(first_name)'

export interface FocusedPostRow extends ModeratedPostState {
  id: string
  content: string | null
  post_type: string | null
  created_at: string
  hidden_at: string | null
  author: { first_name: string | null } | null
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

/** What members see of the post now (the reports queue's Removed & Held list reads it too). */
export function postStatusLabel(post: ModeratedPostState, locale: Locale = 'en'): string {
  if (post.is_hidden === false) return adminModerationT(locale, 'statusVisible')
  if (post.hidden_reason === 'admin_removal') return adminModerationT(locale, 'statusRemoved')
  if (post.hidden_reason === 'hold_for_review') return adminModerationT(locale, 'statusHeld')
  return adminModerationT(locale, 'statusHidden')
}

/** The text of the panel's one status region (always rendered, so each change is announced). */
export function focusedPostStatusText(state: FocusedPostState, lastAction: PostModerationAction | null, locale: Locale = 'en'): string {
  switch (state.status) {
    case 'loading':
      return adminModerationT(locale, 'focusLoading')
    case 'not_found':
      return adminModerationT(locale, 'focusNotFound')
    case 'error':
      return adminModerationT(locale, 'focusError')
    case 'found': {
      const status = formatMessage(adminModerationT(locale, 'statusLine'), { status: postStatusLabel(state.post, locale) })
      return lastAction ? `${moderationActionDone(lastAction, locale)} ${status}` : status
    }
  }
}

export interface FocusedPostViewProps {
  state: FocusedPostState
  processing: PostModerationAction | null
  /** The action that last succeeded (announced in the status region). */
  lastAction?: PostModerationAction | null
  error: string | null
  onAction: (action: PostModerationAction) => void
  onDismiss: () => void
  headingRef?: React.Ref<HTMLHeadingElement>
  /** The signed-in moderator: no lifting actions on their own post. */
  viewerId?: string | null
  /** The admin's language (the panel's words, dates and its lang / dir). */
  locale?: Locale
  /** The status region's text when the panel holds it still (a re-read after the queue acted). */
  statusText?: string | null
}

export function FocusedPostView({ state, processing, lastAction = null, error, onAction, onDismiss, headingRef, viewerId = null, locale = 'en', statusText = null }: FocusedPostViewProps) {
  return (
    <section
      aria-labelledby="focused-post-title"
      data-testid="focused-post"
      lang={locale}
      dir={dir(locale)}
      className="mb-4 rounded-xl border-2 border-lime-700 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="focused-post-title" ref={headingRef} tabIndex={-1} className="text-base font-semibold text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700">
          {adminModerationT(locale, 'focusTitle')}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={adminModerationT(locale, 'focusClose')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* ONE status region, present from the first render: loading → found / not found → each
          action's result change only its text, so screen readers announce every step. */}
      <p role="status" data-testid="focused-post-status" className="mt-2 flex items-center gap-2 text-sm font-medium text-stone-800">
        {state.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {statusText ?? focusedPostStatusText(state, lastAction, locale)}
      </p>

      {state.status === 'found' && (
        <FoundPost post={state.post} processing={processing} error={error} onAction={onAction} viewerId={viewerId} locale={locale} />
      )}
    </section>
  )
}

function FoundPost({
  post,
  processing,
  error,
  onAction,
  viewerId,
  locale,
}: {
  post: FocusedPostRow
  processing: PostModerationAction | null
  error: string | null
  onAction: (action: PostModerationAction) => void
  viewerId: string | null
  locale: Locale
}) {
  const author = post.author?.first_name || null
  const text = (post.content ?? '').replace(/\s+/g, ' ').trim()
  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-700">
        {author && (
          <span>
            {adminModerationT(locale, 'authorLabel')}{' '}
            <span lang="" dir="auto">{author}</span>
          </span>
        )}
        <span>{formatDate(post.created_at, locale, browserTimeZone())}</span>
        <MemberViewLink
          to={{ kind: 'post', id: post.id }}
          visibility={postVisibility(post)}
          label={adminModerationT(locale, 'viewPost')}
          locale={locale}
          itemName={text.length > 60 ? `${text.slice(0, 57)}…` : text}
          source="focused_post"
        />
      </div>
      {post.content && (
        <p lang="" dir="auto" className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">
          {post.content}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {postActionsFor(post, viewerId).map((action) => (
          <Button
            key={action}
            size="sm"
            variant={action === 'remove' ? 'destructive' : 'outline'}
            className={`h-9 min-h-[44px] text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-50${action === 'remove' ? ` ${DESTRUCTIVE_BUTTON_CLASS}` : ''}`}
            // aria-disabled (not disabled) while an action runs: the pressed button keeps focus.
            aria-disabled={processing !== null || undefined}
            onClick={() => {
              if (processing === null) onAction(action)
            }}
            data-testid={`focused-${action}-post`}
          >
            {processing === action && <Loader2 className="me-1 h-3 w-3 animate-spin" aria-hidden="true" />}
            {moderationActionLabel(action, locale)}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * The linked post, when the URL carries `focus=post:<id>`; nothing otherwise.
 *   - onChanged: an action here succeeded (the moderation tab reloads the queue below);
 *   - reloadKey: bumped when the queue below changed a post, so this panel re-reads its post and
 *     never offers an action on a stale state;
 *   - onDismissed: the panel was closed (the tab moves focus to its active sub-tab).
 *   - viewerId: the signed-in moderator (no Authorize on their own post; see postActionsFor).
 *   - locale: the admin's language, from the moderation tab (a prop, not a hook: the panel reads no
 *     auth state of its own).
 */
export function FocusedPost({
  onChanged,
  reloadKey = 0,
  onDismissed,
  viewerId = null,
  locale = 'en',
}: {
  onChanged?: () => void
  reloadKey?: number
  onDismissed?: () => void
  viewerId?: string | null
  locale?: Locale
}) {
  const session = useAdminFocusSession('post', 'moderation')
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<FocusedPostState>({ status: 'loading' })
  const [dismissed, setDismissed] = useState(false)
  const [processing, setProcessing] = useState<PostModerationAction | null>(null)
  const [lastAction, setLastAction] = useState<PostModerationAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A re-read after the queue below acted keeps the status region's text as it was: the queue
  // announces its own result, so the panel does not announce a second one.
  const [heldStatus, setHeldStatus] = useState<string | null>(null)
  const shownStatus = useRef('')
  const inFlight = useRef(false)
  const loadedOnce = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The text the status region shows now (read when a re-read holds it still).
  const statusNow = heldStatus ?? focusedPostStatusText(state, lastAction, locale)
  useEffect(() => {
    shownStatus.current = statusNow
  }, [statusNow])

  useEffect(() => {
    if (!session) return
    let active = true
    void loadFocusedPost(supabase, session.focus.id).then((next) => {
      if (!active) return
      if (!loadedOnce.current) {
        // The first read decides the link's one row and lands focus on the panel.
        loadedOnce.current = true
        session.resolve(next.status === 'found' ? 'found' : 'not_found')
        setState(next)
        requestAnimationFrame(() => headingRef.current?.focus())
        return
      }
      // A re-read after the queue changed a post: take its answer (the actions follow it), drop the
      // stale action line — and hold the status region's text still.
      setHeldStatus(shownStatus.current)
      setState(next)
      setLastAction(null)
    })
    return () => {
      active = false
    }
  }, [session, supabase, reloadKey])

  if (!session || dismissed) return null

  const act = async (action: PostModerationAction) => {
    // Only a post that was read gets an action it offers, and only one at a time.
    if (state.status !== 'found' || inFlight.current || !postActionsFor(state.post, viewerId).includes(action)) return
    inFlight.current = true
    const post = state.post
    // The panel's own action: its status region speaks again.
    setHeldStatus(null)
    setProcessing(action)
    setError(null)
    // The version on screen: if the author edited the post since, the RPC refuses (conflict) and the
    // panel re-reads it so the moderator decides on what members would actually see.
    const result = await moderatePost(supabase, action, post.id, post.version ?? null, locale)
    if (!result.ok && (result.conflict || result.gone)) {
      const next = await loadFocusedPost(supabase, post.id)
      setState(next)
      setError(result.message)
    } else if (result.ok) {
      setState({ status: 'found', post: applyPostAction(post, action) })
      setLastAction(action)
      onChanged?.()
      // The pressed button may be gone (the actions change with the status): focus the heading.
      requestAnimationFrame(() => headingRef.current?.focus())
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
      lastAction={lastAction}
      error={error}
      onAction={(a) => void act(a)}
      onDismiss={() => {
        setDismissed(true)
        onDismissed?.()
      }}
      headingRef={headingRef}
      viewerId={viewerId}
      locale={locale}
      statusText={heldStatus}
    />
  )
}
