# FEED Platform — Observability

## Overview

FEED is open-source and privacy-first: application telemetry stays on FEED's own
infrastructure. Every persisted signal lands in the project's Supabase `app_logs`
table; no third-party telemetry vendor (error tracker, analytics or RUM SDK)
receives app or user data, and the CSP allows no analytics host.

| Layer | Mechanism | Destination |
|---|---|---|
| Structured logs | `logger.debug/info` (console JSON) | Server/browser console only |
| Persisted failures | `logger.warn` / `logger.error` | `app_logs` (browser via `/api/client-log`, server via service role) |
| **Persisted wide events (W0.2)** | `withMetric` → `app_logs` (`<op>.complete` / `<op>.error` + `duration_ms` + `user_id`) | Supabase — queryable p50/p95/p99 + regression alerts |
| Named product events | `logEvent(name, attrs)` → `app_logs` (info) | Supabase |
| Uncaught server errors | `src/instrumentation.ts` `onRequestError` → one `request.error` row | Supabase |
| Uncaught client errors | `app/error.tsx`, `app/(admin)/error.tsx`, `global-error.tsx`, `PanelErrorBoundary`, window `error` / `unhandledrejection` capture | Supabase |
| RPC database time | weekly `pg_stat_statements` snapshot → `app_query_stats_weekly` | Supabase |

**Map provider:** the `<Map>` in `components/map/map-view.tsx` sets `performanceMetricsCollection={false}`, so mapbox-gl sends no performance telemetry. Mapbox's billing map-load event (one per map load, to `events.mapbox.com`) still fires because Mapbox's terms of service require it for metered billing.

**Persisted wide events**: `withMetric` writes exactly one row to `public.app_logs` per outcome — an `info` row (`${operation}.complete`) on success and an `error` row (`${operation}.error`) on failure — each carrying `duration_ms` and a server-derived `user_id`. These rows are SQL-queryable, so latency percentiles and regressions are computable in-database (see below).

**`logger.info` vs `logEvent`**: `logger.info` is console-only (lost in the browser). Use `logEvent(name, attrs)` for a named product event that must be stored; it writes one `info` row through the same sink.

## Closed event vocabulary (`/api/client-log`)

`src/lib/event-registry.ts` holds `EVENT_REGISTRY`: event name → allowed label keys. The browser sink route:

- rejects an event name that is not in the registry (`400 unknown_event`, nothing persisted);
- keeps only that event's registered label keys, with flat primitive values (strings ≤ 200 chars); other keys are dropped;
- keeps `error_code` / `error_name` / `error_message` only on `error`-level rows, with `error_message` capped at 120 characters;
- stamps `_source: 'client'` and derives `user_id` from the cookie session;
- rate-limits per client IP (120/min) from the platform-set `x-real-ip` / `x-forwarded-for`; caller-supplied headers such as `x-federation-instance` do not affect the budget. **Trust assumption:** Vercel overwrites `x-real-ip` and `x-forwarded-for` with the connecting client's address, so a caller cannot choose its own key. A self-hosted deployment must put a reverse proxy in front that does the same (overwrite, never append-to, those headers); otherwise the limit is keyed on caller-supplied text.

The server sink (`logger.warn` / `logger.error` / `withMetric` / `logEvent` on the server, and `request.error`) runs the same `sanitizeClientEvent` check before inserting: an unregistered event writes no row, and only registered keys survive.

The registry was sourced from every static event name in `apps/web/src` (logger, withMetric `<op>.complete/.error`, privilegedRpc/privilegedFetch ops, logEvent) plus every distinct `app_logs.event` in production over the prior 30 days. Label keys exclude personal and free-text fields (user ids, emails, addresses, viewport bounds, file paths, raw query text). `src/lib/__tests__/event-registry.test.ts` re-scans the source on every test run and fails when an emitted event is missing — **add the registry entry in the same PR that first emits an event.**

## Error codes

