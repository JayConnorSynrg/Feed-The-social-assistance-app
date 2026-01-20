'use client'

import { useState, useRef } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@feed/database'

interface PostComposerProps {
  user: Profile | null
  onPostCreated?: () => void
}

const MAX_CHARS = 500

export function PostComposer({ user, onPostCreated }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB')
        return
      }
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return
    if (!user) {
      setError('You must be logged in to post')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let imageUrl: string | null = null

      // Upload image if present
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      // Create post
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: imageUrl,
        } as never)

      if (postError) throw postError

      // Reset form
      setContent('')
      removeImage()
      onPostCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  const charsRemaining = MAX_CHARS - content.length
  const isOverLimit = charsRemaining < 0

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatar_url || undefined} alt={user?.full_name || 'User'} />
            <AvatarFallback>{getInitials(user?.full_name)}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[80px] resize-none bg-transparent border-none outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />

            {imagePreview && (
              <div className="relative mt-2 rounded-lg overflow-hidden inline-block">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="max-h-48 rounded-lg"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={loading}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <ImagePlus className="h-4 w-4 mr-1" />
                  Photo
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-sm ${
                    isOverLimit
                      ? 'text-destructive'
                      : charsRemaining < 50
                      ? 'text-yellow-500'
                      : 'text-muted-foreground'
                  }`}
                >
                  {charsRemaining}
                </span>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || isOverLimit || (!content.trim() && !imageFile)}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
