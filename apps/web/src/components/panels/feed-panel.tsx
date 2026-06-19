'use client'

// apps/web/src/components/panels/feed-panel.tsx
// Community Feed panel - posts, updates, and interactions from mutual aid community
// Shows create post form, filter tabs, and scrollable feed of PostCards

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Heart, MessageCircle, Share2, Code, Send, User, Loader2, Check, Link as LinkIcon, ChevronDown, ChevronUp, Star, MapPin, ScrollText, CheckCircle2, Flag, AlertTriangle, Cloud, Construction, Gauge, ShieldAlert, Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { sanitizeInput } from '@/lib/security'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeFeed } from '@/hooks/use-realtime-feed'
import { useAuth } from '@/hooks/use-auth'
import { useSavedResources } from '@/hooks/use-saved-resources'
import { useOptIns, type OptInMap } from '@/hooks/use-opt-ins'
import { useReviews, type ReviewMap } from '@/hooks/use-reviews'
import { useFollows } from '@/hooks/use-follows'
import { MessagesPanel } from './messages-panel'
import { EventsPanel } from './events-panel'
import { PetitionsPanel } from './petitions-panel'
import { usePanelContext } from '@/components/layout/feed-shell'
import { logger, withMetric } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { track } from '@vercel/analytics'
import { CommentThread } from '@/components/feed/comment-thread'
import { PostTypeWizard } from './post-type-wizard'
import { HarmonyBadge } from '@/components/feed/harmony-badge'
import { ReviewModal } from '@/components/feed/review-modal'
import { usePetitions } from '@/hooks/use-petitions'
import { getCategoryTailwind, getCategoryLabel } from '@/lib/resource-categories'
import type { SafetyAlert } from '@/hooks/use-safety-alerts'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'

// ============================================
// TYPES
// ============================================
interface Post {
  id: string
  author: {
    id: string
    name: string
    avatar?: string
    role: string
    harmonyScore: number | null
    harmonyReviewsCount: number
  }
  content: string
  timestamp: Date
  likes: number
  comments: number
  isLiked: boolean
  category: 'update' | 'request' | 'offer' | 'announcement'
  resourceId: string | null
  resourceName: string | null
  resourceCategory: string | null
  maxSeekers: number | null
  slotsRemaining: number | null
  postType: 'feed' | 'resource_post' | 'petition'
  petitionId: string | null
  isHidden: boolean
}

/** An opt-in row enriched with the seeker's profile for the author's management list. */
interface EnrichedOptIn {
  id: string
  postId: string
  seekerId: string
  seekerName: string
  seekerHarmonyScore: number | null
  seekerHarmonyCount: number
  status: string
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
// SAFETY STRIP
// ============================================
// Alert-type icons and labels — mirrors safety-alert-marker.tsx constants
const STRIP_ALERT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  weather: Cloud,
  road_closure: Construction,
  speeding: Gauge,
  general: AlertTriangle,
}

const STRIP_ALERT_LABELS: Record<string, string> = {
  weather: 'Weather Hazard',
  road_closure: 'Road Closure',
  speeding: 'Speeding Area',
  general: 'Safety Alert',
}

interface SafetyStripProps {
  alerts: SafetyAlert[]
  onViewMap: () => void
}

