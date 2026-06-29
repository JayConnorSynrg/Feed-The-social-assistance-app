/**
 * Shared structured logger for FEED edge functions (Deno runtime).
 *
 * - Zero external dependencies — uses console.log + crypto.randomUUID.
 * - Emits a single JSON line per call (Supabase log drain captures it).
 * - Provides a correlation-id helper that reads x-request-id or mints a short
 *   fallback id so every request can be traced across client → edge → app_logs.
 */

/**
 * Emit a single structured JSON log line to stdout.
 * Supabase edge function log drain captures every console.log line.
 *
 * @param level - severity label ('info' | 'warn' | 'error')
 * @param event - dot-namespaced event name, e.g. 'discover.request.complete'
 * @param data  - optional flat key-value pairs merged into the log line
 */
export function edgeLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown> = {},
): void {
  console.log(
    JSON.stringify({
      level,
      event,
      ts: new Date().toISOString(),
      ...data,
    }),
  )
}

/**
 * Read the x-request-id header from a Request (set by the client or API gateway)
 * and return it as the correlation id. When absent or blank, mints a short random
 * id (8 hex chars) so every request has a traceable id without requiring callers
 * to set the header.
 *
 * The returned id is safe to log and pass back to the client as a response header.
 */
export function getCorrelationId(req: Request): string {
  const fromHeader = req.headers.get('x-request-id')?.trim()
  if (fromHeader) return fromHeader
  // crypto.randomUUID() is available in Deno 1.x + Node 19+.
  return crypto.randomUUID().slice(0, 8)
}
