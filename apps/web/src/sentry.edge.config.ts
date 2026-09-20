import * as Sentry from '@sentry/nextjs'

// Edge runtime Sentry init (W0.2). Same policy as the server config: DSN from
// env only, disabled when absent, no perf sampling, no default PII.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0,
  sendDefaultPii: false,
})
