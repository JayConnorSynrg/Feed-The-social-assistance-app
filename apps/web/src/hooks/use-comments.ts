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
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  id: string
  first_name: string | null
  avatar_url: string | null
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useComments(postId: string) {
  const supabase = createClient()

  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Fetch all visible comments for this post (flat → tree)
  const fetchComments = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('post_comments')
        .select('*, user:profiles(id, first_name, avatar_url)')
        .eq('post_id', postId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true })
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError
      const flat = (data ?? []) as unknown as Comment[]
      setComments(buildCommentTree(flat))
    } catch (err: unknown) {
      const msg = isQueryTimeout(err)
        ? 'Comments timed out — please check your connection and retry.'
        : getFriendlyErrorMessage(err, "Couldn't load comments. Please try again.")
      setError(msg)
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
        if (!user) throw new Error('You must be signed in to comment.')

        const { error: insertError } = await supabase
          .from('post_comments')
          .insert({ post_id: postId, user_id: user.id, content: content.trim() })

        if (insertError) throw insertError
        await fetchComments()
        return true
      } catch (err: unknown) {
        setError(getFriendlyErrorMessage(err, "Couldn't post comment. Please try again."))
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
        if (!user) throw new Error('You must be signed in to reply.')

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
        setError(getFriendlyErrorMessage(err, "Couldn't post reply. Please try again."))
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [supabase, postId, fetchComments]
  )

  return { comments, loading, error, submitting, fetchComments, addComment, addReply }
}
