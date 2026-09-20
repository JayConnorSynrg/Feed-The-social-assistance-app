import * as Sentry from '@sentry/nextjs'

// Browser Sentry init (W0.2). Next.js 16 loads this file natively on the client.
// DSN from the public env var only; disabled when absent (inert, no network).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0,
  sendDefaultPii: false,
})

// Instruments App Router client-side navigations for Sentry when enabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
