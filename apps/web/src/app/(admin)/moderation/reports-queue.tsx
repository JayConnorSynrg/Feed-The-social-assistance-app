'use client'

import { useState, useCallback, useEffect } from 'react'
import { Flag, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { privilegedRpc } from '@/lib/privileged-action'
import { logger } from '@/lib/logger'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { postVisibility } from '@/lib/member-visibility'
import { DESTRUCTIVE_BUTTON_CLASS, canResolveReportsOn, moderatePost, moderationFailure, type PostModerationAction } from './post-moderation-actions'
import { buildReportGroups, groupPostVisibility, type ContentGroup, type ReportRow, type ReportedPostRow } from './report-groups'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  abusive: 'Abusive content',
  harassment: 'Harassment',
  misinformation: 'Misinformation',
  illegal: 'Illegal content',
  off_topic: 'Off topic',
  other: 'Other',
}

interface HeldPost {
  id: string
  version: number | null
  is_hidden: boolean
  content: string | null
  created_at: string
  hidden_at: string | null
  hidden_reason: string | null
  user_id: string
}

/** A short accessible name for a post in a "View post" link: the start of its text. */
function postItemName(content: string | null): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

/** onPostChanged: a Remove / Hold / Authorize here succeeded (the linked-post panel above re-reads).
 *  viewerId: the signed-in moderator — no Dismiss on reports about their own post, no Authorize of
 *  their own held post, no Hold of their own removed post (the database refuses each). */
