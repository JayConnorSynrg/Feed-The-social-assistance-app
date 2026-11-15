-- 20261027500000_community_impact_v1.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: community impact v1. One read, community_impact_summary(), gives the Impact overview card every figure
-- in specs/impact-metrics-contract.md section 2: directory figures in full, people figures only once enough
-- distinct people contribute (rounded down to a multiple of 5), and no figure falls when an account is deleted.
-- Contract: specs/impact-metrics-contract.md (sections 1-4 are this file's spec; section 6 its proof).
--
-- What this migration does
--   (A) community_impact_rollup: counts carried from ledger rows lost to an account deletion. Counts only (no user
--       id, no target id); RLS on with no policy and no client grant, so it is read only through the RPC.
--   (B) community_impact_carry_departed(): one statement-level AFTER DELETE trigger on engagement_events. It carries
--       the rows whose actor no longer exists in auth.users (an account deletion's cascade) and nothing else. Every
--       deletion path ends in DELETE FROM auth.users (the member's delete-account function, the admin delete route,
--       the nightly cleanup-anonymous-users job), and that cascade removes all of one account's rows in one
--       statement, so each row and each account is carried exactly once. A failure inside the carry is logged
--       (log_engagement_failure 'impact_carry') and never blocks the deletion.
--   (C) community_impact_summary(): SECURITY DEFINER, STABLE, pinned search_path, no arguments; anon and
--       authenticated may call it, PUBLIC may not. Suppression and rounding happen here; a suppressed figure's
--       count never leaves the database.
--
-- Rollout: additive only (expand). Nothing existing is altered or dropped, so the client deployed today is
-- unaffected; the Impact card that calls the RPC ships after this is applied. No realtime publication change.
-- Migration order: (1) extensions: none; (2) core table: community_impact_rollup; (3) dependent objects: the carry
-- function + trigger, the RPC; (4) junction tables: none; (5) grants + RLS last.
-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Preflight, before anything changes: every object and column this file reads, the two foreign-key behaviours the
-- deletion invariant rests on, and the absence of everything it creates. Anything missing or shaped otherwise: one
-- refusal naming every item (SQLSTATE 55000), nothing applied.
DO $preflight$
DECLARE v_missing text[] := '{}'; v_col text[]; v_fk text[];
BEGIN
  IF to_regclass('auth.users') IS NULL THEN v_missing := v_missing || 'relation auth.users'::text; END IF;
  FOREACH v_col SLICE 1 IN ARRAY ARRAY[
    ['engagement_events', 'actor_id'], ['engagement_events', 'kind'], ['engagement_events', 'created_at'],
    ['event_checkins', 'status'], ['event_checkins', 'household_size'], ['event_checkins', 'household_key'],
    ['event_checkins', 'user_id'], ['event_occurrences', 'event_id'], ['event_occurrences', 'status'],
    ['event_occurrences', 'starts_at'], ['assistance_events', 'is_active'], ['resources', 'status'],
    ['resources', 'source'], ['resources', 'zip_code'], ['organizations', 'is_active'], ['organizations', 'status'],
    ['snap_retailers', 'id'], ['app_logs', 'event']] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.' || v_col[1]) AND attname = v_col[2]
                    AND attnum > 0 AND NOT attisdropped) THEN
      v_missing := v_missing || format('column public.%s.%s', v_col[1], v_col[2]); END IF;
  END LOOP;
  -- engagement_events.actor_id must CASCADE from auth.users (the carry reads the cascade); event_checkins.user_id must
  -- SET NULL (people_served_at_events needs no carry only because check-ins outlive the account)
  FOREACH v_fk SLICE 1 IN ARRAY ARRAY[['engagement_events', 'actor_id', 'c'], ['event_checkins', 'user_id', 'n']] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                    WHERE c.contype = 'f' AND c.conrelid = to_regclass('public.' || v_fk[1]) AND cardinality(c.conkey) = 1
                      AND a.attname = v_fk[2] AND c.confrelid = to_regclass('auth.users') AND c.confdeltype = v_fk[3]::"char") THEN
      v_missing := v_missing || format('foreign key public.%s.%s -> auth.users ON DELETE %s', v_fk[1], v_fk[2],
                                       CASE v_fk[3] WHEN 'c' THEN 'CASCADE' ELSE 'SET NULL' END); END IF;
  END LOOP;
  IF to_regprocedure('public.log_engagement_failure(text,text)') IS NULL THEN
    v_missing := v_missing || 'function public.log_engagement_failure(text,text)'::text; END IF;
  IF to_regtype('public.resource_source') IS NULL
     OR (SELECT count(*) FROM pg_enum WHERE enumtypid = to_regtype('public.resource_source') AND enumlabel IN ('imls', 'hud')) <> 2 THEN
    v_missing := v_missing || 'enum public.resource_source with values imls and hud'::text; END IF;
  IF to_regclass('public.community_impact_rollup') IS NOT NULL THEN
    v_missing := v_missing || 'relation public.community_impact_rollup must not exist yet (this file creates it)'::text; END IF;
  IF to_regprocedure('public.community_impact_summary()') IS NOT NULL THEN
    v_missing := v_missing || 'function public.community_impact_summary() must not exist yet (this file creates it)'::text; END IF;
  IF to_regprocedure('public.community_impact_carry_departed()') IS NOT NULL THEN
    v_missing := v_missing || 'function public.community_impact_carry_departed() must not exist yet (this file creates it)'::text; END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261027500000') THEN
    v_missing := v_missing || 'ledger row 20261027500000 must not exist yet'::text; END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION '20261027500000_community_impact_v1 refused: this database does not have the shape it was written for'
      USING ERRCODE = '55000', DETAIL = array_to_string(v_missing, '; '),
            HINT = 'Nothing was applied. Restore the listed objects (or remove what this file creates) and re-run.';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- (2) Core table: carried counts. No user id, no target id.
