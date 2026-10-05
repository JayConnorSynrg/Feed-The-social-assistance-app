// event-registry.test.ts
// Registry completeness: every event name the app emits must be in EVENT_REGISTRY,
// so the closed-vocabulary /api/client-log route never drops a legitimate event.
//
// The scan (event-scan.mjs) reads every logger.debug/info/warn/error, withMetric
// (as <op>.complete / <op>.error), privilegedRpc / privilegedFetch op and logEvent
// call in apps/web/src. Rare-path events (failure branches, opt-in toggles) never
// show up in production app_logs, so this scan is their only way into the registry.
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { scanEvents } from './event-scan.mjs'
import { EVENT_REGISTRY } from '../event-registry'

const SRC = fileURLToPath(new URL('../..', import.meta.url))
const { sites, dynamic } = scanEvents(SRC) as {
  sites: Array<{ callee: string; name: string; file: string; line: number; persisted: boolean }>
  dynamic: Array<{ callee: string; file: string; line: number }>
}

describe('EVENT_REGISTRY completeness', () => {
  it('CONTROL: the scan is aimed at the real source (finds known call sites)', () => {
    const names = new Set(sites.map((s) => s.name))
    // withMetric('conversations.request', ...) in hooks/use-conversations.ts
    expect(names.has('conversations.request.complete')).toBe(true)
    expect(names.has('conversations.request.error')).toBe(true)
    // logger.warn in hooks/use-admin-tier.ts; logEvent in address-autocomplete.tsx
    expect(names.has('admin.tier.check_failed')).toBe(true)
    expect(sites.some((s) => s.callee === 'logEvent' && s.name === 'admin.resource.autocomplete')).toBe(true)
    expect(sites.length).toBeGreaterThan(300)
  })

  it('every scanned event name is registered', () => {
    const missing = [...new Set(sites.filter((s) => !(s.name in EVENT_REGISTRY)).map((s) => `${s.name}  (${s.file}:${s.line})`))]
    expect(missing).toEqual([])
  })

  it('rare-path events named by the Settings / messaging owners are registered', () => {
    for (const name of [
      'conversations.request.complete',
      'conversations.request.error',
      'conversations.request.blocked',
      'messages.send.complete',
      'messages.send.error',
      'allow_messages.read_failed',
      'allow_messages.changed',
      'allow_messages.write_failed',
      'notif.pref.read_failed',
      'notif.pref.changed',
      'notif.pref.write_failed',
      'geo.optin.toggled',
      'a11y.pref.changed',
    ]) {
      expect(EVENT_REGISTRY, name).toHaveProperty([name])
    }
  })

  it('only the known wrapper definitions emit a non-literal event name', () => {
    // Each entry is a function DEFINITION or a pass-through wrapper whose callers
    // are themselves scanned. A new dynamic call site must be reviewed and added
    // here (and its possible names registered).
    const allowed = new Map<string, number>([
      ['lib/audit-logger.ts|logEvent', 1], // AuditLogger.logEvent method (audit table, not app_logs)
      ['lib/logger.ts|logger.info', 2], // withTiming `${operation}.start/.complete` (no callers)
      ['lib/logger.ts|logger.error', 1], // withTiming `${operation}.error` (no callers)
      ['lib/logger.ts|logEvent', 1], // logEvent definition
      ['lib/logger.ts|withMetric', 1], // withMetric definition
      ['lib/privileged-action.ts|privilegedRpc', 1], // definition; callers scanned via op arg
      ['lib/privileged-action.ts|privilegedFetch', 1], // definition; callers scanned via op arg
      ['lib/privileged-action.ts|withMetric', 2], // forwards the caller's op
    ])
    const counts = new Map<string, number>()
    for (const d of dynamic) {
      const key = `${d.file.split('\\').join('/')}|${d.callee}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(Object.fromEntries(counts)).toEqual(Object.fromEntries(allowed))
  })

  it('registered label keys never include direct personal identifiers', () => {
    const banned = ['userId', 'user_id', 'email', 'address', 'bounds', 'storagePath', 'path', 'query', 'signerId']
    const offenders = Object.entries(EVENT_REGISTRY).filter(([, keys]) => keys.some((k) => banned.includes(k)))
    expect(offenders).toEqual([])
  })
})
