-- 20261025000000_safety_alerts_expire_job.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: a safety alert past its expires_at stops being 'live' everywhere, automatically.
--
-- Before this migration nothing ever wrote status = 'expired' (the CHECK in 20260608000400
-- allows it). Map and feed readers already hide rows with expires_at <= now(), but the row
-- itself stayed 'live' forever, so every reader that filters on status alone (the admin
-- review list, the admin "Live Safety Alerts" count, vote_safety_alert's liveness check, the
-- authenticated RLS policy) kept treating it as live.
--
-- What this migration does
--   expire_safety_alerts() moves every alert with status = 'live' AND expires_at <= now() to
--   'expired' in ONE set-based UPDATE and returns the number of rows moved. The predicate is
--   the exact complement of the readers' liveness rule (expires_at > now(),
--   safety_alerts_in_view in 20260619000200), so a live, unexpired alert is never touched,
--   and only 'live' rows are written, so 'cleared' / 'removed' / 'expired' are never
--   overwritten. Re-running moves 0 rows. Concurrent runs, votes or admin removals are safe:
--   the UPDATE re-checks status = 'live' on the latest row version after any row lock wait.
--   It writes one app_logs row 'safety_alerts.expire' when it moved at least one alert
--   (level 'info', context {expired}) or when it failed (level 'error', context {error_code});
--   a run that moved nothing writes nothing.
--   pg_cron job safety_alerts_expire runs it every 5 minutes (the shortest alert lifetime is
--   2 hours: severity 1 = 2h, 2 = 6h, 3 = 24h, 4 = 72h, set by place_safety_alert).
--   The one trigger on safety_alerts (trg_engagement_safety_alert_verify, 20261005000000)
--   acts only when verified flips to true, which this UPDATE never does.
--
-- Privilege: plain invoker function with a pinned search_path, run by pg_cron as the job
-- owner (the same shape as events_generate_nightly in 20261023000000); EXECUTE is revoked
-- from PUBLIC, anon and authenticated, so no client can call it.
--
-- Migration order (5-step): (1) no extensions; (2)-(4) no tables; one function + one cron
-- job; (5) no RLS change (no new table). ONE transaction; the schema_migrations ledger row is
-- written in the SAME transaction.

BEGIN;
-- Fail fast instead of queueing behind long reads when a lock is contended.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.expire_safety_alerts()
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.safety_alerts
     SET status = 'expired'
   WHERE status = 'live'
     AND expires_at <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 0 THEN
    INSERT INTO public.app_logs (level, event, context)
    VALUES ('info', 'safety_alerts.expire', jsonb_build_object('expired', v_n));
  END IF;
  RETURN v_n;
EXCEPTION WHEN OTHERS THEN
  -- The UPDATE is rolled back to the block start; record the failure and return NULL.
  INSERT INTO public.app_logs (level, event, context)
  VALUES ('error', 'safety_alerts.expire', jsonb_build_object('error_code', SQLSTATE));
  RETURN NULL;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.expire_safety_alerts() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.expire_safety_alerts() IS
  'Moves safety_alerts from live to expired when expires_at <= now(); returns the count. Run by pg_cron job safety_alerts_expire every 5 minutes. 20261025000000.';

-- pg_cron job (guarded + idempotent re-schedule, same shape as 20261023000000).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'safety_alerts_expire') THEN
      PERFORM cron.unschedule('safety_alerts_expire');
    END IF;
    PERFORM cron.schedule('safety_alerts_expire', '*/5 * * * *', 'SELECT public.expire_safety_alerts();');
  END IF;
END;
$cron$;

-- One run now, so alerts that are already past expiry are 'expired' when this commits.
SELECT public.expire_safety_alerts();

-- Ledger row in the SAME transaction.
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261025000000', 'safety_alerts_expire_job');

COMMIT;
