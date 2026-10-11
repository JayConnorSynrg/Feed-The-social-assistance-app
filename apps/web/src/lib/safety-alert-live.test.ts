// apps/web/src/lib/safety-alert-live.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 1 — one rule, every surface, and the SERVER decides:
//   - the predicate returns the verdict the server put on the row (shown_state), whatever the
//     browser clock says: a live row stays live on a clock that is hours ahead, a row the server
//     calls gone is gone on a clock that is hours behind;
//   - the rule on a clock (live while status = 'live' AND expires_at > now; resolved for exactly six
//     hours) exists only as the fallback for a row with no verdict, at the instants that matter;
//   - the tree: no file reads alerts except through lib/safety-alert-rpc.ts (the reader); no file
//     writes its own "is it live" comparison; no surface hands the predicate a clock.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  RESOLVED_SHOWN_MS,
  alertShownState,
  alertShownUntil,
  hasServerShownState,
  isAlertLive,
  isAlertShown,
  isResolvedStatus,
  localShownState,
} from './safety-alert-live'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const HOUR = 3600_000

describe('alertShownState — the server’s verdict, on any browser clock', () => {
  const CLOCKS = [NOW - 24 * HOUR, NOW - 10 * 60_000, NOW, NOW + 10 * 60_000, NOW + 2 * HOUR, NOW + 3 * HOUR]

  it.each(CLOCKS)('browser clock %d: a row the server calls live is live, though its expiry is behind or ahead of that clock', (clock) => {
    const row = { status: 'live', expires_at: at(HOUR), resolved_at: null, shown_state: 'live', shown_until: at(HOUR) }
    expect(alertShownState(row, clock)).toBe('live')
    expect(isAlertLive(row, clock)).toBe(true)
    expect(isAlertShown(row, clock)).toBe(true)
  })

  it.each(CLOCKS)('browser clock %d: a row the server calls resolved is resolved and never live', (clock) => {
    const row = { status: 'resolved', expires_at: at(24 * HOUR), resolved_at: at(-5 * HOUR - 55 * 60_000), shown_state: 'resolved', shown_until: at(5 * 60_000) }
    expect(alertShownState(row, clock)).toBe('resolved')
    expect(isAlertLive(row, clock)).toBe(false)
    expect(isAlertShown(row, clock)).toBe(true)
  })

  it.each(CLOCKS)('browser clock %d: a row the server calls gone is gone, though its dates look live on that clock', (clock) => {
    const row = { status: 'live', expires_at: at(-30_000), resolved_at: null, shown_state: 'gone', shown_until: at(-30_000) }
    expect(alertShownState(row, clock)).toBe('gone')
    expect(isAlertShown(row, clock)).toBe(false)
  })

  it('alertShownUntil is the server’s instant for a shown row, and nothing for a gone one', () => {
    expect(alertShownUntil({ status: 'live', expires_at: at(2 * HOUR), shown_state: 'live', shown_until: at(2 * HOUR) })).toBe(NOW + 2 * HOUR)
    expect(alertShownUntil({ status: 'resolved', expires_at: at(24 * HOUR), resolved_at: at(-HOUR), shown_state: 'resolved', shown_until: at(5 * HOUR) })).toBe(NOW + 5 * HOUR)
    expect(alertShownUntil({ status: 'cleared', expires_at: at(HOUR), shown_state: 'gone', shown_until: at(HOUR) })).toBeNull()
    expect(alertShownUntil({ status: 'live', expires_at: at(HOUR), shown_state: 'live', shown_until: null })).toBeNull()
  })

  it('a refusal’s status: resolved (still shown) or not', () => {
    expect(isResolvedStatus('resolved')).toBe(true)
    for (const status of ['live', 'expired', 'cleared', 'removed', 'withdrawn', null, undefined]) expect(isResolvedStatus(status)).toBe(false)
  })
})

