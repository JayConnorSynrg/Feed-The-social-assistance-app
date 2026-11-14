'use client'

// apps/web/src/components/panels/feed-panel.tsx
// Community Feed panel - posts, updates, and interactions from mutual aid community
// Shows create post form, filter tabs, and scrollable feed of PostCards

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from 'motion/react'
import { User, Link as LinkIcon, ChevronDown, MapPin, ShieldAlert, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeFeed } from '@/hooks/use-realtime-feed'
import { useAuth } from '@/hooks/use-auth'
import { useAdminViewer } from '@/hooks/use-admin-viewer'
import { useSavedResources } from '@/hooks/use-saved-resources'
import { useOptIns, type OptInMap } from '@/hooks/use-opt-ins'
import { useSignUpOutcomes, signUpRowsAfter, type SignUpAttempt } from '@/hooks/use-sign-up-outcomes'
import { createReadOrder, mergeByPost, mergeMapByPost, withoutPost, type ReadClaim } from '@/components/feed/sign-up-side-data'
import { focusWasLost } from '@/lib/focus-lost'
import { useReviews, type ReviewMap } from '@/hooks/use-reviews'
import { useFollows } from '@/hooks/use-follows'
import { MessagesPanel } from './messages-panel'
import { EventsPanel } from './events-panel'
import { BusinessesPanel } from './businesses-panel'
import { OrganizationsPanel } from './organizations-panel'
import { PetitionsPanel } from './petitions-panel'
import { usePanelContext } from '@/components/layout/feed-shell'
import { logEvent, logger, withMetric } from '@/lib/logger'
import { newRequestId } from '@/lib/privileged-action'
import { generateShareUrl } from '@/lib/utils/url'
import { readShareLocationPref } from '@/lib/privacy-prefs'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { getErrorMessage } from '@/lib/errors'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { relativeAge } from '@/lib/relative-age'
import { cardT, type ReportReason } from '@/lib/i18n-feed-card'
import { composerT } from '@/lib/i18n-feed-composer'
import { failureText } from '@/lib/i18n-feed-edit'
import { createPost, deleteOwnPost } from '@/lib/post-rpc'
import { moderatePost, type PostModerationAction } from '@/app/(admin)/moderation/post-moderation-actions'
import { CommentThread } from '@/components/feed/comment-thread'
import { FeedPostCard, type EnrichedOptIn } from '@/components/feed/feed-post-card'
import { PostEditDialog } from '@/components/feed/post-edit-dialog'
import { PostHistoryDialog } from '@/components/feed/post-history-dialog'
import { ConfirmDeleteDialog } from '@/components/feed/post-delete-dialog'
import { ReportDialog } from '@/components/feed/report-dialog'
import { loadFeedRow, readFeedRow } from '@/components/feed/post-edit-data'
import type { ActionViewer, PostMenuItemId } from '@/components/feed/post-actions'
import { usePostImagePicker, PostImagePickerField } from '@/components/feed/post-image-picker'
import { FollowErrorBanner } from '@/components/feed/follow-error-banner'
import { createSingleFlight, composerSubmitOutcome } from '@/components/feed/composer-guards'
import { postEnterExit } from '@/components/feed/feed-motion'
import { resolveFeedSubtab, type FeedSubtab } from '@/components/feed/feed-subtab'
import { rowToPost, visibleInFeed, FEED_POST_SELECT, orderByRankAndAttachBucket, applyPostRowPatch, classifyPostUpdate, rowPatchFromFeedRow, editFallbackPatch, assertNever, partitionRankedRows, mergeRankedFeedItems, feedIncludesEvents, rankedEventRefs, rankEventCards, appendNewEvents, type Post, type FeedPostRow, type RankedFeedV2Row, type EventFeedItem, type FeedItem } from '@/components/feed/post-model'
import { EventCard } from '@/components/feed/event-card'
import { useFeedEventCards } from '@/hooks/use-feed-event-cards'
import { emptyCheckinState, checkinResultEffect } from '@/lib/event-checkin-state'
import { loadEventCards } from '@/lib/event-card-data'
import { SafetyStrip } from '@/components/feed/safety-strip'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { FeedHeader, FeedListStatus, FeedLoadMore, FeedStatusRegions, feedLocaleSettled, useFeedAnnounceReady, nextTabIndex, type FeedLoadError, type FeedRankMode, type FilterType } from '@/components/feed/feed-chrome'
import { PostTypeWizard } from './post-type-wizard'
import { ReviewModal } from '@/components/feed/review-modal'
import { messagesT } from '@/lib/i18n-feed-messages'
import { optInsT, SIGN_UP_NOT_DONE } from '@/lib/i18n-feed-optins'
import { usePetitions } from '@/hooks/use-petitions'
import type { SafetyAlert } from '@/hooks/use-safety-alerts'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'

// ============================================
// TYPES
// ============================================
// Post / FeedPostRow / rowToPost / FEED_POST_SELECT are the shared feed model,
// imported from '@/components/feed/post-model'. The union covers all 7
// post_type discriminants and the transform is reused by the realtime path.


/**
 * Read the caller's coordinates ONLY when geolocation permission is already granted —
 * this never triggers a new permission prompt (W1.3). Returns null on any browser
 * without the Permissions API, when permission is not 'granted', on native (no
 * Permissions API), or on any error. A null result makes ranked_feed_v2 fall back to
 * recency-only ranking (no distance factor), which is the graceful default.
 */
async function readGeoIfGranted(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions
    if (!perms?.query) return null
    const status = await perms.query({ name: 'geolocation' as PermissionName })
    if (status.state !== 'granted') return null
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 }
      )
    })
  } catch {
    return null
  }
}


// MOCK_POSTS removed - now fetching from Supabase

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
// CREATE POST CARD
// ============================================
interface ResourceOption {
  id: string
  name: string
}

interface CreatePostCardProps {
  /** Creates the post through create_post; returns the new post id, or null on error. */
  onPost: (
    content: string,
    resourceId: string | null,
    maxSeekers: number | null,
    imageUrl?: string | null
  ) => Promise<string | null>
  /** A post was created by the wizard: show it right away. */
  onCreated: (postId: string) => void
  resourceOptions: ResourceOption[]
  /** Navigates to the map panel to place a safety pin */
  onSafetyAlertClick: () => void
  locale: Locale
  /** Announce a result in the feed's card-notice region (the one polite region for card actions). */
  onAnnounce: (text: string) => void
}

const GEO_RADIUS_OPTIONS = [5, 10, 25, 50] as const
type GeoRadius = typeof GEO_RADIUS_OPTIONS[number]

/** What became of one read of the sign-up rows (FeedPanel's loadPostSideData): written, failed
 *  (nothing written), or dropped (a later read, or another account, has the say). */
type SideDataOutcome = 'applied' | 'failed' | 'dropped'

/** What one sign-up write did, as its log row says it: the server changed the row, the request
 *  answered without an error and changed nothing, or the request failed. */
type SignUpWriteOutcome = 'success' | 'no_change' | 'failed'

/**
 * One sign-up write (opt in, withdraw, accept, decline, mark completed, unblock), recorded as
 * exactly one first-party wide event in app_logs: `feed.optin.write.complete` with outcome
 * `success` or `no_change`, or `feed.optin.write.error` with outcome `failed` and the error's
 * code. Each carries duration_ms and one request id, which `write` sends as x-request-id.
 * Resolves with whether the server changed the row; rethrows a failure.
 */
async function recordSignUpWrite(action: string, write: (requestId: string) => Promise<boolean>): Promise<boolean> {
  const requestId = newRequestId()
  // Read when the row is written (lib/with-metric-core.mjs), so the outcome follows the answer.
  const labels: { action: string; outcome: SignUpWriteOutcome; request_id: string } = { action, outcome: 'failed', request_id: requestId }
  return withMetric(
    'feed.optin.write',
    labels,
    async () => {
      const changed = await write(requestId)
      labels.outcome = changed ? 'success' : 'no_change'
      return changed
    },
    requestId,
  )
}

