'use client'

// apps/web/src/lib/privileged-action.ts
// Single choke point for every privileged client call (T5). Each call mints ONE request id, sends
// it as x-request-id (via .setHeader for RPCs, as a header for the /api/admin fetches), and wraps
// the call in withMetric with the SAME id — so the durable admin_actions row (keyed on request_id
// via public.request_id()) and the app_logs latency/error telemetry share one correlation id.
//
// A denied or failed call is recorded as a FAILURE (withMetric emits exactly one error-level row
// with ok:false) — a supabase {error} value or a non-ok fetch is thrown INSIDE withMetric so the
// wrapper counts it as a failure, then caught here so the caller still receives the same
// {data, error} / {response} shape it had before.
//
// Every privileged RPC (admin_*, approve_resource, reject_resource, admin_update_resource,
// set_resource_location_by_id, approve_form_template, admin_set_tier) and the ban/delete routes go
// through here. The source-level guard in privileged-action.test.ts proves no privileged call site
// bypasses it (any call form — dot, bracket, alias, template, variable, or a bare route fetch).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { withMetric } from '@/lib/logger'

type Attrs = Record<string, string | number | boolean | null>
type RpcErr = { code?: string; message: string }
type RpcResult<T = unknown> = { data: T | null; error: RpcErr | null }

/** One correlation id per privileged action. */
export function newRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `rid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/**
 * Call a privileged RPC with a fresh request id sent as x-request-id and shared with withMetric.
 * Returns `{ data, error, requestId }`. On a supabase error the wrapper records ONE failure row and
 * the returned `error` is preserved; on success it records ONE info row.
 */
export async function privilegedRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  op: string,
  rpcName: string,
  args: Record<string, unknown> = {},
  attrs: Attrs = {},
): Promise<RpcResult<T> & { requestId: string }> {
  const requestId = newRequestId()
  try {
    const result = await withMetric(
      op,
      { ...attrs, request_id: requestId },
      async () => {
        // supabase.rpc is heavily overloaded by generated types; this file is the ONE controlled
        // boundary that erases the name/arg generics so any privileged RPC can share the plumbing.
        const builder = (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => {
          setHeader?: (k: string, v: string) => unknown
        })(rpcName, args)
        const withHeader =
          typeof builder.setHeader === 'function' ? builder.setHeader('x-request-id', requestId) : builder
        const res = (await withHeader) as RpcResult<T>
        if (res.error) {
          // Throw so withMetric records this as a failure; carry the result to recover it below.
          const e = new Error(res.error.message || 'privileged rpc failed') as Error & { __result?: RpcResult<T> }
          e.name = 'PrivilegedRpcError'
          e.__result = res
          throw e
        }
        return res
      },
      requestId,
    )
    return { ...result, requestId }
  } catch (e) {
    const carried = (e as { __result?: RpcResult<T> }).__result
    if (carried) return { ...carried, requestId } // a supabase {error} — same shape as before
    // A genuine thrown exception (network, etc.): surface it as an error result.
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, requestId }
  }
}

/**
 * Call a privileged /api/admin endpoint with a fresh request id as x-request-id, shared with
 * withMetric. A non-ok response is treated as a FAILURE (one error row) but is still returned to the
 * caller as `{ response, requestId }`. A genuine network error records a failure and re-throws.
 */
export async function privilegedFetch(
  op: string,
  url: string,
  init: RequestInit = {},
  attrs: Attrs = {},
): Promise<{ response: Response; requestId: string }> {
  const requestId = newRequestId()
  try {
    const response = await withMetric(
      op,
      { ...attrs, request_id: requestId },
      async () => {
        const r = await fetch(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string> | undefined), 'x-request-id': requestId },
        })
        if (!r.ok) {
          const e = new Error(`HTTP ${r.status}`) as Error & { __response?: Response }
          e.name = 'PrivilegedFetchError'
          e.__response = r
          throw e
        }
        return r
      },
      requestId,
    )
    return { response, requestId }
  } catch (e) {
    const carried = (e as { __response?: Response }).__response
    if (carried) return { response: carried, requestId } // non-ok HTTP — same shape as before
    throw e // genuine network failure — already recorded; let the caller handle it
  }
}
