# FEED Platform — Observability

## Overview

Five complementary layers cover the full signal surface:

| Layer | Mechanism | Destination |
|---|---|---|
| Structured logs | `logger` (console JSON) | Vercel Log Drain |
| Latency + error analytics | `withMetric` → `@vercel/analytics track()` | Vercel Analytics custom events |
| RUM + Core Web Vitals | `@vercel/speed-insights` + `global-error.tsx` | Vercel Speed Insights |
| **Persisted wide events (W0.2)** | `withMetric` → `app_logs` (info+`duration_ms`+`user_id`) | Supabase — queryable p50/p95/p99 + regression alerts |
| **Uncaught server errors (W0.2)** | `@sentry/nextjs` `onRequestError` | Sentry (DSN from env; inert without one) |

**Log Drain**: Vercel captures every `console.log/warn/error` call as a structured JSON entry in production. The `logger` utility writes JSON with `level`, `message`, `timestamp`, and optional flat fields. No external SDK required.

**Vercel Analytics custom events**: `track(eventName, props)` from `@vercel/analytics` records named events with flat primitive properties. The `withMetric` wrapper calls `track()` on every success/error outcome, giving a latency histogram and error rate for each hot path in the Vercel Analytics dashboard.

**Persisted wide events**: `withMetric` also writes exactly one row to `public.app_logs` per outcome — an `info` row (`${operation}.complete`) on success and an `error` row (`${operation}.error`) on failure — each carrying `duration_ms` and a server-derived `user_id`. Unlike `track()` (which is a Vercel dashboard), these rows are SQL-queryable, so latency percentiles and regressions are computable in-database (see below). Before W0.2 `logger.info` was console-only and `app_logs` held zero completion rows.

---

## Persisted wide-event schema (`public.app_logs`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `created_at` | timestamptz | insert time (retention key) |
| `level` | text | `info` = completion, `warn`/`error` = failure/outcome |
| `event` | text | `${operation}.complete` / `${operation}.error` / warn-error message |
| `context` | jsonb | flat attrs (no PII); `_source:'client'` tag on browser-origin rows |
| `request_id` | text | correlation id (I4) — see below |
| `duration_ms` | integer (nullable) | wall-clock of the instrumented op (added W0.2) |
| `user_id` | uuid (nullable) | **server-derived** actor id, never client-trusted (added W0.2) |

`duration_ms`/`user_id` are additive and nullable. `user_id` is stamped inside `/api/client-log` from the cookie session (`deriveUserId`), never read from the request body.

### Persistence path (exactly once — I1)
- **Client** (all 20 `withMetric` call sites are `'use client'`): `withMetric` → `sinkToSupabase('info'|'error', …, duration_ms)` → `POST /api/client-log` (keepalive) → route derives `user_id` and inserts. One row per outcome; success never also writes an error row and vice-versa.
- **Server** `logger.warn`/`logger.error`: direct service-role insert; `request_id` read from `next/headers` `x-request-id` when a request scope is active.

## Request correlation (I4)

`apps/web/src/proxy.ts` (the Next.js 16 middleware) reads an inbound `x-request-id` or mints `crypto.randomUUID()`, forwards it on the request headers, and echoes it on every response. The logger reads it via `next/headers`; `onRequestError` (`src/instrumentation.ts`) sets it as the Sentry `request_id` tag — so one server request is traceable across `app_logs.request_id` and Sentry under the same id.

## Uncaught server errors (I5)

