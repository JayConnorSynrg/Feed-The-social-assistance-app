'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { logger, withMetric } from '@/lib/logger'
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
  // Discriminant + relation columns present on the posts row in the
  // postgres_changes payload. Declared so the insert handler can hydrate the
  // true post type instead of assuming 'feed' (INV2).
  post_type: string | null
  petition_id: string | null
  resource_id: string | null
  max_seekers: number | null
  // Structured metadata (event/request/offer fields) — on the posts WAL row, so
  // the in-place update patch can re-derive eventMeta / requestCategories (W1.4).
  metadata: unknown
  // Denormalized counts maintained in-txn by the like/comment count triggers and
  // shipped on the posts WAL (they are in the posts publication column list). The
  // update handler patches these absolute counts into the feed in place (W1.4).
  like_count: number | null
  comment_count: number | null
  slots_remaining: number | null
}

interface UseRealtimeFeedOptions {
  onInsert?: (post: Post) => void
  onUpdate?: (post: Post) => void
  onDelete?: (postId: string) => void
  /**
   * Fired when the channel returns to SUBSCRIBED after a prior CHANNEL_ERROR /
   * TIMED_OUT — i.e. a reconnect. Lets the feed backfill any events missed while
   * the socket was down (W1.4).
   */
  onResubscribe?: () => void
  enabled?: boolean
}

export function useRealtimeFeed({
  onInsert,
  onUpdate,
  onDelete,
  onResubscribe,
  enabled = true,
}: UseRealtimeFeedOptions = {}) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Tracks whether the channel has been in an error/timeout state so a return to
  // SUBSCRIBED is recognized as a reconnect (and triggers onResubscribe backfill).
  const hadChannelErrorRef = useRef(false)
  const { session } = useAuth()

  // useEvent-style stable refs: the consumer passes fresh callback closures every
  // render, but the subscribe effect must NOT tear down + rebuild the single
  // 'posts-realtime' channel each render (feed re-renders on every count tick now
  // that onUpdate patches state in place). Reading the latest callbacks through
  // refs keeps handleChange + the effect stable so the channel subscribes ONCE.
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onResubscribeRef = useRef(onResubscribe)
  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate
  onDeleteRef.current = onDelete
  onResubscribeRef.current = onResubscribe

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Post>) => {
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new && !payload.new.is_hidden) {
            onInsertRef.current?.(payload.new as Post)
          }
          break
        case 'UPDATE':
          if (payload.new) {
            // When is_hidden flips true (admin remove/hold), treat as a DELETE
            // so all connected clients instantly remove the post from their feed.
            if (payload.new.is_hidden === true) {
              onDeleteRef.current?.(payload.new.id)
            } else {
              onUpdateRef.current?.(payload.new as Post)
            }
          }
          break
        case 'DELETE':
          if (payload.old?.id) {
            onDeleteRef.current?.(payload.old.id)
          }
          break
      }
    },
    []
  )

  useEffect(() => {
    // Gate subscribe on both the enabled flag and an authenticated session.
    // Without a session the Supabase realtime gateway rejects the connection,
    // producing a console error on every unauthenticated page load.
    if (!enabled || !session) return

    let reconnectCount = 0

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
        if (status === 'SUBSCRIBED') {
          // Wrap the subscribe-to-ready latency signal — called once on successful subscribe.
          // withMetric is async; fire-and-forget here (no await needed — we just need the
          // Vercel track() side-effect and the structured log).
          withMetric('feed.realtime.subscribe', { channel: 'posts-realtime' }, () =>
            Promise.resolve()
          ).catch(() => {
            // Swallow — metric emission must never affect subscription state.
          })
          // Reconnect backfill: if the channel had errored/timed out, this
          // SUBSCRIBED is a recovery — fire onResubscribe so the feed re-reads
          // and backfills events missed while the socket was down (W1.4).
          if (hadChannelErrorRef.current) {
            hadChannelErrorRef.current = false
            onResubscribeRef.current?.()
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          hadChannelErrorRef.current = true
          reconnectCount++
          logger.info('feed.realtime.reconnect', { count: reconnectCount, status, channel: 'posts-realtime' })
          logger.error('realtime-feed.subscribe.status', undefined, {
            channel: 'posts-realtime',
            status,
          })
        } else if (status === 'CLOSED') {
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
    // Callbacks are read through refs (useEvent-style), so they are deliberately
    // NOT deps — the channel subscribes once and survives consumer re-renders.
  }, [supabase, enabled, session, handleChange])

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [supabase])

  return { unsubscribe }
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
