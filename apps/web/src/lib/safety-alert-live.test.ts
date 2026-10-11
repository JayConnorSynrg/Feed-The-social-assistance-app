// apps/web/src/lib/safety-alert-live.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 1 — one rule, every surface:
//   - the rule itself: live while status = 'live' AND expires_at > now; resolved (shown, never live)
//     for exactly six hours after resolved_at; everything else gone — at the instants that matter;
//   - the query form of its live half (the admin overview count);
//   - the tree: no file reads alerts except through lib/safety-alert-rpc.ts (the reader) or, for the
//     one head count, whereSafetyAlertLive; no file writes its own "is it live" comparison.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  RESOLVED_SHOWN_MS,
  alertShownState,
  alertShownUntil,
  isAlertLive,
  isAlertShown,
  whereSafetyAlertLive,
} from './safety-alert-live'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const HOUR = 3600_000

describe('alertShownState — live / resolved / gone', () => {
  it('live: status live and not past its expiry (gone at the expiry instant itself)', () => {
    expect(alertShownState({ status: 'live', expires_at: at(1) }, NOW)).toBe('live')
    expect(alertShownState({ status: 'live', expires_at: at(0) }, NOW)).toBe('gone')
    expect(alertShownState({ status: 'live', expires_at: at(-1) }, NOW)).toBe('gone')
  })

  it('resolved: shown for exactly six hours after resolved_at, and never live', () => {
    const resolved = (agoMs: number) => ({ status: 'resolved', expires_at: at(24 * HOUR), resolved_at: at(-agoMs) })
    expect(RESOLVED_SHOWN_MS).toBe(6 * HOUR)
    expect(alertShownState(resolved(0), NOW)).toBe('resolved')
    expect(alertShownState(resolved(6 * HOUR - 1), NOW)).toBe('resolved')
    expect(alertShownState(resolved(6 * HOUR), NOW)).toBe('gone')
    // Its expiry may still be in the future: it is not live all the same.
    expect(isAlertLive(resolved(0), NOW)).toBe(false)
    expect(isAlertShown(resolved(0), NOW)).toBe(true)
    // A resolved row without its resolved_at cannot be placed in the window: gone.
    expect(alertShownState({ status: 'resolved', expires_at: at(HOUR), resolved_at: null }, NOW)).toBe('gone')
  })

  it.each(['expired', 'cleared', 'removed', 'withdrawn', 'ended', ''])('status %j is gone whatever its dates say', (status) => {
    expect(alertShownState({ status, expires_at: at(24 * HOUR), resolved_at: at(-1) }, NOW)).toBe('gone')
    expect(isAlertShown({ status, expires_at: at(24 * HOUR) }, NOW)).toBe(false)
  })

  it('alertShownUntil: the expiry while live, resolved_at + 6 h once resolved, nothing when gone', () => {
    expect(alertShownUntil({ status: 'live', expires_at: at(2 * HOUR) }, NOW)).toBe(NOW + 2 * HOUR)
    expect(alertShownUntil({ status: 'resolved', expires_at: at(24 * HOUR), resolved_at: at(-HOUR) }, NOW)).toBe(NOW + 5 * HOUR)
    expect(alertShownUntil({ status: 'cleared', expires_at: at(HOUR) }, NOW)).toBeNull()
  })
})

// Records the filter calls a PostgREST builder receives and applies them to rows,
// so the rule is checked by its outcome (which alerts are counted), not its shape.
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

describe('whereSafetyAlertLive — the live half as a query (the admin overview count)', () => {
  const ROWS: Row[] = [
    { id: 'live-future', status: 'live', expires_at: at(2 * HOUR) },
    { id: 'live-past', status: 'live', expires_at: at(-5 * 60_000) }, // expired, job not yet run
    { id: 'live-boundary', status: 'live', expires_at: at(0) },
    { id: 'resolved', status: 'resolved', expires_at: at(2 * HOUR) },
    { id: 'removed-future', status: 'removed', expires_at: at(24 * HOUR) },
  ]

  it('counts only live, unexpired alerts: a resolved alert is never counted as live', () => {
    const q = whereSafetyAlertLive(fakeQuery(ROWS), new Date(NOW))
    expect(q.ids()).toEqual(['live-future'])
    expect(q.calls).toEqual(['eq:status:live', 'gt:expires_at'])
  })

  it('agrees with alertShownState on every row', () => {
    const live = whereSafetyAlertLive(fakeQuery(ROWS), new Date(NOW)).ids()
    expect(ROWS.filter((r) => isAlertLive(r, NOW)).map((r) => r.id)).toEqual(live)
  })
})

