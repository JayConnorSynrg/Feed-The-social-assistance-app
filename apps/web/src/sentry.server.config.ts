import * as Sentry from '@sentry/nextjs'

// Server (Node.js) runtime Sentry init (W0.2). DSN comes from the environment —
// never hardcoded. Absent a DSN, Sentry is disabled: no events are sent and the
// SDK is inert. Perf tracing stays off (rate 0) until a DSN + budget exist.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0,
  // FEED handles PII directly; never let Sentry attach cookies / IPs / bodies.
  sendDefaultPii: false,
})
