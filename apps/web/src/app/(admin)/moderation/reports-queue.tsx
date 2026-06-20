'use client'

import { useState, useCallback, useEffect } from 'react'
import { Flag, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  abusive: 'Abusive content',
  harassment: 'Harassment',
  misinformation: 'Misinformation',
  illegal: 'Illegal content',
  off_topic: 'Off topic',
  other: 'Other',
}

interface ReportRow {
  id: string
  reporter_id: string
  content_type: string
  content_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
}

interface ContentGroup {
  content_id: string
  post_content: string | null
  post_author: string | null
  reports: ReportRow[]
}

interface HeldPost {
  id: string
  content: string | null
  created_at: string
  hidden_at: string | null
  hidden_reason: string | null
  user_id: string
}

export function ReportsQueue() {
  const [groups, setGroups] = useState<ContentGroup[]>([])
  const [heldPosts, setHeldPosts] = useState<HeldPost[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: reports, error: reportsError } = await supabase
          .from('content_reports')
          .select('id, reporter_id, content_type, content_id, reason, details, status, created_at')
          .eq('status', 'open')
          .order('created_at', { ascending: true })
          .limit(100)

        if (reportsError) throw reportsError

        // Group by content_id
        const groupMap = new Map<string, ContentGroup>()
        for (const report of (reports ?? []) as ReportRow[]) {
          if (!groupMap.has(report.content_id)) {
            groupMap.set(report.content_id, {
              content_id: report.content_id,
              post_content: null,
              post_author: null,
              reports: [],
            })
          }
          groupMap.get(report.content_id)!.reports.push(report)
        }

        // Enrich with post content where available
        const contentIds = Array.from(groupMap.keys())
        if (contentIds.length > 0) {
          const { data: posts } = await supabase
            .from('posts')
            .select('id, content, user_id')
            .in('id', contentIds)

          if (posts) {
            for (const post of posts) {
              const group = groupMap.get(post.id)
              if (group) {
                group.post_content = (post.content as string | null)?.slice(0, 200) ?? null
              }
            }
          }
        }

        setGroups(Array.from(groupMap.values()))

        // Load removed & held posts
        const { data: hiddenPostsData } = await supabase
          .from('posts')
          .select('id, content, created_at, hidden_at, hidden_reason, user_id')
          .eq('is_hidden', true)
          .in('hidden_reason', ['admin_removal', 'hold_for_review'])
          .order('hidden_at', { ascending: false })
        if (hiddenPostsData) setHeldPosts(hiddenPostsData as unknown as HeldPost[]) // TODO: regen types after migration is applied
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleResolve = useCallback(
    async (reportId: string, action: 'dismiss' | 'uphold') => {
      setProcessingId(reportId)
      setError(null)
      try {
        const { error: rpcError } = await supabase.rpc('admin_resolve_report', {
          p_report_id: reportId,
          p_action: action,
        })
        if (rpcError) throw rpcError

        // Remove the resolved report; if group is now empty remove the group
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              reports: g.reports.filter((r) => r.id !== reportId),
            }))
            .filter((g) => g.reports.length > 0)
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setProcessingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleRemove = useCallback(
    async (postId: string) => {
      setProcessingId(postId)
      setError(null)
      try {
        const { error: rpcError } = await supabase.rpc('admin_remove_post', {
          p_post_id: postId,
        })
        if (rpcError) throw rpcError
        setGroups((prev) => prev.filter((g) => g.content_id !== postId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setProcessingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleHold = useCallback(
    async (postId: string) => {
      setProcessingId(postId)
      setError(null)
      try {
        const { error: rpcError } = await supabase.rpc('admin_hold_post', {
          p_post_id: postId,
        })
        if (rpcError) throw rpcError
        setGroups((prev) => prev.filter((g) => g.content_id !== postId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setProcessingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleAuthorize = useCallback(
    async (postId: string) => {
      setProcessingId(postId)
      setError(null)
      try {
        const { error: rpcError } = await supabase.rpc('admin_authorize_post', {
          p_post_id: postId,
        })
        if (rpcError) throw rpcError
        setHeldPosts((prev) => prev.filter((p) => p.id !== postId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setProcessingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (groups.length === 0 && heldPosts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">No open reports</h3>
            <p className="text-muted-foreground mt-2">
              There are no content reports awaiting review.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {groups.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {groups.length} post{groups.length !== 1 ? 's' : ''} with open reports
        </p>
      )}

      {groups.map((group) => {
        const isExpanded = expandedId === group.content_id
        const reportCount = group.reports.length
        const reasons = [...new Set(group.reports.map((r) => REASON_LABELS[r.reason] ?? r.reason))]

        return (
          <Card key={group.content_id} className="border-orange-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                      <Flag className="h-3 w-3" />
                      {reportCount} report{reportCount !== 1 ? 's' : ''}
                    </span>
                    {reasons.map((r) => (
                      <span
                        key={r}
                        className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  {group.post_author && (
                    <CardTitle className="mt-2 text-sm font-medium text-stone-500">
                      Author: {group.post_author}
                    </CardTitle>
                  )}
                  {group.post_content && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {group.post_content}
                    </CardDescription>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === group.content_id ? null : group.content_id
                    )
                  }
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3">
                {/* Post-level actions */}
                <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-stone-100">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 min-h-[44px] text-xs"
                    disabled={processingId === group.content_id}
                    onClick={() => handleRemove(group.content_id)}
                    data-testid={`remove-post-${group.content_id}`}
                  >
                    {processingId === group.content_id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    Remove Post
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 min-h-[44px] text-xs"
                    disabled={processingId === group.content_id}
                    onClick={() => handleHold(group.content_id)}
                    data-testid={`hold-post-${group.content_id}`}
                  >
                    {processingId === group.content_id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Hold for Review
                  </Button>
                </div>

                {/* Per-report rows */}
                {group.reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-orange-700">
                          {REASON_LABELS[report.reason] ?? report.reason}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(report.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] text-xs"
                          disabled={processingId === report.id}
                          onClick={() => handleResolve(report.id, 'dismiss')}
                          data-testid={`dismiss-report-${report.id}`}
                        >
                          {processingId === report.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1 text-stone-500" />
                          )}
                          Dismiss
                        </Button>
                      </div>
                    </div>
                    {report.details && (
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {report.details}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Removed & Held Posts */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Removed &amp; Held Posts</h3>
        {heldPosts.length === 0 ? (
          <p className="text-stone-500 text-sm">No removed or held posts.</p>
        ) : (
          <div className="space-y-3">
            {heldPosts.map((post) => (
              <div key={post.id} className="border rounded-lg p-4">
                <p className="text-sm text-stone-700 line-clamp-2">
                  {(post.content ?? '').slice(0, 120)}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-2 text-xs text-stone-500">
                    <span className="font-medium">
                      {post.hidden_reason === 'admin_removal' ? 'Removed' : 'Held for Review'}
                    </span>
                    <span>
                      {post.hidden_at ? new Date(post.hidden_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {post.hidden_reason === 'hold_for_review' && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`authorize-post-${post.id}`}
                      onClick={() => handleAuthorize(post.id)}
                      disabled={processingId === post.id}
                    >
                      {processingId === post.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Authorize Post
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
