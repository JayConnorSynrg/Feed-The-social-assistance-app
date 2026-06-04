'use client'

// apps/web/src/components/panels/feed-panel.tsx
// Community Feed panel - posts, updates, and interactions from mutual aid community
// Shows create post form, filter tabs, and scrollable feed of PostCards

import React, { useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Share2, Send, User, Loader2, Check, Link as LinkIcon, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { sanitizeInput } from '@/lib/security'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeFeed } from '@/hooks/use-realtime-feed'
import { useAuth } from '@/hooks/use-auth'
import { useSavedResources } from '@/hooks/use-saved-resources'
import { useOptIns, type OptInMap } from '@/hooks/use-opt-ins'
import { MessagesPanel } from './messages-panel'
import { usePanelContext } from '@/components/layout/feed-shell'
import { logger, withMetric } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { track } from '@vercel/analytics'
import { CommentThread } from '@/components/feed/comment-thread'

// ============================================
// TYPES
// ============================================
interface Post {
  id: string
  author: { id: string; name: string; avatar?: string; role: string }
  content: string
  timestamp: Date
  likes: number
  comments: number
  isLiked: boolean
  category: 'update' | 'request' | 'offer' | 'announcement'
  resourceId: string | null
  resourceName: string | null
  maxSeekers: number | null
  slotsRemaining: number | null
}

type FilterType = 'all' | 'following' | 'mine' | 'announcements'

// MOCK_POSTS removed - now fetching from Supabase

