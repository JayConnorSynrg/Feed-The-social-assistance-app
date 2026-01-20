'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Post, Profile } from '@feed/database'

interface PostCardProps {
  post: Post & { user?: Profile }
  onLike?: (postId: string) => void
  onComment?: (postId: string) => void
  onShare?: (postId: string) => void
  isLiked?: boolean
  likeCount?: number
  commentCount?: number
}

export function PostCard({
  post,
  onLike,
  onComment,
  onShare,
  isLiked = false,
  likeCount = 0,
  commentCount = 0,
}: PostCardProps) {
  const [liked, setLiked] = useState(isLiked)
  const [likes, setLikes] = useState(likeCount)

  const handleLike = () => {
    setLiked(!liked)
    setLikes(liked ? likes - 1 : likes + 1)
    onLike?.(post.id)
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <Link href={`/profile/${post.user?.username || post.user_id}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.user?.avatar_url || undefined} alt={post.user?.full_name || 'User'} />
            <AvatarFallback>{getInitials(post.user?.full_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.user?.username || post.user_id}`}
            className="font-semibold hover:underline"
          >
            {post.user?.full_name || 'Anonymous'}
          </Link>
          {post.user?.username && (
            <Link
              href={`/profile/${post.user.username}`}
              className="text-sm text-muted-foreground hover:underline ml-1"
            >
              @{post.user.username}
            </Link>
          )}
          <p className="text-xs text-muted-foreground">
            {formatDate(post.created_at)}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="pb-2">
        <p className="whitespace-pre-wrap">{post.content}</p>
        {post.image_url && (
          <div className="relative mt-3 rounded-lg overflow-hidden aspect-video">
            <Image
              src={post.image_url}
              alt="Post image"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={liked ? 'text-red-500' : ''}
          >
            <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} />
            {likes > 0 && <span>{likes}</span>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onComment?.(post.id)}>
            <MessageCircle className="h-4 w-4 mr-1" />
            {commentCount > 0 && <span>{commentCount}</span>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onShare?.(post.id)}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
