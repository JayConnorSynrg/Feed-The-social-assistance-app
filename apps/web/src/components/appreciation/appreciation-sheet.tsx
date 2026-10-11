'use client'

// apps/web/src/components/appreciation/appreciation-sheet.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The author profile sheet opened by clicking a post author's name/avatar in the live
// PostCard (P2.1b). Shows name, avatar, Harmony, the author's full PUBLIC badge list, a
// Follow toggle (reusing the feed's handlers), and — for a signed-in, non-guest, non-self
// viewer — an "Appreciate" button that reveals a 12-item picker. Already-sent items are
// disabled with a check. A single-flight ref gate blocks double-submits; each give is
// optimistic and settles from the RPC result; failures surface an inline error + Retry.
// Follow gating is shared with the post card via resolveFollowGate: a signed-in NON-GUEST
// non-self viewer gets the working toggle ('active'); a guest gets a Follow button that
// surfaces CreateAccountPrompt on tap ('guest-prompt') and attempts NO follows insert (the
// prod RESTRICTIVE anon-insert block would revert it silently — round-2 MEDIUM); self /
// signed-out resolve to 'hidden'. Appreciation is likewise guest-gated: only a signed-in
// NON-GUEST non-self viewer sees the picker; guests get a sign-up prompt in its place (the
// RPC rejects anonymous givers).
//
// In the viewer's language (lib/i18n-feed-badges.ts). The sheet renders in a portal, outside the
// feed's language mark, so it carries its own lang and dir and a translated close label. The
// author's name is the author's own text: shown as written, never looked up. A failure the
// library wrote reads translated; anything else is shown as received and marked English.

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2, Check, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { HarmonyBadge } from '@/components/feed/harmony-badge'
import { EngagementBadges } from '@/components/profile/engagement-badges'
import { PixelItemIcon } from '@/components/appreciation/pixel-item-icon'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { createClient } from '@/lib/supabase/client'
import { resolveFollowGate } from '@/lib/follow-gate'
import { APPRECIATION_ITEMS, giveAppreciation, listSentTo } from '@/lib/appreciation'
import type { BadgeSummary } from '@/lib/engagement-badges'
import type { AdminTier } from '@/lib/admin-tier'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate, splitMessage } from '@/lib/format-message'
import { cardT, roleLabel } from '@/lib/i18n-feed-card'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { appreciationErrorText, appreciationItemAlt, appreciationItemLabel, appreciationItemName, badgesT } from '@/lib/i18n-feed-badges'

export interface AppreciationAuthor {
  id: string
  name: string
  avatar?: string
  harmonyScore: number | null
  harmonyReviewsCount: number
  badgeSummary: BadgeSummary | null
  /** Public tier marker (T4). null/undefined = plain member. */
  authorTier?: AdminTier | null
}

interface AppreciationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author: AppreciationAuthor
  currentUserId: string | null
  isGuest: boolean
  isFollowing: boolean
  onFollow?: (id: string) => void
  onUnfollow?: (id: string) => void
  /** Optional post the appreciation is sent in the context of. Pure optional context: the RPC
   *  silently drops it if the post is missing, hidden, or not authored by the recipient (LOW-1),
   *  so the gift still succeeds. */
  postId?: string | null
  /** The viewer's language. */
  locale: Locale
}

