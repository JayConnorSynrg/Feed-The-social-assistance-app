/**
 * Core withMetric logic — the single source of truth for the metric wrapper,
 * plus the shared error serializer used by every persisted error row.
 *
 * The shipped `withMetric` (src/lib/logger.ts) delegates to `runWithMetric`
 * here, wiring the real `emit` / `sinkToSupabase` as deps. The node:test suite
 * imports this SAME module and injects capture stubs, so the test exercises the
 * actual shipped code path (Node cannot import the .ts logger under
 * `node --test`). A regression in this body — a double-write or a dropped sink
 * call — turns the guard RED because both paths run it.
 *
 * Success emits + persists EXACTLY ONE info wide-event row (I1); failure emits
 * + persists EXACTLY ONE error wide-event row (I1); the operation always
 * re-throws on error. All telemetry stays first-party: the only persist path is
 * the app_logs sink.
 */

/** Persisted error messages are capped at this many characters. */
export const MAX_ERROR_MESSAGE_LEN = 120

/**
 * Normalize any thrown value into the persisted error fields.
 *
 * - `error_code`: the SQLSTATE / PostgREST code when the value carries a string
 *   `code` (Supabase/PostgREST errors are plain `{ code, message }` objects, and
 *   wrapped errors may carry it too); otherwise the Error's `name`; otherwise
 *   'UnknownError'.
 * - `error_message`: the Error / `{ message }` text or a thrown string, capped at
 *   MAX_ERROR_MESSAGE_LEN. Omitted when the value has no message (so an absent
 *   error never persists the literal "undefined" or "[object Object]").
 * - `error_name`: the Error's `name`, when it is an Error.
 *
 * @param {unknown} error
 * @returns {{ error_code: string, error_message?: string, error_name?: string }}
 */
export function serializeError(error) {
  /** @type {{ error_code: string, error_message?: string, error_name?: string }} */
  const out = { error_code: 'UnknownError' }
  if (error instanceof Error) out.error_name = error.name
  if (error !== null && typeof error === 'object') {
    const { code, message } = /** @type {{ code?: unknown, message?: unknown }} */ (error)
    if (typeof code === 'string' && code) out.error_code = code
    else if (error instanceof Error && error.name) out.error_code = error.name
    if (typeof message === 'string' && message) out.error_message = message.slice(0, MAX_ERROR_MESSAGE_LEN)
  } else if (typeof error === 'string' && error) {
    out.error_message = error.slice(0, MAX_ERROR_MESSAGE_LEN)
  }
  return out
}

/**
 * @template T
 * @param {{
 *   emit: (entry: Record<string, unknown>) => void,
 *   sink: (level: 'info' | 'warn' | 'error', event: string, context?: Record<string, unknown>, request_id?: string, duration_ms?: number) => void,
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
  const { emit, sink } = deps
  const start = performance.now()
  try {
    const result = await fn()
    const duration_ms = Math.round(performance.now() - start)
    const event = `${operation}.complete`
    // Console AND exactly one persisted info wide-event row carrying
    // duration_ms (I1). The sink is the sole persist path — success writes
    // exactly one row and never also an error row.
    emit({ level: 'info', message: event, timestamp: new Date().toISOString(), ...attrs, duration_ms })
    sink('info', event, { ...attrs }, requestId, duration_ms)
    return result
  } catch (error) {
    const duration_ms = Math.round(performance.now() - start)
    const event = `${operation}.error`
    const { error_code, error_message } = serializeError(error)
    const ctx = { ...attrs, error_code, ...(error_message ? { error_message } : {}) }
    // A failed operation still records its outcome — exactly one persisted error
    // wide-event row carrying duration_ms (I1). No double write: this is the only
    // sink on the failure path.
    emit({ level: 'error', message: event, timestamp: new Date().toISOString(), ...ctx, duration_ms })
    sink('error', event, ctx, requestId, duration_ms)
    throw error
  }
}
