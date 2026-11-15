'use client'

// apps/web/src/app/(admin)/moderation/reports-queue.tsx
// The reports queue and the Removed & Held list, in the admin's language (lib/i18n-admin-moderation.ts;
// report reasons are reportReasonLabel, the words members chose them by). Member-written text — the
// post, the report's details, the author's name — keeps its own language and direction
// (lang="" dir="auto"). A failed read shows the admin's sentence and writes one
// admin.reports.load_failed row with the error's code (never its text).
// Keyboard and screen reader: the queue has ONE status region and ONE alert, mounted from the first
// render (loading, empty or full) and changing only their text, so every result is announced. When
// an action takes a row away, the next place to stand is chosen first (focusAfterRemoval) and focused
// once the list has changed: the next card's toggle, else the Removed & Held heading, else the empty
// state's heading.

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { postStatusLabel } from './focused-post'
import type { Locale } from '@/lib/i18n'
import { dateTimeFormatter, formatDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { REPORT_REASONS, reportReasonLabel, type ReportReason } from '@/lib/i18n-feed-card'
import { POSTS_WITH_REPORTS, REPORT_COUNT, adminModerationT, moderationActionDone, moderationActionLabel, moderationCount } from '@/lib/i18n-admin-moderation'

/** A report's reason in the admin's language; a code outside the enum is shown as stored, marked English. */
function ReasonText({ reason, locale }: { reason: string; locale: Locale }) {
  return (REPORT_REASONS as readonly string[]).includes(reason) ? (
    <>{reportReasonLabel(reason as ReportReason, locale)}</>
  ) : (
    <span lang="en" dir="ltr">{reason}</span>
  )
}

/** Where focus goes after an action took a row away. */
export type QueueFocus = { kind: 'toggle'; id: string } | { kind: 'held' } | { kind: 'empty' }

/**
 * The next place to stand, decided BEFORE the row goes (the pressed button goes with it):
 *   - a report dismissed and its card stays: that card's toggle;
 *   - a card leaves (Remove, Hold, its last report dismissed): the next card's toggle, else the
 *     Removed & Held heading;
 *   - a held post leaves (Authorize): the Removed & Held heading;
 *   - and when nothing is left at all: the empty state's heading.
 */
export function focusAfterRemoval(
  groups: ReadonlyArray<Pick<ContentGroup, 'content_id'> & { reports: ReadonlyArray<{ id: string }> }>,
  heldIds: readonly string[],
  removed: { group: string } | { report: string; group: string } | { held: string },
): QueueFocus {
  if ('held' in removed) {
    const heldLeft = heldIds.filter((id) => id !== removed.held).length
    return groups.length === 0 && heldLeft === 0 ? { kind: 'empty' } : { kind: 'held' }
  }
  const at = groups.findIndex((g) => g.content_id === removed.group)
  const cardStays = 'report' in removed && (groups[at]?.reports.some((r) => r.id !== removed.report) ?? false)
  if (cardStays) return { kind: 'toggle', id: removed.group }
  const next = groups.slice(at + 1)[0]
  if (next) return { kind: 'toggle', id: next.content_id }
  const groupsLeft = groups.filter((g) => g.content_id !== removed.group).length
  return groupsLeft === 0 && heldIds.length === 0 ? { kind: 'empty' } : { kind: 'held' }
}

/** The code of a failed read for the log row: PostgREST's own code, else the error's class. */
function failureCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === 'string' && code) return code
  return err instanceof Error ? err.name : 'unknown'
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
export function ReportsQueue({
  onPostChanged,
  viewerId = null,
  locale = 'en',
}: { onPostChanged?: (postId: string) => void; viewerId?: string | null; locale?: Locale } = {}) {
  const [groups, setGroups] = useState<ContentGroup[]>([])
  const [heldPosts, setHeldPosts] = useState<HeldPost[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The queue's one status line: loading, then the result of the last action.
  const [announcement, setAnnouncement] = useState('')
  // The lists as rendered, for the memoised handlers below.
  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const heldRef = useRef(heldPosts)
  heldRef.current = heldPosts
  // Focus after a row leaves: chosen before the update, applied after it.
  const focusTarget = useRef<QueueFocus | null>(null)
  const toggles = useRef(new Map<string, HTMLButtonElement>())
  const heldHeading = useRef<HTMLHeadingElement | null>(null)
  const emptyHeading = useRef<HTMLHeadingElement | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const target = focusTarget.current
    if (!target) return
    focusTarget.current = null
    // After the browser has laid out the changed list (a timer where there is no frame loop).
    const nextFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: () => void) => setTimeout(f, 0)
    nextFrame(() => {
      const node =
        target.kind === 'toggle' ? toggles.current.get(target.id) : target.kind === 'held' ? heldHeading.current : emptyHeading.current
      node?.focus()
    })
  }, [groups, heldPosts])

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
        // The filter above admits only is_hidden = true rows with a hold / removal reason; the
        // generated row type cannot express that (is_hidden and created_at are nullable columns), so
        // the rows are narrowed to HeldPost here.
        if (hiddenPostsData) setHeldPosts(hiddenPostsData as HeldPost[])
      } catch (err) {
        // No other row records this read: one row with the code; the message is not logged (a
        // PostgREST message can quote the values it was given).
        logger.warn('admin.reports.load_failed', { code: failureCode(err) })
        setError(adminModerationT(locale, 'loadFailed'))
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

  const timeZone = browserTimeZone()
  const formatReportTime = (iso: string) =>
    dateTimeFormatter(locale, timeZone, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

  const handleResolve = useCallback(
    async (reportId: string, action: 'dismiss' | 'uphold', expectedVersion: number | null, postId: string) => {
      setProcessingId(reportId)
      setError(null)
      setAnnouncement('')
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
            setError(moderationFailure(rpcError, locale).message)
            return
          }
          if (rpcError.code === 'PT409' || rpcError.code === 'PT404') {
            // Show the post as it is now (or that it is gone) before the moderator decides again.
            const failure = moderationFailure(rpcError, locale)
            await rereadPost(postId)
            setError(failure.message)
            return
          }
          throw rpcError
        }

        // Remove the resolved report; if group is now empty remove the group
        focusTarget.current = focusAfterRemoval(groupsRef.current, heldRef.current.map((p) => p.id), { report: reportId, group: postId })
        setAnnouncement(adminModerationT(locale, 'doneDismiss'))
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              reports: g.reports.filter((r) => r.id !== reportId),
            }))
            .filter((g) => g.reports.length > 0)
        )
      } catch {
        // A refusal thrown above already wrote its admin.denied row (and withMetric its error row).
        setError(adminModerationT(locale, 'errorGeneric'))
      } finally {
        setProcessingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  )

  // Remove / Hold / Authorize: the shared post moderation path (post-moderation-actions.ts), the
  // same one the single-post view uses. Remove and Hold take the post out of the reports list;
  // Authorize takes it out of "Removed & Held Posts".
  const handlePostAction = useCallback(
    async (action: PostModerationAction, postId: string, expectedVersion: number | null) => {
      setProcessingId(postId)
      setError(null)
      setAnnouncement('')
      const result = await moderatePost(supabase, action, postId, expectedVersion, locale)
      if (!result.ok) {
        if (result.conflict || result.gone) await rereadPost(postId)
        setError(result.message)
      } else {
        focusTarget.current = focusAfterRemoval(
          groupsRef.current,
          heldRef.current.map((p) => p.id),
          action === 'authorize' ? { held: postId } : { group: postId },
        )
        setAnnouncement(moderationActionDone(action, locale))
        if (action === 'authorize') setHeldPosts((prev) => prev.filter((p) => p.id !== postId))
        else setGroups((prev) => prev.filter((g) => g.content_id !== postId))
        onPostChanged?.(postId)
      }
      setProcessingId(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onPostChanged, locale]
  )

  // The queue's one status region and one alert: rendered in every state, only their text changes.
  const regions = (
    <>
      <p role="status" data-testid="reports-queue-status" className="sr-only">
        {loading ? adminModerationT(locale, 'loadingReports') : announcement}
      </p>
      <div
        role="alert"
        data-testid="reports-queue-error"
        className={error ? 'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700' : 'sr-only'}
      >
        {error ?? ''}
      </div>
    </>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {regions}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    )
  }

  // Nothing could be read: the failure line alone (not "No open reports", which would be untrue).
  if (error && groups.length === 0 && heldPosts.length === 0) return <div className="space-y-4">{regions}</div>

  if (groups.length === 0 && heldPosts.length === 0) {
    return (
      <div className="space-y-4">
        {regions}
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" aria-hidden="true" />
              <h3
                ref={emptyHeading}
                tabIndex={-1}
                data-testid="reports-queue-empty-heading"
                className="text-lg font-semibold rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
              >
                {adminModerationT(locale, 'emptyTitle')}
              </h3>
              <p className="text-muted-foreground mt-2">{adminModerationT(locale, 'emptyBody')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {regions}
      {groups.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {moderationCount(POSTS_WITH_REPORTS, groups.length, locale)}
        </p>
      )}

      {groups.map((group) => {
        const isExpanded = expandedId === group.content_id
        // The moderator's own post: another moderator resolves its reports, and a removal by
        // another moderator is not softened to a hold (the database refuses both).
        const canResolve = canResolveReportsOn(group.post_user_id, viewerId)
        const canHold = canResolve || group.post_hidden_reason !== 'admin_removal'
        const reportCount = group.reports.length
        const reasons = [...new Set(group.reports.map((r) => r.reason))]

        return (
          <Card key={group.content_id} className="border-orange-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                      <Flag className="h-3 w-3" aria-hidden="true" />
                      {moderationCount(REPORT_COUNT, reportCount, locale)}
                    </span>
                    {reasons.map((r) => (
                      <span
                        key={r}
                        className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600"
                      >
                        <ReasonText reason={r} locale={locale} />
                      </span>
                    ))}
                  </div>
                  {group.post_author && (
                    <CardTitle id={`report-author-${group.content_id}`} className="mt-2 text-sm font-medium text-stone-500">
                      {adminModerationT(locale, 'authorLabel')}{' '}
                      <span lang="" dir="auto">{group.post_author}</span>
                    </CardTitle>
                  )}
                  {group.post_content && (
                    <CardDescription id={`report-excerpt-${group.content_id}`} lang="" dir="auto" className="mt-1 line-clamp-2 break-words">
                      {group.post_content}
                    </CardDescription>
                  )}
                  <div className="mt-1">
                    <MemberViewLink
                      to={{ kind: 'post', id: group.content_id }}
                      visibility={groupPostVisibility(group)}
                      label={adminModerationT(locale, 'viewPost')}
                      locale={locale}
                      itemName={postItemName(group.post_content)}
                      source="reports_queue"
                    />
                  </div>
                </div>
                <Button
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) toggles.current.set(group.content_id, node)
                    else toggles.current.delete(group.content_id)
                  }}
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] shrink-0"
                  aria-expanded={isExpanded}
                  aria-controls={`reports-${group.content_id}`}
                  aria-describedby={
                    [group.post_author && `report-author-${group.content_id}`, group.post_content && `report-excerpt-${group.content_id}`]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  aria-label={adminModerationT(locale, 'reportDetails')}
                  data-testid={`toggle-reports-${group.content_id}`}
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === group.content_id ? null : group.content_id
                    )
                  }
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {/* Always present, so the toggle's aria-controls names an element. */}
            <div id={`reports-${group.content_id}`}>
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
                      <Loader2 className="h-3 w-3 animate-spin me-1" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-3 w-3 me-1" aria-hidden="true" />
                    )}
                    {moderationActionLabel('remove', locale)}
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
                      <Loader2 className="h-3 w-3 animate-spin me-1" aria-hidden="true" />
                    ) : null}
                    {moderationActionLabel('hold', locale)}
                  </Button>
                  )}
                </div>
                {!canResolve && (
                  <p className="text-xs text-stone-600" data-testid={`own-post-note-${group.content_id}`}>
                    {adminModerationT(locale, 'ownPostNote')}
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
                          <ReasonText reason={report.reason} locale={locale} />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatReportTime(report.created_at)}
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
                            <Loader2 className="h-3 w-3 animate-spin me-1" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-3 w-3 me-1 text-stone-500" aria-hidden="true" />
                          )}
                          {adminModerationT(locale, 'actionDismiss')}
                        </Button>
                      </div>
                      )}
                    </div>
                    {report.details && (
                      <p lang="" dir="auto" className="text-xs text-stone-600 leading-relaxed break-words">
                        {report.details}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
            </div>
          </Card>
        )
      })}

      {/* Removed & Held Posts */}
      <div className="mt-8">
        <h3
          ref={heldHeading}
          tabIndex={-1}
          data-testid="reports-queue-held-heading"
          className="text-lg font-semibold mb-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
        >
          {adminModerationT(locale, 'heldTitle')}
        </h3>
        {heldPosts.length === 0 ? (
          <p className="text-stone-600 text-sm">{adminModerationT(locale, 'heldEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {heldPosts.map((post) => (
              <div key={post.id} className="border rounded-lg p-4">
                <p lang="" dir="auto" className="text-sm text-stone-700 line-clamp-2 break-words">
                  {(post.content ?? '').slice(0, 120)}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    <span className="font-medium">
                      {postStatusLabel({ is_hidden: true, hidden_reason: post.hidden_reason === 'admin_removal' ? 'admin_removal' : 'hold_for_review' }, locale)}
                    </span>
                    <span>
                      {post.hidden_at ? formatDate(post.hidden_at, locale, timeZone) : ''}
                    </span>
                    <MemberViewLink
                      to={{ kind: 'post', id: post.id }}
                      visibility={postVisibility(post)}
                      label={adminModerationT(locale, 'viewPost')}
                      locale={locale}
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
                        <Loader2 className="h-3 w-3 animate-spin me-1" aria-hidden="true" />
                      ) : null}
                      {moderationActionLabel('authorize', locale)}
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
