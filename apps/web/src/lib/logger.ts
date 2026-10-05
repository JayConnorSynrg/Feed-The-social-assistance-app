/**
 * Structured logging utility for the FEED platform.
 *
 * - Zero dependencies -- wraps the built-in console API with JSON output.
 * - Works in Node.js (API routes), Edge Runtime, and the browser.
 * - Includes request timing via `logger.time()` and error serialization.
 * - First-party sink only: warn/error levels, withMetric wide-events and
 *   logEvent() product events are persisted to FEED's own Supabase `app_logs`
 *   table (fire-and-forget, never throws, never slows the caller). No
 *   third-party telemetry vendor receives any of it.
 * - Browser rows go through /api/client-log, which accepts only event names in
 *   EVENT_REGISTRY (src/lib/event-registry.ts) and drops unknown label keys.
 */

import { runWithMetric, serializeError } from './with-metric-core.mjs'

// ============================================
// Server-side Supabase log sink
// ============================================

/**
 * Fire-and-forget insert into public.app_logs.
 * - On the SERVER (Node.js runtime): writes directly via service-role client.
 *   The per-request correlation id set by the proxy (`x-request-id`) is read
 *   from next/headers when a request scope is active, so every server log row
 *   written during one request shares one correlation id (I4).
 * - On the CLIENT (browser): posts to /api/client-log with keepalive:true so
 *   the request survives navigation and the event is not lost on redirect. The
 *   route derives user_id server-side from the cookie session (never trusted
 *   from the client body).
 * Wrapped in try/catch: a log write must NEVER throw or await in the caller.
 *
 * `duration_ms` (nullable) lands in its own column so latency is queryable per
 * operation. `level` accepts 'info' so completion wide-events persist (I1).
 *
 * Both paths enforce the same closed vocabulary: the browser route and the
 * server branch below run sanitizeClientEvent (EVENT_REGISTRY), so an
 * unregistered event writes no row and only registered label keys — flat
 * primitives, strings capped, error_message <= 120 chars on error rows — are
 * stored. The registry is imported lazily on the server so it stays out of the
 * client bundle.
 */
function sinkToSupabase(
  level: 'info' | 'warn' | 'error',
  event: string,
  context?: Record<string, unknown>,
  request_id?: string,
  duration_ms?: number
): void {
  if (typeof window !== 'undefined') {
    // Browser path — fire-and-forget via the client-log API route.
    // keepalive:true ensures the request is not cancelled on navigation.
    try {
      fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        // Forward the caller's correlation id so the persisted client row is
        // not orphaned (request_id != null). The route treats request_id as a
        // non-security field and still derives user_id from the cookie session.
        body: JSON.stringify({ level, event, context, duration_ms, request_id }),
      }).catch(() => {
        // Swallow network errors — logging must never surface to the caller.
      })
    } catch {
      // Swallow synchronous errors (e.g. JSON.stringify failure).
    }
    return
  }

  // Server path — write directly via service-role client.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  // Detached promise — intentionally not awaited so callers are never blocked.
  Promise.resolve().then(async () => {
    try {
      // Correlate with the proxy-stamped request id when inside a request scope.
      // next/headers is server-only; the AsyncLocalStorage request context
      // propagates through this microtask. Absent a request scope it throws —
      // swallowed, request_id stays whatever the caller passed (usually none).
      let rid = request_id
      if (!rid) {
        try {
          const { headers } = await import('next/headers')
          const h = await headers()
          rid = h.get('x-request-id') ?? undefined
        } catch {
          // Not in a request scope (e.g. cron/startup) — no correlation id.
        }
      }
      const { sanitizeClientEvent } = await import('./event-registry')
      const checked = sanitizeClientEvent(event, level, context)
      if (!checked.ok) return // unregistered event: no row
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      await client.from('app_logs').insert({
        level,
        event,
        context: checked.context,
        request_id: rid,
        duration_ms: duration_ms ?? null,
      })
    } catch {
      // Swallow unconditionally — logging must never break a request.
    }
  })
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: string
  duration_ms?: number
  user_id?: string
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

