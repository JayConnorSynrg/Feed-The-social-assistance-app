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

export const alert = (over: Partial<SafetyAlert> = {}): SafetyAlert => ({
  id: ALERT_ID,
  alert_type: 'road_closure',
  severity: 2,
  description: 'Bridge out',
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
  resolved_at: null,
  ...over,
})

export type RpcAnswer = { data?: unknown; error?: { code?: string; message: string; details?: string } | null }
export interface RpcCall {
  name: string
  args: Record<string, unknown>
  headers: Record<string, string>
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
      const builder = {
        setHeader: (k: string, v: string) => {
          call.headers[k] = v
          return builder
        },
        abortSignal: () => builder,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => result.then(res, rej),
      }
      return builder
    },
  }
}
