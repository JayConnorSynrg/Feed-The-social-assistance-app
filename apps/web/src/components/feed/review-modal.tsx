'use client'

/**
 * review-modal.tsx
 *
 * Modal for submitting a post-exchange review.
 * Supports both directions: seeker reviewing sourcer, and sourcer reviewing seeker.
 *
 * PII: comment content is never logged.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Star } from 'lucide-react'
import { useReviews } from '@/hooks/use-reviews'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  optInId: string
  /** Human-readable name of the person being reviewed. */
  revieweeName: string
  /** Role label shown in the description (e.g. "sourcer" or "seeker"). */
  revieweeRole: string
  onSubmitted: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewModal({
  open,
  onOpenChange,
  optInId,
  revieweeName,
  revieweeRole,
  onSubmitted,
}: ReviewModalProps) {
  const { submitReview, loading, error } = useReviews()

  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleClose = () => {
    if (!loading) {
      setRating(0)
      setHoverRating(0)
      setWouldRecommend(null)
      setComment('')
      setLocalError(null)
      onOpenChange(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (rating === 0) {
      setLocalError('Please select a star rating before submitting.')
      return
    }

    try {
      await submitReview({
        optInId,
        rating,
        wouldRecommend,
        comment: comment.trim() || null,
      })
      // Reset form then notify parent
      setRating(0)
      setHoverRating(0)
      setWouldRecommend(null)
      setComment('')
      onOpenChange(false)
      onSubmitted()
    } catch {
      // error is set by useReviews; also reflect in localError for visibility
      setLocalError(error ?? 'Submission failed. Please try again.')
    }
  }

  const displayError = localError ?? error

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Review {revieweeName}</DialogTitle>
          <DialogDescription>
            Share your experience with this {revieweeRole}. Your rating contributes to their Harmony Score.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {displayError && (
              <Alert variant="destructive">
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            {/* Star rating */}
            <div>
              <p className="text-sm font-medium mb-2">Rating</p>
              <div
                data-testid="review-stars"
                className="flex gap-1"
                role="group"
                aria-label="Star rating"
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= (hoverRating || rating)
                  return (
                    <button
                      key={n}
                      type="button"
                      data-testid={`review-star-${n}`}
                      aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          filled
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-none text-stone-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Would recommend toggle */}
            <div>
              <p className="text-sm font-medium mb-2">Would you recommend this person?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="review-recommend"
                  aria-pressed={wouldRecommend === true}
                  onClick={() => setWouldRecommend(wouldRecommend === true ? null : true)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    wouldRecommend === true
                      ? 'bg-lime-600 text-white border-lime-600'
                      : 'bg-white text-stone-700 border-stone-300 hover:border-lime-400'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  aria-pressed={wouldRecommend === false}
                  onClick={() => setWouldRecommend(wouldRecommend === false ? null : false)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    wouldRecommend === false
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-stone-700 border-stone-300 hover:border-red-300'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Optional comment */}
            <div>
              <label htmlFor="review-comment-input" className="text-sm font-medium">
                Comment{' '}
                <span className="text-stone-400 font-normal">(optional, max 1000 chars)</span>
              </label>
              <textarea
                id="review-comment-input"
                data-testid="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="Describe your experience..."
                className="mt-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#4a5d23] resize-none"
              />
              {comment.length > 800 && (
                <p className="text-xs text-stone-500 mt-1">{comment.length}/1000</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              data-testid="review-submit"
              type="submit"
              disabled={loading || rating === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
