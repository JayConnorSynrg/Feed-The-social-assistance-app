// privacy-logging.test.ts — first-party logging foundation.
// Each block asserts an outcome (what a persisted row / RPC call / source tree
// actually contains) through the shipped modules.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { withMetric, logger, logEvent } from '@/lib/logger'
import { privilegedRpc } from '@/lib/privileged-action'
import { loadAdminTier } from '@/hooks/use-admin-tier'
import { installClientErrorCapture, MAX_REPORTS_PER_SESSION } from '@/lib/client-error-capture'

type Posted = { level: string; event: string; context: Record<string, unknown>; request_id?: string; duration_ms?: number }
let posted: Posted[] = []

// Browser path of the logger: rows go to /api/client-log via fetch.
beforeEach(() => {
  posted = []
  vi.stubGlobal('window', {})
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: { body: string }) => {
      if (url === '/api/client-log') posted.push(JSON.parse(init.body))
      return Promise.resolve(new Response('{}'))
    })
  )
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('withMetric — signature and argument order unchanged', () => {
  it('an existing caller shape withMetric(op, attrs, fn) returns fn result and persists one .complete row', async () => {
    const out = await withMetric('feed.load', { mode: 'ranked', page: 0 }, async () => 'rows')
    expect(out).toBe('rows')
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ level: 'info', event: 'feed.load.complete', context: { mode: 'ranked', page: 0 } })
    expect(typeof posted[0].duration_ms).toBe('number')
    expect(typeof posted[0].request_id).toBe('string')
  })

  it('the optional 4th explicitRequestId is still honored', async () => {
    await withMetric('admin.tier.set', {}, async () => 1, 'rid-fixed-1')
    expect(posted[0].request_id).toBe('rid-fixed-1')
  })
})

describe('error serialization — Supabase {code,message} and SQLSTATE error_code', () => {
  it('logger.error with a PostgREST error object persists code + message, never "[object Object]"', () => {
    logger.error('feed.posts.fetch_failed', { code: '42501', message: 'permission denied for table posts', details: null })
    expect(posted[0].context).toMatchObject({ error_code: '42501', error_message: 'permission denied for table posts' })
    expect(JSON.stringify(posted[0])).not.toContain('[object Object]')
  })

  it('logger.error with no error value persists no "undefined" message', () => {
    logger.error('realtime-feed.subscribe.status', undefined, { status: 'CHANNEL_ERROR' })
    expect(posted[0].context.error_message).toBeUndefined()
    expect(posted[0].context.error_code).toBe('UnknownError')
  })

  it('withMetric failure row carries the SQLSTATE as error_code', async () => {
    await expect(withMetric('feed.load', {}, async () => { throw { code: '57014', message: 'canceling statement due to statement timeout' } })).rejects.toBeTruthy()
    expect(posted[0]).toMatchObject({ level: 'error', event: 'feed.load.error' })
    expect(posted[0].context.error_code).toBe('57014')
  })

  it('privilegedRpc failure row carries the RPC SQLSTATE, not PrivilegedRpcError', async () => {
    const supa = { rpc: () => ({ setHeader: () => Promise.resolve({ data: null, error: { code: '42501', message: 'denied' } }) }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await privilegedRpc(supa as any, 'admin.tier.set', 'admin_set_tier', {})
    expect(res.error).toEqual({ code: '42501', message: 'denied' })
    expect(posted[0]).toMatchObject({ level: 'error', event: 'admin.tier.set.error' })
    expect(posted[0].context.error_code).toBe('42501')
  })
})

describe('logEvent — a persisted first-party info event', () => {
  it('posts one info row with its labels (logger.info stays console-only)', () => {
    logger.info('admin.resource.autocomplete', { query_len: 3 })
    expect(posted).toHaveLength(0)
    logEvent('admin.resource.autocomplete', { query_len: 9, result_count: 5, outcome: 'suggest' })
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ level: 'info', event: 'admin.resource.autocomplete', context: { query_len: 9, result_count: 5, outcome: 'suggest' } })
  })
})

describe('useAdminTier — no tier RPC for logged-out visitors or guests', () => {
  const rpcClient = () => {
    const calls: string[] = []
    return {
      calls,
      client: { rpc: (fn: 'current_user_tier' | 'is_founder') => { calls.push(fn); return Promise.resolve({ data: fn === 'is_founder' ? false : 'steward', error: null }) } },
    }
  }

  it('logged out: zero RPC calls, no tier', async () => {
    const { calls, client } = rpcClient()
    expect(await loadAdminTier(client, null)).toEqual({ tier: null, isFounder: false })
    expect(calls).toEqual([])
  })

  it('guest (anonymous auth): zero RPC calls, no tier', async () => {
    const { calls, client } = rpcClient()
    expect(await loadAdminTier(client, { id: 'g1', is_anonymous: true })).toEqual({ tier: null, isFounder: false })
    expect(calls).toEqual([])
  })

  it('signed-in member: calls both RPCs and returns the tier', async () => {
    const { calls, client } = rpcClient()
    expect(await loadAdminTier(client, { id: 'u1', is_anonymous: false })).toEqual({ tier: 'steward', isFounder: false })
    expect(calls.sort()).toEqual(['current_user_tier', 'is_founder'])
  })
})

