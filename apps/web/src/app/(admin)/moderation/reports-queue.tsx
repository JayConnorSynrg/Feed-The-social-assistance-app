'use client'

import { useState, useCallback } from 'react'
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

interface ReportsQueueProps {
  initialGroups: ContentGroup[]
}

export function ReportsQueue({ initialGroups }: ReportsQueueProps) {
  const [groups, setGroups] = useState<ContentGroup[]>(initialGroups)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

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
    [supabase]
  )

  if (groups.length === 0) {
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
      <p className="text-sm text-muted-foreground">
        {groups.length} post{groups.length !== 1 ? 's' : ''} with open reports
      </p>

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
                          className="h-7 text-xs"
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
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={processingId === report.id}
                          onClick={() => handleResolve(report.id, 'uphold')}
                          data-testid={`uphold-report-${report.id}`}
                        >
                          {processingId === report.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Uphold
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
    </div>
  )
}
