'use client'

// apps/web/src/components/panels/feed-panel.tsx
// Community Feed panel - posts, updates, and interactions from mutual aid community
// Shows create post form, filter tabs, and scrollable feed of PostCards

import React, { useState } from 'react'
import { Heart, MessageCircle, Share2, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ============================================
// TYPES
// ============================================
interface Post {
  id: string
  author: { name: string; avatar?: string; role: string }
  content: string
  timestamp: Date
  likes: number
  comments: number
  isLiked: boolean
  category: 'update' | 'request' | 'offer' | 'announcement'
}

type FilterType = 'all' | 'following' | 'mine' | 'announcements'

// ============================================
// MOCK DATA
// ============================================
const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: { name: 'Community Kitchen', role: 'Organization' },
    content: 'Free hot meals available today from 12-2pm at 123 Main St. All are welcome! 🍲',
    timestamp: new Date(Date.now() - 3600000),
    likes: 24,
    comments: 5,
    isLiked: false,
    category: 'announcement'
  },
  {
    id: '2',
    author: { name: 'Maria G.', role: 'Community Member' },
    content: 'Looking for recommendations for affordable childcare in the downtown area. Any suggestions?',
    timestamp: new Date(Date.now() - 7200000),
    likes: 8,
    comments: 12,
    isLiked: true,
    category: 'request'
  },
  {
    id: '3',
    author: { name: 'James T.', role: 'Volunteer' },
    content: 'I have extra winter coats (sizes M-XL) to donate. DM me if you or someone you know needs one!',
    timestamp: new Date(Date.now() - 86400000),
    likes: 45,
    comments: 8,
    isLiked: false,
    category: 'offer'
  },
  {
    id: '4',
    author: { name: 'FEED Admin', role: 'Platform' },
    content: 'New resources added! Check out the updated food bank listings in your area. 📍',
    timestamp: new Date(Date.now() - 172800000),
    likes: 67,
    comments: 3,
    isLiked: true,
    category: 'announcement'
  }
]

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
interface CreatePostCardProps {
  onPost: (content: string) => void
}

function CreatePostCard({ onPost }: CreatePostCardProps) {
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    if (!content.trim()) return
    onPost(content)
    setContent('')
  }

  return (
    <div className="mb-4 p-4 rounded-xl bg-[#faf9f6] border border-stone-200">
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#4a5d23] flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>

        {/* Input and Button */}
        <div className="flex-1 flex gap-2">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Share an update, request, or offer..."
            className="flex-1 bg-white"
          />
          <Button
            onClick={handleSubmit}
            disabled={!content.trim()}
            size="icon"
            className="rounded-lg"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// POST REACTIONS
// ============================================
interface PostReactionsProps {
  likes: number
  comments: number
  isLiked: boolean
  onLike: () => void
  onComment: () => void
  onShare: () => void
}

function PostReactions({ likes, comments, isLiked, onLike, onComment, onShare }: PostReactionsProps) {
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="font-medium">{comments}</span>
      </button>

      <button
        onClick={onShare}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors ml-auto"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ============================================
// POST CARD
// ============================================
interface PostCardProps {
  post: Post
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
}

function PostCard({ post, onLike, onComment, onShare }: PostCardProps) {
  const categoryColor = CATEGORY_COLORS[post.category]

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

      {/* Reactions */}
      <PostReactions
        likes={post.likes}
        comments={post.comments}
        isLiked={post.isLiked}
        onLike={() => onLike(post.id)}
        onComment={() => onComment(post.id)}
        onShare={() => onShare(post.id)}
      />
    </div>
  )
}

// ============================================
// MAIN FEED PANEL
// ============================================
interface FeedPanelProps {
  userId?: string
}

export function FeedPanel({ userId }: FeedPanelProps) {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const handleCreatePost = (content: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
      author: { name: 'You', role: 'Community Member' },
      content,
      timestamp: new Date(),
      likes: 0,
      comments: 0,
      isLiked: false,
      category: 'update',
    }
    setPosts([newPost, ...posts])
  }

  const handleLike = (postId: string) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ))
  }

  const handleComment = (postId: string) => {
    // Placeholder for comment functionality
    console.log('Comment on post:', postId)
  }

  const handleShare = (postId: string) => {
    // Placeholder for share functionality
    console.log('Share post:', postId)
  }

  // Filter posts based on active filter
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'announcements') return post.category === 'announcement'
    if (activeFilter === 'mine') return post.author.name === 'You'
    if (activeFilter === 'following') return post.author.role !== 'You' // Mock filter
    return true
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header with Filter Tabs */}
      <FeedHeader activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {/* Create Post Card */}
      <CreatePostCard onPost={handleCreatePost} />

      {/* Scrollable Feed */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No posts to show</p>
            <p className="text-xs mt-1">Be the first to share something!</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
            />
          ))
        )}
      </div>
    </div>
  )
}
