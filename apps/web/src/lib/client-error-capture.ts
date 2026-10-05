// apps/web/src/lib/client-error-capture.ts
//
// One browser-wide handler for errors nothing else caught: window 'error'
// (uncaught exceptions in event handlers, timers, scripts) and
// 'unhandledrejection' (a rejected promise nobody awaited). Each becomes one
// error row in FEED's own app_logs via logger.error -> /api/client-log.
//
// De-duplication keeps a render or timer loop from flooding the table: the same
// kind + message is reported at most once per DEDUP_WINDOW_MS, and a page
// session reports at most MAX_REPORTS_PER_SESSION errors in total.
// AbortError rejections are skipped — Next.js aborts in-flight fetches on
// navigation/re-render and those are not failures.

import { logger } from '@/lib/logger'

export const DEDUP_WINDOW_MS = 60_000
export const MAX_REPORTS_PER_SESSION = 20

type Report = (event: 'client.window.error' | 'client.unhandled_rejection', error: unknown, kind: string) => void

type ErrorTarget = {
  addEventListener: (type: string, listener: (event: Event) => void) => void
  removeEventListener: (type: string, listener: (event: Event) => void) => void
}

// Literal event names (not a variable) so the registry-completeness scan sees both.
const defaultReport: Report = (event, error, kind) => {
  if (event === 'client.window.error') logger.error('client.window.error', error, { kind })
  else logger.error('client.unhandled_rejection', error, { kind })
}

function messageOf(value: unknown): string {
  if (value instanceof Error) return `${value.name}:${value.message}`
  if (value && typeof value === 'object' && typeof (value as { message?: unknown }).message === 'string') {
    return (value as { message: string }).message
  }
  return String(value)
}

/**
 * Install the handlers on `target` (normally `window`). Returns an uninstall
 * function. `now` is injectable for tests.
 */
export function installClientErrorCapture(
  target: ErrorTarget,
  report: Report = defaultReport,
  now: () => number = () => Date.now()
): () => void {
  const lastSeen = new Map<string, number>()
  let reported = 0

  const shouldReport = (key: string): boolean => {
    if (reported >= MAX_REPORTS_PER_SESSION) return false
    const t = now()
    const prev = lastSeen.get(key)
    if (prev !== undefined && t - prev < DEDUP_WINDOW_MS) return false
    lastSeen.set(key, t)
    reported++
    return true
  }

  const onError = (event: Event) => {
    const e = event as ErrorEvent
    const error = e.error ?? e.message
    if (shouldReport(`error|${messageOf(error).slice(0, 200)}`)) {
      report('client.window.error', error, 'error')
    }
  }

  const onRejection = (event: Event) => {
    const reason = (event as PromiseRejectionEvent).reason
    if (reason instanceof Error && reason.name === 'AbortError') return
    if (shouldReport(`rejection|${messageOf(reason).slice(0, 200)}`)) {
      report('client.unhandled_rejection', reason, 'unhandledrejection')
    }
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
