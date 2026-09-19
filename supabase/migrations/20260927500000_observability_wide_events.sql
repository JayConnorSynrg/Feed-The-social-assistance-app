-- Wave W0.2 — optimization-driven observability wide events.
--
-- Closes the observability gap where success/latency events were emitted to the
-- console (logger.info / withMetric) but never persisted or queryable: app_logs
-- held only warn/error rows. This migration is ADDITIVE only — it never drops or
-- alters an existing app_logs column or row.
--
-- Adds:
--   1. app_logs.duration_ms  — nullable integer wall-clock of an instrumented op
--   2. app_logs.user_id      — nullable uuid, server-derived (never client-trusted)
--   3. app_logs_latency_percentiles()  — p50/p95/p99 duration by operation (I2)
--   4. app_logs_latency_regressions()  — current-vs-prior p95 regression alert (I3)
--   5. app_logs_retention_30d cron job — deletes rows older than 30 days (I6)
--
-- Existing indexes idx_app_logs_event_created (event, created_at DESC) and
-- idx_app_logs_created (created_at DESC) already cover the percentile grouping,
-- the regression windows, and the retention delete — no new index is added.

-- 1 + 2. Additive columns (idempotent). duration_ms is populated by withMetric;
-- user_id is stamped server-side in /api/client-log from the cookie session.
alter table public.app_logs add column if not exists duration_ms integer;
alter table public.app_logs add column if not exists user_id uuid;

comment on column public.app_logs.duration_ms is
  'Wall-clock milliseconds of the instrumented operation (withMetric). NULL for non-timed rows.';
comment on column public.app_logs.user_id is
  'Server-derived actor id (from the request cookie session in /api/client-log). NEVER client-trusted. NULL when unauthenticated or server-origin.';

-- 3. I2 — latency queryable per operation.
-- Returns p50/p95/p99 duration_ms grouped by operation (the `event` string, which
-- encodes operation + outcome, e.g. `map.resources_in_bounds.complete`) over a
-- rolling window. SECURITY INVOKER: only callers with SELECT on app_logs (i.e.
-- service_role via the Management API / ops layer) can read; anon/authenticated
-- have no grant. search_path pinned per the SECURITY DEFINER hardening pattern
-- (applies to invoker functions too, to satisfy the mutable-search_path advisor).
create or replace function public.app_logs_latency_percentiles(
  p_window interval default interval '24 hours'
)
returns table (
  operation    text,
  samples      bigint,
  p50_ms       double precision,
  p95_ms       double precision,
  p99_ms       double precision
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select
    event as operation,
    count(*) as samples,
    percentile_cont(0.5)  within group (order by duration_ms) as p50_ms,
    percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
    percentile_cont(0.99) within group (order by duration_ms) as p99_ms
  from public.app_logs
  where duration_ms is not null
    and created_at >= now() - p_window
  group by event
  order by p95_ms desc nulls last;
$$;

-- 4. I3 — regression alert. Flags any operation whose current-window p95 exceeds
-- its prior-window p95 by >= p_factor. Returns ZERO rows when every operation is
-- within band. Defaults: 1.5x p95 growth over a 1h current window vs the 24h that
-- precedes it, requiring >= 5 samples in BOTH windows so a single slow outlier or
-- a cold-start burst cannot trip the alert. Thresholds are parameters so the ops
-- layer can self-calibrate against real traffic once a baseline accrues.
create or replace function public.app_logs_latency_regressions(
  p_factor      double precision default 1.5,
  p_current     interval         default interval '1 hour',
  p_prior       interval         default interval '24 hours',
  p_min_samples integer          default 5
)
returns table (
  operation    text,
  current_p95  double precision,
  prior_p95    double precision,
  ratio        double precision,
  current_n    bigint,
  prior_n      bigint
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with cur as (
    select event,
           percentile_cont(0.95) within group (order by duration_ms) as p95,
           count(*) as n
    from public.app_logs
    where duration_ms is not null
      and created_at >= now() - p_current
    group by event
  ),
  prior as (
    select event,
           percentile_cont(0.95) within group (order by duration_ms) as p95,
           count(*) as n
    from public.app_logs
    where duration_ms is not null
      and created_at >= now() - (p_current + p_prior)
      and created_at <  now() - p_current
    group by event
  )
  select cur.event,
         cur.p95,
         prior.p95,
         cur.p95 / nullif(prior.p95, 0),
         cur.n,
         prior.n
  from cur
  join prior using (event)
  where cur.n   >= p_min_samples
    and prior.n >= p_min_samples
    and prior.p95 > 0
    and cur.p95 > prior.p95 * p_factor
  order by (cur.p95 / nullif(prior.p95, 0)) desc;
$$;

-- Least-privilege: logs are already service_role-only (app_logs relacl grants
-- only postgres + service_role). Mirror that on the functions.
revoke execute on function public.app_logs_latency_percentiles(interval) from public;
revoke execute on function public.app_logs_latency_regressions(double precision, interval, interval, integer) from public;
grant  execute on function public.app_logs_latency_percentiles(interval) to service_role;
grant  execute on function public.app_logs_latency_regressions(double precision, interval, interval, integer) to service_role;

-- 5. I6 — retention. pg_cron is already installed on this project. Delete app_logs
-- rows older than 30 days, and only those, daily at 03:17 UTC. Idempotent: drop a
-- prior job of the same name first (guarded so a first run does not error).
do $$
begin
  perform cron.unschedule('app_logs_retention_30d');
exception
  when others then
    -- No existing job of that name — nothing to unschedule.
    null;
end $$;

select cron.schedule(
  'app_logs_retention_30d',
  '17 3 * * *',
  $$delete from public.app_logs where created_at < now() - interval '30 days'$$
);
