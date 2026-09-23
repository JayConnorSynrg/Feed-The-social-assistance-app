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
// Guests see the sheet but a sign-up prompt in place of the picker (matches Follow's guest
// gating: the feed only wires Follow for signed-in users; here we prompt guests to join).

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
import { EngagementBadges, BadgeGlyph } from '@/components/profile/engagement-badges'
import { PixelItemIcon } from '@/components/appreciation/pixel-item-icon'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { createClient } from '@/lib/supabase/client'
import { APPRECIATION_ITEMS, giveAppreciation, listSentTo } from '@/lib/appreciation'
import type { BadgeSummary } from '@/lib/engagement-badges'

export interface AppreciationAuthor {
  id: string
  name: string
  avatar?: string
  harmonyScore: number | null
  harmonyReviewsCount: number
  badgeSummary: BadgeSummary | null
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
  /** Optional post the appreciation is sent in the context of (must be authored by the
   *  recipient; the RPC enforces this). */
  postId?: string | null
}

// ---------------------------------------------------------------------------
// Picker — the 12-item grid with single-flight + optimistic + sent-marking.
// ---------------------------------------------------------------------------
function AppreciatePicker({
  receiverId,
  currentUserId,
  postId,
}: {
  receiverId: string
  currentUserId: string
  postId?: string | null
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
      <p className="flex items-center gap-2 text-sm text-stone-600" data-testid="appreciate-picker-loading">
        <Loader2 className="h-4 w-4 animate-spin text-stone-500" aria-hidden="true" />
        <span>Loading…</span>
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3" data-testid="appreciate-picker-error">
        <p className="text-sm text-stone-600">{loadError}</p>
        <Button size="sm" variant="outline" onClick={() => void loadSent()}>
          Retry
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
                aria-label={isSent ? `${item.label} — already sent` : `Send ${item.alt}`}
                data-testid={`appreciate-item-${item.slug}`}
                data-sent={isSent ? 'true' : 'false'}
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 text-stone-900 transition-colors ${
                  isSent
                    ? 'border-lime-300 bg-lime-50 cursor-default'
                    : 'border-stone-200 bg-stone-50/95 hover:border-lime-300 hover:bg-lime-50'
                }`}
              >
                <PixelItemIcon slug={item.slug} size={32} title={item.alt} />
                <span className="text-[10px] font-medium text-stone-600">{item.label}</span>
                {isSent && (
                  <span
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-lime-600 text-white"
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
      {giveError && (
        <p className="mt-2 text-xs text-red-700" role="alert" data-testid="appreciate-give-error">
          {giveError}
        </p>
      )}
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
}: AppreciationSheetProps) {
  const [showPicker, setShowPicker] = useState(false)
  const isSelf = currentUserId != null && currentUserId === author.id
  const canFollow = currentUserId != null && !isGuest && !isSelf && !!onFollow && !!onUnfollow

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto bg-stone-50/95 text-stone-900" data-testid="author-profile-sheet">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4a5d23]">
              {author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatar} alt={author.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-white">{author.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{author.name}</SheetTitle>
              <div className="mt-1">
                <HarmonyBadge
                  score={author.harmonyScore}
                  count={author.harmonyReviewsCount}
                  userId={author.id}
                />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-6 pb-8">
          {/* Full public badge list (public mode: no private section). */}
          <EngagementBadges summary={author.badgeSummary} displayName={author.name} />

          {/* Follow toggle — reuses the feed's follow handlers. */}
          {canFollow && (
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
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          {/* Appreciation */}
          <section aria-labelledby="appreciate-heading" className="border-t border-stone-200 pt-4">
            <h3 id="appreciate-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Gift className="h-4 w-4 text-[#9a6a1f]" aria-hidden="true" />
              Appreciate {author.name}
            </h3>

            {isSelf ? (
              <p className="text-sm text-stone-500">This is you — appreciation comes from the community.</p>
            ) : currentUserId == null || isGuest ? (
              <CreateAccountPrompt message="Create a free account to send appreciation" />
            ) : showPicker ? (
              <AppreciatePicker receiverId={author.id} currentUserId={currentUserId} postId={postId} />
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-[#9a6a1f] text-white hover:bg-[#835916]"
                onClick={() => setShowPicker(true)}
                data-testid="appreciate-open-picker"
              >
                <Gift className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Send appreciation
              </Button>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
