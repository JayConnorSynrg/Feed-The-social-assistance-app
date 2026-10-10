'use client'

// apps/web/src/components/feed/feed-post-card.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One community-feed post card (moved out of feed-panel.tsx so it can be rendered and tested on its
// own). An <article> named by a visually hidden heading; the author's text is rendered as React text
// (raw storage, React escapes) with dir="auto" and its line breaks kept; the type body comes from the
// post-type registry (post-type-body.tsx). Edit state: an "Edited" button (accessible name "Edited
// <time>. View edit history") opens the public history. Actions: the ⋯ menu (post-card-actions.tsx —
// edit, history, copy link, report or the create-account prompt, delete, and for moderators hold /
// remove / restore / Edit in admin). Chrome is translated (lib/i18n-feed-card.ts).

import React, { useId, useState } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { Heart, MessageCircle, Share2, Code, User, Loader2, Check, Link as LinkIcon, ChevronDown, ChevronUp, Star, ScrollText, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n-event-forms'
import { browserTimeZone, dateTimeFormat } from '@/lib/event-time'
import { cardT, roleLabel, categoryChipLabel } from '@/lib/i18n-feed-card'
import { getCategoryTailwind } from '@/lib/resource-categories'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { resolveFollowGate } from '@/lib/follow-gate'
import { likeTap } from './feed-motion'
import { PostTypeBody } from './post-type-body'
import { postCardFrameClass } from './post-card-frame'
import { HarmonyBadge } from './harmony-badge'
import { AuthorBadgeStrip } from '@/components/appreciation/author-badge-strip'
import { AppreciationSheet } from '@/components/appreciation/appreciation-sheet'
import { PostCardActions } from './post-card-actions'
import { postMenuItems, type ActionViewer, type PostMenuItemId } from './post-actions'
import type { Post } from './post-model'

/** An opt-in row enriched with the seeker's profile for the author's management list. */
export interface EnrichedOptIn {
  id: string
  postId: string
  seekerId: string
  seekerName: string
  seekerHarmonyScore: number | null
  seekerHarmonyCount: number
  status: string
}

const CATEGORY_COLORS: Record<Post['category'], string> = {
  announcement: 'bg-blue-100 text-blue-800',
  request: 'bg-orange-100 text-orange-800',
  offer: 'bg-green-100 text-green-800',
  update: 'bg-gray-100 text-gray-800',
}

/** "Oct 9, 2026, 9:53 PM" in the viewer's language and zone (the Edited label's accessible name). */
export function formatEditedTime(date: Date, locale: Locale, tz: string = browserTimeZone()): string {
  return dateTimeFormat(locale, tz, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

// ============================================
// POST REACTIONS
// ============================================
interface PostReactionsProps {
  postId: string
  likes: number
  comments: number
  isLiked: boolean
  commentsOpen: boolean
  onLike: () => void
  onComment: () => void
  onShare: () => void
  shareCopied?: boolean
  onEmbed: () => void
  embedCopied?: boolean
  /** reduced-motion flag from the parent card; skips the like scale pop when set */
  reduce?: boolean | null
  locale: Locale
}

export function PostReactions({ postId, likes, comments, isLiked, commentsOpen, onLike, onComment, onShare, shareCopied, onEmbed, embedCopied, reduce, locale }: PostReactionsProps) {
  // One-shot Heart pop when the user likes (fired from the click handler on the unliked→liked
  // transition only); reduced motion skips it — the fill still changes.
  const [pop, setPop] = useState(0)
  const handleLikeClick = () => {
    if (!isLiked && !reduce) setPop((p) => p + 1)
    onLike()
  }

  return (
    <div className="flex items-center gap-4 border-t border-stone-200 pt-3">
      {/* Name "Like <count>" (the visible count is part of it, 2.5.3); aria-pressed carries the state. */}
      <m.button
        type="button"
        onClick={handleLikeClick}
        whileTap={likeTap(reduce ?? null)}
        aria-pressed={isLiked}
        data-testid={`like-btn-${postId}`}
        className={`flex items-center gap-1.5 text-sm transition-colors ${isLiked ? 'text-red-700' : 'text-stone-600 hover:text-red-700'}`}
      >
        <m.span
          key={pop}
          initial={pop === 0 ? false : { scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
          className="inline-flex"
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-700' : ''}`} aria-hidden="true" />
        </m.span>
        <span className="sr-only">{cardT(locale, 'like')}</span>
        <span className="font-medium">{likes}</span>
      </m.button>

      <button
        type="button"
        onClick={onComment}
        data-testid={`comment-btn-${postId}`}
        aria-expanded={commentsOpen}
        className="flex items-center gap-1.5 text-sm text-stone-600 transition-colors hover:text-primary"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{cardT(locale, 'comments')}</span>
        <span className="font-medium">{comments}</span>
      </button>

      <button
        type="button"
        onClick={onShare}
        className={`flex items-center gap-1.5 text-sm transition-colors ${shareCopied ? 'text-green-800' : 'text-stone-600 hover:text-primary'}`}
        aria-label={shareCopied ? cardT(locale, 'linkCopied') : cardT(locale, 'sharePost')}
      >
        {shareCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
        {shareCopied && <span className="text-xs font-medium">{cardT(locale, 'copied')}</span>}
      </button>

      <button
        type="button"
        onClick={onEmbed}
        data-testid="embed-code-btn"
        className={`ms-auto flex items-center gap-1.5 text-sm transition-colors ${embedCopied ? 'text-green-800' : 'text-stone-600 hover:text-primary'}`}
        aria-label={embedCopied ? cardT(locale, 'embedCopied') : cardT(locale, 'copyEmbed')}
      >
        {embedCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Code className="h-4 w-4" aria-hidden="true" />}
        {embedCopied && <span className="text-xs font-medium">{cardT(locale, 'embedCopiedShort')}</span>}
      </button>
    </div>
  )
}

// ============================================
// POST CARD
// ============================================
export interface FeedPostCardProps {
  post: Post
  locale: Locale
  /** Relative time of the post ("5m ago") — the feed's shared formatter. */
  formatAge: (date: Date) => string
  /** Who is looking (id, guest, admin tier) — decides the actions offered. */
  viewer: ActionViewer
  currentUserId: string | null
  optInStatus: string | undefined
  currentUserOptInId?: string | null
  seekerHasReviewed?: boolean
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  commentsOpen?: boolean
  onShare: (postId: string) => void
  onEmbed: (postId: string) => void
  onOptIn: (postId: string) => void
  onWithdraw: (postId: string) => void
  onReviewSourcer?: (postId: string, optInId: string) => void
  optInError?: string | null
  shareCopied?: boolean
  embedCopied?: boolean
  optInCount?: number
  authorOptIns?: EnrichedOptIn[]
  onAuthorUpdateOptIn?: (optInId: string, status: 'accepted' | 'declined' | 'completed') => void
  onAuthorReviewSeeker?: (optInId: string, seekerName: string) => void
  onAuthorUnblockOptIn?: (optInId: string) => void
  authorReviewedOptInIds?: Set<string>
  authorDeclinedSeekerIds?: Set<string>
  currentUserIsGuest?: boolean
  isFollowingAuthor?: boolean
  onFollow?: (authorId: string) => void
  onUnfollow?: (authorId: string) => void
  petitionEmbed?: {
    title: string
    summary: string
    signatureCount: number
    targetSignatures: number
    hasSigned: boolean
    isSigning: boolean
  }
  onSignPetition?: (petitionId: string) => void
  /** A card action (menu item, "Edited", footer Report); `trigger` is where focus returns. */
  onAction: (post: Post, id: PostMenuItemId, trigger: HTMLElement | null) => void
}

export function FeedPostCard({
  post,
  locale,
  formatAge,
  viewer,
  currentUserId,
  optInStatus,
  currentUserOptInId,
  seekerHasReviewed,
  onLike,
  onComment,
  commentsOpen = false,
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
  onAuthorUnblockOptIn,
  authorReviewedOptInIds,
  authorDeclinedSeekerIds,
  currentUserIsGuest,
  isFollowingAuthor,
  onFollow,
  onUnfollow,
  petitionEmbed,
  onSignPetition,
  onAction,
}: FeedPostCardProps) {
  const reduce = useReducedMotion()
  const headingId = useId()
  const categoryColor = CATEGORY_COLORS[post.category]
  const isAuthor = currentUserId != null && post.author.id === currentUserId
  // Follow affordance decision (shared with the author profile sheet). A guest resolves to
  // 'guest-prompt' so a tap opens the account prompt instead of a refused follows insert.
  const followGate = resolveFollowGate({
    currentUserId,
    authorId: post.author.id,
    isGuest: currentUserIsGuest === true,
    hasHandlers: !!onFollow && !!onUnfollow,
  })
  const isFull = post.maxSeekers != null && post.slotsRemaining != null && post.slotsRemaining <= 0

  const [optInListOpen, setOptInListOpen] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)

  const showReviewSourcerBtn = !isAuthor && optInStatus === 'completed' && !seekerHasReviewed && currentUserOptInId != null

  // A hidden post is readable only by its author (and staff, who do not keep it in the feed).
  if (post.isHidden && !isAuthor) return null

  const authorName = post.author.name
  const items = postMenuItems(viewer, {
    id: post.id,
    authorId: post.author.id,
    postType: post.postType,
    isHidden: post.isHidden,
    hiddenReason: post.hiddenReason,
    editedAt: post.editedAt,
  })

  return (
    <article aria-labelledby={headingId} tabIndex={-1} className={`${postCardFrameClass(post.isHidden)} focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#4a5d23]`} data-testid={`post-card-${post.id}`}>
      <h3 id={headingId} className="sr-only">
        {formatMessage(cardT(locale, 'postHeading'), { name: authorName })}
      </h3>
      {/* Hidden banner — shown to the post's author only. */}
      {post.isHidden && isAuthor && (
        <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-900" data-testid={`post-hidden-banner-${post.id}`}>
          {cardT(locale, post.hiddenReason === 'admin_removal' ? 'removedBanner' : 'hiddenBanner')}
        </div>
      )}

      {/* Author Row — holds the ⋯ menu, so it keeps full contrast on the author's hidden post
          (post-card-frame dims every child but [data-card-actions]). */}
      <div data-card-actions="" className="mb-3 flex items-start gap-3">
        <button
          type="button"
          onClick={() => setProfileSheetOpen(true)}
          aria-label={formatMessage(cardT(locale, 'viewProfile'), { name: authorName })}
          data-testid={`author-open-${post.author.id}`}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4a5d23] focus:outline-hidden focus:ring-2 focus:ring-lime-700"
        >
          {post.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatar} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <User className="h-5 w-5 text-white" aria-hidden="true" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileSheetOpen(true)}
              className="truncate text-sm font-medium hover:underline focus:underline focus:outline-hidden"
              data-testid={`author-name-${post.author.id}`}
              dir="auto"
            >
              {authorName}
            </button>
            {/* Each badge marks its own (English-only) root lang="en" dir="ltr". */}
            <HarmonyBadge score={post.author.harmonyScore} count={post.author.harmonyReviewsCount} userId={post.author.id} />
            <AuthorBadgeStrip summary={post.author.badgeSummary} userId={post.author.id} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor}`}>{categoryChipLabel(post.category, locale)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span>{roleLabel(post.author.authorTier ?? null, locale)}</span>
            <span aria-hidden="true">•</span>
            <time dateTime={post.timestamp.toISOString()}>{formatAge(post.timestamp)}</time>
            {post.editedAt && (
              <>
                <span aria-hidden="true">•</span>
                <button
                  type="button"
                  data-testid={`post-edited-${post.id}`}
                  aria-label={formatMessage(cardT(locale, 'editedAria'), { time: formatEditedTime(post.editedAt, locale) })}
                  onClick={(e) => onAction(post, 'history', e.currentTarget)}
                  className="rounded-sm underline underline-offset-2 hover:text-stone-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#4a5d23]"
                >
                  <time dateTime={post.editedAt.toISOString()}>{cardT(locale, 'edited')}</time>
                </button>
              </>
            )}
          </div>
        </div>

        <AppreciationSheet
          open={profileSheetOpen}
          onOpenChange={setProfileSheetOpen}
          author={{
            id: post.author.id,
            name: authorName,
            avatar: post.author.avatar,
            harmonyScore: post.author.harmonyScore,
            harmonyReviewsCount: post.author.harmonyReviewsCount,
            badgeSummary: post.author.badgeSummary,
            authorTier: post.author.authorTier ?? null,
          }}
          currentUserId={currentUserId}
          isGuest={currentUserIsGuest === true}
          isFollowing={isFollowingAuthor === true}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          postId={post.id}
        />

        {followGate !== 'hidden' && (
          <button
            type="button"
            data-testid={`follow-btn-${post.author.id}`}
            onClick={() => {
              if (followGate === 'guest-prompt') setProfileSheetOpen(true)
              else if (isFollowingAuthor) onUnfollow!(post.author.id)
              else onFollow!(post.author.id)
            }}
            className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isFollowingAuthor ? 'border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200' : 'border-lime-300 bg-lime-50 text-lime-800 hover:bg-lime-100'
            }`}
            aria-label={formatMessage(cardT(locale, isFollowingAuthor ? 'unfollowAria' : 'followAria'), { name: authorName })}
          >
            {cardT(locale, isFollowingAuthor ? 'following' : 'follow')}
          </button>
        )}

        {/* The ⋯ menu (renders once the shared menu primitive is on this branch). */}
        <PostCardActions
          postId={post.id}
          items={items}
          locale={locale}
          onSelect={(id, trigger) => onAction(post, id, trigger)}
          adminItem={{ content: post.content, author: authorName, createdAt: post.timestamp }}
        />
      </div>

      {/* The author's raw text — React escapes it; line breaks kept; direction from the text. */}
      <p dir="auto" className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed" data-testid={`post-content-${post.id}`}>
        {post.content}
      </p>

      {post.imageUrl && (
        <div data-testid={`post-image-${post.id}`} className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.imageAlt ?? formatMessage(cardT(locale, 'photoAlt'), { name: authorName })}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      {/* Type-specific body via the typed render registry (INV1). */}
      <PostTypeBody post={post} locale={locale} />

      {post.resourceId && post.resourceName && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <div
            data-testid={`resource-chip-${post.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 bg-lime-50 px-2.5 py-1 text-xs font-medium text-lime-800"
          >
            <LinkIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="max-w-[180px] truncate" dir="auto">
              {post.resourceName}
            </span>
          </div>
          {post.resourceCategory && (
            <span
              data-testid={`category-badge-${post.id}`}
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getCategoryTailwind(post.resourceCategory)}`}
            >
              {resourceCategoryLabel(post.resourceCategory, locale)}
            </span>
          )}
        </div>
      )}

      {/* Petition embed card — shown on petition-type posts */}
      {post.postType === 'petition' && petitionEmbed && (
        // English until the petition embed is translated (Release 3): marked so assistive tech reads it as English.
        <div data-testid={`petition-embed-${post.id}`} lang="en" dir="ltr" className="mb-3 flex flex-col gap-2 rounded-xl border border-lime-200 bg-lime-50/60 p-3">
          <div className="flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5 flex-shrink-0 text-lime-700" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-lime-800">Petition</span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900" lang="" dir="auto" data-member-text="petition-title">
            {petitionEmbed.title}
          </p>
          <p className="line-clamp-2 text-xs leading-relaxed text-stone-600" lang="" dir="auto" data-member-text="petition-summary">
            {petitionEmbed.summary}
          </p>
          <div className="text-xs text-stone-600">
            <span className="font-semibold text-stone-800">{petitionEmbed.signatureCount.toLocaleString()}</span>
            {petitionEmbed.targetSignatures > 0 && <> of {petitionEmbed.targetSignatures.toLocaleString()} signatures</>}
          </div>
          {petitionEmbed.hasSigned ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-lime-800">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              Signed
            </div>
          ) : (
            <button
              type="button"
              data-testid={`petition-sign-btn-${post.id}`}
              onClick={() => post.petitionId && onSignPetition?.(post.petitionId)}
              disabled={petitionEmbed.isSigning}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-lime-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-lime-800 disabled:opacity-60"
            >
              {petitionEmbed.isSigning ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Add your verified signature of support
            </button>
          )}
        </div>
      )}

      {/* Capacity + Opt-In section — only shown on posts with a capacity set */}
      {post.maxSeekers != null && (
        // English until opt-in copy is translated (Release 3).
        <div lang="en" dir="ltr" data-testid={`capacity-row-${post.id}`} className="mb-3 flex flex-wrap items-center gap-3">
          <span data-testid={`capacity-${post.id}`} className="text-xs text-stone-600">
            {post.slotsRemaining ?? 0} of {post.maxSeekers} spot{post.maxSeekers !== 1 ? 's' : ''} left
          </span>
          {isAuthor ? (
            <button
              type="button"
              data-testid={`opt-in-manage-${post.id}`}
              onClick={() => setOptInListOpen((v) => !v)}
              aria-expanded={optInListOpen}
              className="flex items-center gap-1 text-xs font-medium text-lime-800 transition-colors hover:text-lime-900"
            >
              {optInCount ?? 0} opted in
              {optInListOpen ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
            </button>
          ) : optInStatus != null ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-medium text-lime-800">
                <Check className="h-3 w-3" aria-hidden="true" /> Opted In
              </span>
              {optInStatus === 'pending' && (
                <button type="button" data-testid={`withdraw-btn-${post.id}`} onClick={() => onWithdraw(post.id)} className="text-xs text-stone-600 underline hover:text-stone-800">
                  Withdraw
                </button>
              )}
            </div>
          ) : isFull ? (
            <button type="button" disabled className="cursor-not-allowed rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              Full
            </button>
          ) : (
            <button
              type="button"
              data-testid={`opt-in-btn-${post.id}`}
              onClick={() => onOptIn(post.id)}
              className="rounded-full bg-lime-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-lime-800"
            >
              Opt In
            </button>
          )}
        </div>
      )}

      {/* Author's expandable opt-in management list */}
      {isAuthor && optInListOpen && authorOptIns && authorOptIns.length > 0 && (
        <div lang="en" dir="ltr" className="mb-3 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {authorOptIns.map((oi) => (
            <div key={oi.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <User className="h-3 w-3 flex-shrink-0 text-stone-500" aria-hidden="true" />
                <span className="truncate text-xs font-medium text-stone-700" lang="" dir="auto" data-member-text="seeker-name">
                  {oi.seekerName}
                </span>
                <HarmonyBadge score={oi.seekerHarmonyScore} count={oi.seekerHarmonyCount} userId={oi.seekerId} />
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    oi.status === 'completed'
                      ? 'bg-lime-100 text-lime-800'
                      : oi.status === 'accepted'
                        ? 'bg-blue-100 text-blue-800'
                        : oi.status === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {oi.status}
                </span>
                {authorDeclinedSeekerIds?.has(oi.seekerId) && (
                  <span
                    data-testid={`declined-before-marker-${oi.seekerId}`}
                    title="You have declined this person before"
                    className="flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                  >
                    <ShieldAlert className="h-2.5 w-2.5" aria-hidden="true" />
                    Declined before
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {oi.status === 'declined' && (
                  <button
                    type="button"
                    data-testid={`unblock-optin-${oi.id}`}
                    onClick={() => onAuthorUnblockOptIn?.(oi.id)}
                    className="rounded bg-lime-700 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-lime-800"
                  >
                    Unblock — they can request again
                  </button>
                )}
                {oi.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      data-testid={`accept-optin-${oi.id}`}
                      onClick={() => onAuthorUpdateOptIn?.(oi.id, 'accepted')}
                      className="rounded bg-lime-700 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-lime-800"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      data-testid={`decline-optin-${oi.id}`}
                      onClick={() => onAuthorUpdateOptIn?.(oi.id, 'declined')}
                      className="rounded bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-800 transition-colors hover:bg-stone-300"
                    >
                      Decline
                    </button>
                  </>
                )}
                {oi.status === 'accepted' && (
                  <button
                    type="button"
                    data-testid={`complete-optin-${oi.id}`}
                    onClick={() => onAuthorUpdateOptIn?.(oi.id, 'completed')}
                    className="rounded bg-blue-700 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-blue-800"
                  >
                    Mark Completed
                  </button>
                )}
                {oi.status === 'completed' && !authorReviewedOptInIds?.has(oi.id) && (
                  <button
                    type="button"
                    onClick={() => onAuthorReviewSeeker?.(oi.id, oi.seekerName)}
                    className="flex items-center gap-0.5 rounded bg-amber-700 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-amber-800"
                  >
                    <Star className="h-2.5 w-2.5" aria-hidden="true" />
                    Review seeker
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showReviewSourcerBtn && (
        <div lang="en" dir="ltr" className="mb-3">
          <button
            type="button"
            data-testid={`review-sourcer-${post.id}`}
            onClick={() => onReviewSourcer?.(post.id, currentUserOptInId!)}
            className="flex items-center gap-1 rounded-full bg-amber-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-800"
          >
            <Star className="h-3 w-3" aria-hidden="true" />
            Review sourcer
          </button>
        </div>
      )}

      {optInError && <div lang="en" dir="ltr" className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{optInError}</div>}

      <PostReactions
        postId={post.id}
        likes={post.likes}
        comments={post.comments}
        isLiked={post.isLiked}
        commentsOpen={commentsOpen}
        onLike={() => onLike(post.id)}
        onComment={() => onComment(post.id)}
        onShare={() => onShare(post.id)}
        shareCopied={shareCopied}
        onEmbed={() => onEmbed(post.id)}
        embedCopied={embedCopied}
        reduce={reduce}
        locale={locale}
      />

    </article>
  )
}