/** The feed composer card (exported for its behaviour tests). */
export function CreatePostCard({ onPost, onCreated, resourceOptions, onSafetyAlertClick, locale, onAnnounce }: CreatePostCardProps) {
  const supabase = createClient()
  const [content, setContent] = useState('')
  const {
    imageUrl,
    previewUrl,
    imageUploading,
    imageError,
    fileInputRef,
    handleFileSelect,
    clearImage,
    resetAfterPost,
  } = usePostImagePicker()
  const [error, setError] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [maxSeekersInput, setMaxSeekersInput] = useState<string>('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  // Synchronous single-flight gate — guarantees a double-click fires onPost once
  // (a disabled/state flag alone races: both handlers run before the re-render).
  const postGateRef = useRef(createSingleFlight())

  // Geo-outreach state
  const [geoNotify, setGeoNotify] = useState(false)
  const [geoRadius, setGeoRadius] = useState<GeoRadius>(10)
  const [seekerCount, setSeekerCount] = useState<number | null>(null)
  const [seekerCountError, setSeekerCountError] = useState<string | null>(null)
  const [geoNotifyResult, setGeoNotifyResult] = useState<string | null>(null)
  const countAbortRef = useRef<AbortController | null>(null)

  const { execute: executeRateLimited, isLimited } = useRateLimitedAction({
    limiterType: 'formSubmit',
    onRateLimited: () => setError(composerT(locale, 'postTooQuickly')),
  })

  // Fetch seeker count whenever geo toggle is on and a resource is selected
  useEffect(() => {
    if (!geoNotify || !selectedResourceId) {
      setSeekerCount(null)
      setSeekerCountError(null)
      return
    }

    // Abort any in-flight request
    if (countAbortRef.current) {
      countAbortRef.current.abort()
    }
    const ctrl = new AbortController()
    countAbortRef.current = ctrl

    setSeekerCount(null)
    setSeekerCountError(null)

    const fetchCount = async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc('seekers_within_radius', {
          p_resource_id: selectedResourceId,
          p_radius_miles: geoRadius,
        })
        if (ctrl.signal.aborted) return
        if (rpcErr) {
          setSeekerCountError(composerT(locale, 'seekerCountFailed'))
        } else {
          setSeekerCount(typeof data === 'number' ? data : null)
        }
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return
        if (!isQueryTimeout(err)) {
          setSeekerCountError(composerT(locale, 'seekerCountFailed'))
        }
      }
    }

    void fetchCount()

    return () => {
      ctrl.abort()
    }
  }, [geoNotify, selectedResourceId, geoRadius, supabase, locale])

  const handleSubmit = async () => {
    if (!content.trim()) return
    if (imageUploading) return // wait for the in-flight photo upload to settle

    // Parse max_seekers — blank = unlimited (null)
    const maxSeekers =
      maxSeekersInput.trim() !== '' ? parseInt(maxSeekersInput, 10) : null
    if (maxSeekers !== null && (isNaN(maxSeekers) || maxSeekers <= 0)) {
      setError(composerT(locale, 'capacityInvalid'))
      return
    }

    // Single-flight: a second synchronous click returns here without a 2nd create_post.
    await postGateRef.current.run(async () => {
      setIsPosting(true)
      setError(null)
      setGeoNotifyResult(null)
      try {
        await executeRateLimited(async () => {
          // Raw text: create_post stores it as written; React escapes it on render.
          const resourceId = selectedResourceId || null
          const shouldNotify = geoNotify && !!resourceId
          const radiusSnapshot = geoRadius

          const newPostId = await onPost(content, resourceId, maxSeekers, imageUrl)
          const outcome = composerSubmitOutcome(newPostId)
          if (!outcome.reset) {
            // create_post failed (handleCreatePost returns null): keep the member's text and photo
            // and say so, so they can retry.
            setError(composerT(locale, 'postFailed'))
            return
          }

          // Success — clear the composer. The photo blob is now committed to the
          // post, so resetAfterPost (NOT clearImage) clears state without deleting it.
          setContent('')
          setSelectedResourceId('')
          setMaxSeekersInput('')
          setGeoNotify(false)
          setSeekerCount(null)
          resetAfterPost()

          // Fan-out geo notifications after post is created — failure does NOT block the post
          if (shouldNotify && newPostId) {
            try {
              const { data: notifyData, error: notifyErr } = await supabase
                .rpc('notify_seekers_near_resource', {
                  p_post_id: newPostId,
                  p_radius_miles: radiusSnapshot,
                })
              if (notifyErr) throw notifyErr
              const count = typeof notifyData === 'number' ? notifyData : 0
              const text = formatMessage(composerT(locale, 'notifiedSeekers'), { count, radius: radiusSnapshot })
              setGeoNotifyResult(text)
              onAnnounce(text)
            } catch (notifyEx: unknown) {
              logger.error('geo.notify.fanout', notifyEx)
              setGeoNotifyResult(composerT(locale, 'notifyFailed'))
              onAnnounce(composerT(locale, 'notifyFailed'))
            }
          }
        })
      } finally {
        setIsPosting(false)
      }
    })
  }

  return (
    <div className="mb-4 p-4 rounded-xl bg-[#faf9f6] border border-stone-200">
      {error && (
        <div role="alert" className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
          {error}
        </div>
      )}
      {geoNotifyResult && (
        <div
          className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-900"
          data-testid="geo-notify-result"
        >
          {geoNotifyResult}
        </div>
      )}
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#4a5d23] flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <User className="w-5 h-5 text-white" />
        </div>

        {/* Input, Resource Selector, and Send */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Inline quick-compose: a plain update with an optional photo, posted
              directly from the always-visible composer (W1.2). Structured post
              types (offer, request, poll, event, petition) open via the wizard
              trigger below. */}
          <Textarea
            data-testid="composer-content"
            dir="auto"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={5000}
            placeholder={composerT(locale, 'composerPlaceholder')}
            className="min-h-[72px] bg-white text-stone-900 placeholder:text-stone-500"
            aria-label={composerT(locale, 'composerAria')}
          />
          <PostImagePickerField
            previewUrl={previewUrl}
            imageUploading={imageUploading}
            imageError={imageError}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onClear={clearImage}
            compact
            locale={locale}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="composer-post-btn"
              onClick={handleSubmit}
              disabled={!content.trim() || imageUploading || isLimited || isPosting}
              className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white"
            >
              {imageUploading ? composerT(locale, 'uploading') : isPosting ? composerT(locale, 'posting') : composerT(locale, 'post')}
            </Button>
          </div>

          {/* Post creation trigger — structured post types */}
          <button
            type="button"
            data-testid="post-wizard-trigger"
            onClick={() => setWizardOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-600 text-sm hover:border-[#4a5d23] hover:text-stone-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-1"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4a5d23] flex items-center justify-center" aria-hidden="true">
              <Plus className="w-4 h-4 text-white" />
            </span>
            <span>{composerT(locale, 'moreTypes')}</span>
          </button>

          {/* Optional resource link selector */}
          {resourceOptions.length > 0 && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center">
                <LinkIcon className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
              </div>
              <select
                value={selectedResourceId}
                onChange={(e) => {
                  setSelectedResourceId(e.target.value)
                  setGeoNotify(false)
                  setSeekerCount(null)
                }}
                className="w-full appearance-none rounded-lg border border-stone-200 bg-white ps-7 pe-7 py-1.5 text-xs text-stone-700 focus:outline-hidden focus:ring-1 focus:ring-[#4a5d23]"
                aria-label={composerT(locale, 'linkResourceOptional')}
              >
                <option value="">{composerT(locale, 'linkResourceOptional')}</option>
                {resourceOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 end-2 flex items-center">
                <ChevronDown className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
              </div>
            </div>
          )}

          {/* Capacity input — shown whenever a resource is linked */}
          {selectedResourceId && (
            <Input
              type="number"
              min={1}
              max={1000}
              value={maxSeekersInput}
              onChange={(e) => setMaxSeekersInput(e.target.value)}
              placeholder={composerT(locale, 'placeholderCapacity')}
              className="bg-white text-xs"
              aria-label={composerT(locale, 'capacityAria')}
              data-testid="max-seekers-input"
            />
          )}

          {/* Geo-outreach controls — shown only when a resource is linked */}
          {selectedResourceId && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-700 select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={geoNotify}
                  aria-labelledby="geo-outreach-label"
                  data-testid="geo-outreach-toggle"
                  onClick={() => setGeoNotify((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-1 ${
                    geoNotify ? 'bg-[#4a5d23]' : 'bg-stone-500'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      geoNotify ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0.5 rtl:-translate-x-0.5'
                    }`}
                  />
                </button>
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                <span id="geo-outreach-label">{composerT(locale, 'notifyNearby')}</span>
              </label>

              {geoNotify && (
                <select
                  value={geoRadius}
                  onChange={(e) => setGeoRadius(Number(e.target.value) as GeoRadius)}
                  data-testid="geo-outreach-radius"
                  aria-label={composerT(locale, 'radiusAria')}
                  className="appearance-none rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 focus:outline-hidden focus:ring-1 focus:ring-[#4a5d23]"
                >
                  {GEO_RADIUS_OPTIONS.map((r) => (
                    <option key={r} value={r}>{formatMessage(composerT(locale, 'miles'), { n: r })}</option>
                  ))}
                </select>
              )}

              {geoNotify && (
                <span
                  className="text-xs text-stone-600"
                  data-testid="geo-seeker-count"
                  aria-live="polite"
                >
                  {seekerCountError
                    ? seekerCountError
                    : seekerCount === null
                      ? composerT(locale, 'loading')
                      : formatMessage(composerT(locale, 'seekersWithin'), { count: seekerCount, radius: geoRadius })}
                </span>
              )}
            </div>
          )}

          {/* Safety alert affordance — deep-links to map panel pin-placement flow */}
          <button
            type="button"
            data-testid="composer-safety-alert-btn"
            onClick={onSafetyAlertClick}
            className="flex items-center gap-1.5 text-xs text-amber-800 hover:text-amber-950 transition-colors pt-1"
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            {composerT(locale, 'reportHazard')}
          </button>

          <PostTypeWizard
            open={wizardOpen}
            onClose={() => setWizardOpen(false)}
            onCreated={onCreated}
            resourceOptions={resourceOptions}
            onSafetyAlertClick={onSafetyAlertClick}
            locale={locale}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN FEED PANEL
// ============================================
export function FeedPanel() {
  // W1.5 — reduced-motion flag drives the feed list enter/exit degradation
  // (opacity-only, no y translate) via the shared postEnterExit helper.
  const reduce = useReducedMotion()
  const [posts, setPosts] = useState<Post[]>([])
  // Mirror of posts for realtime handlers that must decide off the CURRENT list
  // (e.g. the onUpdate present/absent branch) without re-subscribing on every change.
  const postsRef = useRef<Post[]>([])
  useEffect(() => { postsRef.current = posts }, [posts])
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [paginationCursor, setPaginationCursor] = useState<{ createdAt: string; id: string } | null>(null)
  // Ranked feed (W1.3): default 'ranked'. rankCursor is the keyset for ranked pages.
  const [feedRankMode, setFeedRankMode] = useState<FeedRankMode>('ranked')
  const [rankCursor, setRankCursor] = useState<{ score: number; id: string } | null>(null)
  // The viewer's language: the feed's chrome, the event cards, and the panel's lang / dir.
  const locale = useProfileLocale()
  // Cached caller geo (undefined = not yet read; null = unavailable/denied). Read at
  // most once per mount and never triggers a permission prompt.
  const geoRef = useRef<{ lat: number; lng: number } | null | undefined>(undefined)
  // A failed feed read, by kind; the member sees a translated sentence, never the server's text.
  const [error, setError] = useState<FeedLoadError | null>(null)
  // Active safety alerts for the feed strip — fetched independently of the map
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([])
  const [shareCopiedPostId, setShareCopiedPostId] = useState<string | null>(null)
  const [embedCopiedPostId, setEmbedCopiedPostId] = useState<string | null>(null)
  // Set of post IDs whose comment threads are currently open
  const [openCommentPostIds, setOpenCommentPostIds] = useState<Set<string>>(new Set())
  // Opt-in state: map of post_id → current user's opt-in status
  const [optInMap, setOptInMap] = useState<OptInMap>(new Map())
  // Per-post opt-in error (postId → message)
  const [optInErrors, setOptInErrors] = useState<Record<string, string>>({})
  // Per-post opt-in count for the author view (postId → count)
  const [optInCounts, setOptInCounts] = useState<Record<string, number>>({})
  // Full opt-in rows for author management (postId → enriched list)
  const [authorOptInsMap, setAuthorOptInsMap] = useState<Record<string, EnrichedOptIn[]>>({})
  // Current user's seeker opt-in id per post (postId → optInId)
  const [seekerOptInIds, setSeekerOptInIds] = useState<Record<string, string>>({})
  // Reviews the current user has submitted (keyed by optInId)
  const [myReviewMap, setMyReviewMap] = useState<ReviewMap>(new Map())
  // Reviews the author has submitted (set of optInIds they've reviewed)
  const [authorReviewedSet, setAuthorReviewedSet] = useState<Set<string>>(new Set())
  // Seekers this author has declined/blocked before (private marker; RLS returns only
  // rows where author_id = me). Persists across an unblock.
  const [authorDeclinedSeekers, setAuthorDeclinedSeekers] = useState<Set<string>>(new Set())
  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewModalOptInId, setReviewModalOptInId] = useState<string | null>(null)
  const [reviewModalRevieweeName, setReviewModalRevieweeName] = useState('')
  const [reviewModalRevieweeRole, setReviewModalRevieweeRole] = useState('')
  // Per-post like-toggle in-flight guard (see handleLike): postIds with an
  // unsettled like/unlike write, so a rapid double-click cannot flip isLiked
  // out of sync with the server.
  const likeInFlightRef = useRef<Set<string>>(new Set())
  // Post editing (PR-2): the one card dialog open at a time, the element focus returns to, the
  // polite status line (4.1.3), and the ids taken out because they became hidden (so an unhide
  // can put them back without reloading the feed).
  const [cardDialog, setCardDialog] = useState<
    | { kind: 'edit'; post: Post }
    | { kind: 'delete'; post: Post }
    | { kind: 'remove'; post: Post }
    | { kind: 'report'; post: Post }
    | { kind: 'history'; post: Post }
    | { kind: 'signup' }
    | null
  >(null)
  const dialogTriggerRef = useRef<HTMLElement | null>(null)
  // An announcement waiting for its dialog to close (the modal hides the feed's notice region).
  const pendingNoticeRef = useRef<(() => void) | null>(null)
  const removedHiddenIdsRef = useRef<Set<string>>(new Set())
  const moderationGateRef = useRef(createSingleFlight())

  const { user, profileSettled, isAuthenticated, isAnonymous, loading: authLoading } = useAuth()
  const supabase = createClient()
  // The viewer's admin tier (shared, cached lookup — never profile columns): moderation items only.
  const adminViewer = useAdminViewer(false)
  const actionViewer: ActionViewer = {
    id: user?.id ?? null,
    isGuest: isAnonymous,
    tier: adminViewer.status === 'ready' ? adminViewer.tier : null,
  }
  const { panelParams, setActivePanel, setPanelParams } = usePanelContext()
  // Resolve active subtab from panelParams (set by alias routing in feed-shell).
  // A cleared/unknown subtab resolves to 'feed' — see resolveFeedSubtab.
  const activeSubtab: FeedSubtab = resolveFeedSubtab(panelParams?.subtab)
  // Events in the ranked feed (W1.6b): eventItems are hydrated occurrences in RPC
  // rank order; eventMyStatuses / eventAnonClaims drive each card's check-in button
  // (own rows only, exactly as the Events panel loads them). All three are empty in
  // Recent mode and clear when the ranked page has no event rows. A change an admin makes
  // from an event card re-reads only that card (hooks/use-feed-event-cards.ts).
  const feedTitleRef = useRef<HTMLHeadingElement>(null)
  const focusFeedTitle = useCallback(() => feedTitleRef.current?.focus(), [])
  const {
    eventItems,
    setEventItems,
    eventMyStatuses,
    setEventMyStatuses,
    eventAnonClaims,
    setEventAnonClaims,
    feedNotice,
    handleEventManaged,
    announceCardNotice,
    syncFeedEventCard,
  } = useFeedEventCards({
    supabase,
    userId: user?.id ?? null,
    isGuest: isAnonymous,
    locale,
    timeoutMs: QUERY_TIMEOUT_MS,
    focusHeading: focusFeedTitle,
    // A card notice belongs to this sub-tab visit and this account: leaving the sub-tab or
    // switching accounts clears it (silently); a reload keeps it.
    noticeContext: `${activeSubtab}|${user?.id ?? ''}`,
  })
  // Saved resources for the resource-link selector in the composer
  const { savedResources } = useSavedResources()
  const resourceOptions: ResourceOption[] = savedResources
    .filter((r) => r.resource_id != null)
    .map((r) => ({ id: r.resource_id as string, name: r.resource_name }))
  const { fetchOptInsForPosts, optIn: doOptIn, withdrawOptIn: doWithdraw } = useOptIns()
  const { fetchMyReviewsForOptIns } = useReviews()
  // What a sign-up action says and where focus goes once its outcome is on screen. It sends
  // nothing: the handlers below tell it when an attempt begins and how its request came back.
  // Its attempts belong to this sub-tab visit and this account, as the card notice does.
  const signUpContext = `${activeSubtab}|${user?.id ?? ''}`
  // A sign-up action that did not go through is shown on its card's alert line (which is what
  // speaks, so it is heard once) until the next action on that card.
  const showNotDone = useCallback((postId: string) => {
    if (postId) setOptInErrors((prev) => ({ ...prev, [postId]: SIGN_UP_NOT_DONE }))
  }, [])
  const onSignUpNotDone = useCallback((attempt: SignUpAttempt) => showNotDone(attempt.postId), [showNotDone])
  const signUps = useSignUpOutcomes({ locale, announce: announceCardNotice, memberStatuses: optInMap, authorRows: authorOptInsMap, context: signUpContext, onNotDone: onSignUpNotDone })
  // Stable (the hook's own callback): the loaders below must not change with every render.
  const settleSignUp = signUps.settled
  // The button that opened the review dialog and the post it sits on (where focus returns).
  const reviewOpenerRef = useRef<HTMLElement | null>(null)
  const reviewPostIdRef = useRef<string | null>(null)
  const { followingIds, fetchFollowing, follow: doFollow, unfollow: doUnfollow, error: followError } = useFollows()
  const { petitions: petitionsList, sign: signPetition, signingId: signingPetitionId } = usePetitions()


  // Sync subtab when panelParams.subtab changes (e.g. back-button hash navigation)
  // No local state needed — activeSubtab is derived directly from panelParams.

  // Tab switch handler: drives via setActivePanel alias path so hash + state
  // stay in sync through one code path. replaceState — no back-button spam.
  const handleSubtabSwitch = useCallback((tab: FeedSubtab) => {
    logEvent('nav.subtab.switch', { panel: 'feed', subtab: tab })
    if (tab === 'messages') {
      setActivePanel('messages')
    } else if (tab === 'events') {
      // events resolves via PANEL_ALIAS to feed+subtab='events'
      setActivePanel('events')
    } else if (tab === 'businesses') {
      // businesses resolves via PANEL_ALIAS to feed+subtab='businesses'
      setActivePanel('businesses')
    } else if (tab === 'organizations') {
      // organizations resolves via PANEL_ALIAS to feed+subtab='organizations'
      setActivePanel('organizations')
    } else if (tab === 'petitions') {
      // petitions resolves via PANEL_ALIAS to feed+subtab='petitions'
      setActivePanel('petitions')
    } else {
      // setActivePanel('feed') is a base panel — the shell clears any stale
      // subtab, so activeSubtab derives back to 'feed'.
      setActivePanel('feed')
    }
  }, [setActivePanel])

  // ARIA roving tabindex keyboard handler for the Feed tablist
  const handleFeedTabKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    const tabs: FeedSubtab[] = ['feed', 'events', 'businesses', 'organizations', 'petitions', 'messages']
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSubtabSwitch(tabs[currentIdx]); return }
    // Arrow keys follow the reading direction (right-to-left locales swap them).
    const next = nextTabIndex(e.key, currentIdx, tabs.length, locale)
    if (next === null) return
    e.preventDefault()
    const tabEls = (e.currentTarget.closest('[role="tablist"]') as HTMLElement | null)?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabEls?.[next]?.focus()
    handleSubtabSwitch(tabs[next])
  }, [handleSubtabSwitch, locale])

  // ── Pagination constants ────────────────────────────────────────────────────
  // Keyset pagination uses (created_at, id) for a stable cursor. is_pinned desc
  // ordering complicates a pure keyset — the simplest correct approach is to sort
  // pinned posts client-side within the already-loaded set (pinned-first applies
  // to the visible list, not across page boundaries). Each page fetches 25 rows
  // ordered by created_at desc, id desc. The realtime prepend path dedupes by id
  // so new posts don't duplicate rows already paged in.
  const PAGE_SIZE = 25

  // ── Sign-up side data, kept per post ──────────────────────────────────────────────────────
  // The viewer's own statuses, the rows of an author's sign-up list, the "N opted in" counts and
  // the viewer's own opt-in ids are kept per post (components/feed/sign-up-side-data.ts). A page
  // that is added to the list MERGES its posts' entries, so the cards of earlier pages keep
  // theirs; the first page or a refresh REPLACES; the read after an action asks about the acted
  // post alone. When two reads ask about the same post, the one STARTED LATEST writes its entry.
  const viewerId = user?.id ?? null
  const viewerIdRef = useRef<string | null>(viewerId)
  const signUpContextRef = useRef(signUpContext)
  // Sign-up requests that came back and that no read has settled yet (see settleSignUps).
  const confirmedSignUpsRef = useRef<SignUpAttempt[]>([])
  useEffect(() => {
    viewerIdRef.current = viewerId
    confirmedSignUpsRef.current = []
  }, [viewerId])
  useEffect(() => {
    signUpContextRef.current = signUpContext
  }, [signUpContext])
  const statusOrderRef = useRef(createReadOrder())
  const rowsOrderRef = useRef(createReadOrder())
  const countsOrderRef = useRef(createReadOrder())
  const declinesClockRef = useRef(0)

  // A read has come back: the attempts it settles are those that came back before it started,
  // on posts it asked about, unless a later read asked about that post too (that one settles
  // them). Each is taken off the list here and returned with what this read may say about it.
  const takeSettled = useCallback((waiting: SignUpAttempt[], claim: (postId: string) => ReadClaim): Array<[SignUpAttempt, ReadClaim]> => {
    const mine = waiting.filter((a) => confirmedSignUpsRef.current.includes(a) && claim(a.postId) !== 'overtaken')
    confirmedSignUpsRef.current = confirmedSignUpsRef.current.filter((a) => !mine.includes(a))
    return mine.map((a) => [a, claim(a.postId)])
  }, [])

  // The viewer's own statuses for some posts. A read that FAILS keeps the statuses on screen (an
  // empty map would show Opt In on posts the member is signed up to); a member's own action it
  // covers is then set from that action's result, and said with the stale-list sentence.
  const readMyStatuses = useCallback(async (postIds: string[], replace: boolean, uid: string | null) => {
    const order = statusOrderRef.current
    const stamp = order.start(postIds, replace)
    const waiting = confirmedSignUpsRef.current.filter((a) => a.optInId === null && postIds.includes(a.postId))
    const read = await fetchOptInsForPosts(postIds)
    if (viewerIdRef.current !== uid) return
    const claim = (id: string) => order.claim(stamp, id)
    const mine = takeSettled(waiting, claim)
    if (read.ok) {
      setOptInMap((prev) => mergeMapByPost(prev, postIds, read.statuses, (id) => claim(id) === 'owns', replace))
    } else {
      // opt_in_to_post inserts a pending row; withdraw_opt_in deleted the row.
      const confirmed = mine.filter(([a, c]) => c === 'owns' && a.changed === true).map(([a]) => a)
      if (confirmed.length > 0) {
        setOptInMap((prev) => {
          const next = new Map(prev)
          for (const a of confirmed) {
            if (a.kind === 'optIn') next.set(a.postId, 'pending')
            else next.delete(a.postId)
          }
          return next
        })
      }
    }
    for (const [a, c] of mine) settleSignUp(a, c === 'unlisted' ? 'unread' : read.ok ? 'fresh' : 'stale')
  }, [fetchOptInsForPosts, settleSignUp, takeSettled])

  // Sign-up side data for some posts: the viewer's statuses, the author's decline markers, the
  // sign-up rows (the author's list, and the viewer's own opt-in ids) and the reviews the viewer
  // has given for those rows. Used by BOTH list loaders (chronological and ranked) — `replace`
  // on a first page or a refresh, merge on a page that is added — and by the read that follows a
  // sign-up or review action (`action` names it; its failure is logged). Resolves with what
  // became of the sign-up rows read.
  const loadPostSideData = useCallback((postIds: string[], replace = false, action: string | null = null): Promise<SideDataOutcome> => {
    if (!user) return Promise.resolve('dropped')
    const uid = user.id
    const same = () => viewerIdRef.current === uid
    void readMyStatuses(postIds, replace, uid)
    const order = rowsOrderRef.current
    const stamp = order.start(postIds, replace)
    const claim = (id: string) => order.claim(stamp, id)
    const owns = (id: string) => claim(id) === 'owns'
    if (postIds.length === 0) {
      if (replace) {
        setSeekerOptInIds({})
        setAuthorOptInsMap({})
      }
      return Promise.resolve('applied')
    }
    // After an action the acted post's "N opted in" is the number of its rows (the same table
    // and row rules as the list loaders' count read): claimed now, written when the rows land.
    const countsStamp = action === null ? null : countsOrderRef.current.start(postIds)
    const waiting = confirmedSignUpsRef.current.filter((a) => a.optInId !== null && postIds.includes(a.postId))

    // Load this author's private decline markers (author-only via RLS). Best-effort:
    // the marker is a supplementary label, so a failure never blocks the opt-in list.
    // One set for the whole account: the read started latest is the one that writes.
    const declinesStamp = ++declinesClockRef.current
    supabase
      .from('opt_in_declines')
      .select('seeker_id')
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .then(({ data }) => {
        if (data && same() && declinesClockRef.current === declinesStamp) setAuthorDeclinedSeekers(new Set(data.map((r) => r.seeker_id as string)))
      })

    // The rows could not be read: nothing is written. A CONFIRMED action this read covers is set
    // from its own result, so its row is not shown with the status it had before; an action that
    // changed nothing settles nothing. Each is said with the stale-list sentence.
    const rowsFailed = (error: unknown): SideDataOutcome => {
      if (!same()) return 'dropped'
      const mine = takeSettled(waiting, claim)
      if (action !== null) logger.error('feed.optin.reread_failed', error, { step: 'side_data', action })
      // (signUpRowsAfter leaves the rows as they are for an action that changed nothing.)
      const confirmed = mine.filter(([, c]) => c === 'owns').map(([a]) => a)
      if (confirmed.length > 0) {
        setAuthorOptInsMap((prev) => confirmed.reduce((rows, a) => signUpRowsAfter(rows, a), prev))
        // The count moves only for an unblock that deleted the row (as on the fresh path).
        const unblocked = confirmed.filter((a) => a.kind === 'unblock' && a.changed === true)
        if (unblocked.length > 0) {
          setOptInCounts((prev) => {
            const next = { ...prev }
            for (const a of unblocked) next[a.postId] = Math.max((next[a.postId] ?? 1) - 1, 0)
            return next
          })
        }
      }
      for (const [a, c] of mine) settleSignUp(a, c === 'unlisted' ? 'unread' : 'stale')
      return 'failed'
    }

    // Fetch full seeker opt-in rows (for review prompts and author management)
    const rowsRead = supabase
      .from('resource_opt_ins')
      .select('id, post_id, seeker_id, status, seeker:profiles!resource_opt_ins_seeker_id_fkey(id, first_name, harmony_score, harmony_reviews_count)')
      .in('post_id', postIds)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .then(({ data: oisData, error: oisError }): SideDataOutcome => {
        if (!oisData) return rowsFailed(oisError)
        if (!same()) return 'dropped'
        const mine = takeSettled(waiting, claim)

        // Map post_id → seeker opt-in id for the current user (seeker view)
        const seekerIds: Record<string, string> = {}
        // Map post_id → enriched list for the author view
        const authorMap: Record<string, EnrichedOptIn[]> = {}

        for (const oi of oisData) {
          if (oi.seeker_id === uid) {
            seekerIds[oi.post_id] = oi.id
          }
          // Build author management list (one entry per seeker per post)
          const seeker = oi.seeker as { id: string; first_name: string | null; harmony_score: number | null; harmony_reviews_count: number } | null
          if (!authorMap[oi.post_id]) authorMap[oi.post_id] = []
          authorMap[oi.post_id].push({
            id: oi.id,
            postId: oi.post_id,
            seekerId: oi.seeker_id,
            seekerName: seeker?.first_name ?? 'Unknown',
            seekerHarmonyScore: seeker?.harmony_score ?? null,
            seekerHarmonyCount: seeker?.harmony_reviews_count ?? 0,
            status: oi.status,
          })
        }
        setSeekerOptInIds((prev) => mergeByPost(prev, postIds, seekerIds, owns, replace))
        setAuthorOptInsMap((prev) => mergeByPost(prev, postIds, authorMap, owns, replace))
        if (countsStamp !== null) {
          const counts: Record<string, number> = {}
          for (const id of postIds) counts[id] = authorMap[id]?.length ?? 0
          setOptInCounts((prev) => mergeByPost(prev, postIds, counts, (id) => countsOrderRef.current.claim(countsStamp, id) === 'owns', false))
        }
        for (const [a, c] of mine) settleSignUp(a, c === 'unlisted' ? 'unread' : 'fresh')

        // Fetch reviews the current user has submitted (seeker+author directions). A review is
        // never taken back: a page that is added, and the read after an action, add to the set.
        const allOptInIds = oisData.map((oi) => oi.id)
        const wrote = postIds.some(owns)
        if (allOptInIds.length > 0) {
          fetchMyReviewsForOptIns(allOptInIds).then((reviewMap) => {
            if (!same()) return
            const whole = replace && postIds.some(owns)
            setMyReviewMap((prev) => (whole ? reviewMap : new Map([...prev, ...reviewMap])))
            // Build the set of opt-in ids the current user has reviewed (for author side)
            setAuthorReviewedSet((prev) => (whole ? new Set(reviewMap.keys()) : new Set([...prev, ...reviewMap.keys()])))
          })
        } else if (replace && wrote) {
          setMyReviewMap(new Map())
          setAuthorReviewedSet(new Set())
        }
        return wrote ? 'applied' : 'dropped'
      })
    return Promise.resolve(rowsRead).catch(rowsFailed)
  }, [supabase, user, readMyStatuses, fetchMyReviewsForOptIns, settleSignUp, takeSettled])

  // A card left the list: its entries go with it.
  const dropSideData = useCallback((postId: string) => {
    setOptInMap((prev) => {
      if (!prev.has(postId)) return prev
      const next = new Map(prev)
      next.delete(postId)
      return next
    })
    setSeekerOptInIds((prev) => withoutPost(prev, postId))
    setAuthorOptInsMap((prev) => withoutPost(prev, postId))
    setOptInCounts((prev) => withoutPost(prev, postId))
    setOptInErrors((prev) => withoutPost(prev, postId))
  }, [])

  // Fetch posts from Supabase
  // When cursor is provided, fetches the NEXT page after that cursor position.
  // When cursor is null, fetches the first page.
  const fetchPosts = useCallback(async (cursor: { createdAt: string; id: string } | null = null) => {
    if (cursor === null) {
      setLoading(true)
      // Recent (chronological) mode shows posts only (W1.6b): drop any events held
      // from a prior ranked page so nothing stale lingers behind the render gate.
      setEventItems([])
      setEventMyStatuses({})
      setEventAnonClaims(new Set())
    } else {
      setLoadingMore(true)
    }
    setError(null)
    // Hard timeout: if the entire fetch (main query + secondary queries) doesn't
    // complete within QUERY_TIMEOUT_MS + 2s grace, reject and clear loading state.
    // This guards against cases where the AbortSignal on individual queries doesn't
    // fire (e.g. browser fetch patching or signal lifecycle edge cases).
    const timeoutMs = QUERY_TIMEOUT_MS + 2_000
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new DOMException('Feed fetch timed out', 'TimeoutError')),
        timeoutMs
      )
    })
    try {
      await Promise.race([timeoutPromise, (async () => {
      let query = supabase
        .from('posts')
        // Explicit column list (INV4) — never select('*'): includes the
        // discriminant, metadata, denormalized counts, and the columns each
        // card type needs, so a later coordinate/PII column gate can't
        // silently break or over-expose the feed.
        .select(FEED_POST_SELECT)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      // Keyset filter: fetch rows BEFORE the cursor position.
      // Ordering is (created_at desc, id desc). We use a simple `.lt('created_at')`
      // keyset. This means posts with the exact same created_at millisecond as the
      // cursor may be skipped — acceptable because same-millisecond multi-user posts
      // are rare and those posts will appear on the next scroll pass via realtime.
      // A nested OR+AND tiebreak is the full-correct formulation but the PostgREST
      // or(a.lt.X,and(a.eq.X,b.lt.Y)) form can produce a 400 on some Supabase
      // versions; the simple lt approach is safer and correct for the production load.
      if (cursor !== null) {
        query = query.lt('created_at', cursor.createdAt)
      }

      const { data, error } = await withMetric(
        'feed.load',
        { page: cursor ? 'next' : 'first', page_size: PAGE_SIZE },
        async () => query
      )

      if (error) throw error

      // The typed client returns GenericStringError[] for a dynamic (non-literal)
      // select string, so cast to the known joined shape (INV4 keeps the columns
      // explicit; FeedPostRow documents them).
      const rows = (data ?? []) as unknown as FeedPostRow[]
      const postIds = rows.map((p) => p.id)

      // Posts with a capacity set — need opt-in counts for the author view
      const cappedPostIds = rows
        .filter((r) => r.max_seekers != null)
        .map((r) => r.id)

      // Counts come from the denormalized posts.like_count / comment_count
      // columns returned by the main query (INV3) — NO secondary aggregation
      // fetch. The only per-post lookup that remains is "my likes", which
      // decides isLiked and cannot be derived from a denormalized column.
      const userLikes: Set<string> = new Set()

      if (postIds.length > 0) {
        type PostIdRow = { post_id: string }
        type QueryResult = { data: PostIdRow[] | null }

        // My-likes + opt-in counts in parallel. Each carries an AbortSignal so
        // it can't block the finally block if the connection stalls mid-fetch.
        const secondarySignal = AbortSignal.timeout(QUERY_TIMEOUT_MS)
        const countsStamp = countsOrderRef.current.start(postIds, cursor === null)
        const [myLikesResult, optInResult] = await Promise.all([
          user
            ? supabase
                .from('post_likes')
                .select('post_id')
                .in('post_id', postIds)
                .eq('user_id', user.id)
                .abortSignal(secondarySignal) as unknown as Promise<QueryResult>
            : Promise.resolve({ data: [] as PostIdRow[] }),
          cappedPostIds.length > 0
            ? supabase
                .from('resource_opt_ins')
                .select('post_id')
                .in('post_id', cappedPostIds)
                .abortSignal(secondarySignal) as unknown as Promise<QueryResult>
            : Promise.resolve({ data: [] as PostIdRow[] }),
        ])

        if (myLikesResult.data) {
          for (const like of myLikesResult.data) {
            userLikes.add(like.post_id)
          }
        }
        if (optInResult?.data) {
          const counts: Record<string, number> = {}
          for (const row of optInResult.data) {
            counts[row.post_id] = (counts[row.post_id] || 0) + 1
          }
          // This page's posts: merged on a page that is added, the whole map on a first page.
          setOptInCounts((prev) => mergeByPost(prev, postIds, counts, (id) => countsOrderRef.current.claim(countsStamp, id) === 'owns', cursor === null))
        }
      }

      // Transform to Post via the shared rowToPost (runs even when postIds is
      // empty). Counts read straight from like_count/comment_count; the
      // discriminant + metadata are preserved for every type.
      // A hidden post is the author's alone in the feed (staff review it in moderation).
      const transformed: Post[] = rows
        .map((row) => rowToPost(row, { isLiked: userLikes.has(row.id) }))
        .filter((p) => visibleInFeed(p, user?.id ?? null))

      // Update pagination cursor: last row's created_at + id becomes the next-page cursor.
      // hasMore is true when the page returned exactly PAGE_SIZE rows (there may be more).
      if (cursor === null) {
        // First page — sort pinned posts to the top client-side within this page.
        // This scopes pinned-first ordering to the initial loaded set only, which is
        // the simplest correct behavior with keyset pagination on created_at.
        const pinned = transformed.filter((p) => p.category === 'announcement')
        const rest = transformed.filter((p) => p.category !== 'announcement')
        setPosts([...pinned, ...rest])
      } else {
        // Subsequent pages — append, deduplicating by id to protect against
        // realtime prepends of rows that ended up in a keyset page too.
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id))
          const fresh = transformed.filter((p) => !existingIds.has(p.id))
          return [...prev, ...fresh]
        })
      }

      if (rows.length === PAGE_SIZE) {
        const last = rows[rows.length - 1]
        // Normalize created_at to a UTC ISO string without timezone offset suffix.
        // PostgREST filter strings embed the value in a query param; a bare +00:00
        // suffix could be misinterpreted. Using the UTC 'Z' form is unambiguous.
        const rawTs = last.created_at as string
        const normalizedTs = new Date(rawTs).toISOString()
        setPaginationCursor({ createdAt: normalizedTs, id: last.id as string })
        setHasMore(true)
      } else {
        setPaginationCursor(null)
        setHasMore(false)
      }

      // Opt-in / seeker / review side-data — shared with the ranked path. This page's posts only:
      // the whole maps on a first page, merged into them on a page that is added.
      void loadPostSideData(postIds, cursor === null)
      })()])
    } catch (err: unknown) {
      const isTimeout = isQueryTimeout(err) || (err instanceof DOMException && err.name === 'TimeoutError')
      const serializedMsg = getErrorMessage(err)
      const isPermission =
        (err as { code?: string })?.code === '42501' ||
        serializedMsg.toLowerCase().includes('permission denied')

      const msg: FeedLoadError = isTimeout ? 'timeout' : 'failed'

      logger.error('feed.posts.fetch_failed', err, {
        code: (err as { code?: string })?.code,
        message: serializedMsg,
        kind: isTimeout ? 'timeout' : isPermission ? 'permission' : 'unknown',
      })
      setError(msg)
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle)
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase, user, loadPostSideData, setEventItems, setEventMyStatuses, setEventAnonClaims])

  // Ranked feed (W1.3): fetch a page via the hardened ranked_feed_v2 RPC, then hydrate
  // full rows with the SAME explicit FEED_POST_SELECT + rowToPost transform the
  // chronological path uses (single-transform invariant). The RPC returns only
  // id + score + distance_bucket (never coords). Caller geo is read at most once and
  // only when already granted; without geo the RPC ranks by recency+engagement.
  const fetchRankedPosts = useCallback(async (cursor: { score: number; id: string } | null = null) => {
    if (cursor === null) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    const timeoutMs = QUERY_TIMEOUT_MS + 2_000
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new DOMException('Feed fetch timed out', 'TimeoutError')),
        timeoutMs
      )
    })
    try {
      await Promise.race([timeoutPromise, (async () => {
        if (geoRef.current === undefined) {
          // INV-H: device location is used only when the user has explicitly
          // opted in via Settings → Privacy → Share Location. When off (default),
          // skip the read entirely; ranked_feed_v2 then falls back to recency+
          // engagement ranking (the graceful no-geo path).
          geoRef.current = readShareLocationPref() ? await readGeoIfGranted() : null
        }
        const geo = geoRef.current
        const hasGeo = geo !== null

        const { data: rankedData, error: rankErr } = await withMetric(
          'feed.load',
          { mode: 'ranked', has_geo: hasGeo, page_size: PAGE_SIZE },
          async () =>
            supabase.rpc('ranked_feed_v2', {
              // W1.6b: ranked_feed_v2 returns posts + events in one cross-kind keyset.
              // Omit (→ undefined) rather than null so the RPC's own DEFAULT NULL
              // applies; the generated Args type treats every param as optional.
              p_lat: geo?.lat ?? undefined,
              p_lng: geo?.lng ?? undefined,
              p_limit: PAGE_SIZE,
              p_cursor_score: cursor?.score ?? undefined,
              p_cursor_id: cursor?.id ?? undefined,
            }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        )
        if (rankErr) throw rankErr

        const ranked = (rankedData ?? []) as unknown as RankedFeedV2Row[]
        logger.info('feed.rank', { mode: 'ranked', has_geo: hasGeo, returned_count: ranked.length })

        // W1.6b: split the cross-kind page into post ids and event (occurrence) ids.
        const { postIds, eventIds } = partitionRankedRows(ranked)
        if (ranked.length === 0) {
          if (cursor === null) {
            setPosts([])
            setEventItems([])
            setEventMyStatuses({})
            setEventAnonClaims(new Set())
          }
          setRankCursor(null)
          setHasMore(false)
          return
        }
        // The post-kind ranked rows carry the score+bucket for orderByRankAndAttachBucket.
        const postRankRows = ranked.filter((r) => r.kind === 'post')

        // Hydrate the ranked POST ids with the SAME explicit select as the chronological
        // feed (omits location). RLS still applies to this SECURITY INVOKER read.
        const { data: rowData, error: rowErr } = await supabase
          .from('posts')
          .select(FEED_POST_SELECT)
          .in('id', postIds)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (rowErr) throw rowErr
        const rows = (rowData ?? []) as unknown as FeedPostRow[]

        // my-likes + opt-in counts in parallel (mirrors the chronological path).
        const cappedPostIds = rows.filter((r) => r.max_seekers != null).map((r) => r.id)
        const userLikes = new Set<string>()
        type PostIdRow = { post_id: string }
        type QueryResult = { data: PostIdRow[] | null }
        const secondarySignal = AbortSignal.timeout(QUERY_TIMEOUT_MS)
        const countsStamp = countsOrderRef.current.start(postIds, cursor === null)
        const [myLikesResult, optInResult] = await Promise.all([
          user && postIds.length > 0
            ? supabase
                .from('post_likes')
                .select('post_id')
                .in('post_id', postIds)
                .eq('user_id', user.id)
                .abortSignal(secondarySignal) as unknown as Promise<QueryResult>
            : Promise.resolve({ data: [] as PostIdRow[] }),
          cappedPostIds.length > 0
            ? supabase
                .from('resource_opt_ins')
                .select('post_id')
                .in('post_id', cappedPostIds)
                .abortSignal(secondarySignal) as unknown as Promise<QueryResult>
            : Promise.resolve({ data: [] as PostIdRow[] }),
        ])
        if (myLikesResult.data) {
          for (const like of myLikesResult.data) userLikes.add(like.post_id)
        }
        if (optInResult?.data) {
          const counts: Record<string, number> = {}
          for (const row of optInResult.data) {
            counts[row.post_id] = (counts[row.post_id] || 0) + 1
          }
          // This page's posts: merged on a page that is added, the whole map on a first page.
          setOptInCounts((prev) => mergeByPost(prev, postIds, counts, (id) => countsOrderRef.current.claim(countsStamp, id) === 'owns', cursor === null))
        }

        // Transform via the shared rowToPost, then re-order to the RPC's score order
        // and attach each row's distance bucket + score by id. The RPC already places
        // pinned posts first (via the score boost), so NO client-side pinned re-sort.
        // A hidden post is the author's alone in the feed (staff review it in moderation).
        const transformed = rows
          .map((row) => rowToPost(row, { isLiked: userLikes.has(row.id) }))
          .filter((p) => visibleInFeed(p, user?.id ?? null))
        const ordered = orderByRankAndAttachBucket(postRankRows, transformed)

        // W1.6b: build the event cards in RPC rank order through the loader the Events tab
        // shares (lib/event-card-data.ts): hydrate the shown dates, dropping any occurrence
        // the RLS read did not surface (I4 — the same drop-unhydrated rule the posts path
        // uses); then, in parallel, the next upcoming date for a shown date that was
        // cancelled ("Sat, Oct 10 cancelled — next: Sat, Oct 24") and the member's own
        // check-in state. Each event row is the event's shown date (one per event; the server
        // applies the organizer's "post N days before" window, and keeps an event listed while
        // its cancelled date is announced and not ended).
        let events: EventFeedItem[] = []
        let checkinState = emptyCheckinState()
        if (eventIds.length > 0) {
          const loaded = await loadEventCards(supabase, rankedEventRefs(ranked), {
            surface: 'feed',
            userId: user?.id ?? null,
            isGuest: isAnonymous,
            timeoutMs: QUERY_TIMEOUT_MS,
          })
          events = rankEventCards(ranked, loaded.items)
          checkinState = loaded.checkin
        }

        if (cursor === null) {
          setPosts(ordered)
          setEventItems(events)
          setEventMyStatuses(checkinState.statuses)
          setEventAnonClaims(checkinState.anonClaims)
        } else {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const fresh = ordered.filter((p) => !existingIds.has(p.id))
            return [...prev, ...fresh]
          })
          // One card per event across pages: an event already listed is skipped even when
          // its shown date moved on between the two page loads (different occurrence id).
          setEventItems((prev) => appendNewEvents(prev, events))
          setEventMyStatuses((prev) => ({ ...prev, ...checkinState.statuses }))
          setEventAnonClaims((prev) => new Set([...prev, ...checkinState.anonClaims]))
        }

        if (ranked.length === PAGE_SIZE) {
          const last = ranked[ranked.length - 1]
          setRankCursor({ score: last.score, id: last.id })
          setHasMore(true)
        } else {
          setRankCursor(null)
          setHasMore(false)
        }

        // Opt-in / seeker / review side-data — shared with the chronological path. This page's
        // posts only: the whole maps on a first page, merged into them on a page that is added.
        void loadPostSideData(postIds, cursor === null)
      })()])
    } catch (err: unknown) {
      const isTimeout = isQueryTimeout(err) || (err instanceof DOMException && err.name === 'TimeoutError')
      const serializedMsg = getErrorMessage(err)
      const isPermission =
        (err as { code?: string })?.code === '42501' ||
        serializedMsg.toLowerCase().includes('permission denied')

      const msg: FeedLoadError = isTimeout ? 'timeout' : 'failed'

      logger.error('feed.rank.fetch_failed', err, {
        code: (err as { code?: string })?.code,
        message: serializedMsg,
        kind: isTimeout ? 'timeout' : isPermission ? 'permission' : 'unknown',
      })
      setError(msg)
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle)
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase, user, isAnonymous, loadPostSideData, setEventItems, setEventMyStatuses, setEventAnonClaims])

  // Refresh the feed in the CURRENT ordering mode — used by the initial load, the
  // mode toggle, the retry button, and realtime UPDATE/DELETE reconciliation.
  const refreshFeed = useCallback(() => {
    if (feedRankMode === 'ranked') {
      fetchRankedPosts(null)
    } else {
      fetchPosts(null)
    }
  }, [feedRankMode, fetchRankedPosts, fetchPosts])

  // The feed's status region starts empty and gets its first text a frame after the viewer's
  // language has settled (useProfileLocale reads 'en' until the profile has loaded), so its first
  // message (the list loading) is announced once, in the viewer's language.
  const announceReady = useFeedAnnounceReady(feedLocaleSettled({ authLoading, user, profileSettled }))

  // Initial fetch + mode-change refetch — wait for auth to reconcile (guest OR user)
  // before the first fetch so it runs against the reconciled session. Gate on
  // !authLoading only: posts are guest-readable, so we never require a user here.
  // refreshFeed depends on feedRankMode, so toggling the mode re-runs this effect.
  useEffect(() => {
    if (!authLoading) {
      refreshFeed()
    }
  }, [authLoading, refreshFeed])

  // Load following ids on mount (and when auth resolves)
  useEffect(() => {
    if (!authLoading) {
      fetchFollowing()
    }
  }, [authLoading, fetchFollowing])

  // Hydrate one post by id with the SAME explicit select + rowToPost transform as the main query and
  // put it at the top (deduped by id). Used by the realtime insert, by the author's own create (so a
  // new post shows even when realtime is slow), and by a restore after an unhide.
  const hydrateAndInsertPost = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(FEED_POST_SELECT)
        .eq('id', postId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        .maybeSingle()
      if (error) throw error
      if (!data) {
        // The row vanished between the realtime event and this read (deleted / hidden).
        logger.warn('feed.realtime.insert.hydrate.empty', { postId })
        return
      }
      let isLiked = false
      if (user) {
        const { data: liked } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
          .maybeSingle()
        isLiked = liked != null
      }
      const hydrated = rowToPost(data as unknown as FeedPostRow, { isLiked })
      if (!visibleInFeed(hydrated, user?.id ?? null)) return
      removedHiddenIdsRef.current.delete(postId)
      setPosts((prev) => (prev.some((p) => p.id === hydrated.id) ? prev : [hydrated, ...prev]))
    } catch (err) {
      if (isQueryTimeout(err)) return
      logger.warn('feed.realtime.hydrate_failed', { postId, error: getErrorMessage(err) })
    }
  }, [supabase, user])

  // Real-time updates. INSERT: hydrate the real row (true type, full data, exactly once — INV2).
  // UPDATE: classifyPostUpdate decides — patch a listed post in place (version-guarded: a stale echo
  // never reverts an edit, and nothing is re-ranked), keep the author's own held post with its
  // banner, take a hidden or deleted post out for everyone else, put back a post this session took
  // out when it is visible again, and IGNORE everything else (a like or comment on a post that is
  // not listed used to reload the whole feed for every connected viewer).
  useRealtimeFeed({
    onInsert: (newPost) => {
      void hydrateAndInsertPost(newPost.id)
    },
    onUpdate: (row) => {
      const action = classifyPostUpdate(row, {
        inList: postsRef.current.some((p) => p.id === row.id),
        viewerId: user?.id ?? null,
        removedHiddenIds: removedHiddenIdsRef.current,
      })
      switch (action) {
        case 'patch':
        case 'mark_held':
          setPosts((prev) => applyPostRowPatch(prev, row))
          return
        case 'remove':
          if (row.deleted_at == null) removedHiddenIdsRef.current.add(row.id)
          setPosts((prev) => prev.filter((p) => p.id !== row.id))
          dropSideData(row.id)
          return
        case 'restore':
          void hydrateAndInsertPost(row.id)
          return
        case 'ignore':
          return
      }
    },
    onResubscribe: () => refreshFeed(),
    onDelete: (postId) => {
      setPosts(prev => prev.filter(p => p.id !== postId))
    },
    enabled: !authLoading,
  })

  // ── Safety alerts feed strip ────────────────────────────────────────────────
  // Fetch active (expires_at > now) safety alerts directly via authenticated SELECT.
  // RLS on safety_alerts allows authenticated SELECT (migration 20260608000400).
  // We use a direct table query rather than the safety_alerts_in_view RPC because
  // that RPC requires viewport bounds — not available in the feed context.
  // Cap at 5, ordered by severity desc then created_at desc.
  useEffect(() => {
    if (!isAuthenticated) return
    const ctrl = new AbortController()
    void (async () => {
      try {
        const { data } = await supabase
          .from('safety_alerts')
          .select('id, alert_type, severity, description, created_at, expires_at, status, confirm_count, clear_count, verified')
          .gt('expires_at', new Date().toISOString())
          .order('severity', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5)
          .abortSignal(ctrl.signal)
        if (ctrl.signal.aborted) return
        // Safety alerts from the table do not have lng/lat pre-decomposed —
        // the location column is PostGIS geography. For the feed strip we only
        // need metadata (type, severity, description, times), not coordinates.
        // Map each row explicitly so is_mine (not available without the RPC) defaults
        // to false — the strip never uses ownership; map panel handles that.
        type StripRow = NonNullable<typeof data>[number]
        setSafetyAlerts(
          (data ?? []).map((r: StripRow): SafetyAlert => ({
            id: r.id,
            alert_type: r.alert_type as SafetyAlert['alert_type'],
            severity: r.severity,
            description: r.description,
            lng: 0,
            lat: 0,
            status: r.status,
            confirm_count: r.confirm_count,
            clear_count: r.clear_count,
            created_at: r.created_at,
            expires_at: r.expires_at,
            verified: r.verified ?? false,
            is_mine: false,
          }))
        )
      } catch (err) {
        // Non-critical; the strip hides gracefully on error. Still report it so
        // a persistent safety-alert load failure is observable (INV5).
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          logger.warn('feed.safety_alerts.fetch_failed', { error: getErrorMessage(err) })
        }
      }
    })()
    return () => ctrl.abort()
  }, [isAuthenticated, supabase])

  // ── Load more ────────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (loadingMore) return
    if (feedRankMode === 'ranked') {
      if (!rankCursor) return
      fetchRankedPosts(rankCursor)
    } else {
      if (!paginationCursor) return
      fetchPosts(paginationCursor)
    }
  }, [feedRankMode, rankCursor, paginationCursor, loadingMore, fetchRankedPosts, fetchPosts])

  // The composer's create: one create_post (raw text, the member's language as posts.lang). The new
  // post is shown at once from a fresh read; the realtime insert is deduped by id.
  const handleCreatePost = async (
    content: string,
    resourceId: string | null,
    maxSeekers: number | null,
    imageUrl?: string | null
  ): Promise<string | null> => {
    if (!user) return null
    const res = await createPost(supabase, {
      postType: 'feed',
      fields: {
        content: content.trim(),
        ...(maxSeekers != null ? { max_seekers: maxSeekers } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      },
      resourceId,
      lang: locale,
    })
    if (!res.ok) return null
    void hydrateAndInsertPost(res.value)
    return res.value
  }

  const handleOptIn = async (postId: string) => {
    if (isAnonymous) {
      // Server would reject this anyway (RESTRICTIVE policy). Surface friendly error.
      setOptInErrors((prev) => ({ ...prev, [postId]: 'Create a free account to opt in.' }))
      return
    }
    setOptInErrors((prev) => ({ ...prev, [postId]: '' }))
    const attempt = signUps.begin('optIn', { postId })
    if (!attempt) return
    const uid = viewerIdRef.current
    try {
      await recordSignUpWrite('opt_in', async (requestId) => {
        await doOptIn(postId, requestId)
        return true
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not opt in.'
      setOptInErrors((prev) => ({ ...prev, [postId]: msg }))
      return
    }
    signUps.succeeded(attempt)
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
    await followMyStatus(attempt, uid)
  }

  const handleWithdraw = async (postId: string) => {
    setOptInErrors((prev) => ({ ...prev, [postId]: '' }))
    const attempt = signUps.begin('withdraw', { postId })
    if (!attempt) return
    const uid = viewerIdRef.current
    let deleted: boolean
    try {
      deleted = await recordSignUpWrite('withdraw', (requestId) => doWithdraw(postId, requestId))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not withdraw.'
      setOptInErrors((prev) => ({ ...prev, [postId]: msg }))
      return
    }
    if (deleted) {
      signUps.succeeded(attempt)
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
    } else {
      // withdraw_opt_in deletes only a pending request and answers false, with no error, when
      // there was none (it was accepted, declined or already withdrawn): nothing was withdrawn,
      // so nothing is said as withdrawn. The card says it did not go through, and the read
      // below shows what the request is now.
      signUps.unchanged(attempt)
      showNotDone(postId)
    }
    await followMyStatus(attempt, uid)
  }

  // ── After a sign-up or review action on one post ──────────────────────────────────────────
  // The acted post is read again on its own and patched in place, then sign-up side data is read
  // again for THAT post and written over its entries (every other card keeps its own): exactly
  // one post read and one side-data set per action, however long the list is. The list is left
  // alone — its cards and their order, its mode (ranked stays ranked), its event cards, its
  // loaded pages and cursor, its loading and error state.
  //
  // A response writes only while it is the latest read of that post and the account has not
  // changed (per post for the post read; components/feed/sign-up-side-data.ts for side data).
  const postReadSeqRef = useRef(new Map<string, number>())

  // Read the acted post again with the feed's own select and decide with the feed's own rule
  // (classifyPostUpdate, as a realtime update does): patch it in place — version-guarded, so a
  // sign-up, which does not move the version, still patches slots_remaining — or take the card
  // out when the post is hidden from this viewer or no longer readable. A read that FAILS keeps
  // the card and is logged; it is never taken for "the post is gone".
  // `uid` is the account the action began under: a result that comes back to another one is dropped.
  const rereadActedPost = async (postId: string, action: string, uid: string | null, leave: () => void): Promise<'kept' | 'left'> => {
    const seq = (postReadSeqRef.current.get(postId) ?? 0) + 1
    postReadSeqRef.current.set(postId, seq)
    const read = await readFeedRow(supabase, postId)
    if (viewerIdRef.current !== uid || postReadSeqRef.current.get(postId) !== seq) return 'kept'
    if (read.status === 'error') {
      logger.error('feed.optin.reread_failed', read.error, { step: 'post', action, postId })
      return 'kept'
    }
    if (read.status === 'gone') {
      leave()
      return 'left'
    }
    const patch = rowPatchFromFeedRow(read.row)
    const decision = classifyPostUpdate(patch, {
      inList: postsRef.current.some((p) => p.id === postId),
      viewerId: uid,
      removedHiddenIds: removedHiddenIdsRef.current,
    })
    if (decision === 'patch' || decision === 'mark_held') {
      setPosts((prev) => applyPostRowPatch(prev, patch))
    } else if (decision === 'remove') {
      removedHiddenIdsRef.current.add(postId)
      leave()
      return 'left'
    }
    return 'kept'
  }

  // The acted card leaves the feed (its post is gone, or hidden from this viewer). On the
  // sub-tab the action began in it leaves as a deleted card does — focus to the next card, the
  // card goes, then the sentence. When the member has moved to another sub-tab meanwhile, the
  // card just goes: nothing is said and no focus is moved there.
  const actedCardLeaves = (postId: string, context: string, text: string) => {
    if (signUpContextRef.current === context) {
      cardLeaves(postId, text)
      return
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    dropSideData(postId)
  }

  // A member's own opt-in or withdraw came back: read their status for that post again. The
  // read that lands settles the attempt (readMyStatuses).
  const followMyStatus = async (attempt: SignUpAttempt, uid: string | null) => {
    if (viewerIdRef.current !== uid) return
    confirmedSignUpsRef.current.push(attempt)
    try {
      await readMyStatuses([attempt.postId], false, uid)
    } catch (err: unknown) {
      logger.error('feed.optin.reread_failed', err, { step: 'follow_up', action: attempt.kind })
      confirmedSignUpsRef.current = confirmedSignUpsRef.current.filter((a) => a !== attempt)
      signUps.settled(attempt, 'stale')
    }
  }

  // An author's sign-up request came back (it changed the row, or it changed nothing): follow
  // it up, and make sure its attempt is settled. The read that lands settles it
  // (loadPostSideData); an attempt with nothing to read is settled here.
  const followSignUp = async (attempt: SignUpAttempt, uid: string | null) => {
    if (viewerIdRef.current !== uid) return
    confirmedSignUpsRef.current.push(attempt)
    const forget = () => {
      confirmedSignUpsRef.current = confirmedSignUpsRef.current.filter((a) => a !== attempt)
    }
    try {
      if (!attempt.postId) {
        forget()
        signUps.settled(attempt, 'unread')
        return
      }
      const left = (await rereadActedPost(attempt.postId, attempt.kind, uid, () => {
        // What is said as the card goes is this action's outcome; one that changed nothing has
        // been said by the card's own alert line already.
        forget()
        signUps.disarm(attempt)
        actedCardLeaves(attempt.postId, attempt.context, attempt.changed === true ? signUps.sentence(attempt) : '')
      })) === 'left'
      if (left || viewerIdRef.current !== uid) return
      await loadPostSideData([attempt.postId], false, attempt.kind)
    } catch (err: unknown) {
      logger.error('feed.optin.reread_failed', err, { step: 'follow_up', action: attempt.kind })
      forget()
      signUps.settled(attempt, 'stale')
    }
  }

  // Author updates an opt-in status (accept / decline / complete). One action per row at a time:
  // a press on a row whose action is still under way starts nothing.
  //
  // The update asks for the row it changed (`.select('id')`). An update that matches no row —
  // the seeker withdrew, and this list had not caught up — answers with no error and no row:
  // it changed nothing, and is not said as done. (The author can read every row they can
  // update: the SELECT and UPDATE policies of resource_opt_ins share the post-author branch,
  // so a real change never comes back empty.)
  const handleAuthorUpdateOptIn = async (
    optInId: string,
    status: 'accepted' | 'declined' | 'completed'
  ) => {
    const attempt = signUps.begin(status === 'accepted' ? 'accept' : status === 'declined' ? 'decline' : 'complete', { optInId })
    if (!attempt) return
    const uid = viewerIdRef.current
    if (attempt.postId) setOptInErrors((prev) => ({ ...prev, [attempt.postId]: '' }))
    let changed: boolean
    try {
      changed = await recordSignUpWrite(attempt.kind, async (requestId) => {
        const { data: changedRows, error: updErr } = await supabase
          .from('resource_opt_ins')
          .update({ status })
          .eq('id', optInId)
          .select('id')
          .setHeader('x-request-id', requestId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (updErr) throw updErr
        return (changedRows ?? []).length > 0
      })
    } catch {
      // The card says that it did not go through; focus stays on the button they pressed.
      signUps.failed(attempt)
      showNotDone(attempt.postId)
      return
    }
    if (changed) {
      signUps.succeeded(attempt)
    } else {
      signUps.unchanged(attempt)
      showNotDone(attempt.postId)
    }
    await followSignUp(attempt, uid)
  }

  // Author unblocks a previously-declined opt-in -> the DB DELETEs the declined row and
  // restores the slot exactly once; the seeker may then opt in again. The private
  // "declined before" marker survives (opt_in_declines is untouched here). The row is busy
  // from the press (signUps.begin), so a rapid double-click fires the RPC once; an Unblock on
  // another row goes through. unblock_opt_in answers false, with no error, when it deleted
  // nothing (a second concurrent call, or one from another tab, got there first): that is not
  // said as unblocked; the card says it did not go through and the read below shows the row.
  const handleAuthorUnblockOptIn = async (optInId: string) => {
    const attempt = signUps.begin('unblock', { optInId })
    if (!attempt) return
    const uid = viewerIdRef.current
    if (attempt.postId) setOptInErrors((prev) => ({ ...prev, [attempt.postId]: '' }))
    let changed: boolean
    try {
      changed = await recordSignUpWrite('unblock', async (requestId) => {
        const { data, error: rpcErr } = await supabase
          .rpc('unblock_opt_in', { p_opt_in_id: optInId })
          .setHeader('x-request-id', requestId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (rpcErr) throw rpcErr
        return data === true
      })
    } catch {
      signUps.failed(attempt)
      showNotDone(attempt.postId)
      return
    }
    if (changed) {
      signUps.succeeded(attempt)
    } else {
      signUps.unchanged(attempt)
      showNotDone(attempt.postId)
    }
    await followSignUp(attempt, uid)
  }

  // Author opens review modal for a specific seeker
  const handleAuthorReviewSeeker = (optInId: string, seekerName: string) => {
    reviewOpenerRef.current = document.querySelector<HTMLElement>(`[data-testid="review-seeker-${CSS.escape(optInId)}"]`)
    reviewPostIdRef.current = Object.values(authorOptInsMap).flat().find((o) => o.id === optInId)?.postId ?? null
    setReviewModalOptInId(optInId)
    setReviewModalRevieweeName(seekerName)
    setReviewModalRevieweeRole('seeker')
    setReviewModalOpen(true)
  }

  // Seeker opens review modal for the sourcer
  const handleReviewSourcer = (_postId: string, optInId: string) => {
    const post = posts.find((p) => p.id === _postId)
    reviewOpenerRef.current = document.querySelector<HTMLElement>(`[data-testid="review-sourcer-${CSS.escape(_postId)}"]`)
    reviewPostIdRef.current = _postId
    setReviewModalOptInId(optInId)
    setReviewModalRevieweeName(post?.author.name ?? 'Sourcer')
    setReviewModalRevieweeRole('sourcer')
    setReviewModalOpen(true)
  }

  // Where focus goes when the review dialog closes and its button is gone (a sent review removes
  // it): the sign-up list toggle of that post, else the post card, else the feed's heading.
  const focusAfterReview = () => {
    const postId = reviewPostIdRef.current
    const stable = postId
      ? document.querySelector<HTMLElement>(`[data-testid="opt-in-manage-${CSS.escape(postId)}"]`) ??
        document.querySelector<HTMLElement>(`[data-testid="post-card-${CSS.escape(postId)}"]`)
      : null
    if (stable) stable.focus()
    else focusFeedTitle()
  }

  // After a review is submitted: the same follow-up as a sign-up action (one post read, one
  // side-data set for that post), then it is said once. Focus was put on a stable control when
  // the dialog closed; it is moved again only if it has been lost since, so a member who has
  // moved on is not pulled back. When the post is gone the card leaves and the sentence is said
  // as it goes; when the side data could not be read the sentence says so (the Review button
  // may still be on the card). A member who has left the sub-tab hears nothing.
  const handleReviewSubmitted = async () => {
    const postId = reviewPostIdRef.current
    const uid = viewerIdRef.current
    const context = signUpContextRef.current
    const sent = messagesT(locale, 'announceReviewSubmitted')
    const left = postId != null && (await rereadActedPost(postId, 'review', uid, () => actedCardLeaves(postId, context, sent))) === 'left'
    if (left || viewerIdRef.current !== uid) return
    const side = postId != null ? await loadPostSideData([postId], false, 'review') : 'applied'
    if (signUpContextRef.current !== context) return
    announceCardNotice(side === 'failed' ? `${sent} ${optInsT(locale, 'announceListStale')}` : sent, () => {
      if (focusWasLost(null)) focusAfterReview()
    })
  }

  const handleLike = async (postId: string) => {
    if (!user) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    // In-flight guard: ignore a second toggle for the same post until the first
    // settles. A rapid double-click could otherwise leave isLiked transiently
    // disagreeing with the server on the heart-fill (the counts already
    // reconcile from server truth below; this closes the isLiked drift).
    if (likeInFlightRef.current.has(postId)) return
    likeInFlightRef.current.add(postId)

    // Optimistic update — immediate feedback only. The displayed count is
    // reconciled to the server's denormalized like_count below (INV3) so
    // repeated like/unlike can never accumulate client-side arithmetic drift.
    setPosts((prev) => prev.map(p =>
      p.id === postId
        ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? Math.max(p.likes - 1, 0) : p.likes + 1 }
        : p
    ))

    try {
      if (post.isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id })
        if (error) throw error
      }

      // Settle from server truth: the recompute trigger maintains like_count.
      const { data: fresh, error: readErr } = await supabase
        .from('posts')
        .select('like_count')
        .eq('id', postId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        .maybeSingle()
      if (!readErr && fresh && typeof fresh.like_count === 'number') {
        setPosts((prev) => prev.map(p =>
          p.id === postId ? { ...p, likes: fresh.like_count } : p
        ))
      }
    } catch (err) {
      // Revert optimistic update to the pre-click server-backed values.
      setPosts((prev) => prev.map(p =>
        p.id === postId
          ? { ...p, isLiked: post.isLiked, likes: post.likes }
          : p
      ))
      // A hidden or deleted post takes no new likes (post_likes RLS): say so instead of failing silently.
      announceCardNotice(cardT(locale, (err as { code?: string })?.code === '42501' ? 'likeClosed' : 'likeFailed'))
      logger.error('feed.like.toggle_failed', err, { postId })
    } finally {
      likeInFlightRef.current.delete(postId)
    }
  }

  // Submit a content report via SECDEF RPC
  const handleReport = async (
    postId: string,
    reason: string,
    details: string | null
  ): Promise<{ hidden: boolean }> => {
    const { data, error } = await supabase.rpc('submit_content_report', {
      p_content_type: 'post',
      p_content_id: postId,
      p_reason: reason as ReportReason,
      p_details: details ?? undefined,
    })
    if (error) throw new Error(getFriendlyErrorMessage(error))
    const result = data as { report_count: number; hidden: boolean }
    // A report that hides the post: its card leaves the reporter's feed once the dialog closes
    // (ReportDialog onSubmit below), the same way as every other card that leaves.
    return { hidden: result.hidden }
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
    const url = generateShareUrl('post', postId)
    const copied = () => {
      setShareCopiedPostId(postId)
      announceCardNotice(cardT(locale, 'statusLinkCopied'))
      setTimeout(() => setShareCopiedPostId(null), 2000)
    }
    if (navigator.share) {
      navigator.share({ title: cardT(locale, 'shareTitle'), url }).catch((err: unknown) => {
        // AbortError = user cancelled — swallow silently
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Any other share failure: fall back to clipboard
        navigator.clipboard?.writeText(url).then(copied).catch(() => {})
      })
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(copied).catch(() => {})
    }
  }

  const handleEmbed = (postId: string) => {
    const origin = window.location.origin
    const snippet = `<iframe src="${origin}/s/embed/${postId}" width="100%" height="220" style="border:1px solid #e7e5e4;border-radius:12px;" title="FEED opt-in"></iframe>`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(snippet).then(() => {
        setEmbedCopiedPostId(postId)
        setTimeout(() => setEmbedCopiedPostId(null), 2500)
      }).catch(() => {})
    }
  }

  // Copy a post's share link (the menu's Copy link), announced.
  const copyPostLink = (postId: string) => {
    const url = generateShareUrl('post', postId)
    navigator.clipboard?.writeText(url).then(() => announceCardNotice(cardT(locale, 'statusLinkCopied'))).catch(() => {})
  }

  // Moderators act from the card with the version they are looking at (p_expected_version). A
  // conflict (the author edited since) re-reads the post and says so; hold / remove take it out of
  // the feed (staff review hidden posts in the moderation queue); restore re-reads it in place.
  // `fromDialog`: run from Remove's confirmation — the notice (and a leaving card's focus move) waits
  // until the dialog has closed (the modal hides the notice region).
  const moderateFromCard = async (post: Post, action: PostModerationAction, fromDialog = false) => {
    const say = (text: string) => {
      if (fromDialog) pendingNoticeRef.current = () => announceCardNotice(text, () => focusCardTrigger(post.id))
      else announceCardNotice(text)
    }
    const leave = (text: string) => {
      if (!fromDialog) return cardLeaves(post.id, text)
      dialogTriggerRef.current = null
      pendingNoticeRef.current = () => cardLeaves(post.id, text)
    }
    await moderationGateRef.current.run(async () => {
      const result = await moderatePost(supabase, action, post.id, post.version)
      if (!result.ok) {
        if (result.conflict || result.gone) {
          const row = await loadFeedRow(supabase, post.id)
          if (row) {
            setPosts((prev) => applyPostRowPatch(prev, rowPatchFromFeedRow(row)))
            say(cardT(locale, result.gone ? 'statusPostGone' : 'statusModerationConflict'))
          } else leave(cardT(locale, 'statusPostGone'))
        } else say(cardT(locale, 'statusModerationFailed'))
        return
      }
      if (action === 'authorize') {
        const row = await loadFeedRow(supabase, post.id)
        if (row) setPosts((prev) => applyPostRowPatch(prev, rowPatchFromFeedRow(row)))
        // The card stays (focus stays on its ⋯ button): announce only.
        say(cardT(locale, 'statusRestored'))
      } else {
        removedHiddenIdsRef.current.add(post.id)
        leave(cardT(locale, action === 'hold' ? 'statusHeld' : 'statusRemoved'))
      }
    })
  }

  // One handler for every card action (⋯ menu items, the "Edited" label, the footer Report).
  const handleCardAction = (post: Post, id: PostMenuItemId, trigger: HTMLElement | null) => {
    dialogTriggerRef.current = trigger
    switch (id) {
      case 'edit':
      case 'delete':
      case 'report':
      case 'history':
        setCardDialog({ kind: id, post })
        return
      case 'signup_to_report':
        setCardDialog({ kind: 'signup' })
        return
      case 'copy_link':
        copyPostLink(post.id)
        return
      case 'hold':
        void moderateFromCard(post, 'hold')
        return
      case 'remove':
        // Removing upholds the post's reports: confirmed first, like Delete.
        setCardDialog({ kind: 'remove', post })
        return
      case 'restore':
        void moderateFromCard(post, 'authorize')
        return
      case 'edit_in_admin':
        // Rendered as the "Edit in admin" link itself (it navigates; nothing to run here).
        return
      default:
        assertNever(id)
    }
  }

  // A card leaves the feed (the author deleted it, a moderator held or removed it): in ONE frame,
  // focus moves to the next post card (or the feed's heading when none is left), the card is
  // removed, then the notice is set — the same order as an event card that leaves.
  const cardLeaves = (postId: string, text: string) => {
    announceCardNotice(text, () => {
      const list = postsRef.current
      const idx = list.findIndex((p) => p.id === postId)
      const nextId = idx >= 0 ? (list[idx + 1] ?? list[idx - 1])?.id : undefined
      const next = nextId ? document.querySelector<HTMLElement>(`[data-testid="post-card-${CSS.escape(nextId)}"]`) : null
      if (next) next.focus()
      else focusFeedTitle()
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      dropSideData(postId)
    })
  }

  // The card's ⋯ button (or, when it is gone, nothing): where focus returns after a dialog.
  const focusCardTrigger = (postId: string) => {
    const trigger = dialogTriggerRef.current
    if (trigger?.isConnected) trigger.focus()
    else document.querySelector<HTMLElement>(`[data-testid="post-menu-${CSS.escape(postId)}"]`)?.focus()
  }

  // A dialog closed: announce what it did (queued while the modal hid the notice region).
  const flushPendingNotice = () => {
    const pending = pendingNoticeRef.current
    pendingNoticeRef.current = null
    pending?.()
  }

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'announcements') return post.category === 'announcement'
    if (activeFilter === 'mine') return user != null && post.author.id === user.id
    if (activeFilter === 'following') return user != null && followingIds.has(post.author.id)
    return true
  })

  // W1.6b: interleave community events among posts by their ranked_feed_v2 score,
  // but ONLY in ranked mode under the "All" filter (feedIncludesEvents). Following /
  // My Posts / Announcements are author-scoped (events have no post author) and the
  // chronological "Recent" mode is posts-only — those render posts alone. Each ranked
  // row renders exactly once, in global rank order (I4).
  const feedItems: FeedItem[] = feedIncludesEvents(feedRankMode, activeFilter)
    ? mergeRankedFeedItems(filteredPosts, eventItems)
    : filteredPosts.map((post) => ({ kind: 'post', post }))

  return (
    <>
    {/* Review modal — rendered at panel root so it can overlay everything */}
    {reviewModalOpen && reviewModalOptInId && (
      <ReviewModal
        open={reviewModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReviewModalOpen(false)
            setReviewModalOptInId(null)
          }
        }}
        optInId={reviewModalOptInId}
        revieweeName={reviewModalRevieweeName}
        revieweeRole={reviewModalRevieweeRole}
        onSubmitted={handleReviewSubmitted}
        returnFocusRef={reviewOpenerRef}
        fallbackFocus={focusAfterReview}
      />
    )}
    {/* Post editing (PR-2): the card dialogs, one at a time, at panel root. Their announcements go
        through the feed's card-notice region (FeedStatusRegions). */}
    <PostEditDialog
      post={cardDialog?.kind === 'edit' ? cardDialog.post : null}
      locale={locale}
      returnFocusRef={dialogTriggerRef}
      onClose={() => setCardDialog(null)}
      onGone={(postId) => {
        // The post no longer exists: once the dialog has closed, its card leaves (focus to the next
        // card or the heading — the card's own ⋯ button is going), then "This post was deleted".
        dialogTriggerRef.current = null
        pendingNoticeRef.current = () => cardLeaves(postId, cardT(locale, 'statusPostGone'))
      }}
      onSaved={(postId, row, result, changes) => {
        if (!result) {
          // "Use the current version": nothing was saved, so nothing is announced; the card shows the
          // current version when it could be read.
          if (row) setPosts((prev) => applyPostRowPatch(prev, rowPatchFromFeedRow(row)))
          return
        }
        const patch = row ? rowPatchFromFeedRow(row) : editFallbackPatch(postId, result, changes)
        setPosts((prev) => applyPostRowPatch(prev, patch))
        const text = cardT(locale, 'statusPostUpdated')
        pendingNoticeRef.current = () => announceCardNotice(text, () => focusCardTrigger(postId))
      }}
      onClosed={flushPendingNotice}
    />
    <PostHistoryDialog
      target={
        cardDialog?.kind === 'history'
          ? {
              kind: 'post',
              id: cardDialog.post.id,
              postType: cardDialog.post.postType,
              authorId: cardDialog.post.author.id,
              current: {
                version: cardDialog.post.version,
                content: cardDialog.post.content,
                imageUrl: cardDialog.post.imageUrl,
                createdAt: cardDialog.post.timestamp.toISOString(),
                editedAt: cardDialog.post.editedAt?.toISOString() ?? null,
              },
            }
          : null
      }
      locale={locale}
      viewer={{ id: user?.id ?? null, isGuest: isAnonymous, isPlatformAdmin: actionViewer.tier === 'platform_admin' }}
      onClose={() => setCardDialog(null)}
      returnFocusRef={dialogTriggerRef}
    />
    <ConfirmDeleteDialog
      open={cardDialog?.kind === 'delete'}
      kind="post"
      locale={locale}
      returnFocusRef={dialogTriggerRef}
      onClose={() => setCardDialog(null)}
      onClosed={flushPendingNotice}
      onConfirm={async () => {
        if (cardDialog?.kind !== 'delete') return null
        const target = cardDialog.post
        const res = await deleteOwnPost(supabase, target.id, target.postType)
        // Already gone counts as deleted.
        if (!res.ok && res.failure.kind !== 'not_found') return failureText(locale, res.failure)
        // The card's own ⋯ button is about to leave: focus goes to the next card once the dialog closed.
        dialogTriggerRef.current = null
        const text = cardT(locale, 'statusPostDeleted')
        pendingNoticeRef.current = () => cardLeaves(target.id, text)
        return null
      }}
    />
    <ConfirmDeleteDialog
      open={cardDialog?.kind === 'remove'}
      kind="remove"
      locale={locale}
      returnFocusRef={dialogTriggerRef}
      onClose={() => setCardDialog(null)}
      onClosed={flushPendingNotice}
      onConfirm={async () => {
        if (cardDialog?.kind !== 'remove') return null
        await moderateFromCard(cardDialog.post, 'remove', true)
        return null
      }}
    />
    <ReportDialog
      postId={cardDialog?.kind === 'report' ? cardDialog.post.id : null}
      locale={locale}
      returnFocusRef={dialogTriggerRef}
      onClose={() => setCardDialog(null)}
      onClosed={flushPendingNotice}
      // The dialog itself shows and announces its confirmation (the feed's region is hidden while it is
      // open). When the report hid the post, the card leaves after the dialog closed.
      onSubmit={async (postId, reason, details) => {
        const { hidden } = await handleReport(postId, reason, details)
        if (hidden) {
          dialogTriggerRef.current = null
          pendingNoticeRef.current = () => cardLeaves(postId, cardT(locale, 'statusReportHidden'))
        }
      }}
    />
    {cardDialog?.kind === 'signup' && (
      <Dialog open onOpenChange={(o) => !o && setCardDialog(null)}>
        <DialogContent
          className="max-w-sm"
          aria-describedby={undefined}
          lang={locale}
          dir={dir(locale)}
          closeLabel={cardT(locale, 'close')}
          onCloseAutoFocus={(e) => {
            if (dialogTriggerRef.current) {
              e.preventDefault()
              dialogTriggerRef.current.focus()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{cardT(locale, 'signupToReportTitle')}</DialogTitle>
          </DialogHeader>
          <CreateAccountPrompt message={cardT(locale, 'signupToReportBody')} linkLabel={feedChromeT(locale, 'createAccount')} />
        </DialogContent>
      </Dialog>
    )}
    <div lang={locale} dir={dir(locale)} className="h-full flex flex-col">
      {/* Top-level tablist: Feed | Messages
          Styled DISTINCT from FeedHeader's rounded-full filter pills:
          py-2.5 font-semibold border-b — per NN/g 2-level tab differentiation */}
      {/* shrink-0 is load-bearing: `overflow-x-auto` sets this flex item's
          automatic minimum height to 0 (instead of min-content), which let the
          sibling flex-1 tabpanel collapse the tablist to its 1px border. Its tab
          buttons then overflowed under the feed header, which intercepted the
          clicks (only #events/#petitions hashes reached the subtabs). Never
          shrinking keeps the full tab-row height and its own hit area. */}
      <div
        role="tablist"
        aria-label={feedChromeT(locale, 'sectionsAria')}
        className="flex shrink-0 border-b border-stone-200 mb-0 overflow-x-auto"
      >
        <button
          role="tab"
          id="feed-tab-feed"
          aria-selected={activeSubtab === 'feed'}
          aria-controls="feed-panel-feed"
          tabIndex={activeSubtab === 'feed' ? 0 : -1}
          onClick={() => handleSubtabSwitch('feed')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 0)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'feed'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {feedChromeT(locale, 'tabFeed')}
        </button>
        <button
          role="tab"
          id="feed-tab-events"
          aria-selected={activeSubtab === 'events'}
          aria-controls="feed-panel-events"
          tabIndex={activeSubtab === 'events' ? 0 : -1}
          onClick={() => handleSubtabSwitch('events')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 1)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'events'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {feedChromeT(locale, 'tabEvents')}
        </button>
        <button
          role="tab"
          id="feed-tab-businesses"
          aria-selected={activeSubtab === 'businesses'}
          aria-controls="feed-panel-businesses"
          tabIndex={activeSubtab === 'businesses' ? 0 : -1}
          onClick={() => handleSubtabSwitch('businesses')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 2)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'businesses'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {feedChromeT(locale, 'tabBusinesses')}
        </button>
        <button
          role="tab"
          id="feed-tab-organizations"
          aria-selected={activeSubtab === 'organizations'}
          aria-controls="feed-panel-organizations"
          tabIndex={activeSubtab === 'organizations' ? 0 : -1}
          onClick={() => handleSubtabSwitch('organizations')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 3)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'organizations'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {feedChromeT(locale, 'tabOrganizations')}
        </button>
        <button
          role="tab"
          id="feed-tab-petitions"
          aria-selected={activeSubtab === 'petitions'}
          aria-controls="feed-panel-petitions"
          tabIndex={activeSubtab === 'petitions' ? 0 : -1}
          onClick={() => handleSubtabSwitch('petitions')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 4)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'petitions'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {feedChromeT(locale, 'tabPetitions')}
        </button>
        {/* Visual divider before Messages — separates community content from P2P */}
        <span className="border-l border-stone-300 dark:border-stone-600 pl-1 ml-1 self-stretch my-1" aria-hidden="true" />
        <button
          role="tab"
          id="feed-tab-messages"
          aria-selected={activeSubtab === 'messages'}
          aria-controls="feed-panel-messages"
          tabIndex={activeSubtab === 'messages' ? 0 : -1}
          onClick={() => handleSubtabSwitch('messages')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 5)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'messages'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {feedChromeT(locale, 'tabMessages')}
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
      ) : activeSubtab === 'events' ? (
        <div
          role="tabpanel"
          id="feed-panel-events"
          aria-labelledby="feed-tab-events"
          tabIndex={0}
          className="flex-1 overflow-y-auto p-1"
        >
          <EventsPanel onEventChanged={syncFeedEventCard} />
        </div>
      ) : activeSubtab === 'businesses' ? (
        <div
          role="tabpanel"
          id="feed-panel-businesses"
          aria-labelledby="feed-tab-businesses"
          tabIndex={0}
          className="flex-1 min-h-0"
        >
          <BusinessesPanel />
        </div>
      ) : activeSubtab === 'organizations' ? (
        <div
          role="tabpanel"
          id="feed-panel-organizations"
          aria-labelledby="feed-tab-organizations"
          tabIndex={0}
          className="flex-1 min-h-0"
        >
          <OrganizationsPanel />
        </div>
      ) : activeSubtab === 'petitions' ? (
        <div
          role="tabpanel"
          id="feed-panel-petitions"
          aria-labelledby="feed-tab-petitions"
          tabIndex={0}
          className="flex-1 overflow-y-auto p-1"
        >
          <PetitionsPanel />
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
          <FeedHeader
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            rankMode={feedRankMode}
            onRankModeChange={setFeedRankMode}
            locale={locale}
            titleRef={feedTitleRef}
          />
          {/* The feed's two polite status regions (mounted before their first text): the list
              (loading / empty) and, separately, what the last event-card change did. */}
          <FeedStatusRegions
            ready={announceReady}
            loading={loading}
            error={error !== null}
            empty={feedItems.length === 0}
            notice={feedNotice}
            locale={locale}
          />

          {/* Create Post Card — full users only; guests see account prompt */}
          {isAuthenticated && !isAnonymous && (
            <div data-testid="feed-composer-region">
            <CreatePostCard
              onPost={handleCreatePost}
              onCreated={(postId) => void hydrateAndInsertPost(postId)}
              locale={locale}
              onAnnounce={announceCardNotice}
              resourceOptions={resourceOptions}
              onSafetyAlertClick={() => {
                setPanelParams((prev) => ({ ...prev, openSafetyReport: true }))
                setActivePanel('map')
              }}
            />
            </div>
          )}
          {isAnonymous && (
            <div className="mb-3">
              <CreateAccountPrompt message={feedChromeT(locale, 'guestPrompt')} linkLabel={feedChromeT(locale, 'createAccount')} />
            </div>
          )}


          {/* Follow/unfollow error banner: the hook's sentence, in the member's language. */}
          {followError && <FollowErrorBanner error={followError} locale={locale} />}

          {/* Safety alerts strip — active alerts (expires_at > now), max 5.
              Tap any card to navigate to the map panel for full details + voting. */}
          {safetyAlerts.length > 0 && (
            /* Not translated yet (Release 3): its English copy is marked English. */
            <div lang="en" dir="ltr" data-testid="feed-safety-region">
              <SafetyStrip
                alerts={safetyAlerts}
                onViewMap={() => setActivePanel('map')}
                formatAge={getRelativeTime}
              />
            </div>
          )}

          {/* Scrollable Feed */}
          {/* W1.5 — LazyMotion(strict) loads only the domAnimation feature bundle
              and FAILS the build if a full `motion.*` component is used, keeping
              the motion surface to the `m.*` primitives below. */}
          <LazyMotion features={domAnimation} strict>
          <div className="flex-1 overflow-y-auto space-y-3">
            {error || loading || feedItems.length === 0 ? (
              <FeedListStatus
                state={error ? { kind: 'error', error } : loading ? { kind: 'loading' } : { kind: 'empty' }}
                locale={locale}
                onRetry={() => { setError(null); refreshFeed() }}
                focusTitle={focusFeedTitle}
              />
            ) : (
              // W1.5 — initial={false} so page-1 / first paint does NOT animate
              // every post; only subsequent live inserts/removals animate. No
              // `layout` prop anywhere — positions are never animated (that would
              // reshuffle on W1.4 count patches). Enter/exit is opacity+transform only.
              <AnimatePresence initial={false}>
              {feedItems.map((item) => {
                // W1.6b: an event row renders the shared EventCard (same enter/exit
                // motion, no `layout`); check-in reuses the W1.6a logic + sheet.
                if (item.kind === 'event') {
                  const ev = item.event
                  return (
                    <m.div key={`event-${ev.eventId}`} data-testid={`event-${ev.occurrenceId}`} {...postEnterExit(reduce)}>
                      <EventCard
                        event={ev}
                        locale={locale}
                        surface="feed"
                        distanceBucket={ev.distanceBucket}
                        myStatus={eventMyStatuses[ev.occurrenceId] ?? 'none'}
                        anonymousClaimed={eventAnonClaims.has(ev.occurrenceId)}
                        onCheckedIn={(occurrenceId, result) => {
                          // Apply the server's check_in answer to this card in place (the feed,
                          // the member's place and focus stay); re-read only when it is unknown.
                          const effect = checkinResultEffect(result)
                          if (!effect) { refreshFeed(); return }
                          if ('anonymous' in effect) setEventAnonClaims((prev) => new Set(prev).add(occurrenceId))
                          else setEventMyStatuses((prev) => ({ ...prev, [occurrenceId]: effect.status }))
                        }}
                        onManaged={handleEventManaged}
                      />
                    </m.div>
                  )
                }
                const post = item.post
                const seekerOptInId = seekerOptInIds[post.id] ?? null
                const seekerHasReviewed =
                  seekerOptInId != null && myReviewMap.has(seekerOptInId)
                // optInMap is the single source of truth for the current user's opt-in status.
                // fetchOptInsForPosts returns all statuses (pending/accepted/completed/declined)
                // with no filter, so this correctly clears to undefined after a withdraw.
                const postOptInStatus = optInMap.get(post.id)

                return (
                  <m.div key={post.id} data-testid={`post-${post.id}`} {...postEnterExit(reduce)}>
                    <FeedPostCard
                      post={post}
                      locale={locale}
                      formatAge={(d) => relativeAge(d.toISOString(), locale)}
                      viewer={actionViewer}
                      onAction={handleCardAction}
                      commentsOpen={openCommentPostIds.has(post.id)}
                      currentUserId={user?.id ?? null}
                      optInStatus={postOptInStatus}
                      currentUserOptInId={seekerOptInId}
                      seekerHasReviewed={seekerHasReviewed}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                      onEmbed={handleEmbed}
                      onOptIn={handleOptIn}
                      onWithdraw={handleWithdraw}
                      onReviewSourcer={handleReviewSourcer}
                      optInError={optInErrors[post.id] || null}
                      shareCopied={shareCopiedPostId === post.id}
                      embedCopied={embedCopiedPostId === post.id}
                      optInCount={optInCounts[post.id]}
                      authorOptIns={authorOptInsMap[post.id]}
                      onAuthorUpdateOptIn={handleAuthorUpdateOptIn}
                      onAuthorReviewSeeker={handleAuthorReviewSeeker}
                      onAuthorUnblockOptIn={handleAuthorUnblockOptIn}
                      busyOptInIds={signUps.busy}
                      authorReviewedOptInIds={authorReviewedSet}
                      authorDeclinedSeekerIds={authorDeclinedSeekers}
                      currentUserIsGuest={isAnonymous}
                      isFollowingAuthor={followingIds.has(post.author.id)}
                      onFollow={doFollow}
                      onUnfollow={doUnfollow}
                      petitionEmbed={
                        post.postType === 'petition' && post.petitionId
                          ? (() => {
                              const p = petitionsList.find((x) => x.id === post.petitionId)
                              return p
                                ? {
                                    title: p.title,
                                    summary: p.summary,
                                    signatureCount: p.signatureCount,
                                    targetSignatures: p.target_signatures,
                                    hasSigned: p.hasSigned,
                                    isSigning: signingPetitionId === p.id,
                                  }
                                : undefined
                            })()
                          : undefined
                      }
                      onSignPetition={signPetition}
                    />
                    {openCommentPostIds.has(post.id) && (
                      <CommentThread
                        postId={post.id}
                        locale={locale}
                        onAnnounce={announceCardNotice}
                        onCountChange={(count) => {
                          setPosts((prev) =>
                            prev.map((p) => (p.id === post.id ? { ...p, comments: count } : p))
                          )
                        }}
                      />
                    )}
                  </m.div>
                )
              })}
              </AnimatePresence>
            )}

            {/* Load More — only shown when there are more pages and the feed has loaded */}
            {!loading && !error && hasMore && (
              <FeedLoadMore locale={locale} loading={loadingMore} onLoadMore={handleLoadMore} />
            )}
          </div>
          </LazyMotion>
        </div>
      )}
    </div>
    </>
  )
}
