'use client'

/**
 * comment-thread.tsx
 *
 * Collapsible per-post comment thread.
 * - Renders a flat→tree list of comments respecting parent_id (one level of indent).
 * - Composer for top-level comments.
 * - Reply affordance on each comment.
 * - Respects is_hidden (hidden comments never rendered — filtered at hook level).
 * - Wires useRealtimeComments for live append on new DB inserts.
 * - Earth-tone styling: stone/lime palette.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Send, User, Loader2, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useComments, type Comment } from '@/hooks/use-comments'
import { useRealtimeComments } from '@/hooks/use-realtime-feed'
import { useAuth } from '@/hooks/use-auth'
import { formatDistanceToNow } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentThreadProps {
  postId: string
  /** Called when realtime fires so parent can update its comment count badge */
  onCountChange?: (count: number) => void
}

// ---------------------------------------------------------------------------
// Single comment row
// ---------------------------------------------------------------------------

interface CommentRowProps {
  comment: Comment
  depth?: number
  onReply: (parentId: string, content: string) => Promise<boolean>
  submitting: boolean
  isAuthenticated: boolean
  /** IDs of comments whose reply composer is currently open (lifted to CommentThread) */
  replyOpenIds: Set<string>
  onToggleReply: (id: string) => void
  /** Reply text per comment id (lifted to CommentThread so it survives realtime refetches) */
  replyTexts: Map<string, string>
  onReplyTextChange: (id: string, text: string) => void
}

