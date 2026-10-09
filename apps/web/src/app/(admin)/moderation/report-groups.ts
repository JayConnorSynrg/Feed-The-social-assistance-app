// apps/web/src/app/(admin)/moderation/report-groups.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure model for the moderation reports queue: open reports grouped per reported post, enriched with
// that post's text and hidden state, and whether members can open the post right now (the "View post"
// link or its reason). No React, so the grouping and the visibility rule are unit-testable.

import { postVisibility, type MemberVisibility } from '@/lib/member-visibility'

export interface ReportRow {
  id: string
  reporter_id: string
  content_type: string
  content_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
}

export interface ContentGroup {
  content_id: string
  post_content: string | null
  post_author: string | null
  /** True unless the post's is_hidden is exactly false; null when the post row was not returned (deleted). */
  post_hidden: boolean | null
  /** posts.version the moderator is looking at (sent as p_expected_version); null when not read. */
  post_version: number | null
  reports: ReportRow[]
}

export interface ReportedPostRow {
  id: string
  content: string | null
  is_hidden: boolean | null
  version?: number | null
}

/** Groups open reports by reported post (first-report order), then fills in each post's text and
 *  hidden state from the posts read. A group whose post was not returned keeps post_hidden = null. */
export function buildReportGroups(reports: ReportRow[], posts: ReportedPostRow[]): ContentGroup[] {
  const groupMap = new Map<string, ContentGroup>()
  for (const report of reports) {
    let group = groupMap.get(report.content_id)
    if (!group) {
      group = { content_id: report.content_id, post_content: null, post_author: null, post_hidden: null, post_version: null, reports: [] }
      groupMap.set(report.content_id, group)
    }
    group.reports.push(report)
  }
  for (const post of posts) {
    const group = groupMap.get(post.id)
    if (!group) continue
    group.post_content = post.content?.slice(0, 200) ?? null
    // /s/post/[id] reads is_hidden=false only, so a NULL is_hidden is hidden from members too.
    group.post_hidden = post.is_hidden !== false
    group.post_version = post.version ?? null
  }
  return Array.from(groupMap.values())
}

/** Whether members can open the group's post at /s/post/<id>. */
export function groupPostVisibility(group: Pick<ContentGroup, 'post_hidden'>): MemberVisibility {
  return postVisibility(group.post_hidden === null ? null : { is_hidden: group.post_hidden })
}
