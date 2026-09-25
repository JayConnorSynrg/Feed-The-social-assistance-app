'use client'

// apps/web/src/lib/privileged-action.ts
// Single choke point for every privileged client call (T5). Each call mints ONE request id, sends
// it as x-request-id (via .setHeader for RPCs, as a header for the /api/admin fetches), and wraps
// the call in withMetric with the SAME id — so the durable admin_actions row (keyed on request_id
// via public.request_id()) and the app_logs latency/error telemetry share one correlation id.
//
// Every privileged RPC (admin_*, approve_resource, reject_resource, admin_update_resource,
// set_resource_location_by_id, approve_form_template, admin_set_tier) and the ban/delete routes go
// through here. A source-level guard test (privileged-action.guard.test.ts) proves no privileged
// call site bypasses it.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { withMetric } from '@/lib/logger'

type Attrs = Record<string, string | number | boolean | null>
type RpcResult<T = unknown> = { data: T | null; error: { code?: string; message: string } | null }

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
 * `rpcName`/`args` are passed straight to supabase.rpc; the result is `{ data, error }` plus the
 * `requestId` used, so callers can surface it in denial logs.
 */
export async function privilegedRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  op: string,
  rpcName: string,
  args: Record<string, unknown> = {},
  attrs: Attrs = {},
): Promise<RpcResult<T> & { requestId: string }> {
  const requestId = newRequestId()
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
      return (await withHeader) as RpcResult<T>
    },
    requestId,
  )
  return { ...result, requestId }
}

/**
 * Call a privileged /api/admin endpoint with a fresh request id as x-request-id, shared with
 * withMetric. The route reads the header and stamps it on the admin_actions row it writes.
 */
export async function privilegedFetch(
  op: string,
  url: string,
  init: RequestInit = {},
  attrs: Attrs = {},
): Promise<{ response: Response; requestId: string }> {
  const requestId = newRequestId()
  const response = await withMetric(
    op,
    { ...attrs, request_id: requestId },
    () =>
      fetch(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), 'x-request-id': requestId },
      }),
    requestId,
  )
  return { response, requestId }
}
