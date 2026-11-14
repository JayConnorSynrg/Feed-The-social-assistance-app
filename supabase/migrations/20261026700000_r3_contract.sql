-- 20261026700000_r3_contract.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: the CONTRACT step of Release 3 (expand = 20261026600000_r3_foundation.sql). Apply only AFTER every
-- Release 3 client is live: until then the deployed client still updates alerts without a version token, decides
-- opt-ins with a direct UPDATE and sends a petition hash, and the foundation migration kept those three paths so
-- nothing breaks between its apply and the client deploys. (The fourth path closed here, the direct DELETE of an
-- opt-in, has no deployed caller.)
--
-- What this migration does
--   (a) update_safety_alert requires its version token (p_expected_version NULL -> 22023
--       alert_field_required:expected_version). Same signature and return type: CREATE OR REPLACE. The body is the
--       foundation body plus that one guard; nothing else changes.
--   (b) Opt-in decisions go through decide_opt_in only: the direct UPDATE (status) grant and policy opt_ins_update
--       go (with them the path that accepted an opt-in on a removed post). The policy's platform-admin branch
--       already went in the foundation.
--   (b2) No client DELETE on opt-ins: policy opt_ins_delete and the DELETE grant go. A seeker leaves through
--       withdraw_opt_in, an author lifts a decline through unblock_opt_in; both lock the post before the opt-in,
--       so they cannot deadlock with decide_opt_in the way the direct DELETE did. The slot-return trigger stays.
--   (c) petitions: INSERT (body_version_hash) goes. The composer no longer sends a hash; the server computes it.
--   (d) Refuses to run before the foundation migration (SQLSTATE 55000), so it can never remove a legacy path
--       whose replacement does not exist.
-- Contract: specs/r3-contract.md ("Release: expand / contract").
--
-- Migration order (5-step): no extensions, no tables; one function, then grants, then policies (RLS last).
-- ONE transaction; the schema_migrations ledger row is written in the SAME transaction.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026600000')
     OR to_regprocedure('public.update_safety_alert(uuid,text,integer,text,double precision,double precision,integer,text)') IS NULL
     OR to_regprocedure('public.decide_opt_in(uuid,text,text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.petitions'::regclass AND tgname = 'trg_petitions_guard') THEN
    RAISE EXCEPTION '20261026700000 requires 20261026600000_r3_foundation (update_safety_alert with a version token, decide_opt_in, trg_petitions_guard) to be applied first'
      USING ERRCODE = '55000';
  END IF;
END
$guard$;