`serializeError` (`src/lib/with-metric-core.mjs`) normalizes any thrown value for persisted rows: Supabase/PostgREST `{ code, message }` objects (which are not `Error` instances) become `error_code` = the SQLSTATE / PostgREST code and a capped `error_message`; an `Error` without a `code` uses its `name`. `privilegedRpc` carries the RPC's SQLSTATE on its wrapper error, so a denied admin call records `error_code: '42501'`. Stacks stay in the console.

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
- **Server** `logger.warn`/`logger.error`: direct service-role insert; `request_id` read from `next/headers` `x-request-id` when a request scope is active (or pinned via `logger.error(..., { requestId })`).

## Request correlation (I4)

`apps/web/src/proxy.ts` (the Next.js 16 middleware) reads an inbound `x-request-id` or mints `crypto.randomUUID()`, forwards it on the request headers, and echoes it on every response. The logger reads it via `next/headers`, and `onRequestError` (`src/instrumentation.ts`) writes it as the `request.error` row's `request_id` — so one server request is traceable across every `app_logs` row it produced. Client-side, `privilegedRpc` / `privilegedFetch` and the post-photo upload (`lib/post-image-upload.ts`) mint one id with `newRequestId()` and send it as `x-request-id` to the RPC / edge function.

## Uncaught errors (I5)

- **Server**: `src/instrumentation.ts` exports `onRequestError`. Next.js calls it once per uncaught server error; it writes one `request.error` row with `request_id`, the route **pattern** (`/profile/[username]`, never the concrete URL), `route_type`, `method`, the Next.js `digest`, and `error_code`. The raw message is not persisted.
- **Client**: `app/error.tsx` (`app.error.boundary`), `app/(admin)/error.tsx` (`admin.error.boundary`), `app/global-error.tsx` (`global-error.boundary`) and the panel `PanelErrorBoundary` in `app/page.tsx` (`panel.error.boundary`) each persist one error row. `src/lib/client-error-capture.ts`, installed once in `app/providers.tsx`, records window `error` (`client.window.error`) and `unhandledrejection` (`client.unhandled_rejection`), de-duplicated (same message at most once per 60 s, at most 20 per page session; `AbortError` rejections skipped).

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
// apps/web/src/lib/logger.ts — signature and argument order are a stable contract
export async function withMetric<T>(
  operation: string,
  attrs: Record<string, string | number | boolean | null>,
  fn: () => Promise<T>,
  explicitRequestId?: string
): Promise<T>
```

**Behaviour:**

- On success — console `info` entry plus exactly one persisted `info` row `${operation}.complete` with `attrs` and `duration_ms`. Returns `fn()`'s value unchanged.
- On error — console `error` entry plus exactly one persisted `error` row `${operation}.error` with `attrs`, `error_code` (SQLSTATE when present) and a capped `error_message`. Re-throws the error unchanged.
- `duration_ms` is `Math.round(performance.now() - start)` — integer milliseconds.
- `explicitRequestId` pins the row's `request_id` (used by `privilegedRpc` / `privilegedFetch`); omitted, the browser mints a per-op id and the server reads the proxy-stamped header.

**Supabase builder note**: Supabase query builders are `PromiseLike` (thenable) but not full `Promise` instances. Wrap them with `async () => await builder` to satisfy `withMetric`'s `() => Promise<T>` signature.

**Attrs rules:**
- All values must be flat primitives: `string | number | boolean | null`.
- No PII. Use lengths, counts, category labels, template IDs — never content, names, addresses, or user ids (`app_logs.user_id` is already derived server-side).
- Every key must be listed for the event in `EVENT_REGISTRY`, or the client-log route drops it.

---

## Naming convention

Operations use dot-namespacing (`namespace.verb`), lowercase. Duration is always `duration_ms` (integer).

---

## How to add a new metric or event

1. Identify the single dominant async call for the hot path (network fetch, DB query, storage op).
2. Import `withMetric` (timed operation) or `logEvent` (named product event) from `@/lib/logger`.
3. Wrap with `async () => await <existing call>` if the call returns a PromiseLike (Supabase builders).
4. Choose flat-primitive attrs: no PII, use counts/lengths/category labels/ids.
5. Add the event name(s) and label keys to `EVENT_REGISTRY` in `src/lib/event-registry.ts` (`<op>.complete` and `<op>.error` for `withMetric`).
6. Run `npx vitest run src/lib/__tests__/event-registry.test.ts` and `npm run type-check`.

```typescript
// Timed operation (Supabase builder):
const { data, error } = await withMetric(
  'namespace.verb',
  { category: selectedCategory ?? null, limit: PAGE_SIZE },
  async () => await supabase.from('table').select('*').eq('col', value)
)

