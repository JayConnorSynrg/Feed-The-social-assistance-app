'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { PostCard } from './post-card'
import { createClient } from '@/lib/supabase/client'
import type { Post, Profile } from '@feed/database'

interface FeedListProps {
  initialPosts?: (Post & { user?: Profile })[]
}

const PAGE_SIZE = 20

export function FeedList({ initialPosts = [] }: FeedListProps) {
  const [posts, setPosts] = useState<(Post & { user?: Profile })[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const fetchPosts = useCallback(async (cursor?: string) => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('posts')
        .select('*, user:profiles(id, username, full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (cursor) {
        query = query.lt('created_at', cursor)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      if (data) {
        const newPosts = data as (Post & { user?: Profile })[]

        if (cursor) {
          setPosts((prev) => [...prev, ...newPosts])
        } else {
          setPosts(newPosts)
        }

        setHasMore(newPosts.length === PAGE_SIZE)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Initial load
  useEffect(() => {
    if (initialPosts.length === 0) {
      fetchPosts()
    }
  }, [fetchPosts, initialPosts.length])

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const lastPost = posts[posts.length - 1]
          if (lastPost) {
            fetchPosts(lastPost.created_at)
          }
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [posts, hasMore, loading, fetchPosts])

  // Real-time subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('posts-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          // Fetch the new post with user data
          const { data } = await supabase
            .from('posts')
            .select('*, user:profiles(id, username, full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setPosts((prev) => [data as Post & { user?: Profile }, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleLike = async (postId: string) => {
    // Optimistic update happens in PostCard
    // Here we would sync with the server
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select()
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single()

    if (existingLike) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id } as never)
    }
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => fetchPosts()}
          className="mt-2 text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (posts.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No posts yet. Be the first to share something!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={handleLike}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        {!hasMore && posts.length > 0 && (
          <p className="text-sm text-muted-foreground">You&apos;ve reached the end</p>
        )}
      </div>
    </div>
  )
}
