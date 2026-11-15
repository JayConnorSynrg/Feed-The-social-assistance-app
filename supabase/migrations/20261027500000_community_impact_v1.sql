-- 20261027500000_community_impact_v1.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: community impact v1. One read, community_impact_summary(), gives the Impact overview card every figure
-- in specs/impact-metrics-contract.md section 2: directory figures in full, people figures only once enough
-- distinct people contribute (rounded down to a multiple of 5), and no figure falls when an account is deleted.
-- Contract: specs/impact-metrics-contract.md (sections 1-4 are this file's spec; section 6 its proof).
--
-- Who counts toward k (the "contributors" of a people figure): distinct member accounts. A guest account
-- (auth.users.is_anonymous) adds to every value and to no k, so fake guest accounts cannot open a figure. For
-- people_served_at_events an identity is a confirmed visit's household_key, or else its member account; a visit
-- with neither (an anonymous walk-in, or a visit whose account was deleted) adds to the visits and the sum, never to
-- the identities.
--
-- What this migration does
--   (A) community_impact_rollup: what account deletions took away, as all-time totals per figure: carried rows
--       (count), carried accounts (contributors) and carried member accounts (k_contributors). No row can be tied to
--       one deletion: no timestamp, no period, a random key, and every deletion updates every figure's row (adding
--       zero where the account had nothing), so a row's xmin / heap position say only "the latest deletion". Counts
--       only (no user id, no target id); RLS on with no policy and no client grant, so it is read only through the RPC.
--   (B) community_impact_carry_departed(): one row-level BEFORE DELETE trigger on auth.users, the only writer. Every
--       deletion path is a DELETE FROM auth.users (the member's delete-account function, the admin delete route, the
--       nightly cleanup-anonymous-users job). The trigger runs once per deleted account, before the cascades, while the
--       account's ledger rows, its check-ins and its is_anonymous flag are still readable; it carries the ledger rows
--       the cascade will remove and, for a member, the event identity that ON DELETE SET NULL will erase. A delete that
--       finds no row runs no trigger, so a repeated delete adds nothing. The carry never cancels or blocks a deletion:
--       it takes a figure's row with FOR UPDATE SKIP LOCKED and, when another deletion holds it, adds a separate row
--       instead of waiting (the next carry folds such rows back in); its only other wait, a table-level lock, is capped
--       by SET lock_timeout = '100ms'; any error, a lock timeout or a statement timeout (query_canceled) inside it is
--       logged (log_engagement_failure 'impact_carry') and the deletion goes on.
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

