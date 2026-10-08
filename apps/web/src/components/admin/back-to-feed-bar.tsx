'use client'

// apps/web/src/components/admin/back-to-feed-bar.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The slim bar (admin)/layout.tsx renders above every admin page: one "Back to feed" link to the
// community feed panel, in the same tab. It is the only way out of admin that every page shares, so
// it lives in the layout (not in each page) — every admin page shows it exactly once, including the
// admin error screen, which renders inside the layout. The icon is the feed panel's own sidebar icon
// (feed-shell.tsx SIDEBAR_ICONS) so the destination reads the same in both places. Copy follows the
// viewer's profile language (organization admins may not read English).

import { useMemo, type MouseEvent } from 'react'
import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { dir, resolveUserLocale, type Locale } from '@/lib/i18n'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { logEvent } from '@/lib/logger'
import { memberUrl } from '@/lib/member-url'

function logBackToFeed() {
  logEvent('admin.nav.back_to_feed', { source: 'admin_bar' })
}

export function BackToFeedBar() {
  // Server render and the first client render both use 'en' (profile not loaded yet), so hydration
  // matches; the profile language applies once it loads (same as admin-shell.tsx).
  const { profile } = useAuth()
  const locale: Locale = useMemo(
    () => (profile ? resolveUserLocale((profile as { preferred_language?: string | null }).preferred_language ?? null) : 'en'),
    [profile]
  )

  return (
    <nav
      aria-label={adminNavT(locale, 'navLabel')}
      lang={locale}
      dir={dir(locale)}
      className="border-b border-stone-200 bg-white px-2 py-1 sm:px-4"
      style={{ paddingTop: 'max(4px, env(safe-area-inset-top))' }}
    >
      <Link
        href={memberUrl({ kind: 'feed_home' })}
        onClick={logBackToFeed}
        onAuxClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (e.button === 1) logBackToFeed()
        }}
        className="inline-flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium text-stone-800 hover:bg-lime-50 hover:text-lime-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-2"
      >
        <Newspaper className="h-4 w-4 shrink-0 text-lime-700" aria-hidden="true" />
        {adminNavT(locale, 'backToFeed')}
      </Link>
    </nav>
  )
}