const CATEGORY_COLORS: Record<Post['category'], string> = {
  announcement: 'bg-blue-100 text-blue-700',
  request: 'bg-orange-100 text-orange-700',
  offer: 'bg-green-100 text-green-700',
  update: 'bg-gray-100 text-gray-700',
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`
  return date.toLocaleDateString()
}

// ============================================
// FEED HEADER
// ============================================
interface FeedHeaderProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

function FeedHeader({ activeFilter, onFilterChange }: FeedHeaderProps) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'following', label: 'Following' },
    { key: 'mine', label: 'My Posts' },
    { key: 'announcements', label: 'Announcements' },
  ]

  return (
    <div className="mb-4">
      <h2 className="font-semibold text-lg mb-3">Community Feed</h2>
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeFilter === filter.key
                ? 'bg-[#4a5d23] text-white'
                : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================
// CREATE POST CARD
// ============================================
interface ResourceOption {
  id: string
  name: string
}

interface CreatePostCardProps {
  onPost: (content: string, resourceId: string | null, maxSeekers: number | null) => void
  resourceOptions: ResourceOption[]
}

function CreatePostCard({ onPost, resourceOptions }: CreatePostCardProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [maxSeekersInput, setMaxSeekersInput] = useState<string>('')

  const { execute: executeRateLimited, isLimited } = useRateLimitedAction({
    limiterType: 'formSubmit',
    onRateLimited: () => setError('Posting too quickly. Please wait a moment.'),
  })

  const handleSubmit = async () => {
    if (!content.trim()) return
    setError(null)

    // Parse max_seekers — blank = unlimited (null)
    const maxSeekers =
      maxSeekersInput.trim() !== '' ? parseInt(maxSeekersInput, 10) : null
    if (maxSeekers !== null && (isNaN(maxSeekers) || maxSeekers <= 0)) {
      setError('Seeker limit must be a positive number.')
      return
    }

    const result = await executeRateLimited(async () => {
      const sanitizedContent = sanitizeInput(content)
      onPost(sanitizedContent, selectedResourceId || null, maxSeekers)
      setContent('')
      setSelectedResourceId('')
      setMaxSeekersInput('')
    })

    if (!result) {
      // Rate limited - error is already set
    }
  }

  return (
    <div className="mb-4 p-4 rounded-xl bg-[#faf9f6] border border-stone-200">
      {error && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#4a5d23] flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>

        {/* Input, Resource Selector, and Send */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLimited && handleSubmit()}
              placeholder="Share an update, request, or offer..."
              className="flex-1 bg-white"
              disabled={isLimited}
            />
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isLimited}
              size="icon"
              className="rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Optional resource link selector */}
          {resourceOptions.length > 0 && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
                <LinkIcon className="w-3.5 h-3.5 text-stone-400" />
              </div>
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-stone-200 bg-white pl-7 pr-7 py-1.5 text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#4a5d23]"
                aria-label="Link a resource (optional)"
              >
                <option value="">Link a resource (optional)</option>
                {resourceOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </div>
            </div>
          )}

          {/* Capacity input — shown whenever a resource is linked */}
          {selectedResourceId && (
            <Input
              type="number"
              min={1}
              value={maxSeekersInput}
              onChange={(e) => setMaxSeekersInput(e.target.value)}
              placeholder="Limit number of seekers (optional)"
              className="bg-white text-xs"
              aria-label="Limit number of seekers"
              data-testid="max-seekers-input"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// POST REACTIONS
// ============================================
interface PostReactionsProps {
  postId: string
  likes: number
  comments: number
  isLiked: boolean
  onLike: () => void
  onComment: () => void
  onShare: () => void
  shareCopied?: boolean
}

function PostReactions({ postId, likes, comments, isLiked, onLike, onComment, onShare, shareCopied }: PostReactionsProps) {
  return (
    <div className="flex items-center gap-4 pt-3 border-t border-stone-200">
      <button
        onClick={onLike}
        className={`flex items-center gap-1.5 text-sm transition-colors ${
          isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
        }`}
      >
        <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
        <span className="font-medium">{likes}</span>
      </button>

      <button
        onClick={onComment}
        data-testid={`comment-btn-${postId}`}
        aria-label="Comment"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="font-medium">{comments}</span>
      </button>

      <button
        onClick={onShare}
        className={`flex items-center gap-1.5 text-sm transition-colors ml-auto ${shareCopied ? 'text-green-600' : 'text-muted-foreground hover:text-primary'}`}
        aria-label={shareCopied ? 'Link copied' : 'Share post'}
      >
        {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {shareCopied && <span className="text-xs font-medium">Copied</span>}
      </button>
    </div>
  )
}

// ============================================
// POST CARD
// ============================================
interface PostCardProps {
  post: Post
  currentUserId: string | null
  optInStatus: string | undefined   // current user's opt-in status for this post
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onOptIn: (postId: string) => void
  onWithdraw: (postId: string) => void
  optInError?: string | null
  shareCopied?: boolean
  optInCount?: number
}

function PostCard({
  post,
  currentUserId,
  optInStatus,
  onLike,
  onComment,
  onShare,
  onOptIn,
  onWithdraw,
  optInError,
  shareCopied,
  optInCount,
}: PostCardProps) {
  const categoryColor = CATEGORY_COLORS[post.category]
  const isAuthor = currentUserId != null && post.author.id === currentUserId
  const isFull =
    post.maxSeekers != null &&
    post.slotsRemaining != null &&
    post.slotsRemaining <= 0

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-200 hover:border-primary/30 transition-all">
      {/* Author Row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#4a5d23] flex items-center justify-center flex-shrink-0">
          {post.author.avatar ? (
            <img src={post.author.avatar} alt={post.author.name} className="w-full h-full rounded-full" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>

        {/* Author Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-sm truncate">{post.author.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryColor}`}>
              {post.category}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{post.author.role}</span>
            <span>•</span>
            <span>{getRelativeTime(post.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed mb-3">{post.content}</p>

      {/* Resource chip — shown when the post is linked to a resource */}
      {post.resourceId && post.resourceName && (
        <div
          data-testid={`resource-chip-${post.id}`}
          className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full bg-lime-50 border border-lime-200 text-xs font-medium text-lime-700"
        >
          <LinkIcon className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[180px]">{post.resourceName}</span>
        </div>
      )}

      {/* Capacity + Opt-In section — only shown on posts with a capacity set */}
      {post.maxSeekers != null && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {/* Capacity meter */}
          <span
            data-testid={`capacity-${post.id}`}
            className="text-xs text-stone-600"
          >
            {post.slotsRemaining ?? 0} of {post.maxSeekers} spot{post.maxSeekers !== 1 ? 's' : ''} left
          </span>

          {/* Author view: opt-in count */}
          {isAuthor ? (
            <span
              data-testid={`opt-in-count-${post.id}`}
              className="text-xs font-medium text-lime-700"
            >
              {optInCount ?? 0} opted in
            </span>
          ) : (
            /* Seeker view: opt-in / opted-in + withdraw / full */
            optInStatus != null ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-lime-700 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Opted In
                </span>
                {optInStatus === 'pending' && (
                  <button
                    data-testid={`withdraw-btn-${post.id}`}
                    onClick={() => onWithdraw(post.id)}
                    className="text-xs text-stone-500 underline hover:text-stone-700"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ) : isFull ? (
              <button
                disabled
                className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-400 cursor-not-allowed"
              >
                Full
              </button>
            ) : (
              <button
                data-testid={`opt-in-btn-${post.id}`}
                onClick={() => onOptIn(post.id)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-lime-600 text-white hover:bg-lime-700 transition-colors"
              >
                Opt In
              </button>
            )
          )}
        </div>
      )}

      {/* Opt-in error alert */}
      {optInError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          {optInError}
        </div>
      )}

      {/* Reactions */}
      <PostReactions
        postId={post.id}
        likes={post.likes}
        comments={post.comments}
        isLiked={post.isLiked}
        onLike={() => onLike(post.id)}
        onComment={() => onComment(post.id)}
        onShare={() => onShare(post.id)}
        shareCopied={shareCopied}
      />
    </div>
  )
}

