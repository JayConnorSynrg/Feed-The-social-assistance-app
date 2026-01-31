'use client'

import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { PostComposer } from '@/components/feed/post-composer'
import { FeedList } from '@/components/feed/feed-list'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Post, Profile, TablesInsert } from '@feed/database'

interface FeedContentProps {
  initialPosts: (Post & { user?: Profile })[]
  userProfile: Profile | null
}

export function FeedContent({ initialPosts, userProfile }: FeedContentProps) {
  const [key, setKey] = useState(0)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const supabase = createClient()

  const handlePostCreated = useCallback(() => {
    // Force refresh the feed list
    setKey((prev) => prev + 1)
  }, [])

  const handleSubmitPost = useCallback(
    async (postData: {
      content: string
      type: 'offer' | 'request'
      category?: string
      publishTo: 'community' | 'embed'
    }) => {
      if (!userProfile?.id) return

      // Only insert if publishing to community
      if (postData.publishTo === 'community') {
        const postInsert: TablesInsert<'posts'> = {
          user_id: userProfile.id,
          content: `[${postData.type.toUpperCase()}]${postData.category ? ` #${postData.category}` : ''}\n\n${postData.content}`,
        }
        // Type assertion needed due to @supabase/ssr generic inference limitation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from('posts').insert(postInsert as any)

        if (error) {
          console.error('Failed to create post:', error)
          throw error
        }

        handlePostCreated()
      }
      // For embed, the PostComposer handles showing the embed code
    },
    [supabase, userProfile?.id, handlePostCreated]
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 relative">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Community Feed</h1>
        {userProfile && (
          <Button
            onClick={() => setIsComposerOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        )}
      </div>

      <FeedList key={key} initialPosts={initialPosts} />

      {/* Floating Action Button for mobile */}
      {userProfile && (
        <Button
          onClick={() => setIsComposerOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg md:hidden"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Slide-out Post Composer Panel */}
      <PostComposer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onSubmit={handleSubmitPost}
        userName={userProfile?.full_name || userProfile?.username || 'Community Member'}
      />
    </div>
  )
}
