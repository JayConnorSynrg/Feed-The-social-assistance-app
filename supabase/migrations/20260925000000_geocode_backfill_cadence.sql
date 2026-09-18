-- Recurring geocode-verification cadence.
--
-- INVARIANT: every approved+located resource row reaches a verified
-- geocode_accuracy tag within one cadence interval of its creation,
-- automatically, regardless of which writer created it — without exceeding
-- the edge compute budget (batch <= 2000/run) and without ever embedding the
-- raw BACKFILL_SECRET value in this migration or anywhere in the repo.
--
-- The already-deployed geocode-backfill edge function's `?target=untagged`
-- mode already selects its candidates by `geocode_accuracy IS NULL` (via
-- untagged_geocode_targets(), 20260923000000) — orphan-proof by construction
-- (PR-4, #189): any row created by ANY writer (admin form, 211 sync, HUD
-- sync, IMLS sync, federation ingest, etc.) that lands with
-- status='approved' AND location IS NOT NULL AND geocode_accuracy IS NULL
-- falls into this selector on the very next cadence run. No per-writer
-- wiring is needed — the cadence closes the invariant for every current and
-- future writer uniformly.
--
-- The function already honors `?limit=` for untagged mode, clamped to
-- UNTAGGED_MAX_LIMIT = 4000 (supabase/functions/geocode-backfill/index.ts) —
-- requesting limit=2000 is honored as-is, so no function code change or
-- redeploy is required to hold the batch <= 2000/run instruction here.
--
-- Secret handling: the shared `x-backfill-secret` header value is read from
-- Supabase Vault (`vault.decrypted_secrets` WHERE name = 'BACKFILL_SECRET')
-- at CRON RUNTIME via a subquery inside the job body — the raw value is
-- never written to this file, this migration, or cron.job.command literally;
-- only the lookup expression is persisted.

-- pg_cron / pg_net are already installed on this project (verified live:
-- pg_cron 1.6.4 in pg_catalog, pg_net 0.19.5 in public) — IF NOT EXISTS kept
-- for portability to any environment where they are not yet enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent (re)schedule: drop any prior job of this name before creating
-- the new one, so re-running this migration never produces a duplicate job.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'geocode-backfill-cadence') THEN
    PERFORM cron.unschedule('geocode-backfill-cadence');
  END IF;
END;
$$;

-- Daily at 04:17 UTC (low-traffic window, matches the low-traffic-hour
-- convention already used by daily-hud-sync at 03:00 UTC).
SELECT cron.schedule(
  'geocode-backfill-cadence',
  '17 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/geocode-backfill?target=untagged&limit=2000',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backfill-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'BACKFILL_SECRET'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
