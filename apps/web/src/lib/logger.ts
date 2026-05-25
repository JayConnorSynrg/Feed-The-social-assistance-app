/**
 * Structured logging utility for the FEED platform.
 *
 * - Zero dependencies -- wraps the built-in console API with JSON output.
 * - Vercel Log Drain captures console.log/warn/error automatically.
 * - Works in Node.js (API routes), Edge Runtime, and the browser.
 * - Includes request timing via `logger.time()` and error serialization.
 */

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

  warn: (message: string, data?: Record<string, unknown>) =>
    emit({ level: 'warn', message, timestamp: new Date().toISOString(), ...data }),

  error: (message: string, error?: unknown, data?: Record<string, unknown>) =>
    emit({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      error_name: error instanceof Error ? error.name : undefined,
      error_message: error instanceof Error ? error.message : String(error),
      stack:
        error instanceof Error
          ? error.stack?.split('\n').slice(0, 5).join('\n')
          : undefined,
      ...data,
    }),

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