describe('client error capture — de-duplicated', () => {
  function fakeWindow() {
    const handlers: Record<string, (e: Event) => void> = {}
    return {
      handlers,
      target: {
        addEventListener: (t: string, l: (e: Event) => void) => { handlers[t] = l },
        removeEventListener: (t: string) => { delete handlers[t] },
      },
    }
  }

  it('reports a repeated error once per window and caps a session', () => {
    const { handlers, target } = fakeWindow()
    const reports: string[] = []
    let t = 0
    installClientErrorCapture(target, (event) => reports.push(event), () => t)
    for (let i = 0; i < 50; i++) handlers.error({ error: new Error('loop') } as unknown as Event)
    expect(reports).toEqual(['client.window.error'])

    for (let i = 0; i < 100; i++) handlers.unhandledrejection({ reason: new Error(`distinct ${i}`) } as unknown as Event)
    expect(reports.length).toBe(MAX_REPORTS_PER_SESSION)
  })

  it('skips AbortError rejections', () => {
    const { handlers, target } = fakeWindow()
    const reports: string[] = []
    installClientErrorCapture(target, (event) => reports.push(event))
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    handlers.unhandledrejection({ reason: abort } as unknown as Event)
    expect(reports).toEqual([])
  })
})

// ── No third-party telemetry vendor remains ────────────────────────────────────
const WEB = fileURLToPath(new URL('../../..', import.meta.url))
const REPO = path.resolve(WEB, '../..')
function listFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(p))
    else if (/\.(ts|tsx|mjs|js|md)$/.test(e.name)) out.push(p)
  }
  return out
}
const THIS_FILE = fileURLToPath(import.meta.url)
const sourceFiles = listFiles(path.join(WEB, 'src')).filter((f) => f !== THIS_FILE)
function hits(re: RegExp, files: string[] = sourceFiles): string[] {
  return files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(WEB, f))
}
// Built by concatenation so this file never contains the literal it searches for.
const SENTRY = new RegExp('sen' + 'try', 'i')
const VA = new RegExp('@vercel/' + 'analytics')
const SI = new RegExp('@vercel/' + 'speed-insights')
const TRACK = new RegExp('(?<![\\w.$])' + 'track' + '\\(')

describe('no third-party telemetry vendor remains', () => {
  it('CONTROL: the same search finds a string known to exist', () => {
    expect(hits(/withMetric\(/).length).toBeGreaterThan(10)
    expect(sourceFiles.length).toBeGreaterThan(200)
  })

  it('no Sentry, Vercel Analytics, Speed Insights or track( in apps/web/src', () => {
    expect(hits(SENTRY)).toEqual([])
    expect(hits(VA)).toEqual([])
    expect(hits(SI)).toEqual([])
    expect(hits(TRACK)).toEqual([])
  })

  it('every react-map-gl <Map> disables mapbox-gl performance telemetry', () => {
    const mapFiles = sourceFiles.filter((f) => /from 'react-map-gl/.test(fs.readFileSync(f, 'utf8')))
    const openings: Array<{ file: string; tag: string }> = []
    for (const f of mapFiles) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(/<Map\b[\s\S]*?>/g)) openings.push({ file: path.relative(WEB, f), tag: m[0] })
    }
    // control: the scan sees the app's map
    expect(openings.map((o) => o.file)).toContain('src/components/map/map-view.tsx')
    expect(openings.filter((o) => !o.tag.includes('performanceMetricsCollection={false}')).map((o) => o.file)).toEqual([])
  })

  it('no vendor package in apps/web/package.json, the root lockfile, or the observability doc', () => {
    const pkg = fs.readFileSync(path.join(WEB, 'package.json'), 'utf8')
    const lock = fs.readFileSync(path.join(REPO, 'package-lock.json'), 'utf8')
    const doc = fs.readFileSync(path.join(REPO, 'docs/observability.md'), 'utf8')
    for (const text of [pkg, lock]) {
      expect(SENTRY.test(text)).toBe(false)
      expect(VA.test(text)).toBe(false)
      expect(SI.test(text)).toBe(false)
    }
    expect(SENTRY.test(doc)).toBe(false)
    // control: the lockfile search does see a dependency that is installed
    expect(lock).toContain('@supabase/supabase-js')
  })
})