`src/instrumentation.ts` registers `@sentry/nextjs` per runtime (`sentry.server.config.ts` / `sentry.edge.config.ts`, client via `instrumentation-client.ts`) and exports `onRequestError = Sentry.captureRequestError` (wrapped to tag `request_id`). Sentry is **disabled unless a DSN env var is set** (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`) — no hardcoded secret, no network or build cost until turned on. Source-map upload (via `withSentryConfig` + `SENTRY_AUTH_TOKEN`) is a later enhancement; runtime error capture works without it.

## Retention (I6)

pg_cron job `app_logs_retention_30d` runs daily (03:17 UTC) and deletes only `app_logs` rows older than 30 days, bounding the table (it held 105k rows from a past error incident).

## Operator queries & alerts (committed in migration `20260928000000_observability_wide_events.sql`)

All three are `service_role`-only (mirrors `app_logs` grants). Run via the Management API SQL endpoint / ops layer.

**Latency percentiles (I2)** — p50/p95/p99 `duration_ms` by operation over a window:
```sql
select * from public.app_logs_latency_percentiles(interval '24 hours');
-- → operation, samples, p50_ms, p95_ms, p99_ms
```

**Regression alert (I3)** — flags any op whose current-window p95 exceeds its prior-window p95 by ≥ factor; returns zero rows when all within band:
```sql
-- defaults: 1.5x growth, 1h current vs preceding 24h, ≥5 samples each window
select * from public.app_logs_latency_regressions();
-- tune: app_logs_latency_regressions(2.0, interval '30 min', interval '12 hours', 10)
```
Defaults chosen so a single slow outlier or a cold-start burst cannot trip it; parameters let the ops layer self-calibrate as a baseline accrues.

---

## `withMetric` contract

```typescript
// apps/web/src/lib/logger.ts
export async function withMetric<T>(
  operation: string,
  attrs: Record<string, string | number | boolean | null>,
  fn: () => Promise<T>
): Promise<T>
```

**Behaviour:**

- On success — emits `logger.info(`${operation}.complete`, { ...attrs, duration_ms })` and calls `track(operation, { ...attrs, duration_ms, ok: true })`. Returns `fn()`'s value unchanged.
- On error — emits `logger.error(`${operation}.error`, error, { ...attrs, duration_ms, error_code })` and calls `track(operation, { ...attrs, duration_ms, ok: false, error_code })` *unless* `error_code === 'AbortError'` (Next.js aborts in-flight fetch on re-render — these are not real errors). Re-throws the error unchanged.
- `duration_ms` is `Math.round(performance.now() - start)` — integer milliseconds.
- The function is fully transparent: same return type, same throw, zero control-flow change.

**Supabase builder note**: Supabase query builders are `PromiseLike` (thenable) but not full `Promise` instances. Wrap them with `async () => await builder` to satisfy `withMetric`'s `() => Promise<T>` signature.

**Attrs rules:**
- All values must be flat primitives: `string | number | boolean | null`.
- No PII. Use lengths, counts, category labels, template IDs — never content, names, or addresses.
- Vercel Analytics prop key+value combined limit: 255 characters. Keep `operation` names short (dot-namespaced, ≤ 30 chars).

---

## Naming convention

Operations follow OpenTelemetry semantic-convention dot-namespacing (`namespace.verb`) and Vercel custom-event naming guidance (lowercase, dot-separated, concise). Duration is always `duration_ms` (integer). This aligns with the OTel `*_ms` suffix convention for millisecond measurements.

References:
- OpenTelemetry Semantic Conventions — General attributes: `https://opentelemetry.io/docs/specs/semconv/general/attributes/`
- Vercel Analytics custom events: `https://vercel.com/docs/analytics/custom-events`

---

## Metric catalog

| Operation | File : line | Attrs | Mechanism |
|---|---|---|---|
| `map.resources_in_bounds` | `apps/web/src/hooks/use-viewport-resources.ts` : L112 | `category`, `limit` | `withMetric` |
| `vault.unlock` | `apps/web/src/contexts/vault-context.tsx` : L165 | `userId` | `withMetric` |
| `documents.upload` | `apps/web/src/hooks/use-documents.ts` : L141 | `category`, `file_size`, `document_type` | `withMetric` |
| `programs.query` | `apps/web/src/hooks/use-program-browser.ts` : L89 | `category`, `state`, `has_search` | `withMetric` |
| `feed.load` | `apps/web/src/components/panels/feed-panel.tsx` : L323 | `limit` | `withMetric` |
| `messages.send` | `apps/web/src/hooks/use-conversations.ts` : L356 | `content_length` | `withMetric` |
| `forms.draft` | `apps/web/src/hooks/use-vault-form-submission.ts` : L262 | `template_id` | `withMetric` |
| `forms.submit` | `apps/web/src/hooks/use-vault-form-submission.ts` : L411 | `template_id`, `has_signature` | `withMetric` |
| `chat.ttfb` | `apps/web/src/hooks/use-chat.ts` : L194 | `duration_ms` | inline `track()` |
| `chat.complete` | `apps/web/src/hooks/use-chat.ts` : L215 | `duration_ms`, `ok` | inline `track()` |
| `nav_subtab` | `apps/web/src/components/panels/feed-panel.tsx` : L292; `documents-panel.tsx` : L600 | `panel`, `subtab` | inline `track()` |

All `withMetric`-backed operations also emit a structured log entry (`${operation}.complete` or `${operation}.error`) visible in the Vercel Log Drain.

---

## How to add a new metric

1. Identify the single dominant async call for the hot path (network fetch, DB query, storage op).
2. Import `withMetric` from `@/lib/logger`.
3. Wrap with `async () => await <existing call>` if the call returns a PromiseLike (Supabase builders).
4. Choose flat-primitive attrs: no PII, use counts/lengths/category labels/ids.
5. Register the operation in the catalog table above.
6. Confirm `npm run type-check` passes — the `attrs` type enforces `string | number | boolean | null`.

```typescript
// Pattern for Supabase builders (PromiseLike, not full Promise):
const { data, error } = await withMetric(
  'namespace.verb',
  { category: selectedCategory ?? null, limit: PAGE_SIZE },
  async () => await supabase.from('table').select('*').eq('col', value)
)

// Pattern for regular async functions:
const result = await withMetric(
  'namespace.verb',
  { userId },
  () => someAsyncFunction(arg1, arg2)
)
```

---

## PII policy

`withMetric` attrs must never contain:
- Names, email addresses, phone numbers, SSNs, addresses
- Free-text content (message body, form field values)
- IP addresses or device fingerprints

Use instead: `content_length` (character count), `file_size` (bytes), `category` (enum label), `template_id` (opaque ID), `has_signature` (boolean).

The logger's `error_message` field from `withMetric` error paths captures the Error `.message` string. Ensure error messages in Supabase/crypto layers do not embed PII — this is enforced at the library level, not at call sites.
