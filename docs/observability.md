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

**Map provider (Mapbox) — known third-party data flow.** The `<Map>` in `components/map/map-view.tsx` sets `performanceMetricsCollection={false}`, which stops mapbox-gl's performance-metrics event. mapbox-gl 3.18.0 still makes one session request to `api.mapbox.com` and sends three events to `events.mapbox.com` from every browser that opens the map. Each request's URL carries FEED's public Mapbox access token, and like any request it exposes the viewer's IP address and user agent to Mapbox:

| Event | When | Payload (besides `event`, `created` timestamp) | Can FEED turn it off? |
|---|---|---|---|
| `map.auth` (GET `api.mapbox.com/map-sessions/v1?sku=…&access_token=…`) | once per map load | no body — the URL carries the billing `sku` session token and the access token | No — protected by Mapbox's terms of service (the library marks the code as not to be modified) |
| `map.load` | once per map instance | `sdkIdentifier`, `sdkVersion`, `skuId`, `skuToken` (billing session token), `userId` = an anonymous device id | No — Mapbox's terms of service require it for metered billing (the library marks the code as not to be modified) |
| `style.load` | each time a style loads | `mapInstanceId` (random per map instance), `eventId` (counter), `style` (the full style URL, `mapbox://styles/mapbox/streets-v12`), `importedStyles` | No — there is no option for it |
| `appUserTurnstile` | at most once per day per device | `sdkIdentifier`, `sdkVersion`, `skuId`, `enabled.telemetry: false`, `userId` = the same anonymous device id | No — there is no option for it |

The three `events.mapbox.com` events are POSTs. The anonymous device id is a random UUID that mapbox-gl keeps in the browser's `localStorage` and regenerates after 24 hours. None of these requests carries FEED account data, coordinates, or search text. FEED does not patch the library. Replacing Mapbox is the next objective ("remove third-party data flows"), which closes this flow entirely.

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

## Database-written events (pg_cron jobs)

These rows are inserted by SQL, not by the browser, so they are not in `src/lib/event-registry.ts` (that registry is the allowlist for `/api/client-log`).

| Event | Job (schedule, UTC) | Rows |
|---|---|---|
| `events.generate.nightly` / `events.generate.skipped` / `events.generate.watchdog` | `events_generate_nightly` (03:37), `events_generate_watchdog` (15:37) | One per run; watchdog only when no successful run in 26 h. See `20261023000000`. |
| `safety_alerts.expire` | `safety_alerts_expire` (every 5 min) | Only when a run expired ≥ 1 alert (`info`, `context.expired`) or failed (`error`, `context.error_code`). See [safety-alerts.md](safety-alerts.md). |

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

## Admin → member navigation

Every admin page shows one **Back to feed** link (the bar in `app/(admin)/layout.tsx`), and admin rows offer **View …** links that open an item's member page in one reused `feed-preview` tab (`components/admin/member-view-link.tsx`). Every click or auxclick (middle-button) activation persists exactly one row; a context-menu "Open in new tab" fires neither event and writes no row. These two events carry no entity ids or personal data:

