'use client'

// apps/web/src/components/appreciation/gifts-received-shelf.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The signed-in user's "Gifts received" shelf for Settings → Profile (P2.1b). Each received
// item shows its pixel icon, a count, and (owner-only, via RLS) the giver names. Empty state
// "No gifts yet"; loading + error/Retry states mirror the badges card. Owner-only: the read
// is RLS-scoped to receiver_id = the caller.
//
// In the viewer's language (lib/i18n-feed-badges.ts), with its own language mark: Settings, where
// it mounts, is still English. Each giver's name is that member's own text, in its own element
// with its own direction; a giver with no name reads "Someone" in the viewer's language. A
// failure the library wrote reads translated; anything else is shown as received, marked English.

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { PixelItemIcon } from '@/components/appreciation/pixel-item-icon'
import { myReceivedShelf, type ShelfEntry } from '@/lib/appreciation'
import { dir, type Locale } from '@/lib/i18n'
import { splitPlaceholders } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { appreciationErrorText, appreciationItemLabel, badgesT, giftsFromMessage } from '@/lib/i18n-feed-badges'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { useFeedAnnounceReady } from '@/components/feed/feed-chrome'

export function GiftsReceivedShelf({ userId }: { userId?: string | null }) {
  const supabase = createClient()
  const locale = useProfileLocale()
  const [shelf, setShelf] = useState<ShelfEntry[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setShelf([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await myReceivedShelf(supabase, userId)
    if (res.ok) {
      setShelf(res.shelf)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    // load() sets loading/error/shelf on mount; matches the repo's badges-card loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const failure = error ? appreciationErrorText(error, locale) : null
  // The loading status is on the page empty for a frame before its text, so it is spoken.
  const statusReady = useFeedAnnounceReady(true)

  return (
    <div
      lang={locale}
      dir={dir(locale)}
      className="rounded-xl border border-stone-200 bg-stone-50/95 p-4 text-stone-900"
      data-testid="gifts-received-shelf"
    >
      <h3 className="mb-3 text-sm font-semibold text-stone-500">{badgesT(locale, 'giftsHeading')}</h3>

      <p role="status" aria-live="polite" className="sr-only" data-testid="gifts-received-status">
        {statusReady && loading ? badgesT(locale, 'giftsLoading') : ''}
      </p>
      {loading ? (
        // The status region above says it; this line is for sighted readers.
        <p aria-hidden="true" className="flex items-center gap-2 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin text-stone-500" aria-hidden="true" />
          <span>{badgesT(locale, 'giftsLoading')}</span>
        </p>
      ) : failure ? (
        <div className="flex items-center justify-between gap-3">
          <p role="alert" lang={failure.translated ? undefined : 'en'} dir={failure.translated ? undefined : 'ltr'} className="text-sm text-stone-600" data-testid="gifts-received-error">
            {failure.text}
          </p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            {feedChromeT(locale, 'retry')}
          </Button>
        </div>
      ) : shelf.length === 0 ? (
        <p className="text-sm text-stone-500">{badgesT(locale, 'giftsEmpty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-3" data-testid="gifts-received-list">
          {shelf.map((entry) => (
            <li
              key={entry.slug}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2"
              data-testid={`gift-received-${entry.slug}`}
            >
              <PixelItemIcon slug={entry.slug} size={32} title={appreciationItemLabel(entry.slug, locale)} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  {appreciationItemLabel(entry.slug, locale)} <span className="text-stone-500">×{formatCount(entry.count, locale)}</span>
                </p>
                <p className="truncate text-xs text-stone-500" data-testid={`gift-givers-${entry.slug}`}>
                  <GiversLine names={entry.givers.map((g) => g.name)} locale={locale} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * "from Ada", "from Ada & Ben", "from Ada, Ben & 3 others" in the viewer's language: the sentence
 * comes from the dictionary with a slot per name, and each name goes into its slot as an element
 * of its own (its own direction, no page language). Owner-only names (RLS-scoped).
 */
export function GiversLine({ names, locale }: { names: Array<string | null>; locale: Locale }) {
  // The sentence decides how many names show: up to three; from four givers on, two names and
  // how many others (giftsFromMessage).
  const slot: Record<string, string | null | undefined> = { a: names[0], b: names[1], c: names[2] }
  return (
    <>
      {splitPlaceholders(giftsFromMessage(names.length, locale)).map((part, i) => {
        if (typeof part === 'string') return part
        const name = slot[part.name]
        // No name on the giver's profile: FEED's own word, in the viewer's language.
        return name ? <bdi key={i} lang="">{name}</bdi> : <span key={i}>{badgesT(locale, 'someone')}</span>
      })}
    </>
  )
}
