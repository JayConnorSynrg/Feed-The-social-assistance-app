-- safety_alerts_expire.smoke.sql
-- Behavioural smoke for 20261025000000_safety_alerts_expire_job.sql: expire_safety_alerts()
-- (status x expiry-position matrix incl. expires_at = now(), exactly-once, app_logs rows, no
-- engagement side effect, privileges + search_path), the safety_alerts_expire cron job, and
-- vote_safety_alert's liveness rule (a past-expiry alert takes no vote; a vote never turns an
-- alert expired by the job into 'cleared').
--
-- Run against a database that ALREADY has the migration applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/safety_alerts_expire.smoke.sql
--   -- or via the Management API SQL endpoint (single request; it wraps one txn).
--
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING (on a live database the
-- job's run inside this transaction is rolled back too). A failed ASSERT aborts the
-- transaction with the failing message; reaching the final NOTICE means every check held.
-- Portable: it discovers three non-guest profiles at runtime and SKIPs (loud NOTICE) when they
-- are absent. X4 creates a trigger on public.safety_alert_votes, so it runs only on a
-- local/ephemeral database that opts in with feed.smoke_local=on
-- (PGOPTIONS='-c feed.smoke_local=on'); elsewhere it is skipped with a NOTICE.
-- now() is fixed for the transaction, so "expires_at = now()" is an exact boundary.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path TO public, extensions, pg_temp;

CREATE TEMP TABLE smoke_seed (id uuid PRIMARY KEY, status text, pos text, verified boolean, expect text) ON COMMIT DROP;

DO $smoke$
DECLARE
  v_p        uuid[];
  v_creator  uuid;
  v_verifier uuid;
  v_n        integer;
  v_pre      integer;
  v_logs     integer;
  v_info     integer;
  v_id       uuid;
  v_state    text;
  v_err      text;
  r          record;
BEGIN
  SELECT array_agg(id) INTO v_p FROM (
    SELECT p.id FROM public.profiles p
     WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.is_anonymous IS TRUE)
     ORDER BY p.id LIMIT 3) s;
  IF COALESCE(array_length(v_p, 1), 0) < 3 THEN
    RAISE NOTICE 'SKIP safety_alerts_expire smoke: needs three non-guest profiles';
    RETURN;
  END IF;
  v_creator := v_p[1]; v_verifier := v_p[2];

  -- ===================================================================================
  -- X0 — hygiene: expire_safety_alerts is invoker-only, pinned, not client-callable;
  --      vote_safety_alert keeps SECURITY DEFINER, its search_path and its grants.
  -- ===================================================================================
  ASSERT NOT has_function_privilege('anon', 'public.expire_safety_alerts()', 'EXECUTE'),
    'X0: anon must hold no EXECUTE on expire_safety_alerts';
  ASSERT NOT has_function_privilege('authenticated', 'public.expire_safety_alerts()', 'EXECUTE'),
    'X0: authenticated must hold no EXECUTE on expire_safety_alerts';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.expire_safety_alerts()'::regprocedure),
    'X0: expire_safety_alerts must not be SECURITY DEFINER';
  ASSERT (SELECT proconfig FROM pg_proc WHERE oid = 'public.expire_safety_alerts()'::regprocedure)
         @> ARRAY['search_path=public, pg_temp'],
    'X0: expire_safety_alerts must pin search_path = public, pg_temp';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.vote_safety_alert(uuid,text)'::regprocedure),
    'X0: vote_safety_alert stays SECURITY DEFINER';
  ASSERT (SELECT proconfig FROM pg_proc WHERE oid = 'public.vote_safety_alert(uuid,text)'::regprocedure)
         @> ARRAY['search_path=public, pg_temp'],
    'X0: vote_safety_alert keeps search_path = public, pg_temp';
  ASSERT has_function_privilege('authenticated', 'public.vote_safety_alert(uuid,text)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.vote_safety_alert(uuid,text)', 'EXECUTE'),
    'X0: vote_safety_alert stays authenticated-only';

  -- ===================================================================================
  -- X1 — cron: exactly one safety_alerts_expire job every 5 minutes (guarded like the migration).
  -- ===================================================================================
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    ASSERT (SELECT count(*) FROM cron.job WHERE jobname = 'safety_alerts_expire') = 1,
      'X1: exactly one cron.job named safety_alerts_expire';
    ASSERT (SELECT schedule FROM cron.job WHERE jobname = 'safety_alerts_expire') = '*/5 * * * *',
      'X1: safety_alerts_expire runs every 5 minutes';
  ELSE
    RAISE NOTICE 'SKIP X1: pg_cron is not installed on this database';
  END IF;

  -- ===================================================================================
  -- X2 — the job: one row per status x expiry position (past / now / future), plus a verified
  --      live past-expiry row whose verify-trigger preconditions all hold except the flip.
  --      Only live rows at or past expiry move; nothing else changes.
  -- ===================================================================================
  INSERT INTO smoke_seed (id, status, pos, verified, expect)
  SELECT gen_random_uuid(), st, pos, false,
         CASE WHEN st = 'live' AND pos IN ('past', 'now') THEN 'expired' ELSE st END
    FROM unnest(ARRAY['live', 'expired', 'cleared', 'removed']) st
   CROSS JOIN unnest(ARRAY['past', 'now', 'future']) pos;
  INSERT INTO smoke_seed VALUES (gen_random_uuid(), 'live', 'past', true, 'expired');

  INSERT INTO public.safety_alerts (id, alert_type, severity, description, location, status, created_by,
                                    expires_at, verified, verified_by, verified_at)
  SELECT s.id, 'general', 1, 'SMOKE expire', ST_SetSRID(ST_MakePoint(-72.58, 44.26), 4326)::geography,
         s.status, v_creator,
         now() + CASE s.pos WHEN 'past' THEN interval '-1 hour' WHEN 'now' THEN interval '0' ELSE interval '1 hour' END,
         s.verified, CASE WHEN s.verified THEN v_verifier END, CASE WHEN s.verified THEN now() END
    FROM smoke_seed s;

  SELECT count(*) INTO v_pre FROM public.safety_alerts WHERE status = 'live' AND expires_at <= now();
  SELECT count(*) INTO v_logs FROM public.app_logs WHERE event = 'safety_alerts.expire';

  v_n := public.expire_safety_alerts();
  ASSERT v_n = v_pre,
    format('X2: the run must move exactly the %s live past-expiry rows, moved %s', v_pre, v_n);
  FOR r IN SELECT s.id, s.status AS seeded, s.pos, s.verified, s.expect, a.status AS now_status
             FROM smoke_seed s JOIN public.safety_alerts a USING (id) LOOP
    ASSERT r.now_status = r.expect,
      format('X2: %s/%s (verified=%s) must be %s, is %s', r.seeded, r.pos, r.verified, r.expect, r.now_status);
  END LOOP;
  ASSERT NOT EXISTS (SELECT 1 FROM public.safety_alerts WHERE status = 'live' AND expires_at <= now()),
    'X2: no live row may remain at or past expiry';

  -- exactly one info row for a run that expired something, carrying the count
  ASSERT (SELECT count(*) FROM public.app_logs WHERE event = 'safety_alerts.expire') = v_logs + 1,
    'X2: a run that expires rows writes exactly one app_logs row';
  ASSERT EXISTS (SELECT 1 FROM public.app_logs
                  WHERE event = 'safety_alerts.expire' AND level = 'info' AND (context->>'expired')::int = v_n),
    'X2: that row is level info with context.expired = the count';

  -- no engagement side effect for the verified row
  ASSERT NOT EXISTS (SELECT 1 FROM public.engagement_events e JOIN smoke_seed s ON s.id = e.target_id),
    'X2: expiring an alert must write no engagement_events row';

  -- ===================================================================================
  -- X3 — exactly once: a second run moves 0 rows and writes no log row.
  -- ===================================================================================
  ASSERT public.expire_safety_alerts() = 0, 'X3: the second run must move 0 rows';
  ASSERT (SELECT count(*) FROM public.app_logs WHERE event = 'safety_alerts.expire') = v_logs + 1,
    'X3: a run that moves nothing writes no app_logs row';

  -- ===================================================================================
  -- X4 — votes. (a) An alert past expiry the job has not reached yet takes no vote.
  -- ===================================================================================
  v_id := gen_random_uuid();
  INSERT INTO public.safety_alerts (id, alert_type, severity, location, status, created_by, expires_at)
  VALUES (v_id, 'general', 1, ST_SetSRID(ST_MakePoint(-72.58, 44.26), 4326)::geography, 'live', v_creator,
          now() - interval '1 minute');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_p[3], 'role', 'authenticated', 'is_anonymous', false)::text, true);
  SET LOCAL ROLE authenticated;
  v_state := NULL; v_err := NULL;
  BEGIN
    PERFORM public.vote_safety_alert(v_id, 'confirm');
  EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
  END;
  RESET ROLE;
  ASSERT v_err = 'alert is no longer live',
    'X4a: a vote on a past-expiry alert must be refused as no longer live, got '||COALESCE(v_state || ' ' || v_err, '<accepted>');
  ASSERT NOT EXISTS (SELECT 1 FROM public.safety_alert_votes WHERE alert_id = v_id),
    'X4a: a refused vote must write nothing';

  -- (b) The job expires an alert between a vote's liveness check and its count UPDATE (simulated
  --     with a trigger that moves the clock and runs the job when the vote row lands). The vote
  --     would auto-clear it (3 clears > 0 confirms); the row must stay 'expired'.
  IF current_setting('feed.smoke_local', true) = 'on' THEN
    v_id := gen_random_uuid();
    INSERT INTO public.safety_alerts (id, alert_type, severity, location, status, created_by, expires_at)
    VALUES (v_id, 'general', 1, ST_SetSRID(ST_MakePoint(-72.58, 44.26), 4326)::geography, 'live', v_creator,
            now() + interval '1 hour');
    INSERT INTO public.safety_alert_votes (alert_id, voter_id, vote)
    VALUES (v_id, v_p[1], 'clear'), (v_id, v_p[2], 'clear');
    CREATE FUNCTION public.smoke_expire_on_vote() RETURNS trigger LANGUAGE plpgsql AS $t$
    BEGIN
      UPDATE public.safety_alerts SET expires_at = now() - interval '1 second' WHERE id = NEW.alert_id;
      PERFORM public.expire_safety_alerts();
      RETURN NULL;
    END $t$;
    EXECUTE format('CREATE TRIGGER smoke_expire_on_vote AFTER INSERT ON public.safety_alert_votes
                    FOR EACH ROW WHEN (NEW.alert_id = %L::uuid) EXECUTE FUNCTION public.smoke_expire_on_vote()', v_id);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_p[3], 'role', 'authenticated', 'is_anonymous', false)::text, true);
    SET LOCAL ROLE authenticated;
    v_state := NULL; v_err := NULL;
    BEGIN
      PERFORM public.vote_safety_alert(v_id, 'clear');
    EXCEPTION WHEN others THEN v_state := SQLSTATE; v_err := SQLERRM;
    END;
    RESET ROLE;
    ASSERT v_state IS NULL, 'X4b: the vote itself passed the liveness check, got '||COALESCE(v_state || ' ' || v_err, '');
    SELECT status, clear_count INTO r FROM public.safety_alerts WHERE id = v_id;
    ASSERT r.status = 'expired',
      'X4b: a vote racing the job must leave the alert expired, is '||r.status;
    ASSERT r.clear_count = 3, 'X4b: the vote counts are still recomputed (clear_count 3), is '||r.clear_count;
  ELSE
    RAISE NOTICE 'SKIP X4b: needs feed.smoke_local=on (creates a trigger on public.safety_alert_votes)';
  END IF;

  RAISE NOTICE 'PASS safety_alerts_expire smoke: X0 hygiene, X1 cron, X2 matrix + log + no engagement, X3 exactly once, X4 votes';
END
$smoke$;

ROLLBACK;
