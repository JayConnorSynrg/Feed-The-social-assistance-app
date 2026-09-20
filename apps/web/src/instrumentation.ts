import * as Sentry from '@sentry/nextjs'

/**
 * Next.js server/edge instrumentation entry (W0.2).
 *
 * `register()` loads the runtime-specific Sentry init. `onRequestError` captures
 * uncaught server errors exactly once per request (Next.js invokes it once per
 * server-side error) and tags each event with the proxy-stamped `x-request-id`
 * so a Sentry event and its app_logs rows share one correlation id (I4/I5).
 *
 * Sentry is a no-op unless a DSN env var is set (see sentry.*.config), so this is
 * inert until observability is turned on — no network calls, no build failure.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = (
  ...args: Parameters<typeof Sentry.captureRequestError>
): ReturnType<typeof Sentry.captureRequestError> => {
  const request = args[1]
  const rid = request?.headers?.['x-request-id']
  if (typeof rid === 'string') {
    Sentry.setTag('request_id', rid)
  }
  return Sentry.captureRequestError(...args)
}