// ---- The tree ---------------------------------------------------------------------------------

const SRC = path.join(__dirname, '..')
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'test') continue
      sourceFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|smoke)\.tsx?$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}
const FILES = sourceFiles(SRC).map((file) => ({ rel: path.relative(SRC, file).split(path.sep).join('/'), text: readFileSync(file, 'utf8') }))
const naming = (pattern: RegExp) => FILES.filter((f) => pattern.test(f.text)).map((f) => f.rel).sort()

describe('every alert read goes through the one rule (source scan of apps/web/src)', () => {
  it('control: the scan sees the tree', () => {
    expect(FILES.length).toBeGreaterThan(300)
    expect(FILES.some((f) => f.rel === 'components/panels/feed-panel.tsx')).toBe(true)
  })

  it('the alert reader RPC is called in exactly one file', () => {
    expect(naming(/['"`]safety_alerts_in_view['"`]/)).toEqual(['lib/safety-alert-rpc.ts'])
    expect(naming(/['"`]safety_alert_history['"`]/)).toEqual(['lib/safety-alert-rpc.ts'])
  })

  it('the safety_alerts table is read in exactly one place: the admin overview count, through whereSafetyAlertLive', () => {
    expect(naming(/from\(\s*['"`]safety_alerts['"`]/)).toEqual(['app/(admin)/moderation/overview-tab.tsx'])
    const overview = FILES.find((f) => f.rel === 'app/(admin)/moderation/overview-tab.tsx')!.text
    expect(overview).toMatch(/whereSafetyAlertLive\(\s*supabase\s*\.from\('safety_alerts'\)\.select\('id', \{ count: 'exact', head: true \}\)/)
    expect(overview.match(/from\('safety_alerts'\)/g)).toHaveLength(1)
  })

  it('no alert file writes its own "is it live / resolved" test: a status is compared to them only in the rule module', () => {
    // alert.status === 'live', a.status !== 'resolved', .eq('status', 'live') … anywhere but the rule.
    const own = /\bstatus\s*[!=]==?\s*['"`](live|resolved)['"`]|\.eq\(\s*['"`]status['"`]\s*,\s*['"`]live['"`]/
    const alertFiles = FILES.filter((f) => /safety[-_]?alert|safety-strip|hazard|components\/alerts\//i.test(f.rel) || /\bSafetyAlert\b/.test(f.text))
    expect(alertFiles.length).toBeGreaterThan(15)
    expect(alertFiles.filter((f) => f.rel !== 'lib/safety-alert-live.ts' && own.test(f.text)).map((f) => f.rel)).toEqual([])
    // Control: the pattern does find such a comparison (the rule module has them).
    expect(own.test(FILES.find((f) => f.rel === 'lib/safety-alert-live.ts')!.text)).toBe(true)
  })

  it('every surface that draws an alert asks the rule', () => {
    for (const rel of [
      'components/feed/safety-strip.tsx',
      'components/map/safety-alert-marker.tsx',
      'app/(admin)/moderation/safety-alerts-review.tsx',
      'lib/map-focus.ts',
      'lib/member-visibility.ts',
      'lib/safety-alert-store.ts',
      'lib/safety-alert-rpc.ts',
    ]) {
      const text = FILES.find((f) => f.rel === rel)?.text ?? ''
      expect(text, rel).toMatch(/from ['"](?:@\/lib|\.)\/safety-alert-live['"]/)
      expect(text, rel).toMatch(/\b(alertShownState|isAlertShown|isAlertLive)\(/)
    }
  })

  it('the feed panel no longer reads alerts itself: it mounts the strip hook', () => {
    const panel = FILES.find((f) => f.rel === 'components/panels/feed-panel.tsx')!.text
    expect(panel).not.toMatch(/safety_alerts/)
    expect(panel).not.toMatch(/is_mine/)
    expect(panel).toMatch(/useSafetyStrip\(authLoading \? null : user\?\.id \?\? 'signed-out', focusFeedTitle\)/)
  })
})
