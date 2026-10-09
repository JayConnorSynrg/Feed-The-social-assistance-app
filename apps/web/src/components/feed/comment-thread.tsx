'use client'

/**
 * comment-thread.tsx
 *
 * Collapsible per-post comment thread, in the member's language (lib/i18n-feed-comments.ts).
 * - A flat → tree list (one level of replies). A comment its author deleted stays as "Comment
 *   deleted" while it has replies (they are kept); with no replies it is left out.
 * - Under each comment, inline actions decided by commentActions (post-actions.ts): Reply; for its
 *   author Edit (inline, saved through edit_comment with its version — single-flight, settles from a
 *   re-read; a stale version shows the current text and keeps the draft) and Delete (confirmation,
 *   delete_own_comment); "Edited" opens the comment's public history; moderators Hide
 *   (admin_set_comment_hidden). Nobody edits another person's comment.
 * - Results are announced in a polite status region (4.1.3); metadata meets AA (stone-600).
 * - Live: useRealtimeComments re-reads on every post_comments change.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MessageCircle, Send, User, Loader2, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useComments, type Comment } from '@/hooks/use-comments'
import { useRealtimeComments } from '@/hooks/use-realtime-feed'
import { useAuth } from '@/hooks/use-auth'
import { useAdminViewer } from '@/hooks/use-admin-viewer'
import { createClient } from '@/lib/supabase/client'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n-event-forms'
import { relativeTimeText } from '@/lib/event-time'
import { commentsT, commentErrorText } from '@/lib/i18n-feed-comments'
import { roleLabel } from '@/lib/i18n-feed-card'
import { editT, failureText } from '@/lib/i18n-feed-edit'
import { deleteOwnComment, editComment, setCommentHidden } from '@/lib/post-rpc'
import { createSingleFlight } from './composer-guards'
import { commentActions, type ActionViewer, type CommentActionId } from './post-actions'
import { ConfirmDeleteDialog } from './post-delete-dialog'
import { PostHistoryDialog, formatHistoryTime, type HistoryTarget } from './post-history-dialog'
import { LIMITS } from './post-edit-model'

interface CommentThreadProps {
  postId: string
  locale: Locale
  /** Called when realtime fires so the card can update its comment count badge */
  onCountChange?: (count: number) => void
}

