'use client'

/**
 * review-modal.tsx
 *
 * Modal for submitting a post-exchange review.
 * Supports both directions: seeker reviewing sourcer, and sourcer reviewing seeker.
 * Also supports the conversation path (p_conversation_id) introduced in Phase 9.
 *
 * PII: comment content is never logged.
 *
 * In the viewer's language (lib/i18n-feed-badges.ts; the locale is the profile's, so every caller
 * gets it). The dialog renders in a portal and carries its own lang, dir and close label. The
 * reviewed member's name is their own text; their role is a code the description is chosen by.
 * A failure is kept as a code or as the hook's fixed sentence and read through reviewErrorText;
 * text FEED did not write is shown as received and marked English.
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
import { Loader2 } from 'lucide-react'
import { useReviews } from '@/hooks/use-reviews'
import { WheatStalkRatingInteractive } from '@/components/ui/wheat-stalk-rating'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir } from '@/lib/i18n'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { cardT } from '@/lib/i18n-feed-card'
import { editT } from '@/lib/i18n-feed-edit'
import { badgesT, reviewDescription, reviewErrorText, REVIEW_RATING_REQUIRED, REVIEW_SUBMIT_FAILED } from '@/lib/i18n-feed-badges'

/** The longest comment, in characters. */
const MAX_COMMENT = 1000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Provide exactly one of optInId or conversationId. */
  optInId?: string
  conversationId?: string
  /** Name of the person being reviewed, as they wrote it. */
  revieweeName: string
  /** `lang` of that name: '' (the default) for a member's own text; undefined when the caller
   *  passes FEED's own fallback word in the viewer's language. */
  revieweeNameLang?: string
  /** The reviewed member's role, as a code: sourcer, seeker, requester or volunteer. */
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
  conversationId,
  revieweeName,
  revieweeNameLang = '',
  revieweeRole,
  onSubmitted,
}: ReviewModalProps) {
  const { submitReview, loading, error } = useReviews()
  const locale = useProfileLocale()

  const [rating, setRating] = useState<number>(0)
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleClose = () => {
    if (!loading) {
      setRating(0)
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
      setLocalError(REVIEW_RATING_REQUIRED)
      return
    }

    try {
      await submitReview({
        optInId,
        conversationId,
        rating,
        wouldRecommend,
        comment: comment.trim() || null,
      })
      // Reset form then notify parent
      setRating(0)
      setWouldRecommend(null)
      setComment('')
      onOpenChange(false)
      onSubmitted()
    } catch {
      // error is set by useReviews; also reflect in localError for visibility
      setLocalError(error ?? REVIEW_SUBMIT_FAILED)
    }
  }

  const displayError = localError ?? error
  const failure = displayError ? reviewErrorText(displayError, locale) : null
  const [beforeName, afterName] = splitMessage(badgesT(locale, 'reviewTitle'), 'name')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* A portal: it does not inherit the language of the surface it opens from, so it carries
          its own. */}
      <DialogContent lang={locale} dir={dir(locale)} closeLabel={cardT(locale, 'close')} className="sm:max-w-[440px]" data-testid="review-dialog">
        <DialogHeader>
          <DialogTitle>
            {beforeName}
            <bdi lang={revieweeNameLang}>{revieweeName}</bdi>
            {afterName}
          </DialogTitle>
          <DialogDescription>{reviewDescription(revieweeRole, locale)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {failure && (
              <Alert variant="destructive">
                {/* A sentence FEED wrote reads in the member's language; anything else is English. */}
                <AlertDescription lang={failure.translated ? undefined : 'en'} dir={failure.translated ? undefined : 'ltr'} data-testid="review-error">
                  {failure.text}
                </AlertDescription>
              </Alert>
            )}

            {/* Wheat-stalk rating */}
            <div>
              <p className="text-sm font-medium mb-2">{badgesT(locale, 'ratingLabel')}</p>
              <WheatStalkRatingInteractive
                value={rating}
                onChange={setRating}
                testIdPrefix="review"
                locale={locale}
              />
            </div>

            {/* Would recommend toggle: a group named by its question */}
            <div>
              <p id="review-recommend-question" className="text-sm font-medium mb-2">{badgesT(locale, 'recommendQuestion')}</p>
              <div role="group" aria-labelledby="review-recommend-question" className="flex gap-2">
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
                  {editT(locale, 'yes')}
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
                  {editT(locale, 'no')}
                </button>
              </div>
            </div>

            {/* Optional comment */}
            <div>
              <label htmlFor="review-comment-input" className="text-sm font-medium">
                {badgesT(locale, 'commentLabel')}{' '}
                <span className="text-stone-600 font-normal">{formatMessage(badgesT(locale, 'commentHint'), { max: formatCount(MAX_COMMENT, locale) })}</span>
              </label>
              {/* The member's own words: their direction once typed, the page's while empty. */}
              <textarea
                id="review-comment-input"
                data-testid="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                rows={3}
                dir={comment ? 'auto' : dir(locale)}
                placeholder={badgesT(locale, 'commentPlaceholder')}
                className="mt-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-1 focus:ring-[#4a5d23] resize-none"
              />
              {comment.length > 800 && (
                <p className="text-xs text-stone-500 mt-1">
                  {formatCount(comment.length, locale)}/{formatCount(MAX_COMMENT, locale)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              {cardT(locale, 'cancel')}
            </Button>
            <Button
              data-testid="review-submit"
              type="submit"
              disabled={loading || rating === 0}
            >
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {badgesT(locale, 'submitReview')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
