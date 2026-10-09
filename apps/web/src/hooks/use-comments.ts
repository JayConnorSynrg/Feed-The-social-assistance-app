'use client'

/**
 * use-comments.ts
 *
 * Data layer for post_comments: fetch, insert top-level, insert reply.
 * Builds a parent_id tree client-side from a single flat fetch (no N+1).
 * Applies QUERY_TIMEOUT_MS abort pattern consistent with other hooks in this repo.
 */

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminTier } from '@/lib/admin-tier'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  id: string
  first_name: string | null
  avatar_url: string | null
  admin_tier: AdminTier | null
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  parent_id: string | null
  is_hidden: boolean
  created_at: string
  updated_at: string
  /** Post-editing columns (PR-2): the version token edit_comment sends, the Edited label, the soft
   *  delete (content '' + deleted_at; the row and its replies stay). */
  version: number
  edited_at: string | null
  edit_count: number
  deleted_at: string | null
  user: CommentAuthor | null
  // client-side tree — populated by buildCommentTree
  replies: Comment[]
}

// ---------------------------------------------------------------------------
// Tree builder — pure function, unit-testable
// ---------------------------------------------------------------------------

/**
 * Converts a flat array of comments (all for one post) into a nested tree.
 * Top-level nodes (parent_id === null) appear at the root.
 * Replies are nested under their parent.
 * Ordering: created_at ascending within each level.
 */
export function buildCommentTree(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>()
  // Clone to avoid mutating the input
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] })
  }

  const roots: Comment[] = []
  for (const c of map.values()) {
    if (c.parent_id === null) {
      roots.push(c)
    } else {
      const parent = map.get(c.parent_id)
      if (parent) {
        parent.replies.push(c)
      } else {
        // Orphaned reply (parent hidden/deleted) — surface as root
        roots.push(c)
      }
    }
  }

  // Sort each level by created_at ascending
  const sortByDate = (a: Comment, b: Comment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

  roots.sort(sortByDate)
  for (const root of roots) {
    root.replies.sort(sortByDate)
  }

  return roots
}

/**
 * What the thread shows: a deleted comment that still has replies stays as a "Comment deleted"
 * placeholder holding them; a deleted comment with no replies is left out. Pure.
 */
export function visibleCommentTree(roots: Comment[]): Comment[] {
  const keep = (c: Comment): Comment | null => {
    const replies = c.replies.map(keep).filter((r): r is Comment => r !== null)
    if (c.deleted_at && replies.length === 0) return null
    return { ...c, replies }
  }
  return roots.map(keep).filter((c): c is Comment => c !== null)
}

/**
 * What one viewer's thread shows, from the flat rows. Hidden comments are shown to staff only (the
 * database returns them to staff and to their own author; members and guests — the author included —
 * never see them in the thread). For everyone else they are dropped BEFORE the tree is built, so a
 * reply under a hidden comment still shows (as a root), exactly as when the read excluded them.
 */
export function commentThreadView(flat: readonly Comment[], opts: { includeHidden: boolean }): Comment[] {
  return visibleCommentTree(buildCommentTree(flat.filter((c) => opts.includeHidden || !c.is_hidden)))
}

/**
 * The number of comments a post has, as everyone counts them: live (not deleted) and not hidden,
 * replies included. The comment button and the thread header both show this number.
 */
export function liveCommentCount(flat: readonly Pick<Comment, 'deleted_at' | 'is_hidden'>[]): number {
  return flat.filter((c) => c.deleted_at == null && !c.is_hidden).length
}

/** The hook's error, as a token the thread translates (lib/i18n-feed-comments.ts commentErrorText).
 *  'closed': the server refused a new comment because the post is hidden or deleted (post_comments RLS). */
export type CommentError = 'load_timeout' | 'load_failed' | 'post_failed' | 'reply_failed' | 'closed' | 'signed_out'
export const COMMENTS_CLOSED: CommentError = 'closed'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useComments(postId: string) {
  const supabase = createClient()

  // Flat rows as the database returned them (RLS: visible comments, plus hidden ones for staff and
  // their author); the thread builds its view with commentThreadView.
  const [rows, setRows] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<CommentError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Fetch all visible comments for this post (flat → tree)
  const fetchComments = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('post_comments')
        .select('*, user:profiles!post_comments_user_id_fkey(id, first_name, avatar_url, admin_tier)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError
      const flat = (data ?? []) as unknown as Comment[]
      setRows(flat)
    } catch (err: unknown) {
      setError(isQueryTimeout(err) ? 'load_timeout' : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [supabase, postId])

  // Insert a top-level comment (parent_id = null)
  const addComment = useCallback(
    async (content: string): Promise<boolean> => {
      if (!content.trim()) return false
      setSubmitting(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setError('signed_out')
          return false
        }

        const { error: insertError } = await supabase
          .from('post_comments')
          .insert({ post_id: postId, user_id: user.id, content: content.trim() })

        if (insertError) throw insertError
        await fetchComments()
        return true
      } catch (err: unknown) {
        setError((err as { code?: string })?.code === '42501' ? COMMENTS_CLOSED : 'post_failed')
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [supabase, postId, fetchComments]
  )

  // Insert a reply (parent_id set)
  const addReply = useCallback(
    async (parentId: string, content: string): Promise<boolean> => {
      if (!content.trim()) return false
      setSubmitting(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setError('signed_out')
          return false
        }

        const { error: insertError } = await supabase
          .from('post_comments')
          .insert({
            post_id: postId,
            user_id: user.id,
            content: content.trim(),
            parent_id: parentId,
          })

        if (insertError) throw insertError
        await fetchComments()
        return true
      } catch (err: unknown) {
        setError((err as { code?: string })?.code === '42501' ? COMMENTS_CLOSED : 'reply_failed')
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [supabase, postId, fetchComments]
  )

  return { rows, loading, error, submitting, fetchComments, addComment, addReply }
}
