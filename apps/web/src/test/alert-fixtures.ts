// apps/web/src/test/alert-fixtures.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Test-only: one fixed clock, one alert, and a recording Supabase client for the safety-alert tests.
// The client answers each RPC name from a queue (or a fixed answer) and records name, arguments and
// the x-request-id header, for both call styles the app uses (reads: .abortSignal(); writes through
// privilegedRpc: .setHeader()).

import type { SafetyAlert } from '@/lib/safety-alert-rpc'

export const NOW = Date.parse('2026-10-11T12:00:00.000Z')
export const HOUR = 3600_000
export const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

export const ALERT_ID = '55555555-5555-4555-8555-555555555555'

/** The verdict a server whose clock reads NOW gives a row (specs/r3-contract.md: shown_state, shown_until). */
export function serverVerdict(row: { status: string; expires_at: string; resolved_at: string | null }, serverNow: number = NOW): Pick<SafetyAlert, 'shown_state' | 'shown_until'> {
  if (row.status === 'live' && Date.parse(row.expires_at) > serverNow) return { shown_state: 'live', shown_until: row.expires_at }
  if (row.status === 'resolved' && row.resolved_at) {
    const until = Date.parse(row.resolved_at) + 6 * HOUR
    return { shown_state: until > serverNow ? 'resolved' : 'gone', shown_until: new Date(until).toISOString() }
  }
  return { shown_state: 'gone', shown_until: row.status === 'resolved' ? null : row.expires_at }
}

/** An alert as the server (clock = NOW) returns it. The verdict follows the row unless a test sets
 *  `shown_state` / `shown_until` itself (a server that disagrees with the browser's clock). */
export const alert = (over: Partial<SafetyAlert> = {}): SafetyAlert => {
  const row = {
    id: ALERT_ID,
    alert_type: 'road_closure' as const,
    severity: 2,
    description: 'Bridge out' as string | null,
    lng: -72.97,
    lat: 43.61,
    status: 'live',
    confirm_count: 1,
    clear_count: 0,
    created_at: iso(-HOUR),
    expires_at: iso(5 * HOUR),
    verified: false,
    is_mine: false,
    version: 1,
    updated_at: null,
    update_count: 0,
    resolved_at: null as string | null,
    resolved_by_role: null,
    ...over,
  }
  return { ...serverVerdict(row), ...row }
}

export type RpcAnswer = { data?: unknown; error?: { code?: string; message: string; details?: string } | null }
export interface RpcCall {
  name: string
  args: Record<string, unknown>
  headers: Record<string, string>
  /** The signal the caller bounded the call with, when it did. */
  signal?: AbortSignal
}

export interface RpcBackend {
  calls: RpcCall[]
  /** Per RPC name: a fixed answer, or a function called for each call (queue, delay, fail…). */
  answers: Record<string, RpcAnswer | ((args: Record<string, unknown>) => RpcAnswer | Promise<RpcAnswer>)>
  named: (name: string) => RpcCall[]
  reset: () => void
}

export function createRpcBackend(): RpcBackend {
  const backend: RpcBackend = {
    calls: [],
    answers: {},
    named: (name) => backend.calls.filter((c) => c.name === name),
    reset: () => {
      backend.calls.length = 0
      backend.answers = {}
    },
  }
  return backend
}

/** A Supabase client whose only method is rpc(), backed by `backend`. */
export function rpcClient(backend: RpcBackend) {
  return {
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      const call: RpcCall = { name, args, headers: {} }
      backend.calls.push(call)
      const answer = backend.answers[name]
      const result = Promise.resolve(typeof answer === 'function' ? answer(args) : answer).then((a) => ({ data: null, error: null, ...(a ?? {}) }))
      // An aborted call answers as supabase-js does: an error result with no SQLSTATE.
      let aborted: Promise<{ data: null; error: { message: string; code: string } }> | null = null
      const builder = {
        setHeader: (k: string, v: string) => {
          call.headers[k] = v
          return builder
        },
        abortSignal: (signal?: AbortSignal) => {
          if (signal) {
            call.signal = signal
            aborted = new Promise((resolve) => {
              const done = () => resolve({ data: null, error: { message: 'TimeoutError: The operation timed out.', code: '' } })
              if (signal.aborted) done()
              else signal.addEventListener('abort', done)
            })
          }
          return builder
        },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => (aborted ? Promise.race([result, aborted]) : result).then(res, rej),
      }
      return builder
    },
  }
}