/** A failure line: FEED's sentence in the viewer's language, or received text marked English. */
function FailureText({ error, locale, className, testId, alert }: { error: string; locale: Locale; className: string; testId?: string; alert?: boolean }) {
  const failure = appreciationErrorText(error, locale)
  return (
    <p role={alert ? 'alert' : undefined} lang={failure.translated ? undefined : 'en'} dir={failure.translated ? undefined : 'ltr'} className={className} data-testid={testId}>
      {failure.text}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Picker — the 12-item grid with single-flight + optimistic + sent-marking.
// ---------------------------------------------------------------------------
export function AppreciatePicker({
  receiverId,
  currentUserId,
  postId,
  locale,
}: {
  receiverId: string
  currentUserId: string
  postId?: string | null
  locale: Locale
}) {
  const supabase = createClient()
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [giveError, setGiveError] = useState<string | null>(null)
  // Single-flight gate: flip synchronously before the first await so a rapid second
  // click cannot start a second give (state alone would race).
  const inFlight = useRef(false)

  const loadSent = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const res = await listSentTo(supabase, currentUserId, receiverId)
    if (res.ok) {
      setSent(new Set(res.items))
    } else {
      setLoadError(res.error)
    }
    setLoading(false)
  }, [supabase, currentUserId, receiverId])

  useEffect(() => {
    // loadSent() sets loading/sent on open; matches the repo's async-loader effect pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSent()
  }, [loadSent])

  const handleGive = useCallback(
    async (slug: string) => {
      if (inFlight.current) return
      if (sent.has(slug)) return
      inFlight.current = true
      setPending(slug)
      setGiveError(null)
      // Optimistic: mark sent immediately, then settle from the server result.
      setSent((prev) => new Set(prev).add(slug))
      const res = await giveAppreciation(supabase, receiverId, slug, postId ?? null)
      if (!res.ok) {
        // Roll back the optimistic mark and surface the error with a retry affordance.
        setSent((prev) => {
          const next = new Set(prev)
          next.delete(slug)
          return next
        })
        setGiveError(res.error)
      }
      // On success (created true OR idempotent false) the item stays marked sent.
      setPending(null)
      inFlight.current = false
    },
    [supabase, receiverId, postId, sent]
  )

  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-stone-600" data-testid="appreciate-picker-loading">
        <Loader2 className="h-4 w-4 animate-spin text-stone-500" aria-hidden="true" />
        <span>{feedChromeT(locale, 'loadingMore')}</span>
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3" data-testid="appreciate-picker-error">
        <FailureText error={loadError} locale={locale} className="text-sm text-stone-600" alert />
        <Button size="sm" variant="outline" onClick={() => void loadSent()}>
          {feedChromeT(locale, 'retry')}
        </Button>
      </div>
    )
  }

  return (
    <div data-testid="appreciate-picker">
      <ul className="grid grid-cols-4 gap-2" role="list">
        {APPRECIATION_ITEMS.map((item) => {
          const isSent = sent.has(item.slug)
          const isPending = pending === item.slug
          return (
            <li key={item.slug}>
              <button
                type="button"
                disabled={isSent || isPending}
                onClick={() => void handleGive(item.slug)}
                aria-label={appreciationItemName(item.slug, isSent, locale)}
                data-testid={`appreciate-item-${item.slug}`}
                data-sent={isSent ? 'true' : 'false'}
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 text-stone-900 transition-colors ${
                  isSent
                    ? 'border-lime-300 bg-lime-50 cursor-default'
                    : 'border-stone-200 bg-stone-50/95 hover:border-lime-300 hover:bg-lime-50'
                }`}
              >
                <PixelItemIcon slug={item.slug} size={32} title={appreciationItemAlt(item.slug, locale)} />
                <span className="text-[10px] font-medium text-stone-600">{appreciationItemLabel(item.slug, locale)}</span>
                {isSent && (
                  <span
                    className="absolute end-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-lime-600 text-white"
                    aria-hidden="true"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
                {isPending && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60" aria-hidden="true">
                    <Loader2 className="h-4 w-4 animate-spin text-lime-700" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {giveError && <FailureText error={giveError} locale={locale} className="mt-2 text-xs text-red-700" testId="appreciate-give-error" alert />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------
export function AppreciationSheet({
  open,
  onOpenChange,
  author,
  currentUserId,
  isGuest,
  isFollowing,
  onFollow,
  onUnfollow,
  postId,
  locale,
}: AppreciationSheetProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [showFollowPrompt, setShowFollowPrompt] = useState(false)
  const isSelf = currentUserId != null && currentUserId === author.id
  // Shared with the post card via resolveFollowGate: 'active' toggles follow/unfollow;
  // 'guest-prompt' surfaces CreateAccountPrompt on tap and never inserts; 'hidden' shows nothing.
  const followGate = resolveFollowGate({
    currentUserId,
    authorId: author.id,
    isGuest,
    hasHandlers: !!onFollow && !!onUnfollow,
  })

  const [beforeHeadingName, afterHeadingName] = splitMessage(badgesT(locale, 'appreciateHeading'), 'name')
  const createAccount = feedChromeT(locale, 'createAccount')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* A portal: it does not inherit the feed's language, so it carries its own. */}
      <SheetContent
        lang={locale}
        dir={dir(locale)}
        closeLabel={cardT(locale, 'close')}
        className="overflow-y-auto bg-stone-50/95 text-stone-900"
        data-testid="author-profile-sheet"
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4a5d23]">
              {author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatar} alt={author.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-white" aria-hidden="true">{author.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              {/* The author's own name: its own direction, no page language. */}
              <SheetTitle lang="" dir="auto" className="truncate">{author.name}</SheetTitle>
              {/* The tier marker, with the card's own words (plain members get none). */}
              {author.authorTier && (
                <span className="mt-1 inline-flex items-center rounded-full bg-stone-800 px-2 py-0.5 text-xs font-medium text-stone-50" data-testid="author-sheet-tier">
                  {roleLabel(author.authorTier, locale)}
                </span>
              )}
              <div className="mt-1">
                <HarmonyBadge
                  score={author.harmonyScore}
                  count={author.harmonyReviewsCount}
                  userId={author.id}
                  locale={locale}
                />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-6 pb-8">
          {/* Full public badge list (public mode: no private section). */}
          <EngagementBadges summary={author.badgeSummary} displayName={author.name} locale={locale} />

          {/* Follow toggle — 'active' reuses the feed's follow handlers. */}
          {followGate === 'active' && (
            <button
              type="button"
              data-testid={`sheet-follow-btn-${author.id}`}
              onClick={() => (isFollowing ? onUnfollow!(author.id) : onFollow!(author.id))}
              className={`w-full rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                isFollowing
                  ? 'border-stone-300 bg-stone-100 text-stone-600 hover:bg-stone-200'
                  : 'border-lime-300 bg-lime-50 text-lime-700 hover:bg-lime-100'
              }`}
            >
              {cardT(locale, isFollowing ? 'following' : 'follow')}
            </button>
          )}

          {/* Guest Follow — a tap surfaces the account prompt (no follows insert is attempted). */}
          {followGate === 'guest-prompt' &&
            (showFollowPrompt ? (
              <CreateAccountPrompt message={formatMessage(badgesT(locale, 'guestFollowPrompt'), { name: isolate(author.name) })} linkLabel={createAccount} />
            ) : (
              <button
                type="button"
                data-testid={`sheet-follow-btn-${author.id}`}
                onClick={() => setShowFollowPrompt(true)}
                className="w-full rounded-full border border-lime-300 bg-lime-50 px-3 py-2 text-sm font-medium text-lime-700 transition-colors hover:bg-lime-100"
              >
                {cardT(locale, 'follow')}
              </button>
            ))}

          {/* Appreciation */}
          <section aria-labelledby="appreciate-heading" className="border-t border-stone-200 pt-4">
            <h3 id="appreciate-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Gift className="h-4 w-4 text-[#9a6a1f]" aria-hidden="true" />
              <span>
                {beforeHeadingName}
                <bdi lang="">{author.name}</bdi>
                {afterHeadingName}
              </span>
            </h3>

            {isSelf ? (
              <p className="text-sm text-stone-500">{badgesT(locale, 'appreciateSelf')}</p>
            ) : currentUserId == null || isGuest ? (
              <CreateAccountPrompt message={badgesT(locale, 'appreciateGuestPrompt')} linkLabel={createAccount} />
            ) : showPicker ? (
              <AppreciatePicker receiverId={author.id} currentUserId={currentUserId} postId={postId} locale={locale} />
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-[#9a6a1f] text-white hover:bg-[#835916]"
                onClick={() => setShowPicker(true)}
                data-testid="appreciate-open-picker"
              >
                <Gift className="me-1.5 h-4 w-4" aria-hidden="true" />
                {badgesT(locale, 'sendAppreciation')}
              </Button>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