describe('the fallback rule — only for a row that carries no verdict', () => {
  it('a row without shown_state (or with a value the client does not know) has no server verdict', () => {
    expect(hasServerShownState({ shown_state: 'live' })).toBe(true)
    expect(hasServerShownState({ shown_state: 'gone' })).toBe(true)
    for (const v of [undefined, null, '', 'pending']) expect(hasServerShownState({ shown_state: v })).toBe(false)
    // …and falls back to the clock it is given.
    expect(alertShownState({ status: 'live', expires_at: at(1) }, NOW)).toBe('live')
    expect(alertShownState({ status: 'live', expires_at: at(1), shown_state: 'pending' }, NOW + 2)).toBe('gone')
  })

  it('live: status live and not past its expiry (gone at the expiry instant itself)', () => {
    expect(localShownState({ status: 'live', expires_at: at(1) }, NOW)).toBe('live')
    expect(localShownState({ status: 'live', expires_at: at(0) }, NOW)).toBe('gone')
    expect(localShownState({ status: 'live', expires_at: at(-1) }, NOW)).toBe('gone')
  })

  it('resolved: shown for exactly six hours after resolved_at, and never live', () => {
    const resolved = (agoMs: number) => ({ status: 'resolved', expires_at: at(24 * HOUR), resolved_at: at(-agoMs) })
    expect(RESOLVED_SHOWN_MS).toBe(6 * HOUR)
    expect(localShownState(resolved(0), NOW)).toBe('resolved')
    expect(localShownState(resolved(6 * HOUR - 1), NOW)).toBe('resolved')
    expect(localShownState(resolved(6 * HOUR), NOW)).toBe('gone')
    expect(localShownState({ status: 'resolved', expires_at: at(HOUR), resolved_at: null }, NOW)).toBe('gone')
  })

  it.each(['expired', 'cleared', 'removed', 'withdrawn', 'ended', ''])('status %j is gone whatever its dates say', (status) => {
    expect(localShownState({ status, expires_at: at(24 * HOUR), resolved_at: at(-1) }, NOW)).toBe('gone')
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

  it('the safety_alerts table is read by no client file (the admin overview counts through the reader too)', () => {
    expect(naming(/from\(\s*['"`]safety_alerts['"`]/)).toEqual([])
    const overview = FILES.find((f) => f.rel === 'app/(admin)/moderation/overview-tab.tsx')!.text
    expect(overview).toMatch(/countLiveSafetyAlerts\(supabase\)/)
  })

  it('no surface hands the predicate a clock, and none compares an alert’s dates with the browser’s', () => {
    // alertShownState(alert, now) / isAlertShown(x, Date.now()) … outside the rule module and the two
    // files that format a row with no server verdict (the wrapper's logged fallback; the admin
    // visibility helper, whose rows carry the verdict).
    const withClock = /\b(alertShownState|isAlertShown|isAlertLive)\(\s*[^(),]+,/
    const ownClock = /Date\.parse\([^)]*\b(expires_at|resolved_at|shown_until)\)\s*[<>]=?\s*(now|Date\.now\(\)|clock)/
    const allowed = new Set(['lib/safety-alert-live.ts', 'lib/member-visibility.ts'])
    const offenders = FILES.filter((f) => !allowed.has(f.rel) && (withClock.test(f.text) || ownClock.test(f.text))).map((f) => f.rel)
    expect(offenders).toEqual([])
    // Control: the patterns do match such code.
    expect(withClock.test('if (isAlertShown(alert, Date.now())) keep(alert)')).toBe(true)
    expect(ownClock.test('Date.parse(a.expires_at) > now')).toBe(true)
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

  it('the map-focus link reads the alert through the reader by id (the reader returns only what the server shows)', () => {
    const focus = FILES.find((f) => f.rel === 'lib/map-focus.ts')!.text
    expect(focus).toMatch(/const alert = await readSafetyAlertById\(supabase, id, signal\)/)
  })
})