function CommentRow({ comment, depth = 0, onReply, submitting, isAuthenticated, replyOpenIds, onToggleReply, replyTexts, onReplyTextChange }: CommentRowProps) {
  const replyOpen = replyOpenIds.has(comment.id)
  const replyText = replyTexts.get(comment.id) ?? ''
  const [localSubmitting, setLocalSubmitting] = useState(false)

  const authorName = comment.user?.full_name ?? 'Anonymous'
  const initials = authorName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleSubmitReply = async () => {
    if (!replyText.trim() || localSubmitting) return
    setLocalSubmitting(true)
    const ok = await onReply(comment.id, replyText)
    if (ok) {
      onReplyTextChange(comment.id, '')
      onToggleReply(comment.id) // close after successful submit
    }
    setLocalSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmitReply()
    }
  }

  return (
    <div
      data-testid={`comment-${comment.id}`}
      className={depth > 0 ? 'ml-8 border-l-2 border-stone-200 pl-3' : ''}
    >
      <div className="flex gap-2.5 py-2.5">
        <Avatar className="h-7 w-7 flex-shrink-0">
          {comment.user?.avatar_url && (
            <AvatarImage src={comment.user.avatar_url} alt={authorName} />
          )}
          <AvatarFallback className="bg-stone-200 text-stone-600 text-[10px]">
            {initials || <User className="h-3 w-3" />}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-xs font-semibold text-stone-800">{authorName}</span>
            <span className="text-[10px] text-stone-400">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-stone-700 leading-snug whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Reply affordance — only for authenticated users, only on top-level (depth 0) */}
          {isAuthenticated && depth === 0 && (
            <button
              data-testid={`reply-btn-${comment.id}`}
              onClick={() => onToggleReply(comment.id)}
              className="mt-1 text-[11px] text-stone-400 hover:text-[#4a5d23] transition-colors flex items-center gap-1"
              aria-label={replyOpen ? 'Cancel reply' : 'Reply to this comment'}
            >
              <CornerDownRight className="h-3 w-3" />
              {replyOpen ? 'Cancel' : 'Reply'}
            </button>
          )}

          {/* Inline reply composer */}
          {replyOpen && (
            <div className="mt-2 flex gap-2 items-end">
              <Textarea
                data-testid={`reply-input-${comment.id}`}
                value={replyText}
                onChange={(e) => onReplyTextChange(comment.id, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a reply… (Cmd+Enter to submit)"
                rows={2}
                className="flex-1 text-sm text-stone-900 placeholder:text-stone-400 resize-none rounded-lg border-stone-200 focus:border-[#4a5d23] focus:ring-[#4a5d23]/20"
              />
              <Button
                data-testid={`reply-submit-${comment.id}`}
                size="sm"
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || localSubmitting || submitting}
                className="bg-[#4a5d23] hover:bg-[#3a4d18] text-white h-9"
              >
                {localSubmitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies (one level of indent) */}
      {comment.replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          onReply={onReply}
          submitting={submitting}
          isAuthenticated={isAuthenticated}
          replyOpenIds={replyOpenIds}
          onToggleReply={onToggleReply}
          replyTexts={replyTexts}
          onReplyTextChange={onReplyTextChange}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main CommentThread component
// ---------------------------------------------------------------------------

export function CommentThread({ postId, onCountChange }: CommentThreadProps) {
  const { user, isAuthenticated } = useAuth()
  const { comments, loading, error, submitting, fetchComments, addComment, addReply } =
    useComments(postId)

  const [newComment, setNewComment] = useState('')
  const [showAll, setShowAll] = useState(false)
  // Lifted reply-open state: survives realtime refetches (which remount CommentRows)
  const [replyOpenIds, setReplyOpenIds] = useState<Set<string>>(new Set())
  // Lifted reply text: survives realtime refetches so in-progress text isn't lost
  const [replyTexts, setReplyTexts] = useState<Map<string, string>>(new Map())

  const handleToggleReply = useCallback((id: string) => {
    setReplyOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleReplyTextChange = useCallback((id: string, text: string) => {
    setReplyTexts((prev) => {
      const next = new Map(prev)
      next.set(id, text)
      return next
    })
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // Wire realtime: when a new comment lands, refetch so tree rebuilds correctly
  const handleRealtimeChange = useCallback(
    (count: number) => {
      fetchComments()
      onCountChange?.(count)
    },
    [fetchComments, onCountChange]
  )

  useRealtimeComments({
    postId,
    onCommentChange: handleRealtimeChange,
    enabled: true,
  })

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return
    const ok = await addComment(newComment)
    if (ok) setNewComment('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmitComment()
    }
  }

  // Show first 5 top-level comments, expand to all on demand
  const INITIAL_SHOW = 5
  const visibleComments = showAll ? comments : comments.slice(0, INITIAL_SHOW)
  const hiddenCount = comments.length - INITIAL_SHOW

  return (
    <div
      data-testid="comment-thread"
      className="border-t border-stone-100 bg-stone-50/60 px-4 pb-3 pt-2"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <MessageCircle className="h-3.5 w-3.5 text-stone-400" />
        <span className="text-xs font-medium text-stone-500">
          {loading ? 'Loading…' : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <p
          data-testid="comment-error"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2"
        >
          {error}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-3 text-stone-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading comments…</span>
        </div>
      )}

      {/* Comment list */}
      {!loading && (
        <div data-testid="comment-list" className="divide-y divide-stone-100">
          {visibleComments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onReply={addReply}
              submitting={submitting}
              isAuthenticated={isAuthenticated}
              replyOpenIds={replyOpenIds}
              onToggleReply={handleToggleReply}
              replyTexts={replyTexts}
              onReplyTextChange={handleReplyTextChange}
            />
          ))}
        </div>
      )}

      {/* Show more / collapse */}
      {!loading && hiddenCount > 0 && (
        <button
          data-testid="show-more-comments"
          onClick={() => setShowAll(true)}
          className="mt-1 text-xs text-stone-400 hover:text-[#4a5d23] flex items-center gap-1 transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          Show {hiddenCount} more comment{hiddenCount !== 1 ? 's' : ''}
        </button>
      )}
      {!loading && showAll && comments.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-1 text-xs text-stone-400 hover:text-[#4a5d23] flex items-center gap-1 transition-colors"
        >
          <ChevronUp className="h-3 w-3" />
          Show fewer
        </button>
      )}

      {/* Composer — only for authenticated users */}
      {isAuthenticated && user && (
        <div
          data-testid="comment-composer"
          className="mt-3 flex gap-2 items-end"
        >
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="bg-stone-200 text-stone-600 text-[10px]">
              {(user.email?.[0] ?? 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Textarea
            data-testid="comment-input"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment… (Cmd+Enter to submit)"
            rows={2}
            className="flex-1 text-sm text-stone-900 placeholder:text-stone-400 resize-none rounded-lg border-stone-200 focus:border-[#4a5d23] focus:ring-[#4a5d23]/20"
          />
          <Button
            data-testid="comment-submit"
            size="sm"
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            className="bg-[#4a5d23] hover:bg-[#3a4d18] text-white h-9"
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      {/* Prompt unauthenticated users to sign in */}
      {!isAuthenticated && (
        <p className="mt-2 text-xs text-stone-400 text-center">
          Sign in to leave a comment.
        </p>
      )}
    </div>
  )
}
