import type { Instrumentation } from 'next'
import { logger } from '@/lib/logger'
import { serializeError } from '@/lib/with-metric-core.mjs'

/**
 * Next.js server/edge instrumentation entry — first-party error capture.
 *
 * Next.js invokes `onRequestError` once per uncaught server-side error. Each one
 * becomes exactly one `request.error` row in FEED's own `app_logs` table, written
 * through the server logger. The row carries only PII-free fields:
 *   - request_id: the proxy-stamped `x-request-id`, so it joins every other row
 *     written during the same request (I4)
 *   - route: the route PATTERN (e.g. /profile/[username]), never the concrete URL
 *   - route_type / method, the Next.js error `digest` (the "ref" a user sees)
 *   - error_code: the SQLSTATE / PostgREST code when present, else the error name
 * The raw error message is not persisted (it can echo user data); Next.js itself
 * still prints the full error to the server console.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const rid = request.headers['x-request-id']
  const requestId = typeof rid === 'string' ? rid : undefined
  const digest = (error as { digest?: unknown } | null)?.digest
  const { error_code } = serializeError(error)
  logger.error(
    'request.error',
    { code: error_code },
    {
      route: context.routePath,
      route_type: context.routeType,
      method: request.method,
      ...(typeof digest === 'string' ? { digest } : {}),
    },
    { requestId }
  )
}
