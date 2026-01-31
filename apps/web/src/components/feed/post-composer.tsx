'use client'

import { useState, useCallback } from 'react'
import { X, Send, Link2, Globe, Users, HandHeart, HelpCircle, Image as ImageIcon, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PostComposerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (post: PostData) => Promise<void>
  userName?: string
  userAvatar?: string
}

interface PostData {
  content: string
  type: 'offer' | 'request'
  category?: string
  publishTo: 'community' | 'embed'
  imageUrl?: string
}

const RESOURCE_CATEGORIES = [
  'Food',
  'Housing',
  'Healthcare',
  'Employment',
  'Transportation',
  'Childcare',
  'Legal Aid',
  'Financial',
  'Education',
  'Other',
]

export function PostComposer({
  isOpen,
  onClose,
  onSubmit,
  userName = 'Community Member',
}: PostComposerProps) {
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<'offer' | 'request'>('offer')
  const [publishTo, setPublishTo] = useState<'community' | 'embed'>('community')
  const [category, setCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [embedCode, setEmbedCode] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        content,
        type: postType,
        category: category || undefined,
        publishTo,
      })

      // If embed was selected, generate embed code
      if (publishTo === 'embed') {
        const embedSnippet = `<div class="feed-embed" data-type="${postType}" data-category="${category}">
  <blockquote>${content}</blockquote>
  <cite>— ${userName} on FEED</cite>
  <a href="https://feedapp.community/share/${Date.now()}" target="_blank">View on FEED</a>
</div>`
        setEmbedCode(embedSnippet)
      } else {
        // Reset and close for community posts
        setContent('')
        setPostType('offer')
        setCategory('')
        onClose()
      }
    } catch (error) {
      console.error('Failed to submit post:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [content, postType, category, publishTo, onSubmit, onClose, userName])

  const handleCopyEmbed = useCallback(() => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [embedCode])

  const handleClose = useCallback(() => {
    setContent('')
    setPostType('offer')
    setCategory('')
    setPublishTo('community')
    setEmbedCode('')
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={handleClose}
      />

      {/* Slide-out Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-stone-50 to-lime-50/50 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-lime-200/50 bg-white/80">
          <h2 className="text-lg font-semibold text-stone-800">Create Post</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-stone-500 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto h-[calc(100%-4rem)]">
          {/* Post Type Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">What would you like to do?</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={postType === 'offer' ? 'default' : 'outline'}
                onClick={() => setPostType('offer')}
                className={`flex items-center gap-2 ${
                  postType === 'offer'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'border-lime-300 text-stone-700 hover:bg-lime-50'
                }`}
              >
                <HandHeart className="h-4 w-4" />
                Offer Help
              </Button>
              <Button
                type="button"
                variant={postType === 'request' ? 'default' : 'outline'}
                onClick={() => setPostType('request')}
                className={`flex items-center gap-2 ${
                  postType === 'request'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'border-amber-300 text-stone-700 hover:bg-amber-50'
                }`}
              >
                <HelpCircle className="h-4 w-4" />
                Request Help
              </Button>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Category (optional)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-lime-300 bg-white/80 text-stone-800 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            >
              <option value="">Select a category...</option>
              {RESOURCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat.toLowerCase()}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Your Message</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                postType === 'offer'
                  ? "Describe what you're offering to the community..."
                  : "Describe what kind of help you're looking for..."
              }
              className="min-h-[120px] bg-white/80 border-lime-300 focus:border-green-500 focus:ring-green-500/30 text-stone-800 placeholder:text-stone-400"
            />
            <p className="text-xs text-stone-500">{content.length}/500 characters</p>
          </div>

          {/* Add Image (placeholder) */}
          <Button
            variant="outline"
            className="w-full border-dashed border-lime-300 text-stone-600 hover:bg-lime-50"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Add Image (coming soon)
          </Button>

          {/* Publish To */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Share to</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={publishTo === 'community' ? 'default' : 'outline'}
                onClick={() => setPublishTo('community')}
                className={`flex items-center gap-2 ${
                  publishTo === 'community'
                    ? 'bg-stone-800 hover:bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Users className="h-4 w-4" />
                Community
              </Button>
              <Button
                type="button"
                variant={publishTo === 'embed' ? 'default' : 'outline'}
                onClick={() => setPublishTo('embed')}
                className={`flex items-center gap-2 ${
                  publishTo === 'embed'
                    ? 'bg-stone-800 hover:bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Link2 className="h-4 w-4" />
                Get Embed
              </Button>
            </div>
            <p className="text-xs text-stone-500">
              {publishTo === 'community'
                ? 'Post will be visible to all FEED community members'
                : 'Generate an embed code to share on other platforms'}
            </p>
          </div>

          {/* Embed Code Result */}
          {embedCode && (
            <Card className="bg-stone-100/80 border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-stone-700">
                  <Globe className="h-4 w-4" />
                  Embed Code Generated
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-white rounded-md p-3 font-mono text-xs text-stone-600 overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{embedCode}</pre>
                </div>
                <Button
                  onClick={handleCopyEmbed}
                  variant="outline"
                  size="sm"
                  className="w-full border-stone-300"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3"
          >
            {isSubmitting ? (
              'Posting...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {publishTo === 'community' ? 'Post to Community' : 'Generate Embed'}
              </>
            )}
          </Button>

          {/* Social Integration Notice */}
          <div className="text-center p-3 bg-lime-100/50 rounded-lg border border-lime-200">
            <p className="text-xs text-stone-600">
              <Globe className="h-3 w-3 inline mr-1" />
              Direct social media integration coming soon!
              <br />
              Connect Facebook, Twitter, Instagram, and more.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