-- ---------------------------------------------------------------------------
CREATE TABLE public.community_impact_rollup (
  metric_id     text        NOT NULL,
  period_start  date        NOT NULL,   -- first day of the UTC month of the carried rows' created_at
  period_end    date        NOT NULL,   -- first day of the next month (exclusive)
  count         bigint      NOT NULL DEFAULT 0 CHECK (count >= 0),
  contributors  bigint      NOT NULL DEFAULT 0 CHECK (contributors >= 0),
  written_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_id, period_start),
  CHECK (metric_id IN ('petition_signers', 'needs_met', 'alerts_verified', 'member_resources_approved')),
  CHECK (period_end > period_start)
);
COMMENT ON TABLE public.community_impact_rollup IS
  'Counts carried from engagement_events rows lost to an account deletion (written only by community_impact_carry_departed). Read only through community_impact_summary(). specs/impact-metrics-contract.md section 3.';

-- ---------------------------------------------------------------------------
-- (3a) The carry: runs in the deleting transaction, after the cascade removed the rows.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.community_impact_carry_departed()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  BEGIN
    WITH departed AS (
      -- rows of a carried kind whose actor is gone: inside the auth.users cascade the parent row is already
      -- invisible, so this is exactly the rows lost to an account deletion (a direct delete of a live actor's row
      -- is not carried)
      SELECT CASE g.kind WHEN 'petition_signature'      THEN 'petition_signers'
                         WHEN 'opt_in_completed_seeker' THEN 'needs_met'
                         WHEN 'safety_alert_verified'   THEN 'alerts_verified'
                         WHEN 'resource_approved'       THEN 'member_resources_approved' END AS metric_id,
             g.actor_id,
             date_trunc('month', g.created_at AT TIME ZONE 'UTC')::date AS period_start
        FROM gone g
       WHERE g.kind IN ('petition_signature', 'opt_in_completed_seeker', 'safety_alert_verified', 'resource_approved')
         AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.actor_id)
    ), per_month AS (
      SELECT metric_id, period_start, count(*) AS n FROM departed GROUP BY metric_id, period_start
    ), first_month AS (
      -- each account counts once per figure, in the month of its earliest carried row of that kind
      SELECT metric_id, actor_id, min(period_start) AS period_start FROM departed GROUP BY metric_id, actor_id
    ), people AS (
      SELECT metric_id, period_start, count(*) AS d FROM first_month GROUP BY metric_id, period_start
    )
    INSERT INTO public.community_impact_rollup AS r (metric_id, period_start, period_end, count, contributors)
    SELECT m.metric_id, m.period_start, (m.period_start + interval '1 month')::date, m.n, coalesce(p.d, 0)
      FROM per_month m LEFT JOIN people p USING (metric_id, period_start)
    ON CONFLICT (metric_id, period_start) DO UPDATE
      SET count        = r.count + EXCLUDED.count,
          contributors = r.contributors + EXCLUDED.contributors,
          written_at   = now();
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_engagement_failure('impact_carry', SQLERRM);
  END;
  RETURN NULL;
END;
$fn$;

CREATE TRIGGER trg_community_impact_carry_departed
  AFTER DELETE ON public.engagement_events
  REFERENCING OLD TABLE AS gone
  FOR EACH STATEMENT EXECUTE FUNCTION public.community_impact_carry_departed();