function emit(entry: LogEntry) {
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[MIN_LEVEL]) return

  const method =
    entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log'

  // eslint-disable-next-line no-console
  console[method](JSON.stringify(entry))
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) =>
    emit({ level: 'debug', message, timestamp: new Date().toISOString(), ...data }),

  info: (message: string, data?: Record<string, unknown>) =>
    emit({ level: 'info', message, timestamp: new Date().toISOString(), ...data }),

  warn: (message: string, data?: Record<string, unknown>) => {
    emit({ level: 'warn', message, timestamp: new Date().toISOString(), ...data })
    sinkToSupabase('warn', message, data)
  },

  /**
   * Log an error. `error` may be an Error, a Supabase/PostgREST `{ code, message }`
   * object, a string, or absent; it is normalized by serializeError so the
   * persisted row carries `error_code` (the SQLSTATE when present) and a capped
   * `error_message` instead of "[object Object]". The stack goes to the console
   * only. `opts.requestId` pins the row's correlation id when no request scope is
   * active (e.g. instrumentation onRequestError).
   */
  error: (
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
    opts?: { requestId?: string }
  ) => {
    const errorFields = serializeError(error)
    const stack =
      error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined
    emit({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...errorFields,
      stack,
      ...data,
    })
    sinkToSupabase('error', message, { ...errorFields, ...data }, opts?.requestId)
  },

  /**
   * Start a timer for an operation. Returns an object with `.end()` and
   * `.error()` to emit a structured log entry with `duration_ms`.
   *
   * ```ts
   * const t = logger.time('db.query.users')
   * const rows = await db.select(...)
   * t.end({ row_count: rows.length })
   * ```
   */
  time: (context: string) => {
    const start = performance.now()
    return {
      end: (data?: Record<string, unknown>) => {
        const duration_ms = Math.round(performance.now() - start)
        emit({
          level: 'info',
          message: `${context} completed`,
          timestamp: new Date().toISOString(),
          context,
          duration_ms,
          ...data,
        })
        return duration_ms
      },
      error: (error: unknown, data?: Record<string, unknown>) => {
        const duration_ms = Math.round(performance.now() - start)
        emit({
          level: 'error',
          message: `${context} failed`,
          timestamp: new Date().toISOString(),
          context,
          duration_ms,
          error_name: error instanceof Error ? error.name : undefined,
          error_message: error instanceof Error ? error.message : String(error),
          ...data,
        })
        return duration_ms
      },
    }
  },
}

// ============================================
// Correlation utilities
// ============================================

/**
 * Generate a short random operation ID for correlating multi-step operations
 * across client logs and edge function logs.
 */
export function createOpId(): string {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * Wrap an async operation with structured start/complete/error logging and
 * automatic duration tracking. Re-throws on error — never swallows exceptions.
 */
export async function withTiming<T>(
  operation: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  const opId = createOpId()
  logger.info(`${operation}.start`, { ...context, opId })
  try {
    const result = await fn()
    logger.info(`${operation}.complete`, {
      ...context,
      opId,
      duration_ms: Math.round(performance.now() - start),
    })
    return result
  } catch (error) {
    logger.error(`${operation}.error`, error, {
      ...context,
      opId,
      duration_ms: Math.round(performance.now() - start),
    })
    throw error
  }
}

/** Flat, primitive label set for a persisted event. */
export type EventAttrs = Record<string, string | number | boolean | null>

/**
 * Record a named product event as a persisted first-party info row in app_logs
 * (browser: via /api/client-log; server: via the service-role sink). Unlike
 * logger.info — which is console-only — this event is stored. `name` must be in
 * EVENT_REGISTRY or the client-log route rejects it; labels outside the
 * registry's key list for that event are dropped. Never throws.
 */
export function logEvent(name: string, attrs: EventAttrs = {}): void {
  emit({ level: 'info', message: name, timestamp: new Date().toISOString(), ...attrs })
  sinkToSupabase(
    'info',
    name,
    { ...attrs },
    typeof window !== 'undefined' ? createOpId() : undefined
  )
}

/**
 * Time an async operation, emitting a structured log AND persisting exactly one
 * first-party wide-event row to app_logs (`<operation>.complete` with
 * duration_ms, or `<operation>.error` with error_code/error_message), so
 * latency/error signals are queryable in production (where `debug` and raw
 * timing logs are suppressed). Re-throws on error — never swallows.
 *
 * Signature and argument order are a stable contract: (operation, attrs, fn,
 * explicitRequestId?). `attrs` are flat primitive labels.
 */
export async function withMetric<T>(
  operation: string,
  attrs: EventAttrs,
  fn: () => Promise<T>,
  // Optional caller-supplied correlation id. When a privileged client call mints one request id
  // and sends it as x-request-id (so the durable admin_actions row and this app_logs row share
  // it), pass the same id here. Omitted -> preserve prior behavior (mint on client, undefined on
  // server so sinkToSupabase reads the proxy-stamped header).
  explicitRequestId?: string
): Promise<T> {
  // Client operations have no server request scope, so mint a per-op
  // correlation id that ties this operation's persisted wide-event row back to
  // the op (I5). On the server, request_id stays undefined so sinkToSupabase
  // reads the proxy-stamped x-request-id (I4) — server correlation is unchanged.
  const requestId = explicitRequestId ?? (typeof window !== 'undefined' ? createOpId() : undefined)
  // The guarded body lives in with-metric-core.mjs so the shipped path and the
  // node:test suite exercise the SAME code. Real emit/sink wired here.
  return runWithMetric(
    // `emit` requires a full LogEntry; the core's dep slot is intentionally
    // broader. The core only ever calls it with a valid LogEntry-shaped object,
    // so this boundary cast is safe and keeps runtime behavior unchanged.
    { emit: emit as (entry: Record<string, unknown>) => void, sink: sinkToSupabase },
    operation,
    attrs,
    fn,
    requestId
  ) as Promise<T>
}