/** "3 hours ago" in the viewer's language (Intl), or the translated short form where Intl has none. */
export function commentAge(iso: string, locale: Locale, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (mins < 1) return commentsT(locale, 'justNow')
  const pick = (n: number, unit: 'minute' | 'hour' | 'day') => relativeTimeText(-n, unit, locale) ?? formatMessage(commentsT(locale, unit === 'minute' ? 'minutesAgo' : unit === 'hour' ? 'hoursAgo' : 'daysAgo'), { n })
  if (mins < 60) return pick(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return pick(hours, 'hour')
  return pick(Math.round(hours / 24), 'day')
}

interface RowContext {
  locale: Locale
  viewer: ActionViewer
  isAuthenticated: boolean
  submitting: boolean
  onReply: (parentId: string, content: string) => Promise<boolean>
  replyOpenIds: Set<string>
  onToggleReply: (id: string) => void
  replyTexts: Map<string, string>
  onReplyTextChange: (id: string, text: string) => void
  editingId: string | null
  onAction: (comment: Comment, action: CommentActionId, trigger: HTMLElement) => void
  onSaveEdit: (comment: Comment, text: string) => Promise<void>
  onCancelEdit: () => void
  editNotice: { commentId: string; current: string } | null
}

function CommentRow({ comment, depth = 0, ctx }: { comment: Comment; depth?: number; ctx: RowContext }) {
  const { locale } = ctx
  const replyOpen = ctx.replyOpenIds.has(comment.id)
  const replyText = ctx.replyTexts.get(comment.id) ?? ''
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const [editText, setEditText] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const editing = ctx.editingId === comment.id
  const editRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      setEditText((t) => (ctx.editNotice?.commentId === comment.id ? t : comment.content))
      requestAnimationFrame(() => editRef.current?.focus())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const deleted = comment.deleted_at != null
  const authorName = comment.user?.first_name ?? commentsT(locale, 'anonymous')
  const initials = authorName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const actions = commentActions(ctx.viewer, { authorId: comment.user_id, editedAt: comment.edited_at, deletedAt: comment.deleted_at })

  const handleSubmitReply = async () => {
    if (!replyText.trim() || localSubmitting) return
    setLocalSubmitting(true)
    const ok = await ctx.onReply(comment.id, replyText)
    if (ok) {
      ctx.onReplyTextChange(comment.id, '')
      ctx.onToggleReply(comment.id)
    }
    setLocalSubmitting(false)
  }

  const saveEdit = async () => {
    if (saving) return
    setSaving(true)
    try {
      await ctx.onSaveEdit(comment, editText)
    } finally {
      setSaving(false)
    }
  }

  const tierText = comment.user?.admin_tier ? roleLabel(comment.user.admin_tier, locale) : null

  return (
    <div data-testid={`comment-${comment.id}`} className={depth > 0 ? 'ms-8 border-s-2 border-stone-200 ps-3' : ''}>
      <div className="flex gap-2.5 py-2.5">
        {deleted ? (
          <div className="h-7 w-7 flex-shrink-0 rounded-full bg-stone-200" aria-hidden="true" />
        ) : (
          <Avatar className="h-7 w-7 flex-shrink-0">
            {comment.user?.avatar_url && <AvatarImage src={comment.user.avatar_url} alt="" />}
            <AvatarFallback className="bg-stone-200 text-[10px] text-stone-700">{initials || <User className="h-3 w-3" aria-hidden="true" />}</AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          {deleted ? (
            <p className="text-sm italic text-stone-600" data-testid={`comment-deleted-${comment.id}`}>
              {commentsT(locale, 'deletedComment')}
            </p>
          ) : (
            <>
              <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-stone-800" dir="auto">
                  {authorName}
                </span>
                {tierText && <span className="rounded-full bg-lime-100 px-1.5 py-0.5 text-[10px] font-medium text-lime-900">{tierText}</span>}
                <time dateTime={comment.created_at} className="text-[10px] text-stone-600">
                  {commentAge(comment.created_at, locale)}
                </time>
                {comment.edited_at && actions.includes('history') && (
                  <button
                    type="button"
                    data-testid={`comment-edited-${comment.id}`}
                    aria-label={formatMessage(commentsT(locale, 'editedAria'), { time: formatHistoryTime(comment.edited_at, locale) })}
                    onClick={(e) => ctx.onAction(comment, 'history', e.currentTarget)}
                    className="rounded-sm text-[10px] text-stone-600 underline underline-offset-2 hover:text-stone-900"
                  >
                    {commentsT(locale, 'edited')}
                  </button>
                )}
              </div>
              {editing ? (
                <div className="mt-1 flex flex-col gap-2">
                  {ctx.editNotice?.commentId === comment.id && (
                    <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
                      {commentsT(locale, 'editConflict')} <span dir="auto" className="font-medium">{ctx.editNotice.current}</span>
                    </p>
                  )}
                  <label htmlFor={`comment-edit-${comment.id}`} className="sr-only">
                    {commentsT(locale, 'editLabel')}
                  </label>
                  <Textarea
                    id={`comment-edit-${comment.id}`}
                    ref={editRef}
                    dir="auto"
                    rows={2}
                    maxLength={LIMITS.commentMax}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') ctx.onCancelEdit()
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        void saveEdit()
                      }
                    }}
                    className="resize-none rounded-lg border-stone-300 text-sm text-stone-900"
                    data-testid={`comment-edit-input-${comment.id}`}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveEdit()}
                      aria-disabled={saving || !editText.trim() || editText.trim() === comment.content || undefined}
                      className="h-8 bg-[#4a5d23] text-white hover:bg-[#3a4d18] aria-disabled:opacity-60"
                      data-testid={`comment-edit-save-${comment.id}`}
                    >
                      {saving && <Loader2 className="me-1 h-3 w-3 animate-spin" aria-hidden="true" />}
                      {editT(locale, 'save')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={ctx.onCancelEdit} className="h-8">
                      {editT(locale, 'cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-snug text-stone-800">
                  {comment.content}
                </p>
              )}
            </>
          )}

          {!editing && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
              {ctx.isAuthenticated && depth === 0 && !deleted && (
                <button
                  type="button"
                  data-testid={`reply-btn-${comment.id}`}
                  onClick={() => ctx.onToggleReply(comment.id)}
                  aria-expanded={replyOpen}
                  className="flex items-center gap-1 text-stone-600 transition-colors hover:text-[#4a5d23]"
                >
                  <CornerDownRight className="h-3 w-3" aria-hidden="true" />
                  {replyOpen ? commentsT(locale, 'cancelReply') : commentsT(locale, 'reply')}
                </button>
              )}
              {actions
                .filter((a) => a !== 'history')
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    data-testid={`comment-${a}-${comment.id}`}
                    onClick={(e) => ctx.onAction(comment, a, e.currentTarget)}
                    className={a === 'delete' || a === 'hide' ? 'text-red-800 hover:underline' : 'text-stone-600 hover:text-[#4a5d23]'}
                  >
                    {commentsT(locale, a === 'edit' ? 'edit' : a === 'delete' ? 'delete' : 'hide')}
                  </button>
                ))}
            </div>
          )}

          {replyOpen && (
            <div className="mt-2 flex items-end gap-2">
              <label htmlFor={`reply-input-${comment.id}`} className="sr-only">
                {commentsT(locale, 'replyLabel')}
              </label>
              <Textarea
                id={`reply-input-${comment.id}`}
                data-testid={`reply-input-${comment.id}`}
                dir="auto"
                value={replyText}
                onChange={(e) => ctx.onReplyTextChange(comment.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void handleSubmitReply()
                  }
                }}
                placeholder={commentsT(locale, 'replyPlaceholder')}
                rows={2}
                className="flex-1 resize-none rounded-lg border-stone-200 text-sm text-stone-900 placeholder:text-stone-500 focus:border-[#4a5d23] focus:ring-[#4a5d23]/20"
              />
              <Button
                data-testid={`reply-submit-${comment.id}`}
                size="sm"
                onClick={() => void handleSubmitReply()}
                disabled={!replyText.trim() || localSubmitting || ctx.submitting}
                aria-label={commentsT(locale, 'sendReply')}
                className="h-9 bg-[#4a5d23] text-white hover:bg-[#3a4d18]"
              >
                {localSubmitting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3 rtl:-scale-x-100" aria-hidden="true" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {comment.replies.map((reply) => (
        <CommentRow key={reply.id} comment={reply} depth={depth + 1} ctx={ctx} />
      ))}
    </div>
  )
}