-- ---------------------------------------------------------------------------
-- (3b) The read: every figure id always present; suppression and rounding inside.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.community_impact_summary()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  k_people   constant integer := 10;   -- distinct people for a people-derived figure
  k_visits   constant integer := 20;   -- confirmed visits for the household sum
  v          jsonb := '{}'::jsonb;
  n          bigint;
  d          bigint;
  h          bigint;   -- distinct check-in identities
  r          record;
BEGIN
  -- directory figures: in full, never suppressed
  v := v
    || jsonb_build_object('resources_available', jsonb_build_object('value',
         (SELECT count(*) FROM resources WHERE status = 'approved'),
         'suppressed', false, 'unit', 'resources', 'window', 'all_time'))
    || jsonb_build_object('resources_curated', jsonb_build_object('value',
         (SELECT count(*) FROM resources WHERE status = 'approved' AND source NOT IN ('imls', 'hud')),
         'suppressed', false, 'unit', 'resources', 'window', 'all_time'))
    || jsonb_build_object('snap_retailers', jsonb_build_object('value',
         (SELECT count(*) FROM snap_retailers),
         'suppressed', false, 'unit', 'retailers', 'window', 'all_time'))
    || jsonb_build_object('zip_codes_covered', jsonb_build_object('value',
         (SELECT count(DISTINCT zip_code) FROM resources WHERE status = 'approved' AND nullif(btrim(zip_code), '') IS NOT NULL),
         'suppressed', false, 'unit', 'zip_codes', 'window', 'all_time'))
    || jsonb_build_object('organizations_listed', jsonb_build_object('value',
         (SELECT count(*) FROM organizations WHERE is_active AND status = 'approved'),
         'suppressed', false, 'unit', 'organizations', 'window', 'all_time'))
    || jsonb_build_object('event_dates_next_30_days', jsonb_build_object('value',
         (SELECT count(*) FROM event_occurrences o JOIN assistance_events e ON e.id = o.event_id
           WHERE e.is_active AND o.status = 'upcoming' AND o.starts_at >= now() AND o.starts_at < now() + interval '30 days'),
         'suppressed', false, 'unit', 'event_dates', 'window', 'next_30_days'));

  -- ledger figures: live rows + carried counts; k on distinct accounts (live distinct actors + carried contributors)
  FOR r IN
    SELECT f.metric_id, f.kind, f.unit, f.people_value
      FROM (VALUES ('petition_signers',          'petition_signature',      'people',      true),
                   ('needs_met',                 'opt_in_completed_seeker', 'completions', false),
                   ('alerts_verified',           'safety_alert_verified',   'alerts',      false),
                   ('member_resources_approved', 'resource_approved',       'resources',   false)) f(metric_id, kind, unit, people_value)
  LOOP
    SELECT count(*), count(DISTINCT actor_id) INTO n, d FROM engagement_events WHERE kind = r.kind;
    SELECT n + coalesce(sum(c.count), 0), d + coalesce(sum(c.contributors), 0) INTO n, d
      FROM community_impact_rollup c WHERE c.metric_id = r.metric_id;
    IF r.people_value THEN n := d; END IF;   -- petition_signers is the number of distinct signers
    v := v || jsonb_build_object(r.metric_id, jsonb_build_object(
           'value', CASE WHEN d >= k_people THEN to_jsonb(n - n % 5) ELSE 'null'::jsonb END,
           'suppressed', d < k_people, 'unit', r.unit, 'window', 'all_time'));
  END LOOP;

  -- people served at events: confirmed visits only; shown at 20 visits from 10 distinct check-in identities
  SELECT coalesce(sum(household_size), 0), count(*), count(DISTINCT coalesce(household_key, user_id::text, id::text))
    INTO n, d, h
    FROM event_checkins WHERE status = 'confirmed';
  v := v || jsonb_build_object('people_served_at_events', jsonb_build_object(
         'value', CASE WHEN d >= k_visits AND h >= k_people THEN to_jsonb(n - n % 5) ELSE 'null'::jsonb END,
         'suppressed', NOT (d >= k_visits AND h >= k_people), 'unit', 'people', 'window', 'all_time'));

  RETURN v;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- (5) Grants + RLS, last. Objects postgres creates in public are born with anon / authenticated privileges
-- (pg_default_acl), so every one is revoked here by name before the one grant the design needs.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.community_impact_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_impact_summary() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.community_impact_carry_departed() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.community_impact_rollup ENABLE ROW LEVEL SECURITY;   -- no policies: no client reads or writes
REVOKE ALL ON public.community_impact_rollup FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261027500000', 'community_impact_v1');

COMMIT;
