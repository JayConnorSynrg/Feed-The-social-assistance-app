-- Sync secret in Vault: hud-sync / imls-sync cron jobs read x-sync-secret at run time.
--
-- INVARIANT: pg_cron jobs `daily-hud-sync` and `monthly-imls-sync-batch1`
-- authenticate to the hud-sync / imls-sync edge functions with the
-- `x-sync-secret` header, and that header value is read from Supabase Vault
-- (`vault.decrypted_secrets` WHERE name = 'RESOURCE_SYNC_SECRET') at CRON
-- RUNTIME. cron.job.command holds only the lookup expression, so the value
-- stays out of cron.job, out of cron.job_run_details.command, and out of this
-- repo. Same idiom as job `geocode-backfill-cadence`
-- (20260925000000_geocode_backfill_cadence.sql).
--
-- Both jobs were first created out-of-band (no earlier migration) with the
-- secret embedded as a literal in the header JSON. This migration records
-- their bodies in the repo for the first time:
--   * where a job of that name exists, it is re-pointed in place with
--     cron.alter_job (jobid, schedule and active are preserved);
--   * where it does not exist, it is scheduled with the production schedule.
--
-- Secret provisioning (out-of-band, value generated inside Postgres so it
-- never travels in a request body; the edge env var must hold the same value):
--   SELECT vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
--                              'RESOURCE_SYNC_SECRET', '<description>');
--   supabase secrets set --env-file <file with RESOURCE_SYNC_SECRET=...>
-- Rotation = vault.update_secret(<id>, <new value>) + the same secrets set;
-- the job bodies below stay unchanged.

-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction
-- (repo convention since 20261012000000). The ledger insert is ON CONFLICT DO NOTHING because
-- production recorded this version when it was applied on 2026-10-06.
BEGIN;

-- pg_cron / pg_net are already installed on this project (pg_cron 1.6.4 in
-- pg_catalog, pg_net 0.19.5 in public) — IF NOT EXISTS kept for portability
-- to any environment where they are not yet enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $mig$
DECLARE
  v_hud_body text := $cron$
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/hud-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'RESOURCE_SYNC_SECRET'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$;

  v_imls_body text := $cron$
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/imls-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'RESOURCE_SYNC_SECRET'
      )
    ),
    body := '{"state": "CA"}'::jsonb,
    timeout_milliseconds := 30000
  );
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/imls-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'RESOURCE_SYNC_SECRET'
      )
    ),
    body := '{"state": "TX"}'::jsonb,
    timeout_milliseconds := 30000
  );
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/imls-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'RESOURCE_SYNC_SECRET'
      )
    ),
    body := '{"state": "NY"}'::jsonb,
    timeout_milliseconds := 30000
  );
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/imls-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'RESOURCE_SYNC_SECRET'
      )
    ),
    body := '{"state": "FL"}'::jsonb,
    timeout_milliseconds := 30000
  );
  SELECT net.http_post(
    url := 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/imls-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'RESOURCE_SYNC_SECRET'
      )
    ),
    body := '{"state": "VT"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$;

  v_jobid bigint;
BEGIN
  -- Daily at 03:00 UTC.
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-hud-sync';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, command := v_hud_body);
  ELSE
    PERFORM cron.schedule('daily-hud-sync', '0 3 * * *', v_hud_body);
  END IF;

  -- Monthly on the 1st at 04:00 UTC, one post per state.
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'monthly-imls-sync-batch1';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, command := v_imls_body);
  ELSE
    PERFORM cron.schedule('monthly-imls-sync-batch1', '0 4 1 * *', v_imls_body);
  END IF;
END;
$mig$;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261019500000', 'sync_secret_vault')
ON CONFLICT (version) DO NOTHING;

COMMIT;
