/**
 * Structured logging utility for the FEED platform.
 *
 * - Zero dependencies -- wraps the built-in console API with JSON output.
 * - Vercel Log Drain captures console.log/warn/error automatically.
 * - Works in Node.js (API routes), Edge Runtime, and the browser.
 * - Includes request timing via `logger.time()` and error serialization.
 * - Server-side sink: warn/error levels are persisted to app_logs in Supabase
 *   via service-role client (fire-and-forget, never throws, never slows caller).
 */

import { track } from '@vercel/analytics'

// ============================================
// Server-side Supabase log sink
// ============================================

/**
 * Fire-and-forget insert into public.app_logs.
 * Runs only on the server (Node.js runtime, not browser/Edge).
 * Uses SUPABASE_SERVICE_ROLE_KEY — if absent, silently skips.
 * Wrapped in try/catch: a log write must NEVER throw or await in the caller.
 */
function sinkToSupabase(
  level: 'warn' | 'error',
  event: string,
  context?: Record<string, unknown>,
  request_id?: string
): void {
  // Guard: server-only
  if (typeof window !== 'undefined') return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  // Detached promise — intentionally not awaited so callers are never blocked.
  Promise.resolve().then(async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      await client.from('app_logs').insert({ level, event, context, request_id })
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

  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    const entry = {
      level: 'error' as const,
      message,
      timestamp: new Date().toISOString(),
      error_name: error instanceof Error ? error.name : undefined,
      error_message: error instanceof Error ? error.message : String(error),
      stack:
        error instanceof Error
          ? error.stack?.split('\n').slice(0, 5).join('\n')
          : undefined,
      ...data,
    }
    emit(entry)
    const { level: _l, message: _m, timestamp: _t, ...contextFields } = entry
    sinkToSupabase('error', message, { ...contextFields, ...data })
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

/**
 * Time an async operation, emitting a structured log AND a Vercel analytics
 * event so latency/error signals are visible in production (where `debug` and
 * raw timing logs are suppressed). Re-throws on error — never swallows.
 *
 * `track()` accepts only flat primitive props (string | number | boolean |
 * null). AbortError outcomes are NOT failures (Next.js aborts in-flight fetch
 * on re-render), so the analytics event is skipped for them.
 */
export async function withMetric<T>(
  operation: string,
  attrs: Record<string, string | number | boolean | null>,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration_ms = Math.round(performance.now() - start)
    logger.info(`${operation}.complete`, { ...attrs, duration_ms })
    track(operation, { ...attrs, duration_ms, ok: true })
    return result
  } catch (error) {
    const duration_ms = Math.round(performance.now() - start)
    const error_code = error instanceof Error ? error.name : 'UnknownError'
    logger.error(`${operation}.error`, error, { ...attrs, duration_ms, error_code })
    if (error_code !== 'AbortError') {
      track(operation, { ...attrs, duration_ms, ok: false, error_code })
    }
    throw error
  }
}
