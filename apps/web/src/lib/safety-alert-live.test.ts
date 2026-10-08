import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { whereSafetyAlertLive } from './safety-alert-live'

// Records the filter calls a PostgREST builder receives and applies them to rows,
// so the rule is checked by its outcome (which alerts an admin sees), not its shape.
interface Row { id: string; status: string; expires_at: string }
function fakeQuery(rows: Row[]) {
  let kept = rows
  const calls: string[] = []
  const q = {
    eq(column: 'status', value: 'live') {
      calls.push(`eq:${column}:${value}`)
      kept = kept.filter((r) => r[column] === value)
      return q
    },
    gt(column: 'expires_at', value: string) {
      calls.push(`gt:${column}`)
      kept = kept.filter((r) => Date.parse(r[column]) > Date.parse(value))
      return q
    },
    ids: () => kept.map((r) => r.id),
    calls,
  }
  return q
}

const NOW = new Date('2026-10-08T19:12:00.000Z')
const ROWS: Row[] = [
  { id: 'live-future', status: 'live', expires_at: '2026-10-08T21:12:00.000Z' },
  { id: 'live-past', status: 'live', expires_at: '2026-10-08T19:07:00.000Z' }, // expired, job not yet run
  { id: 'live-boundary', status: 'live', expires_at: '2026-10-08T19:12:00.000Z' },
  { id: 'expired', status: 'expired', expires_at: '2026-10-08T18:00:00.000Z' },
  { id: 'removed-future', status: 'removed', expires_at: '2026-10-09T19:12:00.000Z' },
]

describe('whereSafetyAlertLive — admin "live" = status live AND expires_at > now', () => {
  it('keeps only live, unexpired alerts (a past-expiry row the job has not reached yet is hidden)', () => {
    const q = whereSafetyAlertLive(fakeQuery(ROWS), NOW)
    expect(q.ids()).toEqual(['live-future'])
    expect(q.calls).toEqual(['eq:status:live', 'gt:expires_at'])
  })

  it('an alert stays visible until its expiry instant passes', () => {
    const before = new Date('2026-10-08T19:06:59.999Z')
    expect(whereSafetyAlertLive(fakeQuery(ROWS), before).ids()).toEqual(['live-future', 'live-past', 'live-boundary'])
  })
})

describe('admin safety-alert reads go through the one rule', () => {
  const read = (f: string) => readFileSync(path.join(__dirname, '../app/(admin)/moderation', f), 'utf8')

  it.each(['safety-alerts-review.tsx', 'overview-tab.tsx'])('%s filters safety_alerts with whereSafetyAlertLive', (file) => {
    const src = read(file)
    expect(src).toMatch(/whereSafetyAlertLive\(\s*supabase\s*\.from\('safety_alerts'\)/)
    expect(src).not.toMatch(/from\('safety_alerts'\)[^;]*?\.eq\('status',\s*'live'\)/)
  })
})
