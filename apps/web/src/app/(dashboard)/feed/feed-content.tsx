'use client'

import { useCallback, useState } from 'react'
import { PostComposer } from '@/components/feed/post-composer'
import { FeedList } from '@/components/feed/feed-list'
import type { Post, Profile } from '@feed/database'

interface FeedContentProps {
  initialPosts: (Post & { user?: Profile })[]
  userProfile: Profile | null
}

export function FeedContent({ initialPosts, userProfile }: FeedContentProps) {
  const [key, setKey] = useState(0)

  const handlePostCreated = useCallback(() => {
    // Force refresh the feed list
    setKey((prev) => prev + 1)
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Feed</h1>

      {userProfile && (
        <div className="mb-6">
          <PostComposer user={userProfile} onPostCreated={handlePostCreated} />
        </div>
      )}

      <FeedList key={key} initialPosts={initialPosts} />
    </div>
  )
}
