/**
 * Core withMetric logic — the single source of truth for the metric wrapper.
 *
 * The shipped `withMetric` (src/lib/logger.ts) delegates to `runWithMetric`
 * here, wiring the real `emit` / `sinkToSupabase` / `track` as deps. The
 * node:test suite imports this SAME module and injects capture stubs, so the
 * test exercises the actual shipped code path (Node cannot import the .ts
 * logger under `node --test`). A regression in this body — a double-write or a
 * dropped sink call — turns the guard RED because both paths run it.
 *
 * Behavior is byte-for-byte identical to the prior inline implementation:
 * success emits + persists EXACTLY ONE info wide-event row (I1); failure emits
 * + persists EXACTLY ONE error wide-event row (I1); AbortError re-throws but
 * skips the analytics event; the operation always re-throws on error.
 */

/**
 * @template T
 * @param {{
 *   emit: (entry: Record<string, unknown>) => void,
 *   sink: (level: 'info' | 'warn' | 'error', event: string, context?: Record<string, unknown>, request_id?: string, duration_ms?: number) => void,
 *   track: (name: string, props: Record<string, string | number | boolean | null>) => void,
 * }} deps
 * @param {string} operation
 * @param {Record<string, string | number | boolean | null>} attrs
 * @param {() => Promise<T>} fn
 * @param {string} [requestId] Correlation id forwarded to the sink. Undefined on
 *   the server so the sink reads the proxy-stamped x-request-id (I4); a per-op id
 *   on the client so the persisted wide-event row is not orphaned (I5).
 * @returns {Promise<T>}
 */
export async function runWithMetric(deps, operation, attrs, fn, requestId) {
  const { emit, sink, track } = deps
  const start = performance.now()
  try {
    const result = await fn()
    const duration_ms = Math.round(performance.now() - start)
    const event = `${operation}.complete`
    // Console (Vercel Log Drain) AND exactly one persisted info wide-event row
    // carrying duration_ms (I1). The sink is the sole persist path — success
    // writes exactly one row and never also an error row.
    emit({ level: 'info', message: event, timestamp: new Date().toISOString(), ...attrs, duration_ms })
    sink('info', event, { ...attrs }, requestId, duration_ms)
    track(operation, { ...attrs, duration_ms, ok: true })
    return result
  } catch (error) {
    const duration_ms = Math.round(performance.now() - start)
    const error_code = error instanceof Error ? error.name : 'UnknownError'
    const event = `${operation}.error`
    const ctx = {
      ...attrs,
      error_code,
      error_message: error instanceof Error ? error.message : String(error),
    }
    // A failed operation still records its outcome — exactly one persisted error
    // wide-event row carrying duration_ms (I1). No double write: this is the only
    // sink on the failure path.
    emit({ level: 'error', message: event, timestamp: new Date().toISOString(), ...ctx, duration_ms })
    sink('error', event, ctx, requestId, duration_ms)
    if (error_code !== 'AbortError') {
      track(operation, { ...attrs, duration_ms, ok: false, error_code })
    }
    throw error
  }
}