export function ReportsQueue({ onPostChanged, viewerId = null }: { onPostChanged?: (postId: string) => void; viewerId?: string | null } = {}) {
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

        // Group by reported post, then enrich with each post's text and hidden state.
        const reportRows = (reports ?? []) as ReportRow[]
        const contentIds = [...new Set(reportRows.map((r) => r.content_id))]
        let postRows: ReportedPostRow[] = []
        if (contentIds.length > 0) {
          const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select('id, content, user_id, is_hidden, hidden_reason, version')
            .in('id', contentIds)
          // A failed read must not pass for "post deleted" (post_hidden stays null only when the
          // read succeeded without that row), so it surfaces like a failed reports read.
          if (postsError) throw postsError

          postRows = (posts ?? []) as ReportedPostRow[]
        }

        setGroups(buildReportGroups(reportRows, postRows))

        // Load removed & held posts
        const { data: hiddenPostsData } = await supabase
          .from('posts')
          .select('id, is_hidden, content, created_at, hidden_at, hidden_reason, user_id, version')
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

  // After a conflict (the author edited) or a gone post: read the post again so the queue shows the
  // version the next decision is made on (its text, hidden state and version), or that it is gone.
  const rereadPost = async (postId: string) => {
    const { data, error: readError } = await supabase
      .from('posts')
      .select('id, user_id, content, is_hidden, hidden_reason, version')
      .eq('id', postId)
      .maybeSingle()
    if (readError) return
    const row = data as ReportedPostRow | null
    setGroups((prev) =>
      prev.map((g) =>
        g.content_id !== postId
          ? g
          : row
            ? { ...g, post_user_id: row.user_id ?? g.post_user_id, post_hidden_reason: row.hidden_reason ?? null, post_content: row.content?.slice(0, 200) ?? null, post_hidden: row.is_hidden !== false, post_version: row.version ?? null }
            : { ...g, post_content: null, post_hidden: null, post_version: null },
      ),
    )
    setHeldPosts((prev) =>
      row
        ? prev.map((p) => (p.id === postId ? { ...p, content: row.content, is_hidden: row.is_hidden !== false, version: row.version ?? null } : p))
        : prev.filter((p) => p.id !== postId),
    )
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleResolve = useCallback(
    async (reportId: string, action: 'dismiss' | 'uphold', expectedVersion: number | null, postId: string) => {
      setProcessingId(reportId)
      setError(null)
      try {
        const { error: rpcError, requestId } = await privilegedRpc(
          supabase,
          'admin.report.resolve',
          'admin_resolve_report',
          // The version on screen: an author edit since the queue loaded is refused (PT409) instead of
          // being published by a dismissal nobody reviewed.
          { p_report_id: reportId, p_action: action, p_expected_version: expectedVersion ?? undefined },
          { action: `report.${action}`, target_id: reportId },
        )
        if (rpcError) {
          logger.warn('admin.denied', { action: `report.${action}`, code: rpcError.code ?? 'unknown', request_id: requestId })
          if (rpcError.code === '42501' && /self_moderation_refused/.test(rpcError.message)) {
            // Dismissing reports on their own content: another moderator has to review it.
            setError(moderationFailure(rpcError).message)
            return
          }
          if (rpcError.code === 'PT409' || rpcError.code === 'PT404') {
            // Show the post as it is now (or that it is gone) before the moderator decides again.
            const failure = moderationFailure(rpcError)
            await rereadPost(postId)
            setError(failure.message)
            return
          }
          throw rpcError
        }

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

  // Remove / Hold / Authorize: the shared post moderation path (post-moderation-actions.ts), the
  // same one the single-post view uses. Remove and Hold take the post out of the reports list;
  // Authorize takes it out of "Removed & Held Posts".
  const handlePostAction = useCallback(
    async (action: PostModerationAction, postId: string, expectedVersion: number | null) => {
      setProcessingId(postId)
      setError(null)
      const result = await moderatePost(supabase, action, postId, expectedVersion)
      if (!result.ok) {
        if (result.conflict || result.gone) await rereadPost(postId)
        setError(result.message)
      } else {
        if (action === 'authorize') setHeldPosts((prev) => prev.filter((p) => p.id !== postId))
        else setGroups((prev) => prev.filter((g) => g.content_id !== postId))
        onPostChanged?.(postId)
      }
      setProcessingId(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onPostChanged]
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
        <div role="alert" data-testid="reports-queue-error" className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
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
        // The moderator's own post: another moderator resolves its reports, and a removal by
        // another moderator is not softened to a hold (the database refuses both).
        const canResolve = canResolveReportsOn(group.post_user_id, viewerId)
        const canHold = canResolve || group.post_hidden_reason !== 'admin_removal'
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
                  <div className="mt-1">
                    <MemberViewLink
                      to={{ kind: 'post', id: group.content_id }}
                      visibility={groupPostVisibility(group)}
                      label="View post"
                      itemName={postItemName(group.post_content)}
                      source="reports_queue"
                    />
                  </div>
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
                    className={`h-9 min-h-[44px] text-xs ${DESTRUCTIVE_BUTTON_CLASS}`}
                    disabled={processingId === group.content_id}
                    onClick={() => handlePostAction('remove', group.content_id, group.post_version)}
                    data-testid={`remove-post-${group.content_id}`}
                  >
                    {processingId === group.content_id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    Remove Post
                  </Button>
                  {canHold && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 min-h-[44px] text-xs"
                    disabled={processingId === group.content_id}
                    onClick={() => handlePostAction('hold', group.content_id, group.post_version)}
                    data-testid={`hold-post-${group.content_id}`}
                  >
                    {processingId === group.content_id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Hold for Review
                  </Button>
                  )}
                </div>
                {!canResolve && (
                  <p className="text-xs text-stone-600" data-testid={`own-post-note-${group.content_id}`}>
                    This is your own post: another moderator reviews its reports.
                  </p>
                )}

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
                      {canResolve && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] text-xs"
                          disabled={processingId === report.id}
                          onClick={() => handleResolve(report.id, 'dismiss', group.post_version, group.content_id)}
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
                      )}
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    <span className="font-medium">
                      {post.hidden_reason === 'admin_removal' ? 'Removed' : 'Held for Review'}
                    </span>
                    <span>
                      {post.hidden_at ? new Date(post.hidden_at).toLocaleDateString() : ''}
                    </span>
                    <MemberViewLink
                      to={{ kind: 'post', id: post.id }}
                      visibility={postVisibility(post)}
                      label="View post"
                      itemName={postItemName(post.content)}
                      source="held_posts"
                    />
                  </div>
                  {post.hidden_reason === 'hold_for_review' && canResolveReportsOn(post.user_id, viewerId) && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`authorize-post-${post.id}`}
                      onClick={() => handlePostAction('authorize', post.id, post.version)}
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