-- Preflight, before anything changes: every object and column this file reads, the foreign-key behaviours the
-- deletion invariant rests on, and the absence of everything it creates. Anything missing or shaped otherwise: one
-- refusal naming every item (SQLSTATE 55000), nothing applied.
DO $preflight$
DECLARE v_missing text[] := '{}'; v_col text[]; v_fk text[];
BEGIN
  IF to_regclass('auth.users') IS NULL THEN v_missing := v_missing || 'relation auth.users'::text; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('auth.users') AND attname = 'is_anonymous'
                  AND atttypid = 'boolean'::regtype AND attnum > 0 AND NOT attisdropped) THEN
    v_missing := v_missing || 'column auth.users.is_anonymous (boolean)'::text; END IF;
  FOREACH v_col SLICE 1 IN ARRAY ARRAY[
    ['engagement_events', 'actor_id'], ['engagement_events', 'kind'], ['engagement_events', 'created_at'],
    ['event_checkins', 'status'], ['event_checkins', 'household_size'], ['event_checkins', 'household_key'],
    ['event_checkins', 'user_id'], ['event_checkins', 'checked_in_at'], ['event_occurrences', 'event_id'],
    ['event_occurrences', 'status'], ['event_occurrences', 'starts_at'], ['assistance_events', 'is_active'],
    ['resources', 'status'], ['resources', 'source'], ['resources', 'zip_code'], ['organizations', 'is_active'],
    ['organizations', 'status'], ['snap_retailers', 'id'], ['app_logs', 'event']] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.' || v_col[1]) AND attname = v_col[2]
                    AND attnum > 0 AND NOT attisdropped) THEN
      v_missing := v_missing || format('column public.%s.%s', v_col[1], v_col[2]); END IF;
  END LOOP;
  -- engagement_events.actor_id must CASCADE from auth.users (the carry counts the rows the cascade removes);
  -- event_checkins.user_id must SET NULL (visits outlive the account; only the member identity is carried)
  FOREACH v_fk SLICE 1 IN ARRAY ARRAY[['engagement_events', 'actor_id', 'c'], ['event_checkins', 'user_id', 'n']] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                    WHERE c.contype = 'f' AND c.conrelid = to_regclass('public.' || v_fk[1]) AND cardinality(c.conkey) = 1
                      AND a.attname = v_fk[2] AND c.confrelid = to_regclass('auth.users') AND c.confdeltype = v_fk[3]::"char") THEN
      v_missing := v_missing || format('foreign key public.%s.%s -> auth.users ON DELETE %s', v_fk[1], v_fk[2],
                                       CASE v_fk[3] WHEN 'c' THEN 'CASCADE' ELSE 'SET NULL' END); END IF;
  END LOOP;
  -- a BEFORE DELETE row trigger on auth.users could cancel a deletion after the carry ran (a carry with no deletion)
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('auth.users') AND NOT tgisinternal
              AND tgtype & 11 = 11) THEN                                    -- ROW (1) + BEFORE (2) + DELETE (8)
    v_missing := v_missing || 'no BEFORE DELETE row trigger on auth.users yet (this file adds the only one)'::text; END IF;
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
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,   -- random: no order, no time
  metric_id       text        NOT NULL,
  count           bigint      NOT NULL DEFAULT 0 CHECK (count >= 0),            -- carried ledger rows
  contributors    bigint      NOT NULL DEFAULT 0 CHECK (contributors >= 0),     -- carried accounts (guests included)
  k_contributors  bigint      NOT NULL DEFAULT 0 CHECK (k_contributors >= 0),   -- carried member accounts / identities
  CHECK (metric_id IN ('petition_signers', 'needs_met', 'alerts_verified', 'member_resources_approved', 'people_served_at_events')),
  CHECK (k_contributors <= contributors)
);
COMMENT ON TABLE public.community_impact_rollup IS
  'All-time totals of what account deletions took from the impact figures (carried ledger rows, accounts, member accounts for k), normally one row per figure. Written only by community_impact_carry_departed (BEFORE DELETE on auth.users), which updates every figure on every deletion; read only through community_impact_summary(). specs/impact-metrics-contract.md section 3.';

-- ---------------------------------------------------------------------------
-- (3a) The carry: once per deleted account, before its cascades.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.community_impact_carry_departed()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '100ms'
AS $fn$
DECLARE
  v_member boolean;
  r        record;
  v_keep   uuid;
BEGIN
  -- everything but RETURN OLD is inside this block: the deletion goes on whatever happens here
  BEGIN
    v_member := OLD.is_anonymous IS NOT TRUE;   -- a guest adds to values, never to k
    FOR r IN
      -- this account's share of every figure, zeros included: each deletion touches all five rows alike
      SELECT f.metric_id,
             coalesce(l.n, 0) AS n,
             CASE WHEN f.metric_id = 'people_served_at_events' THEN coalesce(ev.d, 0)
                  ELSE (coalesce(l.n, 0) > 0)::int END AS d
        FROM (VALUES ('petition_signers', 'petition_signature'), ('needs_met', 'opt_in_completed_seeker'),
                     ('alerts_verified', 'safety_alert_verified'), ('member_resources_approved', 'resource_approved'),
                     ('people_served_at_events', NULL)) f(metric_id, kind)
        LEFT JOIN LATERAL (
          -- the ledger rows ON DELETE CASCADE is about to remove
          SELECT count(*) AS n FROM public.engagement_events e WHERE e.actor_id = OLD.id AND e.kind = f.kind
        ) l ON f.kind IS NOT NULL
        LEFT JOIN LATERAL (
          -- the account's own identity at events (a confirmed visit with no household_key): ON DELETE SET NULL erases
          -- it, the visits and their sum stay
          SELECT 1 AS d WHERE EXISTS (SELECT 1 FROM public.event_checkins c
                                       WHERE c.user_id = OLD.id AND c.status = 'confirmed' AND c.household_key IS NULL)
        ) ev ON f.kind IS NULL
    LOOP
      v_keep := NULL;
      SELECT id INTO v_keep FROM public.community_impact_rollup WHERE metric_id = r.metric_id
       ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF v_keep IS NULL THEN
        -- no row yet, or another deletion holds it: add a row rather than wait
        INSERT INTO public.community_impact_rollup (metric_id, count, contributors, k_contributors)
        VALUES (r.metric_id, r.n, r.d, CASE WHEN v_member THEN r.d ELSE 0 END);
      ELSE
        -- add this account and fold every other unlocked row of the figure into the kept one (totals unchanged)
        WITH folded AS (
          DELETE FROM public.community_impact_rollup
           WHERE id IN (SELECT id FROM public.community_impact_rollup
                         WHERE metric_id = r.metric_id AND id <> v_keep FOR UPDATE SKIP LOCKED)
          RETURNING count, contributors, k_contributors
        )
        UPDATE public.community_impact_rollup
           SET count          = count + r.n + coalesce((SELECT sum(count) FROM folded), 0),
               contributors   = contributors + r.d + coalesce((SELECT sum(contributors) FROM folded), 0),
               k_contributors = k_contributors + CASE WHEN v_member THEN r.d ELSE 0 END
                                + coalesce((SELECT sum(k_contributors) FROM folded), 0)
         WHERE id = v_keep;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS OR query_canceled THEN
    -- OTHERS does not include query_canceled (a statement timeout); both are logged and the deletion goes on
    BEGIN
      PERFORM public.log_engagement_failure('impact_carry', SQLSTATE || ' ' || SQLERRM);
    EXCEPTION WHEN OTHERS OR query_canceled THEN NULL;
    END;
  END;
  RETURN OLD;
