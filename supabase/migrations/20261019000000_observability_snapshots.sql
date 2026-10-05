-- Observability snapshots — weekly PostgREST RPC database-time history.
--
-- pg_stat_statements counters are cumulative since the last stats reset, so on
-- their own they cannot answer "which RPC got more expensive this week". This
-- migration keeps a weekly first-party snapshot of those counters, per RPC, in
-- FEED's own database so week-over-week DB-time deltas are a SQL query (see
-- docs/observability.md "Weekly review").
--
-- Adds:
--   1. public.app_query_stats_weekly           — one row per (captured_at, RPC)
--   2. public.capture_app_query_stats_weekly() — snapshot + 26-week retention
--   3. pg_cron job app_query_stats_weekly       — Mondays 04:23 UTC
--   4. a baseline snapshot at apply time, so the first weekly delta exists
--
-- Scope: PostgREST RPC calls only. PostgREST wraps every /rpc/<fn> call in a
-- `WITH pgrst_source AS (... pgrst_call ...)` statement whose first quoted
-- "schema"."function"( reference is the called function; that pair is the label.
-- Query text, parameters and row data are never copied — only the label and
-- the counters.
--
-- Rollback — run these four statements together in one transaction:
--   SELECT cron.unschedule('app_query_stats_weekly');
--   DROP FUNCTION IF EXISTS public.capture_app_query_stats_weekly();
--   DROP TABLE IF EXISTS public.app_query_stats_weekly;
--   DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261019000000';

BEGIN;

-- (2) core table ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_query_stats_weekly (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at        timestamptz      NOT NULL DEFAULT now(),
  query_label        text             NOT NULL,
  calls              bigint           NOT NULL,
  total_exec_time_ms double precision NOT NULL,
  mean_exec_time_ms  double precision,
  rows               bigint           NOT NULL,
  CONSTRAINT app_query_stats_weekly_capture_label_key UNIQUE (captured_at, query_label)
);

CREATE INDEX IF NOT EXISTS idx_app_query_stats_weekly_label_captured
  ON public.app_query_stats_weekly (query_label, captured_at DESC);

COMMENT ON TABLE public.app_query_stats_weekly IS
  'Weekly snapshot of cumulative pg_stat_statements counters per PostgREST RPC (schema.function). Deltas between consecutive captures give per-week DB time. service_role only; 26-week retention.';
COMMENT ON COLUMN public.app_query_stats_weekly.query_label IS
  'schema.function extracted from the PostgREST RPC wrapper statement. No query text or parameters are stored.';
COMMENT ON COLUMN public.app_query_stats_weekly.calls IS
  'Cumulative calls since the last pg_stat_statements reset (summed across statement variants).';

-- Snapshot + retention. SECURITY INVOKER: pg_cron runs the job as the scheduling
-- role (postgres), which can read pg_stat_statements; no caller elevation needed.
CREATE OR REPLACE FUNCTION public.capture_app_query_stats_weekly()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.app_query_stats_weekly
    (captured_at, query_label, calls, total_exec_time_ms, mean_exec_time_ms, rows)
  SELECT now(),
         m[1] || '.' || m[2],
         sum(s.calls),
         sum(s.total_exec_time),
         sum(s.total_exec_time) / nullif(sum(s.calls), 0),
         sum(s.rows)
  FROM extensions.pg_stat_statements s
  CROSS JOIN LATERAL regexp_match(s.query, '"([a-z_][a-z0-9_]*)"\."([a-z_][a-z0-9_]*)"\(') AS m
  WHERE s.query LIKE 'WITH pgrst_source AS %pgrst_call%'
    AND m IS NOT NULL -- a wrapper with no "schema"."fn"( reference is skipped, never aborts the capture
  GROUP BY m[1], m[2];
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  DELETE FROM public.app_query_stats_weekly
  WHERE captured_at < now() - interval '26 weeks';

  RETURN v_inserted;
END;
$$;

-- (5) RLS + least privilege ---------------------------------------------------
ALTER TABLE public.app_query_stats_weekly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_query_stats_weekly_service_role_all ON public.app_query_stats_weekly;
CREATE POLICY app_query_stats_weekly_service_role_all
  ON public.app_query_stats_weekly
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.app_query_stats_weekly FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.app_query_stats_weekly TO service_role;

REVOKE EXECUTE ON FUNCTION public.capture_app_query_stats_weekly() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_app_query_stats_weekly() TO service_role;

-- Weekly job (Mondays 04:23 UTC). Idempotent: drop a prior job of the same name.
DO $$
BEGIN
  PERFORM cron.unschedule('app_query_stats_weekly');
EXCEPTION
  WHEN others THEN
    NULL; -- no existing job of that name
END $$;

SELECT cron.schedule(
  'app_query_stats_weekly',
  '23 4 * * 1',
  $$SELECT public.capture_app_query_stats_weekly()$$
);

-- Baseline snapshot so the first weekly run already has a prior capture to diff.
SELECT public.capture_app_query_stats_weekly();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261019000000', 'observability_snapshots');
COMMIT;
