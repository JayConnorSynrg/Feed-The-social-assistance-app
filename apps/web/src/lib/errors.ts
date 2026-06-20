/**
 * errors.ts
 *
 * Low-level error serialization utilities.
 *
 * getErrorMessage extracts a human-readable string from any thrown value,
 * including PostgrestError plain objects ({message, code, details, hint})
 * that are NOT Error instances and would otherwise serialize as "[object Object]".
 *
 * Distinct from friendly-error.ts: this function returns the RAW technical
 * message for logging purposes. Use getFriendlyErrorMessage for user-facing text.
 */

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err != null && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const msg = e['message'] ?? e['details'] ?? e['hint'] ?? e['code']
    if (msg != null) return String(msg)
    return JSON.stringify(err)
  }
  return String(err)
}