// Named product event:
logEvent('admin.resource.autocomplete', { query_len: 9, result_count: 5, outcome: 'suggest' })
```

---

## PII policy

Persisted labels must never contain:
- Names, email addresses, phone numbers, SSNs, addresses, coordinates or viewport bounds
- Free-text content (message body, form field values, search text)
- User ids (use the server-derived `user_id` column), IP addresses or device fingerprints

Use instead: `content_length` (character count), `file_size` (bytes), `category` (enum label), `template_id` (opaque ID), `has_signature` (boolean).

`error_message` is capped at 120 characters and kept only on error-level rows. A Postgres constraint message can echo a column value; for writes that touch personal fields, log a scrubbed error (code + static message) as `runResourceSave` does.

---

## Weekly review

Run with the service role (Management API SQL endpoint). All three read first-party data only.

**1. p95 latency by operation, this week vs last week** (`app_logs`, 30-day retention):
```sql
-- operations whose p95 grew ≥ 25% week-over-week (≥ 5 samples in each week)
select * from public.app_logs_latency_regressions(1.25, interval '7 days', interval '7 days', 5);

-- full table, every operation
with w as (
  select event,
         case when created_at >= now() - interval '7 days' then 'this' else 'last' end as wk,
         duration_ms
  from public.app_logs
  where duration_ms is not null and created_at >= now() - interval '14 days'
)
select event,
       percentile_cont(0.95) within group (order by duration_ms) filter (where wk = 'this') as p95_this_week,
       percentile_cont(0.95) within group (order by duration_ms) filter (where wk = 'last') as p95_last_week,
       count(*) filter (where wk = 'this') as n_this,
       count(*) filter (where wk = 'last') as n_last
from w group by event order by p95_this_week desc nulls last;
```

**2. Error rate by operation and error_code** (last 7 days):
```sql
with ops as (
  select regexp_replace(event, '\.(complete|error)$', '') as operation,
         event like '%.error' as failed,
         context->>'error_code' as error_code
  from public.app_logs
  where created_at >= now() - interval '7 days'
    and (event like '%.complete' or event like '%.error')
)
select operation,
       count(*) as calls,
       count(*) filter (where failed) as errors,
       round(100.0 * count(*) filter (where failed) / count(*), 2) as error_pct
from ops group by operation having count(*) filter (where failed) > 0
order by error_pct desc;

select regexp_replace(event, '\.error$', '') as operation, context->>'error_code' as error_code, count(*)
from public.app_logs
where level = 'error' and created_at >= now() - interval '7 days'
group by 1, 2 order by 3 desc;
```

**3. RPC database-time deltas between weekly snapshots** (`app_query_stats_weekly`, 26-week retention, captured Mondays 04:23 UTC by pg_cron `app_query_stats_weekly`):
```sql
with s as (
  select query_label, captured_at, calls, total_exec_time_ms, rows,
         lag(calls)              over w as prev_calls,
         lag(total_exec_time_ms) over w as prev_ms,
         lag(rows)               over w as prev_rows
  from public.app_query_stats_weekly
  window w as (partition by query_label order by captured_at)
), d as (
  -- after a stats reset the counters drop, so the current value is the delta
  select query_label, captured_at,
         case when calls >= prev_calls then calls - prev_calls else calls end as calls_delta,
         case when total_exec_time_ms >= prev_ms then total_exec_time_ms - prev_ms else total_exec_time_ms end as db_ms_delta,
         case when rows >= prev_rows then rows - prev_rows else rows end as rows_delta
  from s where prev_calls is not null
)
select query_label, captured_at, calls_delta, round(db_ms_delta::numeric, 1) as db_ms_delta,
       round((db_ms_delta / nullif(calls_delta, 0))::numeric, 2) as mean_ms, rows_delta
from d
where captured_at = (select max(captured_at) from public.app_query_stats_weekly)
order by db_ms_delta desc;
```
