'use client'

// apps/web/src/app/(admin)/moderation/community-summary-section.tsx
// The Community tab's insights card, in the admin's language (lib/i18n-admin-moderation.ts), marked
// lang/dir on its root. The themes (label, summary) are written in English by the model behind
// /api/community-summary and stay marked lang="en" dir="ltr". A failure shows the admin's sentence
// and writes one admin.community.insights_failed row: the PostgREST code, the HTTP status, or the
// error's class — never a message (the route's reply is not shown or logged).

import { useState, useCallback } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { formatClock } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { THEME_POSTS, adminModerationT, moderationCount } from '@/lib/i18n-admin-moderation'

type Theme = {
  type: string
  label: string
  summary: string
  count: number
}

type PostGroup = {
  type: string
  count: number
  excerpts: string[]
}

/** A failure the card logs: where it happened, by code (no message text). */
class InsightsFailure extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super(code)
    this.name = 'InsightsFailure'
  }
}

export function CommunitySummarySection({ locale = 'en' }: { locale?: Locale } = {}) {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(false)
  const [suppressed, setSuppressed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const supabase = createClient()

  const generateSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch recent posts (last 30 days, limit 200)
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, post_type, content')
        .gte('created_at', since.toISOString())
        .limit(200)

      if (postsError) throw new InsightsFailure(postsError.code || 'postgrest')
      if (!posts || posts.length === 0) {
        setSuppressed(true)
        setThemes([])
        setLoading(false)
        return
      }

      // Category-based clustering (v1 proxy for embed→cluster)
      const groups: Record<string, PostGroup> = {}
      for (const post of posts) {
        const type = post.post_type ?? 'general'
        if (!groups[type]) groups[type] = { type, count: 0, excerpts: [] }
        groups[type].count++
        if (groups[type].excerpts.length < 3) {
          const text = (post.content ?? '').slice(0, 100)
          if (text) groups[type].excerpts.push(text)
        }
      }

      const groupList = Object.values(groups)

      // Call admin-gated API route
      const res = await fetch('/api/community-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupList }),
      })

      if (!res.ok) throw new InsightsFailure('http', res.status)

      const data = await res.json() as { suppressed?: boolean; themes?: Theme[] }
      if (data.suppressed) {
        setSuppressed(true)
        setThemes([])
      } else {
        setSuppressed(false)
        setThemes(data.themes ?? [])
      }
      setLastFetched(new Date())
    } catch (err) {
      // The route writes no row of its own: this is the one row for the failure.
      if (err instanceof InsightsFailure) {
        logger.warn('admin.community.insights_failed', err.status === undefined ? { code: err.code } : { code: err.code, status: err.status })
      } else {
        logger.warn('admin.community.insights_failed', { code: err instanceof Error ? err.name : 'unknown' })
      }
      setError(adminModerationT(locale, 'insightsFailed'))
    } finally {
      setLoading(false)
    }
  }, [supabase, locale])

  const generateLabel = adminModerationT(locale, 'insightsGenerate')

  return (
    <div lang={locale} dir={dir(locale)} className="rounded-xl border border-stone-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-lime-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-stone-800">{adminModerationT(locale, 'insightsTitle')}</h2>
        </div>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="flex min-h-9 items-center gap-1.5 rounded-lg bg-lime-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-lime-800 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading
            ? adminModerationT(locale, 'insightsAnalyzing')
            : lastFetched
              ? adminModerationT(locale, 'insightsRefresh')
              : generateLabel}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {suppressed && (
        <p className="text-sm text-stone-600 italic">{adminModerationT(locale, 'insightsSuppressed')}</p>
      )}

      {!loading && !suppressed && themes.length === 0 && !error && !lastFetched && (
        <p className="text-sm text-stone-600 italic">
          {formatMessage(adminModerationT(locale, 'insightsHint'), { button: generateLabel })}
        </p>
      )}

      {themes.length > 0 && (
        <div className="space-y-3">
          {themes.map((theme) => (
            <div
              key={theme.type}
              className="rounded-lg border border-stone-100 bg-stone-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {/* Written in English by the model behind /api/community-summary. */}
                <span lang="en" dir="ltr" className="rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-semibold text-lime-800">
                  {theme.label}
                </span>
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-700">
                  {moderationCount(THEME_POSTS, theme.count, locale)}
                </span>
              </div>
              <p lang="en" dir="ltr" className="text-sm text-stone-700">{theme.summary}</p>
            </div>
          ))}
          {lastFetched && (
            <p className="text-xs text-stone-600 mt-2">
              {formatMessage(adminModerationT(locale, 'insightsUpdated'), { time: formatClock(lastFetched.toISOString(), locale, browserTimeZone()) })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