export function CommentThread({ postId, locale, onCountChange }: CommentThreadProps) {
  const { user, isAuthenticated, isAnonymous } = useAuth()
  const adminViewer = useAdminViewer(false)
  const supabase = useMemo(() => createClient(), [])
  const { comments, loading, error, submitting, fetchComments, addComment, addReply } = useComments(postId)

  const [newComment, setNewComment] = useState('')
  const [showAll, setShowAll] = useState(false)
  // Lifted reply-open state + text: survive realtime refetches.
  const [replyOpenIds, setReplyOpenIds] = useState<Set<string>>(new Set())
  const [replyTexts, setReplyTexts] = useState<Map<string, string>>(new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotice, setEditNotice] = useState<{ commentId: string; current: string } | null>(null)
  const [deleting, setDeleting] = useState<Comment | null>(null)
  const [history, setHistory] = useState<HistoryTarget | null>(null)
  const [status, setStatus] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const editGate = useRef(createSingleFlight())
  const hideGate = useRef(createSingleFlight())

  const viewer: ActionViewer = {
    id: user?.id ?? null,
    isGuest: isAnonymous,
    tier: adminViewer.status === 'ready' ? adminViewer.tier : null,
  }

  const handleToggleReply = useCallback((id: string) => {
    setReplyOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleReplyTextChange = useCallback((id: string, text: string) => {
    setReplyTexts((prev) => new Map(prev).set(id, text))
  }, [])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleRealtimeChange = useCallback(
    (count: number) => {
      fetchComments()
      onCountChange?.(count)
    },
    [fetchComments, onCountChange],
  )

  useRealtimeComments({ postId, onCommentChange: handleRealtimeChange, enabled: true })

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return
    const ok = await addComment(newComment)
    if (ok) setNewComment('')
  }

  const onSaveEdit = async (comment: Comment, text: string) => {
    await editGate.current.run(async () => {
      setActionError(null)
      const res = await editComment(supabase, comment.id, comment.version, text)
      if (res.ok) {
        setEditingId(null)
        setEditNotice(null)
        setStatus(commentsT(locale, 'statusEdited'))
        await fetchComments()
        return
      }
      if (res.failure.kind === 'conflict') {
        // The author's own other tab saved first: show its text above, keep this draft, and save
        // against the current version next time (the re-read refreshes the token).
        const { data } = await supabase.from('post_comments').select('content').eq('id', comment.id).maybeSingle()
        setEditNotice({ commentId: comment.id, current: (data?.content as string | undefined) ?? '' })
        await fetchComments()
        return
      }
      setActionError(res.failure.kind === 'not_found' ? commentsT(locale, 'commentGone') : failureText(locale, res.failure))
    })
  }

  const onAction = (comment: Comment, action: CommentActionId, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setActionError(null)
    switch (action) {
      case 'edit':
        setEditNotice(null)
        setEditingId(comment.id)
        return
      case 'delete':
        setDeleting(comment)
        return
      case 'history':
        setHistory({
          kind: 'comment',
          id: comment.id,
          authorId: comment.user_id,
          current: { version: comment.version, content: comment.content, imageUrl: null, createdAt: comment.created_at, editedAt: comment.edited_at },
        })
        return
      case 'hide':
        void hideGate.current.run(async () => {
          const res = await setCommentHidden(supabase, comment.id, true)
          if (res.ok) {
            setStatus(commentsT(locale, 'statusHidden'))
            await fetchComments()
          } else setActionError(failureText(locale, res.failure))
        })
        return
    }
  }

  const INITIAL_SHOW = 5
  const visibleComments = showAll ? comments : comments.slice(0, INITIAL_SHOW)
  const hiddenCount = comments.length - INITIAL_SHOW
  const errorText = error ? commentErrorText(locale, error) : null

  const ctx: RowContext = {
    locale,
    viewer,
    isAuthenticated,
    submitting,
    onReply: addReply,
    replyOpenIds,
    onToggleReply: handleToggleReply,
    replyTexts,
    onReplyTextChange: handleReplyTextChange,
    editingId,
    onAction,
    onSaveEdit,
    onCancelEdit: () => {
      setEditingId(null)
      setEditNotice(null)
      requestAnimationFrame(() => triggerRef.current?.focus())
    },
    editNotice,
  }

  return (
    <div data-testid="comment-thread" lang={locale} dir={dir(locale)} className="border-t border-stone-100 bg-stone-50/60 px-4 pb-3 pt-2">
      <div className="mb-2 flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5 text-stone-600" aria-hidden="true" />
        <span className="text-xs font-medium text-stone-700">
          {loading ? commentsT(locale, 'loadingShort') : formatMessage(commentsT(locale, 'commentCount'), { n: comments.length })}
        </span>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      {(errorText || actionError) && (
        <p data-testid="comment-error" role="alert" className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
          {actionError ?? errorText}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-3 text-stone-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span className="text-xs">{commentsT(locale, 'loadingComments')}</span>
        </div>
      )}

      {!loading && (
        <div data-testid="comment-list" className="divide-y divide-stone-100">
          {visibleComments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} ctx={ctx} />
          ))}
        </div>
      )}

      {!loading && hiddenCount > 0 && !showAll && (
        <button
          type="button"
          data-testid="show-more-comments"
          onClick={() => setShowAll(true)}
          className="mt-1 flex items-center gap-1 text-xs text-stone-600 transition-colors hover:text-[#4a5d23]"
        >
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
          {formatMessage(commentsT(locale, 'showMore'), { n: hiddenCount })}
        </button>
      )}
      {!loading && showAll && comments.length > INITIAL_SHOW && (
        <button type="button" onClick={() => setShowAll(false)} className="mt-1 flex items-center gap-1 text-xs text-stone-600 transition-colors hover:text-[#4a5d23]">
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
          {commentsT(locale, 'showFewer')}
        </button>
      )}

      {isAuthenticated && user && (
        <div data-testid="comment-composer" className="mt-3 flex items-end gap-2">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="bg-stone-200 text-[10px] text-stone-700">{(user.email?.[0] ?? 'U').toUpperCase()}</AvatarFallback>
          </Avatar>
          <label htmlFor={`comment-input-${postId}`} className="sr-only">
            {commentsT(locale, 'commentLabel')}
          </label>
          <Textarea
            id={`comment-input-${postId}`}
            data-testid="comment-input"
            dir="auto"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSubmitComment()
              }
            }}
            placeholder={commentsT(locale, 'commentPlaceholder')}
            rows={2}
            className="flex-1 resize-none rounded-lg border-stone-200 text-sm text-stone-900 placeholder:text-stone-500 focus:border-[#4a5d23] focus:ring-[#4a5d23]/20"
          />
          <Button
            data-testid="comment-submit"
            size="sm"
            onClick={() => void handleSubmitComment()}
            disabled={!newComment.trim() || submitting}
            aria-label={commentsT(locale, 'sendComment')}
            className="h-9 bg-[#4a5d23] text-white hover:bg-[#3a4d18]"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3 rtl:-scale-x-100" aria-hidden="true" />}
          </Button>
        </div>
      )}

      {!isAuthenticated && <p className="mt-2 text-center text-xs text-stone-600">{commentsT(locale, 'signInToComment')}</p>}

      <ConfirmDeleteDialog
        open={deleting !== null}
        kind="comment"
        locale={locale}
        returnFocusRef={triggerRef}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return null
          const res = await deleteOwnComment(supabase, deleting.id)
          if (!res.ok && res.failure.kind !== 'not_found') return failureText(locale, res.failure)
          setStatus(commentsT(locale, 'statusDeleted'))
          await fetchComments()
          return null
        }}
      />
      <PostHistoryDialog
        target={history}
        locale={locale}
        viewer={{ id: user?.id ?? null, isGuest: isAnonymous, isPlatformAdmin: viewer.tier === 'platform_admin' }}
        onClose={() => setHistory(null)}
        returnFocusRef={triggerRef}
      />
    </div>
  )
}