// ============================================
// MAIN FEED PANEL
// ============================================
export function FeedPanel() {
  const [posts, setPosts] = useState<Post[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareCopiedPostId, setShareCopiedPostId] = useState<string | null>(null)
  // Set of post IDs whose comment threads are currently open
  const [openCommentPostIds, setOpenCommentPostIds] = useState<Set<string>>(new Set())
  // Opt-in state: map of post_id → current user's opt-in status
  const [optInMap, setOptInMap] = useState<OptInMap>(new Map())
  // Per-post opt-in error (postId → message)
  const [optInErrors, setOptInErrors] = useState<Record<string, string>>({})
  // Per-post opt-in count for the author view (postId → count)
  const [optInCounts, setOptInCounts] = useState<Record<string, number>>({})

  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const supabase = createClient()
  const { panelParams, setActivePanel } = usePanelContext()
  // Saved resources for the resource-link selector in the composer
  const { savedResources } = useSavedResources()
  const resourceOptions: ResourceOption[] = savedResources
    .filter((r) => r.resource_id != null)
    .map((r) => ({ id: r.resource_id as string, name: r.resource_name }))
  const { fetchOptInsForPosts, optIn: doOptIn, withdrawOptIn: doWithdraw } = useOptIns()

  // Resolve active subtab from panelParams (set by alias routing in feed-shell)
  const activeSubtab: 'feed' | 'messages' =
    panelParams?.subtab === 'messages' ? 'messages' : 'feed'

  // Sync subtab when panelParams.subtab changes (e.g. back-button hash navigation)
  // No local state needed — activeSubtab is derived directly from panelParams.

  // Tab switch handler: drives via setActivePanel alias path so hash + state
  // stay in sync through one code path. replaceState — no back-button spam.
  const handleSubtabSwitch = useCallback((tab: 'feed' | 'messages') => {
    logger.info('nav.subtab.switch', { panel: 'feed', subtab: tab })
    track('nav_subtab', { panel: 'feed', subtab: tab })
    if (tab === 'messages') {
      setActivePanel('messages')
    } else {
      setActivePanel('feed')
    }
  }, [setActivePanel])

  // ARIA roving tabindex keyboard handler for the Feed tablist
  const handleFeedTabKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    const tabs: Array<'feed' | 'messages'> = ['feed', 'messages']
    let next = currentIdx
    if (e.key === 'ArrowRight') { e.preventDefault(); next = (currentIdx + 1) % tabs.length }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); next = (currentIdx - 1 + tabs.length) % tabs.length }
    else if (e.key === 'Home') { e.preventDefault(); next = 0 }
    else if (e.key === 'End') { e.preventDefault(); next = tabs.length - 1 }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSubtabSwitch(tabs[currentIdx]); return }
    else return
    const tabEls = (e.currentTarget.closest('[role="tablist"]') as HTMLElement | null)?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabEls?.[next]?.focus()
    handleSubtabSwitch(tabs[next])
  }, [handleSubtabSwitch])

  // Fetch posts from Supabase
  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await withMetric(
        'feed.load',
        { limit: 50 },
        async () => await supabase
          .from('posts')
          .select('*, user:profiles!posts_user_id_fkey(id, full_name, avatar_url, is_staff), resource:resources(id, name)')
          .eq('is_hidden', false)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      )

      if (error) throw error

      const rows = data || []
      const postIds = rows.map((p) => p.id)

      // Posts with a capacity set — need opt-in counts for the author view
      const cappedPostIds = rows
        .filter((r) => r.max_seekers != null)
        .map((r) => r.id)

      let likeCounts: Record<string, number> = {}
      let userLikes: Set<string> = new Set()
      let commentCounts: Record<string, number> = {}

      if (postIds.length > 0) {
        type PostIdRow = { post_id: string }
        type QueryResult = { data: PostIdRow[] | null }

        // Fetch likes, my-likes, comments, and opt-in counts in parallel
        const [likesResult, myLikesResult, commentsResult, optInResult] =
          await Promise.all([
            supabase.from('post_likes').select('post_id').in('post_id', postIds) as unknown as Promise<QueryResult>,
            user
              ? supabase
                  .from('post_likes')
                  .select('post_id')
                  .in('post_id', postIds)
                  .eq('user_id', user.id) as unknown as Promise<QueryResult>
              : Promise.resolve({ data: [] as PostIdRow[] }),
            supabase
              .from('post_comments')
              .select('post_id')
              .in('post_id', postIds)
              .eq('is_hidden', false) as unknown as Promise<QueryResult>,
            cappedPostIds.length > 0
              ? supabase
                  .from('resource_opt_ins')
                  .select('post_id')
                  .in('post_id', cappedPostIds) as unknown as Promise<QueryResult>
              : Promise.resolve({ data: [] as PostIdRow[] }),
          ])

        if (likesResult.data) {
          for (const like of likesResult.data) {
            likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1
          }
        }
        if (myLikesResult.data) {
          for (const like of myLikesResult.data) {
            userLikes.add(like.post_id)
          }
        }
        if (commentsResult.data) {
          for (const comment of commentsResult.data) {
            commentCounts[comment.post_id] = (commentCounts[comment.post_id] || 0) + 1
          }
        }
        if (optInResult?.data) {
          const counts: Record<string, number> = {}
          for (const row of optInResult.data) {
            counts[row.post_id] = (counts[row.post_id] || 0) + 1
          }
          setOptInCounts(counts)
        }
      }

      // Transform to Post interface (runs even when postIds is empty)
      const transformed: Post[] = rows.map((row) => ({
        id: row.id,
        author: {
          id: row.user?.id || '',
          name: row.user?.full_name || 'Anonymous',
          avatar: row.user?.avatar_url || undefined,
          role: row.user?.is_staff ? 'Admin' : 'Community Member',
        },
        content: row.content,
        timestamp: new Date(row.created_at ?? Date.now()),
        likes: likeCounts[row.id] || 0,
        comments: commentCounts[row.id] || 0,
        isLiked: userLikes.has(row.id),
        category: row.is_pinned ? 'announcement' : 'update',
        resourceId: row.resource?.id ?? null,
        resourceName: row.resource?.name ?? null,
        maxSeekers: row.max_seekers ?? null,
        slotsRemaining: row.slots_remaining ?? null,
      }))

      setPosts(transformed)

      // Fetch this user's opt-in statuses for the loaded posts
      if (user && postIds.length > 0) {
        fetchOptInsForPosts(postIds).then(setOptInMap)
      }
    } catch (err: unknown) {
      const msg = isQueryTimeout(err)
        ? 'Feed timed out — please check your connection and retry.'
        : err instanceof Error ? err.message : String(err)
      console.error('Error fetching posts:', msg, err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [supabase, user, fetchOptInsForPosts])

  // Initial fetch
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Real-time updates
  useRealtimeFeed({
    onInsert: () => {
      fetchPosts()
    },
    onUpdate: () => fetchPosts(),
    onDelete: (postId) => {
      setPosts(prev => prev.filter(p => p.id !== postId))
    },
    enabled: !authLoading,
  })

  const handleCreatePost = async (
    content: string,
    resourceId: string | null,
    maxSeekers: number | null
  ) => {
    if (!user) return

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content,
        resource_id: resourceId ?? null,
        max_seekers: maxSeekers ?? null,
      })

      if (error) throw error
      // Real-time subscription will handle adding the post
    } catch (err) {
      console.error('Error creating post:', err)
    }
  }

  const handleOptIn = async (postId: string) => {
    setOptInErrors((prev) => ({ ...prev, [postId]: '' }))
    try {
      await doOptIn(postId)
      // Refresh opt-in map and slots
      fetchOptInsForPosts(posts.map((p) => p.id)).then(setOptInMap)
      // Decrement slots_remaining optimistically
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId && p.slotsRemaining != null
            ? { ...p, slotsRemaining: p.slotsRemaining - 1 }
            : p
        )
      )
      // Update opt-in count
      setOptInCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not opt in.'
      setOptInErrors((prev) => ({ ...prev, [postId]: msg }))
    }
  }

  const handleWithdraw = async (postId: string) => {
    setOptInErrors((prev) => ({ ...prev, [postId]: '' }))
    try {
      await doWithdraw(postId)
      // Refresh opt-in map
      fetchOptInsForPosts(posts.map((p) => p.id)).then(setOptInMap)
      // Restore slot optimistically
      const post = posts.find((p) => p.id === postId)
      if (post?.maxSeekers != null && post.slotsRemaining != null) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, slotsRemaining: Math.min(p.slotsRemaining! + 1, p.maxSeekers!) }
              : p
          )
        )
      }
      // Update opt-in count
      setOptInCounts((prev) => ({
        ...prev,
        [postId]: Math.max((prev[postId] ?? 1) - 1, 0),
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not withdraw.'
      setOptInErrors((prev) => ({ ...prev, [postId]: msg }))
    }
  }

  const handleLike = async (postId: string) => {
    if (!user) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    // Optimistic update
    setPosts(posts.map(p =>
      p.id === postId
        ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
        : p
    ))

    try {
      if (post.isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id })
      }
    } catch (err) {
      // Revert optimistic update
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, isLiked: post.isLiked, likes: post.likes }
          : p
      ))
    }
  }

  const handleComment = (postId: string) => {
    setOpenCommentPostIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`
    if (navigator.share) {
      navigator.share({ title: 'FEED Community Post', url }).catch((err: unknown) => {
        // AbortError = user cancelled — swallow silently
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Any other share failure: fall back to clipboard
        navigator.clipboard?.writeText(url).then(() => {
          setShareCopiedPostId(postId)
          setTimeout(() => setShareCopiedPostId(null), 2000)
        }).catch(() => {})
      })
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopiedPostId(postId)
        setTimeout(() => setShareCopiedPostId(null), 2000)
      }).catch(() => {})
    }
  }

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'announcements') return post.category === 'announcement'
    if (activeFilter === 'mine') return user != null && post.author.id === user.id
    return true
  })

  return (
    <div className="h-full flex flex-col">
      {/* Top-level tablist: Feed | Messages
          Styled DISTINCT from FeedHeader's rounded-full filter pills:
          py-2.5 font-semibold border-b — per NN/g 2-level tab differentiation */}
      <div
        role="tablist"
        aria-label="Community & Messages sections"
        className="flex border-b border-stone-200 mb-0"
      >
        <button
          role="tab"
          id="feed-tab-feed"
          aria-selected={activeSubtab === 'feed'}
          aria-controls="feed-panel-feed"
          tabIndex={activeSubtab === 'feed' ? 0 : -1}
          onClick={() => handleSubtabSwitch('feed')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 0)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeSubtab === 'feed'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Feed
        </button>
        <button
          role="tab"
          id="feed-tab-messages"
          aria-selected={activeSubtab === 'messages'}
          aria-controls="feed-panel-messages"
          tabIndex={activeSubtab === 'messages' ? 0 : -1}
          onClick={() => handleSubtabSwitch('messages')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 1)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeSubtab === 'messages'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Messages
        </button>
      </div>

      {/* Conditional-mount: only active subtab mounts — leak-free, hooks clean up on unmount */}
      {activeSubtab === 'messages' ? (
        <div
          role="tabpanel"
          id="feed-panel-messages"
          aria-labelledby="feed-tab-messages"
          tabIndex={0}
          className="flex-1 min-h-0"
        >
          <MessagesPanel />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="feed-panel-feed"
          aria-labelledby="feed-tab-feed"
          tabIndex={0}
          className="flex-1 flex flex-col"
        >
          {/* Header with Filter Tabs */}
          <FeedHeader activeFilter={activeFilter} onFilterChange={setActiveFilter} />

          {/* Create Post Card */}
          {isAuthenticated && (
            <CreatePostCard
              onPost={handleCreatePost}
              resourceOptions={resourceOptions}
            />
          )}


          {/* Scrollable Feed */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {error ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={() => { setError(null); fetchPosts() }}
                  className="text-sm text-stone-600 underline mt-2"
                >
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading posts...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No posts to show</p>
                <p className="text-xs mt-1">Be the first to share something!</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div key={post.id} data-testid={`post-${post.id}`}>
                  <PostCard
                    post={post}
                    currentUserId={user?.id ?? null}
                    optInStatus={optInMap.get(post.id)}
                    onLike={handleLike}
                    onComment={handleComment}
                    onShare={handleShare}
                    onOptIn={handleOptIn}
                    onWithdraw={handleWithdraw}
                    optInError={optInErrors[post.id] || null}
                    shareCopied={shareCopiedPostId === post.id}
                    optInCount={optInCounts[post.id]}
                  />
                  {openCommentPostIds.has(post.id) && (
                    <CommentThread
                      postId={post.id}
                      onCountChange={(count) => {
                        setPosts((prev) =>
                          prev.map((p) => (p.id === post.id ? { ...p, comments: count } : p))
                        )
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
