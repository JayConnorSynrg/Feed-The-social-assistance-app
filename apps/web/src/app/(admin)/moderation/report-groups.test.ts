// apps/web/src/app/(admin)/moderation/report-groups.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Reports queue model (I2): a reported post offers "View post" only when members can open it —
// /s/post/[id] reads is_hidden=false, so a NULL is_hidden counts as hidden, and a post the read did
// not return counts as gone. Grouping keeps first-report order and every report.

import { describe, it, expect } from 'vitest'
import { buildReportGroups, groupPostVisibility, type ReportRow } from './report-groups'

const report = (id: string, content_id: string): ReportRow => ({
  id, reporter_id: 'u', content_type: 'post', content_id, reason: 'spam', details: null, status: 'open', created_at: '2026-10-08T00:00:00Z',
})

describe('buildReportGroups + groupPostVisibility', () => {
  it('groups reports per post in first-report order', () => {
    const groups = buildReportGroups([report('r1', 'p1'), report('r2', 'p2'), report('r3', 'p1')], [])
    expect(groups.map((g) => [g.content_id, g.reports.map((r) => r.id)])).toEqual([['p1', ['r1', 'r3']], ['p2', ['r2']]])
  })

  it('is_hidden=false → visible; true → hidden; NULL → hidden; not returned → no longer exists', () => {
    const groups = buildReportGroups(
      [report('r1', 'shown'), report('r2', 'hidden'), report('r3', 'null'), report('r4', 'gone')],
      [
        { id: 'shown', content: 'a', is_hidden: false },
        { id: 'hidden', content: 'b', is_hidden: true },
        { id: 'null', content: 'c', is_hidden: null },
      ],
    )
    const vis = Object.fromEntries(groups.map((g) => [g.content_id, groupPostVisibility(g)]))
    expect(vis.shown).toEqual({ visible: true })
    expect(vis.hidden).toEqual({ visible: false, reason: 'hidden' })
    expect(vis.null).toEqual({ visible: false, reason: 'hidden' })
    expect(vis.gone).toEqual({ visible: false, reason: 'not_found' })
  })

  it('keeps the first 200 characters of the post text', () => {
    const [g] = buildReportGroups([report('r1', 'p1')], [{ id: 'p1', content: 'x'.repeat(300), is_hidden: false }])
    expect(g.post_content).toHaveLength(200)
  })
})
