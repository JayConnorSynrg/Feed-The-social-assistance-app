'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { logger } from '@/lib/logger'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface Post {
  id: string
  user_id: string
  content: string
  image_url: string | null
  is_pinned: boolean
  is_hidden: boolean
  created_at: string
  updated_at: string
}

interface UseRealtimeFeedOptions {
  onInsert?: (post: Post) => void
  onUpdate?: (post: Post) => void
  onDelete?: (postId: string) => void
  enabled?: boolean
}

export function useRealtimeFeed({
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeFeedOptions = {}) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const { session } = useAuth()

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Post>) => {
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new && !payload.new.is_hidden) {
            onInsert?.(payload.new as Post)
          }
          break
        case 'UPDATE':
          if (payload.new) {
            // When is_hidden flips true (admin remove/hold), treat as a DELETE
            // so all connected clients instantly remove the post from their feed.
            if (payload.new.is_hidden === true) {
              onDelete?.(payload.new.id)
            } else {
              onUpdate?.(payload.new as Post)
            }
          }
          break
        case 'DELETE':
          if (payload.old?.id) {
            onDelete?.(payload.old.id)
          }
          break
      }
    },
    [onInsert, onUpdate, onDelete]
  )

  useEffect(() => {
    // Gate subscribe on both the enabled flag and an authenticated session.
    // Without a session the Supabase realtime gateway rejects the connection,
    // producing a console error on every unauthenticated page load.
    if (!enabled || !session) return

    const channel = supabase
      .channel('posts-realtime')
      .on<Post>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        handleChange
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          logger.error('realtime-feed.subscribe.status', undefined, {
            channel: 'posts-realtime',
            status,
          })
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, enabled, session, handleChange])

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [supabase])

  return { unsubscribe }
}

interface UseRealtimeLikesOptions {
  postId: string
  onLikeChange?: (count: number, userLiked: boolean) => void
  enabled?: boolean
}

export function useRealtimeLikes({
  postId,
  onLikeChange,
  enabled = true,
}: UseRealtimeLikesOptions) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!enabled || !postId) return

    const fetchLikeCount = async () => {
      const { count } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)

      const { data: { user } } = await supabase.auth.getUser()
      let userLiked = false

      if (user) {
        const { data } = await supabase
          .from('post_likes')
          .select('user_id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .single()

        userLiked = !!data
      }

      onLikeChange?.(count || 0, userLiked)
    }

    const channel = supabase
      .channel(`likes-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchLikeCount()
        }
      )
      .subscribe()

    channelRef.current = channel
    fetchLikeCount()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, postId, enabled, onLikeChange])
}

interface UseRealtimeCommentsOptions {
  postId: string
  onCommentChange?: (count: number) => void
  enabled?: boolean
}

export function useRealtimeComments({
  postId,
  onCommentChange,
  enabled = true,
}: UseRealtimeCommentsOptions) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!enabled || !postId) return

    const fetchCommentCount = async () => {
      const { count } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .eq('is_hidden', false)

      onCommentChange?.(count || 0)
    }

    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchCommentCount()
        }
      )
      .subscribe()

    channelRef.current = channel
    fetchCommentCount()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, postId, enabled, onCommentChange])
}