| Event | Labels | Values |
|---|---|---|
| `admin.nav.back_to_feed` | `source` | `admin_bar` |
| `admin.nav.member_view` | `kind`, `source`, `view` | `kind`: `post` · `organization` · `business` · `resource` · `event` · `map_focus`; `source`: `reports_queue` · `held_posts` · `manage_resources` · `resources_queue` · `businesses` · `orgs_section` · `org_admin_profile` · `event_scheduler` · `org_admin_events` · `safety_alerts`; `view`: `page` (a `/s/…` page) · `feed` (`event`: the members' Events list) · `map` (`map_focus`) |
| `nav.deeplink.resolve` | `kind`, `outcome`, `panel` | one row per followed focus link (below). `kind`: the focus kind, or `unknown` when malformed; `outcome`: `found` · `not_found` · `invalid` · `abandoned` (the member left the panel before the focus settled — the Events tab before its list loaded, the map before the pin appeared — or, on the map, a newer link replaced it first); `panel`: the subtab when there is one (`events`), else the panel (`map`, `feed`, `chat` …) — a closed set, never the raw hash |

These navigation events were console-only (`logger.info`) and now persist through `logEvent` with their existing registered labels — `org_id` / `resource_id` are object ids (not personal data) kept for path analysis: `admin.shell.tab_switch` (`from_tab`, `org_id`, `to_tab`; `from_tab` is the tab that was showing), `admin.shell.org_switch` (`org_id`), `admin.resource.link.visit` (`resource_id`), `nav.subtab.switch` (`panel`, `subtab` — feed, documents and petitions subtabs), `nav.alias.resolve` (`panel`, `subtab` — an alias such as `events` resolved to its parent panel; the unregistered `input` label was dropped).

### Member deep links (hash scheme)

The member app is one page at `/`; the hash names the panel (`#feed`, `#map`, …) or an alias of a
panel + subtab (`#events` → feed / Events, `#messages`, `#forms`, `#businesses`, `#organizations`,
`#add-business`, … — `PANEL_ALIASES` in `components/layout/feed-shell.tsx`). A focus link adds one
item: `#<panel>?focus=<kind>:<uuid>`, kinds `event` · `resource` · `organization` · `business` ·
`safety_alert` (`lib/deep-link.ts`: `parseHash`, `buildFocusHash`; admin code builds them only through
`memberUrl` — `{ kind: 'event', id }` → `/#events?focus=event:<id>`, `{ kind: 'map_focus', focus }` →
`/#map?focus=<kind>:<id>`).

- The shell reads the hash on load and on every `hashchange` (a re-click in the reused `feed-preview`
  tab is one), opens the panel, and hands the focus to it as `panelParams.focus` only when that panel
  shows the kind (`FOCUS_CONSUMERS`: feed / events ← `event`; map ← `resource`, `organization`,
  `business`, `safety_alert`). It then rewrites the URL in place to `#<panel>`, so a reload does not
  focus again and the same link clicked again differs from the URL and fires a new `hashchange`.
- A malformed focus, an unknown kind, or a kind the panel does not show never changes the panel: it
  opens as `#<panel>` would and the shell writes one `nav.deeplink.resolve` row with `outcome=invalid`.
  A `?` with no `focus` parameter is ignored (it used to send the member to Chat), and prototype keys
  such as `#toString` resolve to Chat like any unknown panel.
- The panel that takes the focus writes the `found` / `not_found` row and clears the focus; if it unmounts
  with the focus still waiting it writes `abandoned`. Any in-app panel or subtab switch drops a focus no
  panel has taken yet, so each followed link writes exactly one row. The Events
  list reads itself again first (an already open list may predate the event), then scrolls the event's
  card into view, focuses it and rings it in lime-700 (4 s from the latest link, or until it loses focus;
  no smooth scroll or fade under reduced motion — the OS setting or FEED's own); an event the list does not show gets one polite status line.
- The map (`components/panels/map-panel.tsx`, `lib/map-focus.ts`) takes `resource`, `organization`,
  `business` and `safety_alert`. It reads the item by id under exactly the predicate of the layer that
  draws it (resource: approved + located; organization: active, non-business, located; business:
  approved, active, located; safety alert: live and `expires_at` > now — the expiry is re-checked on the
  row because RLS checks status only), flies to it at zoom 17 (above the cluster `maxZoom` 16, so a
  clustered pin becomes a leaf; instant under FEED's or the OS's reduced motion), and claims the camera
  so a later GPS fix or profile geocode does not move it. The whole lifecycle is `MapFocusSession`;
  the panel's effects only forward to it. `found` = the pin's id appears in its loaded layer within 8 s
  of the link arriving; its popup opens as a named dialog that takes focus (a resource is also
  selected, as a click on it would; the dialog has its own Close button, and Escape or Close returns
  focus to the marker). A resource that a visible business links to lands on that
  business's pin (the map draws one pin for the pair) and is logged as `kind=resource`. `not_found` =
  the by-id read returned nothing (or failed), or the 8 s deadline (counted from arrival, so a hung read
  also settles; the read is then aborted) passed first; the map shows one polite, translated line
  ("That place isn't on the map right now."). `abandoned` = the member left the map, followed a newer
  link, or dragged/zoomed the map during the flight, first. Every followed map link writes exactly one
  row; a layer that loads after a settle opens nothing.

"View in feed" funnel over the last 7 days (service role) — admin clicks on event links, then what
the followed links resolved to (an `invalid` focus on the Events panel counts here; `not_found` means
the event was not among the 50 listed when the link was followed):
```sql
select 'admin.nav.member_view' as step, context->>'source' as detail, count(*) as n
from public.app_logs
where event = 'admin.nav.member_view' and context->>'kind' = 'event'
  and created_at > now() - interval '7 days'
group by 1, 2
union all
select 'nav.deeplink.resolve', context->>'outcome', count(*)
from public.app_logs
where event = 'nav.deeplink.resolve' and context->>'panel' = 'events'
  and created_at > now() - interval '7 days'
group by 1, 2
order by 1, 3 desc;
```

Safety-alert map reads (`safety_alerts_in_view`): one call per settled pan/zoom (400 ms debounce),
one per 60 s while the map tab is visible, and one after a member places or edits an alert. Before
the 2026-10 fix (admin-nav PR-3) a new bounds object every render re-armed the debounce on every
render — about 1.5–2.5 calls a second per open map (pg_stat_statements: 139,348 calls vs 126 for
`resources_in_bounds`). Expected after deploy: a stationary open map drops from ~2/s to 1/60 s
(~100x fewer), and the ratio to `resources_in_bounds` falls from ~1,100:1 toward ~1–3:1. Measure
(record the counts at deploy, compare the deltas a day later):
```sql
select query, calls from pg_stat_statements
where query ilike '%safety_alerts_in_view%' or query ilike '%resources_in_bounds%'
order by calls desc;
```

"View on map" funnel over the last 7 days, by kind (service role) — admin clicks on map links, then
what the followed links resolved to on the map (`found` / `not_found` / `abandoned`; an `invalid` focus
on the map counts here too):
```sql
select 'admin.nav.member_view' as step,
       context->>'source' as kind_or_source, null as outcome, count(*) as n
from public.app_logs
where event = 'admin.nav.member_view' and context->>'view' = 'map'
  and created_at > now() - interval '7 days'
group by 1, 2
union all
select 'nav.deeplink.resolve', context->>'kind', context->>'outcome', count(*)
from public.app_logs
where event = 'nav.deeplink.resolve' and context->>'panel' = 'map'
  and created_at > now() - interval '7 days'
group by 1, 2, 3
order by 1, 2, 3;
```

Clicks over the last 7 days (service role):
```sql
select event,
       context->>'kind'   as kind,
       context->>'source' as source,
       count(*)           as clicks
from public.app_logs
where event in ('admin.nav.member_view', 'admin.nav.back_to_feed')
  and created_at > now() - interval '7 days'
group by 1, 2, 3
order by 1, 4 desc;
```

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
- The id of the person an admin acted on: `admin.user.*`, `admin.tier.set*`, `admin.notes.*`, `admin.denied` and `admin.audit.*` carry no `target_id` — their `request_id` joins to the durable `admin_actions` row, which records the target

Use instead: `content_length` (character count), `file_size` (bytes), `category` (enum label), `template_id` (opaque ID), `has_signature` (boolean).

`error_message` is capped at 120 characters and kept only on error-level rows. A Postgres constraint message can echo a column value; for writes that touch personal fields, log a scrubbed error (code + static message) as `runResourceSave` does.

---

## Known follow-ups

- Edge functions' `getCorrelationId` (`supabase/functions/_shared/log.ts`) returns the inbound `x-request-id` header unvalidated. It only reaches the edge function's console output today (not `app_logs`); validate it with the same shape as `safeRequestId` during security hardening.
- The SQL `public.request_id()` accepts `^[A-Za-z0-9_-]{1,64}$` (it allows `_`), while the TypeScript `safeRequestId` accepts `^[A-Za-z0-9-]{1,64}$`. An id containing `_` is kept in `admin_actions.request_id` but dropped from `app_logs.request_id`, so the two would not join. Align them during security hardening.
- `public.log_engagement_failure` (migration `20261005000000_p2_1a_engagement.sql`, lines 239-249) writes its `p_detail` argument (its callers pass the raw Postgres `SQLERRM`) into `app_logs` directly from SQL, bypassing `EVENT_REGISTRY` and the 120-character `error_message` cap. It predates the first-party logging foundation and is scheduled for the security-hardening objective.

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
