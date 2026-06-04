/**
 * friendly-error.ts
 *
 * Maps known low-level error types to human-readable strings.
 * Never exposes raw DB internals, error codes, or stack traces to users.
 * The caller is responsible for logging the original error before calling this.
 */

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!error) return fallback

  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : ''

  const code =
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : ''

  // Permission / RLS errors — never expose to user
  if (
    message.toLowerCase().includes('permission denied') ||
    code === '42501'
  ) {
    return "You don't have permission to view this right now. Please try again or contact support."
  }

  // Network / timeout / abort errors
  if (
    (error instanceof DOMException && error.name === 'AbortError') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('signal') ||
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('networkerror')
  ) {
    return "We're having trouble connecting. Please check your connection and try again."
  }

  return fallback
}