function SafetyStrip({ alerts, onViewMap }: SafetyStripProps) {
  return (
    <div
      data-testid="safety-strip"
      className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          Active Alerts
        </div>
        <button
          data-testid="safety-strip-view-map"
          onClick={onViewMap}
          className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
        >
          View on map
        </button>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((alert) => {
          const Icon = STRIP_ALERT_ICONS[alert.alert_type] ?? AlertTriangle
          const label = STRIP_ALERT_LABELS[alert.alert_type] ?? 'Safety Alert'
          // Severity-scaled color: 1-2 amber, 3-4 red (matches safety-alert-marker.tsx)
          const isHigh = alert.severity >= 3
          return (
            <li
              key={alert.id}
              data-testid={`safety-strip-item-${alert.id}`}
              className="flex items-start gap-2 cursor-pointer group"
              onClick={onViewMap}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onViewMap()}
              aria-label={`${label} — tap to view on map`}
            >
              <span
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-semibold ${isHigh ? 'text-red-800' : 'text-amber-800'}`}>
                    {label}
                  </span>
                  {alert.status === 'pending' && (
                    <span className="text-[10px] text-stone-500 font-normal">
                      Unverified — neighbor report
                    </span>
                  )}
                </div>
                {alert.description && (
                  <p className="text-xs text-stone-700 line-clamp-1 mt-0.5">{alert.description}</p>
                )}
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {getRelativeTime(new Date(alert.created_at))}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
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
  /** Returns the new post id on success, or null on error */
  onPost: (
    content: string,
    resourceId: string | null,
    maxSeekers: number | null
  ) => Promise<string | null>
  resourceOptions: ResourceOption[]
  /** Navigates to the map panel to place a safety pin */
  onSafetyAlertClick: () => void
}

const GEO_RADIUS_OPTIONS = [5, 10, 25, 50] as const
type GeoRadius = typeof GEO_RADIUS_OPTIONS[number]

function CreatePostCard({ onPost, resourceOptions, onSafetyAlertClick }: CreatePostCardProps) {
  const supabase = createClient()
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [maxSeekersInput, setMaxSeekersInput] = useState<string>('')
  const [wizardOpen, setWizardOpen] = useState(false)

  // Geo-outreach state
  const [geoNotify, setGeoNotify] = useState(false)
  const [geoRadius, setGeoRadius] = useState<GeoRadius>(10)
  const [seekerCount, setSeekerCount] = useState<number | null>(null)
  const [seekerCountError, setSeekerCountError] = useState<string | null>(null)
  const [geoNotifyResult, setGeoNotifyResult] = useState<string | null>(null)
  const countAbortRef = useRef<AbortController | null>(null)

  const { execute: executeRateLimited, isLimited } = useRateLimitedAction({
    limiterType: 'formSubmit',
    onRateLimited: () => setError('Posting too quickly. Please wait a moment.'),
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
          setSeekerCountError(getFriendlyErrorMessage(rpcErr, 'Could not load seeker count.'))
        } else {
          setSeekerCount(typeof data === 'number' ? data : null)
        }
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return
        if (!isQueryTimeout(err)) {
          setSeekerCountError(getFriendlyErrorMessage(err, 'Could not load seeker count.'))
        }
      }
    }

    void fetchCount()

    return () => {
      ctrl.abort()
    }
  }, [geoNotify, selectedResourceId, geoRadius, supabase])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setError(null)
    setGeoNotifyResult(null)

    // Parse max_seekers — blank = unlimited (null)
    const maxSeekers =
      maxSeekersInput.trim() !== '' ? parseInt(maxSeekersInput, 10) : null
    if (maxSeekers !== null && (isNaN(maxSeekers) || maxSeekers <= 0)) {
      setError('Seeker limit must be a positive number.')
      return
    }

    const result = await executeRateLimited(async () => {
      const sanitizedContent = sanitizeInput(content)
      const resourceId = selectedResourceId || null
      const shouldNotify = geoNotify && !!resourceId
      const radiusSnapshot = geoRadius

      const newPostId = await onPost(sanitizedContent, resourceId, maxSeekers)
      setContent('')
      setSelectedResourceId('')
      setMaxSeekersInput('')
      setGeoNotify(false)
      setSeekerCount(null)

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
          setGeoNotifyResult(
            `Notified ${count} seeker${count !== 1 ? 's' : ''} within ${radiusSnapshot} mi.`
          )
        } catch (notifyEx: unknown) {
          logger.error('geo.notify.fanout', { error: String(notifyEx) })
          setGeoNotifyResult('Post shared. (Seeker notifications could not be sent.)')
        }
      }
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
      {geoNotifyResult && (
        <div
          className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700"
          data-testid="geo-notify-result"
        >
          {geoNotifyResult}
        </div>
      )}
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#4a5d23] flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>

        {/* Input, Resource Selector, and Send */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Post creation trigger */}
          <button
            type="button"
            data-testid="post-wizard-trigger"
            onClick={() => { setWizardOpen(true); track('wizard_open') }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-400 text-sm hover:border-[#4a5d23] hover:text-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-1"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4a5d23] flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </span>
            <span>Share an update, offer, request, or more…</span>
          </button>

          {/* Optional resource link selector */}
          {resourceOptions.length > 0 && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
                <LinkIcon className="w-3.5 h-3.5 text-stone-400" />
              </div>
              <select
                value={selectedResourceId}
                onChange={(e) => {
                  setSelectedResourceId(e.target.value)
                  setGeoNotify(false)
                  setSeekerCount(null)
                }}
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

          {/* Geo-outreach controls — shown only when a resource is linked */}
          {selectedResourceId && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Toggle */}
              <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={geoNotify}
                  data-testid="geo-outreach-toggle"
                  onClick={() => setGeoNotify((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-1 ${
                    geoNotify ? 'bg-[#4a5d23]' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      geoNotify ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <MapPin className="w-3.5 h-3.5" />
                Notify nearby seekers
              </label>

              {/* Radius selector */}
              {geoNotify && (
                <select
                  value={geoRadius}
                  onChange={(e) => setGeoRadius(Number(e.target.value) as GeoRadius)}
                  data-testid="geo-outreach-radius"
                  aria-label="Notification radius in miles"
                  className="appearance-none rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#4a5d23]"
                >
                  {GEO_RADIUS_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r} mi</option>
                  ))}
                </select>
              )}

              {/* Live seeker count */}
              {geoNotify && (
                <span
                  className="text-xs text-stone-500"
                  data-testid="geo-seeker-count"
                  aria-live="polite"
                >
                  {seekerCountError
                    ? seekerCountError
                    : seekerCount === null
                      ? 'Loading…'
                      : `${seekerCount} seeker${seekerCount !== 1 ? 's' : ''} within ${geoRadius} mi`}
                </span>
              )}
            </div>
          )}

          {/* Safety alert affordance — deep-links to map panel pin-placement flow */}
          <button
            type="button"
            data-testid="composer-safety-alert-btn"
            onClick={onSafetyAlertClick}
            className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 transition-colors pt-1"
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            Report a safety hazard on the map
          </button>

          {/* Post type wizard */}
          <PostTypeWizard
            open={wizardOpen}
            onClose={() => setWizardOpen(false)}
            onPost={onPost}
            resourceOptions={resourceOptions}
            onSafetyAlertClick={onSafetyAlertClick}
          />
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
  onEmbed: () => void
  embedCopied?: boolean
}

function PostReactions({ postId, likes, comments, isLiked, onLike, onComment, onShare, shareCopied, onEmbed, embedCopied }: PostReactionsProps) {
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
        className={`flex items-center gap-1.5 text-sm transition-colors ${shareCopied ? 'text-green-600' : 'text-muted-foreground hover:text-primary'}`}
        aria-label={shareCopied ? 'Link copied' : 'Share post'}
      >
        {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {shareCopied && <span className="text-xs font-medium">Copied</span>}
      </button>

      <button
        onClick={onEmbed}
        data-testid="embed-code-btn"
        className={`flex items-center gap-1.5 text-sm transition-colors ml-auto ${embedCopied ? 'text-green-600' : 'text-muted-foreground hover:text-primary'}`}
        aria-label={embedCopied ? 'Embed code copied' : 'Copy embed code'}
      >
        {embedCopied ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
        {embedCopied && <span className="text-xs font-medium">Embed copied</span>}
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
  /** opt-in id for the current user's seeker row (needed for review prompt) */
  currentUserOptInId?: string | null
  /** whether current user (seeker) has already reviewed this opt-in's sourcer */
  seekerHasReviewed?: boolean
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onEmbed: (postId: string) => void
  onOptIn: (postId: string) => void
  onWithdraw: (postId: string) => void
  onReviewSourcer?: (postId: string, optInId: string) => void
  optInError?: string | null
  shareCopied?: boolean
  embedCopied?: boolean
  optInCount?: number
  /** Enriched opt-in rows for the author's management list */
  authorOptIns?: EnrichedOptIn[]
  onAuthorUpdateOptIn?: (optInId: string, status: 'accepted' | 'declined' | 'completed') => void
  onAuthorReviewSeeker?: (optInId: string, seekerName: string) => void
  /** set of opt-in ids the author has already reviewed */
  authorReviewedOptInIds?: Set<string>
  /** whether the current user follows this post's author */
  isFollowingAuthor?: boolean
  /** follow/unfollow the post author — only passed when currentUserId != post.author.id */
  onFollow?: (authorId: string) => void
  onUnfollow?: (authorId: string) => void
  /** petition data for petition-type posts */
  petitionEmbed?: {
    title: string
    summary: string
    signatureCount: number
    targetSignatures: number
    hasSigned: boolean
    isSigning: boolean
  }
  onSignPetition?: (petitionId: string) => void
  onReport?: (postId: string, reason: string, details: string | null) => Promise<{ hidden: boolean }>
}

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abusive', label: 'Abusive content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'off_topic', label: 'Off topic' },
  { value: 'other', label: 'Other' },
]

function PostCard({
  post,
  currentUserId,
  optInStatus,
  currentUserOptInId,
  seekerHasReviewed,
  onLike,
  onComment,
  onShare,
  onEmbed,
  onOptIn,
  onWithdraw,
  onReviewSourcer,
  optInError,
  shareCopied,
  embedCopied,
  optInCount,
  authorOptIns,
  onAuthorUpdateOptIn,
  onAuthorReviewSeeker,
  authorReviewedOptInIds,
  isFollowingAuthor,
  onFollow,
  onUnfollow,
  petitionEmbed,
  onSignPetition,
  onReport,
}: PostCardProps) {
  const categoryColor = CATEGORY_COLORS[post.category]
  const isAuthor = currentUserId != null && post.author.id === currentUserId
  const isFull =
    post.maxSeekers != null &&
    post.slotsRemaining != null &&
    post.slotsRemaining <= 0

  const [optInListOpen, setOptInListOpen] = useState(false)

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportReason, setReportReason] = useState<string>('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [isHiddenLocally, setIsHiddenLocally] = useState(false)

  const handleReportSubmit = async () => {
    if (!reportReason || !onReport) return
    setReportSubmitting(true)
    setReportError(null)
    try {
      const result = await onReport(post.id, reportReason, reportDetails.trim() || null)
      setReportDone(true)
      if (result.hidden) {
        setIsHiddenLocally(true)
      }
      setTimeout(() => setReportDialogOpen(false), 1800)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setReportSubmitting(false)
    }
  }

  const showReviewSourcerBtn =
    !isAuthor &&
    optInStatus === 'completed' &&
    !seekerHasReviewed &&
    currentUserOptInId != null

  // Effective hidden state: either from DB (initial load) or from this session's report
  const effectivelyHidden = post.isHidden || isHiddenLocally

  // Non-author sees a hidden post only transiently (local state for immediate feedback);
  // the RLS policy already excludes DB-hidden posts from non-authors on the next fetch.
  if (effectivelyHidden && !isAuthor) {
    return null
  }

  return (
    <div
      className={`p-4 rounded-xl bg-[#faf9f6] border transition-all ${
        effectivelyHidden
          ? 'border-orange-200 opacity-70'
          : 'border-stone-200 hover:border-primary/30'
      }`}
    >
      {/* Hidden-pending-review banner — shown to post author only */}
      {effectivelyHidden && isAuthor && (
        <div className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs font-medium text-orange-700">
          Hidden pending review — only you can see this post right now.
        </div>
      )}

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
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-medium text-sm truncate">{post.author.name}</h3>
            <HarmonyBadge
              score={post.author.harmonyScore}
              count={post.author.harmonyReviewsCount}
              userId={post.author.id}
            />
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

        {/* Follow/Following toggle — only shown for other authors when authenticated */}
        {currentUserId != null && !isAuthor && onFollow && onUnfollow && (
          <button
            data-testid={`follow-btn-${post.author.id}`}
            onClick={() =>
              isFollowingAuthor ? onUnfollow(post.author.id) : onFollow(post.author.id)
            }
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              isFollowingAuthor
                ? 'bg-stone-100 border-stone-300 text-stone-600 hover:bg-stone-200'
                : 'bg-lime-50 border-lime-300 text-lime-700 hover:bg-lime-100'
            }`}
            aria-label={isFollowingAuthor ? `Unfollow ${post.author.name}` : `Follow ${post.author.name}`}
          >
            {isFollowingAuthor ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed mb-3">{post.content}</p>

      {/* Resource chip — shown when the post is linked to a resource */}
      {post.resourceId && post.resourceName && (
        <div className="flex items-center flex-wrap gap-1.5 mb-3">
          <div
            data-testid={`resource-chip-${post.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime-50 border border-lime-200 text-xs font-medium text-lime-700"
          >
            <LinkIcon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[180px]">{post.resourceName}</span>
          </div>
          {/* Category badge — distinct visual from the resource link chip */}
          {post.resourceCategory && (
            <span
              data-testid={`category-badge-${post.id}`}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getCategoryTailwind(post.resourceCategory)}`}
            >
              {getCategoryLabel(post.resourceCategory)}
            </span>
          )}
        </div>
      )}

      {/* Petition embed card — shown on petition-type posts */}
      {post.postType === 'petition' && petitionEmbed && (
        <div
          data-testid={`petition-embed-${post.id}`}
          className="mb-3 rounded-xl border border-lime-200 bg-lime-50/60 p-3 flex flex-col gap-2"
        >
          <div className="flex items-center gap-1.5">
            <ScrollText className="w-3.5 h-3.5 text-lime-700 flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-lime-800 uppercase tracking-wide">Petition</span>
          </div>
          <p className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
            {petitionEmbed.title}
          </p>
          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
            {petitionEmbed.summary}
          </p>
          <div className="text-xs text-stone-600">
            <span className="font-semibold text-stone-800">{petitionEmbed.signatureCount.toLocaleString()}</span>
            {petitionEmbed.targetSignatures > 0 && (
              <> of {petitionEmbed.targetSignatures.toLocaleString()} signatures</>
            )}
          </div>
          {petitionEmbed.hasSigned ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-lime-800">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              Signed
            </div>
          ) : (
            <button
              data-testid={`petition-sign-btn-${post.id}`}
              onClick={() => post.petitionId && onSignPetition?.(post.petitionId)}
              disabled={petitionEmbed.isSigning}
              className="w-full text-xs font-semibold bg-lime-700 hover:bg-lime-800 disabled:opacity-60 text-white rounded-lg py-1.5 px-3 transition-colors flex items-center justify-center gap-1.5"
            >
              {petitionEmbed.isSigning ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : null}
              Add your verified signature of support
            </button>
          )}
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

          {/* Author view: expandable opt-in count */}
          {isAuthor ? (
            <button
              data-testid={`opt-in-manage-${post.id}`}
              onClick={() => setOptInListOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-lime-700 hover:text-lime-900 transition-colors"
            >
              {optInCount ?? 0} opted in
              {optInListOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
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

      {/* Author's expandable opt-in management list */}
      {isAuthor && optInListOpen && authorOptIns && authorOptIns.length > 0 && (
        <div className="mb-3 border border-stone-200 rounded-lg divide-y divide-stone-100 bg-white">
          {authorOptIns.map((oi) => (
            <div key={oi.id} className="px-3 py-2 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <User className="w-3 h-3 text-stone-400 flex-shrink-0" />
                <span className="text-xs font-medium text-stone-700 truncate">
                  {oi.seekerName}
                </span>
                <HarmonyBadge
                  score={oi.seekerHarmonyScore}
                  count={oi.seekerHarmonyCount}
                  userId={oi.seekerId}
                />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  oi.status === 'completed' ? 'bg-lime-100 text-lime-700' :
                  oi.status === 'accepted'  ? 'bg-blue-100 text-blue-700' :
                  oi.status === 'declined'  ? 'bg-red-100 text-red-600' :
                  'bg-stone-100 text-stone-600'
                }`}>
                  {oi.status}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {oi.status === 'pending' && (
                  <>
                    <button
                      data-testid={`accept-optin-${oi.id}`}
                      onClick={() => onAuthorUpdateOptIn?.(oi.id, 'accepted')}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-lime-600 text-white hover:bg-lime-700 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      data-testid={`decline-optin-${oi.id}`}
                      onClick={() => onAuthorUpdateOptIn?.(oi.id, 'declined')}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors"
                    >
                      Decline
                    </button>
                  </>
                )}
                {oi.status === 'accepted' && (
                  <button
                    data-testid={`complete-optin-${oi.id}`}
                    onClick={() => onAuthorUpdateOptIn?.(oi.id, 'completed')}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Mark Completed
                  </button>
                )}
                {oi.status === 'completed' && !authorReviewedOptInIds?.has(oi.id) && (
                  <button
                    onClick={() => onAuthorReviewSeeker?.(oi.id, oi.seekerName)}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    <Star className="w-2.5 h-2.5" />
                    Review seeker
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Seeker: review sourcer prompt when exchange is completed and not yet reviewed */}
      {showReviewSourcerBtn && (
        <div className="mb-3">
          <button
            data-testid={`review-sourcer-${post.id}`}
            onClick={() => onReviewSourcer?.(post.id, currentUserOptInId!)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <Star className="w-3 h-3" />
            Review sourcer
          </button>
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
        onEmbed={() => onEmbed(post.id)}
        embedCopied={embedCopied}
      />

      {/* Report post — only shown to non-authors when authenticated */}
      {currentUserId != null && !isAuthor && onReport && (
        <div className="mt-2 flex justify-end">
          <button
            data-testid={`report-btn-${post.id}`}
            onClick={() => {
              setReportReason('')
              setReportDetails('')
              setReportDone(false)
              setReportError(null)
              setReportDialogOpen(true)
            }}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-orange-500 transition-colors"
            aria-label="Report post"
          >
            <Flag className="w-3 h-3" />
            Report
          </button>
        </div>
      )}

      {/* Report dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report this post</DialogTitle>
          </DialogHeader>

          {reportDone ? (
            <div className="py-4 text-center text-sm text-stone-700">
              Thanks — your report helps keep the community safe.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor={`report-reason-${post.id}`}>Reason</Label>
                <Select value={reportReason} onValueChange={setReportReason}>
                  <SelectTrigger id={`report-reason-${post.id}`} data-testid={`report-reason-select-${post.id}`}>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`report-details-${post.id}`}>
                  Additional details{' '}
                  <span className="text-stone-600 font-normal">(optional)</span>
                </Label>
                <Textarea
                  id={`report-details-${post.id}`}
                  data-testid={`report-details-${post.id}`}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  maxLength={1000}
                  placeholder="Describe the issue..."
                  className="resize-none text-stone-900 placeholder:text-stone-400"
                  rows={3}
                />
                <p className="text-xs text-stone-600 text-right">
                  {reportDetails.length}/1000
                </p>
              </div>

              {reportError && (
                <p className="text-sm text-destructive">{reportError}</p>
              )}
            </div>
          )}

          {!reportDone && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReportDialogOpen(false)}
                disabled={reportSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReportSubmit}
                disabled={!reportReason || reportSubmitting}
                data-testid={`report-submit-${post.id}`}
              >
                {reportSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Submit report
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [paginationCursor, setPaginationCursor] = useState<{ createdAt: string; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
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
  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewModalOptInId, setReviewModalOptInId] = useState<string | null>(null)
  const [reviewModalRevieweeName, setReviewModalRevieweeName] = useState('')
  const [reviewModalRevieweeRole, setReviewModalRevieweeRole] = useState('')

  const { user, isAuthenticated, isAnonymous, loading: authLoading } = useAuth()
  const supabase = createClient()
  const { panelParams, setActivePanel, setPanelParams } = usePanelContext()
  // Saved resources for the resource-link selector in the composer
  const { savedResources } = useSavedResources()
  const resourceOptions: ResourceOption[] = savedResources
    .filter((r) => r.resource_id != null)
    .map((r) => ({ id: r.resource_id as string, name: r.resource_name }))
  const { fetchOptInsForPosts, optIn: doOptIn, withdrawOptIn: doWithdraw } = useOptIns()
  const { fetchMyReviewsForOptIns } = useReviews()
  const { followingIds, fetchFollowing, follow: doFollow, unfollow: doUnfollow, error: followError } = useFollows()
  const { petitions: petitionsList, sign: signPetition, signingId: signingPetitionId } = usePetitions()

  // Resolve active subtab from panelParams (set by alias routing in feed-shell)
  const activeSubtab: 'feed' | 'events' | 'petitions' | 'messages' =
    panelParams?.subtab === 'messages' ? 'messages'
    : panelParams?.subtab === 'events' ? 'events'
    : panelParams?.subtab === 'petitions' ? 'petitions'
    : 'feed'

  // Sync subtab when panelParams.subtab changes (e.g. back-button hash navigation)
  // No local state needed — activeSubtab is derived directly from panelParams.

  // Tab switch handler: drives via setActivePanel alias path so hash + state
  // stay in sync through one code path. replaceState — no back-button spam.
  const handleSubtabSwitch = useCallback((tab: 'feed' | 'events' | 'petitions' | 'messages') => {
    logger.info('nav.subtab.switch', { panel: 'feed', subtab: tab })
    track('nav_subtab', { panel: 'feed', subtab: tab })
    if (tab === 'messages') {
      setActivePanel('messages')
    } else if (tab === 'events') {
      // events resolves via PANEL_ALIAS to feed+subtab='events'
      setActivePanel('events')
    } else if (tab === 'petitions') {
      // petitions resolves via PANEL_ALIAS to feed+subtab='petitions'
      setActivePanel('petitions')
    } else {
      setActivePanel('feed')
    }
  }, [setActivePanel, setPanelParams])

  // ARIA roving tabindex keyboard handler for the Feed tablist
  const handleFeedTabKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    const tabs: Array<'feed' | 'events' | 'petitions' | 'messages'> = ['feed', 'events', 'petitions', 'messages']
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

  // ── Pagination constants ────────────────────────────────────────────────────
  // Keyset pagination uses (created_at, id) for a stable cursor. is_pinned desc
  // ordering complicates a pure keyset — the simplest correct approach is to sort
  // pinned posts client-side within the already-loaded set (pinned-first applies
  // to the visible list, not across page boundaries). Each page fetches 25 rows
  // ordered by created_at desc, id desc. The realtime prepend path dedupes by id
  // so new posts don't duplicate rows already paged in.
  const PAGE_SIZE = 25

  // Fetch posts from Supabase
  // When cursor is provided, fetches the NEXT page after that cursor position.
  // When cursor is null, fetches the first page.
  const fetchPosts = useCallback(async (cursor: { createdAt: string; id: string } | null = null) => {
    if (cursor === null) {
      setLoading(true)
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
        .select('*, user:profiles!posts_user_id_fkey(id, first_name, avatar_url, is_staff, harmony_score, harmony_reviews_count), resource:resources(id, name, category)')
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

        // Fetch likes, my-likes, comments, and opt-in counts in parallel.
        // Each secondary query carries an AbortSignal so they can't block the
        // finally block indefinitely if the connection stalls mid-fetch.
        const secondarySignal = AbortSignal.timeout(QUERY_TIMEOUT_MS)
        const [likesResult, myLikesResult, commentsResult, optInResult] =
          await Promise.all([
            supabase.from('post_likes').select('post_id').in('post_id', postIds).abortSignal(secondarySignal) as unknown as Promise<QueryResult>,
            user
              ? supabase
                  .from('post_likes')
                  .select('post_id')
                  .in('post_id', postIds)
                  .eq('user_id', user.id)
                  .abortSignal(secondarySignal) as unknown as Promise<QueryResult>
              : Promise.resolve({ data: [] as PostIdRow[] }),
            supabase
              .from('post_comments')
              .select('post_id')
              .in('post_id', postIds)
              .eq('is_hidden', false)
              .abortSignal(secondarySignal) as unknown as Promise<QueryResult>,
            cappedPostIds.length > 0
              ? supabase
                  .from('resource_opt_ins')
                  .select('post_id')
                  .in('post_id', cappedPostIds)
                  .abortSignal(secondarySignal) as unknown as Promise<QueryResult>
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
          name: row.user?.first_name || 'Anonymous',
          avatar: row.user?.avatar_url || undefined,
          role: row.user?.is_staff ? 'Admin' : 'Community Member',
          harmonyScore: (row.user as { harmony_score?: number | null } | undefined)?.harmony_score ?? null,
          harmonyReviewsCount: (row.user as { harmony_reviews_count?: number | null } | undefined)?.harmony_reviews_count ?? 0,
        },
        content: row.content,
        timestamp: new Date(row.created_at ?? Date.now()),
        likes: likeCounts[row.id] || 0,
        comments: commentCounts[row.id] || 0,
        isLiked: userLikes.has(row.id),
        category: row.is_pinned ? 'announcement' : 'update',
        resourceId: row.resource?.id ?? null,
        resourceName: row.resource?.name ?? null,
        resourceCategory: (row.resource as { category?: string | null } | null)?.category ?? null,
        maxSeekers: row.max_seekers ?? null,
        slotsRemaining: row.slots_remaining ?? null,
        postType: (row.post_type as 'feed' | 'resource_post' | 'petition') ?? 'feed',
        petitionId: (row as { petition_id?: string | null }).petition_id ?? null,
        isHidden: (row as { is_hidden?: boolean }).is_hidden ?? false,
      }))

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

      // Fetch this user's opt-in statuses + seeker opt-in rows + author opt-in lists
      if (user && postIds.length > 0) {
        fetchOptInsForPosts(postIds).then(setOptInMap)

        // Fetch full seeker opt-in rows (for review prompts and author management)
        supabase
          .from('resource_opt_ins')
          .select('id, post_id, seeker_id, status, seeker:profiles!resource_opt_ins_seeker_id_fkey(id, first_name, harmony_score, harmony_reviews_count)')
          .in('post_id', postIds)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
          .then(({ data: oisData }) => {
            if (!oisData) return

            // Map post_id → seeker opt-in id for the current user (seeker view)
            const seekerIds: Record<string, string> = {}
            // Map post_id → enriched list for the author view
            const authorMap: Record<string, EnrichedOptIn[]> = {}

            for (const oi of oisData) {
              if (oi.seeker_id === user.id) {
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
            setSeekerOptInIds(seekerIds)
            setAuthorOptInsMap(authorMap)

            // Fetch reviews the current user has submitted (seeker+author directions)
            const allOptInIds = oisData.map((oi) => oi.id)
            if (allOptInIds.length > 0) {
              fetchMyReviewsForOptIns(allOptInIds).then((reviewMap) => {
                setMyReviewMap(reviewMap)
                // Build the set of opt-in ids the current user has reviewed (for author side)
                setAuthorReviewedSet(new Set(reviewMap.keys()))
              })
            }
          })
      }
      })()])
    } catch (err: unknown) {
      const msg = (isQueryTimeout(err) || (err instanceof DOMException && err.name === 'TimeoutError'))
        ? 'Feed timed out — please check your connection and retry.'
        : err instanceof Error ? err.message : String(err)
      console.error('Error fetching posts:', msg, err)
      setError(msg)
    } finally {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle)
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase, user, fetchOptInsForPosts])

  // Initial fetch
  useEffect(() => {
    fetchPosts(null)
  }, [fetchPosts])

  // Load following ids on mount (and when auth resolves)
  useEffect(() => {
    if (!authLoading) {
      fetchFollowing()
    }
  }, [authLoading, fetchFollowing])

  // Real-time updates: a new post arrives — prepend it to the existing list.
  // Deduplication in the paginated append path prevents double-rendering if the
  // same post later appears in a Load More page.
  useRealtimeFeed({
    onInsert: (newPost) => {
      // State updater: only derive new state — no side effects inside the updater
      // because React may call it multiple times (StrictMode double-invocation).
      setPosts((prev) => {
        // Dedupe: skip if already present (e.g. optimistic insert from this session)
        if (prev.some((p) => p.id === newPost.id)) return prev
        const hydrated: Post = {
          id: newPost.id,
          author: { id: '', name: 'Loading…', role: '', harmonyScore: null, harmonyReviewsCount: 0 },
          content: newPost.content,
          timestamp: new Date(newPost.created_at),
          likes: 0,
          comments: 0,
          isLiked: false,
          category: newPost.is_pinned ? 'announcement' : 'update',
          resourceId: null,
          resourceName: null,
          resourceCategory: null,
          maxSeekers: null,
          slotsRemaining: null,
          postType: 'feed',
          petitionId: null,
          isHidden: newPost.is_hidden,
        }
        return [hydrated, ...prev]
      })
    },
    onUpdate: () => fetchPosts(null),
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
          .select('id, alert_type, severity, description, created_at, expires_at, status, confirm_count, clear_count, created_by')
          .gt('expires_at', new Date().toISOString())
          .order('severity', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5)
          .abortSignal(ctrl.signal)
        if (ctrl.signal.aborted) return
        // Safety alerts from the table do not have lng/lat pre-decomposed —
        // the location column is PostGIS geography. For the feed strip we only
        // need metadata (type, severity, description, times), not coordinates.
        // Cast to partial type; map-navigation does not need coords here.
        setSafetyAlerts((data ?? []) as SafetyAlert[])
      } catch {
        /* non-critical; strip hides gracefully on error */
      }
    })()
    return () => ctrl.abort()
  }, [isAuthenticated, supabase])

  // ── Load more ────────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!paginationCursor || loadingMore) return
    fetchPosts(paginationCursor)
  }, [paginationCursor, loadingMore, fetchPosts])

  const handleCreatePost = async (
    content: string,
    resourceId: string | null,
    maxSeekers: number | null
  ): Promise<string | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content,
          resource_id: resourceId ?? null,
          max_seekers: maxSeekers ?? null,
        })
        .select('id')
        .single()

      if (error) throw error
      // Real-time subscription will handle adding the post to the feed
      return data?.id ?? null
    } catch (err) {
      console.error('Error creating post:', err)
      return null
    }
  }

  const handleOptIn = async (postId: string) => {
    if (isAnonymous) {
      // Server would reject this anyway (RESTRICTIVE policy). Surface friendly error.
      setOptInErrors((prev) => ({ ...prev, [postId]: 'Create a free account to opt in.' }))
      return
    }
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

  // Author updates an opt-in status (accept / decline / complete)
  const handleAuthorUpdateOptIn = async (
    optInId: string,
    status: 'accepted' | 'declined' | 'completed'
  ) => {
    try {
      const { error: updErr } = await supabase
        .from('resource_opt_ins')
        .update({ status })
        .eq('id', optInId)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      if (updErr) throw updErr
      // Refresh post data so the management list and seeker view stay in sync
      fetchPosts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update opt-in.'
      logger.error('feed.optin.update', { error: msg })
    }
  }

  // Author opens review modal for a specific seeker
  const handleAuthorReviewSeeker = (optInId: string, seekerName: string) => {
    setReviewModalOptInId(optInId)
    setReviewModalRevieweeName(seekerName)
    setReviewModalRevieweeRole('seeker')
    setReviewModalOpen(true)
  }

  // Seeker opens review modal for the sourcer
  const handleReviewSourcer = (_postId: string, optInId: string) => {
    const post = posts.find((p) => p.id === _postId)
    setReviewModalOptInId(optInId)
    setReviewModalRevieweeName(post?.author.name ?? 'Sourcer')
    setReviewModalRevieweeRole('sourcer')
    setReviewModalOpen(true)
  }

  // After a review is submitted — refresh data
  const handleReviewSubmitted = () => {
    fetchPosts()
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

  // Submit a content report via SECDEF RPC
  const handleReport = async (
    postId: string,
    reason: string,
    details: string | null
  ): Promise<{ hidden: boolean }> => {
    type ReportReason = 'spam' | 'abusive' | 'harassment' | 'misinformation' | 'illegal' | 'off_topic' | 'other'
    const { data, error } = await supabase.rpc('submit_content_report', {
      p_content_type: 'post',
      p_content_id: postId,
      p_reason: reason as ReportReason,
      p_details: details ?? undefined,
    })
    if (error) throw new Error(getFriendlyErrorMessage(error))
    const result = data as { report_count: number; hidden: boolean }
    if (result.hidden) {
      // Remove hidden post from the feed list for non-authors
      // (PostCard itself will handle the author's own hidden post with a badge)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, isHidden: true } : p
        )
      )
    }
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

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'announcements') return post.category === 'announcement'
    if (activeFilter === 'mine') return user != null && post.author.id === user.id
    if (activeFilter === 'following') return user != null && followingIds.has(post.author.id)
    return true
  })

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
      />
    )}
    <div className="h-full flex flex-col">
      {/* Top-level tablist: Feed | Messages
          Styled DISTINCT from FeedHeader's rounded-full filter pills:
          py-2.5 font-semibold border-b — per NN/g 2-level tab differentiation */}
      <div
        role="tablist"
        aria-label="Community sections"
        className="flex border-b border-stone-200 mb-0 overflow-x-auto"
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
          Feed
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
          Events
        </button>
        <button
          role="tab"
          id="feed-tab-petitions"
          aria-selected={activeSubtab === 'petitions'}
          aria-controls="feed-panel-petitions"
          tabIndex={activeSubtab === 'petitions' ? 0 : -1}
          onClick={() => handleSubtabSwitch('petitions')}
          onKeyDown={(e) => handleFeedTabKeyDown(e, 2)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            activeSubtab === 'petitions'
              ? 'border-[#4a5d23] text-[#4a5d23]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Petitions
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
          onKeyDown={(e) => handleFeedTabKeyDown(e, 3)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
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
      ) : activeSubtab === 'events' ? (
        <div
          role="tabpanel"
          id="feed-panel-events"
          aria-labelledby="feed-tab-events"
          tabIndex={0}
          className="flex-1 overflow-y-auto p-1"
        >
          <EventsPanel />
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
          <FeedHeader activeFilter={activeFilter} onFilterChange={setActiveFilter} />

          {/* Create Post Card — full users only; guests see account prompt */}
          {isAuthenticated && !isAnonymous && (
            <CreatePostCard
              onPost={handleCreatePost}
              resourceOptions={resourceOptions}
              onSafetyAlertClick={() => {
                setPanelParams((prev) => ({ ...prev, openSafetyReport: true }))
                setActivePanel('map')
              }}
            />
          )}
          {isAnonymous && (
            <div className="mb-3">
              <CreateAccountPrompt message="Create a free account to post and interact with the community" />
            </div>
          )}


          {/* Follow/unfollow error banner */}
          {followError && (
            <div
              role="alert"
              className="mx-2 mt-1 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md"
            >
              {followError}
            </div>
          )}

          {/* Safety alerts strip — active alerts (expires_at > now), max 5.
              Tap any card to navigate to the map panel for full details + voting. */}
          {safetyAlerts.length > 0 && (
            <SafetyStrip
              alerts={safetyAlerts}
              onViewMap={() => setActivePanel('map')}
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
              filteredPosts.map((post) => {
                const seekerOptInId = seekerOptInIds[post.id] ?? null
                const seekerHasReviewed =
                  seekerOptInId != null && myReviewMap.has(seekerOptInId)
                // optInMap is the single source of truth for the current user's opt-in status.
                // fetchOptInsForPosts returns all statuses (pending/accepted/completed/declined)
                // with no filter, so this correctly clears to undefined after a withdraw.
                const postOptInStatus = optInMap.get(post.id)

                return (
                  <div key={post.id} data-testid={`post-${post.id}`}>
                    <PostCard
                      post={post}
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
                      authorReviewedOptInIds={authorReviewedSet}
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
                      onReport={user ? handleReport : undefined}
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
                )
              })
            )}

            {/* Load More — only shown when there are more pages and the feed has loaded */}
            {!loading && !error && hasMore && (
              <div className="pt-2 pb-4 flex justify-center">
                <button
                  data-testid="feed-load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 rounded-full text-sm font-medium bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700 disabled:opacity-60 flex items-center gap-2 transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    'Load more posts'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
