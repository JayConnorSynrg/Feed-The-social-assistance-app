'use client'

import { useState, useCallback } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

export function CommunitySummarySection() {
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

      if (postsError) throw new Error(postsError.message)
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `API error ${res.status}`)
      }

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
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-lime-600" />
          <h2 className="text-lg font-semibold text-stone-800">Community Insights</h2>
        </div>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-lime-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-lime-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing…' : lastFetched ? 'Refresh' : 'Generate Insights'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {suppressed && (
        <p className="text-sm text-stone-500 italic">
          AI insights available once community reaches sufficient volume (k≥20 per category).
        </p>
      )}

      {!loading && !suppressed && themes.length === 0 && !error && !lastFetched && (
        <p className="text-sm text-stone-400 italic">
          Click &quot;Generate Insights&quot; to analyze community posts from the last 30 days.
        </p>
      )}

      {themes.length > 0 && (
        <div className="space-y-3">
          {themes.map((theme) => (
            <div
              key={theme.type}
              className="rounded-lg border border-stone-100 bg-stone-50 p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-semibold text-lime-800">
                  {theme.label}
                </span>
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">
                  {theme.count} posts
                </span>
              </div>
              <p className="text-sm text-stone-700">{theme.summary}</p>
            </div>
          ))}
          {lastFetched && (
            <p className="text-xs text-stone-400 mt-2">
              Last updated: {lastFetched.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