-- (a) the alert update needs the version the caller saw
CREATE OR REPLACE FUNCTION public.update_safety_alert(p_alert_id uuid, p_type text DEFAULT NULL, p_severity integer DEFAULT NULL,
                                           p_description text DEFAULT NULL, p_lng double precision DEFAULT NULL,
                                           p_lat double precision DEFAULT NULL, p_expected_version integer DEFAULT NULL,
                                           p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := public.safety_alert_require_member(); v_now timestamptz := now();
  a public.safety_alerts; v_owner boolean; v_changed text[] := '{}'; v_sev text := 'same';
  n_type text; n_sev integer; n_desc text; n_loc geography; n_exp timestamptz; v_unverify boolean;
BEGIN
  IF p_expected_version IS NULL THEN RAISE EXCEPTION 'alert_field_required:expected_version' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.safety_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'PT404'; END IF;
  v_owner := a.created_by IS NOT NULL AND a.created_by = v_uid;                 -- a NULL owner is nobody
  IF NOT (v_owner OR public.current_user_tier_at_least('community_moderator')) THEN
    RAISE EXCEPTION 'not_alert_owner' USING ERRCODE = '42501'; END IF;
  IF a.status <> 'live' OR a.expires_at <= v_now THEN                           -- the live rule of the vote and the map
    RAISE EXCEPTION 'alert is no longer live' USING ERRCODE = 'PT410',
      DETAIL = jsonb_build_object('code', 'alert_not_live', 'status', a.status)::text; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> a.version THEN
    RAISE EXCEPTION 'edit_conflict' USING ERRCODE = 'PT409',
      DETAIL = jsonb_build_object('current_version', a.version, 'updated_at', a.updated_at)::text; END IF;
  IF char_length(btrim(p_note)) > 500 THEN RAISE EXCEPTION 'alert_field_invalid:note' USING ERRCODE = '22023'; END IF;

  n_type := COALESCE(p_type, a.alert_type);
  n_sev  := COALESCE(p_severity, a.severity);
  n_desc := CASE WHEN p_description IS NULL THEN a.description ELSE NULLIF(btrim(p_description), '') END;
  IF n_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'alert_field_invalid:type' USING ERRCODE = '22023'; END IF;
  IF n_sev NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'alert_field_invalid:severity' USING ERRCODE = '22023'; END IF;
  IF (p_lng IS NULL) <> (p_lat IS NULL) OR p_lng NOT BETWEEN -180 AND 180 OR p_lat NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION 'alert_field_invalid:location' USING ERRCODE = '22023'; END IF;
  n_loc := CASE WHEN p_lng IS NULL THEN a.location ELSE ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography END;

  IF n_type IS DISTINCT FROM a.alert_type  THEN v_changed := array_append(v_changed, 'alert_type');  END IF;
  IF n_sev  IS DISTINCT FROM a.severity    THEN v_changed := array_append(v_changed, 'severity');    END IF;
  IF n_desc IS DISTINCT FROM a.description THEN v_changed := array_append(v_changed, 'description'); END IF;
  IF NOT ST_Equals(n_loc::geometry, a.location::geometry) THEN v_changed := array_append(v_changed, 'location'); END IF;
  IF cardinality(v_changed) = 0 THEN RETURN public.safety_alert_public(a); END IF;   -- nothing changed: no version, no message

  -- expiry: raising severity restarts the window for the new level from this update; lowering it never extends the
  -- alert and caps what is left at the lower level's window; any other update keeps the current expiry
  IF n_sev > a.severity THEN    v_sev := 'escalated';    n_exp := v_now + public.safety_alert_ttl(n_sev);
  ELSIF n_sev < a.severity THEN v_sev := 'de_escalated'; n_exp := LEAST(a.expires_at, v_now + public.safety_alert_ttl(n_sev));
  ELSE n_exp := a.expires_at; END IF;
  IF n_exp IS DISTINCT FROM a.expires_at THEN v_changed := array_append(v_changed, 'expires_at'); END IF;
  -- publish-then-verify: ANY change by the reporter returns a verified alert to unverified (a lower severity alone
  -- included); a moderator's change of someone else's alert keeps the mark
  v_unverify := a.verified AND v_owner;

  UPDATE public.safety_alerts
     SET alert_type = n_type, severity = n_sev, description = n_desc, location = n_loc, expires_at = n_exp,
         version = a.version + 1, updated_at = v_now, update_count = a.update_count + 1,
         verified    = CASE WHEN v_unverify THEN false ELSE verified END,
         verified_by = CASE WHEN v_unverify THEN NULL ELSE verified_by END,
         verified_at = CASE WHEN v_unverify THEN NULL ELSE verified_at END
   WHERE id = a.id RETURNING * INTO a;
  PERFORM public.safety_alert_append(a, 'update', a.version - 1, v_changed, v_sev, v_uid,
                                     CASE WHEN v_owner THEN 'owner' ELSE 'moderator' END, p_note);
  IF NOT v_owner THEN       -- a moderator acting on someone else's alert: one audit row (an owner's write is its history row)
    PERFORM public.record_admin_action(v_uid, 'safety_alert.update', 'safety_alert', a.id::text, 'ok', NULLIF(btrim(p_note), ''),
      jsonb_build_object('version', a.version, 'changed', v_changed, 'severity_change', v_sev), public.request_id());
  END IF;
  RETURN public.safety_alert_public(a);
END $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- (b) opt-in decisions: decide_opt_in is the only way in. The read policy stays.
REVOKE UPDATE ON public.resource_opt_ins FROM PUBLIC, anon, authenticated;   -- table level: removes the UPDATE (status) column grant too

-- (b2) no client DELETE on opt-ins: a seeker leaves through withdraw_opt_in, an author lifts a decline through
-- unblock_opt_in (both take the post row first, then the opt-in row, as decide_opt_in does). A direct DELETE took
-- the two locks in the opposite order (opt-in row, then the post row in the slot trigger) and deadlocked with a
-- decide_opt_in made at the same moment (measured: 21 and 25 of 40 simultaneous pairs). No deployed client sends
-- it. The slot-return and trail triggers stay: they serve the two RPCs, cascades and account deletion. (The
-- policy's platform-admin branch already went in the foundation: removing a member's opt-in is service-side only.)
REVOKE DELETE ON public.resource_opt_ins FROM PUBLIC, anon, authenticated;

-- (c) petitions: the server's trigger is the only writer of the hash
REVOKE INSERT (body_version_hash) ON public.petitions FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies last: the two policies that served the paths closed above
-- ---------------------------------------------------------------------------
DROP POLICY opt_ins_update ON public.resource_opt_ins;
DROP POLICY opt_ins_delete ON public.resource_opt_ins;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261026700000', 'r3_contract');

COMMIT;
