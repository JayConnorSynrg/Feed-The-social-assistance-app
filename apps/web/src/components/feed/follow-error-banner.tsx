'use client'

// apps/web/src/components/feed/follow-error-banner.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The follow / unfollow failure line above the community feed. hooks/use-follows.ts reports a
// failure as one of its fixed English sentences; this line shows the member's sentence for it
// (lib/i18n-feed-follows.ts) and inherits the feed's language. Text FEED did not write is shown as
// received and marked English.

import type { Locale } from '@/lib/i18n'
import { followErrorText } from '@/lib/i18n-feed-follows'

export function FollowErrorBanner({ error, locale }: { error: string; locale: Locale }) {
  const failure = followErrorText(error, locale)
  return (
    <div
      role="alert"
      lang={failure.translated ? undefined : 'en'}
      dir={failure.translated ? undefined : 'ltr'}
      data-testid="follow-error"
      className="mx-2 mt-1 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md"
    >
      {failure.text}
    </div>
  )
}