END;
$fn$;

CREATE TRIGGER trg_community_impact_carry_departed
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.community_impact_carry_departed();

-- ---------------------------------------------------------------------------
-- (3b) The read: every figure id always present; suppression and rounding inside.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.community_impact_summary()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  k_people   constant integer := 10;   -- distinct member accounts (or identities) for a people-derived figure
  k_visits   constant integer := 20;   -- confirmed visits for the household sum
  v          jsonb := '{}'::jsonb;
  n          bigint;   -- the figure's value before rounding
  a          bigint;   -- distinct accounts, guests included (petition_signers' value)
  d          bigint;   -- distinct member accounts: k
  h          bigint;   -- distinct identities at events: k
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

  -- ledger figures: value from live rows + carried rows (guests included); k from distinct member accounts, live +
  -- carried (guests excluded)
  FOR r IN
    SELECT f.metric_id, f.kind, f.unit, f.people_value
      FROM (VALUES ('petition_signers',          'petition_signature',      'people',      true),
                   ('needs_met',                 'opt_in_completed_seeker', 'completions', false),
                   ('alerts_verified',           'safety_alert_verified',   'alerts',      false),
                   ('member_resources_approved', 'resource_approved',       'resources',   false)) f(metric_id, kind, unit, people_value)
  LOOP
    SELECT count(*), count(DISTINCT e.actor_id), count(DISTINCT e.actor_id) FILTER (WHERE u.is_anonymous IS NOT TRUE)
      INTO n, a, d
      FROM engagement_events e JOIN auth.users u ON u.id = e.actor_id
     WHERE e.kind = r.kind;
    SELECT n + coalesce(sum(c.count), 0), a + coalesce(sum(c.contributors), 0), d + coalesce(sum(c.k_contributors), 0)
      INTO n, a, d
      FROM community_impact_rollup c WHERE c.metric_id = r.metric_id;
    IF r.people_value THEN n := a; END IF;   -- petition_signers is the number of distinct signers
    v := v || jsonb_build_object(r.metric_id, jsonb_build_object(
           'value', CASE WHEN d >= k_people THEN to_jsonb(n - n % 5) ELSE 'null'::jsonb END,
           'suppressed', d < k_people, 'unit', r.unit, 'window', 'all_time'));
  END LOOP;

  -- people served at events: every confirmed visit adds to the visits and the sum; identities are household keys and
  -- member accounts only (live), plus member identities carried at account deletion
  SELECT coalesce(sum(c.household_size), 0), count(*),
         count(DISTINCT CASE WHEN c.household_key IS NOT NULL THEN 'k:' || c.household_key
                             WHEN c.user_id IS NOT NULL AND u.is_anonymous IS NOT TRUE THEN 'u:' || c.user_id::text END)
    INTO n, d, h
    FROM event_checkins c LEFT JOIN auth.users u ON u.id = c.user_id
   WHERE c.status = 'confirmed';
  h := h + coalesce((SELECT sum(k_contributors) FROM community_impact_rollup WHERE metric_id = 'people_served_at_events'), 0);
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
